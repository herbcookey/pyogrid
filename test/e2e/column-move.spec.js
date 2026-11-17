// 헤더를 끌어 컬럼 옮기기 (weekly 데모: columnReorder, 고정 3열, 다단 헤더, 합계 행, stateKey)
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300");
  await page.locator("#gridWrap .pyo-row").first().waitFor();
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));

const order = (page) => page.evaluate(() => window.grid.getColumnOrder());
const head = (page, key) => page.locator(`#gridWrap .pyo-hcell[data-key="${key}"]`);
const center = async (loc) => {
  // 창 크기를 바꾼 직후에는 헤더를 다시 그리는 중일 수 있어, 상자를 얻을 때까지 다시 잰다
  let b = null;
  await expect.poll(async () => (b = await loc.boundingBox()) !== null).toBe(true);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test("헤더를 끌어 놓으면 옮기고, 놓은 뒤 정렬되지 않는다. 새로 고쳐도 순서를 기억한다", async ({ page }) => {
  const before = await order(page);
  expect(before.slice(3, 8)).toEqual(["VENDOR_CODE", "CHANNEL", "REGION", "CATEGORY", "CATEGORY_GROUP"]);
  const from = await center(head(page, "CHANNEL"));
  const to = await center(head(page, "CATEGORY"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(page.locator("#gridWrap .pyo-col-ghost")).toBeVisible();
  await page.mouse.move(to.x + 5, to.y, { steps: 5 });
  await expect(page.locator("#gridWrap .pyo-col-drop")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("#gridWrap .pyo-col-ghost")).toHaveCount(0);
  const after = await order(page);
  expect(after.slice(3, 8)).toEqual(["VENDOR_CODE", "REGION", "CATEGORY", "CHANNEL", "CATEGORY_GROUP"]);
  expect(await page.evaluate(() => window.grid.getSort())).toEqual([]);
  // 본문 칸도 새 순서 (CHANNEL 헤더 아래 칸의 x가 같다)
  const hx = (await head(page, "CHANNEL").boundingBox()).x;
  const c = await page.evaluate(() => window.grid.getColumnOrder().indexOf("CHANNEL"));
  const cx = (await page.locator(`#gridWrap .pyo-row[data-row="0"] .pyo-cell[data-c="${c}"]`).boundingBox()).x;
  expect(Math.abs(cx - hx)).toBeLessThanOrEqual(1);
  // 합계 행: "합계" 칸(colspan 8)은 앞 8개 컬럼 안에서 옮겼으므로 모양이 그대로
  await expect(page.locator("#gridWrap .pyo-foot .pyo-sum-cell", { hasText: "합계" })).toHaveCount(1);

  await page.reload();
  await page.locator("#gridWrap .pyo-row").first().waitFor();
  expect(await order(page)).toEqual(after);
  // 화면 설정 초기화로 정의 순서로
  await page.locator("#btnResetState").click();
  await expect.poll(() => order(page)).toEqual(before);
});

test("고정 경계는 넘지 못하고, 그룹 헤더는 통째로 옮긴다", async ({ page }) => {
  const before = await order(page);
  // 고정 영역의 SKU를 스크롤 영역 쪽으로 멀리 끌어도 고정 영역 끝까지만
  const sku = await center(head(page, "SKU"));
  const far = await center(head(page, "CATEGORY"));
  await page.mouse.move(sku.x, sku.y);
  await page.mouse.down();
  await page.mouse.move(far.x, far.y, { steps: 8 });
  await page.mouse.up();
  const after = await order(page);
  expect(after.slice(0, 3).sort()).toEqual(before.slice(0, 3).sort());
  expect(after.slice(0, 3)).toEqual(["OWNER", "BARCODE", "SKU"]);

  // "이번 주" 그룹을 맨 뒤(상태 뒤)로: 스크롤 영역 오른쪽 끝에서 자동 스크롤 (가로 스크롤이 생기게 창을 줄인다)
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect.poll(() => page.evaluate(() => { const s = document.querySelector("#gridWrap .pyo-scroll"); return s.scrollWidth - s.clientWidth; })).toBeGreaterThan(200);
  const group = page.locator("#gridWrap .pyo-hcell.pyo-hgroup").first();
  const g = await center(group);
  const box = await page.locator("#gridWrap .pyo-scroll").boundingBox();
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 20, g.y, { steps: 2 });
  await page.mouse.move(box.x + box.width - 5, g.y, { steps: 5 });
  await expect.poll(() => page.evaluate(() => document.querySelector("#gridWrap .pyo-scroll").scrollLeft), { timeout: 5000 }).toBeGreaterThan(0);
  // 끝까지 스크롤될 때까지 기다린 뒤 놓는다
  await expect
    .poll(() => page.evaluate(() => { const s = document.querySelector("#gridWrap .pyo-scroll"); return s.scrollWidth - s.clientWidth - s.scrollLeft; }), { timeout: 5000 })
    .toBeLessThan(2);
  await page.mouse.up();
  const moved = await order(page);
  expect(moved.slice(-4)).toEqual(["STATUS", "ORDER_QTY", "SHIP_QTY", "BACKLOG_QTY"]);
});

test("Esc로 끌기를 취소하면 순서도 정렬도 그대로", async ({ page }) => {
  const before = await order(page);
  const from = await center(head(page, "REGION"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 150, from.y, { steps: 5 });
  await page.keyboard.press("Escape");
  await expect(page.locator("#gridWrap .pyo-col-ghost")).toHaveCount(0);
  await page.mouse.up();
  expect(await order(page)).toEqual(before);
  expect(await page.evaluate(() => window.grid.getSort())).toEqual([]);
});

test("키보드: Alt+Shift+→로 활성 칸의 컬럼을 옮기고 활성 칸이 따라간다", async ({ page }) => {
  const c0 = await page.evaluate(() => window.grid.getColumnOrder().indexOf("REGION"));
  await page.locator(`#gridWrap .pyo-row[data-row="2"] .pyo-cell[data-c="${c0}"]`).click();
  await page.keyboard.press("Alt+Shift+ArrowRight");
  const info = await page.evaluate(() => ({ order: window.grid.getColumnOrder(), active: window.grid.getRange().active }));
  expect(info.order.indexOf("REGION")).toBe(c0 + 1);
  expect(info.active).toEqual({ r: 2, c: c0 + 1 });
  await expect(page.locator(`#gridWrap .pyo-row[data-row="2"] .pyo-cell[data-c="${c0 + 1}"]`)).toHaveClass(/pyo-active/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).disableRules(["scrollable-region-focusable"]).include("#gridWrap").analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});
