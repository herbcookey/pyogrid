// @ts-check
import { sortRows } from "../core/sort.js";
import { getValue, toNumber } from "../util.js";

/**
 * 화면 행 만들기: source → 헤더 값 필터 → 정렬 → (그룹 합계 행 넣기 | 트리 펼치기)
 *
 * 그룹 합계 행은 다음 모양의 객체다:
 *   { __isGrouping: true, __groupingList: [행...], __groupingBy: { keys, labels }, __depth: 단계 }
 * 그룹이 끝나는 자리 뒤에 들어가고, 여러 단계면 안쪽 단계 합계가 먼저 온다.
 */

/** @param {any} v */
export const filterKey = (v) => (v === null || v === undefined ? "" : String(v));

/**
 * @param {any[]} list
 * @param {Map<string, Set<string>>} conds  key → 허용 값 (filterKey 기준)
 * @param {string} [exceptKey] 이 키 조건은 빼고 (필터 목록 만들 때)
 * @param {(row: any) => boolean} [pass] true면 조건과 관계없이 통과 (저장 전에 addRow로 넣은 행)
 */
export function filterRows(list, conds, exceptKey, pass) {
  const keys = [...conds.keys()].filter((k) => k !== exceptKey);
  if (!keys.length) return list;
  return list.filter((row) => {
    if (pass && pass(row)) return true;
    for (const k of keys) if (!/** @type {Set<string>} */ (conds.get(k)).has(filterKey(getValue(row, k)))) return false;
    return true;
  });
}

/** 숫자로 (숫자가 아닌 글자는 지우고, 못 읽으면 0) */
export function numberOf(v) {
  const n = numericValue(v);
  return n === null ? 0 : n;
}

/**
 * 합계용 숫자. 빈 값(null, undefined, 공백 글자)과 숫자가 없는 글자는 null (세지 않음).
 * "1,200", "1,200원"처럼 숫자가 든 글자는 숫자로 읽는다.
 * @param {any} v
 * @returns {number|null}
 */
export function numericValue(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (v === null || v === undefined || typeof v === "boolean") return null;
  const str = String(v).trim();
  if (!str) return null;
  const n = toNumber(str);
  if (n !== null) return n;
  const s = str.replace(/[^0-9.\-]/g, "");
  if (!/[0-9]/.test(s)) return null;
  const m = Number(s);
  return isFinite(m) ? m : null;
}

/** 소수 자리 수 (지수 표기 포함). 부동소수 합의 끝자리 오차를 지우는 데 쓴다 */
function decimalsOf(n) {
  const s = String(n);
  const e = s.indexOf("e-");
  if (e >= 0) return Math.min(20, Number(s.slice(e + 2)) + ((s.split("e")[0].split(".")[1] || "").length));
  const d = s.indexOf(".");
  return d < 0 ? 0 : Math.min(20, s.length - d - 1);
}

/** 값들을 더하고, 넣은 값의 가장 긴 소수 자리에서 반올림한다 (0.1 + 0.2 → 0.3) */
function sumOf(list, key) {
  let s = 0;
  let n = 0;
  let dec = 0;
  for (const r of list) {
    if (r.__isGrouping) continue;
    const v = numericValue(getValue(r, key));
    if (v === null) continue;
    s += v;
    n++;
    if (dec < 20 && !Number.isInteger(v)) dec = Math.max(dec, decimalsOf(v));
  }
  return { sum: dec ? Number(s.toFixed(dec)) : s, count: n };
}

/**
 * 합계 행 계산기. this와 첫 인자는 {key, list}.
 * sum·avg·min·max는 빈 값과 숫자가 아닌 글자를 세지 않는다 (아래 바의 선택 합계와 같은 기준).
 */
export const collectors = {
  sum() {
    return sumOf(this.list, this.key).sum;
  },
  avg() {
    const { sum, count } = sumOf(this.list, this.key);
    return count ? Math.round((sum / count) * 100) / 100 : "";
  },
  count() {
    return this.list.filter((r) => !r.__isGrouping).length;
  },
  min() {
    // Math.min(...배열)은 행이 수십만이면 인자 수 한도를 넘어 RangeError가 나므로 반복문으로 센다
    let m = Infinity;
    for (const r of this.list) {
      if (r.__isGrouping) continue;
      const v = numericValue(getValue(r, this.key));
      if (v !== null && v < m) m = v;
    }
    return m === Infinity ? "" : m;
  },
  max() {
    let m = -Infinity;
    for (const r of this.list) {
      if (r.__isGrouping) continue;
      const v = numericValue(getValue(r, this.key));
      if (v !== null && v > m) m = v;
    }
    return m === -Infinity ? "" : m;
  },
};

/**
 * @param {any[]} sorted 그룹 키로 정렬된 행
 * @param {string[]} by
 */
export function insertGroupRows(sorted, by) {
  const out = [];
  /** @type {any[][]} */
  const lists = by.map(() => []);
  /** @type {(string|undefined)[]} */
  const prev = by.map(() => undefined);
  const flush = (level, lastRow) => {
    // level 이상(안쪽) 단계의 합계 행을 안쪽부터 넣는다
    for (let g = by.length - 1; g >= level; g--) {
      if (!lists[g].length) continue;
      out.push({
        __isGrouping: true,
        __groupingList: lists[g],
        __groupingBy: { keys: by.slice(0, g + 1), labels: by.slice(0, g + 1).map((k) => getValue(lastRow, k)) },
        __depth: g,
      });
      lists[g] = [];
    }
  };
  let last = null;
  for (const row of sorted) {
    let changed = -1;
    for (let g = 0; g < by.length; g++) {
      const v = filterKey(getValue(row, by[g]));
      if (last && changed < 0 && v !== prev[g]) changed = g;
      prev[g] = v;
    }
    if (last && changed >= 0) flush(changed, last);
    for (let g = 0; g < by.length; g++) lists[g].push(row);
    out.push(row);
    last = row;
  }
  if (last) flush(0, last);
  return out;
}

/**
 * 부모 키로 트리를 만들어 펼친 순서대로 돌려준다. 접힌 행의 자식은 빠진다.
 * 부모가 없거나 비었거나 "top"이면 맨 위.
 * @param {any[]} list
 * @param {{parentKey: string, selfKey: string, collapseKey: string}} cfg
 * @param {(siblings: any[]) => any[]} sortSiblings
 * @returns {{rows: any[], meta: Map<any, {depth:number, children:any[], parent:any}>}}
 */
export function buildTree(list, cfg, sortSiblings) {
  // 키는 글자로 맞춰 비교한다 (id 1과 pid "1"이 같은 부모가 되게)
  const byId = new Map();
  for (const r of list) {
    const id = r[cfg.selfKey];
    if (id !== undefined && id !== null && id !== "" && !byId.has(String(id))) byId.set(String(id), r);
  }
  /** @type {Map<any, {depth:number, children:any[], parent:any}>} */
  const meta = new Map();
  for (const r of list) meta.set(r, { depth: 0, children: [], parent: null });
  const roots = [];
  for (const r of list) {
    const p = r[cfg.parentKey];
    const parent = p === undefined || p === null || p === "" || p === "top" ? null : byId.get(String(p));
    if (parent && parent !== r) {
      /** @type {{depth:number, children:any[], parent:any}} */ (meta.get(r)).parent = parent;
      /** @type {{depth:number, children:any[], parent:any}} */ (meta.get(parent)).children.push(r);
    } else roots.push(r);
  }
  const rows = [];
  const seen = new Set();
  const walk = (nodes, depth) => {
    for (const n of sortSiblings(nodes)) {
      if (seen.has(n)) continue; // 순환 참조 방지
      seen.add(n);
      const m = /** @type {{depth:number, children:any[], parent:any}} */ (meta.get(n));
      m.depth = depth;
      rows.push(n);
      if (!n[cfg.collapseKey] && m.children.length) walk(m.children, depth + 1);
      else if (m.children.length) markDepth(m.children, depth + 1);
    }
  };
  // 접힌 자손의 깊이도 정해 둔다 (펼쳤을 때·합계용)
  const markDepth = (nodes, depth) => {
    for (const n of nodes) {
      const m = /** @type {{depth:number, children:any[], parent:any}} */ (meta.get(n));
      if (seen.has(n)) continue;
      m.depth = depth;
      markDepth(m.children, depth + 1);
    }
  };
  walk(roots, 0);
  // 부모가 순환으로만 이어진 행은 맨 위로 (사라지지 않게)
  for (const r of list) if (!seen.has(r) && !isUnderCollapsed(r, meta, cfg)) walk([r], 0);
  return { rows, meta };
}

function isUnderCollapsed(row, meta, cfg) {
  let p = meta.get(row).parent;
  const guard = new Set();
  while (p && !guard.has(p)) {
    if (p[cfg.collapseKey]) return true;
    guard.add(p);
    p = meta.get(p).parent;
  }
  return false;
}

/**
 * @param {Object} o
 * @param {any[]} o.source
 * @param {Map<string, Set<string>>} o.filters
 * @param {import("../core/sort.js").SortItem[]} o.sort
 * @param {import("../core/sort.js").SortCompare} o.compare
 * @param {string} [o.locale]  글자 정렬 언어
 * @param {boolean} o.remoteSort
 * @param {{by: string[]}|null} o.grouping
 * @param {{parentKey:string, selfKey:string, collapseKey:string}|null} o.tree
 * @param {(row: any) => boolean} [o.pass]  필터와 관계없이 통과시킬 행 (저장 전에 넣은 행)
 * @returns {{rows: any[], dataRows: any[], treeMeta: Map<any, any>|null}}
 */
export function buildView(o) {
  const filtered = o.filters.size ? filterRows(o.source, o.filters, undefined, o.pass) : o.source.slice();
  if (o.tree) {
    const sort = o.remoteSort ? [] : o.sort;
    const t = buildTree(filtered, o.tree, (sib) => (sort.length ? sortRows(sib, sort, o.compare, o.locale) : sib));
    return { rows: t.rows, dataRows: filtered, treeMeta: t.meta };
  }
  let sort = o.remoteSort ? [] : o.sort;
  if (o.grouping && o.grouping.by.length) {
    // 그룹 키로 먼저 정렬한다 (오름차순 고정)
    const fixed = o.grouping.by.map((key) => {
      const user = o.sort.find((s) => s.key === key);
      return { key, dir: user ? user.dir : "asc" };
    });
    sort = fixed.concat(sort.filter((s) => !/** @type {{by: string[]}} */ (o.grouping).by.includes(s.key)));
  }
  const sorted = sort.length ? sortRows(filtered, sort, o.compare, o.locale) : filtered;
  if (o.grouping && o.grouping.by.length) return { rows: insertGroupRows(sorted, o.grouping.by), dataRows: sorted, treeMeta: null };
  return { rows: sorted, dataRows: sorted, treeMeta: null };
}

/**
 * 셀 병합: 위 행과 값이 같고, 왼쪽의 병합 컬럼도 모두 이어지면 합친다.
 * 편집기가 있는 컬럼과 그룹 합계 행은 합치지 않는다.
 * @param {any[]} rows
 * @param {{def: any}[]} leaves
 * @param {boolean|string[]} spec  true면 모든 컬럼, 배열이면 그 키들
 * @returns {Map<number, {start: Int32Array, end: Int32Array}>}  잎 순번 → 행마다 덩어리 시작·끝
 */
export function computeMerge(rows, leaves, spec) {
  /** @type {Map<number, {start: Int32Array, end: Int32Array}>} */
  const out = new Map();
  if (!spec || !rows.length) return out;
  const cols = [];
  leaves.forEach((l, i) => {
    const def = l.def;
    if (def.editor || def.key === undefined || def.key === null) return;
    if (spec === true || (Array.isArray(spec) && spec.includes(def.key))) cols.push(i);
  });
  const n = rows.length;
  let prevStart = null; // 왼쪽 병합 컬럼의 시작 (이어짐 판단)
  for (const c of cols) {
    const key = leaves[c].def.key;
    const start = new Int32Array(n);
    const end = new Int32Array(n);
    for (let r = 0; r < n; r++) {
      const row = rows[r];
      const cont =
        r > 0 &&
        !row.__isGrouping &&
        !rows[r - 1].__isGrouping &&
        filterKey(getValue(row, key)) === filterKey(getValue(rows[r - 1], key)) &&
        (!prevStart || prevStart[r] !== r);
      start[r] = cont ? start[r - 1] : r;
    }
    for (let r = n - 1; r >= 0; r--) end[r] = r < n - 1 && start[r + 1] === start[r] ? end[r + 1] : r;
    out.set(c, { start, end });
    prevStart = start;
  }
  return out;
}
