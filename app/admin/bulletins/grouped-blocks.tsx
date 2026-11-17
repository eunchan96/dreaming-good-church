'use client';
import {bulletinSections,sectionFor,isNewsItem,newsGroups,accountBody,renderedItems} from '@/lib/bulletin-editor';
import type {BulletinItem} from '@/lib/bulletins';
import {BlockPreview} from './block-fields';
import styles from './grouped-blocks.module.css';

type Item=Pick<BulletinItem,'id'|'title'|'body'|'kind'|'content'|'printPage'>;
export default function BulletinBlocks({items,editor=false,idPrefix='bulletin-item',sectionIdPrefix,className}:{items:Item[];editor?:boolean;idPrefix?:string;sectionIdPrefix?:string;className?:string}){
 const visible=renderedItems(items);
 return <div className={styles.document}>{bulletinSections.map((section,sectionIndex)=>{
  const entries=visible.filter(item=>sectionFor(item)===section);if(!entries.length)return null;
  return <section className={styles.section} key={section} aria-label={section} data-section={section} id={sectionIdPrefix?`${sectionIdPrefix}-${sectionIndex}`:undefined} tabIndex={sectionIdPrefix?-1:undefined}><header className={styles.sectionHeading}><span aria-hidden="true">✦</span><h3>{section}</h3></header>{section==='좋은 소식'?<div className={styles.news}>{newsGroups(entries.filter(isNewsItem)).map(group=><div className={styles.newsRow} key={group.title}><h4>〈{group.title}〉</h4><div>{group.entries.filter(item=>item.body.trim()||item.content?.rows?.length).map(entry=><section id={`${idPrefix}-${entry.id}`} tabIndex={-1} key={entry.id} className={className}><BlockPreview item={{...entry,body:group.title==='헌금'?accountBody(entry):entry.body}} editor={editor} compact hideTitle/></section>)}</div></div>)}{entries.filter(item=>!isNewsItem(item)).map(item=><section id={`${idPrefix}-${item.id}`} tabIndex={-1} key={item.id} className={className}><BlockPreview item={item} editor={editor} compact/></section>)}</div>:entries.map(item=><section id={`${idPrefix}-${item.id}`} tabIndex={-1} className={className} key={item.id}><BlockPreview item={item} editor={editor} compact hideTitle={item.title===section&&section!=='토라&토브'}/></section>)}</section>;
 })}</div>;
}
