import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';

/** Reads one file out of a .docx (zip) without extra packages. */
function unzip(zip:Buffer,name:string){
 const end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));let at=zip.readUInt32LE(end+16);
 for(let n=zip.readUInt16LE(end+10);n>0;n--){
  const method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+20),nameLen=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32),local=zip.readUInt32LE(at+42);
  if(zip.toString('utf8',at+46,at+46+nameLen)===name){const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),data=zip.subarray(start,start+size);return (method===8?inflateRawSync(data):data).toString('utf8');}
  at+=46+nameLen+extra+comment;
 }
 throw new Error(`${name} not found`);
}

test('print preview downloads a two-sheet A4 landscape Word bulletin with the printed content',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID(),id=randomUUID();
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  expect((await db.from('church_editors').insert({user_id:user.data.user.id})).error).toBeNull();
  expect((await db.from('bulletins').insert({id,service_date:'2189-03-04',issue_number:12})).error).toBeNull();
  expect((await db.from('bulletin_items').insert([
   {position:0,title:'하나님 앞에서\n더 나은 예배',body:'',print_page:1},
   {position:1,title:'묵상 가이드',body:'워드 파일에 담길 묵상 문장입니다.',print_page:3},
   {position:2,title:'좋은 소식 · 광고',body:'첫째 소식입니다.\n둘째 소식입니다.',print_page:4},
   {position:3,title:'2월 헌금 내역',body:'2월(4주) 총계',kind:'offering',content:{month:'2189-02',rows:[['주일헌금','12000'],['온라인 / 주일헌금','3000'],['감사헌금','5000']]},print_page:4},
  ].map(row=>({id:randomUUID(),bulletin_id:id,kind:'text',content:{},...row})))).error).toBeNull();
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByRole('button',{name:/2189-03-04/}).click();await page.getByRole('button',{name:'수정',exact:true}).click();await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();
  const print=page.getByRole('dialog',{name:'관리자 인쇄 미리보기',exact:true});await expect(print.getByText('워드 파일에 담길 묵상 문장입니다.')).toBeVisible();await expect(print.getByText('하늘보좌예배').first()).toBeVisible();
  const zoom=await print.getByRole('document',{name:'인쇄 주보'}).evaluate(el=>(el as HTMLElement).style.zoom);
  const download=page.waitForEvent('download');await print.getByRole('button',{name:'Word로 내려받기',exact:true}).click();const file=await download;
  expect(file.suggestedFilename()).toBe('890304 주일 주보.docx');
  await expect(print.getByText('Word 파일을 내려받았습니다. 글꼴은 맑은 고딕으로 열립니다.',{exact:true})).toBeVisible();
  // Measuring resets the preview zoom only for a moment.
  expect(await print.getByRole('document',{name:'인쇄 주보'}).evaluate(el=>(el as HTMLElement).style.zoom)).toBe(zoom);
  const xml=unzip(await readFile(await file.path()),'word/document.xml'),text=xml.replace(/<w:br\/>|<\/w:p>/g,'\n').replace(/<[^>]+>/g,'');
  expect(xml.match(/<w:pgSz [^>]*w:orient="landscape"/g)).toHaveLength(2);
  expect(xml).toContain('w:w="16838" w:h="11906"');
  // 한 장 = 높이 고정(196mm) 2칸 표 한 줄: 면이 길어져도 옆 면·다음 쪽으로 밀리지 않는다.
  expect(xml.match(/<w:trHeight w:val="11112" w:hRule="exact"\/>/g)).toHaveLength(2);
  expect(xml).not.toContain('w:type="column"');
  // 3색 띠에 폭 0인 칸이 없어야 한다.
  expect(xml).not.toContain('<w:gridCol w:w="0"/>');
  // 바깥면(4면 → 1면) 다음 안쪽면(2면 → 3면) 순서
  const order=['좋은 소식','첫째 소식입니다.','헌금 내역','하나님 앞에서','더 나은 예배','묵상 가이드','워드 파일에 담길 묵상 문장입니다.'].map(value=>text.indexOf(value));
  expect(order.every(index=>index>=0)).toBe(true);expect([...order].sort((a,b)=>a-b)).toEqual(order);
  expect(text).toMatch(/^1\.$/m);expect(text).toContain('첫째 소식입니다.\n둘째 소식입니다.');expect(text).toContain('20,000원');
  expect(xml).toContain('w:fill="');expect(xml).toMatch(/<w:drawing>/);
 }finally{await db.from('bulletins').delete().eq('id',id);await db.auth.admin.deleteUser(user.data.user.id);}
});
