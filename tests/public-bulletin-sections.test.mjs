import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBulletinSections } from '../lib/public-bulletin-sections.mjs';
test('weekly public projection selects scripture sections and keeps their order', () => {
  const rows = [{ title:'교회 소식', kind:'text' }, { title:'토라 & 토브', kind:'text' }, { title:'묵상 가이드', kind:'text' }, { title:'주일 말씀', kind:'sermon' }, { title:'예배 공지', kind:'text' }, { title:'토라 사진', kind:'image' }, { title:'헌금', kind:'offering' }];
  assert.deepEqual(selectBulletinSections(rows,'torah-tov'),[rows[1],rows[2]]);
  assert.deepEqual(selectBulletinSections(rows,'worship'),[rows[3],rows[4]]);
});
