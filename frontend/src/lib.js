// ════════════════════════════════════════════════════════════════════════
// lib.js  ·  Utility helpers and cryptography
// ════════════════════════════════════════════════════════════════════════

/**
 * Hash an ArrayBuffer with SHA-256.
 * Uses Web Crypto API — runs entirely in the browser, no server roundtrip.
 * Returns a 64-character lowercase hex string.
 */
export async function sha256(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Hash a File object (any type — PDF, image, video, etc). */
export async function hashFile(file) {
  return sha256(await file.arrayBuffer());
}

/** Hash a string (UTF-8 encoded). */
export async function hashString(str) {
  return sha256(new TextEncoder().encode(str).buffer);
}

/** Format bytes into a human-readable string. */
export const fmtBytes = b =>
  b < 1024 ? `${b} B`
  : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB`
  : b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(1)} MB`
  : `${(b / 1024 ** 3).toFixed(2)} GB`;

/** Format money. ILS gets the symbol after the number; USD before. */
export const fmtMoney = (n, c = "USD") =>
  c === "ILS" ? `${n.toLocaleString()} ₪` : `$${n.toLocaleString()}`;

/** Format decimal as percent (0.42 → "42%"). */
export const fmtPct = n => `${(n * 100).toFixed(0)}%`;

/** Get up-to-2-letter initials from a name. */
export const initials = name => name.split(" ").map(p => p[0]).slice(0, 2).join("");

/** Truncate a hash for display:  abcdef…12345678  */
export const shortHash = h => h ? `${h.slice(0, 12)}…${h.slice(-8)}` : "";

/** Detect the kind of a File ("image" | "video" | "audio" | "pdf" | "doc"). */
export const fileKind = file => {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.includes("pdf")) return "pdf";
  return "doc";
};

/** Pick font family stack based on language. */
export const fontFor = (lang, kind = "body") => {
  const isHe = lang === "he";
  if (kind === "display") return isHe ? `'Frank Ruhl Libre', 'Fraunces', serif` : `'Fraunces', 'Frank Ruhl Libre', serif`;
  if (kind === "mono") return `'JetBrains Mono', ui-monospace, monospace`;
  return isHe ? `'Heebo', 'Manrope', system-ui, sans-serif` : `'Manrope', 'Heebo', system-ui, sans-serif`;
};

/** Copy text to clipboard, with promise that resolves when done. */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
