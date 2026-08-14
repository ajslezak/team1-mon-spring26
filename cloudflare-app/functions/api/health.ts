import { json, type Env } from "../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  json({ ok: true, service: "amenity-help", supabaseConfigured: Boolean(env.SUPABASE_URL || env.DATABASE_API) });
