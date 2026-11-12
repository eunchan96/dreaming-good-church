import test from 'node:test';
import assert from 'node:assert/strict';
import { createItem, createBulletin, copyBulletin, editItem, publicBulletin, offeringTotal } from '../lib/bulletins.ts';

test('structured copy keeps independent rows, visibility and weekly review', () => {
  const item = createItem({ id: 'offering', title: '헌금', kind: 'offering', webVisible: false, reviewOnCopy: true });
  item.content.rows = [['감사헌금', '123000'], ['십일조', '500000']];
  item.content.month = '2026-10';
  const source = { ...createBulletin({ id: 'source', serviceDate: '2026-11-01', issueNumber: 44 }), items: [item] };
  const copied = copyBulletin(source, { id: 'copy', serviceDate: '2026-11-08', issueNumber: 45 }, () => 'new');
  assert.equal(offeringTotal(copied.items[0].content), 623000);
  assert.equal(copied.items[0].webVisible, false);
  assert.equal(copied.items[0].needsReview, true);
  copied.items[0].content.rows[0][1] = '0';
  assert.equal(source.items[0].content.rows[0][1], '123000');
  assert.deepEqual(publicBulletin({ ...source, status: 'published' }).items, []);
  assert.deepEqual(editItem(item, { title: '수정' }).content, item.content);
});
