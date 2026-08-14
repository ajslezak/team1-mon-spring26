import { json, supabase, type Env } from "../_lib/supabase";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 1000), 1000);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const south = Number(url.searchParams.get("south"));
  const north = Number(url.searchParams.get("north"));
  const west = Number(url.searchParams.get("west"));
  const east = Number(url.searchParams.get("east"));
  const query = supabase(env, request)
    .from("amenities")
    .select("id,external_id,name,latitude,longitude,address,description,operator,accessibility,amenity_type_id,active,amenity_types(name,color,icon)")
    .eq("active", true)
    .range(offset, offset + (Number.isFinite(limit) ? limit : 1000) - 1);

  const q = url.searchParams.get("q")?.trim();
  let filtered = query;
  if ([south, north, west, east].every(Number.isFinite)) filtered = filtered.gte("latitude", south).lte("latitude", north).gte("longitude", west).lte("longitude", east);
  const result = q ? await filtered.or(`name.ilike.%${q}%,address.ilike.%${q}%`) : await filtered;
  if (result.error) return json({ error: result.error.message }, 500);
  return json({ amenities: result.data ?? [] });
};
