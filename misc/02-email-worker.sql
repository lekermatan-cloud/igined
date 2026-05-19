-- ════════════════════════════════════════════════════════════════════════
-- Email Worker Tables
-- ════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to create required tables
-- ════════════════════════════════════════════════════════════════════════

-- Message Queue Table
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_signer_id UUID REFERENCES signers(id) ON DELETE SET NULL,
  flow_id UUID,
  step_id UUID,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  language TEXT DEFAULT 'he',
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abandonment Events Table
CREATE TABLE IF NOT EXISTS abandonment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  signer_id UUID REFERENCES signers(id) ON DELETE SET NULL,
  document_id UUID,
  email TEXT,
  abandonment_type TEXT NOT NULL,
  recovery_status TEXT NOT NULL DEFAULT 'in_recovery',
  emails_sent INTEGER DEFAULT 0,
  next_action_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Flows Table
CREATE TABLE IF NOT EXISTS email_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id TEXT NOT NULL UNIQUE,
  name_he TEXT,
  name_en TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Steps Table
CREATE TABLE IF NOT EXISTS email_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject_he TEXT,
  subject_en TEXT,
  body_html_he TEXT,
  body_html_en TEXT,
  body_text_he TEXT,
  body_text_en TEXT,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_queue_status_scheduled 
  ON message_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_message_queue_user 
  ON message_queue(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_abandonment_events_status 
  ON abandonment_events(recovery_status, next_action_at);
CREATE INDEX IF NOT EXISTS idx_abandonment_events_user 
  ON abandonment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_signers_status 
  ON signers(status, invited_at);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active 
  ON profiles(last_active_at);

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandonment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_steps ENABLE ROW LEVEL SECURITY;

-- Note: Service role bypasses RLS, so these are safe for the worker