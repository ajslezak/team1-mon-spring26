import { json, supabase, type Env } from "../../../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const amenityId = String(params.id);
  const result = await supabase(env, request).from("availability_reports").select("is_available,reported_at").eq("amenity_id", amenityId).gt("expires_at", new Date().toISOString());
  if (result.error) return json({ error: result.error.message }, 500);
  const reports = result.data ?? [];
  return json({ available: reports.filter(x => x.is_available).length, unavailable: reports.filter(x => !x.is_available).length, total: reports.length, reports });
};
