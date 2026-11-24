import { expect, test } from '@playwright/test';

test('search engines get a sitemap, page descriptions, share images and church details', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  // 로컬·브랜치 미리보기는 검색 엔진 수집을 막는다(운영 배포에서만 허용).
  expect(robots).toContain('Disallow: /');

  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const path of ['/church/worship-times', '/church/directions', '/worship/friday', '/bulletins', '/notices']) expect(sitemap).toContain(`${path}</loc>`);
  expect(sitemap).not.toContain('/admin');
  expect(sitemap).toMatch(/\/bulletins\/\d{4}-\d{2}-\d{2}<\/loc>/);

  await page.goto('/');
  await expect(page).toHaveTitle('꿈꾸는좋은교회');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /고양시 덕양구/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /opengraph-image\.png/);
  const church = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? '{}');
  expect(church).toMatchObject({ '@type': 'Church', name: '꿈꾸는좋은교회', telephone: '010-3012-9192', address: { addressRegion: '경기도' } });

  await page.goto('/church/directions');
  await expect(page).toHaveTitle('오시는 길 | 꿈꾸는좋은교회');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/church\/directions$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/opengraph-image\.png$/);

  expect((await request.get('/opengraph-image.png')).headers()['content-type']).toContain('image/png');
});
