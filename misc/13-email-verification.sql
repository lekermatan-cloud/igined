-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Email Verification Migration
-- Run AFTER 01-schema.sql.
-- ════════════════════════════════════════════════════════════════════════

-- Add email_verified column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Index for looking up unverified users
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified
  ON profiles(email_verified)
  WHERE email_verified = FALSE;

-- Verification tokens for email verification flow
CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token
  ON verification_tokens(token);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_email
  ON verification_tokens(email);