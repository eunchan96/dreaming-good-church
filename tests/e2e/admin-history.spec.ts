import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {acceptConfirm,dismissConfirm} from './confirm';

test('browser back and forward move one admin screen at a time and keep unsaved input safe',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID(),published=randomUUID(),news=randomUUID(),tag=news.slice(0,6);
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  expect((await db.from('church_editors').insert({user_id:user.data.user.id})).error).toBeNull();
  expect((await db.from('bulletins').insert({id:published,service_date:'2190-06-04',issue_number:41})).error).toBeNull();
  expect((await db.from('bulletin_items').insert({id:randomUUID(),bulletin_id:published,position:0,title:'뒤로가기 확인 소식',body:'본문',kind:'text',content:{},print_page:4})).error).toBeNull();
  expect((await db.from('bulletins').update({status:'published'}).eq('id',published)).error).toBeNull();
  expect((await db.from('community_entries').insert({id:news,kind:'notice',title:'뒤로가기 공지 '+tag,body:'내용',status:'draft'})).error).toBeNull();
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();

  // 주보: 목록 → 상세 → 뒤로(목록, 같은 관리 화면에 머문다) → 앞으로(같은 상세)
  const detail=page.getByLabel('주보 상세 내용',{exact:true}),entry=page.getByRole('button',{name:/2190-06-04/});
  await entry.click();await expect(detail).toBeVisible();await expect(page).toHaveURL(/\/admin\/bulletins\?view=detail&id=/);
  await page.goBack();await expect(entry).toBeVisible();await expect(detail).toHaveCount(0);await expect(page).toHaveURL(/\/admin\/bulletins$/);
  await page.goForward();await expect(detail).toBeVisible();await expect(page.getByText('41호 주보').first()).toBeVisible();

  // 공지: 목록 → 편집 → 뒤로(목록) → 앞으로(같은 편집)
  await page.goto('/admin/community');
  const title=page.getByRole('textbox',{name:/제목/}).first(),search=page.getByLabel('소식 제목 검색');
  await search.fill(tag);await page.getByRole('button').filter({hasText:'뒤로가기 공지 '+tag}).click();await expect(title).toHaveValue('뒤로가기 공지 '+tag);
  await page.goBack();await expect(search).toBeVisible();await expect(page).toHaveURL(/\/admin\/community$/);
  await page.goForward();await expect(title).toHaveValue('뒤로가기 공지 '+tag);

  // 저장하지 않은 입력이 있으면 뒤로가기가 확인을 묻고, 취소하면 그 자리에 남는다. 확인하면 목록으로 간다.
  await title.fill('고치는 중 '+tag);
  await dismissConfirm(page);await page.goBack();
  await expect(title).toHaveValue('고치는 중 '+tag);await expect(page).toHaveURL(/\/admin\/community\?view=editor&id=/);
  await acceptConfirm(page);await page.goBack();
  await expect(search).toBeVisible();await expect(page).toHaveURL(/\/admin\/community$/);

  // 예배 영상 관리: 캘린더 주소로 열고, 영상 목록 탭 → 뒤로가면 캘린더
  await page.goto('/admin/worship?view=calendar');
  const tabs=page.getByRole('navigation',{name:'페이지 메뉴'});
  await expect(tabs.getByRole('button',{name:'캘린더',exact:true})).toHaveAttribute('aria-current','page');
  await tabs.getByRole('button',{name:'영상 목록',exact:true}).click();await expect(tabs.getByRole('button',{name:'영상 목록',exact:true})).toHaveAttribute('aria-current','page');
  await page.goBack();await expect(tabs.getByRole('button',{name:'캘린더',exact:true})).toHaveAttribute('aria-current','page');
 }finally{await db.from('bulletins').delete().eq('id',published);await db.from('community_entries').delete().eq('id',news);await db.auth.admin.deleteUser(user.data.user.id);}
});
