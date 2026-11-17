// @ts-check
// 컬럼 바꾸기, 크기·너비 계산, 스크롤 위치, 너비 조절 끌기
// PyoGrid의 메서드 구현. 공개 메서드와 JSDoc 설명은 grid.js의 클래스에 있고, 클래스는 여기 함수를 부르기만 한다.
import { buildColumnModel, computeWidths } from "../core/columns.js";
import { displayKeys, moveCandidates, sameFrozen } from "../features/column-order.js";
import { startColumnDrag } from "../features/column-drag.js";
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
  grid._order = null; // 순서는 지우고, stateKey 저장값이 있으면 _restoreState가 되살린다
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

/* ------------------------------------------------------------------
 * 컬럼 순서. 정의는 그대로 두고 grid._order(잎 key 목록)로 화면 순서를 정한다 (features/column-order.js)
 * ---------------------------------------------------------------- */

/**
 * 고정 잎 수. 레이아웃 전(생성자의 저장값 되살리기)에도 쓸 수 있게 옵션에서 바로 센다
 * @param {Grid} grid
 * @param {number} [n]
 */
function frozenOf(grid, n = grid.leaves.length) {
  return clamp(grid.options.frozenColumns | 0, 0, n);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {string[]}
 */
export function getColumnOrder(grid) {
  return grid.leaves.filter((l) => l.def.key !== undefined && l.def.key !== null).map((l) => String(l.def.key));
}

/**
 * 잎 번호, key, 정의 객체(그룹 포함) → 화면에 있는 정의 객체
 * @param {Grid} grid
 * @param {any} column
 * @returns {ColumnDef|null}
 */
function resolveColumn(grid, column) {
  if (typeof column === "number") {
    const leaf = grid.leaves[column];
    return leaf ? leaf.def : null;
  }
  if (typeof column === "string") {
    const leaf = grid.leaves.find((l) => l.def.key !== undefined && l.def.key !== null && String(l.def.key) === column);
    return leaf ? leaf.def : null;
  }
  if (column && typeof column === "object" && (grid.leaves.some((l) => l.def === column) || grid.headerCells.some((c) => c.def === column))) return column;
  return null;
}

/**
 * 컬럼 하나를 놓을 수 있는 자리들 (지금 자리 포함, 고정 경계를 넘는 자리 제외)
 * @param {Grid} grid
 * @param {ColumnDef} def
 * @returns {import("../features/column-order.js").MoveCandidate[]}
 */
export function _columnMoveTargets(grid, def) {
  return moveCandidates(grid.options.columns, grid._order, def, grid.leaves, frozenOf(grid));
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number|string|ColumnDef} column
 * @param {number} toIndex
 * @returns {boolean}
 */
export function moveColumn(grid, column, toIndex) {
  const def = resolveColumn(grid, column);
  if (!def || !Number.isInteger(toIndex)) return false;
  const cands = _columnMoveTargets(grid, def);
  const cur = cands.find((c) => c.same);
  if (!cur || toIndex === cur.index) return false;
  const pick = cands.find((c) => !c.same && c.index === toIndex);
  if (!pick) return false;
  return _applyColumnOrder(grid, pick.keys, { column: def, from: cur.index, to: pick.index });
}

/**
 * 키보드(Alt+Shift+←/→): 잎 c를 같은 부모 안에서 한 자리 옮긴다
 * @param {Grid} grid
 * @param {number} c
 * @param {number} dir -1 또는 1
 * @returns {boolean}
 */
export function _moveColumnStep(grid, c, dir) {
  const leaf = grid.leaves[c];
  if (!leaf) return false;
  const cands = _columnMoveTargets(grid, leaf.def);
  const cur = cands.find((x) => x.same);
  if (!cur) return false;
  let pick = null;
  for (const x of cands) {
    if (x.same) continue;
    if (dir > 0 ? x.index > cur.index && (!pick || x.index < pick.index) : x.index < cur.index && (!pick || x.index > pick.index)) pick = x;
  }
  if (!pick) return false;
  return _applyColumnOrder(grid, pick.keys, { column: leaf.def, from: cur.index, to: pick.index });
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string[]|null} keys
 * @returns {boolean}
 */
export function setColumnOrder(grid, keys) {
  if (keys !== null && keys !== undefined && !Array.isArray(keys)) return false;
  const next = Array.isArray(keys) ? keys.filter((k) => typeof k === "string") : null;
  const model = buildColumnModel(grid.options.columns, next);
  if (next && !sameFrozen(grid.leaves, model.leaves, frozenOf(grid))) return false;
  const changed = model.leaves.length !== grid.leaves.length || model.leaves.some((l, i) => l.def !== grid.leaves[i].def);
  if (!changed) {
    grid._order = next;
    grid._saveState();
    return true;
  }
  return _applyColumnOrder(grid, next, { column: null, from: -1, to: -1 });
}

/**
 * 순서를 바꾸고 다시 그린다. 너비·활성 칸은 컬럼을 따라가고, 범위는 활성 칸 하나로 줄인다.
 * 정렬·필터는 key로 들고 있어 그대로다. 편집 중이면 확정하고, 확정할 수 없으면 바꾸지 않는다.
 * @param {Grid} grid
 * @param {string[]|null} keys
 * @param {{column: ColumnDef|null, from: number, to: number}} ev
 * @returns {boolean}
 */
export function _applyColumnOrder(grid, keys, ev) {
  if (grid.editing.active && !grid.editing.commit()) return false;
  if (grid._filterPopup) grid._filterPopup.close();
  /** @type {Map<ColumnDef, number>} */
  const widthOf = new Map();
  grid.leaves.forEach((l) => {
    if (grid._userWidths[l.index] !== undefined) widthOf.set(l.def, grid._userWidths[l.index]);
  });
  const rng = grid.range;
  const activeLeaf = rng ? grid.leaves[rng.active.c] : null;
  grid._order = keys;
  _setColumnsInternal(grid, grid.options.columns);
  /** @type {Record<number, number>} */
  const keep = {};
  grid.leaves.forEach((l) => {
    const w = widthOf.get(l.def);
    if (w !== undefined) keep[l.index] = w;
  });
  grid._userWidths = keep;
  layout(grid);
  if (rng) {
    const c = activeLeaf ? grid.leaves.findIndex((l) => l.def === activeLeaf.def) : -1;
    if (c >= 0) grid.setRange(rng.active.r, c);
    else grid.clearRange();
  }
  grid._saveState();
  grid.emit("columnmove", { column: ev.column, from: ev.from, to: ev.to, order: getColumnOrder(grid) });
  return true;
}

/**
 * 저장된 순서를 쓸 수 있는가 (고정 경계를 넘지 않는가). 생성자·setColumns의 되살리기에서 부른다
 * @param {Grid} grid
 * @param {string[]} order
 * @returns {boolean}
 */
export function _canRestoreOrder(grid, order) {
  const model = buildColumnModel(grid.options.columns, order);
  return sameFrozen(grid.leaves, model.leaves, frozenOf(grid));
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
  const model = buildColumnModel(grid.options.columns, grid._order);
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
  // 순서는 유지한다. 새 컬럼은 정의 자리에 놓인 그대로 순서에 넣어, 뒤에 다른 컬럼을 빼거나 바꿔도 제자리에 있게 한다
  if (grid._order) grid._order = displayKeys(grid.options.columns, grid._order);
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
  if (!t || !t.matches) return;
  if (!t.matches(".pyo-resizer")) {
    if (grid.options.columnReorder) {
      if (grid._colDragCleanup) grid._colDragCleanup();
      startColumnDrag(grid, e, {
        targets: (def) => _columnMoveTargets(grid, def),
        apply: (keys, ev) => _applyColumnOrder(grid, keys, ev),
        dragged: () => (grid._justDragged = Date.now()),
        setCleanup: (fn) => (grid._colDragCleanup = fn),
      });
    }
    return;
  }
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
