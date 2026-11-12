import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import type { Bulletin, BulletinItem, BlockKind, BlockContent } from "./bulletins";

export type SavedBulletin = Bulletin & { revision: number };
type ItemRow = Tables<"bulletin_items">;
type BulletinRow = Pick<Tables<"bulletins">, "id" | "service_date" | "issue_number" | "status" | "revision"> & { bulletin_items?: ItemRow[] };

let browserClient: SupabaseClient<Database> | null = null;

export function makeBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^https?:\/\//.test(url)) return null;
  if (typeof window === "undefined") return createClient<Database>(url, key);
  browserClient ??= createClient<Database>(url, key);
  return browserClient;
}
export type BrowserClient = NonNullable<ReturnType<typeof makeBrowserClient>>;

export function fromRow(row: BulletinRow): SavedBulletin {
  if (row.status !== "draft" && row.status !== "published") throw new Error("Unknown bulletin status");
  return {
    id: row.id, serviceDate: row.service_date, issueNumber: row.issue_number,
    status: row.status, revision: row.revision,
    items: [...(row.bulletin_items ?? [])].sort((a, b) => a.position - b.position)
      .map((item): BulletinItem => ({
        id: item.id, title: item.title, body: item.body, webVisible: item.web_visible,
        reviewOnCopy: item.review_on_copy, needsReview: item.needs_review,
        // CHECK constraints validate block JSON; generated types cannot express those constraints.
        ...(item.kind && item.kind !== "text" ? { kind: item.kind as BlockKind, content: item.content as BlockContent } : {}),
      })),
  };
}

export async function loadBulletins(client: BrowserClient) {
  const { data, error } = await client.from("bulletins")
    .select("id,service_date,issue_number,status,revision,bulletin_items(*)")
    .order("service_date", { ascending: false }).limit(100);
  if (error) throw error;
  return data.map(fromRow);
}

export async function saveDraft(client: BrowserClient, draft: SavedBulletin) {
  const { data, error } = await client.rpc("save_bulletin_draft", {
    p_id: draft.id, p_service_date: draft.serviceDate, p_issue_number: draft.issueNumber,
    p_revision: draft.revision, p_items: draft.items,
  });
  if (error) throw error;
  return { ...draft, revision: data.revision };
}

export function errorMessage(error: unknown): string {
  const details = error as { code?: string; message?: string };
  if (details.message === "REVIEW_REQUIRED") return "이번 주 확인이 필요한 항목을 모두 확인해 주세요.";
  if (details.message === "PUBLIC_CONTENT_REQUIRED") return "내용이 있는 공개 항목을 하나 이상 작성해 주세요.";
  if (details.code === "23505") return "같은 날짜의 주보가 이미 있습니다. 날짜를 확인해 주세요.";
  if (details.code === "40001") return "다른 곳에서 수정한 내용이 있습니다. 입력 내용을 복사해 보관한 뒤 다시 열어 주세요.";
  if (details.code === "42501") return "편집 권한이 없습니다. 관리자 계정을 확인해 주세요.";
  if (details.code === "23514" || details.code === "23502" || details.code === "22023") {
    return "날짜·호수·항목 제목과 내용 길이, 헌금 월·금액 및 표 형식을 확인해 주세요.";
  }
  return "처리하지 못했습니다. 연결과 로그인 상태를 확인한 뒤 다시 시도해 주세요. 입력 내용은 화면에 유지됩니다.";
}
