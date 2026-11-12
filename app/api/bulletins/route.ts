import type { Database } from "@/lib/database.types";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  const date = query.get("date");
  const month = query.get("month");
  const before = query.get("before");
  if ((month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) ||
    (before !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(before) || !Number.isFinite(Date.parse(`${before}T00:00:00Z`)) || new Date(`${before}T00:00:00Z`).toISOString().slice(0, 10) !== before))) {
    return Response.json({ error: "조회할 월과 날짜를 확인해 주세요." }, { status: 400, headers });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "주보를 찾을 수 없습니다." }, { status: 404, headers });
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "주보를 찾을 수 없습니다." }, { status: 404, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "주보 서비스를 준비 중입니다." }, { status: 503, headers });
  // Never inherit the editor's session or use a service-role key on a public request.
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  try {
    if (!id && !date) {
      let selection = client.from("bulletins").select("id,service_date,issue_number").eq("status", "published").order("service_date", { ascending: false });
      if (month) {
        const year = Number(month.slice(0, 4)), value = Number(month.slice(5));
        const nextMonth = value === 12 ? `${String(year + 1).padStart(4, "0")}-01-01` : `${month.slice(0, 4)}-${String(value + 1).padStart(2, "0")}-01`;
        selection = selection.gte("service_date", `${month}-01`).lt("service_date", nextMonth);
      }
      if (before) selection = selection.lt("service_date", before);
      const { data, error } = await selection.limit(21);
      if (error) throw error;
      const bulletins = data.slice(0, 20);
      return Response.json({ bulletins, nextCursor: data.length > 20 ? bulletins.at(-1)!.service_date : null }, { headers });
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
