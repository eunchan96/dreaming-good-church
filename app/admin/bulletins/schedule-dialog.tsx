"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DatePicker } from "../calendar";
import TimePicker from "../time-picker";
import { fromKoreaLocal, koreaWhen } from "@/lib/korean-date";
import confirmStyles from "../confirm-dialog.module.css";
import styles from "./schedule-dialog.module.css";

const isPast = (iso: string) => new Date(iso).getTime() <= Date.now();

/** 예약 공개 시각 선택 창. 날짜는 달력, 시간은 시계로 고르고 '예약 게시'를 누르면 ISO 시각을 넘긴다. 열 때만 그린다. */
export default function ScheduleDialog({ defaultDate, onSubmit, onCancel }: { defaultDate: string; onSubmit: (iso: string) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(defaultDate), [time, setTime] = useState("09:00"), [error, setError] = useState("");
  useEffect(() => { const node = dialog.current; if (node && !node.open) node.showModal(); }, []);
  const cancel = useCallback(() => { dialog.current?.close(); onCancel(); }, [onCancel]);
  const iso = date && time ? fromKoreaLocal(`${date}T${time}`) : null;
  function submit() {
    if (!iso || isPast(iso)) { setError("지금보다 뒤의 날짜와 시간을 골라 주세요."); return; }
    dialog.current?.close();
    onSubmit(iso);
  }
  return <dialog ref={dialog} className={confirmStyles.dialog} data-confirm data-schedule aria-labelledby="schedule-title"
    onCancel={event => { event.preventDefault(); cancel(); }}>
    <div className={confirmStyles.body}>
      <h2 id="schedule-title" className={confirmStyles.title}>예약 공개</h2>
      <div className={confirmStyles.message}><p>정한 날짜와 시간(한국 시간)에 공개 주보에 나타납니다. 그때까지는 공개되지 않아요.</p></div>
      <div className={styles.fields}>
        <div><span className={styles.label}>날짜</span><DatePicker label="공개 날짜" value={date} onChange={value => { setDate(value); setError(""); }} /></div>
        <div><span className={styles.label}>시간</span><TimePicker label="공개 시간" value={time} onChange={value => { setTime(value); setError(""); }} /></div>
      </div>
      <p className={styles.summary} role={error ? "alert" : undefined} data-error={error ? "true" : undefined}>{error || (iso ? `${koreaWhen(iso)}에 공개됩니다.` : "날짜와 시간을 골라 주세요.")}</p>
      <div className={confirmStyles.actions}>
        <button type="button" className={confirmStyles.cancel} data-confirm-cancel onClick={cancel}>취소</button>
        <button type="button" className={confirmStyles.confirm} data-confirm-ok onClick={submit}>예약 게시</button>
      </div>
    </div>
  </dialog>;
}
