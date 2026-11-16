'use client';
import {useRef,useState} from 'react';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {defaultItem,newsGroups,accountBody,isPrayerGuide,newsCategory} from '@/lib/bulletin-editor';
import GrowingTextarea from './growing-textarea';
import EditableText from './editable-text';
import AdminIcon from '../admin-icons';
import css from './news-editor.module.css';
type Props={items:BulletinItem[];previous?:BulletinItem[];onText:(id:string,changes:Partial<Pick<BulletinItem,'title'|'body'|'webVisible'>>)=>void;onContent:(id:string,content:BlockContent,body?:string)=>void;onToggle:(item:BulletinItem)=>void;onOrder:(ids:string[])=>void;onAdd:()=>void;onRemove:(ids:string[])=>void;onImport:(ids:string[],source:BulletinItem[])=>void;showVisibility:boolean};
export default function NewsEditor({items,previous=[],onText,onContent,onOrder,onAdd,onRemove,onImport,showVisibility}:Props){
 const [originalCategories]=useState(()=>new Map(items.map(item=>[item.id,newsCategory(item)])));
 const groups=newsGroups(items),root=useRef<HTMLDivElement>(null),source=useRef<number|null>(null),target=useRef<number|null>(null),[over,setOver]=useState<number|null>(null),[status,setStatus]=useState('');
 function move(from:number,to:number){if(from===to||to<0||to>=groups.length)return;const ordered=[...groups],[group]=ordered.splice(from,1);ordered.splice(to,0,group);onOrder(ordered.flatMap(group=>group.entries.map(item=>item.id)));setStatus(`${group.title} 소식을 ${to+1}번째로 이동했습니다.`);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-news-row="${group.entries[0].id}"] [data-handle]`)?.focus());}
 function finish(){if(source.current!==null&&target.current!==null)move(source.current,target.current);source.current=null;target.current=null;setOver(null);}
 const nameWidth=Math.max(4,...groups.map(group=>[...group.title].length))+2;
 return <div ref={root} className={css.editor} role="group" aria-label="좋은 소식 내용" style={{["--name-w" as string]:`calc(${nameWidth}em + 30px)`}}>{groups.map((group,index)=>{const ids=group.entries.map(item=>item.id),prior=newsGroups(previous).find(old=>old.title===(originalCategories.get(ids[0])??group.title))?.entries;
 const off=group.entries.every(item=>item.content?.disabled);
 return <section key={ids[0]} data-news-row={ids[0]} data-over={over===index} data-disabled={off} className={css.row} aria-label={group.title}>
  <button type="button" data-handle className={css.handle} aria-label={`${group.title} 이동`} title="드래그하거나 위아래 방향키로 이동" onKeyDown={e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(index,index+(e.key==='ArrowUp'?-1:1));}}} onPointerDown={e=>{if(e.button!==0)return;source.current=index;target.current=index;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(source.current===null)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-news-row]');if(row&&root.current?.contains(row)){target.current=groups.findIndex(g=>g.entries[0].id===row.dataset.newsRow);setOver(target.current);}}} onPointerUp={finish} onPointerCancel={()=>{source.current=null;target.current=null;setOver(null);}}><AdminIcon name="grip" size={16}/></button>
  <div className={css.name}><EditableText brackets value={group.title} label={`${group.title} 이름 수정`} maxLength={160} onChange={value=>group.entries.forEach(item=>onText(item.id,{title:`좋은 소식 · ${value}`}))}/></div>
  <div className={css.content}>{group.entries.filter(isPrayerGuide).map(item=><PrayerGuide key={item.id} item={item} onContent={onContent}/>)}<TextGroup title={group.title} items={group.entries.filter(item=>!isPrayerGuide(item))} onText={onText}/>
   {group.entries.map(item=><div key={item.id} className={css.options}>{showVisibility?<label><input type="checkbox" checked={item.webVisible} onChange={e=>onText(item.id,{webVisible:e.target.checked})}/>{group.title} 웹에 공개</label>:null}</div>)}
  </div><div className={css.tools}><button type="button" className={css.mobileMove} aria-label={`${group.title} 위로`} title="위로" disabled={index===0} onClick={()=>move(index,index-1)}><AdminIcon name="up"/></button><button type="button" className={css.mobileMove} aria-label={`${group.title} 아래로`} title="아래로" disabled={index===groups.length-1} onClick={()=>move(index,index+1)}><AdminIcon name="down"/></button>{prior?<button type="button" aria-label={`${group.title} 지난 주 가져오기`} title="지난 주 가져오기" onClick={()=>onImport(ids,prior)}><AdminIcon name="undo"/></button>:null}<button type="button" aria-label={`${group.title} ${off?'활성화':'비활성화'}`} title={off?'활성화':'비활성화'} onClick={()=>{group.entries.forEach(item=>onContent(item.id,{...item.content,disabled:!off}));}}><AdminIcon name={off?'on':'off'}/></button>{group.entries.every(defaultItem)?null:<button type="button" aria-label={`${group.title} 삭제`} title="소식 삭제" onClick={()=>onRemove(ids)}><AdminIcon name="remove"/></button>}</div>
 </section>;
 })}<div className={css.addRow}><button className={css.add} type="button" onClick={onAdd}><AdminIcon name="plus" size={14}/>소식 추가</button></div><span className={css.srOnly} aria-live="polite">{status}</span></div>;
}
function TextGroup({title,items,onText}:{title:string;items:BulletinItem[];onText:Props['onText']}){
 // Separate audiences remain separate: combining public and private text must not publish it.
 const partitions=new Map<string,BulletinItem[]>();for(const item of items){const key=String(item.webVisible)+':'+String(!!item.content?.disabled);partitions.set(key,[...(partitions.get(key)??[]),item]);}
 return [...partitions].map(([key,entries])=><div key={key} className={css.textPart} data-disabled={!!entries[0].content?.disabled}>{partitions.size>1?<small>{entries[0].webVisible?'웹 공개':'웹 비공개'}{entries[0].content?.disabled?' · 비활성':''}</small>:null}<GrowingTextarea disabled={entries[0].content?.disabled} aria-label={title==='기도･안내'?'안내 추가 내용':title==='헌금'?'헌금 계좌 내용':`${title} 내용`} maxLength={20000} placeholder="내용" value={entries.map(item=>newsCategory(item)==='헌금'?accountBody(item):item.body).filter(Boolean).join('\n')} onChange={e=>{onText(entries[0].id,{body:e.target.value});entries.slice(1).forEach(item=>onText(item.id,{body:''}));}}/></div>);
}
export function PrayerGuide({item,onContent}:{item:BulletinItem;onContent:Props['onContent']}){
 const rows=Array.from({length:Math.max(5,item.content?.rows?.length??0)},(_,i)=>item.content?.rows?.[i]??['','','']);
 function update(index:number,column:number,value:string){onContent(item.id,{...item.content,rows:rows.map((row,i)=>i===index?Array.from({length:3},(_,j)=>j===column?value:row[j]??''):row)});}
 return <div className={css.tableWrap}><table className={css.guide} aria-label="기도･안내"><tbody>{['날짜','기도','안내'].map((title,column)=><tr key={title}><th scope="row">{title}</th>{rows.map((row,index)=><td key={index}><GrowingTextarea maxLength={500} aria-label={`기도･안내 ${index+1}열 ${title}`} value={row[column]??''} onChange={e=>update(index,column,e.target.value)}/></td>)}</tr>)}</tbody></table>{item.body?<GrowingTextarea aria-label="기도 안내 내용" maxLength={20000} value={item.body} onChange={e=>onContent(item.id,item.content??{},e.target.value)}/>:null}</div>;
}
