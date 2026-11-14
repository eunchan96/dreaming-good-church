import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test('community list, concise editor and publication states preserve drafts and conflict protection',async({page,context})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const email=`${randomUUID()}@example.test`,password=randomUUID(),prefix=`UI-${randomUUID().slice(0,8)}`;
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 const rows=[
  {id:randomUUID(),kind:'notice',title:`${prefix} 공개 공지`,body:'공개 안내',status:'published',is_public:true,sensitive:false,publish_from:'2000-01-01T00:00:00Z',publish_until:null},
  {id:randomUUID(),kind:'event',title:`${prefix} 예정 모임`,body:'모임',status:'published',is_public:true,sensitive:false,publish_from:'2190-01-01T00:00:00Z',starts_at:'2190-01-02T04:00:00Z'},
  {id:randomUUID(),kind:'notice',title:`${prefix} 종료 공지`,body:'종료',status:'published',is_public:true,sensitive:false,publish_until:'2001-01-01T00:00:00Z'},
  {id:randomUUID(),kind:'notice',title:`${prefix} 민감 공지`,body:'비공개',status:'published',is_public:false,sensitive:true},
  {id:randomUUID(),kind:'event',title:`${prefix} 보관 모임`,body:'보관',status:'archived',is_public:true,sensitive:false,starts_at:'2190-01-03T04:00:00Z'},
 ];
 try{
  expect((await db.from('church_editors').insert({user_id:user.data.user.id})).error).toBeNull();expect((await db.from('community_entries').insert(rows)).error).toBeNull();
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:'공지·일정 관리',exact:true}).click();
  const list=page.getByRole('region',{name:'소식 목록',exact:true});const item=(title:string)=>list.getByRole('button').filter({hasText:prefix+' '+title});await page.getByLabel('소식 제목 검색').fill(prefix);
  for(const [title,state] of [['공개 공지','공개'],['예정 모임','공개 예정'],['종료 공지','게시 종료'],['민감 공지','비공개'],['보관 모임','보관']])await expect(item(title).getByText(state,{exact:true})).toBeVisible();
  await page.getByRole('group',{name:'소식 종류'}).getByRole('button',{name:'일정',exact:true}).click();await expect(list.locator('li')).toHaveCount(2);await page.getByRole('group',{name:'소식 종류'}).getByRole('button',{name:'공지',exact:true}).click();await expect(list.locator('li')).toHaveCount(3);
  await item('공개 공지').click();await expect(page.getByLabel('게시 기간 시작',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'저장',exact:true})).toBeDisabled();
  const heading=await page.getByRole('region',{name:'페이지 제목',exact:true}).boundingBox(),toc=await page.getByRole('navigation',{name:'페이지 목차'}).boundingBox();expect(heading!.y+heading!.height).toBeLessThanOrEqual(toc!.y);
  await expect(list).toHaveCount(0);await page.getByLabel('내용',{exact:true}).fill('미저장 변경');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'소식 목록',exact:true}).click();await expect(page.getByLabel('내용',{exact:true})).toHaveValue('미저장 변경');
  const saved=await db.from('community_entries').select('*').eq('id',rows[0].id).single();expect(saved.error).toBeNull();await db.from('community_entries').update({body:'다른 편집에서 먼저 저장',revision:saved.data!.revision+1}).eq('id',rows[0].id);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('다른 화면에서 수정');await expect(page.getByLabel('내용',{exact:true})).toHaveValue('미저장 변경');

  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:'.local/community-ui-mobile.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.local/community-ui-desktop.png',fullPage:true,animations:'disabled'});
  // Explicit list refresh confirms discarding input; a network error remains a list error.
  await page.route('**/rest/v1/community_entries?*',r=>r.fulfill({status:503,json:{message:'unavailable'}}));page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'소식 목록',exact:true}).click();await page.getByRole('button',{name:'목록 새로 불러오기',exact:true}).click();await expect(list.getByRole('status')).toContainText('불러오지 못했습니다',{timeout:15000});await expect(page.getByRole('button',{name:'로그아웃',exact:true})).toBeVisible();await page.unroute('**/rest/v1/community_entries?*');await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).click();await expect(item('공개 공지')).toBeVisible();
  await page.getByRole('group',{name:'소식 종류'}).getByRole('button',{name:'전체',exact:true}).click();await item('보관 모임').click();await page.getByRole('button',{name:'임시 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('저장했습니다');await expect(page.getByRole('button',{name:'임시 저장',exact:true})).toBeDisabled();await expect(page.getByRole('status')).toHaveCount(0,{timeout:6000});await page.getByRole('button',{name:'소식 목록',exact:true}).click();await page.getByRole('group',{name:'소식 종류'}).getByRole('button',{name:'일정',exact:true}).click();await item('예정 모임').click();await page.getByText('추가 작업',{exact:true}).click();await page.getByRole('button',{name:'다음 주 일정으로 복사',exact:true}).click();await expect(page.getByLabel('시작 시간',{exact:true})).toHaveValue('2190-01-09T13:00');await expect(page.getByLabel('게시 기간 시작',{exact:true})).not.toBeVisible();
  const auth=await context.newPage();await auth.goto('/admin/bulletins');await auth.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByRole('heading',{name:'작성하던 내용을 이어가세요'})).toBeVisible();await expect(page.getByLabel('제목',{exact:true})).toHaveCount(0);await auth.getByLabel('이메일',{exact:true}).fill(email);await auth.getByLabel('비밀번호',{exact:true}).fill(password);await auth.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.getByLabel('시작 시간',{exact:true})).toHaveValue('2190-01-09T13:00');
 }finally{await db.from('community_entries').delete().in('id',rows.map(row=>row.id));await db.auth.admin.deleteUser(user.data.user.id);}
});
