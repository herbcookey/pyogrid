// 2단계: 행 선택·셀 범위 선택·정렬·선택 합계·페이지 바 (실제 Chrome, 실제 마우스)
import { test, expect } from "@playwright/test";

const box = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
const cell = (page, r, c, root = "#gridWrap") => page.locator(`${root} .pyo-row[data-row="${r}"] .pyo-cell[data-c="${c}"]`);
const num = (s) => Number(String(s).replace(/,/g, ""));

test.describe("weekly 데모", () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.__errors = errors;
    await page.goto("/demo/weekly.html?date=2026-11-12&rows=300");
  });
  test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
  });

  test("끌어서 셀 범위 선택 (틀 고정 경계를 넘어서) → 합계 표시", async ({ page }) => {
    const from = await box(cell(page, 1, 1));
    const to = await box(cell(page, 3, 9));
    await page.mouse.move(from.cx, from.cy);
    await page.mouse.down();
    await page.mouse.move(to.cx, to.cy, { steps: 8 });
    await page.mouse.up();
    const range = await page.evaluate(() => window.grid.getRange());
    expect(range).toEqual({ r0: 1, c0: 1, r1: 3, c1: 9, active: { r: 3, c: 9 } });
    await expect(page.locator("#gridWrap .pyo-cell.pyo-in-range")).toHaveCount(27);
    await expect(cell(page, 3, 9)).toHaveClass(/pyo-active/);
    await expect(cell(page, 2, 5)).toHaveCSS("background-color", "rgb(207, 224, 250)");

    // 합계 = 숫자 셀: 주문·출고(컬럼 8,9) 3행씩. 바코드(컬럼 2)는 숫자 글자지만 코드라 세지 않는다
    const expected = await page.evaluate(() => {
      let s = 0;
      for (let r = 1; r <= 3; r++) {
        const row = window.grid.getRow(r);
        s += row.ORDER_QTY + row.SHIP_QTY;
      }
      return s;
    });
    const summary = page.locator("#gridWrap .pyo-page-summary");
    await expect(summary).toHaveText(new RegExp("^선택 27셀 · 숫자 6 · 합계 " + expected.toLocaleString("ko-KR") + " · 평균 "));
  });

  test("Shift+클릭으로 범위 넓히기", async ({ page }) => {
    await cell(page, 0, 8).click();
    await cell(page, 4, 10).click({ modifiers: ["Shift"] });
    expect(await page.evaluate(() => window.grid.getRange())).toMatchObject({ r0: 0, c0: 8, r1: 4, c1: 10 });
    await expect(page.locator("#gridWrap .pyo-page-summary")).toContainText("선택 15셀 · 숫자 15");
  });

  test("헤더 클릭 정렬: 숫자 내림차순 → 오름차순 → 원래 순서", async ({ page }) => {
    const before = await page.evaluate(() => window.grid.getRows().map((r) => r.SKU));
    const head = page.locator('#gridWrap .pyo-hcell[data-key="ORDER_QTY"]');
    const values = () => page.evaluate(() => window.grid.getRows().map((r) => r.ORDER_QTY));
    await head.click();
    const desc = await values();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    await expect(head).toHaveAttribute("data-sort", "desc");
    // 화면 첫 행도 가장 큰 값
    expect(num(await cell(page, 0, 8).textContent())).toBe(desc[0]);
    await head.click();
    const asc = await values();
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    await head.click();
    expect(await page.evaluate(() => window.grid.getRows().map((r) => r.SKU))).toEqual(before);
    await expect(head).not.toHaveAttribute("data-sort", /.+/);
  });

  test("너비 조절 끌기는 정렬을 일으키지 않는다", async ({ page }) => {
    const handle = page.locator('#gridWrap .pyo-hcell[data-key="ORDER_QTY"] .pyo-resizer');
    const b = await box(handle);
    await page.mouse.move(b.cx, b.cy);
    await page.mouse.down();
    await page.mouse.move(b.cx + 30, b.cy, { steps: 4 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.grid.getSort())).toEqual([]);
  });

  test("행 체크박스·Shift+클릭·헤더 전체 선택 → 화면 요약 갱신", async ({ page }) => {
    // 샘플 데이터는 미출하 행을 기본 선택해 둔다 → 전부 해제하고 시작
    await page.evaluate(() => window.grid.clearSelection());
    await expect(page.locator("#sumCarry")).toHaveText("0");
    const check = (r) => page.locator(`#gridWrap .pyo-row[data-row="${r}"] [data-special="rowSelector"]`);
    await check(2).click();
    await expect(page.locator('#gridWrap .pyo-row[data-row="2"]')).toHaveClass(/pyo-selected/);
    await check(5).click({ modifiers: ["Shift"] });
    expect(await page.evaluate(() => window.grid.getSelectedIndexes())).toEqual([2, 3, 4, 5]);
    const carry = await page.evaluate(() => window.grid.getSelectedRows().reduce((s, r) => s + r.CARRY_QTY, 0));
    await expect(page.locator("#sumCarry")).toHaveText(carry.toLocaleString("ko-KR"));

    const headCheck = page.locator('#gridWrap .pyo-head [data-special="rowSelector"]');
    await headCheck.click();
    expect(await page.evaluate(() => window.grid.getSelectedRows().length)).toBe(300);
    await expect(headCheck.locator(".pyo-check")).toHaveClass(/pyo-checked/);
    await headCheck.click();
    expect(await page.evaluate(() => window.grid.getSelectedRows().length)).toBe(0);
  });

  test("페이지 바 상태 문구는 스크롤을 따라간다", async ({ page }) => {
    const status = page.locator("#gridWrap .pyo-page-status");
    await expect(status).toHaveText(/^1 - \d+ of 300$/);
    await page.locator("#gridWrap .pyo-scroll").evaluate((el) => (el.scrollTop = 26 * 100));
    await expect(status).toHaveText(/^101 - \d+ of 300$/);
  });
});

test("끌다가 아래로 벗어나면 자동 스크롤하며 범위가 늘어난다", async ({ page }) => {
  await page.goto("/demo/big.html");
  const start = await box(page.locator('.pyo-row[data-row="2"] .pyo-cell[data-c="3"]'));
  const scroll = await box(page.locator(".pyo-scroll"));
  await page.mouse.move(start.cx, start.cy);
  await page.mouse.down();
  await page.mouse.move(start.cx, scroll.y + scroll.h + 40, { steps: 5 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  const top = await page.locator(".pyo-scroll").evaluate((el) => el.scrollTop);
  const range = await page.evaluate(() => window.grid.getRange());
  expect(top).toBeGreaterThan(200);
  expect(range.r0).toBe(2);
  expect(range.r1).toBeGreaterThan(30);
  // 손을 뗀 뒤에는 더 스크롤되지 않는다
  await page.waitForTimeout(200);
  expect(await page.locator(".pyo-scroll").evaluate((el) => el.scrollTop)).toBe(top);
});

test("서버 페이징·서버 정렬", async ({ page }) => {
  await page.goto("/demo/paging.html");
  const status = page.locator(".pyo-page-status");
  await expect(status).toHaveText(/^1 - \d+ of 50\u00a0 Total 1,234$/);
  await expect(page.locator(".pyo-page-nums button")).toHaveText(["1", "2", "3", "4", "5"]);
  await page.locator('[data-page-move="next"]').click();
  await expect(page.locator('.pyo-page-btn[data-selected="true"]')).toHaveText("2");
  expect(await page.evaluate(() => window.grid.getRow(0).id)).toBe(51);
  await page.locator('[data-page-move="last"]').click();
  await expect(page.locator('.pyo-page-btn[data-selected="true"]')).toHaveText("25");
  expect(await page.evaluate(() => window.grid.rowCount)).toBe(34);

  // 서버 정렬: 클릭하면 1페이지를 정렬된 순서로 다시 받는다
  await page.locator('.pyo-hcell[data-key="qty"]').click();
  await expect(page.locator('.pyo-page-btn[data-selected="true"]')).toHaveText("1");
  const qty = await page.evaluate(() => window.grid.getRows().map((r) => r.qty));
  const max = await page.evaluate(() => Math.max(...window.ALL.map((r) => r.qty)));
  expect(qty[0]).toBe(max);
  expect(qty).toEqual([...qty].sort((a, b) => b - a));
  await expect(page.locator('.pyo-hcell[data-key="qty"]')).toHaveAttribute("data-sort", "desc");
});
