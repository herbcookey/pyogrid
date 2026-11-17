// 접근성: 그리드 크기(aria-rowcount·colcount), 행·칸 위치(aria-rowindex·colindex), 활성 칸(aria-activedescendant), ARIA 부모·자식
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows, rowEl } from "./helpers.js";

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

const gridEl = (grid) => grid.el.root.querySelector('[role="grid"]');
const num = (el, a) => Number(el.getAttribute(a));

describe("그리드 크기", () => {
  it("aria-rowcount = 헤더 줄 + 화면 행(그룹 소계 포함) + 합계 행, aria-colcount = 줄 번호·행 선택 칸 + 잎 컬럼", () => {
    const grid = new PyoGrid(host, {
      lineNumber: true,
      rowSelector: true,
      columns: [{ key: "team" }, { label: "묶음", columns: [{ key: "name" }, { key: "qty" }] }, { key: "memo", hidden: true }],
      grouping: { by: ["team"], columns: [{ label: "소계" }] },
      footSum: [[{ label: "합계" }], [{ label: "평균" }]],
    });
    grid.setData([
      { team: "A", name: "가", qty: 1 },
      { team: "A", name: "나", qty: 2 },
      { team: "B", name: "다", qty: 3 },
    ]);
    const g = gridEl(grid);
    expect(g).not.toBeNull();
    expect(num(g, "aria-rowcount")).toBe(2 + 5 + 2); // 헤더 2줄, 데이터 3 + 소계 2, 합계 2줄
    expect(num(g, "aria-colcount")).toBe(2 + 3); // 줄 번호·행 선택 + team·name·qty (hidden은 빠진다)
  });

  it("행·컬럼이 바뀌면 개수도 바뀐다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "name" }] });
    grid.setData(makeRows(10));
    const g = gridEl(grid);
    expect(num(g, "aria-rowcount")).toBe(11);
    grid.addRow({ id: 99 });
    expect(num(g, "aria-rowcount")).toBe(12);
    grid.setFilter("id", [1, 2]);
    expect(num(g, "aria-rowcount")).toBe(1 + 3); // 1, 2와 저장 전에 넣은 행
    grid.addColumn({ key: "qty" });
    expect(num(g, "aria-colcount")).toBe(3);
  });
});

describe("행·칸 위치 (가상 스크롤로 일부만 그려도 전체 기준)", () => {
  it("본문 행 aria-rowindex는 헤더 줄 다음부터, 칸 aria-colindex는 줄 번호 칸 다음부터", () => {
    const grid = new PyoGrid(host, { lineNumber: true, columns: [{ key: "id" }, { key: "name" }] });
    grid.setData(makeRows(10000));
    grid.el.scroll.scrollTop = 26 * 5000;
    grid.refresh();
    const el = rowEl(grid, 5000);
    expect(num(el, "aria-rowindex")).toBe(1 + 5000 + 1);
    const cells = [...el.querySelectorAll('[role="gridcell"]')];
    expect(cells.map((c) => num(c, "aria-colindex"))).toEqual([1, 2, 3]); // 줄 번호, id, name
    expect(el.querySelector('[role="gridcell"][aria-colindex="1"]').textContent).toBe("5001");
  });

  it("가로로 스크롤해 앞 컬럼을 그리지 않아도 칸 번호는 컬럼 순번을 따른다", () => {
    const columns = Array.from({ length: 100 }, (_, i) => ({ key: "c" + i, width: 100 }));
    const grid = new PyoGrid(host, { columns, rowSelector: true });
    grid.setData([Object.fromEntries(columns.map((c) => [c.key, c.key]))]);
    grid.el.scroll.scrollLeft = 100 * 60;
    grid.refresh();
    const cells = [...rowEl(grid, 0).querySelectorAll('.pyo-sc [role="gridcell"]')];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(num(cell, "aria-colindex")).toBe(1 + Number(cell.dataset.c) + 1);
    expect(num(cells[0], "aria-colindex")).toBeGreaterThan(50);
  });

  it("헤더: columnheader는 모두 role=row 안에 있고, 줄 번호는 aria-rowindex, 묶음 헤더는 aria-colspan, 여러 줄에 걸친 칸은 aria-rowspan", () => {
    const grid = new PyoGrid(host, {
      lineNumber: true,
      frozenColumns: 1,
      columns: [{ key: "a", label: "A" }, { label: "묶음", columns: [{ key: "b", label: "B" }, { key: "c", label: "C" }] }],
    });
    grid.setData(makeRows(1));
    const all = [...grid.el.head.querySelectorAll('[role="columnheader"]')];
    expect(all.every((h) => h.parentElement.getAttribute("role") === "row")).toBe(true);
    const info = (h) => [h.textContent, num(h.parentElement, "aria-rowindex"), num(h, "aria-colindex"), h.getAttribute("aria-colspan"), h.getAttribute("aria-rowspan")];
    expect(all.map(info)).toEqual([
      ["", 1, 1, null, "2"], // 줄 번호 (고정 쪽)
      ["A", 1, 2, null, "2"],
      ["묶음", 1, 3, "2", null], // 스크롤 쪽
      ["B", 2, 3, null, null],
      ["C", 2, 4, null, null],
    ]);
    // 고정 쪽·스크롤 쪽 상자에 줄 요소가 따로 있다 (배치를 바꾸지 않으려고)
    expect([...grid.el.headFz.children].map((r) => r.getAttribute("aria-rowindex"))).toEqual(["1"]);
    expect([...grid.el.headSc.children].map((r) => r.getAttribute("aria-rowindex"))).toEqual(["1", "2"]);
  });

  it("고정 칸도 줄 번호 칸도 없으면 고정 쪽 상자는 비어 있다 (:empty 그림자 그대로)", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a" }, { key: "b" }] });
    grid.setData(makeRows(1));
    expect(grid.el.headFz.innerHTML).toBe("");
  });

  it("고정 경계를 걸치는 묶음 헤더는 조각마다 자기 칸 번호와 칸 수를 갖는다", () => {
    const grid = new PyoGrid(host, { frozenColumns: 1, columns: [{ label: "묶음", columns: [{ key: "a" }, { key: "b" }, { key: "c" }] }] });
    grid.setData(makeRows(1));
    const groups = [...grid.el.head.querySelectorAll(".pyo-hgroup")].map((el) => [num(el, "aria-colindex"), el.getAttribute("aria-colspan")]);
    expect(groups).toEqual([
      [1, null],
      [2, "2"],
    ]);
  });

  it("합계 행과 그룹 소계 행은 role=row, 칸은 role=gridcell과 칸 번호", () => {
    const grid = new PyoGrid(host, {
      lineNumber: true,
      columns: [{ key: "team" }, { key: "qty" }, { key: "x" }],
      grouping: { by: ["team"], columns: [{ label: "소계", colspan: 2 }] },
      footSum: [[{ label: "합계" }, { key: "qty", collector: "sum" }]],
    });
    grid.setData([{ team: "A", qty: 1 }]);
    const foot = grid.el.foot.querySelector(".pyo-foot-row");
    expect(foot.getAttribute("role")).toBe("row");
    expect(num(foot, "aria-rowindex")).toBe(1 + 2 + 1); // 헤더 1, 데이터 1 + 소계 1 뒤
    expect([...foot.querySelectorAll('[role="gridcell"]')].map((c) => [num(c, "aria-colindex"), c.getAttribute("aria-colspan")])).toEqual([
      [1, null],
      [2, null],
      [3, null],
      [4, null],
    ]);
    const group = rowEl(grid, 1);
    expect(group.classList.contains("pyo-group-row")).toBe(true);
    expect(num(group, "aria-rowindex")).toBe(3);
    expect([...group.querySelectorAll('[role="gridcell"]')].map((c) => [num(c, "aria-colindex"), c.getAttribute("aria-colspan")])).toEqual([
      [1, null],
      [2, "2"],
      [4, null],
    ]);
  });
});

describe("활성 칸 (aria-activedescendant)", () => {
  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "name", editor: { type: "text" } }] });
    grid.setData(makeRows(10000));
    return { grid, input: grid.editing.input };
  };
  const active = (grid) => grid.el.body.querySelector(".pyo-active");

  it("입력칸이 활성 칸을 가리키고, 칸을 옮기면 따라간다", () => {
    const { grid, input } = setup();
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    grid.setRange(2, 1);
    const id = input.getAttribute("aria-activedescendant");
    expect(id).toBeTruthy();
    expect(document.getElementById(id)).toBe(active(grid));
    grid.setRange(3, 0);
    const id2 = input.getAttribute("aria-activedescendant");
    expect(id2).not.toBe(id);
    expect(document.getElementById(id2)).toBe(active(grid));
    expect(document.getElementById(id)).toBeNull(); // 앞 칸에서는 id를 뗀다
  });

  it("범위를 넓히면 끝 칸(getActiveCell)을 가리킨다", () => {
    const { grid, input } = setup();
    grid.setRange(1, 0, 4, 1);
    const el = document.getElementById(input.getAttribute("aria-activedescendant"));
    expect(el.closest(".pyo-row").dataset.row).toBe("4");
    expect(el.dataset.c).toBe("1");
  });

  it("활성 칸이 화면 밖이라 그려지지 않으면 속성을 떼고, 다시 그려지면 붙인다", () => {
    const { grid, input } = setup();
    grid.setRange(2, 1);
    grid.el.scroll.scrollTop = 26 * 5000;
    grid.refresh();
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    grid.el.scroll.scrollTop = 0;
    grid.refresh();
    expect(document.getElementById(input.getAttribute("aria-activedescendant"))).toBe(active(grid));
  });

  it("편집 중에는 떼고(입력칸 자체를 읽게), 편집이 끝나면 다시 붙인다. 범위를 지우면 뗀다", () => {
    const { grid, input } = setup();
    grid.setRange(2, 1);
    grid.startEdit(2, 1);
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    grid.cancelEdit();
    expect(document.getElementById(input.getAttribute("aria-activedescendant"))).toBe(active(grid));
    grid.startEdit(2, 1);
    grid.commitEdit();
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    grid.clearRange();
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("두 그리드의 id는 겹치지 않는다", () => {
    const { grid } = setup();
    const host2 = document.body.appendChild(document.createElement("div"));
    const g2 = new PyoGrid(host2, { columns: [{ key: "id" }, { key: "name" }] });
    g2.setData(makeRows(10));
    grid.setRange(2, 1);
    g2.setRange(2, 1);
    expect(grid.editing.input.getAttribute("aria-activedescendant")).not.toBe(g2.editing.input.getAttribute("aria-activedescendant"));
    g2.destroy();
    host2.remove();
  });
});

describe("ARIA 부모·자식과 이름", () => {
  it("role=grid 안에는 rowgroup·row만 있고, 입력칸과 아래 바는 grid 밖이다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }], footSum: [[{ label: "합계" }]] });
    grid.setData(makeRows(3));
    const g = gridEl(grid);
    expect([...g.children].map((c) => c.getAttribute("role"))).toEqual(["rowgroup", "rowgroup", "rowgroup"]);
    expect(g.contains(grid.editing.input)).toBe(false);
    expect(g.contains(grid.el.pagebar)).toBe(false);
  });

  it("체크박스에 이름이 있다: 헤더 전체 선택은 messages.selectAll, 체크박스 편집기 칸은 컬럼 label", () => {
    const grid = new PyoGrid(host, {
      rowSelector: true,
      locale: "ko",
      columns: [{ key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } }],
    });
    grid.setData([{ use: "Y" }]);
    expect(grid.el.head.querySelector('[role="checkbox"]').getAttribute("aria-label")).toBe(grid.messages.selectAll);
    expect(rowEl(grid, 0).querySelector('[role="checkbox"]').getAttribute("aria-label")).toBe("사용");
  });
});
