'use client';
import type {ReactNode} from 'react';
import {bodyField,displayTitle,managedSchedule,newsTitle,type BulletinSection} from '@/lib/bulletin-editor';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {BlockFields} from './block-fields';
import GrowingTextarea from './growing-textarea';
import ui from '../management.module.css';
import polish from './editor.module.css';
import styles from './workspace.module.css';
import {bulletinSections,sectionFor} from '@/lib/bulletin-editor';

type Props={items:BulletinItem[];groups:Record<string,BulletinSection>;showVisibility:boolean;coverPicker:ReactNode;newsConnections:ReactNode;onText:(id:string,changes:Partial<Pick<BulletinItem,'title'|'body'|'webVisible'>>)=>void;onContent:(id:string,content:BlockContent)=>void;onRemoveImage:(id:string)=>void};
export default function BulletinForm({items,groups,showVisibility,coverPicker,newsConnections,onText,onContent,onRemoveImage}:Props){
 return bulletinSections.map((section,index)=>{
  const entries=items.filter(item=>(groups[item.id]??sectionFor(item))===section&&!managedSchedule(item));
  function entry(item:BulletinItem){
   const title=section==='좋은 소식'?newsTitle(item.title):displayTitle(item.title),heading=`item-heading-${item.id}`;
   return <article id={`edit-item-${item.id}`} key={item.id} tabIndex={-1} aria-label={title} className={`${polish.entry} ${item.kind==='image'?polish.imageEntry:''}`}>
    {section==='표지'&&item.kind!=='image'?<div className={`${ui.row} ${polish.row}`}><label htmlFor={`title-${item.id}`}>제목</label><GrowingTextarea id={`title-${item.id}`} aria-label="항목 제목" value={item.title} maxLength={200} onChange={e=>onText(item.id,{title:e.target.value})}/></div>:title!==section&&item.kind!=='image'?<h3 id={heading}>{title}</h3>:null}
    {bodyField(item)?<div className={section==='표지'?`${ui.row} ${polish.row}`:polish.contentOnly}>{section==='표지'?<label htmlFor={`body-${item.id}`}>내용</label>:null}<GrowingTextarea id={`body-${item.id}`} aria-label="내용" aria-description={`${title} 내용`} value={item.body} maxLength={20000} placeholder={section==='표지'?undefined:'내용을 입력하세요'} onChange={e=>onText(item.id,{body:e.target.value})}/></div>:null}
    <BlockFields item={item} onChange={content=>onContent(item.id,content)}/>{item.kind==='image'?<button className={polish.detach} aria-label={`${item.title} 첨부 해제`} onClick={()=>onRemoveImage(item.id)}>첨부 해제</button>:null}
    {showVisibility?<label className={`${styles.check} ${polish.visibility}`}><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>웹에 공개</label>:null}
   </article>;
  }
  return <section id={`bulletin-section-${index}`} key={section} tabIndex={-1} className={polish.group}>
   <div className={ui.heading}><h2>{section}</h2></div>
   {section==='좋은 소식'?<div role="group" aria-label="좋은 소식 내용" className={polish.newsGroup}>{entries.map(entry)}</div>:<>{entries.filter(item=>item.kind!=='image').map(entry)}{section==='표지'?coverPicker:null}{entries.filter(item=>item.kind==='image').map(entry)}</>}
   {section==='좋은 소식'?newsConnections:null}
  </section>;
 });
}
