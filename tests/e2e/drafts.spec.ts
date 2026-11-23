import {saveAndEdit} from './bulletin-helpers';
import {calendarControl,selectCalendar} from './calendar-helpers';
import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import { acceptConfirm, dismissConfirm } from "./confirm";

test('new bulletin retains print-only material and structured attribution when reopened',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID();const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'+ 새 주보 작성',exact:true}).click();
  for(const title of ['표지','예배 순서','예배 안내','묵상 가이드','토라&토브','기도','좋은 소식','헌금 내역'])await expect(page.getByRole('heading',{name:title,exact:true,level:2})).toBeVisible();
  await selectCalendar(page,calendarControl(page,'예배 날짜'),'2097-11-03');await page.getByLabel('표지 첫째 줄',{exact:true}).fill('이번 주 표지');await page.getByLabel('묵상',{exact:true}).fill('이번 주 묵상');await page.getByLabel('담당',{exact:true}).fill('선교회');await saveAndEdit(page);
  const result=await db.from('bulletins').select('id').eq('service_date','2097-11-03').single();if(result.error)throw result.error;const count=await db.from('bulletin_items').select('id',{count:'exact',head:true}).eq('bulletin_id',result.data.id);
  expect((await db.from('bulletin_items').insert([{bulletin_id:result.data.id,position:count.count!,title:'메모',body:'인쇄 메모',needs_review:true,web_visible:true},{bulletin_id:result.data.id,position:count.count!+1,title:'교회 안내',body:'기존 교회 안내',needs_review:false,web_visible:true}])).error).toBeNull();
  await page.reload();await page.getByRole('button',{name:/2097-11-03/}).click();await expect(page.getByText('인쇄 메모',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByLabel('표지 첫째 줄',{exact:true})).toHaveValue('이번 주 표지');await expect(page.getByLabel('담당',{exact:true})).toHaveValue('선교회');
  await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();const print=page.getByRole('dialog',{name:'관리자 인쇄 미리보기',exact:true});await expect(print.getByText('인쇄 메모',{exact:true})).toBeVisible();await expect(print.getByText('선교회',{exact:true})).toBeVisible();await expect(print.getByRole('button',{name:'그대로 사용',exact:true})).toHaveCount(0);await print.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
  await acceptConfirm(page);await page.getByRole('button',{name:'게시하기',exact:true}).click();await expect(page.getByRole('status')).toContainText('주보를 게시했습니다');expect((await db.from('bulletin_items').select('needs_review').eq('bulletin_id',result.data.id)).data?.every(item=>!item.needs_review)).toBe(true);
 }finally{await db.from('bulletins').delete().eq('service_date','2097-11-03');await db.auth.admin.deleteUser(user.data.user.id);}
});
