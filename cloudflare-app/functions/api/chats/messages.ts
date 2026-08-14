import { json, supabase, type Env } from "../../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = supabase(env, request); const user = await db.auth.getUser(); if (!user.data.user) return json({ error: "Login required" }, 401);
  const chatId = new URL(request.url).searchParams.get("chat_id"); if (!chatId) return json({ error: "chat_id is required" }, 400);
  const result = await db.from("messages").select("id,chat_id,sender_id,content,created_at").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(100);
  if (result.error) return json({ error: result.error.message }, 403); return json({ messages: result.data ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = supabase(env, request); const user = await db.auth.getUser(); if (!user.data.user) return json({ error: "Login required" }, 401);
  const body = await request.json() as { chat_id?: number; content?: string }; if (!body.chat_id || !body.content?.trim()) return json({ error: "chat_id and content are required" }, 400);
  const result = await db.from("messages").insert({ chat_id: body.chat_id, sender_id: user.data.user.id, content: body.content.trim() }).select().single();
  if (result.error) return json({ error: result.error.message }, 403); return json({ message: result.data }, 201);
};
