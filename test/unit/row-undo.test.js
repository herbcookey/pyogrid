// 행 추가·삭제·빼기의 실행 취소: addRow·deleteRows·removeRows의 { undoable: true }
// 코드에서 부른 변경은 기본으로 기록하지 않는다 (지금 동작). undoable을 준 호출만 한 묶음으로 기록한다.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout } from "./helpers.js";

let host;
beforeEach(() => {
  mockLayout();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  unmockLayout();
  vi.useRealTimers();
});

const cols = [
  { key: "team", label: "팀" },
  { key: "name", label: "이름" },
  { key: "qty", label: "수량", editor: { type: "number" } },
];
const data = () => [
  { team: "A", name: "가", qty: 10 },
  { team: "B", name: "나", qty: 20 },
  { team: "A", name: "다", qty: 30 },
  { team: "C", name: "라", qty: 40 },
];
const make = (opts = {}) => {
  const grid = new PyoGrid(host, { columns: cols, ...opts });
  grid.setData(opts.rows || data());
  return grid;
};
const names = (list) => list.map((r) => r.name);
const all = (grid) => names(grid.getAllRows());
const shown = (grid) => names(grid.getRows());
const flash = (grid) => grid.el.summary.textContent;
/** 행 이벤트를 모은다: [이름, source, 행 이름들] */
const watch = (grid) => {
  const ev = [];
  for (const n of ["rowsadd", "rowsdelete", "rowsremove"]) grid.on(n, (e) => ev.push([n, e.source, names(e.rows)]));
  return ev;
};
const keysOf = (row) => Object.keys(row).sort();

describe("기록 방식: 호출 옵션 undoable", () => {
  it("기본은 기록하지 않는다 (지금과 같음)", () => {
    const grid = make();
    grid.addRow({ name: "새" });
    grid.deleteRows(0);
    grid.removeRows(0);
    expect(grid.canUndo).toBe(false);
  });

  it("undoable: true면 호출 한 번을 한 묶음으로 기록한다. 그리드 undo: false면 기록하지 않는다", () => {
    const grid = make();
    grid.deleteRows([0, 1], { undoable: true });
    expect(grid.canUndo).toBe(true);
    const off = new PyoGrid(document.body.appendChild(document.createElement("div")), { columns: cols, undo: false });
    off.setData(data());
    off.addRow({ name: "새" }, "last", { undoable: true });
    off.deleteRows(0, { undoable: true });
    expect(off.canUndo).toBe(false);
    off.destroy();
  });

  it("rowsadd·rowsdelete·rowsremove에 source가 늘 있다 (코드에서 부르면 api)", () => {
    const grid = make();
    const ev = watch(grid);
    grid.addRow({ name: "새" });
    grid.deleteRows(0);
    grid.removeRows(0);
    expect(ev).toEqual([
      ["rowsadd", "api", ["새"]],
      ["rowsdelete", "api", ["가"]],
      ["rowsremove", "api", ["나"]],
    ]);
  });
});

describe("삭제를 되돌리기", () => {
  it("원래 자리, 지운 행 목록, 표시 키가 돌아오고 rowsadd(source: undo)를 알린다. 다시 실행하면 다시 지운다", () => {
    const grid = make({ rowSelector: true });
    const rows = grid.getAllRows();
    grid.selectRow(1);
    rows[1].__modified__ = true;
    const before = rows.map(keysOf);
    const ev = watch(grid);
    const undoEv = vi.fn();
    grid.on("undo", undoEv);
    grid.deleteRows([1, 2], { undoable: true });
    expect(all(grid)).toEqual(["가", "라"]);
    expect(names(grid.getDeletedRows())).toEqual(["나", "다"]);

    expect(grid.undo()).toBe(true);
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(grid.getDeletedRows()).toEqual([]);
    expect(rows.map(keysOf)).toEqual(before); // __deleted__가 빠지고 선택·수정 표시는 그대로
    expect(names(grid.getSelectedRows())).toEqual(["나"]);
    expect(undoEv).toHaveBeenCalledWith({ source: "deleteRows", count: 2 });
    expect(flash(grid)).toBe("Undo delete rows: 2 rows");

    expect(grid.redo()).toBe(true);
    expect(all(grid)).toEqual(["가", "라"]);
    expect(names(grid.getDeletedRows())).toEqual(["나", "다"]);
    expect(rows[1].__deleted__).toBe(true);
    expect(flash(grid)).toBe("Redo delete rows: 2 rows");
    expect(ev).toEqual([
      ["rowsdelete", "api", ["나", "다"]],
      ["rowsadd", "undo", ["나", "다"]],
      ["rowsdelete", "redo", ["나", "다"]],
    ]);
  });

  it("추가했다가 지운 행을 되돌리면 다시 추가한 행이다", () => {
    const grid = make();
    const neu = { team: "D", name: "새", qty: 1 };
    grid.addRow(neu);
    grid.deleteRows(neu, { undoable: true });
    expect(grid.getDeletedRows()).toEqual([]);
    grid.undo();
    expect(grid.getAddedRows()).toEqual([neu]);
    expect(grid.getDeletedRows()).toEqual([]);
    expect(grid.getChanges()).toEqual({ added: [{ team: "D", name: "새", qty: 1 }], modified: [], deleted: [] });
    grid.redo();
    expect(grid.getAddedRows()).toEqual([]);
    expect(grid.getDeletedRows()).toEqual([]);
  });

  it("트리: 함께 지운 자손이 같은 자리·같은 부모로 돌아오고, 접힌 노드는 접힌 채다", () => {
    const rows = [
      { id: 1, pid: null, name: "뿌리1" },
      { id: 2, pid: 1, name: "자식", collapse: true },
      { id: 3, pid: 2, name: "손자" },
      { id: 4, pid: null, name: "뿌리2" },
    ];
    const grid = new PyoGrid(host, { columns: [{ key: "name", treeControl: true }], tree: { parentKey: "pid", selfKey: "id" } });
    grid.setData(rows);
    const view = shown(grid);
    grid.deleteRows(rows[0], { undoable: true });
    expect(all(grid)).toEqual(["뿌리2"]);
    expect(names(grid.getDeletedRows())).toEqual(["뿌리1", "자식", "손자"]);
    grid.undo();
    expect(all(grid)).toEqual(["뿌리1", "자식", "손자", "뿌리2"]);
    expect(shown(grid)).toEqual(view);
    expect(grid.getTreeInfo(rows[2]).parent).toBe(rows[1]);
    expect(grid.getDeletedRows()).toEqual([]);
  });

  it("정렬 중이면 정렬된 자리로, 필터에 가린 행은 가린 채로 돌아온다", () => {
    const grid = make({ sortable: true, filter: true });
    grid.setSort([{ key: "qty", dir: "desc" }]);
    const view = shown(grid);
    grid.deleteRows(1, { undoable: true });
    grid.undo();
    expect(shown(grid)).toEqual(view);

    grid.setFilter("team", ["A"]);
    const hidden = grid.getAllRows().find((r) => r.name === "나");
    grid.deleteRows(hidden, { undoable: true });
    grid.undo();
    expect(all(grid)).toContain("나");
    expect(shown(grid)).not.toContain("나");
    expect(grid.getDeletedRows()).toEqual([]);
  });

  it("그룹 소계가 원래대로 돌아온다", () => {
    const grid = make({ grouping: { by: ["team"], columns: [{ label: "소계" }, { key: "name", collector: "count" }, { key: "qty", collector: "sum" }] } });
    const view = () => grid.getViewRows().map((r) => (r.__isGrouping ? "소계:" + r.__groupingList.length : r.name));
    const before = view();
    grid.deleteRows(grid.getAllRows()[0], { undoable: true });
    expect(view()).not.toEqual(before);
    grid.undo();
    expect(view()).toEqual(before);
  });

  it("셀 범위를 돌아온 첫 행으로 옮기고 그 행으로 스크롤한다 (열은 지금 활성 칸의 열)", () => {
    const grid = make();
    grid.setRange(0, 2);
    grid.deleteRows([1, 2], { undoable: true });
    const spy = vi.spyOn(grid, "scrollToCell");
    grid.undo();
    expect(grid.getRange()).toEqual({ r0: 1, c0: 2, r1: 1, c1: 2, active: { r: 1, c: 2 } });
    expect(spy).toHaveBeenCalledWith(1, 2);
  });

  it("선택된 행이 돌아오거나 빠지면 selectionchange(source: undo·redo)를 알린다", () => {
    const grid = make({ rowSelector: true });
    grid.selectRow(1);
    const fn = vi.fn();
    grid.on("selectionchange", fn);
    grid.deleteRows([1, 2], { undoable: true });
    expect(fn).not.toHaveBeenCalled(); // 지금 동작 그대로
    grid.undo();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toMatchObject({ source: "undo", selected: true, changed: [grid.getAllRows()[1]], indexes: [1] });
    grid.redo();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toMatchObject({ source: "redo", selected: false, indexes: [] });
  });
});

describe("추가를 되돌리기", () => {
  it("행이 빠지고 rowsremove(source: undo), 다시 실행하면 같은 자리로 돌아오고 rowsadd(source: redo)", () => {
    const grid = make();
    const ev = watch(grid);
    const x = { team: "X", name: "엑스", qty: 1 };
    const y = { team: "Y", name: "와이", qty: 2 };
    grid.addRow([x, y], 1, { undoable: true });
    expect(all(grid)).toEqual(["가", "엑스", "와이", "나", "다", "라"]);
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(grid.getChanges()).toEqual({ added: [], modified: [], deleted: [] });
    expect(flash(grid)).toBe("Undo add rows: 2 rows");
    grid.redo();
    expect(all(grid)).toEqual(["가", "엑스", "와이", "나", "다", "라"]);
    expect(grid.getAddedRows()).toEqual([x, y]);
    expect(grid.getRange().active).toEqual({ r: 1, c: 0 });
    expect(ev).toEqual([
      ["rowsadd", "api", ["엑스", "와이"]],
      ["rowsremove", "undo", ["엑스", "와이"]],
      ["rowsadd", "redo", ["엑스", "와이"]],
    ]);
  });

  it("removeRows도 되돌리면 같은 자리로 돌아오고 표시 키는 건드리지 않는다", () => {
    const grid = make();
    const ev = watch(grid);
    grid.removeRows([0, 3], { undoable: true });
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(grid.getDeletedRows()).toEqual([]);
    expect(grid.getAllRows().every((r) => !r.__deleted__ && !r.__added__)).toBe(true);
    grid.redo();
    expect(all(grid)).toEqual(["나", "다"]);
    expect(ev.map((e) => e.slice(0, 2))).toEqual([
      ["rowsremove", "api"],
      ["rowsadd", "undo"],
      ["rowsremove", "redo"],
    ]);
  });
});

describe("셀 편집 기록과 섞였을 때의 순서", () => {
  it("편집 → 삭제 → 되돌리기 두 번: 편집한 값으로 행이 돌아온 뒤 편집이 되돌아간다", () => {
    const grid = make();
    const row = grid.getAllRows()[1];
    grid.setRange(1, 2);
    grid.paste("99");
    grid.deleteRows(1, { undoable: true });
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(row.qty).toBe(99);
    expect(row.__modified__).toBe(true);
    grid.undo();
    expect(row.qty).toBe(20);
    expect(row.__modified__).toBeUndefined();
    expect(grid.canUndo).toBe(false);
    expect(grid.getChanges()).toEqual({ added: [], modified: [], deleted: [] });
  });

  it("추가 → 편집 → 되돌리기 두 번 → 다시 실행 두 번", () => {
    const grid = make();
    const x = { team: "X", name: "엑스", qty: 1 };
    grid.addRow(x, "last", { undoable: true });
    grid.setRange(4, 2);
    grid.paste("5");
    expect(x.qty).toBe(5);
    grid.undo();
    expect(x.qty).toBe(1);
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    grid.redo();
    expect(all(grid)).toEqual(["가", "나", "다", "라", "엑스"]);
    expect(x.qty).toBe(1);
    grid.redo();
    expect(x.qty).toBe(5);
    expect(grid.getChanges().added).toEqual([{ team: "X", name: "엑스", qty: 5 }]);
    expect(grid.canRedo).toBe(false);
  });

  it("기록 없이 지운 행의 셀 편집을 되돌리면 값만 행 객체에 써 넣는다 (지금 동작)", () => {
    const grid = make();
    const row = grid.getAllRows()[1];
    grid.setRange(1, 2);
    grid.paste("99");
    grid.deleteRows(1); // 기록 없음
    const change = vi.fn();
    grid.on("change", change);
    expect(grid.undo()).toBe(true);
    expect(row.qty).toBe(20);
    expect(row.__modified__).toBeUndefined();
    expect(all(grid)).toEqual(["가", "다", "라"]);
    expect(grid.getDeletedRows()).toEqual([row]);
    expect(grid.getChanges().deleted).toEqual([{ team: "B", name: "나", qty: 20 }]);
    expect(change).not.toHaveBeenCalled();
    expect(flash(grid)).toBe("Undo paste: 1 cell");
  });
});

describe("기록한 작업과 기록하지 않은 작업이 섞일 때: 기대한 상태가 아닌 행은 건너뛴다", () => {
  it("기록하며 추가 → 기록 없이 removeRows → 되돌리기 → 다시 실행: 앱이 뺀 행을 되살리지 않는다", () => {
    const grid = make();
    const x = { name: "엑스" };
    grid.addRow(x, "last", { undoable: true });
    grid.removeRows(x);
    const ev = watch(grid);
    expect(grid.undo()).toBe(true);
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(flash(grid)).toBe("Undo add rows: 0 rows");
    expect(grid.redo()).toBe(true);
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(ev).toEqual([]);
  });

  it("기록하며 삭제 → 기록 없이 같은 행을 addRow → 되돌리기: 같은 행을 두 번 넣지 않는다", () => {
    const grid = make();
    const row = grid.getAllRows()[1];
    grid.deleteRows(row, { undoable: true });
    grid.addRow(row, 0);
    const ev = watch(grid);
    grid.undo();
    expect(all(grid)).toEqual(["나", "가", "다", "라"]);
    expect(grid.getAllRows().filter((r) => r === row)).toHaveLength(1);
    expect(ev).toEqual([]);
    grid.redo(); // 되돌리기에서 건너뛴 행은 다시 실행에서도 건너뛴다
    expect(all(grid)).toEqual(["나", "가", "다", "라"]);
  });

  it("여러 행 중 일부만 기대한 상태면 그 행만 처리한다", () => {
    const grid = make();
    const [a, b] = grid.getAllRows();
    grid.deleteRows([a, b], { undoable: true });
    grid.addRow(a, "last"); // 앱이 a만 다시 넣었다
    const ev = watch(grid);
    grid.undo();
    expect(all(grid)).toEqual(["나", "다", "라", "가"]);
    expect(ev).toEqual([["rowsadd", "undo", ["나"]]]);
    expect(flash(grid)).toBe("Undo delete rows: 1 row");
  });

  it("자리 기준 행이 없어졌으면 기록한 순번 자리로 돌아온다", () => {
    const grid = make();
    const rows = grid.getAllRows();
    grid.deleteRows(rows[1], { undoable: true }); // 기준(바로 뒤 행)은 다
    grid.removeRows(rows[2]); // 기록 없이 기준 행을 뺀다
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "라"]);
  });
});

describe("저장 처리(clearModified·clearDeleted) 뒤의 되돌리기와 왕복", () => {
  const state = (grid, row) => ({ rows: all(grid), changes: grid.getChanges(), keys: keysOf(row), deleted: grid.getDeletedRows().length });

  it("추가 → clearModified → 되돌리기: 저장된 행이므로 지운 행이 된다. 다시 실행하면 clearModified 직후와 같다", () => {
    const grid = make();
    const x = { team: "X", name: "엑스", qty: 1 };
    grid.addRow(x, "last", { undoable: true });
    grid.clearModified();
    const saved = state(grid, x);
    expect(saved.changes).toEqual({ added: [], modified: [], deleted: [] });
    const ev = watch(grid);
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(grid.getChanges()).toEqual({ added: [], modified: [], deleted: [{ team: "X", name: "엑스", qty: 1 }] });
    expect(x.__deleted__).toBe(true);
    grid.redo();
    expect(state(grid, x)).toEqual(saved);
    expect(ev).toEqual([
      ["rowsdelete", "undo", ["엑스"]],
      ["rowsadd", "redo", ["엑스"]],
    ]);
  });

  it("삭제 → clearDeleted → 되돌리기: 처리된 삭제이므로 추가한 행으로 돌아온다. 다시 실행하면 clearDeleted 직후와 같다", () => {
    const grid = make();
    const row = grid.getAllRows()[1];
    grid.deleteRows(row, { undoable: true });
    grid.clearDeleted();
    const saved = state(grid, row);
    expect(saved.changes).toEqual({ added: [], modified: [], deleted: [] });
    const ev = watch(grid);
    grid.undo();
    expect(all(grid)).toEqual(["가", "나", "다", "라"]);
    expect(grid.getChanges()).toEqual({ added: [{ team: "B", name: "나", qty: 20 }], modified: [], deleted: [] });
    expect(row.__added__).toBe(true);
    expect(row.__deleted__).toBeUndefined();
    grid.redo();
    expect(state(grid, row)).toEqual(saved);
    expect(ev).toEqual([
      ["rowsadd", "undo", ["나"]],
      ["rowsdelete", "redo", ["나"]],
    ]);
  });
});

describe("기록 한도와 지우기", () => {
  it("undoLimit: 행 작업 하나는 행 수와 관계없이 1개로 센다", () => {
    const grid = make({ undoLimit: 2 });
    grid.deleteRows([0, 1, 2], { undoable: true });
    grid.addRow({ name: "x" }, "last", { undoable: true });
    grid.addRow({ name: "y" }, "last", { undoable: true });
    grid.undo();
    grid.undo();
    expect(grid.canUndo).toBe(false);
    expect(all(grid)).toEqual(["라"]);
  });

  it("acceptChanges·setData는 행 기록도 지운다", () => {
    const grid = make();
    grid.deleteRows(0, { undoable: true });
    grid.acceptChanges();
    expect(grid.canUndo).toBe(false);
    grid.addRow({ name: "x" }, "last", { undoable: true });
    grid.setData(data());
    expect(grid.canUndo).toBe(false);
    expect(grid.canRedo).toBe(false);
  });

  it("한국어 문구", () => {
    const grid = make({ locale: "ko" });
    grid.deleteRows([0, 1], { undoable: true });
    grid.undo();
    expect(flash(grid)).toBe("실행 취소: 행 삭제 2행");
    grid.redo();
    expect(flash(grid)).toBe("다시 실행: 행 삭제 2행");
    grid.addRow({ name: "x" }, "last", { undoable: true });
    grid.undo();
    expect(flash(grid)).toBe("실행 취소: 행 추가 1행");
    grid.removeRows(0, { undoable: true });
    grid.undo();
    expect(flash(grid)).toBe("실행 취소: 행 빼기 1행");
  });
});
