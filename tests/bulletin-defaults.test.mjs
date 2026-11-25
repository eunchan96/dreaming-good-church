import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOrderRows,volunteerDefaults,shiftPrayerRows,defaultOfferingRows,fixedOrderCell,removeContentRow} from '../lib/bulletin-defaults.mjs';
test('weekly template distinguishes fixed liturgy and mutable values; dates cross months and years',()=>{
 assert.match(defaultOrderRows[0][0],/^↑/);assert.equal(defaultOrderRows.filter(row=>row[2]==='다 같이').length,6);assert.equal(defaultOrderRows.filter(row=>row[2]==='인도자').length,2);assert.equal(defaultOrderRows.find(row=>row[0]==='봉헌 & 기도')[1],'헌금은 헌금함에 하시면 됩니다');assert.equal(fixedOrderCell(['신앙고백','사도신경','다 같이'],1),true);assert.equal(fixedOrderCell(['찬송','비전','다 같이'],1),false);assert.equal(fixedOrderCell(['묵상기도','','다 같이'],1),true);
 assert.deepEqual(volunteerDefaults('2026-11-01'),[['교회 청소','','11/7'],['기도 인도','','11/8']]);assert.deepEqual(volunteerDefaults('2026-12-27'),[['교회 청소','','1/2'],['기도 인도','','1/3']]);assert.ok(defaultOfferingRows.every(row=>row[1]===''));
 const source=[['12/20','A','1팀'],['12/27','B','2팀'],['1/3','C','3팀'],['1/10','D','4팀'],['1/17','E','5팀']];const before=structuredClone(source);
 assert.deepEqual(shiftPrayerRows(source,'2026-12-27','2026-12-20'),[['12/27','B','2팀'],['1/3','C','3팀'],['1/10','D','4팀'],['1/17','E','5팀'],['1/24','','']]);assert.deepEqual(source,before);
 const rows={rows:[['a','',''],['b','',''],['c','','']],disabledRows:[2],fullRows:[0,2]};assert.deepEqual(removeContentRow(rows,1),{rows:[['a','',''],['c','','']],disabledRows:[1],fullRows:[0,1]});assert.equal(rows.rows.length,3);
});

test('first and third Sundays get the afternoon worship notice', async () => {
  const { afternoonWorship, worshipNewsBody, afternoonNotice } = await import('../lib/bulletin-defaults.mjs');
  assert.deepEqual(['2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27', '2027-01-03', '2027-01-31', '2026-11-29'].map(afternoonWorship), [true, false, true, false, true, false, false]);
  assert.equal(afternoonWorship('2026-12-07'), false); // 일요일이 아니면 아님
  assert.equal(worshipNewsBody('', '2026-12-06'), afternoonNotice);
  assert.equal(worshipNewsBody('', '2026-12-13'), '');
  // 지난주 공지(본문·제목 채움)는 다음 주에 빠지고, 편집자가 쓴 다른 내용은 남는다.
  assert.equal(worshipNewsBody('1시 오후 찬양예배\n본문 : 요 3:16\n제목 : 사랑\n\n성탄 예배 안내', '2026-12-13'), '성탄 예배 안내');
  assert.equal(worshipNewsBody('성탄 예배 안내', '2026-12-20'), `${afternoonNotice}\n\n성탄 예배 안내`);
  // 이미 공지가 있으면 겹쳐 넣지 않는다(본문·제목은 새 주라 비운다).
  assert.equal(worshipNewsBody(afternoonNotice, '2026-12-20'), afternoonNotice);
});

test('copied bulletins follow the monthly offering and afternoon rules', async () => {
  const { applyMonthlyRules, afternoonNotice } = await import('../lib/bulletin-defaults.mjs');
  const items = [
    { id: 'o', title: '헌금 내역', kind: 'offering', body: '', content: { month: '2026-10', disabled: false, rows: [['주일헌금', '100000'], ['감사헌금', '5000']] } },
    { id: 'w', title: '좋은 소식 · 예배', kind: 'text', body: '' },
    { id: 'x', title: '좋은 소식 · 광고', kind: 'text', body: '김장' },
  ];
  const first = applyMonthlyRules(items, '2026-12-06');
  assert.deepEqual(first[0].content, { month: '2026-11', disabled: false, rows: [['주일헌금', ''], ['감사헌금', '']] });
  assert.equal(first[1].body, afternoonNotice);
  assert.equal(first[2].body, '김장');
  const second = applyMonthlyRules(first, '2026-12-13');
  assert.equal(second[0].content.disabled, true);
  assert.equal(second[1].body, '');
});
