// big.html 단계별 시간 측정 (성능 회귀 확인용). 서버가 떠 있어야 한다.
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const t = () => performance.now();
let s = t();
await page.goto("http://127.0.0.1:5179/demo/big.html");
console.log("goto(load)", Math.round(t() - s), "ms");
s = t();
await page.evaluate(() => window.timing);
console.log("evaluate", Math.round(t() - s), "ms", await page.evaluate(() => JSON.stringify(window.timing)));
s = t();
const n = await page.locator(".pyo-cell").count();
console.log("count cells", n, Math.round(t() - s), "ms");
s = t();
await page.evaluate(() => {
  window.grid.scrollToRow(25000, "top");
});
console.log("scrollToRow", Math.round(t() - s), "ms");
s = t();
await page.locator('.pyo-row[data-row="25000"] .pyo-cell').nth(2).textContent();
console.log("read cell", Math.round(t() - s), "ms");
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
  return { median: work[60].toFixed(2), p95: work[114].toFixed(2), max: work[119].toFixed(2) };
});
console.log("render 작업 시간(ms)", res);
await browser.close();
