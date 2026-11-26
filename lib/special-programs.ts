/** 특별 순서지: 주간 주보에 없는 구성(1부·2부, 서약문 박스 등)을 웹으로 보여 주기 위한 내용 형식과 검사. DB에는 JSON으로 저장한다. */
export type ProgramTone = "orange" | "gold" | "yellow" | "olive" | "green" | "lime";
export type ProgramRow = { name: string; what?: string; who: string; org?: string };
export type ProgramBlock =
  | { type: "title"; text: string }
  | { type: "band"; title: string; tone: ProgramTone; lead?: string }
  | { type: "table"; title: string; tone: ProgramTone; rows: [string, string][] }
  | { type: "rows"; rows: ProgramRow[] }
  /** 서약문처럼 순서 안에 딸린 안내 박스. 글 안의 **굵게**를 지원한다. */
  | { type: "note"; parts: { heading: string; list?: string[]; text?: string }[] }
  | { type: "schedule"; title: string; tone: ProgramTone; columns: [string, string][][] }
  | { type: "boxes"; boxes: { title: string; tone: ProgramTone; text: string }[] };
export type SpecialProgramContent = {
  cover: { kicker: string; title: string; date: string; time: string; poster?: { src: string; alt: string; width: number; height: number } };
  blocks: ProgramBlock[];
  notice?: { title: string; tone: ProgramTone; body: string };
  church?: { name: string; address: string; phone: string };
};
export type SpecialProgram = { slug: string; title: string; service_date: string; content: SpecialProgramContent; pdf_path: string | null };
export type SpecialProgramSummary = Pick<SpecialProgram, "slug" | "title" | "service_date">;

const tones = new Set<ProgramTone>(["orange", "gold", "yellow", "olive", "green", "lime"]);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 2000): value is string => typeof value === "string" && value.length <= max;
const optionalText = (value: unknown, max = 2000) => value === undefined || text(value, max);
const tone = (value: unknown): value is ProgramTone => typeof value === "string" && tones.has(value as ProgramTone);
const list = <T,>(value: unknown, item: (entry: unknown) => entry is T, max = 200): value is T[] => Array.isArray(value) && value.length <= max && value.every(item);
const pair = (entry: unknown): entry is [string, string] => Array.isArray(entry) && entry.length === 2 && text(entry[0], 200) && text(entry[1], 400);
const row = (entry: unknown): entry is ProgramRow => isObject(entry) && text(entry.name, 60) && optionalText(entry.what, 200) && text(entry.who, 100) && optionalText(entry.org, 100);

function block(entry: unknown): entry is ProgramBlock {
  if (!isObject(entry)) return false;
  switch (entry.type) {
    case "title": return text(entry.text, 100);
    case "band": return text(entry.title, 60) && tone(entry.tone) && optionalText(entry.lead, 100);
    case "table": return text(entry.title, 60) && tone(entry.tone) && list(entry.rows, pair, 30);
    case "rows": return list(entry.rows, row, 60);
    case "note": return list(entry.parts, (part): part is { heading: string } => isObject(part) && text(part.heading, 60) && optionalText(part.text, 3000) && (part.list === undefined || list(part.list, (line): line is string => text(line, 600), 30)), 10);
    case "schedule": return text(entry.title, 60) && tone(entry.tone) && list(entry.columns, (column): column is [string, string][] => list(column, pair, 10), 6);
    case "boxes": return list(entry.boxes, (box): box is { title: string } => isObject(box) && text(box.title, 60) && tone(box.tone) && text(box.text, 600), 4);
    default: return false;
  }
}

/** DB에서 읽은 JSON을 화면에 그려도 되는 형식인지 확인한다. 맞지 않으면 null(그리지 않는다). */
export function parseProgramContent(value: unknown): SpecialProgramContent | null {
  if (!isObject(value) || !isObject(value.cover)) return null;
  const cover = value.cover;
  if (!text(cover.kicker, 100) || !text(cover.title, 100) || !text(cover.date, 60) || !text(cover.time, 60)) return null;
  const poster = cover.poster;
  if (poster !== undefined) {
    if (!isObject(poster) || !text(poster.src, 200) || !/^\/special\/[\w.-]+$/.test(poster.src) || !text(poster.alt, 300)) return null;
    if (!Number.isInteger(poster.width) || !Number.isInteger(poster.height) || (poster.width as number) < 1 || (poster.height as number) < 1) return null;
  }
  if (!list(value.blocks, block, 200)) return null;
  const notice = value.notice;
  if (notice !== undefined && !(isObject(notice) && text(notice.title, 60) && tone(notice.tone) && text(notice.body, 3000))) return null;
  const church = value.church;
  if (church !== undefined && !(isObject(church) && text(church.name, 60) && text(church.address, 300) && text(church.phone, 40))) return null;
  return value as unknown as SpecialProgramContent;
}

export const validProgramSlug = (slug: string) => /^[a-z0-9][a-z0-9-]{2,60}$/.test(slug);
