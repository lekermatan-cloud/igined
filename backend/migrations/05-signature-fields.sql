-- ════════════════════════════════════════════════════════════════════════
-- Signature Fields Support for Drag-and-Drop Signing
-- ════════════════════════════════════════════════════════════════════════

-- Add field_values column to store signer's filled field values
ALTER TABLE signers ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}'::JSONB;

-- Add label column to document_fields for display purposes
ALTER TABLE document_fields ADD COLUMN IF NOT EXISTS label TEXT;

-- Add field_order column for ordering fields within a signer
ALTER TABLE document_fields ADD COLUMN IF NOT EXISTS field_order INTEGER DEFAULT 0;

-- Index for faster field lookups by signer
CREATE INDEX IF NOT EXISTS idx_document_fields_signer ON document_fields(signer_id);

-- Allow NULL signer_id for sender-defined fields (fields that belong to document, not specific signer)
ALTER TABLE document_fields ALTER COLUMN signer_id DROP NOT NULL;