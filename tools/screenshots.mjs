// README·데모 목록용 스크린샷을 docs/images/에 다시 찍는다. 먼저 npm run build.
//   node tools/screenshots.mjs            README 그림 6장 (weekly, filter, editors, summary, paging, big)
//   node tools/screenshots.mjs --pages    데모 페이지 전체 화면을 test-results/pages/에 (모양 확인용)
// 데모 서버를 같은 프로세스에서 띄우고 설치된 Chrome으로 찍는다.
import "./serve.mjs";
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:5179";
const browser = await chromium.launch({ channel: "chrome" });

async function open(url, w = 1280, h = 720) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, locale: "ko-KR" });
  page.on("pageerror", (e) => console.log("[pageerror]", url, e.message));
  await page.goto(base + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return page;
}
/** 여러 요소를 감싸는 영역 */
async function around(page, selectors, pad = 12) {
  const boxes = [];
  for (const s of selectors) {
    const b = await page.locator(s).first().boundingBox();
    if (b) boxes.push(b);
  }
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) + pad - x, height: Math.max(...boxes.map((b) => b.y + b.height)) + pad - y };
}

if (process.argv.includes("--pages")) {
  fs.mkdirSync("test-results/pages", { recursive: true });
  for (const [name, w] of [["index", 1280], ["weekly", 1280], ["editors", 1280], ["summary", 1280], ["paging", 1280], ["big", 1280], ["index", 390], ["weekly", 390]]) {
    const page = await open(`/demo/${name}.html${name === "weekly" ? "?date=2026-11-12" : ""}`, w, w < 500 ? 844 : 800);
    const file = `test-results/pages/${name}-${w}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log("saved", file);
    await page.close();
  }
} else {
  const out = "docs/images";
  fs.mkdirSync(out, { recursive: true });
  const shot = async (page, file, clip) => {
    await page.screenshot({ path: `${out}/${file}`, clip });
    console.log("saved", `${out}/${file}`);
  };

  // 주간 현황: 툴바·숫자 카드·그리드 (위쪽 바 아래부터)
  {
    const page = await open("/demo/weekly.html?date=2026-11-12&rows=300", 1280, 800);
    await shot(page, "weekly.png", await around(page, [".d-head", ".d-toolbar", "#gridWrap"], 16));
    // 헤더 값 필터 팝업
    await page.locator('#gridWrap .pyo-hcell[data-key="OWNER"] .pyo-filter-btn').click();
    await page.locator(".pyo-filter .pyo-f-list label", { hasText: "김철수" }).locator("input").uncheck();
    const g = await page.locator("#gridWrap").boundingBox();
    await shot(page, "filter.png", { x: g.x - 8, y: g.y - 8, width: 760, height: 420 });
    await page.close();
  }
  // 셀 편집기: 날짜 칸에 숫자를 치는 중 (달력)
  {
    const page = await open("/demo/editors.html", 1100, 700);
    await page.locator('#grid .pyo-row[data-row="2"] .pyo-cell[data-c="4"]').click();
    await page.keyboard.type("2026111");
    await page.waitForTimeout(200);
    await shot(page, "editors.png", await around(page, ["#grid", ".pyo-calendar"]));
    await page.close();
  }
  // 그룹 합계·트리·셀 병합
  {
    const page = await open("/demo/summary.html", 900, 1200);
    await shot(page, "summary.png", await around(page, [".d-section", "#group", "#tree", "#merge"]));
    await page.close();
  }
  // 서버 페이징: 3페이지로 이동한 화면
  {
    const page = await open("/demo/paging.html", 1000, 700);
    await page.locator('.pyo-page-btn[data-page-move="3"]').click();
    await page.waitForTimeout(200);
    await shot(page, "paging.png", await around(page, ["#grid"]));
    await page.close();
  }
  // 50,000행: 가운데로 스크롤 (틀 고정 열은 그대로)
  {
    const page = await open("/demo/big.html", 1280, 800);
    await page.evaluate(() => {
      const s = document.querySelector("#grid .pyo-scroll");
      s.scrollTop = 26 * 25000;
      s.scrollLeft = 1200;
    });
    await page.waitForTimeout(400);
    await shot(page, "big.png", await around(page, ["#info", "#grid"]));
    await page.close();
  }
}

await browser.close();
process.exit(0);
