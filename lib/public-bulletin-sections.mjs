// This projection consumes only public RLS-filtered rows. Never pass editor rows here.
export function selectBulletinSections(items, section) {
  return items.filter(item => {
    const title = String(item.title ?? '').normalize('NFKC').replace(/\s/g, '');
    if (section === 'torah-tov') return /토라|토브|묵상가이드|암송/.test(title) && item.kind !== 'image';
    return item.kind !== 'image' && (/예배묵상진행|예배말씀/.test(title) || /(?:새벽|금요|주일(?:오후)?)\s*예배\s*말씀\s*[:：]/.test(String(item.body ?? '')));
  });
}
export function parseWorshipReadings(items) {
  const readings = {};
  const keys = { '주일': 'sunday', '주일오후': 'afternoon', '금요': 'friday', '새벽': 'dawn' };
  for (const item of items) {
    if (item.kind === 'image') continue;
    // A label and its passage must be on the same line; never infer from a sermon title/date.
    const lines = String(item.body ?? '').replace(/[;,，]\s*(?=(?:주일\s*오후|주일|금요|새벽)\s*예배\s*말씀\s*[:：])/g, '\n').split(/\r?\n/);
    const title = String(item.title ?? '').normalize('NFKC');
    const titleLabel = title.match(/^\s*(주일\s*오후|주일|금요|새벽)\s*예배\s*말씀\s*[:：]?\s*$/);
    if (titleLabel && lines.length === 1) lines.unshift(`${titleLabel[1]}예배 말씀: ${lines[0]}`);
    for (const line of lines) {
      const match = line.normalize('NFKC').match(/^\s*[-•·]?\s*(주일\s*오후|주일|금요|새벽)\s*예배\s*말씀\s*[:：]\s*(.{1,500})\s*$/);
      if (!match || !match[2].trim()) continue;
      const key = keys[match[1].replace(/\s/g, '')];
      const passage = match[2].trim();
      if (!readings[key]) readings[key] = passage;
    }
  }
  return readings;
}
