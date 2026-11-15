import {createItem,type BlockKind} from './bulletins';
import {bulletinSections,type BulletinSection} from './bulletin-presentation';
export * from './bulletin-presentation';
export function sectionItem(title: BulletinSection,kind?:BlockKind) {
 return createItem({id:crypto.randomUUID(),title,kind:kind??(title==='예배 순서'||title==='예배 안내'?'worship':title==='헌금 내역'?'offering':title==='토라&토브'?'sermon':'text'),reviewOnCopy:false});
}
export function initialBulletinItems(){
 return bulletinSections.flatMap(title=>{
  if(title==='예배 안내')return [sectionItem('예배 안내','text'),createItem({id:crypto.randomUUID(),title:'다음 주 봉사위원',kind:'worship'}),createItem({id:crypto.randomUUID(),title:'섬기는 이들',kind:'worship'})].map(item=>({...item,title:item.title==='예배 안내'?'예배 공지사항':item.title,printPage:2}));
  return [{...sectionItem(title),printPage:title==='표지'?1:title==='예배 순서'?2:['묵상 가이드','토라&토브','기도'].includes(title)?3:4}];
 });
}
