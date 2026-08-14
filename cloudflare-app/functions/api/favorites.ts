import { json, supabase, type Env } from "../_lib/supabase";

async function currentUser(request: Request, env: Env) { return (await supabase(env, request).auth.getUser()).data.user?.id; }

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const id = await currentUser(request, env); if (!id) return json({ error: "Login required" }, 401);
  const body = await request.json() as { amenity_id?: number; notify_on_updates?: boolean };
  if (!body.amenity_id) return json({ error: "amenity_id is required" }, 400);
  const result = await supabase(env, request).from("favorites").upsert({ user_id: id, amenity_id: body.amenity_id, notify_on_updates: body.notify_on_updates ?? true }, { onConflict: "user_id,amenity_id" }).select().single();
  if (result.error) return json({ error: result.error.message }, 400); return json({ favorite: result.data }, 201);
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const id = await currentUser(request, env); if (!id) return json({ error: "Login required" }, 401);
  const amenityId = new URL(request.url).searchParams.get("amenity_id");
  if (!amenityId) return json({ error: "amenity_id is required" }, 400);
  const result = await supabase(env, request).from("favorites").delete().eq("user_id", id).eq("amenity_id", amenityId);
  if (result.error) return json({ error: result.error.message }, 400); return json({ ok: true });
};
