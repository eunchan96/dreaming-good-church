"use client";

import { offeringTotal, type BulletinItem, type BlockContent } from "@/lib/bulletins";
import styles from "./workspace.module.css";
import { BulletinImageView } from "@/app/bulletin-image";

export function BlockFields({ item, onChange }: { item: BulletinItem; onChange: (content: BlockContent) => void }) {
  const content = item.content ?? {};
  if (item.kind === "image") return <div>{content.assetId ? <BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt ?? ""} editor /> : null}<label>이미지 설명 (대체텍스트)<input required maxLength={500} value={content.alt ?? ""} onChange={e => onChange({ ...content, alt: e.target.value })} /></label></div>;
  if (item.kind === "sermon") return <div className={styles.actions}>
    <label>성경 구절<input maxLength={500} value={content.reference ?? ""} onChange={(e) => onChange({ ...content, reference: e.target.value })} /></label>
    <label>설교자<input maxLength={500} value={content.preacher ?? ""} onChange={(e) => onChange({ ...content, preacher: e.target.value })} /></label>
  </div>;
  if (item.kind !== "worship" && item.kind !== "offering") return null;
  const rows = content.rows ?? [];
  const labels = item.kind === "worship" ? ["예배 순서", "진행 내용", "담당자"] : ["헌금 구분", "금액"];
  return <div>
    {item.kind === "offering" ? <label>헌금 집계 월<input type="month" value={content.month ?? ""} onChange={(e) => onChange({ ...content, month: e.target.value })} /></label> : null}
    {rows.map((row, index) => <div className={styles.actions} key={index}>
      {labels.map((label, column) => <label key={label}>{label}<input aria-label={`${item.title} ${index + 1}행 ${label}`} maxLength={column === 1 && item.kind === "offering" ? 12 : 500} inputMode={column === 1 && item.kind === "offering" ? "numeric" : "text"} value={row[column] ?? ""} onChange={(event) => {
        const value = event.target.value;
        if (item.kind === "offering" && column === 1 && !/^\d{0,12}$/.test(value)) return;
        onChange({ ...content, rows: rows.map((r, at) => at === index ? r.map((cell, col) => col === column ? value : cell) : r) });
      }} /></label>)}
      <button aria-label={`${item.title} ${index + 1}행 위로`} disabled={index === 0} onClick={() => { const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange({ ...content, rows: next }); }}>행 위로</button>
      <button aria-label={`${item.title} ${index + 1}행 삭제`} onClick={() => onChange({ ...content, rows: rows.filter((_, at) => at !== index) })}>행 삭제</button>
    </div>)}
    <button disabled={rows.length >= 100} onClick={() => onChange({ ...content, rows: [...rows, labels.map(() => "")] })}>{item.title} 행 추가</button>
    {item.kind === "offering" ? <p>합계: {offeringTotal(content).toLocaleString("ko-KR")}원</p> : null}
  </div>;
}

export function BlockPreview({ item, editor = false }: { item: Pick<BulletinItem, "title" | "body" | "kind" | "content">; editor?: boolean }) {
  const content = item.content ?? {};
  return <article className={styles.preview}><h3>{item.title}</h3>
    {item.kind === "image" && content.assetId ? <BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt ?? ""} editor={editor} /> : null}
    {item.kind === "sermon" ? <p>{content.reference} · {content.preacher}</p> : null}
    {item.kind === "offering" ? <p>{content.month} 헌금 내역</p> : null}
    {item.kind === "worship" || item.kind === "offering" ? <div style={{ overflowX: "auto" }}><table><thead><tr>{(item.kind === "worship" ? ["순서", "내용", "담당"] : ["구분", "금액(원)"]).map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{content.rows?.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{item.kind === "offering" && j === 1 && cell ? Number(cell).toLocaleString("ko-KR") : cell}</td>)}</tr>)}</tbody></table></div> : null}
    {item.kind === "offering" ? <p>합계: {offeringTotal(content).toLocaleString("ko-KR")}원</p> : null}
    <p>{item.body}</p>
  </article>;
}
