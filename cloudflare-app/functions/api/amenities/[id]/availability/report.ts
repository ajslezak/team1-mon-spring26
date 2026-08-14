import { json, supabase, type Env } from "../../../../_lib/supabase";

export const onRequestPost: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = supabase(env, request);
  const user = await db.auth.getUser();
  const body = await request.json() as { is_available?: boolean };
  if (typeof body.is_available !== "boolean") return json({ error: "is_available is required" }, 400);
  const result = await db.from("availability_reports").insert({ amenity_id: String(params.id), is_available: body.is_available, session_key: user.data.user?.id || "anonymous" }).select().single();
  if (result.error) return json({ error: result.error.message }, 400);
  return json({ report: result.data }, 201);
};
