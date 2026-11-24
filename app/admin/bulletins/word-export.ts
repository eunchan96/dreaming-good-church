/*
 * 인쇄 미리보기 → Word(.docx).
 * 화면에 그려진 인쇄 시트(테마·서식·면 배치가 모두 반영된 상태)를 읽어 Word의 진짜 문단·표·그림으로 옮긴다.
 * 1단계(measure)는 화면을 동기적으로 재서 단순한 모형을 만들고, 2단계(build)는 사진을 PNG/JPEG로 바꿔 docx를 만든다.
 * 쪽: A4 가로 2단. 1쪽 = 바깥면(4면 | 1면), 2쪽 = 안쪽면(2면 | 3면).
 */
import paper from './paper.module.css';

const PX = 15; // 1px(=0.75pt) → 15 twips
const twips = (px: number) => Math.max(0, Math.round(px * PX));
const MM = 56.6929; // 1mm → twips
const SANS = 'Malgun Gothic', SERIF = 'Batang';

type Side = { color: string; size: number; style: 'single' | 'dashed' | 'dotted' | 'double' };
type Borders = Partial<Record<'top' | 'bottom' | 'left' | 'right', Side>>;
type TextRunModel = { t: 'text'; text: string; size: number; bold: boolean; italic: boolean; underline: boolean; color: string; serif: boolean; spacing: number; shade?: string };
type Run = TextRunModel | { t: 'br' } | { t: 'tab'; style: TextRunModel } | { t: 'img'; el: Element; w: number; h: number };
type Align = 'left' | 'center' | 'right' | 'both' | 'distribute';
type Para = { k: 'p'; runs: Run[]; align: Align; left: number; right: number; line: number; exact: boolean; top: number; bottom: number; before?: number; tabs?: { type: 'center' | 'right'; pos: number }[]; border?: Borders; size: number };
type Cell = { width: number; blocks: Block[]; shade?: string; border?: Borders; pad: [number, number, number, number]; vAlign: 'top' | 'center' | 'bottom'; span?: number };
type Row = { height: number; exact?: boolean; cells: Cell[] };
type Tbl = { k: 't'; rows: Row[]; width: number; left: number; top: number; bottom: number; before?: number };
type Block = Para | Tbl;
type Frame = { left: number; right: number; top: number };
export type WordPanel = { page: number; blocks: Block[] };

/* ---------- 색·스타일 읽기 ---------- */
function parseColor(value: string): { hex: string; alpha: number } | null {
  const m = value.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\)/);
  if (!m) return null;
  let alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  if (!(alpha > 0)) return null;
  alpha = Math.min(1, alpha);
  // 반투명 색은 흰 종이 위에 섞인 색으로 바꾼다.
  const mix = (c: string) => Math.round(parseFloat(c) * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
  return { hex: (mix(m[1]) + mix(m[2]) + mix(m[3])).toUpperCase(), alpha };
}
const colorOf = (value: string) => parseColor(value)?.hex;
const px = (value: string) => parseFloat(value) || 0;

function side(cs: CSSStyleDeclaration, name: 'Top' | 'Bottom' | 'Left' | 'Right'): Side | undefined {
  const style = cs.getPropertyValue(`border-${name.toLowerCase()}-style`), width = px(cs.getPropertyValue(`border-${name.toLowerCase()}-width`));
  const color = colorOf(cs.getPropertyValue(`border-${name.toLowerCase()}-color`));
  if (!width || !color || style === 'none' || style === 'hidden') return undefined;
  return { color, size: Math.min(96, Math.max(2, Math.round(width * 6))), style: style === 'dashed' ? 'dashed' : style === 'dotted' ? 'dotted' : style === 'double' ? 'double' : 'single' };
}
function bordersOf(cs: CSSStyleDeclaration): Borders | undefined {
  const b: Borders = {};
  for (const [key, name] of [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']] as const) { const s = side(cs, name); if (s) b[key] = s; }
  return Object.keys(b).length ? b : undefined;
}
/** Hard-stop gradients (기본 테마의 3색 띠) as [color, fraction] segments. */
function gradientSegments(image: string): { color: string; until: number }[] | undefined {
  if (!image.includes('gradient')) return undefined;
  const stops = [...image.matchAll(/(rgba?\([^)]*\))\s*([\d.]+%)?\s*([\d.]+%)?/g)].map(m => ({ color: colorOf(m[1]), until: m[3] ? parseFloat(m[3]) / 100 : m[2] ? parseFloat(m[2]) / 100 : NaN }));
  const valid = stops.filter((s): s is { color: string; until: number } => !!s.color);
  if (!valid.length) return undefined;
  valid.forEach((s, i) => { if (Number.isNaN(s.until)) s.until = i === valid.length - 1 ? 1 : (i + 1) / valid.length; });
  // 계산된 값은 'c1 0%, c1 66%, c2 66%…'처럼 색마다 두 번 나온다: 같은 색은 합치고 폭 0인 조각은 버린다.
  const merged: { color: string; until: number }[] = [];
  for (const stop of valid) { const last = merged.at(-1); if (last && last.color === stop.color) last.until = Math.max(last.until, stop.until); else merged.push({ ...stop }); }
  merged[merged.length - 1].until = 1;
  return merged.filter((s, i) => s.until - (i ? merged[i - 1].until : 0) > .005);
}
/** 배경색. 칸 전체를 덮는 선형 그라데이션만 색으로 본다(작게 반복되는 무늬·점은 제외). */
function fullGradient(cs: CSSStyleDeclaration) {
  return cs.backgroundImage.startsWith('linear-gradient') && /^(auto|auto auto|100% 100%|100%|cover)$/.test(cs.backgroundSize.trim()) ? gradientSegments(cs.backgroundImage) : undefined;
}
function backgroundOf(cs: CSSStyleDeclaration) { return colorOf(cs.backgroundColor) ?? fullGradient(cs)?.[0]?.color; }
/** 줄마다 찍힌 점 무늬(radial-gradient, repeat-y) = 글머리표 목록 */
function bulletOf(cs: CSSStyleDeclaration) {
  if (!cs.backgroundImage.startsWith('radial-gradient') || !cs.backgroundRepeat.includes('repeat-y')) return undefined;
  return gradientSegments(cs.backgroundImage)?.[0]?.color;
}

function visible(el: Element) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || Number(cs.opacity) === 0) return false;
  if (cs.display === 'contents') return true;
  const r = el.getBoundingClientRect();
  return !(r.width <= 1 && r.height <= 1); // 화면 읽기 전용(1px) 글자
}
const isInlineDisplay = (d: string) => d.startsWith('inline') || d === 'contents' || d === 'ruby';
const isMedia = (el: Element) => el.tagName === 'IMG' || el.tagName.toLowerCase() === 'svg';

/** 블록 자식이 하나라도 있으면 문단이 아니라 여러 덩어리로 나눈다. */
function hasBlockChild(el: Element): boolean {
  for (const child of el.children) {
    if (!visible(child)) continue;
    const d = getComputedStyle(child).display;
    if (d === 'contents') { if (hasBlockChild(child)) return true; continue; }
    if (!isInlineDisplay(d)) return true;
    if (!isMedia(child) && hasBlockChild(child)) return true;
  }
  return false;
}

function runStyle(el: Element): TextRunModel {
  const cs = getComputedStyle(el);
  return {
    t: 'text', text: '', size: Math.max(2, Math.round(px(cs.fontSize) * 1.5)), bold: Number(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic',
    underline: cs.textDecorationLine.includes('underline'), color: colorOf(cs.color) ?? '342B25', serif: /serif/i.test(cs.fontFamily) && !/sans/i.test(cs.fontFamily.split(',')[0]),
    spacing: cs.letterSpacing === 'normal' ? 0 : Math.round(px(cs.letterSpacing) * PX), shade: isInlineDisplay(cs.display) ? colorOf(cs.backgroundColor) : undefined,
  };
}

/*
 * 글꼴 폭 맞추기: Word는 맑은 고딕(화면의 Noto Sans KR보다 약 6% 넓음)으로 열린다.
 * 글자 조각마다 두 글꼴의 폭을 재서, 차이만큼 Word 글자 간격을 줄여 줄바꿈 위치를 미리보기와 같게 한다.
 */
let ruler: CanvasRenderingContext2D | null = null, wordFontReady: boolean | undefined;
function measure(font: string, text: string) { ruler ??= document.createElement('canvas').getContext('2d'); ruler!.font = font; return ruler!.measureText(text).width; }
function hasWordFont() {
  if (wordFontReady === undefined) { const probe = '가나다라마바사 abc 123'; wordFontReady = measure(`40px "${SANS}", monospace`, probe) !== measure('40px monospace', probe); }
  return wordFontReady;
}
function fitSpacing(el: Element, style: TextRunModel, text: string, squeeze = 0) {
  const chars = [...text].length; if (!chars) return;
  const cs = getComputedStyle(el), base = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}`;
  const screen = measure(`${base} ${cs.fontFamily}`, text);
  const word = hasWordFont() ? measure(`${base} "${style.serif ? SERIF : SANS}"`, text) : screen * 1.063;
  // 글자당 px(음수 = 좁히기). Word 줄 맞춤 오차에 대비해 조금 더 좁히고, 줄바꿈 금지(nowrap) 글자는 더 여유를 둔다.
  const nowrap = /nowrap|pre$/.test(cs.whiteSpace) ? .3 : 0;
  const extra = Math.max(-2.4, Math.min(1.5, (screen - word) / chars - .12 - nowrap - squeeze));
  style.spacing += Math.round(extra * PX);
}

function collectRuns(node: Node, out: Run[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement!; const ws = getComputedStyle(parent).whiteSpace;
    const keepBreaks = /pre|break-spaces/.test(ws);
    const raw = (node.textContent ?? '').replace(/ /g, ' ');
    const style = runStyle(parent);
    const parts = keepBreaks ? raw.split('\n') : [raw.replace(/\s+/g, ' ')];
    parts.forEach((part, i) => { if (i) out.push({ t: 'br' }); if (part) { const run = { ...style, text: part }; fitSpacing(parent, run, part); out.push(run); } });
    return;
  }
  if (!(node instanceof Element) || !visible(node)) return;
  if (node.tagName === 'BR') { out.push({ t: 'br' }); return; }
  if (isMedia(node)) { const r = node.getBoundingClientRect(); out.push({ t: 'img', el: node, w: r.width, h: r.height }); return; }
  for (const child of node.childNodes) collectRuns(child, out);
}
function trimRuns(runs: Run[]) {
  const first = runs.find(r => r.t === 'text') as TextRunModel | undefined, last = [...runs].reverse().find(r => r.t === 'text') as TextRunModel | undefined;
  if (first && runs.indexOf(first) === 0) first.text = first.text.replace(/^\s+/, '');
  if (last && runs.indexOf(last) === runs.length - 1) last.text = last.text.replace(/\s+$/, '');
  return runs.filter(r => r.t !== 'text' || r.text);
}

function contentBox(el: Element) {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const l = px(cs.paddingLeft) + px(cs.borderLeftWidth), rr = px(cs.paddingRight) + px(cs.borderRightWidth);
  const t = px(cs.paddingTop) + px(cs.borderTopWidth), b = px(cs.paddingBottom) + px(cs.borderBottomWidth);
  return { left: r.left + l, right: r.right - rr, top: r.top + t, bottom: r.bottom - b, rect: r, cs };
}
function alignOf(cs: CSSStyleDeclaration): Align {
  const a = cs.textAlign;
  if (a === 'center' || a === '-webkit-center') return 'center';
  if (a === 'right' || a === 'end' || a === '-webkit-right') return 'right';
  if (a === 'justify') return 'both';
  if (cs.display.includes('flex') && cs.justifyContent === 'center') return 'center';
  if (cs.display.includes('flex') && (cs.justifyContent === 'flex-end' || cs.justifyContent === 'end')) return 'right';
  return 'left';
}
/** 모던 테마 띠 제목의 왼쪽 강조선(::before)을 문단 왼쪽 테두리로. */
function accentBar(el: Element): Side | undefined {
  const before = getComputedStyle(el, '::before');
  if (before.content === 'none' || before.position !== 'absolute') return undefined;
  const color = colorOf(before.backgroundColor), width = px(before.width);
  if (!color || !width || width > 10) return undefined;
  return { color, size: Math.min(96, Math.round(width * 6)), style: 'single' };
}

function paragraph(el: Element, frame: Frame, nodes?: Node[], align?: Align, given?: Run[]): Para | null {
  const box = contentBox(el), cs = box.cs;
  const runs = trimRuns(given ?? (() => { const out: Run[] = []; for (const n of nodes ?? el.childNodes) collectRuns(n, out); return out; })());
  if (!runs.length) return null;
  const size = px(cs.fontSize), lh = cs.lineHeight === 'normal' ? size * 1.4 : px(cs.lineHeight);
  const bullet = bulletOf(cs);
  if (bullet) {
    const style = { ...runStyle(el), color: bullet, text: '• ', bold: false };
    for (let i = runs.length - 1; i >= 0; i--) if (runs[i].t === 'br') runs.splice(i + 1, 0, { ...style });
    runs.unshift({ ...style });
  }
  const hasImage = runs.some(r => r.t === 'img');
  const border = bordersOf(cs) ?? {};
  const bar = accentBar(el); if (bar) border.left = bar;
  // Word 글꼴(맑은 고딕)은 화면 글꼴보다 넓을 수 있어, 정렬 반대쪽 여백은 비워 줄바꿈을 막는다.
  // 가운데 정렬은 가운데 위치를 지키면서 양쪽에 여유를 둔다.
  const a = align ?? alignOf(cs), slack = a === 'center' ? Math.max(8, (box.right - box.left) * .3) : 0;
  return {
    k: 'p', runs, align: a, left: a === 'right' ? 0 : Math.max(0, (bullet ? box.rect.left : box.left) - frame.left - slack), right: a === 'left' || a === 'both' ? 0 : Math.max(0, frame.right - box.right - slack),
    line: lh, exact: !hasImage, top: box.top, bottom: box.bottom, border: Object.keys(border).length ? border : undefined, size,
  };
}

/* ---------- 덩어리(블록) 나누기 ---------- */
function decorated(el: Element, cs: CSSStyleDeclaration) {
  if (el.tagName === 'TABLE' || el.tagName === 'TD' || el.tagName === 'TH') return false;
  const sides = ['Top', 'Bottom', 'Left', 'Right'].filter(n => side(cs, n as 'Top')).length;
  return !!backgroundOf(cs) || sides >= 2;
}

function walk(el: Element, frame: Frame): Block[] {
  if (!visible(el)) return [];
  const cs = getComputedStyle(el);
  if (cs.display === 'contents') return children(el, frame);
  const marker = listMarker(el, cs);
  if (marker) return [markerTable(el, cs, marker, frame)];
  if (decorated(el, cs)) return [boxTable(el, cs, frame)];
  return inner(el, frame);
}

/** 번호 목록(좋은 소식 1. 2. 3.)의 번호는 화면에서 글자가 아니라 표시(::marker)라서 직접 만든다. */
function listMarker(el: Element, cs: CSSStyleDeclaration) {
  if (el.tagName !== 'LI' || cs.display !== 'list-item' || cs.listStyleType === 'none') return undefined;
  if (el.parentElement?.tagName !== 'OL') return cs.listStyleType === 'disc' ? '•' : undefined;
  const list = el.parentElement as HTMLOListElement, items = [...list.children].filter(c => c.tagName === 'LI' && visible(c));
  return `${(list.start || 1) + items.indexOf(el)}.`;
}
function markerTable(el: Element, cs: CSSStyleDeclaration, marker: string, frame: Frame): Tbl {
  const r = el.getBoundingClientRect(), size = px(cs.fontSize), width = size * 1.8;
  const lh = cs.lineHeight === 'normal' ? size * 1.4 : px(cs.lineHeight);
  const own = { left: r.left, right: r.right, top: r.top }, body = decorated(el, cs) ? [boxTable(el, cs, own)] : inner(el, own);
  const mark: Para = { k: 'p', runs: [{ ...runStyle(el), text: marker }], align: 'right', left: 0, right: size * .4, line: lh, exact: true, top: r.top, bottom: r.top + lh, size };
  return { k: 't', left: Math.max(0, r.left - width - frame.left), width: width + r.width, top: r.top, bottom: r.bottom, rows: [{ height: r.height, cells: [
    { width, pad: [0, 0, 0, 0], vAlign: 'top', blocks: [mark] },
    { width: r.width, pad: [0, 0, 0, 0], vAlign: 'top', blocks: stack(body, r.top) },
  ] }] };
}

function inner(el: Element, frame: Frame): Block[] {
  const cs = getComputedStyle(el);
  if (el.tagName === 'TABLE') return [htmlTable(el as HTMLTableElement, frame)];
  if (isMedia(el)) { const p = mediaParagraph(el, frame); return p ? [p] : []; }
  if (el.classList.contains(paper.spreadText)) {
    // 균등 배치 글자(한 글자씩 벌린 span들) → Word의 '균등 분할' 문단
    const text = (el.textContent ?? '').replace(/\s+/g, ''), style = runStyle(el.firstElementChild ?? el);
    const run = { ...style, text }; fitSpacing(el.firstElementChild ?? el, run, text, .45);
    const p = paragraph(el, frame, undefined, [...text].length > 1 ? 'distribute' : 'center', [run]);
    return p ? [p] : [];
  }
  if (rowLayout(el, cs)) return [layoutTable(el, frame)];
  if (!hasBlockChild(el)) {
    const p = paragraph(el, frame);
    if (p) return [p];
    return [];
  }
  return children(el, frame);
}

function children(el: Element, frame: Frame): Block[] {
  const out: Block[] = []; let loose: Node[] = []; let orders: Element[] = [];
  const flushLoose = () => { if (loose.length && loose.some(n => (n.textContent ?? '').trim() || (n instanceof Element && isMedia(n)))) { const p = paragraph(el, frame, loose); if (p) out.push(p); } loose = []; };
  const flushOrders = () => { if (orders.length) out.push(orderTable(orders, frame)); orders = []; };
  for (const node of el.childNodes) {
    if (node instanceof Element && node.hasAttribute('data-order-row') && visible(node)) { flushLoose(); orders.push(node); continue; }
    flushOrders();
    if (node.nodeType === Node.TEXT_NODE) { loose.push(node); continue; }
    if (!(node instanceof Element) || !visible(node)) continue;
    const d = getComputedStyle(node).display;
    if ((isInlineDisplay(d) && d !== 'contents' && !hasBlockChild(node)) || node.tagName === 'BR') { loose.push(node); continue; }
    flushLoose();
    out.push(...walk(node, frame));
  }
  flushLoose(); flushOrders();
  return out;
}

/** flex(가로)·grid 여러 칸이면 테두리 없는 표로 나란히 둔다. */
function rowLayout(el: Element, cs: CSSStyleDeclaration) {
  const flexRow = cs.display.includes('flex') && !cs.flexDirection.startsWith('column');
  const grid = cs.display.includes('grid');
  if (!flexRow && !grid) return false;
  // 글자가 섞인 줄(<환영> 꼬리표처럼)은 문단 하나로 둔다.
  if ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())) return false;
  const kids = [...el.children].filter(visible).map(k => k.getBoundingClientRect());
  if (kids.length < 2) return false;
  return kids.some((a, i) => kids.some((b, j) => i !== j && a.top < b.bottom - 2 && b.top < a.bottom - 2));
}
function groupRows(items: Element[]) {
  const sorted = items.map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
  const rows: { top: number; bottom: number; items: { el: Element; r: DOMRect }[] }[] = [];
  for (const item of sorted) {
    const row = rows.find(row => item.r.top < row.bottom - 2 && row.top < item.r.bottom - 2);
    if (row) { row.items.push(item); row.top = Math.min(row.top, item.r.top); row.bottom = Math.max(row.bottom, item.r.bottom); }
    else rows.push({ top: item.r.top, bottom: item.r.bottom, items: [item] });
  }
  // 같은 줄 안에서 세로로 겹치는(같은 열) 항목은 한 칸에 위아래로 쌓는다.
  return rows.map(row => {
    const columns: { left: number; right: number; items: { el: Element; r: DOMRect }[] }[] = [];
    for (const item of row.items) {
      const column = columns.find(c => item.r.left < c.right - 2 && c.left < item.r.right - 2);
      if (column) { column.items.push(item); column.left = Math.min(column.left, item.r.left); column.right = Math.max(column.right, item.r.right); }
      else columns.push({ left: item.r.left, right: item.r.right, items: [item] });
    }
    columns.sort((a, b) => a.left - b.left).forEach(c => c.items.sort((a, b) => a.r.top - b.r.top));
    return { ...row, columns };
  });
}
/** 글자로 된 ::before(예: 좋은 소식의 counter 번호)를 실제 글자로. */
function pseudoText(el: Element): { text: string; cs: CSSStyleDeclaration } | undefined {
  const cs = getComputedStyle(el, '::before');
  if (!cs.content || cs.content === 'none' || cs.content === 'normal' || cs.position === 'absolute' || cs.display === 'none') return undefined;
  const index = el.parentElement ? [...el.parentElement.children].filter(c => c.tagName === el.tagName).indexOf(el) + 1 : 1;
  // content 값은 이어 붙인 조각들: counter(news) "." → "1."
  const text = (cs.content.match(/counters?\([^)]*\)|"[^"]*"|'[^']*'/g) ?? []).map(token => /^counter/.test(token) ? String(index) : token.slice(1, -1)).join('').trim();
  return text ? { text, cs } : undefined;
}
function layoutTable(el: Element, frame: Frame): Tbl {
  const box = contentBox(el), kids = [...el.children].filter(visible), before = pseudoText(el);
  const rows = groupRows(kids).map((row, rowIndex) => {
    const lead = rowIndex === 0 && before && row.columns[0].left - box.left > 2 ? before : undefined;
    const edges = [box.left, ...row.columns.slice(lead ? 0 : 1).map(c => c.left), box.right];
    const leadCell: Cell[] = lead ? [(() => {
      const size = px(lead.cs.fontSize), lh = lead.cs.lineHeight === 'normal' ? size * 1.4 : px(lead.cs.lineHeight);
      const style: TextRunModel = { ...runStyle(el), text: lead.text, color: colorOf(lead.cs.color) ?? '342B25', size: Math.round(size * 1.5), bold: Number(lead.cs.fontWeight) >= 600 };
      return { width: edges[1] - edges[0], pad: [0, 0, 0, 0], vAlign: 'top', blocks: [{ k: 'p', runs: [style], align: 'left', left: 0, right: 0, line: lh, exact: true, top: row.top, bottom: row.top + lh, size }] } satisfies Cell;
    })()] : [];
    const offset = lead ? 1 : 0;
    return {
      height: row.bottom - row.top,
      cells: [...leadCell, ...row.columns.map((column, j): Cell => { const i = j + offset;
        const cellLeft = edges[i], cellRight = Math.max(edges[i + 1], cellLeft + 4), top = column.items[0].r.top;
        const blocks = column.items.flatMap(item => walk(item.el, { left: column.left, right: cellRight, top: item.r.top }));
        return { width: cellRight - cellLeft, pad: [top - row.top, 0, 0, Math.max(0, column.left - cellLeft)], vAlign: 'top', blocks: stack(blocks, top) };
      })],
    };
  });
  return { k: 't', rows, width: box.right - box.left, left: Math.max(0, box.left - frame.left), top: box.rect.top, bottom: box.rect.bottom };
}

/** 배경·테두리가 있는 상자(띠 제목, 메모 칸, 옅은 바탕 영역) = 칸 하나짜리 표. */
function boxTable(el: Element, cs: CSSStyleDeclaration, frame: Frame): Tbl {
  const r = el.getBoundingClientRect(), box = contentBox(el);
  const pad: [number, number, number, number] = [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)];
  const content = stack(inner(el, { left: box.left, right: box.right, top: box.top }), box.top);
  const border = bordersOf(cs), segments = !colorOf(cs.backgroundColor) ? fullGradient(cs) : undefined;
  if (segments && segments.length > 1) {
    // 3색 띠: 글자는 첫 칸, 나머지는 색만 칠한 칸. 글자가 첫 칸보다 길면(좁은 칸) 첫 칸을 넓힌다.
    const widths = segments.map((s, i) => (s.until - (i ? segments[i - 1].until : 0)) * r.width);
    const range = document.createRange(); range.selectNodeContents(el);
    const need = Math.min(r.width, (range.getBoundingClientRect().right - r.left) * 1.15 + pad[1] + 4);
    if (widths[0] < need) { const rest = r.width - widths[0], left = r.width - need; widths.forEach((w, i) => { widths[i] = i ? (rest > 0 ? w / rest * left : 0) : need; }); }
    return { k: 't', left: Math.max(0, r.left - frame.left), width: r.width, top: r.top, bottom: r.bottom, rows: [{ height: r.height, cells: segments.map((s, i) => ({ width: widths[i], shade: s.color, pad: i ? [0, 0, 0, 0] : pad, vAlign: 'center', blocks: i ? [] : content })) }] };
  }
  return { k: 't', left: Math.max(0, r.left - frame.left), width: r.width, top: r.top, bottom: r.bottom, rows: [{ height: r.height, cells: [{ width: r.width, shade: backgroundOf(cs), border, pad, vAlign: 'top', blocks: content }] }] };
}

function htmlTable(table: HTMLTableElement, frame: Frame): Tbl {
  const r = table.getBoundingClientRect();
  const rows = [...table.rows].filter(visible).map(tr => {
    const trBg = colorOf(getComputedStyle(tr).backgroundColor), tr_r = tr.getBoundingClientRect();
    return {
      height: tr_r.height,
      cells: [...tr.cells].filter(visible).map((td): Cell => {
        const cs = getComputedStyle(td), box = contentBox(td);
        return {
          width: td.getBoundingClientRect().width, shade: colorOf(cs.backgroundColor) ?? trBg, border: bordersOf(cs), span: td.colSpan > 1 ? td.colSpan : undefined,
          pad: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)], vAlign: cs.verticalAlign === 'middle' ? 'center' : cs.verticalAlign === 'bottom' ? 'bottom' : 'top',
          blocks: stack(hasBlockChild(td) || rowLayout(td, cs) ? inner(td, box) : [paragraph(td, box)].filter((p): p is Para => !!p), box.top),
        };
      }),
    };
  }).filter(row => row.cells.length);
  return { k: 't', rows, width: r.width, left: Math.max(0, r.left - frame.left), top: r.top, bottom: r.bottom };
}

/** 예배 순서 한 줄: ↑ | 이름(균등 배치) | 점선·내용·점선 | 담당(균등 배치) */
function orderTable(rows: Element[], frame: Frame): Tbl {
  const first = rows[0].getBoundingClientRect(), last = rows[rows.length - 1].getBoundingClientRect();
  return {
    k: 't', left: Math.max(0, first.left - frame.left), width: first.width, top: first.top, bottom: last.bottom,
    rows: rows.map(row => {
      const rr = row.getBoundingClientRect(), rcs = getComputedStyle(row), rowBorder = bordersOf(rcs);
      const kids = [...row.children].filter(visible);
      const edges = [rr.left, ...kids.slice(1).map(k => k.getBoundingClientRect().left), rr.right];
      return {
        height: rr.height, exact: true,
        cells: kids.map((kid, i): Cell => {
          const kr = kid.getBoundingClientRect(), width = Math.max(4, edges[i + 1] - edges[i]);
          const cellFrame = { left: edges[i], right: edges[i] + width, top: kr.top };
          let blocks: Block[];
          const dots = [...kid.children].filter(c => c.tagName === 'I' && visible(c));
          if (dots.length) {
            // 점선은 Word의 점선 탭으로 그린다.
            const style = runStyle(kid); style.color = colorOf(getComputedStyle(dots[0]).backgroundColor) ?? '8F8476';
            const text = [...kid.children].filter(c => c.tagName !== 'I' && visible(c));
            const runs: Run[] = [{ t: 'tab', style }];
            if (text.length) { for (const t of text) collectRuns(t, runs); runs.push({ t: 'tab', style }); }
            const cs = getComputedStyle(kid), lh = cs.lineHeight === 'normal' ? px(cs.fontSize) * 1.4 : px(cs.lineHeight);
            blocks = [{ k: 'p', runs: trimRuns(runs), align: 'left', left: 0, right: 0, line: lh, exact: true, top: kr.top, bottom: kr.bottom, size: px(cs.fontSize), tabs: text.length ? [{ type: 'center', pos: width / 2 }, { type: 'right', pos: width - 1 }] : [{ type: 'right', pos: width - 1 }] }];
          } else blocks = stack(walk(kid, cellFrame), kr.top);
          return { width, pad: [0, 0, 0, Math.max(0, kr.left - edges[i])], vAlign: 'center', border: rowBorder ? { bottom: rowBorder.bottom, top: rowBorder.top } : undefined, blocks };
        }),
      };
    }),
  };
}

function mediaParagraph(el: Element, frame: Frame): Para | null {
  const r = el.getBoundingClientRect(), parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
  const left = Math.max(0, r.left - frame.left), right = Math.max(0, frame.right - r.right);
  const align: Align = parent && alignOf(parent) !== 'left' ? alignOf(parent) : Math.abs(left - right) < 4 && left > 4 ? 'center' : 'left';
  return { k: 'p', runs: [{ t: 'img', el, w: r.width, h: r.height }], align, left: align === 'left' ? left : 0, right: 0, line: r.height, exact: false, top: r.top, bottom: r.bottom, size: 11 };
}

/** 위아래 간격은 화면의 실제 위치 차이로 정한다(여백·마진·flex 간격 모두 포함). */
function stack(blocks: Block[], start: number): Block[] {
  const sorted = [...blocks].sort((a, b) => a.top - b.top);
  let cursor = start;
  for (const b of sorted) { b.before = Math.max(0, b.top - cursor); cursor = Math.max(cursor, b.bottom); }
  return sorted;
}

/** 화면에서 인쇄 시트를 읽는다. 미리보기 확대·축소(zoom)는 잠시 1로 되돌려 실제 크기로 잰다. */
export function measurePanels(root: HTMLElement): WordPanel[] {
  const zoomed = root.querySelector<HTMLElement>('[role="document"]');
  const zoom = zoomed?.style.zoom ?? '';
  if (zoomed) zoomed.style.zoom = '1';
  (document.activeElement as HTMLElement | null)?.blur?.();
  try {
    return [4, 1, 2, 3].map(page => {
      const body = root.querySelector<HTMLElement>(`[data-print-panel="${page}"]`);
      if (!body) return { page, blocks: [] };
      const box = contentBox(body);
      const frame = { left: box.left, right: box.right, top: box.top };
      // 큰 빈 공간(예: 4면 아래 교회 안내 앞)은 10% 줄여, Word에서 조금 길어져도 아래가 잘리지 않게 한다.
      const blocks = stack(children(body, frame), box.top);
      blocks.forEach(b => { if ((b.before ?? 0) > 40) b.before = b.before! * .9; });
      return { page, blocks };
    });
  } finally { if (zoomed) zoomed.style.zoom = zoom; }
}

/* ---------- 그림 ---------- */
async function rasterize(el: Element, w: number, h: number): Promise<{ data: Uint8Array; type: 'png' | 'jpg' }> {
  const scale = 3, canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  let source: CanvasImageSource, sw: number, sh: number;
  if (el instanceof HTMLImageElement) {
    const blob = await (await fetch(el.currentSrc || el.src)).blob();
    const bitmap = await createImageBitmap(blob); source = bitmap; sw = bitmap.width; sh = bitmap.height;
    const fit = getComputedStyle(el).objectFit;
    if (fit === 'cover' || fit === 'contain') {
      const k = fit === 'cover' ? Math.max(canvas.width / sw, canvas.height / sh) : Math.min(canvas.width / sw, canvas.height / sh);
      const dw = sw * k, dh = sh * k;
      if (blob.type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(source, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    } else {
      if (blob.type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    const jpeg = blob.type === 'image/jpeg';
    const out = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image')), jpeg ? 'image/jpeg' : 'image/png', .9));
    return { data: new Uint8Array(await out.arrayBuffer()), type: jpeg ? 'jpg' : 'png' };
  }
  // 인라인 SVG(아이콘·하트): 화면 크기를 박아 넣고 PNG로.
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h)); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = new Image(); img.src = url; await img.decode();
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally { URL.revokeObjectURL(url); }
  const out = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image')), 'image/png'));
  return { data: new Uint8Array(await out.arrayBuffer()), type: 'png' };
}

/* ---------- docx 만들기 ---------- */
export async function buildDocx(panels: WordPanel[], title: string): Promise<Blob> {
  const d = await import('docx');
  const images = new Map<Element, Promise<{ data: Uint8Array; type: 'png' | 'jpg' }>>();
  const visit = (blocks: Block[]) => blocks.forEach(b => b.k === 'p' ? b.runs.forEach(r => { if (r.t === 'img' && !images.has(r.el)) images.set(r.el, rasterize(r.el, r.w, r.h)); }) : b.rows.forEach(row => row.cells.forEach(c => visit(c.blocks))));
  panels.forEach(p => visit(p.blocks));
  const ready = new Map<Element, { data: Uint8Array; type: 'png' | 'jpg' } | null>();
  await Promise.all([...images].map(async ([el, job]) => { try { ready.set(el, await job); } catch { ready.set(el, null); } }));

  const borderStyle = (s: Side['style']) => s === 'dashed' ? d.BorderStyle.DASHED : s === 'dotted' ? d.BorderStyle.DOTTED : s === 'double' ? d.BorderStyle.DOUBLE : d.BorderStyle.SINGLE;
  const border = (s?: Side) => s ? { style: borderStyle(s.style), size: s.size, color: s.color, space: 1 } : undefined;
  const none = { style: d.BorderStyle.NONE, size: 0, color: 'auto' };
  const font = (serif: boolean) => { const name = serif ? SERIF : SANS; return { ascii: name, eastAsia: name, hAnsi: name, cs: name }; };
  const textRun = (r: TextRunModel, extra: Record<string, unknown> = {}) => new d.TextRun({
    text: r.text, size: r.size, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined, color: r.color, font: font(r.serif),
    characterSpacing: r.spacing || undefined, shading: r.shade ? { type: d.ShadingType.CLEAR, fill: r.shade, color: 'auto' } : undefined, ...extra,
  });
  const alignment = { left: d.AlignmentType.LEFT, center: d.AlignmentType.CENTER, right: d.AlignmentType.RIGHT, both: d.AlignmentType.BOTH, distribute: d.AlignmentType.DISTRIBUTE } as const;

  // 브라우저처럼: 한글·영문/숫자 사이 자동 간격 끔, 한글은 글자 단위 줄바꿈, 줄 옮김(과부·고아) 조정 끔.
  const browserLike = { autoSpaceLatinAndEastAsianText: false, autoSpaceEastAsianText: false, wordWrap: false, widowControl: false } as const;
  function para(p: Para, width: number): InstanceType<typeof d.Paragraph> {
    const children: (InstanceType<typeof d.TextRun> | InstanceType<typeof d.ImageRun>)[] = [];
    let pendingBreak = false;
    for (const r of p.runs) {
      if (r.t === 'br') { if (pendingBreak) children.push(new d.TextRun({ break: 1 })); pendingBreak = true; continue; }
      const brk = pendingBreak ? { break: 1 } : {}; pendingBreak = false;
      if (r.t === 'text') children.push(textRun(r, brk));
      else if (r.t === 'tab') children.push(textRun({ ...r.style, text: '' }, { ...brk, children: [new d.Tab()] }));
      else { const img = ready.get(r.el); if (img) { if (Object.keys(brk).length) children.push(new d.TextRun({ break: 1 })); children.push(new d.ImageRun({ type: img.type, data: img.data, transformation: { width: Math.round(r.w), height: Math.round(r.h) } })); } }
    }
    if (pendingBreak) children.push(new d.TextRun({ break: 1 }));
    const firstText = p.runs.find(r => r.t === 'text') as TextRunModel | undefined;
    if (!children.length) children.push(new d.TextRun({ text: '', size: firstText?.size ?? Math.round(p.size * 1.5) }));
    return new d.Paragraph({
      ...browserLike, children, alignment: alignment[p.align],
      indent: { left: twips(p.left), right: twips(p.right) },
      spacing: { before: twips(p.before ?? 0), after: 0, ...(p.exact ? { line: Math.max(20, twips(p.line)), lineRule: d.LineRuleType.EXACT } : { line: 240, lineRule: d.LineRuleType.AUTO }) },
      tabStops: p.tabs?.map(t => ({ type: t.type === 'center' ? d.TabStopType.CENTER : d.TabStopType.RIGHT, position: Math.min(twips(width), twips(t.pos)), leader: d.LeaderType.DOT })),
      border: p.border ? { top: border(p.border.top), bottom: border(p.border.bottom), left: border(p.border.left), right: border(p.border.right) } : undefined,
    });
  }
  /** 표 앞 간격은 표에 줄 수 없어서 아주 낮은 빈 문단으로 띄운다. */
  const spacer = (px: number) => new d.Paragraph({ ...browserLike, children: [new d.TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: Math.max(2, twips(px)), lineRule: d.LineRuleType.EXACT } });
  function table(t: Tbl): InstanceType<typeof d.Table> {
    const cols = t.rows[0]?.cells.length ?? 1, uniform = t.rows.every(r => r.cells.length === cols && !r.cells.some(c => c.span));
    return new d.Table({
      width: { size: twips(t.width), type: d.WidthType.DXA }, indent: { size: twips(t.left), type: d.WidthType.DXA },
      layout: uniform ? d.TableLayoutType.FIXED : d.TableLayoutType.AUTOFIT, columnWidths: uniform ? t.rows[0].cells.map(c => twips(c.width)) : undefined,
      borders: d.TableBorders.NONE, margins: { top: 0, bottom: 0, left: 0, right: 0 },
      rows: t.rows.map(row => new d.TableRow({
        cantSplit: true, height: { value: Math.max(20, twips(row.height)), rule: row.exact ? d.HeightRule.EXACT : d.HeightRule.ATLEAST },
        children: row.cells.map(c => new d.TableCell({
          width: { size: twips(c.width), type: d.WidthType.DXA }, columnSpan: c.span,
          margins: { top: twips(c.pad[0]), right: twips(c.pad[1]), bottom: twips(c.pad[2]), left: twips(c.pad[3]) },
          verticalAlign: c.vAlign === 'center' ? d.VerticalAlign.CENTER : c.vAlign === 'bottom' ? d.VerticalAlign.BOTTOM : d.VerticalAlign.TOP,
          shading: c.shade ? { type: d.ShadingType.CLEAR, fill: c.shade, color: 'auto' } : undefined,
          borders: { top: border(c.border?.top) ?? none, bottom: border(c.border?.bottom) ?? none, left: border(c.border?.left) ?? none, right: border(c.border?.right) ?? none },
          children: flow(c.blocks, c.width - c.pad[1] - c.pad[3], true),
        })),
      })),
    });
  }
  function flow(blocks: Block[], width: number, inCell = false): (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] {
    const out: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];
    for (const b of blocks) {
      if (b.k === 'p') out.push(para(b, width));
      else { if ((b.before ?? 0) >= 1 || out.at(-1) instanceof d.Table) out.push(spacer(Math.max(0.2, b.before ?? 0))); out.push(table(b)); }
    }
    // Word 표 칸은 문단으로 끝나야 한다.
    if (inCell && (!out.length || out.at(-1) instanceof d.Table)) out.push(spacer(0.2));
    return out;
  }
  /*
   * 한 장(두 면) = 높이가 고정된 2칸짜리 표 한 줄. Word에서 한 면이 조금 길어져도
   * 옆 면·다음 쪽으로 밀리지 않는다(단·단 나누기를 쓰면 몇 mm 차이로 전체가 밀린다).
   * 시트: 297×210mm, 안쪽 여백 7mm(위아래)·6mm(좌우), 면마다 좌우 5mm 여백.
   */
  const panelWidth = 142.5, panelPad = 5, panelHeight = 196, contentPx = (panelWidth - panelPad * 2) * 3.7795;
  const none4 = { top: none, bottom: none, left: none, right: none };
  const sheet = (pages: WordPanel[]) => new d.Table({
    width: { size: Math.round(panelWidth * 2 * MM), type: d.WidthType.DXA }, layout: d.TableLayoutType.FIXED, columnWidths: [Math.round(panelWidth * MM), Math.round(panelWidth * MM)],
    borders: d.TableBorders.NONE, margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: [new d.TableRow({
      cantSplit: true, height: { value: Math.round(panelHeight * MM), rule: d.HeightRule.EXACT },
      children: pages.map(page => new d.TableCell({
        width: { size: Math.round(panelWidth * MM), type: d.WidthType.DXA }, borders: none4, verticalAlign: d.VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: Math.round(panelPad * MM), right: Math.round(panelPad * MM) },
        children: flow(page.blocks, contentPx, true),
      })),
    })],
  });
  // 표 뒤에 Word가 요구하는 빈 문단은 아주 낮게(빈 쪽이 생기지 않도록).
  const tail = () => new d.Paragraph({ ...browserLike, children: [new d.TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACT } });
  const section = (pages: WordPanel[]) => ({
    properties: {
      page: { size: { width: 11906, height: 16838, orientation: d.PageOrientation.LANDSCAPE }, margin: { top: Math.round(7 * MM), bottom: Math.round(5 * MM), left: Math.round(6 * MM), right: Math.round(6 * MM), header: 0, footer: 0, gutter: 0 } },
    },
    children: [sheet(pages), tail()],
  });
  const byPage = (n: number) => panels.find(p => p.page === n) ?? { page: n, blocks: [] };
  const doc = new d.Document({
    title, creator: '꿈꾸는좋은교회',
    styles: { default: { document: { run: { font: font(false), size: 17, color: '3D342B' }, paragraph: { spacing: { before: 0, after: 0 } } } } },
    sections: [section([byPage(4), byPage(1)]), section([byPage(2), byPage(3)])],
  });
  return d.Packer.toBlob(doc);
}
