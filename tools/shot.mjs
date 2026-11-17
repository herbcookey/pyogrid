// 데모 페이지 스크린샷: node tools/shot.mjs <경로> <파일> [너비] [높이] [스크롤 "top,left"]
// 서버(npm run demo)가 떠 있어야 한다.
import { chromium } from "@playwright/test";

const [, , url = "demo/compare.html", out = "test-results/shot.png", w = "1400", hgt = "700", scroll = ""] = process.argv;
const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars=false"], ignoreDefaultArgs: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(hgt) }, locale: "ko-KR" });
page.on("console", (m) => console.log("[console]", m.type(), m.text(), m.location().url));
page.on("pageerror", (e) => console.log("[pageerror]", e.stack));
await page.goto("http://127.0.0.1:5179/" + url, { waitUntil: "networkidle" });
if (scroll) {
  const [top, left] = scroll.split(",").map(Number);
  await page.evaluate(
    ([t, l]) =>
      document.querySelectorAll(".pyo-scroll").forEach((s) => {
        s.scrollTop = t;
        s.scrollLeft = l;
      }),
    [top, left],
  );
}
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
