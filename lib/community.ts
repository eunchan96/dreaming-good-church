export type CommunityEntry = {
  id: string; kind: "notice" | "event"; title: string; body: string; location: string;
  starts_at: string | null; ends_at: string | null; is_public: boolean; sensitive: boolean;
  publish_from: string | null; publish_until: string | null;
  status: "draft" | "published" | "archived"; revision: number;
};
export function newEntry(kind: CommunityEntry["kind"]): CommunityEntry {
  return { id: crypto.randomUUID(), kind, title: "", body: "", location: "", starts_at: null, ends_at: null,
    is_public: true, sensitive: false, publish_from: null, publish_until: null, status: "draft", revision: 0 };
}
export function koreanInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0,16);
}
export function fromKoreanInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+09:00`).toISOString();
}
export function communityError(error: unknown): string {
  const code = (error as {code?:string}).code;
  if (code === "40001") return "다른 화면에서 수정되었습니다. 입력을 별도 보관하고 목록을 새로 불러와 주세요.";
  if (code === "42501") return "편집 권한 또는 로그인을 확인해 주세요.";
  if (code === "23514" || code === "22007" || code === "22008" || code === "23502") return "제목·본문·일정 시간·게시 기간과 민감정보 공개 설정을 확인해 주세요.";
  return "처리하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요. 입력은 유지됩니다.";
}
