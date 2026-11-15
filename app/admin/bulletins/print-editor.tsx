'use client';
import {createContext,useContext,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import type {BulletinItem} from '@/lib/bulletins';
import {offeringTotal} from '@/lib/bulletins';
import {sectionFor,displayTitle,isPrayerGuide,isNewsItem,newsGroups,accountBody,worshipRows,offeringRows,offeringSummary,managedSchedule,bodyField,emptyNews} from '@/lib/bulletin-editor';
import {BulletinImageView} from '@/app/bulletin-image';
import css from './print-preview.module.css';

type FontStyle={size?:number;bold?:boolean;color?:string;align?:'left'|'center'|'right'};
const colors=['#342b25','#866738','#9b3434','#365a4a'];
const sizes=[8,8.5,9,10,11,12,14,16,18,22,26];
type Selection={id:string;label:string};
type Context={formats:Record<string,FontStyle>;select:(value:Selection)=>void;editable:boolean;replace:(item:BulletinItem)=>void;toolbar?:ReactNode};
const PrintContext=createContext<Context>({formats:{},select:()=>{},editable:false,replace:()=>{}});
function loadFormats(key:string):Record<string,FontStyle>{
 try{const raw=JSON.parse(localStorage.getItem(key)??'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};return Object.fromEntries(Object.entries(raw).slice(0,3000).map(([id,value])=>{const v=value as FontStyle;return [id,{...(sizes.includes(v?.size??0)?{size:v.size}:{}),...(typeof v?.bold==='boolean'?{bold:v.bold}:{}),...(colors.includes(v?.color??'')?{color:v.color}:{}),...(['left','center','right'].includes(v?.align??'')?{align:v.align}:{})}];}));}catch{return {};}
}
export function PrintEditorProvider({bulletinId,editable,onReplace,children}:{bulletinId:string;editable:boolean;onReplace:(item:BulletinItem)=>void;children:ReactNode}){
 const key=`church-bulletin-print-v1:${bulletinId}`;
 const [formats,setFormats]=useState(()=>loadFormats(key)),[selected,setSelected]=useState<Selection|null>(null),[notice,setNotice]=useState('');
 const current=selected?formats[selected.id]??{}:{};
 function format(changes:FontStyle){if(!selected)return;const next={...formats,[selected.id]:{...current,...changes}};setFormats(next);try{localStorage.setItem(key,JSON.stringify(next));setNotice('');}catch{setNotice('서식을 보관하지 못했습니다. 현재 미리보기에는 적용됩니다.');}}
 function reset(){if(!selected)return;const next={...formats};delete next[selected.id];setFormats(next);try{localStorage.setItem(key,JSON.stringify(next));setNotice('');}catch{setNotice('서식을 보관하지 못했습니다.');}}
 const toolbar=<div className={css.formatBar} role="group" aria-label="인쇄 서식 도구"><span className={css.selection}>{selected?.label??'서식을 바꿀 문단이나 칸을 클릭하세요'}</span><label>크기<select aria-label="인쇄 글자 크기" disabled={!selected} value={current.size??''} onChange={e=>format({size:Number(e.target.value)})}><option value="" disabled>기본</option>{sizes.map(size=><option value={size} key={size}>{size}pt</option>)}</select></label><button type="button" aria-label="굵게" aria-pressed={current.bold??false} disabled={!selected} onClick={()=>format({bold:!current.bold})}><b>가</b></button><label>색상<select aria-label="인쇄 글자 색상" disabled={!selected} value={current.color??'#342b25'} onChange={e=>format({color:e.target.value})}>{['먹색','갈색','벽돌색','녹색'].map((label,i)=><option key={label} value={colors[i]}>{label}</option>)}</select></label><label>정렬<select aria-label="인쇄 문단 정렬" disabled={!selected} value={current.align??'left'} onChange={e=>format({align:e.target.value as FontStyle['align']})}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label><button type="button" disabled={!selected} onClick={reset}>서식 초기화</button><small>서식은 이 브라우저에 저장됩니다</small>{notice?<p role="status">{notice}</p>:null}</div>;
 return <PrintContext value={{formats,select:setSelected,editable,replace:onReplace,toolbar}}>{children}</PrintContext>;
}
export function PrintFormatToolbar(){return useContext(PrintContext).toolbar;}
function PrintText({id,label,value,onChange,maxLength=20000,className,numeric=false}:{id:string;label:string;value:string;onChange?:(value:string)=>void;maxLength?:number;className?:string;numeric?:boolean}){
 const {formats,select,editable}=useContext(PrintContext),ref=useRef<HTMLDivElement>(null),style=formats[id]??{};
 const canEdit=editable&&!!onChange;
 useLayoutEffect(()=>{if(ref.current&&ref.current.innerText.replace(/\r/g,'')!==value)ref.current.innerText=value;},[value]);
 const cssStyle:CSSProperties={...(style.size?{fontSize:`${style.size}pt`}:{}),...(style.bold!==undefined?{fontWeight:style.bold?700:400}:{}),color:style.color,textAlign:style.align};
 function changed(){if(!ref.current)return;let text=ref.current.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ');if(numeric&&!/^\d{0,12}$/.test(text.replace(/[,원\s]/g,''))){ref.current.innerText=value;return;}if(text.length>maxLength){text=text.slice(0,maxLength);ref.current.innerText=text;}if(text!==value)onChange?.(text);}
 return <div ref={ref} className={`${css.printText} ${className??''}`} style={cssStyle} tabIndex={0} role="textbox" aria-readonly={!canEdit} aria-label={label} aria-multiline="true" data-print-field={id} data-empty={!value} contentEditable={canEdit?'plaintext-only':false} suppressContentEditableWarning onFocus={()=>select({id,label})} onClick={()=>select({id,label})} onInput={changed} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase()))e.preventDefault();}} onPaste={e=>{if(!canEdit)return;e.preventDefault();const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!ref.current?.contains(range.commonAncestorContainer))return;range.deleteContents();const text=document.createTextNode(e.clipboardData.getData('text/plain'));range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);changed();}}/>;
}
export function PrintBlocks({items}:{items:BulletinItem[]}){
 const visible=items.filter(item=>!item.content?.disabled&&!emptyNews(item)),news=visible.filter(isNewsItem),support=visible.filter(item=>sectionFor(item)==='예배 안내'&&item.kind==='worship');
 return <>{visible.map(item=>isNewsItem(item)?item.id===news[0]?.id?<section key="news" className={css.printNews}><h3>좋은 소식</h3>{newsGroups(news).map(group=><section className={css.printNewsRow} key={group.title}><h4>〈{group.title}〉</h4><div>{group.entries.map(entry=><PrintBlock item={entry} hideTitle key={entry.id} account={group.title==='헌금'}/>)}</div></section>)}</section>:null:support.some(entry=>entry.id===item.id)?item.id===support[0]?.id?<div className={css.printColumns} key="support">{support.map(entry=><PrintBlock item={entry} key={entry.id}/>)}</div>:null:<PrintBlock item={item} key={item.id}/>)}</>;
}
function PrintBlock({item,hideTitle=false,account=false}:{item:BulletinItem;hideTitle?:boolean;account?:boolean}){
 const context=useContext(PrintContext),{replace}=context,section=sectionFor(item),order=item.kind==='worship'&&section==='예배 순서',prayer=isPrayerGuide(item);
 const content=order?worshipRows(item):item.kind==='offering'?offeringRows(item.content??{}):item.content??{};
 function setText(field:'title'|'body',value:string){replace({...item,[field]:value,needsReview:false});}
 function setContent(field:'reference'|'attribution'|'footer',value:string){replace({...item,content:{...content,[field]:value},...(order?{body:''}:{}),needsReview:false});}
 function cell(row:number,col:number,value:string){replace({...item,content:{...content,rows:(content.rows??[]).map((r,i)=>i===row?r.map((v,j)=>j===col?value:v):r)},...(order?{body:''}:{}),needsReview:false});}
 const title=<PrintText id={`${item.id}:title`} label={`${displayTitle(item.title)} 제목`} value={displayTitle(item.title)} maxLength={200} onChange={value=>setText('title',value)}/>;
 const rows=(content.rows??[]).map((row,i)=>({row,i})).filter(({i})=>!content.disabledRows?.includes(i));
 return <PrintContext value={{...context,editable:context.editable&&!managedSchedule(item)}}><article className={`${css.printBlock} ${section==='표지'?css.printCover:''}`} data-print-item={item.id}>
  {!hideTitle&&item.kind!=='image'?<h3>{title}</h3>:null}
  {item.kind==='image'&&content.assetId?<BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt??''} editor/>:null}
  {item.kind==='sermon'?<div className={css.reference}><PrintText id={`${item.id}:reference`} label={`${displayTitle(item.title)} 본문`} value={content.reference??''} onChange={value=>setContent('reference',value)} maxLength={500}/></div>:null}
  {item.kind==='offering'?<div className={css.offeringColumns} data-split={rows.some(({row})=>/온라인/.test(row[0]))&&rows.some(({row})=>!/온라인/.test(row[0]))}>{[rows.filter(({row})=>/온라인/.test(row[0])),rows.filter(({row})=>!/온라인/.test(row[0]))].filter(column=>column.length).map((column,index)=><table key={index}>{rows.some(({row})=>/온라인/.test(row[0]))?<caption>{/온라인/.test(column[0].row[0])?"온라인 헌금":"현장 헌금"}</caption>:null}<tbody>{column.map(({row,i})=><tr key={i}>{row.slice(0,2).map((value,col)=><td key={col}><PrintText id={`${item.id}:row:${i}:${col}`} label={`${item.title} ${i+1}행 ${col+1}열`} value={col===1?Number(value||0).toLocaleString('ko-KR'):value.replace(/^온라인\s*[\/·]\s*/,'')} numeric={col===1} maxLength={col===1?20:500} onChange={next=>cell(i,col,col===1?next.replace(/[,원\s]/g,''):next)}/></td>)}</tr>)}</tbody></table>)}</div>:prayer?<table className={css.prayerTable} aria-label="기도･안내"><tbody>{['날짜','기도','안내'].map((label,col)=><tr key={label}><th scope="row">{label}</th>{rows.map(({row,i})=><td key={i}><PrintText id={`${item.id}:row:${i}:${col}`} label={`기도･안내 ${i+1}열 ${label}`} value={row[col]??''} maxLength={500} onChange={value=>cell(i,col,value)}/></td>)}</tr>)}</tbody></table>:item.kind==='worship'?<table className={order?css.worshipTable:undefined}><tbody>{rows.map(({row,i})=><tr key={i}>{content.fullRows?.includes(i)?<td colSpan={3}><PrintText id={`${item.id}:row:${i}:0`} label={`${item.title} ${i+1}행 내용`} value={row[0]} maxLength={500} onChange={value=>cell(i,0,value)}/></td>:row.slice(0,/섬기는 이들|각종 예배 안내/.test(item.title)?2:3).map((value,col)=><td key={col}><PrintText id={`${item.id}:row:${i}:${col}`} label={`${item.title} ${i+1}행 ${col+1}열`} value={value} maxLength={500} onChange={next=>cell(i,col,next)}/></td>)}</tr>)}</tbody></table>:null}
  {order||content.footer?<div className={css.printFootnote}><PrintText id={`${item.id}:footer`} label="일어서서 안내" value={content.footer??''} onChange={value=>setContent('footer',value)} maxLength={1000}/></div>:null}
  {section!=='표지'&&item.kind!=='image'&&item.kind!=='offering'&&(!order)&&bodyField(item)&&!managedSchedule(item)?<PrintText id={`${item.id}:body`} label={`${item.title} 내용`} value={account?accountBody(item):item.body} onChange={value=>setText('body',value)}/>:null}
  {section==='묵상 가이드'||content.attribution?<div className={css.printAttribution}><PrintText id={`${item.id}:attribution`} label="묵상 담당" value={content.attribution??''} onChange={value=>setContent('attribution',value)} maxLength={200}/></div>:null}
  {item.kind==='offering'?<p className={css.printTotal}>{offeringSummary(content,item.body)} {offeringTotal(content).toLocaleString('ko-KR')}원</p>:null}
 </article></PrintContext>;
}
