// @ts-check
import { getValue, isFn, escapeHtml } from "../util.js";
import { sumCellValue } from "./summary.js";

/**
 * xlsx 내보내기. SheetJS(window.XLSX)가 있을 때만 쓴다 (그리드 자체는 의존하지 않음).
 * 화면에 보이는 글자(formatter 결과)를 쓰되, 숫자는 숫자 셀로 넣는다:
 *  - "1,234", "-1,234.5"처럼 쉼표 숫자 → 숫자 + "#,##0" 서식
 *  - 원래 값이 숫자이거나 money formatter·오른쪽 정렬·합계 칸이면 숫자 모양 글자 → 숫자
 *  - 앞자리 0이 있는 코드(0012 등)는 글자로 둔다
 * 다단 헤더·합계 칸의 colspan·rowspan은 병합 셀로 남긴다.
 *
 * @typedef {{t: "s"|"n", v: any, z?: string}} XCell
 * @typedef {{rows: (XCell|null)[][], merges: {s:{r:number,c:number}, e:{r:number,c:number}}[], widths: number[], headerRows: number}} ExportData
 */

/** 글자를 뽑아낼 때 쓰는 문서 하나 (셀마다 DOMParser를 새로 만들지 않게). 스크립트를 실행하지 않는 빈 문서다 */
let scratch = null;

/** HTML 글자 → 일반 글자 (스크립트를 실행하지 않는다) */
export function htmlToText(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (!/[<&]/.test(s)) return s;
  const t = s.replace(/<br\s*\/?>/gi, " ");
  try {
    if (!scratch) scratch = document.implementation.createHTMLDocument("").createElement("div");
    scratch.innerHTML = t;
    const out = scratch.textContent || "";
    scratch.textContent = "";
    return out;
  } catch (e) {
    return t.replace(/<[^>]*>/g, "");
  }
}

/**
 * @param {any} html 화면 글자 (HTML일 수 있음)
 * @param {any} raw 원래 값
 * @param {{formatter?: any, align?: string}|null} col
 * @param {"header"|"body"|"sum"} kind
 * @returns {XCell|null}
 */
export function toXlsxCell(html, raw, col, kind) {
  const s = htmlToText(html)
    .replace(/\u00a0/g, " ")
    .trim();
  if (s === "") return null;
  if (kind !== "header") {
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      const dec = (s.split(".")[1] || "").length;
      return { t: "n", v: Number(s.replace(/,/g, "")), z: dec ? "#,##0." + "0".repeat(dec) : "#,##0" };
    }
    const hint = typeof raw === "number" || (col && (col.formatter === "money" || col.align === "right")) || kind === "sum";
    if (hint && /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s)) {
      const cell = { t: "n", v: Number(s) };
      if (col && col.formatter === "money") cell.z = "#,##0";
      return /** @type {XCell} */ (cell);
    }
  }
  return { t: "s", v: s };
}

/**
 * 그리드 → 내보낼 표 (SheetJS 없이 만들 수 있어 단위 테스트에 쓴다)
 * @param {import("../grid.js").PyoGrid} g
 * @returns {ExportData}
 */
export function buildExportData(g) {
  const n = g.leaves.length;
  /** @type {(XCell|null)[][]} */
  const rows = [];
  const merges = [];
  // 헤더
  for (let r = 0; r < g.headerDepth; r++) rows.push(new Array(n).fill(null));
  for (const cell of g.headerCells) {
    // 화면과 같게: html: true가 아닌 제목은 글자 그대로 (태그 모양 글자도 지우지 않는다)
    rows[cell.row][cell.colStart] = toXlsxCell(cell.def && cell.def.html ? cell.label : escapeHtml(cell.label), undefined, null, "header");
    if (cell.colSpan > 1 || cell.rowSpan > 1) {
      merges.push({ s: { r: cell.row, c: cell.colStart }, e: { r: cell.row + cell.rowSpan - 1, c: cell.colStart + cell.colSpan - 1 } });
    }
  }
  const headerRows = rows.length;
  /** @param {any[]} cells @param {any[]} list @param {any} [groupBy] */
  const sumLine = (cells, list, groupBy) => {
    const line = new Array(n).fill(null);
    const R = rows.length;
    let c = 0;
    for (const cell of cells || []) {
      if (c >= n) break;
      const span = Math.max(1, Math.min(cell.colspan || 1, n - c));
      line[c] = toXlsxCell(sumCellValue(cell, list, groupBy), undefined, cell, "sum");
      if (span > 1) merges.push({ s: { r: R, c }, e: { r: R, c: c + span - 1 } });
      c += span;
    }
    rows.push(line);
  };
  // 본문 (화면 순서, 그룹 합계 행 포함)
  for (let i = 0; i < g.rows.length; i++) {
    const row = g.rows[i];
    if (row.__isGrouping) {
      sumLine((g.options.grouping && g.options.grouping.columns) || [], row.__groupingList, row.__groupingBy);
      continue;
    }
    const line = new Array(n);
    for (let c = 0; c < n; c++) {
      const def = g.leaves[c].def;
      line[c] = toXlsxCell(g.cellText(i, c), getValue(row, def.key), def, "body");
    }
    rows.push(line);
  }
  // 합계 행
  if (Array.isArray(g.options.footSum)) for (const cells of g.options.footSum) sumLine(cells, g.dataRows);
  return { rows, merges, widths: g.widths.slice(), headerRows };
}

/**
 * @param {ExportData} data
 * @param {any} XLSX SheetJS
 */
export function toWorksheet(data, XLSX) {
  /** @type {any} */
  const ws = {};
  let maxC = 0;
  data.rows.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (!cell) return;
      ws[XLSX.utils.encode_cell({ r, c })] = cell;
      maxC = Math.max(maxC, c);
    });
  });
  const lastC = Math.max(maxC, data.widths.length - 1, 0);
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, data.rows.length - 1), c: lastC } });
  if (data.merges.length) ws["!merges"] = data.merges;
  ws["!cols"] = data.widths.map((w) => ({ wpx: Math.round(w || 100) }));
  return ws;
}

/**
 * @param {import("../grid.js").PyoGrid} g
 * @param {string} fileName
 * @param {{sheetName?: string, XLSX?: any}} [opts]
 * @returns {boolean} SheetJS가 없으면 false
 */
export function exportXlsx(g, fileName, opts = {}) {
  const XLSX = opts.XLSX || (typeof window !== "undefined" ? /** @type {any} */ (window).XLSX : null);
  if (!XLSX || !XLSX.utils || !isFn(XLSX.writeFile)) {
    console.warn("[pyogrid] Excel export needs SheetJS (window.XLSX). Load xlsx.full.min.js before calling exportExcel.");
    return false;
  }
  const ws = toWorksheet(buildExportData(g), XLSX);
  let name = String(fileName || "export").replace(/\.xls$/i, ".xlsx");
  if (!/\.xlsx$/i.test(name)) name += ".xlsx";
  const sheet =
    String(opts.sheetName || "Sheet1")
      .replace(/[[\]:*?/\\]/g, "")
      .substring(0, 31) || "Sheet1";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, name);
  return true;
}
