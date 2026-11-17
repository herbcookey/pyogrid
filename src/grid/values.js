// @ts-check
// 값 바꾸기, 수정 표시, 실행 취소, 복사·붙여넣기·잘라내기
// PyoGrid의 메서드 구현. 공개 메서드와 JSDoc 설명은 grid.js의 클래스에 있고, 클래스는 여기 함수를 부르기만 한다.
import { RECORDED_SOURCES } from "../features/history.js";
import { parseTSV, buildTSV, pastePlan, convertPasteValue } from "../features/clipboard.js";
import { sameValue } from "../editors/types.js";
import { getValue, setValue as setPathValue } from "../util.js";

/**
 * @template [Row=any]
 * @typedef {import("../grid.js").PyoGrid<Row>} Grid
 */
/**
 * @template [Row=any]
 * @typedef {import("../grid.js").AppliedChange<Row>} AppliedChange
 */

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number | Row} target
 * @param {string} key
 * @param {any} value
 * @param {{
        source?: string;
        refresh?: boolean;
        batch?: boolean;
    }} [opts]
 * @returns {boolean}
 */
export function setValue(grid, target, key, value, opts = {}) {
  const hit = _resolveRow(grid, target);
  return hit ? _setRowValue(grid, hit.row, hit.index, key, value, opts) : false;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {number | any} target
 * @param {Map<any, number>} [viewIndex]
 * @param {Set<any>} [sourceSet]
 * @returns {{
        row: any;
        index: number;
    } | null}
 */
export function _resolveRow(grid, target, viewIndex, sourceSet) {
  if (typeof target === "number") {
    const row = grid.rows[target];
    return row && !row.__isGrouping ? { row, index: target } : null;
  }
  if (!target || typeof target !== "object" || target.__isGrouping) return null;
  const vi = viewIndex ? viewIndex.get(target) : grid.rows.indexOf(target);
  const index = vi === undefined ? -1 : vi;
  if (index < 0 && !(sourceSet ? sourceSet.has(target) : grid.source.includes(target))) return null;
  return { row: target, index };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {any} row
 * @param {number} rowIndex
 * @param {string} key
 * @param {any} value
 * @param {{
        source?: string;
        refresh?: boolean;
        batch?: boolean;
    }} opts
 * @returns {boolean}
 */
export function _setRowValue(grid, row, rowIndex, key, value, opts) {
  const old = getValue(row, key);
  const empty = (v) => v === null || v === undefined || v === "";
  if (old === value || (empty(old) && empty(value))) return false;
  if (!setPathValue(row, key, value)) return false;
  _trackModified(grid, row, key, old, value);
  const source = opts.source || "api";
  if (!opts.batch && grid.options.undo && RECORDED_SOURCES[source]) {
    grid.history.push({ source, changes: [{ row, key, oldValue: old, value }] });
  }
  if (opts.refresh !== false) {
    _redrawAfterValues(grid, [key], rowIndex);
    grid._scheduleSummary();
  }
  grid.emit("change", {
    row,
    item: row,
    rowIndex,
    dindex: rowIndex,
    key,
    value,
    oldValue: old,
    source,
    batch: !!opts.batch,
  });
  return true;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {{
        rowIndex?: number;
        row?: Row;
        key: string;
        value: any;
    }[]} changes
 * @param {{
        source?: string;
    }} [opts]
 * @returns {AppliedChange<Row>[]}
 */
export function setValues(grid, changes, opts = {}) {
  const source = opts.source || "api";
  const applied = [];
  /** @type {Map<any, number>|undefined} */
  let viewIndex;
  /** @type {Set<any>|undefined} */
  let sourceSet;
  for (const ch of changes) {
    let hit;
    if (ch.row && typeof ch.row === "object") {
      if (typeof ch.rowIndex === "number" && grid.rows[ch.rowIndex] === ch.row) hit = { row: ch.row, index: ch.rowIndex };
      else {
        // 행 객체로 여러 개를 찾을 때 indexOf를 반복하지 않게 표를 한 번만 만든다
        if (!viewIndex) {
          viewIndex = new Map();
          grid.rows.forEach((r, i) => viewIndex.set(r, i));
          sourceSet = new Set(grid.source);
        }
        hit = _resolveRow(grid, ch.row, viewIndex, sourceSet);
      }
    } else hit = _resolveRow(grid, ch.rowIndex);
    if (!hit) continue;
    const old = getValue(hit.row, ch.key);
    if (_setRowValue(grid, hit.row, hit.index, ch.key, ch.value, { source, refresh: false, batch: true })) {
      applied.push({ rowIndex: hit.index, row: hit.row, key: ch.key, value: ch.value, oldValue: old });
    }
  }
  if (applied.length) {
    if (grid.options.undo && RECORDED_SOURCES[source]) {
      grid.history.push({ source, changes: applied.map((a) => ({ row: a.row, key: a.key, oldValue: a.oldValue, value: a.value })) });
    }
    _redrawAfterValues(grid, new Set(applied.map((a) => a.key)));
    grid._scheduleSummary();
    grid.emit("batchchange", { source, changes: applied });
  }
  return applied;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {boolean}
 */
export function undo(grid) {
  if (grid.editing.active) grid.editing.cancel();
  for (;;) {
    const entry = grid.history.popUndo();
    if (!entry) {
      grid._flash(grid.messages.nothingToUndo);
      return false;
    }
    const n = entry.rows ? grid._applyRowHistory(entry, "undo") : _applyHistory(grid, entry, "undo");
    // 처리할 행이 하나도 없는 행 작업(앱이 기록 없이 그 행들을 바꿈)은 버리고 다음 기록으로
    if (entry.rows && !n) {
      grid.history.dropRedoTop();
      continue;
    }
    const action = grid.messages.actions[entry.source] || entry.source;
    grid._flash(entry.rows ? grid.messages.undoneRows(action, grid._fmt(n)) : grid.messages.undone(action, grid._fmt(n)));
    grid.emit("undo", { source: entry.source, count: n });
    return true;
  }
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {boolean}
 */
export function redo(grid) {
  if (grid.editing.active) grid.editing.cancel();
  for (;;) {
    const entry = grid.history.popRedo();
    if (!entry) {
      grid._flash(grid.messages.nothingToRedo);
      return false;
    }
    const n = entry.rows ? grid._applyRowHistory(entry, "redo") : _applyHistory(grid, entry, "redo");
    if (entry.rows && !n) {
      grid.history.dropUndoTop();
      continue;
    }
    const action = grid.messages.actions[entry.source] || entry.source;
    grid._flash(entry.rows ? grid.messages.redoneRows(action, grid._fmt(n)) : grid.messages.redone(action, grid._fmt(n)));
    grid.emit("redo", { source: entry.source, count: n });
    return true;
  }
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function clearHistory(grid) {
  grid.history.clear();
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {any} row
 * @param {string} key
 * @param {any} old
 * @param {any} value
 * @returns {void}
 */
export function _trackModified(grid, row, key, old, value) {
  const mk = grid.options.modifiedKey;
  let t = grid._orig.get(row);
  if (!t) {
    t = { was: !!row[mk], keys: new Map() };
    grid._orig.set(row, t);
  }
  if (!t.keys.has(key)) t.keys.set(key, old);
  const empty = (v) => v === null || v === undefined || v === "";
  const first = t.keys.get(key);
  if (first === value || (empty(first) && empty(value))) t.keys.delete(key);
  if (t.keys.size) row[mk] = true;
  else {
    if (t.was) row[mk] = true;
    else delete row[mk];
    grid._orig.delete(row);
  }
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row[]} [rows]
 * @returns {Grid<Row>}
 */
export function clearModified(grid, rows) {
  const mk = grid.options.modifiedKey;
  const ak = grid.options.addedKey;
  const list = /** @type {any[]} */ (rows || grid.source.concat(grid.deleted));
  let wasAdded = false;
  for (const r of list) {
    if (!r) continue;
    delete r[mk];
    if (r[ak]) {
      delete r[ak];
      wasAdded = true;
    }
    grid._orig.delete(r);
  }
  if (wasAdded && grid.isFilterActive()) grid._afterRowsChanged();
  else grid.refresh();
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function clearDeleted(grid) {
  grid.deleted = [];
  return grid;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Grid<Row>}
 */
export function acceptChanges(grid) {
  grid.history.clear();
  clearDeleted(grid);
  return clearModified(grid);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {import("../features/history.js").Entry} entry
 * @param {"undo" | "redo"} source
 * @returns {number}
 */
export function _applyHistory(grid, entry, source) {
  const index = new Map();
  grid.rows.forEach((r, i) => index.set(r, i));
  const inSource = new Set(grid.source);
  const list = source === "undo" ? entry.changes.slice().reverse() : entry.changes;
  const changes = [];
  let gone = 0;
  for (const ch of list) {
    const v = source === "undo" ? ch.oldValue : ch.value;
    if (!inSource.has(ch.row)) {
      // 그 뒤에 지운 행: 값만 되돌린다 (화면·합계에 없으므로 알릴 곳이 없다)
      const old = getValue(ch.row, ch.key);
      setPathValue(ch.row, ch.key, v);
      _trackModified(grid, ch.row, ch.key, old, v);
      gone++;
      continue;
    }
    // 필터로 숨은 행·접힌 트리 자식도 행 객체로 바꿔서 change·batchchange·합계 행이 빠지지 않게 한다
    const i = index.get(ch.row);
    changes.push({ row: ch.row, rowIndex: i === undefined ? -1 : i, key: ch.key, value: v });
  }
  // 같은 셀이 여러 번 나오면 마지막에 적용한 값이 남도록 그대로 순서대로 적용한다
  const applied = setValues(grid, changes, { source });
  if (applied.length) {
    // 바뀐 셀을 감싸는 범위 (Math.min(...)은 셀이 수십만이면 스택 초과라 반복문으로). 화면에 있는 행만
    let r0 = Infinity,
      r1 = -Infinity,
      c0 = Infinity,
      c1 = -Infinity;
    const colOf = new Map(grid.leaves.map((l, i) => [l.def.key, i]));
    for (const a of applied) {
      const c = colOf.get(a.key);
      if (c === undefined || a.rowIndex < 0) continue;
      if (a.rowIndex < r0) r0 = a.rowIndex;
      if (a.rowIndex > r1) r1 = a.rowIndex;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
    }
    if (c0 !== Infinity) {
      grid.setRange(r0, c0, r1, c1);
      grid.scrollToCell(r0, c0);
    }
  }
  return applied.length + gone;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {string}
 */
export function getRangeText(grid) {
  const g = grid.range;
  if (!g) return "";
  const out = [];
  for (let r = g.r0; r <= g.r1; r++) {
    const line = [];
    for (let c = g.c0; c <= g.c1; c++) line.push(getValue(grid.rows[r], grid.leaves[c].def.key));
    out.push(line);
  }
  return buildTSV(out);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Promise<boolean>}
 */
export async function copy(grid) {
  const text = getRangeText(grid);
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    return false;
  }
  _afterCopy(grid, text);
  return true;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string} [text]
 * @returns {void}
 */
export function _afterCopy(grid, text) {
  const g = grid.range;
  if (g) grid._flash(grid.messages.copied(grid._fmt(g.size)));
  grid.emit("copy", { range: grid.getRange(), text: text === undefined ? getRangeText(grid) : text });
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string} text
 * @returns {{
        applied: number;
        skipped: number;
        rows?: number;
    }}
 */
export function paste(grid, text) {
  const g = grid.range;
  if (!g || grid.editing.active) return { applied: 0, skipped: 0 };
  const data = parseTSV(text);
  const plan = pastePlan(data, g);
  const changes = [];
  let skipped = 0;
  let rMax = g.r0;
  let cMax = g.c0;
  for (const p of plan) {
    const info = p.r < grid.rows.length && p.c < grid.leaves.length ? grid.editing.editable(p.r, p.c) : null;
    if (!info) {
      skipped++;
      continue;
    }
    const conv = convertPasteValue(info.def.editor, p.text);
    if (!conv.ok) {
      skipped++;
      continue;
    }
    rMax = Math.max(rMax, p.r);
    cMax = Math.max(cMax, p.c);
    // 같은 뜻의 값(text 칸의 0과 "0" 등)은 바꾸지 않는다: 수정 표시·실행 취소 기록이 생기지 않게
    if (sameValue(info.type, info.cfg, getValue(info.row, info.key), conv.value)) continue;
    changes.push({ rowIndex: p.r, key: info.key, value: conv.value });
  }
  const applied = setValues(grid, changes, { source: "paste" });
  if (changes.length || plan.length > skipped) grid.setRange(g.r0, g.c0, rMax, cMax);
  const info = { applied: applied.length, skipped, rows: data.length };
  grid._flash(grid.messages.pasted(grid._fmt(applied.length), grid._fmt(skipped)));
  grid.emit("paste", info);
  return info;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {string}
 */
export function cut(grid) {
  const text = getRangeText(grid);
  grid.editing.clearRange("cut");
  return text;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {Row[]}
 */
export function getModifiedRows(grid) {
  const k = grid.options.modifiedKey;
  return grid.source.filter((r) => r && r[k]);
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Row} row
 * @returns {Row}
 */
export function cleanRow(grid, row) {
  if (row === null || typeof row !== "object") return row;
  const o = grid.options;
  const copy = /** @type {any} */ ({ ...row });
  delete copy[o.selectedKey];
  delete copy[o.modifiedKey];
  delete copy[o.addedKey];
  delete copy[o.deletedKey];
  return copy;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @returns {{added: Row[], modified: Row[], deleted: Row[]}}
 */
export function getChanges(grid) {
  const ak = grid.options.addedKey;
  const clean = (/** @type {Row} */ r) => cleanRow(grid, r);
  return {
    added: grid.getAddedRows().map(clean),
    modified: getModifiedRows(grid)
      .filter((r) => !(/** @type {any} */ (r)[ak]))
      .map(clean),
    deleted: grid.getDeletedRows().map(clean),
  };
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string} key
 * @returns {boolean}
 */
export function _isMergeKey(grid, key) {
  const mc = grid.options.mergeCells;
  if (!mc) return false;
  for (const l of grid.leaves) {
    const def = l.def;
    if (def.key !== key || def.editor) continue;
    if (mc === true || (Array.isArray(mc) && mc.includes(key))) return true;
  }
  return false;
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {string} key
 * @returns {boolean}
 */
export function _isGroupKey(grid, key) {
  const gr = grid.options.grouping;
  return !!(gr && Array.isArray(gr.by) && gr.by.includes(key));
}

/**
 * @template [Row=any]
 * @param {Grid<Row>} grid
 * @param {Iterable<string>} keys
 * @param {number} [rowIndex]
 * @returns {void}
 */
export function _redrawAfterValues(grid, keys, rowIndex) {
  let regroup = false;
  let remerge = false;
  for (const k of keys) {
    if (_isGroupKey(grid, k)) regroup = true;
    if (_isMergeKey(grid, k)) remerge = true;
  }
  if (regroup) {
    // 행이 다른 그룹으로 옮겨 가야 하므로 화면 행을 다시 만든다
    grid._afterRowsChanged();
    return;
  }
  if (remerge) grid._mergeDirty = true;
  if (grid.options.grouping || remerge || rowIndex === undefined)
    grid.refresh(); // 소계 행은 다른 행에 걸린다
  else {
    if (rowIndex >= 0) grid.refreshRow(rowIndex);
    grid._renderFoot();
  }
}
