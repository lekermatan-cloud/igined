import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { createStorage } from "../lib/storage";
import { Env } from "../config";
import { z } from "zod";
import { EmailService } from "../lib/email";
import { sha256Hex } from "../lib/signing/crypto";

const documents = new Hono<{ Bindings: Env }>();

const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  team_id: z.string().uuid().optional(),
});

const sendDocumentSchema = z.object({
  signers: z.array(z.object({
    email: z.string().email(),
    name: z.string().min(1).max(255),
    role_label: z.enum(["signer", "witness", "approver", "cc"]).default("signer"),
    signing_order: z.number().int().min(0).default(0),
  })),
  message: z.string().max(2000).optional(),
  expires_in_days: z.number().int().positive().optional(),
});

documents.post("/", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  const contentType = c.req.header("Content-Type") || "";
  const disposition = c.req.header("Content-Disposition") || "";

  let fileName = "document.pdf";
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) {
      fileName = match[1].replace(/['"]/g, "");
    }
  }

  let fileBuffer: ArrayBuffer | undefined;
  let docTeamId: string | undefined;
  let docName: string = "";
  let fileMimeType = "application/octet-stream";

  try {
    const body = await c.req.parseBody({ all: true });
    
    const file = body["file"];
    if (!file || !(file instanceof File) || file.size === 0) {
      return c.json({ error: "File is required" }, 400);
    }

    fileMimeType = file.type || "application/octet-stream";

    if (!fileName || fileName === "document.pdf") {
      fileName = file.name;
    }

    fileBuffer = await file.arrayBuffer();

    const nameField = body["name"];
    if (typeof nameField !== "string" || !nameField.trim()) {
      return c.json({ error: "Name is required" }, 400);
    }
    docName = nameField.trim();

    docTeamId = typeof body["team_id"] === "string" ? body["team_id"] : undefined;

    const parsed = createDocumentSchema.safeParse({
      name: docName,
      team_id: docTeamId,
    });

    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    docTeamId = parsed.data.team_id;

    if (!docTeamId) {
      const supabase = createServiceClient(env);
      const { data: personalTeam } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", authCtx.userId)
        .limit(1)
        .single();

      docTeamId = personalTeam?.id;

      if (!docTeamId) {
        return c.json({ error: "No team found. Please create a team first." }, 400);
      }
    }
  } catch (err) {
    return c.json({ error: "Failed to parse request body" }, 400);
  }

  const docId = crypto.randomUUID();
  const storageKey = `teams/${docTeamId}/documents/${docId}/original`;

  const storage = createStorage(env);

  try {
    const uploaded = await storage.upload(fileBuffer, {
      bucket: "documents",
      key: storageKey,
      contentType: contentType || "application/octet-stream",
      metadata: {
        original_name: fileName,
        doc_id: docId,
      },
    });

    const supabase = createServiceClient(env);

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        id: docId,
        name: docName,
        file_url: uploaded.url,
        file_size_bytes: uploaded.size,
        file_type: fileMimeType,
        mime_type: fileMimeType,
        sha256_hash: await sha256Hex(fileBuffer),
        status: "draft",
        created_by: authCtx.userId,
        team_id: docTeamId,
      })
      .select()
      .single();

    if (error) {
      await storage.delete("documents", storageKey);
      return c.json({ error: error.message }, 400);
    }

    return c.json(doc, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      500
    );
  }
});

documents.get("/", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAuth(c);

  const teamId = c.req.query("team_id");

  const supabase = createServiceClient(env);

  let query = supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data: docs, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ documents: docs });
});

documents.get("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAuth(c);
  const docId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", docId)
    .single();

  if (error || !doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  return c.json(doc);
});

documents.get("/:id/download", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAuth(c);
  const docId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, file_url, name, mime_type, team_id, status, signed_file_url")
    .eq("id", docId)
    .single();

  if (error || !doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const storage = createStorage(env);
  const mimeExt: Record<string, string> = {
    "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg",
    "image/jpg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
    "image/svg+xml": ".svg", "video/mp4": ".mp4", "video/webm": ".webm",
    "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/wav": ".wav",
    "audio/ogg": ".ogg", "text/plain": ".txt", "text/csv": ".csv",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };

  const ext = mimeExt[doc.mime_type] || "";
  const baseName = doc.name?.trim() || `document-${docId}`;
  const downloadName = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;

  if (doc.status === "completed" && doc.signed_file_url) {
    const finalUrl = await storage.getSignedUrl("documents", doc.signed_file_url, 3600, downloadName);
    return c.json({ download_url: finalUrl, expires_in: 3600 });
  }

  const storageKey = `teams/${doc.team_id || 'personal'}/documents/${docId}/original`;

  try {
    const signedUrl = await storage.getSignedUrl("documents", storageKey, 3600, downloadName);
    return c.json({ download_url: signedUrl, expires_in: 3600 });
  } catch (err) {
    return c.json({ error: "Failed to generate download URL" }, 500);
  }
});

documents.patch("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAuth(c);
  const docId = c.req.param("id");

  const body = await c.req.json();

  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    status: z.enum(["draft", "pending", "completed", "cancelled"]).optional(),
  });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const supabase = createServiceClient(env);

  const { data: doc, error } = await supabase
    .from("documents")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(doc);
});

documents.delete("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAuth(c);
  const docId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, file_url, team_id")
    .eq("id", docId)
    .single();

  if (fetchError || !doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const storage = createStorage(env);
  const storageKey = `teams/${doc.team_id || 'personal'}/documents/${docId}/original`;

  try {
    await storage.delete("documents", storageKey);
  } catch {
    console.error("Failed to delete file from storage");
  }

  // Delete audit log entries first to avoid FK violation
  await supabase.from("audit_log").delete().eq("document_id", docId);

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId);

  if (deleteError) {
    return c.json({ error: deleteError.message }, 400);
  }

  return c.json({ success: true });
});

documents.get("/:id/fields", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const docId = c.req.param("id");
  const supabase = createServiceClient(env);

  const { data: doc } = await supabase
    .from("documents")
    .select("team_id")
    .eq("id", docId)
    .single();

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", doc.team_id)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  if (!membership) {
    const { data: teamOwner } = await supabase
      .from("teams")
      .select("id")
      .eq("id", doc.team_id)
      .eq("owner_id", authCtx.userId)
      .maybeSingle();

    if (!teamOwner) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else if (!["owner", "admin", "editor", "viewer"].includes(membership.role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { data: fields, error } = await supabase
    .from("document_fields")
    .select("*")
    .eq("document_id", docId);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ fields: fields || [] });
});

documents.post("/:id/fields", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const docId = c.req.param("id");
  const supabase = createServiceClient(env);

  const { data: doc } = await supabase
    .from("documents")
    .select("team_id, status")
    .eq("id", docId)
    .single();

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", doc.team_id)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  if (!membership) {
    const { data: teamOwner } = await supabase
      .from("teams")
      .select("id")
      .eq("id", doc.team_id)
      .eq("owner_id", authCtx.userId)
      .maybeSingle();

    if (!teamOwner) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else if (!["owner", "admin", "editor"].includes(membership.role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Can only modify fields on draft documents" }, 400);
  }

  const body = await c.req.json();
  const fieldSchema = z.object({
    signer_id: z.string().uuid().nullable().optional(),
    field_type: z.enum(["signature", "initials", "date", "text", "checkbox", "name", "email"]),
    page_number: z.number().int().positive().default(1),
    x_percent: z.number().min(0).max(100),
    y_percent: z.number().min(0).max(100),
    width_px: z.number().int().positive(),
    height_px: z.number().int().positive(),
    is_required: z.boolean().default(true),
  });

  const fieldsData = body.fields as unknown[];
  if (!Array.isArray(fieldsData)) {
    return c.json({ error: "Fields must be an array" }, 400);
  }

  const parsedFields = [];
  for (const field of fieldsData) {
    const parsed = fieldSchema.safeParse(field);
    if (!parsed.success) {
      return c.json({ error: `Invalid field: ${parsed.error.issues[0].message}` }, 400);
    }
    parsedFields.push({
      document_id: docId,
      ...parsed.data,
    });
  }

  await supabase.from("document_fields").delete().eq("document_id", docId);

  const { data: createdFields, error: insertError } = await supabase
    .from("document_fields")
    .insert(parsedFields)
    .select();

  if (insertError) {
    return c.json({ error: "Failed to create fields: " + insertError.message }, 400);
  }

  return c.json({ fields: createdFields, success: true });
});

documents.post("/:id/send", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const docId = c.req.param("id");
  const supabase = createServiceClient(env);

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, name, status, team_id")
    .eq("id", docId)
    .single();

  if (docError || !doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", doc.team_id)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  if (!membership) {
    const { data: teamOwner } = await supabase
      .from("teams")
      .select("id")
      .eq("id", doc.team_id)
      .eq("owner_id", authCtx.userId)
      .maybeSingle();

    if (!teamOwner) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else if (!["owner", "admin", "editor"].includes(membership.role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const parsed = sendDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  if (parsed.data.signers.length === 0) {
    return c.json({ error: "At least one signer is required" }, 400);
  }

  const { data: existingFields } = await supabase
    .from("document_fields")
    .select("id")
    .eq("document_id", docId);

  if (!existingFields || existingFields.length === 0) {
    return c.json({ 
      error: "Please add signature fields before sending. Use PATCH /documents/:id/fields to define fields.",
      code: "FIELDS_REQUIRED"
    }, 400);
  }

  const expiresAt = parsed.data.expires_in_days
    ? new Date(Date.now() + parsed.data.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const signers = parsed.data.signers.map(s => ({
    document_id: docId,
    email: s.email.toLowerCase(),
    name: s.name,
    role_label: s.role_label,
    signing_order: s.signing_order,
    access_token: crypto.randomUUID(),
    status: "pending",
    invited_at: new Date().toISOString(),
    expires_at: expiresAt,
  }));

  const { data: createdSigners, error: signerError } = await supabase
    .from("signers")
    .insert(signers)
    .select();

  if (signerError) {
    return c.json({ error: "Failed to create signers: " + signerError.message }, 400);
  }

  await supabase
    .from("documents")
    .update({
      status: "sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", authCtx.userId)
    .single();

  const emailService = new EmailService(env);

  for (const signer of createdSigners || []) {
    try {
      await emailService.sendSignerInvite(signer, doc, profile, parsed.data.message);
    } catch (err) {
      console.error(`Failed to send invite to ${signer.email}:`, err);
    }
  }

  return c.json({
    success: true,
    signers: createdSigners,
    message: `Document sent to ${createdSigners?.length || 0} signer(s)`,
  });
});

documents.get("/:id/signers", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const docId = c.req.param("id");
  const supabase = createServiceClient(env);

  const { data: doc } = await supabase
    .from("documents")
    .select("team_id")
    .eq("id", docId)
    .single();

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", doc.team_id)
    .eq("user_id", authCtx.userId)
    .maybeSingle();

  if (!membership) {
    const { data: teamOwner } = await supabase
      .from("teams")
      .select("id")
      .eq("id", doc.team_id)
      .eq("owner_id", authCtx.userId)
      .maybeSingle();

    if (!teamOwner) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else if (!["owner", "admin", "editor", "viewer"].includes(membership.role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { data: signers, error } = await supabase
    .from("signers")
    .select("*")
    .eq("document_id", docId)
    .order("signing_order", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ signers });
});

documents.post("/:id/self-sign", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const docId = c.req.param("id");
  const supabase = createServiceClient(env);

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, name, status, team_id")
    .eq("id", docId)
    .single();

  if (docError || !doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Only draft documents can be self-signed" }, 400);
  }

  let teamId = doc.team_id;
  console.log("Self-sign debug - doc.team_id:", doc.team_id);
  if (!teamId) {
    const { data: personalTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("owner_id", authCtx.userId)
      .limit(1)
      .single();
    
    console.log("Self-sign debug - personalTeam:", personalTeam);
    if (personalTeam) {
      teamId = personalTeam.id;
    } else {
      return c.json({ error: "No team found. Please create a team first." }, 400);
    }
  }

  console.log("Self-sign debug - final teamId:", teamId);

  const { data: membership } = await supabase
    .from("team_members")
    .select("role, profiles(full_name, email)")
    .eq("team_id", teamId)
    .eq("user_id", authCtx.userId)
    .single();

  console.log("Self-sign debug:", { teamId, userId: authCtx.userId, membership });

  if (!membership) {
    const { data: teamOwner } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("owner_id", authCtx.userId)
      .single();
    
    if (!teamOwner) {
      return c.json({ error: "Access denied: not a team member or owner", debug: { teamId, userId: authCtx.userId } }, 403);
    }
  } else if (!["owner", "admin", "editor"].includes(membership.role)) {
    return c.json({ error: `Access denied: role '${membership.role}' not allowed` }, 403);
  }

  let profile: { full_name: string; email: string } | null = null;
  if (membership?.profiles) {
    profile = membership.profiles as unknown as { full_name: string; email: string };
  } else {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", authCtx.userId)
      .single();
    profile = userProfile;
  }

  const signerName = profile?.full_name || authCtx.userId;
  const signerEmail = profile?.email || `${authCtx.userId}@self-sign`;
  console.log("Signer email for lookup:", signerEmail.toLowerCase());

  const { data: existingSigner, error: existingSignerError } = await supabase
    .from("signers")
    .select("id, access_token, status")
    .eq("document_id", docId)
    .eq("email", signerEmail.toLowerCase())
    .maybeSingle();

  console.log("Existing signer check:", { existingSigner, existingSignerError, signerEmail: signerEmail.toLowerCase() });

  if (existingSigner) {
    if (existingSigner.status === "signed") {
      return c.json({ error: "You have already signed this document" }, 400);
    }
    
    // If no access_token, generate a new one
    if (!existingSigner.access_token) {
      const newToken = crypto.randomUUID();
      await supabase
        .from("signers")
        .update({ access_token: newToken })
        .eq("id", existingSigner.id);
      
      console.log("Generated new token for existing signer");
      return c.json({
        signing_token: newToken,
        message: "New signing token generated",
      });
    }
    
    console.log("Returning existing token:", existingSigner.access_token);
    return c.json({
      signing_token: existingSigner.access_token,
      message: "Use existing signing token",
    });
  }

  const accessToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newSigner, error: signerError } = await supabase
    .from("signers")
    .insert({
      document_id: docId,
      email: signerEmail.toLowerCase(),
      name: signerName,
      role_label: "signer",
      signing_order: 0,
      status: "pending",
      access_token: accessToken,
      invited_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select()
    .single();

  console.log("Self-sign create signer:", { newSigner, signerError });

  if (signerError) {
    return c.json({ error: "Failed to create signer: " + signerError.message }, 500);
  }

  await supabase
    .from("documents")
    .update({
      status: "sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);

  console.log("Self-sign returning:", { signing_token: accessToken });

  return c.json({
    signing_token: accessToken,
    signer: newSigner,
    message: "Self-sign token created. Redirect to signing page.",
  });
});

export default documents;