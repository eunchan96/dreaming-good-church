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
