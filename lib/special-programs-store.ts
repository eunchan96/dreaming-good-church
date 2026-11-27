import type { BrowserClient } from "./bulletin-store";
import { parseProgramContent, type SpecialProgramContent } from "./special-programs";

/** 관리자 화면에서 다루는 특별 순서지 한 건. 내용은 읽기 전용이고, 게시 상태와 예약 시각만 바뀐다. */
export type SpecialRow = {
  slug: string; title: string; serviceDate: string; status: "draft" | "published";
  /** 예약 공개 시각(ISO). 미래면 아직 공개 전. */
  publishAt: string | null; pdfPath: string | null; content: SpecialProgramContent;
};

const COLUMNS = "slug,title,service_date,status,publish_at,content,pdf_path";
type Raw = { slug: string; title: string; service_date: string; status: string; publish_at: string | null; content: unknown; pdf_path: string | null };

function fromRow(row: Raw): SpecialRow | null {
  const content = parseProgramContent(row.content);
  if (!content || (row.status !== "draft" && row.status !== "published")) return null;
  return { slug: row.slug, title: row.title, serviceDate: row.service_date, status: row.status, publishAt: row.publish_at, pdfPath: row.pdf_path, content };
}

/** 편집자가 볼 수 있는 특별 순서지 전체(초안 포함). 테이블이 아직 없거나 읽지 못하면 목록에서만 빼고 주보 관리는 그대로 쓴다. */
export async function loadSpecialPrograms(client: BrowserClient): Promise<SpecialRow[]> {
  try {
    const { data, error } = await client.from("special_programs").select(COLUMNS).order("service_date", { ascending: false }).limit(100);
    if (error || !data) return [];
    return data.flatMap(row => { const mapped = fromRow(row as Raw); return mapped ? [mapped] : []; });
  } catch { return []; }
}

/** 게시(publishAt 없으면 바로, 있으면 예약)하거나 게시를 취소한다. 서버 함수가 편집자·상태·시각을 검사한다. */
export async function setSpecialPublication(client: BrowserClient, slug: string, publish: boolean, publishAt?: string): Promise<SpecialRow> {
  const { data, error } = await client.rpc("set_special_program_publication", { p_slug: slug, p_publish: publish, ...(publishAt ? { p_publish_at: publishAt } : {}) });
  if (error) throw error;
  const row = fromRow(data as unknown as Raw);
  if (!row) throw new Error("순서지 내용을 읽지 못했습니다.");
  return row;
}

export function specialErrorMessage(error: unknown): string {
  const details = error as { code?: string; message?: string };
  if (details.message === "SCHEDULE_TOO_FAR") return "예약 공개는 1년 이내로만 정할 수 있습니다.";
  if (details.message === "INVALID_PUBLICATION_STATE") return "다른 곳에서 이미 상태가 바뀌었습니다. 목록을 새로 열어 확인해 주세요.";
  if (details.code === "42501") return "편집 권한이 없습니다. 관리자 계정을 확인해 주세요.";
  return "순서지 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
