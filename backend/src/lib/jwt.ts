import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { Env } from "../config";

const ALGORITHM = "HS256";

export async function createToken(env: Env, userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(env: Env, token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function createEmailVerificationToken(env: Env, userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  return new SignJWT({ userId, email, purpose: "email_verify" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}