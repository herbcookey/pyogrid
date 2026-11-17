// 5단계: 헤더 값 필터·합계 행·그룹 합계·트리·셀 병합 (실제 Chrome)
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));

const box = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) };
});
const num = (s) => Number(String(s).replace(/,/g, ""));

test.describe("weekly 데모", () => {
  test.beforeEach(async ({ page }) => page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300"));

  test("합계 행은 본문 아래 붙어 있고 가로 스크롤을 따라간다, 값은 전체 합계", async ({ page }) => {
    const foot = page.locator("#gridWrap .pyo-foot");
    await expect(foot).toBeVisible();
    const scroll = await box(page.locator("#gridWrap .pyo-scroll"));
    const hbar = await page.locator("#gridWrap .pyo-scroll").evaluate((el) => el.offsetHeight - el.clientHeight);
    const fb = await box(foot);
    expect(Math.abs(fb.b - (scroll.b - hbar))).toBeLessThanOrEqual(1); // 가로 스크롤바가 있으면 그 위
    const sum = await page.evaluate(() => window.grid.getRows().reduce((s, r) => s + r.ORDER_QTY, 0));
    const cell = foot.locator('.pyo-sum-cell[data-c="8"]');
    expect(num(await cell.textContent())).toBe(sum);
    // 같은 컬럼 헤더와 x가 같다 (가로로 스크롤한 뒤에도)
    await page.locator("#gridWrap .pyo-scroll").evaluate((el) => (el.scrollLeft = 120));
    await page.waitForTimeout(80);
    const head = await box(page.locator('#gridWrap .pyo-hcell[data-key="ORDER_QTY"]'));
    expect((await box(cell)).x).toBe(head.x);
    // 고정 영역의 "합계"는 제자리
    await expect(foot.locator(".pyo-fz .pyo-sum-cell", { hasText: "합계" })).toBeVisible();
  });

  test("헤더 값 필터: 담당자 하나만 → 행·합계·요약이 바뀌고, 초기화로 복구", async ({ page }) => {
    await page.locator('#gridWrap .pyo-hcell[data-key="OWNER"] .pyo-filter-btn').click();
    const pop = page.locator(".pyo-filter");
    await expect(pop).toBeVisible();
    await expect(pop.locator(".pyo-f-list label")).toHaveCount(5);
    await pop.locator(".pyo-f-all input").uncheck();
    await pop.locator(".pyo-f-list label", { hasText: "김철수" }).locator("input").check();
    await pop.locator(".pyo-f-ok").click();
    await expect(pop).toHaveCount(0);
    const names = await page.evaluate(() => [...new Set(window.grid.getRows().map((r) => r.OWNER))]);
    expect(names).toEqual(["김철수"]);
    expect(await page.evaluate(() => window.grid.getRows().length)).toBe(60);
    await expect(page.locator("#sumItemCount")).toHaveText("60");
    await expect(page.locator('#gridWrap .pyo-hcell[data-key="OWNER"] .pyo-filter-btn')).toHaveClass(/pyo-filter-on/);
    const sum = await page.evaluate(() => window.grid.getRows().reduce((s, r) => s + r.ORDER_QTY, 0));
    expect(num(await page.locator('#gridWrap .pyo-foot .pyo-sum-cell[data-c="8"]').textContent())).toBe(sum);

    // 검색 + Enter
    await page.locator('#gridWrap .pyo-hcell[data-key="CHANNEL"] .pyo-filter-btn').click();
    await page.keyboard.type("온라인");
    await page.keyboard.press("Enter");
    const buyers = await page.evaluate(() => [...new Set(window.grid.getRows().map((r) => r.CHANNEL))]);
    expect(buyers).toEqual(["온라인"]);

    await page.locator('#gridWrap .pyo-hcell[data-key="OWNER"] .pyo-filter-btn').click();
    await page.locator(".pyo-filter .pyo-f-clear").click();
    await page.evaluate(() => window.grid.clearFilters());
    expect(await page.evaluate(() => window.grid.getRows().length)).toBe(300);
  });

  test("필터 단추를 눌러도 정렬되지 않고, 바깥을 누르거나 Esc면 닫힌다", async ({ page }) => {
    await page.locator('#gridWrap .pyo-hcell[data-key="CATEGORY"] .pyo-filter-btn').click();
    await expect(page.locator(".pyo-filter")).toBeVisible();
    expect(await page.evaluate(() => window.grid.getSort())).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.locator(".pyo-filter")).toHaveCount(0);
    await page.locator('#gridWrap .pyo-hcell[data-key="CATEGORY"] .pyo-filter-btn').click();
    await page.mouse.click(5, 5);
    await expect(page.locator(".pyo-filter")).toHaveCount(0);
    // 헤더 글자를 누르면 정렬, 정렬 표시는 그때 보인다
    const head = page.locator('#gridWrap .pyo-hcell[data-key="CATEGORY"]');
    await expect(head.locator(".pyo-sort-mark")).toBeHidden();
    await head.locator(".pyo-hlabel").click();
    await expect(head).toHaveAttribute("data-sort", "desc");
    await expect(head.locator(".pyo-sort-mark")).toBeVisible();
  });

  test("조건 필터: 팝업에서 '이상'을 고르고 값을 넣어 Enter → 행·합계가 바뀌고, 초기화로 복구", async ({ page }) => {
    const all = await page.evaluate(() => window.grid.getRows().length);
    // 기준값: 데이터의 가운데 값 (데이터가 바뀌어도 일부 행만 남게)
    const mid = await page.evaluate(() => {
      const v = window.grid.getRows().map((r) => r.ORDER_QTY).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    });
    const btn = page.locator('#gridWrap .pyo-hcell[data-key="ORDER_QTY"] .pyo-filter-btn');
    await btn.click();
    const pop = page.locator(".pyo-filter");
    await pop.locator("select.pyo-f-op").selectOption("ge");
    await pop.locator(".pyo-f-value").fill(mid.toLocaleString("en-US"));
    await pop.locator(".pyo-f-value").press("Enter");
    await expect(pop).toHaveCount(0);
    const info = await page.evaluate(() => ({
      rows: window.grid.getRows().map((r) => r.ORDER_QTY),
      conds: window.grid.getFilterConditions(),
    }));
    expect(info.conds).toEqual({ ORDER_QTY: { type: "number", op: "ge", value: mid } });
    expect(info.rows.length).toBeGreaterThan(0);
    expect(info.rows.length).toBeLessThan(all);
    expect(info.rows.every((v) => v >= mid)).toBe(true);
    await expect(btn).toHaveClass(/pyo-filter-on/);
    const sum = info.rows.reduce((s, v) => s + v, 0);
    expect(num(await page.locator('#gridWrap .pyo-foot .pyo-sum-cell[data-c="8"]').textContent())).toBe(sum);
    // 다시 열면 건 조건이 채워져 있다
    await btn.click();
    await expect(pop.locator("select.pyo-f-op")).toHaveValue("ge");
    await expect(pop.locator(".pyo-f-value")).toHaveValue(String(mid));
    await pop.locator(".pyo-f-clear").click();
    expect(await page.evaluate(() => [window.grid.getRows().length, window.grid.getFilterConditions()])).toEqual([all, {}]);
    await expect(btn).not.toHaveClass(/pyo-filter-on/);
  });
});

test.describe("summary 데모", () => {
  test.beforeEach(async ({ page }) => page.goto("/demo/summary.html?lang=ko"));

  test("그룹 소계·합계 행, 편집하면 소계가 바뀐다", async ({ page }) => {
    const groups = await page.evaluate(() =>
      window.groupGrid.getViewRows().filter((r) => r.__isGrouping).map((r) => r.__groupingBy.labels.join("/")),
    );
    expect(groups).toEqual(["부산점/A구역", "부산점/B구역", "부산점/C구역", "부산점", "서울점/A구역", "서울점/B구역", "서울점/C구역", "서울점"]);
    const g = page.locator('#group .pyo-row.pyo-group-row[data-row="6"]');
    await expect(g).toContainText("부산점 / A구역 소계");
    const qty = () => g.locator('.pyo-sum-cell[data-c="3"]').textContent();
    const before = num(await qty());
    const old = await page.evaluate(() => window.groupGrid.getRow(0).QTY);
    await page.locator('#group .pyo-row[data-row="0"] .pyo-cell[data-c="3"]').click();
    await page.keyboard.type("1000");
    await page.keyboard.press("Enter");
    expect(num(await qty())).toBe(before - old + 1000);
    // 그룹 행은 편집·선택 대상이 아니다
    await g.locator(".pyo-sum-cell").nth(3).click();
    await page.keyboard.type("5");
    expect(await page.evaluate(() => window.groupGrid.isEditing)).toBe(false);
  });

  test("트리: 펼침 단추로 접기·펼치기, 접힌 노드 펼치기", async ({ page }) => {
    const ids = () => page.evaluate(() => window.treeGrid.getViewRows().map((r) => r.id));
    expect(await ids()).toEqual(["C-100", "C-110", "C-111", "C-112", "C-120", "C-121", "C-122", "C-200"]);
    await page.locator('#tree .pyo-row[data-row="1"] [data-tree-toggle]').click();
    expect(await ids()).toEqual(["C-100", "C-110", "C-120", "C-121", "C-122", "C-200"]);
    await page.locator('#tree .pyo-row[data-row="5"] [data-tree-toggle]').click();
    expect((await ids()).slice(-2)).toEqual(["C-200", "C-210"]);
    const indent = await box(page.locator('#tree .pyo-row[data-row="3"] .pyo-tree-indent'));
    expect(indent.w).toBe(28);
  });

  test("셀 병합: 덩어리 안 가로선 없음, 글자는 덩어리 가운데 행", async ({ page }) => {
    const cell = (r, c) => page.locator(`#merge .pyo-row[data-row="${r}"] .pyo-cell[data-c="${c}"]`);
    const text = (r, c) => cell(r, c).locator(".pyo-merge-text");
    await expect(text(0, 0)).toBeHidden();
    await expect(text(1, 0)).toBeVisible();
    await expect(text(1, 0)).toHaveText("음료");
    await expect(cell(0, 0)).toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
    await expect(cell(2, 0)).not.toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
    await expect(text(0, 1)).toBeVisible();
    await expect(text(0, 1)).toHaveText("커피");
    await expect(cell(2, 1)).toHaveText("차"); // 한 줄짜리는 병합하지 않는다
  });
});

test("값이 50,000개인 바코드 필터: 확인만 누르면 그대로, 마지막 바코드도 검색된다", async ({ page }) => {
  page.__errors = page.__errors || [];
  await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=50000");
  const btn = page.locator('#gridWrap .pyo-hcell[data-key="BARCODE"] .pyo-filter-btn');
  await btn.click();
  const pop = page.locator(".pyo-filter");
  await expect(pop.locator(".pyo-f-list label")).toHaveCount(2000);
  await expect(pop.locator(".pyo-f-note")).toContainText("50,000개 중 앞의 2,000개");
  await pop.locator(".pyo-f-ok").click();
  expect(await page.evaluate(() => window.grid.getRows().length)).toBe(50000);
  expect(await page.evaluate(() => window.grid.isFilterActive())).toBe(false);

  const last = await page.evaluate(() => window.grid.getAllRows()[49999].BARCODE);
  await btn.click();
  await page.keyboard.type(last);
  await expect(pop.locator(".pyo-f-list label")).toHaveCount(1);
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.grid.getRows().map((r) => r.BARCODE))).toEqual([last]);
});

test("200행 병합 덩어리: 화면 안에 글자가 하나 보이고 스크롤을 따라온다", async ({ page }) => {
  await page.goto("/demo/index.html");
  await page.setContent(`<!DOCTYPE html><html><head><link rel="stylesheet" href="/dist/pyogrid.css"></head><body>
    <div id="g" style="width:500px;height:300px"></div>
    <script src="/dist/pyogrid.js"></script>
    <script>window.grid = new PyoGrid(document.getElementById("g"), { mergeCells: ["k"], columns: [{ key: "k", label: "K" }, { key: "i", label: "I" }] });
    grid.setData(Array.from({ length: 200 }, (_, i) => ({ k: "같은 값", i })));</script></body></html>`);
  await page.waitForFunction(() => window.grid);
  const visibleLabels = () =>
    page.locator('.pyo-body .pyo-cell[data-c="0"] .pyo-merge-text').evaluateAll((els) => {
      const sc = document.querySelector(".pyo-scroll").getBoundingClientRect();
      return els
        .filter((e) => getComputedStyle(e).visibility === "visible")
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.top >= sc.top && r.bottom <= sc.bottom).length;
    });
  await expect.poll(visibleLabels).toBe(1);
  await page.locator(".pyo-scroll").evaluate((el) => (el.scrollTop = 26 * 120));
  // 스크롤 뒤 다시 그리기는 다음 프레임이다. 부하가 큰 PC에서도 기다리도록 고정 시간 대신 될 때까지 본다
  await expect.poll(visibleLabels).toBe(1);
  await expect(page.locator('.pyo-body .pyo-merge-text:visible').first()).toHaveText("같은 값");
});

test("병합 셀도 범위 선택 색·포커스 셀 색이 보인다", async ({ page }) => {
  await page.goto("/demo/summary.html?lang=ko");
  const cell = (r, c) => page.locator(`#merge .pyo-row[data-row="${r}"] .pyo-cell[data-c="${c}"]`);
  await expect(cell(0, 0)).toHaveClass(/pyo-merged/);
  await expect(cell(0, 0)).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.evaluate(() => window.mergeGrid.setRange(0, 0, 2, 1)); // 포커스는 (2,1)
  await expect(cell(0, 0)).toHaveCSS("background-color", "rgb(207, 224, 250)");
  await expect(cell(0, 2)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)"); // 범위 밖 일반 셀은 투명 (행 배경)
  await page.evaluate(() => window.mergeGrid.setRange(1, 0));
  await expect(cell(1, 0)).toHaveCSS("background-color", "rgb(234, 242, 254)");
  await expect(cell(0, 0)).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("달력·필터 팝업은 바깥 페이지·모달 스크롤을 따라가고, 아래 자리가 없으면 위로 열린다", async ({ page }) => {
  await page.goto("/demo/index.html");
  await page.setContent(`<!DOCTYPE html><html><head><link rel="stylesheet" href="/dist/pyogrid.css"></head><body style="margin:0">
    <div id="modal" style="height:500px;overflow:auto;border:1px solid #ccc">
      <div style="height:200px"></div>
      <div id="g" style="width:500px;height:200px"></div>
      <div style="height:1500px"></div>
    </div>
    <div style="height:2000px"></div>
    <script src="/dist/pyogrid.js"></script>
    <script>window.grid = new PyoGrid(document.getElementById("g"), { filter: true,
      columns: [{ key: "d", label: "D", editor: { type: "date" } }, { key: "t", label: "T" }] });
    grid.setData([{ d: "2026-11-13", t: "a" }, { d: "", t: "b" }]);</script></body></html>`);
  await page.waitForFunction(() => window.grid);
  const cell = page.locator('.pyo-row[data-row="0"] .pyo-cell[data-c="0"]');
  const gap = async (popup) => {
    const c = await cell.boundingBox();
    const p = await page.locator(popup).boundingBox();
    return Math.round(p.y - (c.y + c.height));
  };

  // 달력: 모달 안 스크롤, 페이지 스크롤 뒤에도 셀 바로 아래
  await cell.click();
  await page.keyboard.press("F2");
  await expect(page.locator(".pyo-calendar")).toBeVisible();
  const g0 = await gap(".pyo-calendar");
  await page.locator("#modal").evaluate((el) => (el.scrollTop = 60));
  await page.waitForTimeout(50);
  expect(await gap(".pyo-calendar")).toBe(g0);
  await page.evaluate(() => window.scrollTo(0, 40));
  await page.waitForTimeout(50);
  expect(await gap(".pyo-calendar")).toBe(g0);
  await page.keyboard.press("Escape");

  // 필터 팝업: 단추 아래에 붙어 따라오고, 화면 아래쪽이면 위로 열린다
  const btn = page.locator('.pyo-hcell[data-key="t"] .pyo-filter-btn');
  await btn.click();
  const pop = page.locator(".pyo-filter");
  await expect(pop).toBeVisible();
  const below = async () => Math.round((await pop.boundingBox()).y - ((await btn.boundingBox()).y + (await btn.boundingBox()).height));
  const b0 = await below();
  await page.locator("#modal").evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(50);
  expect(await below()).toBe(b0);
  await page.keyboard.press("Escape");
  // 헤더가 창 아래쪽에 오게 줄이고 다시 연다
  await page.setViewportSize({ width: 1000, height: 330 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#modal").evaluate((el) => (el.scrollTop = 0));
  await btn.click();
  const pb = await pop.boundingBox();
  const bb = await btn.boundingBox();
  expect(pb.y + pb.height).toBeLessThanOrEqual(bb.y);
});
