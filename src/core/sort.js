// @ts-check
import { getValue, toNumber } from "../util.js";

/**
 * @typedef {{key: string, dir: "asc"|"desc"}} SortItem
 * @typedef {"smart"|"plain"|((a: any, b: any) => number)} SortCompare
 */

const collator = typeof Intl !== "undefined" && Intl.Collator ? new Intl.Collator("ko", { numeric: true, sensitivity: "base" }) : null;

const isEmpty = (v) => v === null || v === undefined || v === "";

/**
 * 정렬용 값 비교.
 * - 둘 다 숫자(또는 "1,200" 같은 숫자 문자열)면 숫자로
 * - 아니면 한국어 자연 정렬 (Intl.Collator ko, numeric)
 * 빈 값은 sortRows가 따로 맨 뒤로 보낸다.
 */
export function compareSmart(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na < nb ? -1 : na > nb ? 1 : 0;
  const sa = String(a);
  const sb = String(b);
  if (collator) return collator.compare(sa, sb);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** 단순 비교: 형이 다르면 문자열로 바꾼 뒤 <, > */
export function comparePlain(a, b) {
  if (typeof a !== typeof b) {
    a = "" + a;
    b = "" + b;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 안정 정렬된 새 배열을 돌려준다 (원본 배열은 그대로).
 * smart 모드는 빈 값(null, undefined, "")을 정렬 방향과 관계없이 맨 뒤에 둔다.
 * @param {any[]} rows
 * @param {SortItem[]} sort
 * @param {SortCompare} [mode]
 */
export function sortRows(rows, sort, mode = "smart") {
  if (!sort || !sort.length) return rows.slice();
  const cmp = typeof mode === "function" ? mode : mode === "plain" ? comparePlain : compareSmart;
  const emptyLast = mode === "smart";
  const keys = sort.map((s) => s.key);
  const dirs = sort.map((s) => (s.dir === "desc" ? -1 : 1));
  // 값을 한 번만 읽어 둔다
  const decorated = rows.map((row, i) => ({ row, i, v: keys.map((k) => getValue(row, k)) }));
  decorated.sort((x, y) => {
    for (let k = 0; k < keys.length; k++) {
      const a = x.v[k];
      const b = y.v[k];
      if (emptyLast) {
        const ea = isEmpty(a);
        const eb = isEmpty(b);
        if (ea || eb) {
          if (ea && eb) continue;
          return ea ? 1 : -1;
        }
      }
      const r = cmp(a, b);
      if (r) return r * dirs[k];
    }
    return x.i - y.i;
  });
  return decorated.map((d) => d.row);
}

/**
 * 헤더 클릭 순환: 없음 → desc → asc → 없음
 * @param {"asc"|"desc"|undefined} cur
 * @returns {"asc"|"desc"|undefined}
 */
export function nextSortDir(cur) {
  if (!cur) return "desc";
  if (cur === "desc") return "asc";
  return undefined;
}
