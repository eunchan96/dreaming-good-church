import {createItem,type BlockKind} from './bulletins';
import {bulletinSections,type BulletinSection} from './bulletin-presentation';
export * from './bulletin-presentation';
export function sectionItem(title: BulletinSection,kind?:BlockKind) {
 return createItem({id:crypto.randomUUID(),title,kind:kind??(title==='예배 순서'||title==='예배 안내'?'worship':title==='헌금 내역'?'offering':title==='토라&토브'?'sermon':'text'),reviewOnCopy:false});
}
export function initialBulletinItems(){
 return bulletinSections.flatMap(title=>{
  if(title==='예배 안내')return [sectionItem('예배 안내','text'),createItem({id:crypto.randomUUID(),title:'다음 주 봉사위원',kind:'worship'}),createItem({id:crypto.randomUUID(),title:'섬기는 이들',kind:'worship'})].map(item=>({...item,title:item.title==='예배 안내'?'예배 공지사항':item.title,printPage:2}));
  if(title==='좋은 소식')return ['환영','예배','중보','광고','성경','기도･안내','안내','헌금'].map(name=>({...createItem({id:crypto.randomUUID(),title:'좋은 소식 · '+name,kind:name==='기도･안내'?'worship':'text'}),...(name==='기도･안내'?{content:{rows:Array.from({length:5},()=>['','',''])}}:{}),printPage:4}));
  if(title==='토라&토브')return ['나의 묵상','토라&토브'].map(name=>({...createItem({id:crypto.randomUUID(),title:name,kind:'sermon'}),printPage:3}));
  const item=sectionItem(title);if(title==='표지')item.title='하나님 앞에서\n더 나은 예배';if(title==='예배 순서')item.content={rows:[['','',''],['','','']],fullRows:[0],footer:'↑ 표시는 일어서서, 몸이 불편한 분은 앉아 계셔도 됩니다.'};
  return [{...item,printPage:title==='표지'?1:title==='예배 순서'?2:['묵상 가이드','토라&토브','기도'].includes(title)?3:4}];
 });
}
