import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Env } from "../config";

export function createSupabaseClient(env: Env, serviceRole = false): SupabaseClient {
  const key = serviceRole ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  return createClient(env.SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createServiceClient(env: Env): SupabaseClient {
  return createSupabaseClient(env, true);
}