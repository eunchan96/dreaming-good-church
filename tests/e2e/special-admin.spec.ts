import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { acceptConfirm } from "./confirm";
import { calendarControl, selectCalendar } from "./calendar-helpers";
import { selectTime, timeControl } from "./time-helpers";

// 관리자 주보 목록에 특별 순서지가 함께 보이고, 상세에서 웹·인쇄 미리보기와 게시·예약·게시 취소를 한다. (시험용 가짜 내용만 쓴다)
test("특별 순서지는 주보 목록에서 열어 미리 보고 예약·게시·게시 취소할 수 있다", async ({ page, request }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (user.error) throw user.error;
  const slug = `e2e-admin-${randomUUID().slice(0, 8)}`;
  const content = {
    cover: { kicker: "시험 교회 10주년", title: "시험 감사예배", date: "2098. 3. 1(주일)", time: "오후 1:00" },
    blocks: [
      { type: "title", text: "시험 감사 예배" },
      { type: "band", title: "1부 예배", tone: "olive", lead: "시험 목사" },
      { type: "rows", rows: [{ name: "찬송", what: "595장", who: "다같이" }] },
      { type: "schedule", title: "시험예배 안내", tone: "olive", columns: [[["주일\n하늘보좌예배", "오전 10:45"]], [["학생부 예배", "오전 9:30"]], [["금요 예배", "저녁 8:45"]]] },
    ],
  };
  const pdf = await PDFDocument.create(); pdf.addPage([595, 842]);
  const publicSlugs = async () => (await (await request.get("/api/special-programs")).json()).programs.map((program: { slug: string }) => program.slug);
  try {
    const member = await admin.from("church_editors").insert({ user_id: user.data.user.id });
    if (member.error) throw member.error;
    const inserted = await admin.from("special_programs").insert({ slug, title: "시험 감사예배", service_date: "2098-03-01", status: "draft", content, pdf_path: `${slug}.pdf` });
    if (inserted.error) throw inserted.error;
    const uploaded = await admin.storage.from("special-programs").upload(`${slug}.pdf`, await pdf.save(), { contentType: "application/pdf" });
    if (uploaded.error) throw uploaded.error;

    await page.goto("/admin/bulletins");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();

    // 목록: 주보와 같은 줄 모양으로 제목과 상태가 보인다.
    const row = page.getByRole("button", { name: /\(2098-03-01\) · 시험 감사예배 · 초안/ });
    await expect(row).toBeVisible();
    await row.click();

    // 상세: 웹 미리보기가 본문에 있고, 수정·삭제 버튼은 없다.
    await expect(page.locator("#editor-tools").getByRole("heading", { level: 2, name: "시험 감사예배" })).toBeVisible();
    const sheet = page.getByRole("article", { name: "시험 감사예배" });
    await expect(sheet.getByText("1부 예배")).toBeVisible();
    await expect(sheet.getByText("시험예배 안내")).toBeVisible();
    await expect(page.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);

    // 새로고침해도 같은 순서지로 돌아온다.
    await page.reload();
    await expect(page.locator("#editor-tools").getByRole("heading", { level: 2, name: "시험 감사예배" })).toBeVisible();

    // 인쇄 미리보기: 올려 둔 PDF가 창에 뜬다.
    await page.getByRole("button", { name: "인쇄 미리보기", exact: true }).click();
    await expect(page.locator("iframe[title$='인쇄용 PDF']")).toHaveAttribute("src", /^blob:/);
    await page.getByRole("button", { name: "닫기", exact: true }).click();

    // 예약 공개: 달력·시계로 고르면 게시 상태 + 예약 표시, 공개 쪽에서는 아직 안 보인다.
    await page.getByRole("button", { name: "예약 공개", exact: true }).click();
    const schedule = page.locator("dialog[data-schedule][open]");
    const day = new Date(Date.now() + 9 * 3600000 + 2 * 86400000).toISOString().slice(0, 10);
    await selectCalendar(page, calendarControl(page, "공개 날짜"), day);
    await selectTime(page, timeControl(page, "공개 시간"), "09:30");
    await schedule.getByRole("button", { name: "예약 게시", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("공개로 예약했습니다");
    await expect(page.getByText(/^예약 · /)).toBeVisible();
    expect(await publicSlugs()).not.toContain(slug);
    const saved = await admin.from("special_programs").select("status,publish_at").eq("slug", slug).single();
    expect(saved.data?.status).toBe("published");
    expect(new Date(saved.data!.publish_at!).toISOString()).toBe(new Date(`${day}T09:30:00+09:00`).toISOString());

    // 게시 취소 → 초안, 바로 게시 → 공개 목록에 나타남.
    await acceptConfirm(page);
    await page.getByRole("button", { name: "게시 취소", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("게시를 취소했습니다");
    await acceptConfirm(page);
    await page.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("순서지를 게시했습니다");
    expect(await publicSlugs()).toContain(slug);

    // 목록으로 돌아가면 게시됨으로 보인다.
    await page.getByRole("button", { name: "주보 목록 돌아가기" }).click();
    await expect(page.getByRole("button", { name: /\(2098-03-01\) · 시험 감사예배 · 게시됨/ })).toBeVisible();
  } finally {
    await admin.storage.from("special-programs").remove([`${slug}.pdf`]);
    await admin.from("special_programs").delete().eq("slug", slug);
    await admin.auth.admin.deleteUser(user.data.user.id);
  }
});
