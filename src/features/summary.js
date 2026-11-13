// @ts-check
import { collectors } from "./view.js";
import { formatters } from "../core/formatters.js";
import { isFn } from "../util.js";

/**
 * 합계 행(footSum)과 그룹 합계 행의 칸 정의:
 *   { key?, label?, collector?, formatter?, align?, colspan? }
 *  - key가 없으면 label (글자 또는 함수. this = {key, list, groupBy})
 *  - collector가 있으면 계산값 ("sum", "avg", "count", "min", "max" 또는 함수. this = {key, list})
 *  - formatter가 있으면 계산값에 적용 (this = {key, list, value})
 * 칸은 왼쪽 잎 컬럼부터 colspan만큼 차지한다 (줄 번호·행 선택 칸은 세지 않음).
 *
 * @typedef {{key?: string, label?: any, collector?: string|Function, formatter?: string|Function, align?: string, colspan?: number, className?: string}} SumCell
 */

/** @type {Record<string, Function>} 사용자 계산기 (PyoGrid.collectors에 등록) */
export const userCollectors = {};

/**
 * @param {SumCell} cell
 * @param {any[]} list
 * @param {any} [groupBy]
 * @returns {string} HTML
 */
export function sumCellValue(cell, list, groupBy) {
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
 * 합계 행 한 줄의 고정·스크롤 영역 HTML. 고정 경계를 걸치는 칸은 고정 쪽에 글자를 두고 나머지는 빈칸.
 * @param {import("../grid.js").PyoGrid} g
 * @param {SumCell[]} cells
 * @param {any[]} list
 * @param {any} [groupBy]
 */
export function sumRowHtml(g, cells, list, groupBy) {
  let fz = "";
  let sc = "";
  for (const a of g.aside) fz += `<div class="pyo-cell pyo-aside pyo-sum-cell" style="width:${a.width}px"></div>`;
  const n = g.leaves.length;
  let c = 0;
  const part = (from, to, html, align, extra) => {
    let w = 0;
    for (let i = from; i < to; i++) w += g.widths[i];
    return `<div class="pyo-cell pyo-sum-cell${align ? " pyo-al-" + align : ""}${extra ? " " + extra : ""}" data-c="${from}" style="width:${w}px">${html}</div>`;
  };
  for (const cell of cells || []) {
    if (c >= n) break;
    const span = Math.max(1, Math.min(cell.colspan || 1, n - c));
    const end = c + span;
    const html = sumCellValue(cell, list, groupBy);
    if (c < g.frozenCount) {
      fz += part(c, Math.min(end, g.frozenCount), html, cell.align, cell.className);
      if (end > g.frozenCount) sc += part(g.frozenCount, end, "", cell.align, cell.className);
    } else sc += part(c, end, html, cell.align, cell.className);
    c = end;
  }
  // 정의가 모자라면 남은 칸은 빈칸
  for (; c < n; c++) {
    if (c < g.frozenCount) fz += part(c, c + 1, "", "");
    else sc += part(c, c + 1, "", "");
  }
  return (
    `<div class="pyo-fz" style="width:${g.fzWidth}px">${fz}</div>` + `<div class="pyo-sc" style="width:${g.scWidth}px">${sc}</div>`
  );
}
