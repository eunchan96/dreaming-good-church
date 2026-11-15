"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {CHURCH_ADDRESS,CHURCH_PHONE} from '@/lib/site-content';
import ChurchContentProvider,{useChurchContent} from '@/app/church-content';
import type { SavedBulletin } from "@/lib/bulletin-store";
import {PrintEditorProvider,PrintBlocks,PrintFormatToolbar} from "./print-editor";
import type {BulletinItem} from "@/lib/bulletins";
import {managedSchedule,presentationItems,sectionFor,isPrayerGuide} from "@/lib/bulletin-editor";
import {formatWorshipTime,timeLabels} from "@/lib/church-page-settings";
import styles from "./print-preview.module.css";

function defaultPage(item: SavedBulletin["items"][number]) {
  if (sectionFor(item)==="표지") return 1;
  if (isPrayerGuide(item)) return 4;
  if (item.kind === "sermon" || item.kind === "worship") return 2;
  if (/묵상|기도문|^기도$|메모|토라|목장/.test(item.title)) return 3;
  return 4;
}
const pageTitles = ["표지", "예배", "묵상과 기도", "교회 소식"];
function PrintPreviewContent({ draft, dirty, onClose, pages, onPagesChange,onReplace }: { draft: SavedBulletin; dirty: boolean; onClose: () => void; pages: Record<string, number>; onPagesChange: (pages: Record<string, number>) => void;onReplace:(item:BulletinItem)=>void }) {
  const {fields,settings,settingsStatus,retry}=useChurchContent();
  const schedule=()=>settings.worship_times.map(row=>[timeLabels[row.key],formatWorshipTime(row),'']);
  const items=presentationItems(draft.items).map(item=>managedSchedule(item)?{...item,content:{...item.content,rows:schedule()}}:item);
  if(!items.some(managedSchedule))items.push({id:'church-managed-schedule',title:'각종 예배 안내',body:'',kind:'worship',content:{rows:schedule()},printPage:2,webVisible:false,reviewOnCopy:false,needsReview:false});
  const root = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [overflowPages, setOverflowPages] = useState<number[]>([]);
  function checkOverflow() {
    return Array.from(root.current?.querySelectorAll<HTMLElement>('[data-print-panel]') ?? []).filter(node => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1).map(node => Number(node.dataset.printPanel));
  }
  useEffect(() => {
    const check = () => { const next = checkOverflow(); setOverflowPages(current => JSON.stringify(current) === JSON.stringify(next) ? current : next); };
    const observer = new ResizeObserver(check);
    root.current?.querySelectorAll<HTMLElement>('[data-print-panel], [data-print-content]').forEach(node => observer.observe(node));
    let active = true;
    void document.fonts.ready.then(() => { if (active) check(); });
    check();
    return () => { active = false; observer.disconnect(); };
  }, [draft, pages]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings=Array.from(document.body.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node!==root.current).map(node=>({node,inert:node.inert}));
    siblings.forEach(({node})=>{node.inert=true;});
    root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href],[tabindex="0"],input:not(:disabled)');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow;siblings.forEach(({node,inert})=>{node.inert=inert;}); previous?.focus(); };
  }, [onClose]);
  function arrange(){
    const panels=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-print-panel]')??[]);
    const heights=new Map(panels.map(node=>[Number(node.dataset.printPanel),{used:node.querySelector<HTMLElement>('[data-print-content]')?.scrollHeight??0,available:node.clientHeight}]));
    const next={...pages};let moved=0;
    const candidates=items.filter(item=>item.kind==='offering'||item.kind==='sermon').sort((a,b)=>Number(b.kind==='offering')-Number(a.kind==='offering'));
    for(const item of candidates){const from=next[item.id]??defaultPage(item),current=heights.get(from);if(!current||current.used<=current.available)continue;
      const node=root.current?.querySelector<HTMLElement>(`[data-print-item="${item.id}"]`);if(!node)continue;const height=node.getBoundingClientRect().height+2;
      const target=[2,3,4].filter(number=>number!==from).sort((a,b)=>heights.get(a)!.used-heights.get(b)!.used).find(number=>heights.get(number)!.used+height<=heights.get(number)!.available);
      if(target){next[item.id]=target;current.used-=height;heights.get(target)!.used+=height;moved++;}
    }
    if(moved){onPagesChange(next);setMessage('내용을 보존하며 지면 배치를 정리했습니다.');}else setMessage('이동할 여유 지면이 없습니다. 글자 크기나 면 배치를 조절해 주세요.');
  }
  async function print() {
    if(settingsStatus!=="ready"){setMessage("교회 예배시간을 불러온 뒤 인쇄해 주세요.");return;}
    const images = Array.from(root.current?.querySelectorAll("img") ?? []);
    const expected = items.filter(item => item.kind === "image" && item.content?.assetId&&!item.content.disabled).length;
    if (images.length !== expected) { setMessage("이미지를 아직 불러오지 못했습니다. 이미지가 모두 표시된 뒤 다시 눌러 주세요."); return; }
    try { await Promise.all(images.map(image => image.decode())); await document.fonts.ready;
      const overflow = checkOverflow(); setOverflowPages(overflow);
      if (overflow.length) { setMessage(`${overflow.join("·")}면의 내용이 넘칩니다. 면 배치를 바꾸거나 편집 화면에서 내용을 줄여 주세요.`); return; }
      setMessage(""); window.print(); }
    catch { setMessage("이미지를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요."); }
  }
  return createPortal(<PrintEditorProvider bulletinId={draft.id} editable={draft.status==="draft"} onReplace={item=>{if(draft.status==="draft"&&draft.items.some(original=>original.id===item.id))onReplace(item);}}><div ref={root} tabIndex={-1} className={`${styles.overlay} ${overflowPages.length ? styles.badLayout : ""}`} role="dialog" aria-modal="true" aria-labelledby="print-title">
    <header className={styles.controls}><div className={styles.printHeading}><div><span>PRINT STUDIO</span><h2 id="print-title">관리자 인쇄 미리보기</h2><p>{draft.issueNumber}호 · {draft.serviceDate} · A4 가로 반접지</p></div><div>{draft.status==="draft"&&overflowPages.length?<button onClick={arrange}>지면 자동 정리</button>:null}<button onClick={() => void print()}>인쇄 · PDF로 저장</button><button onClick={onClose}>미리보기 닫기</button></div></div>
    <details><summary>면 배치 · 인쇄 설정</summary><p>겉면 4·1 / 안쪽 2·3 · A4 가로 · 배율 100% · 여백 없음 · 머리글/바닥글 끔</p><p>{dirty?"저장 전 변경도 표시합니다. ":""}웹 비공개 항목도 인쇄에 포함됩니다. 문구 수정은 초안 저장에 반영됩니다.{draft.status!=="draft"?" 게시된 주보의 문구는 읽기 전용입니다.":""}</p>{presentationItems(draft.items).map(item=><label className={styles.assignment} key={item.id}>{item.title||"주보 항목"}<select disabled={draft.status!=="draft"} aria-label={`${item.title||"주보 항목"} 인쇄 면`} value={pages[item.id]??defaultPage(item)} onChange={event=>{onPagesChange({...pages,[item.id]:Number(event.target.value)});setMessage("");}}>{pageTitles.map((title,index)=><option value={index+1} key={title}>{index+1}면 · {title}</option>)}</select></label>)}</details>
    {settingsStatus==="error"?<button onClick={retry}>예배시간 다시 불러오기</button>:null}<p role="status">{overflowPages.length?`${overflowPages.join("·")}면 넘침: 면 배치나 글자 크기를 조절해 주세요.`:""} {message}</p></header>
    <PrintFormatToolbar/>
    <p className={styles.blockedPrint}>내용이 면을 넘쳐 인쇄를 중단했습니다. 미리보기에서 면 배치를 조정한 뒤 다시 인쇄해 주세요.</p>
    <div className={styles.paper} role="document" aria-label="인쇄 주보">{[[4,1],[2,3]].map((side,index) => <div className={styles.sheet} key={index} aria-label={index === 0 ? "겉면 4·1" : "안쪽 2·3"}>{side.map(number => <section className={styles.panel} key={number} aria-label={`${number}면`}>
      <header><p>꿈꾸는좋은교회 · {number}면</p><h2>{number === 1 ? `${draft.serviceDate} · ${draft.issueNumber}호 주보` : pageTitles[number - 1]}</h2></header>
      <div className={styles.panelBody} data-print-panel={number}><div data-print-content><PrintBlocks items={items.filter(item=>(pages[item.id]??defaultPage(item))===number)}/>{number===3&&!draft.items.some(item=>item.title.trim()==="메모")?<section className={styles.item}><h3>메모</h3><div style={{minHeight:"32mm"}}/></section>:null}{number===4&&!draft.items.some(item=>item.title.trim()==="교회 안내")?<section className={styles.item}><h3>교회 안내</h3><p>{fields?.name||"꿈꾸는좋은교회"}</p><p>{fields?.address||CHURCH_ADDRESS}</p><p>{fields?.phone||CHURCH_PHONE}</p></section>:null}</div></div>
    </section>)}</div>)}
    </div>
  </div></PrintEditorProvider>, document.body);
}

export default function PrintPreview(props:Parameters<typeof PrintPreviewContent>[0]) { return <ChurchContentProvider><PrintPreviewContent {...props}/></ChurchContentProvider>; }
