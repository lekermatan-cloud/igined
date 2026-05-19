import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth, requireAdmin } from "../middleware/auth";
import { Env } from "../config";
import { z } from "zod";

const users = new Hono<{ Bindings: Env }>();

const updateProfileSchema = z.object({
  full_name: z.string().optional(),
  phone: z.string().optional(),
  country_code: z.string().optional(),
  preferred_language: z.string().optional(),
  timezone: z.string().optional(),
  avatar_url: z.string().url().optional(),
  professional_role: z.string().optional(),
  bar_number: z.string().optional(),
  company_name: z.string().optional(),
  company_id: z.string().optional(),
  whatsapp_number: z.string().optional(),
  whatsapp_opted_in: z.boolean().optional(),
  saved_signature_url: z.string().optional().nullable(),
  notify_doc_signed: z.boolean().optional(),
  notify_signature_reminders: z.boolean().optional(),
  notify_new_features: z.boolean().optional(),
});

users.get("/me", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  const supabase = createServiceClient(env);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authCtx.userId)
    .single();

  if (error || !profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  if (profile.saved_signature_url && profile.saved_signature_url.includes("/public/")) {
    const storageKey = `profiles/${authCtx.userId}/signature.png`;
    const { data: urlData } = await supabase.storage
      .from("signatures")
      .createSignedUrl(storageKey, 315360000);
    if (urlData?.signedUrl) {
      profile.saved_signature_url = urlData.signedUrl;
    }
  }

  return c.json(profile);
});

users.patch("/me", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const body = await c.req.json();

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const supabase = createServiceClient(env);

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authCtx.userId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(profile);
});

users.patch("/me/avatar", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  let formData: FormData;
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    formData = await c.req.formData();
  } else {
    const body = await c.req.json();
    formData = new FormData();
    formData.append("avatar_url", body.avatar_url || "");
  }

  const avatarUrl = formData.get("avatar_url");
  if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.startsWith("data:")) {
    const base64Data = avatarUrl.split(",")[1];
    if (!base64Data) {
      return c.json({ error: "Invalid image data" }, 400);
    }
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const fileBuffer = bytes.buffer;
    const storageKey = `avatars/${authCtx.userId}/${Date.now()}.png`;

    const supabase = createServiceClient(env);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storageKey, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return c.json({ error: uploadError.message }, 400);
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(uploadData.path);

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", authCtx.userId)
      .select("avatar_url")
      .single();

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ avatar_url: profile.avatar_url });
  }

  const directUrl = avatarUrl ? String(avatarUrl) : null;
  if (!directUrl) {
    return c.json({ error: "No avatar data provided" }, 400);
  }

  const supabase = createServiceClient(env);
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ avatar_url: directUrl, updated_at: new Date().toISOString() })
    .eq("id", authCtx.userId)
    .select("avatar_url")
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ avatar_url: profile.avatar_url });
});

users.post("/me/signature", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const body = await c.req.json();

  const signatureDataUrl = body.signature_url;
  if (!signatureDataUrl || typeof signatureDataUrl !== "string") {
    return c.json({ error: "No signature data provided" }, 400);
  }

  if (!signatureDataUrl.startsWith("data:")) {
    const { data: profile, error } = await createServiceClient(env)
      .from("profiles")
      .update({ saved_signature_url: signatureDataUrl, updated_at: new Date().toISOString() })
      .eq("id", authCtx.userId)
      .select("saved_signature_url")
      .single();

    if (error) return c.json({ error: error.message }, 400);
    return c.json({ signature_url: profile.saved_signature_url });
  }

  const base64Data = signatureDataUrl.split(",")[1];
  if (!base64Data) {
    return c.json({ error: "Invalid image data" }, 400);
  }

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const supabase = createServiceClient(env);
  const storageKey = `profiles/${authCtx.userId}/signature.png`;

  const { error: uploadError } = await supabase.storage
    .from("signatures")
    .upload(storageKey, bytes.buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    return c.json({ error: uploadError.message }, 400);
  }

  const { data: urlData } = await supabase.storage
    .from("signatures")
    .createSignedUrl(storageKey, 315360000); // 10 years

  if (!urlData?.signedUrl) {
    return c.json({ error: "Failed to generate signed URL" }, 500);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ saved_signature_url: urlData.signedUrl, updated_at: new Date().toISOString() })
    .eq("id", authCtx.userId)
    .select("saved_signature_url")
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ signature_url: profile.saved_signature_url });
});

users.get("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAuth(c);
  const userId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, professional_role, company_name, created_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(profile);
});

users.get("/", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  if (!authCtx.isAdmin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const supabase = createServiceClient(env);

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ users: profiles });
});

users.patch("/:id/suspend", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAdmin(c);
  const userId = c.req.param("id");
  const body = await c.req.json();

  const { reason } = body;
  if (!reason) {
    return c.json({ error: "Suspension reason is required" }, 400);
  }

  const supabase = createServiceClient(env);

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      is_suspended: true,
      suspension_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(profile);
});

users.patch("/:id/activate", authMiddleware, async (c) => {
  const env = c.env as Env;
  requireAdmin(c);
  const userId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      is_suspended: false,
      suspension_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(profile);
});

export default users;