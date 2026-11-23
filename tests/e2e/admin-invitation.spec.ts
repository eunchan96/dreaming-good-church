import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { acceptConfirm, dismissConfirm } from "./confirm";

// Needs the local dev server from scripts/dev-local.ps1, which lets @inviter.test editors invite.
const key = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const local = () => { if (!key) throw new Error('Local test key required'); return createClient('http://127.0.0.1:54321', key, { auth: { persistSession: false } }); };

async function makeEditor(domain: string) {
  const db = local();
  const email = `${randomUUID()}@${domain}`, password = `${randomUUID()}-Aa1!`;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const member = await db.from('church_editors').insert({ user_id: created.data.user.id });
  if (member.error) throw member.error;
  return { id: created.data.user.id, email, password };
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/admin/bulletins');
  await page.getByLabel('이메일', { exact: true }).fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
}

test('only designated inviters see 관리자 초대; they can issue, list and cancel an invitation', async ({ page, browser }) => {
  const db = local();
  const inviter = await makeEditor('inviter.test');
  const plain = await makeEditor('example.test');
  const invitee = `${randomUUID()}@example.test`;
  try {
    // A regular editor gets no invite button and the API refuses them.
    const otherContext = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001' });
    const other = await otherContext.newPage();
    await login(other, plain.email, plain.password);
    await expect(other.getByRole('button', { name: '관리자 초대', exact: true })).toHaveCount(0);
    const token = await other.evaluate(() => Object.entries(localStorage).find(([k]) => k.includes('auth-token'))?.[1] ?? '');
    const access = token ? JSON.parse(token).access_token : '';
    const refused = await other.request.post('/api/admin/invitations', { headers: { Authorization: `Bearer ${access}` }, data: { email: invitee } });
    expect(refused.status()).toBe(403);
    await otherContext.close();

    await login(page, inviter.email, inviter.password);
    await page.getByRole('button', { name: '관리자 초대', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '관리자 초대' });
    const current = dialog.getByRole('region', { name: '현재 관리자' });
    await expect(current.getByText(inviter.email, { exact: true })).toBeVisible();
    await expect(current.getByRole('listitem').filter({ hasText: inviter.email })).toContainText('나');

    await dialog.getByLabel('담당자 이메일').fill('not-an-email');
    await dialog.getByLabel('담당자 이메일').fill(invitee);
    await dialog.getByRole('button', { name: '초대 링크 만들기', exact: true }).click();
    await expect(dialog.getByLabel('초대 링크')).toHaveValue(/\/admin\/account#/);
    const row = current.getByRole('listitem').filter({ hasText: invitee });
    await expect(row).toContainText('초대 대기');
    const invited = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find(u => u.email === invitee)!;
    expect((await db.from('church_editors').select('user_id').eq('user_id', invited.id)).data).toHaveLength(1);

    // An already confirmed account is told to use a password reset instead.
    await dialog.getByRole('button', { name: '다른 사람 초대', exact: true }).click();
    await dialog.getByLabel('담당자 이메일').fill(plain.email);
    await dialog.getByRole('button', { name: '초대 링크 만들기', exact: true }).click();
    await expect(dialog.getByRole('status').last()).toContainText('이미 초대를 확인한 계정');

    expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations.map(v => v.id)).toEqual([]);

    // Cancelling the pending invitation removes both the access and the unused account.
    await acceptConfirm(page);
    await row.getByRole('button', { name: `${invitee} 초대 취소` }).click();
    await expect(dialog.getByRole('status').last()).toContainText('초대를 취소했습니다.');
    await expect(current.getByText(invitee, { exact: true })).toHaveCount(0);
    expect((await db.auth.admin.getUserById(invited.id)).data.user).toBeNull();

    // Removing an active editor keeps the account but takes away access; the inviter cannot remove themself.
    await expect(current.getByRole('listitem').filter({ hasText: inviter.email }).getByRole('button')).toHaveCount(0);
    await acceptConfirm(page);
    await current.getByRole('listitem').filter({ hasText: plain.email }).getByRole('button', { name: `${plain.email} 권한 해제` }).click();
    await expect(dialog.getByRole('status').last()).toContainText('관리자 권한을 해제했습니다.');
    expect((await db.from('church_editors').select('user_id').eq('user_id', plain.id)).data).toHaveLength(0);
  } finally {
    for (const id of [inviter.id, plain.id]) await db.auth.admin.deleteUser(id);
    const left = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find(u => u.email === invitee);
    if (left) await db.auth.admin.deleteUser(left.id);
  }
});
