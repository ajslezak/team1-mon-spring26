import { json, supabase, type Env } from "../_lib/supabase";

async function user(env: Env, request: Request) { return (await supabase(env, request).auth.getUser()).data.user; }

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const current = await user(env, request); if (!current) return json({ error: "Login required" }, 401);
  const result = await supabase(env, request).from("food_requests").select("id,requester_id,donor_id,donation_code,latitude,longitude,status,created_at,expires_at").eq("requester_id", current.id).in("status", ["active", "pending_confirmation"]).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (result.error) return json({ error: result.error.message }, 500); return json({ request: result.data });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const current = await user(env, request); if (!current) return json({ error: "Login required" }, 401);
  const body = await request.json() as { latitude?: number; longitude?: number };
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") return json({ error: "Valid coordinates are required" }, 400);
  const db = supabase(env, request); const existing = await db.from("food_requests").select("id").eq("requester_id", current.id).in("status", ["active", "pending_confirmation"]).maybeSingle();
  if (existing.data) return json({ error: "You already have an active request" }, 409);
  const result = await db.from("food_requests").insert({ requester_id: current.id, donation_code: crypto.randomUUID().slice(0, 8).toUpperCase(), latitude: body.latitude, longitude: body.longitude }).select().single();
  if (result.error) return json({ error: result.error.message }, 400); return json({ request: result.data }, 201);
};
