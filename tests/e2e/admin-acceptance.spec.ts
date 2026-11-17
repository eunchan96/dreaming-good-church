import {calendarControl,selectCalendar} from './calendar-helpers';
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("unregistered account is denied; editor sees duplicate date and can cancel leaving unsaved work", async ({ page }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID(), fixture = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const user = created.data.user.id;
  async function login() {
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
  }
  try {
    await page.goto("/admin/bulletins"); await login();
    await expect(page.getByRole("heading", { name: "편집 권한이 필요합니다" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ 새 주보 작성", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    const member = await admin.from("church_editors").insert({ user_id: user });
    if (member.error) throw member.error;
    const inserted = await admin.from("bulletins").insert({ id: fixture, service_date: "2090-05-07", issue_number: 1 });
    if (inserted.error) throw inserted.error;
    await login();
    await page.getByRole("button", { name: "+ 새 주보 작성", exact: true }).click();
    await selectCalendar(page,calendarControl(page,"예배 날짜"),"2090-05-07");
    await page.getByLabel("내용", { exact: true }).first().fill("이탈 취소 후 유지할 입력");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("link", { name: "공지·일정 관리", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/bulletins$/);
    await expect(page.getByLabel("내용", { exact: true }).first()).toHaveValue("이탈 취소 후 유지할 입력");
    await page.getByRole("button", { name: "초안 저장", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("같은 날짜의 주보가 이미 있습니다");
    await expect(page.getByLabel("내용", { exact: true }).first()).toHaveValue("이탈 취소 후 유지할 입력");
    await expect(page.getByRole("button", { name: "저장 다시 시도", exact: true })).toBeEnabled();
  } finally {
    const deleted = await admin.from("bulletins").delete().eq("id", fixture);
    if (deleted.error) throw deleted.error;
    await admin.auth.admin.deleteUser(user);
  }
});
