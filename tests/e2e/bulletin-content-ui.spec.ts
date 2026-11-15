import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import {defaultPageSettings} from '../../lib/church-page-settings';

test('bulletin content-first editing hides duplicates, groups news, grows inputs and keeps settings reversible',async({page})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}}),email=randomUUID()+'@example.test',password=randomUUID(),id=randomUUID();const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 const seed=[
  {title:'함께 드리는 예배',body:'이번 주 표지',print_page:1},
  {title:'표지 사진',body:'[원본 사진 분리·확인 후 첨부 필요]',print_page:1},
  {title:'표지',body:'',print_page:1},
  {title:'주일 하늘보좌 예배',body:'함께 예배합니다.',kind:'worship',content:{rows:[['↑ 찬송','기쁨의 찬양','다 같이'],['성경봉독','요한복음 3:16','다 같이'],['말씀 선포','사랑의 예배','담임 목사']]},print_page:2},
  {title:'사랑의 예배',body:'',kind:'sermon',content:{reference:'요한복음 3:16',preacher:'담임 목사'},print_page:2},
  {title:'각종 예배 안내',body:'',kind:'worship',content:{rows:[['주일예배','오전 10:45','']]},print_page:2},
  {title:'예배 묵상 진행',body:'금요예배 안내',print_page:2},
  {title:'다음 주 봉사위원',body:'',kind:'worship',content:{rows:[['교회 청소','봉사팀','11/22']]},print_page:2},
  {title:'섬기는 이들',body:'',kind:'worship',content:{rows:[['담임 목사','담임',''],['찬양','찬양팀','']]},print_page:2},
  {title:'묵상 가이드',body:'말씀을 묵상합니다.',print_page:3},
  {title:'토라 & 토브',body:'이웃을 사랑합니다.',kind:'sermon',content:{reference:'요한복음 3:16',preacher:''},print_page:3},
  {title:'기도',body:'우리 교회를 위해 기도합니다.',print_page:3},
  {title:'좋은 소식 · 환영',body:'새가족을 환영합니다.',print_page:4},
  {title:'좋은 소식 · 중보',body:'비공개 인쇄 안내',web_visible:false,print_page:4},
  {title:'11월 기도 인도 · 안내',body:'',kind:'worship',content:{rows:[['11/22','기도팀','안내팀']]},print_page:4},
  {title:'11월 헌금 내역',body:'',kind:'offering',content:{month:'2026-11',rows:[['감사헌금','12345']]},print_page:4},
 ];
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});expect((await db.from('bulletins').insert({id,service_date:'2190-11-19',issue_number:591})).error).toBeNull();const records=seed.map((item,position)=>({id:randomUUID(),bulletin_id:id,position,title:item.title,body:item.body,kind:item.kind??'text',content:item.content??{},print_page:item.print_page,web_visible:item.web_visible??true,review_on_copy:true,needs_review:false}));expect((await db.from('bulletin_items').insert(records)).error).toBeNull();
  const settings=structuredClone(defaultPageSettings);settings.worship_times[0].time='12:34';await page.route('**/api/church-settings',route=>route.fulfill({json:{groups:settings}}));
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:/2190-11-19/}).click();await page.getByRole('button',{name:'수정',exact:true}).click();
  const cover=page.locator('#bulletin-section-0'),order=page.locator('#bulletin-section-1'),guide=page.locator('#bulletin-section-2'),news=page.locator('#bulletin-section-6');
  await expect(page.getByLabel('웹에 공개',{exact:true})).toHaveCount(0);await expect(page.getByText('다음 주 복사할 때 다시 확인',{exact:true})).toHaveCount(0);await expect(page.locator('#bulletin-fields').getByRole('button',{name:'+ 추가',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'함께 드리는 예배 삭제',exact:true})).toHaveCount(0);
  await expect(cover.getByLabel('항목 제목',{exact:true})).toHaveCount(1);await expect(cover.getByLabel('내용',{exact:true})).toHaveCount(1);await expect(cover.getByText('표지 사진',{exact:true})).toHaveCount(0);await expect(cover.getByText('[원본 사진 분리·확인 후 첨부 필요]',{exact:true})).toHaveCount(0);
  const body=cover.getByLabel('내용',{exact:true}),small=(await body.boundingBox())!.height;await body.fill('긴 내용을 확인합니다.\n'.repeat(9));await expect.poll(async()=>(await body.boundingBox())!.height).toBeGreaterThan(small+100);await body.fill('간단한 표지 문구');await expect.poll(async()=>(await body.boundingBox())!.height).toBeLessThan(small+20);const bounds=await body.boundingBox(),picker=await cover.getByText('이미지 추가',{exact:true}).boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(picker!.y);
  await expect(order.getByLabel('설교자',{exact:true})).toHaveCount(0);await expect(order.getByRole('heading',{name:'사랑의 예배',exact:true})).toHaveCount(0);await expect(guide.getByRole('heading',{name:'예배 공지사항',exact:true})).toBeVisible();await expect(guide.getByText('각종 예배 안내',{exact:true})).toHaveCount(0);await expect(guide.getByLabel('항목 제목',{exact:true})).toHaveCount(0);await expect(guide.getByLabel('내용',{exact:true})).toHaveCount(1);
  const serving=guide.getByRole('article',{name:'섬기는 이들',exact:true});await expect(serving.getByPlaceholder('담당자',{exact:true})).toHaveCount(0);await expect(serving.locator('[data-row="0"] textarea')).toHaveCount(2);await expect(news.getByRole('group',{name:'좋은 소식 내용',exact:true})).toBeVisible();await expect(news.getByRole('heading',{name:'환영',exact:true})).toBeVisible();await expect(news.getByRole('heading',{name:'11월 기도 인도 · 안내',exact:true})).toBeVisible();await expect(guide.getByText('11월 기도 인도 · 안내',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'주보 설정',exact:true}).click();await page.getByLabel('웹 공개 설정 표시',{exact:true}).check();await page.getByRole('button',{name:'돌아가기',exact:true}).click();await expect(news.getByRole('article',{name:'중보',exact:true}).getByLabel('웹에 공개',{exact:true})).not.toBeChecked();await expect(body).toHaveValue('간단한 표지 문구');
  await page.getByRole('button',{name:'주보 설정',exact:true}).click();await page.getByLabel('웹 공개 설정 표시',{exact:true}).uncheck();await page.getByRole('button',{name:'돌아가기',exact:true}).click();await expect(page.getByLabel('웹에 공개',{exact:true})).toHaveCount(0);
  const cell=serving.getByRole('textbox',{name:'섬기는 이들 1행 이름',exact:true});await cell.fill('긴 이름\n'.repeat(5));await expect.poll(async()=>(await cell.boundingBox())!.height).toBeGreaterThan(100);await cell.fill('담임');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.local/bulletin-content-${width}.png`,fullPage:true});await guide.screenshot({path:`.local/bulletin-guide-${width}.png`});await news.screenshot({path:`.local/bulletin-news-${width}.png`});}expect((await new AxeBuilder({page}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
  await expect.poll(async()=>{const result=await db.from('bulletin_items').select('body').eq('id',records[0].id).single();return result.data?.body;}).toBe('간단한 표지 문구');const stored=await db.from('bulletin_items').select('title,web_visible,review_on_copy').eq('bulletin_id',id).order('position');expect(stored.data?.map(item=>item.title)).toEqual(records.map(item=>item.title));expect(stored.data?.map(item=>item.web_visible)).toEqual(records.map(item=>item.web_visible));expect(stored.data?.every(item=>item.review_on_copy)).toBe(true);
  await page.getByRole('button',{name:'인쇄 미리보기',exact:true}).click();const print=page.getByRole('dialog',{name:'관리자 인쇄 미리보기',exact:true});await expect(print.getByText('주일 오후 12:34',{exact:true})).toBeVisible();await expect(print.getByText('[원본 사진 분리·확인 후 첨부 필요]',{exact:true})).toHaveCount(0);await expect(print.getByRole('heading',{name:'사랑의 예배',exact:true})).toHaveCount(0);await expect(print.getByRole('region',{name:'좋은 소식',exact:true})).toHaveCount(1);await expect(print.getByRole('heading',{name:'예배 공지사항',exact:true})).toBeVisible();await print.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:/2190-11-19/}).click();await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByLabel('웹에 공개',{exact:true})).toHaveCount(0);await expect(cover.getByLabel('내용',{exact:true})).toHaveValue('간단한 표지 문구');
 }finally{await db.from('bulletins').delete().eq('id',id);await db.auth.admin.deleteUser(user.data.user.id);}
});
