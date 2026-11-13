// 6단계: xlsx 내보내기(실제 다운로드 파일을 SheetJS로 다시 읽기)·컬럼 너비/정렬 기억 (실제 Chrome)
import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import fs from "node:fs";

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));

test("엑셀 다운: 파일 이름·시트·병합 헤더·숫자 셀·합계 행", async ({ page }) => {
  await page.goto("/demo/weekly.html?date=2026-11-12&rows=6");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#btnExcelDownload").click()]);
  expect(download.suggestedFilename()).toBe("주간출고_W46_2026-11-09.xlsx");
  const file = await download.path();
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer", cellStyles: true });
  expect(wb.SheetNames).toEqual(["주간 출고"]);
  const ws = wb.Sheets["주간 출고"];
  const merges = ws["!merges"].map((m) => XLSX.utils.encode_range(m));
  expect(merges).toContain("I1:K1"); // 이번 주 W46 (주문·출고·미출고)
  expect(merges).toContain("M1:N1"); // 다음 주 W47
  expect(merges).toContain("A1:A2");
  expect(ws.I1.v).toBe("이번 주 W46");
  expect(ws.I2.v).toBe("주문");
  const rows = await page.evaluate(() => window.grid.getRows().map((r) => ({ ...r })));
  // 3행부터 데이터: 숫자 셀로 들어간다
  expect(ws.B3).toMatchObject({ t: "s", v: rows[0].SKU });
  expect(ws.I3).toMatchObject({ t: "n", v: rows[0].ORDER_QTY });
  expect(ws.L3).toMatchObject({ t: "n", v: rows[0].CARRY_QTY });
  // 합계 행 (6행 데이터 다음 = 9행): "합계"는 A~H 병합, 숫자는 숫자 셀
  expect(ws.A9.v).toBe("합계");
  expect(merges).toContain("A9:H9");
  expect(ws.I9).toMatchObject({ t: "n", v: rows.reduce((s, r) => s + r.ORDER_QTY, 0) });
  expect(ws["!cols"].length).toBe(15);
});

test("필터·정렬한 화면 그대로 내보낸다", async ({ page }) => {
  await page.goto("/demo/weekly.html?date=2026-11-12&rows=300");
  await page.evaluate(() => {
    window.grid.setFilter("OWNER", ["이영희"]);
    window.grid.setSort([{ key: "ORDER_QTY", dir: "desc" }]);
  });
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#btnExcelDownload").click()]);
  const ws = XLSX.read(fs.readFileSync(await download.path()), { type: "buffer" }).Sheets["주간 출고"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 2 });
  const body = data.slice(0, 60);
  expect(body.every((r) => r[0] === "이영희")).toBe(true);
  const demand = body.map((r) => r[8]);
  expect(demand).toEqual([...demand].sort((a, b) => b - a));
  expect(data[60][0]).toBe("합계");
});

test("너비·정렬 기억: 새로 고쳐도 남고, 초기화하면 사라진다", async ({ page }) => {
  await page.goto("/demo/weekly.html?date=2026-11-12&rows=300");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const head = page.locator('#gridWrap .pyo-hcell[data-key="CHANNEL"]');
  const w0 = (await head.boundingBox()).width;
  const h = await head.locator(".pyo-resizer").boundingBox();
  await page.mouse.move(h.x + 2, h.y + 5);
  await page.mouse.down();
  await page.mouse.move(h.x + 42, h.y + 5, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(350); // 너비 조절 직후 300ms 안의 클릭은 정렬하지 않는다 (실수 방지)
  await page.locator('#gridWrap .pyo-hcell[data-key="SHIP_QTY"] .pyo-hlabel').click();
  await page.reload();
  await expect(head).toHaveAttribute("data-key", "CHANNEL");
  expect(Math.round((await head.boundingBox()).width)).toBe(Math.round(w0 + 40));
  expect(await page.evaluate(() => window.grid.getSort())).toEqual([{ key: "SHIP_QTY", dir: "desc" }]);
  // 조회를 다시 눌러 컬럼을 새로 만들어도 남는다 (화면이 주차마다 setColumns를 부름)
  await page.locator("#btnNextWeek").click();
  expect(Math.round((await head.boundingBox()).width)).toBe(Math.round(w0 + 40));
  await page.locator("#btnResetState").click();
  await page.reload();
  expect(Math.round((await head.boundingBox()).width)).toBe(Math.round(w0));
  expect(await page.evaluate(() => window.grid.getSort())).toEqual([]);
});
