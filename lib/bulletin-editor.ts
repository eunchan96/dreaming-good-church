import {createItem,type BlockContent,type BlockKind,type BulletinItem} from './bulletins';
import {rowIdentity,defaultOrderRows,defaultStaffRows,defaultAccountBody,defaultOfferingRows,standingFooter,volunteerDefaults,shiftPrayerRows,worshipNewsBody,offeringFor} from './bulletin-defaults.mjs';
export const defaultGuideBody='1층 남선교회 김동주 집사, 김형신 집사';
const defaultNews=['환영','예배','중보','광고','성경','기도･안내','안내','헌금'];
/** Items every new bulletin starts with. They can be disabled but not deleted; added items can be deleted. */
export function defaultItem(item:Pick<BulletinItem,'title'|'kind'|'printPage'>){
 if(item.kind==='image')return false;
 const section=sectionFor(item),title=item.title.trim();
 if(section==='표지'||section==='예배 순서'||section==='헌금 내역'||section==='묵상 가이드'||section==='기도')return true;
 if(section==='예배 안내')return /예배 공지사항|예배 묵상 진행|다음 주 봉사위원|섬기는 이들|각종 예배 안내/.test(title);
 if(section==='토라&토브')return /나의 묵상|^토라\s*&\s*토브$/.test(title);
 if(section==='좋은 소식')return defaultNews.includes(title.replace(/^좋은 소식\s*[·ㆍ:]\s*/,'').replace(/\s/g,''))||isPrayerGuide(item);
 return false;
}
import {newsGroups,accountBody,isPrayerGuide,sectionFor,moveRow} from './bulletin-presentation';
import {bulletinSections,type BulletinSection} from './bulletin-presentation';
export * from './bulletin-presentation';
export function sectionItem(title: BulletinSection,kind?:BlockKind) {
 return createItem({id:crypto.randomUUID(),title,kind:kind??(title==='예배 순서'||title==='예배 안내'?'worship':title==='헌금 내역'?'offering':title==='토라&토브'?'sermon':'text'),reviewOnCopy:false});
}
/** 섬기는 이들 for a new week: last week's rows (or defaults), with 교회 청소 moved last and left empty to fill in. */
function staffContent(staff?:BulletinItem){
 let content:BlockContent={disabled:staff?.content?.disabled??false,disabledRows:structuredClone(staff?.content?.disabledRows??[]),rows:structuredClone(staff?.content?.rows??defaultStaffRows).map(row=>/성경.*(?:통독|봉독)/.test(row[0])&&/판독 확인 필요/.test(row[1])?['성경 봉독','조근혜','']:row)};
 const rows=content.rows??[],at=rows.findIndex(row=>rowIdentity(row[0])==='교회청소');
 if(at>=0&&at!==rows.length-1)content=moveRow(content,at,rows.length-1);
 return {...content,rows:(content.rows??[]).map(row=>rowIdentity(row[0])==='교회청소'?[row[0],'',row[2]??'']:row)};
}
export function initialBulletinItems(serviceDate=new Date().toISOString().slice(0,10),previous?:{serviceDate:string;items:BulletinItem[]}):BulletinItem[]{
 const prior=previous?.items??[],staff=prior.find(item=>/섬기는 이들/.test(item.title)),offering=prior.find(item=>item.kind==='offering'),prayer=prior.find(isPrayerGuide),welcome=prior.find(item=>/환영/.test(item.title));
 const accountItems=newsGroups(prior.filter(item=>sectionFor(item)==='좋은 소식')).find(group=>group.title==='헌금')?.entries;
 return bulletinSections.flatMap(title=>{
  if(title==='예배 안내')return [
   {...sectionItem('예배 안내','text'),title:'예배 공지사항',body:'새벽예배 말씀:\n금요예배 말씀:\n주일예배 말씀:'},
   {...createItem({id:crypto.randomUUID(),title:'다음 주 봉사위원',kind:'worship'}),content:{rows:volunteerDefaults(serviceDate)}},
   {...createItem({id:crypto.randomUUID(),title:'섬기는 이들',kind:'worship'}),webVisible:staff?.webVisible??true,content:staffContent(staff)}
  ].map(item=>({...item,printPage:2}));
  if(title==='좋은 소식')return ['환영','예배','중보','광고','성경','기도･안내','안내','헌금'].flatMap(name=>{
   if(name==='헌금'&&accountItems?.length)return accountItems.map(source=>({...createItem({id:crypto.randomUUID(),title:'좋은 소식 · 헌금'}),body:accountBody(source),webVisible:source.webVisible,content:{disabled:source.content?.disabled??false},printPage:4}));
   return [{...createItem({id:crypto.randomUUID(),title:'좋은 소식 · '+name,kind:name==='기도･안내'?'worship':'text'}),webVisible:name==='환영'?(welcome?.webVisible??true):name==='기도･안내'?(prayer?.webVisible??true):true,body:name==='환영'?(welcome?.body??'주님의 이름으로 사랑하고 축복합니다.'):name==='예배'?worshipNewsBody('',serviceDate):name==='헌금'?defaultAccountBody:name==='안내'?(prior.find(old=>/^좋은 소식\s*·\s*안내$/.test(old.title))?.body.trim()||defaultGuideBody):'',...(name==='기도･안내'?{content:{disabled:prayer?.content?.disabled??false,rows:shiftPrayerRows(prayer?.content?.rows,serviceDate,previous?.serviceDate)}}:name==='환영'?{content:{disabled:welcome?.content?.disabled??false}}:{}),printPage:4}];
  });
  if(title==='토라&토브')return ['나의 묵상','토라&토브'].map(name=>({...createItem({id:crypto.randomUUID(),title:name,kind:'sermon'}),printPage:3}));
  const item=sectionItem(title);
  if(title==='표지')item.title='하나님 앞에서\n더 나은 예배';
  if(title==='예배 순서')item.content={rows:structuredClone(defaultOrderRows),fullRows:[0],footer:standingFooter,disabledRows:[6]};
  if(title==='헌금 내역')item.content={...offeringFor(serviceDate),rows:structuredClone(offering?.content?.rows??defaultOfferingRows).map(row=>[row[0],''])};
  return [{...item,printPage:title==='표지'?1:title==='예배 순서'?2:['묵상 가이드','토라&토브','기도'].includes(title)?3:4}];
 });
}
