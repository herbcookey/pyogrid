// 3단계: 셀 편집기·키보드·한글 바로 입력 (실제 Chrome, 실제 키 입력)
import { test, expect } from "@playwright/test";
import { rectOf } from "./helpers.js";

const cell = (page, r, c, root = "#grid") => page.locator(`${root} .pyo-row[data-row="${r}"] .pyo-cell[data-c="${c}"]`);
const row = (page, r) => page.evaluate((i) => ({ ...window.grid.getRow(i) }), r);
const active = (page) => page.evaluate(() => window.grid.getRange() && window.grid.getRange().active);
const input = (page) => page.locator("#grid .pyo-input");

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  await page.goto("/demo/editors.html?lang=ko");
});
test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

test("셀을 누르고 바로 치면 첫 글자부터 들어가고 Enter로 저장·아래로", async ({ page }) => {
  await cell(page, 1, 1).click();
  await page.keyboard.type("abc 12");
  await expect(input(page)).toHaveValue("abc 12");
  await expect(input(page)).toBeVisible();
  // 입력칸이 셀 위에 정확히 겹친다
  const cb = await rectOf(cell(page, 1, 1));
  const ib = await rectOf(input(page));
  expect(Math.round(ib.x)).toBe(Math.round(cb.x));
  expect(Math.round(ib.y)).toBe(Math.round(cb.y));
  await page.keyboard.press("Enter");
  expect((await row(page, 1)).name).toBe("abc 12");
  expect((await row(page, 1)).__modified__).toBe(true);
  await expect(cell(page, 1, 1)).toHaveText("abc 12");
  expect(await active(page)).toEqual({ r: 2, c: 1 });
});

test("한글 조합 입력 (CDP IME) → 셀에 그대로 들어간다", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "IME 조합 흉내(CDP Input.imeSetComposition)는 Chromium에서만 된다");
  await cell(page, 0, 1).click();
  const cdp = await page.context().newCDPSession(page);
  for (const t of ["ㅎ", "하", "한"]) await cdp.send("Input.imeSetComposition", { text: t, selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: "한" });
  for (const t of ["ㄱ", "그", "글"]) await cdp.send("Input.imeSetComposition", { text: t, selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: "글" });
  await expect(input(page)).toHaveValue("한글");
  expect(await page.evaluate(() => window.grid.isEditing)).toBe(true);
  await page.keyboard.press("Enter");
  expect((await row(page, 0)).name).toBe("한글");
});

test("F2는 지금 값, Esc는 취소, Tab은 저장 후 오른쪽", async ({ page }) => {
  await cell(page, 3, 1).click();
  await page.keyboard.press("F2");
  await expect(input(page)).toHaveValue("품목 4");
  await page.keyboard.type("-수정");
  await page.keyboard.press("Escape");
  expect((await row(page, 3)).name).toBe("품목 4");
  await page.keyboard.press("F2");
  await page.keyboard.type("!");
  await page.keyboard.press("Tab");
  expect((await row(page, 3)).name).toBe("품목 4!");
  expect(await active(page)).toEqual({ r: 3, c: 2 });
});

test("수량은 숫자만, 금액은 입력 중 쉼표·저장은 숫자", async ({ page }) => {
  await cell(page, 2, 2).click();
  await page.keyboard.type("4x2");
  await expect(input(page)).toHaveValue("42");
  await page.keyboard.press("Tab");
  expect((await row(page, 2)).qty).toBe(42);
  await page.keyboard.type("1234567");
  await expect(input(page)).toHaveValue("1,234,567");
  await page.keyboard.press("Enter");
  expect((await row(page, 2)).amt).toBe(1234567);
  await expect(cell(page, 2, 3)).toHaveText("1,234,567");
});

test("일자: 숫자만 쳐도 하이픈, 잘못된 날짜는 저장 안 됨, 달력 클릭", async ({ page }) => {
  await cell(page, 1, 4).click();
  await page.keyboard.type("20260230");
  await expect(input(page)).toHaveValue("2026-02-30");
  await expect(page.locator(".pyo-calendar")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(input(page)).toHaveClass(/pyo-invalid/);
  expect((await row(page, 1)).dt).toBe("");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(input(page)).toHaveValue("2026-02");
  await page.keyboard.type("28");
  await page.keyboard.press("Enter");
  expect((await row(page, 1)).dt).toBe("2026-02-28");

  // 달력: 셀 바로 아래에 열리고, 날짜를 누르면 저장
  await cell(page, 2, 4).dblclick();
  const cal = page.locator(".pyo-calendar");
  const cb = await rectOf(cell(page, 2, 4));
  const pb = await rectOf(cal);
  expect(pb.y).toBeGreaterThanOrEqual(cb.y + cb.height);
  await cal.locator(".pyo-cal-today").click();
  const today = await page.evaluate(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  expect((await row(page, 2)).dt).toBe(today);
  await expect(cal).toHaveCount(0);
});

test("구분: Enter로 목록, 방향키·Enter 저장, 한글로 찾기, 클릭", async ({ page, browserName }) => {
  await cell(page, 0, 5).click();
  await expect(cell(page, 0, 5)).toHaveText("가공");
  await page.keyboard.press("Enter");
  const dd = page.locator(".pyo-dropdown");
  await expect(dd).toBeVisible();
  await expect(dd.locator(".pyo-option-active")).toHaveText("가공");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  expect((await row(page, 0)).cd).toBe("C");
  await expect(cell(page, 0, 5)).toHaveText("조립");

  // 한글로 찾기: 조합 입력 (CDP는 Chromium에서만. 다른 브라우저는 조합 없이 글자로 찾는다)
  await cell(page, 1, 5).click();
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    for (const t of ["ㄷ", "도"]) await cdp.send("Input.imeSetComposition", { text: t, selectionStart: 1, selectionEnd: 1 });
    await cdp.send("Input.insertText", { text: "도" });
  } else {
    await page.keyboard.insertText("도");
  }
  await expect(dd.locator(".pyo-option-active")).toHaveText("도장");
  await dd.locator(".pyo-option", { hasText: "검사" }).click();
  expect((await row(page, 1)).cd).toBe("E");
  await expect(dd).toHaveCount(0);
});

test("체크박스: 클릭·Space로 Y/N", async ({ page }) => {
  expect((await row(page, 0)).use).toBe("N");
  await cell(page, 0, 6).click();
  expect((await row(page, 0)).use).toBe("Y");
  await expect(cell(page, 0, 6).locator(".pyo-cb")).toHaveClass(/pyo-checked/);
  await page.keyboard.press("Space");
  expect((await row(page, 0)).use).toBe("N");
});

test("셀 click·dblclick 이벤트가 실제 브라우저에서도 셀 정보를 담는다", async ({ page }) => {
  await page.evaluate(() => {
    window.__ev = [];
    window.grid.on("click", (e) => window.__ev.push(["click", e.rowIndex, e.key]));
    window.grid.on("dblclick", (e) => window.__ev.push(["dblclick", e.rowIndex, e.key]));
  });
  await cell(page, 4, 0).click();
  await cell(page, 4, 0).dblclick(); // 편집기 없는 컬럼 → dblclick 알림
  await cell(page, 4, 1).dblclick(); // 편집기 컬럼 → 편집 시작, dblclick 알리지 않음
  const ev = await page.evaluate(() => window.__ev);
  expect(ev).toEqual([["click", 4, "no"], ["click", 4, "no"], ["click", 4, "no"], ["dblclick", 4, "no"], ["click", 4, "name"], ["click", 4, "name"]]);
  expect(await page.evaluate(() => window.grid.isEditing)).toBe(true);
});

test("Delete는 끌어 선택한 범위의 편집 가능한 셀만 비운다, 잠긴 셀은 그대로", async ({ page }) => {
  const a = await rectOf(cell(page, 0, 1));
  const b = await rectOf(cell(page, 2, 7));
  await page.mouse.move(a.x + 5, a.y + 5);
  await page.mouse.down();
  await page.mouse.move(b.x + 5, b.y + 5, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press("Delete");
  const rows = await page.evaluate(() => [0, 1, 2].map((i) => ({ ...window.grid.getRow(i) })));
  expect(rows.map((r) => r.name)).toEqual(["", "", ""]);
  expect(rows.map((r) => r.no)).toEqual([1, 2, 3]); // 편집기 없음
  expect(rows[0].memo).toBe("잠김"); // disabled
  expect(rows.map((r) => r.use)).toEqual(["N", "Y", "Y"]); // 체크박스는 지우지 않는다
  await expect(page.locator("#log")).toContainText("clear");
});

test("편집 중 다른 셀 클릭·그리드 밖 클릭은 저장", async ({ page }) => {
  await cell(page, 5, 1).click();
  await page.keyboard.type("가나");
  await cell(page, 8, 2).click();
  expect((await row(page, 5)).name).toBe("가나");
  expect(await active(page)).toEqual({ r: 8, c: 2 });
  await page.keyboard.type("7");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  expect((await row(page, 8)).qty).toBe(7);
  expect(await page.evaluate(() => window.grid.isEditing)).toBe(false);
});

test("방향키로 화면 밖 셀까지 이동하면 따라 스크롤된다", async ({ page }) => {
  await cell(page, 0, 1).click();
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  expect(await active(page)).toEqual({ r: 30, c: 1 });
  await expect(cell(page, 30, 1)).toBeInViewport();
  await page.keyboard.press("Control+End");
  expect(await active(page)).toEqual({ r: 199, c: 7 });
  await expect(cell(page, 199, 7)).toBeInViewport();
  // 이동한 곳에서 바로 입력하면 그 셀이 편집된다
  await page.keyboard.type("끝");
  await page.keyboard.press("Enter");
  expect((await row(page, 199)).memo).toBe("끝");
});

test("weekly 데모: 이월 수량 편집 → 다음 주 조정 수요·요약 재계산", async ({ page }) => {
  await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=6");
  const c = page.locator('#gridWrap .pyo-row[data-row="0"] .pyo-cell[data-c="11"]');
  await c.click();
  await page.keyboard.type("777.9");
  await page.keyboard.press("Enter");
  const r = await page.evaluate(() => ({ ...window.grid.getRow(0) }));
  expect(r.CARRY_QTY).toBe(777);
  expect(r.NEXT_TOTAL).toBe(r.NEXT_ORDER + 777);
  await expect(page.locator('#gridWrap .pyo-row[data-row="0"] .pyo-cell[data-c="11"]')).toHaveText("777");
  const carry = await page.evaluate(() => window.grid.getSelectedRows().reduce((s, x) => s + x.CARRY_QTY, 0));
  await expect(page.locator("#sumCarry")).toHaveText(carry.toLocaleString("ko-KR"));
});
