import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { filterRows, insertGroupRows, buildTree, computeMerge, collectors, numberOf } from "../../src/features/view.js";
import { sumCellValue } from "../../src/features/summary.js";
import { mockLayout, unmockLayout, rowEl, cellsOf, fire } from "./helpers.js";

describe("view 도우미", () => {
  it("filterRows: 키별 허용 값, 빈 값은 ''", () => {
    const rows = [{ a: "x", b: 1 }, { a: "y", b: 2 }, { a: null, b: 1 }];
    expect(filterRows(rows, new Map([["a", new Set(["x", ""])]]))).toEqual([rows[0], rows[2]]);
    expect(filterRows(rows, new Map([["a", new Set(["x", ""])], ["b", new Set(["1"])]]), "a")).toEqual([rows[0], rows[2]]);
  });

  it("insertGroupRows: 그룹 끝 뒤에 합계 행, 안쪽 단계가 먼저", () => {
    const rows = [
      { k: "A", s: 1, v: 1 }, { k: "A", s: 1, v: 2 }, { k: "A", s: 2, v: 3 }, { k: "B", s: 1, v: 4 },
    ];
    const out = insertGroupRows(rows, ["k", "s"]);
    const shape = out.map((r) => (r.__isGrouping ? `G${r.__depth}:${r.__groupingBy.labels.join("/")}(${r.__groupingList.length})` : r.v));
    expect(shape).toEqual([1, 2, "G1:A/1(2)", 3, "G1:A/2(1)", "G0:A(3)", 4, "G1:B/1(1)", "G0:B(1)"]);
    expect(insertGroupRows([], ["k"])).toEqual([]);
  });

  it("buildTree: 부모 키, 접힘, 형제 정렬, 없는 부모·순환은 맨 위", () => {
    const rows = [
      { id: 1, pid: "top", n: "루트" },
      { id: 3, pid: 1, n: "b" },
      { id: 2, pid: 1, n: "a" },
      { id: 4, pid: 2, n: "손자" },
      { id: 5, pid: 99, n: "부모 없음" },
      { id: 6, pid: 7, n: "순환1" },
      { id: 7, pid: 6, n: "순환2" },
    ];
    const cfg = { parentKey: "pid", selfKey: "id", collapseKey: "collapse" };
    const bySort = (s) => s.slice().sort((x, y) => (x.n < y.n ? -1 : 1));
    let t = buildTree(rows, cfg, bySort);
    expect(t.rows.map((r) => r.id)).toEqual([1, 2, 4, 3, 5, 6, 7]);
    expect(t.rows.map((r) => t.meta.get(r).depth)).toEqual([0, 1, 2, 1, 0, 0, 1]);
    rows[2].collapse = true;
    t = buildTree(rows, cfg, (s) => s);
    expect(t.rows.map((r) => r.id)).toEqual([1, 3, 2, 5, 6, 7]);
    expect(t.meta.get(rows[3]).depth).toBe(2); // 접힌 손자도 깊이를 안다
  });

  it("computeMerge: 같은 값 덩어리, 왼쪽 병합 컬럼이 끊기면 끊긴다, 편집기 컬럼 제외", () => {
    const leaves = [{ def: { key: "a" } }, { def: { key: "b" } }, { def: { key: "c", editor: { type: "text" } } }];
    const rows = [{ a: 1, b: "x", c: 1 }, { a: 1, b: "x", c: 1 }, { a: 2, b: "x", c: 1 }, { a: 2, b: "x", c: 1 }];
    const m = computeMerge(rows, leaves, true);
    expect([...m.get(0).start]).toEqual([0, 0, 2, 2]);
    expect([...m.get(1).start]).toEqual([0, 0, 2, 2]); // b는 모두 x지만 a가 끊기는 2행에서 끊긴다
    expect([...m.get(1).end]).toEqual([1, 1, 3, 3]);
    expect(m.has(2)).toBe(false);
    expect(computeMerge(rows, leaves, ["b"]).get(1).start[2]).toBe(0); // b만 병합하면 이어진다
  });

  it("collectors·numberOf·sumCellValue", () => {
    const list = [{ v: 1000 }, { v: "1,500" }, { v: "" }, { __isGrouping: true, v: 99 }];
    expect(collectors.sum.call({ key: "v", list })).toBe(2500);
    expect(collectors.avg.call({ key: "v", list })).toBe(1250); // 빈 값은 평균에 넣지 않는다
    expect(collectors.count.call({ key: "v", list })).toBe(3);
    expect(numberOf("abc12")).toBe(12);
    expect(sumCellValue({ label: "합계" }, list)).toBe("합계");
    expect(sumCellValue({ key: "v", collector: "sum", formatter: "money" }, list)).toBe("2,500");
    expect(sumCellValue({ key: "v", collector() { return this.list.length; } }, list)).toBe("4");
    expect(sumCellValue({ label() { return this.groupBy.labels[0] + " 소계"; } }, list, { labels: ["A"] })).toBe("A 소계");
    expect(sumCellValue({ key: "v" }, list)).toBe("");
  });
});

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
  vi.useRealTimers();
});

const cols = [
  { key: "team", label: "팀", width: 80 },
  { key: "name", label: "이름", width: 80 },
  { key: "qty", label: "수량", width: 80, editor: { type: "number" } },
];
const data = () => [
  { team: "A", name: "가", qty: 10 },
  { team: "B", name: "나", qty: 20 },
  { team: "A", name: "다", qty: 30 },
  { team: "C", name: "라", qty: 40 },
];

describe("footSum", () => {
  const footSum = [[{ label: "합계", colspan: 2, align: "center" }, { key: "qty", collector: "sum", formatter: "money", align: "right" }]];

  it("필터·편집을 따라 다시 계산된다, 높이만큼 보이는 행이 준다", () => {
    const grid = new PyoGrid(host, { columns: cols, footSum, filter: true });
    grid.setData(data());
    const foot = grid.el.foot;
    expect(foot.hidden).toBe(false);
    const cells = foot.querySelectorAll(".pyo-sum-cell");
    expect(cells[0].textContent).toBe("합계");
    expect(cells[0].style.width).toBe("160px");
    expect(cells[1].textContent).toBe("100");
    grid.setValue(0, "qty", 1000);
    expect(foot.querySelectorAll(".pyo-sum-cell")[1].textContent).toBe("1,090");
    grid.setFilter("team", ["A"]);
    expect(foot.querySelectorAll(".pyo-sum-cell")[1].textContent).toBe("1,030");
    expect(grid._footHeight).toBe(27);
  });

  it("고정 경계를 걸치는 칸은 고정 쪽에 글자, 줄 번호 칸은 빈칸", () => {
    const grid = new PyoGrid(host, { columns: cols, footSum, frozenColumns: 1, lineNumber: true });
    grid.setData(data());
    const fz = grid.el.foot.querySelector(".pyo-fz");
    const sc = grid.el.foot.querySelector(".pyo-sc");
    expect([...fz.children].map((c) => c.textContent)).toEqual(["", "합계"]);
    expect([...sc.children].map((c) => c.textContent)).toEqual(["", "100"]);
  });
});

describe("그룹 합계 (grouping)", () => {
  const grouping = {
    by: ["team"],
    columns: [{ label() { return this.groupBy.labels[0] + " 소계"; }, colspan: 2 }, { key: "qty", collector: "sum" }],
  };

  it("그룹 키로 정렬하고 각 그룹 뒤에 합계 행", () => {
    const grid = new PyoGrid(host, { columns: cols, grouping, lineNumber: true });
    grid.setData(data());
    const view = grid.getViewRows().map((r) => (r.__isGrouping ? "G" : r.name));
    expect(view).toEqual(["가", "다", "G", "나", "G", "라", "G"]);
    expect(grid.getRows().map((r) => r.name)).toEqual(["가", "다", "나", "라"]);
    const g = rowEl(grid, 2);
    expect(g.classList.contains("pyo-group-row")).toBe(true);
    expect([...g.querySelectorAll(".pyo-sum-cell")].map((c) => c.textContent)).toEqual(["", "A 소계", "40"]);
    // 줄 번호는 데이터 행만 센다
    expect(rowEl(grid, 3).querySelector('[data-special="lineNumber"]').textContent).toBe("3");
  });

  it("그룹 행은 선택·편집되지 않고, 값을 바꾸면 소계가 바뀐다", () => {
    const grid = new PyoGrid(host, { columns: cols, grouping, rowSelector: true });
    grid.setData(data());
    expect(grid.selectRow(2)).toBe(false);
    grid.selectAll();
    expect(grid.getSelectedRows()).toHaveLength(4);
    grid.setRange(2, 2);
    expect(grid.startEdit(2, 2)).toBe(false);
    grid.setValue(0, "qty", 15);
    expect(rowEl(grid, 2).querySelectorAll(".pyo-sum-cell")[2].textContent).toBe("45");
  });
});

describe("트리", () => {
  const treeData = () => [
    { id: "1", pid: "", name: "제품" },
    { id: "1-1", pid: "1", name: "부품 A" },
    { id: "1-1-1", pid: "1-1", name: "나사" },
    { id: "1-2", pid: "1", name: "부품 B" },
    { id: "2", pid: "top", name: "기타" },
  ];
  const tcols = [{ key: "name", label: "이름", width: 200, treeControl: true }, { key: "id", label: "ID" }];

  it("들여쓰기·펼침 단추, 단추를 누르면 접히고 getRows에는 남는다", () => {
    const grid = new PyoGrid(host, { columns: tcols, tree: { indentWidth: 12 } });
    grid.setData(treeData());
    expect(grid.getViewRows().map((r) => r.id)).toEqual(["1", "1-1", "1-1-1", "1-2", "2"]);
    const c = cellsOf(grid, 2)[0];
    expect(c.querySelector(".pyo-tree-indent").style.width).toBe("24px");
    expect(c.querySelector(".pyo-tree-text").textContent).toBe("나사");
    expect(cellsOf(grid, 1)[0].querySelector("[data-tree-toggle]").textContent).toBe("▾");
    expect(cellsOf(grid, 2)[0].querySelector("[data-tree-toggle]")).toBeNull();
    fire(cellsOf(grid, 1)[0].querySelector("[data-tree-toggle]"), "pointerdown");
    expect(grid.getViewRows().map((r) => r.id)).toEqual(["1", "1-1", "1-2", "2"]);
    expect(cellsOf(grid, 1)[0].querySelector("[data-tree-toggle]").textContent).toBe("▸");
    expect(grid.getRows()).toHaveLength(5);
    grid.collapseAll();
    expect(grid.getViewRows().map((r) => r.id)).toEqual(["1", "2"]);
    grid.expandAll();
    expect(grid.rowCount).toBe(5);
    expect(grid.getTreeInfo(grid.getRow(1))).toMatchObject({ depth: 1 });
  });

  it("HTML 아이콘, 접힌 자식도 전체 선택에 들어간다, 지우면 자손도", () => {
    const grid = new PyoGrid(host, {
      columns: tcols, rowSelector: true,
      tree: { icons: { openedArrow: '<i class="fa-down"></i>', collapsedArrow: '<i class="fa-right"></i>', itemIcon: "" } },
    });
    const rows = treeData();
    rows[0].collapse = true;
    grid.setData(rows);
    expect(grid.rowCount).toBe(2);
    expect(cellsOf(grid, 0)[1].querySelector(".fa-right")).not.toBeNull(); // 0번은 행 선택 칸
    grid.selectAll();
    expect(grid.getSelectedRows()).toHaveLength(5);
    grid.deleteRows(0);
    expect(grid.getDeletedRows().map((r) => r.id).sort()).toEqual(["1", "1-1", "1-1-1", "1-2"]);
    expect(grid.getRows().map((r) => r.id)).toEqual(["2"]);
  });
});

describe("셀 병합 (mergeCells)", () => {
  it("가운데 행에만 글자, 안쪽 가로선 없음", () => {
    const grid = new PyoGrid(host, { columns: cols, mergeCells: ["team"] });
    grid.setData([
      { team: "A", name: "1" }, { team: "A", name: "2" }, { team: "A", name: "3" }, { team: "B", name: "4" },
    ]);
    const t = [0, 1, 2, 3].map((i) => cellsOf(grid, i)[0]);
    // 글자는 모든 칸에 있고, 덩어리마다 가운데 행만 보인다 (나머지는 pyo-merge-hide로 숨김)
    expect(t.map((c) => c.textContent)).toEqual(["A", "A", "A", "B"]);
    expect(t.map((c) => c.classList.contains("pyo-merge-hide"))).toEqual([true, false, true, false]);
    expect(t.map((c) => c.classList.contains("pyo-merge-cont"))).toEqual([true, true, false, false]);
    expect(t[3].classList.contains("pyo-merged")).toBe(false);
    expect(cellsOf(grid, 0)[1].classList.contains("pyo-merged")).toBe(false);
  });
});

describe("헤더 값 필터", () => {
  it("필터 단추 → 팝업 값 목록 → 일부 해제 → 확인", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData(data());
    const events = [];
    grid.on("filterchange", (e) => events.push(e));
    grid.el.headSc.querySelector('[data-filter="0"]').click();
    const pop = document.querySelector(".pyo-filter");
    const labels = [...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim());
    expect(labels).toEqual(["A", "B", "C"]);
    pop.querySelectorAll(".pyo-f-list input")[1].click(); // B 해제
    pop.querySelector(".pyo-f-ok").click();
    expect(grid.getRows().map((r) => r.name)).toEqual(["가", "다", "라"]);
    expect(events[0]).toEqual({ filters: { team: ["A", "C"] }, count: 3 });
    expect(grid.el.headSc.querySelector('[data-filter="0"]').classList.contains("pyo-filter-on")).toBe(true);
    expect(document.querySelector(".pyo-filter")).toBeNull();
  });

  it("다른 컬럼 조건에 걸린 값만 목록에, 검색 뒤 확인은 검색 결과 중 체크한 것만", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData(data());
    grid.setFilter("team", ["A"]);
    grid.openFilter(1);
    let pop = document.querySelector(".pyo-filter");
    expect([...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim())).toEqual(["가", "다"]);
    pop.querySelector(".pyo-f-cancel").click();
    grid.clearFilters();
    grid.openFilter(1);
    pop = document.querySelector(".pyo-filter");
    const search = pop.querySelector(".pyo-f-search");
    search.value = "다";
    search.dispatchEvent(new Event("input"));
    pop.querySelector(".pyo-f-ok").click();
    expect(grid.getRows().map((r) => r.name)).toEqual(["다"]);
    expect(grid.el.empty.hidden).toBe(true);
    grid.setFilter("name", ["없음"]);
    expect(grid.el.empty.textContent).toBe("No rows match the filter");
  });

  it("초기화, 빈 값 표시, filter:false 컬럼, 트리에서는 필터 없음", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a", label: "A" }, { key: "b", filter: false }], filter: true });
    grid.setData([{ a: "" }, { a: "x" }]);
    expect(grid.el.headSc.querySelector('[data-filter="1"]')).toBeNull();
    grid.openFilter(0);
    const pop = document.querySelector(".pyo-filter");
    expect([...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim())).toEqual(["x", "(Blank)"]);
    pop.querySelectorAll(".pyo-f-list input")[0].click();
    pop.querySelector(".pyo-f-ok").click();
    expect(grid.getRows()).toHaveLength(1);
    grid.openFilter(0);
    document.querySelector(".pyo-f-clear").click();
    expect(grid.getRows()).toHaveLength(2);
    const t = new PyoGrid(document.body.appendChild(document.createElement("div")), { columns: [{ key: "a" }], filter: true, tree: {} });
    expect(t.el.headSc.querySelector("[data-filter]")).toBeNull();
  });

  it("setData 뒤에도 조건이 남는다, 필터로 숨은 행은 getAllRows에 있다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setFilter("team", ["B"]);
    grid.setData(data());
    expect(grid.getRows().map((r) => r.name)).toEqual(["나"]);
    expect(grid.getAllRows()).toHaveLength(4);
  });
});

describe("행 넣기·빼기·지우기", () => {
  it("addRow first/last/위치, 넣은 행은 __modified__", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(data());
    grid.addRow({ name: "처음" }, "first");
    grid.addRow([{ name: "끝1" }, { name: "끝2" }]);
    grid.addRow({ name: "중간" }, 2);
    expect(grid.getRows().map((r) => r.name)).toEqual(["처음", "가", "중간", "나", "다", "라", "끝1", "끝2"]);
    expect(grid.getModifiedRows().map((r) => r.name)).toEqual(["처음", "중간", "끝1", "끝2"]);
  });

  it("addRow focus: 넣은 행으로 이동", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(data());
    grid.addRow({ name: "새 행" }, "last", { focus: true });
    expect(grid.getRange().active).toEqual({ r: 4, c: 0 });
  });

  it("deleteRows는 getDeletedRows에 남기고 __deleted__, removeRows는 남기지 않는다, setData가 비운다", () => {
    const grid = new PyoGrid(host, { columns: cols, rowSelector: true });
    const rows = data();
    grid.setData(rows);
    grid.selectRow(1, true);
    grid.selectRow(3, true);
    grid.deleteRows(grid.getSelectedRows());
    expect(grid.getRows().map((r) => r.name)).toEqual(["가", "다"]);
    expect(grid.getDeletedRows()).toEqual([rows[1], rows[3]]);
    expect(rows[1].__deleted__).toBe(true);
    grid.removeRows(0);
    expect(grid.getRows().map((r) => r.name)).toEqual(["다"]);
    expect(grid.getDeletedRows()).toHaveLength(2);
    grid.setData(data());
    expect(grid.getDeletedRows()).toEqual([]);
  });

  it("replaceRow, 정렬 중 넣은 행도 정렬된 자리", () => {
    const grid = new PyoGrid(host, { columns: cols, sortable: true });
    grid.setData(data());
    grid.setSort([{ key: "qty", dir: "desc" }]);
    grid.addRow({ name: "큰", qty: 99 });
    expect(grid.getRow(0).name).toBe("큰");
    grid.replaceRow(1, { name: "바꿈", qty: 1 });
    expect(grid.getRows().map((r) => r.name)).toEqual(["큰", "다", "나", "가", "바꿈"]);
  });
});
