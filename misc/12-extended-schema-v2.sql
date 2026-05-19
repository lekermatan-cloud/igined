-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Schema Extensions for Authenticity Verification + Automation Signing
-- ════════════════════════════════════════════════════════════════════════
-- Run AFTER 01-schema.sql AND 09-extended-schema.sql.
-- Adds:
--   - verification_log: every authenticity check
--   - automations: registered automation definitions
--   - automation_signatures: each signed automation output
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- VERIFICATION LOG
-- ════════════════════════════════════════════════════════════════════════
-- Public verification feature - logs every check (anonymous or by registered user).
-- Used for analytics, anti-abuse, and demonstrating product value.

CREATE TABLE IF NOT EXISTS verification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- What was checked
  file_hash TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  -- Verdict
  verdict TEXT NOT NULL CHECK (verdict IN ('authentic', 'tampered', 'ai_generated', 'suspicious', 'unknown')),
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  is_ai BOOLEAN DEFAULT FALSE,
  is_tampered BOOLEAN DEFAULT FALSE,
  is_in_registry BOOLEAN DEFAULT FALSE,
  -- Full report (for debugging + analytics)
  full_report JSONB,
  -- Who checked (optional)
  checked_by_user_id UUID REFERENCES profiles(id),
  checked_by_team_id UUID REFERENCES teams(id),
  ip_address INET,
  -- Timestamp
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verlog_hash ON verification_log(file_hash);
CREATE INDEX IF NOT EXISTS idx_verlog_verdict ON verification_log(verdict);
CREATE INDEX IF NOT EXISTS idx_verlog_user ON verification_log(checked_by_user_id);
CREATE INDEX IF NOT EXISTS idx_verlog_when ON verification_log(checked_at DESC);

-- Public verification logs are NOT enabled with RLS - anyone can read aggregated stats
-- but full reports are admin-only

ALTER TABLE verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own verifications" ON verification_log
  FOR SELECT USING (
    checked_by_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

CREATE POLICY "Anyone can insert verification" ON verification_log
  FOR INSERT WITH CHECK (TRUE);

-- ════════════════════════════════════════════════════════════════════════
-- AUTOMATIONS REGISTRY
-- ════════════════════════════════════════════════════════════════════════
-- Every registered automation gets an entry here.
-- Each automation has a signing key (hashed) used to sign outputs.

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  automation_type TEXT NOT NULL CHECK (automation_type IN (
    'make', 'zapier', 'n8n', 'custom_script', 'ai_agent', 'rpa', 'other'
  )),
  -- Technical details
  platform_url TEXT,
  ai_model TEXT,         -- e.g., 'claude-opus-4-7', 'gpt-4-turbo'
  ai_provider TEXT,      -- e.g., 'anthropic', 'openai'
  inputs_schema JSONB,
  outputs_schema JSONB,
  -- Compliance
  human_oversight TEXT NOT NULL DEFAULT 'none'
    CHECK (human_oversight IN ('none', 'review_after', 'approval_required', 'co-pilot')),
  -- Authentication
  signing_key_hash TEXT UNIQUE NOT NULL,  -- SHA-256 of the signing key
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  total_runs BIGINT DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auto_team ON automations(team_id);
CREATE INDEX IF NOT EXISTS idx_auto_active ON automations(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_auto_keyhash ON automations(signing_key_hash);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage automations" ON automations
  FOR ALL USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin', 'editor')
    )
  );

-- RPC to atomically increment run counter
CREATE OR REPLACE FUNCTION increment_automation_runs(automation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE automations
  SET total_runs = total_runs + 1,
      last_used_at = NOW()
  WHERE id = automation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════
-- AUTOMATION SIGNATURES
-- ════════════════════════════════════════════════════════════════════════
-- Each automation run that produces a signed output creates a record here.

CREATE TABLE IF NOT EXISTS automation_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Output
  output_type TEXT NOT NULL CHECK (output_type IN ('document', 'data', 'decision', 'action', 'message')),
  output_hash TEXT NOT NULL,
  output_size_bytes BIGINT,
  output_metadata JSONB,
  -- Inputs (what triggered)
  inputs_hash TEXT NOT NULL,
  inputs_data JSONB,
  -- Steps (what happened)
  steps_hash TEXT,
  steps_data JSONB,    -- Array of step objects with timing, tools, AI prompts
  -- Signature
  signature_hash TEXT NOT NULL UNIQUE,  -- The composite SHA-256 signature
  rfc3161_token TEXT,                    -- RFC 3161 timestamp from TSA
  public_url TEXT UNIQUE,                -- Short ID for public verification
  -- Context
  triggered_by TEXT,                     -- 'webhook', 'schedule', 'user', etc.
  human_approver_id UUID REFERENCES profiles(id),  -- If human approved
  parent_run_id UUID REFERENCES automation_signatures(id),  -- For chained runs
  -- Timestamps
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Verification stats
  verification_count INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_autosig_automation ON automation_signatures(automation_id);
CREATE INDEX IF NOT EXISTS idx_autosig_team ON automation_signatures(team_id);
CREATE INDEX IF NOT EXISTS idx_autosig_hash ON automation_signatures(signature_hash);
CREATE INDEX IF NOT EXISTS idx_autosig_output ON automation_signatures(output_hash);
CREATE INDEX IF NOT EXISTS idx_autosig_public ON automation_signatures(public_url);
CREATE INDEX IF NOT EXISTS idx_autosig_when ON automation_signatures(signed_at DESC);

ALTER TABLE automation_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view their signatures" ON automation_signatures
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM user_team_ids(auth.uid()))
  );

CREATE POLICY "Public can verify by signature_hash" ON automation_signatures
  FOR SELECT USING (TRUE);

-- ════════════════════════════════════════════════════════════════════════
-- PRE-CONFIGURED AUTOMATION TEMPLATES (seed data)
-- ════════════════════════════════════════════════════════════════════════
-- Templates users can enable with one click for popular automation tools.

CREATE TABLE IF NOT EXISTS automation_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Identity
  template_id TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_he TEXT,
  description_en TEXT,
  category TEXT,
  -- Platform
  platform TEXT NOT NULL,  -- 'make', 'zapier', 'n8n', 'native'
  platform_template_url TEXT,  -- Link to import the template
  -- Use case
  use_case_he TEXT,
  use_case_en TEXT,
  -- Setup instructions
  setup_steps_he JSONB,
  setup_steps_en JSONB,
  -- Stats
  use_count INTEGER DEFAULT 0,
  -- Status
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO automation_templates (template_id, name_he, name_en, category, platform, use_case_he, use_case_en) VALUES
  ('make_invoice_generator', 'יצירת חשבוניות אוטומטית', 'Automated Invoice Generator', 'accounting', 'make',
   'יצירת חשבוניות אוטומטית מ-Stripe/PayPal עם חתימה דיגיטלית של Sigil',
   'Auto-generate invoices from Stripe/PayPal with Sigil digital signature'),
  
  ('claude_contract_drafter', 'ניסוח חוזים ע"י Claude', 'Claude Contract Drafter', 'legal', 'native',
   'Claude AI מנסח חוזה לפי הוראות המשתמש, החוזה נחתם אוטומטית כ-AI-generated',
   'Claude AI drafts contracts from user prompts, output auto-signed as AI-generated'),
  
  ('zapier_lead_qualifier', 'סינון לידים ע"י AI', 'AI Lead Qualifier', 'sales', 'zapier',
   'Zap שמנתח לידים נכנסים, מעריך אותם, ושולח דו"ח חתום ל-CRM',
   'Zap analyzes incoming leads, scores them, and sends signed report to CRM'),
  
  ('n8n_legal_research', 'מחקר משפטי אוטומטי', 'Automated Legal Research', 'legal', 'n8n',
   'n8n flow שמבצע מחקר משפטי במאגרים, מסכם, וחותם על המסמך',
   'n8n flow performs legal database research, summarizes, signs document'),
  
  ('make_social_post_generator', 'יצירת תוכן לרשתות חברתיות', 'Social Media Post Generator', 'marketing', 'make',
   'יצירת פוסטים אוטומטית עם סימון C2PA + חתימת Sigil לציות EU AI Act',
   'Auto-generate social posts with C2PA labeling + Sigil signature for EU AI Act compliance'),
  
  ('claude_email_responder', 'מענה אוטומטי למיילים', 'Automated Email Responder', 'support', 'native',
   'Claude עונה על מיילי תמיכה, התשובות חתומות ומסומנות כ-AI',
   'Claude responds to support emails, responses signed and labeled as AI'),
  
  ('rpa_data_extractor', 'חילוץ נתונים אוטומטי', 'RPA Data Extractor', 'data', 'other',
   'בוט RPA שמחלץ נתונים ממסמכים, יוצר דו"ח חתום עם chain of custody',
   'RPA bot extracts data from documents, creates signed report with chain of custody');

-- ════════════════════════════════════════════════════════════════════════
-- AUTOMATIONS DASHBOARD VIEW
-- ════════════════════════════════════════════════════════════════════════
-- Materialized view for efficient dashboard queries

CREATE OR REPLACE VIEW automation_dashboard AS
SELECT
  a.id,
  a.team_id,
  a.name,
  a.automation_type,
  a.ai_model,
  a.is_active,
  a.created_at,
  a.last_used_at,
  a.total_runs,
  COUNT(DISTINCT asig.id) AS total_signatures,
  COUNT(DISTINCT asig.id) FILTER (WHERE asig.signed_at > NOW() - INTERVAL '7 days') AS signatures_last_7d,
  COUNT(DISTINCT asig.id) FILTER (WHERE asig.signed_at > NOW() - INTERVAL '30 days') AS signatures_last_30d,
  AVG(asig.verification_count) AS avg_verifications,
  MAX(asig.signed_at) AS last_signature_at
FROM automations a
LEFT JOIN automation_signatures asig ON asig.automation_id = a.id
GROUP BY a.id;

-- ════════════════════════════════════════════════════════════════════════
-- ANALYTICS FUNCTION
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_verification_stats(start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days')
RETURNS TABLE (
  total_verifications BIGINT,
  authentic_count BIGINT,
  tampered_count BIGINT,
  ai_generated_count BIGINT,
  suspicious_count BIGINT,
  unique_files BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE verdict = 'authentic'),
    COUNT(*) FILTER (WHERE verdict = 'tampered'),
    COUNT(*) FILTER (WHERE verdict = 'ai_generated'),
    COUNT(*) FILTER (WHERE verdict = 'suspicious'),
    COUNT(DISTINCT file_hash),
    COUNT(DISTINCT checked_by_user_id) FILTER (WHERE checked_by_user_id IS NOT NULL)
  FROM verification_log
  WHERE checked_at >= start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
