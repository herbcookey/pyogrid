// @ts-check
/**
 * 아래쪽 페이지 바: [선택 합계] [페이지 이동] ……… [상태 "1 - 15 of 300  Total 1,234"]
 */

const nf = typeof Intl !== "undefined" ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }) : null;

/** 천 단위 쉼표, 소수 2자리까지 (반올림) */
export function formatNumber(n) {
  const r = Math.round(n * 100) / 100;
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
 */
export function statusData(first, visibleCount, rowCount, page) {
  const to = Math.min(rowCount, first + visibleCount);
  return {
    fromRowIndex: rowCount ? formatNumber(first + 1) : "0",
    toRowIndex: formatNumber(to),
    dataRowCount: formatNumber(rowCount),
    totalElements: page && page.totalElements !== undefined ? formatNumber(page.totalElements) : false,
  };
}

/** @param {ReturnType<typeof statusData>} d */
export function defaultStatusHtml(d) {
  return `<span>${d.fromRowIndex} - ${d.toRowIndex} of ${d.dataRowCount}${d.totalElements !== false ? "&nbsp; Total " + d.totalElements : ""}</span>`;
}

/**
 * 선택 합계 문구. 2셀 미만이면 "".
 * @param {{count: number, numCount: number, sum: number}} s
 */
export function summaryText(s) {
  if (s.count < 2) return "";
  let text = "선택 " + formatNumber(s.count) + "셀";
  if (s.numCount) {
    text += " · 숫자 " + formatNumber(s.numCount) + " · 합계 " + formatNumber(s.sum) + " · 평균 " + formatNumber(s.sum / s.numCount);
  }
  return text;
}
