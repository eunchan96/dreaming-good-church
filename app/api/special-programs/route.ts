import { publicClient } from "@/lib/server-access";

const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

/** 공개된 특별 순서지 목록(최신순). 익명 읽기 권한(RLS)으로만 조회한다. */
export async function GET() {
  try {
    const { data, error } = await publicClient().from("special_programs").select("slug,title,service_date").order("service_date", { ascending: false }).limit(50);
    if (error) throw error;
    return Response.json({ programs: data }, { headers });
  } catch {
    return Response.json({ error: "특별 순서지 목록을 불러오지 못했습니다." }, { status: 503, headers });
  }
}
