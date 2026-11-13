import test from 'node:test';
import assert from 'node:assert/strict';
import {fromKoreanInput,koreanInput,newEntry} from '../lib/community.ts';
test('Korea datetime inputs are independent of host timezone and cross UTC date boundaries',()=>{
  assert.equal(fromKoreanInput('2026-11-12T00:30'),'2026-11-11T15:30:00.000Z');
  assert.equal(koreanInput('2026-11-11T15:30:00.000Z'),'2026-11-12T00:30');
  assert.equal(fromKoreanInput(''),null);
  const entry=newEntry('event');assert.equal(entry.is_public,true);assert.equal(entry.status,'draft');
});
