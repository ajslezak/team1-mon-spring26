import { json, supabase, type Env } from "../../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = supabase(env, request);
  const id = String(params.id);
  const amenity = await db.from("amenities").select("*,amenity_types(id,name,icon,color)").or(`id.eq.${id},external_id.eq.${id}`).maybeSingle();
  if (amenity.error) return json({ error: amenity.error.message }, 500);
  if (!amenity.data) return json({ error: "Amenity not found" }, 404);
  const reviews = await db.from("reviews").select("id,user_id,rating,review_text,created_at").eq("amenity_id", amenity.data.id).order("created_at", { ascending: false });
  if (reviews.error) return json({ error: reviews.error.message }, 500);
  const user = await db.auth.getUser();
  const favorite = user.data.user ? await db.from("favorites").select("user_id,amenity_id,notify_on_updates").eq("user_id", user.data.user.id).eq("amenity_id", amenity.data.id).maybeSingle() : { data: null, error: null };
  if (favorite.error) return json({ error: favorite.error.message }, 500);
  return json({ amenity: amenity.data, reviews: reviews.data ?? [], favorite: favorite.data });
};
