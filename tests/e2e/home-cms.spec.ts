import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import {defaultHomeContent} from '../../lib/home-content';

test('homepage editor previews unsaved content, publishes normalized images and protects conflicts and permissions',async({page,request,context})=>{
 const key=process.env.LOCAL_SUPABASE_SERVICE_KEY,pub=process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;if(!key||!pub)throw new Error('Local keys required');
 const db=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false}}),original=await db.from('homepage_content').select('*').maybeSingle();if(original.error)throw original.error;
 const email=`${randomUUID()}@example.test`,password=`${randomUUID()}-Aa1!`,user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;const uid=user.data.user.id;
 const actor=createClient('http://127.0.0.1:54321',pub,{auth:{persistSession:false}});const login=await actor.auth.signInWithPassword({email,password});if(login.error)throw login.error;
 const assets:string[]=[];
 try{
  expect((await actor.rpc('save_homepage_content',{p_revision:0,p_content:defaultHomeContent})).error?.code).toBe('42501');
  await db.from('church_editors').insert({user_id:uid});
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:'홈페이지 관리',exact:true}).click();
  const preview=page.frameLocator('iframe[title="홈페이지 첫 화면 미리보기"]');await expect(preview.locator('#welcome-title')).toContainText(defaultHomeContent.title_line1);
  const title='가나다라마바사아자차카타';await page.getByLabel('제목 첫째 줄',{exact:true}).fill(title);await page.getByLabel('제목 둘째 줄',{exact:true}).fill('함께하는 예배');await page.getByLabel('교회 소개 버튼 문구',{exact:true}).fill('가'.repeat(24));await page.getByLabel('설명 첫째 줄',{exact:true}).fill('A'.repeat(48));
  await expect(preview.locator('#welcome-title')).toContainText(title);
  const before=await (await request.get('/api/home-content')).json();expect(before.content?.title_line1).not.toBe(title);
  for(const [label,width] of [['PC',1280],['모바일390',390],['모바일320',320]] as const){await page.getByRole('button',{name:label,exact:true}).click();await expect.poll(()=>preview.locator('body').evaluate(()=>innerWidth)).toBe(width);await expect.poll(()=>preview.locator('#welcome-title').evaluate(el=>Math.max(...Array.from(el.children).map(child=>child.scrollWidth))-el.clientWidth)).toBeLessThanOrEqual(1);await expect.poll(()=>preview.getByRole('link',{name:'가'.repeat(24),exact:true}).evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);}
  await preview.locator('body').evaluate((_el,content)=>window.postMessage({type:'homepage-preview',content:{...content,title_line1:'변조된 미리보기'}},location.origin),defaultHomeContent);await expect(preview.locator('#welcome-title')).toContainText(title);
  await page.getByLabel('이미지 설명',{exact:true}).fill('검수용 초록색 교회 사진');
  await page.getByLabel('새 이미지 파일',{exact:true}).setInputFiles({name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(4*1024*1024+1)});await page.getByRole('button',{name:'이미지 올리기',exact:true}).click();await expect(page.getByRole('status')).toContainText('4MB 이하');await page.getByRole('button',{name:'파일 선택 취소',exact:true}).click();
  const pixels=await sharp({create:{width:900,height:600,channels:4,background:{r:20,g:100,b:60,alpha:.6}}}).png().withMetadata({exif:{IFD0:{Artist:'Synthetic test'}}}).toBuffer();
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/images')&&r.request().method()==='POST');await page.getByLabel('새 이미지 파일',{exact:true}).setInputFiles({name:'church.png',mimeType:'image/png',buffer:pixels});await page.getByRole('button',{name:'이미지 올리기',exact:true}).click();const asset=await (await uploaded).json();assets.push(asset.id);await expect(page.getByRole('status')).toContainText('이미지를 올렸습니다');
  expect((await request.get(`/api/images?id=${asset.id}`)).status()).toBe(404);
  await expect(preview.getByRole('img',{name:'검수용 초록색 교회 사진'})).toHaveJSProperty('complete',true);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장하고 홈페이지에 반영',exact:true}).click();await expect(page.getByRole('status')).toContainText('홈페이지에 반영되었습니다');
  const publicSettings=await request.get('/api/home-content');expect(publicSettings.headers()['cache-control']).toContain('no-store');const saved=(await publicSettings.json()).content;expect(saved.title_line1).toBe(title);expect(saved.revision).toBeUndefined();
  const image=await request.get(`/api/images?id=${asset.id}`);expect(image.status()).toBe(200);const meta=await sharp(await image.body()).metadata();expect(meta.exif).toBeUndefined();expect(meta.hasAlpha).toBe(true);
  const reader=await context.newPage();await reader.goto('/');await expect(reader.locator('#welcome-title')).toContainText(title);await expect(reader.getByRole('img',{name:'검수용 초록색 교회 사진'})).toBeVisible();
  for(const width of [2560,1440,1120,768,390,320]){await reader.setViewportSize({width,height:900});expect(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect.poll(()=>reader.locator('#welcome-title').evaluate(el=>Math.max(...Array.from(el.children).map(child=>child.scrollWidth))-el.clientWidth)).toBeLessThanOrEqual(1);}
  const axe=await new AxeBuilder({page:reader}).exclude('iframe').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);await reader.close();
  const deleted=await request.delete(`/api/images?id=${asset.id}`,{headers:{Authorization:`Bearer ${login.data.session!.access_token}`}});expect(deleted.status()).toBe(409);expect((await request.get(`/api/images?id=${asset.id}`)).status()).toBe(200);
  await page.route('**/api/images',r=>r.fulfill({status:503,json:{error:'사진 교체 실패'}}));await page.getByLabel('새 이미지 파일',{exact:true}).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:pixels});await page.getByRole('button',{name:'이미지 올리기',exact:true}).click();await expect(page.getByRole('status')).toContainText('사진 교체 실패');expect((await (await request.get('/api/home-content')).json()).content.image_asset_id).toBe(asset.id);await page.unroute('**/api/images');await page.getByRole('button',{name:'파일 선택 취소',exact:true}).click();
  const old=await db.from('homepage_content').select('*').single();if(old.error)throw old.error;
  const changed=await actor.rpc('save_homepage_content',{p_revision:old.data.revision,p_content:{...old.data,footnote:'다른 탭에서 먼저 저장'}});if(changed.error)throw changed.error;
  await page.getByLabel('하단 환영 문구',{exact:true}).fill('늦게 저장하는 입력');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장하고 홈페이지에 반영',exact:true}).click();await expect(page.getByRole('status')).toContainText('다른 곳에서 수정');await expect(page.getByLabel('하단 환영 문구',{exact:true})).toHaveValue('늦게 저장하는 입력');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'현재 공개 설정 다시 불러오기',exact:true}).click();await expect(page.getByLabel('하단 환영 문구',{exact:true})).toHaveValue('다른 탭에서 먼저 저장');
  const current=await db.from('homepage_content').select('*').single();if(current.error)throw current.error;
  expect((await actor.rpc('save_homepage_content',{p_revision:current.data.revision,p_content:{...current.data,title_line1:'줄\n바꿈'}})).error?.code).toBe('23514');
  const tiny=await request.post('/api/images',{headers:{Authorization:`Bearer ${login.data.session!.access_token}`,'x-image-title':'tiny','x-image-alt':'tiny'},data:await sharp({create:{width:12,height:12,channels:3,background:'#fff'}}).png().toBuffer()});expect(tiny.status()).toBe(201);const tinyAsset=await tiny.json();assets.push(tinyAsset.id);expect((await actor.rpc('save_homepage_content',{p_revision:current.data.revision,p_content:{...current.data,image_asset_id:tinyAsset.id}})).error?.message).toBe('IMAGE_RESOLUTION_REQUIRED');expect((await (await request.get('/api/home-content')).json()).content.image_asset_id).toBe(asset.id);
  await page.getByRole('combobox',{name:'표시 방식',exact:true}).selectOption('illustration');await expect(preview.getByRole('img',{name:'검수용 초록색 교회 사진'})).toHaveCSS('object-fit','contain');
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:'.local/home-cms-desktop.png',fullPage:true});
  for(const width of [1440,1120,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  const adminAxe=await new AxeBuilder({page}).exclude('iframe').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(adminAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await db.from('church_editors').delete().eq('user_id',uid);expect((await actor.rpc('save_homepage_content',{p_revision:current.data.revision,p_content:defaultHomeContent})).error?.code).toBe('42501');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByLabel('제목 첫째 줄',{exact:true})).toHaveCount(0);await expect(page.locator('iframe[title="홈페이지 첫 화면 미리보기"]')).toHaveCount(0);
 }finally{
  await actor.auth.signOut();await db.from('homepage_content').delete().eq('id',true);if(original.data){const restored=await db.from('homepage_content').insert(original.data);if(restored.error)throw restored.error;}
  for(const id of assets){await db.from('bulletin_images').delete().eq('id',id);await db.storage.from('bulletin-images').remove([`${id}.webp`]);}await db.auth.admin.deleteUser(uid);
 }
});
