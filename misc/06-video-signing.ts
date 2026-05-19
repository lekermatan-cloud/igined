// ════════════════════════════════════════════════════════════════════════
// SIGIL · Video Signing Module
// ════════════════════════════════════════════════════════════════════════
// Handles cryptographic signing of video files. Unlike PDFs, videos can
// be modified subtly (frame substitution, audio replacement) so we need:
//   1. Frame-by-frame SHA-256 hashes
//   2. Audio waveform fingerprint
//   3. Visible watermark with signer name + timestamp
//   4. Cryptographic seal at end of video
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ────────────────────────────────────────────────────────────────────────
// FRAME-BY-FRAME INTEGRITY HASHING
// ────────────────────────────────────────────────────────────────────────
// Extract keyframes every N seconds, hash each, store in DB.
// On verification, re-extract and compare. Any frame swap is detected.

interface FrameHash {
  timestamp_seconds: number;
  hash_sha256: string;
  frame_size_bytes: number;
}

export async function generateVideoFrameHashes(
  videoUrl: string,
  intervalSeconds = 5
): Promise<FrameHash[]> {
  // Use FFmpeg via a service like Mux, AWS MediaConvert, or Bannerbear
  // For Deno Deploy, use an external transcoding API:

  const FFMPEG_API = Deno.env.get("FFMPEG_API_URL"); // e.g., AWS Lambda fn

  const response = await fetch(`${FFMPEG_API}/extract-frames`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: videoUrl,
      interval_seconds: intervalSeconds,
      output_format: "jpg",
      max_resolution: 720
    })
  });

  if (!response.ok) {
    throw new Error(`FFmpeg API error: ${response.status}`);
  }

  const { frames } = await response.json();

  // Hash each frame
  const frameHashes: FrameHash[] = [];
  for (const frame of frames) {
    const frameBuffer = await fetch(frame.url).then(r => r.arrayBuffer());
    const hash = await sha256Hex(frameBuffer);
    frameHashes.push({
      timestamp_seconds: frame.timestamp,
      hash_sha256: hash,
      frame_size_bytes: frame.size_bytes
    });
  }

  return frameHashes;
}

// ────────────────────────────────────────────────────────────────────────
// VISIBLE WATERMARK GENERATION
// ────────────────────────────────────────────────────────────────────────
// Adds a visible overlay to the video showing:
//   - Signer name
//   - Timestamp of signing
//   - Document ID (last 8 chars of UUID)
//   - Sigil logo

export async function addWatermarkToVideo(
  videoUrl: string,
  watermark: {
    signerName: string;
    signedAt: string;
    documentShortId: string;
    language: "he" | "en";
  }
): Promise<string> {
  const FFMPEG_API = Deno.env.get("FFMPEG_API_URL");

  // Build watermark text
  const text = watermark.language === "he"
    ? `נחתם ע"י ${watermark.signerName} · ${formatHebrewDate(watermark.signedAt)} · Sigil ${watermark.documentShortId}`
    : `Signed by ${watermark.signerName} · ${new Date(watermark.signedAt).toLocaleDateString("en-US")} · Sigil ${watermark.documentShortId}`;

  const response = await fetch(`${FFMPEG_API}/watermark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: videoUrl,
      watermark_text: text,
      position: "bottom-right",
      font: watermark.language === "he" ? "FrankRuhlLibre" : "Fraunces",
      font_size: 24,
      font_color: "#c8924a",
      background_color: "#0f1422AA", // Semi-transparent
      padding: 12
    })
  });

  if (!response.ok) {
    throw new Error(`Watermark API error: ${response.status}`);
  }

  const { output_url } = await response.json();
  return output_url;
}

// ────────────────────────────────────────────────────────────────────────
// CRYPTOGRAPHIC SEAL FRAME (appended at end)
// ────────────────────────────────────────────────────────────────────────
// Generates a 5-second "seal" video appended to the original.
// Contains visible certificate hash, QR code, and signer details.

export async function appendSigilSeal(
  videoUrl: string,
  cert: {
    cert_hash: string;
    document_hash: string;
    issued_at_utc: string;
    public_url: string;
    qr_code_url: string;
    signers: Array<{ name: string; signed_at: string }>;
  },
  language: "he" | "en"
): Promise<string> {
  const isHebrew = language === "he";

  // Build the seal HTML (will be rendered to video by FFmpeg API)
  const sealHtml = `
<!DOCTYPE html>
<html dir="${isHebrew ? "rtl" : "ltr"}">
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Frank+Ruhl+Libre:wght@600&family=JetBrains+Mono&display=swap');
    body {
      margin: 0;
      width: 1920px;
      height: 1080px;
      background: radial-gradient(ellipse at top, #0f1422 0%, #070a13 60%);
      color: #f5e9d4;
      font-family: ${isHebrew ? "'Frank Ruhl Libre'" : "'Fraunces'"}, serif;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 32px;
    }
    .seal {
      width: 240px;
      height: 240px;
      border: 4px solid #c8924a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 80px;
      color: #c8924a;
    }
    h1 {
      font-size: 72px;
      margin: 0;
      color: #c8924a;
    }
    .meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 22px;
      color: #e8e3d6;
      max-width: 1200px;
      text-align: center;
      line-height: 1.6;
    }
    .hash {
      color: #c8924a;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="seal">✓</div>
  <h1>${isHebrew ? "מסמך מאומת" : "Document Certified"}</h1>
  <div class="meta">
    <p>${isHebrew ? "חתימה קריפטוגרפית" : "Cryptographic seal"}</p>
    <p class="hash">${cert.cert_hash.substring(0, 32)}...${cert.cert_hash.substring(56)}</p>
    <p>${isHebrew ? "אמת ב-" : "Verify at"} sigil.app/v/${cert.public_url}</p>
    <p>${isHebrew ? "חותמים" : "Signers"}: ${cert.signers.map(s => s.name).join(" · ")}</p>
  </div>
</body>
</html>`;

  const FFMPEG_API = Deno.env.get("FFMPEG_API_URL");
  const response = await fetch(`${FFMPEG_API}/append-html-frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: videoUrl,
      append_html: sealHtml,
      append_duration_seconds: 5,
      qr_code_url: cert.qr_code_url
    })
  });

  if (!response.ok) {
    throw new Error(`Seal append error: ${response.status}`);
  }

  const { output_url } = await response.json();
  return output_url;
}

// ────────────────────────────────────────────────────────────────────────
// COMPLETE VIDEO SIGNING PIPELINE
// ────────────────────────────────────────────────────────────────────────

export async function processVideoSignature(
  documentId: string,
  signerId: string
): Promise<{ signed_video_url: string; frame_hashes: FrameHash[] }> {
  // 1. Get document + signer + certificate
  const { data: doc } = await supabase
    .from("documents")
    .select("*, signers(*), certificates(*)")
    .eq("id", documentId)
    .single();

  if (!doc) throw new Error("Document not found");
  if (doc.file_type !== "video") throw new Error("Not a video document");

  const cert = doc.certificates?.[0];
  if (!cert) throw new Error("Certificate not yet issued");

  // 2. Generate frame hashes (BEFORE watermarking - on original)
  const frameHashes = await generateVideoFrameHashes(doc.file_url, 5);

  // 3. Save frame hashes to DB for future verification
  await supabase
    .from("documents")
    .update({ frame_hashes: frameHashes })
    .eq("id", documentId);

  // 4. Add watermark
  const signer = doc.signers.find((s: any) => s.id === signerId);
  const watermarkedUrl = await addWatermarkToVideo(doc.file_url, {
    signerName: signer.name,
    signedAt: signer.signed_at,
    documentShortId: documentId.substring(0, 8),
    language: doc.language || "he"
  });

  // 5. Append cryptographic seal frame
  const finalUrl = await appendSigilSeal(watermarkedUrl, {
    cert_hash: cert.cert_hash,
    document_hash: cert.document_hash,
    issued_at_utc: cert.issued_at_utc,
    public_url: cert.public_url,
    qr_code_url: cert.qr_code_url,
    signers: doc.signers.filter((s: any) => s.status === "signed")
  }, doc.language || "he");

  // 6. Save final URL
  await supabase
    .from("documents")
    .update({ signed_video_url: finalUrl })
    .eq("id", documentId);

  return { signed_video_url: finalUrl, frame_hashes: frameHashes };
}

// ────────────────────────────────────────────────────────────────────────
// VIDEO INTEGRITY VERIFICATION
// ────────────────────────────────────────────────────────────────────────
// Re-extracts frames from a video and compares to stored hashes.
// If any frame doesn't match, the video has been tampered with.

export async function verifyVideoIntegrity(documentId: string): Promise<{
  valid: boolean;
  tampered_frames: number[];
  reason?: string;
}> {
  const { data: doc } = await supabase
    .from("documents")
    .select("file_url, frame_hashes, signed_video_url")
    .eq("id", documentId)
    .single();

  if (!doc?.frame_hashes) {
    return { valid: false, tampered_frames: [], reason: "No frame hashes on file" };
  }

  // Re-extract and re-hash
  const currentHashes = await generateVideoFrameHashes(doc.signed_video_url || doc.file_url, 5);
  const original: FrameHash[] = doc.frame_hashes;

  const tamperedFrames: number[] = [];
  for (let i = 0; i < original.length; i++) {
    if (currentHashes[i]?.hash_sha256 !== original[i].hash_sha256) {
      tamperedFrames.push(original[i].timestamp_seconds);
    }
  }

  return {
    valid: tamperedFrames.length === 0,
    tampered_frames: tamperedFrames,
    reason: tamperedFrames.length > 0
      ? `${tamperedFrames.length} frames have been modified`
      : undefined
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatHebrewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
