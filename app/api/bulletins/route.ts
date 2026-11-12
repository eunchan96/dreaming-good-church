import type { Database } from "@/lib/database.types";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const id = new URL(request.url).searchParams.get("id");
  const date = new URL(request.url).searchParams.get("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "주보를 찾을 수 없습니다." }, { status: 404, headers });
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "주보를 찾을 수 없습니다." }, { status: 404, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "주보 서비스를 준비 중입니다." }, { status: 503, headers });
  // Never inherit the editor's session or use a service-role key on a public request.
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  try {
    if (!id && !date) {
      const { data, error } = await client.from("bulletins").select("id,service_date,issue_number").eq("status", "published").order("service_date", { ascending: false }).limit(100);
      if (error) throw error;
      return Response.json({ bulletins: data }, { headers });
    }
    let selection = client.from("bulletins").select("id,service_date,issue_number,items:bulletin_items(id,position,title,body,kind,content)").eq("status", "published");
    selection = id ? selection.eq("id", id) : selection.eq("service_date", date!);
    const { data, error } = await selection.maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "주보를 찾을 수 없습니다." }, { status: 404, headers });
    data.items.sort((a, b) => a.position - b.position);
    return Response.json(data, { headers });
  } catch {
    return Response.json({ error: "주보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers });
  }
}
