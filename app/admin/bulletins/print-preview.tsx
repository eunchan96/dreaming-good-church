"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SavedBulletin } from "@/lib/bulletin-store";
import { BlockPreview } from "./block-fields";
import styles from "./print-preview.module.css";

export default function PrintPreview({ draft, dirty, onClose }: { draft: SavedBulletin; dirty: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]');
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
    try { await Promise.all(images.map(image => image.decode())); await document.fonts.ready; window.print(); }
    catch { setMessage("이미지를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요."); }
  }
  return createPortal(<div ref={root} tabIndex={-1} className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="print-title">
    <header className={styles.controls}><div><h2 id="print-title">관리자 인쇄 미리보기</h2><p>웹 비공개 항목을 포함한 전체 {draft.items.length}개 항목입니다. 공개용 PDF가 아닙니다.</p><p>{dirty ? "저장 전 변경을 포함한 현재 화면을 인쇄합니다." : "현재 주보 내용을 인쇄합니다."} A4 세로 연속형이며 기존 4면 배치는 후속 작업입니다.</p></div><div><button onClick={() => void print()}>인쇄 · PDF로 저장</button><button onClick={onClose}>미리보기 닫기</button></div><p role="status">{message}</p></header>
    <main className={styles.paper}><header><p>꿈꾸는좋은교회 · 관리자용 전체 항목</p><h1>{draft.serviceDate} · {draft.issueNumber}호 주보</h1></header>
      {draft.items.map(item => <section key={item.id} className={styles.item}><p className={styles.scope}>{item.webVisible ? "웹 공개 · 인쇄 포함" : "웹 비공개 · 인쇄 포함"}</p><BlockPreview item={item} editor /></section>)}
      {!draft.items.length ? <p>인쇄할 항목이 없습니다.</p> : null}
    </main>
  </div>, document.body);
}
