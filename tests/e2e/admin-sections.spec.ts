import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
test('top navigation, page contents and isolated field saves preserve other edits and reject conflicts',async({page,context})=>{
  const key=process.env.LOCAL_SUPABASE_SERVICE_KEY;if(!key)throw new Error('Local key required');
  const db=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false}});
  const original=await db.from('church_info').select('*');if(original.error)throw original.error;
  const email=`${randomUUID()}@example.test`,password=`${randomUUID()}-Aa1!`;
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;const id=created.data.user.id;
  try{
    const member=await db.from('church_editors').insert({user_id:id});if(member.error)throw member.error;
    await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
    const menu=page.getByRole('navigation',{name:'관리 메뉴',exact:true});await expect(menu).toBeVisible();
    expect(await menu.evaluate(el=>!!el.closest('header'))).toBe(true);
    await page.getByRole('button',{name:'+ 새 주보 작성',exact:true}).click();
    const toc=page.getByRole('navigation',{name:'페이지 목차',exact:true});await toc.getByRole('link',{name:/성경 본문/}).click();
    await expect(page.locator('[id^="edit-item-"]:focus')).toHaveCount(1);
    page.once('dialog',d=>d.accept());await menu.getByRole('link',{name:'교회 정보·이미지 관리',exact:true}).click();
    const intro=page.getByRole('region',{name:'교회 소개 편집',exact:true});const phone=page.getByRole('region',{name:'연락처 편집',exact:true});
    await expect(page.getByRole('link',{name:'공개 화면 확인',exact:true})).toHaveCount(1);
    await intro.getByLabel('교회 소개',{exact:true}).fill('이 항목만 저장합니다.');await phone.getByLabel('연락처',{exact:true}).fill('아직 저장하지 않은 연락처');
    const before=await db.from('church_info').select('*');if(before.error)throw before.error;
    await intro.getByRole('button',{name:'교회 소개 저장',exact:true}).click();await expect(intro.getByRole('status')).toContainText('저장했습니다');
    const after=await db.from('church_info').select('*');if(after.error)throw after.error;
    for(const row of before.data){const next=after.data.find(x=>x.key===row.key)!;if(row.key==='introduction'){expect(next.body).toBe('이 항목만 저장합니다.');expect(next.revision).toBe(row.revision+1);}else expect(next).toEqual(row);}
    await expect(phone.getByLabel('연락처',{exact:true})).toHaveValue('아직 저장하지 않은 연락처');
    await expect(phone.getByRole('button',{name:'연락처 저장',exact:true})).toBeEnabled();
    const other=await context.newPage();await other.goto('/admin/church');const otherIntro=other.getByRole('region',{name:'교회 소개 편집',exact:true});await expect(otherIntro.getByLabel('교회 소개',{exact:true})).toHaveValue('이 항목만 저장합니다.');
    await intro.getByLabel('교회 소개',{exact:true}).fill('먼저 저장한 새 안내');await intro.getByRole('button',{name:'교회 소개 저장',exact:true}).click();await expect(intro.getByRole('status')).toContainText('저장했습니다');
    await otherIntro.getByLabel('교회 소개',{exact:true}).fill('늦게 도착한 수정');await otherIntro.getByRole('button',{name:'교회 소개 저장',exact:true}).click();await expect(otherIntro.getByRole('status')).toContainText('다른 곳에서 수정');
    await expect(otherIntro.getByLabel('교회 소개',{exact:true})).toHaveValue('늦게 도착한 수정');
    expect((await db.from('church_info').select('body').eq('key','introduction').single()).data?.body).toBe('먼저 저장한 새 안내');
    other.once('dialog',d=>d.accept());await otherIntro.getByRole('button',{name:'저장값 다시 불러오기',exact:true}).click();await expect(otherIntro.getByLabel('교회 소개',{exact:true})).toHaveValue('먼저 저장한 새 안내');await other.close();
    await page.setViewportSize({width:320,height:844});
    await expect(page.locator('summary[aria-label="교회 정보 도움말"]')).toHaveCount(0);
    await expect(page.getByText('항목별로 저장하면 공개 안내에 반영됩니다.',{exact:false})).toBeVisible();
    await page.getByRole('navigation',{name:'페이지 목차',exact:true}).getByRole('link',{name:/오시는 길/}).click();await expect(page.locator('#church-field-directions')).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.route('**/rest/v1/church_info?*',async r=>r.request().method()==='PATCH'?r.fulfill({status:503,json:{message:'offline'}}):r.continue());
    await phone.getByRole('button',{name:'연락처 저장',exact:true}).click();await expect(phone.getByRole('status')).not.toBeEmpty();await expect(phone.getByLabel('연락처',{exact:true})).toHaveValue('아직 저장하지 않은 연락처');
    await page.unroute('**/rest/v1/church_info?*');
    const priorPhone=await db.from('church_info').select('*').eq('key','phone').single();if(priorPhone.error)throw priorPhone.error;
    const revoked=await db.from('church_editors').delete().eq('user_id',id);if(revoked.error)throw revoked.error;
    const deniedSave=page.waitForResponse(r=>r.url().includes('/rest/v1/church_info?')&&r.request().method()==='PATCH');
    await phone.getByRole('button',{name:'연락처 저장',exact:true}).click();await deniedSave;await expect(phone.getByRole('status')).toContainText('다른 곳에서 수정');
    expect((await db.from('church_info').select('*').eq('key','phone').single()).data).toEqual(priorPhone.data);
  }finally{for(const row of original.data){const restored=await db.from('church_info').update(row).eq('key',row.key);if(restored.error)throw restored.error;}const removed=await db.auth.admin.deleteUser(id);if(removed.error)throw removed.error;}
});
