import { createServiceClient } from "../supabase";
import type { Env } from "../../config";

interface AbandonmentEvent {
  id: string;
  user_id: string | null;
  signer_id: string | null;
  document_id: string | null;
  email: string | null;
  abandonment_type: string;
  recovery_status: string;
  emails_sent: number;
  next_action_at: string | null;
}

export class AbandonmentDetector {
  private supabase: ReturnType<typeof createServiceClient>;
  private appUrl: string;

  constructor(env: Env) {
    this.supabase = createServiceClient(env);
    this.appUrl = env.APP_URL || "https://sigil.app";
  }

  async detectAbandonments(): Promise<number> {
    let count = 0;

    count += await this.detectDraftDocuments();
    count += await this.detectPendingSigners();
    count += await this.detectInactiveUsers();

    return count;
  }

  private async detectDraftDocuments(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: abandonedDocs } = await this.supabase
      .from("documents")
      .select("id, created_by, created_at")
      .eq("status", "draft")
      .lt("created_at", oneHourAgo)
      .is("deleted_at", null);

    let count = 0;
    for (const doc of abandonedDocs || []) {
      const { data: existing } = await this.supabase
        .from("abandonment_events")
        .select("id")
        .eq("user_id", doc.created_by)
        .eq("document_id", doc.id)
        .eq("abandonment_type", "document_uploaded")
        .single();

      if (!existing) {
        await this.supabase.from("abandonment_events").insert({
          user_id: doc.created_by,
          document_id: doc.id,
          abandonment_type: "document_uploaded",
          recovery_status: "in_recovery",
          next_action_at: new Date().toISOString(),
        });
        count++;
      }
    }

    return count;
  }

  private async detectPendingSigners(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingSigners } = await this.supabase
      .from("signers")
      .select("id, email, document_id, invited_at")
      .eq("status", "pending")
      .lt("invited_at", oneDayAgo);

    let count = 0;
    for (const signer of pendingSigners || []) {
      const { data: existing } = await this.supabase
        .from("abandonment_events")
        .select("id")
        .eq("signer_id", signer.id)
        .eq("abandonment_type", "signature_pending")
        .single();

      if (!existing) {
        await this.supabase.from("abandonment_events").insert({
          signer_id: signer.id,
          email: signer.email,
          document_id: signer.document_id,
          abandonment_type: "signature_pending",
          recovery_status: "in_recovery",
          next_action_at: new Date().toISOString(),
        });
        count++;
      }
    }

    return count;
  }

  private async detectInactiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveUsers } = await this.supabase
      .from("profiles")
      .select("id, email, last_active_at")
      .lt("last_active_at", thirtyDaysAgo)
      .eq("is_suspended", false);

    let count = 0;
    for (const user of inactiveUsers || []) {
      const { data: existing } = await this.supabase
        .from("abandonment_events")
        .select("id, detected_at")
        .eq("user_id", user.id)
        .eq("abandonment_type", "inactive_30d")
        .gte("detected_at", thirtyDaysAgo)
        .single();

      if (!existing) {
        await this.supabase.from("abandonment_events").insert({
          user_id: user.id,
          email: user.email,
          abandonment_type: "inactive_30d",
          recovery_status: "in_recovery",
          next_action_at: new Date().toISOString(),
        });
        count++;
      }
    }

    return count;
  }

  async scheduleQueuedMessages(): Promise<number> {
    const { data: events } = await this.supabase
      .from("abandonment_events")
      .select("*")
      .eq("recovery_status", "in_recovery")
      .lte("next_action_at", new Date().toISOString())
      .limit(100);

    let count = 0;
    for (const event of events || []) {
      const flowIdMap: Record<string, string> = {
        document_uploaded: "abandoned_upload",
        signature_pending: "signer_reminder",
        inactive_30d: "inactive_30d",
      };

      const flowId = flowIdMap[event.abandonment_type];
      if (!flowId) continue;

      const { data: flow } = await this.supabase
        .from("email_flows")
        .select("id, is_active")
        .eq("flow_id", flowId)
        .single();

      if (!flow || !flow.is_active) continue;

      const { data: steps } = await this.supabase
        .from("email_steps")
        .select("*")
        .eq("flow_id", flow.id)
        .order("step_order");

      if (!steps || steps.length === 0) continue;

      const currentStep = steps[event.emails_sent];
      if (!currentStep) {
        await this.supabase
          .from("abandonment_events")
          .update({ recovery_status: "lost" })
          .eq("id", event.id);
        continue;
      }

      const recipientEmail = event.email || (await this.getEmailForUser(event.user_id));
      if (!recipientEmail) continue;

      const lang = await this.getLanguageForUser(event.user_id);

      const subject = lang === "he" ? currentStep.subject_he : currentStep.subject_en;
      const bodyHtml = this.personalizeBody(
        lang === "he" ? currentStep.body_html_he : currentStep.body_html_en,
        event
      );
      const bodyText = this.personalizeBody(
        lang === "he" ? currentStep.body_text_he : currentStep.body_text_en,
        event
      );

      await this.supabase.from("message_queue").insert({
        recipient_email: recipientEmail,
        recipient_user_id: event.user_id,
        recipient_signer_id: event.signer_id,
        flow_id: flow.id,
        step_id: currentStep.id,
        channel: currentStep.channel,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        language: lang,
        scheduled_for: new Date(Date.now() + currentStep.delay_minutes * 60 * 1000).toISOString(),
      });

      const nextStep = steps[event.emails_sent + 1];
      const nextActionAt = nextStep
        ? new Date(Date.now() + nextStep.delay_minutes * 60 * 1000).toISOString()
        : null;

      await this.supabase
        .from("abandonment_events")
        .update({
          emails_sent: event.emails_sent + 1,
          next_action_at: nextActionAt,
          recovery_status: nextStep ? "in_recovery" : "lost",
        })
        .eq("id", event.id);

      count++;
    }

    return count;
  }

  async shouldSkip(msg: QueuedMessage): Promise<boolean> {
    if (msg.recipient_user_id) {
      const { data: profile } = await this.supabase
        .from("profiles")
        .select("is_suspended")
        .eq("id", msg.recipient_user_id)
        .single();

      if (profile?.is_suspended) return true;
    }

    if (msg.recipient_signer_id) {
      const { data: signer } = await this.supabase
        .from("signers")
        .select("status")
        .eq("id", msg.recipient_signer_id)
        .single();

      if (signer?.status === "signed") return true;
    }

    const ageMs = Date.now() - new Date(msg.scheduled_for).getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) return true;

    return false;
  }

  private async getEmailForUser(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const { data } = await this.supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();
    return data?.email || null;
  }

  private async getLanguageForUser(userId: string | null): Promise<string> {
    if (!userId) return "he";
    const { data } = await this.supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", userId)
      .single();
    return data?.preferred_language || "he";
  }

  private personalizeBody(template: string | null, event: AbandonmentEvent): string {
    if (!template) return "";
    return template
      .replace(/\{\{name\}\}/g, event.email?.split("@")[0] || "")
      .replace(/\{\{document_url\}\}/g, `${this.appUrl}/documents/${event.document_id || ""}`)
      .replace(/\{\{app_url\}\}/g, this.appUrl)
      .replace(/\{\{unsubscribe_url\}\}/g, `${this.appUrl}/unsubscribe?token=${event.user_id || event.signer_id}`);
  }
}

interface QueuedMessage {
  recipient_user_id: string | null;
  recipient_signer_id: string | null;
  scheduled_for: string;
}