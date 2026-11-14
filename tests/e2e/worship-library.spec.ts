import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
test('editor video registration, representative changes, conflict rollback and public pagination enforce permissions',async({page,request})=>{
 const key=process.env.LOCAL_SUPABASE_SERVICE_KEY,pub=process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;if(!key||!pub)throw new Error('Local keys required');
 const db=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false}});
 const email=`${randomUUID()}@example.test`,password=`${randomUUID()}-Aa1!`;
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;const uid=user.data.user.id,ids:string[]=[];
 const client=createClient('http://127.0.0.1:54321',pub,{auth:{persistSession:false}});const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
 const save=(id:string,rev:number,status='draft',featured=false,title='검수 예배')=>client.rpc('save_worship_video',{p_id:id,p_revision:rev,p_type:'afternoon',p_date:'2026-11-08',p_video:id.replaceAll('-','').slice(0,11),p_title:title,p_status:status,p_featured:featured});
 try{
  const a=randomUUID(),b=randomUUID();ids.push(a,b);expect((await save(a,0)).error?.code).toBe('42501');
  const membership=await db.from('church_editors').insert({user_id:uid});if(membership.error)throw membership.error;
  expect((await save(a,0)).error).toBeNull();expect((await request.get('/api/worship/videos?type=afternoon')).headers()['cache-control']).toContain('no-store');
  expect((await (await request.get('/api/worship/videos?type=afternoon')).json()).videos.some((v:{id:string})=>v.id===a)).toBe(false);
  const published=await save(a,1,'published',true);if(published.error)throw published.error;
  const featuredB=await save(b,0,'published',true);if(featuredB.error)throw featuredB.error;
  expect((await save(a,2,'published',true)).error?.code).toBe('40001');
  let body=await (await request.get('/api/worship/videos?type=afternoon')).json();expect(body.featured.id).toBe(b);expect(body.videos.every((v:object)=>!('revision' in v)&&!('status' in v))).toBe(true);
  const outsider=await db.from('church_editors').delete().eq('user_id',uid);if(outsider.error)throw outsider.error;
  expect((await save(b,1,'archived')).error?.code).toBe('42501');expect((await client.from('worship_videos').select('*')).data).toEqual([]);
  const memberAgain=await db.from('church_editors').insert({user_id:uid});if(memberAgain.error)throw memberAgain.error;
  const archived=await save(b,1,'archived');if(archived.error)throw archived.error;
  const fixtures=Array.from({length:23},(_,i)=>({id:randomUUID(),service_type:'afternoon',service_date:'2026-11-01',video_id:`x${String(i).padStart(10,'0')}`,title:`페이지 검수 ${i}`,status:'published'}));ids.push(...fixtures.map(x=>x.id));const inserted=await db.from('worship_videos').insert(fixtures);if(inserted.error)throw inserted.error;
  const seen:string[]=[];let cursor:null|{date:string;id:string}=null;
  do{const response=await request.get('/api/worship/videos?type=afternoon'+(cursor?`&beforeDate=${cursor.date}&beforeId=${cursor.id}`:''));expect(response.status()).toBe(200);body=await response.json();seen.push(...body.videos.map((v:{id:string})=>v.id));cursor=body.next;}while(cursor);
  expect(new Set(seen).size).toBe(seen.length);for(const id of [a,...fixtures.map(x=>x.id)])expect(seen).toContain(id);expect(seen).not.toContain(b);
  expect((await request.get('/api/worship/videos?type=evil')).status()).toBe(400);
  await page.goto('/worship/afternoon');const list=page.getByRole('region',{name:'주일오후예배 영상 목록'});await expect(list).toBeVisible();
  await list.getByRole('button',{name:'이전 영상 더 보기',exact:true}).click();await expect(list.getByRole('button',{name:'이전 영상 더 보기',exact:true})).toHaveCount(0);
  const choice=list.getByRole('button').filter({hasText:'페이지 검수 22'});await choice.focus();await page.keyboard.press('Enter');await expect(choice).toHaveAttribute('aria-pressed','true');await expect(page.locator('iframe[title="주일오후예배 영상"]')).toHaveAttribute('src',/x0000000022/);
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  const axe=await new AxeBuilder({page}).exclude('iframe').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
 }finally{await client.auth.signOut();if(ids.length){const removed=await db.from('worship_videos').delete().in('id',ids);if(removed.error)throw removed.error;}const removed=await db.auth.admin.deleteUser(uid);if(removed.error)throw removed.error;}
});

test('admin video form saves drafts, publishes, protects unsaved inputs and scrolls smoothly',async({page,request})=>{
 const key=process.env.LOCAL_SUPABASE_SERVICE_KEY;if(!key)throw new Error('Local key required');const db=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false}});
 const email=`${randomUUID()}@example.test`,password=`${randomUUID()}-Aa1!`,title=`UI 예배 ${randomUUID()}`;
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;const uid=user.data.user.id;
 try{
  await db.from('church_editors').insert({user_id:uid});await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:'예배 영상 관리',exact:true}).click();
  await page.getByRole('button',{name:'영상 등록',exact:true}).click();await page.getByRole('combobox',{name:'종류',exact:true}).selectOption('friday');await page.getByLabel('날짜',{exact:true}).fill('2026-11-06');await page.getByLabel('링크',{exact:true}).fill('https://youtu.be/OSfMkv-YWJQ');await page.getByLabel('제목',{exact:true}).fill(title);
  await page.getByRole('button',{name:'임시 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('임시 저장');
  expect((await (await request.get('/api/worship/videos?type=friday')).json()).videos.some((v:{title:string})=>v.title===title)).toBe(false);
  await page.getByRole('checkbox',{name:'이 예배의 대표 영상으로 지정'}).check();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('저장했습니다');
  const body=await (await request.get('/api/worship/videos?type=friday')).json();expect(body.featured.title).toBe(title);
  await page.screenshot({path:'.local/worship-admin-desktop.png',fullPage:true});
  const reader=await page.context().newPage();await reader.goto('/worship/friday');await expect(reader.getByRole('heading',{name:title,exact:true})).toBeVisible();await reader.screenshot({path:'.local/worship-public-desktop.png',fullPage:true});await reader.close();
  await page.evaluate(()=>{const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){document.documentElement.dataset.scrollBehavior=typeof options==='object'?options.behavior:'';return original.call(this,options);};scrollTo(0,0);});
  await page.getByRole('navigation',{name:'페이지 목차'}).getByRole('link',{name:/저장/}).click();expect(await page.locator('html').getAttribute('data-scroll-behavior')).toBe('smooth');await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(200);await expect(page.locator('#video-publication')).toBeFocused();
  await page.getByLabel('제목',{exact:true}).fill(title+' 수정');page.once('dialog',d=>d.dismiss());await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:'주보 관리',exact:true}).click();await expect(page).toHaveURL(/\/admin\/worship/);
  await page.route('**/rest/v1/rpc/save_worship_video',r=>r.fulfill({status:503,json:{message:'offline'}}));page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('입력 내용은 화면에 유지');await expect(page.getByLabel('제목',{exact:true})).toHaveValue(title+' 수정');await page.unroute('**/rest/v1/rpc/save_worship_video');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  const axe=await new AxeBuilder({page}).exclude('iframe').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:'.local/worship-admin-mobile.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('navigation',{name:'페이지 목차'}).getByRole('link',{name:/저장/}).click();expect(await page.locator('html').getAttribute('data-scroll-behavior')).toBe('instant');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'공개 목록에서 내리기',exact:true}).click();await expect(page.getByRole('status')).toContainText('공개 목록에서 내렸습니다');expect((await (await request.get('/api/worship/videos?type=friday')).json()).videos.some((v:{title:string})=>v.title===title)).toBe(false);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByLabel('제목',{exact:true})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'관리 메뉴'})).toHaveCount(0);
 }finally{await db.from('worship_videos').delete().like('title',title+'%');await db.auth.admin.deleteUser(uid);}
});

test('video pages, chips, date range and automatic title keep editing simple',async({page,request})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const email=`${randomUUID()}@example.test`,password=randomUUID(),prefix=`detail-${randomUUID()}`;
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 const fixtures=[{id:randomUUID(),service_type:'sunday',service_date:'2026-11-02',video_id:randomUUID().replaceAll('-','').slice(0,11),title:prefix+' 첫째',status:'draft'},{id:randomUUID(),service_type:'friday',service_date:'2026-11-13',video_id:randomUUID().replaceAll('-','').slice(0,11),title:prefix+' 둘째',status:'draft'}];
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});expect((await db.from('worship_videos').insert(fixtures)).error).toBeNull();
  expect((await request.get('/api/worship/title?id=OSfMkv-YWJQ')).status()).toBe(401);
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:'예배 영상 관리',exact:true}).click();
  const toc=page.getByRole('navigation',{name:'페이지 목차'}),list=page.locator('#video-library');
  await expect(toc.getByRole('button',{name:'영상 목록',exact:true})).toHaveAttribute('aria-expanded','true');await expect(toc.getByRole('button',{name:'영상 등록',exact:true})).toHaveAttribute('aria-expanded','false');await expect(page.getByLabel('링크',{exact:true})).toHaveCount(0);
  await page.getByLabel('영상 검색').fill(prefix);await expect(list.locator('li')).toHaveCount(2);
  await page.getByRole('group',{name:'예배 종류 필터'}).getByRole('button',{name:'금요예배',exact:true}).click();await expect(list.locator('li')).toHaveCount(1);await page.getByRole('group',{name:'예배 종류 필터'}).getByRole('button',{name:'모든 예배'}).click();
  await page.getByRole('button',{name:'날짜 검색',exact:true}).click();const calendar=page.getByRole('dialog',{name:'날짜 검색'});await calendar.getByLabel('시작 날짜').fill('2026-11-01');await calendar.getByLabel('끝 날짜').fill('2026-11-08');await calendar.getByRole('button',{name:'적용',exact:true}).click();await expect(list.locator('li')).toHaveCount(1);await expect(list).toContainText(prefix+' 첫째');
  await page.getByRole('button',{name:'날짜 검색',exact:true}).click();await calendar.getByRole('button',{name:'2, 2026년 11월',exact:true}).click();await calendar.getByRole('button',{name:'8, 2026년 11월',exact:true}).click();await expect(calendar.getByLabel('시작 날짜')).toHaveValue('2026-11-02');await expect(calendar.getByLabel('끝 날짜')).toHaveValue('2026-11-08');await calendar.getByRole('button',{name:'초기화'}).click();await expect(list.locator('li')).toHaveCount(2);
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'날짜 검색',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html}))}))).toEqual([]);await page.screenshot({path:`.local/worship-calendar-${width}.png`,fullPage:true});await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'날짜 검색',exact:true})).toBeFocused();}
  await toc.getByRole('button',{name:'영상 등록',exact:true}).click();await expect(list).toHaveCount(0);await expect(toc.getByRole('button',{name:'영상 목록',exact:true})).toHaveAttribute('aria-expanded','false');await expect(page.getByText('영상 확인',{exact:true})).toHaveCount(0);
  await page.route('**/api/worship/title?*',async route=>{await new Promise(resolve=>setTimeout(resolve,600));await route.fulfill({json:{title:'자동으로 가져온 제목'}});});
  await page.getByLabel('링크',{exact:true}).fill('https://youtu.be/OSfMkv-YWJQ');await expect(page.getByLabel('제목',{exact:true})).toHaveValue('자동으로 가져온 제목');await expect(page.locator('iframe')).toBeVisible();
  await page.getByLabel('링크',{exact:true}).fill('https://youtu.be/abcdefghijk');await page.getByLabel('제목',{exact:true}).fill('직접 쓴 제목');await page.waitForResponse('**/api/worship/title?*');await expect(page.getByLabel('제목',{exact:true})).toHaveValue('직접 쓴 제목');
  page.once('dialog',d=>d.dismiss());await toc.getByRole('button',{name:'영상 목록',exact:true}).click();await expect(page.getByLabel('제목',{exact:true})).toHaveValue('직접 쓴 제목');
 }finally{await db.from('worship_videos').delete().in('id',fixtures.map(row=>row.id));await db.auth.admin.deleteUser(user.data.user.id);}
});
