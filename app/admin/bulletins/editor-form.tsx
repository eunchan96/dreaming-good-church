'use client';
import type {ReactNode} from 'react';
import {bodyField,displayTitle,managedSchedule,newsTitle,type BulletinSection} from '@/lib/bulletin-editor';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {BlockFields} from './block-fields';
import NewsEditor from './news-editor';
import GrowingTextarea from './growing-textarea';
import ui from '../management.module.css';
import polish from './editor.module.css';
import styles from './workspace.module.css';
import {bulletinSections,sectionFor} from '@/lib/bulletin-editor';

type Props={items:BulletinItem[];groups:Record<string,BulletinSection>;showVisibility:boolean;coverPicker:ReactNode;newsConnections:ReactNode;onText:(id:string,changes:Partial<Pick<BulletinItem,'title'|'body'|'webVisible'>>)=>void;onContent:(id:string,content:BlockContent,body?:string)=>void;onOrderNews:(ids:string[])=>void;onAddNews:()=>void;onRemoveImage:(id:string)=>void};
export default function BulletinForm({items,groups,showVisibility,coverPicker,newsConnections,onText,onContent,onRemoveImage,onOrderNews,onAddNews}:Props){
 return bulletinSections.map((section,index)=>{
  const entries=items.filter(item=>(groups[item.id]??sectionFor(item))===section&&!managedSchedule(item));
  function entry(item:BulletinItem){
   const title=section==='좋은 소식'?newsTitle(item.title):displayTitle(item.title),heading=`item-heading-${item.id}`;
   return <article id={`edit-item-${item.id}`} key={item.id} tabIndex={-1} aria-label={title} className={`${polish.entry} ${item.kind==='image'?polish.imageEntry:''}`}>
    {section==='표지'&&item.kind!=='image'?<div className={polish.coverLines}>{[0,1].map(line=>{const values=item.title.split(/\n|\s*[·ㆍ]\s*/);const first=values[0]??'',second=values.slice(1).join('\n');return <GrowingTextarea key={line} aria-label={line===0?'표지 첫째 줄':'표지 둘째 줄'} value={line===0?first:second} maxLength={99} onChange={e=>onText(item.id,{title:line===0?`${e.target.value}\n${second}`:`${first}\n${e.target.value}`})}/>;})}</div>:<>
     {(title!==section||section==='토라&토브')&&item.kind!=='image'?<h3 id={heading}>{title}</h3>:null}
     {section==='묵상 가이드'?<><label className={polish.labeled}><span>묵상</span><GrowingTextarea aria-label="묵상" value={item.body} maxLength={20000} onChange={e=>onText(item.id,{body:e.target.value})}/></label><label className={`${polish.labeled} ${polish.attribution}`}><span>담당</span><GrowingTextarea aria-label="담당" value={item.content?.attribution??''} maxLength={200} onChange={e=>onContent(item.id,{...item.content,attribution:e.target.value})}/></label></>:section==='토라&토브'?<><label className={polish.labeled}><span>본문</span><GrowingTextarea aria-label={`${title} 본문`} value={item.content?.reference??''} maxLength={500} onChange={e=>onContent(item.id,{preacher:'',...item.content,reference:e.target.value})}/></label><label className={polish.labeled}><span>구절</span><GrowingTextarea aria-label={`${title} 구절`} value={item.body} maxLength={20000} onChange={e=>onText(item.id,{body:e.target.value})}/></label></>:<>
      {bodyField(item)&&item.kind!=='offering'&&!(item.kind==='worship'&&section==='예배 순서')?<div className={polish.contentOnly}><GrowingTextarea aria-label="내용" aria-description={`${title} 내용`} value={item.body} maxLength={20000} placeholder="내용을 입력하세요" onChange={e=>onText(item.id,{body:e.target.value})}/></div>:null}
      <BlockFields item={item} onChange={(content,body)=>onContent(item.id,content,body)}/>
     </>}
    </>}
    {item.kind==='image'?<button className={polish.detach} aria-label={`${item.title} 첨부 해제`} onClick={()=>onRemoveImage(item.id)}>첨부 해제</button>:null}
    {showVisibility?<label className={`${styles.check} ${polish.visibility}`}><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>웹에 공개</label>:null}
   </article>;
  }
  return <section id={`bulletin-section-${index}`} key={section} tabIndex={-1} className={polish.group}>
   <div className={ui.heading}><h2>{section}</h2></div>
   {section==='좋은 소식'?<><NewsEditor items={entries} onContent={onContent} onText={onText} onToggle={item=>onContent(item.id,{...item.content,disabled:!item.content?.disabled})} onOrder={onOrderNews} onAdd={onAddNews} showVisibility={showVisibility}/></>:<>{entries.filter(item=>item.kind!=='image').map(entry)}{section==='표지'?coverPicker:null}{entries.filter(item=>item.kind==='image').map(entry)}</>}
   {section==='좋은 소식'?newsConnections:null}
  </section>;
 });
}
