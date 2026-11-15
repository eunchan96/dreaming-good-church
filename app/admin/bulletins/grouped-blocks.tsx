'use client';
import {isNewsItem,newsTitle,renderedItems} from '@/lib/bulletin-editor';
import type {BulletinItem} from '@/lib/bulletins';
import {BlockPreview} from './block-fields';
import styles from './grouped-blocks.module.css';
type Item=Pick<BulletinItem,'id'|'title'|'body'|'kind'|'content'|'printPage'>;
export default function BulletinBlocks({items,editor=false,idPrefix='bulletin-item',className}:{items:Item[];editor?:boolean;idPrefix?:string;className?:string}){
 const visible=renderedItems(items),news=visible.filter(isNewsItem);
 return visible.map(item=>{
  if(isNewsItem(item))return item.id===news[0]?.id?<section key={item.id} className={`${styles.news} ${className??''}`} aria-label="좋은 소식"><h3>좋은 소식</h3>{news.map(entry=><section id={`${idPrefix}-${entry.id}`} tabIndex={-1} key={entry.id}><BlockPreview item={{...entry,title:entry.kind==='worship'?newsTitle(entry.title):`${news.filter(item=>item.kind!=='worship').findIndex(item=>item.id===entry.id)+1}. 〈${newsTitle(entry.title)}〉`}} editor={editor} compact hideTitle={entry.title==='좋은 소식'}/></section>)}</section>:null;
  return <section id={`${idPrefix}-${item.id}`} tabIndex={-1} className={className} key={item.id}><BlockPreview item={item} editor={editor}/></section>;
 });
}
