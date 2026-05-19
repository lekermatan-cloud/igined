import { SupabaseClient } from "@supabase/supabase-js";
import { createStorage } from "../storage";
import { Env } from "../../config";
import { escapeHtml } from "./crypto";

interface CertificateData {
  id: string;
  document_id: string;
  cert_hash: string;
  document_hash: string;
  signers_hash: string;
  rfc3161_token?: string;
  rfc3161_authority?: string;
  issued_at_utc: string;
  public_url: string;
  qr_code_url?: string;
  pdf_url?: string;
  compliance_level: string;
}

interface DocumentData {
  id: string;
  name: string;
  team_id: string;
  completed_at: string;
  signers?: SignerData[];
}

interface SignerData {
  id: string;
  name: string;
  email: string;
  signed_at?: string;
}

interface FieldData {
  id: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_px: number;
  height_px: number;
  field_type: string;
  filled_value?: string | null;
  signer_id?: string | null;
}

interface SignerWithSignature {
  id: string;
  name: string;
  signature_image_url?: string | null;
}

export async function generateSignedPDF(
  supabase: SupabaseClient,
  env: Env,
  doc: { id: string; name: string; team_id: string; mime_type: string },
  fields: FieldData[],
  signers: SignerWithSignature[]
): Promise<string | null> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_BROWSER_API_TOKEN) return null;

  const storage = createStorage(env);
  const storageKey = `teams/${doc.team_id || "personal"}/documents/${doc.id}/original`;

  let originalUrl: string;
  try {
    originalUrl = await storage.getSignedUrl("documents", storageKey, 7200);
  } catch {
    console.error("Failed to get signed URL for original document");
    return null;
  }

  const maxPage = Math.max(...fields.map((f) => f.page_number || 1), 1);

  let pagesHTML = "";
  for (let p = 1; p <= maxPage; p++) {
    const pageFields = fields.filter((f) => (f.page_number || 1) === p);

    const overlays = pageFields
      .map((f) => {
        let imgTag = "";
        const baseStyle = `position:absolute;transform:translate(-50%,-50%);left:${f.x_percent}%;top:${f.y_percent}%;width:${f.width_px}px;height:${f.height_px}px;object-fit:contain;`;

        if (f.filled_value && f.field_type === "signature") {
          const signer = signers.find((s) => s.id === f.signer_id);
          const sigUrl = signer?.signature_image_url || f.filled_value;
          if (sigUrl && sigUrl.startsWith("data:")) {
            imgTag = `<img src="${sigUrl}" style="${baseStyle}" />`;
          } else if (sigUrl) {
            imgTag = `<img src="${sigUrl}" style="${baseStyle}" />`;
          }
        } else if (f.filled_value && f.field_type === "initials") {
          imgTag = `<div style="${baseStyle}display:flex;align-items:center;justify-content:center;font-family:cursive;font-size:24px;color:#000;">${escapeHtml(f.filled_value)}</div>`;
        } else if (f.filled_value && f.field_type === "checkbox") {
          const checked = f.filled_value === "true" || f.filled_value === true;
          imgTag = `<div style="${baseStyle}display:flex;align-items:center;justify-content:center;font-size:24px;">${checked ? "&#10003;" : ""}</div>`;
        } else if (f.filled_value && f.field_type === "text") {
          imgTag = `<div style="${baseStyle}display:flex;align-items:center;justify-content:center;font-size:14px;color:#000;overflow:hidden;word-break:break-word;">${escapeHtml(f.filled_value)}</div>`;
        }

        return imgTag;
      })
      .join("");

    pagesHTML += `
    <div class="page">
      <embed src="${escapeHtml(originalUrl)}#page=${p}" type="application/pdf" />
      ${overlays}
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 0; size: A4; }
    body { margin: 0; padding: 0; }
    .page {
      width: 595px; height: 842px; position: relative;
      page-break-after: always; overflow: hidden;
    }
    .page embed {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  ${pagesHTML}
</body>
</html>`;

  try {
    const pdfBuffer = await generatePDFWithBrowserRendering(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_BROWSER_API_TOKEN,
      html
    );

    const signedKey = `teams/${doc.team_id || "personal"}/documents/${doc.id}/signed`;
    await storage.upload(pdfBuffer, {
      bucket: "documents",
      key: signedKey,
      contentType: "application/pdf",
    });

    return signedKey;
  } catch (err) {
    console.error("Failed to generate signed PDF:", err);
    return null;
  }
}

export async function generateCertificatePDF(
  _supabase: SupabaseClient,
  env: Env,
  doc: DocumentData,
  cert: CertificateData
): Promise<string> {
  const html = buildCertificateHTML(doc, cert);

  const storage = createStorage(env);

  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_BROWSER_API_TOKEN) {
    try {
      const pdfBuffer = await generatePDFWithBrowserRendering(
        env.CLOUDFLARE_ACCOUNT_ID,
        env.CLOUDFLARE_BROWSER_API_TOKEN,
        html
      );

      const storageKey = `certificates/${cert.id}.pdf`;
      await storage.upload(pdfBuffer, {
        bucket: "certificates",
        key: storageKey,
        contentType: "application/pdf",
      });

      return storage.getPublicUrl("certificates", storageKey);
    } catch (err) {
      console.error("Browser rendering failed, using fallback:", err);
    }
  }

  return "";
}

async function generatePDFWithBrowserRendering(
  accountId: string,
  apiToken: string,
  html: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        pdfOptions: {
          format: "A4",
          printBackground: true,
          margin: {
            top: "20mm",
            bottom: "20mm",
            left: "25mm",
            right: "25mm",
          },
        },
        addStyleTag: [
          {
            url: "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&family=Heebo:wght@400;700&display=swap",
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Browser rendering failed: ${response.status} - ${error}`);
  }

  return response.arrayBuffer();
}

function buildCertificateHTML(doc: DocumentData, cert: CertificateData): string {
  const completionDate = new Date(doc.completed_at).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const signersList = doc.signers
    ?.map((s) => `<li>${escapeHtml(s.name)} - ${escapeHtml(s.email)}${s.signed_at ? ` (${new Date(s.signed_at).toLocaleDateString("he-IL")})` : ""}</li>`)
    .join("") || "<li>—</li>";

  const complianceLabel =
    cert.compliance_level === "qualified"
      ? "מאובטחת (eIDAS) - חתימה מוכרת"
      : cert.compliance_level === "advanced"
      ? "מתקדמת"
      : "פשוטה";

  const tsaStatus = cert.rfc3161_token ? "✓ מאומתת" : "—";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Frank Ruhl Libre', 'Heebo', serif;
      background: #fdf9f0;
      padding: 40px;
      min-height: 100vh;
    }
    .certificate {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 3px solid #c8924a;
      padding: 50px;
      position: relative;
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 1px solid #c8924a;
      pointer-events: none;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 48px;
      color: #c8924a;
      font-weight: 700;
      letter-spacing: 8px;
    }
    .title {
      font-size: 28px;
      color: #c8924a;
      margin-top: 10px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .content {
      margin-top: 30px;
    }
    .field {
      margin-bottom: 20px;
    }
    .label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .value {
      font-size: 16px;
      color: #333;
    }
    .hash {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      word-break: break-all;
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      margin-top: 5px;
    }
    .divider {
      height: 1px;
      background: #c8924a;
      margin: 30px 0;
      opacity: 0.3;
    }
    .qr-section {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      background: #fdf9f0;
    }
    .qr-code {
      width: 150px;
      height: 150px;
    }
    .qr-text {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      font-size: 10px;
      color: #999;
    }
    .compliance-badge {
      display: inline-block;
      padding: 8px 16px;
      background: ${cert.compliance_level === "qualified" ? "#4CAF50" : "#FF9800"};
      color: white;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }
    .seal {
      position: absolute;
      bottom: 40px;
      right: 40px;
      width: 100px;
      height: 100px;
      border: 3px solid #c8924a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.3;
    }
    .seal-text {
      font-size: 10px;
      color: #c8924a;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">SIGIL</div>
      <div class="title">תעודת בעלות דיגיטלית</div>
      <div class="subtitle">Digital Ownership Certificate</div>
    </div>
    
    <div class="content">
      <div class="field">
        <div class="label">מסמך / Document</div>
        <div class="value">${escapeHtml(doc.name)}</div>
      </div>
      
      <div class="field">
        <div class="label">תאריך השלמה / Completion Date</div>
        <div class="value">${completionDate}</div>
      </div>
      
      <div class="field">
        <div class="label">חותמים / Signers</div>
        <ul style="margin-top: 5px; padding-right: 20px;">${signersList}</ul>
      </div>
      
      <div class="divider"></div>
      
      <div class="field">
        <div class="label">רמת תאימות / Compliance Level</div>
        <div class="value">
          <span class="compliance-badge">${complianceLabel}</span>
        </div>
      </div>
      
      <div class="field">
        <div class="label">חתימת זמן RFC 3161 / Timestamp</div>
        <div class="value">${tsaStatus} ${cert.rfc3161_authority ? `(TSA: ${escapeHtml(cert.rfc3161_authority)})` : ""}</div>
      </div>
      
      <div class="divider"></div>
      
      <div class="field">
        <div class="label">טביעת אצבע מסמך / Document Hash</div>
        <div class="hash">${cert.document_hash}</div>
      </div>
      
      <div class="field">
        <div class="label">חתימת תעודה / Certificate Hash</div>
        <div class="hash">${cert.cert_hash}</div>
      </div>
      
      <div class="field">
        <div class="label">הונפק בתאריך (UTC) / Issued At</div>
        <div class="value">${cert.issued_at_utc}</div>
      </div>
    </div>
    
    <div class="qr-section">
      ${cert.qr_code_url ? `<img src="${cert.qr_code_url}" class="qr-code" alt="QR Code" />` : ""}
      <div class="qr-text">אמת ב: ${`https://sigil.app/verify/${cert.public_url}`}</div>
    </div>
    
    <div class="footer">
      מסמך זה תואם לחוק חתימה אלקטרונית התשס"א-2001 · ESIGN Act · eIDAS Regulation<br>
      This certificate is cryptographically tied to the document and all signatures
    </div>
    
    <div class="seal">
      <div class="seal-text">מאומת<br>VERIFIED</div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateQRCode(text: string): Promise<string> {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
}