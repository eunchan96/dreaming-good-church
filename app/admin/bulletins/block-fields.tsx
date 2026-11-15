"use client";

import RowEditor from "./row-editor";
import {displayTitle,sectionFor,isPrayerGuide,offeringRows,offeringSummary} from '@/lib/bulletin-editor';
import { offeringTotal, type BulletinItem, type BlockContent } from "@/lib/bulletins";
import styles from "./workspace.module.css";
import { BulletinImageView } from "@/app/bulletin-image";

export function BlockFields({ item, onChange,previous,volunteerHint,onImported }: { onImported?:()=>void;previous?:BulletinItem;volunteerHint?:string;item: BulletinItem; onChange: (content: BlockContent,body?:string) => void }) {
  const content = item.content ?? {};
  if (item.kind === "image") return <div>{content.assetId ? <BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt ?? ""} editor /> : null}<label>이미지 설명 (대체텍스트)<input required maxLength={500} value={content.alt ?? ""} onChange={e => onChange({ ...content, alt: e.target.value })} /></label></div>;
  if (item.kind === "sermon") return <div className={styles.actions}>
    <label>성경 구절<input maxLength={500} value={content.reference ?? ""} onChange={(e) => onChange({ ...content, reference: e.target.value })} /></label>
    {!/토라|토브/.test(item.title)?<label>설교자<input maxLength={500} value={content.preacher ?? ""} onChange={(e) => onChange({ ...content, preacher: e.target.value })} /></label>:null}
  </div>;
  if (item.kind !== "worship" && item.kind !== "offering") return null;
  return <RowEditor onImported={onImported} item={item} previous={previous} volunteerHint={volunteerHint} onChange={onChange}/>;
}

export function BlockPreview({ item, editor = false, compact=false, hideTitle=false }: { item: Pick<BulletinItem, "title" | "body" | "kind" | "content">; editor?: boolean;compact?:boolean;hideTitle?:boolean }) {
  const content = item.kind==='offering'?offeringRows(item.content??{}):item.content??{};
  const Heading=compact?"h4":"h3";
  const prayerGuide=isPrayerGuide(item);
  const serving=/섬기는 이들/.test(item.title)||item.title==="각종 예배 안내";
  const headers=item.kind==="offering"?["구분","금액(원)"]:serving?(item.title==="각종 예배 안내"?["예배","시간"]:["역할","이름"]):/봉사위원/.test(item.title)?["봉사","이름","날짜"]:/기도\s*인도.*안내/.test(item.title)?["날짜","기도 인도","안내"]:["순서","내용","담당"];
  return <article className={styles.preview}>{hideTitle||item.kind==="image"?null:<Heading style={{whiteSpace:"pre-line"}}>{displayTitle(item.title)}</Heading>}
    {item.kind === "image" && content.assetId ? <BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt ?? ""} editor={editor} /> : null}
    {item.kind === "sermon" ? <p>{[content.reference,content.preacher].filter(Boolean).join(" · ")}</p> : null}
    {prayerGuide?<div style={{overflowX:"auto"}}><table aria-label="기도･안내"><tbody>{["날짜","기도","안내"].map((title,col)=><tr key={title}><th scope="row">{title}</th>{(content.rows??[]).map((row,i)=><td key={i}>{row[col]}</td>)}</tr>)}</tbody></table></div>:item.kind === "worship" || item.kind === "offering" ? <div style={{ overflowX: "auto" }}><table><thead><tr>{headers.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{content.rows?.map((row, i) => <tr key={i}>{content.fullRows?.includes(i)?<td colSpan={headers.length}>{row[0]}</td>:row.slice(0,headers.length).map((cell, j) => <td key={j}>{item.kind === "offering" && j === 1 && cell ? Number(cell).toLocaleString("ko-KR") : cell}</td>)}</tr>)}</tbody></table></div> : null}
    {content.footer?<p>{content.footer}</p>:null}
    {content.attribution?<p>{content.attribution}</p>:null}
    {item.kind === "offering" ? <p>{offeringSummary(content,item.body)}: {offeringTotal(content).toLocaleString("ko-KR")}원</p> : null}
    {item.kind!=="image"&&item.kind!=="offering"&&sectionFor(item)!=="표지"&&item.body?<p>{item.body}</p>:null}
  </article>;
}
