/** Display helpers for YYYY-MM-DD dates on public pages (calendar dates, no time zone shift). */
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const parts = (value: string) => { const [y, m, d] = value.slice(0, 10).split('-').map(Number); return { y, m, d, day: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };

/** 2026년 11월 8일 주일 (Sundays read 주일, other days 월요일…) */
export function longDate(value: string) { const { y, m, d, day } = parts(value); return `${y}년 ${m}월 ${d}일 ${day === 0 ? '주일' : `${DAYS[day]}요일`}`; }
/** 11월 8일 */
export function monthDay(value: string) { const { m, d } = parts(value); return `${m}월 ${d}일`; }
/** 11월 8일(일) */
export function monthDayWeek(value: string) { const { m, d, day } = parts(value); return `${m}월 ${d}일(${DAYS[day]})`; }
/** 2026년 11월 — used to group lists by month */
export function yearMonth(value: string) { const { y, m } = parts(value); return `${y}년 ${m}월`; }

/** "2026-11-01T13:40" (Korea local) → 오후 1:40 */
function clock(local: string) { const h = Number(local.slice(11, 13)), m = local.slice(14, 16); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`; }
/** Event time range from Korea-local "YYYY-MM-DDTHH:mm" strings: 11월 1일(일) 오후 1:40 ~ 2:40 */
export function eventWhen(start: string, end?: string | null) {
  const first = `${monthDayWeek(start)} ${clock(start)}`;
  if (!end) return first;
  return end.slice(0, 10) === start.slice(0, 10) ? `${first} ~ ${clock(end)}` : `${first} ~ ${monthDayWeek(end)} ${clock(end)}`;
}
