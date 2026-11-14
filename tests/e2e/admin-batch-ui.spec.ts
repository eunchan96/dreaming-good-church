import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test('all management pages share concise headings, mobile layouts and accessible editing controls',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const email=`${randomUUID()}@example.test`,password=randomUUID();
 const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByRole('button',{name:'+ 새 주보 작성',exact:true}).click();await page.getByLabel('추가할 항목 종류').selectOption('worship');await page.getByRole('button',{name:'+ 항목 추가',exact:true}).click();
  await page.getByRole('button',{name:/행 추가$/}).click();
  await expect(page.getByLabel('예배 순서 1행 예배 순서',{exact:true})).toBeVisible();
  for(const [path,label,section] of [['bulletins','주보 관리','게시 전 확인'],['worship','예배 영상 관리','저장'],['church','교회 정보·이미지 관리','이미지 보관함']] as const){
   if(path!=='bulletins'){
    await page.setViewportSize({width:1440,height:1000});page.once('dialog',d=>d.accept());await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:label,exact:true}).click();
    if(path==='worship'){await page.getByRole('button',{name:'영상 등록',exact:true}).click();await page.getByLabel('링크',{exact:true}).fill('https://youtu.be/OSfMkv-YWJQ');await page.getByLabel('제목',{exact:true}).fill('관리자 화면 검수용 영상');}
   }
   await expect(page.getByRole('heading',{name:label,level:1,exact:true})).toBeVisible();await expect(page.locator('[data-tip-panel]')).toHaveCount(0);
   const title=await page.getByRole('region',{name:'페이지 제목'}).boundingBox(),toc=await page.getByRole('navigation',{name:'페이지 목차'}).boundingBox();expect(title!.y+title!.height).toBeLessThanOrEqual(toc!.y);
   for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
   expect((await new AxeBuilder({page}).exclude('iframe').analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
   await page.screenshot({path:`.local/admin-batch-${path}-mobile.png`,fullPage:true,animations:'disabled'});
   await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`.local/admin-batch-${path}-desktop.png`,fullPage:true,animations:'disabled'});
   await page.getByRole('navigation',{name:'페이지 목차'}).getByRole('link',{name:new RegExp(section)}).click();
   await expect(page.locator(':focus')).toHaveAttribute('id',path==='bulletins'?'publication-check':path==='worship'?'video-publication':'church-images');
  }
 }finally{await db.auth.admin.deleteUser(user.data.user.id);}
});
