import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { createStorage } from "../lib/storage";
import { Env } from "../config";
import { z } from "zod";
import {
  sha256Hex,
  base64ToBuffer,
  generateQRCode,
} from "../lib/signing";
import { addAuditEntry } from "../lib/signing/audit";
import { getRFC3161Timestamp } from "../lib/signing/timestamp";
import { generateCertificatePDF, generateSignedPDF } from "../lib/signing/pdf";
import { getClientGeo, getClientIP, getClientUserAgent } from "../lib/geo";
import { EmailService } from "../lib/email";

const signing = new Hono<{ Bindings: Env }>();

const signSchema = z.object({
  signature_image: z.string().optional(),
  typed_text: z.string().optional(),
  field_values: z.record(z.string()).optional(),
  consent_text: z.string().min(50, "Consent text must be at least 50 characters"),
  forensic: z.object({
    ip: z.string().optional(),
    user_agent: z.string().optional(),
    geolocation: z
      .object({
        lat: z.number(),
        lng: z.number(),
        city: z.string().optional(),
        country: z.string().optional(),
      })
      .optional()
      .nullable(),
  }).optional(),
});

const verifySchema = z.object({
  hash: z.string().optional(),
  public_id: z.string().optional(),
}).refine((data) => data.hash || data.public_id, {
  message: "Either hash or public_id is required",
});

const issueCertificateSchema = z.object({
  document_id: z.string().uuid(),
});

signing.post("/sign", async (c) => {
  const env = c.env as Env;
  const supabase = createServiceClient(env);
  const storage = createStorage(env);

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  const { data: signer, error: signerErr } = await supabase
    .from("signers")
    .select("*, documents(*)")
    .eq("access_token", accessToken)
    .single();

  if (signerErr || !signer) {
    return c.json({ error: "Invalid signer token" }, 401);
  }

  if (signer.status === "signed") {
    return c.json({ error: "Already signed" }, 400);
  }

  const body = await c.req.json();
  const parsed = signSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0].message },
      400
    );
  }

  const { signature_image, typed_text, field_values, consent_text, forensic } = parsed.data;

  let signatureUrl: string | null = null;
  if (signature_image) {
    try {
      const buffer = base64ToBuffer(signature_image);
      const path = `signatures/${signer.document_id}/${signer.id}.png`;

      await storage.upload(buffer.buffer as ArrayBuffer, {
        bucket: "signatures",
        key: path,
        contentType: "image/png",
      });

      signatureUrl = await storage.getSignedUrl("signatures", path, 3600);
    } catch (err) {
      console.error("Failed to upload signature:", err);
    }
  }

  const signedAt = new Date().toISOString();

  const clientIP = getClientIP(c);
  const clientUserAgent = getClientUserAgent(c);
  const clientGeo = getClientGeo(c);
  
  const geoLocation = clientGeo 
    ? { lat: clientGeo.lat, lng: clientGeo.lng, city: clientGeo.city, country: clientGeo.country }
    : forensic?.geolocation || undefined;

  const { error: updateErr } = await supabase
    .from("signers")
    .update({
      status: "signed",
      signed_at: signedAt,
      signature_image_url: signatureUrl,
      signature_typed_text: typed_text || null,
      signature_method: signature_image ? "drawn" : "typed",
      ip_address: clientIP || forensic?.ip || null,
      user_agent: clientUserAgent || forensic?.user_agent || null,
      geolocation: geoLocation,
      consent_text_shown: consent_text,
      consent_accepted_at: signedAt,
    })
    .eq("id", signer.id);

  if (updateErr) {
    return c.json({ error: updateErr.message }, 500);
  }

  if (field_values) {
    for (const [fieldId, value] of Object.entries(field_values)) {
      await supabase
        .from("document_fields")
        .update({ filled_value: String(value), filled_at: signedAt })
        .eq("id", fieldId);
    }

    await supabase
      .from("signers")
      .update({ field_values: field_values })
      .eq("id", signer.id);
  }

  await addAuditEntry(supabase, {
    document_id: signer.document_id,
    signer_id: signer.id,
    event_type: "signed",
    event_data: {
      signature_method: signature_image ? "drawn" : "typed",
      consent_length: consent_text.length,
    },
    ip_address: clientIP || forensic?.ip,
    user_agent: clientUserAgent || forensic?.user_agent,
    geolocation: geoLocation,
  });

  const emailService = new EmailService(env);

  const certificateUrl = `${env.APP_URL || "https://sigined.com"}/verify?public_id=${signer.document_id}`;

  try {
    await emailService.sendSigningConfirmation(
      { name: signer.name, email: signer.email, role_label: signer.role_label },
      { name: signer.documents.name },
      certificateUrl
    );
  } catch (err) {
    console.error("Failed to send signing confirmation email:", err);
  }

  const { data: allSigners } = await supabase
    .from("signers")
    .select("status")
    .eq("document_id", signer.document_id);

  const allSigned = allSigners?.every((s) => s.status === "signed");

  if (allSigned) {
    await supabase
      .from("documents")
      .update({
        status: "completed",
        completed_at: signedAt,
      })
      .eq("id", signer.document_id);

    try {
      await issueCertificate(supabase, env, signer.document_id);
    } catch (err) {
      console.error("Failed to issue certificate:", err);
    }

    try {
      const { data: allFields } = await supabase
        .from("document_fields")
        .select("id, page_number, x_percent, y_percent, width_px, height_px, field_type, filled_value, signer_id")
        .eq("document_id", signer.document_id)
        .not("filled_value", "is", null);

      const { data: allSignersWithSigs } = await supabase
        .from("signers")
        .select("id, name, signature_image_url")
        .eq("document_id", signer.document_id);

      const signedKey = await generateSignedPDF(
        supabase,
        env,
        { id: signer.document_id, name: signer.documents.name, team_id: signer.documents.team_id, mime_type: signer.documents.mime_type },
        allFields || [],
        allSignersWithSigs || []
      );

      if (signedKey) {
        await supabase
          .from("documents")
          .update({ signed_file_url: signedKey })
          .eq("id", signer.document_id);
      }
    } catch (err) {
      console.error("Failed to generate signed PDF:", err);
    }

    try {
      const { data: team } = await supabase
        .from("teams")
        .select("owner_id")
        .eq("id", signer.documents.team_id)
        .single();

      if (team) {
        const { data: owner } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", team.owner_id)
          .single();

        if (owner && owner.email) {
          await emailService.sendDocumentCompletedNotification(
            { name: owner.full_name || owner.email, email: owner.email },
            { name: signer.documents.name },
            allSigners?.length || 0
          );
        }
      }
    } catch (err) {
      console.error("Failed to send completion notification:", err);
    }
  }

  return c.json({
    success: true,
    signed_at: signedAt,
    all_signed: allSigned,
  });
});

signing.get("/document", async (c) => {
  const env = c.env as Env;
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  const supabase = createServiceClient(env);
  const storage = createStorage(env);

  const { data: signer, error: signerErr } = await supabase
    .from("signers")
    .select(`
      *,
      documents(
        id,
        name,
        file_url,
        file_size_bytes,
        file_type,
        mime_type,
        status,
        sha256_hash,
        team_id
      )
    `)
    .eq("access_token", token)
    .single();

  if (signerErr || !signer) {
    console.error("Signer lookup error:", signerErr);
    return c.json({ error: "Invalid or expired signing link" }, 404);
  }

  if (!signer.documents) {
    console.error("Document not found for signer:", signer.id);
    return c.json({ error: "Document not found" }, 404);
  }

  if (signer.expires_at && new Date(signer.expires_at) < new Date()) {
    return c.json({ error: "This signing link has expired" }, 410);
  }

  const { data: allFields } = await supabase
    .from("document_fields")
    .select("*")
    .eq("document_id", signer.document_id);

  const signerFields = (allFields || []).filter(
    (f: Record<string, unknown>) => !f.signer_id || f.signer_id === signer.id
  );

  let signedUrl = null;
  try {
    const storageKey = `teams/${signer.documents.team_id || 'personal'}/documents/${signer.documents.id}/original`;
    signedUrl = await storage.getSignedUrl("documents", storageKey, 3600);
  } catch (err) {
    console.error("Failed to get signed URL:", err);
  }

  return c.json({
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      role_label: signer.role_label,
      status: signer.status,
      field_values: signer.field_values || {},
    },
    document: {
      ...signer.documents,
      file_url: signedUrl,
    },
    fields: signerFields,
  });
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleVerify(env: Env, hash?: string, public_id?: string) {
  const supabase = createServiceClient(env);

  let cert;
  if (hash) {
    const { data } = await supabase
      .from("certificates")
      .select(
        "*, documents(id, name, file_size_bytes, file_type, completed_at, team_id)"
      )
      .or(`cert_hash.eq.${hash},document_hash.eq.${hash}`)
      .single();
    cert = data;
  } else if (public_id) {
    const { data } = await supabase
      .from("certificates")
      .select(
        "*, documents(id, name, file_size_bytes, file_type, completed_at, team_id)"
      )
      .eq("public_url", public_id)
      .single();
    cert = data;

    if (!cert && UUID_PATTERN.test(public_id)) {
      const { data: docCert } = await supabase
        .from("certificates")
        .select(
          "*, documents(id, name, file_size_bytes, file_type, completed_at, team_id)"
        )
        .eq("document_id", public_id)
        .single();
      cert = docCert;
    }
  }

  if (!cert) {
    return { valid: false, message: "Document not found in registry" };
  }

  return {
    valid: true,
    document: {
      name: cert.documents?.name,
      type: cert.documents?.file_type,
      size_bytes: cert.documents?.file_size_bytes,
      completed_at: cert.documents?.completed_at,
    },
    certificate: {
      hash: cert.cert_hash,
      issued_at: cert.issued_at_utc,
      compliance_level: cert.compliance_level,
      has_tsa_timestamp: !!cert.rfc3161_token,
      tsa_authority: cert.rfc3161_authority,
    },
  };
}

signing.post("/verify", async (c) => {
  const env = c.env as Env;

  const body = await c.req.json();
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0].message },
      400
    );
  }

  const { hash, public_id } = parsed.data;
  const result = await handleVerify(env, hash, public_id);
  return c.json(result);
});

signing.get("/verify", async (c) => {
  const env = c.env as Env;
  const public_id = c.req.query("public_id");
  const hash = c.req.query("hash");

  if (!public_id && !hash) {
    return c.json({ error: "Either public_id or hash query parameter is required" }, 400);
  }

  const result = await handleVerify(env, hash, public_id);
  return c.json(result);
});

signing.get("/verify/:public_id", async (c) => {
  const env = c.env as Env;
  const public_id = c.req.param("public_id");
  const result = await handleVerify(env, undefined, public_id);
  return c.json(result);
});

signing.post("/certificate/:document_id", async (c) => {
  const env = c.env as Env;
  const supabase = createServiceClient(env);
  const documentId = c.req.param("document_id");

  try {
    const cert = await issueCertificate(supabase, env, documentId);
    return c.json({ success: true, certificate: cert });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to issue certificate" },
      500
    );
  }
});

async function issueCertificate(
  supabase: ReturnType<typeof createServiceClient>,
  env: Env,
  documentId: string
) {
  const { data: doc } = await supabase
    .from("documents")
    .select("*, signers(*)")
    .eq("id", documentId)
    .single();

  if (!doc) {
    throw new Error("Document not found");
  }

  const signersData = (doc.signers || [])
    .filter((s: Record<string, unknown>) => s.status === "signed")
    .map((s: Record<string, unknown>) => ({
      name: s.name,
      email: s.email,
      signed_at: s.signed_at,
      ip: s.ip_address,
      consent: s.consent_text_shown,
    }))
    .sort((a: Record<string, string>, b: Record<string, string>) =>
      a.email.localeCompare(b.email)
    );

  const signersJson = JSON.stringify(signersData);
  const signersHash = await sha256Hex(signersJson);

  const utcNow = new Date().toISOString();
  const certData = `${doc.sha256_hash}|${signersHash}|${utcNow}`;
  const certHash = await sha256Hex(certData);

  let rfc3161Token: string | null = null;
  let rfc3161Authority: string | null = null;

  const tsaUrl = env.TSA_URL || "https://freetsa.org/tsr";

  try {
    const tsaResult = await getRFC3161Timestamp(certHash, tsaUrl);
    rfc3161Token = tsaResult.token;
    rfc3161Authority = tsaResult.authority;
  } catch (err) {
    console.error("TSA timestamp failed:", err);
  }

  const complianceLevel = rfc3161Token ? "qualified" : "advanced";

  const publicId = crypto.randomUUID().replace(/-/g, "").substring(0, 24);
  const qrCodeUrl = await generateQRCode(`https://sigil.app/verify/${publicId}`);

  const { data: cert, error: certErr } = await supabase
    .from("certificates")
    .insert({
      document_id: documentId,
      cert_hash: certHash,
      document_hash: doc.sha256_hash,
      signers_hash: signersHash,
      rfc3161_token: rfc3161Token,
      rfc3161_authority: rfc3161Authority,
      issued_at_utc: utcNow,
      public_url: publicId,
      qr_code_url: qrCodeUrl,
      compliance_level: complianceLevel,
    })
    .select()
    .single();

  if (certErr) {
    throw certErr;
  }

  try {
    const pdfUrl = await generateCertificatePDF(supabase, env, doc, cert);
    if (pdfUrl) {
      await supabase
        .from("certificates")
        .update({ pdf_url: pdfUrl })
        .eq("id", cert.id);
    }
  } catch (err) {
    console.error("Failed to generate PDF:", err);
  }

  await addAuditEntry(supabase, {
    document_id: documentId,
    event_type: "certified",
    event_data: {
      cert_hash: certHash,
      compliance_level: complianceLevel,
      has_tsa_timestamp: !!rfc3161Token,
    },
  });

  return cert;
}

export default signing;