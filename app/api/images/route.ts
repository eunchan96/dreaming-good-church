import { randomUUID } from "node:crypto";
import { imageWriter, noStore, publicClient, requireEditor } from "@/lib/server-access";
import { MAX_IMAGE_BYTES, normalizeImage } from "@/lib/image-processing";
const validId = (id: string | null): id is string => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return reply("이미지를 찾을 수 없습니다.", 404);
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const client = publicClient(token);
    const { data, error } = await client.storage.from("bulletin-images").download(`${id}.webp`);
    if (error || !data) return reply("이미지를 찾을 수 없습니다.", 404);
    return new Response(data, { headers: { ...noStore, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" } });
  } catch { return reply("이미지를 불러오지 못했습니다.", 503); }
}
export async function POST(request: Request) {
  try {
    if (!await requireEditor(request)) return reply("관리자 로그인이 필요합니다.", 401);
    const title = decodeURIComponent(request.headers.get("x-image-title") ?? "").trim();
    const alt = decodeURIComponent(request.headers.get("x-image-alt") ?? "").trim();
    if (!title || title.length > 200 || !alt || alt.length > 500) return reply("제목과 이미지 설명을 입력해 주세요.", 400);
    if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) return reply("8MB 이하의 이미지를 선택해 주세요.", 413);
    const reader = request.body?.getReader();
    if (!reader) return reply("이미지를 선택해 주세요.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_IMAGE_BYTES) { await reader.cancel(); return reply("8MB 이하의 이미지를 선택해 주세요.", 413); } chunks.push(value); }
    let image;
    try { image = await normalizeImage(Buffer.concat(chunks)); } catch { return reply("이미지를 읽을 수 없습니다. 8MB 이하의 정지된 JPEG·PNG·WebP 파일을 선택해 주세요.", 400); }
    const client = imageWriter(), id = randomUUID(), path = `${id}.webp`;
    const uploaded = await client.storage.from("bulletin-images").upload(path, image.data, { contentType: "image/webp", upsert: false });
    if (uploaded.error) return reply("이미지를 저장하지 못했습니다. 다시 시도해 주세요.", 503);
    const record = { id, title, alt, width: image.width, height: image.height, bytes: image.data.length };
    const saved = await client.from("bulletin_images").insert(record);
    if (saved.error) { await client.storage.from("bulletin-images").remove([path]); return reply("이미지 정보를 저장하지 못했습니다.", 503); }
    return Response.json(record, { status: 201, headers: noStore });
  } catch { return reply("이미지 서비스를 이용할 수 없습니다.", 503); }
}
export async function DELETE(request: Request) {
  try {
    if (!await requireEditor(request)) return reply("관리자 로그인이 필요합니다.", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!validId(id)) return reply("이미지를 찾을 수 없습니다.", 404);
    const client = imageWriter();
    // FK locks serialize deletion against attaching images, including historical copies.
    const deleted = await client.from("bulletin_images").delete().eq("id", id);
    if (deleted.error?.code === "23503") return reply("주보에서 사용 중인 이미지는 삭제할 수 없습니다. 과거 주보도 확인해 주세요.", 409);
    if (deleted.error) return reply("이미지를 삭제하지 못했습니다.", 503);
    const removed = await client.storage.from("bulletin-images").remove([`${id}.webp`]);
    if (removed.error) return reply("파일 정리가 완료되지 않았습니다. 같은 이미지의 삭제를 다시 시도해 주세요.", 503);
    return Response.json({ deleted: true }, { headers: noStore });
  } catch { return reply("이미지 서비스를 이용할 수 없습니다.", 503); }
}
