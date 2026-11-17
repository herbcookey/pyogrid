// 정렬
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows, rowEl, fire } from "./helpers.js";

describe("정렬", () => {
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
