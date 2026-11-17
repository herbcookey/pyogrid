// @vitest-environment node
import { describe, it, expect } from "vitest";
import { median, compareToBaseline, perfMarkdown } from "../../tools/perf-check.mjs";

describe("median", () => {
  it("가운데 값 (짝수 개면 가운데 둘의 평균)", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([5])).toBe(5);
  });
});

describe("compareToBaseline", () => {
  const baseline = { tolerance: 1.5, metrics: { initAndSetData: 40, renderMedian: 2, frameP95: 20 } };

  it("기준 × tolerance를 넘은 항목만 regression이다", () => {
    const r = compareToBaseline({ initAndSetData: 61, renderMedian: 2.9, frameP95: 10 }, baseline);
    expect(r.rows).toEqual([
      { metric: "initAndSetData", value: 61, baseline: 40, limit: 60, status: "slower" },
      { metric: "renderMedian", value: 2.9, baseline: 2, limit: 3, status: "ok" },
      { metric: "frameP95", value: 10, baseline: 20, limit: 30, status: "ok" },
    ]);
    expect(r.regressions.map((x) => x.metric)).toEqual(["initAndSetData"]);
  });

  it("기준에 없는 항목은 new, 잰 값에 없는 기준 항목은 missing", () => {
    const r = compareToBaseline({ initAndSetData: 30, extra: 5 }, baseline);
    expect(r.rows.find((x) => x.metric === "extra")).toEqual({ metric: "extra", value: 5, baseline: null, limit: null, status: "new" });
    expect(r.rows.find((x) => x.metric === "renderMedian").status).toBe("missing");
    expect(r.regressions).toEqual([]);
  });

  it("tolerance가 없으면 1.5", () => {
    const r = compareToBaseline({ a: 15.1 }, { metrics: { a: 10 } });
    expect(r.rows[0].limit).toBe(15);
    expect(r.rows[0].status).toBe("slower");
  });
});

describe("perfMarkdown", () => {
  it("표와 함께 느려진 항목을 적는다", () => {
    const r = compareToBaseline({ a: 20, b: 1 }, { tolerance: 1.5, metrics: { a: 10, b: 1 } });
    const md = perfMarkdown(r, { a: 20, b: 1 });
    expect(md).toContain("| Metric | Value (ms) | Baseline (ms) | Limit (ms) | Status |");
    expect(md).toContain("| a | 20 | 10 | 15 | slower |");
    expect(md).toContain("| b | 1 | 1 | 1.5 | ok |");
    // 기준을 바꿀 때 붙여 넣을 값
    expect(md).toContain('"a": 20');
  });
});
