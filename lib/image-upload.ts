import type { SupabaseClient } from "@supabase/supabase-js";
import type { BulletinImage } from "@/lib/church";

/** Shared client-side access to the image library (주보·홈·교회 정보 all use the same store). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any typed Supabase client works here.
type Client = SupabaseClient<any, any, any>;

export async function listImages(client: Client): Promise<BulletinImage[]> {
  const result = await client.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(300);
  if (result.error) throw new Error("이미지 목록을 불러오지 못했습니다.");
  return (result.data as BulletinImage[]).map(withFolder);
}

/** File name without extension, used as the default title. */
export const titleFromFile = (file: File) => file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "이미지";

/** Returns an error message for files the server would reject, before uploading. */
export function checkImageFile(file: File) {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "JPEG·PNG·WebP 이미지만 올릴 수 있습니다.";
  if (file.size > MAX_UPLOAD_BYTES) return "8MB 이하의 이미지를 선택해 주세요.";
  return "";
}

/** Rows from before the folder column existed read as "no folder". */
export const withFolder = (image: BulletinImage): BulletinImage => ({ ...image, folder: image.folder ?? "" });
/** Distinct folder names, 가나다 order. */
export const folderNames = (images: BulletinImage[], extra: string[] = []) => [...new Set([...images.map(image => image.folder ?? ""), ...extra].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));

async function editorToken(client: Client) { const token = (await client.auth.getSession()).data.session?.access_token; if (!token) throw new Error("관리자 로그인이 필요합니다."); return token; }

/** Update an image's name, description or folder ('' = 폴더 없음). */
export async function updateImage(client: Client, id: string, changes: { title?: string; alt?: string; folder?: string }): Promise<BulletinImage> {
  const response = await fetch("/api/images", { method: "PATCH", headers: { Authorization: `Bearer ${await editorToken(client)}`, "Content-Type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "이미지 정보를 바꾸지 못했습니다.");
  return withFolder(data as BulletinImage);
}

/** Uploads one image to the library. Title defaults to the file name; the description defaults to the title. */
export async function uploadImage(client: Client, file: File, options: { title?: string; alt?: string; folder?: string } = {}): Promise<BulletinImage> {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);
  const token = (await client.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("관리자 로그인이 필요합니다.");
  const title = (options.title?.trim() || titleFromFile(file)).slice(0, 200);
  const alt = (options.alt?.trim() || title).slice(0, 500);
  const response = await fetch("/api/images", { method: "POST", headers: { Authorization: `Bearer ${token}`, "x-image-title": encodeURIComponent(title), "x-image-alt": encodeURIComponent(alt), ...(options.folder?.trim() ? { "x-image-folder": encodeURIComponent(options.folder.trim()) } : {}) }, body: file });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "이미지를 올리지 못했습니다. 다시 시도해 주세요.");
  return withFolder(data as BulletinImage);
}
