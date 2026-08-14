import { json, supabase, type Env } from "../_lib/supabase";

async function authUser(env: Env, request: Request) { return (await supabase(env, request).auth.getUser()).data.user; }

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const user = await authUser(env, request); if (!user) return json({ error: "Login required" }, 401);
  const db = supabase(env, request);
  const result = await db.from("chat_participants").select("chat_id,chats(id,chat_type,name,created_at)").eq("user_id", user.id);
  if (result.error) return json({ error: result.error.message }, 500); return json({ chats: result.data ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const user = await authUser(env, request); if (!user) return json({ error: "Login required" }, 401);
  const body = await request.json() as { name?: string; chat_type?: string; amenity_id?: number };
  const db = supabase(env, request);
  const chat = await db.from("chats").insert({ created_by: user.id, name: body.name || "", chat_type: body.chat_type || "group", amenity_id: body.amenity_id || null }).select().single();
  if (chat.error) return json({ error: chat.error.message }, 400);
  const member = await db.from("chat_participants").insert({ chat_id: chat.data.id, user_id: user.id });
  if (member.error) return json({ error: member.error.message }, 400); return json({ chat: chat.data }, 201);
};
