"use client";
import { useEffect, useRef, useState } from "react";
import { specialSections } from "@/lib/special-programs";
import SpecialView from "@/app/bulletins/special/special-view";
import { koreaWhen, longDate } from "@/lib/korean-date";
import { setSpecialPublication, specialErrorMessage, type SpecialRow } from "@/lib/special-programs-store";
import type { BrowserClient } from "@/lib/bulletin-store";
import { useConfirm } from "../confirm-dialog";
import SaveButton from "../save-button";
import AdminIcon from "../admin-icons";
import ScheduleDialog from "./schedule-dialog";
import polish from "./editor.module.css";
import view_ from "./view.module.css";
import styles from "./special-detail.module.css";

const isScheduled = (row: SpecialRow) => row.status === "published" && !!row.publishAt && new Date(row.publishAt).getTime() > Date.now();
export const specialStatusLabel = (row: SpecialRow) => row.status === "draft" ? "초안" : isScheduled(row) ? `예약 · ${koreaWhen(row.publishAt as string)}` : "게시됨";
export const specialStatus = (row: SpecialRow) => isScheduled(row) ? "scheduled" : row.status;

/** 주보 상세와 같은 화면 틀로 특별 순서지를 보여 준다: 웹 미리보기는 본문에, 인쇄 미리보기는 버튼으로. 내용은 고치지 않고 게시·예약·게시 취소만 한다. */
export default function SpecialDetail({ program, client, onBack, onChanged, onMessage }: {
  program: SpecialRow; client: BrowserClient; onBack: () => void; onChanged: (row: SpecialRow) => void; onMessage: (text: string) => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false), [scheduleOpen, setScheduleOpen] = useState<string | null>(null);
  const [printUrl, setPrintUrl] = useState<string | null>(null), [printing, setPrinting] = useState(false);
  const printDialog = useRef<HTMLDialogElement>(null);
  const [spacer, setSpacer] = useState(0);
  const spacerRef = useRef(0);

  async function change(publish: boolean, scheduledIso?: string) {
    if (busy) return;
    if (!scheduledIso && !await confirm(publish
      ? { title: "순서지를 웹에 게시할까요?", message: "게시하면 공개 주보 화면의 특별 순서지에 바로 나타납니다.", confirmLabel: "게시" }
      : { title: "게시를 취소할까요?", message: "공개 화면에서 내려갑니다. 내용은 그대로 남아 있어요.", confirmLabel: "게시 취소", tone: "danger" })) return;
    setBusy(true); onMessage("");
    try {
      const updated = await setSpecialPublication(client, program.slug, publish, scheduledIso);
      onChanged(updated);
      onMessage(publish ? (scheduledIso ? `${koreaWhen(scheduledIso)} 공개로 예약했습니다.` : "순서지를 게시했습니다.") : "게시를 취소했습니다.");
    } catch (error) { onMessage(specialErrorMessage(error)); } finally { setBusy(false); }
  }

  // 인쇄 미리보기: 올려 둔 PDF를 편집자 권한으로 받아 창에서 보여 준다(공개 전에도 볼 수 있다).
  async function openPrint() {
    if (!program.pdfPath) { onMessage("인쇄용 PDF가 아직 올라와 있지 않습니다."); return; }
    setPrinting(true);
    try {
      const { data, error } = await client.storage.from("special-programs").download(program.pdfPath);
      if (error || !data) throw error ?? new Error("empty");
      setPrintUrl(URL.createObjectURL(data));
    } catch { onMessage("인쇄용 PDF를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); } finally { setPrinting(false); }
  }
  useEffect(() => { if (printUrl) printDialog.current?.showModal(); }, [printUrl]);
  useEffect(() => () => { if (printUrl) URL.revokeObjectURL(printUrl); }, [printUrl]);
  const closePrint = () => { printDialog.current?.close(); setPrintUrl(null); };

  // 빠른 이동으로 마지막 구역(광고)도 다른 구역처럼 화면 위쪽에 놓이도록, 문서 끝에 모자란 만큼만 빈 칸을 둔다.
  useEffect(() => {
    const last = specialSections(program.content, "detail-section").at(-1)?.id;
    if (!last) return;
    const measure = () => {
      const target = document.getElementById(last); if (!target) return;
      const base = document.documentElement.scrollHeight - spacerRef.current;
      const top = target.getBoundingClientRect().top + window.scrollY;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const need = Math.max(0, Math.round(window.innerHeight - margin - (base - top)));
      spacerRef.current = need; setSpacer(need);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [program.content]);

  const draft = program.status === "draft";
  return <>
    <div id="editor-tools" tabIndex={-1} className={view_.bar}>
      <button type="button" className={`${view_.btn} ${view_.ghost} ${view_.back}`} aria-label="주보 목록 돌아가기" disabled={busy} onClick={onBack}><AdminIcon name="back" size={16} />주보 목록</button>
      <div className={view_.titleRow}>
        <div>
          <div className={view_.titleLine}><h2>{program.title}</h2><span className={view_.pill} data-status={specialStatus(program)}>{specialStatusLabel(program)}</span></div>
          <p>{longDate(program.serviceDate)} · 특별 순서지</p>
        </div>
        <div className={view_.actions}>
          <button type="button" className={view_.btn} disabled={busy || printing} onClick={() => void openPrint()}>{printing ? "불러오는 중…" : "인쇄 미리보기"}</button>
          {draft
            ? <>
              <button type="button" className={view_.btn} disabled={busy} onClick={() => setScheduleOpen(new Date(Date.now() + 9 * 3600000 + 86400000).toISOString().slice(0, 10))}>예약 공개</button>
              <SaveButton className={`${view_.btn} ${view_.primary}`} disabled={busy} disabledHint="처리 중입니다." onClick={() => void change(true)}>게시하기</SaveButton>
            </>
            : <button type="button" className={`${view_.btn} ${view_.ghost}`} disabled={busy} onClick={() => void change(false)}>게시 취소</button>}
        </div>
      </div>
    </div>
    <section className={`${polish.reader} ${view_.reader}`} aria-label="특별 순서지 상세 내용">
      <SpecialView content={program.content} label={program.title} plain sectionIdPrefix="detail-section" />
    </section>
    <div aria-hidden="true" style={{ height: spacer }} />
    {confirmDialog}
    {scheduleOpen ? <ScheduleDialog defaultDate={scheduleOpen} onCancel={() => setScheduleOpen(null)} onSubmit={iso => { setScheduleOpen(null); void change(true, iso); }} /> : null}
    {printUrl ? <dialog ref={printDialog} className={styles.print} aria-label="인쇄 미리보기" onCancel={event => { event.preventDefault(); closePrint(); }}>
      <div className={styles.printBar}><strong>인쇄 미리보기</strong><a href={printUrl} download={`program-${program.slug}.pdf`}>PDF로 내려받기</a><button type="button" onClick={closePrint}>닫기</button></div>
      <iframe title={`${program.title} 인쇄용 PDF`} src={printUrl} />
    </dialog> : null}
  </>;
}
