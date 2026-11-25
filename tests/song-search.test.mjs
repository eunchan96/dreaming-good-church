import test from 'node:test';
import assert from 'node:assert/strict';
import {firstInitial,initialsOf,matchesSong} from '../lib/song-search.mjs';

const song={title:'갈릴리 바닷가에서(갈릴리 호숫가에서)',themes:['고백','영접'],codes:['D'],bible:'요 21:15~18',english:'By the Sea of Galilee',tempo:['느린 3/4']};

test('한글은 초성으로 바꾸고 공백·괄호는 버린다',()=>{
  assert.equal(initialsOf('갈릴리 바닷가에서'),'ㄱㄹㄹㅂㄷㄱㅇㅅ');
  assert.equal(initialsOf('주 Love(E) 77'),'ㅈlovee77');
});
test('자음만 입력하면 제목 초성에서 찾는다',()=>{
  assert.ok(matchesSong(song,'ㄱㄹㄹ'));
  assert.ok(matchesSong(song,'ㅂㄷㄱ'));
  assert.ok(!matchesSong(song,'ㅎㅎ'));
});
test('여러 단어는 모두 들어 있어야 하고, 주제·코드·성경·영어도 찾는다',()=>{
  assert.ok(matchesSong(song,'갈릴리 고백'));
  assert.ok(matchesSong(song,'  영접 '));
  assert.ok(matchesSong(song,'요 21'));
  assert.ok(matchesSong(song,'galilee'));
  assert.ok(!matchesSong(song,'갈릴리 승리'));
  assert.ok(matchesSong(song,''));
});
test('목록 필터용 첫 초성은 쌍자음을 합치고 한글이 아니면 비운다',()=>{
  assert.equal(firstInitial('까마귀'),'ㄱ');
  assert.equal(firstInitial('따뜻한'),'ㄷ');
  assert.equal(firstInitial('Amazing Grace'),'');
  assert.equal(firstInitial('(주)님의 사랑'),'ㅈ');
  assert.equal(firstInitial('(E)주님'),'');
});
