import { connection } from 'next/server';
import { noStore, requireEditor } from '@/lib/server-access';
import { listSongs, SongsUnavailable } from '@/lib/notion-songs';

/** 찬양 곡 목록(관리자 전용). */
export async function GET(request: Request) {
  await connection();
  try { if (!await requireEditor(request)) return Response.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401, headers: noStore }); }
  catch { return Response.json({ error: '관리자 확인을 하지 못했습니다.' }, { status: 503, headers: noStore }); }
  try { return Response.json({ songs: await listSongs() }, { headers: noStore }); }
  catch (error) { return Response.json({ error: error instanceof SongsUnavailable ? error.message : '찬양 곡 DB를 불러오지 못했습니다.' }, { status: 503, headers: noStore }); }
}
