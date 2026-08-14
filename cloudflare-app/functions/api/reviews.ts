import { json, supabase, type Env } from "../_lib/supabase";

async function userId(request: Request, env: Env) {
  const result = await supabase(env, request).auth.getUser();
  return result.data.user?.id;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const id = await userId(request, env);
  if (!id) return json({ error: "Login required" }, 401);
  const body = await request.json() as { amenity_id?: number; rating?: number; review_text?: string };
  if (!body.amenity_id || !body.rating || !body.review_text?.trim()) return json({ error: "amenity_id, rating, and review_text are required" }, 400);
  const result = await supabase(env, request).from("reviews").upsert({ amenity_id: body.amenity_id, user_id: id, rating: body.rating, review_text: body.review_text.trim(), updated_at: new Date().toISOString() }, { onConflict: "amenity_id,user_id" }).select().single();
  if (result.error) return json({ error: result.error.message }, 400);
  return json({ review: result.data }, 201);
};
