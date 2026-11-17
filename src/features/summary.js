// @ts-check
import { collectors } from "./view.js";
import { formatters } from "../core/formatters.js";
import { isFn, escapeHtml } from "../util.js";
import { colAttrs } from "../grid/a11y.js";

/**
 * 합계 행(footSum)과 그룹 합계 행의 칸 정의:
 *   { key?, label?, collector?, formatter?, align?, colspan?, className?, html? }
 *  - key가 없으면 label (글자 또는 함수. this = {key, list, groupBy})
 *  - collector가 있으면 계산값 ("sum", "avg", "count", "min", "max" 또는 함수. this = {key, list})
 *  - formatter가 있으면 계산값에 적용 (this = {key, list, value})
 *  - label·formatter 결과는 글자로 넣는다. html: true면 HTML로 넣는다 (그룹 이름 같은 데이터 글자로 스크립트가 들어오지 않게)
 * 칸은 왼쪽 잎 컬럼부터 colspan만큼 차지한다 (줄 번호·행 선택 칸은 세지 않음).
 * 덮는 컬럼은 정의 순서로 정하고, 컬럼을 옮기면 지금 순서로 조각을 놓는다 (sumPieces).
 *
 * @typedef {{key?: string, label?: any, collector?: string|Function, formatter?: string|Function, align?: string, colspan?: number, className?: string, html?: boolean}} SumCell
 */

/** @type {Record<string, Function>} 사용자 계산기 (PyoGrid.collectors에 등록) */
export const userCollectors = {};

/**
 * @param {SumCell} cell
 * @param {any[]} list
 * @param {any} [groupBy]
 * @returns {string} HTML (html: true가 아니면 이스케이프한 글자)
 */
export function sumCellValue(cell, list, groupBy) {
  const out = sumCellRaw(cell, list, groupBy);
  return cell.html ? out : escapeHtml(out);
}

/** @param {SumCell} cell @param {any[]} list @param {any} [groupBy] */
function sumCellRaw(cell, list, groupBy) {
  const ctx = { key: cell.key, list, groupBy, value: undefined };
  if (cell.key === undefined || cell.key === null) {
    const l = isFn(cell.label) ? cell.label.call(ctx, ctx) : cell.label;
    return l === undefined || l === null ? "" : String(l);
  }
  if (!cell.collector) return "";
  const col = isFn(cell.collector) ? cell.collector : userCollectors[cell.collector] || collectors[cell.collector];
  if (!col) return "";
  const value = col.call(ctx, ctx);
  if (!cell.formatter) return value === undefined || value === null ? "" : String(value);
  ctx.value = value;
  const f = isFn(cell.formatter) ? cell.formatter : formatters[cell.formatter];
  const out = f ? f.call(ctx, ctx) : value;
  return out === undefined || out === null ? "" : String(out);
}

/**
 * 합계 행 한 줄을 지금 컬럼 순서의 조각으로 나눈다.
 * 칸이 덮는 컬럼은 정의 순서(잎의 defIndex)로 정하고, 지금 순서에서 붙어 있는 것끼리 한 조각으로 묶는다.
 * 한 칸이 덮던 컬럼이 떨어지면 조각이 여럿이 되고, 글자는 왼쪽 첫 조각에만 넣는다(text).
 * 정의를 덮지 않는 컬럼은 칸 없는 한 칸짜리 조각이다. 결과는 지금 순서에만 달려 있다.
 * @param {import("../grid.js").PyoGrid} g
 * @param {SumCell[]} cells
 * @returns {{from: number, to: number, cell: SumCell|null, text: boolean}[]}
 */
export function sumPieces(g, cells) {
  const n = g.leaves.length;
  /** @type {number[]} 정의 순서 자리 → 칸 순번 (-1: 칸 없음) */
  const cover = new Array(n).fill(-1);
  let c = 0;
  const list = cells || [];
  for (let ci = 0; ci < list.length && c < n; ci++) {
    const span = Math.max(1, Math.min(list[ci].colspan || 1, n - c));
    for (let i = c; i < c + span; i++) cover[i] = ci;
    c += span;
  }
  const idOf = (/** @type {number} */ p) => {
    const d = g.leaves[p].defIndex;
    return cover[d === undefined ? p : d];
  };
  const out = [];
  const seen = new Set();
  for (let p = 0; p < n;) {
    const id = idOf(p);
    let q = p + 1;
    if (id >= 0) while (q < n && idOf(q) === id) q++;
    out.push({ from: p, to: q, cell: id >= 0 ? list[id] : null, text: id >= 0 && !seen.has(id) });
    if (id >= 0) seen.add(id);
    p = q;
  }
  return out;
}

/**
 * 합계 행 한 줄의 고정·스크롤 영역 HTML. 고정 경계를 걸치는 칸은 고정 쪽에 글자를 두고 나머지는 빈칸.
 * @param {import("../grid.js").PyoGrid} g
 * @param {SumCell[]} cells
 * @param {any[]} list
 * @param {any} [groupBy]
 */
export function sumRowHtml(g, cells, list, groupBy) {
  let fz = "";
  let sc = "";
  g.aside.forEach((a, k) => (fz += `<div class="pyo-cell pyo-aside pyo-sum-cell" role="gridcell" aria-colindex="${k + 1}" style="width:${a.width}px"></div>`));
  const part = (from, to, html, align, extra) => {
    let w = 0;
    for (let i = from; i < to; i++) w += g.widths[i];
    return `<div class="pyo-cell pyo-sum-cell${align ? " pyo-al-" + align : ""}${extra ? " " + escapeHtml(extra) : ""}" role="gridcell"${colAttrs(g, from, to)} data-c="${from}" style="width:${w}px">${html}</div>`;
  };
  for (const piece of sumPieces(g, cells)) {
    const { from, to, cell } = piece;
    const html = cell && piece.text ? sumCellValue(cell, list, groupBy) : "";
    const align = cell ? cell.align : "";
    const extra = cell ? cell.className : "";
    if (from < g.frozenCount) {
      fz += part(from, Math.min(to, g.frozenCount), html, align, extra);
      if (to > g.frozenCount) sc += part(g.frozenCount, to, "", align, extra);
    } else sc += part(from, to, html, align, extra);
  }
  return `<div class="pyo-fz" style="width:${g.fzWidth}px">${fz}</div>` + `<div class="pyo-sc" style="width:${g.scWidth}px">${sc}</div>`;
}
