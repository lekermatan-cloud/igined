import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { Env } from "../config";
import { z } from "zod";

const apiKeys = new Hono<{ Bindings: Env }>();

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

function generateApiKey(): { plainKey: string; hash: string; prefix: string; suffix: string } {
  const prefix = "sk_live_";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < 32; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const plainKey = prefix + randomPart;
  return { plainKey, hash: "", prefix, suffix: randomPart.slice(-5) };
}

export async function createApiKeyWithHash(name: string): Promise<{ plainKey: string; hash: string; prefix: string; suffix: string }> {
  const prefix = "sk_live_";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < 32; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const plainKey = prefix + randomPart;
  const keyBuffer = new TextEncoder().encode(plainKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  return { plainKey, hash, prefix, suffix: randomPart.slice(-5) };
}

apiKeys.get("/", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const supabase = createServiceClient(env);

  const { data: personalTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_id", authCtx.userId)
    .limit(1)
    .single();

  if (!personalTeam) {
    return c.json({ keys: [] });
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, key_suffix, last_used_at, created_at")
    .eq("team_id", personalTeam.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ keys: keys || [] });
});

apiKeys.post("/", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const body = await c.req.json();

  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const supabase = createServiceClient(env);

  const { data: personalTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_id", authCtx.userId)
    .limit(1)
    .single();

  if (!personalTeam) {
    return c.json({ error: "No team found" }, 400);
  }

  const { plainKey, hash, prefix, suffix } = await createApiKeyWithHash(parsed.data.name);

  const { data: key, error } = await supabase
    .from("api_keys")
    .insert({
      id: crypto.randomUUID(),
      team_id: personalTeam.id,
      created_by: authCtx.userId,
      name: parsed.data.name,
      key_prefix: prefix,
      key_suffix: suffix,
      key_hash: hash,
      scopes: ["documents:read", "documents:write", "signers:read", "signers:write"],
    })
    .select("id, name, key_prefix, key_suffix, created_at")
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({
    key: {
      ...key,
      plain_key: plainKey,
    },
  }, 201);
});

apiKeys.delete("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const keyId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: personalTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_id", authCtx.userId)
    .limit(1)
    .single();

  if (!personalTeam) {
    return c.json({ error: "No team found" }, 400);
  }

  const { error } = await supabase
    .from("api_keys")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .eq("team_id", personalTeam.id);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true });
});

export default apiKeys;