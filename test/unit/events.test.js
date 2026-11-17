// 이벤트 달기·떼기
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows } from "./helpers.js";

describe("6. 이벤트 핸들러가 예외를 던져도 그리드는 계속한다", () => {
  // review-fixes3.test.js의 공통 준비
  let host;
  beforeEach(() => {
    mockLayout();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    document.querySelectorAll(".pyo-popup").forEach((p) => p.remove());
    unmockLayout();
    vi.restoreAllMocks();
  });

  it("붙여넣기 중 change 핸들러가 실패해도 모든 값이 바뀌고 기록·batchchange가 남는다", () => {
    const reported = [];
    const g = /** @type {any} */ (globalThis);
    const orig = g.reportError;
    g.reportError = (e) => reported.push(e);
    try {
      const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text" } }, { key: "b", editor: { type: "text" } }] });
      const rows = [{ a: "", b: "" }, { a: "", b: "" }];
      grid.setData(rows);
      let after = 0;
      grid.on("change", () => { throw new Error("boom"); });
      grid.on("change", () => after++);
      const batches = [];
      grid.on("batchchange", (e) => batches.push(e.changes.length));
      grid.setRange(0, 0);
      const r = grid.paste("1\t2\n3\t4");
      expect(r.applied).toBe(4);
      expect(rows).toEqual([{ a: "1", b: "2", __modified__: true }, { a: "3", b: "4", __modified__: true }]);
      expect(after).toBe(4);
      expect(batches).toEqual([4]);
      expect(reported).toHaveLength(4);
      expect(grid.canUndo).toBe(true);
      grid.undo();
      expect(rows.map((x) => x.a + x.b)).toEqual(["", ""]);
    } finally {
      g.reportError = orig;
    }
  });

  it("reportError가 없으면 console.error, beforeedit에서 던지면 편집은 막지 않는다", () => {
    const g = /** @type {any} */ (globalThis);
    const orig = g.reportError;
    delete g.reportError;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text" } }] });
      grid.setData([{ a: "x" }]);
      grid.on("beforeedit", () => { throw new Error("bad"); });
      expect(grid.startEdit(0, 0)).toBe(true);
      expect(spy).toHaveBeenCalled();
    } finally {
      g.reportError = orig;
    }
  });
});

describe("off", () => {
  // events.test.js의 공통 준비
  let host;
  beforeEach(() => {
    mockLayout();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    unmockLayout();
  });
  const cols = [{ key: "id" }, { key: "name" }];

  it("핸들러를 주면 그 핸들러만 뗀다 (같은 이벤트의 다른 핸들러, 다른 이벤트는 그대로)", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(3));
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    grid.on("change", a).on("change", b).on("rangechange", other);
    expect(grid.off("change", a)).toBe(grid);
    grid.setValue(0, "name", "x");
    grid.setRange(0, 0);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("핸들러를 주지 않으면 그 이벤트의 핸들러를 모두 뗀다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(3));
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    grid.on("change", a).on("change", b).on("rangechange", other);
    expect(grid.off("change")).toBe(grid);
    grid.setValue(0, "name", "x");
    grid.setRange(0, 0);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("단 적이 없는 핸들러나 이벤트를 떼도 아무 일도 없다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(3));
    const a = vi.fn();
    grid.on("change", a);
    expect(() => grid.off("change", () => {}).off("datachange").off("nothing", a)).not.toThrow();
    grid.setValue(0, "name", "x");
    expect(a).toHaveBeenCalledTimes(1);
  });
});
