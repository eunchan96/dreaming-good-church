import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test('content settings remain reversible and auto-sizing preserves private flags',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID(),id=randomUUID();const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});expect((await db.from('bulletins').insert({id,service_date:'2190-11-19',issue_number:591})).error).toBeNull();expect((await db.from('bulletin_items').insert([
   {id:ids[0],bulletin_id:id,position:0,title:'묵상 가이드',body:'묵상',kind:'text',content:{},web_visible:true,review_on_copy:true},
   {id:ids[1],bulletin_id:id,position:1,title:'좋은 소식 · 중보',body:'인쇄에만 포함할 내용',kind:'text',content:{},web_visible:false,review_on_copy:true},
   {id:ids[2],bulletin_id:id,position:2,title:'섬기는 이들',body:'',kind:'worship',content:{rows:[['교회 청소','담임','']]},web_visible:true,review_on_copy:true},
  ])).error).toBeNull();
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:/2190-11-19/}).click();await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByLabel('웹에 공개',{exact:true})).toHaveCount(0);
  const body=page.getByLabel('묵상',{exact:true}),small=(await body.boundingBox())!.height;await body.fill('긴 내용\n'.repeat(10));await expect.poll(async()=>(await body.boundingBox())!.height).toBeGreaterThan(small+100);await body.fill('간단한 묵상');await expect.poll(async()=>(await body.boundingBox())!.height).toBeLessThan(small+20);
  await page.getByRole('button',{name:'주보 설정',exact:true}).click();await page.getByLabel('웹 공개 설정 표시',{exact:true}).check();await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('button',{name:'주보 등록',exact:true}).click();await expect(page.getByRole('checkbox',{name:'중보 웹에 공개',exact:true})).not.toBeChecked();await expect(body).toHaveValue('간단한 묵상');await page.getByRole('button',{name:'주보 설정',exact:true}).click();await page.getByLabel('웹 공개 설정 표시',{exact:true}).uncheck();await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('button',{name:'주보 등록',exact:true}).click();
  const cell=page.getByRole('textbox',{name:'섬기는 이들 1행 이름',exact:true});await cell.fill('긴 이름\n'.repeat(5));await expect.poll(async()=>(await cell.boundingBox())!.height).toBeGreaterThan(100);await cell.fill('담임');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}expect((await new AxeBuilder({page}).analyze()).violations.map(v=>v.id)).toEqual([]);
  await expect.poll(async()=>(await db.from('bulletin_items').select('body').eq('id',ids[0]).single()).data?.body).toBe('간단한 묵상');const stored=await db.from('bulletin_items').select('web_visible,review_on_copy').eq('bulletin_id',id).order('position');expect(stored.data?.map(item=>item.web_visible)).toEqual([true,false,true]);expect(stored.data?.every(item=>item.review_on_copy)).toBe(true);
  await page.reload();await page.getByRole('button',{name:/2190-11-19/}).click();await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByLabel('웹에 공개',{exact:true})).toHaveCount(0);await expect(body).toHaveValue('간단한 묵상');
 }finally{await db.from('bulletins').delete().eq('id',id);await db.auth.admin.deleteUser(user.data.user.id);}
});
