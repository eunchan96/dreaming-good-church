export const VERIFIED_SUNDAY_VIDEO = { id: 'OSfMkv-YWJQ', title: '네가 나를 사랑하느냐 (요한복음 21:1-17)', source: 'verified', label: '최근 확인한 주일 말씀' };
export function parseSundayVideo(html) {
  if (html.length > 3000000) return null;
  const match = html.match(/var ytInitialData = (.*?);<\/script>/s);
  if (!match) return null;
  let root; try { root = JSON.parse(match[1]); } catch { return null; }
  if (root.metadata?.channelMetadataRenderer?.externalId !== 'UCSkvK9jOZFIT84hiS0B5Rzg') return null;
  const stack = [root]; let visited = 0;
  while (stack.length && visited++ < 60000) {
    const node = stack.pop(); if (!node || typeof node !== 'object') continue;
    const lockup = node.lockupViewModel, video = node.videoRenderer;
    const id = lockup?.contentId ?? video?.videoId;
    const title = lockup?.metadata?.lockupMetadataViewModel?.title?.content ?? video?.title?.runs?.map(x => x.text).join('');
    if (typeof id === 'string' && /^[\w-]{11}$/.test(id) && typeof title === 'string' && title.length < 250 && !/찬양|오후|새벽|금요|1분|일분|shorts/i.test(title) && /주일|설교|[（(][가-힣]+\s*\d+\s*[:：]/.test(title)) return { id, title, source: 'channel', label: '최근 주일 말씀' };
    stack.push(...Object.values(node).reverse());
  }
  return null;
}
