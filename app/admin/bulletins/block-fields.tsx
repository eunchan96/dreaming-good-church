"use client";

import {useRef,useState} from "react";
import rowStyle from "./structured-rows.module.css";
import {DatePicker} from "../calendar";
import { offeringTotal, type BulletinItem, type BlockContent } from "@/lib/bulletins";
import styles from "./workspace.module.css";
import SiteIcon from '@/app/site-icon';
import { BulletinImageView } from "@/app/bulletin-image";

export function BlockFields({ item, onChange }: { item: BulletinItem; onChange: (content: BlockContent) => void }) {
  const content = item.content ?? {};
  if (item.kind === "image") return <div>{content.assetId ? <BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt ?? ""} editor /> : null}<label>이미지 설명 (대체텍스트)<input required maxLength={500} value={content.alt ?? ""} onChange={e => onChange({ ...content, alt: e.target.value })} /></label></div>;
  if (item.kind === "sermon") return <div className={styles.actions}>
    <label>성경 구절<input maxLength={500} value={content.reference ?? ""} onChange={(e) => onChange({ ...content, reference: e.target.value })} /></label>
    <label>설교자<input maxLength={500} value={content.preacher ?? ""} onChange={(e) => onChange({ ...content, preacher: e.target.value })} /></label>
  </div>;
  if (item.kind !== "worship" && item.kind !== "offering") return null;
  return <StructuredRows item={item} onChange={onChange}/>;
}
function StructuredRows({item,onChange}:{item:BulletinItem;onChange:(content:BlockContent)=>void}) {
  const content=item.content??{},rows=content.rows??[];
  const labels=item.kind==='worship'?['예배 순서','진행 내용','담당자']:['헌금 구분','금액'];
  const root=useRef<HTMLDivElement>(null),source=useRef<number|null>(null),destination=useRef<number|null>(null);
  const [over,setOver]=useState<number|null>(null),[announcement,setAnnouncement]=useState('');
  function move(from:number,to:number){
    if(from===to||to<0||to>=rows.length)return;
    const next=rows.map(row=>[...row]);const [row]=next.splice(from,1);next.splice(to,0,row);
    onChange({...content,rows:next});setAnnouncement(`${from+1}행을 ${to+1}행으로 이동했습니다.`);
    requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-row="${to}"] [data-handle]`)?.focus());
  }
  function finish(){if(source.current!==null&&destination.current!==null)move(source.current,destination.current);source.current=null;destination.current=null;setOver(null);}
  return <div ref={root} className={rowStyle.editor}>
    {item.kind==='offering'?<label className={rowStyle.month}>집계 월<DatePicker label="헌금 집계 월" value={content.month?`${content.month}-01`:''} onChange={value=>onChange({...content,month:value.slice(0,7)})}/></label>:null}
    {rows.map((row,index)=><div data-row={index} data-over={over===index} className={rowStyle.row} data-kind={item.kind} key={index}>
      <button type="button" data-handle className={rowStyle.handle} aria-label={`${item.title} ${index+1}행 이동`} title="드래그하거나 위아래 방향키로 이동" onKeyDown={e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();move(index,index+(e.key==='ArrowUp'?-1:1));}}
        onPointerDown={e=>{if(e.button!==0)return;source.current=index;destination.current=index;e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(source.current===null)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-row]');if(!target||!root.current?.contains(target))return;destination.current=Number(target.dataset.row);setOver(destination.current);}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);finish();}}
        onPointerCancel={()=>{source.current=null;destination.current=null;setOver(null);}}>≡</button>
      {labels.map((label,column)=><input key={label} aria-label={`${item.title} ${index+1}행 ${label}`} placeholder={label} maxLength={column===1&&item.kind==='offering'?12:500} inputMode={column===1&&item.kind==='offering'?'numeric':'text'} value={row[column]??''} onChange={e=>{
        const value=e.target.value;if(item.kind==='offering'&&column===1&&!/^\d{0,12}$/.test(value))return;
        onChange({...content,rows:rows.map((r,at)=>at===index?labels.map((_,col)=>col===column?value:r[col]??''):r)});
      }}/>)}
      <button type="button" className={rowStyle.remove} aria-label={`${item.title} ${index+1}행 삭제`} onClick={()=>onChange({...content,rows:rows.filter((_,at)=>at!==index)})}><SiteIcon name="close"/></button>
    </div>)}
    <button type="button" className={rowStyle.add} aria-label={`${item.title} 행 추가`} disabled={rows.length>=100} onClick={()=>onChange({...content,rows:[...rows,labels.map(()=>'')]})}>+ 추가</button>
    {item.kind==='offering'?<p className={rowStyle.total}>합계 {offeringTotal(content).toLocaleString('ko-KR')}원</p>:null}
    <span className={rowStyle.srOnly} aria-live="polite">{announcement}</span>
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
