import { notFound } from 'next/navigation';
import { worshipTypes } from '@/lib/site-content';
import WorshipPage from '../worship-page';
export function generateStaticParams() { return worshipTypes.filter(w => w.key !== 'sunday').map(w => ({ type: w.key })); }
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params; const selected = worshipTypes.find(w => w.key === type);
  if (!selected) notFound();
  return <WorshipPage type={selected.key} />;
}
