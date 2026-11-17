// 컬럼 순서 바꾸기: moveColumn·getColumnOrder·setColumnOrder, columnReorder 옵션(끌기·키보드), 합계 칸 조각, 기억하기
// 정의(options.columns, 그룹 정의, footSum, grouping.columns)는 바꾸지 않고, 순서는 따로 든 상태다.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, fire } from "./helpers.js";

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

const keys = (grid) => grid.leaves.map((l) => l.key);
const flat = () => [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }, { key: "d", label: "D" }];
const nested = () => [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { label: "G", columns: [{ key: "g1", label: "G1" }, { key: "g2", label: "G2" }, { key: "g3", label: "G3" }] },
  { key: "c", label: "C" },
];
const data = () => [
  { a: 1, b: 2, c: 3, d: 4, g1: 5, g2: 6, g3: 7 },
  { a: 10, b: 20, c: 30, d: 40, g1: 50, g2: 60, g3: 70 },
];
const make = (columns, opts = {}) => {
  const grid = new PyoGrid(host, { columns, ...opts });
  grid.setData(data());
  return grid;
};

describe("moveColumn: 정의는 그대로, 순서만 바뀐다", () => {
  it("잎 번호·key·정의 객체로 옮긴다. getColumns()는 받은 배열을 그대로 돌려주고 정의는 바뀌지 않는다", () => {
    const columns = nested();
    const before = JSON.stringify(columns);
    const groupCols = columns[2].columns;
    const grid = make(columns);
    expect(grid.moveColumn(0, 1)).toBe(true); // a를 b 뒤로
    expect(keys(grid)).toEqual(["b", "a", "g1", "g2", "g3", "c"]);
    expect(grid.moveColumn("c", 0)).toBe(true);
    expect(keys(grid)).toEqual(["c", "b", "a", "g1", "g2", "g3"]);
    expect(grid.moveColumn(columns[2], 0)).toBe(true); // 그룹 통째로
    expect(keys(grid)).toEqual(["g1", "g2", "g3", "c", "b", "a"]);
    expect(grid.getColumnOrder()).toEqual(["g1", "g2", "g3", "c", "b", "a"]);
    expect(grid.getColumns()).toBe(columns);
    expect(columns[2].columns).toBe(groupCols);
    expect(JSON.stringify(columns)).toBe(before);
  });

  it("헤더도 지금 순서로 그린다 (그룹 칸의 시작 위치)", () => {
    const columns = nested();
    const grid = make(columns);
    grid.moveColumn(columns[2], 0);
    const group = grid.headerCells.find((h) => h.def === columns[2]);
    expect(group.colStart).toBe(0);
    expect(group.colSpan).toBe(3);
    const labels = [...grid.el.head.querySelectorAll(".pyo-hcell[data-leaf]")]
      .sort((x, y) => Number(x.dataset.leaf) - Number(y.dataset.leaf))
      .map((el) => el.dataset.key);
    expect(labels).toEqual(["g1", "g2", "g3", "a", "b", "c"]);
  });

  it("잎은 같은 그룹 안에서만, 그룹은 같은 부모 안에서만 옮긴다", () => {
    const columns = nested();
    const grid = make(columns);
    expect(grid.moveColumn("g3", 2)).toBe(true);
    expect(keys(grid)).toEqual(["a", "b", "g3", "g1", "g2", "c"]);
    expect(grid.moveColumn("g1", 0)).toBe(false); // 그룹 밖으로
    expect(grid.moveColumn("g1", 5)).toBe(false);
    expect(grid.moveColumn("a", 3)).toBe(false); // 그룹 한가운데로
    expect(grid.moveColumn("a", 4)).toBe(true); // 그룹 뒤로 (a의 첫 잎이 4번)
    expect(keys(grid)).toEqual(["b", "g3", "g1", "g2", "a", "c"]);
  });

  it("옮길 곳이 지금 자리이거나 없는 컬럼·범위 밖이면 false이고 아무것도 바꾸지 않는다", () => {
    const grid = make(flat());
    const fn = vi.fn();
    grid.on("columnmove", fn);
    expect(grid.moveColumn(1, 1)).toBe(false);
    expect(grid.moveColumn("nope", 0)).toBe(false);
    expect(grid.moveColumn(9, 0)).toBe(false);
    expect(grid.moveColumn(0, 9)).toBe(false);
    expect(grid.moveColumn(0, -1)).toBe(false);
    expect(grid.moveColumn({ key: "a" }, 1)).toBe(false); // 같은 key라도 그리드의 정의 객체가 아니다
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("columnmove: {column, from, to, order}", () => {
    const columns = flat();
    const grid = make(columns);
    const fn = vi.fn();
    grid.on("columnmove", fn);
    grid.moveColumn("a", 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ column: columns[0], from: 0, to: 2, order: ["b", "c", "a", "d"] });
  });

  it("columnReorder 옵션이 꺼져 있어도(기본) 메서드는 동작한다", () => {
    const grid = make(flat());
    expect(grid.options.columnReorder).toBe(false);
    expect(grid.moveColumn("d", 0)).toBe(true);
    expect(keys(grid)).toEqual(["d", "a", "b", "c"]);
  });

  it("셀 값 실행 취소 대상이 아니다", () => {
    const grid = make(flat(), { undo: true });
    grid.moveColumn("a", 3);
    expect(grid.canUndo).toBe(false);
    expect(grid.undo()).toBe(false);
    expect(keys(grid)).toEqual(["b", "c", "d", "a"]);
  });
});

describe("옮길 수 없는 컬럼과 고정 경계", () => {
  it("reorderable: false는 옮길 수 없고 제자리에 남는다. 다른 컬럼은 그 자리를 건너뛴다", () => {
    const columns = flat();
    columns[1].reorderable = false;
    const grid = make(columns);
    expect(grid.moveColumn("b", 0)).toBe(false);
    expect(grid.moveColumn("a", 1)).toBe(false); // b 자리
    expect(grid.moveColumn("a", 2)).toBe(true);
    expect(keys(grid)).toEqual(["c", "b", "a", "d"]);
  });

  it("그룹의 reorderable: false는 그룹을 고정하고, 그룹 안의 잎은 옮길 수 있다", () => {
    const columns = nested();
    columns[2].reorderable = false;
    const grid = make(columns);
    expect(grid.moveColumn(columns[2], 0)).toBe(false);
    expect(grid.moveColumn("g1", 4)).toBe(true);
    expect(keys(grid)).toEqual(["a", "b", "g2", "g3", "g1", "c"]);
  });

  it("key가 없는 컬럼은 옮길 수 없고 제자리에 남으며, getColumnOrder()에 나오지 않는다", () => {
    const columns = [{ key: "a" }, { label: "계산", formatter: () => "x" }, { key: "c" }, { key: "d" }];
    const grid = make(columns);
    expect(grid.moveColumn(1, 0)).toBe(false);
    expect(grid.moveColumn(columns[1], 0)).toBe(false);
    expect(grid.moveColumn("a", 2)).toBe(true);
    expect(grid.leaves.map((l) => l.def)).toEqual([columns[2], columns[1], columns[0], columns[3]]);
    expect(grid.getColumnOrder()).toEqual(["c", "a", "d"]);
  });

  it("고정 경계는 넘지 못한다 (메서드)", () => {
    const grid = make(flat(), { frozenColumns: 2 });
    expect(grid.moveColumn("a", 1)).toBe(true);
    expect(keys(grid)).toEqual(["b", "a", "c", "d"]);
    expect(grid.moveColumn("a", 2)).toBe(false);
    expect(grid.moveColumn("c", 1)).toBe(false);
    expect(grid.moveColumn("d", 2)).toBe(true);
    expect(keys(grid)).toEqual(["b", "a", "d", "c"]);
  });

  it("고정 경계를 걸친 그룹은 옮길 수 없고, 그룹 안에서도 경계를 넘지 못한다", () => {
    const columns = nested();
    const grid = make(columns, { frozenColumns: 3 }); // a, b, g1 고정
    expect(grid.moveColumn(columns[2], 0)).toBe(false);
    expect(grid.moveColumn("g1", 3)).toBe(false);
    expect(grid.moveColumn("g3", 3)).toBe(true);
    expect(keys(grid)).toEqual(["a", "b", "g1", "g3", "g2", "c"]);
  });
});

describe("숨긴 컬럼이 섞여 있을 때", () => {
  it("번호는 보이는 잎 기준이고, 숨긴 컬럼을 다시 보이면 옮긴 순서 안의 자기 자리로 돌아온다", () => {
    const columns = [{ key: "a" }, { key: "b", hidden: true }, { key: "c" }, { key: "d" }];
    const grid = make(columns);
    expect(keys(grid)).toEqual(["a", "c", "d"]);
    expect(grid.moveColumn("d", 0)).toBe(true);
    expect(keys(grid)).toEqual(["d", "a", "c"]);
    expect(grid.getColumnOrder()).toEqual(["d", "a", "c"]);
    grid.updateColumn({ key: "b" }, 1); // 숨김을 푼다
    expect(keys(grid)).toEqual(["d", "a", "b", "c"]);
  });

  it("그룹 안의 숨긴 잎", () => {
    const columns = nested();
    columns[2].columns[1].hidden = true; // g2
    const grid = make(columns);
    expect(keys(grid)).toEqual(["a", "b", "g1", "g3", "c"]);
    expect(grid.moveColumn("g3", 2)).toBe(true);
    expect(keys(grid)).toEqual(["a", "b", "g3", "g1", "c"]);
    expect(grid.moveColumn(columns[2], 0)).toBe(true);
    expect(keys(grid)).toEqual(["g3", "g1", "a", "b", "c"]);
  });
});

describe("getColumnOrder·setColumnOrder", () => {
  it("목록에 있는 컬럼은 그 순서로, 없는 컬럼은 원래 자리에 둔다. 모르는 key는 무시한다", () => {
    const grid = make(flat());
    expect(grid.setColumnOrder(["d", "nope", "a"])).toBe(true);
    expect(keys(grid)).toEqual(["d", "b", "c", "a"]);
    expect(grid.setColumnOrder(["c", "b", "a", "d"])).toBe(true);
    expect(grid.getColumnOrder()).toEqual(["c", "b", "a", "d"]);
  });

  it("null이면 정의 순서로 돌아간다", () => {
    const grid = make(nested());
    grid.moveColumn("c", 0);
    grid.moveColumn("g3", 3);
    expect(grid.setColumnOrder(null)).toBe(true);
    expect(keys(grid)).toEqual(["a", "b", "g1", "g2", "g3", "c"]);
  });

  it("다단 헤더: 그룹은 안의 잎이 목록에 처음 나오는 자리로 옮긴다", () => {
    const grid = make(nested());
    grid.setColumnOrder(["g2", "c", "g1", "a", "b"]);
    expect(keys(grid)).toEqual(["g2", "g1", "g3", "c", "a", "b"]);
  });

  it("고정 경계를 넘는 순서는 false이고 바꾸지 않는다", () => {
    const grid = make(flat(), { frozenColumns: 1 });
    expect(grid.setColumnOrder(["b", "a"])).toBe(false);
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(grid.setColumnOrder(["a", "d", "c", "b"])).toBe(true);
    expect(keys(grid)).toEqual(["a", "d", "c", "b"]);
  });

  it("화면 순서가 바뀌면 columnmove를 {column: null, from: -1, to: -1, order}로 알린다", () => {
    const grid = make(flat());
    const fn = vi.fn();
    grid.on("columnmove", fn);
    grid.setColumnOrder(["a", "b"]); // 그대로
    expect(fn).not.toHaveBeenCalled();
    grid.setColumnOrder(["b", "a"]);
    expect(fn).toHaveBeenCalledWith({ column: null, from: -1, to: -1, order: ["b", "a", "c", "d"] });
  });
});

describe("컬럼 정의를 바꾸는 메서드와 순서", () => {
  it("setColumns는 순서를 지운다", () => {
    const columns = flat();
    const grid = make(columns);
    grid.moveColumn("a", 3);
    grid.setColumns(columns);
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(grid.getColumns()).toBe(columns);
  });

  it("addColumn·removeColumn·updateColumn은 순서를 유지하고, 새 컬럼은 정의 자리를 따른다", () => {
    const grid = make(flat());
    grid.moveColumn("d", 0);
    expect(keys(grid)).toEqual(["d", "a", "b", "c"]);
    grid.addColumn({ key: "e" }, 1); // 정의: a e b c d
    expect(keys(grid)).toEqual(["d", "e", "a", "b", "c"]);
    grid.removeColumn(0); // a를 뺀다
    expect(keys(grid)).toEqual(["d", "e", "b", "c"]);
    grid.updateColumn({ key: "b", label: "B2" }, 1);
    expect(keys(grid)).toEqual(["d", "e", "b", "c"]);
    expect(grid.leaves[2].def.label).toBe("B2");
  });
});

describe("컬럼을 따라가는 것", () => {
  it("정렬·필터·조건·사용자가 조절한 너비", () => {
    const grid = make(flat(), { sortable: true, filter: true });
    grid.setSort([{ key: "b", dir: "desc" }]);
    grid.setFilter("b", [2, 20]);
    grid.setFilterCondition("c", { type: "number", op: "ge", value: 0 });
    grid.setColumnWidth(1, 150);
    const filters = grid.getFilters();
    const conds = grid.getFilterConditions();
    const rows = grid.getRows();
    grid.moveColumn("b", 3);
    expect(grid.getSort()).toEqual([{ key: "b", dir: "desc" }]);
    expect(grid.getFilters()).toEqual(filters);
    expect(grid.getFilterConditions()).toEqual(conds);
    expect(grid.getRows()).toEqual(rows);
    expect(grid.getColumnWidths()[3]).toBe(150);
    expect(grid.getColumnWidths()[1]).not.toBe(150);
    const head = grid.el.head.querySelector('.pyo-hcell[data-key="b"]');
    expect(head.dataset.leaf).toBe("3");
    expect(head.dataset.sort).toBe("desc");
    expect(head.querySelector(".pyo-filter-btn").classList.contains("pyo-filter-on")).toBe(true);
    expect(grid.el.head.querySelector('.pyo-hcell[data-key="c"] .pyo-filter-btn').classList.contains("pyo-filter-on")).toBe(true);
  });

  it("활성 칸은 자기 컬럼을 따라가고, 범위는 활성 칸 하나로 줄어든다", () => {
    const grid = make(flat());
    grid.setRange(0, 0, 1, 1); // 활성 칸 (1, 1) = b
    grid.moveColumn("b", 3);
    expect(grid.getRange()).toEqual({ r0: 1, c0: 3, r1: 1, c1: 3, active: { r: 1, c: 3 } });
  });

  it("편집 중이면 확정한 뒤 옮긴다. 필터 팝업은 닫는다", () => {
    const grid = make([{ key: "a", editor: { type: "text" } }, { key: "b" }, { key: "c" }], { filter: true });
    grid.startEdit(0, 0);
    grid.editing.input.value = "새 값";
    grid.moveColumn("a", 2);
    expect(grid.isEditing).toBe(false);
    expect(grid.getAllRows()[0].a).toBe("새 값");
    grid.openFilter(0);
    expect(document.querySelector(".pyo-filter")).not.toBeNull();
    grid.moveColumn("b", 2);
    expect(document.querySelector(".pyo-filter")).toBeNull();
  });

  it("셀 병합은 바뀐 순서로 다시 계산한다 (왼쪽 병합 컬럼이 바뀐다)", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "k1" }, { key: "k2" }], mergeCells: true });
    grid.setData([
      { k1: "A", k2: "x" },
      { k1: "A", k2: "x" },
      { k1: "B", k2: "x" },
    ]);
    // k1이 왼쪽: k2는 k1이 끊기는 2행에서 끊긴다
    expect([...grid._merge.get(1).end]).toEqual([1, 1, 2]);
    grid.moveColumn("k2", 0);
    // k2가 왼쪽: k2는 세 행이 한 덩어리, k1은 그 안에서 A·B로 나뉜다
    expect([...grid._merge.get(0).end]).toEqual([2, 2, 2]);
    expect([...grid._merge.get(1).end]).toEqual([1, 1, 2]);
  });
});

describe("합계 칸: 정의 순서로 덮는 컬럼을 정하고, 지금 순서로 조각을 놓는다", () => {
  const cols5 = () => ["a", "b", "c", "d", "e"].map((k) => ({ key: k, label: k.toUpperCase() }));
  const rows = () => [
    { g: "X", a: 1, b: 2, c: 3, d: 4, e: 5 },
    { g: "X", a: 10, b: 20, c: 30, d: 40, e: 50 },
    { g: "Y", a: 100, b: 200, c: 300, d: 400, e: 500 },
  ];
  const sumCells = () => [
    { label: "합계", colspan: 2, className: "lbl" },
    { key: "c", collector: "sum" },
    { key: "d", collector: "sum", colspan: 2 },
  ];
  const setup = (opts = {}) => {
    const grid = new PyoGrid(host, {
      columns: cols5(),
      footSum: [sumCells()],
      grouping: { by: ["g"], columns: sumCells() },
      ...opts,
    });
    grid.setData(rows());
    return grid;
  };
  const footCells = (grid) =>
    [...grid.el.foot.querySelectorAll(".pyo-sum-cell:not(.pyo-aside)")].map((el) => `${el.dataset.c}:${el.getAttribute("aria-colspan") || 1}:${el.textContent}`);
  const shape = (grid) => ({
    foot: grid.el.foot.innerHTML,
    group: grid.el.body.querySelector(".pyo-group-row").innerHTML,
    excel: JSON.stringify(grid.getExportData()),
  });

  it("떨어진 컬럼은 조각이 되고 글자는 첫 조각에만 넣는다", () => {
    const grid = setup();
    expect(footCells(grid)).toEqual(["0:2:합계", "2:1:333", "3:2:444"]);
    grid.moveColumn("b", 4); // a c d e b
    expect(footCells(grid)).toEqual(["0:1:합계", "1:1:333", "2:2:444", "4:1:"]);
    grid.moveColumn("d", 1); // a d c e b: d·e 칸도 떨어진다
    expect(footCells(grid)).toEqual(["0:1:합계", "1:1:444", "2:1:333", "3:1:", "4:1:"]);
    // 조각에도 칸의 className을 붙인다
    expect(grid.el.foot.querySelectorAll(".lbl")).toHaveLength(2);
  });

  it("글자는 지금 순서에서 왼쪽에 있는 조각에 들어간다", () => {
    const grid = setup();
    grid.moveColumn("b", 0); // b a c d e: 합계 칸의 두 컬럼이 그대로 붙어 있다
    expect(footCells(grid)).toEqual(["0:2:합계", "2:1:333", "3:2:444"]);
    grid.setColumnOrder(["e", "a", "b", "c", "d"]); // e가 앞으로: d·e 칸이 떨어지고 e 조각이 왼쪽
    expect(footCells(grid)).toEqual(["0:1:444", "1:2:합계", "3:1:333", "4:1:"]);
  });

  it("결과는 지금 순서에만 달려 있고 옮긴 과정과 무관하다 (합계 행, 그룹 합계 행, 엑셀)", () => {
    const g1 = setup();
    g1.moveColumn("e", 0);
    g1.moveColumn("b", 4);
    g1.moveColumn("c", 1);
    const s1 = shape(g1);
    g1.destroy();
    const g2 = setup();
    g2.moveColumn("c", 0);
    g2.moveColumn("e", 0);
    g2.moveColumn("a", 2);
    g2.moveColumn("d", 3);
    const order = g2.getColumnOrder();
    const s2 = shape(g2);
    g2.destroy();
    const g3 = setup();
    g3.setColumnOrder(order);
    const s3 = shape(g3);
    expect(order).toEqual(["e", "c", "a", "d", "b"]);
    expect(s1).toEqual(s3);
    expect(s2).toEqual(s3);
  });

  it("원래 순서로 돌아오면 원래 모양과 같다", () => {
    const grid = setup();
    const original = shape(grid);
    grid.moveColumn("a", 4); // b c d e a
    grid.moveColumn("d", 0); // d b c e a
    expect(shape(grid)).not.toEqual(original);
    grid.moveColumn("a", 0); // a d b c e
    grid.moveColumn("d", 3); // a b c d e
    expect(grid.getColumnOrder()).toEqual(["a", "b", "c", "d", "e"]);
    expect(shape(grid)).toEqual(original);
    grid.moveColumn("c", 0);
    grid.setColumnOrder(null);
    expect(shape(grid)).toEqual(original);
  });

  it("고정 경계에서 나뉜 조각은 고정 쪽에 글자를 둔다 (지금과 같음)", () => {
    const grid = setup({ frozenColumns: 1 });
    expect(footCells(grid)).toEqual(["0:1:합계", "1:1:", "2:1:333", "3:2:444"]);
    grid.moveColumn("c", 1); // a c b d e
    expect(footCells(grid)).toEqual(["0:1:합계", "1:1:333", "2:1:", "3:2:444"]);
  });

  it("숨긴 컬럼은 덮는 컬럼 수에 들지 않는다 (정의 순서의 보이는 컬럼 기준, 지금과 같음)", () => {
    const columns = cols5();
    columns[1].hidden = true; // b
    const grid = setup({ columns });
    // 보이는 컬럼: a c d e → 합계(a,c) c합(d) d합(e)
    expect(footCells(grid)).toEqual(["0:2:합계", "2:1:333", "3:1:444"]);
    grid.moveColumn("a", 3); // c d e a: 합계 칸(a, c)이 떨어지고, 왼쪽 조각(c)에 글자
    expect(footCells(grid)).toEqual(["0:1:합계", "1:1:333", "2:1:444", "3:1:"]);
  });
});

describe("엑셀 내보내기는 지금 순서를 따른다", () => {
  it("헤더·본문·합계 칸의 순서와 병합", () => {
    const columns = [
      { key: "a", label: "A" },
      { label: "G", columns: [{ key: "g1", label: "G1" }, { key: "g2", label: "G2" }] },
      { key: "c", label: "C" },
    ];
    const grid = new PyoGrid(host, {
      columns,
      footSum: [[{ label: "합계", colspan: 2 }, { key: "g2", collector: "sum" }, { key: "c", collector: "sum" }]],
    });
    grid.setData([{ a: 1, g1: 2, g2: 3, c: 4 }]);
    grid.moveColumn(columns[1], 0); // g1 g2 a c
    grid.moveColumn("g2", 0); // g2 g1 a c
    const d = grid.getExportData();
    const text = (cell) => (cell ? String(cell.v) : null);
    expect(d.rows[0].map(text)).toEqual(["G", null, "A", "C"]);
    expect(d.rows[1].map(text)).toEqual(["G2", "G1", null, null]);
    expect(d.rows[2].map(text)).toEqual(["3", "2", "1", "4"]);
    // 합계: 합계 칸(a, g1)은 g1 조각(글자)과 a 조각으로 나뉜다. g2 합계는 맨 앞
    expect(d.rows[3].map(text)).toEqual(["3", "합계", null, "4"]);
    expect(d.merges).toEqual(
      expect.arrayContaining([
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // G
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // A (rowspan)
      ]),
    );
    // 붙어 있는 g1·a 조각은 한 칸으로 병합
    expect(d.merges.filter((m) => m.s.r === 3)).toEqual([{ s: { r: 3, c: 1 }, e: { r: 3, c: 2 } }]);
    expect(d.widths).toEqual(grid.getColumnWidths());
  });
});

describe("키보드: Alt+Shift+←/→", () => {
  const press = (grid, key, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key, altKey: true, shiftKey: true, bubbles: true, cancelable: true, ...init });
    grid.editing.input.dispatchEvent(ev);
    return ev;
  };

  it("columnReorder가 켜져 있으면 활성 칸의 컬럼을 한 칸 옮기고, 활성 칸이 따라간다", () => {
    const grid = make(flat(), { columnReorder: true });
    grid.setRange(1, 1);
    const ev = press(grid, "ArrowRight");
    expect(ev.defaultPrevented).toBe(true);
    expect(keys(grid)).toEqual(["a", "c", "b", "d"]);
    expect(grid.getRange().active).toEqual({ r: 1, c: 2 });
    press(grid, "ArrowLeft");
    press(grid, "ArrowLeft");
    expect(keys(grid)).toEqual(["b", "a", "c", "d"]);
    press(grid, "ArrowLeft"); // 맨 앞: 그대로
    expect(keys(grid)).toEqual(["b", "a", "c", "d"]);
  });

  it("그룹 안에서는 그룹 끝에서 멈추고, 옮길 수 없는 칸·고정 경계는 건너뛰거나 멈춘다", () => {
    const columns = nested();
    const grid = make(columns, { columnReorder: true, frozenColumns: 1 });
    grid.setRange(0, 4); // g3
    press(grid, "ArrowRight");
    expect(keys(grid)).toEqual(["a", "b", "g1", "g2", "g3", "c"]);
    press(grid, "ArrowLeft");
    expect(keys(grid)).toEqual(["a", "b", "g1", "g3", "g2", "c"]);
    grid.setRange(0, 1); // b: 왼쪽은 고정 경계
    press(grid, "ArrowLeft");
    expect(keys(grid)).toEqual(["a", "b", "g1", "g3", "g2", "c"]);
    press(grid, "ArrowRight"); // 그룹을 건너뛴다
    expect(keys(grid)).toEqual(["a", "g1", "g3", "g2", "b", "c"]);
    expect(grid.getRange().active).toEqual({ r: 0, c: 4 });
  });

  it("옵션이 꺼져 있으면 지금처럼 범위를 넓힌다", () => {
    const grid = make(flat());
    grid.setRange(0, 1);
    press(grid, "ArrowRight");
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(grid.getRange()).toMatchObject({ c0: 1, c1: 2 });
  });

  it("편집 중에는 옮기지 않는다", () => {
    const grid = make([{ key: "a", editor: { type: "text" } }, { key: "b" }], { columnReorder: true });
    grid.startEdit(0, 0);
    press(grid, "ArrowRight");
    expect(keys(grid)).toEqual(["a", "b"]);
    expect(grid.isEditing).toBe(true);
  });

  it("keydown 핸들러가 false를 돌려주면 옮기지 않는다", () => {
    const grid = make(flat(), { columnReorder: true });
    grid.on("keydown", (e) => !(e.event.altKey && e.event.shiftKey));
    grid.setRange(0, 0);
    press(grid, "ArrowRight");
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("stateKey: 순서도 기억한다", () => {
  const stored = () => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith(":cm"))));

  it("옮긴 순서를 저장하고, 같은 stateKey로 만든 그리드와 setColumns가 되살린다", () => {
    const columns = nested();
    const g1 = make(columns, { stateKey: "cm" });
    g1.moveColumn("c", 0);
    g1.moveColumn("g3", 3);
    expect(stored().order).toEqual(["c", "a", "b", "g3", "g1", "g2"]);
    g1.destroy();
    const g2 = make(nested(), { stateKey: "cm" });
    expect(keys(g2)).toEqual(["c", "a", "b", "g3", "g1", "g2"]);
    g2.setColumnOrder(null);
    expect(stored().order).toBeUndefined();
    // setColumns는 순서를 지운 뒤 저장값이 있으면 되살린다 (너비와 같은 규칙)
    g2.moveColumn("c", 0);
    g2.setColumns(nested());
    expect(keys(g2)).toEqual(["c", "a", "b", "g1", "g2", "g3"]);
  });

  it("순서가 없는 예전 저장값도 읽는다 (너비·정렬만)", () => {
    localStorage.setItem("pyogrid:" + location.pathname + ":cm", JSON.stringify({ widths: { b: 140 }, sort: [{ key: "c", dir: "asc" }] }));
    const grid = make(flat(), { stateKey: "cm", sortable: true });
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(grid.getColumnWidths()[1]).toBe(140);
    expect(grid.getSort()).toEqual([{ key: "c", dir: "asc" }]);
  });

  it("저장된 순서가 고정 경계를 넘으면 쓰지 않는다", () => {
    localStorage.setItem("pyogrid:" + location.pathname + ":cm", JSON.stringify({ widths: {}, sort: [], order: ["c", "a", "b", "d"] }));
    const grid = make(flat(), { stateKey: "cm", frozenColumns: 1 });
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
  });

  it("resetState()는 순서도 지운다 (화면은 그대로)", () => {
    const g1 = make(flat(), { stateKey: "cm" });
    g1.moveColumn("d", 0);
    g1.resetState();
    expect(keys(g1)).toEqual(["d", "a", "b", "c"]);
    g1.destroy();
    const g2 = make(flat(), { stateKey: "cm" });
    expect(keys(g2)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("헤더 끌기 (columnReorder)", () => {
  // jsdom은 위치를 계산하지 않아 모든 상자가 (0, 0)에 있다. 그리드는 잎 x(leafX)와 스크롤 위치로 놓을 자리를 정한다.
  const centerX = (grid, i) => grid.fzWidth + grid.leafX[i] + grid.widths[i] / 2;
  const headCell = (grid, key) => grid.el.head.querySelector(`.pyo-hcell[data-key="${key}"]`);
  const drag = (grid, key, toX, { up = true } = {}) => {
    const i = grid.leaves.findIndex((l) => l.key === key);
    const x = centerX(grid, i);
    fire(headCell(grid, key).querySelector(".pyo-hlabel"), "pointerdown", { clientX: x, clientY: 10 });
    fire(document, "pointermove", { clientX: x + (toX > x ? 3 : -3), clientY: 10 });
    fire(document, "pointermove", { clientX: toX, clientY: 10 });
    if (up) fire(document, "pointerup", { clientX: toX, clientY: 10 });
  };

  it("5px 넘게 끌어 놓으면 옮기고, 이어지는 click은 정렬하지 않는다", () => {
    const grid = make(flat(), { columnReorder: true, sortable: true });
    const fn = vi.fn();
    grid.on("columnmove", fn);
    drag(grid, "a", centerX(grid, 2) + 10);
    expect(keys(grid)).toEqual(["b", "c", "a", "d"]);
    expect(fn).toHaveBeenCalledTimes(1);
    fire(headCell(grid, "a").querySelector(".pyo-hlabel"), "click");
    expect(grid.getSort()).toEqual([]);
  });

  it("5px 이하로 움직이면 끌기가 아니다: click은 지금처럼 정렬한다", () => {
    const grid = make(flat(), { columnReorder: true, sortable: true });
    const x = centerX(grid, 0);
    const label = headCell(grid, "a").querySelector(".pyo-hlabel");
    fire(label, "pointerdown", { clientX: x, clientY: 10 });
    fire(document, "pointermove", { clientX: x + 5, clientY: 10 });
    fire(document, "pointerup", { clientX: x + 5, clientY: 10 });
    expect(document.querySelector(".pyo-col-ghost")).toBeNull();
    fire(label, "click");
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(grid.getSort()).toEqual([{ key: "a", dir: "desc" }]);
  });

  it("끄는 동안 반투명 헤더와 놓을 자리 표시가 보이고, Esc면 취소한다", () => {
    const grid = make(flat(), { columnReorder: true });
    drag(grid, "a", centerX(grid, 3), { up: false });
    expect(grid.el.root.querySelector(".pyo-col-ghost")).not.toBeNull();
    const drop = grid.el.root.querySelector(".pyo-col-drop");
    expect(drop).not.toBeNull();
    expect(drop.hidden).toBe(false);
    expect(grid.el.root.classList.contains("pyo-col-dragging")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(grid.el.root.querySelector(".pyo-col-ghost")).toBeNull();
    fire(document, "pointerup", { clientX: centerX(grid, 3), clientY: 10 });
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
  });

  it("그룹 헤더를 끌면 그룹을 통째로 옮긴다. 놓을 수 없는 자리면 그대로", () => {
    const columns = nested();
    const grid = make(columns, { columnReorder: true });
    const g = grid.el.head.querySelector(".pyo-hcell.pyo-hgroup");
    const x = centerX(grid, 3);
    fire(g, "pointerdown", { clientX: x, clientY: 5 });
    fire(document, "pointermove", { clientX: x - 50, clientY: 5 });
    fire(document, "pointermove", { clientX: 1, clientY: 5 });
    fire(document, "pointerup", { clientX: 1, clientY: 5 });
    expect(keys(grid)).toEqual(["g1", "g2", "g3", "a", "b", "c"]);
    // 그룹 안의 잎을 그룹 밖 자리로 끌어도 그룹 안의 가장 가까운 자리까지만
    drag(grid, "g1", centerX(grid, 5) + 30);
    expect(keys(grid)).toEqual(["g2", "g3", "g1", "a", "b", "c"]);
  });

  it("고정 경계를 넘어 끌어도 경계 안쪽까지만 옮긴다", () => {
    const grid = make(flat(), { columnReorder: true, frozenColumns: 2 });
    const x = grid.leafX[0] + grid.widths[0] / 2; // 고정 쪽은 스크롤과 상관없다
    fire(headCell(grid, "a").querySelector(".pyo-hlabel"), "pointerdown", { clientX: x, clientY: 10 });
    fire(document, "pointermove", { clientX: x + 20, clientY: 10 });
    fire(document, "pointermove", { clientX: 700, clientY: 10 });
    fire(document, "pointerup", { clientX: 700, clientY: 10 });
    expect(keys(grid)).toEqual(["b", "a", "c", "d"]);
  });

  it("옵션이 꺼져 있거나, reorderable: false, 너비 조절 손잡이·필터 단추에서는 끌지 않는다", () => {
    const columns = flat();
    columns[1].reorderable = false;
    const off = make(flat(), { sortable: true });
    drag(off, "a", centerX(off, 3));
    expect(keys(off)).toEqual(["a", "b", "c", "d"]);
    off.destroy();
    const grid = make(columns, { columnReorder: true, filter: true });
    drag(grid, "b", centerX(grid, 3));
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    const x = centerX(grid, 0);
    fire(headCell(grid, "a").querySelector(".pyo-filter-btn"), "pointerdown", { clientX: x, clientY: 10 });
    fire(document, "pointermove", { clientX: x + 200, clientY: 10 });
    fire(document, "pointerup", { clientX: x + 200, clientY: 10 });
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
    expect(grid.el.root.querySelector(".pyo-col-ghost")).toBeNull();
  });

  it("터치로는 끌지 않는다", () => {
    const grid = make(flat(), { columnReorder: true });
    const x = centerX(grid, 0);
    const label = headCell(grid, "a").querySelector(".pyo-hlabel");
    label.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: 10 }), { pointerType: "touch" }));
    fire(document, "pointermove", { clientX: x + 300, clientY: 10 });
    fire(document, "pointerup", { clientX: x + 300, clientY: 10 });
    expect(keys(grid)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("필터 팝업이 열린 채 순서가 바뀔 때", () => {
  const popup = () => document.querySelector(".pyo-filter");
  const setup = () => {
    const grid = new PyoGrid(host, { columns: flat(), filter: true });
    grid.setData([
      { a: "a1", b: "b1", c: "c1", d: "d1" },
      { a: "a2", b: "b2", c: "c2", d: "d2" },
    ]);
    return grid;
  };

  it("setColumnOrder로 화면 순서가 바뀌면 팝업을 닫는다. 순서가 그대로면 열어 둔다", () => {
    const grid = setup();
    grid.openFilter(1); // b
    grid.setColumnOrder(["a", "b"]); // 그대로
    expect(popup()).not.toBeNull();
    grid.setColumnOrder(["c", "b", "a"]);
    expect(popup()).toBeNull();
  });

  it("moveColumn 뒤에 다시 연 팝업은 같은 컬럼의 값을 보이고 그 컬럼에 적용한다", () => {
    const grid = setup();
    grid.openFilter(1); // b
    grid.moveColumn("b", 3); // a c d b
    expect(popup()).toBeNull();
    grid.openFilter(3);
    const labels = [...popup().querySelectorAll(".pyo-f-item")].map((l) => l.textContent.trim());
    expect(labels).toEqual(["b1", "b2"]);
    popup().querySelectorAll(".pyo-f-list input")[0].click(); // b1 해제
    popup().querySelector(".pyo-f-ok").click();
    expect(grid.getFilters()).toEqual({ b: ["b2"] });
    expect(grid.el.head.querySelector('.pyo-hcell[data-key="b"] .pyo-filter-btn').classList.contains("pyo-filter-on")).toBe(true);
  });
});
