import test from 'node:test';
import assert from 'node:assert/strict';
import {worshipRows,moveRow,renderedItems} from '../lib/bulletin-presentation.ts';
import {copyBulletin,offeringTotal,publicationIssues,publicBulletin,printBulletin} from '../lib/bulletins.ts';

test('legacy worship introduction becomes a full row and footer without losing raw text',()=>{
 const item={title:'주일 하늘보좌 예배',kind:'worship',body:'하나님은 영이시니\n↑ 표시는 일어서서, 몸이 불편한 분은 앉아 계셔도 됩니다.',content:{rows:[['특송','곡명','담당']],disabledRows:[0]}};
 const before=structuredClone(item),model=worshipRows(item);assert.deepEqual(model.fullRows,[0]);assert.deepEqual(model.disabledRows,[1]);assert.equal(model.rows[0][0],'하나님은 영이시니');assert.match(model.footer,/↑ 표시는/);assert.deepEqual(item,before);
 const shifted=moveRow(model,0,1);assert.deepEqual(shifted.fullRows,[1]);assert.deepEqual(shifted.disabledRows,[0]);const rendered=renderedItems([{...item,content:shifted}])[0];assert.equal(rendered.body,'');assert.deepEqual(rendered.content.rows,[['하나님은 영이시니','','']]);assert.deepEqual(rendered.content.fullRows,[0]);assert.equal(rendered.content.disabledRows,undefined);
});

test('disabled rows are copied intact but excluded from public/print output and offering totals',()=>{
 const source={id:'source',serviceDate:'2026-11-01',issueNumber:44,status:'published',items:[
  {id:'offering',title:'헌금 내역',body:'',kind:'offering',content:{month:'2026-10',rows:[['주일','1000'],['감사','2000']],disabledRows:[1]},webVisible:true,needsReview:false,reviewOnCopy:true},
  {id:'news',title:'좋은 소식 · 예배',body:'비활성 소식',content:{disabled:true},webVisible:true,needsReview:false,reviewOnCopy:false},
  {id:'guide',title:'묵상 가이드',body:'묵상',content:{attribution:'3, 4 여선교회'},webVisible:true,needsReview:false,reviewOnCopy:false},
 ]};
 const original=structuredClone(source);let n=0;const copy=copyBulletin(source,{id:'copy',serviceDate:'2026-11-08',issueNumber:45},()=>`new-${n++}`);
 assert.deepEqual(copy.items[0].content.disabledRows,[1]);assert.equal(copy.items[1].content.disabled,true);assert.equal(offeringTotal(source.items[0].content),1000);
 const visible=publicBulletin(source),printed=printBulletin(source);assert.equal(visible.items.length,2);assert.equal(printed.items.length,2);assert.deepEqual(visible.items[0].content.rows,[['주일','1000']]);assert.equal(visible.items[1].content.attribution,'3, 4 여선교회');assert.deepEqual(source,original);
 copy.items[0].content.disabledRows.pop();assert.deepEqual(source.items[0].content.disabledRows,[1]);
});

test('disabled-only content cannot satisfy publication and long legacy intro remains within row bounds',()=>{
 const disabled={id:'x',title:'예배 순서',body:'',kind:'worship',webVisible:true,reviewOnCopy:false,needsReview:false,content:{rows:[['특송','','']],disabledRows:[0]}};
 assert.ok(publicationIssues({id:'b',serviceDate:'2026-11-01',issueNumber:44,status:'draft',items:[disabled]}).some(message=>message.includes('내용이 있는 공개 항목')));
 const expanded=worshipRows({...disabled,body:'가'.repeat(1100)});assert.equal(expanded.fullRows.length,3);assert.ok(expanded.rows.every(row=>row.every(cell=>cell.length<=500)));assert.equal(expanded.rows.slice(0,3).map(row=>row[0]).join(''),'가'.repeat(1100));
});
