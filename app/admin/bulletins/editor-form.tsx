'use client';
import {shortDate} from '@/lib/bulletin-defaults.mjs';
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

type Props={previous?:{serviceDate:string;items:BulletinItem[]};onRemove:(ids:string[])=>void;onImport:(ids:string[],source:BulletinItem[])=>void;items:BulletinItem[];groups:Record<string,BulletinSection>;showVisibility:boolean;coverImages:(images:BulletinItem[])=>ReactNode;newsConnections:ReactNode;onText:(id:string,changes:Partial<Pick<BulletinItem,'title'|'body'|'webVisible'>>)=>void;onContent:(id:string,content:BlockContent,body?:string)=>void;onOrderNews:(ids:string[])=>void;onAddNews:()=>void;};
export default function BulletinForm({items,previous,onRemove,onImport,groups,showVisibility,coverImages,newsConnections,onText,onContent,onOrderNews,onAddNews}:Props){
 return bulletinSections.map((section,index)=>{
  const entries=items.filter(item=>(groups[item.id]??sectionFor(item))===section&&!managedSchedule(item));
  function entry(item:BulletinItem){
   const title=section==='좋은 소식'?newsTitle(item.title):displayTitle(item.title),heading=`item-heading-${item.id}`;
   const prev=previous?.items.find(old=>old.title===item.title)??previous?.items.find(old=>old.kind===item.kind&&sectionFor(old)===section);
   const cleaning=previous?.items.find(old=>/봉사위원/.test(old.title))?.content?.rows?.find(row=>/교회\s*청소/.test(row[0]));
   const hint=previous&&cleaning?.[1]?`${shortDate(previous.serviceDate)}(지난주)은 ${cleaning[1]}였어요`:undefined;
   return <article id={`edit-item-${item.id}`} key={item.id} tabIndex={-1} aria-label={title} className={`${polish.entry} ${item.kind==='image'?polish.imageEntry:''}`}>{item.kind!=='worship'&&item.kind!=='offering'?<div className={polish.entryTools}>{prev?<button type="button" aria-label={`${title} 지난 주 가져오기`} title="지난 주 가져오기" onClick={()=>onImport([item.id],[prev])}>↶</button>:null}<button type="button" aria-label={`${title} 삭제`} title="항목 삭제" onClick={()=>onRemove([item.id])}>×</button></div>:null}
    {section==='표지'&&item.kind!=='image'?<div className={polish.coverLines}>{[0,1].map(line=>{const values=item.title.split(/\n|\s*[·ㆍ]\s*/);const first=values[0]??'',second=values.slice(1).join('\n');return <GrowingTextarea key={line} aria-label={line===0?'표지 첫째 줄':'표지 둘째 줄'} value={line===0?first:second} maxLength={99} onChange={e=>onText(item.id,{title:line===0?`${e.target.value}\n${second}`:`${first}\n${e.target.value}`})}/>;})}</div>:<>
     {(title!==section||section==='토라&토브')&&item.kind!=='image'?<h3 id={heading}>{title}</h3>:null}
     {section==='묵상 가이드'?<><label className={polish.labeled}><span>묵상</span><GrowingTextarea aria-label="묵상" value={item.body} maxLength={20000} onChange={e=>onText(item.id,{body:e.target.value})}/></label><label className={`${polish.labeled} ${polish.attribution}`}><span>담당</span><GrowingTextarea aria-label="담당" value={item.content?.attribution??''} maxLength={200} onChange={e=>onContent(item.id,{...item.content,attribution:e.target.value})}/></label></>:section==='토라&토브'?<><label className={polish.labeled}><span>본문</span><GrowingTextarea aria-label={`${title} 본문`} value={item.content?.reference??''} maxLength={500} onChange={e=>onContent(item.id,{preacher:'',...item.content,reference:e.target.value})}/></label><label className={polish.labeled}><span>구절</span><GrowingTextarea aria-label={`${title} 구절`} value={item.body} maxLength={20000} onChange={e=>onText(item.id,{body:e.target.value})}/></label></>:<>
      {bodyField(item)&&item.kind!=='offering'&&!(item.kind==='worship'&&section==='예배 순서')?<div className={polish.contentOnly}><GrowingTextarea aria-label="내용" aria-description={`${title} 내용`} value={item.body} maxLength={20000} placeholder="내용을 입력하세요" onChange={e=>onText(item.id,{body:e.target.value})}/></div>:null}
      <BlockFields onImported={()=>{if(prev&&!prev.webVisible)onText(item.id,{webVisible:false});}} previous={prev} volunteerHint={hint} item={item} onChange={(content,body)=>onContent(item.id,content,body)}/>
     </>}
    </>}
    {showVisibility?<label className={`${styles.check} ${polish.visibility}`}><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>웹에 공개</label>:null}
   </article>;
  }
  return <section id={`bulletin-section-${index}`} key={section} tabIndex={-1} className={polish.group}>
   <div className={ui.heading}><h2>{section}</h2>{section==='헌금 내역'&&entries.length?<button type="button" className={polish.useToggle} aria-pressed={!entries.every(item=>item.content?.disabled)} onClick={()=>{const disabled=!entries.every(item=>item.content?.disabled);entries.forEach(item=>onContent(item.id,{...item.content,disabled}));}}>{entries.every(item=>item.content?.disabled)?"활성화":"비활성화"}</button>:null}</div>
   {section==='헌금 내역'&&entries.every(item=>item.content?.disabled)?null:section==='좋은 소식'?<><NewsEditor onRemove={onRemove} onImport={onImport} previous={previous?.items.filter(item=>sectionFor(item)==='좋은 소식')} items={entries} onContent={onContent} onText={onText} onToggle={item=>onContent(item.id,{...item.content,disabled:!item.content?.disabled})} onOrder={onOrderNews} onAdd={onAddNews} showVisibility={showVisibility}/></>:<>{entries.filter(item=>item.kind!=='image').map(entry)}{section==='표지'?coverImages(entries.filter(item=>item.kind==='image')):null}</>}
   {section==='좋은 소식'?newsConnections:null}
  </section>;
 });
}
