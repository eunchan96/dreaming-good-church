"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./status-message.module.css";

/** "저장했습니다." 처럼 성공을 알리는 말인지(실패·부정 표현은 제외). */
export function isSuccessMessage(message: string) {
  const text = message.trim();
  return /(했습니다|했어요)/.test(text) && !/못했|않았|없습니다|실패|오류|확인해 주세요/.test(text);
}

function Toast({ children, onDone, attrs }: { children: ReactNode; onDone?: () => void; attrs?: Record<string, string | boolean> }) {
  const [gone, setGone] = useState(false), done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => { const timer = setTimeout(() => { setGone(true); done.current?.(); }, 3500); return () => clearTimeout(timer); }, []);
  return gone ? null : <p role="status" className={styles.toast} {...attrs}>{children}</p>;
}

/** 성공 안내는 화면 아래에 떴다가 서서히 사라지는 플로팅 메시지로, 그 밖의 안내(오류·확인 요청)는 제자리에 그대로 둔다. */
export default function StatusMessage({ message, className, onDone, attrs, toast = false }: { message: string; className?: string; onDone?: () => void; attrs?: Record<string, string | boolean>; toast?: boolean }) {
  if (!message) return null;
  if (toast || isSuccessMessage(message)) return <Toast key={message} onDone={onDone} attrs={attrs}>{message}</Toast>;
  return <p role="status" className={className} {...attrs}>{message}</p>;
}
