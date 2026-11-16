import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { collectors } from "../../src/features/view.js";
import { sumCellValue } from "../../src/features/summary.js";
import { money } from "../../src/core/formatters.js";
import { FilterPopup } from "../../src/features/filter.js";
import { mockLayout, unmockLayout } from "./helpers.js";

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

describe("1. 필터가 걸린 상태에서 addRow", () => {
  it("새 행은 필터 조건에 맞지 않아도 보이고, focus로 그 행에 간다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData([{ team: "A", qty: 1 }, { team: "B", qty: 2 }]);
    grid.setFilter("team", ["A"]);
    expect(grid.getRows().map((r) => r.team)).toEqual(["A"]);
    const row = { team: "", qty: 0 };
    grid.addRow(row, "last", { focus: true });
    expect(grid.getRows()).toContain(row);
    expect(grid.getRange()).toMatchObject({ r0: grid.getRows().indexOf(row), c0: 0 });
    // 편집해서 조건에 안 맞는 값이 되어도 저장 전까지는 보인다
    grid.setValue(grid.getRows().indexOf(row), "team", "Z");
    grid.setFilter("team", ["A"]);
    expect(grid.getRows()).toContain(row);
  });

  it("저장(acceptChanges) 뒤에는 다시 필터를 따른다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData([{ team: "A", qty: 1 }]);
    grid.setFilter("team", ["A"]);
    const row = { team: "", qty: 0 };
    grid.addRow(row);
    grid.acceptChanges();
    expect(row.__added__).toBeUndefined();
    expect(grid.getRows()).not.toContain(row);
  });
});

describe("2. 합계의 소수", () => {
  it("sum은 넣은 값의 소수 자리에서 반올림한다", () => {
    const list = [{ v: 0.1 }, { v: 0.7 }];
    expect(collectors.sum.call({ key: "v", list })).toBe(0.8);
    expect(sumCellValue({ key: "v", collector: "sum" }, [{ v: 0.1 }, { v: 0.2 }])).toBe("0.3");
    expect(sumCellValue({ key: "v", collector: "sum", formatter: "money" }, list)).toBe("0.8");
    expect(collectors.sum.call({ key: "v", list: [{ v: "1,234.56" }, { v: 0.01 }] })).toBe(1234.57);
  });

  it("money는 숫자의 부동소수 오차를 지운 뒤 2자리까지 자른다 (글자는 그대로)", () => {
    expect(money({ value: 0.1 + 0.7 })).toBe("0.8");
    expect(money({ value: 1234.5678 })).toBe("1,234.56");
    expect(money({ value: 1e21 })).toBe("1,000,000,000,000,000,000,000");
    expect(money({ value: 0.0000001 })).toBe("0.00");
    expect(money({ value: "0.799" })).toBe("0.79");
  });

  it("선택 합계도 같은 오차를 지운다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v", numeric: true }] });
    grid.setData([{ v: 0.1 }, { v: 0.2 }]);
    grid.setRange(0, 0, 1, 0);
    expect(grid.getSelectionSummary().sum).toBe(0.3);
  });
});

describe("3. avg·min·max는 빈 값을 세지 않는다", () => {
  const list = [{ v: 10 }, { v: "" }, { v: null }, {}, { v: 30 }, { v: "n/a" }];
  it("빈 값과 숫자가 없는 글자를 뺀다", () => {
    expect(collectors.avg.call({ key: "v", list })).toBe(20);
    expect(collectors.min.call({ key: "v", list })).toBe(10);
    expect(collectors.max.call({ key: "v", list })).toBe(30);
    expect(collectors.sum.call({ key: "v", list })).toBe(40);
    expect(collectors.avg.call({ key: "v", list: [{ v: "" }] })).toBe("");
    expect(collectors.min.call({ key: "v", list: [{ v: "" }] })).toBe("");
    expect(collectors.min.call({ key: "v", list: [{ v: -5 }, { v: 0 }] })).toBe(-5);
  });

  it("합계 행 평균과 선택 합계 평균이 같다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v", numeric: true }], footSum: [[{ key: "v", collector: "avg" }]] });
    grid.setData([{ v: 10 }, { v: "" }, { v: 30 }]);
    grid.setRange(0, 0, 2, 0);
    expect(grid.getSelectionSummary().avg).toBe(20);
    expect(grid.el.foot.textContent).toContain("20");
  });
});

describe("4. 추가한 행과 수정한 행을 나눈다", () => {
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

describe("5. 필터 팝업의 Enter", () => {
  const open = () => {
    const applied = [];
    let closed = 0;
    const p = new FilterPopup({ title: "T", values: ["a", "b"], label: (v) => v, current: null, onApply: (s) => applied.push(s), onClose: () => closed++ });
    return { p, applied, get closed() { return closed; } };
  };
  const press = (target, init) => {
    const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    return ev;
  };

  it("단추에 포커스가 있으면 Enter는 그 단추를 누른다 (팝업이 가로채지 않음)", () => {
    const s = open();
    const cancel = s.p.el.querySelector(".pyo-f-cancel");
    const ev = press(cancel, { key: "Enter" });
    expect(ev.defaultPrevented).toBe(false);
    expect(s.applied).toEqual([]);
  });

  it("조합 중 Enter는 무시하고, 검색칸의 Enter는 적용한다", () => {
    const s = open();
    const search = s.p.el.querySelector(".pyo-f-search");
    press(search, { key: "Enter", isComposing: true });
    press(search, { key: "Enter", keyCode: 229 });
    expect(s.applied).toEqual([]);
    press(search, { key: "Enter" });
    expect(s.applied).toEqual([null]);
  });
});

describe("6. 이벤트 핸들러가 예외를 던져도 그리드는 계속한다", () => {
  it("붙여넣기 중 change 핸들러가 실패해도 모든 값이 바뀌고 기록·batchchange가 남는다", () => {
    const reported = [];
    const g = /** @type {any} */ (globalThis);
    const orig = g.reportError;
    g.reportError = (e) => reported.push(e);
    try {
      const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text" } }, { key: "b", editor: { type: "text" } }] });
      const rows = [{ a: "", b: "" }, { a: "", b: "" }];
      grid.setData(rows);
      let after = 0;
      grid.on("change", () => { throw new Error("boom"); });
      grid.on("change", () => after++);
      const batches = [];
      grid.on("batchchange", (e) => batches.push(e.changes.length));
      grid.setRange(0, 0);
      const r = grid.paste("1\t2\n3\t4");
      expect(r.applied).toBe(4);
      expect(rows).toEqual([{ a: "1", b: "2", __modified__: true }, { a: "3", b: "4", __modified__: true }]);
      expect(after).toBe(4);
      expect(batches).toEqual([4]);
      expect(reported).toHaveLength(4);
      expect(grid.canUndo).toBe(true);
      grid.undo();
      expect(rows.map((x) => x.a + x.b)).toEqual(["", ""]);
    } finally {
      g.reportError = orig;
    }
  });

  it("reportError가 없으면 console.error, beforeedit에서 던지면 편집은 막지 않는다", () => {
    const g = /** @type {any} */ (globalThis);
    const orig = g.reportError;
    delete g.reportError;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text" } }] });
      grid.setData([{ a: "x" }]);
      grid.on("beforeedit", () => { throw new Error("bad"); });
      expect(grid.startEdit(0, 0)).toBe(true);
      expect(spy).toHaveBeenCalled();
    } finally {
      g.reportError = orig;
    }
  });
});
