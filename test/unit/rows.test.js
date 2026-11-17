// 행 넣기·빼기·지우기와 저장 뒤 정리
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("clearDeleted", () => {
  it("지운 행 목록만 비운다: 행은 돌아오지 않고, 수정 표시·실행 취소 기록은 그대로", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "name", editor: { type: "text" } }] });
    const rows = makeRows(4);
    grid.setData(rows);
    grid.setRange(1, 1);
    grid.paste("고침");
    grid.deleteRows([rows[0], rows[3]]);
    expect(grid.getDeletedRows()).toEqual([rows[0], rows[3]]);
    expect(grid.clearDeleted()).toBe(grid);
    expect(grid.getDeletedRows()).toEqual([]);
    expect(grid.getAllRows()).toEqual([rows[1], rows[2]]);
    expect(grid.getModifiedRows()).toEqual([rows[1]]);
    expect(grid.canUndo).toBe(true);
  });

  it("비운 뒤에 지운 행은 다시 기록된다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = makeRows(3);
    grid.setData(rows);
    grid.deleteRows(0);
    grid.clearDeleted();
    grid.deleteRows(0);
    expect(grid.getDeletedRows()).toEqual([rows[1]]);
  });
});
