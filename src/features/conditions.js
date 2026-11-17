// @ts-check
// 조건 필터: 글자(포함·시작·같음·같지 않음), 숫자(비교·범위), 날짜(범위).
// 조건마다 판정 함수를 한 번 만들고(compileCondition), 행마다 그 함수만 부른다.
import { toNumber } from "../util.js";

/**
 * @typedef {{type: "text", op: "contains"|"startsWith"|"equals"|"notEquals", value: string}} TextCondition
 * @typedef {{type: "number", op: "eq"|"ne"|"gt"|"ge"|"lt"|"le", value: number}} NumberCompareCondition
 * @typedef {{type: "number", op: "between", from?: number, to?: number}} NumberRangeCondition
 * @typedef {{type: "date", op?: "between", from?: string, to?: string}} DateCondition  from·to: "yyyy-MM-dd" (양 끝 포함)
 * @typedef {TextCondition|NumberCompareCondition|NumberRangeCondition|DateCondition} FilterCondition
 */

export const TEXT_OPS = ["contains", "startsWith", "equals", "notEquals"];
export const NUMBER_OPS = ["eq", "ne", "gt", "ge", "lt", "le", "between"];

const pad = (/** @type {number} */ n) => (n < 10 ? "0" : "") + n;
const daysIn = (/** @type {number} */ y, /** @type {number} */ m) =>
  m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;

/**
 * 연·월·일 → "yyyy-MM-dd" (없는 날짜면 null)
 * @param {number} y
 * @param {number} m
 * @param {number} d
 * @returns {string|null}
 */
function ymd(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m))) return null;
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
}

/** @type {Map<string, {re: RegExp, order: string[]}|null>} */
const formatCache = new Map();

/**
 * valueFormat 형식 글자("dd/MM/yyyy" 등)로 읽는다
 * @param {string} s
 * @param {string} fmt
 * @returns {string|null}
 */
function byFormat(s, fmt) {
  let f = formatCache.get(fmt);
  if (f === undefined) {
    const order = [];
    let src = "";
    let rest = fmt;
    while (rest) {
      const t = /^(yyyy|MM|dd)/.exec(rest);
      if (t) {
        order.push(t[1]);
        src += t[1] === "yyyy" ? "(\\d{4})" : "(\\d{1,2})";
        rest = rest.slice(t[1].length);
      } else {
        src += rest[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        rest = rest.slice(1);
      }
    }
    f = order.length === 3 ? { re: new RegExp("^" + src + "(?!\\d)"), order } : null;
    formatCache.set(fmt, f);
  }
  if (!f) return null;
  const m = f.re.exec(s);
  if (!m) return null;
  const part = (/** @type {string} */ k) => Number(m[f.order.indexOf(k) + 1]);
  return ymd(part("yyyy"), part("MM"), part("dd"));
}

/**
 * 값 → "yyyy-MM-dd" 글자 (날짜로 읽지 못하면 null). Date로 바꾸지 않고 글자에서 연·월·일을 읽는다.
 * - Date 객체: 그 날짜(지역 시각)의 연·월·일
 * - 글자: valueFormat 형식 글자가 있으면 먼저 그 형식으로, 아니면 "2026-11-13", "2026.11.13", "2026/1/2", "20261113".
 *   뒤에 시간이 붙어 있으면("2026-11-13T23:00:00Z", "2026-11-13 10:00") 날짜 부분만 본다 (시간대로 하루가 밀리지 않게).
 * @param {any} v
 * @param {string|Function|undefined|null} [valueFormat] date 편집기의 config.valueFormat (함수면 형식으로 쓰지 않는다)
 * @returns {string|null}
 */
export function dateKey(v, valueFormat) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (typeof valueFormat === "string" && valueFormat) {
    const r = byFormat(s, valueFormat);
    if (r) return r;
  }
  // 이미 "yyyy-MM-dd"(뒤에 시간이 붙어도 됨)이면 정규식 없이 그 부분을 쓴다 (가장 흔한 모양, 20만 행에서 차이가 크다)
  if (s.length >= 10 && s[4] === "-" && s[7] === "-" && !(s.charCodeAt(10) >= 48 && s.charCodeAt(10) <= 57)) {
    const head = s.slice(0, 10);
    if (/^\d{4}-\d\d-\d\d$/.test(head)) {
      const m = Number(head.slice(5, 7));
      const d = Number(head.slice(8, 10));
      return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(Number(head.slice(0, 4)), m) ? head : null;
    }
  }
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/.exec(s) || /^(\d{4})(\d{2})(\d{2})(?!\d)/.exec(s);
  return m ? ymd(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

/**
 * 값 → 숫자 (number이거나 "1,200" 같은 숫자 글자). 아니면 null
 * @param {any} v
 * @returns {number|null}
 */
export function numberKey(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  return toNumber(v);
}

const isNum = (/** @type {any} */ v) => typeof v === "number" && isFinite(v);
const absent = (/** @type {any} */ v) => v === undefined || v === null;

/**
 * 조건의 모양을 검사하고 정리한 복사본을 돌려준다. 틀리면 TypeError.
 * @param {any} c
 * @returns {FilterCondition}
 */
export function normalizeCondition(c) {
  const fail = (/** @type {string} */ why) => {
    throw new TypeError(`PyoGrid: invalid filter condition (${why}): ${JSON.stringify(c)}`);
  };
  if (!c || typeof c !== "object") fail("not an object");
  if (c.type === "text") {
    if (!TEXT_OPS.includes(c.op)) fail("unknown op");
    if (typeof c.value !== "string") fail("value must be a string");
    return { type: "text", op: c.op, value: c.value };
  }
  if (c.type === "number") {
    if (!NUMBER_OPS.includes(c.op)) fail("unknown op");
    if (c.op === "between") {
      if (!absent(c.from) && !isNum(c.from)) fail("from must be a number");
      if (!absent(c.to) && !isNum(c.to)) fail("to must be a number");
      if (absent(c.from) && absent(c.to)) fail("between needs from or to");
      /** @type {NumberRangeCondition} */
      const out = { type: "number", op: "between" };
      if (!absent(c.from)) out.from = c.from;
      if (!absent(c.to)) out.to = c.to;
      return out;
    }
    if (!isNum(c.value)) fail("value must be a finite number");
    return { type: "number", op: c.op, value: c.value };
  }
  if (c.type === "date") {
    if (!absent(c.op) && c.op !== "between") fail("unknown op");
    /** @type {DateCondition} */
    const out = { type: "date", op: "between" };
    for (const k of /** @type {const} */ (["from", "to"])) {
      if (absent(c[k])) continue;
      const d = typeof c[k] === "string" || c[k] instanceof Date ? dateKey(c[k]) : null;
      if (!d) fail(`${k} must be a date (yyyy-MM-dd)`);
      out[k] = /** @type {string} */ (d);
    }
    if (absent(out.from) && absent(out.to)) fail("date needs from or to");
    return out;
  }
  return fail("unknown type");
}

/**
 * 조건 → 판정 함수 (셀 값을 받아 통과하면 true)
 * @param {FilterCondition} c  normalizeCondition을 거친 조건
 * @param {{label?: (key: string) => string, valueFormat?: any}} [opts]
 *   label: 필터 목록에 보이는 글자 (filterKey 값을 받는다). 글자 조건은 이 글자와 비교한다
 * @returns {(value: any) => boolean}
 */
export function compileCondition(c, opts = {}) {
  if (c.type === "text") {
    const label = opts.label || ((/** @type {string} */ k) => k);
    // 필터 팝업의 검색칸과 같은 toLowerCase (toLocaleLowerCase(locale)는 Chrome에서 20만 행에 300ms 넘게 걸린다)
    const lower = (/** @type {string} */ s) => s.toLowerCase();
    const needle = lower(c.value);
    const text = (/** @type {any} */ v) => lower(String(label(v === null || v === undefined ? "" : String(v))));
    if (c.op === "contains") return (v) => text(v).includes(needle);
    if (c.op === "startsWith") return (v) => text(v).startsWith(needle);
    if (c.op === "equals") return (v) => text(v) === needle;
    return (v) => text(v) !== needle; // notEquals: equals의 반대 (빈 칸도 통과)
  }
  if (c.type === "number") {
    if (c.op === "between") {
      const lo = c.from;
      const hi = c.to;
      return (v) => {
        const x = numberKey(v);
        return x !== null && (lo === undefined || x >= lo) && (hi === undefined || x <= hi);
      };
    }
    const n = c.value;
    const cmp = { eq: (x) => x === n, ne: (x) => x === n, gt: (x) => x > n, ge: (x) => x >= n, lt: (x) => x < n, le: (x) => x <= n }[c.op];
    if (c.op === "ne") return (v) => !(numberKey(v) === n); // ne: eq의 반대 (빈 칸·숫자가 아닌 값도 통과, 엑셀과 같음)
    return (v) => {
      const x = numberKey(v);
      return x !== null && cmp(x);
    };
  }
  const { from, to } = c;
  const fmt = opts.valueFormat;
  return (v) => {
    const d = dateKey(v, fmt);
    return d !== null && (from === undefined || d >= from) && (to === undefined || d <= to);
  };
}

/**
 * 컬럼의 조건 종류: filterType이 있으면 그것, 없으면 date 편집기 → date, 숫자 컬럼 → number, 나머지 → text.
 * 숫자 컬럼은 선택 합계와 같은 기준이다 (numeric, money formatter, number·money 편집기).
 * @param {import("../core/columns.js").ColumnDef} def
 * @returns {"text"|"number"|"date"}
 */
export function filterTypeOf(def) {
  if (def.filterType === "text" || def.filterType === "number" || def.filterType === "date") return def.filterType;
  const ed = def.editor && def.editor.type;
  if (ed === "date") return "date";
  const numeric = def.numeric !== undefined ? !!def.numeric : def.formatter === "money" || ed === "number" || ed === "money";
  return numeric ? "number" : "text";
}
