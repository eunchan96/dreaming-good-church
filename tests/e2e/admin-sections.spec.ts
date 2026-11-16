import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test('교회 소개 categories save only their own fields, roll back conflicts and keep other drafts',async({page,context})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const original=await db.from('church_info').select('*');if(original.error)throw original.error;
 const email=randomUUID()+'@example.test',password=randomUUID(),user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  const menu=page.getByRole('navigation',{name:'관리 메뉴',exact:true});await expect(menu.getByRole('link',{name:'교회 정보·이미지 관리'})).toHaveCount(0);
  await menu.getByRole('link',{name:'홈페이지 관리',exact:true}).click();const tabs=page.getByRole('navigation',{name:'페이지 메뉴'});await expect(tabs.getByRole('button')).toHaveText(['홈 화면','교회 소개','이미지 관리']);
  await tabs.getByRole('button',{name:'교회 소개',exact:true}).click();await expect(page).toHaveURL(/\/admin\/church$/);
  const greeting=page.getByRole('region',{name:'인사말',exact:true}),visit=page.getByRole('region',{name:'오시는 길',exact:true});
  for(const name of ['인사말','오시는 길','예배시간 안내','온라인 헌금'])await expect(page.getByRole('region',{name,exact:true})).toBeVisible();
  const save=greeting.getByRole('button',{name:'인사말 저장',exact:true}),reload=greeting.getByRole('button',{name:'인사말 다시 불러오기',exact:true});
  await expect(save).toBeDisabled();await expect(reload).toBeDisabled();
  const before=await db.from('church_info').select('*').order('key');
  await page.getByLabel('인사말 글',{exact:true}).fill('함께 예배하는 인사말');await page.getByLabel('연락처',{exact:true}).fill('010-1234-5678');await page.getByLabel('주변 위치 안내',{exact:true}).fill('다른 묶음의 미저장 초안');
  await expect(save).toBeEnabled();await expect(visit.getByRole('button',{name:'오시는 길 저장',exact:true})).toBeEnabled();
  await save.click();await expect(page.getByRole('status').filter({hasText:'저장했습니다'})).toBeVisible();await expect(save).toBeDisabled();
  const after=await db.from('church_info').select('*').order('key');
  expect(after.data!.find(r=>r.key==='introduction')!.body).toBe('함께 예배하는 인사말');
  expect(after.data!.find(r=>r.key==='phone')!.body).toBe(before.data!.find(r=>r.key==='phone')!.body);
  await expect(page.getByLabel('연락처',{exact:true})).toHaveValue('010-1234-5678');await expect(page.getByLabel('주변 위치 안내',{exact:true})).toHaveValue('다른 묶음의 미저장 초안');
  // A conflict anywhere rolls the whole save back and keeps the drafts.
  const other=await context.newPage();await other.goto('/admin/church');await other.getByLabel('교회 이름',{exact:true}).fill('저장되지 않아야 할 이름');
  const worship=after.data!.find(row=>row.key==='worship')!;await db.from('church_info').update({body:'다른 화면에서 저장한 예배 안내',revision:worship.revision+1}).eq('key','worship');const beforeConflict=await db.from('church_info').select('*').order('key');
  await other.getByRole('region',{name:'인사말',exact:true}).getByRole('button',{name:'인사말 저장',exact:true}).click();await expect(other.getByRole('status').filter({hasText:'다른 곳에서 수정'})).toBeVisible();expect((await db.from('church_info').select('*').order('key')).data).toEqual(beforeConflict.data);await expect(other.getByLabel('교회 이름',{exact:true})).toHaveValue('저장되지 않아야 할 이름');
  other.once('dialog',d=>d.accept());await other.getByRole('region',{name:'인사말',exact:true}).getByRole('button',{name:'인사말 다시 불러오기',exact:true}).click();await expect(other.getByLabel('교회 이름',{exact:true})).not.toHaveValue('저장되지 않아야 할 이름');await other.close();
  // Network failure keeps the draft.
  await page.getByLabel('인사말 글',{exact:true}).fill('실패해도 유지할 초안');await page.route('**/rest/v1/rpc/save_church_info',r=>r.fulfill({status:503,json:{message:'offline'}}));await save.click();await expect(page.getByLabel('인사말 글',{exact:true})).toHaveValue('실패해도 유지할 초안');await page.unroute('**/rest/v1/rpc/save_church_info');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).exclude('iframe').analyze()).violations.map(v=>v.id)).toEqual([]);}
  await page.setViewportSize({width:1440,height:900});await page.getByRole('navigation',{name:'페이지 목차'}).getByRole('link',{name:'오시는 길'}).click();await expect(page.locator('#church-section-directions')).toBeFocused();
  await db.from('church_editors').delete().eq('user_id',user.data.user.id);const beforeDenied=await db.from('church_info').select('*').order('key');await save.click();await expect(page.getByRole('status').filter({hasText:'편집 권한'})).toBeVisible();expect((await db.from('church_info').select('*').order('key')).data).toEqual(beforeDenied.data);
 }finally{for(const row of original.data)await db.from('church_info').update(row).eq('key',row.key);await db.auth.admin.deleteUser(user.data.user.id);}
});
