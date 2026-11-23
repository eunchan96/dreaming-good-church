import type { CSSProperties } from "react";
import styles from "./skeleton.module.css";

/** 불러오는 동안 글자 대신 보여 주는 흐릿한 자리 표시. 스크린 리더에는 한 번만 "불러오는 중"으로 알린다. */
export function Skel({ w = "100%", h = 14, className, style }: { w?: number | string; h?: number; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`${styles.skel} ${className ?? ""}`} style={{ width: w, height: h, ...style }} />;
}
/** 여러 줄 글 자리: 마지막 줄은 짧게 */
export function SkelLines({ n = 3, h = 14, gap = 10, last = "62%" }: { n?: number; h?: number; gap?: number; last?: string }) {
  return <span aria-hidden="true" className={styles.lines} style={{ gap }}>{Array.from({ length: n }, (_, i) => <Skel key={i} h={h} w={i === n - 1 && n > 1 ? last : "100%"} />)}</span>;
}
/** 감싸는 영역: aria-busy와 숨은 안내 문구 */
export function SkelRegion({ label = "불러오는 중", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return <div role="status" aria-busy="true" className={className}><span className={styles.sr}>{label}</span>{children}</div>;
}
