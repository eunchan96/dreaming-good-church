import {createItem, type BulletinItem, type BlockKind} from './bulletins';
export const bulletinSections = ['표지','예배 순서','예배 안내','묵상 가이드','토라&토브','기도','좋은 소식','헌금 내역'] as const;
export type BulletinSection = typeof bulletinSections[number];
export function printOnlyItem(item: Pick<BulletinItem,'title'>) { return /^(메모|교회 안내)$/.test(item.title.trim()); }
export function sectionFor(item: BulletinItem): BulletinSection {
 const title=item.title;
 const fixed=bulletinSections.find(section=>title===section||title.startsWith(section+' ·'));if(fixed)return fixed;
 if(item.kind==='offering'||/헌금 내역/.test(title))return '헌금 내역';
 if(/토라|토브/.test(title))return '토라&토브';
 if(/묵상 가이드/.test(title))return '묵상 가이드';
 if(/^(기도|기도문|기도 담당)$/.test(title))return '기도';
 if(item.printPage===1||item.kind==='image'||/표지|하나님 앞에서/.test(title))return '표지';
 if(/예배 안내|봉사위원|섬기는 이들|기도 인도|예배 묵상/.test(title))return '예배 안내';
 if(item.kind==='worship'||item.kind==='sermon'||/설교|성경 본문|찬송|예배 순서/.test(title))return '예배 순서';
 return '좋은 소식';
}
export function sectionItem(title: BulletinSection,kind?:BlockKind) {
 return createItem({id:crypto.randomUUID(),title,kind:kind??(title==='예배 순서'||title==='예배 안내'?'worship':title==='헌금 내역'?'offering':title==='토라&토브'?'sermon':'text'),reviewOnCopy:true});
}
export function initialBulletinItems(){ return bulletinSections.map(title=>({...sectionItem(title),printPage:title==='표지'?1:title==='예배 순서'||title==='예배 안내'?2:['묵상 가이드','토라&토브','기도'].includes(title)?3:4})); }
