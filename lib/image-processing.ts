import sharp from "sharp";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export async function normalizeImage(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("8MB 이하의 이미지를 선택해 주세요.");
  const source = sharp(buffer, { limitInputPixels: 40000000, failOn: "error" });
  const metadata = await source.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error("정지된 JPEG·PNG·WebP 이미지만 지원합니다.");
  // Re-encode rather than trusting MIME/filename; discard EXIF including location.
  const { data, info } = await source.rotate().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  if (data.length > MAX_IMAGE_BYTES) throw new Error("변환된 이미지가 너무 큽니다.");
  return { data, width: info.width, height: info.height };
}
