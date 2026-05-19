-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Production Database Schema (PostgreSQL / Supabase)
-- ════════════════════════════════════════════════════════════════════════
-- Compliant with:
--   · Israeli Electronic Signature Law 5761-2001
--   · ESIGN Act (US) — 15 USC §7001
--   · UETA — Uniform Electronic Transactions Act
--   · eIDAS Regulation (EU) 910/2014
-- ════════════════════════════════════════════════════════════════════════
-- Run this ENTIRE file in Supabase SQL Editor as a single migration.
-- Order matters - do not run sections out of order.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search

-- ════════════════════════════════════════════════════════════════════════
-- USERS & TEAMS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  country_code TEXT DEFAULT 'IL',
  preferred_language TEXT DEFAULT 'he' CHECK (preferred_language IN ('he', 'en')),
  timezone TEXT DEFAULT 'Asia/Jerusalem',
  avatar_url TEXT,
  professional_role TEXT, -- 'lawyer' | 'accountant' | 'realtor' | 'creator' | 'business' | 'individual'
  bar_number TEXT, -- For lawyers - Israeli Bar Association number
  company_name TEXT,
  company_id TEXT, -- ע.מ./ח.פ. number
  -- Marketing fields
  referral_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 0, 9),
  referred_by UUID REFERENCES profiles(id),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  -- Compliance
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  ip_at_signup INET,
  -- Status
  is_admin BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,
  -- Activity tracking (for churn detection)
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  -- WhatsApp opt-in (required for WhatsApp Business compliance)
  whatsapp_number TEXT,
  whatsapp_opted_in BOOLEAN DEFAULT FALSE,
  whatsapp_opted_in_at TIMESTAMPTZ,
  -- Created/updated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX idx_profiles_last_active ON profiles(last_active_at);

-- Teams (organizations)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  -- Branding (for white-label)
  brand_color TEXT DEFAULT '#c8924a',
  custom_domain TEXT,
  email_from_name TEXT,
  email_from_address TEXT,
  -- Plan
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  seats INTEGER DEFAULT 1,
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT, -- 'trialing' | 'active' | 'past_due' | 'canceled'
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  -- Tranzila (for ILS billing)
  tranzila_terminal_id TEXT,
  tranzila_token TEXT, -- encrypted PCI token
  -- Created/updated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_owner ON teams(owner_id);
CREATE INDEX idx_teams_stripe ON teams(stripe_customer_id);

-- Team members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- DOCUMENTS & SIGNATURES
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  -- File metadata
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_size_bytes BIGINT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf' | 'image' | 'video' | 'audio' | 'doc' | 'digital_product'
  mime_type TEXT NOT NULL,
  -- Cryptographic identity
  sha256_hash TEXT NOT NULL UNIQUE, -- 64-char lowercase hex
  -- For videos: also frame-by-frame hash for tamper detection
  frame_hashes JSONB, -- Array of {timestamp, hash} for video integrity
  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'expired', 'declined', 'cancelled')),
  signing_order TEXT DEFAULT 'parallel' CHECK (signing_order IN ('parallel', 'sequential')),
  -- Compliance
  legal_jurisdiction TEXT DEFAULT 'IL' CHECK (legal_jurisdiction IN ('IL', 'US', 'EU', 'UK')),
  signature_type TEXT DEFAULT 'simple'
    CHECK (signature_type IN ('simple', 'advanced', 'qualified')), -- per eIDAS levels
  -- Expiration
  expires_at TIMESTAMPTZ,
  reminder_schedule JSONB DEFAULT '[1, 3, 7]'::JSONB, -- days before expiry to remind
  -- Template
  template_id UUID, -- if created from a template
  -- Categorization
  category TEXT, -- 'nda' | 'lease' | 'employment' | 'sale' | etc.
  tags TEXT[],
  -- Tracking
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_team ON documents(team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status ON documents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_hash ON documents(sha256_hash);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_expires ON documents(expires_at) WHERE status IN ('sent', 'in_progress');

-- Signers
CREATE TABLE signers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- Identity
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  id_number TEXT, -- Israeli teudat zehut for advanced signatures
  -- Order
  signing_order INTEGER DEFAULT 0,
  role_label TEXT DEFAULT 'signer', -- 'signer' | 'witness' | 'approver' | 'cc'
  color TEXT DEFAULT '#c8924a', -- visual color in editor
  -- Auth
  access_token TEXT UNIQUE NOT NULL DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  -- Authentication method (per eIDAS)
  auth_method TEXT DEFAULT 'email' CHECK (auth_method IN ('email', 'sms', 'id_check', 'video_kyc', 'qualified_certificate')),
  auth_completed_at TIMESTAMPTZ,
  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'viewed', 'signed', 'declined', 'expired')),
  -- Forensic data (collected at sign time per ESIGN/eIDAS)
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB, -- {lat, lng, city, country}
  device_fingerprint TEXT,
  -- Signature data
  signature_image_url TEXT, -- Drawn or typed signature
  signature_typed_text TEXT, -- For typed signatures
  signature_method TEXT, -- 'drawn' | 'typed' | 'uploaded'
  -- Cryptographic proof
  consent_text_shown TEXT, -- The exact consent text shown to signer
  consent_accepted_at TIMESTAMPTZ,
  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  first_viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  -- Reminders
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ
);

CREATE INDEX idx_signers_document ON signers(document_id);
CREATE INDEX idx_signers_email ON signers(email);
CREATE INDEX idx_signers_status ON signers(status);
CREATE INDEX idx_signers_token ON signers(access_token);

-- Form fields placed on documents
CREATE TABLE document_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES signers(id) ON DELETE CASCADE,
  -- Type
  field_type TEXT NOT NULL CHECK (field_type IN (
    'signature', 'initials', 'date', 'text', 'checkbox',
    'name', 'email', 'phone', 'id_number', 'video_signature'
  )),
  -- Position (percentage of page, page number for multi-page docs)
  page_number INTEGER DEFAULT 1,
  x_percent NUMERIC(5,2) NOT NULL,
  y_percent NUMERIC(5,2) NOT NULL,
  width_px INTEGER NOT NULL,
  height_px INTEGER NOT NULL,
  -- Behavior
  is_required BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  validation_regex TEXT,
  -- Filled value
  filled_value TEXT,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fields_document ON document_fields(document_id);
CREATE INDEX idx_fields_signer ON document_fields(signer_id);

-- Final certificate (ownership proof)
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  -- Cryptographic proof
  cert_hash TEXT NOT NULL UNIQUE, -- final SHA-256 of document + all signatures + timestamp
  document_hash TEXT NOT NULL, -- original file hash
  signers_hash TEXT NOT NULL, -- hash of all signer data combined
  -- Timestamping (RFC 3161)
  rfc3161_token TEXT, -- TSA timestamp token (for advanced signatures)
  rfc3161_authority TEXT, -- e.g., 'freetsa.org', 'DigiCert TSA'
  issued_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Public verification
  public_url TEXT UNIQUE NOT NULL DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  qr_code_url TEXT,
  -- PDF certificate file
  pdf_url TEXT,
  -- Compliance level
  compliance_level TEXT NOT NULL DEFAULT 'simple'
    CHECK (compliance_level IN ('simple', 'advanced', 'qualified')),
  -- Anchoring (optional blockchain proof - phase 2)
  blockchain_tx_hash TEXT,
  blockchain_network TEXT, -- 'opentimestamps' | 'ethereum' | etc.
  blockchain_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certs_hash ON certificates(cert_hash);
CREATE INDEX idx_certs_public_url ON certificates(public_url);

-- ════════════════════════════════════════════════════════════════════════
-- AUDIT TRAIL (CRITICAL FOR COMPLIANCE)
-- ════════════════════════════════════════════════════════════════════════
-- Every action on every document must be logged here. This is the
-- evidence used in court. Never delete from this table.

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  signer_id UUID REFERENCES signers(id),
  user_id UUID REFERENCES profiles(id),
  -- Event
  event_type TEXT NOT NULL, -- 'created' | 'sent' | 'viewed' | 'signed' | 'declined' | 'reminded' | 'expired' | 'completed' | 'downloaded' | 'verified'
  event_data JSONB, -- arbitrary metadata
  -- Forensic
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB,
  -- Tamper-proof: each row contains hash of previous row
  previous_log_hash TEXT,
  current_log_hash TEXT NOT NULL,
  -- Timestamp
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_document ON audit_log(document_id);
CREATE INDEX idx_audit_signer ON audit_log(signer_id);
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at);

-- ════════════════════════════════════════════════════════════════════════
-- TEMPLATES (REUSABLE DOCUMENT FORMATS)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  -- NULL team_id = system template (free for everyone)
  is_system BOOLEAN DEFAULT FALSE,
  -- Content
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_he TEXT,
  description_en TEXT,
  category TEXT NOT NULL, -- 'legal' | 'business' | 'real_estate' | 'hr' | 'sales' | 'creative'
  professional_role TEXT, -- which profession is this for? 'lawyer' | 'realtor' | etc.
  -- Document data
  base_pdf_url TEXT,
  base_html_he TEXT, -- HTML template for Hebrew
  base_html_en TEXT, -- HTML template for English
  -- Field positions (JSON array)
  default_fields JSONB,
  -- Stats
  use_count INTEGER DEFAULT 0,
  -- Status
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_team ON templates(team_id);

-- ════════════════════════════════════════════════════════════════════════
-- BILLING & SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id),
  -- Invoice details
  invoice_number TEXT UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'ILS', 'EUR')),
  vat_amount NUMERIC(10,2) DEFAULT 0,
  vat_rate NUMERIC(5,2) DEFAULT 17.00, -- Israeli VAT
  total_amount NUMERIC(10,2) GENERATED ALWAYS AS (amount + vat_amount) STORED,
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  -- Provider
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'tranzila', 'manual')),
  provider_invoice_id TEXT,
  provider_payment_id TEXT,
  -- Tax compliance
  recipient_business_id TEXT, -- ע.מ./ח.פ.
  recipient_business_name TEXT,
  recipient_address TEXT,
  -- Document URLs
  pdf_url TEXT,
  -- Period
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  -- Timestamps
  paid_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_team ON invoices(team_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ════════════════════════════════════════════════════════════════════════
-- EMAIL AUTOMATION (THE GROWTH ENGINE)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE email_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Identity
  flow_id TEXT UNIQUE NOT NULL, -- 'welcome' | 'trial_ending' | 'abandoned_upload' | 'churn_winback' | 'milestone_10docs' | etc.
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_he TEXT,
  description_en TEXT,
  -- Trigger
  trigger_event TEXT NOT NULL, -- 'signup' | 'trial_started' | 'doc_abandoned' | 'inactivity_30d' | 'milestone' | 'churn'
  trigger_conditions JSONB, -- {min_days_inactive: 14, plan: 'pro', ...}
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  -- Stats (updated by worker)
  total_sent INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  attributed_revenue NUMERIC(12,2) DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  -- Timing
  delay_minutes INTEGER NOT NULL, -- how long after trigger (or previous step) to send
  -- Channel (multi-channel: email + WhatsApp + SMS)
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  -- Content (bilingual)
  subject_he TEXT,
  subject_en TEXT,
  preview_he TEXT,
  preview_en TEXT,
  body_html_he TEXT,
  body_html_en TEXT,
  body_text_he TEXT,
  body_text_en TEXT,
  -- Conditions to skip this step
  skip_if_signed BOOLEAN DEFAULT FALSE,
  skip_if_paid BOOLEAN DEFAULT FALSE,
  skip_if_active_recently BOOLEAN DEFAULT FALSE,
  -- A/B testing
  variant TEXT DEFAULT 'A',
  UNIQUE(flow_id, step_order, variant)
);

-- Queue: every scheduled email/WhatsApp message lives here
CREATE TABLE message_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Recipient
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_user_id UUID REFERENCES profiles(id),
  recipient_signer_id UUID REFERENCES signers(id),
  -- Source
  flow_id UUID REFERENCES email_flows(id),
  step_id UUID REFERENCES email_steps(id),
  campaign_id UUID, -- for one-off broadcasts
  -- Channel
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  -- Content (denormalized at queue time, in case template changes)
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  language TEXT DEFAULT 'he',
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority INTEGER DEFAULT 5, -- 1-10, lower is higher priority
  -- Status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  -- Provider response
  provider_message_id TEXT, -- Resend ID, WhatsApp wamid, etc.
  -- Engagement tracking
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  -- Created
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_scheduled ON message_queue(scheduled_for, status) WHERE status = 'queued';
CREATE INDEX idx_queue_recipient ON message_queue(recipient_user_id);

-- ════════════════════════════════════════════════════════════════════════
-- ABANDONMENT TRACKING (THE CHURN PREVENTION ENGINE)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE abandonment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Who
  user_id UUID REFERENCES profiles(id),
  signer_id UUID REFERENCES signers(id),
  email TEXT,
  -- What was abandoned
  abandonment_type TEXT NOT NULL CHECK (abandonment_type IN (
    'signup_started',           -- started filling signup form, didn't finish
    'document_uploaded',        -- uploaded but didn't add signers/send
    'signature_pending',        -- got invitation, didn't sign
    'trial_no_action',          -- on trial, no documents created
    'payment_failed',           -- subscription payment failed
    'inactive_30d',             -- haven't logged in 30 days
    'inactive_60d',             -- haven't logged in 60 days
    'churned'                   -- cancelled subscription
  )),
  -- Context
  document_id UUID REFERENCES documents(id),
  abandonment_data JSONB, -- {step: 3, plan_viewed: 'pro', etc.}
  -- Recovery
  recovery_status TEXT DEFAULT 'pending'
    CHECK (recovery_status IN ('pending', 'in_recovery', 'recovered', 'lost', 'excluded')),
  emails_sent INTEGER DEFAULT 0,
  whatsapps_sent INTEGER DEFAULT 0,
  recovered_at TIMESTAMPTZ,
  recovery_revenue NUMERIC(10,2),
  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_action_at TIMESTAMPTZ
);

CREATE INDEX idx_abandonment_user ON abandonment_events(user_id);
CREATE INDEX idx_abandonment_status ON abandonment_events(recovery_status);
CREATE INDEX idx_abandonment_next_action ON abandonment_events(next_action_at) WHERE recovery_status = 'in_recovery';

-- ════════════════════════════════════════════════════════════════════════
-- API & WEBHOOKS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  -- Key parts
  key_prefix TEXT NOT NULL, -- 'sk_live_' or 'sk_test_'
  key_suffix TEXT NOT NULL, -- last 5 chars (for display)
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 of full key (we don't store plaintext)
  -- Permissions
  scopes TEXT[] DEFAULT ARRAY['documents:read', 'documents:write', 'webhooks:read'],
  rate_limit_per_minute INTEGER DEFAULT 60,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active;

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- ['document.signed', 'document.viewed', 'document.declined']
  signing_secret TEXT NOT NULL, -- HMAC secret for verifying webhooks
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — CRITICAL!
-- ════════════════════════════════════════════════════════════════════════
-- Without RLS, any user could read any other user's documents.
-- Enable RLS on every table that contains user data.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandonment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get teams a user belongs to
CREATE OR REPLACE FUNCTION user_team_ids(user_uuid UUID)
RETURNS TABLE(team_id UUID) AS $$
  SELECT DISTINCT tm.team_id FROM team_members tm WHERE tm.user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Profiles: users can read their own profile and profiles of their team members
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));

-- Teams: members can read their teams
CREATE POLICY "Members can view their teams" ON teams
  FOR SELECT USING (id IN (SELECT team_id FROM user_team_ids(auth.uid())));
CREATE POLICY "Owners can update their teams" ON teams
  FOR UPDATE USING (owner_id = auth.uid());

-- Team members: visible to team members
CREATE POLICY "Members can view team membership" ON team_members
  FOR SELECT USING (team_id IN (SELECT team_id FROM user_team_ids(auth.uid())));

-- Documents: visible to team members
CREATE POLICY "Team members can view documents" ON documents
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM user_team_ids(auth.uid()))
    AND deleted_at IS NULL
  );
CREATE POLICY "Team editors+ can create documents" ON documents
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin', 'editor')
    )
  );
CREATE POLICY "Team editors+ can update their documents" ON documents
  FOR UPDATE USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin', 'editor')
    )
  );

-- Signers: signers themselves can view via access_token (handled in app, not RLS)
-- Team members can view signers of their team's documents
CREATE POLICY "Team members can view signers" ON signers
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents
      WHERE team_id IN (SELECT team_id FROM user_team_ids(auth.uid()))
    )
  );

-- Audit log: read-only for team members, never UPDATE or DELETE
CREATE POLICY "Team members can view audit log" ON audit_log
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents
      WHERE team_id IN (SELECT team_id FROM user_team_ids(auth.uid()))
    )
  );
-- No UPDATE/DELETE policies = nobody can modify audit log (immutable!)

-- Templates: system templates visible to all, team templates visible to members
CREATE POLICY "Anyone can view system templates" ON templates
  FOR SELECT USING (is_system = TRUE AND is_published = TRUE);
CREATE POLICY "Team members can view team templates" ON templates
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM user_team_ids(auth.uid()))
  );

-- Invoices: team owners and admins only
CREATE POLICY "Team admins can view invoices" ON invoices
  FOR SELECT USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Admin tables: only admins can access
CREATE POLICY "Admins only - message queue" ON message_queue
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));
CREATE POLICY "Admins only - abandonment" ON abandonment_events
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));

-- API keys: team members only see prefix, but full key only by creator
CREATE POLICY "Team members can view API key info" ON api_keys
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM user_team_ids(auth.uid()))
  );

-- ════════════════════════════════════════════════════════════════════════
-- TRIGGERS & FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, terms_accepted_at, privacy_accepted_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
-- SEED DATA: Default email flows for the auto-pilot engine
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO email_flows (flow_id, trigger_event, name_he, name_en, description_he, description_en) VALUES
  ('welcome', 'signup', 'ברוכים הבאים', 'Welcome series',
   'סדרת 4 מיילים שמובילה משתמשים חדשים מהרישום עד למסמך הראשון',
   '4-email sequence guiding new users from signup to first signed document'),

  ('trial_ending', 'trial_ending_in_7d', 'סיום ניסיון', 'Trial ending',
   'סדרת 3 מיילים בימים האחרונים של תקופת הניסיון',
   '3-email sequence in the final days of trial'),

  ('abandoned_upload', 'doc_abandoned', 'מסמך נטוש', 'Abandoned document',
   'משתמש העלה מסמך אבל לא שלח להחתמה - 3 מיילים תוך 14 יום',
   'User uploaded but didn''t send for signing - 3 emails over 14 days'),

  ('signer_reminder', 'signer_inactive', 'תזכורת לחותם', 'Signer reminder',
   'תזכורות מתחזקות לחותמים שלא חתמו - יום 1, יום 3, יום 7',
   'Escalating reminders to signers - day 1, day 3, day 7'),

  ('churn_winback', 'cancelled', 'החזרת לקוחות', 'Churn winback',
   'סדרת מיילים ללקוחות שביטלו, עם הנחה של 30%',
   '3-email winback sequence with 30% discount'),

  ('milestone_10docs', 'milestone', 'אבן דרך', 'Milestone celebration',
   'מייל ברכה ועידוד אחרי 10 מסמכים שנחתמו',
   'Congratulations email after 10 signed documents'),

  ('referral_nudge', 'milestone', 'דחיפה להפניה', 'Referral nudge',
   'הצעה להזמין חברים אחרי שימוש פעיל של 30 יום',
   'Invite friends offer after 30 days of active use'),

  ('inactive_30d', 'inactivity_30d', 'משתמש לא פעיל 30 יום', 'Inactive 30 days',
   'מייל שמזכיר ללקוחות שלא נכנסו 30 יום',
   'Re-engagement email for users inactive for 30 days');
