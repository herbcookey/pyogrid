import { describe, it, expect } from "vitest";
import { buildColumnModel, computeWidths, parseWidth } from "../../src/core/columns.js";

describe("buildColumnModel", () => {
  const defs = [
    { key: "a", label: "A" },
    { label: "G1", columns: [{ key: "b", label: "B" }, { label: "G2", columns: [{ key: "c", label: "C" }, { key: "d", label: "D" }] }] },
    { key: "e", label: "E", hidden: true },
    { label: "빈 묶음", columns: [] },
    { key: "f", label: "F" },
  ];
  const m = buildColumnModel(defs);

  it("잎 컬럼을 왼쪽부터 순서대로 모은다 (hidden, 빈 묶음 제외)", () => {
    expect(m.leaves.map((l) => l.key)).toEqual(["a", "b", "c", "d", "f"]);
    expect(m.leaves.map((l) => l.index)).toEqual([0, 1, 2, 3, 4]);
  });
  it("헤더 깊이와 칸의 colSpan·rowSpan", () => {
    expect(m.depth).toBe(3);
    const byLabel = Object.fromEntries(m.header.map((c) => [c.label, c]));
    expect(byLabel.A).toMatchObject({ row: 0, rowSpan: 3, colStart: 0, colSpan: 1 });
    expect(byLabel.G1).toMatchObject({ row: 0, rowSpan: 1, colStart: 1, colSpan: 3 });
    expect(byLabel.B).toMatchObject({ row: 1, rowSpan: 2, colStart: 1, colSpan: 1 });
    expect(byLabel.G2).toMatchObject({ row: 1, rowSpan: 1, colStart: 2, colSpan: 2 });
    expect(byLabel.C).toMatchObject({ row: 2, rowSpan: 1, colStart: 2 });
    expect(byLabel.F).toMatchObject({ row: 0, rowSpan: 3, colStart: 4 });
    expect(byLabel["빈 묶음"]).toBeUndefined();
  });
  it("묶음이 여러 개여도 colSpan을 정확히 센다", () => {
    const mm = buildColumnModel([
      { label: "X", columns: [{ label: "X1", columns: [{ key: "a" }, { key: "b" }] }, { label: "X2", columns: [{ key: "c" }] }] },
    ]);
    expect(mm.header.find((c) => c.label === "X").colSpan).toBe(3);
  });
});

describe("parseWidth / computeWidths", () => {
  it("parseWidth", () => {
    expect(parseWidth(80)).toEqual({ type: "px", value: 80 });
    expect(parseWidth("120")).toEqual({ type: "px", value: 120 });
    expect(parseWidth("50px")).toEqual({ type: "px", value: 50 });
    expect(parseWidth("*")).toEqual({ type: "auto", value: 0 });
    expect(parseWidth("30%")).toEqual({ type: "pct", value: 30 });
    expect(parseWidth(undefined)).toBeNull();
    expect(parseWidth("abc")).toBeNull();
  });
  const leaves = (widths) => widths.map((w, i) => ({ def: { width: w }, index: i, level: 0 }));
  it("고정·문자열·기본값(100)", () => {
    expect(computeWidths(leaves([80, "120", undefined]), 1000)).toEqual([80, 120, 100]);
    expect(computeWidths(leaves([undefined]), 1000, { defaultWidth: 70 })).toEqual([70]);
  });
  it("%는 사용 가능 너비 기준", () => {
    expect(computeWidths(leaves(["10%", "25%"]), 1000)).toEqual([100, 250]);
  });
  it('"*"는 남은 너비를 나누고 나머지 픽셀은 마지막이 가져간다', () => {
    expect(computeWidths(leaves([100, "*", "*"]), 401)).toEqual([100, 150, 151]);
  });
  it('"*" 최소 너비', () => {
    expect(computeWidths(leaves([500, "*"]), 300)).toEqual([500, 20]);
  });
  it("사용자 조절 너비가 우선", () => {
    expect(computeWidths(leaves([100, "*"]), 500, { override: { 0: 200 } })).toEqual([200, 300]);
  });
});
