import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  DATABASE_API?: string;
  PUBLISHABLE_DB_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

export function supabaseUrl(value: string): string {
  return value.replace(/\/rest\/v1\/?$/, "");
}

export function supabase(env: Env, request?: Request): SupabaseClient {
  const url = env.SUPABASE_URL || env.DATABASE_API;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.PUBLISHABLE_DB_KEY;
  if (!url || !key) throw new Error("Supabase API configuration is missing");
  const auth = request?.headers.get("Authorization");
  return createClient(supabaseUrl(url), key, {
    global: { headers: auth ? { Authorization: auth } : {} },
  });
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
