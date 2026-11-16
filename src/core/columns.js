// @ts-check
/**
 * 컬럼 정의(묶음 컬럼 포함)를 잎 컬럼 목록과 다단 헤더 칸 목록으로 바꾼다.
 *
 * @typedef {Object} ColumnDef
 * @property {string} [key]
 * @property {string} [label]
 * @property {number|string} [width]  숫자, "120", "50px", "*", "30%"
 * @property {"left"|"center"|"right"} [align]
 * @property {"left"|"center"|"right"} [headerAlign]
 * @property {boolean} [filter]  false면 헤더 값 필터 안 함, true면 그리드 filter 옵션과 관계없이 필터
 * @property {boolean} [treeControl]  트리 펼침 단추를 그릴 컬럼
 * @property {boolean} [numeric]  선택 합계에서 숫자 컬럼으로 볼지 (없으면 money formatter·number/money 편집기면 숫자)
 * @property {ColumnDef[]} [columns]  묶음 헤더의 하위 컬럼
 * @property {boolean} [hidden]
 * @property {boolean} [multiLine]
 * @property {boolean} [resizable]
 * @property {boolean} [sortable]  false면 정렬 안 함, true면 그리드 sortable과 관계없이 정렬
 * @property {{type: string, config?: any, disabled?: boolean|Function, attributes?: Record<string, any>}} [editor]
 *   type: text, number, money, date, select, checkbox
 * @property {string|Function} [formatter]
 * @property {boolean} [html]  true면 label과 formatter 결과를 HTML로 넣는다 (기본은 글자로 이스케이프)
 * @property {string|Function} [cellClass]
 * @property {string|Function} [headerClass]
 *
 * @typedef {Object} LeafColumn
 * @property {ColumnDef} def
 * @property {number} index     잎 컬럼 순번 (보조 컬럼 제외)
 * @property {number} level     헤더 깊이 (0부터)
 * @property {string} [key]
 * @property {string} [special] "lineNumber" | "rowSelector"
 *
 * @typedef {Object} HeaderCell
 * @property {string} label
 * @property {number} row
 * @property {number} rowSpan
 * @property {number} colStart  잎 컬럼 순번 (보조 컬럼 제외)
 * @property {number} colSpan
 * @property {ColumnDef} def
 * @property {number} [leafIndex] 잎 컬럼이면 그 순번
 */

/**
 * @param {ColumnDef[]} defs
 * @returns {{leaves: LeafColumn[], header: HeaderCell[], depth: number}}
 */
export function buildColumnModel(defs) {
  /** @type {LeafColumn[]} */
  const leaves = [];
  /** @type {HeaderCell[]} */
  const header = [];
  let depth = 1;

  const walk = (list, level) => {
    if (!Array.isArray(list)) return;
    for (const def of list) {
      if (!def || def.hidden) continue;
      if (Array.isArray(def.columns)) {
        const colStart = leaves.length;
        const cell = { label: labelOf(def), row: level, rowSpan: 1, colStart, colSpan: 0, def };
        header.push(cell);
        walk(def.columns, level + 1);
        cell.colSpan = leaves.length - colStart;
        if (cell.colSpan === 0) header.splice(header.indexOf(cell), 1);
      } else {
        const index = leaves.length;
        leaves.push({ def, index, level, key: def.key });
        header.push({ label: labelOf(def), row: level, rowSpan: 1, colStart: index, colSpan: 1, def, leafIndex: index });
        depth = Math.max(depth, level + 1);
      }
    }
  };
  walk(defs, 0);

  for (const cell of header) {
    if (cell.leafIndex !== undefined) cell.rowSpan = depth - cell.row;
  }
  return { leaves, header, depth };
}

function labelOf(def) {
  return def.label === undefined || def.label === null ? "" : String(def.label);
}

/**
 * 너비 지정값을 해석한다.
 * @param {number|string|undefined} spec
 * @returns {{type: "px"|"auto"|"pct", value: number} | null}
 */
export function parseWidth(spec) {
  if (typeof spec === "number" && isFinite(spec)) return { type: "px", value: spec };
  if (typeof spec === "string") {
    const s = spec.trim();
    if (s === "*") return { type: "auto", value: 0 };
    let m = s.match(/^(\d+(?:\.\d+)?)%$/);
    if (m) return { type: "pct", value: Number(m[1]) };
    m = s.match(/^(\d+(?:\.\d+)?)(px)?$/);
    if (m) return { type: "px", value: Number(m[1]) };
  }
  return null;
}

/**
 * 잎 컬럼 너비(px)를 계산한다.
 * - 숫자·"120"·"50px": 그대로
 * - "n%": 사용 가능 너비의 n%
 * - "*": 남은 너비를 나눠 가짐 (최소 minAuto)
 * - 그 밖(없음 포함): defaultWidth
 * - override[i]가 있으면 그 값 (사용자가 조절한 너비)
 *
 * @param {LeafColumn[]} leaves
 * @param {number} available
 * @param {{defaultWidth?: number, minAuto?: number, override?: Record<number, number>}} [opts]
 * @returns {number[]}
 */
export function computeWidths(leaves, available, opts = {}) {
  const defaultWidth = opts.defaultWidth ?? 100;
  const minAuto = opts.minAuto ?? 20;
  const override = opts.override || {};
  const widths = new Array(leaves.length);
  const autos = [];
  let used = 0;
  for (let i = 0; i < leaves.length; i++) {
    if (override[i] !== undefined) {
      widths[i] = override[i];
      used += widths[i];
      continue;
    }
    const w = parseWidth(leaves[i].def.width);
    if (!w) widths[i] = defaultWidth;
    else if (w.type === "px") widths[i] = w.value;
    else if (w.type === "pct") widths[i] = Math.floor((Math.max(0, available) * w.value) / 100);
    else {
      autos.push(i);
      continue;
    }
    used += widths[i];
  }
  if (autos.length) {
    const rest = Math.max(0, available - used);
    const each = Math.floor(rest / autos.length);
    autos.forEach((i, n) => {
      // 나머지 픽셀은 마지막 "*" 컬럼이 가져가서 정확히 채운다
      const w = n === autos.length - 1 ? rest - each * (autos.length - 1) : each;
      widths[i] = Math.max(minAuto, w);
    });
  }
  return widths;
}
