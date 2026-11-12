import { createClient } from "@supabase/supabase-js";
import type { Bulletin, BulletinItem } from "./bulletins";

export type SavedBulletin = Bulletin & { revision: number };
type ItemRow = {
  id: string; title: string; body: string; position: number;
  web_visible: boolean; review_on_copy: boolean; needs_review: boolean;
};
type BulletinRow = {
  id: string; service_date: string; issue_number: number;
  status: Bulletin["status"]; revision: number; bulletin_items?: ItemRow[];
};

let browserClient: ReturnType<typeof createClient> | null = null;

export function makeBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^https?:\/\//.test(url)) return null;
  if (typeof window === "undefined") return createClient(url, key);
  browserClient ??= createClient(url, key);
  return browserClient;
}
export type BrowserClient = NonNullable<ReturnType<typeof makeBrowserClient>>;

export function fromRow(row: BulletinRow): SavedBulletin {
  return {
    id: row.id, serviceDate: row.service_date, issueNumber: row.issue_number,
    status: row.status, revision: row.revision,
    items: [...(row.bulletin_items ?? [])].sort((a, b) => a.position - b.position)
      .map((item): BulletinItem => ({
        id: item.id, title: item.title, body: item.body, webVisible: item.web_visible,
        reviewOnCopy: item.review_on_copy, needsReview: item.needs_review,
      })),
  };
}

export async function loadBulletins(client: BrowserClient) {
  const { data, error } = await client.from("bulletins")
    .select("id,service_date,issue_number,status,revision,bulletin_items(*)")
    .order("service_date", { ascending: false }).limit(100);
  if (error) throw error;
  return (data as BulletinRow[]).map(fromRow);
}

export async function saveDraft(client: BrowserClient, draft: SavedBulletin) {
  const { data, error } = await client.rpc("save_bulletin_draft", {
    p_id: draft.id, p_service_date: draft.serviceDate, p_issue_number: draft.issueNumber,
    p_revision: draft.revision, p_items: draft.items,
  });
  if (error) throw error;
  return { ...draft, revision: (data as BulletinRow).revision };
}

export function errorMessage(error: unknown): string {
  const details = error as { code?: string; message?: string };
  if (details.code === "23505") return "같은 날짜의 주보가 이미 있습니다. 날짜를 확인해 주세요.";
  if (details.code === "40001") return "다른 곳에서 수정한 내용이 있습니다. 입력 내용을 복사해 보관한 뒤 다시 열어 주세요.";
  if (details.code === "42501") return "편집 권한이 없습니다. 관리자 계정을 확인해 주세요.";
  if (details.code === "23514" || details.code === "23502" || details.code === "22023") {
    return "날짜·호수·항목 제목과 내용 길이를 확인해 주세요.";
  }
  return "처리하지 못했습니다. 연결과 로그인 상태를 확인한 뒤 다시 시도해 주세요. 입력 내용은 화면에 유지됩니다.";
}
