import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

test('login layout, password visibility and errors remain accessible on small screens',async({page})=>{
  await page.route('**/auth/v1/token?*',r=>r.fulfill({status:400,json:{error:'invalid_grant',error_description:'Invalid login credentials'}}));
  await page.goto('/admin/bulletins');
  await expect(page.getByRole('heading',{name:'관리자 로그인',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'관리 메뉴',exact:true})).toHaveCount(0);
  await page.getByLabel('비밀번호',{exact:true}).fill('test-only-password');
  const show=page.getByRole('button',{name:'비밀번호 보기',exact:true});await show.focus();await page.keyboard.press('Space');
  await expect(page.getByLabel('비밀번호',{exact:true})).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'비밀번호 숨기기',exact:true}).click();
  await expect(page.getByLabel('비밀번호',{exact:true})).toHaveAttribute('type','password');
  await page.getByLabel('이메일',{exact:true}).fill('invalid@example.test');await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('이메일 또는 비밀번호를 확인해 주세요.');
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.goto('/admin/account');await expect(page.getByRole('heading',{name:'관리자 비밀번호 설정',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('shared admin navigation protects unsaved church edits and all workspaces fit mobile',async({page})=>{
  const key=process.env.LOCAL_SUPABASE_SERVICE_KEY;if(!key)throw new Error('Local test key required');
  const local=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false}});
  const email=`${randomUUID()}@example.test`,password=`${randomUUID()}-Aa1!`;
  const created=await local.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  const id=created.data.user.id;
  try{
    const member=await local.from('church_editors').insert({user_id:id});if(member.error)throw member.error;
    await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'관리 메뉴',exact:true})).toBeVisible();
    for(const [path,title] of [['/admin/bulletins','주보 관리'],['/admin/community','공지·일정 관리'],['/admin/church','교회 정보·이미지 관리']]){
      await page.goto(path);await expect(page.getByRole('button',{name:'로그아웃',exact:true})).toBeVisible();
      await expect(page.getByRole('heading',{name:title,level:1,exact:true})).toBeVisible();
      for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
      if(path==='/admin/church'){
        await page.evaluate(()=>scrollTo(0,600));
        const mobile=page.getByRole('button',{name:'관리 메뉴 열기',exact:true});await mobile.click();await expect(page.getByRole('navigation',{name:'관리 메뉴',exact:true})).toBeVisible();
        const menuBox=await page.getByRole('navigation',{name:'관리 메뉴',exact:true}).boundingBox();expect(menuBox!.y).toBeLessThan(150);
        await page.keyboard.press('Escape');await expect(mobile).toBeFocused();await expect(mobile).toHaveAttribute('aria-expanded','false');await mobile.click();
        await page.getByLabel('교회 소개',{exact:true}).fill('저장하지 않은 인사말');
        page.once('dialog',d=>d.dismiss());await page.getByRole('navigation',{name:'관리 메뉴',exact:true}).getByRole('link',{name:/주보 관리/}).click();
        await expect(page).toHaveURL(/\/admin\/church$/);await expect(page.getByLabel('교회 소개',{exact:true})).toHaveValue('저장하지 않은 인사말');
        page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByLabel('교회 소개',{exact:true})).toHaveValue('저장하지 않은 인사말');
      }
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),path).toEqual([]);
    }
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'로그아웃',exact:true}).click();
    await expect(page.getByRole('button',{name:'로그인 다시 확인',exact:true})).toBeVisible();
    await expect(page.getByLabel('교회 소개',{exact:true})).toHaveCount(0);
  }finally{const removed=await local.auth.admin.deleteUser(id);if(removed.error)throw removed.error;}
});
