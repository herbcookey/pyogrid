// @ts-check
// 그리기: 헤더, 본문 행과 셀, 합계 행, 셀 병합 표시, 아래 바
// PyoGrid의 메서드 구현. 공개 메서드와 JSDoc 설명은 grid.js의 클래스에 있고, 클래스는 여기 함수를 부르기만 한다.
import { formatters } from "../core/formatters.js";
import { navigationHtml, statusData, defaultStatusHtml, summaryText } from "../features/pagebar.js";
import { computeMerge } from "../features/view.js";
import { sumRowHtml } from "../features/summary.js";
import { editorTypes, selectOptions, isChecked } from "../editors/types.js";
import { escapeHtml, getValue, isFn, clamp } from "../util.js";
import { colAttrs, rowIndex, footRowIndex, activeCellId, updateCounts, updateActiveDescendant } from "./a11y.js";

/**
 * @template [Row=any]
 * @typedef {import("../grid.js").PyoGrid<Row>} Grid
 */
/** @typedef {import("../grid.js").HeaderCell} HeaderCell */

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function refresh(grid) {
  if (grid._destroyed) return grid;
  grid._measure();
  const mc = grid.options.mergeCells;
  if (!mc) grid._merge = new Map();
  else if (grid._mergeDirty || grid._mergeRows !== grid.rows || grid._mergeLeaves !== grid.leaves) {
    // 병합 덩어리는 행 목록·컬럼·병합 컬럼 값이 바뀔 때만 다시 센다 (셀 하나 고칠 때마다 전체를 세지 않게)
    grid._merge = computeMerge(grid.rows, grid.leaves, mc === true ? true : mc);
    grid._mergeRows = grid.rows;
    grid._mergeLeaves = grid.leaves;
    grid._mergeDirty = false;
  }
  _clearRows(grid);
  _render(grid);
  _renderFoot(grid);
  _renderStatus(grid);
  updateCounts(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @returns {Grid<Row>}
 */
export function refreshRow(grid, index) {
  const old = grid._rowEls.get(index);
  if (!old) return grid;
  const el = _createRow(grid, index);
  old.replaceWith(el);
  grid._rowEls.set(index, el);
  _paintMerge(grid);
  updateActiveDescendant(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _renderFoot(grid) {
  const fs = grid.options.footSum;
  const foot = grid.el.foot;
  if (!Array.isArray(fs) || !fs.length) {
    if (foot.innerHTML) foot.innerHTML = "";
    foot.hidden = true;
    return;
  }
  foot.hidden = false;
  const rh = grid.options.rowHeight;
  let html = "";
  fs.forEach((cells, i) => {
    html += `<div class="pyo-row pyo-foot-row" role="row" aria-rowindex="${footRowIndex(grid, i)}" data-foot="${i}" style="height:${rh}px;width:${grid.totalWidth}px">${sumRowHtml(grid, cells, grid.dataRows)}</div>`;
  });
  foot.innerHTML = html;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _renderHeader(grid) {
  const o = grid.options;
  const rh = o.headerRowHeight;
  const depth = grid.headerDepth;
  // 헤더 칸은 고정·스크롤 두 상자에 절대 위치로 놓인다. 상자 안에 줄마다 크기 없는 role=row를 두고 그 줄의 칸을 넣는다.
  // 이 줄 요소는 위치를 갖지 않아 칸의 기준 상자는 그대로 상자다 (배치가 바뀌지 않는다). 그래서 고정 칸이 있으면
  // 한 헤더 줄이 role=row 둘(고정 쪽, 스크롤 쪽)로 나뉘고, 둘은 같은 aria-rowindex를 갖는다.
  /** @type {string[][]} 줄마다 고정 쪽 칸 */
  const fz = Array.from({ length: depth }, () => []);
  /** @type {string[][]} 줄마다 스크롤 쪽 칸 */
  const sc = Array.from({ length: depth }, () => []);
  let ax = 0;
  grid.aside.forEach((a, k) => {
    const label = a.special === "rowSelector" && o.headerSelector ? ` aria-label="${escapeHtml(grid.messages.selectAll)}"` : "";
    const inner = a.special === "rowSelector" && o.headerSelector ? `<span class="pyo-check" role="checkbox" aria-checked="false"${label}></span>` : "";
    const span = depth > 1 ? ` aria-rowspan="${depth}"` : "";
    fz[0].push(
      `<div class="pyo-hcell pyo-aside pyo-al-center" role="columnheader" aria-colindex="${k + 1}"${span} data-special="${a.special}" style="left:${ax}px;top:0;width:${a.width}px;height:${depth * rh}px">${inner}</div>`,
    );
    ax += a.width;
  });
  const frozen = grid.frozenCount;
  for (const cell of grid.headerCells) {
    const end = cell.colStart + cell.colSpan; // 미포함
    // 고정 경계를 걸치는 묶음 헤더는 두 조각으로 나눠 양쪽에 같은 제목을 보여 준다
    if (cell.colStart < frozen) fz[cell.row].push(_headerCellHtml(grid, cell, cell.colStart, Math.min(end, frozen), rh));
    if (end > frozen) sc[cell.row].push(_headerCellHtml(grid, cell, Math.max(cell.colStart, frozen), end, rh));
  }
  // 칸이 없는 줄은 만들지 않는다 (빈 상자는 :empty로 그림자를 끈다)
  const rows = (/** @type {string[][]} */ levels) =>
    levels.map((cells, level) => (cells.length ? `<div class="pyo-hrow" role="row" aria-rowindex="${level + 1}">${cells.join("")}</div>` : "")).join("");
  grid.el.headFz.innerHTML = rows(fz);
  grid.el.headSc.innerHTML = rows(sc);
  _updateHeaderSelector(grid);
  updateCounts(grid);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {HeaderCell} cell
 * @param {number} from
 * @param {number} to
 * @param {number} rh
 * @returns {string}
 */
export function _headerCellHtml(grid, cell, from, to, rh) {
  const left = grid.leafX[from];
  let width = 0;
  for (let i = from; i < to; i++) width += grid.widths[i];
  const o = grid.options;
  const def = cell.def;
  const isLeaf = cell.leafIndex !== undefined;
  const align = def.headerAlign || o.headerAlign || (isLeaf ? null : "center");
  let cls = "pyo-hcell" + (align ? " pyo-al-" + align : "") + (isLeaf ? "" : " pyo-hgroup");
  if (def.headerClass) cls += " " + escapeHtml((isFn(def.headerClass) ? def.headerClass.call(def, def) : def.headerClass) || "");
  let attrs = "";
  let sortMark = "";
  if (isLeaf) {
    attrs = ` data-leaf="${cell.leafIndex}"` + (def.key !== undefined ? ` data-key="${escapeHtml(def.key)}"` : "");
    if (grid.isSortable(grid.leaves[cell.leafIndex])) {
      cls += " pyo-sortable";
      const s = grid.sort.find((x) => x.key === def.key);
      attrs += ` aria-sort="${s ? (s.dir === "asc" ? "ascending" : "descending") : "none"}"`;
      if (s) attrs += ` data-sort="${s.dir}"`;
      sortMark = '<span class="pyo-sort-mark"></span>';
    }
    if (grid.isFilterable(grid.leaves[cell.leafIndex])) {
      const on = grid.isFilterActive() && (grid.filters.has(def.key) || grid._filterConds.has(def.key));
      cls += " pyo-filterable";
      const filterLabel = escapeHtml(grid.messages.filter);
      sortMark += `<span class="pyo-filter-btn${on ? " pyo-filter-on" : ""}" data-filter="${cell.leafIndex}" role="button" aria-label="${filterLabel}" title="${filterLabel}"></span>`;
    }
  }
  const resizer = isLeaf && o.resizable && def.resizable !== false ? `<span class="pyo-resizer" data-resize="${cell.leafIndex}"></span>` : "";
  return (
    `<div class="${cls}"${attrs} role="columnheader"${colAttrs(grid, from, to)}${cell.rowSpan > 1 ? ` aria-rowspan="${cell.rowSpan}"` : ""} style="left:${left}px;top:${cell.row * rh}px;width:${width}px;height:${cell.rowSpan * rh}px">` +
    `<span class="pyo-hlabel">${def.html ? cell.label : escapeHtml(cell.label)}</span>${sortMark}${resizer}</div>`
  );
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _updateHeaderSelector(grid) {
  const box = grid.el.headFz.querySelector('[data-special="rowSelector"] .pyo-check');
  if (!box) return;
  let any = false;
  let all = true;
  for (const r of grid.rows) {
    if (!grid.isRowSelectable(r)) continue;
    any = true;
    if (!grid.isRowSelected(r)) {
      all = false;
      break;
    }
  }
  const on = any && all;
  box.classList.toggle("pyo-checked", on);
  box.setAttribute("aria-checked", on ? "true" : "false");
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {MouseEvent} e
 * @returns {void}
 */
export function _onHeaderClick(grid, e) {
  const t = /** @type {HTMLElement} */ (e.target);
  if (!t || !t.closest) return;
  if (t.closest(".pyo-resizer") || Date.now() - grid._justResized < 300) return;
  if (grid.editing.active && !grid.editing.commit()) grid.editing.cancel();
  const fb = /** @type {HTMLElement|null} */ (t.closest("[data-filter]"));
  if (fb) {
    grid.openFilter(Number(fb.dataset.filter), fb);
    return;
  }
  if (t.closest('[data-special="rowSelector"]')) {
    if (!grid.options.headerSelector || !grid.options.multipleSelect) return;
    const box = grid.el.headFz.querySelector('[data-special="rowSelector"] .pyo-check');
    grid.selectAll(!(box && box.classList.contains("pyo-checked")));
    return;
  }
  const cell = /** @type {HTMLElement|null} */ (t.closest(".pyo-hcell[data-leaf]"));
  if (!cell) return;
  grid.toggleSort(Number(cell.dataset.leaf));
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {{
        r0: any;
        r1: number;
        c0: number;
        c1: number;
    }}
 */
export function _visibleRange(grid) {
  const o = grid.options;
  const s = grid.el.scroll;
  const rh = o.rowHeight;
  const viewH = Math.max(0, grid._vh - grid._headerHeight - grid._footHeight);
  const n = grid.rows.length;
  const r0 = clamp(Math.floor(s.scrollTop / rh) - o.overscanRows, 0, Math.max(0, n - 1));
  const r1 = clamp(Math.ceil((s.scrollTop + viewH) / rh) + o.overscanRows, 0, n) - 1;

  // 스크롤 영역 컬럼 중 보이는 범위 (고정 컬럼은 항상 그린다)
  const frozen = grid.frozenCount;
  const last = grid.leaves.length - 1;
  let c0 = frozen;
  let c1 = last;
  if (grid._vw > 0 && frozen <= last) {
    const leftEdge = s.scrollLeft;
    const rightEdge = s.scrollLeft + Math.max(0, grid._vw - grid.fzWidth);
    while (c0 < last && grid.leafX[c0] + grid.widths[c0] <= leftEdge) c0++;
    c1 = c0;
    while (c1 < last && grid.leafX[c1 + 1] < rightEdge) c1++;
    c0 = Math.max(frozen, c0 - o.overscanColumns);
    c1 = Math.min(last, c1 + o.overscanColumns);
  }
  return { r0, r1, c0, c1 };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _render(grid) {
  if (grid._destroyed) return;
  const next = _visibleRange(grid);
  const cur = grid._range;
  if (next.c0 !== cur.c0 || next.c1 !== cur.c1) _clearRows(grid);
  for (const [i, el] of grid._rowEls) {
    if (i < next.r0 || i > next.r1) {
      el.remove();
      grid._rowEls.delete(i);
    }
  }
  grid._range = next;
  if (next.r1 < next.r0) return;
  const frag = document.createDocumentFragment();
  for (let i = next.r0; i <= next.r1; i++) {
    if (grid._rowEls.has(i)) continue;
    const el = _createRow(grid, i);
    grid._rowEls.set(i, el);
    frag.append(el);
  }
  grid.el.body.append(frag);
  _paintMerge(grid);
  updateActiveDescendant(grid);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _paintMerge(grid) {
  if (!grid._merge.size || !grid._rowEls.size) return;
  const rh = grid.options.rowHeight;
  const s = grid.el.scroll;
  const viewH = Math.max(rh, grid._vh - grid._headerHeight - grid._footHeight);
  const v0 = Math.floor(s.scrollTop / rh);
  const v1 = Math.max(v0, Math.ceil((s.scrollTop + viewH) / rh) - 1);
  for (const [c, mg] of grid._merge) {
    for (const [r, el] of grid._rowEls) {
      const st = mg.start[r];
      const en = mg.end[r];
      if (st === en) continue;
      const cell = el.querySelector(`.pyo-cell[data-c="${c}"]`);
      if (!cell) continue;
      const a = Math.max(st, v0);
      const b = Math.min(en, v1);
      const label = a <= b ? a + ((b - a) >> 1) : st + ((en - st) >> 1);
      cell.classList.toggle("pyo-merge-hide", r !== label);
    }
  }
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _clearRows(grid) {
  for (const el of grid._rowEls.values()) el.remove();
  grid._rowEls.clear();
  grid._range = { r0: 0, r1: -1, c0: -1, c1: -1 };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @returns {string}
 */
export function _rowClassName(grid, index) {
  const o = grid.options;
  const row = grid.rows[index];
  if (row.__isGrouping) return "pyo-row pyo-group-row pyo-group-depth-" + (row.__depth || 0);
  let cls = "pyo-row " + (index % 2 ? "pyo-odd" : "pyo-even");
  if (grid.isRowSelected(row)) cls += " pyo-selected";
  if (!grid.isRowSelectable(row)) cls += " pyo-unselectable";
  if (o.rowClass) {
    const extra = isFn(o.rowClass) ? o.rowClass.call(grid, row, index) : o.rowClass;
    if (extra) cls += " " + extra;
  }
  return cls;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @returns {HTMLDivElement}
 */
export function _createRow(grid, index) {
  const o = grid.options;
  const row = grid.rows[index];
  const el = document.createElement("div");
  el.className = _rowClassName(grid, index);
  el.setAttribute("role", "row");
  el.setAttribute("aria-rowindex", String(rowIndex(grid, index)));
  el.setAttribute("aria-selected", grid.isRowSelected(row) ? "true" : "false");
  el.dataset.row = String(index);
  el.style.top = index * o.rowHeight + "px";
  el.style.height = o.rowHeight + "px";
  el.style.width = grid.totalWidth + "px";

  if (row.__isGrouping) {
    // 그룹 합계 행: grouping.columns를 칸 정의로 그린다 (가로 가상 스크롤 없이 전부)
    el.innerHTML = sumRowHtml(grid, (grid.options.grouping && grid.options.grouping.columns) || [], row.__groupingList, row.__groupingBy);
    return el;
  }

  let fz = "";
  for (const a of grid.aside) fz += _asideCellHtml(grid, a, index);
  for (let c = 0; c < grid.frozenCount; c++) fz += _cellHtml(grid, c, row, index);

  const r = grid._range;
  const c0 = r.c0 < 0 ? grid.frozenCount : r.c0;
  const c1 = r.c1 < 0 ? grid.leaves.length - 1 : r.c1;
  let sc = "";
  for (let c = c0; c <= c1; c++) sc += _cellHtml(grid, c, row, index);
  const pad = c0 < grid.leaves.length ? grid.leafX[c0] || 0 : 0;
  el.innerHTML =
    `<div class="pyo-fz" style="width:${grid.fzWidth}px">${fz}</div>` + `<div class="pyo-sc" style="width:${grid.scWidth}px;padding-left:${pad}px">${sc}</div>`;
  return el;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {{
        special: string;
        width: number;
    }} a
 * @param {number} index
 * @returns {string}
 */
export function _asideCellHtml(grid, a, index) {
  const ln = grid._lineNo ? grid._lineNo[index] : index;
  const inner = a.special === "lineNumber" ? String((ln >= 0 ? ln : index) + 1) : '<span class="pyo-check"></span>';
  return `<div class="pyo-cell pyo-aside pyo-al-center" role="gridcell" aria-colindex="${grid.aside.indexOf(a) + 1}" data-special="${a.special}" style="width:${a.width}px">${inner}</div>`;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {any} row
 * @returns {string}
 */
export function _treeControlHtml(grid, row) {
  const t = grid.options.tree || {};
  const m = grid._treeMeta && grid._treeMeta.get(row);
  if (!m) return "";
  const icons = { openedArrow: "▾", collapsedArrow: "▸", groupIcon: "⊚", collapsedGroupIcon: "⊚", itemIcon: "⊙", ...(t.icons || {}) };
  const indent = (t.indentWidth ?? 10) * m.depth;
  const aw = t.arrowWidth ?? 15;
  const iw = t.iconWidth ?? 18;
  const collapsed = !!row[t.collapseKey || "collapse"];
  const has = m.children.length > 0;
  const arrow = has
    ? `<span class="pyo-tree-arrow" data-tree-toggle role="button" aria-expanded="${!collapsed}" style="width:${aw}px">${collapsed ? icons.collapsedArrow : icons.openedArrow}</span>`
    : `<span class="pyo-tree-arrow" style="width:${aw}px"></span>`;
  const icon = has ? (collapsed ? icons.collapsedGroupIcon : icons.groupIcon) : icons.itemIcon;
  return `<span class="pyo-tree-indent" style="width:${indent}px"></span>${arrow}${icon ? `<span class="pyo-tree-icon" style="width:${iw}px">${icon}</span>` : ""}`;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} c
 * @param {any} row
 * @param {number} index
 * @param {any} value
 * @param {any} ctx
 * @param {boolean} [plain]
 * @returns {string}
 */
export function _cellContent(grid, c, row, index, value, ctx, plain = false) {
  const def = grid.leaves[c].def;
  const ed = def.editor;
  const edType = ed && grid.options.editable ? editorTypes[ed.type] : null;
  const fn = def.formatter ? (isFn(def.formatter) ? def.formatter : formatters[/** @type {string} */ (def.formatter)]) : null;
  if (edType && edType.kind === "toggle" && grid.editing.editable(index, c)) {
    // 체크박스 편집기는 셀 안에 바로 그린다 (formatter보다 우선). 편집할 수 없으면 값 그대로.
    if (plain) return escapeHtml(value);
    const on = isChecked(value, ed.config);
    return `<span class="pyo-check pyo-cb${on ? " pyo-checked" : ""}" role="checkbox" aria-checked="${on}" aria-label="${escapeHtml(columnName(def))}"></span>`;
  }
  if (fn) {
    // formatter 결과는 글자로 넣는다. 컬럼에 html: true를 준 경우에만 HTML로 넣는다 (서버 글자로 스크립트가 들어오지 않게)
    const out = fn.call(ctx, ctx);
    const s = out === undefined || out === null ? "" : String(out);
    return def.html ? s : escapeHtml(s);
  }
  if (edType && edType.kind === "list") {
    // formatter가 없는 선택 목록은 값 대신 항목 글자를 보여 준다
    const opt = selectOptions(ed.config).find((o) => String(o.value) === String(value));
    return escapeHtml(opt ? opt.text : value);
  }
  return escapeHtml(value);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} r
 * @param {number} c
 * @returns {string}
 */
export function cellText(grid, r, c) {
  const row = grid.rows[r];
  const def = grid.leaves[c].def;
  const value = getValue(row, def.key);
  const ctx = { value, row, item: row, key: def.key, rowIndex: r, dindex: r, column: def, grid: grid };
  return _cellContent(grid, c, row, r, value, ctx, true);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} c
 * @param {any} row
 * @param {number} index
 * @returns {string}
 */
export function _cellHtml(grid, c, row, index) {
  const def = grid.leaves[c].def;
  const value = getValue(row, def.key);
  const ctx = { value, row, item: row, key: def.key, rowIndex: index, dindex: index, column: def, grid: grid };
  let content = _cellContent(grid, c, row, index, value, ctx);
  const align = def.align || grid.options.align;
  let cls = "pyo-cell" + (align ? " pyo-al-" + align : "") + (def.multiLine ? " pyo-multiline" : "");
  if (def.treeControl && grid._treeMeta) {
    cls += " pyo-tree-cell";
    content = _treeControlHtml(grid, row) + `<span class="pyo-tree-text">${content}</span>`;
  }
  const mg = grid._merge.get(c);
  if (mg && mg.start[index] !== mg.end[index]) {
    // 합친 덩어리: 안쪽 가로선을 지우고, 글자는 _paintMerge가 보이는 부분 가운데 행에만 보인다
    const s = mg.start[index];
    const e = mg.end[index];
    cls += " pyo-merged" + (index !== e ? " pyo-merge-cont" : "");
    if (index !== s + ((e - s) >> 1)) cls += " pyo-merge-hide";
    content = `<span class="pyo-merge-text">${content}</span>`;
  }
  const g = grid.range;
  let id = "";
  if (g && g.contains(index, c)) {
    cls += " pyo-in-range";
    if (g.active.r === index && g.active.c === c) {
      cls += " pyo-active";
      id = ` id="${activeCellId(grid, index, c)}"`;
    }
  }
  if (def.cellClass) {
    const extra = isFn(def.cellClass) ? def.cellClass.call(ctx, ctx) : def.cellClass;
    if (extra) cls += " " + escapeHtml(extra);
  }
  return `<div class="${cls}"${id} role="gridcell" aria-colindex="${grid.aside.length + c + 1}" data-c="${c}" style="width:${grid.widths[c]}px">${content}</div>`;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _renderPageNav(grid) {
  if (!grid.options.pageBar) return;
  grid.el.nav.innerHTML = grid.page ? navigationHtml(grid.page, grid.options.pageIcons || {}, grid.options.pageNavigationCount) : "";
  _renderStatus(grid);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _renderStatus(grid) {
  const o = grid.options;
  if (!o.pageBar) return;
  if (!o.statusDisplay) {
    grid.el.status.innerHTML = "";
    return;
  }
  const s = grid.el.scroll;
  const rh = o.rowHeight;
  const first = Math.floor(s.scrollTop / rh);
  const visible = Math.max(1, Math.ceil(Math.max(0, grid._vh - grid._headerHeight - grid._footHeight) / rh));
  const data = statusData(Math.min(first, Math.max(0, grid.rows.length - 1)), visible, grid.rows.length, grid.page, grid._intl);
  const html = isFn(o.statusFormat) ? o.statusFormat.call(grid, data) : defaultStatusHtml(data, grid.messages);
  if (grid._lastStatus !== html) {
    grid._lastStatus = html;
    grid.el.status.innerHTML = html;
  }
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _scheduleSummary(grid) {
  if (!grid.options.selectionSummary || !grid.options.pageBar) return;
  clearTimeout(grid._summaryTimer);
  grid._summaryTimer = setTimeout(() => {
    if (grid._destroyed || grid._flashing) return;
    grid.el.summary.textContent = summaryText(grid.getSelectionSummary(), grid.messages, grid._intl);
  }, 30);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string} msg
 * @returns {void}
 */
export function _flash(grid, msg) {
  if (!grid.options.pageBar) return;
  clearTimeout(grid._flashTimer);
  grid._flashing = true;
  grid.el.summary.textContent = msg;
  grid.el.summary.dataset.flash = "true";
  grid._flashTimer = setTimeout(() => {
    grid._flashing = false;
    delete grid.el.summary.dataset.flash;
    _scheduleSummary(grid);
  }, 2500);
}

/**
 * 스크린 리더에 읽힐 컬럼 이름: label(html이면 태그를 뺀 글자), 없으면 key
 * @param {import("../grid.js").ColumnDef} def
 * @returns {string}
 */
function columnName(def) {
  if (def.label === undefined || def.label === null || def.label === "") return def.key === undefined ? "" : String(def.key);
  return def.html ? String(def.label).replace(/<[^>]*>/g, "") : String(def.label);
}
