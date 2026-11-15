'use client';
import {useRef,useState} from 'react';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {newsGroups,accountBody,isPrayerGuide,newsTitle} from '@/lib/bulletin-editor';
import GrowingTextarea from './growing-textarea';
import css from './news-editor.module.css';

type Props={items:BulletinItem[];onText:(id:string,changes:Partial<Pick<BulletinItem,'title'|'body'|'webVisible'>>)=>void;onContent:(id:string,content:BlockContent,body?:string)=>void;onToggle:(item:BulletinItem)=>void;onOrder:(ids:string[])=>void;onAdd:()=>void;showVisibility:boolean};
export default function NewsEditor({items,onText,onContent,onToggle,onAdd,showVisibility}:Props){
 const dialog=useRef<HTMLDialogElement>(null),back=useRef<HTMLElement|null>(null);
 const [renaming,setRenaming]=useState<BulletinItem|null>(null),[name,setName]=useState('');
 const close=()=>{dialog.current?.close();back.current?.focus();};
 return <div className={css.editor} role="group" aria-label="좋은 소식 내용">{newsGroups(items).map(group=><section key={group.title} className={css.row} aria-label={group.title}>
  <div className={css.name}><span>〈{group.title}〉</span>{group.entries.length===1&&!isPrayerGuide(group.entries[0])?<button type="button" aria-label={`${group.title} 이름 수정`} onClick={e=>{back.current=e.currentTarget;setRenaming(group.entries[0]);setName(newsTitle(group.entries[0].title));dialog.current?.showModal();}}>수정</button>:null}</div>
  <div className={css.content}>{group.title==='헌금'?<><AccountEditor items={group.entries} onText={onText}/>{group.entries.map(item=><div key={item.id} className={css.accountOptions}>{item.content?.disabled?<button type="button" onClick={()=>onToggle(item)}>{item.title} 활성화</button>:null}{showVisibility?<label className={css.visibility}><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>{item.title} 웹에 공개</label>:null}</div>)}</>:group.entries.map(item=><div key={item.id} className={css.part} data-disabled={item.content?.disabled??false}>
   {isPrayerGuide(item)?<PrayerGuide item={item} onContent={onContent}/>:<GrowingTextarea disabled={item.content?.disabled} aria-label={group.title==='기도･안내'?'안내 추가 내용':`${newsTitle(item.title)} 내용`} placeholder="내용" maxLength={20000} value={item.body} onChange={e=>onText(item.id,{body:e.target.value})}/>}
   {!isPrayerGuide(item)?<button type="button" className={css.enable} aria-label={`${newsTitle(item.title)} ${item.content?.disabled?'활성화':'비활성화'}`} aria-pressed={!item.content?.disabled} onClick={()=>onToggle(item)}>{item.content?.disabled?'활성화':'비활성화'}</button>:null}
   {showVisibility?<label className={css.visibility}><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>웹에 공개</label>:null}
  </div>)}</div>
 </section>)}<button className={css.add} type="button" onClick={onAdd}>소식 추가</button>
 <dialog ref={dialog} className={css.dialog} aria-label="소식 항목 수정" onCancel={()=>back.current?.focus()}><h3>항목 수정</h3><label>이름<input maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label><div><button type="button" onClick={close}>취소</button><button type="button" onClick={()=>{if(renaming)onText(renaming.id,{title:`좋은 소식 · ${name}`});close();}}>적용</button></div></dialog>
 </div>;
}
function AccountEditor({items,onText}:{items:BulletinItem[];onText:Props['onText']}){
 const value=items.map(accountBody).filter(Boolean).join('\n');
 return <GrowingTextarea aria-label="헌금 계좌 내용" maxLength={20000} placeholder="온라인 헌금계좌: 농협 …\n온라인 건축헌금: 농협 …" value={value} onChange={e=>{
  // One editor, existing records and their individual visibility are retained.
  const text=e.target.value,split=text.search(/\n(?=온라인\s*건축헌금\s*[:：])/),construction=items.find(item=>/건축/.test(item.title)),general=items.find(item=>!/건축/.test(item.title))??items[0];
  if(split>=0&&construction&&general.id!==construction.id){onText(general.id,{body:text.slice(0,split)});onText(construction.id,{body:text.slice(split+1)});}
  else{onText(general.id,{body:text});for(const item of items)if(item.id!==general.id)onText(item.id,{body:''});}
 }}/>
}
export function PrayerGuide({item,onContent}:{item:BulletinItem;onContent:Props['onContent']}){
 const rows=Array.from({length:Math.max(5,item.content?.rows?.length??0)},(_,i)=>item.content?.rows?.[i]??['','','']);
 function update(index:number,column:number,value:string){onContent(item.id,{...item.content,rows:rows.map((row,i)=>i===index?Array.from({length:3},(_,j)=>j===column?value:row[j]??''):row)});}
 return <div className={css.tableScroll}><table className={css.guide}><tbody>{['날짜','기도','안내'].map((title,column)=><tr key={title}><th scope="row">{title}</th>{rows.map((row,index)=><td key={index}><GrowingTextarea maxLength={500} aria-label={`기도･안내 ${index+1}열 ${title}`} value={row[column]??''} onChange={e=>update(index,column,e.target.value)}/></td>)}</tr>)}</tbody></table>{item.body?<GrowingTextarea aria-label="기도 안내 내용" maxLength={20000} value={item.body} onChange={e=>onContent(item.id,item.content??{},e.target.value)}/>:null}</div>;
}
