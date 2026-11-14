import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBulletinSections, parseWorshipReadings } from '../lib/public-bulletin-sections.mjs';
test('weekly public projection selects scripture sections and keeps their order', () => {
  const rows = [{ title:'교회 소식', kind:'text' }, { title:'토라 & 토브', kind:'text' }, { title:'묵상 가이드', kind:'text' }, { title:'주일 말씀', kind:'sermon' }, { title:'예배 공지', kind:'text' }, { title:'토라 사진', kind:'image' }, { title:'헌금', kind:'offering' }];
  assert.deepEqual(selectBulletinSections(rows,'torah-tov'),[rows[1],rows[2]]);
  assert.deepEqual(selectBulletinSections(rows,'worship'),[]);
});
test('weekly readings use explicit service labels, never the sermon title or a guessed service',()=>{
  const items=[{title:'예배 묵상 진행',kind:'text',body:'새벽예배 말씀: 사도행전 11장\n금요예배 말씀: 갈라디아서 1장\n주일예배 말씀: 사도행전 12장'},{title:'성경 공부',kind:'sermon',body:'요한복음 3장'},{title:'새벽예배 말씀',kind:'image',body:'공개 이미지 설명'}];
  assert.deepEqual(parseWorshipReadings(items),{dawn:'사도행전 11장',friday:'갈라디아서 1장',sunday:'사도행전 12장'});
  assert.deepEqual(parseWorshipReadings([{title:'금요예배 말씀',kind:'text',body:'시편 1편, 2편'},{title:'안내',body:'주일 오후예배 말씀： 시편 3편, 새벽예배 말씀: 사도행전 2장'}]),{friday:'시편 1편, 2편',afternoon:'시편 3편',dawn:'사도행전 2장'});
  assert.deepEqual(parseWorshipReadings([{title:'주일 설교',kind:'sermon',body:'이전에 새벽예배 말씀: 시편 1편을 읽었습니다.'},{title:'새벽예배 말씀',body:''}]),{});
});
