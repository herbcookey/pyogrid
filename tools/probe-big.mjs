// big.html 단계별 시간 측정 (성능 회귀 확인용). 서버가 떠 있어야 한다.
//   node tools/probe-big.mjs
// measureBig()는 tools/perf-check.mjs(CI 성능 확인)도 쓴다.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

/**
 * big.html(50,000행 × 30열)을 열어 단계별 시간을 잰다.
 * @param {import("@playwright/test").Page} page
 * @param {string} [baseURL]
 * @param {(...args: any[]) => void} [log]  단계마다 찍을 함수 (CLI는 console.log)
 */
export async function measureBig(page, baseURL = "http://127.0.0.1:5179", log = () => {}) {
  const t = () => performance.now();
  let s = t();
  await page.goto(baseURL + "/demo/big.html");
  const gotoMs = t() - s;
  log("goto(load)", Math.round(gotoMs), "ms");
  s = t();
  const timing = await page.evaluate(() => window.timing);
  log("evaluate", Math.round(t() - s), "ms", JSON.stringify(timing));
  s = t();
  const n = await page.locator(".pyo-cell").count();
  log("count cells", n, Math.round(t() - s), "ms");
  s = t();
  await page.evaluate(() => {
    window.grid.scrollToRow(25000, "top");
  });
  const scrollMs = t() - s;
  log("scrollToRow", Math.round(scrollMs), "ms");
  s = t();
  await page.locator('.pyo-row[data-row="25000"] .pyo-cell').nth(2).textContent();
  log("read cell", Math.round(t() - s), "ms");
  const res = await page.evaluate(async () => {
    const sc = document.querySelector(".pyo-scroll");
    const work = [];
    for (let i = 0; i < 120; i++) {
      const a = performance.now();
      sc.scrollTop += 26 * 7;
      if (i % 3 === 0) sc.scrollLeft = (i * 37) % 1500;
      window.grid._render();
      window.grid._renderStatus();
      work.push(performance.now() - a);
      await new Promise((r) => requestAnimationFrame(r));
    }
    work.sort((a, b) => a - b);
    return { median: work[60], p95: work[114], max: work[119] };
  });
  log("render 작업 시간(ms)", { median: res.median.toFixed(2), p95: res.p95.toFixed(2), max: res.max.toFixed(2) });
  return {
    initAndSetData: timing.initAndSetData,
    scrollToRow: scrollMs,
    renderMedian: res.median,
    renderP95: res.p95,
    renderMax: res.max,
    cells: n,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await measureBig(page, undefined, console.log);
  await browser.close();
}
