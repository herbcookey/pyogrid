// @ts-check
/**
 * 셀 편집기 종류.
 *
 * kind
 *  - "input"  : 그리드가 가진 입력칸 하나(textarea)로 편집한다. 셀에서 바로 타이핑(한글 포함)할 수 있다.
 *  - "list"   : 선택 목록 팝업 (select)
 *  - "toggle" : 셀 안에서 바로 바뀐다 (checkbox)
 *
 * 입력칸 편집기 함수
 *  - format(value, config)        : 편집을 시작할 때 입력칸에 넣을 글자
 *  - parse(text, config)          : 저장할 값. {ok:false}면 잘못된 입력이라 편집을 끝내지 않는다.
 *  - sanitize(text, config)       : 입력 중 허용하지 않는 글자를 지운다 (한글 조합 중에는 부르지 않음)
 */

/**
 * @typedef {Object} EditorType
 * @property {"input"|"list"|"toggle"} kind
 * @property {boolean} [typeToEdit]   셀에서 글자를 치면 바로 편집 시작
 * @property {boolean} [clearable]    Delete로 지울 수 있음
 * @property {string} [popup]         "calendar"
 * @property {RegExp} [sig]           서식 글자를 뺀 의미 있는 글자 (입력 정리 뒤 커서 위치 계산용)
 * @property {(v: any, cfg: any) => string} [format]
 * @property {(s: string, cfg: any) => {ok: boolean, value?: any}} [parse]
 * @property {(s: string, cfg: any) => string} [sanitize]
 */

import { toNumber } from "../util.js";

const isEmpty = (v) => v === null || v === undefined || v === "";

/* ---------------- 숫자 ---------------- */

/** 천 단위 쉼표 (소수 부분은 그대로) */
export function addCommas(s) {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const dot = body.indexOf(".");
  const int = dot < 0 ? body : body.slice(0, dot);
  const frac = dot < 0 ? "" : body.slice(dot);
  return (neg ? "-" : "") + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + frac;
}

/**
 * 숫자 입력 정리: 숫자, 맨 앞 "-", 점 하나만 남긴다. decimal=0이면 점도 지운다.
 * @param {string} s
 * @param {{decimal?: number}} [cfg]
 */
export function sanitizeNumber(s, cfg = {}) {
  let out = "";
  let dot = false;
  let decimals = 0;
  const maxDec = cfg && typeof cfg.decimal === "number" ? cfg.decimal : Infinity;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") {
      if (dot) {
        if (decimals >= maxDec) continue;
        decimals++;
      }
      out += ch;
    } else if (ch === "-" && out === "") out = "-";
    else if (ch === "." && !dot && maxDec > 0) {
      dot = true;
      out += ".";
    }
  }
  return out;
}

/**
 * @param {string} s
 * @param {{decimal?: number, min?: number, max?: number}} [cfg]
 */
export function parseNumber(s, cfg = {}) {
  const t = String(s).replace(/[,\s]/g, "");
  if (t === "") return { ok: true, value: "" };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false };
  let n = Number(t);
  if (!isFinite(n)) return { ok: false };
  if (cfg && typeof cfg.min === "number" && n < cfg.min) n = cfg.min;
  if (cfg && typeof cfg.max === "number" && n > cfg.max) n = cfg.max;
  if (cfg && typeof cfg.decimal === "number") n = Number(n.toFixed(cfg.decimal));
  return { ok: true, value: n };
}

/* ---------------- 날짜 ---------------- */

const pad = (n) => (n < 10 ? "0" : "") + n;

/** @param {Date} d */
export const formatDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

/** 입력 중인 날짜: 숫자만 남겨 yyyy-MM-dd 모양으로 하이픈을 넣는다 */
export function sanitizeDate(s) {
  const d = String(s).replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return d.slice(0, 4) + "-" + d.slice(4);
  return d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6);
}

/**
 * "2026-11-12", "20261112", "2026.11.12", "2026/1/2" → "2026-11-12". 없는 날짜는 {ok:false}.
 * @param {string} s
 */
export function parseDate(s) {
  const t = String(s).trim();
  if (t === "") return { ok: true, value: "" };
  let m = t.match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})$/);
  if (!m && /^\d{8}$/.test(t)) m = [t, t.slice(0, 4), t.slice(4, 6), t.slice(6)];
  if (!m) return { ok: false };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return { ok: false };
  return { ok: true, value: formatDate(d) };
}

/** 값 → Date (날짜가 아니면 null) */
export function toDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const p = parseDate(v === null || v === undefined ? "" : String(v).slice(0, 10));
  if (!p.ok || !p.value) return null;
  const [y, m, d] = p.value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Date를 저장 형식으로. 형식은 yyyy·MM·dd를 바꾸는 글자("yyyy-MM-dd", "yyyyMMdd", "yyyy.MM.dd" 등)
 * 또는 (date) => 값 함수. 없으면 "yyyy-MM-dd".
 * @param {Date} d
 * @param {string|((d: Date) => any)|undefined|null} fmt
 */
export function formatDateAs(d, fmt) {
  if (typeof fmt === "function") return fmt(d);
  const f = typeof fmt === "string" && fmt ? fmt : "yyyy-MM-dd";
  return f.replace(/yyyy|MM|dd/g, (t) => (t === "yyyy" ? String(d.getFullYear()) : t === "MM" ? pad(d.getMonth() + 1) : pad(d.getDate())));
}

/**
 * date 편집기의 저장 값. config.valueFormat으로 저장 형식을 정한다 (기본 "yyyy-MM-dd").
 * 입력칸에서는 항상 yyyy-MM-dd로 보이고, 저장할 때만 이 형식으로 바꾼다.
 * @param {string} s
 * @param {{valueFormat?: string|((d: Date) => any)}} [cfg]
 */
export function parseDateValue(s, cfg) {
  const p = parseDate(s);
  if (!p.ok || p.value === "" || !cfg || !cfg.valueFormat) return p;
  const [y, m, d] = /** @type {string} */ (p.value).split("-").map(Number);
  return { ok: true, value: formatDateAs(new Date(y, m - 1, d), cfg.valueFormat) };
}

/** 저장된 날짜 값(20261113, Date 등) → 입력칸 글자 yyyy-MM-dd. 날짜로 읽지 못하면 그대로 */
function dateText(v) {
  if (isEmpty(v)) return "";
  const d = toDate(v instanceof Date ? v : String(v));
  return d ? formatDate(d) : String(v);
}

/* ---------------- 선택 목록 ---------------- */

/**
 * editor.config에서 목록을 꺼낸다. columnKeys로 값·글자 키를 바꿀 수 있다.
 * @param {any} cfg
 * @returns {{value: any, text: string}[]}
 */
export function selectOptions(cfg) {
  const c = cfg || {};
  const keys = { optionValue: "value", optionText: "text", ...(c.columnKeys || {}) };
  const opts = Array.isArray(c.options) ? c.options : [];
  return opts.map((o) =>
    o !== null && typeof o === "object"
      ? { value: o[keys.optionValue], text: String(o[keys.optionText] ?? o[keys.optionValue] ?? "") }
      : { value: o, text: String(o) },
  );
}

/* ---------------- 체크박스 ---------------- */

/**
 * @param {any} v
 * @param {any} cfg  {trueValue, falseValue}
 */
export function isChecked(v, cfg) {
  if (cfg && cfg.trueValue !== undefined) return String(v) === String(cfg.trueValue);
  return v === true || v === "true" || v === 1 || v === "1" || v === "Y";
}

/** @param {any} cfg */
export function checkboxValue(checked, cfg) {
  if (cfg && cfg.trueValue !== undefined) return checked ? cfg.trueValue : cfg.falseValue;
  return checked;
}

/* ---------------- 붙여넣기·저장 공통 ---------------- */

/** editor.attributes의 maxlength (없으면 0) */
export function maxLengthOf(editor) {
  const a = editor && editor.attributes;
  if (!a) return 0;
  const n = Number(a.maxlength ?? a.maxLength);
  return n > 0 ? Math.floor(n) : 0;
}

/**
 * 붙여넣거나 편집해 얻은 값이 지금 값과 같은 뜻인가.
 * 입력칸 편집기는 지금 값을 편집기에 넣었다 꺼낸 값(parse(format(old)))과 비교한다.
 * 그래서 text 칸의 숫자 0과 "0", money 칸의 "1,200"과 1200은 같은 값이다.
 * 단, 넣었다 꺼내면서 숫자가 달라졌으면(min·max로 잘림, decimal로 반올림) 같은 값으로 보지 않는다.
 * 기존 값이 편집기 제한 밖일 때(min:0 칸의 -5) 경계값(0)으로 고칠 수 있어야 하기 때문이다.
 * @param {EditorType} type
 * @param {any} cfg
 * @param {any} oldValue
 * @param {any} newValue
 */
export function sameValue(type, cfg, oldValue, newValue) {
  if (oldValue === newValue || (isEmpty(oldValue) && isEmpty(newValue))) return true;
  if (type.kind === "input" && type.format && type.parse) {
    const p = type.parse(type.format(oldValue, cfg), cfg);
    if (!p.ok) return false;
    if (typeof p.value === "number") {
      const o = typeof oldValue === "number" ? oldValue : toNumber(oldValue);
      if (o !== null && o !== p.value) return false; // 보정이 일어났다
    }
    return p.value === newValue || (isEmpty(p.value) && isEmpty(newValue));
  }
  return String(oldValue) === String(newValue);
}

/* ---------------- 등록 ---------------- */

/** @type {Record<string, EditorType>} */
export const editorTypes = {
  text: {
    kind: "input",
    typeToEdit: true,
    clearable: true,
    format: (v) => (isEmpty(v) ? "" : String(v)),
    parse: (s) => ({ ok: true, value: s }),
  },
  number: {
    kind: "input",
    typeToEdit: true,
    clearable: true,
    format: (v) => (isEmpty(v) ? "" : String(v).replace(/,/g, "")),
    parse: parseNumber,
    sanitize: sanitizeNumber,
  },
  money: {
    kind: "input",
    typeToEdit: true,
    clearable: true,
    format: (v) => (isEmpty(v) ? "" : addCommas(sanitizeNumber(String(v)))),
    parse: parseNumber,
    sanitize: (s, cfg) => addCommas(sanitizeNumber(s, cfg)),
  },
  date: {
    kind: "input",
    typeToEdit: true,
    clearable: true,
    popup: "calendar",
    sig: /[0-9]/,
    format: dateText,
    parse: parseDateValue,
    sanitize: sanitizeDate,
  },
  select: { kind: "list", typeToEdit: true, clearable: true },
  checkbox: { kind: "toggle" },
};
