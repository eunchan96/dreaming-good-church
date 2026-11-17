'use client';
import { useEffect, useRef } from 'react';
import type { SavedBulletin } from '@/lib/bulletin-store';

type Snapshot = Pick<SavedBulletin, 'serviceDate' | 'issueNumber' | 'items'>;
const snap = (d: SavedBulletin): Snapshot => ({ serviceDate: d.serviceDate, issueNumber: d.issueNumber, items: d.items });
const key = (s: Snapshot) => JSON.stringify([s.serviceDate, s.issueNumber, s.items]);

/**
 * Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y) for the bulletin editor.
 * Keystrokes within ~0.7s are one step, saves that only change revision/status are not steps,
 * and undo restores content only (revision/status stay current so saving keeps working).
 */
export function useEditHistory(draft: SavedBulletin | null, active: boolean, apply: (next: Snapshot) => void) {
  const past = useRef<Snapshot[]>([]), future = useRef<Snapshot[]>([]);
  const last = useRef<{ id: string | null; key: string; snapshot: Snapshot | null; at: number; restoring: boolean }>({ id: null, key: '', snapshot: null, at: 0, restoring: false });
  useEffect(() => {
    const state = last.current;
    if (!draft || !active) { state.id = null; past.current = []; future.current = []; return; }
    const current = snap(draft), currentKey = key(current);
    if (state.id !== draft.id) { Object.assign(state, { id: draft.id, key: currentKey, snapshot: current, at: 0, restoring: false }); past.current = []; future.current = []; return; }
    if (currentKey === state.key) return;
    if (state.restoring) { state.restoring = false; }
    else {
      const now = Date.now();
      if (now - state.at > 700 && state.snapshot) { past.current.push(state.snapshot); if (past.current.length > 100) past.current.shift(); }
      state.at = now; future.current = [];
    }
    state.key = currentKey; state.snapshot = current;
  }, [draft, active]);
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase(), redo = (k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey);
      if (k !== 'z' && !redo) return;
      if (document.querySelector('dialog[open]')) return; // dialogs keep their own text undo
      const from = redo ? future.current : past.current, to = redo ? past.current : future.current;
      e.preventDefault();
      const target = from.pop(), state = last.current;
      if (!target || !state.snapshot) return;
      to.push(state.snapshot); state.restoring = true; state.at = 0;
      apply(target);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, apply]);
}
