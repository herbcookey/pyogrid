// @ts-check
/**
 * 컬럼 정의(묶음 컬럼 포함)를 잎 컬럼 목록과 다단 헤더 칸 목록으로 바꾼다.
 *
 * 타입 메모: core는 grid.js를 가져오지 않는다 (strictNullChecks 단계 적용 범위를 core에 묶어 두려고).
 * 그래서 셀 정보의 grid는 여기서 any이고, grid.js의 cellContext()가 PyoGrid<Row>로 좁혀 돌려준다.
 */

/**
 * formatter·cellClass에 넘기는 셀 정보. 함수의 this도 같은 객체다.
 * @template [Row=any]
 * @typedef {Object} CellContext
 * @property {any} value  셀 값 (formatter를 거치기 전)
 * @property {Row} row
 * @property {Row} item   row와 같다
 * @property {string|undefined} key
 * @property {number} rowIndex  화면 순번
 * @property {number} dindex    rowIndex와 같다
 * @property {ColumnDef<Row>} column
 * @property {any} grid  그리드 (PyoGrid)
 */

/**
 * editor.disabled에 넘기는 셀 정보 (grid.cellContext()가 돌려주는 것). 함수의 this도 같은 객체다.
 * @template [Row=any]
 * @typedef {CellContext<Row> & {colIndex: number, list: any[]}} CellInfo
 */

/**
 * @template [Row=any]
 * @typedef {Object} ColumnEditor
 * @property {string} type  text, number, money, date, select, checkbox 또는 PyoGrid.editors에 넣은 이름
 * @property {any} [config]
 * @property {boolean|((this: CellInfo<Row>, c: CellInfo<Row>) => any)} [disabled]  true(또는 참인 값을 돌려주면) 편집 막기
 * @property {Record<string, any>} [attributes]  입력칸에 붙일 속성
 */

/**
 * @template [Row=any]
 * @typedef {Object} ColumnDef
 * @property {string} [key]  "a.b", "a['키']", "list[0].name" 같은 경로 키도 된다
 * @property {string} [label]
 * @property {number|string} [width]  숫자, "120", "50px", "*", "30%"
 * @property {"left"|"center"|"right"} [align]
 * @property {"left"|"center"|"right"} [headerAlign]
 * @property {boolean} [filter]  false면 헤더 값 필터 안 함, true면 그리드 filter 옵션과 관계없이 필터
 * @property {"text"|"number"|"date"} [filterType]  조건 필터의 종류. 없으면 date 편집기는 date, 숫자 컬럼은 number, 나머지는 text
 * @property {boolean} [filterConditions]  false면 이 컬럼의 필터 팝업에 조건 칸을 보이지 않는다 (그리드 filterConditions가 켜져 있어도)
 * @property {boolean} [treeControl]  트리 펼침 단추를 그릴 컬럼
 * @property {boolean} [numeric]  선택 합계에서 숫자 컬럼으로 볼지 (없으면 money formatter·number/money 편집기면 숫자)
 * @property {ColumnDef<Row>[]} [columns]  묶음 헤더의 하위 컬럼
 * @property {boolean} [hidden]
 * @property {boolean} [multiLine]
 * @property {boolean} [resizable]
 * @property {boolean} [reorderable]  false면 끌기·moveColumn으로 옮기지 않고 제자리에 둔다 (그룹이면 그룹 전체)
 * @property {boolean} [sortable]  false면 정렬 안 함, true면 그리드 sortable과 관계없이 정렬
 * @property {ColumnEditor<Row>} [editor]
 * @property {string|((this: CellContext<Row>, c: CellContext<Row>) => any)} [formatter]  이름(PyoGrid.formatters) 또는 함수
 * @property {boolean} [html]  true면 label과 formatter 결과를 HTML로 넣는다 (기본은 글자로 이스케이프)
 * @property {string|((this: CellContext<Row>, c: CellContext<Row>) => any)} [cellClass]
 * @property {string|((this: ColumnDef<Row>, column: ColumnDef<Row>) => any)} [headerClass]
 */

/**
 * @typedef {Object} LeafColumn
 * @property {ColumnDef} def
 * @property {number} index     잎 컬럼 순번 (보조 컬럼 제외, 화면 순서)
 * @property {number} level     헤더 깊이 (0부터)
 * @property {string} [key]
 * @property {string} [special] "lineNumber" | "rowSelector"
 * @property {number} [defIndex] 정의 순서의 순번 (보이는 잎만 센다). 합계 칸이 덮는 컬럼을 정할 때 쓴다
 */

/**
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
 * 잎 컬럼·헤더 칸을 만든다. order(잎 key 목록)가 있으면 같은 부모 안의 형제를 그 순서로 놓는다 (orderSiblings).
 * 정의(defs)는 바꾸지 않는다.
 * @param {ColumnDef[]} defs
 * @param {string[]|null} [order]
 * @returns {{leaves: LeafColumn[], header: HeaderCell[], depth: number}}
 */
export function buildColumnModel(defs, order) {
  /** @type {LeafColumn[]} */
  const leaves = [];
  /** @type {HeaderCell[]} */
  const header = [];
  let depth = 1;
  const rank = order ? rankOf(order) : null;
  /** @type {Map<ColumnDef, number>} 정의 순서의 보이는 잎 순번 */
  const defIndex = new Map();
  if (rank) {
    let n = 0;
    /** @param {any} list */
    const count = (list) => {
      if (!Array.isArray(list)) return;
      for (const def of list) {
        if (!def || def.hidden) continue;
        if (Array.isArray(def.columns)) count(def.columns);
        else if (!defIndex.has(def)) defIndex.set(def, n++);
      }
    };
    count(defs);
  }

  const walk = (list, level) => {
    if (!Array.isArray(list)) return;
    for (const def of rank ? orderSiblings(list, rank) : list) {
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
        const di = rank ? /** @type {number} */ (defIndex.get(def)) : index;
        leaves.push({ def, index, level, key: def.key, defIndex: di });
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

/**
 * 잎 key 목록 → key별 순위 (처음 나온 자리)
 * @param {string[]} order
 * @returns {Map<string, number>}
 */
export function rankOf(order) {
  const rank = new Map();
  order.forEach((k, i) => {
    if (typeof k === "string" && !rank.has(k)) rank.set(k, i);
  });
  return rank;
}

/**
 * 형제 하나의 순위. 잎은 key의 순위, 그룹은 안의 잎(숨긴 잎 포함) 중 가장 앞선 순위.
 * 옮길 수 없는 것(key가 없는 잎, reorderable: false, 순위가 없는 것)은 undefined
 * @param {ColumnDef} def
 * @param {Map<string, number>} rank
 * @returns {number|undefined}
 */
export function siblingRank(def, rank) {
  if (!def || def.reorderable === false) return undefined;
  if (Array.isArray(def.columns)) {
    let best;
    /** @param {any[]} list */
    const scan = (list) => {
      for (const d of list) {
        if (!d) continue;
        if (Array.isArray(d.columns)) scan(d.columns);
        else if (d.key !== undefined && d.key !== null) {
          const r = rank.get(String(d.key));
          if (r !== undefined && (best === undefined || r < best)) best = r;
        }
      }
    };
    scan(def.columns);
    return best;
  }
  return def.key === undefined || def.key === null ? undefined : rank.get(String(def.key));
}

/**
 * 형제 목록을 순서대로 놓는다 (숨긴 것 포함, 원래 배열은 그대로).
 * 순위가 없는 것은 정의 자리에 그대로 두고, 순위가 있는 것은 남은 자리를 순위 차례로 채운다.
 * @param {ColumnDef[]} list
 * @param {Map<string, number>} rank
 * @returns {ColumnDef[]}
 */
export function orderSiblings(list, rank) {
  const out = new Array(list.length);
  /** @type {{def: ColumnDef, r: number, i: number}[]} */
  const ranked = [];
  /** @type {number[]} */
  const free = [];
  list.forEach((def, i) => {
    const r = siblingRank(def, rank);
    if (r === undefined) out[i] = def;
    else {
      ranked.push({ def, r, i });
      free.push(i);
    }
  });
  ranked.sort((x, y) => x.r - y.r || x.i - y.i);
  ranked.forEach((x, k) => (out[free[k]] = x.def));
  return out;
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
