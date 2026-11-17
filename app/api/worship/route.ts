import { connection } from 'next/server';
import { latestSundayVideo } from '@/lib/worship-video';
export async function GET() {
  await connection();
  return Response.json(await latestSundayVideo(), { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
}
