// @ts-check
/** 공통 도우미. 외부 의존성 없음. */

const HTML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** HTML 텍스트·속성에 넣을 값을 이스케이프한다. */
export function escapeHtml(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => HTML_ESC[c]);
}

/**
 * @param {any} v
 * @returns {v is Function}
 */
export const isFn = (v) => typeof v === "function";
/** @param {any} v */
export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * 일반 객체만 깊게 병합한다 (배열·함수·DOM 요소는 그대로 대입).
 * @param {any} target
 * @param  {...any} sources
 */
export function deepMerge(target, ...sources) {
  for (const src of sources) {
    if (!isObj(src)) continue;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (isPlain(v)) {
        if (!isPlain(target[k])) target[k] = {};
        deepMerge(target[k], v);
      } else {
        target[k] = v;
      }
    }
  }
  return target;
}

function isPlain(v) {
  if (!isObj(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const pathCache = new Map();

/**
 * "a.b", "a['한글 키']", "a[0].b" 형태의 키를 경로 배열로 바꾼다. 경로가 아니면 null.
 * eval·Function() 없이 직접 해석한다.
 * @param {string} key
 * @returns {string[] | null}
 */
export function parseKeyPath(key) {
  if (typeof key !== "string" || !/[.[\]]/.test(key)) return null;
  if (pathCache.has(key)) return pathCache.get(key);
  const out = [];
  const re = /([^.[\]]+)|\[\s*(?:'([^']*)'|"([^"]*)"|([^\]]*?))\s*\]/g;
  let m;
  while ((m = re.exec(key))) {
    const part = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    out.push(part);
  }
  pathCache.set(key, out);
  return out;
}

/** 행에서 key 값을 읽는다 (경로 키 지원). */
export function getValue(row, key) {
  if (!row || key === undefined || key === null) return undefined;
  const p = parseKeyPath(key);
  if (!p) return row[key];
  let cur = row;
  for (const part of p) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** 행에 key 값을 쓴다 (경로 키 지원, 중간 객체가 없으면 쓰지 않는다). */
export function setValue(row, key, value) {
  const p = parseKeyPath(key);
  if (!p) {
    row[key] = value;
    return true;
  }
  let cur = row;
  for (let i = 0; i < p.length - 1; i++) {
    cur = cur[p[i]];
    if (cur === null || typeof cur !== "object") return false;
  }
  cur[p[p.length - 1]] = value;
  return true;
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {Record<string,string>} [attrs]
 */
export function h(tag, className, attrs) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
  return el;
}

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** 숫자처럼 보이는 문자열("1,200", " 12.5 ")을 숫자로. 아니면 null. */
export function toNumber(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s) || /^[-+]?\.\d+$/.test(s)) return Number(s.replace(/,/g, ""));
  return null;
}

/** deprecate로 이미 알린 id */
const warned = new Set();

/**
 * 폐기 예정인 옵션·메서드를 쓸 때 console.warn으로 한 번 알린다. 같은 id는 페이지에서 한 번만 알린다.
 * 내부용이며 index.js에서 내보내지 않는다. message는 영어로 쓰고, 무엇을 대신 쓰면 되는지 적는다.
 * @param {string} id  폐기 항목을 가리키는 이름 (예: "option:oldName")
 * @param {string} message
 */
export function deprecate(id, message) {
  if (warned.has(id)) return;
  warned.add(id);
  console.warn("[pyogrid] " + message);
}
