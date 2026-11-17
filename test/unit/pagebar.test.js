// 아래 바: 페이지 이동과 상태 문구
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

describe("setPage", () => {
  it("페이지 정보만 바꾼다: 이동 단추와 상태 문구가 바뀌고, 행·선택·pagechange는 그대로", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = makeRows(50);
    grid.setData(rows, { currentPage: 0, pageSize: 50, totalElements: 120, totalPages: 3 });
    grid.setRange(2, 1);
    const fn = vi.fn();
    grid.on("pagechange", fn);
    expect(grid.setPage({ currentPage: 1, pageSize: 50, totalElements: 1234, totalPages: 25 })).toBe(grid);
    expect(grid.el.status.textContent).toBe("1 - 15 of 50\u00a0 Total 1,234");
    expect(grid.el.nav.querySelector('[data-selected="true"]').textContent).toBe("2");
    expect(grid.getRows()).toEqual(rows);
    expect(grid.getRange()).toMatchObject({ r0: 2, c0: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("null이면 페이지 정보를 지운다: 이동 단추가 없어지고 전체 건수 문구도 빠진다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(30), { currentPage: 0, pageSize: 30, totalElements: 90, totalPages: 3 });
    expect(grid.el.nav.innerHTML).not.toBe("");
    grid.setPage(null);
    expect(grid.el.nav.innerHTML).toBe("");
    expect(grid.el.status.textContent).toBe("1 - 15 of 30");
  });
});
