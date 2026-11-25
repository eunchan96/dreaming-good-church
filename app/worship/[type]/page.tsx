import { notFound } from 'next/navigation';
import { worshipTypes } from '@/lib/site-content';
import WorshipPage from '../worship-page';
import { pageMeta } from '@/lib/site';
export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params; const w = worshipTypes.find(x => x.key === type);
  return w ? pageMeta(w.name, `꿈꾸는좋은교회 ${w.name}(${w.time}) 영상과 예배 시간을 안내합니다.`, `/worship/${w.key}`) : {};
}
export function generateStaticParams() { return worshipTypes.filter(w => w.key !== 'sunday').map(w => ({ type: w.key })); }
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params; const selected = worshipTypes.find(w => w.key === type);
  if (!selected) notFound();
  return <WorshipPage type={selected.key} />;
}
