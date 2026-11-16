import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { collectors } from "../../src/features/view.js";
import { pastePlan } from "../../src/features/clipboard.js";
import { mockLayout, unmockLayout, rowEl, fire } from "./helpers.js";

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

describe("단일 선택은 화면에 없는 행의 선택도 푼다", () => {
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

describe("행이 아주 많아도 스택 초과가 나지 않는다", () => {
  const N = 200000;

  it("min·max 계산기", () => {
    const list = Array.from({ length: N }, (_, i) => ({ v: i - 5 }));
    expect(collectors.min.call({ key: "v", list })).toBe(-5);
    expect(collectors.max.call({ key: "v", list })).toBe(N - 6);
    expect(collectors.min.call({ key: "v", list: [] })).toBe("");
  });

  it("20만 행 footSum max로 setData", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "v", align: "right" }],
      footSum: [[{ key: "v", collector: "max" }]],
    });
    expect(() => grid.setData(Array.from({ length: N }, (_, i) => ({ v: i })))).not.toThrow();
    expect(grid.el.foot.querySelector(".pyo-sum-cell").textContent).toBe(String(N - 1));
  });

  it("20만 셀 붙여넣기 → 실행 취소", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v", editor: { type: "text" } }], pageBar: false });
    const rows = Array.from({ length: N }, () => ({ v: "a" }));
    grid.setData(rows);
    grid.setRange(0, 0);
    const text = Array.from({ length: N }, () => "b").join("\n");
    expect(pastePlan([["x"]], { r0: 0, c0: 0, r1: 0, c1: 0 })).toHaveLength(1);
    expect(grid.paste(text).applied).toBe(N);
    expect(() => grid.undo()).not.toThrow();
    expect(rows[N - 1].v).toBe("a");
    expect(grid.getRange()).toMatchObject({ r0: 0, c0: 0, r1: N - 1, c1: 0 });
  });

  it("20만 행 addRow·deleteRows", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v" }] });
    grid.setData([{ v: "first" }]);
    const many = Array.from({ length: N }, (_, i) => ({ v: i }));
    expect(() => grid.addRow(many, 0)).not.toThrow();
    expect(grid.getAllRows()).toHaveLength(N + 1);
    expect(grid.getAllRows()[N].v).toBe("first");
    grid.acceptChanges(); // 저장한 뒤라야 지운 행이 기록에 남는다 (저장 전에 넣은 행은 기록하지 않음)
    expect(() => grid.deleteRows(many)).not.toThrow();
    expect(grid.getDeletedRows()).toHaveLength(N);
  });
});

describe("Shift+클릭 기준 행은 행 객체로 기억한다", () => {
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
