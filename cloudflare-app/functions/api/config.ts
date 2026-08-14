import { json, supabaseUrl, type Env } from "../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  const url = env.SUPABASE_URL || env.DATABASE_API;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.PUBLISHABLE_DB_KEY;
  if (!url || !key) return json({ error: "Supabase public configuration is missing" }, 500);
  return json({ url: supabaseUrl(url), key });
};
