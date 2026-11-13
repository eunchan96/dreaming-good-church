import { noStore, publicClient } from '@/lib/server-access';
import { selectBulletinSections } from '@/lib/public-bulletin-sections.mjs';
export async function GET(request: Request) {
  const section = new URL(request.url).searchParams.get('section');
  if (section !== 'torah-tov' && section !== 'worship') return Response.json({ error: '안내 종류를 확인해 주세요.' }, { status: 400, headers: noStore });
  try {
    // Anonymous client even when an editor visits: draft/private items must remain hidden.
    const { data, error } = await publicClient().from('bulletins').select('service_date,issue_number,items:bulletin_items(id,position,title,body,kind,content)').eq('status', 'published').order('service_date', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return Response.json(data ? { serviceDate: data.service_date, issueNumber: data.issue_number, items: selectBulletinSections(data.items.sort((a,b) => a.position-b.position), section) } : { items: [], serviceDate: null }, { headers: noStore });
  } catch { return Response.json({ error: '주보의 공개 안내를 불러오지 못했습니다.' }, { status: 503, headers: noStore }); }
}
