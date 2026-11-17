// 이벤트 달기·떼기
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows } from "./helpers.js";

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

describe("off", () => {
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
