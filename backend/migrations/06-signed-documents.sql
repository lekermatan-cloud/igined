-- ════════════════════════════════════════════════════════════════════════
-- Signed Document Storage
-- Adds a column to store the URL of the signed PDF with signature overlays
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_file_url TEXT;
