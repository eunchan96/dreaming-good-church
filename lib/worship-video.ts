import { cacheLife } from 'next/cache';
import { parseSundayVideo, VERIFIED_SUNDAY_VIDEO } from './youtube-video.mjs';
export async function latestSundayVideo() {
  'use cache';
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  try {
    const response = await fetch('https://www.youtube.com/@%EA%BF%88%EA%BE%B8%EB%8A%94%EC%A2%8B%EC%9D%80%EA%B5%90%ED%9A%8C/videos', { signal: AbortSignal.timeout(6000) });
    if (!response.ok || !response.body) return VERIFIED_SUNDAY_VIDEO;
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 3000000) { await reader.cancel(); return VERIFIED_SUNDAY_VIDEO; } chunks.push(value); }
    return parseSundayVideo(Buffer.concat(chunks).toString('utf8')) ?? VERIFIED_SUNDAY_VIDEO;
  } catch { return VERIFIED_SUNDAY_VIDEO; }
}
