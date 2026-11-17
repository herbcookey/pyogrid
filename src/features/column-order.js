// @ts-check
// 컬럼 순서: 정의(options.columns)는 그대로 두고, 잎 key 목록(order)으로 화면 순서를 정한다.
// 같은 부모 안의 형제끼리만 순서가 바뀐다 (core/columns.js orderSiblings).
// 옮길 수 없는 형제(key가 없는 잎, reorderable: false, key 있는 잎이 없는 그룹)는 정의 자리에 남고, 나머지가 남은 자리를 채운다.
import { buildColumnModel, rankOf, orderSiblings } from "../core/columns.js";

/**
 * @typedef {import("../core/columns.js").ColumnDef} ColumnDef
 * @typedef {import("../core/columns.js").LeafColumn} LeafColumn
 * @typedef {{index: number, keys: string[], leaves: LeafColumn[], same: boolean}} MoveCandidate
 *   index: 옮긴 뒤 그 컬럼(그룹이면 첫 잎)의 잎 번호, keys: 그때의 순서, same: 지금 자리
 */

const hasKey = (/** @type {any} */ d) => d && d.key !== undefined && d.key !== null;

/**
 * 끌기·moveColumn으로 옮길 수 있는 형제인가
 * @param {ColumnDef} def
 * @returns {boolean}
 */
export function isMovable(def) {
  if (!def || def.reorderable === false) return false;
  if (!Array.isArray(def.columns)) return hasKey(def);
  /** @param {any[]} list @returns {boolean} */
  const any = (list) => list.some((d) => d && (Array.isArray(d.columns) ? any(d.columns) : hasKey(d)));
  return any(def.columns);
}

/**
 * 지금 순서의 잎 key (숨긴 컬럼 포함). override로 한 형제 목록의 배치를 바꿔 볼 수 있다
 * @param {ColumnDef[]} defs
 * @param {string[]|null} order
 * @param {Map<ColumnDef[], ColumnDef[]>} [override]
 * @returns {string[]}
 */
export function displayKeys(defs, order, override) {
  const rank = order ? rankOf(order) : null;
  /** @type {string[]} */
  const out = [];
  /** @param {any} list */
  const walk = (list) => {
    if (!Array.isArray(list)) return;
    const arranged = (override && override.get(list)) || (rank ? orderSiblings(list, rank) : list);
    for (const def of arranged) {
      if (!def) continue;
      if (Array.isArray(def.columns)) walk(def.columns);
      else if (hasKey(def)) out.push(String(def.key));
    }
  };
  walk(defs);
  return out;
}

/**
 * def가 들어 있는 형제 목록 (최상위 배열 또는 그룹의 columns)
 * @param {ColumnDef[]} defs
 * @param {ColumnDef} target
 * @returns {ColumnDef[]|null}
 */
export function parentList(defs, target) {
  /** @param {any} list @returns {ColumnDef[]|null} */
  const find = (list) => {
    if (!Array.isArray(list)) return null;
    if (list.includes(target)) return list;
    for (const d of list) {
      const r = d && Array.isArray(d.columns) ? find(d.columns) : null;
      if (r) return r;
    }
    return null;
  };
  return find(defs);
}

/**
 * 고정 영역에 있는 정의들
 * @param {LeafColumn[]} leaves
 * @param {number} frozen
 */
export function frozenSet(leaves, frozen) {
  return new Set(leaves.slice(0, frozen).map((l) => l.def));
}

/**
 * 두 잎 목록의 고정 영역 컬럼이 같은가 (고정 경계를 넘은 컬럼이 없는가)
 * @param {LeafColumn[]} a
 * @param {LeafColumn[]} b
 * @param {number} frozen
 */
export function sameFrozen(a, b, frozen) {
  const s = frozenSet(a, frozen);
  const t = frozenSet(b, frozen);
  if (s.size !== t.size) return false;
  for (const d of s) if (!t.has(d)) return false;
  return true;
}

/**
 * 컬럼 하나(잎 또는 그룹)를 같은 부모 안에서 놓을 수 있는 모든 자리. 고정 경계를 넘는 자리는 뺀다.
 * 지금 자리도 넣는다 (same: true). 화면에 보이지 않는 컬럼이거나 옮길 수 없으면 빈 배열.
 * @param {ColumnDef[]} defs
 * @param {string[]|null} order
 * @param {ColumnDef} target
 * @param {LeafColumn[]} current 지금 잎 목록
 * @param {number} frozen 고정 잎 수
 * @returns {MoveCandidate[]}
 */
export function moveCandidates(defs, order, target, current, frozen) {
  const list = parentList(defs, target);
  if (!list || !isMovable(target)) return [];
  const cur = order ? orderSiblings(list, rankOf(order)) : list.slice();
  const movable = cur.filter((d) => isMovable(d));
  /** @type {number[]} 옮길 수 있는 형제가 놓일 수 있는 자리 */
  const free = [];
  cur.forEach((d, i) => {
    if (isMovable(d)) free.push(i);
  });
  const rest = movable.filter((d) => d !== target);
  const at = movable.indexOf(target);
  /** @type {MoveCandidate[]} */
  const out = [];
  for (let k = 0; k <= rest.length; k++) {
    const seq = rest.slice(0, k).concat([target], rest.slice(k));
    const arr = cur.slice();
    seq.forEach((d, j) => (arr[free[j]] = d));
    const keys = displayKeys(defs, order, new Map([[list, arr]]));
    const { leaves, header } = buildColumnModel(defs, keys);
    const index = Array.isArray(target.columns)
      ? (header.find((h) => h.def === target) || { colStart: -1 }).colStart
      : leaves.findIndex((l) => l.def === target);
    if (index < 0) continue;
    if (k !== at && !sameFrozen(current, leaves, frozen)) continue;
    out.push({ index, keys, leaves, same: k === at });
  }
  return out;
}
