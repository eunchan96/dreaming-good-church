import type {BlockContent,BulletinItem} from './bulletins';
export const bulletinSections = ['표지','예배 순서','예배 안내','묵상 가이드','토라&토브','기도','좋은 소식','헌금 내역'] as const;
export type BulletinSection = typeof bulletinSections[number];
export function printOnlyItem(item: Pick<BulletinItem,'title'>) { return /^(메모|교회 안내)$/.test(item.title.trim()); }
export function sectionFor(item: {title:string;kind?:string;printPage?:number|null}): BulletinSection {
 const title=item.title;
 const fixed=bulletinSections.find(section=>title===section||title.startsWith(section+' ·'));if(fixed)return fixed;
 if(item.kind==='offering'||/헌금 내역/.test(title))return '헌금 내역';
 if(/토라|토브|나의 묵상/.test(title))return '토라&토브';
 if(/묵상 가이드/.test(title))return '묵상 가이드';
 if(/^(기도|기도문|기도 담당)$/.test(title))return '기도';
 if(item.printPage===1||item.kind==='image'||/표지|하나님 앞에서/.test(title))return '표지';
 if(/기도\s*인도.*안내/.test(title))return '좋은 소식';
 if(/예배 안내|봉사위원|섬기는 이들|예배 묵상|예배 공지사항/.test(title))return '예배 안내';
 if(item.kind==='worship'||item.kind==='sermon'||/설교|성경 본문|찬송|예배 순서/.test(title))return '예배 순서';
 return '좋은 소식';
}
export type PresentationItem={title:string;body:string;kind?:string;content?:unknown;printPage?:number|null;webVisible?:boolean};
export const displayTitle=(title:string)=>title==='예배 묵상 진행'?'예배 공지사항':/나의 묵상/.test(title)?'나의 묵상':/^토라\s*&\s*토브$/.test(title)?'토라&토브':title;
export const newsTitle=(title:string)=>displayTitle(title).replace(/^좋은 소식\s*[·ㆍ:]\s*/,'');
export const isNewsItem=(item:Pick<PresentationItem,'title'>)=>/^좋은 소식(?:\s*[·ㆍ:]|$)|기도\s*인도.*안내/.test(item.title);
export const managedSchedule=(item:Pick<PresentationItem,'title'>)=>item.title==='각종 예배 안내';
export const bodyField=(item:Pick<PresentationItem,'title'|'kind'>)=>item.kind!=='image'&&!(item.kind==='worship'&&/다음\s*주\s*봉사위원|섬기는 이들|기도\s*인도.*안내/.test(item.title));
export function presentationItems<T extends PresentationItem>(items:readonly T[]):T[]{
 const orders=items.filter(item=>item.kind==='worship');
 return items.filter(item=>{
  if(item.kind!=='image'&&/^표지\s*사진$/.test(item.title.trim()))return false;
  if(item.kind==='sermon'&&!item.body.trim()&&!/토라|토브/.test(item.title)){
   const reference=(item.content as BlockContent)?.reference?.trim();
   if(reference&&orders.some(order=>{const text=((order.content as BlockContent)?.rows??[]).filter((_,i)=>!(order.content as BlockContent)?.disabledRows?.includes(i)).flat().join('\n');return order.webVisible===item.webVisible&&text.includes(reference)&&text.includes(item.title.trim());}))return false;
  }
  // Old generic additions should not create another empty box beside a filled section.
  if(bulletinSections.some(title=>title===item.title)&&!item.body.trim()&&item.kind!=='image'){
   const rows=(item.content as BlockContent)?.rows;const reference=(item.content as BlockContent)?.reference;
   if(!reference&&!rows?.some(row=>row.some(cell=>cell.trim()))&&items.some(other=>other!==item&&other.title!==item.title&&other.kind!=='image'&&!printOnlyItem(other)&&sectionFor(other)===sectionFor(item)&&!/^표지\s*사진$/.test(other.title)))return false;
  }
  return true;
 });
}

export function worshipRows(item:PresentationItem):BlockContent{
 const content=structuredClone((item.content??{}) as BlockContent);
 if(item.kind!=='worship'||sectionFor(item)!=='예배 순서'||content.fullRows!==undefined)return content;
 const lines=item.body.split('\n');
 const footer=lines.filter(line=>/↑\s*표시/.test(line));
 const intro=lines.filter(line=>!/↑\s*표시/.test(line)).join('\n').trim();
 if(intro){const parts=intro.match(/[\s\S]{1,500}/g)??[];content.rows=[...parts.map(part=>[part,'','']),...(content.rows??[])];content.disabledRows=(content.disabledRows??[]).map(i=>i+parts.length);content.fullRows=parts.map((_,i)=>i);}
 else content.fullRows=[];
 if(footer.length)content.footer=footer.join('\n');
 return content;
}
export function moveRow(content:BlockContent,from:number,to:number):BlockContent{
 const order=(content.rows??[]).map((_,i)=>i);const [moving]=order.splice(from,1);order.splice(to,0,moving);
 return {...content,rows:order.map(i=>[...content.rows![i]]),disabledRows:order.flatMap((old,i)=>content.disabledRows?.includes(old)?[i]:[]),...(content.fullRows?{fullRows:order.flatMap((old,i)=>content.fullRows?.includes(old)?[i]:[])}:{})};
}
export function renderedItems<T extends PresentationItem>(items:readonly T[]):T[]{
 return presentationItems(items).filter(item=>!(item.content as BlockContent)?.disabled).map(item=>{
  const ordered=item.kind==='worship'&&sectionFor(item)==='예배 순서';
  const content=ordered?worshipRows(item):structuredClone((item.content??{}) as BlockContent);
  if(content.rows){const enabled=content.rows.map((_,i)=>i).filter(i=>!content.disabledRows?.includes(i));content.rows=enabled.map(i=>content.rows![i]);if(content.fullRows)content.fullRows=enabled.flatMap((old,i)=>content.fullRows!.includes(old)?[i]:[]);delete content.disabledRows;}
  return {...item,...(ordered?{body:''}:{}),content};
 });
}
