import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationItems,sectionFor,displayTitle,bodyField} from '../lib/bulletin-presentation.ts';

test('presentation removes duplicated printed scaffolding while preserving raw data, flags and print-only sections',()=>{
 const items=[
  {id:'cover',title:'함께 예배',body:'환영',printPage:1,webVisible:true},
  {id:'photo-note',title:'표지 사진',body:'[사진 첨부 필요]',printPage:1,webVisible:true},
  {id:'cover-empty',title:'표지',body:'',printPage:1,webVisible:true},
  {id:'order',title:'예배 순서',body:'',kind:'worship',content:{rows:[['본문','요한복음 3:16','다 같이'],['말씀','사랑의 예배','담임']]},webVisible:true},
  {id:'sermon',title:'사랑의 예배',body:'',kind:'sermon',content:{reference:'요한복음 3:16',preacher:'담임'},webVisible:true},
  {id:'news',title:'좋은 소식',body:'',webVisible:true},
  {id:'guide',title:'교회 안내',body:'',webVisible:true},
  {id:'memo',title:'메모',body:'',webVisible:true},
 ];
 const before=structuredClone(items),result=presentationItems(items);
 assert.deepEqual(result.map(item=>item.id),['cover','order','news','guide','memo']);assert.deepEqual(items,before);
 const independent=presentationItems(items.map(item=>item.id==='order'?{...item,webVisible:false}:item));assert.ok(independent.some(item=>item.id==='sermon'));
 const notes=presentationItems(items.map(item=>item.id==='sermon'?{...item,body:'이번 주 설교 메모'}:item));assert.ok(notes.some(item=>item.id==='sermon'));
});

test('prayer and usher rows join news; volunteer and staff editors keep table fields instead of duplicate bodies',()=>{
 assert.equal(sectionFor({title:'11월 기도 인도 · 안내',kind:'worship',printPage:4}),'좋은 소식');assert.equal(sectionFor({title:'다음 주 봉사위원',kind:'worship'}),'예배 안내');assert.equal(displayTitle('예배 묵상 진행'),'예배 공지사항');
 assert.equal(bodyField({title:'섬기는 이들',kind:'worship'}),false);assert.equal(bodyField({title:'다음 주 봉사위원',kind:'worship'}),false);assert.equal(bodyField({title:'다음 주 봉사위원',kind:'text'}),true);
});
