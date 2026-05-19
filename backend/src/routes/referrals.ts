import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { Env } from "../config";

const referrals = new Hono<{ Bindings: Env }>();

referrals.get("/stats", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const supabase = createServiceClient(env);

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", authCtx.userId)
    .single();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const { data: referredUsers } = await supabase
    .from("profiles")
    .select("id, created_at, full_name, email")
    .eq("referred_by", authCtx.userId)
    .order("created_at", { ascending: false });

  const referredUserIds = (referredUsers || []).map(u => u.id);

  const { count: signedCount } = await supabase
    .from("signers")
    .select("id", { count: "exact", head: true })
    .in("user_id", referredUserIds)
    .eq("status", "signed");

  const stats = {
    invited: (referredUsers || []).length,
    joined: signedCount || 0,
  };

  return c.json({
    referral_code: profile.referral_code,
    referral_url: `https://sigined.com/ref/${profile.referral_code}`,
    stats,
    referred_users: referredUsers || [],
  });
});

referrals.get("/validate/:code", async (c) => {
  const env = c.env as Env;
  const code = c.req.param("code");

  if (!code) {
    return c.json({ valid: false, error: "Code required" }, 400);
  }

  const supabase = createServiceClient(env);

  const { data: referrer } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("referral_code", code)
    .single();

  if (!referrer) {
    return c.json({ valid: false, error: "Invalid referral code" }, 404);
  }

  return c.json({
    valid: true,
    referrer_name: referrer.full_name,
  });
});

export default referrals;