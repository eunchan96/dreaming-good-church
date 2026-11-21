'use client';
import { useEffect, useState } from 'react';
import type { WorshipType } from '@/lib/site-content';
import { readingWeekLabel } from '@/lib/reading-week';
import styles from '../public-site.module.css';

/** "이번 주 본문 · 사도행전 12장" for the chosen worship, from the latest public bulletin; hidden when there is none or it is too old. */
export default function WeeklyPassage({ type }: { type: WorshipType }) {
  const [reading, setReading] = useState<{ label: string; text: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/bulletin-sections?section=worship', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json() as { serviceDate: string | null; readings: Partial<Record<string, string>> };
        const label = data.serviceDate ? readingWeekLabel(data.serviceDate) : null;
        const text = data.readings?.[type]?.trim();
        setReading(label && text ? { label, text } : null);
      })
      .catch(() => { if (!controller.signal.aborted) setReading(null); });
    return () => controller.abort();
  }, [type]);
  return reading ? <p className={styles.weeklyPassage}><b>{reading.label} 본문</b><span>{reading.text}</span></p> : null;
}
