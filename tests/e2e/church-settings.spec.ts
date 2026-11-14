import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import {defaultPageSettings} from '../../lib/church-page-settings';

test('common reauthentication card is clear, accessible and responsive',async({page})=>{
 for(const route of ['home','church','worship','community']){
  await page.goto(`/admin/${route}`);
  const card=page.getByRole('region',{name:'관리자 로그인을 확인해 주세요',exact:true});
  await expect(card).toBeVisible();
  await expect(card.getByRole('link',{name:'새 탭에서 관리자 로그인'})).toHaveAttribute('target','_blank');
  await expect(card.getByRole('link')).toHaveAttribute('rel','noopener noreferrer');
  await card.getByRole('button',{name:'로그인 다시 확인'}).click();await expect(card).toBeVisible();
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(card.getByRole('link')).toBeVisible();
   if(route==='home')await page.screenshot({path:`.local/reauth-${width}.png`,fullPage:true});
  }
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 }
});

test('individual church settings save publicly, enforce permissions/conflicts and preserve session drafts',async({page,context})=>{
 const service=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const anon=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const original=await service.from('church_page_settings').select('*');if(original.error)throw original.error;
 const info=await service.from('church_info').select('*');if(info.error)throw info.error;
 const email=`${randomUUID()}@example.test`,password=randomUUID();
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
 const other=await service.auth.admin.createUser({email:`${randomUUID()}@example.test`,password,email_confirm:true});if(other.error)throw other.error;
 try{
  await service.from('church_editors').insert({user_id:created.data.user.id});
  await service.from('church_page_settings').delete().in('key',Object.keys(defaultPageSettings));
  const editor=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
  const login=await editor.auth.signInWithPassword({email,password});expect(login.error).toBeNull();
  const noneditor=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
  expect((await noneditor.auth.signInWithPassword({email:other.data.user.email!,password})).error).toBeNull();
  expect((await noneditor.rpc('save_church_page_setting',{p_key:'location',p_revision:0,p_payload:defaultPageSettings.location})).error?.code).toBe('42501');
  expect((await noneditor.from('church_page_settings').select('*')).data).toEqual([]);
  await service.from('church_editors').insert({user_id:other.data.user.id});
  expect((await anon.from('church_page_settings').select('*')).error).not.toBeNull();
  expect((await anon.rpc('save_church_page_setting',{p_key:'location',p_revision:0,p_payload:defaultPageSettings.location})).error).not.toBeNull();
  for(const payload of [{...defaultPageSettings.location,zoom:9},{...defaultPageSettings.location,latitude:91},{...defaultPageSettings.location,landmark:'a\nb'}])expect((await editor.rpc('save_church_page_setting',{p_key:'location',p_revision:0,p_payload:payload})).error).not.toBeNull();
  const badTimes=structuredClone(defaultPageSettings.worship_times);badTimes[0].time='24:00';expect((await editor.rpc('save_church_page_setting',{p_key:'worship_times',p_revision:0,p_payload:badTimes})).error).not.toBeNull();
  const badAccount=structuredClone(defaultPageSettings.offering_accounts);badAccount[0].holder='\n';expect((await editor.rpc('save_church_page_setting',{p_key:'offering_accounts',p_revision:0,p_payload:badAccount})).error).not.toBeNull();
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  const manager=await context.newPage();await manager.goto('/admin/church');
  const times=manager.getByRole('region',{name:'예배시간 설정',exact:true});
  const accounts=manager.getByRole('region',{name:'온라인 헌금계좌 설정',exact:true});
  const location=manager.getByRole('region',{name:'지도·방문안내 설정',exact:true});
  await expect(times).toBeVisible();
  await times.getByRole('group',{name:'주일오후예배',exact:true}).getByLabel('예배 시각').fill('13:30');
  await location.getByLabel('주변 위치 안내',{exact:true}).fill('미저장 위치 초안');
  manager.once('dialog',d=>d.accept());await times.getByRole('button',{name:'예배시간 설정 저장',exact:true}).click();await expect(times.getByRole('status')).toContainText('저장했습니다');
  await expect(location.getByLabel('주변 위치 안내',{exact:true})).toHaveValue('미저장 위치 초안');
  const rows=await service.from('church_page_settings').select('*');expect(rows.data?.map(row=>row.key)).toEqual(['worship_times']);
  await accounts.getByRole('group',{name:'온라인 헌금',exact:true}).getByLabel('계좌번호',{exact:true}).fill('123-456-789');
  manager.once('dialog',async d=>{expect(d.message()).toContain('농협 123-456-789 / 좋은교회');await d.dismiss();});await accounts.getByRole('button',{name:'온라인 헌금계좌 설정 저장',exact:true}).click();
  expect((await service.from('church_page_settings').select('*').eq('key','offering_accounts')).data).toEqual([]);
  manager.once('dialog',d=>d.accept());await accounts.getByRole('button',{name:'온라인 헌금계좌 설정 저장',exact:true}).click();await expect(accounts.getByRole('status')).toContainText('저장했습니다');
  for(const label of ['위도','경도','지도 확대 단계'])await expect(location.getByLabel(label,{exact:true})).toHaveCount(0);
  manager.once('dialog',d=>d.accept());await location.getByRole('button',{name:'지도·방문안내 설정 저장',exact:true}).click();await expect(location.getByRole('status')).toContainText('저장했습니다');
  const savedLocation=await service.from('church_page_settings').select('payload').eq('key','location').single();expect(savedLocation.data?.payload).toMatchObject({latitude:defaultPageSettings.location.latitude,longitude:defaultPageSettings.location.longitude,zoom:defaultPageSettings.location.zoom});
  const publicResult=await anon.from('church_page_settings').select('key,payload');expect(publicResult.error).toBeNull();expect(publicResult.data).toHaveLength(3);
  const reader=await context.newPage();await reader.goto('/church/worship-times');await expect(reader.getByText('첫째·셋째 주일 오후 1:30',{exact:true})).toBeVisible();
  await reader.goto('/worship');await expect(reader.getByText('첫째·셋째 주일 오후 1:30',{exact:true})).toBeVisible();
  await reader.goto('/church/offering');await expect(reader.getByText('123-456-789',{exact:true})).toBeVisible();
  const api=await reader.request.get('/api/church-settings');expect(api.headers()['cache-control']).toContain('no-store');expect(await api.text()).not.toContain('revision');
  await reader.goto('/church/directions');await expect(reader.locator('iframe[title="꿈꾸는좋은교회 위치 지도"]')).toHaveAttribute('src',/z=16/);await expect(reader.getByText('미저장 위치 초안',{exact:true})).toBeVisible();
  await service.from('church_info').update({body:'공개 검증 주소'}).eq('key','address');await reader.reload();await expect(reader.locator('footer address')).toHaveText('공개 검증 주소');
  await service.from('church_info').update({web_visible:false}).eq('key','address');await reader.reload();await expect(reader.locator('footer address')).toHaveCount(0);await expect(reader.locator('iframe[title="꿈꾸는좋은교회 위치 지도"]')).toHaveCount(0);
  // A competing editor advances the version. Current input stays visible after conflict.
  const current=(await service.from('church_page_settings').select('*').eq('key','worship_times').single()).data!;
  expect((await editor.rpc('save_church_page_setting',{p_key:'worship_times',p_revision:current.revision,p_payload:current.payload})).error).toBeNull();
  await times.getByRole('group',{name:'주일예배',exact:true}).getByLabel('예배 시각').fill('11:00');
  manager.once('dialog',d=>d.accept());await times.getByRole('button',{name:'예배시간 설정 저장',exact:true}).click();await expect(times.getByRole('status')).not.toContainText('저장했습니다');await expect(times.getByRole('status')).not.toBeEmpty();await expect(times.getByRole('group',{name:'주일예배',exact:true}).getByLabel('예배 시각')).toHaveValue('11:00');
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(manager.getByRole('heading',{name:'작성하던 내용을 이어가세요'})).toBeVisible();
  await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(times.getByRole('group',{name:'주일예배',exact:true}).getByLabel('예배 시각')).toHaveValue('11:00');
  for(const width of [1440,390,320]){await manager.setViewportSize({width,height:900});expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect((await new AxeBuilder({page:manager}).exclude('iframe').analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(manager.getByRole('heading',{name:'작성하던 내용을 이어가세요'})).toBeVisible();
  await page.getByLabel('이메일',{exact:true}).fill(other.data.user.email!);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(times.getByRole('group',{name:'주일예배',exact:true}).getByLabel('예배 시각')).toHaveValue('10:45');
 }finally{
  await service.from('church_page_settings').delete().in('key',Object.keys(defaultPageSettings));if(original.data.length)await service.from('church_page_settings').insert(original.data);
  for(const field of info.data)await service.from('church_info').update(field).eq('key',field.key);
  await service.auth.admin.deleteUser(created.data.user.id);await service.auth.admin.deleteUser(other.data.user.id);
 }
});

test('offering fetch failure removes stale account values and retry recovers',async({page})=>{
 let failed=false;
 await page.route('**/api/church-settings',r=>r.fulfill(failed?{status:503,json:{}}:{json:{groups:defaultPageSettings}}));
 await page.goto('/church/offering');await expect(page.getByText('301-0223-0182-71',{exact:true})).toBeVisible();
 failed=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText('301-0223-0182-71',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('status')).toContainText('현재 헌금계좌를 확인할 수 없습니다');failed=false;await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await expect(page.getByText('301-0223-0182-71',{exact:true})).toBeVisible();
});
