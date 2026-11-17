// @ts-check
// 행 선택, 셀 범위, 선택 합계, 본문 클릭·끌기
// PyoGrid의 메서드 구현. 공개 메서드와 JSDoc 설명은 grid.js의 클래스에 있고, 클래스는 여기 함수를 부르기만 한다.
import { CellRange } from "../core/range.js";
import { getValue, clamp, toNumber } from "../util.js";

/**
 * @template [Row=any]
 * @typedef {import("../grid.js").PyoGrid<Row>} Grid
 */
/**
 * @template [Row=any]
 * @typedef {import("../grid.js").ColumnDef<Row>} ColumnDef
 */
/**
 * @template [Row=any]
 * @typedef {import("../grid.js").ViewRow<Row>} ViewRow
 */
/** @typedef {import("../grid.js").RangeInfo} RangeInfo */

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {any} row
 * @returns {boolean}
 */
export function isRowSelected(grid, row) {
  return !!(row && row[grid.options.selectedKey]);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {any} row
 * @returns {boolean}
 */
export function isRowSelectable(grid, row) {
  return !!row && !row.__isGrouping && !row[grid.options.disableSelectionKey];
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @param {boolean} [selected]
 * @param {{
        source?: string;
    }} [opts]
 * @returns {boolean}
 */
export function selectRow(grid, index, selected, opts = {}) {
  const row = grid.rows[index];
  if (!isRowSelectable(grid, row)) return false;
  const key = grid.options.selectedKey;
  const next = selected === undefined ? !row[key] : !!selected;
  const changed = [];
  const changedRows = [];
  if (next && !grid.options.multipleSelect) {
    // 화면 행이 아니라 전체 행에서 푼다: 접힌 트리 자식·필터로 숨은 행도 선택된 채 남지 않게
    for (const r of grid.source) {
      if (r !== row && r[key]) {
        r[key] = false;
        changedRows.push(r);
      }
    }
    if (changedRows.length) {
      const set = new Set(changedRows);
      grid.rows.forEach((r, i) => set.has(r) && changed.push(i));
    }
  }
  if (!!row[key] !== next) {
    changed.push(index);
    changedRows.push(row);
  }
  row[key] = next;
  _afterSelection(grid, changed, { index, row, selected: next, source: opts.source || "api" }, changedRows);
  return next;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} from
 * @param {number} to
 * @param {boolean} selected
 * @returns {boolean}
 */
export function selectRowRange(grid, from, to, selected) {
  if (!grid.options.multipleSelect) return selectRow(grid, to, selected);
  const key = grid.options.selectedKey;
  const changed = [];
  for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
    const r = grid.rows[i];
    if (!isRowSelectable(grid, r) || !!r[key] === selected) continue;
    r[key] = selected;
    changed.push(i);
  }
  _afterSelection(grid, changed, { index: to, row: grid.rows[to], selected, source: "range" });
  return selected;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {boolean} [selected]
 * @param {(this: Row, row: Row, index: number) => boolean} [filter]
 * @returns {Grid<Row>}
 */
export function selectAll(grid, selected = true, filter) {
  const key = grid.options.selectedKey;
  const changedRows = [];
  // 데이터 행 전체 (트리의 접힌 자식 포함, 필터로 숨은 행 제외)
  grid.dataRows.forEach((r, i) => {
    if (!isRowSelectable(grid, r)) return;
    if (filter && filter.call(r, r, i) !== true) return;
    if (!!r[key] === selected) return;
    r[key] = selected;
    changedRows.push(r);
  });
  const set = new Set(changedRows);
  const changed = [];
  grid.rows.forEach((r, i) => set.has(r) && changed.push(i));
  _afterSelection(grid, changed, { index: -1, row: null, selected, source: "all" }, changedRows);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function clearSelection(grid) {
  return selectAll(grid, false);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Row[]}
 */
export function getSelectedRows(grid) {
  return grid.dataRows.filter((r) => isRowSelected(grid, r));
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {number[]}
 */
export function getSelectedIndexes(grid) {
  const out = [];
  grid.rows.forEach((r, i) => {
    if (isRowSelected(grid, r)) out.push(i);
  });
  return out;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} r0
 * @param {number} c0
 * @param {number} [r1]
 * @param {number} [c1]
 * @returns {Grid<Row>}
 */
export function setRange(grid, r0, c0, r1 = r0, c1 = c0) {
  if (!grid.rows.length || !grid.leaves.length) return clearRange(grid);
  const rng = new CellRange({ r: r0, c: c0 }, { r: r1, c: c1 }).clamp(grid.rows.length, grid.leaves.length);
  _setRangeInternal(grid, rng);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function clearRange(grid) {
  _setRangeInternal(grid, null);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {RangeInfo | null}
 */
export function getRange(grid) {
  const g = grid.range;
  return g ? { r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1, active: { ...g.active } } : null;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {{
        rowIndex: number;
        colIndex: number;
        row: ViewRow<Row>;
        column: ColumnDef<Row>;
        key: string | undefined;
        value: any;
    } | null}
 */
export function getActiveCell(grid) {
  const g = grid.range;
  if (!g) return null;
  const leaf = grid.leaves[g.active.c];
  const row = grid.rows[g.active.r];
  return { rowIndex: g.active.r, colIndex: g.active.c, row, column: leaf.def, key: leaf.def.key, value: getValue(row, leaf.def.key) };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {{
        rowIndex: number;
        colIndex: number;
        row: ViewRow<Row>;
        key: string | undefined;
        value: any;
    }[]}
 */
export function getRangeCells(grid) {
  const g = grid.range;
  if (!g) return [];
  const out = [];
  for (let r = g.r0; r <= g.r1; r++) {
    const row = grid.rows[r];
    for (let c = g.c0; c <= g.c1; c++) {
      const key = grid.leaves[c].def.key;
      out.push({ rowIndex: r, colIndex: c, row, key, value: getValue(row, key) });
    }
  }
  return out;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {ColumnDef} def
 * @returns {boolean}
 */
export function isNumericColumn(grid, def) {
  if (def.numeric !== undefined) return !!def.numeric;
  const ed = def.editor && def.editor.type;
  return def.formatter === "money" || ed === "number" || ed === "money";
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {{
        count: number;
        numCount: number;
        sum: number;
        avg: number;
    }}
 */
export function getSelectionSummary(grid) {
  const g = grid.range;
  let count = 0;
  let numCount = 0;
  let sum = 0;
  let dec = 0;
  if (g) {
    count = g.size;
    for (let c = g.c0; c <= g.c1; c++) {
      const def = grid.leaves[c].def;
      const key = def.key;
      if (key === undefined || key === null) continue;
      const numericCol = isNumericColumn(grid, def);
      for (let r = g.r0; r <= g.r1; r++) {
        const row = grid.rows[r];
        if (!row || row.__isGrouping) continue;
        const v = getValue(row, key);
        const n = typeof v === "number" ? (isFinite(v) ? v : null) : numericCol ? toNumber(v) : null;
        if (n !== null) {
          sum += n;
          numCount++;
          if (dec < 15 && !Number.isInteger(n)) {
            const s = String(n);
            const d = s.indexOf(".");
            dec = Math.max(dec, d < 0 || /e/i.test(s) ? 15 : Math.min(15, s.length - d - 1));
          }
        }
      }
    }
  }
  // 0.1 + 0.2 = 0.30000000000000004 같은 끝자리 오차를 넣은 값의 가장 긴 소수 자리에서 지운다
  if (dec) sum = Number(sum.toFixed(dec));
  return { count, numCount, sum, avg: numCount ? sum / numCount : 0 };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number[]} changed
 * @param {{
        index: number;
        row: any;
        selected: boolean;
        source: string;
    }} info
 * @param {any[]} [changedRows]
 * @returns {void}
 */
export function _afterSelection(grid, changed, info, changedRows) {
  for (const i of changed) {
    const el = grid._rowEls.get(i);
    if (!el) continue;
    el.className = grid._rowClassName(i);
    el.setAttribute("aria-selected", isRowSelected(grid, grid.rows[i]) ? "true" : "false");
  }
  grid._updateHeaderSelector();
  const rowsChanged = changedRows || changed.map((i) => grid.rows[i]);
  if (rowsChanged.length) grid.emit("selectionchange", { ...info, changed: rowsChanged, indexes: changed });
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {CellRange | null} rng
 * @returns {void}
 */
export function _setRangeInternal(grid, rng) {
  const prev = grid.range;
  const same =
    (!prev && !rng) ||
    (prev && rng && prev.anchor.r === rng.anchor.r && prev.anchor.c === rng.anchor.c && prev.active.r === rng.active.r && prev.active.c === rng.active.c);
  grid.range = rng;
  if (same) return;
  _paintRange(grid);
  grid._scheduleSummary();
  grid.editing.position();
  grid.emit("rangechange", { range: getRange(grid) });
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _paintRange(grid) {
  const g = grid.range;
  for (const [r, el] of grid._rowEls) {
    const cells = el.querySelectorAll(".pyo-cell[data-c]");
    for (let k = 0; k < cells.length; k++) {
      const cell = /** @type {HTMLElement} */ (cells[k]);
      const c = Number(cell.dataset.c);
      const inR = !!g && g.contains(r, c);
      cell.classList.toggle("pyo-in-range", inR);
      cell.classList.toggle("pyo-active", inR && g.active.r === r && g.active.c === c);
    }
  }
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} x
 * @param {number} y
 * @returns {{
        r: any;
        c: any;
    }}
 */
export function _cellFromPoint(grid, x, y) {
  const s = grid.el.scroll;
  const sr = s.getBoundingClientRect();
  const rh = grid.options.rowHeight;
  const contentY = y - sr.top + s.scrollTop - grid._headerHeight;
  const r = clamp(Math.floor(contentY / rh), 0, Math.max(0, grid.rows.length - 1));
  const xIn = x - sr.left;
  let c;
  if (xIn < grid.fzWidth && grid.frozenCount > 0) {
    c = 0;
    for (let i = 0; i < grid.frozenCount; i++) if (xIn >= grid.leafX[i]) c = i;
  } else {
    const sx = xIn + s.scrollLeft - grid.fzWidth;
    c = grid.frozenCount;
    for (let i = grid.frozenCount; i < grid.leaves.length; i++) if (sx >= grid.leafX[i]) c = i;
  }
  return { r, c: clamp(c, 0, Math.max(0, grid.leaves.length - 1)) };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {PointerEvent} e
 * @returns {void}
 */
export function _onBodyPointerDown(grid, e) {
  if (e.button !== 0) return;
  const t = /** @type {HTMLElement} */ (e.target);
  const rowEl = t.closest && /** @type {HTMLElement|null} */ (t.closest(".pyo-row"));
  if (!rowEl) return;
  const r = Number(rowEl.dataset.row);
  if (t.closest("[data-tree-toggle]")) {
    e.preventDefault();
    grid.toggleNode(r);
    return;
  }
  const special = /** @type {HTMLElement|null} */ (t.closest("[data-special]"));
  if (special) {
    if (special.dataset.special === "rowSelector") {
      e.preventDefault();
      // 기준 행은 행 객체로 기억한다 (화면 순번은 정렬·필터·행 추가·삭제로 바뀐다)
      const from = grid._lastRowClick ? grid.rows.indexOf(grid._lastRowClick) : -1;
      if (e.shiftKey && from >= 0 && grid.options.multipleSelect) {
        // Shift+클릭: 마지막으로 누른 행의 상태로 사이 행을 맞춘다
        selectRowRange(grid, from, r, isRowSelected(grid, grid._lastRowClick));
      } else {
        selectRow(grid, r, undefined, { source: "click" });
      }
      grid._lastRowClick = grid.rows[r];
    }
    return;
  }
  const cellEl = /** @type {HTMLElement|null} */ (t.closest(".pyo-cell[data-c]"));
  if (!cellEl || !grid.options.cellSelect) return;
  const c = Number(cellEl.dataset.c);
  // 셀 안의 입력 요소(화면 코드가 formatter로 넣은 것)는 기본 동작을 둔다
  if (t.closest("input, select, textarea, button, a")) return;
  e.preventDefault();
  // 편집 중인 셀을 다시 누른 경우는 그대로 둔다. 다른 셀이면 저장 (잘못된 값이면 이동하지 않음).
  const ed = grid.editing.edit;
  if (ed) {
    if (ed.r === r && ed.c === c) return;
    if (!grid.editing.commit()) return;
  }
  grid.editing.focus();
  if (e.shiftKey && grid.range) _setRangeInternal(grid, new CellRange(grid.range.anchor, { r, c }));
  else _setRangeInternal(grid, new CellRange({ r, c }));
  _startDrag(grid, e);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {PointerEvent} e
 * @returns {void}
 */
export function _startDrag(grid, e) {
  if (grid._dragCleanup) grid._dragCleanup();
  const s = grid.el.scroll;
  let lastX = e.clientX;
  let lastY = e.clientY;
  let timer = 0;
  const update = () => {
    if (!grid.range) return;
    const p = _cellFromPoint(grid, lastX, lastY);
    _setRangeInternal(grid, new CellRange(grid.range.anchor, p));
  };
  const autoScroll = () => {
    timer = 0;
    const sr = s.getBoundingClientRect();
    const top = sr.top + grid._headerHeight;
    const bottom = sr.top + s.clientHeight;
    const left = sr.left + grid.fzWidth;
    const right = sr.left + s.clientWidth;
    let dy = 0;
    let dx = 0;
    if (lastY < top) dy = lastY - top;
    else if (lastY > bottom) dy = lastY - bottom;
    if (lastX > right) dx = lastX - right;
    else if (lastX < left && s.scrollLeft > 0 && grid.range && grid.range.active.c >= grid.frozenCount) dx = lastX - left;
    if (dx || dy) {
      s.scrollTop += clamp(dy, -60, 60);
      s.scrollLeft += clamp(dx, -60, 60);
      grid._render();
      update();
      timer = requestAnimationFrame(autoScroll);
    }
  };
  /** @param {PointerEvent} ev */
  const move = (ev) => {
    lastX = ev.clientX;
    lastY = ev.clientY;
    update();
    if (!timer) timer = requestAnimationFrame(autoScroll);
  };
  const up = () => cleanup();
  const cleanup = () => {
    cancelAnimationFrame(timer);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
    grid._dragCleanup = null;
  };
  grid._dragCleanup = cleanup;
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {MouseEvent} e
 * @param {"click" | "dblclick"} type
 * @returns {void}
 */
export function _onBodyClick(grid, e, type) {
  const t = /** @type {HTMLElement} */ (e.target);
  const rowEl = t.closest && /** @type {HTMLElement|null} */ (t.closest(".pyo-row"));
  if (!rowEl) return;
  const r = Number(rowEl.dataset.row);
  const special = /** @type {HTMLElement|null} */ (t.closest("[data-special]"));
  const cellEl = /** @type {HTMLElement|null} */ (t.closest(".pyo-cell[data-c]"));
  const row = grid.rows[r];
  if (special) {
    grid.emit(type, { row, item: row, rowIndex: r, dindex: r, special: special.dataset.special, event: e, grid: grid });
    return;
  }
  if (!cellEl) return;
  const c = Number(cellEl.dataset.c);
  const def = grid.leaves[c].def;
  const info = grid.editing.editable(r, c);
  if (info && !e.shiftKey) {
    // 체크박스는 셀을 누르면 바로 바뀐다. 그 밖의 편집기는 더블클릭으로 편집하고 dblclick은 알리지 않는다.
    if (type === "click" && info.type.kind === "toggle") grid.editing.toggle(r, c);
    if (type === "dblclick" && info.type.kind !== "toggle") {
      grid.editing.start(r, c, { mode: "edit" });
      return;
    }
  }
  grid.emit(type, {
    row,
    item: row,
    rowIndex: r,
    dindex: r,
    colIndex: c,
    column: def,
    key: def.key,
    value: getValue(row, def.key),
    event: e,
    grid: grid,
  });
}
