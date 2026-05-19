import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { Env } from "../config";

const dashboard = new Hono<{ Bindings: Env }>();

dashboard.get("/stats", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const supabase = createServiceClient(env);

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, onboarding_upload, onboarding_sign, onboarding_invite, onboarding_api, onboarding_brand")
    .eq("id", authCtx.userId)
    .single();

  const { data: personalTeam } = await supabase
    .from("teams")
    .select("id, logo_url, brand_color")
    .eq("owner_id", authCtx.userId)
    .limit(1)
    .single();

  const teamId = personalTeam?.id;

  const { count: totalDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authCtx.userId);

  const { count: signedDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authCtx.userId)
    .eq("status", "completed");

  const { count: pendingDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authCtx.userId)
    .in("status", ["sent", "in_progress"]);

  const { count: draftDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authCtx.userId)
    .eq("status", "draft");

  const { count: certificates } = await supabase
    .from("certificates")
    .select("id", { count: "exact", head: true })
    .eq("issued_for_user_id", authCtx.userId);

  const { count: teamMembers } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  const { count: apiKeys } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authCtx.userId);

  const onboarding = {
    upload: totalDocs! > 0,
    sign: signedDocs! > 0,
    invite: teamMembers! > 1,
    api: apiKeys! > 0,
    brand: !!(personalTeam?.logo_url && personalTeam?.brand_color !== "#c8924a"),
  };

  const onboardingCompleted = Object.values(onboarding).every(Boolean);

  if (profile) {
    const updateData: Record<string, unknown> = { onboarding_completed: onboardingCompleted };
    if (!profile.onboarding_upload && onboarding.upload) updateData.onboarding_upload = true;
    if (!profile.onboarding_sign && onboarding.sign) updateData.onboarding_sign = true;
    if (!profile.onboarding_invite && onboarding.invite) updateData.onboarding_invite = true;
    if (!profile.onboarding_api && onboarding.api) updateData.onboarding_api = true;
    if (!profile.onboarding_brand && onboarding.brand) updateData.onboarding_brand = true;

    if (Object.keys(updateData).length > 1) {
      await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", authCtx.userId);
    }
  }

  const { data: recentDocs } = await supabase
    .from("documents")
    .select("id, name, status, created_at, mime_type")
    .eq("created_by", authCtx.userId)
    .order("created_at", { ascending: false })
    .limit(5);

  return c.json({
    stats: {
      documents_total: totalDocs || 0,
      documents_signed: signedDocs || 0,
      documents_pending: pendingDocs || 0,
      documents_draft: draftDocs || 0,
      certificates: certificates || 0,
      team_members: teamMembers || 0,
    },
    onboarding,
    onboarding_completed: onboardingCompleted,
    recent_documents: recentDocs || [],
  });
});

export default dashboard;