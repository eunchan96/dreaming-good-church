// This projection consumes only public RLS-filtered rows. Never pass editor rows here.
export function selectBulletinSections(items, section) {
  return items.filter(item => {
    const title = String(item.title ?? '').normalize('NFKC').replace(/\s/g, '');
    if (section === 'torah-tov') return /토라|토브|묵상가이드|암송/.test(title) && item.kind !== 'image';
    return item.kind === 'sermon' || /예배말씀|예배공지/.test(title);
  });
}
