/** Shared bulletin rules. Authentication and persistence belong to the server layer. */
export type BulletinItem = {
  id: string;
  printPage?: number | null;
  title: string;
  body: string;
  webVisible: boolean;
  reviewOnCopy: boolean;
  needsReview: boolean;
  kind?: BlockKind;
  content?: BlockContent;
};

export type BlockKind = "text" | "sermon" | "worship" | "offering" | "image";
export type BlockContent = { reference?: string; preacher?: string; month?: string; rows?: string[][]; assetId?: string; alt?: string };
export const blockNames: Record<Exclude<BlockKind, "image">, string> = { text: "일반 글·공지·묵상", sermon: "설교", worship: "예배 순서", offering: "헌금 내역" };
export function blockContent(kind: BlockKind): BlockContent {
  if (kind === "sermon") return { reference: "", preacher: "" };
  if (kind === "worship") return { rows: [["", "", ""]] };
  if (kind === "offering") return { month: "", rows: [["", ""]] };
  return {};
}
export function offeringTotal(content: BlockContent) {
  return (content.rows ?? []).reduce((sum, row) => sum + Number(row[1] || 0), 0);
}

export function publicationIssues(bulletin: Bulletin): string[] {
  const issues: string[] = [];
  if (bulletin.items.some((item) => item.needsReview)) issues.push("이번 주 확인이 필요한 항목을 모두 확인해 주세요.");
  const meaningful = bulletin.items.some((item) => item.webVisible && (item.body.trim() ||
    (item.kind === "image" && item.content?.assetId && item.content?.alt?.trim()) ||
    (item.kind === "sermon" && item.content?.reference?.trim()) ||
    ((item.kind === "worship" || item.kind === "offering") && item.content?.rows?.some((row) => row.some((cell) => cell.trim())))));
  if (!meaningful) issues.push("내용이 있는 공개 항목을 하나 이상 작성해 주세요.");
  return issues;
}

export type Bulletin = {
  id: string;
  serviceDate: string;
  issueNumber: number;
  status: "draft" | "published";
  items: BulletinItem[];
};

function requireId(id: string): void {
  if (!id.trim()) throw new Error("ID가 필요합니다.");
}

/** Calendar dates are interpreted without the machine's local timezone. */
function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("유효하지 않은 날짜입니다.");
  }
  return date;
}

export function createItem(input: {
  id: string;
  title: string;
  body?: string;
  webVisible?: boolean;
  reviewOnCopy?: boolean;
  kind?: BlockKind;
}): BulletinItem {
  requireId(input.id);
  return {
    id: input.id,
    title: input.title,
    body: input.body ?? "",
    webVisible: input.webVisible ?? true,
    reviewOnCopy: input.reviewOnCopy ?? false,
    needsReview: false,
    ...(input.kind && input.kind !== "text" ? { kind: input.kind, content: blockContent(input.kind) } : {}),
  };
}

export function createBulletin(input: {
  id: string;
  serviceDate: string;
  issueNumber: number;
}): Bulletin {
  requireId(input.id);
  parseDate(input.serviceDate);
  if (!Number.isSafeInteger(input.issueNumber) || input.issueNumber < 1) {
    throw new Error("주보 호수는 양의 정수여야 합니다.");
  }
  return { ...input, status: "draft", items: [] };
}

/** Editing text never implicitly changes visibility or mutates last week's item. */
export function editItem(
  item: BulletinItem,
  changes: Partial<Pick<BulletinItem, "title" | "body" | "webVisible">>,
): BulletinItem {
  const title = changes.title ?? item.title;
  const body = changes.body ?? item.body;
  const contentChanged = title !== item.title || body !== item.body;
  return {
    ...item,
    title,
    body,
    webVisible: changes.webVisible ?? item.webVisible,
    reviewOnCopy: item.reviewOnCopy,
    needsReview: contentChanged ? false : item.needsReview,
  };
}

/** Explicit "use as is" action; does not change content or visibility. */
export function confirmItem(item: BulletinItem): BulletinItem {
  return { ...item, needsReview: false };
}

/** The caller supplies fresh IDs; the database must also enforce unique dates/IDs. */
export function copyBulletin(
  source: Bulletin,
  input: { id: string; serviceDate: string; issueNumber: number },
  newItemId: () => string,
): Bulletin {
  const copy = createBulletin(input);
  if (copy.id === source.id) throw new Error("새 주보 ID가 필요합니다.");
  if (parseDate(copy.serviceDate) <= parseDate(source.serviceDate)) {
    throw new Error("복사할 주보 날짜는 원본보다 이후여야 합니다.");
  }
  const usedIds = new Set(source.items.map((item) => item.id));
  copy.items = source.items.map((item) => {
    const id = newItemId();
    requireId(id);
    if (usedIds.has(id)) throw new Error("항목 ID가 중복되었습니다.");
    usedIds.add(id);
    return {
      ...structuredClone(item),
      id,
      title: item.title,
      body: item.body,
      webVisible: item.webVisible,
      reviewOnCopy: item.reviewOnCopy,
      needsReview: item.reviewOnCopy,
    };
  });
  return copy;
}

/** Build a public response on the server; do not send the unfiltered source to a client. */
export function publicBulletin(bulletin: Bulletin) {
  if (bulletin.status !== "published") return null;
  return {
    id: bulletin.id,
    serviceDate: bulletin.serviceDate,
    issueNumber: bulletin.issueNumber,
    items: bulletin.items
      .filter((item) => item.webVisible)
      .map((item) => ({ id: item.id, title: item.title, body: item.body,
        ...(item.kind && item.kind !== "text" ? { kind: item.kind, content: structuredClone(item.content) } : {}) })),
  };
}

/** All items remain in print output. Only authorized server routes may call this. */
export function printBulletin(bulletin: Bulletin): Bulletin {
  return {
    id: bulletin.id,
    serviceDate: bulletin.serviceDate,
    issueNumber: bulletin.issueNumber,
    status: bulletin.status,
    items: structuredClone(bulletin.items),
  };
}

/** First Sunday of the month carries the previous calendar month's offering summary. */
export function offeringPeriod(serviceDate: string): string | null {
  const date = parseDate(serviceDate);
  if (date.getUTCDay() !== 0 || date.getUTCDate() > 7) return null;
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}
