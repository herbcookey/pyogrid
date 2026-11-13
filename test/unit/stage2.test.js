import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows, rowEl, cellsOf, fire } from "./helpers.js";

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

describe("정렬", () => {
  it("헤더 클릭: 없음 → desc → asc → 없음 (처음 순서로 복귀)", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    const rows = [{ id: 2, name: "나" }, { id: 10, name: "가" }, { id: 1, name: "다" }];
    grid.setData(rows);
    const events = [];
    grid.on("sortchange", (e) => events.push(e.sort));
    const head = () => grid.el.headSc.querySelector('[data-key="id"]');
    head().click();
    expect(grid.getRows().map((r) => r.id)).toEqual([10, 2, 1]);
    expect(head().getAttribute("aria-sort")).toBe("descending");
    head().click();
    expect(grid.getRows().map((r) => r.id)).toEqual([1, 2, 10]);
    expect(head().dataset.sort).toBe("asc");
    head().click();
    expect(grid.getRows().map((r) => r.id)).toEqual([2, 10, 1]);
    expect(head().getAttribute("aria-sort")).toBe("none");
    expect(events).toEqual([[{ key: "id", dir: "desc" }], [{ key: "id", dir: "asc" }], []]);
    expect(rowEl(grid, 0).querySelector(".pyo-cell").textContent).toBe("2");
  });

  it("sortable 설정: 그리드 false여도 컬럼 true면 정렬, 컬럼 false면 안 함", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(3));
    expect(grid.el.headSc.querySelector('[data-key="id"]').classList.contains("pyo-sortable")).toBe(false);
    grid.el.headSc.querySelector('[data-key="id"]').click();
    expect(grid.getSort()).toEqual([]);
    grid.el.headSc.querySelector('[data-key="qty"]').click();
    expect(grid.getSort()).toEqual([{ key: "qty", dir: "desc" }]);
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), { columns: cols, sortable: true });
    g2.toggleSort(3);
    expect(g2.getSort()).toEqual([]);
  });

  it("multiSort: 클릭한 순서대로 쌓이고, 방향만 바꾸면 순서 유지", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true, multiSort: true });
    grid.setData([{ id: 1, name: "B" }, { id: 2, name: "A" }, { id: 3, name: "B" }]);
    grid.toggleSort(1); // name desc
    grid.toggleSort(0); // id desc
    expect(grid.getSort()).toEqual([{ key: "name", dir: "desc" }, { key: "id", dir: "desc" }]);
    expect(grid.getRows().map((r) => r.id)).toEqual([3, 1, 2]);
    grid.toggleSort(1); // name asc, 순서 유지
    expect(grid.getSort()).toEqual([{ key: "name", dir: "asc" }, { key: "id", dir: "desc" }]);
    grid.toggleSort(1); // name 해제
    expect(grid.getSort()).toEqual([{ key: "id", dir: "desc" }]);
  });

  it("단일 정렬은 다른 컬럼 정렬을 지운다", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    grid.toggleSort(0);
    grid.toggleSort(1);
    expect(grid.getSort()).toEqual([{ key: "name", dir: "desc" }]);
  });

  it("setData 뒤에도 정렬이 유지되고, remoteSort는 순서를 바꾸지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    grid.setSort([{ key: "id", dir: "desc" }], { silent: true });
    grid.setData(makeRows(3));
    expect(grid.getRows().map((r) => r.id)).toEqual([3, 2, 1]);
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), { columns: cols, sortable: true, remoteSort: true });
    const fn = vi.fn();
    g2.on("sortchange", fn);
    g2.setData(makeRows(3));
    g2.toggleSort(0);
    expect(fn).toHaveBeenCalledWith({ sort: [{ key: "id", dir: "desc" }] });
    expect(g2.getRows().map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("너비 조절 직후의 click은 정렬하지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    const handle = grid.el.headSc.querySelector('[data-resize="0"]');
    fire(handle, "pointerdown", { clientX: 60 });
    fire(handle, "pointerup", { clientX: 90 });
    grid.el.headSc.querySelector('[data-key="id"]').click();
    expect(grid.getSort()).toEqual([]);
  });
});

describe("행 선택", () => {
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

describe("페이지 바", () => {
  it("기본: 상태 문구만, 페이지 정보가 있으면 이동 버튼", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(300));
    expect(grid.el.status.textContent).toBe("1 - 15 of 300");
    expect(grid.el.nav.innerHTML).toBe("");
    grid.setData(makeRows(50), { currentPage: 2, pageSize: 50, totalElements: 1234, totalPages: 25 });
    expect(grid.el.status.textContent).toBe("1 - 15 of 50\u00a0 Total 1,234");
    const nums = [...grid.el.nav.querySelectorAll(".pyo-page-nums button")].map((b) => b.textContent);
    expect(nums).toEqual(["1", "2", "3", "4", "5"]);
    expect(grid.el.nav.querySelector('[data-selected="true"]').textContent).toBe("3");
  });

  it("이동 버튼은 pagechange(page는 0부터)를 알리고, 같은 페이지는 무시한다", () => {
    const grid = new PyoGrid(host, { columns: cols, pageIcons: { first: "|«", last: "»|" } });
    grid.setData(makeRows(10), { currentPage: 2, pageSize: 10, totalElements: 100, totalPages: 10 });
    const fn = vi.fn();
    grid.on("pagechange", fn);
    grid.el.nav.querySelector('[data-page-move="next"]').click();
    grid.el.nav.querySelector('[data-page-move="first"]').click();
    grid.el.nav.querySelector('[data-page-move="3"]').click();
    expect(fn.mock.calls.map((c) => c[0].page)).toEqual([3, 0]);
    expect(fn.mock.calls[0][0].current).toBe(2);
  });

  it("pageBar:false면 숨기고 본문이 아래까지, statusFormat으로 문구 바꾸기", () => {
    const grid = new PyoGrid(host, { columns: cols, pageBar: false });
    expect(grid.el.pagebar.hidden).toBe(true);
    expect(grid.el.scroll.style.bottom).toBe("0px");
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), {
      columns: cols,
      statusFormat: (d) => `<b>${d.dataRowCount}건</b>`,
    });
    g2.setData(makeRows(1200));
    expect(g2.el.status.innerHTML).toBe("<b>1,200건</b>");
    expect(g2.el.scroll.style.bottom).toBe("25px");
  });

  it("스크롤하면 상태 문구가 바뀐다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(300));
    grid.el.scroll.scrollTop = 26 * 100;
    grid.scrollToRow(100, "top");
    grid._renderStatus();
    expect(grid.el.status.textContent).toBe("101 - 115 of 300");
  });
});
