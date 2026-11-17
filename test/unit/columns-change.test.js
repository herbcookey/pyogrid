import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout } from "./helpers.js";

let host;
beforeEach(() => {
  mockLayout();
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  unmockLayout();
});

const rows = () => Array.from({ length: 50 }, (_, i) => ({ owner: "o" + (i % 5), q: 50 - i, n: i }));
const base = () => [{ key: "owner", label: "담당" }, { key: "q", label: "수량" }, { key: "n", label: "번호" }];

describe("컬럼을 바꾸면 없어진 컬럼의 필터·정렬을 지운다", () => {
  it("setColumns: 없는 키의 필터·정렬을 지우고 화면 행을 다시 만든다", () => {
    const grid = new PyoGrid(host, { columns: base(), filter: true, sortable: true });
    grid.setData(rows());
    grid.setFilter("owner", ["o1"]);
    grid.setSort([{ key: "q", dir: "asc" }]);
    expect(grid.getRows()).toHaveLength(10);
    const ev = [];
    grid.on("filterchange", (e) => ev.push(["filter", e]));
    grid.on("sortchange", (e) => ev.push(["sort", e]));
    grid.setColumns([{ key: "n", label: "번호" }]);
    expect(grid.getFilters()).toEqual({});
    expect(grid.getSort()).toEqual([]);
    expect(grid.getRows()).toHaveLength(50);
    expect(grid.getRows()[0].n).toBe(0); // 원래 순서
    expect(ev).toEqual([["filter", { filters: {}, conditions: {}, count: 50 }], ["sort", { sort: [] }]]);
  });

  it("남아 있는 컬럼의 조건은 그대로 둔다", () => {
    const grid = new PyoGrid(host, { columns: base(), filter: true, sortable: true });
    grid.setData(rows());
    grid.setFilter("owner", ["o1"]);
    grid.setSort([{ key: "q", dir: "asc" }, { key: "n", dir: "desc" }]);
    const ev = [];
    grid.on("filterchange", () => ev.push("filter"));
    grid.on("sortchange", (e) => ev.push(e.sort));
    grid.setColumns([{ key: "owner" }, { key: "n" }]);
    expect(grid.getFilters()).toEqual({ owner: ["o1"] });
    expect(grid.getSort()).toEqual([{ key: "n", dir: "desc" }]);
    expect(grid.getRows().map((r) => r.n)).toEqual([46, 41, 36, 31, 26, 21, 16, 11, 6, 1]);
    expect(ev).toEqual([[{ key: "n", dir: "desc" }]]); // 필터는 그대로라 filterchange 없음
  });

  it("removeColumn·updateColumn도 같다, 필터·정렬을 끈 컬럼도 지운다", () => {
    const grid = new PyoGrid(host, { columns: base(), filter: true, sortable: true });
    grid.setData(rows());
    grid.setFilter("owner", ["o1"]);
    grid.setSort([{ key: "q", dir: "asc" }]);
    grid.removeColumn(0);
    expect(grid.getFilters()).toEqual({});
    expect(grid.getRows()).toHaveLength(50);
    grid.updateColumn({ key: "q", label: "수량", sortable: false }, 0);
    expect(grid.getSort()).toEqual([]);
    grid.setFilter("n", ["1"]);
    grid.updateColumn({ key: "n", filter: false }, 1);
    expect(grid.getFilters()).toEqual({});
  });

  it("바뀐 것이 없으면 이벤트도 없다", () => {
    const grid = new PyoGrid(host, { columns: base(), filter: true, sortable: true });
    grid.setData(rows());
    const ev = [];
    grid.on("filterchange", () => ev.push(1));
    grid.on("sortchange", () => ev.push(2));
    grid.addColumn({ key: "x" });
    grid.setColumns(base());
    expect(ev).toEqual([]);
  });
});
