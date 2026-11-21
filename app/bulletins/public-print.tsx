"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CHURCH_ADDRESS, CHURCH_PHONE } from "@/lib/site-content";
import { useChurchContent } from "../church-content";
import { PrintEditorProvider, type PrintFormats } from "../admin/bulletins/print-editor";
import { PaperBlocks, Memo, ChurchInfo, useScheduledItems } from "../admin/bulletins/paper";
import { defaultPage } from "../admin/bulletins/print-preview";
import type { BulletinItem } from "@/lib/bulletins";
import styles from "../admin/bulletins/print-preview.module.css";
import reader from "./reader.module.css";

export type PrintableBulletin = { id: string; service_date: string; issue_number: number; printItems: BulletinItem[]; formats?: PrintFormats };
const sides = [{ label: "바깥면", pages: [4, 1] }, { label: "안쪽면", pages: [2, 3] }];

/** 관리자 인쇄 미리보기와 같은 시트를 화면 밖에 그리고, 준비되면 인쇄(PDF로 저장) 창을 연다. */
export default function PublicPrint({ bulletin, onDone, onError }: { bulletin: PrintableBulletin; onDone: () => void; onError: (message: string) => void }) {
  const { fields, settingsStatus } = useChurchContent();
  const items = useScheduledItems(bulletin.printItems, true);
  const root = useRef<HTMLDivElement>(null);
  const pageOf = (item: BulletinItem) => item.kind === "offering" ? 4 : (item.printPage ?? defaultPage(item));
  // 예배 순서 줄 높이: 면에 꽉 차는 가장 넓은 값 (관리자 인쇄 미리보기와 같은 계산)
  const fit = () => root.current?.querySelectorAll<HTMLElement>("[data-print-panel]").forEach(body => {
    const panel = body.closest<HTMLElement>("[data-page]");
    if (!panel || !body.querySelector("[data-order-row]")) { panel?.style.removeProperty("--order-row"); return; }
    let size = 2.7; panel.style.setProperty("--order-row", `${size}em`);
    while (size > 1.6 && body.scrollHeight > body.clientHeight + 1) { size = Math.round((size - 0.05) * 100) / 100; panel.style.setProperty("--order-row", `${size}em`); }
  });
  useLayoutEffect(() => { fit(); });
  useEffect(() => {
    if (settingsStatus === "error") { onError("교회 예배시간을 불러오지 못해 PDF를 만들지 못했습니다. 다시 시도해 주세요."); onDone(); return; }
    if (settingsStatus !== "ready") return;
    let live = true;
    (async () => {
      const expected = new Set(items.filter(item => item.kind === "image" && item.content?.assetId && !item.content.disabled).map(item => item.content!.assetId)).size;
      for (let waited = 0; waited < 12000; waited += 150) {
        const photos = Array.from(root.current?.querySelectorAll<HTMLImageElement>("img[data-asset-id]") ?? []);
        if (new Set(photos.map(photo => photo.dataset.assetId)).size >= expected && photos.every(photo => photo.complete)) break;
        await new Promise(resolve => window.setTimeout(resolve, 150));
      }
      if (!live) return;
      const all = Array.from(root.current?.querySelectorAll<HTMLImageElement>("img") ?? []);
      all.forEach(image => { image.loading = "eager"; });
      try { await Promise.all(all.map(image => image.decode().catch(() => undefined))); await document.fonts.ready; } catch { /* 계속 진행 */ }
      fit(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!live) return;
      const title = document.title; document.title = `${bulletin.service_date.slice(2).replaceAll("-", "")} 주일 주보`;
      const finish = () => { document.title = title; window.removeEventListener("afterprint", finish); onDone(); };
      window.addEventListener("afterprint", finish); window.setTimeout(finish, 180000);
      window.print();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsStatus]);
  const memo = bulletin.printItems.find(item => item.title.trim() === "메모");
  const church = bulletin.printItems.find(item => item.title.trim() === "교회 안내");
  const meta = { serviceDate: bulletin.service_date, issueNumber: bulletin.issue_number };
  return createPortal(<PrintEditorProvider key={bulletin.id} bulletinId={bulletin.id} editable={false} plain initialFormats={bulletin.formats ?? {}} onReplace={() => {}}>
    <div ref={root} className={`${styles.overlay} ${reader.printHost}`} aria-hidden="true">
      <div className={styles.stage}><div className={styles.canvas}><div className={styles.paper} style={{ zoom: 1 }}>{sides.map(side => <div key={side.label} className={styles.sheetWrap}>
        <div className={styles.sheet} data-sheet>{side.pages.map(number => <section className={styles.panel} key={number} data-page={number}>
          <div className={styles.panelBody} data-print-panel={number}><div data-print-content className={styles.panelContent}>
            <PaperBlocks items={items.filter(item => pageOf(item) === number)} meta={meta} memo={number === 3 ? <Memo item={memo} /> : undefined} />
          </div>{number === 4 ? <div className={styles.panelFooter} data-print-footer><ChurchInfo item={church} name={fields?.name || "꿈꾸는좋은교회"} address={fields?.address || CHURCH_ADDRESS} phone={fields?.phone || CHURCH_PHONE} /></div> : null}</div>
        </section>)}</div>
      </div>)}</div></div></div>
    </div>
  </PrintEditorProvider>, document.body);
}
