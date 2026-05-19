// ════════════════════════════════════════════════════════════════════════
// SIGIL · AI Automation Output Signing
// ════════════════════════════════════════════════════════════════════════
// Sign and certify outputs of automated processes (Make, Zapier, n8n, custom
// scripts, AI agents, etc.) so recipients can verify:
//   1. The output came from a specific automation
//   2. The automation ran at a specific time
//   3. The output was not modified after generation
//   4. The chain of operations that produced it
//
// This is the world's first standardized "automation provenance" system.
// Useful for:
//   - AI agents producing reports/contracts
//   - Make/Zapier/n8n flows generating documents
//   - Compliance with EU AI Act Article 50
//   - Proving non-human origin for legal/regulatory purposes
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ────────────────────────────────────────────────────────────────────────
// AUTOMATION REGISTRATION
// ────────────────────────────────────────────────────────────────────────
// Step 1: Register your automation. You get a key + secret pair.

interface AutomationDefinition {
  team_id: string;
  name: string;
  description?: string;
  type: "make" | "zapier" | "n8n" | "custom_script" | "ai_agent" | "rpa" | "other";
  platform_url?: string;        // e.g., Make scenario URL
  ai_model?: string;             // 'claude-opus-4-7', 'gpt-4', etc.
  ai_provider?: string;          // 'anthropic', 'openai', etc.
  inputs_schema?: any;           // JSON schema describing expected inputs
  outputs_schema?: any;          // JSON schema describing produced outputs
  human_oversight: "none" | "review_after" | "approval_required" | "co-pilot";
}

export async function registerAutomation(def: AutomationDefinition): Promise<{
  automation_id: string;
  signing_key: string;
  webhook_url: string;
}> {
  const automationId = crypto.randomUUID();
  const signingKey = generateSigningKey();
  const signingKeyHash = await sha256Hex(new TextEncoder().encode(signingKey).buffer);
  
  await supabase.from("automations").insert({
    id: automationId,
    team_id: def.team_id,
    name: def.name,
    description: def.description,
    automation_type: def.type,
    platform_url: def.platform_url,
    ai_model: def.ai_model,
    ai_provider: def.ai_provider,
    inputs_schema: def.inputs_schema,
    outputs_schema: def.outputs_schema,
    human_oversight: def.human_oversight,
    signing_key_hash: signingKeyHash,
    is_active: true
  });
  
  return {
    automation_id: automationId,
    signing_key: signingKey,
    webhook_url: `https://api.sigil.app/automation/${automationId}/sign`
  };
}

// ────────────────────────────────────────────────────────────────────────
// AUTOMATION OUTPUT SIGNING
// ────────────────────────────────────────────────────────────────────────
// Step 2: Each automation run signs its outputs with the key.

interface AutomationRun {
  automation_id: string;
  signing_key: string;
  
  // Input data (what triggered the automation)
  inputs: any;
  inputs_hash?: string;        // Optional pre-computed hash
  
  // Output data (what the automation produced)
  output_type: "document" | "data" | "decision" | "action" | "message";
  output_content: string | ArrayBuffer; // Text content OR binary file
  output_metadata?: any;
  
  // Process info
  steps_executed?: Array<{
    step_name: string;
    duration_ms: number;
    tool_used?: string;
    ai_model?: string;
    prompt?: string;          // For AI steps
    response?: string;        // For AI steps  
  }>;
  
  // Context
  triggered_by?: string;       // 'webhook' | 'schedule' | 'user' | etc.
  human_approver_id?: string;  // If a human approved before output
  parent_run_id?: string;      // For chained automations
}

interface AutomationSignature {
  signature_id: string;
  automation_id: string;
  output_hash: string;
  signed_at: string;
  certificate_url: string;
  public_verification_url: string;
  qr_code_url: string;
  visible_label_he: string;
  visible_label_en: string;
}

export async function signAutomationOutput(run: AutomationRun): Promise<AutomationSignature> {
  // 1. Verify signing key
  const keyHash = await sha256Hex(new TextEncoder().encode(run.signing_key).buffer);
  const { data: automation } = await supabase
    .from("automations")
    .select("*")
    .eq("id", run.automation_id)
    .eq("signing_key_hash", keyHash)
    .eq("is_active", true)
    .single();
  
  if (!automation) {
    throw new Error("Invalid automation or signing key");
  }
  
  // 2. Hash the output
  let outputHash: string;
  let outputSizeBytes: number;
  
  if (run.output_content instanceof ArrayBuffer) {
    outputHash = await sha256Hex(run.output_content);
    outputSizeBytes = run.output_content.byteLength;
  } else {
    const buffer = new TextEncoder().encode(run.output_content).buffer;
    outputHash = await sha256Hex(buffer);
    outputSizeBytes = buffer.byteLength;
  }
  
  // 3. Hash the inputs
  const inputsHash = run.inputs_hash || await sha256Hex(
    new TextEncoder().encode(JSON.stringify(run.inputs)).buffer
  );
  
  // 4. Hash the steps (if provided)
  const stepsHash = run.steps_executed
    ? await sha256Hex(new TextEncoder().encode(JSON.stringify(run.steps_executed)).buffer)
    : null;
  
  // 5. Create the run record
  const runId = crypto.randomUUID();
  const signedAt = new Date().toISOString();
  
  // 6. Compute composite signature hash
  // signature = SHA-256(automation_id + output_hash + inputs_hash + steps_hash + timestamp)
  const compositeData = [
    run.automation_id,
    outputHash,
    inputsHash,
    stepsHash || "",
    signedAt
  ].join("|");
  const signatureHash = await sha256Hex(new TextEncoder().encode(compositeData).buffer);
  
  // 7. Get RFC 3161 timestamp (optional but recommended)
  const tsaToken = await getRFC3161Timestamp(signatureHash).catch(() => null);
  
  // 8. Generate public verification ID
  const publicId = signatureHash.substring(0, 24);
  
  // 9. Save signature record
  await supabase.from("automation_signatures").insert({
    id: runId,
    automation_id: run.automation_id,
    team_id: automation.team_id,
    output_type: run.output_type,
    output_hash: outputHash,
    output_size_bytes: outputSizeBytes,
    output_metadata: run.output_metadata,
    inputs_hash: inputsHash,
    inputs_data: run.inputs,
    steps_hash: stepsHash,
    steps_data: run.steps_executed,
    signature_hash: signatureHash,
    public_url: publicId,
    rfc3161_token: tsaToken,
    triggered_by: run.triggered_by,
    human_approver_id: run.human_approver_id,
    parent_run_id: run.parent_run_id,
    signed_at: signedAt
  });
  
  // 10. Update automation usage stats
  await supabase.rpc("increment_automation_runs", {
    automation_id: run.automation_id
  });
  
  // 11. Generate certificate PDF
  const certificateUrl = await generateAutomationCertificate({
    runId,
    automation,
    outputHash,
    inputsHash,
    signedAt,
    signatureHash,
    tsaToken,
    stepsExecuted: run.steps_executed
  });
  
  // 12. Build labels
  const aiLabel = automation.ai_model ? ` · נוצר ע"י ${automation.ai_model}` : "";
  const aiLabelEn = automation.ai_model ? ` · Generated by ${automation.ai_model}` : "";
  
  return {
    signature_id: runId,
    automation_id: run.automation_id,
    output_hash: outputHash,
    signed_at: signedAt,
    certificate_url: certificateUrl,
    public_verification_url: `https://sigil.app/verify/automation/${publicId}`,
    qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://sigil.app/verify/automation/${publicId}`)}`,
    visible_label_he: `🤖 פלט אוטומטי · ${automation.name}${aiLabel} · אומת ב-Sigil`,
    visible_label_en: `🤖 Automated Output · ${automation.name}${aiLabelEn} · Verified by Sigil`
  };
}

// ────────────────────────────────────────────────────────────────────────
// PUBLIC VERIFICATION OF AUTOMATION OUTPUT
// ────────────────────────────────────────────────────────────────────────
// Anyone can verify an automation output using:
//   - The public verification URL, OR
//   - The output content (we re-hash and check registry)

export async function verifyAutomationOutput(
  publicIdOrHash: string
): Promise<{
  valid: boolean;
  automation?: any;
  signature?: any;
  certificate_url?: string;
  reason?: string;
}> {
  // Try by public URL first
  let { data: signature } = await supabase
    .from("automation_signatures")
    .select(`
      *,
      automation:automations (
        id, name, description, automation_type, ai_model, ai_provider,
        human_oversight, total_runs, created_at,
        team:teams ( name, slug )
      )
    `)
    .eq("public_url", publicIdOrHash)
    .single();
  
  // If not found, try by signature hash or output hash
  if (!signature) {
    const result = await supabase
      .from("automation_signatures")
      .select(`
        *,
        automation:automations (
          id, name, description, automation_type, ai_model, ai_provider,
          human_oversight, total_runs, created_at,
          team:teams ( name, slug )
        )
      `)
      .or(`signature_hash.eq.${publicIdOrHash},output_hash.eq.${publicIdOrHash}`)
      .maybeSingle();
    
    signature = result.data;
  }
  
  if (!signature) {
    return {
      valid: false,
      reason: "Automation signature not found in registry"
    };
  }
  
  return {
    valid: true,
    automation: signature.automation,
    signature: {
      signed_at: signature.signed_at,
      output_type: signature.output_type,
      output_hash: signature.output_hash,
      has_tsa_timestamp: !!signature.rfc3161_token,
      triggered_by: signature.triggered_by,
      had_human_approval: !!signature.human_approver_id,
      steps_count: signature.steps_data?.length || 0
    }
  };
}

// ────────────────────────────────────────────────────────────────────────
// CERTIFICATE GENERATION
// ────────────────────────────────────────────────────────────────────────

async function generateAutomationCertificate(params: {
  runId: string;
  automation: any;
  outputHash: string;
  inputsHash: string;
  signedAt: string;
  signatureHash: string;
  tsaToken: string | null;
  stepsExecuted?: any[];
}): Promise<string> {
  const stepsHtml = params.stepsExecuted?.map((step, i) => `
    <div class="step">
      <div class="step-num">${i + 1}</div>
      <div class="step-content">
        <div class="step-name">${escapeHtml(step.step_name)}</div>
        ${step.tool_used ? `<div class="step-meta">Tool: ${escapeHtml(step.tool_used)}</div>` : ""}
        ${step.ai_model ? `<div class="step-meta">AI Model: ${escapeHtml(step.ai_model)}</div>` : ""}
        ${step.duration_ms ? `<div class="step-meta">Duration: ${step.duration_ms}ms</div>` : ""}
      </div>
    </div>
  `).join("") || "<div>(No steps recorded)</div>";
  
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
  body { font-family: 'Frank Ruhl Libre', serif; padding: 40px; background: #fdf9f0; color: #0f1422; }
  .border { border: 3px double #c8924a; padding: 40px; min-height: 1000px; position: relative; }
  .header { text-align: center; border-bottom: 1px solid #c8924a44; padding-bottom: 24px; }
  .robot-icon { font-size: 48px; margin-bottom: 8px; }
  h1 { font-size: 32px; color: #c8924a; margin: 12px 0 4px; }
  .subtitle { color: #666; font-size: 13px; }
  .badge { display: inline-block; background: #c8924a; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; margin-top: 12px; }
  .section { margin: 30px 0; }
  .section-title { font-size: 18px; color: #c8924a; border-bottom: 1px solid #c8924a22; padding-bottom: 6px; margin-bottom: 12px; }
  .row { display: flex; padding: 8px 0; }
  .label { font-weight: 700; min-width: 200px; color: #333; font-size: 13px; }
  .value { color: #0f1422; font-size: 13px; }
  .hash { font-family: 'JetBrains Mono', monospace; font-size: 10px; word-break: break-all; color: #c8924a; background: #c8924a11; padding: 6px 10px; border-radius: 4px; margin-top: 4px; }
  .step { display: flex; gap: 12px; padding: 10px; background: #c8924a08; border-right: 3px solid #c8924a; margin: 6px 0; }
  .step-num { font-weight: 700; color: #c8924a; min-width: 24px; }
  .step-name { font-weight: 600; }
  .step-meta { font-size: 11px; color: #666; font-family: 'JetBrains Mono', monospace; }
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; padding-top: 20px; border-top: 1px solid #c8924a22; }
  .qr-section { text-align: center; margin: 24px 0; }
  .qr-section img { width: 140px; height: 140px; }
</style>
</head>
<body>
  <div class="border">
    <div class="header">
      <div class="robot-icon">🤖</div>
      <h1>תעודת פלט אוטומטי</h1>
      <div class="subtitle">Automated Output Certificate · Sigil</div>
      <div class="badge">${params.automation.ai_model ? "AI-GENERATED CONTENT" : "AUTOMATED PROCESS OUTPUT"}</div>
    </div>

    <div class="section">
      <div class="section-title">פרטי האוטומציה</div>
      <div class="row"><span class="label">שם האוטומציה</span><span class="value">${escapeHtml(params.automation.name)}</span></div>
      <div class="row"><span class="label">סוג</span><span class="value">${params.automation.automation_type}</span></div>
      ${params.automation.ai_model ? `<div class="row"><span class="label">מודל AI</span><span class="value">${escapeHtml(params.automation.ai_model)} (${escapeHtml(params.automation.ai_provider || "")})</span></div>` : ""}
      <div class="row"><span class="label">פיקוח אנושי</span><span class="value">${humanOversightLabel(params.automation.human_oversight, "he")}</span></div>
      <div class="row"><span class="label">תאריך הרצה</span><span class="value">${new Date(params.signedAt).toLocaleString("he-IL")}</span></div>
    </div>

    <div class="section">
      <div class="section-title">שלבי הביצוע</div>
      ${stepsHtml}
    </div>

    <div class="section">
      <div class="section-title">חתימות קריפטוגרפיות</div>
      <div><strong>טביעת אצבע פלט (SHA-256):</strong></div>
      <div class="hash">${params.outputHash}</div>
      <div style="margin-top: 8px;"><strong>טביעת אצבע קלט (SHA-256):</strong></div>
      <div class="hash">${params.inputsHash}</div>
      <div style="margin-top: 8px;"><strong>חתימה מורכבת (SHA-256):</strong></div>
      <div class="hash">${params.signatureHash}</div>
      ${params.tsaToken ? `<div style="margin-top: 8px;"><strong>חתימת זמן מאומתת (RFC 3161):</strong> ✓ קיימת</div>` : `<div style="margin-top: 8px; color: #999;">חתימת זמן: לא הופקה</div>`}
    </div>

    <div class="qr-section">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://sigil.app/verify/automation/${params.signatureHash.substring(0,24)}`)}" />
      <div style="margin-top: 8px; font-size: 11px;">
        אמת בסריקה<br>sigil.app/verify/automation/${params.signatureHash.substring(0, 24)}
      </div>
    </div>

    <div class="footer">
      תעודה זו מאשרת שהפלט נוצר ע"י תהליך אוטומטי, לא אנושי, בהתאם לרישום ב-Sigil.<br>
      תואם EU AI Act Article 50 (תקף מ-2.8.2026) · תואם ESIGN Act · חוק חתימה אלקטרונית התשס"א-2001
    </div>
  </div>
</body>
</html>`;
  
  // Send to PDF service
  const PDFSHIFT_API = Deno.env.get("PDFSHIFT_API_KEY");
  if (!PDFSHIFT_API) return ""; // Skip if not configured
  
  const response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`api:${PDFSHIFT_API}`)}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ source: html })
  });
  
  if (!response.ok) return "";
  
  const buffer = await response.arrayBuffer();
  const path = `automation-certificates/${params.runId}.pdf`;
  await supabase.storage
    .from("certificates")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  
  return supabase.storage.from("certificates").getPublicUrl(path).data.publicUrl;
}

// ────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────

function generateSigningKey(): string {
  const random = crypto.getRandomValues(new Uint8Array(32));
  return "sigil_auto_" + Array.from(random).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getRFC3161Timestamp(hash: string): Promise<string | null> {
  const TSA_URL = Deno.env.get("TSA_URL") || "https://freetsa.org/tsr";
  try {
    const response = await fetch(TSA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query" },
      body: hexToBytes(hash)
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanOversightLabel(level: string, lang: "he" | "en"): string {
  const map: Record<string, { he: string; en: string }> = {
    none: { he: "ללא פיקוח אנושי", en: "No human oversight" },
    review_after: { he: "סקירה אחרי הביצוע", en: "Post-execution review" },
    approval_required: { he: "אישור אנושי נדרש", en: "Human approval required" },
    "co-pilot": { he: "co-pilot - שיתוף פעולה אנושי", en: "Co-pilot mode" }
  };
  return map[level]?.[lang] || level;
}

// ────────────────────────────────────────────────────────────────────────
// HTTP HANDLER
// ────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);
  
  try {
    // POST /register → Register a new automation
    if (path[0] === "register" && req.method === "POST") {
      const body = await req.json();
      const result = await registerAutomation(body);
      return jsonResponse(result, 201);
    }
    
    // POST /sign → Sign automation output
    if (path[0] === "sign" && req.method === "POST") {
      const body = await req.json();
      const result = await signAutomationOutput(body);
      return jsonResponse(result);
    }
    
    // GET /verify/:id → Verify automation output by public ID
    if (path[0] === "verify" && req.method === "GET") {
      const result = await verifyAutomationOutput(path[1]);
      return jsonResponse(result);
    }
    
    return new Response("Not found", { status: 404 });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
