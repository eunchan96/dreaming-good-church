/** 찬양 곡 검색: 제목·주제·코드·성경·영어 제목으로 찾고, ㄱㄴㄷ 초성만 쳐도 제목을 찾는다. */
const CHOSUNG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/** 글자마다 한글은 초성으로, 그 밖의 글자는 소문자로 바꾼다(공백·괄호·특수문자 제외). */
export function initialsOf(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHOSUNG[Math.floor((code - 0xac00) / 588)];
    else if (/[0-9a-zA-Zㄱ-ㅎ]/.test(ch)) out += ch.toLowerCase();
  }
  return out;
}

/**
 * @typedef {{ title: string, themes?: string[], codes?: string[], bible?: string, english?: string, tempo?: string[], memo?: string[] }} SongSearchable
 * @param {SongSearchable} song
 * @param {string} query
 */
export function matchesSong(song, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  // ㄱㅅ 처럼 자음만 입력하면 제목의 초성과 비교한다.
  if (/^[ㄱ-ㅎ\s]+$/.test(q)) return initialsOf(song.title).includes(q.replace(/\s/g, ''));
  const haystack = [song.title, ...(song.themes ?? []), ...(song.codes ?? []), song.bible ?? '', song.english ?? '', ...(song.tempo ?? []), ...(song.memo ?? [])].join(' ').toLowerCase();
  return q.split(/\s+/).every(token => haystack.includes(token));
}

/** 제목 첫 글자의 초성(목록 필터용). 한글이 아니면 빈 문자열. */
export function firstInitial(title) {
  const first = initialsOf(title)[0] ?? '';
  const plain = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }[first] ?? first;
  return CHOSUNG.includes(plain) ? plain : '';
}
