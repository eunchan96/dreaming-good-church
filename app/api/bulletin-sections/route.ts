import { noStore, publicClient } from '@/lib/server-access';
import { selectBulletinSections, parseWorshipReadings } from '@/lib/public-bulletin-sections.mjs';

type Row = { service_date: string; issue_number: number; items: { id: string; position: number; title: string; body: string; kind: string; content: { reference?: string } | null }[] };
const filled = (item: Row['items'][number]) => !!(item.body?.trim() || item.content?.reference?.trim());

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const section = query.get('section'), date = query.get('date');
  if (section !== 'torah-tov' && section !== 'worship') return Response.json({ error: '안내 종류를 확인해 주세요.' }, { status: 400, headers: noStore });
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: '날짜를 확인해 주세요.' }, { status: 400, headers: noStore });
  try {
    // Anonymous client even when an editor visits: draft/private items must remain hidden.
    const select = publicClient().from('bulletins').select('service_date,issue_number,items:bulletin_items(id,position,title,body,kind,content)').eq('status', 'published').order('service_date', { ascending: false });
    if (section === 'worship') {
      const { data, error } = await select.limit(1).maybeSingle();
      if (error) throw error;
      const items = data?.items.sort((a, b) => a.position - b.position) ?? [];
      return Response.json({ readings: parseWorshipReadings(items), serviceDate: data?.service_date ?? null, issueNumber: data?.issue_number ?? null }, { headers: noStore });
    }
    // 토라&토브: every published week that carries it (newest first), plus the chosen week's entries.
    const { data, error } = await select.limit(260);
    if (error) throw error;
    const weeks = (data as Row[]).map(row => ({ row, items: (selectBulletinSections(row.items.sort((a, b) => a.position - b.position), 'torah-tov') as Row['items']).filter(filled) })).filter(week => week.items.length);
    const chosen = (date ? weeks.find(week => week.row.service_date === date) : weeks[0]) ?? null;
    const dates = weeks.map(({ row, items }) => ({ serviceDate: row.service_date, issueNumber: row.issue_number, reference: items.find(item => /토라|토브/.test(item.title))?.content?.reference?.trim() || items[0].content?.reference?.trim() || '' }));
    return Response.json({ dates, items: chosen?.items ?? [], serviceDate: chosen?.row.service_date ?? null, issueNumber: chosen?.row.issue_number ?? null }, { headers: noStore });
  } catch { return Response.json({ error: '주보의 공개 안내를 불러오지 못했습니다.' }, { status: 503, headers: noStore }); }
}
