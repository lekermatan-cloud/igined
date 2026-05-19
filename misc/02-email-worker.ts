// ════════════════════════════════════════════════════════════════════════
// SIGIL · Email Automation Engine (Cron Worker)
// ════════════════════════════════════════════════════════════════════════
// This is a Supabase Edge Function that runs every minute.
// It processes the message_queue table and sends emails via Resend
// and WhatsApp messages via the WhatsApp Business API.
//
// Deploy with: supabase functions deploy email-worker
// Schedule with: pg_cron extension or Supabase Cron
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ─────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_BUSINESS_TOKEN")!;
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@sigil.app";
const FROM_NAME = "Sigil";
const APP_URL = Deno.env.get("APP_URL") || "https://sigil.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Main handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const startTime = Date.now();
  const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    // 1. Detect new abandonment events (run BEFORE processing queue)
    await detectAbandonments();

    // 2. Schedule new messages for active flows
    await scheduleQueuedMessages();

    // 3. Send messages whose scheduled_for time has arrived
    const messages = await fetchDueMessages();
    stats.processed = messages.length;

    for (const msg of messages) {
      try {
        // Check skip conditions
        if (await shouldSkip(msg)) {
          await markSkipped(msg.id);
          stats.skipped++;
          continue;
        }

        // Send via appropriate channel
        if (msg.channel === "email") {
          await sendEmail(msg);
        } else if (msg.channel === "whatsapp") {
          await sendWhatsApp(msg);
        } else if (msg.channel === "sms") {
          await sendSMS(msg);
        }

        await markSent(msg.id);
        stats.sent++;
      } catch (err) {
        await markFailed(msg.id, err.message);
        stats.failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - startTime,
      ...stats
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ABANDONMENT DETECTION
// ════════════════════════════════════════════════════════════════════════

async function detectAbandonments() {
  // 1. Documents uploaded but never sent (>1 hour old)
  const { data: abandonedUploads } = await supabase
    .from("documents")
    .select("id, created_by, created_at")
    .eq("status", "draft")
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .is("deleted_at", null);

  for (const doc of abandonedUploads || []) {
    // Check if already detected
    const { data: existing } = await supabase
      .from("abandonment_events")
      .select("id")
      .eq("user_id", doc.created_by)
      .eq("document_id", doc.id)
      .eq("abandonment_type", "document_uploaded")
      .single();

    if (!existing) {
      await supabase.from("abandonment_events").insert({
        user_id: doc.created_by,
        document_id: doc.id,
        abandonment_type: "document_uploaded",
        recovery_status: "in_recovery",
        next_action_at: new Date().toISOString()
      });
    }
  }

  // 2. Signers who haven't signed (>24 hours since invitation)
  const { data: pendingSigners } = await supabase
    .from("signers")
    .select("id, email, document_id, invited_at")
    .eq("status", "pending")
    .lt("invited_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  for (const signer of pendingSigners || []) {
    const { data: existing } = await supabase
      .from("abandonment_events")
      .select("id")
      .eq("signer_id", signer.id)
      .eq("abandonment_type", "signature_pending")
      .single();

    if (!existing) {
      await supabase.from("abandonment_events").insert({
        signer_id: signer.id,
        email: signer.email,
        document_id: signer.document_id,
        abandonment_type: "signature_pending",
        recovery_status: "in_recovery",
        next_action_at: new Date().toISOString()
      });
    }
  }

  // 3. Inactive users (no activity for 30 days)
  const { data: inactiveUsers } = await supabase
    .from("profiles")
    .select("id, email, last_active_at")
    .lt("last_active_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .eq("is_suspended", false);

  for (const user of inactiveUsers || []) {
    const { data: existing } = await supabase
      .from("abandonment_events")
      .select("id, detected_at")
      .eq("user_id", user.id)
      .eq("abandonment_type", "inactive_30d")
      .gte("detected_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (!existing) {
      await supabase.from("abandonment_events").insert({
        user_id: user.id,
        email: user.email,
        abandonment_type: "inactive_30d",
        recovery_status: "in_recovery",
        next_action_at: new Date().toISOString()
      });
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// SCHEDULE MESSAGES FOR ACTIVE FLOWS
// ════════════════════════════════════════════════════════════════════════

async function scheduleQueuedMessages() {
  // For each abandonment that's "in_recovery" and ready for next action,
  // pick the right flow + step and queue messages

  const { data: events } = await supabase
    .from("abandonment_events")
    .select("*")
    .eq("recovery_status", "in_recovery")
    .lte("next_action_at", new Date().toISOString())
    .limit(100);

  for (const event of events || []) {
    // Map abandonment type to flow
    const flowIdMap: Record<string, string> = {
      "document_uploaded": "abandoned_upload",
      "signature_pending": "signer_reminder",
      "trial_no_action": "trial_ending",
      "inactive_30d": "inactive_30d",
      "churned": "churn_winback"
    };

    const flowId = flowIdMap[event.abandonment_type];
    if (!flowId) continue;

    // Get flow + steps
    const { data: flow } = await supabase
      .from("email_flows")
      .select("id, is_active")
      .eq("flow_id", flowId)
      .single();

    if (!flow || !flow.is_active) continue;

    const { data: steps } = await supabase
      .from("email_steps")
      .select("*")
      .eq("flow_id", flow.id)
      .order("step_order");

    if (!steps || steps.length === 0) continue;

    // Determine which step we're on (based on emails_sent count)
    const currentStep = steps[event.emails_sent];
    if (!currentStep) {
      // No more steps - mark as lost
      await supabase
        .from("abandonment_events")
        .update({ recovery_status: "lost" })
        .eq("id", event.id);
      continue;
    }

    // Queue the message
    const recipientEmail = event.email || (await getEmailForUser(event.user_id));
    const recipientPhone = await getPhoneForUser(event.user_id);
    const lang = await getLanguageForUser(event.user_id);

    const subject = lang === "he" ? currentStep.subject_he : currentStep.subject_en;
    const bodyHtml = personalizeBody(
      lang === "he" ? currentStep.body_html_he : currentStep.body_html_en,
      event
    );
    const bodyText = personalizeBody(
      lang === "he" ? currentStep.body_text_he : currentStep.body_text_en,
      event
    );

    await supabase.from("message_queue").insert({
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      recipient_user_id: event.user_id,
      recipient_signer_id: event.signer_id,
      flow_id: flow.id,
      step_id: currentStep.id,
      channel: currentStep.channel,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      language: lang,
      scheduled_for: new Date(Date.now() + currentStep.delay_minutes * 60 * 1000).toISOString()
    });

    // Update next_action_at on event
    const nextStep = steps[event.emails_sent + 1];
    const nextActionAt = nextStep
      ? new Date(Date.now() + nextStep.delay_minutes * 60 * 1000).toISOString()
      : null;

    await supabase
      .from("abandonment_events")
      .update({
        emails_sent: event.emails_sent + 1,
        next_action_at: nextActionAt,
        recovery_status: nextStep ? "in_recovery" : "lost"
      })
      .eq("id", event.id);
  }
}

// ════════════════════════════════════════════════════════════════════════
// FETCH MESSAGES DUE FOR SENDING
// ════════════════════════════════════════════════════════════════════════

async function fetchDueMessages() {
  const { data, error } = await supabase
    .from("message_queue")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("priority")
    .order("scheduled_for")
    .limit(100);

  if (error) throw error;
  return data || [];
}

async function shouldSkip(msg: any): Promise<boolean> {
  // Don't send to suspended users
  if (msg.recipient_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", msg.recipient_user_id)
      .single();
    if (profile?.is_suspended) return true;
  }

  // Skip if signer already signed
  if (msg.recipient_signer_id) {
    const { data: signer } = await supabase
      .from("signers")
      .select("status")
      .eq("id", msg.recipient_signer_id)
      .single();
    if (signer?.status === "signed") return true;
  }

  // Skip if message older than 7 days (stale)
  const ageMs = Date.now() - new Date(msg.scheduled_for).getTime();
  if (ageMs > 7 * 24 * 60 * 60 * 1000) return true;

  return false;
}

// ════════════════════════════════════════════════════════════════════════
// SEND VIA RESEND (EMAIL)
// ════════════════════════════════════════════════════════════════════════

async function sendEmail(msg: any) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: msg.recipient_email,
      subject: msg.subject,
      html: msg.body_html,
      text: msg.body_text,
      tags: [
        { name: "flow_id", value: msg.flow_id || "broadcast" },
        { name: "language", value: msg.language || "en" }
      ],
      // Use Resend's tracking pixels
      headers: {
        "X-Sigil-Message-Id": msg.id
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error: ${response.status} ${err}`);
  }

  const result = await response.json();
  await supabase
    .from("message_queue")
    .update({ provider_message_id: result.id })
    .eq("id", msg.id);
}

// ════════════════════════════════════════════════════════════════════════
// SEND VIA WHATSAPP BUSINESS API
// ════════════════════════════════════════════════════════════════════════

async function sendWhatsApp(msg: any) {
  // CRITICAL: WhatsApp requires explicit opt-in. Check before sending.
  if (msg.recipient_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_opted_in, whatsapp_number")
      .eq("id", msg.recipient_user_id)
      .single();

    if (!profile?.whatsapp_opted_in) {
      throw new Error("User has not opted in to WhatsApp messages");
    }
    if (!profile?.whatsapp_number) {
      throw new Error("No WhatsApp number on file");
    }
  }

  // Format phone number (E.164: +972501234567)
  const phone = formatE164(msg.recipient_phone);

  // WhatsApp Business API requires pre-approved templates for marketing.
  // For session messages (within 24h of customer message), free-form is allowed.
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template", // Use approved template
      template: {
        name: "abandonment_recovery", // Pre-approved template name
        language: { code: msg.language === "he" ? "he" : "en_US" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: msg.subject || "Sigil" }
            ]
          }
        ]
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`WhatsApp error: ${response.status} ${err}`);
  }

  const result = await response.json();
  await supabase
    .from("message_queue")
    .update({ provider_message_id: result.messages?.[0]?.id })
    .eq("id", msg.id);
}

// ════════════════════════════════════════════════════════════════════════
// SEND VIA SMS (TWILIO BACKUP CHANNEL)
// ════════════════════════════════════════════════════════════════════════

async function sendSMS(msg: any) {
  const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!TWILIO_SID) {
    throw new Error("Twilio not configured");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

  const formData = new URLSearchParams({
    From: TWILIO_FROM!,
    To: formatE164(msg.recipient_phone),
    Body: msg.body_text || msg.subject
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Twilio error: ${response.status}`);
  }
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

async function markSent(id: string) {
  await supabase
    .from("message_queue")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
}

async function markFailed(id: string, error: string) {
  const { data } = await supabase
    .from("message_queue")
    .select("attempts")
    .eq("id", id)
    .single();

  const attempts = (data?.attempts || 0) + 1;
  const status = attempts >= 3 ? "failed" : "queued";

  await supabase
    .from("message_queue")
    .update({
      status,
      attempts,
      last_error: error,
      // Retry with exponential backoff
      scheduled_for: status === "queued"
        ? new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000).toISOString()
        : undefined
    })
    .eq("id", id);
}

async function markSkipped(id: string) {
  await supabase
    .from("message_queue")
    .update({ status: "skipped" })
    .eq("id", id);
}

async function getEmailForUser(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
  return data?.email || "";
}

async function getPhoneForUser(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("phone, whatsapp_number, whatsapp_opted_in")
    .eq("id", userId)
    .single();
  return (data?.whatsapp_opted_in && data?.whatsapp_number) || data?.phone || null;
}

async function getLanguageForUser(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", userId)
    .single();
  return data?.preferred_language || "he";
}

function personalizeBody(template: string, event: any): string {
  if (!template) return "";
  return template
    .replace(/\{\{name\}\}/g, event.full_name || "")
    .replace(/\{\{document_url\}\}/g, `${APP_URL}/documents/${event.document_id || ""}`)
    .replace(/\{\{app_url\}\}/g, APP_URL)
    .replace(/\{\{unsubscribe_url\}\}/g, `${APP_URL}/unsubscribe?token=${event.user_id || event.signer_id}`);
}

function formatE164(phone: string | null | undefined): string {
  if (!phone) return "";
  // Strip everything but digits and +
  let cleaned = phone.replace(/[^\d+]/g, "");
  // Israeli mobile: 050... → +97250...
  if (cleaned.startsWith("0")) cleaned = "+972" + cleaned.substring(1);
  if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}
