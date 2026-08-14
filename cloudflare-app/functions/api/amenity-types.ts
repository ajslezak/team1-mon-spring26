import { json, supabase, type Env } from "../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const result = await supabase(env, request).from("amenity_types").select("id,name,icon,color,parent_id").order("name");
  if (result.error) return json({ error: result.error.message }, 500);
  return json({ types: result.data ?? [] });
};
