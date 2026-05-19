import { Hono } from "hono";
import { createServiceClient } from "../lib/supabase";
import { createToken, createEmailVerificationToken, verifyToken } from "../lib/jwt";
import { hashPassword, verifyPassword } from "../lib/password";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { Env } from "../config";
import { z } from "zod";
import { EmailService } from "../lib/email";
import { createRemoteJWKSet, jwtVerify } from "jose";

const googleJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const auth = new Hono<{ Bindings: Env }>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  phone: z.string().optional(),
  terms_accepted: z.boolean().refine((v) => v === true, "Terms must be accepted"),
  privacy_accepted: z.boolean().refine((v) => v === true, "Privacy policy must be accepted"),
  referral_code: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

auth.post("/register", async (c) => {
  const env = c.env as Env;
  const body = await c.req.json();
  
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
    return c.json({ error: errors || "Validation failed" }, 400);
  }

  const { email, password, full_name, phone, terms_accepted, privacy_accepted, referral_code } = parsed.data;
  const supabase = createServiceClient(env);

  let referredById: string | null = null;
  if (referral_code) {
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referral_code)
      .single();
    referredById = referrer?.id || null;
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .single();

  if (existing) {
    return c.json({ error: "Email already registered" }, 400);
  }

  const password_hash = await hashPassword(password);

  const { data: profile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || null,
      terms_accepted_at: terms_accepted ? new Date().toISOString() : null,
      privacy_accepted_at: privacy_accepted ? new Date().toISOString() : null,
      preferred_language: "he",
      timezone: "Asia/Jerusalem",
      country_code: "IL",
      referred_by: referredById,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Registration error:", JSON.stringify(insertError));
    return c.json({ error: "Failed to create account: " + insertError.message }, 500);
  }

  const personalTeamId = crypto.randomUUID();

  const { error: teamError } = await supabase
    .from("teams")
    .insert({
      id: personalTeamId,
      name: `${full_name}'s Personal`,
      slug: `${profile.id}-personal`,
      owner_id: profile.id,
    });

  if (teamError) {
    console.error("Failed to create personal team:", JSON.stringify(teamError));
  } else {
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: personalTeamId,
        user_id: profile.id,
        role: "owner",
        joined_at: new Date().toISOString(),
      });
    if (memberError) {
      console.error("Failed to add owner to team_members:", JSON.stringify(memberError));
    }
  }

  const token = await createToken(env, profile.id, profile.email);

  const emailService = new EmailService(env);
  try {
    const verificationToken = await createEmailVerificationToken(env, profile.id, profile.email);
    await emailService.sendVerificationEmail(email, full_name, verificationToken);
  } catch (err) {
    console.error("Failed to send verification email:", err);
  }

  return c.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      is_admin: profile.is_admin || false,
      email_verified: false,
    },
    referral_code: profile.referral_code,
  });
});

auth.post("/login", async (c) => {
  const env = c.env as Env;
  const body = await c.req.json();
  
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { email, password } = parsed.data;
  const supabase = createServiceClient(env);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !profile) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  if (profile.is_suspended) {
    return c.json({ error: "Account suspended", reason: profile.suspension_reason }, 403);
  }

  const valid = await verifyPassword(password, profile.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  await supabase.from("profiles").update({
    last_login_at: new Date().toISOString(),
    login_count: (profile.login_count || 0) + 1,
    last_active_at: new Date().toISOString(),
  }).eq("id", profile.id);

  const token = await createToken(env, profile.id, profile.email);

  return c.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      is_admin: profile.is_admin || false,
      email_verified: profile.email_verified || false,
    },
  });
});

const googleSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
});

auth.post("/google", async (c) => {
  const env = c.env as Env;
  const body = await c.req.json();

  const parsed = googleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { credential } = parsed.data;
  const supabase = createServiceClient(env);

  let payload;
  try {
    const result = await jwtVerify(credential, googleJWKS, {
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = result.payload;
  } catch (err) {
    console.error("Google token verification failed:", err);
    return c.json({ error: "Invalid Google credential" }, 401);
  }

  const email = (payload.email as string)?.toLowerCase();
  const googleName = (payload.name as string) || email?.split("@")[0] || "User";

  if (!email) {
    return c.json({ error: "Google account has no email" }, 400);
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .single();

  if (existing) {
    if (existing.is_suspended) {
      return c.json({ error: "Account suspended", reason: existing.suspension_reason }, 403);
    }

    await supabase.from("profiles").update({
      email_verified: true,
      email_verified_at: existing.email_verified ? existing.email_verified_at : new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      login_count: (existing.login_count || 0) + 1,
      last_active_at: new Date().toISOString(),
    }).eq("id", existing.id);

    const token = await createToken(env, existing.id, existing.email);

    return c.json({
      token,
      user: {
        id: existing.id,
        email: existing.email,
        full_name: existing.full_name,
        is_admin: existing.is_admin || false,
        email_verified: true,
      },
    });
  }

  const { data: profile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      email,
      full_name: googleName,
      email_verified: true,
      email_verified_at: new Date().toISOString(),
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      preferred_language: "he",
      timezone: "Asia/Jerusalem",
      country_code: "IL",
    })
    .select()
    .single();

  if (insertError) {
    console.error("Google registration error:", JSON.stringify(insertError));
    return c.json({ error: "Failed to create account" }, 500);
  }

  const personalTeamId = crypto.randomUUID();

  const { error: teamError } = await supabase
    .from("teams")
    .insert({
      id: personalTeamId,
      name: `${googleName}'s Personal`,
      slug: `${profile.id}-personal`,
      owner_id: profile.id,
    });

  if (teamError) {
    console.error("Failed to create personal team:", JSON.stringify(teamError));
  } else {
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: personalTeamId,
        user_id: profile.id,
        role: "owner",
        joined_at: new Date().toISOString(),
      });
    if (memberError) {
      console.error("Failed to add owner to team_members:", JSON.stringify(memberError));
    }
  }

  const token = await createToken(env, profile.id, profile.email);

  try {
    const emailService = new EmailService(env);
    await emailService.sendWelcomeEmail(email, googleName);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }

  return c.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      is_admin: profile.is_admin || false,
      email_verified: true,
    },
  });
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

auth.post("/verify-email", async (c) => {
  const env = c.env as Env;
  const body = await c.req.json();

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { token } = parsed.data;
  const supabase = createServiceClient(env);

  const payload = await verifyToken(env, token);
  if (!payload || payload.purpose !== "email_verify") {
    return c.json({ error: "Invalid or expired verification token" }, 400);
  }

  const userId = payload.userId as string;
  if (!userId) {
    return c.json({ error: "Invalid verification token" }, 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email_verified")
    .eq("id", userId)
    .single();

  if (!profile) {
    return c.json({ error: "User not found" }, 404);
  }

  if (profile.email_verified) {
    return c.json({ message: "Email already verified" });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      email_verified: true,
      email_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Email verification error:", JSON.stringify(updateError));
    return c.json({ error: "Failed to verify email" }, 500);
  }

  return c.json({ message: "Email verified successfully" });
});

auth.post("/resend-verification", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  const supabase = createServiceClient(env);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, email_verified")
    .eq("id", authCtx.userId)
    .single();

  if (!profile) {
    return c.json({ error: "User not found" }, 404);
  }

  if (profile.email_verified) {
    return c.json({ message: "Email already verified" });
  }

  try {
    const verificationToken = await createEmailVerificationToken(env, profile.id, profile.email);
    const emailService = new EmailService(env);
    await emailService.sendVerificationEmail(profile.email, profile.full_name, verificationToken);
  } catch (err) {
    console.error("Failed to resend verification email:", err);
    return c.json({ error: "Failed to send verification email" }, 500);
  }

  return c.json({ message: "Verification email sent" });
});

auth.post("/logout", authMiddleware, async (c) => {
  return c.json({ message: "Logged out successfully" });
});

auth.get("/me", authMiddleware, async (c) => {
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

  return c.json({ user: profile });
});

auth.post("/reset-password", async (c) => {
  const env = c.env as Env;
  const body = await c.req.json();
  
  const { email } = body;
  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const supabase = createServiceClient(env);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", email.toLowerCase())
    .single();

  if (!profile) {
    return c.json({ message: "If the email exists, a reset link has been sent" });
  }

  const resetToken = await createToken(env, profile.id, profile.email);
  
  const emailService = new EmailService(env);
  await emailService.sendPasswordResetEmail(email, profile.full_name, resetToken);

  return c.json({ message: "If the email exists, a reset link has been sent" });
});

auth.post("/update-password", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const body = await c.req.json();
  
  const { password, current_password } = body;
  
  if (!password || password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const supabase = createServiceClient(env);

  if (current_password) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("password_hash")
      .eq("id", authCtx.userId)
      .single();

    if (profile) {
      const valid = await verifyPassword(current_password, profile.password_hash);
      if (!valid) {
        return c.json({ error: "Current password is incorrect" }, 400);
      }
    }
  }

  const password_hash = await hashPassword(password);

  const { error } = await supabase
    .from("profiles")
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq("id", authCtx.userId);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ message: "Password updated successfully" });
});

export default auth;