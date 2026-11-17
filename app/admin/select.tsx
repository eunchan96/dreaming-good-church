'use client';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './select.module.css';

export type SelectOption = { value: string; label: ReactNode; hint?: ReactNode };
type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  'aria-label'?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'medium';
  placeholder?: ReactNode;
};

/**
 * Admin dropdown: a button that opens a rounded list (check mark on the current choice) instead of the
 * browser's native menu. Keyboard: ↑/↓/Enter/Space opens, ↑/↓/Home/End move, Enter/Space picks, Esc/Tab closes.
 */
export default function Select({ value, options, onChange, id, disabled, className, size = 'medium', placeholder, ...rest }: Props) {
  const [open, setOpen] = useState(false), [up, setUp] = useState(false), [end, setEnd] = useState(false);
  const root = useRef<HTMLSpanElement>(null), button = useRef<HTMLButtonElement>(null), list = useRef<HTMLSpanElement>(null);
  const current = options.find(option => option.value === value), uid = useId(), label = rest['aria-label'];
  const items = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role=option]') ?? [])];
  useLayoutEffect(() => {
    if (!open) return;
    // Open upward when there is clearly more room above (e.g. near the bottom of a dialog).
    // Line it up with the right edge when it would run off the right side of the screen.
    const box = button.current?.getBoundingClientRect(), height = list.current?.offsetHeight ?? 0, width = list.current?.offsetWidth ?? 0;
    if (box) { setUp(window.innerHeight - box.bottom < height + 12 && box.top > window.innerHeight - box.bottom); setEnd(box.left + width > window.innerWidth - 8); }
    (items().find(item => item.getAttribute('aria-selected') === 'true') ?? items()[0])?.focus();
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  function close(focus = true) { setOpen(false); if (focus) button.current?.focus(); }
  function pick(next: string) { if (next !== value) onChange(next); close(); }
  function onButtonKey(event: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); }
  }
  function onListKey(event: KeyboardEvent) {
    const all = items(), index = all.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => { event.preventDefault(); all[Math.max(0, Math.min(all.length - 1, to))]?.focus(); };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(all.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close(false);
  }
  return <span ref={root} className={`${styles.select} ${className ?? ''}`} data-size={size}>
    <button ref={button} id={id} type="button" className={styles.trigger} aria-labelledby={label ? `${uid}-label ${uid}-value` : undefined} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)} onKeyDown={onButtonKey}>
      {label ? <span id={`${uid}-label`} hidden>{label}</span> : null}
      <span id={`${uid}-value`} className={styles.value} data-placeholder={!current || undefined}>{current?.label ?? placeholder ?? '선택'}</span>
      <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open ? <span ref={list} role="listbox" aria-label={label} className={styles.list} data-up={up || undefined} data-end={end || undefined} onKeyDown={onListKey}>
      {options.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={styles.option} onClick={() => pick(option.value)}>
        <span className={styles.optionLabel}>{option.label}{option.hint ? <small>{option.hint}</small> : null}</span>
        {option.value === value ? <svg className={styles.check} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}
      </button>)}
    </span> : null}
  </span>;
}
