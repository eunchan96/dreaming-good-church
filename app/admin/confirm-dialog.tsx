"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./confirm-dialog.module.css";

export type ConfirmOptions = {
  title: string;
  /** 본문(줄바꿈은 문단으로 나뉨) */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: 삭제처럼 되돌리기 어려운 동작은 빨간 확인 버튼 */
  tone?: "default" | "danger";
};

/** 브라우저 기본 confirm() 대신 쓰는 사이트 모양의 확인 창. `const [confirm, dialog] = useConfirm()` 후 `await confirm({...})`, dialog를 화면에 한 번 그린다. */
export function useConfirm() {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setState({ options, resolve })), []);
  const dialog: ReactNode = state ? <ConfirmDialog options={state.options} onAnswer={value => { state.resolve(value); setState(null); }} /> : null;
  return [confirm, dialog] as const;
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (value: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const answered = useRef(false);
  const answer = useCallback((value: boolean) => { if (answered.current) return; answered.current = true; dialog.current?.close(); onAnswer(value); }, [onAnswer]);
  useEffect(() => { const node = dialog.current; if (node && !node.open) node.showModal(); }, []);
  const paragraphs = (options.message ?? "").split("\n").filter(Boolean);
  return <dialog ref={dialog} className={styles.dialog} data-confirm aria-labelledby="confirm-title" aria-describedby={paragraphs.length ? "confirm-message" : undefined}
    onCancel={event => { event.preventDefault(); answer(false); }}
    onClick={event => { if (event.target === dialog.current) answer(false); }}>
    <div className={styles.body}>
      <h2 id="confirm-title" className={styles.title}>{options.title}</h2>
      {paragraphs.length ? <div id="confirm-message" className={styles.message}>{paragraphs.map((line, index) => <p key={index}>{line}</p>)}</div> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} data-confirm-cancel onClick={() => answer(false)}>{options.cancelLabel ?? "취소"}</button>
        <button type="button" className={`${styles.confirm} ${options.tone === "danger" ? styles.danger : ""}`} autoFocus data-confirm-ok onClick={() => answer(true)}>{options.confirmLabel ?? "확인"}</button>
      </div>
    </div>
  </dialog>;
}
