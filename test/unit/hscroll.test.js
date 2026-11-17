// 가로 스크롤: 보이는 컬럼 범위가 바뀌면 행을 다시 만들지 않고 벗어난 셀만 지우고 새 셀만 넣는다.
// 결과 DOM이 처음부터 다시 그린 DOM과 같은지 비교한다.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout } from "./helpers.js";

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

const N_COLS = 60;
const columns = () => [
  { key: "id", label: "번호", width: 60 },
  { key: "name", label: "이름", width: 80 },
  { label: "묶음", columns: Array.from({ length: N_COLS }, (_, c) => ({ key: "c" + c, label: "값" + c, width: 70, formatter: c % 7 === 0 ? "money" : undefined })) },
];
const rows = (n = 120) =>
  Array.from({ length: n }, (_, i) => {
    const r = { id: i, name: "행" + i, g: i < 40 ? "A" : "B" };
    for (let c = 0; c < N_COLS; c++) r["c" + c] = c === 3 ? "같음" + Math.floor(i / 4) : (i * 31 + c * 7) % 1000;
    return r;
  });

/** 행 순서·class 순서와 상관없이 비교할 수 있게 본문 DOM을 글자로 */
function snapshot(grid) {
  const body = grid.el.body.cloneNode(true);
  for (const el of body.querySelectorAll("[class]")) el.className = el.className.split(/\s+/).filter(Boolean).sort().join(" ");
  // style 글자는 넣은 방법(HTML 글자 / el.style)에 따라 띄어쓰기가 달라지므로 같은 모양으로 맞춘다
  for (const el of body.querySelectorAll("[style]")) el.setAttribute("style", el.style.cssText);
  // 속성 순서도 맞춘다 (그려 둔 칸에 나중에 id를 붙이면 id가 뒤에 온다)
  for (const el of body.querySelectorAll("*")) {
    const attrs = [...el.attributes].map((a) => [a.name, a.value]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    for (const [name] of attrs) el.removeAttribute(name);
    for (const [name, value] of attrs) el.setAttribute(name, value);
  }
  return [...body.children]
    .sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row))
    .map((r) => r.outerHTML)
    .join("\n");
}
/** 같은 상태에서 행을 모두 지우고 처음부터 다시 그린 DOM (refresh는 그린 행을 모두 지우고 다시 만든다) */
function fresh(grid) {
  grid.refresh();
  return snapshot(grid);
}
const scrollTo = (grid, x, y) => {
  if (x !== undefined) grid.el.scroll.scrollLeft = x;
  if (y !== undefined) grid.el.scroll.scrollTop = y;
  grid._render();
};
const scCells = (grid, r) => [...grid.el.body.querySelector(`.pyo-row[data-row="${r}"] .pyo-sc`).children].map((c) => Number(c.dataset.c));

describe("가로 스크롤: 셀 단위 갱신", () => {
  it("행 요소는 그대로 두고, 스크롤 영역 셀만 바꾸고 padding-left를 맞춘다. 고정 쪽은 그대로", () => {
    const grid = new PyoGrid(host, { columns: columns(), frozenColumns: 2, lineNumber: true });
    grid.setData(rows());
    const rowEl = grid.el.body.querySelector('.pyo-row[data-row="3"]');
    const fzEl = rowEl.querySelector(".pyo-fz");
    const fzHtml = fzEl.innerHTML;
    const before = scCells(grid, 3);
    scrollTo(grid, 700);
    expect(grid.el.body.querySelector('.pyo-row[data-row="3"]')).toBe(rowEl);
    expect(rowEl.querySelector(".pyo-fz")).toBe(fzEl);
    expect(fzEl.innerHTML).toBe(fzHtml);
    const after = scCells(grid, 3);
    expect(after).not.toEqual(before);
    expect(after).toEqual(Array.from({ length: grid._range.c1 - grid._range.c0 + 1 }, (_, k) => grid._range.c0 + k));
    expect(rowEl.querySelector(".pyo-sc").style.paddingLeft).toBe(grid.leafX[grid._range.c0] + "px");
  });

  it("오른쪽·왼쪽, 조금씩·크게(겹치지 않게) 스크롤한 뒤의 DOM이 다시 그린 DOM과 같다", () => {
    const grid = new PyoGrid(host, { columns: columns(), frozenColumns: 2, lineNumber: true, rowSelector: true });
    grid.setData(rows());
    for (const x of [40, 90, 200, 1500, 1530, 600, 0, 3000, 2950, 10]) {
      scrollTo(grid, x);
      const inc = snapshot(grid);
      expect(inc, `scrollLeft ${x}`).toBe(fresh(grid));
    }
  });

  it("세로·가로를 함께 스크롤해도 같다 (새로 생긴 행과 남은 행)", () => {
    const grid = new PyoGrid(host, { columns: columns(), frozenColumns: 1 });
    grid.setData(rows());
    for (const [x, y] of [[300, 100], [420, 400], [1200, 410], [0, 0], [2000, 1800]]) {
      scrollTo(grid, x, y);
      expect(snapshot(grid), `${x},${y}`).toBe(fresh(grid));
    }
  });

  it("셀 범위·활성 칸 표시, aria-colindex, 셀 병합, 그룹 합계 행이 그대로다", () => {
    const grid = new PyoGrid(host, {
      columns: columns(),
      frozenColumns: 2,
      mergeCells: ["c3"],
      grouping: { by: ["g"], columns: [{ label: "소계", colspan: 2 }, { key: "c0", collector: "sum" }] },
    });
    grid.setData(rows());
    grid.setRange(2, 3, 6, 9); // 활성 칸 (6, 9)
    for (const x of [100, 250, 700, 80]) {
      scrollTo(grid, x);
      expect(snapshot(grid), `scrollLeft ${x}`).toBe(fresh(grid));
    }
    // 활성 칸이 보이는 범위 안이면 그 칸에 id와 pyo-active, 입력칸이 그 칸을 가리킨다
    scrollTo(grid, 0);
    const active = grid.el.body.querySelector(".pyo-cell.pyo-active");
    expect(active.dataset.c).toBe("9");
    expect(active.getAttribute("aria-colindex")).toBe(String(9 + 1));
    expect(grid.editing.input.getAttribute("aria-activedescendant")).toBe(active.id);
    // 그룹 합계 행은 가로 가상 스크롤 없이 전부 그린 그대로 (A 그룹 40행 뒤)
    scrollTo(grid, 300, 26 * 36);
    expect(snapshot(grid)).toBe(fresh(grid));
    const gr = grid.el.body.querySelector(".pyo-group-row");
    expect(gr.querySelectorAll(".pyo-sum-cell").length).toBeGreaterThan(2);
  });

  it("옮긴 컬럼 순서로 셀을 넣는다", () => {
    const grid = new PyoGrid(host, { columns: columns(), frozenColumns: 2 });
    grid.setData(rows());
    grid.setColumnOrder(["id", "name", "c10", "c0", "c5"]);
    for (const x of [70, 500, 140]) {
      scrollTo(grid, x);
      expect(snapshot(grid), `scrollLeft ${x}`).toBe(fresh(grid));
    }
    const keys = [...grid.el.body.querySelector('.pyo-row[data-row="0"] .pyo-sc').children].map((c) => grid.leaves[Number(c.dataset.c)].key);
    expect(keys[0]).toBe(grid.leaves[grid._range.c0].key);
  });

  it("편집 중에 가로로 스크롤해도 편집이 이어지고 입력칸이 그 칸을 따라간다", () => {
    const cols = columns();
    cols[2].columns[4].editor = { type: "text" };
    const grid = new PyoGrid(host, { columns: cols, frozenColumns: 2 });
    grid.setData(rows());
    grid.startEdit(1, 6); // c4
    grid.editing.input.value = "입력 중";
    scrollTo(grid, 140);
    expect(grid.isEditing).toBe(true);
    expect(grid.editing.input.value).toBe("입력 중");
    expect(grid.commitEdit()).toBe(true);
    expect(grid.getAllRows()[1].c4).toBe("입력 중");
    expect(snapshot(grid)).toBe(fresh(grid));
  });
});
