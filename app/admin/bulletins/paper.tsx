'use client';
import Image from 'next/image';
import {Fragment,useContext,type ReactNode} from 'react';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {offeringTotal} from '@/lib/bulletins';
import {bulletinSections,sectionFor,displayTitle,isPrayerGuide,newsGroups,accountBody,worshipRows,offeringRows,offeringSummary,managedSchedule,bodyField,emptyNews,printOnlyItem,type BulletinSection} from '@/lib/bulletin-editor';
import {rowIdentity} from '@/lib/bulletin-defaults.mjs';
import {BulletinImageView} from '@/app/bulletin-image';
import SiteIcon from '@/app/site-icon';
import {PrintContext,PrintText} from './print-editor';
import css from './paper.module.css';

/* Word-style bulletin renderer shared by the print preview (A4 panels) and the admin detail view.
   Layout follows the church's weekly Word file: coloured title bands, dotted worship order,
   numbered "좋은 소식", two-column offering list. Text stays editable through PrintText. */

export type PaperMeta={serviceDate:string;issueNumber:number};
type Tone='orange'|'gold'|'yellow'|'olive'|'green'|'lime';
const strip=(value:string)=>value.replace(/^\s*↑\s*/,'');

/** Word-style 균등 배치: shows characters spread across the cell; the real text appears while editing. */
function Spread({value,className,children}:{value:string;className:string;children:ReactNode}){
 const chars=[...value.replace(/\s+/g,'')];
 return <span className={`${css.spread} ${className}`}>{children}<span className={css.spreadText} aria-hidden="true">{chars.map((c,i)=><span key={i}>{c}</span>)}</span></span>;
}

export function Band({title,tone}:{title:string;tone:Tone}){return <h3 className={css.band} data-tone={tone}><span>{title}</span></h3>;}

function useEdit(item:BulletinItem){
 const context=useContext(PrintContext),order=item.kind==='worship'&&sectionFor(item)==='예배 순서';
 const content:BlockContent=order?worshipRows(item):item.kind==='offering'?offeringRows(item.content??{}):item.content??{};
 const rows=(content.rows??[]).map((row,i)=>({row,i})).filter(({i})=>!content.disabledRows?.includes(i));
 const editable=context.editable&&!managedSchedule(item);
 return {content,rows,editable,
  text:(field:'title'|'body',value:string)=>context.replace({...item,[field]:value,needsReview:false}),
  field:(field:'reference'|'attribution'|'footer',value:string)=>context.replace({...item,content:{...content,[field]:value},...(order?{body:''}:{}),needsReview:false}),
  cell:(row:number,col:number,value:string)=>context.replace({...item,content:{...content,rows:(content.rows??[]).map((r,i)=>i===row?r.map((v,j)=>j===col?value:v):r)},...(order?{body:''}:{}),needsReview:false}),
 };
}
/** Read-only items (managed schedule) get a non-editable context. */
function Scope({item,children,role}:{item:BulletinItem;children:ReactNode;role?:string}){const context=useContext(PrintContext);return <PrintContext value={{...context,editable:context.editable&&!managedSchedule(item)}}><article className={css.item} data-print-item={item.id} data-role={role}>{children}</article></PrintContext>;}

function longDate(value:string){const [y,m,d]=value.split('-').map(Number);if(!y)return value;const w=new Date(Date.UTC(y,m-1,d)).getUTCDay();return `${y}. ${m}. ${d}(${w===0?'주일':'일월화수목금토'[w]})`;}

function Cover({items,meta}:{items:BulletinItem[];meta:PaperMeta}){
 const texts=items.filter(item=>item.kind!=='image'),images=items.filter(item=>item.kind==='image'&&item.content?.assetId);
 return <div className={css.cover}>
  <div className={css.coverHead}>
   <div className={css.coverLines}>{texts.map(item=><CoverTitle key={item.id} item={item}/>)}</div>
   <div className={css.coverMeta}><p>{longDate(meta.serviceDate)}</p><p>{meta.issueNumber}호</p></div>
  </div>
  <div className={css.coverImages}>{images.map(item=><Scope key={item.id} item={item}><BulletinImageView key={item.content!.assetId} id={item.content!.assetId!} alt={item.content?.alt??''} editor/></Scope>)}</div>
  <div className={css.coverMark}><Image src="/brand/church-mark.svg" width={56} height={56} alt=""/><span><small>꿈 꾸 는</small><strong>좋은교회</strong></span></div>
 </div>;
}
function CoverTitle({item}:{item:BulletinItem}){
 const {text}=useEdit(item),lines=item.title.split(/\n|\s*[·ㆍ]\s*/);
 return <Scope item={item}>{lines.map((line,i)=><PrintText key={i} id={`${item.id}:title:${i}`} className={css.coverLine} label={`${displayTitle(item.title)} 제목${lines.length>1?` ${i+1}줄`:''}`} value={line} maxLength={99} onChange={value=>text('title',lines.map((old,j)=>j===i?value:old).join('\n'))}/>)}</Scope>;
}

function Order({item}:{item:BulletinItem}){
 const {content,rows,field,cell}=useEdit(item),title=/^예배 순서$/.test(item.title.trim())?'주일 하늘보좌 예배':displayTitle(item.title);
 return <Scope item={item}><h3 className={css.orderTitle}><span aria-hidden="true">❧</span>{title}<span aria-hidden="true">☙</span></h3>
  <div className={css.order}>{rows.map(({row,i})=>content.fullRows?.includes(i)
   ?<PrintText key={i} className={css.orderIntro} id={`${item.id}:row:${i}:0`} label={`${item.title} ${i+1}행 내용`} value={row[0]} maxLength={500} onChange={value=>cell(i,0,value)}/>
   :<div key={i} className={css.orderRow} data-emph={/^성경봉독$/.test(rowIdentity(row[0]))?'scripture':/^말씀선포$/.test(rowIdentity(row[0]))?'sermon':undefined}>
     <span className={css.stand}>{/^\s*↑/.test(row[0])?'↑':''}</span>
     <Spread className={css.orderName} value={strip(row[0])}><PrintText id={`${item.id}:row:${i}:0`} label={`${item.title} ${i+1}행 1열`} value={strip(row[0])} maxLength={500} onChange={value=>cell(i,0,(/^\s*↑/.test(row[0])?'↑ ':'')+value)}/></Spread>
     <span className={css.leader}><i/>{row[1]?<><PrintText className={css.orderWhat} id={`${item.id}:row:${i}:1`} label={`${item.title} ${i+1}행 2열`} value={row[1]} maxLength={500} onChange={value=>cell(i,1,value)}/><i/></>:null}</span>
     <Spread className={css.orderWho} value={row[2]??''}><PrintText id={`${item.id}:row:${i}:2`} label={`${item.title} ${i+1}행 3열`} value={row[2]??''} maxLength={500} onChange={value=>cell(i,2,value)}/></Spread>
   </div>)}</div>
  {content.footer?<PrintText className={css.orderFoot} id={`${item.id}:footer`} label="일어서서 안내" value={content.footer} maxLength={1000} onChange={value=>field('footer',value)}/>:null}
 </Scope>;
}

function Table({item,columns}:{item:BulletinItem;columns:number}){
 const {rows,cell}=useEdit(item);
 return <table className={css.table}><tbody>{rows.map(({row,i})=><tr key={i}>{row.slice(0,columns).map((value,col)=><td key={col}><PrintText id={`${item.id}:row:${i}:${col}`} label={`${item.title} ${i+1}행 ${col+1}열`} value={value} maxLength={500} onChange={next=>cell(i,col,next)}/></td>)}</tr>)}</tbody></table>;
}
function Schedule({item}:{item:BulletinItem}){
 const {rows,cell}=useEdit(item);
 const column=(label:string)=>/학생|월삭/.test(label)?1:/새벽|금요/.test(label)?2:0;
 return <Scope item={item}><Band title="예배 안내" tone="olive"/><div className={css.schedule}>{[0,1,2].map(index=><div key={index}>{rows.filter(({row})=>column(row[0])===index).map(({row,i})=><div key={i} className={css.scheduleRow}><PrintText id={`${item.id}:row:${i}:0`} label={`${item.title} ${i+1}행 1열`} value={row[0]} onChange={v=>cell(i,0,v)}/><PrintText id={`${item.id}:row:${i}:1`} label={`${item.title} ${i+1}행 2열`} value={row[1]} onChange={v=>cell(i,1,v)}/></div>)}</div>)}</div></Scope>;
}
function Volunteers({item}:{item:BulletinItem}){
 const {rows,cell}=useEdit(item);
 return <div className={css.volunteers}>{rows.map(({row,i})=><div key={i}><PrintText className={css.volunteerRole} id={`${item.id}:row:${i}:0`} label={`${item.title} ${i+1}행 1열`} value={row[0]} maxLength={500} onChange={v=>cell(i,0,v)}/><div className={css.volunteerWho}><PrintText id={`${item.id}:row:${i}:1`} label={`${item.title} ${i+1}행 2열`} value={row[1]??''} maxLength={500} onChange={v=>cell(i,1,v)}/><PrintText id={`${item.id}:row:${i}:2`} label={`${item.title} ${i+1}행 3열`} value={row[2]??''} maxLength={500} onChange={v=>cell(i,2,v)}/></div></div>)}</div>;
}
function Support({item}:{item:BulletinItem}){
 const {text}=useEdit(item),title=displayTitle(item.title),staff=/섬기는 이들/.test(item.title),volunteer=/봉사위원/.test(item.title);
 return <Scope item={item} role={staff?'staff':undefined}><Band title={title} tone={/공지/.test(title)?'lime':'green'}/><div className={css.tinted}>
  {item.kind==='worship'?volunteer?<Volunteers item={item}/>:<Table item={item} columns={staff?2:3}/>:null}
  {bodyField(item)&&item.body?<PrintText className={css.dashList} id={`${item.id}:body`} label={`${item.title} 내용`} value={item.body} onChange={v=>text('body',v)}/>:null}
 </div></Scope>;
}
function Guide({item}:{item:BulletinItem}){
 const {content,text,field}=useEdit(item);
 return <Scope item={item}><Band title={displayTitle(item.title)} tone="yellow"/><PrintText className={css.prose} id={`${item.id}:body`} label={`${item.title} 내용`} value={item.body} onChange={v=>text('body',v)}/>{<PrintText className={css.attribution} id={`${item.id}:attribution`} label="묵상 담당" value={content.attribution??''} maxLength={200} onChange={v=>field('attribution',v)}/>}</Scope>;
}
function TorahRow({item}:{item:BulletinItem}){
 const {content,text,field}=useEdit(item);
 return <div className={css.torahRow} data-print-item={item.id}><div className={css.torahHead}><span>{displayTitle(item.title)}</span><PrintText className={css.reference} id={`${item.id}:reference`} label={`${displayTitle(item.title)} 본문`} value={content.reference??''} maxLength={500} onChange={v=>field('reference',v)}/></div><PrintText className={css.verse} id={`${item.id}:body`} label={`${item.title} 내용`} value={item.body} onChange={v=>text('body',v)}/></div>;
}
function Sermon({item}:{item:BulletinItem}){
 const {content,text,field}=useEdit(item);
 return <Scope item={item}><h4 className={css.subTitle}><PrintText id={`${item.id}:title`} label={`${displayTitle(item.title)} 제목`} value={displayTitle(item.title)} maxLength={200} onChange={v=>text('title',v)}/></h4><PrintText className={css.reference} id={`${item.id}:reference`} label={`${displayTitle(item.title)} 본문`} value={content.reference??''} maxLength={500} onChange={v=>field('reference',v)}/>{item.body?<PrintText className={css.prose} id={`${item.id}:body`} label={`${item.title} 내용`} value={item.body} onChange={v=>text('body',v)}/>:null}</Scope>;
}
function Plain({item,tone='olive'}:{item:BulletinItem;tone?:Tone}){
 const {text}=useEdit(item);
 return <Scope item={item}><Band title={displayTitle(item.title)} tone={tone}/>{item.body?<PrintText className={css.prose} id={`${item.id}:body`} label={`${item.title} 내용`} value={item.body} onChange={v=>text('body',v)}/>:null}</Scope>;
}
function NewsEntry({item,account}:{item:BulletinItem;account:boolean}){
 const {rows,cell,text}=useEdit(item);
 return <div data-print-item={item.id}>{isPrayerGuide(item)?<table className={css.prayer} aria-label="기도･안내"><tbody>{['날짜','기도','안내'].map((label,col)=><tr key={label}><th scope="row">{col===0?<span className={css.srOnly}>{label}</span>:label}</th>{rows.map(({row,i})=><td key={i}><PrintText id={`${item.id}:row:${i}:${col}`} label={`기도･안내 ${i+1}열 ${label}`} value={row[col]??''} maxLength={500} onChange={v=>cell(i,col,v)}/></td>)}</tr>)}</tbody></table>:null}
  {item.body?<PrintText id={`${item.id}:body`} label={`${item.title} 내용`} value={account?accountBody(item):item.body} onChange={v=>text('body',v)}/>:null}</div>;
}
function News({items}:{items:BulletinItem[]}){
 return <section className={css.block} data-print-group="news"><Band title="좋은 소식" tone="orange"/><ol className={css.news}>{newsGroups(items).map(group=><li key={group.title} data-prayer={group.entries.some(isPrayerGuide)||undefined}><span className={css.tag}>&lt;{group.title}&gt;</span><div>{group.entries.map(entry=><NewsEntry key={entry.id} item={entry} account={group.title==='헌금'}/>)}</div></li>)}</ol></section>;
}
function Offering({item}:{item:BulletinItem}){
 const {content,rows,cell}=useEdit(item),online=rows.filter(({row})=>/온라인/.test(row[0])),onsite=rows.filter(({row})=>!/온라인/.test(row[0]));
 return <Scope item={item}><Band title="헌금 내역" tone="lime"/><div className={css.offering} data-split={online.length>0&&onsite.length>0}>{[onsite,online].filter(column=>column.length).map(column=><table key={column===online?'online':'onsite'}>{online.length&&onsite.length?<caption>{column===online?'온라인 헌금':'현장 헌금'}</caption>:null}<tbody>{column.map(({row,i})=><tr key={i}>{row.slice(0,2).map((value,col)=><td key={col}><PrintText id={`${item.id}:row:${i}:${col}`} label={`${item.title} ${i+1}행 ${col+1}열`} value={col===1?Number(value||0).toLocaleString('ko-KR'):value.replace(/^온라인\s*[\/·]\s*/,'')} numeric={col===1} maxLength={col===1?20:500} onChange={next=>cell(i,col,col===1?next.replace(/[,원\s]/g,''):next)}/></td>)}</tr>)}</tbody></table>)}</div><p className={css.total}>{offeringSummary(content,item.body)} {offeringTotal(content).toLocaleString('ko-KR')}원</p></Scope>;
}

export function Memo({item}:{item?:BulletinItem}){return <section className={`${css.block} ${css.memoBlock}`} data-print-item={item?.id}><Band title="메모" tone="olive"/><div className={css.memo}>{item?.body?<p>{item.body}</p>:null}</div></section>;}
export function ChurchInfo({name,address,phone,item}:{name:string;address:string;phone:string;item?:BulletinItem}){
 return <section className={css.church}><div data-print-item={item?.id}><h3>{name.replace(/^꿈꾸는\s*/,'')}<span aria-hidden="true">♥</span></h3>{item?.body?<p className={css.churchText}>{item.body}</p>:<ul className={css.churchList}>
  <li><SiteIcon name="pin" size={14} style={{color:"#d63a2f"}}/><span>{address}</span></li>
  <li><SiteIcon name="phone" size={14} style={{color:"#e8a10c"}}/><span>{phone}</span></li>
  <li><SiteIcon name="youtube" size={14} style={{color:"#e02b20"}}/><span>Youtube [꿈꾸는 좋은교회]</span></li>
 </ul>}</div><Image className={css.map} src="/brand/church-map.png" alt="교회 약도: 행신동 선아빌딩 5층, 중앙로와 충장로 사이" width={788} height={417} unoptimized/></section>;
}

/** Renders the given items grouped by bulletin section, in the Word bulletin's order. */
export function PaperBlocks({items,meta,memo,footer,sectionIdPrefix}:{items:BulletinItem[];meta:PaperMeta;memo?:ReactNode;footer?:ReactNode;sectionIdPrefix?:string}){
 const visible=items.filter(item=>!item.content?.disabled&&!emptyNews(item)&&!printOnlyItem(item));
 const groups=bulletinSections.map(section=>[section,visible.filter(item=>sectionFor(item)===section)] as [BulletinSection,BulletinItem[]]).filter(([,entries])=>entries.length);
 const memoAt=groups.findIndex(([section])=>section==='기도');
 return <>{groups.map(([section,entries],index)=><Fragment key={section}>{memo&&index===memoAt?memo:null}<div className={css.section} data-section={section} id={sectionIdPrefix?`${sectionIdPrefix}-${bulletinSections.indexOf(section)}`:undefined} tabIndex={sectionIdPrefix?-1:undefined}>
  {section==='표지'?<Cover items={entries} meta={meta}/>
  :section==='예배 순서'?entries.map(item=>item.kind==='worship'?<Order key={item.id} item={item}/>:item.kind==='sermon'?<Sermon key={item.id} item={item}/>:<Plain key={item.id} item={item}/>)
  :section==='예배 안내'?<>{entries.filter(managedSchedule).map(item=><Schedule key={item.id} item={item}/>)}<div className={css.supportGrid}>{entries.filter(item=>!managedSchedule(item)).map(item=><Support key={item.id} item={item}/>)}</div></>
  :section==='묵상 가이드'?entries.map(item=><Guide key={item.id} item={item}/>)
  :section==='토라&토브'?<section className={css.block}><Band title="토라&토브" tone="gold"/><div className={css.torah}>{entries.map(item=><TorahRow key={item.id} item={item}/>)}</div></section>
  :section==='기도'?entries.map(item=><Plain key={item.id} item={item} tone="olive"/>)
  :section==='좋은 소식'?<News items={entries}/>
  :section==='헌금 내역'?entries.map(item=><Offering key={item.id} item={item}/>)
  :entries.map(item=><Plain key={item.id} item={item}/>)}
 </div></Fragment>)}{memo&&memoAt<0?memo:null}{footer}</>;
}

/** Read-only Word-style rendering for the admin detail / web preview. */
export function PaperView({items,meta,sectionIdPrefix}:{items:BulletinItem[];meta:PaperMeta;sectionIdPrefix?:string}){
 return <div className={css.flow}><PaperBlocks items={items} meta={meta} sectionIdPrefix={sectionIdPrefix}/></div>;
}
