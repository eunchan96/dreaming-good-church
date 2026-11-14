import {calendarControl,selectCalendar} from './calendar-helpers';
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";

test("one bulletin travels from published source through copy, print, public PDF and withdrawal", async ({ page, browser }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const source = randomUUID(), ids = [source];
  const readerContext = await browser.newContext();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const member = await admin.from("church_editors").insert({ user_id: created.data.user.id }); if (member.error) throw member.error;
    const seed = await admin.from("bulletins").insert({ id: source, service_date: "2086-11-03", issue_number: 1 }); if (seed.error) throw seed.error;
    const items = await admin.from("bulletin_items").insert([
      { bulletin_id: source, position: 0, title: "예배 안내", body: "지난주 공개 안내", web_visible: true, review_on_copy: true },
      { bulletin_id: source, position: 1, title: "인쇄 전용 안내", body: "지난주 비공개 안내", web_visible: false, review_on_copy: true },
    ]); if (items.error) throw items.error;
    const publishedSource = await admin.from("bulletins").update({ status: "published" }).eq("id", source); if (publishedSource.error) throw publishedSource.error;
    const reader = await readerContext.newPage();
    reader.on("pageerror", error => errors.push(error.message));
    await test.step("editor logs in and copies last week's published bulletin", async () => {
      await page.goto("/admin/bulletins");
      await page.getByLabel("이메일", { exact: true }).fill(email);
      await page.getByLabel("비밀번호", { exact: true }).fill(password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await page.getByRole("button", { name: /2086-11-03/ }).click();
      await expect(page.getByLabel("내용", { exact: true }).first()).toBeDisabled();
      await selectCalendar(page,calendarControl(page,"새 주보 날짜"),"2086-11-10");
      const response = page.waitForResponse(r => r.url().includes("rpc/copy_bulletin_draft"));
      await page.getByRole("button", { name: "다음 주 주보 복사", exact: true }).click();
      const copied = await (await response).json(); ids.push(copied.id);
      await expect(page.getByText("2개 항목 확인 필요", { exact: true })).toBeVisible();
      await expect(page.getByLabel("웹에 공개", { exact: true }).first()).toBeChecked();
      await expect(page.getByLabel("웹에 공개", { exact: true }).nth(1)).not.toBeChecked();
      expect((await reader.request.get("/api/bulletins?date=2086-11-10")).status()).toBe(404);
      expect((await reader.request.get("/api/bulletins/pdf?date=2086-11-10")).status()).toBe(404);
    });
    await test.step("edit, save, reopen and check both preview audiences", async () => {
      await page.getByLabel("내용", { exact: true }).first().fill("이번 주 성도 공개 안내");
      await page.getByLabel("내용", { exact: true }).nth(1).fill("이번 주 인쇄 전용 비공개 내용");
      await page.getByRole("button", { name: "초안 저장", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("초안을 저장했습니다");
      await page.reload(); await page.getByRole("button", { name: /2086-11-10/ }).click();
      await expect(page.getByLabel("내용", { exact: true }).nth(1)).toHaveValue("이번 주 인쇄 전용 비공개 내용");
      await expect(page.getByLabel("웹에 공개", { exact: true }).nth(1)).not.toBeChecked();
      await expect(page.getByText("0개 항목 확인 필요", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "웹 미리보기", exact: true }).click();
      await expect(page.getByText("이번 주 성도 공개 안내", { exact: true })).toBeVisible();
      await expect(page.getByText("이번 주 인쇄 전용 비공개 내용", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "인쇄 미리보기", exact: true }).click();
      const print = page.getByRole("dialog", { name: "관리자 인쇄 미리보기", exact: true });
      await expect(print.getByText("이번 주 인쇄 전용 비공개 내용", { exact: true })).toBeVisible();
      await expect(print.getByRole("status")).not.toContainText("넘침");
      const physical = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
      expect(physical.getPageCount()).toBe(2);
      for (const sheet of physical.getPages()) {
        expect(Math.abs(sheet.getWidth() - 841.89)).toBeLessThan(1);
        expect(Math.abs(sheet.getHeight() - 595.28)).toBeLessThan(1);
      }
      await print.getByRole("button", { name: "미리보기 닫기", exact: true }).click();
      await page.getByRole("button", { name: "편집으로 돌아가기", exact: true }).click();
    });
    await test.step("publish and read/download from a separate anonymous browser", async () => {
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: "주보 게시", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("주보를 게시했습니다");
      await reader.goto("/bulletins/2086-11-10");
      await expect(reader.getByText("이번 주 성도 공개 안내", { exact: true })).toBeVisible();
      await expect(reader.getByText("인쇄 전용 안내", { exact: true })).toHaveCount(0);
      const payload = await reader.request.get("/api/bulletins?date=2086-11-10");
      expect(await payload.text()).not.toContain("비공개");
      const download = reader.waitForEvent("download");
      await reader.getByRole("button", { name: "공개용 PDF 다운로드", exact: true }).click();
      expect((await download).suggestedFilename()).toBe("bulletin-2086-11-10.pdf");
      await expect(reader.getByText("공개용 PDF를 내려받았습니다.", { exact: true })).toBeVisible();
    });
    await test.step("withdrawal removes the public page and blocks new PDF access without changing the source", async () => {
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: "게시 취소", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("게시를 취소했습니다");
      expect((await reader.request.get("/api/bulletins?date=2086-11-10")).status()).toBe(404);
      expect((await reader.request.get("/api/bulletins/pdf?date=2086-11-10")).status()).toBe(404);
      await reader.reload();
      await expect(reader.getByText("이번 주 성도 공개 안내", { exact: true })).toHaveCount(0);
      await expect(reader.getByRole("button", { name: "공개용 PDF 다운로드", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: /2086-11-03/ }).click();
      await expect(page.getByLabel("내용", { exact: true }).first()).toHaveValue("지난주 공개 안내");
      await expect(page.getByLabel("내용", { exact: true }).nth(1)).toHaveValue("지난주 비공개 안내");
      expect(errors).toEqual([]);
    });
  } finally {
    await readerContext.close();
    const removed = await admin.from("bulletins").delete().in("id", ids); if (removed.error) throw removed.error;
    await admin.auth.admin.deleteUser(created.data.user.id);
  }
});
