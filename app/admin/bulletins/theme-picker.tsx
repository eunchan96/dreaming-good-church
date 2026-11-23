"use client";
import { bulletinThemes, themeOf } from "@/lib/bulletin-themes";
import styles from "./theme-picker.module.css";

/** 주보 테마 선택: 색 견본과 이름이 있는 칩. 초안일 때만 바꿀 수 있다. */
export default function ThemePicker({ value, disabled, onChange }: { value?: string; disabled?: boolean; onChange: (key: string) => void }) {
  const current = themeOf(value);
  return <div className={styles.picker}>
    <div className={styles.chips} role="radiogroup" aria-label="주보 테마">
      {bulletinThemes.map(theme => <button key={theme.key} type="button" role="radio" aria-checked={theme.key === current.key} disabled={disabled} className={styles.chip} title={theme.description} onClick={() => onChange(theme.key)}>
        <span className={styles.dots} aria-hidden="true"><i style={{ background: theme.swatch[0] }} /><i style={{ background: theme.swatch[1] }} /></span>{theme.name}
      </button>)}
    </div>
    <p className={styles.hint}>{current.description}. 웹 주보·인쇄·PDF에 모두 적용돼요.</p>
  </div>;
}
