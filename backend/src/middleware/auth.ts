import { Context, Next } from "hono";
import { createServiceClient } from "../lib/supabase";
import { verifyToken } from "../lib/jwt";
import { Env, AuthContext } from "../config";

export async function authMiddleware(c: Context, next: Next) {
  const env = c.env as Env;
  
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  if (token.startsWith("sk_live_")) {
    return await apiKeyAuth(c, next, token, env);
  }

  const payload = await verifyToken(env, token);

  if (!payload || !payload.userId || !payload.email) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const supabase = createServiceClient(env);
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", payload.userId)
    .single();

  const authContext: AuthContext = {
    userId: payload.userId as string,
    email: payload.email as string,
    isAdmin: profile?.is_admin || false,
    teamId: undefined,
  };

  const { data: personalTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_id", payload.userId as string)
    .limit(1)
    .single();

  if (personalTeam) {
    authContext.teamId = personalTeam.id;
  }

  c.set("auth", authContext);
  await next();
}

async function apiKeyAuth(c: Context, next: Next, plainKey: string, env: Env) {
  const keyBuffer = new TextEncoder().encode(plainKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  
  const supabase = createServiceClient(env);

  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, team_id, scopes, is_active, revoked_at, created_by")
    .eq("key_hash", hash)
    .single();

  if (!apiKey) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  if (!apiKey.is_active || apiKey.revoked_at) {
    return c.json({ error: "API key is inactive or revoked" }, 401);
  }

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id);

  const { data: team } = await supabase
    .from("teams")
    .select("owner_id")
    .eq("id", apiKey.team_id)
    .single();

  c.set("auth", {
    userId: apiKey.created_by,
    email: "",
    isAdmin: false,
    teamId: apiKey.team_id,
    isOwner: team?.owner_id === apiKey.created_by,
    scopes: apiKey.scopes || [],
    apiKeyId: apiKey.id,
  });
  await next();
}

export function requireAuth(c: Context): AuthContext {
  const auth = c.get("auth");
  if (!auth) {
    throw new Error("Auth context not set");
  }
  return auth as AuthContext;
}

export function requireAdmin(c: Context): AuthContext {
  const auth = requireAuth(c);
  if (!auth.isAdmin) {
    throw new Error("Admin access required");
  }
  return auth;
}