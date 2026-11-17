// 성능 회귀 확인: tools/probe-big.mjs·probe-frames.mjs로 big.html(50,000행 × 30열)을 여러 번 재고,
// 항목마다 중간값을 tools/perf-baseline.json과 비교한다.
//   node tools/perf-check.mjs              재고 비교한다. 느려져도 경고만 찍고 0으로 끝난다
//   node tools/perf-check.mjs --update     잰 값으로 perf-baseline.json을 바꾼다
//   --rounds 7                             잴 횟수 (기본 5)
// CI(GitHub Actions)에서는 느려진 항목을 ::warning::으로 남기고 표를 작업 요약에 붙인다.
// 먼저 npm run build로 dist/를 만들어야 한다. 데모 서버(5179)는 이 스크립트가 띄운다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @param {number[]} list */
export function median(list) {
  const a = [...list].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * @param {Record<string, number>} values  항목 → 잰 값 (ms, 작을수록 좋다)
 * @param {{tolerance?: number, metrics: Record<string, number>}} baseline
 */
export function compareToBaseline(values, baseline) {
  const tol = baseline.tolerance ?? 1.5;
  const rows = [];
  for (const [metric, value] of Object.entries(values)) {
    const base = baseline.metrics[metric];
    if (base === undefined) {
      rows.push({ metric, value, baseline: null, limit: null, status: "new" });
      continue;
    }
    const limit = round3(base * tol);
    rows.push({ metric, value, baseline: base, limit, status: value > limit ? "slower" : "ok" });
  }
  for (const [metric, base] of Object.entries(baseline.metrics)) {
    if (!(metric in values)) rows.push({ metric, value: null, baseline: base, limit: round3(base * tol), status: "missing" });
  }
  return { rows, regressions: rows.filter((r) => r.status === "slower") };
}

/**
 * @param {ReturnType<typeof compareToBaseline>} result
 * @param {Record<string, number>} values
 */
export function perfMarkdown(result, values) {
  const cell = (v) => (v === null || v === undefined ? "" : String(v));
  const out = [
    "### Performance (demo/big.html, 50,000 rows × 30 columns)",
    "",
    "| Metric | Value (ms) | Baseline (ms) | Limit (ms) | Status |",
    "|---|---|---|---|---|",
    ...result.rows.map((r) => `| ${r.metric} | ${cell(r.value)} | ${cell(r.baseline)} | ${cell(r.limit)} | ${r.status} |`),
    "",
    result.regressions.length
      ? `Slower than the limit: ${result.regressions.map((r) => r.metric).join(", ")}. This is a warning only; CI runners vary a lot.`
      : "All metrics are within the limit.",
    "",
    "Measured values, for `tools/perf-baseline.json` if the baseline should change:",
    "",
    "```json",
    JSON.stringify(values, null, 2),
    "```",
    "",
  ];
  return out.join("\n");
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const argv = process.argv.slice(2);
  const update = argv.includes("--update");
  const ri = argv.indexOf("--rounds");
  const rounds = ri >= 0 ? Number(argv[ri + 1]) : 5;
  if (!fs.existsSync(path.join(root, "dist", "pyogrid.js"))) {
    console.error("[perf-check] dist/pyogrid.js가 없습니다. npm run build를 먼저 돌리세요.");
    process.exit(1);
  }

  // 데모 서버: serve.mjs는 불러오면 5179에서 듣는다
  process.argv = [process.argv[0], process.argv[1]];
  await import("./serve.mjs");
  const { chromium } = await import("@playwright/test");
  const { measureBig } = await import("./probe-big.mjs");
  const { measureFrames } = await import("./probe-frames.mjs");

  const browser = await chromium.launch({ channel: "chrome" });
  /** @type {Record<string, number[]>} */
  const samples = {};
  const add = (k, v) => (samples[k] = samples[k] || []).push(v);
  try {
    for (let i = 0; i < rounds; i++) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      const big = await measureBig(page);
      await page.close();
      add("initAndSetData", big.initAndSetData);
      add("scrollToRow", big.scrollToRow);
      add("renderMedian", big.renderMedian);
      add("renderP95", big.renderP95);
      const fr = await measureFrames(browser, "demo/big.html");
      add("frameMedian", fr.median);
      add("frameP95", fr.p95);
    }
  } finally {
    await browser.close();
  }
  /** @type {Record<string, number>} */
  const values = {};
  for (const [k, list] of Object.entries(samples)) values[k] = Math.round(median(list) * 100) / 100;

  const baseFile = path.join(root, "tools", "perf-baseline.json");
  if (update) {
    const prev = fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, "utf8")) : {};
    const next = { ...prev, metrics: values };
    fs.writeFileSync(baseFile, JSON.stringify(next, null, 2) + "\n");
    console.log("[perf-check] tools/perf-baseline.json을 바꿨습니다:", values);
    process.exit(0);
  }

  const baseline = JSON.parse(fs.readFileSync(baseFile, "utf8"));
  const result = compareToBaseline(values, baseline);
  const md = perfMarkdown(result, values);
  process.stdout.write(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (process.env.GITHUB_ACTIONS) {
    for (const r of result.regressions) console.log(`::warning title=Performance::${r.metric} ${r.value} ms (baseline ${r.baseline} ms, limit ${r.limit} ms)`);
  }
  // 처음에는 실패시키지 않는다 (CI 기계마다 편차가 크다)
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
