// 행 선택과 셀 범위
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows, rowEl } from "./helpers.js";

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

const cols = [
  { key: "id", label: "번호" },
  { key: "name", label: "이름" },
  { key: "qty", label: "수량" },
];

describe("getActiveCell", () => {
  it("범위가 없으면 null", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(5));
    expect(grid.getActiveCell()).toBeNull();
  });

  it("포커스된 셀의 {rowIndex, colIndex, row, column, key, value}", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = makeRows(5);
    grid.setData(rows);
    grid.setRange(1, 0, 3, 2); // active는 (r1, c1) 칸: 끌어서 범위를 넓힌 끝
    expect(grid.getActiveCell()).toEqual({ rowIndex: 3, colIndex: 2, row: rows[3], column: cols[2], key: "qty", value: 3000 });
    grid.setRange(4, 1);
    const cell = grid.getActiveCell();
    expect(cell.row).toBe(rows[4]);
    expect(cell.column).toBe(cols[1]);
    expect(cell.value).toBe("행5");
  });

  it("범위를 지우면 다시 null", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(5));
    grid.setRange(0, 0);
    grid.clearRange();
    expect(grid.getActiveCell()).toBeNull();
  });
});

describe("selectRowRange", () => {
  it("from부터 to까지(순서가 거꾸로여도) 같은 상태로 바꾸고, 바뀐 행만 selectionchange로 알린다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    const rows = makeRows(6);
    rows[2].__selected__ = true;
    grid.setData(rows);
    const events = [];
    grid.on("selectionchange", (e) => events.push(e));
    expect(grid.selectRowRange(4, 1, true)).toBe(true);
    expect(grid.getSelectedIndexes()).toEqual([1, 2, 3, 4]);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("range");
    expect(events[0].selected).toBe(true);
    expect(events[0].indexes).toEqual([1, 3, 4]); // 2는 이미 선택돼 있었다
    expect(events[0].changed).toEqual([rows[1], rows[3], rows[4]]);
    expect(rowEl(grid, 3).classList.contains("pyo-selected")).toBe(true);
  });

  it("false면 범위의 선택을 풀고, 선택할 수 없는 행은 건드리지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    const rows = makeRows(5);
    rows.forEach((r) => (r.__selected__ = true));
    rows[2].__disable_selection__ = true;
    rows[2].__selected__ = false;
    grid.setData(rows);
    expect(grid.selectRowRange(0, 4, false)).toBe(false);
    expect(grid.getSelectedIndexes()).toEqual([]);
    grid.selectRowRange(0, 4, true);
    expect(grid.getSelectedIndexes()).toEqual([0, 1, 3, 4]);
    expect(rows[2].__selected__).toBe(false);
  });

  it("multipleSelect:false면 to 행 하나만 선택한다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true, multipleSelect: false });
    grid.setData(makeRows(5));
    grid.selectRowRange(0, 3, true);
    expect(grid.getSelectedIndexes()).toEqual([3]);
  });
});
