import type { Context } from "hono";

export interface GeoLocation {
  country: string;
  city: string;
  lat: number;
  lng: number;
}

export function getClientGeo(c: Context): GeoLocation | null {
  const cf = c.env as Record<string, unknown>;
  
  const country = cf["CF-IPCountry"] as string | undefined;
  const city = cf["CF-IPCity"] as string | undefined;
  const lat = cf["CF-IPLat"] as number | undefined;
  const lng = cf["CF-IPLong"] as number | undefined;
  
  if (!country) return null;
  
  return {
    country: country || "",
    city: city || "",
    lat: typeof lat === "number" ? lat : 0,
    lng: typeof lng === "number" ? lng : 0,
  };
}

export function getClientIP(c: Context): string {
  const cf = c.env as Record<string, unknown>;
  
  const cfConnectingIP = cf["CF-Connecting-IP"] as string | undefined;
  if (cfConnectingIP) return cfConnectingIP;
  
  const xForwardedFor = c.req.header("X-Forwarded-For");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();
  
  return "";
}

export function getClientUserAgent(c: Context): string {
  return c.req.header("User-Agent") || "";
}