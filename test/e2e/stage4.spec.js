// 4단계: 복사·붙여넣기·잘라내기·실행 취소 (실제 Chrome, 시스템 클립보드)
import { test, expect } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const cell = (page, r, c) => page.locator(`#grid .pyo-row[data-row="${r}"] .pyo-cell[data-c="${c}"]`);
const rows = (page, from, to) => page.evaluate(([a, b]) => window.grid.getRows().slice(a, b).map((r) => ({ ...r })), [from, to]);
const readClip = (page) => page.evaluate(() => navigator.clipboard.readText());
const writeClip = (page, t) => page.evaluate((s) => navigator.clipboard.writeText(s), t);

async function dragSelect(page, r0, c0, r1, c1) {
  await cell(page, r1, c1).waitFor();
  const a = await cell(page, r0, c0).boundingBox();
  const b = await cell(page, r1, c1).boundingBox();
  await page.mouse.move(a.x + 5, a.y + 5);
  await page.mouse.down();
  await page.mouse.move(b.x + 5, b.y + 5, { steps: 5 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  await page.goto("/demo/editors.html");
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));

test("Ctrl+C: 선택 범위가 원래 값 TSV로 시스템 클립보드에 들어간다", async ({ page }) => {
  await dragSelect(page, 0, 1, 1, 3);
  await page.keyboard.press("Control+C");
  const r = await rows(page, 0, 2);
  expect(await readClip(page)).toBe(r.map((x) => [x.name, x.qty, x.amt].join("\t")).join("\r\n"));
  await expect(page.locator("#grid .pyo-page-summary")).toHaveText("복사: 6셀");
});

test("Ctrl+V: Excel에서 복사한 여러 셀 (따옴표 칸·쉼표 숫자·잘못된 값)", async ({ page }) => {
  await cell(page, 2, 1).click();
  await writeClip(page, '"줄1\n줄2"\t5\t"1,234"\t2026.12.25\t부품\r\n둘째\tabc\t99\t\t조립\r\n');
  await page.keyboard.press("Control+V");
  const [a, b] = await rows(page, 2, 4);
  expect(a).toMatchObject({ name: "줄1\n줄2", qty: 5, amt: 1234, dt: "2026-12-25", cd: "B" });
  expect(b).toMatchObject({ name: "둘째", qty: 21, amt: 99, dt: "", cd: "C" }); // abc는 숫자가 아니라 건너뜀 (원래 21)
  await expect(page.locator("#grid .pyo-page-summary")).toHaveText(/^붙여넣기: \d+셀 \(건너뜀 1\)$/);
  await expect(cell(page, 2, 3)).toHaveText("1,234");
  expect(await page.evaluate(() => window.grid.getRange())).toMatchObject({ r0: 2, c0: 1, r1: 3, c1: 5 });
});

test("Ctrl+Z 여러 번 → 붙여넣기·셀 편집 차례로 되돌림, Ctrl+Y 다시", async ({ page }) => {
  const before = await rows(page, 0, 3);
  await cell(page, 0, 1).click();
  await page.keyboard.type("편집함");
  await page.keyboard.press("Enter");
  await writeClip(page, "A\nB");
  await page.keyboard.press("Control+V"); // 1행부터
  let now = await rows(page, 0, 3);
  expect(now.map((r) => r.name)).toEqual(["편집함", "A", "B"]);

  await page.keyboard.press("Control+Z");
  now = await rows(page, 0, 3);
  expect(now.map((r) => r.name)).toEqual(["편집함", before[1].name, before[2].name]);
  await expect(page.locator("#grid .pyo-page-summary")).toHaveText("실행 취소: 붙여넣기 2셀");
  await page.keyboard.press("Control+Z");
  now = await rows(page, 0, 3);
  expect(now.map((r) => r.name)).toEqual(before.map((r) => r.name));
  await expect(cell(page, 0, 1)).toHaveText(before[0].name);

  await page.keyboard.press("Control+Y");
  expect((await rows(page, 0, 1))[0].name).toBe("편집함");
});

test("Ctrl+X: 복사하고 비운다, Ctrl+Z로 복구", async ({ page }) => {
  const before = await rows(page, 5, 7);
  await dragSelect(page, 5, 1, 6, 2);
  await page.keyboard.press("Control+X");
  expect(await readClip(page)).toBe(before.map((r) => r.name + "\t" + r.qty).join("\r\n"));
  const after = await rows(page, 5, 7);
  expect(after.map((r) => [r.name, r.qty])).toEqual([["", ""], ["", ""]]);
  await page.keyboard.press("Control+Z");
  expect((await rows(page, 5, 7)).map((r) => [r.name, r.qty])).toEqual(before.map((r) => [r.name, r.qty]));
});

test("편집 중 Ctrl+V는 셀 입력칸에 글자로 들어간다", async ({ page }) => {
  await cell(page, 0, 1).click();
  await page.keyboard.press("F2");
  await writeClip(page, "-추가");
  await page.keyboard.press("Control+V");
  await expect(page.locator("#grid .pyo-input")).toHaveValue("품목 1-추가");
  await page.keyboard.press("Enter");
  expect((await rows(page, 0, 1))[0].name).toBe("품목 1-추가");
});

test("weekly 데모: 이월 수량 여러 셀 붙여넣기 → 다음 주 조정 재계산, Ctrl+Z", async ({ page }) => {
  await page.goto("/demo/weekly.html?date=2026-11-12&rows=6");
  const c = (r) => page.locator(`#gridWrap .pyo-row[data-row="${r}"] .pyo-cell[data-c="11"]`);
  const before = await page.evaluate(() => window.grid.getRows().map((r) => ({ ...r })));
  await c(0).click();
  await writeClip(page, "100\n200\n300");
  await page.keyboard.press("Control+V");
  let r = await page.evaluate(() => window.grid.getRows().map((x) => ({ ...x })));
  expect(r.slice(0, 3).map((x) => x.CARRY_QTY)).toEqual([100, 200, 300]);
  expect(r.slice(0, 3).map((x) => x.NEXT_TOTAL)).toEqual(r.slice(0, 3).map((x) => x.NEXT_ORDER + x.CARRY_QTY));
  await expect(c(1)).toHaveText("200");
  await page.keyboard.press("Control+Z");
  r = await page.evaluate(() => window.grid.getRows().map((x) => ({ ...x })));
  expect(r.slice(0, 3).map((x) => [x.CARRY_QTY, x.NEXT_TOTAL])).toEqual(before.slice(0, 3).map((x) => [x.CARRY_QTY, x.NEXT_TOTAL]));
});
