-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Core Schema (PostgreSQL)
-- ════════════════════════════════════════════════════════════════════════
-- Compliant with:
--   · Israeli Electronic Signature Law 5761-2001
--   · ESIGN Act (US) — 15 USC §7001
--   · UETA — Uniform Electronic Transactions Act
--   · eIDAS Regulation (EU) 910/2014
-- ════════════════════════════════════════════════════════════════════════
-- NOTE: No RLS, no Supabase auth references, no triggers.
--       All auth, session management, and business logic is handled
--       by the application backend.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ════════════════════════════════════════════════════════════════════════
-- USERS & TEAMS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,            -- bcrypt/argon2 hash; managed by backend
  full_name       TEXT NOT NULL,
  phone           TEXT,
  country_code    TEXT DEFAULT 'IL',
  preferred_language TEXT DEFAULT 'he' CHECK (preferred_language IN ('he', 'en')),
  timezone        TEXT DEFAULT 'Asia/Jerusalem',
  avatar_url      TEXT,
  professional_role TEXT,  -- 'lawyer' | 'accountant' | 'realtor' | 'creator' | 'business' | 'individual'
  bar_number      TEXT,    -- Israeli Bar Association number (lawyers only)
  company_name    TEXT,
  company_id      TEXT,    -- ע.מ./ח.פ. number
  -- Marketing
  referral_code   TEXT UNIQUE DEFAULT substr(md5(random()::text), 0, 9),
  referred_by     UUID REFERENCES profiles(id),
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  -- Compliance
  terms_accepted_at    TIMESTAMPTZ,
  privacy_accepted_at  TIMESTAMPTZ,
  ip_at_signup         INET,
  -- Status
  is_admin        BOOLEAN DEFAULT FALSE,
  is_suspended    BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,
  -- Activity
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ,
  login_count     INTEGER DEFAULT 0,
  -- WhatsApp opt-in
  whatsapp_number     TEXT,
  whatsapp_opted_in   BOOLEAN DEFAULT FALSE,
  whatsapp_opted_in_at TIMESTAMPTZ,
  -- Timestamps
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_email         ON profiles(email);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX idx_profiles_last_active   ON profiles(last_active_at);

-- ─── Teams ────────────────────────────────────────────────────────────────

CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES profiles(id),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  -- Branding (white-label)
  brand_color       TEXT DEFAULT '#c8924a',
  custom_domain     TEXT,
  email_from_name   TEXT,
  email_from_address TEXT,
  -- Plan
  plan    TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  seats   INTEGER DEFAULT 1,
  -- Stripe
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  subscription_status     TEXT,  -- 'trialing' | 'active' | 'past_due' | 'canceled'
  trial_ends_at           TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  -- Tranzila (ILS billing)
  tranzila_terminal_id TEXT,
  tranzila_token       TEXT,  -- encrypted PCI token
  -- Timestamps
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_owner  ON teams(owner_id);
CREATE INDEX idx_teams_stripe ON teams(stripe_customer_id);

-- ─── Team members ─────────────────────────────────────────────────────────

CREATE TABLE team_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by  UUID REFERENCES profiles(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- DOCUMENTS & SIGNATURES
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  -- File metadata
  name              TEXT NOT NULL,
  description       TEXT,
  file_url          TEXT NOT NULL,
  file_size_bytes   BIGINT NOT NULL,
  file_type         TEXT NOT NULL,  -- 'pdf' | 'image' | 'video' | 'audio' | 'doc' | 'digital_product'
  mime_type         TEXT NOT NULL,
  -- Cryptographic identity
  sha256_hash   TEXT NOT NULL UNIQUE,
  frame_hashes  JSONB,  -- [{timestamp, hash}] for video integrity
  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'expired', 'declined', 'cancelled')),
  signing_order TEXT DEFAULT 'parallel' CHECK (signing_order IN ('parallel', 'sequential')),
  -- Compliance
  legal_jurisdiction TEXT DEFAULT 'IL' CHECK (legal_jurisdiction IN ('IL', 'US', 'EU', 'UK')),
  signature_type TEXT DEFAULT 'simple'
    CHECK (signature_type IN ('simple', 'advanced', 'qualified')),
  -- Expiration
  expires_at          TIMESTAMPTZ,
  reminder_schedule   JSONB DEFAULT '[1, 3, 7]'::JSONB,  -- days before expiry
  -- Template
  template_id UUID,
  -- Categorisation
  category TEXT,
  tags     TEXT[],
  -- Tracking
  view_count      INTEGER DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Soft delete
  deleted_at  TIMESTAMPTZ,
  -- Timestamps
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_team       ON documents(team_id)       WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status     ON documents(status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_hash       ON documents(sha256_hash);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_expires    ON documents(expires_at)    WHERE status IN ('sent', 'in_progress');

-- ─── Signers ──────────────────────────────────────────────────────────────

CREATE TABLE signers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- Identity
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  id_number   TEXT,  -- Israeli teudat zehut (advanced signatures)
  -- Order
  signing_order INTEGER DEFAULT 0,
  role_label    TEXT DEFAULT 'signer',  -- 'signer' | 'witness' | 'approver' | 'cc'
  color         TEXT DEFAULT '#c8924a',
  -- Auth
  access_token TEXT UNIQUE NOT NULL DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  auth_method  TEXT DEFAULT 'email'
    CHECK (auth_method IN ('email', 'sms', 'id_check', 'video_kyc', 'qualified_certificate')),
  auth_completed_at TIMESTAMPTZ,
  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'viewed', 'signed', 'declined', 'expired')),
  -- Forensic data (ESIGN/eIDAS)
  ip_address         INET,
  user_agent         TEXT,
  geolocation        JSONB,  -- {lat, lng, city, country}
  device_fingerprint TEXT,
  -- Signature data
  signature_image_url  TEXT,
  signature_typed_text TEXT,
  signature_method     TEXT,  -- 'drawn' | 'typed' | 'uploaded'
  -- Cryptographic proof
  consent_text_shown  TEXT,
  consent_accepted_at TIMESTAMPTZ,
  -- Timestamps
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  first_viewed_at TIMESTAMPTZ,
  signed_at       TIMESTAMPTZ,
  -- Reminders
  reminder_count    INTEGER DEFAULT 0,
  last_reminder_at  TIMESTAMPTZ
);

CREATE INDEX idx_signers_document ON signers(document_id);
CREATE INDEX idx_signers_email    ON signers(email);
CREATE INDEX idx_signers_status   ON signers(status);
CREATE INDEX idx_signers_token    ON signers(access_token);

-- ─── Document fields ──────────────────────────────────────────────────────

CREATE TABLE document_fields (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id   UUID REFERENCES signers(id) ON DELETE CASCADE,
  -- Type
  field_type TEXT NOT NULL CHECK (field_type IN (
    'signature', 'initials', 'date', 'text', 'checkbox',
    'name', 'email', 'phone', 'id_number', 'video_signature'
  )),
  -- Position
  page_number  INTEGER DEFAULT 1,
  x_percent    NUMERIC(5,2) NOT NULL,
  y_percent    NUMERIC(5,2) NOT NULL,
  width_px     INTEGER NOT NULL,
  height_px    INTEGER NOT NULL,
  -- Behaviour
  is_required      BOOLEAN DEFAULT TRUE,
  default_value    TEXT,
  validation_regex TEXT,
  -- Filled value
  filled_value TEXT,
  filled_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fields_document ON document_fields(document_id);
CREATE INDEX idx_fields_signer   ON document_fields(signer_id);

-- ─── Certificates ─────────────────────────────────────────────────────────

CREATE TABLE certificates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  -- Cryptographic proof
  cert_hash     TEXT NOT NULL UNIQUE,
  document_hash TEXT NOT NULL,
  signers_hash  TEXT NOT NULL,
  -- Timestamping (RFC 3161)
  rfc3161_token     TEXT,
  rfc3161_authority TEXT,
  issued_at_utc     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Public verification
  public_url  TEXT UNIQUE NOT NULL DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  qr_code_url TEXT,
  pdf_url     TEXT,
  -- Compliance level
  compliance_level TEXT NOT NULL DEFAULT 'simple'
    CHECK (compliance_level IN ('simple', 'advanced', 'qualified')),
  -- Blockchain (phase 2)
  blockchain_tx_hash     TEXT,
  blockchain_network     TEXT,
  blockchain_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certs_hash       ON certificates(cert_hash);
CREATE INDEX idx_certs_public_url ON certificates(public_url);

-- ════════════════════════════════════════════════════════════════════════
-- AUDIT TRAIL
-- ════════════════════════════════════════════════════════════════════════
-- Immutable event log. Never UPDATE or DELETE rows from this table.

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  signer_id   UUID REFERENCES signers(id),
  user_id     UUID REFERENCES profiles(id),
  -- Event
  event_type TEXT NOT NULL,  -- 'created' | 'sent' | 'viewed' | 'signed' | 'declined' | 'reminded' | 'expired' | 'completed' | 'downloaded' | 'verified'
  event_data JSONB,
  -- Forensic
  ip_address  INET,
  user_agent  TEXT,
  geolocation JSONB,
  -- Tamper-proof chain
  previous_log_hash TEXT,
  current_log_hash  TEXT NOT NULL,
  -- Timestamp
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_document ON audit_log(document_id);
CREATE INDEX idx_audit_signer   ON audit_log(signer_id);
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at);

-- ════════════════════════════════════════════════════════════════════════
-- TEMPLATES
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE templates (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,  -- NULL = system template
  is_system   BOOLEAN DEFAULT FALSE,
  -- Content
  name_he        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_he TEXT,
  description_en TEXT,
  category       TEXT NOT NULL,  -- 'legal' | 'business' | 'real_estate' | 'hr' | 'sales' | 'creative'
  professional_role TEXT,
  -- Document data
  base_pdf_url  TEXT,
  base_html_he  TEXT,
  base_html_en  TEXT,
  default_fields JSONB,
  -- Stats
  use_count    INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_team     ON templates(team_id);

-- ════════════════════════════════════════════════════════════════════════
-- BILLING & SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE invoices (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id),
  -- Invoice details
  invoice_number TEXT UNIQUE NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  currency       TEXT NOT NULL CHECK (currency IN ('USD', 'ILS', 'EUR')),
  vat_amount     NUMERIC(10,2) DEFAULT 0,
  vat_rate       NUMERIC(5,2)  DEFAULT 17.00,
  total_amount   NUMERIC(10,2) GENERATED ALWAYS AS (amount + vat_amount) STORED,
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  -- Provider
  provider            TEXT NOT NULL CHECK (provider IN ('stripe', 'tranzila', 'manual')),
  provider_invoice_id TEXT,
  provider_payment_id TEXT,
  -- Tax compliance
  recipient_business_id   TEXT,
  recipient_business_name TEXT,
  recipient_address       TEXT,
  -- Documents
  pdf_url      TEXT,
  period_start TIMESTAMPTZ,
  period_end   TIMESTAMPTZ,
  -- Timestamps
  paid_at    TIMESTAMPTZ,
  due_at     TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_team   ON invoices(team_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ════════════════════════════════════════════════════════════════════════
-- EMAIL / MESSAGE AUTOMATION
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE email_flows (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id TEXT UNIQUE NOT NULL,  -- 'welcome' | 'trial_ending' | 'abandoned_upload' | etc.
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_he TEXT,
  description_en TEXT,
  -- Trigger
  trigger_event      TEXT NOT NULL,
  trigger_conditions JSONB,
  -- Status & stats
  is_active          BOOLEAN DEFAULT TRUE,
  total_sent         INTEGER DEFAULT 0,
  total_opens        INTEGER DEFAULT 0,
  total_clicks       INTEGER DEFAULT 0,
  total_conversions  INTEGER DEFAULT 0,
  attributed_revenue NUMERIC(12,2) DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_steps (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  delay_minutes INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  -- Content (bilingual)
  subject_he    TEXT,
  subject_en    TEXT,
  preview_he    TEXT,
  preview_en    TEXT,
  body_html_he  TEXT,
  body_html_en  TEXT,
  body_text_he  TEXT,
  body_text_en  TEXT,
  -- Skip conditions
  skip_if_signed         BOOLEAN DEFAULT FALSE,
  skip_if_paid           BOOLEAN DEFAULT FALSE,
  skip_if_active_recently BOOLEAN DEFAULT FALSE,
  -- A/B
  variant TEXT DEFAULT 'A',
  UNIQUE (flow_id, step_order, variant)
);

CREATE TABLE message_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Recipient
  recipient_email    TEXT,
  recipient_phone    TEXT,
  recipient_user_id  UUID REFERENCES profiles(id),
  recipient_signer_id UUID REFERENCES signers(id),
  -- Source
  flow_id     UUID REFERENCES email_flows(id),
  step_id     UUID REFERENCES email_steps(id),
  campaign_id UUID,
  -- Channel & content
  channel    TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  subject    TEXT,
  body_html  TEXT,
  body_text  TEXT,
  language   TEXT DEFAULT 'he',
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority      INTEGER DEFAULT 5,
  -- Status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts   INTEGER DEFAULT 0,
  last_error TEXT,
  -- Provider
  provider_message_id TEXT,
  -- Engagement
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_scheduled ON message_queue(scheduled_for, status) WHERE status = 'queued';
CREATE INDEX idx_queue_recipient  ON message_queue(recipient_user_id);

-- ════════════════════════════════════════════════════════════════════════
-- ABANDONMENT TRACKING
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE abandonment_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id),
  signer_id  UUID REFERENCES signers(id),
  email      TEXT,
  abandonment_type TEXT NOT NULL CHECK (abandonment_type IN (
    'signup_started', 'document_uploaded', 'signature_pending',
    'trial_no_action', 'payment_failed', 'inactive_30d', 'inactive_60d', 'churned'
  )),
  document_id      UUID REFERENCES documents(id),
  abandonment_data JSONB,
  -- Recovery
  recovery_status TEXT DEFAULT 'pending'
    CHECK (recovery_status IN ('pending', 'in_recovery', 'recovered', 'lost', 'excluded')),
  emails_sent      INTEGER DEFAULT 0,
  whatsapps_sent   INTEGER DEFAULT 0,
  recovered_at     TIMESTAMPTZ,
  recovery_revenue NUMERIC(10,2),
  -- Timestamps
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_action_at TIMESTAMPTZ
);

CREATE INDEX idx_abandonment_user        ON abandonment_events(user_id);
CREATE INDEX idx_abandonment_status      ON abandonment_events(recovery_status);
CREATE INDEX idx_abandonment_next_action ON abandonment_events(next_action_at)
  WHERE recovery_status = 'in_recovery';

-- ════════════════════════════════════════════════════════════════════════
-- API KEYS & WEBHOOKS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE api_keys (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  name       TEXT NOT NULL,
  key_prefix TEXT NOT NULL,   -- 'sk_live_' or 'sk_test_'
  key_suffix TEXT NOT NULL,   -- last 5 chars (display only)
  key_hash   TEXT NOT NULL UNIQUE,  -- SHA-256 of full key
  -- Permissions
  scopes              TEXT[] DEFAULT ARRAY['documents:read', 'documents:write', 'webhooks:read'],
  rate_limit_per_minute INTEGER DEFAULT 60,
  -- Status
  is_active   BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active;

CREATE TABLE webhooks (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  url     TEXT NOT NULL,
  events          TEXT[] NOT NULL,
  signing_secret  TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  failure_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════
-- SEED DATA: Default email flows
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
