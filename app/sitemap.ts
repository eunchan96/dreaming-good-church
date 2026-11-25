import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { publicClient } from '@/lib/server-access';
import { worshipTypes } from '@/lib/site-content';
import { SITE_URL } from '@/lib/site';

type Entry = MetadataRoute.Sitemap[number];
const page = (path: string, changeFrequency: Entry['changeFrequency'], priority: number): Entry => ({ url: `${SITE_URL}${path}`, changeFrequency, priority });

/** 공개 화면 목록. 관리자·API·정책 화면은 넣지 않는다. 공개된 주보는 날짜별 주소를 함께 넣는다. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const pages: MetadataRoute.Sitemap = [
    page('/', 'weekly', 1),
    page('/church', 'monthly', 0.8),
    page('/church/worship-times', 'monthly', 0.8),
    page('/church/directions', 'yearly', 0.7),
    page('/church/offering', 'yearly', 0.4),
    ...worshipTypes.map(w => page(w.key === 'sunday' ? '/worship' : `/worship/${w.key}`, 'weekly', w.key === 'sunday' ? 0.8 : 0.6)),
    page('/bulletins', 'weekly', 0.8),
    page('/notices', 'weekly', 0.6),
    page('/events', 'weekly', 0.6),
    page('/torah-tov', 'weekly', 0.5),
  ];
  try {
    const { data, error } = await publicClient().from('bulletins').select('service_date').eq('status', 'published').order('service_date', { ascending: false }).limit(200);
    if (!error && data) for (const b of data) pages.push(page(`/bulletins/${b.service_date}`, 'monthly', 0.5));
  } catch { /* 주보 목록을 못 읽어도 기본 화면 목록은 낸다. */ }
  return pages;
}
