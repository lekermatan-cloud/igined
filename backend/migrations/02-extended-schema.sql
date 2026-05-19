-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Extended Schema (PostgreSQL)
-- ════════════════════════════════════════════════════════════════════════
-- Run AFTER 01-schema.sql.
-- Adds:
--   - Video / image signing columns
--   - Digital product sales
--   - AI contract analysis
--   - Lawyer case management
--   - Marketing campaigns
--   - Lawyer verification
-- ════════════════════════════════════════════════════════════════════════

-- ─── Additional columns on documents ────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signed_video_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_image_url TEXT,
  ADD COLUMN IF NOT EXISTS pixel_hash       TEXT,
  ADD COLUMN IF NOT EXISTS language         TEXT DEFAULT 'he' CHECK (language IN ('he', 'en')),
  ADD COLUMN IF NOT EXISTS ai_analysis_id   UUID;

-- ════════════════════════════════════════════════════════════════════════
-- DIGITAL PRODUCT SALES
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS digital_product_sales (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Product
  product_name        TEXT NOT NULL,
  product_description TEXT,
  product_url         TEXT NOT NULL,
  product_hash        TEXT NOT NULL,
  product_size_bytes  BIGINT,
  product_type        TEXT,  -- 'ebook' | 'audio' | 'video' | 'code' | 'design_files' | 'archive'
  -- Buyer
  buyer_email   TEXT NOT NULL,
  buyer_name    TEXT NOT NULL,
  buyer_country TEXT,
  -- Certificate
  certificate_hash    TEXT NOT NULL,
  certificate_pdf_url TEXT,
  bundled_zip_url     TEXT,
  -- License
  license_terms          TEXT NOT NULL,
  resale_allowed         BOOLEAN DEFAULT FALSE,
  commercial_use_allowed BOOLEAN DEFAULT TRUE,
  attribution_required   BOOLEAN DEFAULT FALSE,
  -- Payment
  amount_paid      NUMERIC(10,2),
  currency         TEXT DEFAULT 'USD',
  payment_provider TEXT,  -- 'stripe' | 'tranzila' | 'paypal' | 'manual'
  payment_id       TEXT,
  -- Lifecycle
  download_count    INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  -- Resale chain
  resold_from_id  UUID REFERENCES digital_product_sales(id),
  is_active_owner BOOLEAN DEFAULT TRUE,
  -- Timestamps
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dps_team  ON digital_product_sales(team_id);
CREATE INDEX IF NOT EXISTS idx_dps_buyer ON digital_product_sales(buyer_email);
CREATE INDEX IF NOT EXISTS idx_dps_hash  ON digital_product_sales(certificate_hash);

-- ════════════════════════════════════════════════════════════════════════
-- AI CONTRACT ANALYSIS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contract_analyses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- Analysis
  contract_type     TEXT NOT NULL,
  detected_language TEXT NOT NULL CHECK (detected_language IN ('he', 'en', 'mixed')),
  -- Risk
  risk_score     INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level     TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  findings_count INTEGER NOT NULL DEFAULT 0,
  findings_data  JSONB NOT NULL,
  -- Summaries
  summary_he           TEXT,
  summary_en           TEXT,
  recommended_actions  TEXT[],
  -- Provenance
  ai_model_used       TEXT DEFAULT 'claude-opus-4-7',
  analysis_duration_ms INTEGER,
  cost_credits        NUMERIC(10,4),
  -- Timestamps & feedback
  analyzed_at   TIMESTAMPTZ DEFAULT NOW(),
  user_rating   INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_doc  ON contract_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_analyses_risk ON contract_analyses(risk_level);

-- ════════════════════════════════════════════════════════════════════════
-- LAWYER CASE MANAGEMENT
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS legal_cases (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Identification
  case_number        TEXT,
  court_case_number  TEXT,
  court_name         TEXT,
  -- Parties
  client_name       TEXT NOT NULL,
  client_id_number  TEXT,
  opposing_party_name TEXT,
  -- Type & subject
  case_type    TEXT,  -- 'civil' | 'family' | 'criminal' | 'labor' | 'administrative' | 'commercial'
  case_subject TEXT NOT NULL,
  legal_basis  TEXT,
  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('intake', 'active', 'in_court', 'pending_decision', 'closed', 'archived')),
  -- Dates
  opened_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  next_hearing_at TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  -- Financials
  fee_arrangement        TEXT,  -- 'hourly' | 'flat' | 'contingency' | 'hybrid'
  hourly_rate            NUMERIC(10,2),
  flat_fee               NUMERIC(10,2),
  contingency_percentage NUMERIC(5,2),
  total_billed           NUMERIC(12,2) DEFAULT 0,
  total_paid             NUMERIC(12,2) DEFAULT 0,
  notes                  TEXT,
  primary_attorney_id    UUID REFERENCES profiles(id),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_team     ON legal_cases(team_id);
CREATE INDEX IF NOT EXISTS idx_cases_status   ON legal_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_attorney ON legal_cases(primary_attorney_id);
CREATE INDEX IF NOT EXISTS idx_cases_hearing  ON legal_cases(next_hearing_at)
  WHERE status IN ('active', 'in_court');

-- ─── Documents linked to cases ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_documents (
  case_id     UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id)   ON DELETE CASCADE,
  document_role TEXT,  -- 'engagement' | 'pleading' | 'evidence' | 'judgment' | 'correspondence'
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (case_id, document_id)
);

-- ─── Time entries (hourly billing) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  attorney_id UUID NOT NULL REFERENCES profiles(id),
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL,
  description TEXT NOT NULL,
  is_billable BOOLEAN DEFAULT TRUE,
  hourly_rate NUMERIC(10,2),
  amount      NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN is_billable THEN (duration_minutes::NUMERIC / 60) * hourly_rate ELSE 0 END
  ) STORED,
  is_invoiced BOOLEAN DEFAULT FALSE,
  invoice_id  UUID REFERENCES invoices(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_case     ON time_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_time_attorney ON time_entries(attorney_id);

-- ════════════════════════════════════════════════════════════════════════
-- MARKETING CAMPAIGNS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN (
    'email_blast', 'cold_outreach', 'paid_ads', 'webinar', 'content_series'
  )),
  target_market    TEXT NOT NULL CHECK (target_market IN ('IL', 'US', 'EU', 'global')),
  target_audience  TEXT,
  language         TEXT DEFAULT 'en' CHECK (language IN ('he', 'en')),
  -- Status & schedule
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
  scheduled_start  TIMESTAMPTZ,
  scheduled_end    TIMESTAMPTZ,
  -- Targeting
  recipient_filter     JSONB,
  estimated_recipients INTEGER,
  -- Content
  email_subject          TEXT,
  email_body_html        TEXT,
  whatsapp_template_name TEXT,
  landing_page_url       TEXT,
  utm_source             TEXT,
  utm_medium             TEXT,
  utm_campaign           TEXT,
  -- Budget
  budget_amount   NUMERIC(10,2),
  budget_currency TEXT DEFAULT 'USD',
  -- Results
  total_sent         INTEGER DEFAULT 0,
  total_opens        INTEGER DEFAULT 0,
  total_clicks       INTEGER DEFAULT 0,
  total_conversions  INTEGER DEFAULT 0,
  attributed_revenue NUMERIC(12,2) DEFAULT 0,
  -- Ownership
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_market ON marketing_campaigns(target_market);

-- ════════════════════════════════════════════════════════════════════════
-- LAWYER VERIFICATION (Israeli Bar Association)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lawyer_verifications (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  -- Bar info
  bar_number          TEXT NOT NULL,
  bar_country         TEXT DEFAULT 'IL',
  full_name_on_record TEXT,
  -- Verification
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_at          TIMESTAMPTZ,
  verification_method  TEXT,  -- 'manual' | 'api' | 'document_upload'
  verification_doc_url TEXT,
  -- Renewal
  expires_at       DATE,
  rejection_reason TEXT,
  admin_notes      TEXT,
  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyer_user   ON lawyer_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_status ON lawyer_verifications(status);

-- ════════════════════════════════════════════════════════════════════════
-- SEED DATA: US-targeted marketing campaign template
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO marketing_campaigns (
  campaign_name, campaign_type, target_market, target_audience, language,
  email_subject, email_body_html,
  utm_source, utm_medium, utm_campaign, recipient_filter
) VALUES (
  'US Solo Lawyers - Cold Outreach Template',
  'cold_outreach', 'US', 'lawyers', 'en',
  'How solo attorneys are saving 10+ hours/week',
  '<h1>Hi {{first_name}},</h1><p>I noticed you''re a solo practitioner in {{state}}. Most solo attorneys spend 8-12 hours per week chasing client signatures.</p><p>Sigil is a new e-signature platform built for solo lawyers. Unlike DocuSign:</p><ul><li>$8/month vs $25/month</li><li>Israeli-grade cryptographic ownership proof</li><li>Built-in NDA templates compliant with all 50 states</li><li>AI risk analysis before clients sign</li></ul><p>Free for first 14 days. <a href="{{cta_url}}">Try it</a></p><p>— Matan, Founder</p>',
  'cold_email', 'outreach', 'us_solo_lawyers_q3_2026',
  '{"country": "US", "audience": "solo_lawyers", "estimated_size": 5000}'::JSONB
);
