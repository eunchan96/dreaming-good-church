// Which week a bulletin's readings belong to, counted in Korea time with weeks starting on Sunday.
// A bulletin dated this week (or later) is "이번 주", the week before is "지난 주", anything older is not shown.
const KST = 9 * 60 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;

export function readingWeekLabel(serviceDate: string, now: Date = new Date()): '이번 주' | '지난 주' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return null;
  const today = new Date(now.getTime() + KST);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const weekStart = todayUtc - today.getUTCDay() * day;
  const date = Date.parse(`${serviceDate}T00:00:00Z`);
  if (date >= weekStart) return '이번 주';
  if (date >= weekStart - 7 * day) return '지난 주';
  return null;
}
