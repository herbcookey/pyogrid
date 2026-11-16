// @ts-check
import { getValue, toNumber } from "../util.js";

/**
 * @typedef {{key: string, dir: "asc"|"desc"}} SortItem
 * @typedef {"smart"|"plain"|((a: any, b: any) => number)} SortCompare
 */

/** @type {Map<string, Intl.Collator|null>} 언어별 비교기 (만들기 비싸서 기억해 둔다) */
const collators = new Map();

/**
 * 자연 정렬 비교기 ("항목2" < "항목10"). locale을 모르면 "en".
 * @param {string} [locale]
 * @returns {Intl.Collator|null}
 */
export function collatorFor(locale = "en") {
  let c = collators.get(locale);
  if (c !== undefined) return c;
  c = null;
  if (typeof Intl !== "undefined" && Intl.Collator) {
    try {
      c = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    } catch (e) {
      c = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
    }
  }
  collators.set(locale, c);
  return c;
}

const isEmpty = (v) => v === null || v === undefined || v === "";

/**
 * 정렬용 값 비교.
 * - 둘 다 숫자(또는 "1,200" 같은 숫자 문자열)면 숫자로
 * - 아니면 자연 정렬 (Intl.Collator, numeric)
 * 빈 값은 sortRows가 따로 맨 뒤로 보낸다.
 * @param {any} a
 * @param {any} b
 * @param {string} [locale]
 */
export function compareSmart(a, b, locale) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na < nb ? -1 : na > nb ? 1 : 0;
  return compareText(String(a), String(b), collatorFor(locale));
}

/** @param {string} sa @param {string} sb @param {Intl.Collator|null} col */
function compareText(sa, sb, col) {
  if (col) return col.compare(sa, sb);
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
 * smart 모드는 빈 값(null, undefined, "")을 정렬 방향과 관계없이 맨 뒤에 두고,
 * 값마다 숫자 변환과 글자 변환을 정렬 전에 한 번만 해 둔다 (비교할 때마다 정규식을 돌지 않게).
 * @param {any[]} rows
 * @param {SortItem[]} sort
 * @param {SortCompare} [mode]
 * @param {string} [locale]  smart 모드의 글자 비교 언어 (기본 "en")
 */
export function sortRows(rows, sort, mode = "smart", locale = "en") {
  if (!sort || !sort.length) return rows.slice();
  const keys = sort.map((s) => s.key);
  const dirs = sort.map((s) => (s.dir === "desc" ? -1 : 1));
  const nk = keys.length;
  if (mode !== "smart" && mode !== undefined) {
    const cmp = typeof mode === "function" ? mode : comparePlain;
    const decorated = rows.map((row, i) => ({ row, i, v: keys.map((k) => getValue(row, k)) }));
    decorated.sort((x, y) => {
      for (let k = 0; k < nk; k++) {
        const r = cmp(x.v[k], y.v[k]);
        if (r) return r * dirs[k];
      }
      return x.i - y.i;
    });
    return decorated.map((d) => d.row);
  }
  const col = collatorFor(locale);
  // 키마다 [빈 값인가, 숫자(아니면 null), 글자]를 미리 만든다
  const decorated = rows.map((row, i) => {
    const e = new Array(nk);
    const n = new Array(nk);
    const s = new Array(nk);
    for (let k = 0; k < nk; k++) {
      const v = getValue(row, keys[k]);
      e[k] = isEmpty(v);
      n[k] = e[k] ? null : toNumber(v);
      s[k] = e[k] ? "" : String(v);
    }
    return { row, i, e, n, s };
  });
  decorated.sort((x, y) => {
    for (let k = 0; k < nk; k++) {
      const ea = x.e[k];
      const eb = y.e[k];
      if (ea || eb) {
        if (ea && eb) continue;
        return ea ? 1 : -1;
      }
      const na = x.n[k];
      const nb = y.n[k];
      let r;
      if (na !== null && nb !== null) r = na < nb ? -1 : na > nb ? 1 : 0;
      else r = compareText(x.s[k], y.s[k], col);
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
