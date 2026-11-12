import { noStore, publicClient } from "@/lib/server-access";
export async function GET() {
  try {
    const { data, error } = await publicClient().from("church_info").select("key,body").order("key");
    if (error) throw error;
    return Response.json({ fields: data }, { headers: noStore });
  } catch { return Response.json({ error: "교회 안내를 불러오지 못했습니다." }, { status: 503, headers: noStore }); }
}
