"use client";
import { useEffect, useRef, useState } from "react";
import {PaperView} from "../admin/bulletins/paper";
import {PrintEditorProvider,type PrintFormats} from "../admin/bulletins/print-editor";
import {printOnlyItem,presentationItems,bulletinSections,sectionFor,renderedItems} from '@/lib/bulletin-editor';
import type { BulletinItem } from "@/lib/bulletins";
import { longDate, monthDay, yearMonth } from "@/lib/korean-date";
import SiteIcon from "../site-icon";
import { Skel, SkelLines, SkelRegion } from "../skeleton";
import styles from "./reader.module.css";
import PublicPdfDownload from "./public-pdf-download";
import SpecialLinks from "./special/special-links";
import NewsNavigation from '../news-navigation';
import site from '../public-site.module.css';

type PublicItem = Pick<BulletinItem, "id" | "title" | "body" | "kind" | "content">;
type Summary = { id: string; service_date: string; issue_number: number };

export default function PublicBulletins({ initialDate }: { initialDate?: string }) {
  const [rows, setRows] = useState<Summary[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false), [historyRetry, setHistoryRetry] = useState(0), [loadingMore, setLoadingMore] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [bulletin, setBulletin] = useState<(Summary & { items: PublicItem[]; printItems: BulletinItem[]; theme?: string; formats?: PrintFormats }) | null>(null);
  const [message, setMessage] = useState("주보를 불러오고 있습니다…"), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null), toggle = useRef<HTMLButtonElement>(null);

  // 지난 주보 list: newest first, 20 at a time.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/bulletins", { cache: "no-store", signal: controller.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        setRows(data.bulletins); setNextCursor(data.nextCursor ?? null); setHistoryFailed(false);
      } catch { if (!controller.signal.aborted) setHistoryFailed(true); }
    }
    void load(); window.addEventListener("focus", load);
    return () => { controller.abort(); window.removeEventListener("focus", load); };
  }, [historyRetry]);
  async function loadMore() {
    if (!nextCursor || loadingMore) return null;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/bulletins?before=${nextCursor}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const added = (data.bulletins as Summary[]);
      setRows(current => [...current, ...added.filter(row => !current.some(old => old.id === row.id))]); setNextCursor(data.nextCursor ?? null);
      return added;
    } catch { setHistoryFailed(true); return null; } finally { setLoadingMore(false); }
  }

  // Selected bulletin (refreshes while the page stays open).
  useEffect(() => {
    const controller = new AbortController();
    let requestNumber = 0;
    async function refresh() {
      const currentRequest = ++requestNumber;
      try {
        let selected = id;
        if (!selected && !initialDate) {
          const list = await fetch("/api/bulletins", { cache: "no-store", signal: controller.signal });
          const data = await list.json(); if (!list.ok) throw new Error(data.error);
          selected = data.bulletins[0]?.id ?? null;
          if (!selected) { if (currentRequest === requestNumber) { setBulletin(null); setFailed(false); setMessage("아직 게시된 주보가 없습니다."); } return; }
        }
        const query = selected ? `id=${encodeURIComponent(selected)}` : `date=${encodeURIComponent(initialDate!)}`;
        const detail = await fetch(`/api/bulletins?${query}`, { cache: "no-store", signal: controller.signal });
        const content = await detail.json();
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        if (!detail.ok) throw new Error(content.error);
        setBulletin({...content,items:presentationItems<PublicItem>(content.items).filter(item=>!printOnlyItem(item)),printItems:presentationItems<PublicItem>(content.items).map(item=>({webVisible:true,reviewOnCopy:false,needsReview:false,printPage:(item as {print_page?:number|null}).print_page??null,...item}) as BulletinItem)}); setMessage(""); setFailed(false);
      } catch (error) {
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        setBulletin(null); setFailed(true); setMessage(error instanceof Error ? error.message : "주보를 불러오지 못했습니다.");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id, retry, initialDate]);

  // Close the 지난 주보 panel on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !toggle.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  function select(row: Summary) {
    setOpen(false);
    if (bulletin?.id === row.id) return;
    setBulletin(null); setFailed(false); setMessage("주보를 불러오고 있습니다…"); setId(row.id);
    history.replaceState(null, "", `/bulletins/${row.service_date}`);
    document.getElementById("public-content")?.scrollIntoView({ block: "start" });
  }
  function jump(event: React.MouseEvent<HTMLAnchorElement>, section: number) {
    const target = document.getElementById(`bulletin-section-${section}`); if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // 사진·글꼴이 늦게 불러와 자리가 밀렸을 때, 이동이 끝난 뒤 한 번 더 맞춘다.
    const settle = () => {
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      if (Math.abs(target.getBoundingClientRect().top - margin) > 4 && window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) target.scrollIntoView({ behavior: "auto", block: "start" });
    };
    let done = false;
    const finish = () => { if (done) return; done = true; window.removeEventListener("scrollend", finish); settle(); };
    window.addEventListener("scrollend", finish); window.setTimeout(finish, reduce ? 50 : 1200);
  }
  const index = bulletin ? rows.findIndex(row => row.id === bulletin.id) : -1;
  const newer = index > 0 ? rows[index - 1] : null;
  const older = index >= 0 ? rows[index + 1] ?? null : null;
  async function goOlder() { if (older) return select(older); const added = await loadMore(); if (added?.[0]) select(added[0]); }
  const months = rows.reduce<{ label: string; rows: Summary[] }[]>((groups, row) => { const label = yearMonth(row.service_date); const last = groups.at(-1); if (last?.label === label) last.rows.push(row); else groups.push({ label, rows: [row] }); return groups; }, []);

  const historyControl = <>
      <div className={styles.historyWrap}>
        <button ref={toggle} type="button" className={styles.historyToggle} aria-expanded={open} aria-controls="bulletin-history" onClick={() => setOpen(value => !value)}>지난 주보<SiteIcon name="chevron" size={16} style={{ transform: open ? "rotate(180deg)" : undefined }} /></button>
        {open ? <div ref={panel} id="bulletin-history" className={styles.historyPanel} role="region" aria-label="지난 주보">
          {historyFailed ? <div className={styles.historyState}><p>목록을 불러오지 못했습니다.</p><button type="button" onClick={() => setHistoryRetry(n => n + 1)}>다시 불러오기</button></div>
            : !rows.length ? <p className={styles.historyState}>게시된 주보가 없습니다.</p>
            : <>{months.map(group => <section key={group.label}><h3>{group.label}</h3><ul>{group.rows.map(row => <li key={row.id}><button type="button" aria-label={`${longDate(row.service_date)} · ${row.issue_number}호`} aria-current={bulletin?.id === row.id ? "true" : undefined} onClick={() => select(row)}><span>{monthDay(row.service_date)}</span><small>{row.issue_number}호</small></button></li>)}</ul></section>)}
              {nextCursor ? <button type="button" className={styles.more} disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "불러오는 중…" : "더 보기"}</button> : null}</>}
        </div> : null}
      </div>
  </>;

  return <main id="public-content" tabIndex={-1} className={site.subpage}>
    <header className={site.pageHeading}><p className={site.eyebrow}>WEEKLY BULLETIN</p><h1>주일 주보</h1><p>말씀과 예배 순서, 이번 주 교회 소식을 만나보세요.</p></header><NewsNavigation />
    <div className={site.newsBody}>
    <SpecialLinks />
    <div className={styles.issueBar}>
      <button type="button" className={styles.step} aria-label="이전 주보" title="이전 주보" disabled={!bulletin || (!older && !nextCursor) || index < 0} onClick={() => void goOlder()}><SiteIcon name="arrow" size={18} style={{ transform: "scaleX(-1)" }} /></button>
      <div className={styles.issueTitle}>{bulletin ? <><strong>{longDate(bulletin.service_date)}</strong></> : <strong>{failed ? "주보" : " "}</strong>}</div>
      <button type="button" className={styles.step} aria-label="다음 주보" title="다음 주보" disabled={!newer} onClick={() => newer && select(newer)}><SiteIcon name="arrow" size={18} /></button>
    </div>
    {message && !message.includes("불러오고 있습니다") ? <p role="status" className={styles.message}>{message}</p> : null}
    {message && message.includes("불러오고 있습니다") ? <SkelRegion label="주보를 불러오는 중" className={styles.reading}><span className={styles.contents} aria-hidden="true" /><div className={styles.paper}><Skel w="56%" h={30} style={{ margin: '4px auto 26px' }} /><SkelLines n={4} h={18} gap={14} /><Skel h={34} style={{ margin: '34px 0 16px' }} /><SkelLines n={3} h={16} gap={12} /><Skel h={34} style={{ margin: '34px 0 16px' }} /><SkelLines n={4} h={16} gap={12} last="40%" /></div></SkelRegion> : null}
    {failed ? <button type="button" className={styles.retry} onClick={() => setRetry(value => value + 1)}>다시 불러오기</button> : null}
    {bulletin ? <div className={styles.reading}>
      <nav aria-label="주보 구역 바로가기" className={styles.contents}><h2>목차</h2><ul>{bulletinSections.flatMap((section, index) => (section === '예배 안내' || renderedItems(bulletin.items).some(item => sectionFor(item) === section)) ? [<li key={section}><a href={`#bulletin-section-${index}`} onClick={event => jump(event, index)}>{section}</a></li>] : [])}</ul></nav>
      <section className={styles.paper} aria-label={`${longDate(bulletin.service_date)} ${bulletin.issue_number}호 주보`}>
        {!bulletin.items.length ? <p>웹에 공개된 주보 항목이 없습니다.</p> : null}
        {bulletin.items.length ? <PrintEditorProvider key={`${bulletin.id}:${JSON.stringify(bulletin.formats ?? {})}`} bulletinId={bulletin.id} editable={false} plain webFormats initialFormats={bulletin.formats ?? {}} onReplace={() => {}}><PaperView items={bulletin.items.map(item => ({ webVisible: true, reviewOnCopy: false, needsReview: false, printPage: null, ...item }) as BulletinItem)} meta={{ serviceDate: bulletin.service_date, issueNumber: bulletin.issue_number }} sectionIdPrefix="bulletin-section" addSchedule theme={bulletin.theme}/></PrintEditorProvider> : null}
        <footer className={styles.paperFoot}><PublicPdfDownload key={bulletin.id} bulletin={bulletin} /><div className={styles.historyBar}>{historyControl}</div></footer>
      </section>
    </div> : null}
    {!bulletin ? <div className={styles.historyBar}>{historyControl}</div> : null}
    </div>
  </main>;
}
