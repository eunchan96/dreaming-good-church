import {renderedItems} from "@/lib/bulletin-presentation";
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
    const withPageQuery = () => {
      const query = client.from("bulletins").select("id,service_date,issue_number,items:bulletin_items(id,position,title,body,kind,content,print_page)").eq("status", "published");
      return (id ? query.eq("id", id) : query.eq("service_date", date!)).maybeSingle();
    };
    // theme·print_page는 공개 읽기 권한을 여는 DB 업데이트 뒤에만 읽힌다. 아직이면 있는 열만으로 읽는다.
    const withTheme = client.from("bulletins").select("id,service_date,issue_number,theme,items:bulletin_items(id,position,title,body,kind,content,print_page)").eq("status", "published");
    let { data, error } = await (id ? withTheme.eq("id", id) : withTheme.eq("service_date", date!)).maybeSingle() as unknown as { data: (Awaited<ReturnType<typeof withPageQuery>>["data"] & { theme?: string }) | null; error: unknown };
    if (error) {
      const retry = await withPageQuery();
      data = retry.data as typeof data; error = retry.error;
    }
    if (error) {
      const plain = client.from("bulletins").select("id,service_date,issue_number,items:bulletin_items(id,position,title,body,kind,content)").eq("status", "published");
      const retry = await (id ? plain.eq("id", id) : plain.eq("service_date", date!)).maybeSingle();
      data = retry.data as typeof data; error = retry.error;
    }
    if (error) throw error;
    if (!data) return Response.json({ error: "주보를 찾을 수 없습니다." }, { status: 404, headers });
    data.items.sort((a, b) => a.position - b.position);
    // Print formats are optional (before the DB update the table may not exist): failures mean "no formats".
    const formats = await client.from("bulletin_print_formats").select("formats").eq("bulletin_id", data.id).maybeSingle();
    return Response.json({...data,items:renderedItems(data.items),formats:formats.error?{}:formats.data?.formats??{}}, { headers });
  } catch {
    return Response.json({ error: "주보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers });
  }
}
