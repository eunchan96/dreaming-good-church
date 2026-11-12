import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("invited editor sets a password and can log in; used invite is rejected", async ({ page }) => {
  const secret = process.env.LOCAL_SUPABASE_SERVICE_KEY;
  if (!secret) throw new Error("Local key required");
  const admin = createClient("http://127.0.0.1:54321", secret, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`;
  const password = `${randomUUID()}-Aa1!`;
  const invite = await admin.auth.admin.generateLink({ type: "invite", email });
  if (invite.error) throw invite.error;
  const id = invite.data.user.id;
  try {
    const member = await admin.from("church_editors").insert({ user_id: id });
    if (member.error) throw member.error;
    const link = `/admin/account#token_hash=${invite.data.properties.hashed_token}`;
    await page.goto(link);
    await page.getByRole("button", { name: "초대 확인", exact: true }).click();
    await page.getByLabel("새 비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill("different-password");
    await page.getByRole("button", { name: "비밀번호 설정하고 시작" }).click();
    await expect(page.getByRole("status")).toContainText("두 입력이 같은지");
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "비밀번호 설정하고 시작" }).click();
    await expect(page.getByRole("button", { name: "+ 새 주보 작성" })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ 새 주보 작성" })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.goto(link);
    await page.getByRole("button", { name: "초대 확인", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("만료되었거나 이미 사용");
  } finally { await admin.auth.admin.deleteUser(id); }
});
