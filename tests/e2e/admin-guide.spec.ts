import { test, expect } from '@playwright/test';

test('admin guide shows the user guide with its screenshots and table of contents', async ({ page }) => {
  await page.goto('/admin/guide');
  await expect(page.getByRole('heading', { level: 1, name: '꿈꾸는좋은교회 홈페이지 관리 안내' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const toc = page.getByRole('navigation', { name: '안내 목차' });
  await expect(toc.getByRole('link')).toHaveCount(6);
  await toc.getByRole('link', { name: '매주 주보 만들기' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '2. 매주 주보 만들기' })).toBeInViewport();
  // 그림 경로(../public/admin/guide/…)가 사이트 주소로 바뀌어 모두 불러와진다.
  const images = page.locator('article img');
  expect(await images.count()).toBeGreaterThan(5);
  for (const src of await images.evaluateAll(list => list.map(img => (img as HTMLImageElement).src))) {
    expect(src).toContain('/admin/guide/');
    expect((await page.request.get(src)).headers()['content-type']).toContain('image/png');
  }
  await expect(page.getByText('1시 오후 찬양예배 / 본문 : ... / 제목 : ...').first()).toBeVisible();
  // 저장소 문서 링크(.md)는 글자만 남는다.
  await expect(page.locator('article a[href$=".md"]')).toHaveCount(0);
  for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});
