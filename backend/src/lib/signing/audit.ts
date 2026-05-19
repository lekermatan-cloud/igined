import { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "./crypto";

export interface AuditEntry {
  document_id: string;
  signer_id?: string;
  user_id?: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  geolocation?: { lat: number; lng: number; city?: string; country?: string };
}

export async function addAuditEntry(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  const { data: prev } = await supabase
    .from("audit_log")
    .select("current_log_hash")
    .eq("document_id", entry.document_id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .single();

  const previousHash = prev?.current_log_hash || "GENESIS";

  const dataToHash = JSON.stringify({
    ...entry,
    previous_log_hash: previousHash,
    occurred_at: new Date().toISOString(),
  });

  const currentHash = await sha256Hex(dataToHash);

  await supabase.from("audit_log").insert({
    document_id: entry.document_id,
    signer_id: entry.signer_id,
    user_id: entry.user_id,
    event_type: entry.event_type,
    event_data: entry.event_data,
    ip_address: entry.ip_address,
    user_agent: entry.user_agent,
    geolocation: entry.geolocation,
    previous_log_hash: previousHash,
    current_log_hash: currentHash,
    occurred_at: new Date().toISOString(),
  });
}

export async function verifyAuditChain(
  supabase: SupabaseClient,
  documentId: string
): Promise<{ valid: boolean; brokenAt?: string; entries: number }> {
  const { data: entries } = await supabase
    .from("audit_log")
    .select("*")
    .eq("document_id", documentId)
    .order("occurred_at", { ascending: true });

  if (!entries || entries.length === 0) {
    return { valid: true, entries: 0 };
  }

  let expectedPreviousHash = "GENESIS";

  for (const entry of entries) {
    if (entry.previous_log_hash !== expectedPreviousHash) {
      return {
        valid: false,
        brokenAt: entry.occurred_at,
        entries: entries.length,
      };
    }

    const dataToHash = JSON.stringify({
      document_id: entry.document_id,
      signer_id: entry.signer_id,
      user_id: entry.user_id,
      event_type: entry.event_type,
      event_data: entry.event_data,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      geolocation: entry.geolocation,
      previous_log_hash: entry.previous_log_hash,
      occurred_at: entry.occurred_at,
    });

    const computedHash = await sha256Hex(dataToHash);
    if (computedHash !== entry.current_log_hash) {
      return {
        valid: false,
        brokenAt: entry.occurred_at,
        entries: entries.length,
      };
    }

    expectedPreviousHash = entry.current_log_hash;
  }

  return { valid: true, entries: entries.length };
}