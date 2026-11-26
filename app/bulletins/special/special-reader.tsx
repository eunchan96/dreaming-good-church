"use client";
import { useState } from "react";
import type { SpecialProgramContent } from "@/lib/special-programs";
import SpecialView from "./special-view";
import styles from "./special.module.css";

type Mode = "web" | "print";

/** 웹 미리보기(주보와 같은 모양)와 인쇄 미리보기(올려 둔 PDF)를 바꿔 보는 순서지 화면. */
export default function SpecialReader({ slug, title, content, hasPdf }: { slug: string; title: string; content: SpecialProgramContent; hasPdf: boolean }) {
  const [mode, setMode] = useState<Mode>("web");
  const pdf = `/api/special-programs/pdf?slug=${encodeURIComponent(slug)}`;
  return <>
    {hasPdf ? <div className={styles.tabs} role="group" aria-label="보기 전환">
      <button type="button" aria-pressed={mode === "web"} onClick={() => setMode("web")}>웹 미리보기</button>
      <button type="button" aria-pressed={mode === "print"} onClick={() => setMode("print")}>인쇄 미리보기</button>
    </div> : null}
    {mode === "web" || !hasPdf
      ? <SpecialView content={content} label={title} />
      : <section className={styles.print} aria-label="인쇄 미리보기">
        <iframe className={styles.frame} title={`${title} 인쇄용 PDF`} src={pdf} />
        <p className={styles.printNote}>일부 휴대폰에서는 위에 첫 쪽만 보일 수 있어요. 전체는 PDF로 내려받아 확인해 주세요.</p>
        <a className={styles.download} href={`${pdf}&download=1`}>PDF로 내려받기</a>
      </section>}
  </>;
}
