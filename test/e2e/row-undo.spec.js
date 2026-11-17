// 행 추가·삭제 단추(undoable)와 Ctrl+Z (editors 데모, 실제 브라우저)
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  await page.goto("/demo/editors.html?lang=ko");
  await page.locator("#grid .pyo-row").first().waitFor();
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));

const names = (page) => page.evaluate(() => window.grid.getAllRows().map((r) => r.name));
const mod = process.platform === "darwin" ? "Meta" : "Control";

test("행 삭제 단추로 지운 뒤 Ctrl+Z로 행이 돌아오고, Ctrl+Y로 다시 지운다", async ({ page }) => {
  const before = await names(page);
  await page.locator('#grid .pyo-row[data-row="2"] .pyo-cell[data-c="1"]').click();
  await page.locator("#btnDeleteRows").click();
  expect(await names(page)).toEqual(before.filter((_, i) => i !== 2));
  expect(await page.evaluate(() => window.grid.getDeletedRows().length)).toBe(1);

  await page.keyboard.press(`${mod}+z`);
  expect(await names(page)).toEqual(before);
  expect(await page.evaluate(() => window.grid.getDeletedRows().length)).toBe(0);
  await expect(page.locator("#grid .pyo-page-summary")).toHaveText("실행 취소: 행 삭제 1행");
  // 돌아온 행에 셀 범위
  expect(await page.evaluate(() => window.grid.getRange().active.r)).toBe(2);
  await expect(page.locator("#log")).toContainText("rowsadd (undo) 1행");

  await page.keyboard.press(`${mod}+y`);
  expect(await names(page)).toEqual(before.filter((_, i) => i !== 2));
});

test("행 추가 단추로 넣은 행을 Ctrl+Z로 빼고, Ctrl+Y로 같은 자리에 다시 넣는다", async ({ page }) => {
  const n = (await names(page)).length;
  await page.locator("#btnAddRow").click();
  expect((await names(page)).length).toBe(n + 1);
  await page.keyboard.press(`${mod}+z`);
  expect((await names(page)).length).toBe(n);
  await expect(page.locator("#log")).toContainText("rowsremove (undo) 1행");
  await page.keyboard.press(`${mod}+y`);
  const after = await page.evaluate(() => window.grid.getAllRows().map((r) => r.no));
  expect(after.length).toBe(n + 1);
  expect(after[after.length - 1]).toBe(n + 1);
});
