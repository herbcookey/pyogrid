// 값 바꾸기와 수정·추가 표시
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, cellsOf } from "./helpers.js";

describe("setValue·setValues·getModifiedRows", () => {
  // stage3.test.js의 공통 준비
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
  });
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());

  it("API로 바꾼 값도 __modified__와 change", () => {
    const { grid, rows, changes } = setup();
    expect(grid.setValue(0, "ro", "새 값")).toBe(true);
    expect(grid.setValue(0, "ro", "새 값")).toBe(false);
    expect(grid.setValue(0, "name", null)).toBe(true);
    expect(grid.setValue(0, "name", "")).toBe(false); // null과 ""는 같은 값
    expect(changes.map((c) => c.source)).toEqual(["api", "api"]);
    expect(grid.getModifiedRows()).toEqual([rows[0]]);
    const applied = grid.setValues([{ rowIndex: 1, key: "qty", value: 9 }, { rowIndex: 2, key: "qty", value: 3 }], { source: "paste" });
    expect(applied).toHaveLength(1);
    expect(grid.getModifiedRows()).toEqual([rows[0], rows[1]]);
  });

  it("editable:false면 편집기가 모두 꺼진다", () => {
    const grid = new PyoGrid(host, { columns: columns(), editable: false });
    grid.setData(data());
    grid.setRange(1, 0);
    grid.focus();
    key(grid.editing.input, "F2");
    expect(grid.isEditing).toBe(false);
    expect(cellsOf(grid, 0)[5].querySelector(".pyo-cb")).toBeNull();
  });
});

describe("수정 표시", () => {
  // review-fixes.test.js의 공통 준비
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

  const cols = [{ key: "a", editor: { type: "text" } }, { key: "b", editor: { type: "number" } }];

  it("실행 취소로 처음 값으로 돌아오면 __modified__가 풀린다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x", b: 1 }];
    grid.setData(rows);
    grid.setRange(0, 0);
    grid.paste("y\t2");
    expect(rows[0].__modified__).toBe(true);
    grid.undo();
    expect(rows[0]).toEqual({ a: "x", b: 1 });
    expect(grid.getModifiedRows()).toEqual([]);
    grid.redo();
    expect(rows[0].__modified__).toBe(true);
  });

  it("한 셀만 되돌리면 다른 셀이 바뀐 동안은 수정된 행", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x", b: 1 }];
    grid.setData(rows);
    grid.setValue(0, "a", "y");
    grid.setValue(0, "b", 2);
    grid.setValue(0, "a", "x"); // 직접 되돌림
    expect(rows[0].__modified__).toBe(true);
    grid.setValue(0, "b", 1);
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("addRow로 넣은 행·처음부터 표시가 있던 행은 되돌려도 표시가 남는다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x", __modified__: true }];
    grid.setData(rows);
    grid.addRow({ a: "새" });
    grid.setValue(0, "a", "y");
    grid.setValue(0, "a", "x");
    grid.setValue(1, "a", "z");
    grid.setValue(1, "a", "새");
    expect(grid.getModifiedRows()).toHaveLength(2);
  });

  it("필터로 숨은 행도 되돌리면 표시가 풀린다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    const rows = [{ a: "x", b: 1 }, { a: "q", b: 2 }];
    grid.setData(rows);
    grid.setRange(0, 1);
    grid.paste("9");
    grid.setFilter("a", ["q"]);
    grid.undo();
    expect(rows[0].b).toBe(1);
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("clearModified·clearDeleted·acceptChanges", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x" }, { a: "y" }, { a: "z" }];
    grid.setData(rows);
    grid.setValue(0, "a", "1");
    grid.setValue(1, "a", "2");
    grid.deleteRows(2);
    grid.clearModified([rows[0]]);
    expect(grid.getModifiedRows()).toEqual([rows[1]]);
    grid.acceptChanges();
    expect(grid.getModifiedRows()).toEqual([]);
    expect(grid.getDeletedRows()).toEqual([]);
    expect(grid.canUndo).toBe(false);
    // 저장 뒤 값이 기준: 다시 바꾸고 되돌리면 표시가 풀린다
    grid.setValue(0, "a", "3");
    grid.setValue(0, "a", "1");
    expect(rows[0].__modified__).toBeUndefined();
  });
});

describe("4. 추가한 행과 수정한 행을 나눈다", () => {
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
  const cols = [{ key: "team", label: "Team" }, { key: "qty", label: "Qty", editor: { type: "number" } }];

  it("addRow는 __added__를 붙이고, 저장 전에 지우면 삭제 기록에 넣지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const old = { team: "A", qty: 1 };
    grid.setData([old]);
    const neu = { team: "N", qty: 0 };
    grid.addRow(neu);
    expect(neu.__added__).toBe(true);
    expect(grid.getAddedRows()).toEqual([neu]);
    expect(grid.getModifiedRows()).toEqual([neu]);
    grid.setValue(0, "qty", 5);
    expect(grid.getModifiedRows()).toEqual([old, neu]);
    expect(grid.getAddedRows()).toEqual([neu]);
    const events = [];
    grid.on("rowsdelete", (e) => events.push(e.rows));
    grid.deleteRows([neu, old]);
    expect(grid.getDeletedRows()).toEqual([old]);
    expect(events[0]).toEqual([old, neu]);
    expect(grid.getAllRows()).toEqual([]);
  });

  it("addedKey 옵션으로 이름을 바꾼다", () => {
    const grid = new PyoGrid(host, { columns: cols, addedKey: "_new" });
    const neu = {};
    grid.addRow(neu);
    expect(neu._new).toBe(true);
    expect(neu.__added__).toBeUndefined();
  });
});

describe("8. 값을 바꾸는 API가 행 객체도 받는다", () => {
  // review-fixes4.test.js의 공통 준비
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
  });

  it("필터로 숨은 행을 setValue(row)로 바꾸면 change(rowIndex -1)와 합계 행이 갱신된다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "t" }, { key: "q" }],
      filter: true,
      footSum: [[{ key: "q", collector: "sum" }]],
    });
    const a = { t: "A", q: 1 };
    const b = { t: "B", q: 2 };
    grid.setData([a, b]);
    grid.setFilter("t", ["A"]);
    const events = [];
    grid.on("change", (e) => events.push(e));
    expect(grid.setValue(b, "q", 5)).toBe(true);
    expect(b).toMatchObject({ q: 5, __modified__: true });
    expect(events[0]).toMatchObject({ row: b, rowIndex: -1, key: "q", value: 5, oldValue: 2 });
    expect(grid.setValue({ t: "X" }, "q", 1)).toBe(false); // 이 그리드의 행이 아니다
    expect(grid.setValue(a, "q", 3)).toBe(true);
    expect(events[1].rowIndex).toBe(0);
    expect(grid.el.foot.textContent).toContain("3");
  });

  it("접힌 트리 자식도 setValues({row})로 바꾼다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id", treeControl: true }, { key: "v" }], tree: { parentKey: "p" } });
    const root = { id: 1, p: "", v: 0, collapse: true };
    const child = { id: 2, p: 1, v: 0 };
    grid.setData([root, child]);
    expect(grid.getViewRows()).toEqual([root]);
    const batch = [];
    grid.on("batchchange", (e) => batch.push(e.changes));
    const applied = grid.setValues([{ row: child, key: "v", value: 9 }, { rowIndex: 0, key: "v", value: 1 }]);
    expect(applied.map((x) => [x.row, x.rowIndex])).toEqual([[child, -1], [root, 0]]);
    expect(child.v).toBe(9);
    expect(batch).toHaveLength(1);
  });

  it("실행 취소는 숨은 행도 change를 알리고 합계 행을 다시 계산한다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "t", editor: { type: "text" } }, { key: "q", editor: { type: "number" } }],
      filter: true,
      footSum: [[{ key: "q", collector: "sum" }]],
    });
    const rows = [{ t: "A", q: 1 }, { t: "B", q: 2 }];
    grid.setData(rows);
    grid.setRange(0, 1, 1, 1);
    grid.paste("10\n20");
    grid.setFilter("t", ["A"]);
    const events = [];
    grid.on("change", (e) => events.push([e.row.t, e.rowIndex, e.source]));
    grid.undo();
    expect(rows.map((r) => r.q)).toEqual([1, 2]);
    expect(events).toEqual([["B", -1, "undo"], ["A", 0, "undo"]]);
    expect(grid.el.foot.textContent).toContain("1");
  });
});

describe("getChanges·cleanRow: 저장할 때 내부 표시 키를 뺀 복사본", () => {
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
  const cols = [{ key: "id" }, { key: "name", editor: { type: "text" } }];

  it("added·modified·deleted를 나누고, 각 행은 표시 키를 뺀 얕은 복사본이다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    const rows = [
      { id: 1, name: "가", __selected__: true },
      { id: 2, name: "나" },
      { id: 3, name: "다" },
    ];
    grid.setData(rows);
    grid.setValue(rows[0], "name", "가2");
    grid.deleteRows(rows[2]);
    const added = { id: 4, name: "라" };
    grid.addRow(added);
    grid.selectRow(grid.getRows().indexOf(added), true);

    const ch = grid.getChanges();
    expect(ch).toEqual({
      added: [{ id: 4, name: "라" }],
      modified: [{ id: 1, name: "가2" }], // 추가한 행은 modified에 넣지 않는다
      deleted: [{ id: 3, name: "다" }],
    });
    expect(ch.added[0]).not.toBe(added);
    expect(ch.modified[0]).not.toBe(rows[0]);
    // 원본 행은 그대로
    expect(rows[0]).toEqual({ id: 1, name: "가2", __selected__: true, __modified__: true });
    expect(rows[2]).toEqual({ id: 3, name: "다", __deleted__: true });
    expect(added).toEqual({ id: 4, name: "라", __added__: true, __modified__: true, __selected__: true });
  });

  it("빼는 키 이름은 selectedKey·modifiedKey·addedKey·deletedKey 옵션을 따른다", () => {
    const grid = new PyoGrid(host, { columns: cols, selectedKey: "sel", modifiedKey: "mod", addedKey: "add", deletedKey: "del" });
    // 옵션으로 이름을 바꾸면 기본 이름(__selected__ 등)은 그냥 데이터다
    const rows = [
      { id: 1, name: "가", sel: true, __selected__: "data" },
      { id: 2, name: "나", __modified__: "data" },
    ];
    grid.setData(rows);
    grid.setValue(rows[0], "name", "가2");
    grid.deleteRows(rows[1]);
    grid.addRow({ id: 3, name: "다" });
    expect(grid.getChanges()).toEqual({
      added: [{ id: 3, name: "다" }],
      modified: [{ id: 1, name: "가2", __selected__: "data" }],
      deleted: [{ id: 2, name: "나", __modified__: "data" }],
    });
  });

  it("markAddedModified:false여도 추가한 행은 added에만 있다", () => {
    const grid = new PyoGrid(host, { columns: cols, markAddedModified: false });
    grid.setData([{ id: 1, name: "가" }]);
    grid.addRow({ id: 2, name: "나" });
    expect(grid.getChanges()).toEqual({ added: [{ id: 2, name: "나" }], modified: [], deleted: [] });
  });

  it("그 밖의 키(선택 막기 표시, 트리 접힘 상태, 다른 __ 속성)는 그대로 둔다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const row = { id: 1, name: "가", __disable_selection__: true, collapse: true, __note: "x" };
    grid.setData([row]);
    grid.setValue(row, "name", "가2");
    expect(grid.getChanges().modified).toEqual([{ id: 1, name: "가2", __disable_selection__: true, collapse: true, __note: "x" }]);
  });

  it("얕은 복사라 중첩 객체는 원본과 같은 객체다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const row = { id: 1, name: "가", meta: { tags: ["a"] } };
    grid.setData([row]);
    grid.setValue(row, "name", "가2");
    const [copy] = grid.getChanges().modified;
    expect(copy.meta).toBe(row.meta);
  });

  it("바뀐 것이 없으면 빈 배열 셋, 저장(acceptChanges) 뒤에도 비고, 부를 때마다 새 배열이다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ id: 1, name: "가" }];
    grid.setData(rows);
    expect(grid.getChanges()).toEqual({ added: [], modified: [], deleted: [] });
    grid.setValue(rows[0], "name", "가2");
    grid.addRow({ id: 2 });
    grid.acceptChanges();
    expect(grid.getChanges()).toEqual({ added: [], modified: [], deleted: [] });
    expect(grid.getChanges().added).not.toBe(grid.getChanges().added);
  });

  it("저장 전에 넣었다가 지운 행은 어디에도 없다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData([{ id: 1 }]);
    const r = { id: 2 };
    grid.addRow(r);
    grid.deleteRows(r);
    expect(grid.getChanges()).toEqual({ added: [], modified: [], deleted: [] });
  });

  it("cleanRow는 행 하나를 같은 방식으로 복사한다 (그리드에 없는 행도, 원본은 그대로)", () => {
    const grid = new PyoGrid(host, { columns: cols, selectedKey: "sel" });
    const row = { id: 1, name: "가", sel: true, __modified__: true, __added__: true, __deleted__: true, meta: {} };
    const copy = grid.cleanRow(row);
    expect(copy).toEqual({ id: 1, name: "가", meta: {} });
    expect(copy).not.toBe(row);
    expect(copy.meta).toBe(row.meta);
    expect(row.sel).toBe(true);
    expect(row.__modified__).toBe(true);
  });
});