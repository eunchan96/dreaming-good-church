import { connection } from 'next/server';
import { noStore, requireEditor } from '@/lib/server-access';
import { songDetail, songFile, SongsUnavailable } from '@/lib/notion-songs';

const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** 곡 상세(가사·악보 본문)와, `?ppt=0`처럼 부르면 그 PPT 파일의 새 다운로드 주소(관리자 전용). */
export async function GET(request: Request, { params }: RouteContext<'/api/songs/[id]'>) {
  await connection();
  const { id } = await params, ppt = new URL(request.url).searchParams.get('ppt');
  if (!uuid.test(id) || (ppt !== null && !/^\d{1,2}$/.test(ppt))) return Response.json({ error: '올바른 곡이 아닙니다.' }, { status: 400, headers: noStore });
  try { if (!await requireEditor(request)) return Response.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401, headers: noStore }); }
  catch { return Response.json({ error: '관리자 확인을 하지 못했습니다.' }, { status: 503, headers: noStore }); }
  try {
    if (ppt !== null) {
      const file = await songFile(id, Number(ppt));
      return file ? Response.json(file, { headers: noStore }) : Response.json({ error: 'PPT 파일을 찾을 수 없습니다.' }, { status: 404, headers: noStore });
    }
    return Response.json(await songDetail(id), { headers: noStore });
  } catch (error) {
    return Response.json({ error: error instanceof SongsUnavailable ? error.message : '곡 정보를 불러오지 못했습니다.' }, { status: 503, headers: noStore });
  }
}
