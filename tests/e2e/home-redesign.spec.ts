import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.route('**/api/worship/videos?*',r=>r.fulfill({json:{videos:[],featured:null,next:null}}));
  await page.route('**/api/church',r=>r.fulfill({json:{fields:[]}}));
  await page.route('**/api/bulletins',r=>r.fulfill({json:{bulletins:[]}}));
  await page.route('**/api/community?*',r=>r.fulfill({json:{entries:[]}}));
  await page.route('**/api/worship',r=>r.fulfill({json:{id:'OSfMkv-YWJQ',title:'최근 주일 말씀',source:'channel'}}));
});
test('sticky grouped navigation, keyboard dismissal and footer utilities',async({page})=>{
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'주 메뉴',exact:true});
  const trigger=nav.getByRole('link',{name:'교회 소개',exact:true});await trigger.focus();
  await expect(nav.getByRole('link',{name:'온라인 헌금',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
  await page.evaluate(()=>scrollTo(0,900));expect(await page.locator('header').first().evaluate(e=>Math.abs(e.getBoundingClientRect().top))).toBeLessThan(1);
  await expect(page.locator('header').getByRole('link',{name:'로그인',exact:true})).toHaveCount(0);
  await expect(page.locator('footer').getByRole('link',{name:'로그인',exact:true})).toBeVisible();
  await expect(page.locator('footer').getByRole('navigation',{name:'하단 메뉴'}).getByRole('link')).toHaveText(['교회 소개','온라인 헌금','예배','소식','앱 추가']);
  await expect(page.locator('footer details')).toHaveCount(0);
  await trigger.click();await expect(page).toHaveURL(/\/church$/);
});
test('worship defaults to a current Sunday video and all service tabs work',async({page})=>{
  await page.goto('/worship');
  await expect(page.getByRole('navigation',{name:'예배 종류'}).getByRole('link',{name:'주일예배',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('button',{name:'주일예배 영상 열기',exact:true})).toHaveCount(0);
  await expect(page.locator('iframe[title="주일예배 영상"]')).toHaveAttribute('src',/youtube-nocookie.*OSfMkv-YWJQ/);
  await expect(page.getByRole('heading',{name:'함께 예배하는 시간'})).toBeVisible();
  await page.getByRole('navigation',{name:'예배 종류'}).getByRole('link',{name:'금요예배',exact:true}).click();
  await expect(page.getByText('등록된 금요예배 영상을 준비하고 있습니다.')).toBeVisible();
  await page.goto('/church/offering');await expect(page.getByText('301-0223-0182-71',{exact:true})).toBeVisible();await expect(page.getByText('301-0220-0484-81',{exact:true})).toBeVisible();
});
