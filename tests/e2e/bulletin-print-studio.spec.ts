import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import AxeBuilder from '@axe-core/playwright';

test('print studio balances a dense page, saves assignments and prints two A4 sheets',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID(),id=randomUUID();const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 const offering=randomUUID();
 try{
  expect((await db.from('church_editors').insert({user_id:user.data.user.id})).error).toBeNull();expect((await db.from('bulletins').insert({id,service_date:'2188-11-01',issue_number:45})).error).toBeNull();expect((await db.from('bulletin_items').insert([
   {bulletin_id:id,position:0,title:'하나님 앞에서\n더 나은 예배',body:'',print_page:1},
   {bulletin_id:id,position:1,title:'묵상 가이드',body:'함께 말씀을 묵상합니다.',print_page:3},
   {bulletin_id:id,position:2,title:'좋은 소식 · 광고',body:Array.from({length:31},(_,i)=>`${i+1}주 예배와 교회 소식을 전합니다.`).join('\n'),print_page:4},
   {id:offering,bulletin_id:id,position:3,title:'10월 헌금 내역',body:'10월(4주) 총계',kind:'offering',content:{month:'2188-10',rows:Array.from({length:13},(_,i)=>[i<5?'온라인 / 헌금'+i:'헌금'+i,'1000'])},print_page:4},
  ].map(row=>({id:randomUUID(),kind:"text",content:{},...row})))).error).toBeNull();
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:/2188-11-01/}).click();
  const detail=page.getByLabel('주보 상세 내용',{exact:true});await expect(detail.getByRole('heading',{name:'좋은 소식',exact:true})).toBeVisible();expect(await detail.evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe('1px');
  const pages=page.getByRole('navigation',{name:'페이지 메뉴'});await expect(pages.getByRole('button')).toHaveText(['주보 목록','주보 상세','주보 설정']);await expect(pages.getByRole('button',{name:'주보 상세',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'수정',exact:true}).click();await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();const print=page.getByRole('dialog',{name:'관리자 인쇄 미리보기',exact:true});await expect(print.getByRole('status')).toContainText('넘침');await print.getByRole('button',{name:'지면 자동 정리',exact:true}).click();await expect(print.getByRole('status')).not.toContainText('넘침');await expect.poll(async()=>(await db.from('bulletin_items').select('print_page').eq('bulletin_id',id).eq('title','좋은 소식 · 광고').single()).data?.print_page).toBeLessThan(4);expect((await db.from('bulletin_items').select('print_page').eq('id',offering).single()).data?.print_page).toBe(4);
  const body=print.getByRole('textbox',{name:'묵상 가이드 내용',exact:true});await body.focus();await body.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const s=window.getSelection()!;s.removeAllRanges();s.addRange(range);const data=new DataTransfer();data.setData('text/plain','안전하게 붙여넣은 문구');data.setData('text/html','<img src=x onerror=alert(1)>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});await expect(body).toHaveText('안전하게 붙여넣은 문구');await expect(body.locator('img')).toHaveCount(0);
  expect((await new AxeBuilder({page}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
  const pdf=await PDFDocument.load(await page.pdf({preferCSSPageSize:true}));expect(pdf.getPageCount()).toBe(2);for(const sheet of pdf.getPages()){expect(sheet.getWidth()).toBeCloseTo(841.89,0);expect(sheet.getHeight()).toBeCloseTo(595.28,0);}
  await print.getByRole('button',{name:'미리보기 닫기',exact:true}).click();await expect.poll(async()=>(await db.from('bulletin_items').select('body').eq('bulletin_id',id).eq('title','묵상 가이드').single()).data?.body).toBe('안전하게 붙여넣은 문구');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'게시하기',exact:true}).click();await expect(page.getByRole('status')).toContainText('주보를 게시했습니다');await page.getByRole('button',{name:/\(2188-11-01\)/}).click();await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();await expect(print.locator('[contenteditable="plaintext-only"]')).toHaveCount(0);await print.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
 }finally{await db.from('bulletins').delete().eq('id',id);await db.auth.admin.deleteUser(user.data.user.id);}
});
