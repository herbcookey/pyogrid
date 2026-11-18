// 1단계: 렌더링·가상 스크롤·틀 고정·다단 헤더·너비 조절 (실제 Chrome)
import { test, expect } from "@playwright/test";

/** @param {import("@playwright/test").Page} page */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/.test(m.location().url)) errors.push(m.text());
  });
  return errors;
}

const box = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), w: Math.round(r.width), y: Math.round(r.top), h: Math.round(r.height) };
});

test.describe("weekly 데모", () => {
  test("다단 헤더·틀 고정·money 표시", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300");
    const grid = page.locator("#gridWrap .pyo");
    await expect(grid).toBeVisible();

    // 묶음 헤더 "이번 주 W46"은 아래 3개 잎 헤더 너비의 합 (80 × 3)
    const group = grid.locator(".pyo-hgroup", { hasText: "이번 주 W46" });
    const g = await box(group);
    const demand = await box(grid.locator('.pyo-hcell[data-key="ORDER_QTY"]'));
    const short = await box(grid.locator('.pyo-hcell[data-key="BACKLOG_QTY"]'));
    expect(g.w).toBe(240);
    expect(demand.x).toBe(g.x);
    expect(short.x + short.w).toBe(g.x + g.w);
    expect(demand.y).toBe(g.y + 26);

    // 첫 행 값과 money 서식
    const row0 = grid.locator('.pyo-row[data-row="0"]');
    await expect(row0.locator(".pyo-cell").nth(1)).toHaveText("홍길동"); // 0번은 행 선택 칸
    const demandCell = row0.locator('.pyo-cell[data-c="8"]');
    await expect(demandCell).toHaveText(/^\d{1,3}(,\d{3})*$/);
    await expect(demandCell).toHaveCSS("text-align", "right");

    // 미출하 > 0 인 행의 cellClass
    const shortCell = row0.locator('.pyo-cell[data-c="10"]');
    const shortText = await shortCell.textContent();
    if (Number(shortText.replace(/,/g, "")) > 0) await expect(shortCell).toHaveClass(/wk-backlog-cell/);
    expect(errors).toEqual([]);
  });

  test("가로 스크롤해도 틀 고정 컬럼은 제자리, 헤더와 본문 컬럼은 같이 움직인다", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300");
    const grid = page.locator("#gridWrap .pyo");
    const scroll = grid.locator(".pyo-scroll");
    const frozenHead = grid.locator('.pyo-hcell[data-key="BARCODE"]');
    const frozenCell = grid.locator('.pyo-row[data-row="0"] .pyo-cell[data-c="2"]');
    const movingHead = grid.locator('.pyo-hcell[data-key="CATEGORY"]');
    const movingCell = grid.locator('.pyo-row[data-row="0"] .pyo-cell[data-c="6"]');

    const before = { fh: await box(frozenHead), fc: await box(frozenCell), mh: await box(movingHead), mc: await box(movingCell) };
    expect(before.mh.x).toBe(before.mc.x);
    await scroll.evaluate((el) => (el.scrollLeft = 150));
    // 스크롤 뒤 다시 그리기는 다음 프레임이다. 고정 시간 대신 움직이는 헤더가 옮겨 갈 때까지 본다
    await expect.poll(async () => (await box(movingHead)).x).toBe(before.mh.x - 150);
    const after = { fh: await box(frozenHead), fc: await box(frozenCell), mh: await box(movingHead), mc: await box(movingCell) };
    expect(after.fh.x).toBe(before.fh.x);
    expect(after.fc.x).toBe(before.fc.x);
    expect(after.mh.x).toBe(before.mh.x - 150);
    expect(after.mc.x).toBe(after.mh.x);
    expect(after.mc.w).toBe(after.mh.w);

    // 스크롤된 컬럼은 고정 영역 뒤로 숨는다 (고정 영역이 위에 그려짐)
    const topEl = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest(".pyo-fz, .pyo-sc").className, [
      after.fc.x + 5,
      after.fc.y + 5,
    ]);
    expect(topEl).toContain("pyo-fz");
  });

  test("세로 스크롤해도 헤더는 위에 붙어 있다", async ({ page }) => {
    await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300");
    const grid = page.locator("#gridWrap .pyo");
    const head = grid.locator(".pyo-head");
    const y0 = (await box(head)).y;
    await grid.locator(".pyo-scroll").evaluate((el) => (el.scrollTop = 26 * 150));
    // 행은 스크롤 다음 프레임에 다시 그린다. 느린 CI에서도 기다리도록 고정 시간 대신 그려질 때까지 본다
    const firstRow = () => grid.locator(".pyo-body .pyo-row").evaluateAll((rows) => Math.min(...rows.map((r) => Number(r.dataset.row))));
    await expect.poll(firstRow).toBeGreaterThanOrEqual(140);
    expect((await box(head)).y).toBe(y0);
    await expect(grid.locator('.pyo-row[data-row="150"]')).toBeVisible();
    const visible150 = await box(grid.locator('.pyo-row[data-row="150"]'));
    expect(visible150.y).toBe(y0 + 26 * 2 + 1); // 헤더 2줄 + 헤더 아래 선 1px
  });

  test("헤더 경계를 끌어 너비를 바꾸면 헤더와 본문이 같이 바뀐다", async ({ page }) => {
    await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300");
    const grid = page.locator("#gridWrap .pyo");
    const head = grid.locator('.pyo-hcell[data-key="CHANNEL"]');
    const h0 = await box(head);
    const handle = head.locator(".pyo-resizer");
    const hb = await box(handle);
    await page.mouse.move(hb.x + 2, hb.y + 5);
    await page.mouse.down();
    await page.mouse.move(hb.x + 30, hb.y + 5, { steps: 5 });
    await expect(grid.locator(".pyo-resize-guide")).toBeVisible();
    await page.mouse.move(hb.x + 52, hb.y + 5, { steps: 5 });
    await page.mouse.up();
    await expect(grid.locator(".pyo-resize-guide")).toBeHidden();
    const h1 = await box(head);
    expect(h1.w).toBe(h0.w + 50);
    const cell = await box(grid.locator('.pyo-row[data-row="0"] .pyo-cell[data-c="4"]'));
    expect(cell.w).toBe(h1.w);
    expect(cell.x).toBe(h1.x);
    const widths = await page.evaluate(() => window.grid.getColumnWidths());
    expect(widths[4]).toBe(80 + 50);
  });

  test("데이터가 없으면 안내 문구", async ({ page }) => {
    await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=6");
    await page.evaluate(() => window.grid.setData([]));
    const empty = page.locator("#gridWrap .pyo-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText("조회된 데이터가 없습니다.");
  });
});

test.describe("대량 데이터 (50,000행 × 30열)", () => {
  test("생성 속도·DOM 크기·스크롤 위치", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/demo/big.html?lang=ko");
    const timing = await page.evaluate(() => window.timing);
    console.log(`  그리드 생성+setData: ${timing.initAndSetData.toFixed(1)}ms`);
    expect(timing.initAndSetData).toBeLessThan(500);

    const rowCount = await page.locator(".pyo-row").count();
    const cellCount = await page.locator(".pyo-cell").count();
    console.log(`  DOM 행 ${rowCount}개, 셀 ${cellCount}개`);
    expect(rowCount).toBeLessThan(40);
    expect(cellCount).toBeLessThan(40 * 20);

    // 중간으로 이동 (반환값 grid를 Playwright가 직렬화하지 않도록 값을 돌려주지 않는다)
    await page.evaluate(() => {
      window.grid.scrollToRow(25000, "top");
    });
    await page.waitForTimeout(50);
    const r = page.locator('.pyo-row[data-row="25000"]');
    await expect(r.locator(".pyo-cell").nth(2)).toHaveText("항목-25001"); // 줄 번호, id, name
    await expect(r.locator(".pyo-cell").first()).toHaveText("25001");

    // 끝으로 이동: 마지막 행·마지막 컬럼
    await page.evaluate(() => {
      const s = document.querySelector(".pyo-scroll");
      s.scrollTop = s.scrollHeight;
      s.scrollLeft = s.scrollWidth;
    });
    await page.waitForTimeout(100);
    const last = page.locator('.pyo-row[data-row="49999"]');
    await expect(last).toBeVisible();
    await expect(last.locator('.pyo-cell[data-c="29"]')).toBeVisible();
    const lastBox = await box(last.locator('.pyo-cell[data-c="29"]'));
    const scrollBox = await box(page.locator(".pyo-scroll"));
    expect(lastBox.x + lastBox.w).toBeLessThanOrEqual(scrollBox.x + scrollBox.w);
    expect(errors).toEqual([]);
  });

  test("연속 스크롤 프레임 시간", async ({ page, browserName }) => {
    await page.goto("/demo/big.html?lang=ko");
    const result = await page.evaluate(async () => {
      const s = document.querySelector(".pyo-scroll");
      const frames = [];
      let last = performance.now();
      for (let i = 0; i < 120; i++) {
        s.scrollTop += 26 * 7; // 프레임마다 7행 (빠른 휠 스크롤)
        if (i % 3 === 0) s.scrollLeft = (i * 37) % 1500;
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        frames.push(now - last);
        last = now;
      }
      frames.sort((a, b) => a - b);
      return { median: frames[60], p95: frames[Math.floor(frames.length * 0.95)], max: frames[frames.length - 1] };
    });
    console.log(`  프레임 간격 중간값 ${result.median.toFixed(1)}ms, 95% ${result.p95.toFixed(1)}ms, 최대 ${result.max.toFixed(1)}ms`);
    // 프레임 간격은 PC 부하에 따라 크게 흔들린다 (같은 PC에서 95%가 20~250ms).
    // 중간값으로 평소 속도를, 95% 100ms로 큰 회귀만 잡는다. 정밀 비교는 tools/probe-frames.mjs로 A/B 측정.
    // Windows의 Playwright WebKit·Firefox는 빈 화면에서도 프레임 간격이 Chrome보다 들쭉날쭉하고,
    // WebKit(Desktop Safari, 2배 해상도)은 같은 페이지에서 중간값 50~60ms가 나온다. 엄격한 기준은 Chrome에 두고,
    // 다른 브라우저는 크게 느려진 경우만 잡는다.
    const strict = browserName === "chromium";
    expect(result.median).toBeLessThan(strict ? 25 : 90);
    expect(result.p95).toBeLessThan(strict ? 100 : 160);
  });
});

test.describe("크기 변화", () => {
  test('컨테이너 너비가 바뀌면 "*" 컬럼이 다시 계산된다', async ({ page }) => {
    // setContent 대신 실제 파일로 연다 (CI의 Firefox에서 setContent 뒤 window.grid가 생기지 않은 채 60초를 넘긴 적이 있다)
    const errors = watchErrors(page);
    await page.goto("/test/e2e/fixtures/star-width.html");
    await page.waitForFunction(() => window.grid, undefined, { timeout: 10000 }).catch(() => {
      throw new Error("window.grid가 생기지 않았다. 페이지 오류: " + JSON.stringify(errors));
    });
    expect(errors).toEqual([]);
    // 이 브라우저의 스크롤바 너비 (Chrome·WebKit은 ::-webkit-scrollbar 15px, Firefox는 기본값, headless는 0일 수 있다)
    const sb = await page.evaluate(() => {
      const p = document.createElement("div");
      p.className = "pyo-scroll";
      p.style.cssText = "position:absolute;overflow:scroll;width:100px;height:100px";
      document.querySelector(".pyo").append(p);
      const w = p.offsetWidth - p.clientWidth;
      p.remove();
      return w;
    });
    const w0 = await page.evaluate(() => window.grid.getColumnWidths()[1]);
    expect(w0).toBe(600 - 2 - sb - 100); // 테두리 2px, 스크롤바
    await page.evaluate(() => (document.getElementById("g").style.width = "800px"));
    await page.waitForFunction((s) => window.grid.getColumnWidths()[1] === 800 - 2 - s - 100, sb);
    // 스크롤바가 있는 화면에서 행이 많아져도 가로로 넘치지 않는다
    await page.evaluate(() => window.grid.setData(Array.from({ length: 300 }, (_, i) => ({ a: i, b: i }))));
    expect(await page.evaluate(() => { const s = document.querySelector(".pyo-scroll"); return s.scrollWidth - s.clientWidth; })).toBe(0);
  });
});
