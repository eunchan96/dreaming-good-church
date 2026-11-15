'use client';
import {useRef,useState} from 'react';
import type {BulletinItem} from '@/lib/bulletins';
import {newsTitle} from '@/lib/bulletin-editor';
import GrowingTextarea from './growing-textarea';
import css from './news-editor.module.css';
type Props={items:BulletinItem[];onText:(id:string,changes:Partial<Pick<BulletinItem,'title'|'body'|'webVisible'>>)=>void;onToggle:(item:BulletinItem)=>void;onOrder:(ids:string[])=>void;onAdd:()=>void;showVisibility:boolean};
export default function NewsEditor({items,onText,onToggle,onOrder,onAdd,showVisibility}:Props){
 const root=useRef<HTMLDivElement>(null),from=useRef<number|null>(null),to=useRef<number|null>(null);const [over,setOver]=useState<number|null>(null),[status,setStatus]=useState('');
 function move(start:number,end:number){if(start===end||end<0||end>=items.length)return;const ids=items.map(item=>item.id),[id]=ids.splice(start,1);ids.splice(end,0,id);onOrder(ids);setStatus(`${start+1}번 소식을 ${end+1}번으로 이동했습니다.`);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-news-row="${id}"] [data-handle]`)?.focus());}
 return <div ref={root} className={css.editor} role="group" aria-label="좋은 소식 내용">{items.map((item,index)=><div key={item.id} data-news-row={item.id} data-disabled={item.content?.disabled??false} data-over={over===index} className={css.row}>
  <button type="button" data-handle className={css.handle} aria-label={`소식 ${index+1} 이동`} title="드래그하거나 위아래 방향키로 이동" onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();move(index,index+(e.key==='ArrowUp'?-1:1));}}} onPointerDown={e=>{if(e.button!==0)return;from.current=index;to.current=index;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(from.current===null)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-news-row]');if(row&&root.current?.contains(row)){to.current=items.findIndex(item=>item.id===row.dataset.newsRow);setOver(to.current);}}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(from.current!==null&&to.current!==null)move(from.current,to.current);from.current=null;to.current=null;setOver(null);}} onPointerCancel={()=>{from.current=null;to.current=null;setOver(null);}}>≡</button>
  <span className={css.number}>{index+1}</span><div className={css.name}><span aria-hidden="true">〈</span><GrowingTextarea disabled={item.content?.disabled} value={newsTitle(item.title)==='좋은 소식'?'':newsTitle(item.title)} aria-label={`소식 ${index+1} 제목`} placeholder="제목" maxLength={180} onChange={e=>onText(item.id,{title:`좋은 소식 · ${e.target.value}`})}/><span aria-hidden="true">〉</span></div>
  <GrowingTextarea className={css.body} disabled={item.content?.disabled} aria-label={`소식 ${index+1} 내용`} placeholder="내용" maxLength={20000} value={item.body} onChange={e=>onText(item.id,{body:e.target.value})}/>
  <button type="button" className={css.enable} aria-label={`소식 ${index+1} ${item.content?.disabled?'활성화':'비활성화'}`} aria-pressed={!item.content?.disabled} onClick={()=>onToggle(item)}>{item.content?.disabled?'활성화':'비활성화'}</button>
  {showVisibility?<label className={css.visibility}><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>웹에 공개</label>:null}
 </div>)}<button className={css.add} type="button" onClick={onAdd}>소식 추가</button><span className={css.srOnly} aria-live="polite">{status}</span></div>;
}
