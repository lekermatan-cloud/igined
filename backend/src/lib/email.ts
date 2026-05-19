import { Resend } from "resend";
import { Env } from "../config";

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private appUrl: string;

  constructor(env: Env) {
    this.resend = new Resend(env.RESEND_API_KEY);
    this.fromEmail = env.FROM_EMAIL || "Sigined <noreply@sigined.com>";
    this.appUrl = env.APP_URL || "https://sigined.com";
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/verify-email?token=${token}`;
    
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: "אימות כתובת דוא\"ל - Verify your email",
      html: `
        <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>ברוך הבא ל-Sigil</h1>
          <p>שלום ${name},</p>
          <p>לחץ על הקישור למטה כדי לאמת את כתובת הדוא"ל שלך:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #c8924a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">אמת דוא"ל</a>
          <p>או העתק את הקישור: ${verifyUrl}</p>
          <p>הקישור תקף ל-24 שעות.</p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/update-password?token=${token}`;
    
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: "איפוס ססמה - Password Reset",
      html: `
        <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>איפוס ססמה</h1>
          <p>שלום ${name},</p>
          <p>קיבלנו בקשה לאיפוס הססמה שלך. לחץ על הקישור למטה:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #c8924a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">אפס ססמה</a>
          <p>או העתק את הקישור: ${resetUrl}</p>
          <p>הקישור תקף לשעה אחת בלבד.</p>
          <p>אם לא ביקשת לאפס ססמה, אנא התעלם מהודעה זו.</p>
        </div>
      `,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: "ברוך הבא ל-Sigined - מסמכים דיגיטליים בבטיחות",
      html: `
        <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>ברוך הבא ל-Sigined!</h1>
          <p>שלום ${name},</p>
          <p>תודה שהצטרפת ל-Sigined - הפתרון המוביל לחתימה דיגיטלית בישראל.</p>
          <p>עכשיו אתה יכול:</p>
          <ul>
            <li>ליצור מסמכים עם חתימה דיגיטלית מאובטחת</li>
            <li>לשלוח מסמכים לחתימה בקלות</li>
            <li>לעקוב אחר סטטוס החתימה בזמן אמת</li>
            <li>ליהנות מתמיכה מלאה בעברית ובאנגלית</li>
          </ul>
          <p>התחל עכשיו: <a href="${this.appUrl}">כניסה למערכת</a></p>
        </div>
      `,
    });
  }

  async sendSignerInvite(
    signer: { id: string; email: string; name: string; access_token: string; role_label: string },
    document: { id: string; name: string },
    sender: { full_name: string; email: string } | null,
    message?: string
  ): Promise<void> {
    const signingUrl = `${this.appUrl}/sign/${signer.access_token}`;
    const senderName = sender?.full_name || "Someone";
    const roleLabel = signer.role_label === "witness" ? "עד" : signer.role_label === "approver" ? "מאשר" : "חותם";
    const isRTL = signer.email.includes(".il") || true;

    const html = isRTL ? this.buildRTLInviteEmail(signer.name, senderName, document.name, signingUrl, message, roleLabel) : this.buildLTRInviteEmail(signer.name, senderName, document.name, signingUrl, message, roleLabel);

    await this.resend.emails.send({
      from: this.fromEmail,
      to: signer.email,
      subject: `${senderName} מבקש את חתימתך - ${document.name}`,
      html,
    });
  }

  private buildRTLInviteEmail(
    signerName: string,
    senderName: string,
    docName: string,
    signingUrl: string,
    message?: string,
    roleLabel?: string
  ): string {
    return `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1422; color: #fdf9f0; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c8924a; font-size: 28px; margin: 0;">Sigined</h1>
        </div>
        
        <div style="background: rgba(200, 146, 74, 0.1); border: 1px solid rgba(200, 146, 74, 0.3); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #c8924a; margin: 0 0 16px 0; font-size: 20px;">
            ${roleLabel || 'חתימה'} נדרשת
          </h2>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            שלום ${signerName},
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            <strong>${senderName}</strong> מבקש ממך לחתום על המסמך:
          </p>
          <p style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 6px; margin: 0 0 16px 0; font-size: 16px;">
            <strong>${docName}</strong>
          </p>
          ${message ? `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #fdf9f0cc;">"${message}"</p>` : ""}
          <p style="margin: 0 0 24px 0; line-height: 1.6;">
            לחץ על הכפתור למטה לעיון במסמך ולחתימה:
          </p>
          <a href="${signingUrl}" style="display: inline-block; background: #c8924a; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            הצג וחתום על המסמך
          </a>
        </div>
        
        <div style="text-align: center; font-size: 12px; color: #fdf9f066;">
          <p style="margin: 0 0 8px 0;">קישור זה בטוח ויחיד. אל תשתף אותו עם אחרים.</p>
          <p style="margin: 0;">Sigined - חתימה דיגיטלית מאובטחת</p>
        </div>
      </div>
    `;
  }

  private buildLTRInviteEmail(
    signerName: string,
    senderName: string,
    docName: string,
    signingUrl: string,
    message?: string,
    roleLabel?: string
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1422; color: #fdf9f0; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c8924a; font-size: 28px; margin: 0;">Sigined</h1>
        </div>
        
        <div style="background: rgba(200, 146, 74, 0.1); border: 1px solid rgba(200, 146, 74, 0.3); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #c8924a; margin: 0 0 16px 0; font-size: 20px;">
            ${roleLabel || "Signature"} Required
          </h2>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            Hello ${signerName},
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            <strong>${senderName}</strong> is requesting your signature on:
          </p>
          <p style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 6px; margin: 0 0 16px 0; font-size: 16px;">
            <strong>${docName}</strong>
          </p>
          ${message ? `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #fdf9f0cc;">"${message}"</p>` : ""}
          <p style="margin: 0 0 24px 0; line-height: 1.6;">
            Click the button below to review and sign:
          </p>
          <a href="${signingUrl}" style="display: inline-block; background: #c8924a; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review & Sign Document
          </a>
        </div>
        
        <div style="text-align: center; font-size: 12px; color: #fdf9f066;">
          <p style="margin: 0 0 8px 0;">This link is secure and unique. Do not share it with others.</p>
          <p style="margin: 0;">Sigined - Secure Digital Signatures</p>
        </div>
      </div>
    `;
  }

  async sendSigningConfirmation(
    signer: { name: string; email: string; role_label: string },
    document: { name: string },
    certificateUrl?: string | null
  ): Promise<void> {
    const roleLabel = signer.role_label === "witness" ? "עד" : signer.role_label === "approver" ? "מאשר" : "חותם";
    const isRTL = signer.email.includes(".il") || true;

    const html = isRTL ? `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1422; color: #fdf9f0; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c8924a; font-size: 28px; margin: 0;">Sigined</h1>
        </div>
        <div style="background: rgba(200, 146, 74, 0.1); border: 1px solid rgba(200, 146, 74, 0.3); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #22c55e; margin: 0 0 16px 0; font-size: 20px;">
            ${roleLabel === "חותם" ? "החתימה הושלמה" : "האישור הושלם"}
          </h2>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            שלום ${signer.name},
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            חתימתך על המסמך <strong>${document.name}</strong> התקבלה בהצלחה.
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            תעודת חתימה דיגיטלית הונפקה עבור המסמך.
          </p>
          ${certificateUrl ? `
            <a href="${certificateUrl}" style="display: inline-block; background: #c8924a; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              הצג תעודת חתימה
            </a>
          ` : ""}
        </div>
        <div style="text-align: center; font-size: 12px; color: #fdf9f066;">
          <p style="margin: 0;">Sigined - חתימה דיגיטלית מאובטחת</p>
        </div>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1422; color: #fdf9f0; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c8924a; font-size: 28px; margin: 0;">Sigined</h1>
        </div>
        <div style="background: rgba(200, 146, 74, 0.1); border: 1px solid rgba(200, 146, 74, 0.3); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #22c55e; margin: 0 0 16px 0; font-size: 20px;">
            ${signer.role_label === "witness" ? "Witness completed" : signer.role_label === "approver" ? "Approval completed" : "Signature completed"}
          </h2>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            Hello ${signer.name},
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            Your signature on <strong>${document.name}</strong> has been received successfully.
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            A digital signature certificate has been issued for this document.
          </p>
          ${certificateUrl ? `
            <a href="${certificateUrl}" style="display: inline-block; background: #c8924a; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              View Certificate
            </a>
          ` : ""}
        </div>
        <div style="text-align: center; font-size: 12px; color: #fdf9f066;">
          <p style="margin: 0;">Sigined - Secure Digital Signatures</p>
        </div>
      </div>
    `;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: signer.email,
      subject: isRTL
        ? `חתימתך על ${document.name} התקבלה בהצלחה`
        : `Your signature on ${document.name} has been received`,
      html,
    });
  }

  async sendDocumentCompletedNotification(
    owner: { name: string; email: string },
    document: { name: string },
    signerCount: number
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1422; color: #fdf9f0; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c8924a; font-size: 28px; margin: 0;">Sigined</h1>
        </div>
        <div style="background: rgba(200, 146, 74, 0.1); border: 1px solid rgba(200, 146, 74, 0.3); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #22c55e; margin: 0 0 16px 0; font-size: 20px;">
            Document Fully Signed
          </h2>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            Hello ${owner.name},
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            All ${signerCount} signer(s) have signed <strong>${document.name}</strong>.
          </p>
          <p style="margin: 0 0 16px 0; line-height: 1.6;">
            The document is now complete with a digital signature certificate.
          </p>
        </div>
        <div style="text-align: center; font-size: 12px; color: #fdf9f066;">
          <p style="margin: 0;">Sigined - Secure Digital Signatures</p>
        </div>
      </div>
    `;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: owner.email,
      subject: `${document.name} has been fully signed by all parties`,
      html,
    });
  }
}