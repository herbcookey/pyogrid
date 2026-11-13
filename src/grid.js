// @ts-check
import { buildColumnModel, computeWidths, parseWidth } from "./core/columns.js";
import { formatters } from "./core/formatters.js";
import { sortRows, nextSortDir } from "./core/sort.js";
import { CellRange } from "./core/range.js";
import { navigationHtml, targetPage, statusData, defaultStatusHtml, summaryText } from "./features/pagebar.js";
import { Editing } from "./features/editing.js";
import { buildView, filterKey, computeMerge, filterRows } from "./features/view.js";
import { sumRowHtml } from "./features/summary.js";
import { FilterPopup } from "./features/filter.js";
import { exportXlsx, buildExportData } from "./features/excel.js";
import { storageKey, loadState, saveState, removeState } from "./features/state.js";
import { History, RECORDED_SOURCES } from "./features/history.js";
import { resolveMessages } from "./core/locales.js";
import { parseTSV, buildTSV, pastePlan, convertPasteValue } from "./features/clipboard.js";
import { formatNumber } from "./features/pagebar.js";
import { editorTypes, selectOptions, isChecked, sameValue } from "./editors/types.js";
import { escapeHtml, getValue, setValue as setPathValue, h, isFn, clamp, deepMerge, toNumber } from "./util.js";

/**
 * @typedef {import("./core/columns.js").ColumnDef} ColumnDef
 * @typedef {import("./core/columns.js").LeafColumn} LeafColumn
 * @typedef {import("./core/columns.js").HeaderCell} HeaderCell
 * @typedef {import("./core/sort.js").SortItem} SortItem
 * @typedef {import("./core/sort.js").SortCompare} SortCompare
 * @typedef {import("./features/pagebar.js").PageInfo} PageInfo
 *
 * @typedef {Object} GridOptions
 * @property {ColumnDef[]} [columns]
 * @property {number} [frozenColumns=0]      왼쪽에 고정할 잎 컬럼 수
 * @property {number} [rowHeight=26]
 * @property {number} [headerRowHeight=26]
 * @property {boolean} [lineNumber=false]
 * @property {number} [lineNumberWidth=30]
 * @property {boolean} [rowSelector=false]
 * @property {number} [rowSelectorWidth=26]
 * @property {boolean} [headerSelector=true]  행 선택 칸 헤더의 전체 선택 체크박스
 * @property {boolean} [multipleSelect=true]  false면 행을 하나만 선택
 * @property {string} [selectedKey="__selected__"]  행 선택 상태를 담는 행 속성
 * @property {string} [disableSelectionKey="__disable_selection__"]  true인 행은 선택할 수 없다
 * @property {boolean} [sortable=false]       헤더 클릭 정렬 (컬럼 sortable이 우선)
 * @property {boolean} [multiSort=false]
 * @property {SortCompare} [sortCompare="smart"]  smart: 숫자 문자열·한글 자연 정렬·빈 값 마지막, plain: 값을 그대로 비교
 * @property {boolean} [remoteSort=false]     true면 정렬 상태만 바꾸고 sortchange만 알린다 (서버 정렬)
 * @property {boolean} [cellSelect=true]      셀 클릭·끌기로 범위 선택
 * @property {boolean} [editable=true]        false면 모든 편집기를 끈다
 * @property {string} [modifiedKey="__modified__"]  값이 바뀐 행에 true를 기록하는 속성
 * @property {boolean} [undo=true]            Ctrl+Z 실행 취소 (셀 편집·붙여넣기·지우기·잘라내기)
 * @property {number} [undoLimit=50]
 * @property {boolean} [clipboard=true]       Ctrl+C 복사, Ctrl+V 붙여넣기, Ctrl+X 잘라내기
 * @property {boolean} [filter=false]         헤더 값 필터 (컬럼 filter:false로 끄고, filter:true로 하나만 켤 수 있다)
 * @property {import("./features/summary.js").SumCell[][]|null} [footSum]  아래 합계 행
 * @property {{by: string[], columns: import("./features/summary.js").SumCell[]}|null} [grouping]  그룹 합계 행
 * @property {{parentKey?: string, selfKey?: string, collapseKey?: string, indentWidth?: number, arrowWidth?: number, iconWidth?: number,
 *   icons?: {openedArrow?: string, collapsedArrow?: string, groupIcon?: string, collapsedGroupIcon?: string, itemIcon?: string}}|null} [tree]
 *   트리 (부모 키로 이어진 평평한 목록). 컬럼 treeControl:true에 펼침 단추가 그려진다.
 * @property {boolean|string[]} [mergeCells=false]  위아래 같은 값 합치기
 * @property {string} [deletedKey="__deleted__"]  deleteRows로 지운 행에 true를 기록하는 속성
 * @property {boolean} [markAddedModified=true]  addRow로 넣은 행에 modifiedKey를 붙인다
 * @property {string|null} [stateKey]  지정하면 컬럼 너비·정렬을 브라우저에 기억한다 (화면 경로 + stateKey)
 * @property {string|null} [sheetName]  엑셀 시트 이름
 * @property {boolean} [pageBar=true]         아래쪽 페이지 바
 * @property {number} [pageHeight=25]
 * @property {boolean} [statusDisplay=true]
 * @property {number} [pageNavigationCount=5]
 * @property {{first?: string|null, prev?: string|null, next?: string|null, last?: string|null}} [pageIcons]
 * @property {((data: any) => string)|null} [statusFormat]  상태 문구 HTML
 * @property {boolean} [selectionSummary=true] 셀을 둘 이상 선택하면 개수·합계·평균 표시
 * @property {number} [defaultColumnWidth=100]
 * @property {number} [minColumnWidth=10]   너비 조절 최소값
 * @property {boolean} [resizable=true]
 * @property {string|null} [emptyText]  데이터가 없을 때 문구. 주지 않으면 locale 문구, null이면 표시 안 함
 * @property {string} [locale="en"]  화면 문구 언어 ("en", "ko", 또는 PyoGrid.locales에 넣은 이름)
 * @property {Partial<import("./core/locales.js").Messages>|null} [messages]  화면 문구 일부를 바꾼다
 * @property {number} [overscanRows=6]
 * @property {number} [overscanColumns=2]
 * @property {"left"|"center"|"right"|null} [headerAlign]
 * @property {"left"|"center"|"right"|null} [align]  본문 기본 정렬
 * @property {((row: any, index: number) => string)|string|null} [rowClass]
 * @property {number|null} [height]  null이면 대상 요소 높이를 채운다
 */

/** @type {Required<GridOptions>} */
const DEFAULTS = {
  columns: [],
  frozenColumns: 0,
  rowHeight: 26,
  headerRowHeight: 26,
  lineNumber: false,
  lineNumberWidth: 30,
  rowSelector: false,
  rowSelectorWidth: 26,
  headerSelector: true,
  multipleSelect: true,
  selectedKey: "__selected__",
  disableSelectionKey: "__disable_selection__",
  sortable: false,
  multiSort: false,
  sortCompare: "smart",
  remoteSort: false,
  cellSelect: true,
  editable: true,
  modifiedKey: "__modified__",
  undo: true,
  undoLimit: 50,
  clipboard: true,
  filter: false,
  footSum: null,
  grouping: null,
  tree: null,
  mergeCells: false,
  deletedKey: "__deleted__",
  markAddedModified: true,
  stateKey: null,
  sheetName: null,
  pageBar: true,
  pageHeight: 25,
  statusDisplay: true,
  pageNavigationCount: 5,
  pageIcons: { first: null, prev: "«", next: "»", last: null },
  statusFormat: null,
  selectionSummary: true,
  defaultColumnWidth: 100,
  minColumnWidth: 10,
  resizable: true,
  emptyText: undefined,
  locale: "en",
  messages: null,
  overscanRows: 6,
  overscanColumns: 2,
  headerAlign: null,
  align: null,
  rowClass: null,
  height: null,
};

/** 스크롤바 너비 (CSS ::-webkit-scrollbar와 맞춘다) */
const SCROLLBAR = 15;

let uid = 0;

export class PyoGrid {
  /**
   * @param {HTMLElement|string} target 요소 또는 CSS 선택자
   * @param {GridOptions} [options]
   */
  constructor(target, options = {}) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el || !(el instanceof HTMLElement)) throw new Error("PyoGrid: target element not found.");
    this.id = "pyo" + ++uid;
    /** @type {HTMLElement} */
    this.target = el;
    /** @type {Required<GridOptions>} */
    this.options = deepMerge({}, DEFAULTS, options);
    /** 화면 문구 (locale + messages) */
    this.messages = resolveMessages(this.options.locale, this.options.messages);
    /** @type {any[]} setData로 받은 순서의 행 */
    this.source = [];
    /** @type {any[]} 화면에 보이는 순서의 행 (정렬 적용) */
    this.rows = [];
    /** @type {any[]} 필터·정렬을 거친 데이터 행 (그룹 합계 행 없음, 트리는 접힌 행 포함) */
    this.dataRows = [];
    /** @type {Map<string, Set<string>>} 헤더 값 필터 조건 */
    this.filters = new Map();
    /** @type {any[]} deleteRows로 지운 행 */
    this.deleted = [];
    /** @type {Map<any, {depth:number, children:any[], parent:any}>|null} */
    this._treeMeta = null;
    /** @type {Map<number, {start: Int32Array, end: Int32Array}>} */
    this._merge = new Map();
    /** @type {Int32Array|null} 화면 행 → 줄 번호(데이터 행 순번), 그룹 행은 -1 */
    this._lineNo = null;
    this._footHeight = 0;
    /** @type {FilterPopup|null} */
    this._filterPopup = null;
    /** @type {SortItem[]} */
    this.sort = [];
    /** @type {PageInfo|null} */
    this.page = null;
    /** @type {CellRange|null} */
    this.range = null;
    /** @type {Record<string, Function[]>} */
    this._handlers = {};
    /** @type {Record<number, number>} 사용자가 조절한 너비 (잎 순번 → px) */
    this._userWidths = {};
    /** @type {Map<number, HTMLElement>} */
    this._rowEls = new Map();
    this._range = { r0: 0, r1: -1, c0: -1, c1: -1 };
    this._raf = 0;
    this._destroyed = false;
    /** @type {LeafColumn[]} */
    this.leaves = [];
    /** @type {HeaderCell[]} */
    this.headerCells = [];
    this.headerDepth = 1;
    /** @type {number[]} 잎 컬럼 너비 */
    this.widths = [];
    /** @type {number[]} 잎 컬럼 x (고정 컬럼은 행 기준, 스크롤 컬럼은 스크롤 영역 기준) */
    this.leafX = [];
    /** @type {{special: string, width: number}[]} 줄 번호·행 선택 보조 컬럼 */
    this.aside = [];
    this.frozenCount = 0;
    this.fzWidth = 0;
    this.scWidth = 0;
    this.asideWidth = 0;
    this.totalWidth = 0;
    this._headerHeight = 0;
    /** 스크롤 영역의 보이는 너비·높이 (_measure에서 읽어 둔 값) */
    this._vw = 0;
    this._vh = 0;
    /** @type {null | (() => void)} */
    this._resizeCleanup = null;
    /** @type {null | (() => void)} */
    this._dragCleanup = null;
    /** @type {any} Shift+클릭 기준이 되는 마지막으로 누른 행 (행 객체) */
    this._lastRowClick = null;
    this._summaryTimer = 0;
    this._justResized = 0;

    this._buildDom();
    /** 실행 취소 기록 */
    this.history = new History(this.options.undoLimit);
    /** @type {WeakMap<any, {was: boolean, keys: Map<string, any>}>} 수정된 셀의 처음 값 */
    this._orig = new WeakMap();
    this._flashing = false;
    this._flashTimer = 0;
    /** 셀 편집·키보드 */
    this.editing = new Editing(this);
    this._bind();
    this._setColumnsInternal(this.options.columns);
    this._restoreState();
    this.layout();
  }

  /* ==================================================================
   * 공개 API: 엑셀·상태 기억
   * ================================================================ */

  /**
   * 화면 그대로 .xlsx로 저장한다 (SheetJS 필요). 숫자는 숫자 셀, 다단 헤더·합계 칸은 병합 셀.
   * @param {string} fileName ".xls"로 주어도 ".xlsx"로 저장
   * @param {{sheetName?: string, XLSX?: any}} [opts]
   * @returns {boolean}
   */
  exportExcel(fileName, opts = {}) {
    if (this.editing.active && !this.editing.commit()) this.editing.cancel();
    return exportXlsx(this, fileName, { sheetName: opts.sheetName || this.options.sheetName || undefined, XLSX: opts.XLSX });
  }

  /** 내보낼 표 (헤더 줄 수, 셀, 병합, 너비) */
  getExportData() {
    return buildExportData(this);
  }

  /** 저장해 둔 컬럼 너비·정렬을 지운다 (화면은 그대로) */
  resetState() {
    removeState(storageKey(this.options.stateKey));
    return this;
  }

  _saveState() {
    const key = storageKey(this.options.stateKey);
    if (!key) return;
    /** @type {Record<string, number>} */
    const widths = {};
    this.leaves.forEach((leaf, i) => {
      if (leaf.def.key !== undefined && this._userWidths[i] !== undefined) widths[leaf.def.key] = Math.round(this._userWidths[i]);
    });
    const prev = loadState(key);
    // 지금 컬럼에 없는 키의 너비는 남겨 둔다 (주차별로 컬럼이 바뀌는 화면)
    saveState(key, { widths: { ...(prev ? prev.widths : {}), ...widths }, sort: this.options.tree ? [] : this.getSort() });
  }

  /** 컬럼을 정한 직후: 저장된 너비·정렬을 지금 컬럼에 맞춰 되살린다 */
  _restoreState() {
    const st = loadState(storageKey(this.options.stateKey));
    if (!st) return;
    this.leaves.forEach((leaf, i) => {
      const w = st.widths[leaf.def.key];
      if (typeof w === "number" && w > 10) this._userWidths[i] = w;
    });
    if (!this.options.tree && st.sort.length) {
      const ok = st.sort.filter((s) => {
        const leaf = this.leaves.find((l) => l.def.key === s.key);
        return leaf && this.isSortable(leaf) && (s.dir === "asc" || s.dir === "desc");
      });
      if (ok.length) this.sort = ok.map((s) => ({ key: s.key, dir: s.dir }));
    }
  }

  /* ==================================================================
   * 공개 API: 데이터
   * ================================================================ */

  /**
   * 데이터를 바꾼다. 행 객체는 복사하지 않는다.
   * @param {any[]} rows
   * @param {PageInfo|null} [page] 서버 페이징 정보 (currentPage는 0부터)
   */
  setData(rows, page) {
    this.editing.cancel();
    this.history.clear();
    this._orig = new WeakMap();
    this.source = Array.isArray(rows) ? rows.slice() : [];
    this.deleted = [];
    if (page !== undefined) this.page = page ? { ...page } : null;
    this._applyView();
    this.range = null;
    this._lastRowClick = null;
    this._updateBodySize();
    this.el.scroll.scrollTop = 0;
    this.refresh();
    this._renderPageNav();
    this._updateHeaderSelector();
    this._scheduleSummary();
    this.emit("datachange", { rows: this.rows });
    return this;
  }

  /**
   * @returns {any[]} 필터·정렬을 거친 데이터 행 (배열은 복사본, 행 객체는 원본).
   * 그룹 합계 행은 빠지고, 트리는 접힌 자식도 들어간다.
   */
  getRows() {
    return this.dataRows.slice();
  }

  /** @returns {any[]} 화면에 그리는 순서의 행 (그룹 합계 행 포함, 트리는 펼친 행만) */
  getViewRows() {
    return this.rows.slice();
  }

  /** @returns {any[]} setData로 받은 행 전체 (필터로 숨은 행 포함, 지운 행 제외) */
  getAllRows() {
    return this.source.slice();
  }

  /** @param {number} index 화면 순번 */
  getRow(index) {
    return this.rows[index];
  }

  /** 화면 행 수 (그룹 합계 행 포함) */
  get rowCount() {
    return this.rows.length;
  }

  /* ==================================================================
   * 공개 API: 행 넣기·빼기
   * ================================================================ */

  /**
   * 행을 넣는다.
   * @param {any|any[]} rows
   * @param {"first"|"last"|number} [at="last"]  숫자면 그 화면 순번의 행 앞
   * @param {{focus?: boolean}} [opts] focus: 넣은 첫 행의 첫 셀로 이동
   */
  addRow(rows, at = "last", opts = {}) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (!list.length) return this;
    this.editing.cancel();
    if (this.options.markAddedModified) for (const r of list) r[this.options.modifiedKey] = true;
    let pos = this.source.length;
    if (at === "first") pos = 0;
    else if (typeof at === "number") {
      let ref = this.rows[at];
      for (let i = at; ref && ref.__isGrouping && i < this.rows.length; i++) ref = this.rows[i];
      const si = ref ? this.source.indexOf(ref) : -1;
      if (si >= 0) pos = si;
    }
    // splice(pos, 0, ...list)는 수십만 행이면 인자 수 한도를 넘으므로 배열을 이어 붙인다
    this.source = this.source.slice(0, pos).concat(list, this.source.slice(pos));
    this._afterRowsChanged();
    if (opts.focus) {
      const i = this.rows.indexOf(list[0]);
      if (i >= 0) {
        this.setRange(i, 0);
        this.scrollToCell(i, 0);
        this.focus();
      }
    }
    this.emit("rowsadd", { rows: list });
    return this;
  }

  /**
   * 행을 목록에서 뺀다 (지운 행 기록에 남기지 않음).
   * @param {any|any[]|number|number[]} targets 행 객체 또는 화면 순번
   */
  removeRows(targets) {
    const set = this._targetRows(targets);
    if (!set.size) return this;
    this.editing.cancel();
    this.source = this.source.filter((r) => !set.has(r));
    this._afterRowsChanged();
    this.emit("rowsremove", { rows: [...set] });
    return this;
  }

  /**
   * 행을 지운다. 목록에서 빠지고 getDeletedRows()에 남는다 (서버에 삭제를 보낼 때).
   * 트리면 자손도 같이 지운다.
   * @param {any|any[]|number|number[]} targets 행 객체 또는 화면 순번
   */
  deleteRows(targets) {
    const set = this._targetRows(targets);
    if (this._treeMeta) {
      const add = (r) => {
        const m = this._treeMeta.get(r);
        if (m) for (const ch of m.children) if (!set.has(ch)) (set.add(ch), add(ch));
      };
      for (const r of [...set]) add(r);
    }
    if (!set.size) return this;
    this.editing.cancel();
    const k = this.options.deletedKey;
    const removed = this.source.filter((r) => set.has(r));
    for (const r of removed) r[k] = true;
    for (const r of removed) this.deleted.push(r);
    this.source = this.source.filter((r) => !set.has(r));
    this._afterRowsChanged();
    this.emit("rowsdelete", { rows: removed });
    return this;
  }

  /** @returns {any[]} deleteRows로 지운 행 */
  getDeletedRows() {
    return this.deleted.slice();
  }

  /**
   * 화면 순번의 행을 다른 행 객체로 바꾼다.
   * @param {number} index
   * @param {any} row
   */
  replaceRow(index, row) {
    const old = this.rows[index];
    if (!old || old.__isGrouping) return this;
    const si = this.source.indexOf(old);
    if (si < 0) return this;
    this.source[si] = row;
    this._afterRowsChanged();
    return this;
  }

  /** @param {any} targets */
  _targetRows(targets) {
    const arr = Array.isArray(targets) ? targets : [targets];
    const set = new Set();
    for (const t of arr) {
      const r = typeof t === "number" ? this.rows[t] : t;
      if (r && !r.__isGrouping) set.add(r);
    }
    return set;
  }

  /** 행이 늘거나 줄었을 때: 보이는 위치는 그대로 두고 다시 그린다 */
  _afterRowsChanged() {
    this._applyView();
    if (this.range) this.range = this.range.clamp(this.rows.length, this.leaves.length);
    this._updateBodySize();
    this.refresh();
    this._updateHeaderSelector();
    this._scheduleSummary();
  }

  /* ==================================================================
   * 공개 API: 헤더 값 필터
   * ================================================================ */

  /**
   * @param {string} key
   * @param {any[]|null} values 보여 줄 값 목록. null이면 이 컬럼 조건을 지운다.
   */
  setFilter(key, values) {
    if (values === null || values === undefined) this.filters.delete(key);
    else this.filters.set(key, new Set(values.map(filterKey)));
    this._afterFilter();
    return this;
  }

  clearFilters() {
    this.filters.clear();
    this._afterFilter();
    return this;
  }

  /** @returns {Record<string, string[]>} */
  getFilters() {
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const [k, v] of this.filters) out[k] = [...v];
    return out;
  }

  _afterFilter() {
    this.editing.cancel();
    this._applyView();
    this.range = null;
    this._updateBodySize();
    this.el.scroll.scrollTop = 0;
    this.refresh();
    this._renderHeader();
    this._scheduleSummary();
    this.emit("filterchange", { filters: this.getFilters(), count: this.dataRows.length });
  }

  /** @param {LeafColumn} leaf */
  isFilterable(leaf) {
    const def = leaf.def;
    if (def.key === undefined || def.key === null || this.options.tree || this.page) return false;
    if (def.filter === false) return false;
    return def.filter === true || !!this.options.filter;
  }

  /**
   * @param {number} leafIndex
   * @param {HTMLElement} [anchor]
   */
  openFilter(leafIndex, anchor) {
    const leaf = this.leaves[leafIndex];
    if (!leaf || !this.isFilterable(leaf)) return;
    if (this._filterPopup) this._filterPopup.close();
    const def = leaf.def;
    const key = def.key;
    const seen = new Set();
    for (const r of filterRows(this.source, this.filters, key)) seen.add(filterKey(getValue(r, key)));
    const cur = this.filters.get(key) || null;
    if (cur) for (const v of cur) seen.add(v);
    const opts = def.editor && def.editor.type === "select" ? selectOptions(def.editor.config) : null;
    const label = (v) => {
      if (opts) {
        const o = opts.find((x) => String(x.value) === v);
        if (o) return o.text;
      }
      if (def.formatter === "money" && toNumber(v) !== null) return formatNumber(toNumber(v));
      return v;
    };
    const title = String(def.label || key).replace(/<[^>]*>/g, "");
    this._filterPopup = new FilterPopup({
      title,
      values: [...seen],
      label,
      current: cur,
      messages: this.messages,
      onApply: (allowed) => this.setFilter(key, allowed ? [...allowed] : null),
      onClose: () => {
        this._filterPopup = null;
        this.focus();
      },
    });
    const a = anchor || this.el.head.querySelector(`[data-leaf="${leafIndex}"]`);
    this._filterPopup.place(a ? a.getBoundingClientRect() : this.el.root.getBoundingClientRect());
  }

  /* ==================================================================
   * 공개 API: 트리
   * ================================================================ */

  /** @param {any} row */
  getTreeInfo(row) {
    const m = this._treeMeta && this._treeMeta.get(row);
    return m ? { depth: m.depth, children: m.children.slice(), parent: m.parent } : null;
  }

  /**
   * @param {any|number} target 행 또는 화면 순번
   * @param {boolean} [collapsed] 없으면 반전
   */
  toggleNode(target, collapsed) {
    const row = typeof target === "number" ? this.rows[target] : target;
    const t = this._treeCfg();
    if (!row || !t) return this;
    const m = this._treeMeta.get(row);
    if (!m || !m.children.length) return this;
    row[t.collapseKey] = collapsed === undefined ? !row[t.collapseKey] : !!collapsed;
    this._afterRowsChanged();
    this.emit("treetoggle", { row, collapsed: !!row[t.collapseKey] });
    return this;
  }

  expandAll() {
    return this._setAllCollapsed(false);
  }

  collapseAll() {
    return this._setAllCollapsed(true);
  }

  /** @param {boolean} v */
  _setAllCollapsed(v) {
    const t = this._treeCfg();
    if (!t) return this;
    for (const r of this.source) if (this._treeMeta.get(r) && this._treeMeta.get(r).children.length) r[t.collapseKey] = v;
    this._afterRowsChanged();
    return this;
  }

  _treeCfg() {
    const t = this.options.tree;
    if (!t) return null;
    return { parentKey: t.parentKey || "pid", selfKey: t.selfKey || "id", collapseKey: t.collapseKey || "collapse" };
  }

  /* ==================================================================
   * 공개 API: 행 선택
   * ================================================================ */

  /** @param {any} row */
  isRowSelected(row) {
    return !!(row && row[this.options.selectedKey]);
  }

  /** @param {any} row */
  isRowSelectable(row) {
    return !!row && !row.__isGrouping && !row[this.options.disableSelectionKey];
  }

  /**
   * 행을 선택하거나 해제한다.
   * @param {number} index 화면 순번
   * @param {boolean} [selected] 없으면 반전
   * @param {{source?: string}} [opts]
   * @returns {boolean} 바뀐 뒤 선택 상태 (선택할 수 없는 행이면 false)
   */
  selectRow(index, selected, opts = {}) {
    const row = this.rows[index];
    if (!this.isRowSelectable(row)) return false;
    const key = this.options.selectedKey;
    const next = selected === undefined ? !row[key] : !!selected;
    const changed = [];
    const changedRows = [];
    if (next && !this.options.multipleSelect) {
      // 화면 행이 아니라 전체 행에서 푼다: 접힌 트리 자식·필터로 숨은 행도 선택된 채 남지 않게
      for (const r of this.source) {
        if (r !== row && r[key]) {
          r[key] = false;
          changedRows.push(r);
        }
      }
      if (changedRows.length) {
        const set = new Set(changedRows);
        this.rows.forEach((r, i) => set.has(r) && changed.push(i));
      }
    }
    if (!!row[key] !== next) {
      changed.push(index);
      changedRows.push(row);
    }
    row[key] = next;
    this._afterSelection(changed, { index, row, selected: next, source: opts.source || "api" }, changedRows);
    return next;
  }

  /**
   * 화면 순번 from~to의 행을 같은 상태로 바꾼다 (Shift+클릭).
   * @param {number} from
   * @param {number} to
   * @param {boolean} selected
   */
  selectRowRange(from, to, selected) {
    if (!this.options.multipleSelect) return this.selectRow(to, selected);
    const key = this.options.selectedKey;
    const changed = [];
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
      const r = this.rows[i];
      if (!this.isRowSelectable(r) || !!r[key] === selected) continue;
      r[key] = selected;
      changed.push(i);
    }
    this._afterSelection(changed, { index: to, row: this.rows[to], selected, source: "range" });
    return selected;
  }

  /**
   * @param {boolean} [selected=true]
   * @param {(row: any, index: number) => boolean} [filter]
   */
  selectAll(selected = true, filter) {
    const key = this.options.selectedKey;
    const changedRows = [];
    // 데이터 행 전체 (트리의 접힌 자식 포함, 필터로 숨은 행 제외)
    this.dataRows.forEach((r, i) => {
      if (!this.isRowSelectable(r)) return;
      if (filter && filter.call(r, r, i) !== true) return;
      if (!!r[key] === selected) return;
      r[key] = selected;
      changedRows.push(r);
    });
    const set = new Set(changedRows);
    const changed = [];
    this.rows.forEach((r, i) => set.has(r) && changed.push(i));
    this._afterSelection(changed, { index: -1, row: null, selected, source: "all" }, changedRows);
    return this;
  }

  clearSelection() {
    return this.selectAll(false);
  }

  /** @returns {any[]} 선택된 행 (getRows 순서, 행 객체 원본) */
  getSelectedRows() {
    return this.dataRows.filter((r) => this.isRowSelected(r));
  }

  /** @returns {number[]} 선택된 행의 화면 순번 */
  getSelectedIndexes() {
    const out = [];
    this.rows.forEach((r, i) => {
      if (this.isRowSelected(r)) out.push(i);
    });
    return out;
  }

  /* ==================================================================
   * 공개 API: 셀 범위 선택
   * ================================================================ */

  /**
   * @param {number} r0
   * @param {number} c0
   * @param {number} [r1]
   * @param {number} [c1]
   */
  setRange(r0, c0, r1 = r0, c1 = c0) {
    if (!this.rows.length || !this.leaves.length) return this.clearRange();
    const rng = new CellRange({ r: r0, c: c0 }, { r: r1, c: c1 }).clamp(this.rows.length, this.leaves.length);
    this._setRangeInternal(rng);
    return this;
  }

  clearRange() {
    this._setRangeInternal(null);
    return this;
  }

  /** @returns {{r0:number,c0:number,r1:number,c1:number,active:{r:number,c:number}}|null} */
  getRange() {
    const g = this.range;
    return g ? { r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1, active: { ...g.active } } : null;
  }

  /** 포커스된 셀 (범위의 active) */
  getActiveCell() {
    const g = this.range;
    if (!g) return null;
    const leaf = this.leaves[g.active.c];
    const row = this.rows[g.active.r];
    return { rowIndex: g.active.r, colIndex: g.active.c, row, column: leaf.def, key: leaf.def.key, value: getValue(row, leaf.def.key) };
  }

  /**
   * 선택 범위 안의 셀을 왼쪽 위부터 차례로 돌려준다.
   * @returns {{rowIndex:number, colIndex:number, row:any, key:any, value:any}[]}
   */
  getRangeCells() {
    const g = this.range;
    if (!g) return [];
    const out = [];
    for (let r = g.r0; r <= g.r1; r++) {
      const row = this.rows[r];
      for (let c = g.c0; c <= g.c1; c++) {
        const key = this.leaves[c].def.key;
        out.push({ rowIndex: r, colIndex: c, row, key, value: getValue(row, key) });
      }
    }
    return out;
  }

  /**
   * 숫자로 다루는 컬럼인가: money formatter, number·money 편집기, 또는 numeric:true.
   * 이런 컬럼은 "1,200" 같은 숫자 글자도 숫자로 센다.
   * @param {ColumnDef} def
   */
  isNumericColumn(def) {
    if (def.numeric !== undefined) return !!def.numeric;
    const ed = def.editor && def.editor.type;
    return def.formatter === "money" || ed === "number" || ed === "money";
  }

  /**
   * 선택 범위의 개수·숫자 개수·합계·평균.
   * 값이 number이거나 숫자 컬럼의 숫자 글자일 때만 센다 (바코드·품번·"20261113" 같은 코드 글자는 세지 않음).
   */
  getSelectionSummary() {
    const g = this.range;
    let count = 0;
    let numCount = 0;
    let sum = 0;
    if (g) {
      count = g.size;
      for (let c = g.c0; c <= g.c1; c++) {
        const def = this.leaves[c].def;
        const key = def.key;
        if (key === undefined || key === null) continue;
        const numericCol = this.isNumericColumn(def);
        for (let r = g.r0; r <= g.r1; r++) {
          const row = this.rows[r];
          if (!row || row.__isGrouping) continue;
          const v = getValue(row, key);
          const n = typeof v === "number" ? (isFinite(v) ? v : null) : numericCol ? toNumber(v) : null;
          if (n !== null) {
            sum += n;
            numCount++;
          }
        }
      }
    }
    return { count, numCount, sum, avg: numCount ? sum / numCount : 0 };
  }

  /* ==================================================================
   * 공개 API: 값 바꾸기·편집
   * ================================================================ */

  /**
   * 셀 값을 바꾼다. 값이 바뀌면 행에 modifiedKey(__modified__)를 true로 기록하고 change를 알린다.
   * null·undefined·""는 서로 같은 값으로 본다.
   * @param {number} rowIndex 화면 순번
   * @param {string} key
   * @param {any} value
   * @param {{source?: string, refresh?: boolean, batch?: boolean}} [opts]
   * @returns {boolean} 바뀌었으면 true
   */
  setValue(rowIndex, key, value, opts = {}) {
    const row = this.rows[rowIndex];
    if (!row) return false;
    const old = getValue(row, key);
    const empty = (v) => v === null || v === undefined || v === "";
    if (old === value || (empty(old) && empty(value))) return false;
    if (!setPathValue(row, key, value)) return false;
    this._trackModified(row, key, old, value);
    const source = opts.source || "api";
    if (!opts.batch && this.options.undo && RECORDED_SOURCES[source]) {
      this.history.push({ source, changes: [{ row, key, oldValue: old, value }] });
    }
    if (opts.refresh !== false) {
      // 그룹 합계·셀 병합은 다른 행에도 걸리므로 전체를, 아니면 그 행과 합계 행만 다시 그린다
      if (this.options.grouping || this.options.mergeCells) this.refresh();
      else {
        this.refreshRow(rowIndex);
        this._renderFoot();
      }
      this._scheduleSummary();
    }
    this.emit("change", {
      row, item: row, rowIndex, dindex: rowIndex, key, value, oldValue: old, source, batch: !!opts.batch,
    });
    return true;
  }

  /**
   * 여러 셀을 한 번에 바꾼다. 다 바꾼 뒤 한 번만 다시 그리고 batchchange를 알린다.
   * 셀마다 change도 알리며, 이때 batch:true가 붙는다.
   * @param {{rowIndex:number, key:string, value:any}[]} changes
   * @param {{source?: string}} [opts]
   * @returns {{rowIndex:number, row:any, key:string, value:any, oldValue:any}[]} 실제로 바뀐 것
   */
  setValues(changes, opts = {}) {
    const source = opts.source || "api";
    const applied = [];
    for (const ch of changes) {
      const row = this.rows[ch.rowIndex];
      const old = row ? getValue(row, ch.key) : undefined;
      if (this.setValue(ch.rowIndex, ch.key, ch.value, { source, refresh: false, batch: true })) {
        applied.push({ rowIndex: ch.rowIndex, row, key: ch.key, value: ch.value, oldValue: old });
      }
    }
    if (applied.length) {
      if (this.options.undo && RECORDED_SOURCES[source]) {
        this.history.push({ source, changes: applied.map((a) => ({ row: a.row, key: a.key, oldValue: a.oldValue, value: a.value })) });
      }
      this.refresh();
      this._scheduleSummary();
      this.emit("batchchange", { source, changes: applied });
    }
    return applied;
  }

  /* ==================================================================
   * 공개 API: 실행 취소·복사·붙여넣기
   * ================================================================ */

  /** 마지막 사용자 변경(셀 편집·붙여넣기·지우기·잘라내기)을 되돌린다. Ctrl+Z */
  undo() {
    if (this.editing.active) this.editing.cancel();
    const entry = this.history.popUndo();
    if (!entry) {
      this._flash(this.messages.nothingToUndo);
      return false;
    }
    const n = this._applyHistory(entry, "undo");
    this._flash(this.messages.undone(this.messages.actions[entry.source] || entry.source, formatNumber(n)));
    this.emit("undo", { source: entry.source, count: n });
    return true;
  }

  /** 되돌린 것을 다시 적용한다. Ctrl+Y, Ctrl+Shift+Z */
  redo() {
    if (this.editing.active) this.editing.cancel();
    const entry = this.history.popRedo();
    if (!entry) {
      this._flash(this.messages.nothingToRedo);
      return false;
    }
    const n = this._applyHistory(entry, "redo");
    this._flash(this.messages.redone(this.messages.actions[entry.source] || entry.source, formatNumber(n)));
    this.emit("redo", { source: entry.source, count: n });
    return true;
  }

  get canUndo() {
    return this.history.canUndo;
  }

  get canRedo() {
    return this.history.canRedo;
  }

  clearHistory() {
    this.history.clear();
    return this;
  }

  /**
   * 수정 표시 관리. 셀마다 처음 값을 기억해 두고, 모든 셀이 처음 값으로 돌아오면
   * (실행 취소나 직접 되돌리기) 수정 표시를 푼다. 바꾸기 전에 이미 표시가 있던 행
   * (addRow로 넣은 행, 데이터에 __modified__가 있던 행)은 그대로 둔다.
   * @param {any} row
   * @param {string} key
   * @param {any} old 바꾸기 전 값
   * @param {any} value 바꾼 값
   */
  _trackModified(row, key, old, value) {
    const mk = this.options.modifiedKey;
    let t = this._orig.get(row);
    if (!t) {
      t = { was: !!row[mk], keys: new Map() };
      this._orig.set(row, t);
    }
    if (!t.keys.has(key)) t.keys.set(key, old);
    const empty = (v) => v === null || v === undefined || v === "";
    const first = t.keys.get(key);
    if (first === value || (empty(first) && empty(value))) t.keys.delete(key);
    if (t.keys.size) row[mk] = true;
    else {
      if (t.was) row[mk] = true;
      else delete row[mk];
      this._orig.delete(row);
    }
  }

  /**
   * 수정 표시(__modified__)를 지운다. 저장한 뒤 부른다.
   * @param {any[]} [rows] 없으면 모든 행 (지운 행 포함)
   */
  clearModified(rows) {
    const mk = this.options.modifiedKey;
    const list = rows || this.source.concat(this.deleted);
    for (const r of list) {
      if (!r) continue;
      delete r[mk];
      this._orig.delete(r);
    }
    this.refresh();
    return this;
  }

  /** 지운 행 기록(getDeletedRows)을 비운다. 저장한 뒤 부른다. */
  clearDeleted() {
    this.deleted = [];
    return this;
  }

  /** 저장한 뒤: 수정 표시·지운 행 기록·실행 취소 기록을 모두 비운다 */
  acceptChanges() {
    this.history.clear();
    this.clearDeleted();
    return this.clearModified();
  }

  /**
   * @param {import("./features/history.js").Entry} entry
   * @param {"undo"|"redo"} source
   * @returns {number} 바꾼 셀 수
   */
  _applyHistory(entry, source) {
    const index = new Map();
    this.rows.forEach((r, i) => index.set(r, i));
    const list = source === "undo" ? entry.changes.slice().reverse() : entry.changes;
    const visible = [];
    let hidden = 0;
    for (const ch of list) {
      const v = source === "undo" ? ch.oldValue : ch.value;
      const i = index.get(ch.row);
      if (i === undefined) {
        // 화면에 없는 행(필터로 숨겨짐 등): 값만 되돌린다
        const old = getValue(ch.row, ch.key);
        setPathValue(ch.row, ch.key, v);
        this._trackModified(ch.row, ch.key, old, v);
        hidden++;
      } else visible.push({ rowIndex: i, key: ch.key, value: v });
    }
    // 같은 셀이 여러 번 나오면 마지막에 적용한 값이 남도록 그대로 순서대로 적용한다
    const applied = this.setValues(visible, { source });
    if (applied.length) {
      // 바뀐 셀을 감싸는 범위 (Math.min(...)은 셀이 수십만이면 스택 초과라 반복문으로)
      let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
      const colOf = new Map(this.leaves.map((l, i) => [l.def.key, i]));
      for (const a of applied) {
        const c = colOf.get(a.key);
        if (c === undefined) continue;
        if (a.rowIndex < r0) r0 = a.rowIndex;
        if (a.rowIndex > r1) r1 = a.rowIndex;
        if (c < c0) c0 = c;
        if (c > c1) c1 = c;
      }
      if (c0 !== Infinity) {
        this.setRange(r0, c0, r1, c1);
        this.scrollToCell(r0, c0);
      }
    }
    return applied.length + hidden;
  }

  /**
   * 선택 범위의 값을 TSV(Excel 붙여넣기 형식)로. 값은 formatter를 거치지 않은 원래 값.
   * @returns {string}
   */
  getRangeText() {
    const g = this.range;
    if (!g) return "";
    const out = [];
    for (let r = g.r0; r <= g.r1; r++) {
      const line = [];
      for (let c = g.c0; c <= g.c1; c++) line.push(getValue(this.rows[r], this.leaves[c].def.key));
      out.push(line);
    }
    return buildTSV(out);
  }

  /** 선택 범위를 클립보드에 복사한다 (Ctrl+C는 브라우저 copy 이벤트로 처리) */
  async copy() {
    const text = this.getRangeText();
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      return false;
    }
    this._afterCopy();
    return true;
  }

  _afterCopy() {
    const g = this.range;
    if (g) this._flash(this.messages.copied(formatNumber(g.size)));
    this.emit("copy", { range: this.getRange(), text: this.getRangeText() });
  }

  /**
   * Excel 등에서 복사한 글자를 선택 범위 왼쪽 위부터 붙여넣는다.
   * 편집기가 없거나 막힌 셀, 종류에 맞지 않는 값(숫자 칸의 글자 등), 표 밖의 칸은 건너뛴다.
   * @param {string} text
   * @returns {{applied: number, skipped: number}}
   */
  paste(text) {
    const g = this.range;
    if (!g || this.editing.active) return { applied: 0, skipped: 0 };
    const data = parseTSV(text);
    const plan = pastePlan(data, g);
    const changes = [];
    let skipped = 0;
    let rMax = g.r0;
    let cMax = g.c0;
    for (const p of plan) {
      const info = p.r < this.rows.length && p.c < this.leaves.length ? this.editing.editable(p.r, p.c) : null;
      if (!info) {
        skipped++;
        continue;
      }
      const conv = convertPasteValue(info.def.editor, p.text);
      if (!conv.ok) {
        skipped++;
        continue;
      }
      rMax = Math.max(rMax, p.r);
      cMax = Math.max(cMax, p.c);
      // 같은 뜻의 값(text 칸의 0과 "0" 등)은 바꾸지 않는다: 수정 표시·실행 취소 기록이 생기지 않게
      if (sameValue(info.type, info.cfg, getValue(info.row, info.key), conv.value)) continue;
      changes.push({ rowIndex: p.r, key: info.key, value: conv.value });
    }
    const applied = this.setValues(changes, { source: "paste" });
    if (changes.length || plan.length > skipped) this.setRange(g.r0, g.c0, rMax, cMax);
    const info = { applied: applied.length, skipped, rows: data.length };
    this._flash(this.messages.pasted(formatNumber(applied.length), formatNumber(skipped)));
    this.emit("paste", info);
    return info;
  }

  /** 선택 범위를 복사하고 지운다. Ctrl+X */
  cut() {
    const text = this.getRangeText();
    this.editing.clearRange("cut");
    return text;
  }

  /**
   * 아래 바에 잠깐 문구를 보여 준다 (2.5초 뒤 선택 합계로 돌아감)
   * @param {string} msg
   */
  _flash(msg) {
    if (!this.options.pageBar) return;
    clearTimeout(this._flashTimer);
    this._flashing = true;
    this.el.summary.textContent = msg;
    this.el.summary.dataset.flash = "true";
    this._flashTimer = setTimeout(() => {
      this._flashing = false;
      delete this.el.summary.dataset.flash;
      this._scheduleSummary();
    }, 2500);
  }

  /** @returns {any[]} 값이 바뀐 행 (setData 순서) */
  getModifiedRows() {
    const k = this.options.modifiedKey;
    return this.source.filter((r) => r && r[k]);
  }

  /**
   * 셀 편집을 시작한다.
   * @param {number} rowIndex
   * @param {number} colIndex 잎 컬럼 순번
   * @param {{mode?: "edit"|"type", initial?: string}} [opts]
   */
  startEdit(rowIndex, colIndex, opts) {
    return this.editing.start(rowIndex, colIndex, opts);
  }

  /** 편집 중인 값을 저장한다. 잘못된 값이면 false. */
  commitEdit() {
    return this.editing.commit();
  }

  cancelEdit() {
    this.editing.cancel();
    return this;
  }

  get isEditing() {
    return this.editing.active;
  }

  /** 그리드에 키보드 포커스를 준다 */
  focus() {
    this.editing.focus();
    return this;
  }

  /**
   * formatter·editor.disabled 등에 넘기는 셀 정보
   * @param {number} r
   * @param {number} c
   * @returns {{row: any, item: any, rowIndex: number, dindex: number, colIndex: number, column: ColumnDef, key: any, value: any, grid: PyoGrid, list: any[]}}
   */
  cellContext(r, c) {
    const row = this.rows[r];
    const def = this.leaves[c] ? this.leaves[c].def : {};
    return { row, item: row, rowIndex: r, dindex: r, colIndex: c, column: def, key: def.key, value: getValue(row, def.key), grid: this, list: this.rows };
  }

  /* ==================================================================
   * 공개 API: 정렬
   * ================================================================ */

  /**
   * @param {SortItem[]} sort 앞쪽이 먼저 비교된다
   * @param {{silent?: boolean}} [opts]
   */
  setSort(sort, opts = {}) {
    this.editing.cancel();
    this.sort = (sort || []).filter((s) => s && s.key !== undefined && (s.dir === "asc" || s.dir === "desc")).map((s) => ({ key: s.key, dir: s.dir }));
    this._applyView();
    this.range = null;
    this._renderHeader();
    this.refresh();
    this._scheduleSummary();
    if (!opts.silent) {
      this._saveState();
      this.emit("sortchange", { sort: this.getSort() });
    }
    return this;
  }

  /** @returns {SortItem[]} */
  getSort() {
    return this.sort.map((s) => ({ ...s }));
  }

  /** @param {LeafColumn} leaf */
  isSortable(leaf) {
    const def = leaf.def;
    if (def.key === undefined || def.key === null || def.sortable === false) return false;
    return def.sortable === true || this.options.sortable === true;
  }

  /**
   * 헤더를 클릭한 것처럼 정렬을 바꾼다: 없음 → desc → asc → 없음.
   * @param {number} leafIndex
   */
  toggleSort(leafIndex) {
    const leaf = this.leaves[leafIndex];
    if (!leaf || !this.isSortable(leaf)) return this;
    const key = leaf.def.key;
    const cur = this.sort.find((s) => s.key === key);
    const dir = nextSortDir(cur ? cur.dir : undefined);
    let next = this.options.multiSort ? this.sort.filter((s) => s.key !== key) : [];
    if (dir) {
      if (this.options.multiSort && cur) {
        // 다중 정렬에서 방향만 바꿀 때는 순서를 유지한다
        next = this.sort.map((s) => (s.key === key ? { key, dir } : s));
      } else next.push({ key, dir });
    }
    return this.setSort(next);
  }

  /* ==================================================================
   * 공개 API: 페이지
   * ================================================================ */

  /** @param {PageInfo|null} page */
  setPage(page) {
    this.page = page ? { ...page } : null;
    this._renderPageNav();
    this._renderStatus();
    return this;
  }

  /* ==================================================================
   * 공개 API: 컬럼
   * ================================================================ */

  /** @param {ColumnDef[]} columns */
  setColumns(columns) {
    this.editing.cancel();
    this._userWidths = {};
    this._setColumnsInternal(columns);
    this._afterColumnsChanged(true);
    return this;
  }

  /**
   * 컬럼이 바뀐 뒤: 새 컬럼에 없거나 더는 필터·정렬할 수 없는 키의 조건을 지우고,
   * 화면 행을 다시 만든 뒤 배치한다. 지운 조건이 있으면 filterchange·sortchange를 알린다.
   * @param {boolean} restore stateKey 저장값을 되살릴지 (setColumns)
   */
  _afterColumnsChanged(restore) {
    const leafOf = new Map(this.leaves.map((l) => [l.def.key, l]));
    let filterPruned = false;
    for (const k of [...this.filters.keys()]) {
      const leaf = leafOf.get(k);
      if (!leaf || !this.isFilterable(leaf)) {
        this.filters.delete(k);
        filterPruned = true;
      }
    }
    const sortBefore = JSON.stringify(this.sort);
    this.sort = this.sort.filter((s) => {
      const leaf = leafOf.get(s.key);
      return leaf && this.isSortable(leaf);
    });
    const sortPruned = JSON.stringify(this.sort) !== sortBefore;
    if (restore) this._restoreState();
    const sortChanged = JSON.stringify(this.sort) !== sortBefore;
    if (filterPruned || sortChanged) {
      this._applyView();
      this.range = null;
    }
    this.layout();
    if (filterPruned) this.emit("filterchange", { filters: this.getFilters(), count: this.dataRows.length });
    if (sortPruned) this.emit("sortchange", { sort: this.getSort() });
  }

  /** @returns {ColumnDef[]} 현재 컬럼 정의 */
  getColumns() {
    return this.options.columns;
  }

  /**
   * 맨 위 수준에 컬럼을 넣는다.
   * @param {ColumnDef} column
   * @param {number} [index] 없으면 맨 끝
   */
  addColumn(column, index) {
    const cols = this.options.columns.slice();
    const at = index === undefined || index === null || index < 0 || index > cols.length ? cols.length : index;
    cols.splice(at, 0, column);
    this._replaceColumns(cols);
    return this;
  }

  /** @param {number} [index] 없으면 마지막 컬럼 */
  removeColumn(index) {
    const cols = this.options.columns.slice();
    if (!cols.length) return this;
    const at = index === undefined || index === null ? cols.length - 1 : index;
    if (at < 0 || at >= cols.length) return this;
    cols.splice(at, 1);
    this._replaceColumns(cols);
    return this;
  }

  /**
   * @param {ColumnDef} column
   * @param {number} index
   */
  updateColumn(column, index) {
    const cols = this.options.columns.slice();
    if (index < 0 || index >= cols.length) return this;
    cols[index] = column;
    this._replaceColumns(cols);
    return this;
  }

  /**
   * 잎 컬럼 너비를 바꾼다.
   * @param {number} leafIndex
   * @param {number} width
   */
  setColumnWidth(leafIndex, width) {
    if (!this.leaves[leafIndex]) return this;
    this._userWidths[leafIndex] = Math.max(this.options.minColumnWidth, Math.round(width));
    this.layout();
    this._saveState();
    this.emit("columnresize", { index: leafIndex, column: this.leaves[leafIndex].def, width: this._userWidths[leafIndex] });
    return this;
  }

  /** @returns {number[]} 잎 컬럼 너비(px) */
  getColumnWidths() {
    return this.widths.slice();
  }

  /* ==================================================================
   * 공개 API: 화면
   * ================================================================ */

  /** 크기·컬럼이 바뀐 뒤 다시 배치한다. */
  layout() {
    if (this._destroyed) return this;
    if (this.range) this.range = this.range.clamp(this.rows.length, this.leaves.length);
    this._computeLayout();
    this._renderHeader();
    this._updateBodySize();
    this.refresh();
    this._renderPageNav();
    this.editing.position();
    return this;
  }

  /** 보이는 행을 모두 다시 그린다 (데이터 값이 바뀌었을 때). */
  refresh() {
    if (this._destroyed) return this;
    this._measure();
    const mc = this.options.mergeCells;
    this._merge = mc ? computeMerge(this.rows, this.leaves, mc === true ? true : mc) : new Map();
    this._clearRows();
    this._render();
    this._renderFoot();
    this._renderStatus();
    return this;
  }

  /**
   * 스크롤 영역의 보이는 크기를 읽어 둔다. 스크롤 중에는 다시 읽지 않아서
   * 행을 그린 직후 레이아웃을 강제로 계산하지 않는다.
   * (크기는 컨테이너 크기·행 수·컬럼 너비가 바뀔 때만 바뀌고, 그때마다 refresh가 불린다)
   */
  _measure() {
    const s = this.el.scroll;
    this._vw = s.clientWidth;
    this._vh = s.clientHeight;
  }

  /**
   * 행 하나만 다시 그린다.
   * @param {number} index
   */
  refreshRow(index) {
    const old = this._rowEls.get(index);
    if (!old) return this;
    const el = this._createRow(index);
    old.replaceWith(el);
    this._rowEls.set(index, el);
    this._paintMerge();
    return this;
  }

  /**
   * @param {number} index
   * @param {"nearest"|"top"} [align]
   */
  scrollToRow(index, align = "nearest") {
    const s = this.el.scroll;
    const rh = this.options.rowHeight;
    const top = index * rh;
    const viewH = this._vh - this._headerHeight - this._footHeight;
    if (align === "top" || top < s.scrollTop) s.scrollTop = top;
    else if (top + rh > s.scrollTop + viewH) s.scrollTop = top + rh - viewH;
    this._render();
    return this;
  }

  /**
   * 셀이 보이도록 가로·세로로 스크롤한다 (고정 컬럼은 가로 이동 없음).
   * @param {number} r
   * @param {number} c
   */
  scrollToCell(r, c) {
    this.scrollToRow(r);
    if (c >= this.frozenCount && this.leaves[c]) {
      const s = this.el.scroll;
      const viewW = this._vw - this.fzWidth;
      const x0 = this.leafX[c];
      const x1 = x0 + this.widths[c];
      if (x0 < s.scrollLeft) s.scrollLeft = x0;
      else if (x1 > s.scrollLeft + viewW) s.scrollLeft = x1 - viewW;
      this._render();
    }
    return this;
  }

  /** 높이를 정한다. null이면 대상 요소 높이를 채운다. @param {number|string|null} height */
  setHeight(height) {
    this.options.height = typeof height === "number" ? height : null;
    if (height === null || height === undefined) this.el.root.style.height = "";
    else this.el.root.style.height = typeof height === "number" ? height + "px" : height;
    this.layout();
    return this;
  }

  /**
   * @param {string} name
   * @param {Function} fn
   */
  on(name, fn) {
    (this._handlers[name] = this._handlers[name] || []).push(fn);
    return this;
  }

  /**
   * @param {string} name
   * @param {Function} [fn]
   */
  off(name, fn) {
    if (!fn) delete this._handlers[name];
    else this._handlers[name] = (this._handlers[name] || []).filter((f) => f !== fn);
    return this;
  }

  /**
   * @param {string} name
   * @param {any} [detail]
   */
  emit(name, detail) {
    for (const fn of this._handlers[name] || []) fn.call(this, detail);
  }

  /**
   * 핸들러 중 하나라도 false를 돌려주면 false.
   * @param {string} name
   * @param {any} [detail]
   */
  emitCancelable(name, detail) {
    let ok = true;
    for (const fn of this._handlers[name] || []) if (fn.call(this, detail) === false) ok = false;
    return ok;
  }

  destroy() {
    if (this._destroyed) return;
    if (this._filterPopup) this._filterPopup.close();
    this.editing.cancel();
    this._endResize();
    if (this._dragCleanup) this._dragCleanup();
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    clearTimeout(this._summaryTimer);
    clearTimeout(this._flashTimer);
    if (this._ro) this._ro.disconnect();
    window.removeEventListener("resize", this._onWindowResize);
    this.el.scroll.removeEventListener("scroll", this._onScroll);
    this.target.innerHTML = "";
    this.target.classList.remove("pyo-host");
    this._rowEls.clear();
    this._handlers = {};
  }

  /* ==================================================================
   * DOM 뼈대와 이벤트
   * ================================================================ */

  _buildDom() {
    const t = this.target;
    t.innerHTML = "";
    t.classList.add("pyo-host");
    const root = h("div", "pyo", { "data-pyo": this.id, role: "grid" });
    const scroll = h("div", "pyo-scroll");
    const canvas = h("div", "pyo-canvas");
    const head = h("div", "pyo-head", { role: "rowgroup" });
    const headFz = h("div", "pyo-head-fz");
    const headSc = h("div", "pyo-head-sc");
    const body = h("div", "pyo-body", { role: "rowgroup" });
    const foot = h("div", "pyo-foot", { role: "rowgroup" });
    foot.hidden = true;
    const empty = h("div", "pyo-empty");
    const guide = h("div", "pyo-resize-guide");
    const pagebar = h("div", "pyo-page");
    const summary = h("div", "pyo-page-summary", { "aria-live": "polite" });
    const nav = h("div", "pyo-page-nav");
    const status = h("div", "pyo-page-status");
    pagebar.append(summary, nav, status);
    head.append(headFz, headSc);
    canvas.append(head, body, foot);
    scroll.append(canvas);
    root.append(scroll, empty, guide, pagebar);
    t.append(root);
    if (typeof this.options.height === "number") root.style.height = this.options.height + "px";
    this.el = { root, scroll, canvas, head, headFz, headSc, body, foot, empty, guide, pagebar, summary, nav, status };
  }

  _bind() {
    this._onScroll = () => {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._render();
        this._renderStatus();
        this.editing.position();
        this.emit("scroll", { top: this.el.scroll.scrollTop, left: this.el.scroll.scrollLeft });
      });
    };
    this.el.scroll.addEventListener("scroll", this._onScroll, { passive: true });

    this._lastSize = "";
    this._onWindowResize = () => this._checkSize();
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this._checkSize());
      this._ro.observe(this.el.root);
    } else {
      window.addEventListener("resize", this._onWindowResize);
    }

    this.el.head.addEventListener("pointerdown", (e) => this._onHeaderPointerDown(e));
    this.el.head.addEventListener("click", (e) => this._onHeaderClick(e));
    this.el.body.addEventListener("pointerdown", (e) => this._onBodyPointerDown(e));
    this.el.body.addEventListener("click", (e) => this._onBodyClick(e, "click"));
    this.el.body.addEventListener("dblclick", (e) => this._onBodyClick(e, "dblclick"));
    this.el.nav.addEventListener("click", (e) => this._onPageNavClick(e));
  }

  _checkSize() {
    const r = this.el.root;
    const size = r.clientWidth + "x" + r.clientHeight;
    if (size === this._lastSize) return;
    this._lastSize = size;
    this.layout();
  }

  /* ==================================================================
   * 컬럼과 배치 계산
   * ================================================================ */

  /** @param {ColumnDef[]} columns */
  _setColumnsInternal(columns) {
    this.options.columns = Array.isArray(columns) ? columns : [];
    const model = buildColumnModel(this.options.columns);
    this.leaves = model.leaves;
    this.headerCells = model.header;
    this.headerDepth = model.depth;
  }

  /**
   * 컬럼 구성을 바꾼다. 사용자가 조절한 너비는 같은 정의 객체를 찾아 새 잎 순번으로 옮긴다.
   * @param {ColumnDef[]} cols
   */
  _replaceColumns(cols) {
    this.editing.cancel();
    const byDef = new Map();
    this.leaves.forEach((leaf) => {
      if (this._userWidths[leaf.index] !== undefined) byDef.set(leaf.def, this._userWidths[leaf.index]);
    });
    this._setColumnsInternal(cols);
    /** @type {Record<number, number>} */
    const keep = {};
    this.leaves.forEach((leaf) => {
      if (byDef.has(leaf.def)) keep[leaf.index] = byDef.get(leaf.def);
    });
    this._userWidths = keep;
    this._afterColumnsChanged(false);
  }

  _computeLayout() {
    const o = this.options;
    const aside = [];
    if (o.lineNumber) aside.push({ special: "lineNumber", width: o.lineNumberWidth });
    if (o.rowSelector) aside.push({ special: "rowSelector", width: o.rowSelectorWidth });
    this.aside = aside;
    const asideW = aside.reduce((s, a) => s + a.width, 0);

    // 스크롤바 너비를 항상 빼고 계산해서, 행 수에 따라 "*" 너비가 바뀌지 않게 한다
    const available = this.el.root.clientWidth - asideW - SCROLLBAR;
    this.widths = computeWidths(this.leaves, available, { defaultWidth: o.defaultColumnWidth, override: this._userWidths });

    const frozen = clamp(o.frozenColumns | 0, 0, this.leaves.length);
    this.frozenCount = frozen;

    // x 좌표: 고정 영역은 보조 컬럼 다음부터, 스크롤 영역은 0부터
    const leafX = new Array(this.leaves.length);
    let x = asideW;
    for (let i = 0; i < frozen; i++) {
      leafX[i] = x;
      x += this.widths[i];
    }
    this.fzWidth = x;
    let sx = 0;
    for (let i = frozen; i < this.leaves.length; i++) {
      leafX[i] = sx;
      sx += this.widths[i];
    }
    this.leafX = leafX;
    this.scWidth = sx;
    this.asideWidth = asideW;
    this.totalWidth = this.fzWidth + this.scWidth;
    // 헤더 바깥 높이 = 줄 수 × 줄 높이 + 아래 테두리 1px
    this._headerHeight = this.headerDepth * o.headerRowHeight + 1;
    // 합계 행 높이 = 줄 수 × 행 높이 + 위 테두리 1px
    const footRows = Array.isArray(o.footSum) ? o.footSum.length : 0;
    this._footHeight = footRows ? footRows * o.rowHeight + 1 : 0;
    const pageH = o.pageBar ? o.pageHeight : 0;

    const e = this.el;
    e.canvas.style.width = this.totalWidth + "px";
    e.root.classList.toggle("pyo-has-frozen", frozen > 0);
    e.root.classList.toggle("pyo-cell-select", !!o.cellSelect);
    e.head.style.height = this._headerHeight + "px";
    e.headFz.style.width = this.fzWidth + "px";
    e.headSc.style.width = this.scWidth + "px";
    e.scroll.style.setProperty("--pyo-head-h", this._headerHeight + "px");
    e.scroll.style.bottom = pageH + "px";
    e.pagebar.hidden = !o.pageBar;
    e.pagebar.style.height = pageH + "px";
    e.root.style.setProperty("--pyo-row-h", o.rowHeight + "px");
    e.root.style.setProperty("--pyo-head-row-h", o.headerRowHeight + "px");
    e.empty.style.top = this._headerHeight + "px";
    e.empty.style.bottom = pageH + this._footHeight + "px";
    e.foot.style.height = this._footHeight + "px";
  }

  _applyView() {
    const o = this.options;
    const v = buildView({
      source: this.source,
      filters: this.isFilterActive() ? this.filters : new Map(),
      sort: this.sort,
      compare: o.sortCompare,
      remoteSort: o.remoteSort,
      grouping: o.grouping && Array.isArray(o.grouping.by) ? o.grouping : null,
      tree: this._treeCfg(),
    });
    this.rows = v.rows;
    this.dataRows = v.dataRows;
    this._treeMeta = v.treeMeta;
    const ln = new Int32Array(this.rows.length);
    let n = 0;
    for (let i = 0; i < this.rows.length; i++) ln[i] = this.rows[i].__isGrouping ? -1 : n++;
    this._lineNo = ln;
    this._merge = new Map();
  }

  /** 필터가 걸려 있는가 (트리·서버 페이징에서는 쓰지 않는다) */
  isFilterActive() {
    return this.filters.size > 0 && !this.options.tree && !this.page;
  }

  _updateBodySize() {
    this.el.body.style.height = this.rows.length * this.options.rowHeight + "px";
    const emptyText = this.options.emptyText === undefined ? this.messages.empty : this.options.emptyText;
    const msg = this.isFilterActive() ? this.messages.noFilterMatch : emptyText;
    const showEmpty = !this.rows.length && !!msg;
    this.el.empty.textContent = showEmpty ? msg : "";
    this.el.empty.hidden = !showEmpty;
    this._renderStatus();
  }

  /** 아래 합계 행(footSum) */
  _renderFoot() {
    const fs = this.options.footSum;
    const foot = this.el.foot;
    if (!Array.isArray(fs) || !fs.length) {
      if (foot.innerHTML) foot.innerHTML = "";
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    const rh = this.options.rowHeight;
    let html = "";
    fs.forEach((cells, i) => {
      html += `<div class="pyo-row pyo-foot-row" data-foot="${i}" style="height:${rh}px;width:${this.totalWidth}px">${sumRowHtml(this, cells, this.dataRows)}</div>`;
    });
    foot.innerHTML = html;
  }

  /* ==================================================================
   * 헤더
   * ================================================================ */

  _renderHeader() {
    const o = this.options;
    const rh = o.headerRowHeight;
    const depth = this.headerDepth;
    const fz = [];
    const sc = [];
    let ax = 0;
    for (const a of this.aside) {
      const inner = a.special === "rowSelector" && o.headerSelector ? '<span class="pyo-check" role="checkbox" aria-checked="false"></span>' : "";
      fz.push(
        `<div class="pyo-hcell pyo-aside pyo-al-center" data-special="${a.special}" style="left:${ax}px;top:0;width:${a.width}px;height:${depth * rh}px">${inner}</div>`,
      );
      ax += a.width;
    }
    const frozen = this.frozenCount;
    for (const cell of this.headerCells) {
      const end = cell.colStart + cell.colSpan; // 미포함
      // 고정 경계를 걸치는 묶음 헤더는 두 조각으로 나눠 양쪽에 같은 제목을 보여 준다
      if (cell.colStart < frozen) fz.push(this._headerCellHtml(cell, cell.colStart, Math.min(end, frozen), rh));
      if (end > frozen) sc.push(this._headerCellHtml(cell, Math.max(cell.colStart, frozen), end, rh));
    }
    this.el.headFz.innerHTML = fz.join("");
    this.el.headSc.innerHTML = sc.join("");
    this._updateHeaderSelector();
  }

  /**
   * 제목(label)은 HTML로 넣는다 (화면 코드가 정한 값).
   * @param {HeaderCell} cell
   * @param {number} from
   * @param {number} to  미포함
   * @param {number} rh
   */
  _headerCellHtml(cell, from, to, rh) {
    const left = this.leafX[from];
    let width = 0;
    for (let i = from; i < to; i++) width += this.widths[i];
    const o = this.options;
    const def = cell.def;
    const isLeaf = cell.leafIndex !== undefined;
    const align = def.headerAlign || o.headerAlign || (isLeaf ? null : "center");
    let cls = "pyo-hcell" + (align ? " pyo-al-" + align : "") + (isLeaf ? "" : " pyo-hgroup");
    if (def.headerClass) cls += " " + (isFn(def.headerClass) ? def.headerClass.call(def, def) || "" : def.headerClass);
    let attrs = "";
    let sortMark = "";
    if (isLeaf) {
      attrs = ` data-leaf="${cell.leafIndex}"` + (def.key !== undefined ? ` data-key="${escapeHtml(def.key)}"` : "");
      if (this.isSortable(this.leaves[cell.leafIndex])) {
        cls += " pyo-sortable";
        const s = this.sort.find((x) => x.key === def.key);
        attrs += ` aria-sort="${s ? (s.dir === "asc" ? "ascending" : "descending") : "none"}"`;
        if (s) attrs += ` data-sort="${s.dir}"`;
        sortMark = '<span class="pyo-sort-mark"></span>';
      }
      if (this.isFilterable(this.leaves[cell.leafIndex])) {
        const on = this.isFilterActive() && this.filters.has(def.key);
        cls += " pyo-filterable";
        const filterLabel = escapeHtml(this.messages.filter);
        sortMark += `<span class="pyo-filter-btn${on ? " pyo-filter-on" : ""}" data-filter="${cell.leafIndex}" role="button" aria-label="${filterLabel}" title="${filterLabel}"></span>`;
      }
    }
    const resizer =
      isLeaf && o.resizable && def.resizable !== false ? `<span class="pyo-resizer" data-resize="${cell.leafIndex}"></span>` : "";
    return (
      `<div class="${cls}"${attrs} role="columnheader" style="left:${left}px;top:${cell.row * rh}px;width:${width}px;height:${cell.rowSpan * rh}px">` +
      `<span class="pyo-hlabel">${cell.label}</span>${sortMark}${resizer}</div>`
    );
  }

  /** 헤더 전체 선택 체크박스 상태: 선택 가능한 행이 모두 선택됐으면 체크 */
  _updateHeaderSelector() {
    const box = this.el.headFz.querySelector('[data-special="rowSelector"] .pyo-check');
    if (!box) return;
    let any = false;
    let all = true;
    for (const r of this.rows) {
      if (!this.isRowSelectable(r)) continue;
      any = true;
      if (!this.isRowSelected(r)) {
        all = false;
        break;
      }
    }
    const on = any && all;
    box.classList.toggle("pyo-checked", on);
    box.setAttribute("aria-checked", on ? "true" : "false");
  }

  /** @param {MouseEvent} e */
  _onHeaderClick(e) {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t || !t.closest) return;
    if (t.closest(".pyo-resizer") || Date.now() - this._justResized < 300) return;
    if (this.editing.active && !this.editing.commit()) this.editing.cancel();
    const fb = /** @type {HTMLElement|null} */ (t.closest("[data-filter]"));
    if (fb) {
      this.openFilter(Number(fb.dataset.filter), fb);
      return;
    }
    if (t.closest('[data-special="rowSelector"]')) {
      if (!this.options.headerSelector || !this.options.multipleSelect) return;
      const box = this.el.headFz.querySelector('[data-special="rowSelector"] .pyo-check');
      this.selectAll(!(box && box.classList.contains("pyo-checked")));
      return;
    }
    const cell = /** @type {HTMLElement|null} */ (t.closest(".pyo-hcell[data-leaf]"));
    if (!cell) return;
    this.toggleSort(Number(cell.dataset.leaf));
  }

  /* ==================================================================
   * 본문 (세로·가로 가상 스크롤)
   * ================================================================ */

  _visibleRange() {
    const o = this.options;
    const s = this.el.scroll;
    const rh = o.rowHeight;
    const viewH = Math.max(0, this._vh - this._headerHeight - this._footHeight);
    const n = this.rows.length;
    const r0 = clamp(Math.floor(s.scrollTop / rh) - o.overscanRows, 0, Math.max(0, n - 1));
    const r1 = clamp(Math.ceil((s.scrollTop + viewH) / rh) + o.overscanRows, 0, n) - 1;

    // 스크롤 영역 컬럼 중 보이는 범위 (고정 컬럼은 항상 그린다)
    const frozen = this.frozenCount;
    const last = this.leaves.length - 1;
    let c0 = frozen;
    let c1 = last;
    if (this._vw > 0 && frozen <= last) {
      const leftEdge = s.scrollLeft;
      const rightEdge = s.scrollLeft + Math.max(0, this._vw - this.fzWidth);
      while (c0 < last && this.leafX[c0] + this.widths[c0] <= leftEdge) c0++;
      c1 = c0;
      while (c1 < last && this.leafX[c1 + 1] < rightEdge) c1++;
      c0 = Math.max(frozen, c0 - o.overscanColumns);
      c1 = Math.min(last, c1 + o.overscanColumns);
    }
    return { r0, r1, c0, c1 };
  }

  _render() {
    if (this._destroyed) return;
    const next = this._visibleRange();
    const cur = this._range;
    if (next.c0 !== cur.c0 || next.c1 !== cur.c1) this._clearRows();
    for (const [i, el] of this._rowEls) {
      if (i < next.r0 || i > next.r1) {
        el.remove();
        this._rowEls.delete(i);
      }
    }
    this._range = next;
    if (next.r1 < next.r0) return;
    const frag = document.createDocumentFragment();
    for (let i = next.r0; i <= next.r1; i++) {
      if (this._rowEls.has(i)) continue;
      const el = this._createRow(i);
      this._rowEls.set(i, el);
      frag.append(el);
    }
    this.el.body.append(frag);
    this._paintMerge();
  }

  /**
   * 병합 덩어리마다 글자를 보이는 부분의 가운데 행에만 보인다.
   * 덩어리가 화면보다 길어도 글자가 화면 안에 있게, 스크롤할 때마다 다시 고른다.
   * (셀에는 늘 글자가 들어 있고 class로 숨기므로 행을 다시 만들지 않는다)
   */
  _paintMerge() {
    if (!this._merge.size || !this._rowEls.size) return;
    const rh = this.options.rowHeight;
    const s = this.el.scroll;
    const viewH = Math.max(rh, this._vh - this._headerHeight - this._footHeight);
    const v0 = Math.floor(s.scrollTop / rh);
    const v1 = Math.max(v0, Math.ceil((s.scrollTop + viewH) / rh) - 1);
    for (const [c, mg] of this._merge) {
      for (const [r, el] of this._rowEls) {
        const st = mg.start[r];
        const en = mg.end[r];
        if (st === en) continue;
        const cell = el.querySelector(`.pyo-cell[data-c="${c}"]`);
        if (!cell) continue;
        const a = Math.max(st, v0);
        const b = Math.min(en, v1);
        const label = a <= b ? a + ((b - a) >> 1) : st + ((en - st) >> 1);
        cell.classList.toggle("pyo-merge-hide", r !== label);
      }
    }
  }

  _clearRows() {
    for (const el of this._rowEls.values()) el.remove();
    this._rowEls.clear();
    this._range = { r0: 0, r1: -1, c0: -1, c1: -1 };
  }

  /** @param {number} index */
  _rowClassName(index) {
    const o = this.options;
    const row = this.rows[index];
    if (row.__isGrouping) return "pyo-row pyo-group-row pyo-group-depth-" + (row.__depth || 0);
    let cls = "pyo-row " + (index % 2 ? "pyo-odd" : "pyo-even");
    if (this.isRowSelected(row)) cls += " pyo-selected";
    if (!this.isRowSelectable(row)) cls += " pyo-unselectable";
    if (o.rowClass) {
      const extra = isFn(o.rowClass) ? o.rowClass.call(this, row, index) : o.rowClass;
      if (extra) cls += " " + extra;
    }
    return cls;
  }

  /** @param {number} index */
  _createRow(index) {
    const o = this.options;
    const row = this.rows[index];
    const el = document.createElement("div");
    el.className = this._rowClassName(index);
    el.setAttribute("role", "row");
    el.setAttribute("aria-selected", this.isRowSelected(row) ? "true" : "false");
    el.dataset.row = String(index);
    el.style.top = index * o.rowHeight + "px";
    el.style.height = o.rowHeight + "px";
    el.style.width = this.totalWidth + "px";

    if (row.__isGrouping) {
      // 그룹 합계 행: grouping.columns를 칸 정의로 그린다 (가로 가상 스크롤 없이 전부)
      el.innerHTML = sumRowHtml(this, (this.options.grouping && this.options.grouping.columns) || [], row.__groupingList, row.__groupingBy);
      return el;
    }

    let fz = "";
    for (const a of this.aside) fz += this._asideCellHtml(a, index);
    for (let c = 0; c < this.frozenCount; c++) fz += this._cellHtml(c, row, index);

    const r = this._range;
    const c0 = r.c0 < 0 ? this.frozenCount : r.c0;
    const c1 = r.c1 < 0 ? this.leaves.length - 1 : r.c1;
    let sc = "";
    for (let c = c0; c <= c1; c++) sc += this._cellHtml(c, row, index);
    const pad = c0 < this.leaves.length ? this.leafX[c0] || 0 : 0;
    el.innerHTML =
      `<div class="pyo-fz" style="width:${this.fzWidth}px">${fz}</div>` +
      `<div class="pyo-sc" style="width:${this.scWidth}px;padding-left:${pad}px">${sc}</div>`;
    return el;
  }

  /**
   * @param {{special: string, width: number}} a
   * @param {number} index
   */
  _asideCellHtml(a, index) {
    const ln = this._lineNo ? this._lineNo[index] : index;
    const inner = a.special === "lineNumber" ? String((ln >= 0 ? ln : index) + 1) : '<span class="pyo-check"></span>';
    return `<div class="pyo-cell pyo-aside pyo-al-center" data-special="${a.special}" style="width:${a.width}px">${inner}</div>`;
  }

  /**
   * 트리 펼침 단추·들여쓰기 (기본 아이콘이 있고, 화면은 HTML 아이콘을 줄 수 있다)
   * @param {any} row
   */
  _treeControlHtml(row) {
    const t = this.options.tree || {};
    const m = this._treeMeta && this._treeMeta.get(row);
    if (!m) return "";
    const icons = { openedArrow: "▾", collapsedArrow: "▸", groupIcon: "⊚", collapsedGroupIcon: "⊚", itemIcon: "⊙", ...(t.icons || {}) };
    const indent = (t.indentWidth ?? 10) * m.depth;
    const aw = t.arrowWidth ?? 15;
    const iw = t.iconWidth ?? 18;
    const collapsed = !!row[(t.collapseKey || "collapse")];
    const has = m.children.length > 0;
    const arrow = has
      ? `<span class="pyo-tree-arrow" data-tree-toggle role="button" aria-expanded="${!collapsed}" style="width:${aw}px">${collapsed ? icons.collapsedArrow : icons.openedArrow}</span>`
      : `<span class="pyo-tree-arrow" style="width:${aw}px"></span>`;
    const icon = has ? (collapsed ? icons.collapsedGroupIcon : icons.groupIcon) : icons.itemIcon;
    return `<span class="pyo-tree-indent" style="width:${indent}px"></span>${arrow}${icon ? `<span class="pyo-tree-icon" style="width:${iw}px">${icon}</span>` : ""}`;
  }

  /**
   * 셀 안 HTML (formatter 결과, 체크박스, 선택 목록 글자, 이스케이프한 값)
   * @param {number} c
   * @param {any} row
   * @param {number} index
   * @param {any} value
   * @param {any} ctx
   * @param {boolean} [plain] 체크박스도 글자로 (내보내기용)
   */
  _cellContent(c, row, index, value, ctx, plain = false) {
    const def = this.leaves[c].def;
    const ed = def.editor;
    const edType = ed && this.options.editable ? editorTypes[ed.type] : null;
    const fn = def.formatter ? (isFn(def.formatter) ? def.formatter : formatters[/** @type {string} */ (def.formatter)]) : null;
    if (edType && edType.kind === "toggle" && this.editing.editable(index, c)) {
      // 체크박스 편집기는 셀 안에 바로 그린다 (formatter보다 우선). 편집할 수 없으면 값 그대로.
      if (plain) return escapeHtml(value);
      const on = isChecked(value, ed.config);
      return `<span class="pyo-check pyo-cb${on ? " pyo-checked" : ""}" role="checkbox" aria-checked="${on}"></span>`;
    }
    if (fn) {
      const out = fn.call(ctx, ctx);
      return out === undefined || out === null ? "" : String(out);
    }
    if (edType && edType.kind === "list") {
      // formatter가 없는 선택 목록은 값 대신 항목 글자를 보여 준다
      const opt = selectOptions(ed.config).find((o) => String(o.value) === String(value));
      return escapeHtml(opt ? opt.text : value);
    }
    return escapeHtml(value);
  }

  /**
   * 화면 셀 글자 (HTML일 수 있음). 내보내기에 쓴다.
   * @param {number} r 화면 순번
   * @param {number} c 잎 컬럼 순번
   */
  cellText(r, c) {
    const row = this.rows[r];
    const def = this.leaves[c].def;
    const value = getValue(row, def.key);
    const ctx = { value, row, item: row, key: def.key, rowIndex: r, dindex: r, column: def, grid: this };
    return this._cellContent(c, row, r, value, ctx, true);
  }

  /**
   * formatter 결과는 HTML로 넣고, formatter가 없으면 값을 이스케이프한다.
   * @param {number} c
   * @param {any} row
   * @param {number} index
   */
  _cellHtml(c, row, index) {
    const def = this.leaves[c].def;
    const value = getValue(row, def.key);
    const ctx = { value, row, item: row, key: def.key, rowIndex: index, dindex: index, column: def, grid: this };
    let content = this._cellContent(c, row, index, value, ctx);
    const align = def.align || this.options.align;
    let cls = "pyo-cell" + (align ? " pyo-al-" + align : "") + (def.multiLine ? " pyo-multiline" : "");
    if (def.treeControl && this._treeMeta) {
      cls += " pyo-tree-cell";
      content = this._treeControlHtml(row) + `<span class="pyo-tree-text">${content}</span>`;
    }
    const mg = this._merge.get(c);
    if (mg && mg.start[index] !== mg.end[index]) {
      // 합친 덩어리: 안쪽 가로선을 지우고, 글자는 _paintMerge가 보이는 부분 가운데 행에만 보인다
      const s = mg.start[index];
      const e = mg.end[index];
      cls += " pyo-merged" + (index !== e ? " pyo-merge-cont" : "");
      if (index !== s + ((e - s) >> 1)) cls += " pyo-merge-hide";
      content = `<span class="pyo-merge-text">${content}</span>`;
    }
    const g = this.range;
    if (g && g.contains(index, c)) {
      cls += " pyo-in-range";
      if (g.active.r === index && g.active.c === c) cls += " pyo-active";
    }
    if (def.cellClass) {
      const extra = isFn(def.cellClass) ? def.cellClass.call(ctx, ctx) : def.cellClass;
      if (extra) cls += " " + extra;
    }
    return `<div class="${cls}" role="gridcell" data-c="${c}" style="width:${this.widths[c]}px">${content}</div>`;
  }

  /* ==================================================================
   * 행 선택 반영
   * ================================================================ */

  /**
   * @param {number[]} changed 바뀐 화면 순번
   * @param {{index:number,row:any,selected:boolean,source:string}} info
   * @param {any[]} [changedRows] 화면에 없는 행(접힌 트리)까지 포함한 바뀐 행
   */
  _afterSelection(changed, info, changedRows) {
    for (const i of changed) {
      const el = this._rowEls.get(i);
      if (!el) continue;
      el.className = this._rowClassName(i);
      el.setAttribute("aria-selected", this.isRowSelected(this.rows[i]) ? "true" : "false");
    }
    this._updateHeaderSelector();
    const rowsChanged = changedRows || changed.map((i) => this.rows[i]);
    if (rowsChanged.length) this.emit("selectionchange", { ...info, changed: rowsChanged, indexes: changed });
  }

  /* ==================================================================
   * 셀 범위 선택 반영
   * ================================================================ */

  /** @param {CellRange|null} rng */
  _setRangeInternal(rng) {
    const prev = this.range;
    const same =
      (!prev && !rng) ||
      (prev && rng && prev.anchor.r === rng.anchor.r && prev.anchor.c === rng.anchor.c && prev.active.r === rng.active.r && prev.active.c === rng.active.c);
    this.range = rng;
    if (same) return;
    this._paintRange();
    this._scheduleSummary();
    this.editing.position();
    this.emit("rangechange", { range: this.getRange() });
  }

  /** 그려진 셀의 범위 표시만 고친다 (행을 다시 만들지 않음) */
  _paintRange() {
    const g = this.range;
    for (const [r, el] of this._rowEls) {
      const cells = el.querySelectorAll(".pyo-cell[data-c]");
      for (let k = 0; k < cells.length; k++) {
        const cell = /** @type {HTMLElement} */ (cells[k]);
        const c = Number(cell.dataset.c);
        const inR = !!g && g.contains(r, c);
        cell.classList.toggle("pyo-in-range", inR);
        cell.classList.toggle("pyo-active", inR && g.active.r === r && g.active.c === c);
      }
    }
  }

  /**
   * 화면 좌표 → (행, 잎 컬럼). 영역 밖이면 가장 가까운 셀로 맞춘다.
   * @param {number} x clientX
   * @param {number} y clientY
   */
  _cellFromPoint(x, y) {
    const s = this.el.scroll;
    const sr = s.getBoundingClientRect();
    const rh = this.options.rowHeight;
    const contentY = y - sr.top + s.scrollTop - this._headerHeight;
    const r = clamp(Math.floor(contentY / rh), 0, Math.max(0, this.rows.length - 1));
    const xIn = x - sr.left;
    let c;
    if (xIn < this.fzWidth && this.frozenCount > 0) {
      c = 0;
      for (let i = 0; i < this.frozenCount; i++) if (xIn >= this.leafX[i]) c = i;
    } else {
      const sx = xIn + s.scrollLeft - this.fzWidth;
      c = this.frozenCount;
      for (let i = this.frozenCount; i < this.leaves.length; i++) if (sx >= this.leafX[i]) c = i;
    }
    return { r, c: clamp(c, 0, Math.max(0, this.leaves.length - 1)) };
  }

  /** @param {PointerEvent} e */
  _onBodyPointerDown(e) {
    if (e.button !== 0) return;
    const t = /** @type {HTMLElement} */ (e.target);
    const rowEl = t.closest && /** @type {HTMLElement|null} */ (t.closest(".pyo-row"));
    if (!rowEl) return;
    const r = Number(rowEl.dataset.row);
    if (t.closest("[data-tree-toggle]")) {
      e.preventDefault();
      this.toggleNode(r);
      return;
    }
    const special = /** @type {HTMLElement|null} */ (t.closest("[data-special]"));
    if (special) {
      if (special.dataset.special === "rowSelector") {
        e.preventDefault();
        // 기준 행은 행 객체로 기억한다 (화면 순번은 정렬·필터·행 추가·삭제로 바뀐다)
        const from = this._lastRowClick ? this.rows.indexOf(this._lastRowClick) : -1;
        if (e.shiftKey && from >= 0 && this.options.multipleSelect) {
          // Shift+클릭: 마지막으로 누른 행의 상태로 사이 행을 맞춘다
          this.selectRowRange(from, r, this.isRowSelected(this._lastRowClick));
        } else {
          this.selectRow(r, undefined, { source: "click" });
        }
        this._lastRowClick = this.rows[r];
      }
      return;
    }
    const cellEl = /** @type {HTMLElement|null} */ (t.closest(".pyo-cell[data-c]"));
    if (!cellEl || !this.options.cellSelect) return;
    const c = Number(cellEl.dataset.c);
    // 셀 안의 입력 요소(화면 코드가 formatter로 넣은 것)는 기본 동작을 둔다
    if (t.closest("input, select, textarea, button, a")) return;
    e.preventDefault();
    // 편집 중인 셀을 다시 누른 경우는 그대로 둔다. 다른 셀이면 저장 (잘못된 값이면 이동하지 않음).
    const ed = this.editing.edit;
    if (ed) {
      if (ed.r === r && ed.c === c) return;
      if (!this.editing.commit()) return;
    }
    this.editing.focus();
    if (e.shiftKey && this.range) this._setRangeInternal(new CellRange(this.range.anchor, { r, c }));
    else this._setRangeInternal(new CellRange({ r, c }));
    this._startDrag(e);
  }

  /**
   * 끌어서 범위 넓히기. 영역 밖으로 나가면 자동으로 스크롤한다.
   * 포인터 캡처를 쓰면 Chrome이 click 대상을 캡처한 요소로 바꿔서 셀 click·dblclick이 사라지므로
   * document에 이동·놓기 리스너를 단다.
   * @param {PointerEvent} e
   */
  _startDrag(e) {
    if (this._dragCleanup) this._dragCleanup();
    const s = this.el.scroll;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let timer = 0;
    const update = () => {
      if (!this.range) return;
      const p = this._cellFromPoint(lastX, lastY);
      this._setRangeInternal(new CellRange(this.range.anchor, p));
    };
    const autoScroll = () => {
      timer = 0;
      const sr = s.getBoundingClientRect();
      const top = sr.top + this._headerHeight;
      const bottom = sr.top + s.clientHeight;
      const left = sr.left + this.fzWidth;
      const right = sr.left + s.clientWidth;
      let dy = 0;
      let dx = 0;
      if (lastY < top) dy = lastY - top;
      else if (lastY > bottom) dy = lastY - bottom;
      if (lastX > right) dx = lastX - right;
      else if (lastX < left && s.scrollLeft > 0 && this.range && this.range.active.c >= this.frozenCount) dx = lastX - left;
      if (dx || dy) {
        s.scrollTop += clamp(dy, -60, 60);
        s.scrollLeft += clamp(dx, -60, 60);
        this._render();
        update();
        timer = requestAnimationFrame(autoScroll);
      }
    };
    /** @param {PointerEvent} ev */
    const move = (ev) => {
      lastX = ev.clientX;
      lastY = ev.clientY;
      update();
      if (!timer) timer = requestAnimationFrame(autoScroll);
    };
    const up = () => cleanup();
    const cleanup = () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      this._dragCleanup = null;
    };
    this._dragCleanup = cleanup;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  /**
   * 셀 클릭·더블클릭을 click / dblclick 이벤트로 알린다.
   * @param {MouseEvent} e
   * @param {"click"|"dblclick"} type
   */
  _onBodyClick(e, type) {
    const t = /** @type {HTMLElement} */ (e.target);
    const rowEl = t.closest && /** @type {HTMLElement|null} */ (t.closest(".pyo-row"));
    if (!rowEl) return;
    const r = Number(rowEl.dataset.row);
    const special = /** @type {HTMLElement|null} */ (t.closest("[data-special]"));
    const cellEl = /** @type {HTMLElement|null} */ (t.closest(".pyo-cell[data-c]"));
    const row = this.rows[r];
    if (special) {
      this.emit(type, { row, item: row, rowIndex: r, dindex: r, special: special.dataset.special, event: e, grid: this });
      return;
    }
    if (!cellEl) return;
    const c = Number(cellEl.dataset.c);
    const def = this.leaves[c].def;
    const info = this.editing.editable(r, c);
    if (info && !e.shiftKey) {
      // 체크박스는 셀을 누르면 바로 바뀐다. 그 밖의 편집기는 더블클릭으로 편집하고 dblclick은 알리지 않는다.
      if (type === "click" && info.type.kind === "toggle") this.editing.toggle(r, c);
      if (type === "dblclick" && info.type.kind !== "toggle") {
        this.editing.start(r, c, { mode: "edit" });
        return;
      }
    }
    this.emit(type, {
      row, item: row, rowIndex: r, dindex: r, colIndex: c, column: def, key: def.key, value: getValue(row, def.key), event: e, grid: this,
    });
  }

  /* ==================================================================
   * 페이지 바·선택 합계
   * ================================================================ */

  _renderPageNav() {
    if (!this.options.pageBar) return;
    this.el.nav.innerHTML = this.page ? navigationHtml(this.page, this.options.pageIcons || {}, this.options.pageNavigationCount) : "";
    this._renderStatus();
  }

  _renderStatus() {
    const o = this.options;
    if (!o.pageBar) return;
    if (!o.statusDisplay) {
      this.el.status.innerHTML = "";
      return;
    }
    const s = this.el.scroll;
    const rh = o.rowHeight;
    const first = Math.floor(s.scrollTop / rh);
    const visible = Math.max(1, Math.ceil(Math.max(0, this._vh - this._headerHeight - this._footHeight) / rh));
    const data = statusData(Math.min(first, Math.max(0, this.rows.length - 1)), visible, this.rows.length, this.page);
    const html = isFn(o.statusFormat) ? o.statusFormat.call(this, data) : defaultStatusHtml(data);
    if (this._lastStatus !== html) {
      this._lastStatus = html;
      this.el.status.innerHTML = html;
    }
  }

  /** @param {MouseEvent} e */
  _onPageNavClick(e) {
    const t = /** @type {HTMLElement} */ (e.target);
    const btn = t.closest && /** @type {HTMLElement|null} */ (t.closest("[data-page-move]"));
    if (!btn || !this.page) return;
    const p = targetPage(btn.dataset.pageMove, this.page);
    if (p === null) return;
    this.emit("pagechange", { page: p, current: this.page.currentPage, info: { ...this.page } });
  }

  _scheduleSummary() {
    if (!this.options.selectionSummary || !this.options.pageBar) return;
    clearTimeout(this._summaryTimer);
    this._summaryTimer = setTimeout(() => {
      if (this._destroyed || this._flashing) return;
      this.el.summary.textContent = summaryText(this.getSelectionSummary(), this.messages);
    }, 30);
  }

  /* ==================================================================
   * 컬럼 너비 조절
   * ================================================================ */

  /** @param {PointerEvent} e */
  _onHeaderPointerDown(e) {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t || !t.matches || !t.matches(".pyo-resizer")) return;
    e.preventDefault();
    e.stopPropagation();
    const leafIndex = Number(t.dataset.resize);
    const startX = e.clientX;
    const startW = this.widths[leafIndex];
    const min = this.options.minColumnWidth;
    const rootRect = this.el.root.getBoundingClientRect();
    const cellRect = /** @type {HTMLElement} */ (t.parentElement).getBoundingClientRect();
    const cellLeft = cellRect.right - startW;
    const guide = this.el.guide;
    guide.style.display = "block";
    /** @param {number} dx */
    const place = (dx) => {
      const w = Math.max(min, startW + dx);
      guide.style.left = cellLeft - rootRect.left + w - 1 + "px";
      return w;
    };
    place(0);
    this.el.root.classList.add("pyo-resizing");
    try {
      t.setPointerCapture(e.pointerId);
    } catch (err) {
      /* jsdom 등 */
    }
    /** @param {PointerEvent} ev */
    const move = (ev) => place(ev.clientX - startX);
    /** @param {PointerEvent} ev */
    const up = (ev) => {
      const w = place(ev.clientX - startX);
      this._endResize();
      this._justResized = Date.now();
      if (w !== startW) this.setColumnWidth(leafIndex, w);
    };
    this._resizeCleanup = () => {
      t.removeEventListener("pointermove", move);
      t.removeEventListener("pointerup", up);
      t.removeEventListener("pointercancel", up);
    };
    t.addEventListener("pointermove", move);
    t.addEventListener("pointerup", up);
    t.addEventListener("pointercancel", up);
  }

  _endResize() {
    if (this._resizeCleanup) this._resizeCleanup();
    this._resizeCleanup = null;
    if (this.el && !this._destroyed) {
      this.el.guide.style.display = "none";
      this.el.root.classList.remove("pyo-resizing");
    }
  }
}

PyoGrid.formatters = formatters;
PyoGrid.parseWidth = parseWidth;
