import { publicClient } from "@/lib/server-access";
import { validProgramSlug } from "@/lib/special-programs";

/** 공개된 특별 순서지의 인쇄용 PDF. ?download=1이면 내려받기, 아니면 화면에서 바로 보기(인쇄 미리보기). */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
  const url = new URL(request.url), slug = url.searchParams.get("slug") ?? "";
  if (!validProgramSlug(slug)) return Response.json({ error: "순서지를 찾을 수 없습니다." }, { status: 404, headers });
  try {
    // 쿠키·Authorization을 쓰지 않는다: 편집자여도 공개된 것만 받는다.
    const client = publicClient();
    const { data: program, error } = await client.from("special_programs").select("slug,pdf_path").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!program?.pdf_path) return Response.json({ error: "인쇄용 PDF가 없습니다." }, { status: 404, headers });
    const { data: file, error: storageError } = await client.storage.from("special-programs").download(program.pdf_path);
    if (storageError || !file) return Response.json({ error: "인쇄용 PDF를 찾을 수 없습니다." }, { status: 404, headers });
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(file, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="program-${slug}.pdf"` } });
  } catch {
    return Response.json({ error: "PDF를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers });
  }
}
