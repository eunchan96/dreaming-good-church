import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProgramContent, validProgramSlug } from '../lib/special-programs.ts';

const base = () => ({
  cover: { kicker: '좋은교회 10주년', title: '설립감사 임직예배', date: '2026. 12. 6(주일)', time: '오후 1:00', poster: { src: '/special/poster.jpg', alt: '포스터', width: 1828, height: 1232 } },
  blocks: [
    { type: 'title', text: '설립감사 임직예배' },
    { type: 'band', title: '1부 예배', tone: 'olive', lead: '최선주 목사' },
    { type: 'rows', rows: [{ name: '찬송', what: '595장', who: '다같이' }, { name: '설교', who: '조현기 목사', org: '늘푸른목양교회' }] },
    { type: 'note', parts: [{ heading: '임직자에게', list: ['첫째', '둘째'] }, { heading: '교우들에게', text: '**강홍조** 씨를' }] },
    { type: 'schedule', title: '향기예배 안내', tone: 'olive', columns: [[['주일', '오전 10:45']]] },
    { type: 'boxes', boxes: [{ title: '1층 안내위원', tone: 'green', text: '김동주 집사' }] },
  ],
  notice: { title: '광고', tone: 'orange', body: '감사합니다.' },
});

test('올바른 특별 순서지 내용은 그대로 통과한다', () => {
  assert.deepEqual(parseProgramContent(base()), base());
});

test('형식이 틀리면 그리지 않는다(null)', () => {
  assert.equal(parseProgramContent(null), null);
  assert.equal(parseProgramContent([]), null);
  assert.equal(parseProgramContent({ ...base(), blocks: 'x' }), null);
  const unknownBlock = base(); unknownBlock.blocks.push({ type: 'script', src: 'x' });
  assert.equal(parseProgramContent(unknownBlock), null);
  const badTone = base(); badTone.blocks[1].tone = 'red';
  assert.equal(parseProgramContent(badTone), null);
  const missingWho = base(); delete missingWho.blocks[2].rows[0].who;
  assert.equal(parseProgramContent(missingWho), null);
});

test('포스터는 /special/ 아래 파일만 쓴다', () => {
  for (const src of ['https://example.com/a.jpg', '/special/../secret', '//evil/a.jpg', '/other/a.jpg', 'javascript:alert(1)']) {
    const content = base(); content.cover.poster.src = src;
    assert.equal(parseProgramContent(content), null, src);
  }
  const noPoster = base(); delete noPoster.cover.poster;
  assert.ok(parseProgramContent(noPoster));
});

test('주소 이름(slug)은 소문자·숫자·하이픈만', () => {
  assert.ok(validProgramSlug('2026-12-06-ordination'));
  for (const slug of ['', 'a', 'Bad', 'a b', '../x', '-abc', 'a'.repeat(70)]) assert.equal(validProgramSlug(slug), false, slug);
});

test('관리자 상세의 빠른 이동 목록은 표지·부별 구역·안내·광고 순서로 만든다', async () => {
  const { specialSections } = await import('../lib/special-programs.ts');
  const content = { ...base(), church: { name: '좋은교회', address: '주소', phone: '010' } };
  content.blocks.splice(1, 0, { type: 'table', title: '임직 대상', tone: 'green', rows: [['추대', '가나다']] });
  assert.deepEqual(specialSections(content, 'detail-section').map(s => s.label), ['표지', '임직 대상', '1부 예배', '향기예배 안내', '안내위원', '광고']);
  assert.equal(specialSections(content, 'detail-section')[1].id, 'detail-section-b1');
  assert.deepEqual(specialSections({ cover: base().cover, blocks: [] }, 'x').map(s => s.label), ['표지']);
});
