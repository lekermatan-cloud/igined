import { Resend } from "resend";
import type { Env } from "../../config";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

export class EmailSender {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(env: Env) {
    this.resend = new Resend(env.RESEND_API_KEY);
    this.fromEmail = env.FROM_EMAIL || "noreply@sigined.com";
    this.fromName = env.FROM_NAME || "Sigined";
  }

  async sendEmail(msg: EmailMessage): Promise<string> {
    const response = await this.resend.emails.send({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      tags: msg.tags,
      headers: msg.headers,
    });

    if (response.error) {
      throw new Error(`Resend error: ${response.error.message}`);
    }

    return response.data?.id || "";
  }

  async sendFromQueue(msg: {
    recipient_email: string;
    subject: string;
    body_html: string;
    body_text?: string;
    flow_id?: string;
    language?: string;
  }): Promise<string> {
    return this.sendEmail({
      to: msg.recipient_email,
      subject: msg.subject,
      html: msg.body_html,
      text: msg.body_text,
      tags: [
        { name: "flow_id", value: msg.flow_id || "broadcast" },
        { name: "language", value: msg.language || "he" },
      ],
    });
  }
}