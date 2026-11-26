"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import { Band, ChurchInfo } from "../../admin/bulletins/paper";
import paper from "../../admin/bulletins/paper.module.css";
import type { ProgramBlock, ProgramRow, SpecialProgramContent } from "@/lib/special-programs";
import styles from "./special.module.css";

/** 글 안의 **굵게**만 지원한다(다른 마크업은 글자 그대로 보인다). */
function Rich({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}

function Rows({ rows }: { rows: ProgramRow[] }) {
  return <div className={paper.order}>{rows.map((row, i) => <div key={i} className={paper.orderRow} data-order-row>
    <span aria-hidden="true" />
    <span className={paper.orderName} style={{ fontWeight: 600 }}>{row.name}</span>
    <span className={paper.leader}><i />{row.what ? <><span className={paper.orderWhat}>{row.what}</span><i /></> : null}</span>
    <span className={paper.orderWho}>{row.who}{row.org ? <small className={styles.org}>{row.org}</small> : null}</span>
  </div>)}</div>;
}

function Block({ block }: { block: ProgramBlock }) {
  switch (block.type) {
    case "title": return <h2 className={styles.title}>{block.text}</h2>;
    case "band": return <><Band title={block.title} tone={block.tone} />{block.lead ? <p className={styles.lead}>인도 <span>{block.lead}</span></p> : null}</>;
    case "table": return <section className={paper.block}><Band title={block.title} tone={block.tone} /><div className={paper.tinted}><table className={paper.table}><tbody>
      {block.rows.map(([label, value]) => <tr key={label}><td className={styles.tableLabel}>{label}</td><td>{value}</td></tr>)}
    </tbody></table></div></section>;
    case "rows": return <Rows rows={block.rows} />;
    case "note": return <div className={`${paper.tinted} ${styles.note}`}>{block.parts.map((part, i) => <div key={i}>
      <h3>{part.heading}</h3>
      {part.list ? <ol>{part.list.map((line, j) => <li key={j}>{line}</li>)}</ol> : null}
      {part.text ? <p><Rich text={part.text} /></p> : null}
    </div>)}</div>;
    case "schedule": return <section className={paper.block}><Band title={block.title} tone={block.tone} /><div className={styles.schedule}>
      {block.columns.map((column, i) => <div key={i}>{column.map(([label, time]) => <p key={label}><span>{label}</span><strong>{time}</strong></p>)}</div>)}
    </div></section>;
    case "boxes": return <div className={styles.boxes}>{block.boxes.map(box => <section key={box.title} className={paper.block}><Band title={box.title} tone={box.tone} /><div className={`${paper.tinted} ${styles.boxText}`}>{box.text}</div></section>)}</div>;
  }
}

export default function SpecialView({ content, label }: { content: SpecialProgramContent; label: string }) {
  const { cover, blocks, notice, church } = content;
  return <article className={styles.paper} aria-label={label}>
    <div className={paper.flow} data-theme="classic">
      <header className={styles.cover}>
        <p className={styles.when}>{cover.date}<br />{cover.time}</p>
        <p className={styles.kicker}>{cover.kicker}</p>
        <h2 className={styles.coverTitle}>{cover.title}</h2>
        {cover.poster ? <Image className={styles.poster} src={cover.poster.src} width={cover.poster.width} height={cover.poster.height} alt={cover.poster.alt} unoptimized priority /> : null}
      </header>
      <div className={styles.blocks}>{blocks.map((block, i) => <Block key={i} block={block} />)}</div>
      {notice ? <section className={`${paper.block} ${styles.notice}`}><Band title={notice.title} tone={notice.tone} /><div className={styles.noticeBody}>{notice.body.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}</div></section> : null}
      {church ? <ChurchInfo name={church.name} address={church.address} phone={church.phone} /> : null}
    </div>
  </article>;
}
