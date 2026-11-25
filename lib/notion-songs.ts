/**
 * 찬양 곡 DB(Notion) 읽기 전용 접근. 서버에서만 쓴다(토큰이 브라우저로 나가면 안 된다).
 * 가사·악보는 곡 페이지 본문에, PPT는 'PPT' 파일 속성에 있다. 파일 주소는 1시간 뒤 만료되므로 저장하지 않고 요청 때마다 새로 받는다.
 */
const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const DEFAULT_DATABASE = '1ff61c11cd4d80d2ac4be164e34a5427';
const LIST_TTL = 60_000;

type RichText = { plain_text: string }[];
type NotionFile = { name: string; type: 'file' | 'external'; file?: { url: string }; external?: { url: string } };
type Property = {
  type: string; title?: RichText; rich_text?: RichText; select?: { name: string } | null;
  multi_select?: { name: string }[]; files?: NotionFile[]; formula?: { type: string; string?: string | null };
};
type Page = { id: string; url: string; parent?: { type: string; database_id?: string }; properties: Record<string, Property> };
type RawBlock = Record<string, unknown> & { id: string; type: string; has_children?: boolean };
type List<T> = { results: T[]; has_more: boolean; next_cursor: string | null };

export type Song = {
  id: string; title: string; url: string; initial: string; themes: string[]; codes: string[]; tempo: string[];
  bible: string; hymn: string; english: string; memo: string[]; pptCount: number;
};
export type SongBlock = { kind: 'text' | 'heading' | 'quote' | 'callout' | 'toggle' | 'item' | 'image' | 'file'; text?: string; url?: string; name?: string; icon?: string; children?: SongBlock[] };
export type SongDetail = Song & { blocks: SongBlock[]; files: { name: string }[] };

/** 설정이 없거나 Notion이 응답하지 않을 때. 메시지는 사용자에게 그대로 보여도 되는 문장이다. */
export class SongsUnavailable extends Error {}

export const songDatabaseId = () => (process.env.NOTION_SONG_DATABASE_ID || DEFAULT_DATABASE).replace(/-/g, '');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function notion<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new SongsUnavailable('찬양 곡 DB 연결 설정(NOTION_TOKEN)이 없습니다.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(API + path, { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' } });
    if (response.status === 429) { await sleep((Number(response.headers.get('retry-after')) || 1) * 1000); continue; }
    if (!response.ok) throw new SongsUnavailable(response.status === 404 ? '찬양 곡 DB를 찾을 수 없습니다. Notion에서 연결(통합)이 되어 있는지 확인해 주세요.' : '찬양 곡 DB를 불러오지 못했습니다.');
    return await response.json() as T;
  }
  throw new SongsUnavailable('찬양 곡 DB가 바쁩니다. 잠시 뒤 다시 시도해 주세요.');
}

const text = (property?: Property) => (property?.title ?? property?.rich_text ?? []).map(part => part.plain_text).join('').trim();
const tags = (property?: Property) => property?.multi_select?.map(option => option.name) ?? [];
const fileUrl = (file: NotionFile) => (file.type === 'file' ? file.file?.url : file.external?.url) ?? '';
const compact = (id: string) => id.replace(/-/g, '').toLowerCase();

function toSong(page: Page): Song {
  const p = page.properties;
  return {
    id: page.id, title: text(p['제목']) || '(제목 없음)', url: page.url,
    initial: tags(p['초성'])[0] ?? '', themes: tags(p['주제']), codes: tags(p['코드']), tempo: tags(p['템포']),
    bible: text(p['성경']), hymn: p['찬송가']?.select?.name ?? '', english: p['영어']?.formula?.string?.trim() ?? '', memo: tags(p['비고']),
    pptCount: p['PPT']?.files?.length ?? 0,
  };
}

let listCache: { at: number; songs: Song[] } | undefined;
let listLoading: Promise<Song[]> | undefined;

/** 전체 곡 목록(제목순). 1분 동안은 같은 서버 안에서 다시 쓴다. */
export async function listSongs(): Promise<Song[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL) return listCache.songs;
  listLoading ??= (async () => {
    const pages: Page[] = [];
    let cursor: string | undefined;
    do {
      const result = await notion<List<Page>>(`/databases/${songDatabaseId()}/query`, { method: 'POST', body: JSON.stringify({ page_size: 100, start_cursor: cursor, sorts: [{ property: '제목', direction: 'ascending' }] }) });
      pages.push(...result.results);
      cursor = result.has_more && result.next_cursor ? result.next_cursor : undefined;
    } while (cursor);
    const songs = pages.map(toSong);
    listCache = { at: Date.now(), songs };
    return songs;
  })().finally(() => { listLoading = undefined; });
  return listLoading;
}

function toBlock(block: RawBlock): SongBlock | null {
  const data = (block[block.type] ?? {}) as Record<string, unknown>;
  const rich = ((data.rich_text as RichText | undefined) ?? []).map(part => part.plain_text).join('');
  switch (block.type) {
    case 'paragraph': return { kind: 'text', text: rich };
    case 'heading_1': case 'heading_2': case 'heading_3': return { kind: 'heading', text: rich };
    case 'quote': return { kind: 'quote', text: rich };
    case 'callout': return { kind: 'callout', text: rich, icon: (data.icon as { emoji?: string } | null)?.emoji };
    case 'toggle': return { kind: 'toggle', text: rich };
    case 'bulleted_list_item': case 'numbered_list_item': return { kind: 'item', text: rich };
    case 'image': { const file = data as unknown as NotionFile; return { kind: 'image', url: fileUrl(file) }; }
    case 'file': case 'pdf': { const file = data as unknown as NotionFile; return { kind: 'file', url: fileUrl(file), name: file.name || '첨부 파일' }; }
    default: return null;
  }
}

async function loadBlocks(id: string, depth = 0): Promise<SongBlock[]> {
  const out: SongBlock[] = [];
  let cursor: string | undefined;
  do {
    const result = await notion<List<RawBlock>>(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    for (const raw of result.results) {
      const block = toBlock(raw);
      if (!block) continue;
      if (raw.has_children && depth < 2) block.children = await loadBlocks(raw.id, depth + 1);
      out.push(block);
    }
    cursor = result.has_more && result.next_cursor ? result.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** 곡 DB에 속한 페이지만 읽는다(연결된 다른 페이지를 id로 열어 보지 못하게). */
async function songPage(id: string): Promise<Page> {
  const page = await notion<Page>(`/pages/${id}`);
  if (compact(page.parent?.database_id ?? '') !== songDatabaseId().toLowerCase()) throw new SongsUnavailable('곡을 찾을 수 없습니다.');
  return page;
}

export async function songDetail(id: string): Promise<SongDetail> {
  const [page, blocks] = await Promise.all([songPage(id), loadBlocks(id)]);
  return { ...toSong(page), blocks, files: (page.properties['PPT']?.files ?? []).map(file => ({ name: file.name })) };
}

/** PPT 첨부 한 개의 새 다운로드 주소(약 1시간 유효). */
export async function songFile(id: string, index: number): Promise<{ name: string; url: string } | null> {
  const file = (await songPage(id)).properties['PPT']?.files?.[index];
  const url = file ? fileUrl(file) : '';
  return file && url ? { name: file.name, url } : null;
}
