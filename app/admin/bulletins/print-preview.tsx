"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {CHURCH_ADDRESS,CHURCH_PHONE} from '@/lib/site-content';
import ChurchContentProvider,{useChurchContent} from '@/app/church-content';
import type { SavedBulletin } from "@/lib/bulletin-store";
import {PrintEditorProvider,PrintFormatToolbar} from "./print-editor";
import {PaperBlocks,Memo,ChurchInfo} from "./paper";
import type {BulletinItem} from "@/lib/bulletins";
import {managedSchedule,presentationItems,sectionFor,isPrayerGuide,displayTitle,isNewsItem} from "@/lib/bulletin-editor";
import {formatWorshipTime,timeLabels} from "@/lib/church-page-settings";
import styles from "./print-preview.module.css";
import AdminIcon from "../admin-icons";

/** 헌금 내역 always prints on 4면, like the Word bulletin. */
function defaultPage(item: SavedBulletin["items"][number]) {
  if (item.kind === "offering") return 4;
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
  const [panel, setPanel] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = stage.current; if (!node) return;
    // Fit the 297mm sheet into the visible canvas without changing print output.
    const fit = () => { const available = node.clientWidth - 48; const sheet = 297 * 96 / 25.4; setScale(Math.max(0.3, Math.min(1, available / sheet))); };
    fit(); const observer = new ResizeObserver(fit); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Spread the worship order to fill its page: widest row height that still fits (2.7em → 1.6em).
  useLayoutEffect(() => {
    const fit = () => root.current?.querySelectorAll<HTMLElement>('[data-print-panel]').forEach(body => {
      const panel = body.closest<HTMLElement>('[data-page]');
      if (!panel || !body.querySelector('[data-order-row]')) { panel?.style.removeProperty('--order-row'); return; }
      let size = 2.7;
      panel.style.setProperty('--order-row', `${size}em`);
      while (size > 1.6 && body.scrollHeight > body.clientHeight + 1) { size = Math.round((size - 0.05) * 100) / 100; panel.style.setProperty('--order-row', `${size}em`); }
    });
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; };
  }, [draft, pages, settings, fields]);
  function checkOverflow() {
    // A few pixels of tolerance: sub-pixel rounding should not block printing.
    return Array.from(root.current?.querySelectorAll<HTMLElement>('[data-print-panel]') ?? []).filter(node => node.scrollHeight > node.clientHeight + 6 || node.scrollWidth > node.clientWidth + 6).map(node => Number(node.dataset.printPanel));
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
    const heights=new Map(panels.map(node=>[Number(node.dataset.printPanel),{used:(node.querySelector<HTMLElement>('[data-print-content]')?.offsetHeight??0)+(node.querySelector<HTMLElement>('[data-print-footer]')?.offsetHeight??0),available:node.clientHeight}]));
    const next={...pages};let moved=0;
    // 헌금 내역 stays on 4면; 좋은 소식 moves as one block, sermons individually.
    const news=items.filter(isNewsItem),candidates=[...(news.length?[{ids:news.map(item=>item.id),node:root.current?.querySelector<HTMLElement>('[data-print-group="news"]'),item:news[0]}]:[]),...items.filter(item=>item.kind==='sermon').map(item=>({ids:[item.id],node:root.current?.querySelector<HTMLElement>(`[data-print-item="${item.id}"]`),item}))];
    for(const {ids,node,item} of candidates){const from=next[item.id]??defaultPage(item),current=heights.get(from);if(!node||!current||current.used<=current.available)continue;
      const height=node.offsetHeight+2;
      const target=[2,3,4].filter(number=>number!==from).sort((a,b)=>heights.get(a)!.used-heights.get(b)!.used).find(number=>heights.get(number)!.used+height<=heights.get(number)!.available);
      if(target){ids.forEach(id=>{next[id]=target;});current.used-=height;heights.get(target)!.used+=height;moved++;}
    }
    if(moved){onPagesChange(next);setMessage('내용을 보존하며 지면 배치를 정리했습니다.');}else setMessage('이동할 여유 지면이 없습니다. 글자 크기나 면 배치를 조절해 주세요.');
  }
  async function print() {
    if(settingsStatus!=="ready"){setMessage("교회 예배시간을 불러온 뒤 인쇄해 주세요.");return;}
    const images = Array.from(root.current?.querySelectorAll<HTMLImageElement>("[data-print-item] img") ?? []);
    const expected = items.filter(item => item.kind === "image" && item.content?.assetId&&!item.content.disabled).length;
    if (images.length !== expected) { setMessage("이미지를 아직 불러오지 못했습니다. 이미지가 모두 표시된 뒤 다시 눌러 주세요."); return; }
    try { await Promise.all(images.map(image => image.decode())); await document.fonts.ready;
      const overflow = checkOverflow(); setOverflowPages(overflow);
      if (overflow.length) { setMessage(`${overflow.join("·")}면의 내용이 넘칩니다. 면 배치를 바꾸거나 편집 화면에서 내용을 줄여 주세요.`); return; }
      setMessage(""); window.print(); }
    catch { setMessage("이미지를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요."); }
  }
  const pageOf = (item: BulletinItem) => item.kind === "offering" ? 4 : (pages[item.id] ?? defaultPage(item));
  const sides = [{ label: "바깥면", pages: [4, 1] }, { label: "안쪽면", pages: [2, 3] }];
  // 좋은 소식 entries move together in the layout panel.
  const layoutRows = [...presentationItems(draft.items).filter(item=>!isNewsItem(item)&&item.kind!=="offering").map(item=>({ id:item.id, label:displayTitle(item.title)||"주보 항목", ids:[item.id], item })), ...(draft.items.some(isNewsItem)?[{ id:"news", label:"좋은 소식", ids:draft.items.filter(isNewsItem).map(item=>item.id), item:draft.items.find(isNewsItem)! }]:[])];
  const editable = draft.status === "draft";
  return createPortal(<PrintEditorProvider bulletinId={draft.id} editable={editable} onReplace={item=>{if(draft.status==="draft"&&draft.items.some(original=>original.id===item.id))onReplace(item);}}><div ref={root} tabIndex={-1} className={`${styles.overlay} ${overflowPages.length ? styles.badLayout : ""}`} role="dialog" aria-modal="true" aria-label="관리자 인쇄 미리보기">
    <header className={styles.topbar}>
      <button type="button" className={styles.closeButton} aria-label="미리보기 닫기" title="닫기" onClick={onClose}><AdminIcon name="back" size={20}/></button>
      <div className={styles.topTitle}><h2 id="print-title">인쇄 미리보기</h2><p>{draft.issueNumber}호 · {draft.serviceDate.replaceAll("-", ". ")} · A4 가로 반접지</p></div>
      <div className={styles.topActions}>
        {overflowPages.length ? <span className={styles.warn}>{overflowPages.join("·")}면 넘침</span> : null}
        {editable && overflowPages.length ? <button type="button" className={styles.tool} onClick={arrange}>지면 자동 정리</button> : null}
        <button type="button" className={styles.tool} aria-pressed={panel} aria-controls={panel?'print-layout-panel':undefined} onClick={() => setPanel(!panel)}>면 배치</button>
        <button type="button" className={`${styles.tool} ${styles.primaryTool}`} onClick={() => void print()}>인쇄 · PDF로 저장</button>
      </div>
    </header>
    <PrintFormatToolbar/>
    <div className={styles.notice} role="status" data-empty={!message&&!overflowPages.length&&settingsStatus!=="error"}>{overflowPages.length?`${overflowPages.join("·")}면 넘침: 면 배치나 글자 크기를 조절해 주세요. `:""}{message}{settingsStatus==="error"?<button type="button" className={styles.tool} onClick={retry}>예배시간 다시 불러오기</button>:null}</div>
    <p className={styles.blockedPrint}>내용이 면을 넘쳐 인쇄를 중단했습니다. 미리보기에서 면 배치를 조정한 뒤 다시 인쇄해 주세요.</p>
    <div className={styles.stage} data-panel={panel}>
      <div ref={stage} className={styles.canvas}>
        <div className={styles.paper} role="document" aria-label="인쇄 주보" style={{ zoom: scale }}>{sides.map(side => <div key={side.label} className={styles.sheetWrap}>
          <p className={styles.sheetLabel}>{side.label}</p>
          <div className={styles.sheet} data-sheet aria-label={side.label}>{side.pages.map(number => <section className={styles.panel} key={number} aria-label={`${number}면`} data-page={number} data-overflow={overflowPages.includes(number)}>
            <div className={styles.panelBody} data-print-panel={number}><div data-print-content className={styles.panelContent}>
              <PaperBlocks items={items.filter(item=>pageOf(item)===number)} meta={draft}
                memo={number===3?<Memo item={draft.items.find(item=>item.title.trim()==="메모")}/>:undefined}
/>
            </div>{number===4?<div className={styles.panelFooter} data-print-footer><ChurchInfo item={draft.items.find(item=>item.title.trim()==="교회 안내")} name={fields?.name||"꿈꾸는좋은교회"} address={fields?.address||CHURCH_ADDRESS} phone={fields?.phone||CHURCH_PHONE}/></div>:null}</div>
          </section>)}</div>
        </div>)}</div>
      </div>
      {panel ? <aside id="print-layout-panel" className={styles.side} aria-label="면 배치">
        <div className={styles.sideHead}><h3>면 배치</h3><button type="button" className={styles.iconButton} aria-label="면 배치 닫기" onClick={() => setPanel(false)}>×</button></div>
        {pageTitles.map((title, index) => { const number = index + 1; const entries = layoutRows.filter(row => pageOf(row.item) === number); return <section key={title} className={styles.sideGroup}>
          <h4>{title}{overflowPages.includes(number) ? <span className={styles.warn}>넘침</span> : null}</h4>
          {entries.length ? entries.map(row => <label className={styles.assignment} key={row.id}><span>{row.label}</span><select disabled={!editable} aria-label={`${row.label} 인쇄 면`} value={pages[row.item.id]??defaultPage(row.item)} onChange={event=>{const value=Number(event.target.value);onPagesChange({...pages,...Object.fromEntries(row.ids.map(id=>[id,value]))});setMessage("");}}>{pageTitles.map((option,i)=><option value={i+1} key={option}>{option}</option>)}</select></label>) : <p className={styles.sideEmpty}>배치된 항목 없음</p>}
        </section>; })}
        <div className={styles.sideNote}>
          <p><strong>인쇄 설정</strong> A4 가로 · 배율 100% · 여백 없음 · 머리글/바닥글 끔</p>
          <p>{dirty?"저장 전 변경도 표시합니다. ":""}웹 비공개 항목도 인쇄에 포함됩니다.{editable?" 문구를 클릭하면 바로 고칠 수 있고, 초안 저장에 반영됩니다.":" 게시된 주보의 문구는 읽기 전용입니다."}</p>
        </div>
      </aside> : null}
    </div>
  </div></PrintEditorProvider>, document.body);
}

export default function PrintPreview(props:Parameters<typeof PrintPreviewContent>[0]) { return <ChurchContentProvider><PrintPreviewContent {...props}/></ChurchContentProvider>; }
