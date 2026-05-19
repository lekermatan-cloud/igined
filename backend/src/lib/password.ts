const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const HASH_LENGTH = 32;
const ALGORITHM = "PBKDF2";
const HASH_ALG = "SHA-256";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: ALGORITHM },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALG,
    },
    key,
    HASH_LENGTH * 8
  );
  
  const hash = new Uint8Array(derivedBits);
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
  
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = storedHash.split(":");
    if (!saltHex || !hashHex) return false;
    
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const encoder = new TextEncoder();
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: ALGORITHM },
      false,
      ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: ALGORITHM,
        salt,
        iterations: ITERATIONS,
        hash: HASH_ALG,
      },
      key,
      HASH_LENGTH * 8
    );
    
    const computedHash = new Uint8Array(derivedBits);
    const computedHashHex = Array.from(computedHash).map(b => b.toString(16).padStart(2, "0")).join("");
    
    return computedHashHex === hashHex;
  } catch {
    return false;
  }
}