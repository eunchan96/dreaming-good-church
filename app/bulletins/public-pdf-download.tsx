"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./reader.module.css";
import type { PrintableBulletin } from "./public-print";

// 인쇄용 시트(관리자 인쇄 미리보기와 같은 코드)는 누를 때만 내려받는다.
const PublicPrint = dynamic(() => import("./public-print"), { ssr: false });

/** 주보 맨 아래 작은 글자 링크: 인쇄 미리보기와 같은 모양을 PDF로 저장하는 창을 연다. */
export default function PublicPdfDownload({ bulletin }: { bulletin: PrintableBulletin }) {
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");
  return <div className={styles.pdf}>
    <button type="button" disabled={printing} onClick={() => { setMessage(""); setPrinting(true); }}>{printing ? "PDF 준비 중…" : "PDF로 내려받기"}</button>
    {message ? <span role="status">{message}</span> : null}
    {printing ? <PublicPrint bulletin={bulletin} onDone={() => setPrinting(false)} onError={setMessage} /> : null}
  </div>;
}
