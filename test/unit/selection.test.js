// 행 선택과 셀 범위
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows, rowEl, cellsOf, fire } from "./helpers.js";

describe("행 선택", () => {
  // stage2.test.js의 공통 준비
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
    { key: "id", label: "번호", width: 60 },
    { key: "name", label: "이름", width: 100 },
    { key: "qty", label: "수량", width: 80, sortable: true },
    { key: "memo", label: "메모", width: 80, sortable: false },
  ];

  it("selectRow 반전·지정, 행 객체의 __selected__에 기록", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    const rows = makeRows(3);
    grid.setData(rows);
    expect(grid.selectRow(1)).toBe(true);
    expect(rows[1].__selected__).toBe(true);
    expect(rowEl(grid, 1).classList.contains("pyo-selected")).toBe(true);
    expect(rowEl(grid, 1).getAttribute("aria-selected")).toBe("true");
    expect(grid.selectRow(1)).toBe(false);
    grid.selectRow(0, true);
    grid.selectRow(2, true);
    expect(grid.getSelectedRows()).toEqual([rows[0], rows[2]]);
    expect(grid.getSelectedIndexes()).toEqual([0, 2]);
  });

  it("데이터의 __selected__를 그대로 보여 준다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    grid.setData([{ id: 1, __selected__: true }, { id: 2 }]);
    expect(rowEl(grid, 0).classList.contains("pyo-selected")).toBe(true);
    expect(grid.getSelectedRows().map((r) => r.id)).toEqual([1]);
  });

  it("multipleSelect:false면 하나만 선택된다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true, multipleSelect: false });
    grid.setData(makeRows(3));
    grid.selectRow(0);
    grid.selectRow(2);
    expect(grid.getSelectedIndexes()).toEqual([2]);
    expect(rowEl(grid, 0).classList.contains("pyo-selected")).toBe(false);
  });

  it("__disable_selection__ 행은 선택되지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    grid.setData([{ id: 1, __disable_selection__: true }, { id: 2 }]);
    expect(grid.selectRow(0)).toBe(false);
    grid.selectAll();
    expect(grid.getSelectedRows().map((r) => r.id)).toEqual([2]);
    expect(rowEl(grid, 0).classList.contains("pyo-unselectable")).toBe(true);
  });

  it("selectAll(filter), clearSelection, 헤더 체크박스 상태", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    grid.setData(makeRows(4));
    const box = () => grid.el.headFz.querySelector('[data-special="rowSelector"] .pyo-check');
    grid.selectAll(true, (r) => r.id % 2 === 0);
    expect(grid.getSelectedRows().map((r) => r.id)).toEqual([2, 4]);
    expect(box().classList.contains("pyo-checked")).toBe(false);
    grid.selectAll();
    expect(box().classList.contains("pyo-checked")).toBe(true);
    grid.clearSelection();
    expect(grid.getSelectedRows()).toEqual([]);
    expect(box().getAttribute("aria-checked")).toBe("false");
  });

  it("체크박스 클릭·헤더 체크박스 클릭·Shift+클릭 범위", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    grid.setData(makeRows(6));
    const events = [];
    grid.on("selectionchange", (e) => events.push(e));
    const check = (i) => rowEl(grid, i).querySelector('[data-special="rowSelector"]');
    fire(check(1), "pointerdown");
    expect(grid.getSelectedIndexes()).toEqual([1]);
    expect(events[0]).toMatchObject({ index: 1, selected: true, source: "click", indexes: [1] });
    fire(check(4), "pointerdown", { shiftKey: true });
    expect(grid.getSelectedIndexes()).toEqual([1, 2, 3, 4]);
    grid.el.headFz.querySelector('[data-special="rowSelector"]').click();
    expect(grid.getSelectedIndexes()).toEqual([0, 1, 2, 3, 4, 5]);
    grid.el.headFz.querySelector('[data-special="rowSelector"]').click();
    expect(grid.getSelectedIndexes()).toEqual([]);
  });

  it("정렬해도 선택은 행을 따라간다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true, sortable: true });
    grid.setData(makeRows(3));
    grid.selectRow(0); // id 1
    grid.toggleSort(0); // desc
    expect(grid.getSelectedIndexes()).toEqual([2]);
    expect(rowEl(grid, 2).classList.contains("pyo-selected")).toBe(true);
  });
});

describe("셀 범위 선택·합계", () => {
  // stage2.test.js의 공통 준비
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
    { key: "id", label: "번호", width: 60 },
    { key: "name", label: "이름", width: 100 },
    { key: "qty", label: "수량", width: 80, sortable: true },
    { key: "memo", label: "메모", width: 80, sortable: false },
  ];

  it("setRange / getRange / getRangeCells / 셀 표시", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(5));
    const changes = [];
    grid.on("rangechange", (e) => changes.push(e.range));
    grid.setRange(3, 2, 1, 0);
    expect(grid.getRange()).toEqual({ r0: 1, c0: 0, r1: 3, c1: 2, active: { r: 1, c: 0 } });
    expect(grid.getRangeCells()).toHaveLength(9);
    expect(grid.getRangeCells()[0]).toMatchObject({ rowIndex: 1, colIndex: 0, key: "id", value: 2 });
    expect(cellsOf(grid, 2)[1].classList.contains("pyo-in-range")).toBe(true);
    expect(cellsOf(grid, 2)[3].classList.contains("pyo-in-range")).toBe(false);
    expect(cellsOf(grid, 1)[0].classList.contains("pyo-active")).toBe(true);
    grid.setRange(1, 0, 3, 2); // 같은 범위가 아니다 (anchor가 다름)
    grid.setRange(1, 0, 3, 2);
    expect(changes).toHaveLength(2);
    grid.setRange(99, 99);
    expect(grid.getRange().active).toEqual({ r: 4, c: 3 });
    grid.clearRange();
    expect(grid.getRange()).toBeNull();
    expect(grid.el.body.querySelector(".pyo-in-range")).toBeNull();
  });

  it("범위 표시는 다시 그린 행에도 유지된다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(5));
    grid.setRange(0, 0, 1, 1);
    grid.refresh();
    expect(cellsOf(grid, 1)[1].classList.contains("pyo-in-range")).toBe(true);
  });

  it("셀 누르기 → 범위 시작, Shift+누르기 → 범위 넓히기", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(5));
    fire(cellsOf(grid, 1)[1], "pointerdown");
    fire(grid.el.body, "pointerup");
    expect(grid.getRange()).toMatchObject({ r0: 1, c0: 1, r1: 1, c1: 1 });
    fire(cellsOf(grid, 3)[2], "pointerdown", { shiftKey: true });
    expect(grid.getRange()).toMatchObject({ r0: 1, c0: 1, r1: 3, c1: 2, active: { r: 3, c: 2 } });
  });

  it("합계: 숫자·쉼표 숫자만 더하고 문자는 개수만", async () => {
    vi.useFakeTimers();
    const grid = new PyoGrid(host, { columns: [{ key: "a", formatter: "money" }, { key: "b" }] });
    grid.setData([{ a: 1000, b: "x" }, { a: "1,500", b: null }, { a: "", b: 2.5 }]);
    grid.setRange(0, 0, 2, 1);
    expect(grid.getSelectionSummary()).toEqual({ count: 6, numCount: 3, sum: 2502.5, avg: 2502.5 / 3 });
    vi.advanceTimersByTime(40);
    expect(grid.el.summary.textContent).toBe("6 cells selected · Numbers 3 · Sum 2,502.5 · Average 834.17");
    grid.setRange(0, 0);
    vi.advanceTimersByTime(40);
    expect(grid.el.summary.textContent).toBe("");
  });

  it("click / dblclick 이벤트 내용", () => {
    const grid = new PyoGrid(host, { columns: cols, lineNumber: true });
    const rows = makeRows(3);
    grid.setData(rows);
    const got = [];
    grid.on("click", (e) => got.push(e));
    grid.on("dblclick", (e) => got.push(e));
    cellsOf(grid, 2)[2].click(); // 0번은 줄 번호
    cellsOf(grid, 2)[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(got[0]).toMatchObject({ row: rows[2], item: rows[2], rowIndex: 2, dindex: 2, colIndex: 1, key: "name", value: "행3" });
    expect(got[1]).toMatchObject({ rowIndex: 2, special: "lineNumber" });
  });

  it("setData·정렬은 범위를 지운다", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    grid.setData(makeRows(3));
    grid.setRange(0, 0, 1, 1);
    grid.toggleSort(0);
    expect(grid.getRange()).toBeNull();
    grid.setRange(0, 0);
    grid.setData(makeRows(3));
    expect(grid.getRange()).toBeNull();
  });
});

describe("선택 합계는 코드 글자를 더하지 않는다", () => {
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

  it("number 값과 숫자 컬럼의 숫자 글자만 센다", () => {
    const grid = new PyoGrid(host, {
      columns: [
        { key: "barcode" },                                  // 숫자 글자 코드
        { key: "date" },                                     // "20261113"
        { key: "amt", formatter: "money" },                  // 숫자 컬럼: "1,200"도 숫자
        { key: "qty", editor: { type: "number" } },          // 숫자 컬럼
        { key: "n" },                                        // number 값은 어느 컬럼이든 숫자
        { key: "code", numeric: true },                      // 직접 숫자 컬럼으로 지정
        { key: "price", formatter: "money", numeric: false }, // 직접 제외
      ],
    });
    grid.setData([{ barcode: "8800000010017", date: "20261113", amt: "1,200", qty: "3", n: 5, code: "7", price: 100 }]);
    grid.setRange(0, 0, 0, 6);
    // price는 numeric:false지만 값이 number라 센다
    expect(grid.getSelectionSummary()).toEqual({ count: 7, numCount: 5, sum: 1200 + 3 + 5 + 7 + 100, avg: (1200 + 3 + 5 + 7 + 100) / 5 });
    grid.setRange(0, 0, 0, 1);
    expect(grid.getSelectionSummary().numCount).toBe(0);
  });

  it("그룹 합계 행은 세지 않는다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "g" }, { key: "v" }],
      grouping: { by: ["g"], columns: [{ label: "소계" }, { key: "v", collector: "sum" }] },
    });
    grid.setData([{ g: "A", v: 1 }, { g: "A", v: 2 }]);
    grid.setRange(0, 1, 2, 1);
    expect(grid.getSelectionSummary()).toMatchObject({ count: 3, numCount: 2, sum: 3 });
  });
});

describe("단일 선택은 화면에 없는 행의 선택도 푼다", () => {
  // review-fixes2.test.js의 공통 준비
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

  it("접힌 트리 자식이 선택돼 있으면 다른 행을 고를 때 풀린다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "id", treeControl: true }], rowSelector: true, multipleSelect: false, tree: {},
    });
    const rows = [{ id: "p" }, { id: "c", pid: "p", __selected__: true }, { id: "q" }];
    rows[0].collapse = true; // c는 접혀서 화면에 없다
    grid.setData(rows);
    expect(grid.getViewRows().map((r) => r.id)).toEqual(["p", "q"]);
    const events = [];
    grid.on("selectionchange", (e) => events.push(e));
    grid.selectRow(1); // q
    expect(grid.getSelectedRows().map((r) => r.id)).toEqual(["q"]);
    expect(rows[1].__selected__).toBe(false);
    expect(events[0].changed.map((r) => r.id).sort()).toEqual(["c", "q"]);
    expect(events[0].indexes).toEqual([1]); // 화면에 있는 바뀐 행만
  });

  it("필터로 숨은 행의 선택도 푼다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a" }], rowSelector: true, multipleSelect: false, filter: true });
    const rows = [{ a: "x", __selected__: true }, { a: "y" }];
    grid.setData(rows);
    grid.setFilter("a", ["y"]);
    grid.selectRow(0);
    expect(rows[0].__selected__).toBe(false);
    expect(rows[1].__selected__).toBe(true);
  });
});

describe("Shift+클릭 기준 행은 행 객체로 기억한다", () => {
  // review-fixes2.test.js의 공통 준비
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

  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "n" }], rowSelector: true, sortable: true });
    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({ n }));
    grid.setData(rows);
    const check = (i) => rowEl(grid, i).querySelector('[data-special="rowSelector"]');
    return { grid, rows, check };
  };

  it("정렬 뒤에도 처음 누른 행부터 범위를 잡는다", () => {
    const { grid, check } = setup();
    fire(check(1), "pointerdown"); // n=2
    grid.setSort([{ key: "n", dir: "desc" }]); // 6,5,4,3,2,1 → n=2는 순번 4
    fire(check(2), "pointerdown", { shiftKey: true }); // n=4
    expect(grid.getSelectedRows().map((r) => r.n).sort()).toEqual([2, 3, 4]);
  });

  it("앞에 행을 넣어도 같은 행 기준", () => {
    const { grid, check } = setup();
    fire(check(3), "pointerdown"); // n=4
    grid.addRow([{ n: 0 }, { n: 0.5 }], "first");
    fire(check(1), "pointerdown", { shiftKey: true }); // n=0.5 → 순번 1~5 (0.5,1,2,3,4)
    expect(grid.getSelectedRows().map((r) => r.n)).toEqual([0.5, 1, 2, 3, 4]);
  });

  it("기준 행이 지워지거나 숨으면 Shift+클릭은 그 행만 바꾼다", () => {
    const { grid, rows, check } = setup();
    fire(check(0), "pointerdown"); // n=1
    grid.deleteRows(rows[0]);
    fire(check(3), "pointerdown", { shiftKey: true });
    expect(grid.getSelectedRows().map((r) => r.n)).toEqual([5]);
  });
});

describe("getActiveCell", () => {
  // selection.test.js의 공통 준비
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
  // selection.test.js의 공통 준비
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
