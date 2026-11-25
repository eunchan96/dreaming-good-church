import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

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

test('signed-in admin pages link the guide from the footer in a new tab', async ({ page }) => {
  const db = createClient('http://127.0.0.1:54321', process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const user = await db.auth.admin.createUser({ email, password, email_confirm: true }); if (user.error) throw user.error;
  try {
    expect((await db.from('church_editors').insert({ user_id: user.data.user.id })).error).toBeNull();
    // /admin 으로 들어와도 주보 관리로 간다.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/bulletins$/);
    await page.getByLabel('이메일', { exact: true }).fill(email); await page.getByLabel('비밀번호', { exact: true }).fill(password);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('button', { name: '+ 새 주보 작성', exact: true }).waitFor();
    await expect(page.getByRole('banner').getByRole('link', { name: /사용 안내/ })).toHaveCount(0);
    const link = page.getByRole('contentinfo', { name: '관리자 계정' }).getByRole('link', { name: '사용 안내 (새 탭)' });
    await expect(link).toHaveAttribute('target', '_blank');
    const [guide] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
    await expect(guide.getByRole('heading', { level: 1, name: '꿈꾸는좋은교회 홈페이지 관리 안내' })).toBeVisible();
    // 목차를 누르면 그 절로 스크롤하고 주소에 위치를 남긴다.
    await guide.getByRole('navigation', { name: '안내 목차' }).getByRole('link', { name: '이럴 땐 이렇게' }).click();
    await expect(guide.getByRole('heading', { level: 2, name: '6. 이럴 땐 이렇게' })).toBeInViewport();
    await expect(guide).toHaveURL(/#guide-6$/);
  } finally { await db.auth.admin.deleteUser(user.data.user.id); }
});
