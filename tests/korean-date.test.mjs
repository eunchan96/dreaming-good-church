import test from 'node:test';
import assert from 'node:assert/strict';
import {koreaDate} from '../lib/korean-date.ts';

test('공지 날짜는 한국 시간 기준 달력 날짜로 보인다',()=>{
  assert.equal(koreaDate('2026-11-25T14:59:00Z'),'2026. 11. 25.');
  // UTC로는 아직 25일이지만 한국은 이미 26일 00:30이다.
  assert.equal(koreaDate('2026-11-25T15:30:00Z'),'2026. 11. 26.');
  assert.equal(koreaDate('2026-12-31T20:00:00+00:00'),'2027. 1. 1.');
});
