// @vitest-environment node
import { describe, it, expect } from "vitest";
import { coverageMarkdown } from "../../tools/coverage-summary.mjs";

const summary = {
  total: {
    lines: { total: 200, covered: 190, pct: 95 },
    statements: { total: 300, covered: 270, pct: 90 },
    functions: { total: 50, covered: 45, pct: 90 },
    branches: { total: 100, covered: 80, pct: 80 },
  },
};

describe("coverageMarkdown", () => {
  it("항목마다 비율·개수·기준을 표로 만든다", () => {
    const md = coverageMarkdown(summary, { lines: 94, statements: 90, functions: 89.5, branches: 79 });
    expect(md).toContain("| Metric | Coverage | Covered | Threshold |");
    expect(md).toContain("| Statements | 90% | 270 / 300 | 90% |");
    expect(md).toContain("| Branches | 80% | 80 / 100 | 79% |");
    expect(md).toContain("| Functions | 90% | 45 / 50 | 89.5% |");
    expect(md).toContain("| Lines | 95% | 190 / 200 | 94% |");
    expect(md).not.toContain("below");
  });

  it("기준보다 낮은 항목을 표시한다", () => {
    const md = coverageMarkdown(summary, { lines: 96, statements: 90, functions: 90, branches: 80 });
    expect(md).toContain("| Lines | 95% | 190 / 200 | 96% (below) |");
    expect(md).toContain("| Statements | 90% | 270 / 300 | 90% |");
  });

  it("기준이 없는 항목은 비워 둔다", () => {
    const md = coverageMarkdown(summary, {});
    expect(md).toContain("| Lines | 95% | 190 / 200 |  |");
  });
});
