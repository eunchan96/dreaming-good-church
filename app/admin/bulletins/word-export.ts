/*
 * 인쇄 미리보기 → Word(.docx).
 * 화면에 그려진 인쇄 시트(테마·서식·면 배치가 모두 반영된 상태)를 읽어 Word의 진짜 문단·표·그림으로 옮긴다.
 * 1단계(measure)는 화면을 동기적으로 재서 단순한 모형을 만들고, 2단계(build)는 사진을 PNG/JPEG로 바꿔 docx를 만든다.
 * 쪽: A4 가로 2단. 1쪽 = 바깥면(4면 | 1면), 2쪽 = 안쪽면(2면 | 3면).
 */
import paper from './paper.module.css';
import { makeBrowserClient } from '@/lib/bulletin-store';

const PX = 15; // 1px(=0.75pt) → 15 twips
const twips = (px: number) => Math.max(0, Math.round(px * PX));
const MM = 56.6929; // 1mm → twips
/** 글꼴: 미리보기와 같은 Noto Sans KR을 파일에 넣는다(embedded). 넣지 못하면 맑은 고딕으로 열리고 폭만 보정한다. */
const NOTO = 'Noto Sans KR', NOTO_SEMIBOLD = 'Noto Sans KR SemiBold', MALGUN = 'Malgun Gothic', BATANG = 'Batang';
let embedded = false;

type Side = { color: string; size: number; style: 'single' | 'dashed' | 'dotted' | 'double'; space?: number };
type Borders = Partial<Record<'top' | 'bottom' | 'left' | 'right', Side>>;
type TextRunModel = { t: 'text'; text: string; size: number; weight: number; italic: boolean; underline: boolean; color: string; serif: boolean; spacing: number; shade?: string };
/** 그림: 화면의 img/svg, 또는 글자를 그대로 그린 그림(로고 글씨) */
type Glyphs = { text: string; font: string; color: string; letterSpacing: string };
type Run = TextRunModel | { t: 'br' } | { t: 'tab'; style: TextRunModel } | { t: 'img'; el: Element; w: number; h: number; glyphs?: Glyphs; behind?: boolean; abs?: { left: number; top: number }; at?: { x: number; y: number }; fill?: string };
type Align = 'left' | 'center' | 'right' | 'both' | 'distribute';
type Para = { k: 'p'; runs: Run[]; align: Align; left: number; right: number; line: number; exact: boolean; top: number; bottom: number; before?: number; tabs?: { type: 'center' | 'right'; pos: number }[]; border?: Borders; size: number };
type Cell = { width: number; blocks: Block[]; shade?: string; border?: Borders; pad: [number, number, number, number]; vAlign: 'top' | 'center' | 'bottom'; span?: number };
type Row = { height: number; cells: Cell[] }; // 높이: 미리보기에서 잰 값(줄 사이 간격 포함)을 Word의 최소 높이로
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

/** 선 굵기 px → Word 1/8pt. 1px 선은 0.5pt(0.75pt는 Word에서 화면보다 굵어 보인다). */
const hairline = (width: number) => width <= 1.5 ? 4 : Math.min(96, Math.max(2, Math.round(width * 6)));
function side(cs: CSSStyleDeclaration, name: 'Top' | 'Bottom' | 'Left' | 'Right'): Side | undefined {
  const style = cs.getPropertyValue(`border-${name.toLowerCase()}-style`), width = px(cs.getPropertyValue(`border-${name.toLowerCase()}-width`));
  const color = colorOf(cs.getPropertyValue(`border-${name.toLowerCase()}-color`));
  if (!width || !color || style === 'none' || style === 'hidden') return undefined;
  return { color, size: hairline(width), style: style === 'dashed' ? 'dashed' : style === 'dotted' ? 'dotted' : style === 'double' ? 'double' : 'single' };
}
function bordersOf(cs: CSSStyleDeclaration): Borders | undefined {
  const b: Borders = {};
  for (const [key, name] of [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']] as const) { const s = side(cs, name); if (s) b[key] = s; }
  const drawn = lineImage(cs); if (drawn && !b[drawn.side]) b[drawn.side] = drawn.line;
  return Object.keys(b).length ? b : undefined;
}
/** 칸 일부만 덮는 1px 배경 선(예: 위를 띄운 세로선) → 화면 위치·크기·색 */
function partialLine(el: Element, cs: CSSStyleDeclaration): { left: number; top: number; w: number; h: number; color: string } | undefined {
  if (!cs.backgroundImage.startsWith('linear-gradient')) return undefined;
  const colors = [...new Set([...cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map(m => colorOf(m[0])))];
  if (colors.length !== 1 || !colors[0]) return undefined;
  const r = el.getBoundingClientRect(), bl = px(cs.borderLeftWidth), bt = px(cs.borderTopWidth), W = r.width - bl - px(cs.borderRightWidth), H = r.height - bt - px(cs.borderBottomWidth);
  const length = (v: string, total: number) => { const calc = v.match(/^calc\(100% - ([\d.]+)px\)$/); return calc ? total - parseFloat(calc[1]) : v.endsWith('%') ? total * parseFloat(v) / 100 : px(v); };
  const [sw, sh] = cs.backgroundSize.split(/\s+(?![^(]*\))/), [p1, p2] = cs.backgroundPosition.split(/\s+(?![^(]*\))/);
  if (!sw || !sh) return undefined;
  const w = length(sw, W), h = length(sh, H);
  if (!(w <= 2 && h < H - 1) && !(h <= 2 && w < W - 1)) return undefined;
  const at = (v: string | undefined, total: number, size: number) => !v || v === '0%' || v === 'left' || v === 'top' ? 0 : v === '100%' || v === 'right' || v === 'bottom' ? total - size : v.endsWith('%') ? (total - size) * parseFloat(v) / 100 : px(v);
  return { left: r.left + bl + at(p1, W, w), top: r.top + bt + at(p2, H, h), w: Math.max(w, .75), h: Math.max(h, .75), color: colors[0] };
}
/** 배경 그림으로 그린 1px 선(linear-gradient 한 색, 폭이나 높이가 1~2px) → 그 쪽 테두리 */
function lineImage(cs: CSSStyleDeclaration): { side: 'top' | 'bottom' | 'left' | 'right'; line: Side } | undefined {
  if (!cs.backgroundImage.startsWith('linear-gradient') || cs.backgroundRepeat.includes('repeat') && !cs.backgroundRepeat.includes('no-repeat')) return undefined;
  const colors = [...new Set([...cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map(m => colorOf(m[0])))];
  if (colors.length !== 1 || !colors[0]) return undefined;
  const [w, h] = cs.backgroundSize.split(/\s+(?![^(]*\))/);
  const thin = (v?: string) => !!v && /^[\d.]+px$/.test(v) && px(v) <= 2;
  const pos = cs.backgroundPosition;
  const line = (width: string) => ({ color: colors[0]!, size: hairline(px(width)), style: 'single' as const });
  // 선 길이가 칸 전체가 아니면(섬기는 이들 첫 줄처럼 위를 띄운 선) 테두리로 그리지 않고 따로 그린다.
  const full = (v?: string) => !v || v === 'auto' || v === '100%';
  if (thin(w) && !full(h) || thin(h) && !full(w)) return undefined;
  if (thin(w)) return { side: /(^|\s)(100%|right)/.test(pos.split(' ')[0] ?? '') ? 'right' : 'left', line: line(w) };
  if (thin(h)) return { side: /(100%|bottom)/.test(pos.split(' ')[1] ?? '') ? 'bottom' : 'top', line: line(h) };
  return undefined;
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
    if (isMedia(child) && /absolute|fixed/.test(getComputedStyle(child).position)) continue; // 글자 위에 띄운 그림(하트)은 글줄에 붙인다
    if (!isInlineDisplay(d)) return true;
    if (!isMedia(child) && hasBlockChild(child)) return true;
  }
  return false;
}

function runStyle(el: Element): TextRunModel {
  const cs = getComputedStyle(el);
  return {
    t: 'text', text: '', size: Math.max(2, Math.round(px(cs.fontSize) * 1.5)), weight: Number(cs.fontWeight) || 400, italic: cs.fontStyle === 'italic',
    underline: cs.textDecorationLine.includes('underline'), color: colorOf(cs.color) ?? '342B25', serif: /serif/i.test(cs.fontFamily) && !/sans/i.test(cs.fontFamily.split(',')[0]),
    spacing: cs.letterSpacing === 'normal' ? 0 : Math.round(px(cs.letterSpacing) * PX), shade: isInlineDisplay(cs.display) ? colorOf(cs.backgroundColor) : undefined,
  };
}

/*
 * 글자 폭 맞추기. Word 글자 크기는 0.5pt 단위라 반올림만큼 폭이 달라지고(예: 7.81pt → 8pt),
 * Noto Sans KR을 넣지 못한 경우엔 맑은 고딕(약 6% 넓음)으로 열린다. 글자 조각마다 폭 차이를 재서 Word 글자 간격으로 보정한다.
 */
let ruler: CanvasRenderingContext2D | null = null, malgunReady: boolean | undefined;
function measure(font: string, text: string) { ruler ??= document.createElement('canvas').getContext('2d'); ruler!.font = font; return ruler!.measureText(text).width; }
function hasMalgun() {
  if (malgunReady === undefined) { const probe = '가나다라마바사 abc 123'; malgunReady = measure(`40px "${MALGUN}", monospace`, probe) !== measure('40px monospace', probe); }
  return malgunReady;
}
function fitSpacing(el: Element, style: TextRunModel, text: string, squeeze = 0) {
  const chars = [...text].length; if (!chars) return;
  const cs = getComputedStyle(el), base = `${cs.fontStyle} ${cs.fontWeight}`, size = px(cs.fontSize), wordSize = style.size / 1.5;
  const screen = measure(`${base} ${size}px ${cs.fontFamily}`, text);
  const word = embedded ? screen * wordSize / size : hasMalgun() ? measure(`${base} ${wordSize}px "${style.serif ? BATANG : MALGUN}"`, text) : screen * wordSize / size * 1.063;
  // 글자당 px(음수 = 좁히기). 같은 글꼴이면 아주 작은 여유만, 다른 글꼴이면 Word 줄 맞춤 오차와 줄바꿈 금지(nowrap) 글자에 여유를 더 둔다.
  const nowrap = /nowrap|pre$/.test(cs.whiteSpace) ? (embedded ? .05 : .3) : 0;
  const extra = Math.max(-2.4, Math.min(1.5, (screen - word) / chars - (embedded ? .02 : .12) - nowrap - squeeze));
  style.spacing += Math.round(extra * PX);
}

function collectRuns(node: Node, out: Run[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement!; const ws = getComputedStyle(parent).whiteSpace;
    const keepBreaks = /pre|break-spaces/.test(ws);
    const raw = (node.textContent ?? '').replace(/ /g, ' ');
    const style = runStyle(parent);
    if (style.serif && raw.trim()) {
      // 명조 로고 글씨(좋은교회)는 글꼴을 넣지 않고, 화면 글꼴로 그린 그림으로 옮긴다.
      const range = document.createRange(); range.selectNodeContents(node); const r = range.getBoundingClientRect(), pcs = getComputedStyle(parent);
      out.push({ t: 'img', el: parent, w: r.width, h: r.height, glyphs: { text: raw.trim(), font: `${pcs.fontStyle} ${pcs.fontWeight} ${pcs.fontSize} ${pcs.fontFamily}`, color: pcs.color, letterSpacing: pcs.letterSpacing === 'normal' ? '0px' : pcs.letterSpacing } });
      return;
    }
    // 원래 있는 줄바꿈만 옮기고, 나머지 줄바꿈은 Word가 한다(Word에서 글을 고쳐도 자연스럽게 다시 줄이 바뀌도록).
    const lines = keepBreaks ? raw.split('\n') : [raw.replace(/\s+/g, ' ')];
    lines.forEach((line, i) => {
      if (i) out.push({ t: 'br' });
      if (line) { const run = { ...style, text: line }; fitSpacing(parent, run, line); out.push(run); }
    });
    return;
  }
  if (!(node instanceof Element) || !visible(node)) return;
  if (node.tagName === 'BR') { out.push({ t: 'br' }); return; }
  if (isMedia(node)) { const r = node.getBoundingClientRect(); out.push({ t: 'img', el: node, w: r.width, h: r.height, ...(/absolute|fixed/.test(getComputedStyle(node).position) ? { abs: { left: r.left, top: r.top } } : {}) }); return; }
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

/** ::before / ::after 의 글자(예: 묵상 담당 '< 이름 >'의 꺾쇠) */
function pseudoRun(el: Element, which: '::before' | '::after'): TextRunModel | undefined {
  const cs = getComputedStyle(el, which);
  if (!cs.content || cs.content === 'none' || cs.content === 'normal' || cs.display === 'none' || cs.position === 'absolute') return undefined;
  const text = (cs.content.match(/"([^"]*)"|'([^']*)'/g) ?? []).map(t => t.slice(1, -1)).join('');
  if (!text) return undefined;
  return { t: 'text', text, size: Math.max(2, Math.round(px(cs.fontSize) * 1.5)), weight: Number(cs.fontWeight) || 400, italic: cs.fontStyle === 'italic', underline: false, color: colorOf(cs.color) ?? '342B25', serif: false, spacing: cs.letterSpacing === 'normal' ? 0 : Math.round(px(cs.letterSpacing) * PX) };
}
function paragraph(el: Element, frame: Frame, nodes?: Node[], align?: Align, given?: Run[]): Para | null {
  const box = contentBox(el), cs = box.cs;
  const size = px(cs.fontSize), lh = cs.lineHeight === 'normal' ? size * 1.4 : px(cs.lineHeight);
  const collected = given ?? (() => { const out: Run[] = []; for (const n of nodes ?? el.childNodes) collectRuns(n, out); return out; })();
  if (!given && !nodes) { const before = pseudoRun(el, '::before'), after = pseudoRun(el, '::after'); if (before && collected.length) collected.unshift(before); if (after && collected.length) collected.push(after); }
  const runs = trimRuns(collected);
  if (!runs.length) return null;
  // 글줄의 실제 위치: flex 가운데 정렬처럼 상자가 글자보다 크면 글자 자리로 잡는다(줄 높이만큼 위아래로).
  const range = document.createRange(); if (nodes?.length) { range.setStartBefore(nodes[0]); range.setEndAfter(nodes[nodes.length - 1]); } else range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter(r => r.height > 0);
  const textTop = rects.length ? Math.min(...rects.map(r => r.top)) : box.top, textBottom = rects.length ? Math.max(...rects.map(r => r.bottom)) : box.bottom;
  const first = rects.find(r => r.top === textTop), half = first ? Math.max(0, (lh - first.height) / 2) : 0;
  let top = Math.max(box.top, textTop - half), bottom = Math.min(Math.max(box.bottom, top), textBottom + half);
  const ownBorder = bordersOf(cs);
  if (ownBorder?.top) top = box.rect.top;
  if (ownBorder?.bottom) bottom = box.rect.bottom;
  const bullet = bulletOf(cs);
  if (bullet) {
    const style = { ...runStyle(el), color: bullet, text: '• ', weight: 400 };
    for (let i = runs.length - 1; i >= 0; i--) if (runs[i].t === 'br') runs.splice(i + 1, 0, { ...style });
    runs.unshift({ ...style });
  }
  for (const r of runs) if (r.t === 'img' && r.abs) r.at = { x: r.abs.left - frame.left, y: r.abs.top - top }; // 화면에서 띄워 둔 그림(하트) → 같은 자리에 띄움
  const imageHeight = Math.max(0, ...runs.map(r => r.t === 'img' && !r.at ? r.h : 0));
  const border = bordersOf(cs) ?? {};
  // 선과 글자 사이 간격 = 화면의 안쪽 여백(pt)
  for (const [key, name] of [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']] as const) if (border[key]) border[key] = { ...border[key]!, space: Math.min(31, px(cs.getPropertyValue(`padding-${name.toLowerCase()}`)) * .75) };
  const bar = accentBar(el); if (bar) border.left = bar;
  // Word 글꼴(맑은 고딕)은 화면 글꼴보다 넓을 수 있어, 정렬 반대쪽 여백은 비워 줄바꿈을 막는다.
  // 가운데 정렬은 가운데 위치를 지키면서 양쪽에 여유를 둔다.
  const a = align ?? alignOf(cs), L = Math.max(0, (bullet ? box.rect.left : box.left) - frame.left), R = Math.max(0, frame.right - box.right);
  const slack = a === 'center' ? Math.min(Math.max(8, (box.right - box.left) * .3), L, R) : 0; // 양쪽 같은 만큼만 → 가운데 위치 유지
  const lined = Object.keys(border).length > 0; // 밑줄·테두리가 있는 문단은 화면 폭 그대로(선 길이 유지)
  return {
    k: 'p', runs, align: a, left: a === 'right' && !lined ? 0 : L - slack, right: (a === 'left' || a === 'both') && !lined ? 0 : (lined ? Math.max(0, frame.right - box.rect.right) : R - slack),
    line: Math.max(lh, imageHeight + 1), exact: true, top, bottom, border: Object.keys(border).length ? border : undefined, size,
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
  // 한쪽에만 선이 있는 묶음(칸 사이 세로선, 항목 사이 가로선)도 선을 살리려고 상자로 둔다. 글줄 하나면 문단 테두리로 충분하다.
  if (bordersOf(cs) && (hasBlockChild(el) || rowLayout(el, cs))) return [boxTable(el, cs, frame)];
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
    const ncs = getComputedStyle(node), d = ncs.display;
    const ownBox = d === 'inline-block' && (!!bordersOf(ncs) || !!backgroundOf(ncs)); // 밑줄·바탕이 있는 inline-block은 따로 둔다
    if ((isInlineDisplay(d) && d !== 'contents' && !hasBlockChild(node) && !ownBox) || node.tagName === 'BR' || (isMedia(node) && /absolute|fixed/.test(ncs.position))) { loose.push(node); continue; }
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
  const centredRow = getComputedStyle(el).justifyContent === 'center';
  const grouped = groupRows(kids);
  const rows = grouped.map((row, rowIndex) => {
    const rowTop = rowIndex === 0 ? Math.min(box.top, row.top) : row.top, rowBottom = grouped[rowIndex + 1]?.top ?? Math.max(box.bottom, row.bottom);
    const lead = rowIndex === 0 && before && row.columns[0].left - box.left > 2 ? before : undefined;
    const cols = row.columns;
    // 칸 경계: 오른쪽 선이 있는 칸은 그 칸 오른쪽 끝, 아니면 다음 칸 시작.
    const lines = cols.map(c => c.items.length === 1 ? bordersOf(getComputedStyle(c.items[0].el)) : undefined);
    const edges = [box.left, ...(lead ? [cols[0].left] : []), ...cols.slice(1).map((c, k) => lines[k]?.right ? cols[k].right : c.left), box.right];
    const leadCell: Cell[] = lead ? [(() => {
      const size = px(lead.cs.fontSize), lh = lead.cs.lineHeight === 'normal' ? size * 1.4 : px(lead.cs.lineHeight);
      const style: TextRunModel = { ...runStyle(el), text: lead.text, color: colorOf(lead.cs.color) ?? '342B25', size: Math.round(size * 1.5), weight: Number(lead.cs.fontWeight) || 400 };
      return { width: edges[1] - edges[0], pad: [0, 0, 0, 0], vAlign: 'top', blocks: stack([{ k: 'p', runs: [style], align: 'left', left: 0, right: 0, line: lh, exact: true, top: row.top, bottom: row.top + lh, size }], rowTop) } satisfies Cell;
    })()] : [];
    const offset = lead ? 1 : 0;
    return {
      height: rowBottom - rowTop,
      cells: [...leadCell, ...cols.map((column, k): Cell => { const i = k + offset;
        const cellLeft = edges[i], cellRight = Math.max(edges[i + 1], cellLeft + 4);
        // 칸 하나짜리 항목의 선은 Word 칸 테두리로(문단 옆 선은 Word가 좁은 칸에서 그리지 않는다). 항목 자체는 다시 상자로 감싸지 않는다(선이 두 겹이 됨).
        const own = (el: Element) => lines[k] && !backgroundOf(getComputedStyle(el));
        const blocks = column.items.flatMap(item => own(item.el) ? inner(item.el, { left: column.left, right: cellRight, top: item.r.top }) : walk(item.el, { left: column.left, right: cellRight, top: item.r.top }));
        const border = lines[k] ? { ...lines[k] } : undefined;
        if (border) for (const b of blocks) if (b.k === 'p') b.border = undefined;
        // 가운데로 모으는 줄(날개 그림 사이 예배 제목)의 글자는 자기 칸 안 가운데에 둔다(Word 글자 폭이 조금 달라도 가운데 유지).
        if (centredRow && column.items.length === 1) for (const b of blocks) if (b.k === 'p' && b.align === 'left' && !b.runs.some(r => r.t === 'img')) { b.align = 'center'; b.left = 0; b.right = Math.max(0, cellRight - column.right); }
        // 칸 위치가 이미 화면 자리이므로, 그림만 있는 문단(날개 그림 등)은 칸 안에서 다시 가운데로 옮기지 않는다.
        for (const b of blocks) if (b.k === 'p' && b.runs.length && b.runs.every(r => r.t === 'img' && !r.at && !r.behind)) { b.align = 'left'; b.left = 0; b.right = 0; }
        // 칸 안 세로 위치는 칸 위쪽 여백 대신 문단 앞 간격으로(Word가 칸 위쪽 여백을 무시하는 경우가 있다).
        return { width: cellRight - cellLeft, pad: [0, 0, 0, Math.max(0, column.left - cellLeft)], vAlign: 'top', border, blocks: stack(blocks, rowTop) };
      })],
    };
  });
  const top = Math.min(box.top, grouped[0]?.top ?? box.top);
  return { k: 't', rows, width: box.right - box.left, left: Math.max(0, box.left - frame.left), top, bottom: Math.max(box.bottom, grouped.at(-1)?.bottom ?? box.bottom) };
}

/** 배경·테두리가 있는 상자(띠 제목, 메모 칸, 옅은 바탕 영역) = 칸 하나짜리 표. */
function boxTable(el: Element, cs: CSSStyleDeclaration, frame: Frame): Tbl {
  const r = el.getBoundingClientRect(), box = contentBox(el);
  const pad: [number, number, number, number] = [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)];
  const content = stack(inner(el, { left: box.left, right: box.right, top: box.top }), box.top);
  const border = bordersOf(cs), segments = !colorOf(cs.backgroundColor) ? fullGradient(cs) : undefined;
  if (segments && segments.length > 1) {
    // 사선 3색 띠: 화면과 똑같이 그린 배경 그림을 칸 맨 위 빈 문단에 '글자 뒤'로 고정하고, 글자는 그 위에 둔다.
    const own = stack(inner(el, { left: r.left, right: r.right, top: r.top }), r.top);
    const anchor: Para = { k: 'p', runs: [{ t: 'img', el, w: r.width, h: r.height, behind: true }], align: 'left', left: 0, right: 0, line: .15, exact: true, top: r.top, bottom: r.top, size: 1 };
    return { k: 't', left: Math.max(0, r.left - frame.left), width: r.width, top: r.top, bottom: r.bottom, rows: [{ height: r.height, cells: [{ width: r.width, pad: [0, 0, 0, 0], vAlign: 'top', blocks: [anchor, ...own] }] }] };
  }
  // 화면에서 내용이 상자 밖으로 조금 넘치는 경우(섬기는 이들 마지막 줄)에도 Word 칸이 내용을 자르지 않게 한다.
  const contentBottom = Math.max(r.bottom, ...content.map(b => b.bottom + pad[2]));
  return { k: 't', left: Math.max(0, r.left - frame.left), width: r.width, top: r.top, bottom: contentBottom, rows: [{ height: contentBottom - r.top, cells: [{ width: r.width, shade: backgroundOf(cs), border, pad, vAlign: 'top', blocks: content }] }] };
}

function htmlTable(table: HTMLTableElement, frame: Frame): Tbl {
  const r = table.getBoundingClientRect();
  const trs = [...table.rows].filter(visible);
  type VLine = { x: number; top: number; bottom: number; color: string };
  const vlines: (VLine | undefined)[][] = [];
  const rows = trs.map((tr, index) => {
    const trBg = colorOf(getComputedStyle(tr).backgroundColor), tr_r = tr.getBoundingClientRect();
    const tds = [...tr.cells].filter(visible), lines: (VLine | undefined)[] = [];
    vlines.push(lines);
    return {
      height: (trs[index + 1]?.getBoundingClientRect().top ?? tr_r.bottom) - tr_r.top,
      cells: tds.map((td, c): Cell => {
        const cs = getComputedStyle(td), box = contentBox(td), tr_ = td.getBoundingClientRect();
        const blocks = stack(hasBlockChild(td) || rowLayout(td, cs) ? inner(td, box) : [paragraph(td, box)].filter((p): p is Para => !!p), box.top);
        // 칸 오른쪽 세로선(테두리·배경 선·위를 띄운 배경 선)을 모아 두었다가 아래에서 한 줄로 잇는다.
        const part = partialLine(td, cs), border = bordersOf(cs);
        lines[c] = part && part.w <= 2 ? { x: part.left, top: part.top, bottom: part.top + part.h, color: part.color }
          : border?.right ? { x: tr_.right - border.right.size / 6, top: tr_.top, bottom: (trs[index + 1]?.getBoundingClientRect().top ?? tr_.bottom), color: border.right.color } : undefined;
        return {
          width: tr_.width, shade: colorOf(cs.backgroundColor) ?? trBg, border, span: td.colSpan > 1 ? td.colSpan : undefined,
          pad: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)], vAlign: cs.verticalAlign === 'middle' ? 'center' : cs.verticalAlign === 'bottom' ? 'bottom' : 'top',
          blocks,
        };
      }),
    };
  }).filter(row => row.cells.length);
  // 같은 열의 세로선은 표 위에서 아래까지 하나의 선(0.5pt)으로: 줄마다 따로 그리면 이음매가 끊겨 보인다.
  const columns = Math.max(0, ...vlines.map(l => l.length));
  for (let c = 0; c < columns; c++) {
    const segs = vlines.map((l, row) => ({ line: l[c], row })).filter((v): v is { line: VLine; row: number } => !!v.line);
    if (!segs.length) continue;
    const top = Math.min(...segs.map(v => v.line.top)), bottom = Math.max(...segs.map(v => v.line.bottom)), first = rows[segs[0].row]?.cells[c];
    const anchor = first?.blocks.find((b): b is Para => b.k === 'p');
    if (!first || !anchor) continue;
    for (const v of segs) { const cell = rows[v.row]?.cells[c]; if (cell?.border?.right) cell.border = { ...cell.border, right: undefined }; }
    const td = trs[segs[0].row].cells[c], box = contentBox(td);
    anchor.runs.push({ t: 'img', el: td, w: 2 / 3, h: bottom - top, fill: segs[0].line.color, at: { x: segs[0].line.x - box.left, y: top - anchor.top } });
  }
  return { k: 't', rows, width: r.width, left: Math.max(0, r.left - frame.left), top: r.top, bottom: r.bottom };
}

/** 예배 순서 한 줄: ↑ | 이름(균등 배치) | 점선·내용·점선 | 담당(균등 배치) */
function orderTable(rows: Element[], frame: Frame): Tbl {
  const first = rows[0].getBoundingClientRect(), last = rows[rows.length - 1].getBoundingClientRect();
  return {
    k: 't', left: Math.max(0, first.left - frame.left), width: first.width, top: first.top, bottom: last.bottom,
    rows: rows.map((row, index) => {
      const rr = row.getBoundingClientRect(), rcs = getComputedStyle(row), rowBorder = bordersOf(rcs);
      const height = (rows[index + 1]?.getBoundingClientRect().top ?? rr.bottom) - rr.top;
      const kids = [...row.children].filter(visible);
      const edges = [rr.left, ...kids.slice(1).map(k => k.getBoundingClientRect().left), rr.right];
      return {
        height,
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
  // 작은 아이콘(주소·전화·유튜브)은 Word가 글줄 바닥선에 맞춰 놓아 높이가 흔들린다 → 화면과 같은 자리에 띄운다.
  if (r.width <= 32 && r.height <= 32) return { k: 'p', runs: [{ t: 'img', el, w: r.width, h: r.height, at: { x: left, y: 0 } }], align: 'left', left: 0, right: 0, line: .15, exact: true, top: r.top, bottom: r.bottom, size: 1 };
  return { k: 'p', runs: [{ t: 'img', el, w: r.width, h: r.height }], align, left: align === 'left' ? left : 0, right: 0, line: r.height, exact: false, top: r.top, bottom: r.bottom, size: 1 };
}

/** 위아래 간격은 화면의 실제 위치 차이로 정한다(여백·마진·flex 간격 모두 포함). */
function stack(blocks: Block[], start: number): Block[] {
  const sorted = [...blocks].sort((a, b) => a.top - b.top);
  let cursor = start;
  for (const b of sorted) { b.before = Math.max(0, b.top - cursor); cursor = Math.max(cursor, b.bottom); }
  return sorted;
}

/** 화면에서 인쇄 시트를 읽는다. 미리보기 확대·축소(zoom)는 잠시 1로 되돌려 실제 크기로 잰다. */
export function measurePanels(root: HTMLElement, withFonts = false): WordPanel[] {
  embedded = withFonts;
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
      return { page, blocks: stack(children(body, frame), box.top) };
    });
  } finally { if (zoomed) zoomed.style.zoom = zoom; }
}

/* ---------- 그림 ---------- */
const png = async (canvas: HTMLCanvasElement) => ({ data: new Uint8Array(await (await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image')), 'image/png'))).arrayBuffer()), type: 'png' as const });
/** CSS linear-gradient(각도, 색 위치…)를 캔버스에 같은 모양으로 그린다(띠 제목의 사선 경계 포함). */
function paintGradient(ctx: CanvasRenderingContext2D, css: string, w: number, h: number) {
  const body = css.slice(css.indexOf('(') + 1, css.lastIndexOf(')'));
  const deg = body.match(/^\s*(-?[\d.]+)deg/)?.[1], to = body.match(/^\s*to ([a-z ]+)/)?.[1];
  const angle = (deg !== undefined ? Number(deg) : to ? ({ top: 0, right: 90, bottom: 180, left: 270 } as Record<string, number>)[to.trim()] ?? 180 : 180) * Math.PI / 180;
  const dx = Math.sin(angle), dy = -Math.cos(angle), length = Math.abs(w * dx) + Math.abs(h * dy);
  const g = ctx.createLinearGradient(w / 2 - dx * length / 2, h / 2 - dy * length / 2, w / 2 + dx * length / 2, h / 2 + dy * length / 2);
  const stops = [...body.matchAll(/(rgba?\([^)]*\))\s*([\d.]+%)?/g)];
  stops.forEach((m, i) => g.addColorStop(Math.min(1, Math.max(0, m[2] ? parseFloat(m[2]) / 100 : i / Math.max(1, stops.length - 1))), m[1]));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
async function rasterize(run: Extract<Run, { t: 'img' }>): Promise<{ data: Uint8Array; type: 'png' | 'jpg' }> {
  const { el, w, h } = run;
  const scale = 3, canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  if (run.behind) { ctx.scale(scale, scale); paintGradient(ctx, getComputedStyle(el).backgroundImage, w, h); return png(canvas); }
  if (run.fill) { ctx.fillStyle = `#${run.fill}`; ctx.fillRect(0, 0, canvas.width, canvas.height); return png(canvas); }
  if (run.glyphs) {
    // 로고 글씨: 화면과 같은 글꼴·간격으로 그린다.
    ctx.scale(scale, scale); ctx.font = run.glyphs.font; ctx.fillStyle = run.glyphs.color; ctx.textBaseline = 'alphabetic';
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = run.glyphs.letterSpacing;
    const m = ctx.measureText(run.glyphs.text), ascent = m.fontBoundingBoxAscent, descent = m.fontBoundingBoxDescent;
    ctx.fillText(run.glyphs.text, 0, (h - ascent - descent) / 2 + ascent);
    return png(canvas);
  }
  let source: CanvasImageSource, sw: number, sh: number;
  if (el instanceof HTMLImageElement) {
    const blob = await (await fetch(el.currentSrc || el.src)).blob();
    // 사진(JPEG·WebP)은 JPEG로, 크기는 인쇄에 충분한 만큼만(가로·세로 최대 2400px).
    const photo = blob.type === 'image/jpeg' || blob.type === 'image/webp';
    const k = Math.min(photo ? 2 : scale, 2400 / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
    const bitmap = await createImageBitmap(blob); source = bitmap; sw = bitmap.width; sh = bitmap.height;
    const fit = getComputedStyle(el).objectFit;
    if (fit === 'cover' || fit === 'contain') {
      const k = fit === 'cover' ? Math.max(canvas.width / sw, canvas.height / sh) : Math.min(canvas.width / sw, canvas.height / sh);
      const dw = sw * k, dh = sh * k;
      if (photo) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(source, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    } else {
      if (photo) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    const out = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image')), photo ? 'image/jpeg' : 'image/png', .9));
    return { data: new Uint8Array(await out.arrayBuffer()), type: photo ? 'jpg' : 'png' };
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
export type WordFonts = { regular: string; semibold: string; bold: string };
export async function buildDocx(panels: WordPanel[], title: string, fonts?: WordFonts | null): Promise<Blob> {
  const d = await import('docx');
  type ImageRunModel = Extract<Run, { t: 'img' }>;
  const images = new Map<ImageRunModel, Promise<{ data: Uint8Array; type: 'png' | 'jpg' }>>();
  const visit = (blocks: Block[]) => blocks.forEach(b => b.k === 'p' ? b.runs.forEach(r => { if (r.t === 'img') images.set(r, rasterize(r)); }) : b.rows.forEach(row => row.cells.forEach(c => visit(c.blocks))));
  panels.forEach(p => visit(p.blocks));
  const ready = new Map<ImageRunModel, { data: Uint8Array; type: 'png' | 'jpg' } | null>();
  await Promise.all([...images].map(async ([el, job]) => { try { ready.set(el, await job); } catch { ready.set(el, null); } }));

  const borderStyle = (s: Side['style']) => s === 'dashed' ? d.BorderStyle.DASHED : s === 'dotted' ? d.BorderStyle.DOTTED : s === 'double' ? d.BorderStyle.DOUBLE : d.BorderStyle.SINGLE;
  const border = (s?: Side) => s ? { style: borderStyle(s.style), size: s.size, color: s.color, space: Math.round(s.space ?? 0) } : undefined;
  const none = { style: d.BorderStyle.NONE, size: 0, color: 'auto' };
  const family = (name: string) => ({ ascii: name, eastAsia: name, hAnsi: name, cs: name });
  // 굵기 → 글꼴: 400 = Noto Sans KR, 600 = Noto Sans KR SemiBold, 700 = Noto Sans KR 굵게(넣은 Bold 글꼴)
  const face = (r: TextRunModel) => r.serif ? { font: family(BATANG), bold: r.weight >= 600 }
    : embedded ? (r.weight >= 650 ? { font: family(NOTO), bold: true } : r.weight >= 550 ? { font: family(NOTO_SEMIBOLD), bold: false } : { font: family(NOTO), bold: false })
    : { font: family(MALGUN), bold: r.weight >= 600 };
  const textRun = (r: TextRunModel, extra: Record<string, unknown> = {}) => new d.TextRun({
    text: r.text, ...face(r), italics: r.italic, size: r.size, underline: r.underline ? {} : undefined, color: r.color,
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
      else {
        const img = ready.get(r); if (!img) continue;
        if (Object.keys(brk).length) children.push(new d.TextRun({ break: 1 }));
        // 배경 그림은 칸 왼쪽 위(0,0)에 글자 뒤로 띄운다.
        const EMU = 9525; // px → EMU
        const floating = r.behind ? { horizontalPosition: { relative: d.HorizontalPositionRelativeFrom.COLUMN, offset: 0 }, verticalPosition: { relative: d.VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 }, behindDocument: true, allowOverlap: true, lockAnchor: true, layoutInCell: true, wrap: { type: d.TextWrappingType.NONE } }
          : r.at ? { horizontalPosition: { relative: d.HorizontalPositionRelativeFrom.COLUMN, offset: Math.round(r.at.x * EMU) }, verticalPosition: { relative: d.VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round((r.at.y + (p.before ?? 0)) * EMU) /* Word의 '문단 기준'은 앞 간격까지 포함한 맨 위 */ }, behindDocument: false, allowOverlap: true, lockAnchor: true, layoutInCell: true, wrap: { type: d.TextWrappingType.NONE } } : undefined;
        children.push(new d.ImageRun({ type: img.type, data: img.data, transformation: { width: r.w, height: r.h }, ...(floating ? { floating } : {}) }));
      }
    }
    if (pendingBreak) children.push(new d.TextRun({ break: 1 }));
    const firstText = p.runs.find(r => r.t === 'text') as TextRunModel | undefined;
    if (!children.length) children.push(new d.TextRun({ text: '', size: firstText?.size ?? Math.round(p.size * 1.5) }));
    const pictures = p.runs.some(r => r.t === 'img' && !r.behind && !r.at) && !p.runs.some(r => r.t === 'text');
    return new d.Paragraph({
      ...browserLike, children, alignment: alignment[p.align],
      // 그림 줄: 고정 줄 높이면 Word가 그림을 자르거나 위로 올린다 → 보통 줄 높이 + 아주 작은 문단 기호
      ...(pictures && !p.runs.some(r => r.t === 'text') ? { run: { size: 2 } } : {}),
      indent: { left: twips(p.left), right: twips(p.right) },
      spacing: { before: twips(p.before ?? 0), after: 0, ...(p.exact && !pictures ? { line: Math.max(2, twips(p.line)), lineRule: d.LineRuleType.EXACT } : { line: 240, lineRule: d.LineRuleType.AUTO }) },
      tabStops: p.tabs?.map(t => ({ type: t.type === 'center' ? d.TabStopType.CENTER : d.TabStopType.RIGHT, position: Math.min(twips(width), twips(t.pos)), leader: d.LeaderType.MIDDLE_DOT })),
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
      rows: t.rows.map(row => { const rise = rowRise(row); return new d.TableRow({
        // 높이는 '최소'로: Word에서 글을 더 쓰면 칸이 늘어난다. Word는 칸 위아래 테두리 두께를 높이에 더 얹으므로 그만큼 뺀다.
        cantSplit: true, height: { value: Math.max(20, twips(row.height - Math.max(0, ...row.cells.map(c => (c.border?.top?.size ?? 0) / 6)) - Math.max(0, ...row.cells.map(c => (c.border?.bottom?.size ?? 0) / 6)))), rule: d.HeightRule.ATLEAST },
        children: row.cells.map(c => new d.TableCell({
          width: { size: twips(c.width), type: d.WidthType.DXA }, columnSpan: c.span,
          // Word는 고정 줄 높이에 칸 위아래 여백을 더 얹는다 → 위아래 여백은 쓰지 않고, 위쪽은 첫 문단 앞 간격으로 옮긴다.
          margins: { top: 0, right: twips(c.pad[1]), bottom: 0, left: twips(c.pad[3]) },
          verticalAlign: c.vAlign === 'center' ? d.VerticalAlign.CENTER : c.vAlign === 'bottom' ? d.VerticalAlign.BOTTOM : d.VerticalAlign.TOP,
          shading: c.shade ? { type: d.ShadingType.CLEAR, fill: c.shade, color: 'auto' } : undefined,
          borders: { top: border(c.border?.top) ?? none, bottom: border(c.border?.bottom) ?? none, left: border(c.border?.left) ?? none, right: border(c.border?.right) ?? none },
          children: flow(lead(c, rise), c.width - c.pad[1] - c.pad[3], true, c.vAlign === 'center'),
        })),
      }); }),
    });
  }
  const picturesOnly = (b: Para) => b.runs.some(r => r.t === 'img' && !r.behind && !r.at) && !b.runs.some(r => r.t === 'text');
  /** 이 줄의 글자 칸 첫 문단이 칸 안에서 스스로 올라가는 양 */
  const rowRise = (row: Row) => Math.max(0, ...row.cells.map(c => { const f = c.blocks[0]; return f?.k === 'p' && !picturesOnly(f) ? Math.min(halfLeading(f, c.vAlign === 'center'), (f.before ?? 0) + (c.vAlign === 'top' ? c.pad[0] : 0)) : 0; }));
  /** 칸 첫 덩어리: 위쪽 여백을 앞 간격으로 옮기고, 그림만 있는 칸(아이콘)은 옆 글자만큼 같이 올린다 */
  const lead = (c: Cell, rise: number): Block[] => {
    const f = c.blocks[0]; if (!f) return c.blocks;
    let before = (f.before ?? 0) + (c.vAlign === 'top' ? c.pad[0] : 0);
    if (f.k === 'p' && picturesOnly(f)) before = Math.max(0, before - rise);
    return [{ ...f, before }, ...c.blocks.slice(1)];
  };
  /** 고정 줄 높이 문단에서 Word가 브라우저보다 아래에 두는 양(반쪽 줄 간격, px) */
  const halfLeading = (b: Para, centred: boolean) => {
    const tallest = Math.max(0, ...b.runs.map(r => r.t === 'text' ? r.size : r.t === 'tab' ? r.style.size : 0)) / 1.5; // 반포인트 → px
    const picturesOnly = b.runs.some(r => r.t === 'img' && !r.behind && !r.at) && !b.runs.some(r => r.t === 'text');
    return b.exact && !centred && !picturesOnly && tallest ? Math.max(0, (b.line - tallest * (embedded ? 1.448 : 1.33)) / 2) : 0;
  };
  /** 표 첫 줄 칸들의 첫 문단이 앞 간격만으로 다 올라가지 못하는 양 → 표 전체를 그만큼 올린다 */
  const tableLift = (t: Tbl) => Math.max(0, ...(t.rows[0]?.cells ?? []).map(c => { const first = c.blocks[0]; return first?.k === 'p' ? Math.max(0, halfLeading(first, c.vAlign === 'center') - (first.before ?? 0) - (c.vAlign === 'top' ? c.pad[0] : 0)) : 0; }));
  function flow(blocks: Block[], width: number, inCell = false, centred = false, startCarry = 0): (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] {
    const out: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];
    let carry = startCarry;
    for (let b of blocks) {
      if (b.k === 'p') {
        // 고정 줄 높이에서 Word는 남는 줄 간격을 모두 글자 위에 두고, 브라우저는 위아래로 반씩 나눈다.
        // → 이 문단을 반쪽 간격만큼 올리고(앞 간격에서 빼고), 뺀 만큼은 다음 덩어리 앞에 돌려준다. 가운데 정렬 칸은 Word가 이미 가운데에 둔다.
        const half = halfLeading(b, centred);
        const available = (b.before ?? 0) + carry, shift = Math.min(half, available);
        out.push(para({ ...b, before: available - shift }, width)); carry = shift;
        continue;
      }
      { const available = (b.before ?? 0) + carry, shift = Math.min(tableLift(b), available); b = { ...b, before: available - shift }; carry = shift; }
      if ((b.before ?? 0) >= 1 || out.at(-1) instanceof d.Table) out.push(spacer(Math.max(0.2, b.before ?? 0))); out.push(table(b));
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
  const panelWidth = 142.5, panelPad = 5, panelHeight = 197.5 /* 196mm + 맨 아래 글자 꼬리 여유(쪽 아래 여백 안) */, contentPx = (panelWidth - panelPad * 2) * 3.7795;
  const none4 = { top: none, bottom: none, left: none, right: none };
  /** 면 맨 위 덩어리가 올라가야 하는 양(위로 올릴 앞 간격이 없을 때) */
  const topLift = (page: WordPanel) => { const first = page.blocks[0]; if (!first) return 0; return Math.max(0, (first.k === 'p' ? halfLeading(first, false) : tableLift(first)) - (first.before ?? 0)); };
  const sheet = (pages: WordPanel[], lift: number) => new d.Table({
    width: { size: Math.round(panelWidth * 2 * MM), type: d.WidthType.DXA }, layout: d.TableLayoutType.FIXED, columnWidths: [Math.round(panelWidth * MM), Math.round(panelWidth * MM)],
    borders: d.TableBorders.NONE, margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: [new d.TableRow({
      // 면 높이도 '최소': 내용이 넘치면 Word가 다음 쪽으로 넘긴다(잘라 버리지 않음).
      cantSplit: true, height: { value: Math.round(panelHeight * MM), rule: d.HeightRule.ATLEAST },
      children: pages.map(page => new d.TableCell({
        width: { size: Math.round(panelWidth * MM), type: d.WidthType.DXA }, borders: none4, verticalAlign: d.VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: Math.round(panelPad * MM), right: Math.round(panelPad * MM) },
        children: flow(page.blocks, contentPx, true, false, lift), // 쪽 위 여백을 lift만큼 줄였으니 그만큼 되돌려 받는다
      })),
    })],
  });
  // 표 뒤에 Word가 요구하는 빈 문단은 아주 낮게(빈 쪽이 생기지 않도록).
  const tail = () => new d.Paragraph({ ...browserLike, children: [new d.TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACT } });
  const section = (pages: WordPanel[]) => {
    const lift = Math.max(...pages.map(topLift)); // 두 면 중 맨 위가 더 올라가야 하는 만큼 쪽 위 여백을 줄인다
    return {
      properties: {
        page: { size: { width: 11906, height: 16838, orientation: d.PageOrientation.LANDSCAPE }, margin: { top: Math.round(7 * MM - lift * PX), bottom: Math.round(5 * MM), left: Math.round(6 * MM), right: Math.round(6 * MM), header: 0, footer: 0, gutter: 0 } },
      },
      children: [sheet(pages, lift), tail()],
    };
  };
  const byPage = (n: number) => panels.find(p => p.page === n) ?? { page: n, blocks: [] };
  const doc = new d.Document({
    title, creator: '꿈꾸는좋은교회',
    styles: { default: { document: { run: { font: family(embedded ? NOTO : MALGUN), size: 17, color: '3D342B' }, paragraph: { spacing: { before: 0, after: 0 } } } } },
    // 미리보기와 같은 글꼴(주보에 쓰인 글자만)을 파일에 넣는다: 어느 컴퓨터에서 열어도 굵기·폭이 같다.
    ...(embedded && fonts ? { fonts: [
      { name: NOTO, data: bytes(fonts.regular), bold: bytes(fonts.bold), characterSet: d.CharacterSet.HANGUL },
      { name: NOTO_SEMIBOLD, data: bytes(fonts.semibold), characterSet: d.CharacterSet.HANGUL },
    ] } : {}),
    sections: [section([byPage(4), byPage(1)]), section([byPage(2), byPage(3)])],
  });
  return d.Packer.toBlob(doc);
}

const bytes = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0)) as unknown as Buffer;

/**
 * 인쇄 미리보기 → Word 파일. 주보에 쓰인 글자로 Noto Sans KR을 잘라 받아(관리자 전용 API) 파일에 넣는다.
 * 글꼴을 받지 못하면 맑은 고딕으로 열리도록 만들고 폭만 보정한다.
 */
export async function exportWordBulletin(root: HTMLElement, title: string): Promise<{ blob: Blob; embedded: boolean }> {
  const text = [...root.querySelectorAll<HTMLElement>('[data-sheet]')].map(sheet => sheet.innerText).join('') + '0123456789.,·•';
  let fonts: WordFonts | null = null;
  try {
    const token = (await makeBrowserClient()?.auth.getSession())?.data.session?.access_token;
    const response = token ? await fetch('/api/bulletins/word-fonts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) }) : null;
    if (response?.ok) fonts = await response.json() as WordFonts;
  } catch { fonts = null; }
  const panels = measurePanels(root, !!fonts);
  return { blob: await buildDocx(panels, title, fonts), embedded: !!fonts };
}
