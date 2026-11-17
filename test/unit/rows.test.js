// 행 넣기·빼기·지우기와 저장 뒤 정리
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows } from "./helpers.js";

describe("행 넣기·빼기·지우기", () => {
  // stage5.test.js의 공통 준비
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
    vi.useRealTimers();
  });
  const cols = [
    { key: "team", label: "팀", width: 80 },
    { key: "name", label: "이름", width: 80 },
    { key: "qty", label: "수량", width: 80, editor: { type: "number" } },
  ];
  const data = () => [
    { team: "A", name: "가", qty: 10 },
    { team: "B", name: "나", qty: 20 },
    { team: "A", name: "다", qty: 30 },
    { team: "C", name: "라", qty: 40 },
  ];

  it("addRow first/last/위치, 넣은 행은 __modified__", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(data());
    grid.addRow({ name: "처음" }, "first");
    grid.addRow([{ name: "끝1" }, { name: "끝2" }]);
    grid.addRow({ name: "중간" }, 2);
    expect(grid.getRows().map((r) => r.name)).toEqual(["처음", "가", "중간", "나", "다", "라", "끝1", "끝2"]);
    expect(grid.getModifiedRows().map((r) => r.name)).toEqual(["처음", "중간", "끝1", "끝2"]);
  });

  it("addRow focus: 넣은 행으로 이동", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(data());
    grid.addRow({ name: "새 행" }, "last", { focus: true });
    expect(grid.getRange().active).toEqual({ r: 4, c: 0 });
  });

  it("deleteRows는 getDeletedRows에 남기고 __deleted__, removeRows는 남기지 않는다, setData가 비운다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    const rows = data();
    grid.setData(rows);
    grid.selectRow(1, true);
    grid.selectRow(3, true);
    grid.deleteRows(grid.getSelectedRows());
    expect(grid.getRows().map((r) => r.name)).toEqual(["가", "다"]);
    expect(grid.getDeletedRows()).toEqual([rows[1], rows[3]]);
    expect(rows[1].__deleted__).toBe(true);
    grid.removeRows(0);
    expect(grid.getRows().map((r) => r.name)).toEqual(["다"]);
    expect(grid.getDeletedRows()).toHaveLength(2);
    grid.setData(data());
    expect(grid.getDeletedRows()).toEqual([]);
  });

  it("replaceRow, 정렬 중 넣은 행도 정렬된 자리", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    grid.setData(data());
    grid.setSort([{ key: "qty", dir: "desc" }]);
    grid.addRow({ name: "큰", qty: 99 });
    expect(grid.getRow(0).name).toBe("큰");
    grid.replaceRow(1, { name: "바꿈", qty: 1 });
    expect(grid.getRows().map((r) => r.name)).toEqual(["큰", "다", "나", "가", "바꿈"]);
  });
});

describe("clearDeleted", () => {
  // rows.test.js의 공통 준비
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
