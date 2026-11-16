// @ts-check
import { locales } from "../core/locales.js";
import { escapeHtml } from "../util.js";

/**
 * 아래쪽 페이지 바: [선택 합계] [페이지 이동] ……… [상태 "1 - 15 of 300  Total 1,234"]
 */

/** @type {Map<string, Intl.NumberFormat|null>} 언어별 숫자 서식 (만들기 비싸서 기억해 둔다) */
const numberFormats = new Map();

/**
 * Intl에 넘길 수 있는 언어 이름. 모르는 이름(사용자가 등록한 locale 이름 등)이면 "en".
 * @param {string|null|undefined} locale
 */
export function intlLocale(locale) {
  if (!locale || typeof Intl === "undefined") return "en";
  try {
    return Intl.NumberFormat.supportedLocalesOf([locale]).length ? locale : "en";
  } catch (e) {
    return "en";
  }
}

/**
 * 천 단위 구분, 소수 2자리까지 (반올림). locale에 맞는 기호를 쓴다 (기본 "en": 1,234.5).
 * @param {number} n
 * @param {string} [locale]
 */
export function formatNumber(n, locale = "en") {
  const r = Math.round(n * 100) / 100;
  let nf = numberFormats.get(locale);
  if (nf === undefined) {
    nf = typeof Intl !== "undefined" ? new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }) : null;
    numberFormats.set(locale, nf);
  }
  return nf ? nf.format(r) : String(r);
}

/**
 * @typedef {Object} PageInfo
 * @property {number} currentPage  0부터
 * @property {number} [pageSize]
 * @property {number} [totalElements]
 * @property {number} totalPages
 */

/**
 * 현재 페이지가 가운데 오도록 보여 줄 페이지 번호(0부터)를 고른다.
 * @param {number} current
 * @param {number} total
 * @param {number} count
 * @returns {number[]}
 */
export function pageNumbers(current, total, count) {
  let start = current - Math.floor(count / 2);
  if (start < 0) start = 0;
  let end = current + count;
  if (end > total) end = total;
  if (end - start > count) end = start + count;
  if (end - start < count) start = end - count;
  if (start < 0) start = 0;
  const out = [];
  for (let p = start; p < end; p++) out.push(p);
  return out;
}

/**
 * @param {PageInfo} page
 * @param {{first?: string|null, prev?: string|null, next?: string|null, last?: string|null}} icons
 * @param {number} count
 */
export function navigationHtml(page, icons, count) {
  const nums = pageNumbers(page.currentPage, page.totalPages, count);
  if (!nums.length) return "";
  const btn = (move, html, selected) =>
    `<button type="button" class="pyo-page-btn" data-page-move="${move}"${selected ? ' aria-current="page" data-selected="true"' : ""}>${html}</button>`;
  let s = "";
  if (icons.first) s += btn("first", icons.first);
  s += btn("prev", icons.prev || "«");
  s += '<span class="pyo-page-nums">';
  for (const p of nums) s += btn(String(p + 1), String(p + 1), p === page.currentPage);
  s += "</span>";
  s += btn("next", icons.next || "»");
  if (icons.last) s += btn("last", icons.last);
  return s;
}

/**
 * 이동 버튼 → 목표 페이지(0부터). 같은 페이지면 null.
 * @param {string} move
 * @param {PageInfo} page
 */
export function targetPage(move, page) {
  let p;
  if (move === "first") p = 0;
  else if (move === "prev") p = Math.max(0, page.currentPage - 1);
  else if (move === "next") p = Math.min(page.totalPages - 1, page.currentPage + 1);
  else if (move === "last") p = page.totalPages - 1;
  else p = Number(move) - 1;
  if (!(p >= 0) || p === page.currentPage) return null;
  return p;
}

/**
 * 상태 문구에 넣을 값.
 * @param {number} first 보이는 첫 행 순번(0부터)
 * @param {number} visibleCount 한 화면 행 수
 * @param {number} rowCount
 * @param {PageInfo|null} page
 * @param {string} [locale]  숫자 서식 언어
 */
export function statusData(first, visibleCount, rowCount, page, locale = "en") {
  const to = Math.min(rowCount, first + visibleCount);
  const f = (n) => formatNumber(n, locale);
  return {
    fromRowIndex: rowCount ? f(first + 1) : "0",
    toRowIndex: f(to),
    dataRowCount: f(rowCount),
    totalElements: page && page.totalElements !== undefined ? f(page.totalElements) : false,
  };
}

/**
 * @param {ReturnType<typeof statusData>} d
 * @param {import("../core/locales.js").Messages} [m]
 */
export function defaultStatusHtml(d, m = /** @type {import("../core/locales.js").Messages} */ (locales.en)) {
  const total = d.totalElements !== false ? "&nbsp; " + escapeHtml(m.statusTotal(String(d.totalElements))) : "";
  return `<span>${escapeHtml(m.status(d.fromRowIndex, d.toRowIndex, d.dataRowCount))}${total}</span>`;
}

/**
 * 선택 합계 문구. 2셀 미만이면 "".
 * @param {{count: number, numCount: number, sum: number}} s
 * @param {import("../core/locales.js").Messages} [m]
 * @param {string} [locale]  숫자 서식 언어
 */
export function summaryText(s, m = /** @type {import("../core/locales.js").Messages} */ (locales.en), locale = "en") {
  if (s.count < 2) return "";
  const f = (n) => formatNumber(n, locale);
  let text = m.selected(f(s.count));
  if (s.numCount) {
    text += m.summarySeparator + m.selectedNumbers(f(s.numCount), f(s.sum), f(s.sum / s.numCount));
  }
  return text;
}
