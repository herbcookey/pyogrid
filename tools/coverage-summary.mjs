// 커버리지 요약(coverage/coverage-summary.json)을 Markdown 표로 찍는다. CI가 작업 요약(GITHUB_STEP_SUMMARY)에 붙인다.
//   node tools/coverage-summary.mjs            표준 출력으로
//   GITHUB_STEP_SUMMARY가 있으면 그 파일에도 덧붙인다
// 기준(thresholds)은 vitest.config.js에서 읽는다. 기준을 어기면 vitest가 실패시키므로 여기서는 보여 주기만 한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const METRICS = [
  ["statements", "Statements"],
  ["branches", "Branches"],
  ["functions", "Functions"],
  ["lines", "Lines"],
];

/**
 * @param {{total: Record<string, {total: number, covered: number, pct: number}>}} summary  istanbul json-summary
 * @param {Partial<Record<string, number>>} thresholds
 * @returns {string}
 */
export function coverageMarkdown(summary, thresholds) {
  const out = ["### Coverage (src/)", "", "| Metric | Coverage | Covered | Threshold |", "|---|---|---|---|"];
  for (const [key, label] of METRICS) {
    const m = summary.total[key];
    const min = thresholds[key];
    const limit = min === undefined ? "" : `${min}%${m.pct < min ? " (below)" : ""}`;
    out.push(`| ${label} | ${m.pct}% | ${m.covered} / ${m.total} | ${limit} |`);
  }
  return out.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "coverage", "coverage-summary.json");
  if (!fs.existsSync(file)) {
    console.error("[coverage-summary] coverage/coverage-summary.json이 없습니다. npm run test:coverage를 먼저 돌리세요.");
    process.exit(1);
  }
  const config = (await import(pathToFileURL(path.join(root, "vitest.config.js")).href)).default;
  const md = coverageMarkdown(JSON.parse(fs.readFileSync(file, "utf8")), config.test.coverage.thresholds || {});
  process.stdout.write(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
