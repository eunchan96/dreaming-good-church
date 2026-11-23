import type { Page } from "@playwright/test";

/** 관리자 확인 창(app/admin/confirm-dialog.tsx)이 다음에 뜰 때 한 번 자동으로 확인/취소를 누른다. 브라우저 기본 confirm을 쓰던 page.once("dialog")의 대체. */
async function answerNext(page: Page, ok: boolean) {
  await page.addLocatorHandler(
    page.locator("dialog[data-confirm][open]"),
    async dialog => { await dialog.locator(ok ? "[data-confirm-ok]" : "[data-confirm-cancel]").click(); },
    { times: 1 },
  );
}
export const acceptConfirm = (page: Page) => answerNext(page, true);
export const dismissConfirm = (page: Page) => answerNext(page, false);
