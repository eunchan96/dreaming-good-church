import { publicClient } from "@/lib/server-access";
import { publicBulletinPdf } from "@/lib/public-bulletin-pdf";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
  const date = new URL(request.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return Response.json({ error: "주보 날짜를 확인해 주세요." }, { status: 400, headers });
  }
  try {
    // Ignore cookies/Authorization, even when the requester is an editor.
    const client = publicClient();
    const read = async () => {
      const { data, error } = await client.from("bulletins").select("id,service_date,issue_number,items:bulletin_items(id,position,title,body,kind,content)").eq("status", "published").eq("service_date", date).maybeSingle();
      if (error) throw error;
      data?.items.sort((a, b) => a.position - b.position);
      return data;
    };
    const bulletin = await read();
    if (!bulletin) return Response.json({ error: "게시된 주보를 찾을 수 없습니다." }, { status: 404, headers });
    const bytes = await publicBulletinPdf(bulletin, async id => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid image");
      const { data, error } = await client.storage.from("bulletin-images").download(`${id}.webp`);
      if (error || !data) throw new Error("Image unavailable");
      return new Uint8Array(await data.arrayBuffer());
    });
    // Recheck after image/font work; never return a snapshot withdrawn during generation.
    const current = await read();
    if (!current) return Response.json({ error: "게시가 취소된 주보입니다." }, { status: 404, headers });
    if (JSON.stringify(current) !== JSON.stringify(bulletin)) return Response.json({ error: "주보가 변경되었습니다. 다시 내려받아 주세요." }, { status: 409, headers });
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="bulletin-${date}.pdf"` } });
  } catch {
    return Response.json({ error: "PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers });
  }
}
