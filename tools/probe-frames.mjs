// 연속 스크롤 프레임 간격을 두 페이지에서 번갈아 측정한다 (성능 회귀 A/B 비교).
// node tools/probe-frames.mjs demo/big.html ref/big-stage1.html
import { chromium } from "@playwright/test";

const pages = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const results = Object.fromEntries(pages.map((p) => [p, []]));
for (let round = 0; round < 4; round++) {
  for (const url of pages) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto("http://127.0.0.1:5179/" + url);
    await page.waitForSelector(".pyo-row", { timeout: 10000 }).catch(() => console.log("그리드 없음:", url));
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const s = document.querySelector(".pyo-scroll");
      const frames = [];
      let last = performance.now();
      for (let i = 0; i < 120; i++) {
        s.scrollTop += 26 * 7;
        if (i % 3 === 0) s.scrollLeft = (i * 37) % 1500;
        await new Promise((res) => requestAnimationFrame(res));
        const now = performance.now();
        frames.push(now - last);
        last = now;
      }
      frames.sort((a, b) => a - b);
      return { median: frames[60], p95: frames[114] };
    });
    results[url].push(r);
    await page.close();
  }
}
for (const [url, rs] of Object.entries(results)) {
  const f = (k) => rs.map((r) => r[k].toFixed(1)).join(", ");
  console.log(url.padEnd(22), "중간값:", f("median"), " | 95%:", f("p95"));
}
await browser.close();
