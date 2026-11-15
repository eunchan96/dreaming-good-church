import {createItem,type BlockKind,type BulletinItem} from './bulletins';
import {defaultOrderRows,defaultStaffRows,defaultAccountBody,defaultOfferingRows,standingFooter,volunteerDefaults,shiftPrayerRows} from './bulletin-defaults.mjs';
import {newsGroups,accountBody,isPrayerGuide,sectionFor} from './bulletin-presentation';
import {bulletinSections,type BulletinSection} from './bulletin-presentation';
export * from './bulletin-presentation';
export function sectionItem(title: BulletinSection,kind?:BlockKind) {
 return createItem({id:crypto.randomUUID(),title,kind:kind??(title==='예배 순서'||title==='예배 안내'?'worship':title==='헌금 내역'?'offering':title==='토라&토브'?'sermon':'text'),reviewOnCopy:false});
}
export function initialBulletinItems(serviceDate=new Date().toISOString().slice(0,10),previous?:{serviceDate:string;items:BulletinItem[]}):BulletinItem[]{
 const prior=previous?.items??[],staff=prior.find(item=>/섬기는 이들/.test(item.title)),offering=prior.find(item=>item.kind==='offering'),prayer=prior.find(isPrayerGuide),welcome=prior.find(item=>/환영/.test(item.title));
 const accountItems=newsGroups(prior.filter(item=>sectionFor(item)==='좋은 소식')).find(group=>group.title==='헌금')?.entries;
 return bulletinSections.flatMap(title=>{
  if(title==='예배 안내')return [
   {...sectionItem('예배 안내','text'),title:'예배 공지사항',body:'새벽예배 말씀:\n금요예배 말씀:\n주일예배 말씀:'},
   {...createItem({id:crypto.randomUUID(),title:'다음 주 봉사위원',kind:'worship'}),content:{rows:volunteerDefaults(serviceDate)}},
   {...createItem({id:crypto.randomUUID(),title:'섬기는 이들',kind:'worship'}),webVisible:staff?.webVisible??true,content:{disabled:staff?.content?.disabled??false,disabledRows:structuredClone(staff?.content?.disabledRows??[]),rows:structuredClone(staff?.content?.rows??defaultStaffRows).map(row=>/성경.*(?:통독|봉독)/.test(row[0])&&/판독 확인 필요/.test(row[1])?['성경 봉독','조근혜','']:row)}}
  ].map(item=>({...item,printPage:2}));
  if(title==='좋은 소식')return ['환영','예배','중보','광고','성경','기도･안내','안내','헌금'].flatMap(name=>{
   if(name==='헌금'&&accountItems?.length)return accountItems.map(source=>({...createItem({id:crypto.randomUUID(),title:'좋은 소식 · 헌금'}),body:accountBody(source),webVisible:source.webVisible,content:{disabled:source.content?.disabled??false},printPage:4}));
   return [{...createItem({id:crypto.randomUUID(),title:'좋은 소식 · '+name,kind:name==='기도･안내'?'worship':'text'}),webVisible:name==='환영'?(welcome?.webVisible??true):name==='기도･안내'?(prayer?.webVisible??true):true,body:name==='환영'?(welcome?.body??'주님의 이름으로 사랑하고 축복합니다.'):name==='헌금'?defaultAccountBody:'',...(name==='기도･안내'?{content:{disabled:prayer?.content?.disabled??false,rows:shiftPrayerRows(prayer?.content?.rows,serviceDate,previous?.serviceDate)}}:name==='환영'?{content:{disabled:welcome?.content?.disabled??false}}:{}),printPage:4}];
  });
  if(title==='토라&토브')return ['나의 묵상','토라&토브'].map(name=>({...createItem({id:crypto.randomUUID(),title:name,kind:'sermon'}),printPage:3}));
  const item=sectionItem(title);
  if(title==='표지')item.title='하나님 앞에서\n더 나은 예배';
  if(title==='예배 순서')item.content={rows:structuredClone(defaultOrderRows),fullRows:[0],footer:standingFooter,disabledRows:[6]};
  if(title==='헌금 내역'){const d=new Date(serviceDate+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);item.content={month:d.toISOString().slice(0,7),rows:structuredClone(offering?.content?.rows??defaultOfferingRows).map(row=>[row[0],'']),disabled:Number(serviceDate.slice(8))>7};}
  return [{...item,printPage:title==='표지'?1:title==='예배 순서'?2:['묵상 가이드','토라&토브','기도'].includes(title)?3:4}];
 });
}
