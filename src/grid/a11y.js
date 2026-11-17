// @ts-check
// 접근성 속성: 그리드 크기(aria-rowcount·colcount), 행·칸 위치(aria-rowindex·colindex), 활성 칸(aria-activedescendant).
// 가상 스크롤로 일부만 그려도 번호는 전체 기준이다. 다른 src/grid/ 모듈을 import하지 않는다 (순환 import 없음).
//
// 세는 법
// - 행: 헤더 줄(headerDepth) → 화면 행(grid.rows, 그룹 소계 행 포함, 트리는 펼친 행) → 합계 행(footSum 줄 수). 1부터.
// - 칸: 줄 번호·행 선택 칸(grid.aside) → 잎 컬럼(hidden 제외). 1부터.

/**
 * @template [Row=any]
 * @typedef {import("../grid.js").PyoGrid<Row>} Grid
 */

/**
 * 잎 컬럼 순번 → aria-colindex
 * @param {Grid} grid
 * @param {number} c
 * @returns {number}
 */
export function colIndex(grid, c) {
  return grid.aside.length + c + 1;
}

/**
 * 화면 순번 → aria-rowindex
 * @param {Grid} grid
 * @param {number} index
 * @returns {number}
 */
export function rowIndex(grid, index) {
  return grid.headerDepth + index + 1;
}

/**
 * 합계 행 순번 → aria-rowindex
 * @param {Grid} grid
 * @param {number} i
 * @returns {number}
 */
export function footRowIndex(grid, i) {
  return grid.headerDepth + grid.rows.length + i + 1;
}

/**
 * 칸 하나의 aria-colindex·aria-colspan 속성 글자
 * @param {Grid} grid
 * @param {number} from 잎 컬럼 순번 (포함)
 * @param {number} to 잎 컬럼 순번 (미포함)
 * @returns {string}
 */
export function colAttrs(grid, from, to) {
  const span = to - from;
  return ` aria-colindex="${colIndex(grid, from)}"` + (span > 1 ? ` aria-colspan="${span}"` : "");
}

/**
 * 활성 칸 요소의 id. 그리드마다 다르고(grid.id), 칸을 옮기면 값이 바뀐다 (스크린 리더가 바뀐 것을 알아채게).
 * @param {Grid} grid
 * @param {number} r
 * @param {number} c
 * @returns {string}
 */
export function activeCellId(grid, r, c) {
  return `${grid.id}-cell-${r}-${c}`;
}

/**
 * role=grid 요소의 aria-rowcount·aria-colcount
 * @param {Grid} grid
 * @returns {void}
 */
export function updateCounts(grid) {
  const el = grid.el.canvas;
  const fs = grid.options.footSum;
  const foot = Array.isArray(fs) ? fs.length : 0;
  setAttr(el, "aria-rowcount", String(grid.headerDepth + grid.rows.length + foot));
  setAttr(el, "aria-colcount", String(grid.aside.length + grid.leaves.length));
}

/**
 * 입력칸의 aria-activedescendant를 활성 칸에 맞춘다.
 * 편집 중이면 입력칸 자체를 읽어야 하므로 뗀다. 범위가 없거나 활성 칸이 그려지지 않았으면(화면 밖) 뗀다.
 * @param {Grid} grid
 * @returns {void}
 */
export function updateActiveDescendant(grid) {
  const input = grid.editing && grid.editing.input;
  if (!input) return;
  const g = grid.range;
  let id = null;
  if (g && !grid.editing.edit) {
    const want = activeCellId(grid, g.active.r, g.active.c);
    if (grid.el.body.querySelector(`[id="${want}"]`)) id = want;
  }
  if (id) setAttr(input, "aria-activedescendant", id);
  else if (input.hasAttribute("aria-activedescendant")) input.removeAttribute("aria-activedescendant");
}

/**
 * 값이 다를 때만 쓴다 (스크롤마다 부르므로 같은 값을 다시 쓰지 않게)
 * @param {Element} el
 * @param {string} name
 * @param {string} value
 */
function setAttr(el, name, value) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
