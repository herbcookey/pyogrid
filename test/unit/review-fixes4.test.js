import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { FilterPopup } from "../../src/features/filter.js";
import { parseDateValue, formatDateAs, editorTypes, sameValue } from "../../src/editors/types.js";
import { buildExportData } from "../../src/features/excel.js";
import { mockLayout, unmockLayout, cellsOf } from "./helpers.js";

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

const key = (input, k, init = {}) => {
  const ev = new KeyboardEvent("keydown", { key: k, code: k, bubbles: true, cancelable: true, ...init });
  input.dispatchEvent(ev);
  return ev;
};
const rect = (top, bottom, left = 100, right = 200) => ({ top, bottom, left, right, width: right - left, height: bottom - top });

describe("7. 팝업이 페이지 스크롤을 따라간다", () => {
  it("필터 팝업은 아래 공간이 모자라면 위로 뒤집는다", () => {
    const p = new FilterPopup({ title: "T", values: ["a"], label: (v) => v, current: null, onApply() {}, onClose() {} });
    Object.defineProperty(p.el, "offsetHeight", { configurable: true, value: 300 });
    Object.defineProperty(p.el, "offsetWidth", { configurable: true, value: 200 });
    const vh = window.innerHeight;
    p.place(rect(vh - 40, vh - 20), false);
    expect(parseFloat(p.el.style.top)).toBe(vh - 40 - 300 - 2);
    p.place(rect(10, 30), false);
    expect(parseFloat(p.el.style.top)).toBe(32);
    p.close();
  });

  it("바깥 스크롤·창 크기 변화에 열린 팝업 위치를 다시 잡고, 팝업 안 스크롤은 무시한다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "d", editor: { type: "date" } }], filter: true });
    grid.setData([{ d: "2026-11-13" }]);
    let calls = 0;
    const orig = grid.editing.placePopup.bind(grid.editing);
    grid.editing.placePopup = () => (calls++, orig());
    grid.setRange(0, 0);
    key(grid.editing.input, "F2");
    const pop = document.querySelector(".pyo-calendar");
    expect(pop).not.toBeNull();
    calls = 0;
    document.dispatchEvent(new Event("scroll"));
    expect(calls).toBe(1);
    window.dispatchEvent(new Event("resize"));
    const afterResize = calls;
    expect(afterResize).toBeGreaterThanOrEqual(2);
    pop.dispatchEvent(new Event("scroll"));
    expect(calls).toBe(afterResize);
    key(grid.editing.input, "Escape");
    // 필터 팝업도
    let placed = 0;
    grid.openFilter(0);
    const fp = grid._filterPopup;
    const op = fp.place.bind(fp);
    fp.place = (a, f) => (placed++, op(a, f));
    document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(placed).toBe(1);
    grid.destroy();
    document.dispatchEvent(new Event("scroll"));
    expect(placed).toBe(1);
  });
});

describe("8. 값을 바꾸는 API가 행 객체도 받는다", () => {
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

describe("9. formatter·label·합계 label·cellClass는 기본으로 이스케이프한다", () => {
  const evil = '<img src=x onerror="window.__x=1">';
  it("헤더 label, 합계 label·formatter, cellClass, headerClass", () => {
    const grid = new PyoGrid(host, {
      columns: [
        { key: "a", label: evil, cellClass: () => '" onmouseover="x', headerClass: '"><b>' },
        { key: "b", label: "<b>B</b>", html: true },
      ],
      footSum: [[{ label: evil }, { key: "b", collector: "sum", formatter: () => evil }]],
      grouping: { by: ["a"], columns: [{ label() { return this.groupBy.labels[0]; } }] },
    });
    grid.setData([{ a: evil, b: 1 }]);
    const root = grid.el.root;
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".pyo-hlabel").textContent).toBe(evil);
    expect(root.querySelectorAll(".pyo-hlabel")[1].querySelector("b").textContent).toBe("B");
    expect(grid.el.foot.textContent).toContain(evil);
    expect(root.querySelector(".pyo-group-row").textContent).toContain(evil);
    const cell = cellsOf(grid, 0)[0];
    expect(cell.getAttribute("onmouseover")).toBeNull();
    expect(root.querySelector(".pyo-hcell b")).toBe(root.querySelectorAll(".pyo-hlabel")[1].querySelector("b"));
  });

  it("합계 칸 html: true만 HTML로, 내보내기는 화면 글자 그대로", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "a", label: "<u>A</u>" }],
      footSum: [[{ label: "<b>T</b>", html: true }]],
    });
    grid.setData([{ a: "<i>x</i>" }]);
    expect(grid.el.foot.querySelector("b").textContent).toBe("T");
    const data = buildExportData(grid);
    expect(data.rows[0][0].v).toBe("<u>A</u>");
    expect(data.rows[1][0].v).toBe("<i>x</i>");
    expect(data.rows[2][0].v).toBe("T");
  });
});

describe("10. Tab으로 그리드를 빠져나간다", () => {
  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text" } }, { key: "b", editor: { type: "text" } }] });
    grid.setData([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
    return grid;
  };
  it("마지막 셀의 Tab, 첫 셀의 Shift+Tab은 막지 않는다 (가운데에서는 다음 셀로)", () => {
    const grid = setup();
    const input = grid.editing.input;
    grid.setRange(1, 1);
    expect(key(input, "Tab").defaultPrevented).toBe(false);
    grid.setRange(0, 0);
    expect(key(input, "Tab", { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(input, "Tab").defaultPrevented).toBe(true);
    expect(grid.getRange().active).toEqual({ r: 0, c: 1 });
  });

  it("편집 중 마지막 셀의 Tab은 저장하고 막지 않는다, 잘못된 값이면 막는다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "n", editor: { type: "number" } }] });
    const rows = [{ n: 1 }];
    grid.setData(rows);
    const input = grid.editing.input;
    grid.startEdit(0, 0);
    input.value = "5";
    expect(key(input, "Tab").defaultPrevented).toBe(false);
    expect(rows[0].n).toBe(5);
    expect(grid.isEditing).toBe(false);
    grid.startEdit(0, 0);
    input.value = "abc";
    expect(key(input, "Tab").defaultPrevented).toBe(true);
    expect(grid.isEditing).toBe(true);
  });

  it("범위가 없을 때 Shift+Tab은 막지 않는다", () => {
    const grid = setup();
    expect(key(grid.editing.input, "Tab", { shiftKey: true }).defaultPrevented).toBe(false);
  });
});

describe("11. date 편집기 저장 형식 (config.valueFormat)", () => {
  it("형식 글자와 함수", () => {
    const d = new Date(2026, 10, 3);
    expect(formatDateAs(d)).toBe("2026-11-03");
    expect(formatDateAs(d, "yyyyMMdd")).toBe("20261103");
    expect(formatDateAs(d, "yyyy.MM.dd")).toBe("2026.11.03");
    expect(formatDateAs(d, (x) => x.getTime())).toBe(d.getTime());
    expect(parseDateValue("2026-11-03", { valueFormat: "yyyyMMdd" })).toEqual({ ok: true, value: "20261103" });
    expect(parseDateValue("", { valueFormat: "yyyyMMdd" })).toEqual({ ok: true, value: "" });
    expect(parseDateValue("2026-02-30", { valueFormat: "yyyyMMdd" })).toEqual({ ok: false });
    expect(parseDateValue("20261103")).toEqual({ ok: true, value: "2026-11-03" });
  });

  it("편집·붙여넣기는 서버 형식 그대로 저장하고, 입력칸에는 yyyy-MM-dd로 보인다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "d", editor: { type: "date", config: { valueFormat: "yyyyMMdd" } } }] });
    const rows = [{ d: "20261113" }, { d: "20261114" }];
    grid.setData(rows);
    const input = grid.editing.input;
    grid.startEdit(0, 0);
    expect(input.value).toBe("2026-11-13");
    input.value = "2026-12-01";
    grid.commitEdit();
    expect(rows[0].d).toBe("20261201");
    // 그대로 Enter는 값을 건드리지 않는다 (수정된 행이 되지 않음)
    grid.startEdit(1, 0);
    grid.commitEdit();
    expect(rows[1].__modified__).toBeUndefined();
    grid.setRange(1, 0);
    grid.paste("2026.01.02");
    expect(rows[1].d).toBe("20260102");
    expect(sameValue(editorTypes.date, { valueFormat: "yyyyMMdd" }, "20260102", "20260102")).toBe(true);
  });
});
