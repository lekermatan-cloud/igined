import { createServiceClient } from "../supabase";
import type { Env } from "../../config";

export interface QueuedMessage {
  id: string;
  recipient_email: string;
  recipient_phone: string | null;
  recipient_user_id: string | null;
  recipient_signer_id: string | null;
  flow_id: string | null;
  step_id: string | null;
  channel: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  language: string;
  status: string;
  priority: number;
  scheduled_for: string;
  attempts: number;
  last_error: string | null;
}

export class MessageQueue {
  private supabase: ReturnType<typeof createServiceClient>;

  constructor(env: Env) {
    this.supabase = createServiceClient(env);
  }

  async fetchDueMessages(limit = 100): Promise<QueuedMessage[]> {
    const { data, error } = await this.supabase
      .from("message_queue")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .order("priority")
      .order("scheduled_for")
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async markSent(id: string, providerMessageId?: string): Promise<void> {
    const { error } = await this.supabase
      .from("message_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
      })
      .eq("id", id);

    if (error) throw error;
  }

  async markFailed(id: string, error: string): Promise<void> {
    const { data } = await this.supabase
      .from("message_queue")
      .select("attempts")
      .eq("id", id)
      .single();

    const attempts = (data?.attempts || 0) + 1;
    const status = attempts >= 3 ? "failed" : "queued";

    const { error: updateError } = await this.supabase
      .from("message_queue")
      .update({
        status,
        attempts,
        last_error: error,
        scheduled_for: status === "queued"
          ? new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000).toISOString()
          : null,
      })
      .eq("id", id);

    if (updateError) throw updateError;
  }

  async markSkipped(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("message_queue")
      .update({ status: "skipped" })
      .eq("id", id);

    if (error) throw error;
  }

  async updateProviderMessageId(id: string, providerMessageId: string): Promise<void> {
    const { error } = await this.supabase
      .from("message_queue")
      .update({ provider_message_id: providerMessageId })
      .eq("id", id);

    if (error) throw error;
  }
}