// @ts-check
// 컬럼 바꾸기, 크기·너비 계산, 스크롤 위치, 너비 조절 끌기
// PyoGrid의 메서드 구현. 공개 메서드와 JSDoc 설명은 grid.js의 클래스에 있고, 클래스는 여기 함수를 부르기만 한다.
import { buildColumnModel, computeWidths } from "../core/columns.js";
import { h, clamp } from "../util.js";

/**
 * @template [Row=any]
 * @typedef {import("../grid.js").PyoGrid<Row>} Grid
 */
/**
 * @template [Row=any]
 * @typedef {import("../grid.js").ColumnDef<Row>} ColumnDef
 */

/** 스크롤바 너비를 잴 수 없을 때(화면에 붙지 않음, jsdom) 쓰는 값. CSS ::-webkit-scrollbar 너비와 같다 */
const SCROLLBAR = 15;

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {ColumnDef[]} columns
 * @returns {Grid<Row>}
 */
export function setColumns(grid, columns) {
  grid.editing.cancel();
  grid._userWidths = {};
  _setColumnsInternal(grid, columns);
  _afterColumnsChanged(grid, true);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {boolean} restore
 * @returns {void}
 */
export function _afterColumnsChanged(grid, restore) {
  const leafOf = new Map(grid.leaves.map((l) => [l.def.key, l]));
  let filterPruned = false;
  for (const k of [...grid.filters.keys()]) {
    const leaf = leafOf.get(k);
    if (!leaf || !grid.isFilterable(leaf)) {
      grid.filters.delete(k);
      filterPruned = true;
    }
  }
  for (const k of [...grid._filterConds.keys()]) {
    const leaf = leafOf.get(k);
    if (!leaf || !grid.isFilterable(leaf)) {
      grid._filterConds.delete(k);
      filterPruned = true;
    }
  }
  const sortBefore = JSON.stringify(grid.sort);
  grid.sort = grid.sort.filter((s) => {
    const leaf = leafOf.get(s.key);
    return leaf && grid.isSortable(leaf);
  });
  const sortPruned = JSON.stringify(grid.sort) !== sortBefore;
  if (restore) grid._restoreState();
  const sortChanged = JSON.stringify(grid.sort) !== sortBefore;
  if (filterPruned || sortChanged) {
    grid._applyView();
    grid.range = null;
  }
  layout(grid);
  if (filterPruned) grid.emit("filterchange", { filters: grid.getFilters(), conditions: grid.getFilterConditions(), count: grid.dataRows.length });
  if (sortPruned) grid.emit("sortchange", { sort: grid.getSort() });
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {ColumnDef[]}
 */
export function getColumns(grid) {
  return grid.options.columns;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {ColumnDef} column
 * @param {number} [index]
 * @returns {Grid<Row>}
 */
export function addColumn(grid, column, index) {
  const cols = grid.options.columns.slice();
  const at = index === undefined || index === null || index < 0 || index > cols.length ? cols.length : index;
  cols.splice(at, 0, column);
  _replaceColumns(grid, cols);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} [index]
 * @returns {Grid<Row>}
 */
export function removeColumn(grid, index) {
  const cols = grid.options.columns.slice();
  if (!cols.length) return grid;
  const at = index === undefined || index === null ? cols.length - 1 : index;
  if (at < 0 || at >= cols.length) return grid;
  cols.splice(at, 1);
  _replaceColumns(grid, cols);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {ColumnDef} column
 * @param {number} index
 * @returns {Grid<Row>}
 */
export function updateColumn(grid, column, index) {
  const cols = grid.options.columns.slice();
  if (index < 0 || index >= cols.length) return grid;
  cols[index] = column;
  _replaceColumns(grid, cols);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} leafIndex
 * @param {number} width
 * @returns {Grid<Row>}
 */
export function setColumnWidth(grid, leafIndex, width) {
  if (!grid.leaves[leafIndex]) return grid;
  grid._userWidths[leafIndex] = Math.max(grid.options.minColumnWidth, Math.round(width));
  layout(grid);
  grid._saveState();
  grid.emit("columnresize", { index: leafIndex, column: grid.leaves[leafIndex].def, width: grid._userWidths[leafIndex] });
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {number[]}
 */
export function getColumnWidths(grid) {
  return grid.widths.slice();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function layout(grid) {
  if (grid._destroyed) return grid;
  if (grid.range) grid.range = grid.range.clamp(grid.rows.length, grid.leaves.length);
  _computeLayout(grid);
  grid._renderHeader();
  _updateBodySize(grid);
  grid.refresh();
  grid._renderPageNav();
  grid.editing.position();
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _measure(grid) {
  const s = grid.el.scroll;
  grid._vw = s.clientWidth;
  grid._vh = s.clientHeight;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @param {"nearest" | "top"} [align]
 * @returns {Grid<Row>}
 */
export function scrollToRow(grid, index, align = "nearest") {
  const s = grid.el.scroll;
  const rh = grid.options.rowHeight;
  const top = index * rh;
  const viewH = grid._vh - grid._headerHeight - grid._footHeight;
  if (align === "top" || top < s.scrollTop) s.scrollTop = top;
  else if (top + rh > s.scrollTop + viewH) s.scrollTop = top + rh - viewH;
  grid._render();
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} r
 * @param {number} c
 * @returns {Grid<Row>}
 */
export function scrollToCell(grid, r, c) {
  scrollToRow(grid, r);
  if (c >= grid.frozenCount && grid.leaves[c]) {
    const s = grid.el.scroll;
    const viewW = grid._vw - grid.fzWidth;
    const x0 = grid.leafX[c];
    const x1 = x0 + grid.widths[c];
    if (x0 < s.scrollLeft) s.scrollLeft = x0;
    else if (x1 > s.scrollLeft + viewW) s.scrollLeft = x1 - viewW;
    grid._render();
  }
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number | string | null} height
 * @returns {Grid<Row>}
 */
export function setHeight(grid, height) {
  grid.options.height = typeof height === "number" ? height : null;
  if (height === null || height === undefined) grid.el.root.style.height = "";
  else grid.el.root.style.height = typeof height === "number" ? height + "px" : height;
  layout(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _checkSize(grid) {
  const r = grid.el.root;
  const size = r.clientWidth + "x" + r.clientHeight;
  if (size === grid._lastSize) return;
  grid._lastSize = size;
  layout(grid);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {ColumnDef[]} columns
 * @returns {void}
 */
export function _setColumnsInternal(grid, columns) {
  grid.options.columns = Array.isArray(columns) ? columns : [];
  const model = buildColumnModel(grid.options.columns);
  grid.leaves = model.leaves;
  grid.headerCells = model.header;
  grid.headerDepth = model.depth;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {ColumnDef[]} cols
 * @returns {void}
 */
export function _replaceColumns(grid, cols) {
  grid.editing.cancel();
  const byDef = new Map();
  grid.leaves.forEach((leaf) => {
    if (grid._userWidths[leaf.index] !== undefined) byDef.set(leaf.def, grid._userWidths[leaf.index]);
  });
  _setColumnsInternal(grid, cols);
  /** @type {Record<number, number>} */
  const keep = {};
  grid.leaves.forEach((leaf) => {
    if (byDef.has(leaf.def)) keep[leaf.index] = byDef.get(leaf.def);
  });
  grid._userWidths = keep;
  _afterColumnsChanged(grid, false);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {number}
 */
export function _scrollbarWidth(grid) {
  if (grid._sbw !== undefined) return grid._sbw;
  const probe = h("div", "pyo-scroll");
  probe.style.cssText = "position:absolute;visibility:hidden;overflow:scroll;width:100px;height:100px;top:0;left:0";
  grid.el.root.append(probe);
  const measured = probe.offsetWidth > 0;
  const w = measured ? probe.offsetWidth - probe.clientWidth : SCROLLBAR;
  probe.remove();
  const out = w >= 0 && w < 100 ? w : SCROLLBAR;
  // 화면에 붙기 전이라 잴 수 없었던 값은 기억하지 않는다
  if (measured) grid._sbw = out;
  return out;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _computeLayout(grid) {
  const o = grid.options;
  const aside = [];
  if (o.lineNumber) aside.push({ special: "lineNumber", width: o.lineNumberWidth });
  if (o.rowSelector) aside.push({ special: "rowSelector", width: o.rowSelectorWidth });
  grid.aside = aside;
  const asideW = aside.reduce((s, a) => s + a.width, 0);

  // 스크롤바 너비를 항상 빼고 계산해서, 행 수에 따라 "*" 너비가 바뀌지 않게 한다
  const available = grid.el.root.clientWidth - asideW - _scrollbarWidth(grid);
  grid.widths = computeWidths(grid.leaves, available, { defaultWidth: o.defaultColumnWidth, override: grid._userWidths });

  const frozen = clamp(o.frozenColumns | 0, 0, grid.leaves.length);
  grid.frozenCount = frozen;

  // x 좌표: 고정 영역은 보조 컬럼 다음부터, 스크롤 영역은 0부터
  const leafX = new Array(grid.leaves.length);
  let x = asideW;
  for (let i = 0; i < frozen; i++) {
    leafX[i] = x;
    x += grid.widths[i];
  }
  grid.fzWidth = x;
  let sx = 0;
  for (let i = frozen; i < grid.leaves.length; i++) {
    leafX[i] = sx;
    sx += grid.widths[i];
  }
  grid.leafX = leafX;
  grid.scWidth = sx;
  grid.asideWidth = asideW;
  grid.totalWidth = grid.fzWidth + grid.scWidth;
  // 헤더 바깥 높이 = 줄 수 × 줄 높이 + 아래 테두리 1px
  grid._headerHeight = grid.headerDepth * o.headerRowHeight + 1;
  // 합계 행 높이 = 줄 수 × 행 높이 + 위 테두리 1px
  const footRows = Array.isArray(o.footSum) ? o.footSum.length : 0;
  grid._footHeight = footRows ? footRows * o.rowHeight + 1 : 0;
  const pageH = o.pageBar ? o.pageHeight : 0;

  const e = grid.el;
  e.canvas.style.width = grid.totalWidth + "px";
  e.root.classList.toggle("pyo-has-frozen", frozen > 0);
  e.root.classList.toggle("pyo-cell-select", !!o.cellSelect);
  e.head.style.height = grid._headerHeight + "px";
  e.headFz.style.width = grid.fzWidth + "px";
  e.headSc.style.width = grid.scWidth + "px";
  e.scroll.style.setProperty("--pyo-head-h", grid._headerHeight + "px");
  e.scroll.style.bottom = pageH + "px";
  e.pagebar.hidden = !o.pageBar;
  e.pagebar.style.height = pageH + "px";
  e.root.style.setProperty("--pyo-row-h", o.rowHeight + "px");
  e.root.style.setProperty("--pyo-head-row-h", o.headerRowHeight + "px");
  e.empty.style.top = grid._headerHeight + "px";
  e.empty.style.bottom = pageH + grid._footHeight + "px";
  e.foot.style.height = grid._footHeight + "px";
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _updateBodySize(grid) {
  grid.el.body.style.height = grid.rows.length * grid.options.rowHeight + "px";
  const emptyText = grid.options.emptyText === undefined ? grid.messages.empty : grid.options.emptyText;
  const msg = grid.isFilterActive() ? grid.messages.noFilterMatch : emptyText;
  const showEmpty = !grid.rows.length && !!msg;
  grid.el.empty.textContent = showEmpty ? msg : "";
  grid.el.empty.hidden = !showEmpty;
  grid._renderStatus();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {PointerEvent} e
 * @returns {void}
 */
export function _onHeaderPointerDown(grid, e) {
  const t = /** @type {HTMLElement} */ (e.target);
  if (!t || !t.matches || !t.matches(".pyo-resizer")) return;
  e.preventDefault();
  e.stopPropagation();
  const leafIndex = Number(t.dataset.resize);
  const startX = e.clientX;
  const startW = grid.widths[leafIndex];
  const min = grid.options.minColumnWidth;
  const rootRect = grid.el.root.getBoundingClientRect();
  const cellRect = /** @type {HTMLElement} */ (t.parentElement).getBoundingClientRect();
  const cellLeft = cellRect.right - startW;
  const guide = grid.el.guide;
  guide.style.display = "block";
  /** @param {number} dx */
  const place = (dx) => {
    const w = Math.max(min, startW + dx);
    guide.style.left = cellLeft - rootRect.left + w - 1 + "px";
    return w;
  };
  place(0);
  grid.el.root.classList.add("pyo-resizing");
  try {
    t.setPointerCapture(e.pointerId);
  } catch (err) {
    /* jsdom 등 */
  }
  /** @param {PointerEvent} ev */
  const move = (ev) => place(ev.clientX - startX);
  /** @param {PointerEvent} ev */
  const up = (ev) => {
    const w = place(ev.clientX - startX);
    _endResize(grid);
    grid._justResized = Date.now();
    if (w !== startW) setColumnWidth(grid, leafIndex, w);
  };
  grid._resizeCleanup = () => {
    t.removeEventListener("pointermove", move);
    t.removeEventListener("pointerup", up);
    t.removeEventListener("pointercancel", up);
  };
  t.addEventListener("pointermove", move);
  t.addEventListener("pointerup", up);
  t.addEventListener("pointercancel", up);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _endResize(grid) {
  if (grid._resizeCleanup) grid._resizeCleanup();
  grid._resizeCleanup = null;
  if (grid.el && !grid._destroyed) {
    grid.el.guide.style.display = "none";
    grid.el.root.classList.remove("pyo-resizing");
  }
}

/* 내부용 접근 함수: features/가 그리드의 _ 필드를 직접 읽지 않게 한다. 클래스 멤버가 아니라서 .d.ts에 나오지 않는다. */

/**
 * 헤더 높이 (px, _computeLayout에서 정한 값)
 * @param {Grid} grid
 * @returns {number}
 */
export function headerHeight(grid) {
  return grid._headerHeight;
}

/**
 * 스크롤 영역의 보이는 높이 (px, _measure에서 읽어 둔 값). 스크롤 중에 레이아웃을 다시 읽지 않으려고 기억해 둔 값을 쓴다
 * @param {Grid} grid
 * @returns {number}
 */
export function viewportHeight(grid) {
  return grid._vh;
}
