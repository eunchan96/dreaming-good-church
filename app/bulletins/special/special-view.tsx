"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import { Band, ChurchInfo, ScheduleGrid } from "../../admin/bulletins/paper";
import paper from "../../admin/bulletins/paper.module.css";
import type { ProgramBlock, ProgramRow, SpecialProgramContent } from "@/lib/special-programs";
import styles from "./special.module.css";

/** 글 안의 **굵게**만 지원한다(다른 마크업은 글자 그대로 보인다). */
function Rich({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}

/** 주보 순서 줄과 같은 배분 정렬: 글자 사이를 같은 간격으로 벌려 칸 폭에 맞춘다. */
function Spread({ value, className }: { value: string; className: string }) {
  return <span className={`${paper.spread} ${className}`}><span>{value}</span><span className={paper.spreadText} aria-hidden="true">{[...value.replace(/\s+/g, "")].map((c, i) => <span key={i}>{c}</span>)}</span></span>;
}

function Rows({ rows }: { rows: ProgramRow[] }) {
  return <div className={paper.order}>{rows.map((row, i) => <div key={i} className={paper.orderRow} data-order-row>
    <span aria-hidden="true" />
    <Spread value={row.name} className={paper.orderName} />
    <span className={paper.leader}><i />{row.what ? <><span className={paper.orderWhat}>{row.what}</span><i /></> : null}</span>
    <span className={styles.who}><Spread value={row.who} className={paper.orderWho} />{row.org ? <small className={styles.org}>{row.org}</small> : null}</span>
  </div>)}</div>;
}

/** 예배 안내의 좁은 화면 배치: 주일·새벽·금요를 한 칸에, 학생부·월삭을 다른 칸에 모으고 이름은 한 줄로 쓴다. */
function narrowSchedule(columns: [string, string][][]): [string, string][][] {
  const oneLine = (label: string) => label.replace(/\s*\n\s*/g, " ");
  const dawnLast = [...(columns[2] ?? [])].sort((a, b) => Number(/새벽/.test(a[0])) - Number(/새벽/.test(b[0])));
  return [[...(columns[0] ?? []), ...dawnLast], columns[1] ?? []].map(column => column.map(([label, time]) => [oneLine(label), time] as [string, string]));
}

function Block({ block }: { block: ProgramBlock }) {
  switch (block.type) {
    case "title": return <h3 className={paper.orderTitle}><Image className={paper.wing} src="/brand/wing-left.png" width={168} height={116} alt="" unoptimized /><span>{block.text}</span><Image className={paper.wing} src="/brand/wing-right.png" width={168} height={117} alt="" unoptimized /></h3>;
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
    case "schedule": return <section className={paper.block}><Band title={block.title} tone={block.tone} /><ScheduleGrid columns={block.columns} narrow={narrowSchedule(block.columns)} /></section>;
    case "boxes": return <div className={styles.boxes}>{block.boxes.map(box => <section key={box.title} className={paper.block}><Band title={box.title} tone={box.tone} /><div className={`${paper.tinted} ${styles.boxText}`}>{box.text}</div></section>)}</div>;
  }
}

/** plain: 관리자 상세처럼 이미 바깥 틀 안에 놓일 때(자체 카드 테두리·여백을 빼고 그린다). */
export default function SpecialView({ content, label, plain }: { content: SpecialProgramContent; label: string; plain?: boolean }) {
  const { cover, blocks, notice, church } = content;
  return <article className={styles.paper} data-plain={plain || undefined} aria-label={label}>
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
