import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {acceptConfirm} from './confirm';

test('refreshing an admin page returns to the bulletin or news item that was open',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID(),draft=randomUUID(),published=randomUUID(),news=randomUUID(),tag=news.slice(0,6);
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  expect((await db.from('church_editors').insert({user_id:user.data.user.id})).error).toBeNull();
  expect((await db.from('bulletins').insert([{id:draft,service_date:'2190-05-07',issue_number:31},{id:published,service_date:'2190-05-14',issue_number:32}])).error).toBeNull();
  expect((await db.from('bulletin_items').insert([draft,published].map(bulletin_id=>({id:randomUUID(),bulletin_id,position:0,title:'새로고침 확인 소식',body:'본문',kind:'text',content:{},print_page:4})))).error).toBeNull();
  expect((await db.from('bulletins').update({status:'published'}).eq('id',published)).error).toBeNull();
  expect((await db.from('community_entries').insert({id:news,kind:'notice',title:'새로고침 공지 '+tag,body:'내용',status:'draft'})).error).toBeNull();
  await acceptConfirm(page);
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  // 게시된 주보 상세 → 새로고침 → 그대로 상세
  await page.getByRole('button',{name:/2190-05-14/}).click();
  const detail=page.getByLabel('주보 상세 내용',{exact:true});await expect(detail).toBeVisible();
  await page.reload();await expect(detail).toBeVisible();await expect(page.getByText('32호 주보').first()).toBeVisible();
  // 초안 작성 중 → 새로고침 → 그대로 작성 화면
  await page.getByRole('button',{name:'주보 목록 돌아가기'}).click();await page.getByRole('button',{name:/2190-05-07/}).click();
  await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByRole('button',{name:'초안 저장',exact:true})).toBeVisible();await expect(page.getByText('31호 주보').first()).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'초안 저장',exact:true})).toBeVisible();await expect(page.getByText('31호 주보').first()).toBeVisible();
  // 목록으로 돌아간 뒤 새로고침하면 목록
  await page.getByRole('button',{name:'주보 목록 돌아가기'}).click();await expect(page.getByRole('button',{name:/2190-05-07/})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:/2190-05-07/})).toBeVisible();await expect(page.getByRole('button',{name:'초안 저장',exact:true})).toHaveCount(0);
  // 공지 편집 → 새로고침 → 그대로 편집
  await page.goto('/admin/community');await page.getByLabel('소식 제목 검색').fill(tag);await page.getByRole('button').filter({hasText:'새로고침 공지 '+tag}).click();
  const title=page.getByRole('textbox',{name:/제목/}).first();await expect(title).toHaveValue('새로고침 공지 '+tag);
  await page.reload();await expect(page.getByRole('textbox',{name:/제목/}).first()).toHaveValue('새로고침 공지 '+tag);
 }finally{await db.from('bulletins').delete().in('id',[draft,published]);await db.from('community_entries').delete().eq('id',news);await db.auth.admin.deleteUser(user.data.user.id);}
});
