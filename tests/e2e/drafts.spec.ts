import {calendarControl,selectCalendar} from './calendar-helpers';
import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test('bulletin archive, reader, eight-section editor, reorder, copy and print keep independent content',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const email=randomUUID()+'@example.test',password=randomUUID(),user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page.locator('#bulletin-fields')).toHaveCount(0);await page.getByRole('button',{name:'주보 등록',exact:true}).click();await expect(page.locator('#bulletin-library')).toHaveCount(0);
  const headers=['표지','예배 순서','예배 안내','묵상 가이드','토라&토브','기도','좋은 소식','헌금 내역'];for(const title of headers)await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.getByLabel('내용',{exact:true})).toHaveCount(8);
  await selectCalendar(page,calendarControl(page,'예배 날짜'),'2097-11-03');await page.getByLabel('내용',{exact:true}).first().fill('이번 주 표지');
  const order=page.locator('#bulletin-section-1');await order.getByRole('textbox',{name:'예배 순서 1행 예배 순서',exact:true}).fill('찬송');await order.getByRole('button',{name:'예배 순서 행 추가',exact:true}).click();await order.getByRole('textbox',{name:'예배 순서 2행 예배 순서',exact:true}).fill('기도');
  await order.getByRole('button',{name:'예배 순서 2행 이동',exact:true}).focus();await page.keyboard.press('ArrowUp');await expect(order.getByRole('textbox',{name:'예배 순서 1행 예배 순서',exact:true})).toHaveValue('기도');
  const handle=order.getByRole('button',{name:'예배 순서 1행 이동',exact:true});await handle.scrollIntoViewIfNeeded();const from=await handle.boundingBox(),to=await order.getByRole('textbox',{name:'예배 순서 2행 예배 순서',exact:true}).boundingBox();await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(to!.x+20,to!.y+to!.height/2,{steps:8});await page.mouse.up();await expect(order.getByRole('textbox',{name:'예배 순서 1행 예배 순서',exact:true})).toHaveValue('찬송');
  await order.getByRole('button',{name:'예배 순서 1행 일어서서',exact:true}).click();await expect(order.getByRole('textbox',{name:'예배 순서 1행 예배 순서',exact:true})).toHaveValue('찬송');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await order.screenshot({path:`.local/bulletin-rows-${width}.png`});}
  expect((await new AxeBuilder({page}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('초안을 저장했습니다');
  await page.getByRole('button',{name:'주보 보관함',exact:true}).click();await page.getByRole('button',{name:/2097-11-03/}).click();await expect(page.getByRole('heading',{name:'웹 표시 미리보기',exact:true})).toBeVisible();await expect(page.getByText('이번 주 표지',{exact:true})).toBeVisible();await expect(page.getByLabel('내용',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByLabel('내용',{exact:true}).first()).toHaveValue('이번 주 표지');await expect(order.getByRole('button',{name:'예배 순서 1행 일어서서',exact:true})).toHaveAttribute('aria-pressed','true');await expect(order.getByRole('textbox',{name:'예배 순서 1행 예배 순서',exact:true})).toHaveValue('찬송');
  await selectCalendar(page,calendarControl(page,'새 주보 날짜'),'2097-11-10');await page.getByRole('button',{name:'다음 주 주보 복사',exact:true}).click();await expect(page.getByRole('status')).toContainText('내용과 공개 설정을 복사');await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByText('8개 항목 확인 필요',{exact:true})).toBeVisible();await page.getByLabel('내용',{exact:true}).first().fill('다음 주 표지');
  await page.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('초안을 저장했습니다');
  // Legacy print-only blocks remain persisted and can be reviewed in the print view.
  const result=await db.from('bulletins').select('id').eq('service_date','2097-11-10').single();if(result.error)throw result.error;
  const inserted=await db.from('bulletin_items').insert([{bulletin_id:result.data.id,position:8,title:'메모',body:'인쇄 메모',needs_review:true,web_visible:true},{bulletin_id:result.data.id,position:9,title:'교회 안내',body:'기존 교회 안내',needs_review:false,web_visible:true}]);expect(inserted.error).toBeNull();
  await page.reload();await page.getByRole('button',{name:/2097-11-10/}).click();await expect(page.getByText('인쇄 메모',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByLabel('내용',{exact:true})).toHaveCount(8);
  await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();const print=page.getByRole('dialog',{name:'관리자 인쇄 미리보기',exact:true});await expect(print.getByText('인쇄 메모',{exact:true})).toBeVisible();await expect(print.getByText('기존 교회 안내',{exact:true})).toBeVisible();await print.getByText('항목별 면 배치',{exact:true}).click();await print.locator('div').filter({hasText:/^메모그대로 사용$/}).getByRole('button',{name:'그대로 사용',exact:true}).click();await print.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
  await page.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('초안을 저장했습니다');
  await page.getByRole('button',{name:'주보 보관함',exact:true}).click();await page.getByRole('button',{name:/2097-11-03/}).click();await expect(page.getByText('이번 주 표지',{exact:true})).toBeVisible();await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();await expect(print.getByRole('heading',{name:'메모',exact:true})).toBeVisible();await expect(print.getByRole('heading',{name:'교회 안내',exact:true})).toBeVisible();await print.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
 }finally{await db.from('bulletins').delete().in('service_date',['2097-11-03','2097-11-10']);await db.auth.admin.deleteUser(user.data.user.id);}
});
