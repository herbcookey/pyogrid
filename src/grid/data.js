// @ts-check
// 데이터(행 넣기·빼기), 헤더 값 필터, 정렬, 트리, 화면 행 만들기
// PyoGrid의 메서드 구현. 공개 메서드와 JSDoc 설명은 grid.js의 클래스에 있고, 클래스는 여기 함수를 부르기만 한다.
import { nextSortDir } from "../core/sort.js";
import { buildView, filterKey, filterRows } from "../features/view.js";
import { FilterPopup } from "../features/filter.js";
import { selectOptions } from "../editors/types.js";
import { getValue, toNumber } from "../util.js";

/**
 * @template [Row=any]
 * @typedef {import("../grid.js").PyoGrid<Row>} Grid
 */
/**
 * @template [Row=any]
 * @typedef {import("../grid.js").ViewRow<Row>} ViewRow
 */
/** @typedef {import("../grid.js").LeafColumn} LeafColumn */
/** @typedef {import("../grid.js").SortItem} SortItem */
/** @typedef {import("../grid.js").PageInfo} PageInfo */

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row[]} rows
 * @param {PageInfo | null} [page]
 * @returns {Grid<Row>}
 */
export function setData(grid, rows, page) {
  grid.editing.cancel();
  grid.history.clear();
  grid._orig = new WeakMap();
  grid.source = Array.isArray(rows) ? rows.slice() : [];
  grid.deleted = [];
  if (page !== undefined) grid.page = page ? { ...page } : null;
  _applyView(grid);
  grid.range = null;
  grid._lastRowClick = null;
  grid._updateBodySize();
  grid.el.scroll.scrollTop = 0;
  grid.refresh();
  grid._renderPageNav();
  grid._updateHeaderSelector();
  grid._scheduleSummary();
  grid.emit("datachange", { rows: grid.rows });
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Row[]}
 */
export function getRows(grid) {
  return grid.dataRows.slice();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {ViewRow<Row>[]}
 */
export function getViewRows(grid) {
  return grid.rows.slice();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Row[]}
 */
export function getAllRows(grid) {
  return grid.source.slice();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @returns {ViewRow<Row> | undefined}
 */
export function getRow(grid, index) {
  return grid.rows[index];
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row | Row[]} rows
 * @param {"first" | "last" | number} [at]
 * @param {{
        focus?: boolean;
    }} [opts]
 * @returns {Grid<Row>}
 */
export function addRow(grid, rows, at = "last", opts = {}) {
  const list = /** @type {any[]} */ (Array.isArray(rows) ? rows : [rows]);
  if (!list.length) return grid;
  grid.editing.cancel();
  for (const r of list) r[grid.options.addedKey] = true;
  if (grid.options.markAddedModified) for (const r of list) r[grid.options.modifiedKey] = true;
  let pos = grid.source.length;
  if (at === "first") pos = 0;
  else if (typeof at === "number") {
    let ref = grid.rows[at];
    for (let i = at; ref && ref.__isGrouping && i < grid.rows.length; i++) ref = grid.rows[i];
    const si = ref ? grid.source.indexOf(ref) : -1;
    if (si >= 0) pos = si;
  }
  // splice(pos, 0, ...list)는 수십만 행이면 인자 수 한도를 넘으므로 배열을 이어 붙인다
  grid.source = grid.source.slice(0, pos).concat(list, grid.source.slice(pos));
  _afterRowsChanged(grid);
  if (opts.focus) {
    const i = grid.rows.indexOf(list[0]);
    if (i >= 0) {
      grid.setRange(i, 0);
      grid.scrollToCell(i, 0);
      grid.focus();
    }
  }
  grid.emit("rowsadd", { rows: list });
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row | number | (Row | number)[]} targets
 * @returns {Grid<Row>}
 */
export function removeRows(grid, targets) {
  const set = _targetRows(grid, targets);
  if (!set.size) return grid;
  grid.editing.cancel();
  grid.source = grid.source.filter((r) => !set.has(r));
  _afterRowsChanged(grid);
  grid.emit("rowsremove", { rows: [...set] });
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row | number | (Row | number)[]} targets
 * @returns {Grid<Row>}
 */
export function deleteRows(grid, targets) {
  const set = _targetRows(grid, targets);
  if (grid._treeMeta) {
    const add = (r) => {
      const m = grid._treeMeta.get(r);
      if (m) for (const ch of m.children) if (!set.has(ch)) (set.add(ch), add(ch));
    };
    for (const r of [...set]) add(r);
  }
  if (!set.size) return grid;
  grid.editing.cancel();
  const k = grid.options.deletedKey;
  const ak = grid.options.addedKey;
  const removed = grid.source.filter((r) => set.has(r));
  for (const r of removed) {
    r[k] = true;
    if (!r[ak]) grid.deleted.push(r);
  }
  grid.source = grid.source.filter((r) => !set.has(r));
  _afterRowsChanged(grid);
  grid.emit("rowsdelete", { rows: removed });
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Row[]}
 */
export function getDeletedRows(grid) {
  return grid.deleted.slice();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Row[]}
 */
export function getAddedRows(grid) {
  const k = grid.options.addedKey;
  return grid.source.filter((r) => r && r[k]);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} index
 * @param {Row} row
 * @returns {Grid<Row>}
 */
export function replaceRow(grid, index, row) {
  const old = grid.rows[index];
  if (!old || old.__isGrouping) return grid;
  const si = grid.source.indexOf(old);
  if (si < 0) return grid;
  grid.source[si] = row;
  _afterRowsChanged(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {any} targets
 * @returns {Set<any>}
 */
export function _targetRows(grid, targets) {
  const arr = Array.isArray(targets) ? targets : [targets];
  const set = new Set();
  for (const t of arr) {
    const r = typeof t === "number" ? grid.rows[t] : t;
    if (r && !r.__isGrouping) set.add(r);
  }
  return set;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _afterRowsChanged(grid) {
  _applyView(grid);
  if (grid.range) grid.range = grid.range.clamp(grid.rows.length, grid.leaves.length);
  grid._updateBodySize();
  grid.refresh();
  grid._updateHeaderSelector();
  grid._scheduleSummary();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string} key
 * @param {any[] | null} values
 * @returns {Grid<Row>}
 */
export function setFilter(grid, key, values) {
  if (values === null || values === undefined) grid.filters.delete(key);
  else grid.filters.set(key, new Set(values.map(filterKey)));
  _afterFilter(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function clearFilters(grid) {
  grid.filters.clear();
  _afterFilter(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Record<string, string[]>}
 */
export function getFilters(grid) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [k, v] of grid.filters) out[k] = [...v];
  return out;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _afterFilter(grid) {
  grid.editing.cancel();
  _applyView(grid);
  grid.range = null;
  grid._updateBodySize();
  grid.el.scroll.scrollTop = 0;
  grid.refresh();
  grid._renderHeader();
  grid._scheduleSummary();
  grid.emit("filterchange", { filters: getFilters(grid), count: grid.dataRows.length });
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {LeafColumn} leaf
 * @returns {boolean}
 */
export function isFilterable(grid, leaf) {
  const def = leaf.def;
  if (def.key === undefined || def.key === null || grid.options.tree || grid.page) return false;
  if (def.filter === false) return false;
  return def.filter === true || !!grid.options.filter;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} leafIndex
 * @param {HTMLElement} [_anchor]
 * @returns {void}
 */
export function openFilter(grid, leafIndex, _anchor) {
  const leaf = grid.leaves[leafIndex];
  if (!leaf || !isFilterable(grid, leaf)) return;
  if (grid._filterPopup) grid._filterPopup.close();
  const def = leaf.def;
  const key = def.key;
  const seen = new Set();
  for (const r of filterRows(grid.source, grid.filters, key)) seen.add(filterKey(getValue(r, key)));
  const cur = grid.filters.get(key) || null;
  if (cur) for (const v of cur) seen.add(v);
  const opts = def.editor && def.editor.type === "select" ? selectOptions(def.editor.config) : null;
  const label = (v) => {
    if (opts) {
      const o = opts.find((x) => String(x.value) === v);
      if (o) return o.text;
    }
    if (def.formatter === "money" && toNumber(v) !== null) return grid._fmt(toNumber(v));
    return v;
  };
  const title = def.label === undefined || def.label === null ? String(key) : def.html ? String(def.label).replace(/<[^>]*>/g, "") : String(def.label);
  grid._filterPopup = new FilterPopup({
    title,
    values: [...seen],
    label,
    current: cur,
    messages: grid.messages,
    locale: grid._intl,
    onApply: (allowed) => setFilter(grid, key, allowed ? [...allowed] : null),
    onClose: () => {
      grid._filterPopup = null;
      grid._filterLeaf = -1;
      grid.focus();
    },
  });
  grid._filterLeaf = leafIndex;
  _placeFilterPopup(grid, true);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {boolean} [focus]
 * @returns {void}
 */
export function _placeFilterPopup(grid, focus = false) {
  if (!grid._filterPopup) return;
  const i = grid._filterLeaf;
  const a = grid.el.head.querySelector(`.pyo-filter-btn[data-filter="${i}"]`) || grid.el.head.querySelector(`[data-leaf="${i}"]`) || grid.el.root;
  grid._filterPopup.place(a.getBoundingClientRect(), focus);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row} row
 * @returns {{
        depth: number;
        children: Row[];
        parent: Row | null;
    } | null}
 */
export function getTreeInfo(grid, row) {
  const m = grid._treeMeta && grid._treeMeta.get(row);
  return m ? { depth: m.depth, children: m.children.slice(), parent: m.parent } : null;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row | number} target
 * @param {boolean} [collapsed]
 * @returns {Grid<Row>}
 */
export function toggleNode(grid, target, collapsed) {
  const row = typeof target === "number" ? grid.rows[target] : target;
  const t = _treeCfg(grid);
  if (!row || !t) return grid;
  const m = grid._treeMeta.get(row);
  if (!m || !m.children.length) return grid;
  row[t.collapseKey] = collapsed === undefined ? !row[t.collapseKey] : !!collapsed;
  _afterRowsChanged(grid);
  grid.emit("treetoggle", { row, collapsed: !!row[t.collapseKey] });
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function expandAll(grid) {
  return _setAllCollapsed(grid, false);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function collapseAll(grid) {
  return _setAllCollapsed(grid, true);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {boolean} v
 * @returns {Grid<Row>}
 */
export function _setAllCollapsed(grid, v) {
  const t = _treeCfg(grid);
  if (!t) return grid;
  for (const r of grid.source) if (grid._treeMeta.get(r) && grid._treeMeta.get(r).children.length) r[t.collapseKey] = v;
  _afterRowsChanged(grid);
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {{
        parentKey: string;
        selfKey: string;
        collapseKey: string;
    }}
 */
export function _treeCfg(grid) {
  const t = grid.options.tree;
  if (!t) return null;
  return { parentKey: t.parentKey || "pid", selfKey: t.selfKey || "id", collapseKey: t.collapseKey || "collapse" };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {SortItem[]} sort
 * @param {{
        silent?: boolean;
    }} [opts]
 * @returns {Grid<Row>}
 */
export function setSort(grid, sort, opts = {}) {
  grid.editing.cancel();
  grid.sort = (sort || []).filter((s) => s && s.key !== undefined && (s.dir === "asc" || s.dir === "desc")).map((s) => ({ key: s.key, dir: s.dir }));
  _applyView(grid);
  grid.range = null;
  grid._renderHeader();
  grid.refresh();
  grid._scheduleSummary();
  if (!opts.silent) {
    grid._saveState();
    grid.emit("sortchange", { sort: getSort(grid) });
  }
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {SortItem[]}
 */
export function getSort(grid) {
  return grid.sort.map((s) => ({ ...s }));
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {LeafColumn} leaf
 * @returns {boolean}
 */
export function isSortable(grid, leaf) {
  const def = leaf.def;
  if (def.key === undefined || def.key === null || def.sortable === false) return false;
  return def.sortable === true || grid.options.sortable === true;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number} leafIndex
 * @returns {Grid<Row>}
 */
export function toggleSort(grid, leafIndex) {
  const leaf = grid.leaves[leafIndex];
  if (!leaf || !isSortable(grid, leaf)) return grid;
  const key = leaf.def.key;
  const cur = grid.sort.find((s) => s.key === key);
  const dir = nextSortDir(cur ? cur.dir : undefined);
  let next = grid.options.multiSort ? grid.sort.filter((s) => s.key !== key) : [];
  if (dir) {
    if (grid.options.multiSort && cur) {
      // 다중 정렬에서 방향만 바꿀 때는 순서를 유지한다
      next = grid.sort.map((s) => (s.key === key ? { key, dir } : s));
    } else next.push({ key, dir });
  }
  return setSort(grid, next);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {void}
 */
export function _applyView(grid) {
  const o = grid.options;
  const v = buildView({
    source: grid.source,
    filters: isFilterActive(grid) ? grid.filters : new Map(),
    sort: grid.sort,
    compare: o.sortCompare,
    locale: grid._intl,
    remoteSort: o.remoteSort,
    grouping: o.grouping && Array.isArray(o.grouping.by) ? o.grouping : null,
    tree: _treeCfg(grid),
    pass: (r) => !!r[o.addedKey],
  });
  grid.rows = v.rows;
  grid.dataRows = v.dataRows;
  grid._treeMeta = v.treeMeta;
  const ln = new Int32Array(grid.rows.length);
  let n = 0;
  for (let i = 0; i < grid.rows.length; i++) ln[i] = grid.rows[i].__isGrouping ? -1 : n++;
  grid._lineNo = ln;
  grid._merge = new Map();
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {boolean}
 */
export function isFilterActive(grid) {
  return grid.filters.size > 0 && !grid.options.tree && !grid.page;
}
