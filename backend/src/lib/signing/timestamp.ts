import { hexToBytes, bytesToHex, arrayBufferToBase64 } from "./crypto";

interface RFC3161TimestampResult {
  token: string;
  authority: string;
}

export async function getRFC3161Timestamp(
  hash: string,
  tsaUrl: string,
  timeout: number = 30000
): Promise<RFC3161TimestampResult> {
  const tsaReq = createTimestampRequest(hash);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(tsaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/timestamp-query",
        Accept: "application/timestamp-reply",
      },
      body: tsaReq,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`TSA error: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const token = arrayBufferToBase64(new Uint8Array(buffer));

    return {
      token,
      authority: new URL(tsaUrl).hostname,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("TSA request timed out");
    }
    throw err;
  }
}

function createTimestampRequest(hashHex: string): Uint8Array {
  const hashBytes = hexToBytes(hashHex);
  return asn1TimestampRequest(hashBytes);
}

function asn1TimestampRequest(hash: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(asn1Sequence([
    asn1Integer(Uint8Array.from([1])),
    asn1Sequence([
      asn1Oid("1.2.840.113549.2.11"),
      asn1Null(),
    ]),
    asn1OctetString(hash),
  ]));

  parts.push(asn1Boolean(Uint8Array.from([0xff])));

  return concatUint8Arrays(parts);
}

function asn1Sequence(contents: Uint8Array[]): Uint8Array {
  const body = concatUint8Arrays(contents);
  return concatUint8Arrays([Uint8Array.from([0x30]), asn1Length(body.length), body]);
}

function asn1OctetString(data: Uint8Array): Uint8Array {
  return concatUint8Arrays([Uint8Array.from([0x04]), asn1Length(data.length), data]);
}

function asn1Integer(data: Uint8Array): Uint8Array {
  return concatUint8Arrays([Uint8Array.from([0x02]), asn1Length(data.length), data]);
}

function asn1Oid(oid: string): Uint8Array {
  const parts = oid.split(".").map(Number);
  const encoded: number[] = [];

  encoded.push(parts[0] * 40 + parts[1]);

  for (let i = 2; i < parts.length; i++) {
    const bytes: number[] = [];
    let value = parts[i];
    bytes.unshift(value & 0x7f);
    while (value > 127) {
      value >>= 7;
      bytes.unshift((value & 0x7f) | 0x80);
    }
    encoded.push(...bytes);
  }

  return Uint8Array.from([0x06, encoded.length, ...encoded]);
}

function asn1Null(): Uint8Array {
  return Uint8Array.from([0x05, 0x00]);
}

function asn1Boolean(data: Uint8Array): Uint8Array {
  return concatUint8Arrays([Uint8Array.from([0x01]), asn1Length(data.length), data]);
}

function asn1Length(len: number): Uint8Array {
  if (len < 128) {
    return Uint8Array.from([len]);
  }

  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }

  return Uint8Array.from([0x80 | bytes.length, ...bytes]);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function parseTimestampResponse(token: string): {
  tsa: string;
  timestamp: string;
  hashAlgorithm: string;
} {
  const bytes = hexToBytes(token);
  
  let offset = 0;
  
  if (bytes[offset++] !== 0x30) {
    throw new Error("Invalid timestamp response");
  }
  
  offset += getLengthSize(bytes, offset);
  
  let _statusOffset = offset;
  if (bytes[offset++] !== 0x02) {
    throw new Error("Expected status");
  }
  const statusLen = readLength(bytes, offset);
  offset += getLengthSize(bytes, offset);
  const status = bytes.slice(offset, offset + statusLen);
  offset += statusLen;
  
  if (status[0] !== 0x00) {
    throw new Error(`Timestamp rejected: status ${status[0]}`);
  }
  
  if (bytes[offset++] !== 0x30) {
    throw new Error("Expected timestamp info sequence");
  }
  
  const infoLen = readLength(bytes, offset);
  offset += getLengthSize(bytes, offset);
  
  const infoStart = offset;
  
  if (bytes[offset++] !== 0x02) {
    throw new Error("Expected version");
  }
  offset += readLength(bytes, offset) + getLengthSize(bytes, offset);
  
  if (bytes[offset++] !== 0x06) {
    throw new Error("Expected TSA oid");
  }
  const tsaOidLen = readLength(bytes, offset);
  offset += getLengthSize(bytes, offset) + tsaOidLen;
  
  if (bytes[offset++] !== 0x41) {
    throw new Error("Expected TSA name");
  }
  const tsaNameLen = readLength(bytes, offset);
  offset += getLengthSize(bytes, offset);
  
  const tsaBytes = bytes.slice(offset, offset + tsaNameLen);
  const tsaName = Array.from(tsaBytes)
    .filter(b => b >= 32 && b < 127)
    .map(b => String.fromCharCode(b))
    .join("");
  offset += tsaNameLen;
  
  if (bytes[offset++] !== 0x02) {
    throw new Error("Expected timestamp");
  }
  const tsLen = readLength(bytes, offset);
  offset += getLengthSize(bytes, offset);
  
  const tsBytes = bytes.slice(offset, offset + tsLen);
  offset += tsLen;
  
  let hashAlgorithm = "SHA-256";
  
  if (offset < bytes.length && bytes[offset] === 0x30) {
    const _algoSeqLen = readLength(bytes, offset + 1);
    offset += 1 + getLengthSize(bytes, offset + 1);
    
    if (bytes[offset] === 0x06) {
      const oidLen = readLength(bytes, offset + 1);
      offset += 1 + getLengthSize(bytes, offset + 1);
      const oidBytes = bytes.slice(offset, offset + oidLen);
      offset += oidLen;
      
      if (oidBytes[0] === 0x2b && oidBytes[1] === 0x0e) {
        hashAlgorithm = "SHA-1";
      } else if (oidBytes[0] === 0x60 && oidBytes[1] === 0x86) {
        hashAlgorithm = "SHA-256";
      } else if (oidBytes[0] === 0x60 && oidBytes[1] === 0x86) {
        hashAlgorithm = "SHA-384";
      } else if (oidBytes[0] === 0x60 && oidBytes[1] === 0x86) {
        hashAlgorithm = "SHA-512";
      }
    }
  }
  
  return {
    tsa: tsaName || "Unknown TSA",
    timestamp: bytesToHex(tsBytes),
    hashAlgorithm,
  };
}

function getLengthSize(bytes: Uint8Array, offset: number): number {
  if (bytes[offset] < 128) {
    return 1;
  }
  const numBytes = bytes[offset] & 0x7f;
  return 1 + numBytes;
}

function readLength(bytes: Uint8Array, offset: number): number {
  if (bytes[offset] < 128) {
    return bytes[offset];
  }
  const numBytes = bytes[offset] & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | bytes[offset + 1 + i];
  }
  return length;
}