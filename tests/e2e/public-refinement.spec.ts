import { test, expect } from '@playwright/test';
test('wide hero margins, compact footer and new install route remain aligned', async ({ page }) => {
  await page.goto('/');
  for (const width of [2560,1920,1440,1024,768,390,320]) {
    await page.setViewportSize({ width, height: 1000 });
    const note = page.getByText('꿈꾸는좋은교회에 오신 여러분을 환영합니다.', { exact: true });
    const bounds = await note.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(22);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const footer = page.locator('footer');
  await expect(footer.locator('img[src*="church-banner"]')).toHaveCount(0);
  await expect(footer.getByText('우리의 일상에서 더 깊은 사랑.', { exact:false })).toHaveCount(0);
  await footer.getByRole('link',{name:'앱 추가',exact:true}).click();
  await expect(page).toHaveURL(/\/install$/);
  await expect(page.getByRole('button',{name:'공개 주보·안내 저장',exact:true})).toBeVisible();
});
test('public weekly sections recover, render long content and follow news navigation', async ({ page }) => {
  let failed = true;
  await page.route('**/api/bulletin-sections?section=torah-tov', r => r.fulfill(failed ? { status:503,json:{} } : { json:{ serviceDate:'2026-11-08', items:[{id:'t',kind:'text',title:'토라&토브',body:'이번 주 암송\n'+ '말씀을 묵상합니다. '.repeat(100)}] } }));
  await page.goto('/torah-tov');
  await expect(page.getByRole('status')).toContainText('불러오지 못했습니다');
  failed = false;await page.getByRole('button',{name:'다시 불러오기'}).click();
  await expect(page.getByText('2026-11-08 주보에 실린 내용입니다.')).toBeVisible();
  await expect(page.getByRole('link',{name:'이 주보 전체 보기'})).toHaveAttribute('href','/bulletins/2026-11-08');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await expect(page.getByRole('navigation',{name:'소식 메뉴'}).getByRole('link',{name:'토라&토브'})).toHaveAttribute('aria-current','page');
});
test('confirmed offering and afternoon time, zoomed directions and anonymous API contract', async ({ page, request }) => {
  await page.route('**/api/church',r=>r.fulfill({json:{fields:[]}}));
  await page.goto('/church/offering');
  for(const number of ['301-0223-0182-71','301-0220-0484-81'])await expect(page.getByText(number,{exact:true})).toBeVisible();
  await page.goto('/church/worship-times');await expect(page.getByText('첫째·셋째 주일 오후 1:00',{exact:true})).toBeVisible();
  await page.goto('/church/directions');await expect(page.locator('iframe[title="꿈꾸는좋은교회 위치 지도"]')).toHaveAttribute('src',/q=37\.6223746%2C126\.8354385&z=16/);
  await expect(page.getByText('샘터마을2단지아파트 앞 · 행신초등학교에서 도보 2분',{exact:true})).toBeVisible();
  await expect(page.getByText('경기도 고양시 덕양구 충장로 118-35, 선아빌딩 5층',{exact:true}).first()).toBeVisible();
  expect((await request.get('/api/bulletin-sections?section=invalid')).status()).toBe(400);
  const r=await request.get('/api/bulletin-sections?section=torah-tov');expect(r.ok()).toBe(true);expect(Array.isArray((await r.json()).items)).toBe(true);
});
test('weekly service passages sit under their own times and stay out of the introduction timetable',async({page})=>{
  await page.route('**/api/church',r=>r.fulfill({json:{fields:[]}}));
  let fail=false;
  await page.route('**/api/bulletin-sections?section=worship',r=>r.fulfill(fail?{status:503,json:{}}:{json:{serviceDate:'2026-11-08',readings:{dawn:'사도행전 11장',friday:'갈라디아서 1장',sunday:'사도행전 12장'}}}));
  await page.goto('/worship');
  const times=page.getByRole('region',{name:'함께 예배하는 시간',exact:true});
  for(const [name,passage] of [['새벽예배','사도행전 11장'],['금요예배','갈라디아서 1장'],['주일예배','사도행전 12장']]){
    await expect(times.getByRole('heading',{name,exact:true}).locator('..')).toContainText(passage);
  }
  await expect(page.getByRole('heading',{name:'주보의 예배 말씀',exact:true})).toHaveCount(0);
  fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(times.getByRole('status')).toContainText('불러오지 못했습니다');
  await expect(times.getByText('사도행전 11장',{exact:false})).toHaveCount(0);
  fail=false;await times.getByRole('button',{name:'다시 불러오기'}).click();
  await expect(times.getByText('사도행전 11장',{exact:false})).toBeVisible();
  await page.goto('/church/worship-times');
  await expect(page.getByRole('heading',{name:'학생 예배',exact:true}).locator('..')).toContainText('주일 오전 09:30');
  await expect(page.getByRole('heading',{name:'월삭새벽예배',exact:true}).locator('..')).toContainText('매월 첫날 오전 05:25');
  await expect(page.getByText('이번 주 말씀',{exact:true})).toHaveCount(0);
});
test('compact footer policy destinations and TOP work on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/church');
  const footer=page.locator('footer');
  await expect(footer.getByRole('link',{name:'개인정보처리방침',exact:true})).toHaveAttribute('href','/legal/privacy');
  await footer.getByRole('link',{name:'사진 게시정책',exact:true}).click();
  await expect(page.getByRole('heading',{name:'사진 게시정책',exact:true})).toBeVisible();
  await expect(page.getByText('정책 확인 중',{exact:true})).toBeVisible();
  await page.locator('footer').getByRole('link',{name:'개인정보처리방침',exact:true}).click();
  await expect(page.getByRole('heading',{name:'개인정보처리방침',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'맨 위로 이동',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(5);
  await expect(page.locator('footer').getByRole('button',{name:'맨 위로 이동',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
