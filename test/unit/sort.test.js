import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sortRows, compareSmart, comparePlain, nextSortDir } from "../../src/core/sort.js";
import { CellRange } from "../../src/core/range.js";
import { pageNumbers, targetPage, statusData, defaultStatusHtml, summaryText, formatNumber } from "../../src/features/pagebar.js";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows, rowEl, fire } from "./helpers.js";

const keysOf = (rows, k = "v") => rows.map((r) => r[k]);
const R = (...vals) => vals.map((v, i) => ({ v, i }));

describe("sortRows smart (기본)", () => {
  it("숫자와 쉼표 숫자 문자열을 숫자로 비교한다", () => {
    const rows = R("1,200", 999, "30", 5, "1,000,000");
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }]))).toEqual([5, "30", 999, "1,200", "1,000,000"]);
  });
  it("빈 값(null, undefined, '')은 오름·내림 모두 맨 뒤", () => {
    const rows = R(3, null, 1, "", undefined, 2);
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }]))).toEqual([1, 2, 3, null, "", undefined]);
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "desc" }]))).toEqual([3, 2, 1, null, "", undefined]);
  });
  it("자연 정렬은 그리드 언어를 따른다 (ko: 한글이 영문보다 앞, en: 영문이 앞)", () => {
    const rows = R("나", "가", "item10", "item2", "다");
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }], "smart", "ko"))).toEqual(["가", "나", "다", "item2", "item10"]);
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }]))).toEqual(["item2", "item10", "가", "나", "다"]);
  });
  it("같은 값은 원래 순서를 지킨다 (안정 정렬)", () => {
    const rows = [{ v: 1, i: 0 }, { v: 0, i: 1 }, { v: 1, i: 2 }, { v: 0, i: 3 }];
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "desc" }]), "i")).toEqual([0, 2, 1, 3]);
  });
  it("다중 정렬: 앞 키가 같으면 다음 키", () => {
    const rows = [{ a: "B", b: 1 }, { a: "A", b: 2 }, { a: "B", b: 3 }, { a: "A", b: 1 }];
    const out = sortRows(rows, [{ key: "a", dir: "asc" }, { key: "b", dir: "desc" }]);
    expect(out.map((r) => r.a + r.b)).toEqual(["A2", "A1", "B3", "B1"]);
  });
  it("경로 키와 원본 배열 보존", () => {
    const rows = [{ o: { n: 2 } }, { o: { n: 1 } }];
    const out = sortRows(rows, [{ key: "o.n", dir: "asc" }]);
    expect(out.map((r) => r.o.n)).toEqual([1, 2]);
    expect(rows[0].o.n).toBe(2);
  });
});

describe("sortRows plain (값 그대로 비교)", () => {
  it("문자열은 사전 순, 형이 다르면 문자열로 비교", () => {
    const rows = R("1,200", "999", "30");
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }], "plain"))).toEqual(["1,200", "30", "999"]);
    expect(comparePlain(10, "9")).toBe(-1); // "10" < "9"
    expect(comparePlain(10, 9)).toBe(1);
  });
  it("빈 값을 따로 다루지 않는다", () => {
    const rows = R("b", "", "a");
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }], "plain"))).toEqual(["", "a", "b"]);
  });
  it("사용자 비교 함수", () => {
    const rows = R(3, 1, 2);
    expect(keysOf(sortRows(rows, [{ key: "v", dir: "asc" }], (a, b) => b - a))).toEqual([3, 2, 1]);
  });
  it("compareSmart 기본", () => {
    expect(compareSmart("1,200", "999")).toBe(1);
  });
});

describe("nextSortDir: 없음 → desc → asc → 없음", () => {
  it("순환", () => {
    expect(nextSortDir(undefined)).toBe("desc");
    expect(nextSortDir("desc")).toBe("asc");
    expect(nextSortDir("asc")).toBeUndefined();
  });
});

describe("CellRange", () => {
  it("방향과 관계없이 경계를 구한다", () => {
    const g = new CellRange({ r: 5, c: 3 }, { r: 2, c: 1 });
    expect([g.r0, g.r1, g.c0, g.c1, g.size]).toEqual([2, 5, 1, 3, 12]);
    expect(g.contains(2, 1)).toBe(true);
    expect(g.contains(6, 1)).toBe(false);
  });
  it("clamp", () => {
    const g = new CellRange({ r: 0, c: 0 }, { r: 10, c: 10 }).clamp(3, 2);
    expect([g.r1, g.c1]).toEqual([2, 1]);
    expect(new CellRange({ r: 0, c: 0 }).clamp(0, 2)).toBeNull();
  });
});

describe("페이지 바 도우미", () => {
  it("pageNumbers는 현재 페이지를 가운데에 두고 끝에서는 밀린다", () => {
    expect(pageNumbers(0, 20, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(pageNumbers(10, 20, 5)).toEqual([8, 9, 10, 11, 12]);
    expect(pageNumbers(19, 20, 5)).toEqual([15, 16, 17, 18, 19]);
    expect(pageNumbers(1, 3, 5)).toEqual([0, 1, 2]);
    expect(pageNumbers(0, 0, 5)).toEqual([]);
  });
  it("targetPage", () => {
    const page = { currentPage: 3, totalPages: 10 };
    expect(targetPage("first", page)).toBe(0);
    expect(targetPage("prev", page)).toBe(2);
    expect(targetPage("next", page)).toBe(4);
    expect(targetPage("last", page)).toBe(9);
    expect(targetPage("6", page)).toBe(5);
    expect(targetPage("4", page)).toBeNull(); // 같은 페이지
    expect(targetPage("prev", { currentPage: 0, totalPages: 2 })).toBeNull();
  });
  it("상태 문구", () => {
    expect(defaultStatusHtml(statusData(0, 15, 300, null))).toBe("<span>1 - 15 of 300</span>");
    expect(defaultStatusHtml(statusData(290, 15, 300, { currentPage: 2, totalPages: 9, totalElements: 2500 }))).toBe(
      "<span>291 - 300 of 300&nbsp; Total 2,500</span>",
    );
    expect(defaultStatusHtml(statusData(0, 15, 0, null))).toBe("<span>0 - 0 of 0</span>");
  });
  it("선택 합계 문구", () => {
    expect(summaryText({ count: 1, numCount: 1, sum: 5 })).toBe("");
    expect(summaryText({ count: 3, numCount: 0, sum: 0 })).toBe("3 cells selected");
    expect(summaryText({ count: 4, numCount: 3, sum: 1000.5 })).toBe("4 cells selected · Numbers 3 · Sum 1,000.5 · Average 333.5");
    expect(formatNumber(1 / 3)).toBe("0.33");
  });
});

// 그리드에서 헤더 클릭·setSort로 정렬 (sorting.test.js에서 옮김)
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
