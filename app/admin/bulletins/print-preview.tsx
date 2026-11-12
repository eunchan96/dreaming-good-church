"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SavedBulletin } from "@/lib/bulletin-store";
import { BlockPreview } from "./block-fields";
import styles from "./print-preview.module.css";

function defaultPage(item: SavedBulletin["items"][number]) {
  if (item.kind === "image") return 1;
  if (item.kind === "sermon" || item.kind === "worship") return 2;
  if (/묵상|기도문|메모|토라|목장/.test(item.title)) return 3;
  return 4;
}
const pageTitles = ["표지", "예배", "묵상과 기도", "교회 소식"];
export default function PrintPreview({ draft, dirty, onClose, pages, onPagesChange }: { draft: SavedBulletin; dirty: boolean; onClose: () => void; pages: Record<string, number>; onPagesChange: (pages: Record<string, number>) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [overflowPages, setOverflowPages] = useState<number[]>([]);
  function checkOverflow() {
    return Array.from(root.current?.querySelectorAll<HTMLElement>('[data-print-panel]') ?? []).filter(node => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1).map(node => Number(node.dataset.printPanel));
  }
  useEffect(() => {
    const check = () => { const next = checkOverflow(); setOverflowPages(current => JSON.stringify(current) === JSON.stringify(next) ? current : next); };
    const observer = new ResizeObserver(check);
    root.current?.querySelectorAll<HTMLElement>('[data-print-panel], [data-print-content]').forEach(node => observer.observe(node));
    let active = true;
    void document.fonts.ready.then(() => { if (active) check(); });
    check();
    return () => { active = false; observer.disconnect(); };
  }, [draft, pages]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  async function print() {
    const images = Array.from(root.current?.querySelectorAll("img") ?? []);
    const expected = draft.items.filter(item => item.kind === "image" && item.content?.assetId).length;
    if (images.length !== expected) { setMessage("이미지를 아직 불러오지 못했습니다. 이미지가 모두 표시된 뒤 다시 눌러 주세요."); return; }
    try { await Promise.all(images.map(image => image.decode())); await document.fonts.ready;
      const overflow = checkOverflow(); setOverflowPages(overflow);
      if (overflow.length) { setMessage(`${overflow.join("·")}면의 내용이 넘칩니다. 면 배치를 바꾸거나 편집 화면에서 내용을 줄여 주세요.`); return; }
      setMessage(""); window.print(); }
    catch { setMessage("이미지를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요."); }
  }
  return createPortal(<div ref={root} tabIndex={-1} className={`${styles.overlay} ${overflowPages.length ? styles.badLayout : ""}`} role="dialog" aria-modal="true" aria-labelledby="print-title">
    <header className={styles.controls}><div><h2 id="print-title">관리자 인쇄 미리보기</h2><p>웹 비공개 항목을 포함한 전체 {draft.items.length}개 항목입니다. 공개용 PDF가 아닙니다.</p><p>{dirty ? "저장 전 변경을 포함한 현재 화면을 인쇄합니다." : "현재 주보 내용을 인쇄합니다."} A4 가로 반접지 · A5 4면. 겉면 4·1 / 안쪽 2·3입니다.</p><p>면 배치 변경은 초안 저장에 포함됩니다. 첫 저장 전에는 편집 화면에서 초안 저장을 눌러 주세요. 게시된 주보의 배치를 바꾸려면 게시를 취소해 주세요. 실제 인쇄는 A4 가로·배율 100%·여백 없음·머리글/바닥글 끔으로 설정하고 양면 방향은 시험 출력으로 확인하세요.</p></div>
    <details><summary>항목별 면 배치</summary>{draft.items.map(item => <label className={styles.assignment} key={item.id}>{item.title || "주보 항목"} · <span>{item.webVisible ? "웹 공개 · 인쇄 포함" : "웹 비공개 · 인쇄 포함"}</span><select disabled={draft.status !== "draft"} aria-label={`${item.title || "주보 항목"} 인쇄 면`} value={pages[item.id] ?? defaultPage(item)} onChange={event => { onPagesChange({ ...pages, [item.id]: Number(event.target.value) }); setMessage(""); }}>{pageTitles.map((title,index) => <option value={index + 1} key={title}>{index + 1}면 · {title}</option>)}</select></label>)}</details>
    <div><button onClick={() => void print()}>인쇄 · PDF로 저장</button><button onClick={onClose}>미리보기 닫기</button></div><p role="status">{overflowPages.length ? `${overflowPages.join("·")}면 넘침: 면 배치를 바꾸거나 내용을 줄여 주세요. 넘친 상태에서는 인쇄하지 않습니다.` : "4면 안에 내용이 들어갑니다."} {message}</p></header>
    <p className={styles.blockedPrint}>내용이 면을 넘쳐 인쇄를 중단했습니다. 미리보기에서 면 배치를 조정한 뒤 다시 인쇄해 주세요.</p>
    <main className={styles.paper}>{[[4,1],[2,3]].map((side,index) => <div className={styles.sheet} key={index} aria-label={index === 0 ? "겉면 4·1" : "안쪽 2·3"}>{side.map(number => <section className={styles.panel} key={number} aria-label={`${number}면`}>
      <header><p>꿈꾸는좋은교회 · {number}면</p><h1>{number === 1 ? `${draft.serviceDate} · ${draft.issueNumber}호 주보` : pageTitles[number - 1]}</h1></header>
      <div className={styles.panelBody} data-print-panel={number}><div data-print-content>{draft.items.filter(item => (pages[item.id] ?? defaultPage(item)) === number).map(item => <section key={item.id} className={styles.item}><BlockPreview item={item} editor /></section>)}</div></div>
    </section>)}</div>)}
    </main>
  </div>, document.body);
}
