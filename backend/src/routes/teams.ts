import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { Env } from "../config";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getUserTeamRole(supabase: SupabaseClient, teamId: string, userId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (membership) return membership.role;

  const { data: team } = await supabase
    .from("teams")
    .select("owner_id")
    .eq("id", teamId)
    .single();

  if (team?.owner_id === userId) return "owner";

  return null;
}

const teams = new Hono<{ Bindings: Env }>();

const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logo_url: z.string().url().optional().nullable(),
  brand_color: z.string().optional().nullable(),
  custom_domain: z.string().optional().nullable(),
  email_from_name: z.string().optional().nullable(),
  email_from_address: z.string().email().optional().nullable(),
  plan: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
  seats: z.number().int().positive().optional(),
  stripe_customer_id: z.string().optional().nullable(),
  stripe_subscription_id: z.string().optional().nullable(),
  subscription_status: z.string().optional().nullable(),
  trial_ends_at: z.string().datetime().optional().nullable(),
  current_period_end: z.string().datetime().optional().nullable(),
  tranzila_terminal_id: z.string().optional().nullable(),
  tranzila_token: z.string().optional().nullable(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
});

const updateMemberSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

teams.get("/", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  const supabase = createServiceClient(env);

  const { data: memberTeams } = await supabase
    .from("teams")
    .select(`*, team_members!inner(user_id)`)
    .eq("team_members.user_id", authCtx.userId);

  const { data: ownedTeams } = await supabase
    .from("teams")
    .select(`*`)
    .eq("owner_id", authCtx.userId);

  const teamMap = new Map();
  [...(memberTeams || []), ...(ownedTeams || [])].forEach(t => teamMap.set(t.id, t));
  const teams = Array.from(teamMap.values());

  return c.json({ teams });
});

teams.get("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const teamId = c.req.param("id");

  const supabase = createServiceClient(env);

  const { data: team, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (error || !team) {
    return c.json({ error: "Team not found" }, 404);
  }

  const role = await getUserTeamRole(supabase, teamId, authCtx.userId);

  if (!role) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({ team, role });
});

teams.patch("/:id", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const teamId = c.req.param("id");
  const body = await c.req.json();

  const supabase = createServiceClient(env);

  const role = await getUserTeamRole(supabase, teamId, authCtx.userId);

  if (!role || !["owner", "admin"].includes(role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { data: team, error } = await supabase
    .from("teams")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(team);
});

teams.get("/:id/members", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const teamId = c.req.param("id");

  const supabase = createServiceClient(env);

  const role = await getUserTeamRole(supabase, teamId, authCtx.userId);

  if (!role) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { data: members, error } = await supabase
    .from("team_members")
    .select(`
      id,
      role,
      joined_at,
      invited_by,
      profiles!team_members_user_id_fkey(
        id,
        email,
        full_name,
        avatar_url
      )
    `)
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ members });
});

teams.post("/:id/invite", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const teamId = c.req.param("id");
  const body = await c.req.json();

  const supabase = createServiceClient(env);

  const userRole = await getUserTeamRole(supabase, teamId, authCtx.userId);

  if (!userRole || !["owner", "admin"].includes(userRole)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { email, role: inviteRole } = parsed.data;

  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email.toLowerCase())
    .single();

  if (existingUser) {
    const { data: existingMembership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", existingUser.id)
      .single();

    if (existingMembership) {
      return c.json({ error: "User is already a member of this team" }, 400);
    }

    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: existingUser.id,
        role: inviteRole,
        invited_by: authCtx.userId,
      });

    if (memberError) {
      return c.json({ error: memberError.message }, 400);
    }

    return c.json({ 
      message: "Member added successfully",
      user: existingUser 
    });
  }

  return c.json({ 
    message: "User not found. Send them an invitation to join.",
    email,
    role: inviteRole 
  });
});

teams.delete("/:id/members/:userId", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const teamId = c.req.param("id");
  const userIdToRemove = c.req.param("userId");

  const supabase = createServiceClient(env);

  const role = await getUserTeamRole(supabase, teamId, authCtx.userId);

  if (!role || !["owner", "admin"].includes(role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (userIdToRemove === authCtx.userId) {
    return c.json({ error: "Cannot remove yourself. Transfer ownership first." }, 400);
  }

  const { data: targetMembership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userIdToRemove)
    .single();

  if (!targetMembership) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (targetMembership.role === "owner") {
    return c.json({ error: "Cannot remove the owner" }, 400);
  }

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userIdToRemove);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true });
});

teams.patch("/:id/members/:userId", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const teamId = c.req.param("id");
  const userIdToUpdate = c.req.param("userId");
  const body = await c.req.json();

  const supabase = createServiceClient(env);

  const role = await getUserTeamRole(supabase, teamId, authCtx.userId);

  if (!role || !["owner", "admin"].includes(role)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { data: targetMembership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userIdToUpdate)
    .single();

  if (!targetMembership) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (targetMembership.role === "owner") {
    return c.json({ error: "Cannot change owner's role" }, 400);
  }

  const { error } = await supabase
    .from("team_members")
    .update({ role: parsed.data.role })
    .eq("team_id", teamId)
    .eq("user_id", userIdToUpdate);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true });
});

export default teams;