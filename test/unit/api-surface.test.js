// 공개 API 이름을 고정한다. 이름을 더하거나 빼면 이 테스트가 실패한다.
// 일부러 바꾼 것이라면 아래 목록, docs/api-surface.md, README.md, CHANGELOG.md를 같이 고친다.
// 이름을 빼거나 바꾸는 것은 호환성을 깨는 변경이다 (README의 Stability 절).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "../../src/index.js";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout } from "./helpers.js";

// jsdom 환경에서는 전역 URL이 jsdom 것이라 new URL(..., import.meta.url)을 쓰지 않는다
const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");

/** src 아래 .js 파일 내용 (경로 → 내용) */
function sourceFiles(dir = SRC) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...sourceFiles(p));
    else if (ent.name.endsWith(".js")) out.push({ path: p, text: readFileSync(p, "utf8") });
  }
  return out;
}

const sorted = (list) => [...list].sort();

describe("공개 API 이름 고정", () => {
  it("src/index.js 내보내기", () => {
    expect(sorted(Object.keys(api))).toEqual(sorted([
      "PyoGrid",
      "version",
      // core
      "formatters",
      "buildColumnModel", "computeWidths", "parseWidth",
      "sortRows", "compareSmart", "comparePlain", "nextSortDir",
      "CellRange",
      "locales", "resolveMessages",
      // features
      "formatNumber", "summaryText",
      "userCollectors", "collectors",
      "parseTSV", "buildTSV",
      "toXlsxCell", "htmlToText",
      // editors
      "editorTypes", "parseNumber", "parseDate", "parseDateValue", "formatDateAs",
      "sanitizeNumber", "sanitizeDate", "addCommas", "selectOptions",
      // util
      "escapeHtml", "getValue", "setValue", "parseKeyPath", "toNumber",
    ]));
  });

  it("PyoGrid 정적 속성", () => {
    const own = Object.getOwnPropertyNames(PyoGrid).filter((n) => !["length", "name", "prototype"].includes(n));
    expect(sorted(own)).toEqual(["formatters", "parseWidth"]);
  });

  it("PyoGrid.prototype 공개 메서드 (_로 시작하지 않는 것)", () => {
    const proto = PyoGrid.prototype;
    const names = Object.getOwnPropertyNames(proto).filter((n) => n !== "constructor" && !n.startsWith("_"));
    const methods = names.filter((n) => typeof Object.getOwnPropertyDescriptor(proto, n).value === "function");
    const getters = names.filter((n) => Object.getOwnPropertyDescriptor(proto, n).get);
    expect(methods.length + getters.length).toBe(names.length);

    expect(sorted(methods)).toEqual(sorted([
      // Data
      "setData", "getRows", "getViewRows", "getAllRows", "getRow", "addRow", "removeRows", "deleteRows",
      "getDeletedRows", "getAddedRows", "getModifiedRows", "clearModified", "clearDeleted", "acceptChanges",
      "replaceRow", "setValue", "setValues", "getChanges", "cleanRow",
      // Row selection
      "selectRow", "selectRowRange", "selectAll", "clearSelection", "getSelectedRows", "getSelectedIndexes",
      "isRowSelected", "isRowSelectable",
      // Cell range
      "setRange", "clearRange", "getRange", "getActiveCell", "getRangeCells", "getSelectionSummary", "getRangeText",
      // Sorting, filtering, tree
      "setSort", "getSort", "toggleSort", "setFilter", "clearFilters", "getFilters", "openFilter", "isFilterActive",
      "toggleNode", "expandAll", "collapseAll", "getTreeInfo",
      // Editing, clipboard, undo
      "startEdit", "commitEdit", "cancelEdit", "focus", "copy", "paste", "cut", "undo", "redo", "clearHistory",
      // Columns and layout
      "setColumns", "getColumns", "addColumn", "removeColumn", "updateColumn", "setColumnWidth", "getColumnWidths",
      "layout", "refresh", "refreshRow", "scrollToRow", "scrollToCell", "setHeight", "setPage", "cellContext", "cellText",
      // Export, persistence, misc
      "exportExcel", "getExportData", "resetState", "on", "off", "destroy",
      // README에 없음 (docs/api-surface.md "정할 것")
      "isFilterable", "isSortable", "isNumericColumn", "emit", "emitCancelable",
    ]));
    expect(sorted(getters)).toEqual(sorted(["rowCount", "isEditing", "canUndo", "canRedo"]));
  });

  describe("DEFAULTS 키 (new PyoGrid의 options)", () => {
    beforeAll(mockLayout);
    afterAll(unmockLayout);

    it("옵션 없이 만든 그리드의 options 키", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      const grid = new PyoGrid(el);
      try {
        expect(sorted(Object.keys(grid.options))).toEqual(sorted([
          "columns", "frozenColumns", "rowHeight", "headerRowHeight", "lineNumber", "lineNumberWidth",
          "rowSelector", "rowSelectorWidth", "headerSelector", "multipleSelect", "selectedKey", "disableSelectionKey",
          "sortable", "multiSort", "sortCompare", "remoteSort", "cellSelect", "editable", "modifiedKey",
          "undo", "undoLimit", "clipboard", "filter", "footSum", "grouping", "tree", "mergeCells",
          "deletedKey", "addedKey", "markAddedModified", "stateKey", "sheetName",
          "pageBar", "pageHeight", "statusDisplay", "pageNavigationCount", "pageIcons", "statusFormat",
          "selectionSummary", "defaultColumnWidth", "minColumnWidth", "resizable", "emptyText",
          "locale", "messages", "overscanRows", "overscanColumns", "headerAlign", "align", "rowClass", "height",
        ]));
      } finally {
        grid.destroy();
        el.remove();
      }
    });
  });

  it("소스에서 emit하는 이벤트 이름", () => {
    const names = new Set();
    let dynamic = 0;
    for (const { text } of sourceFiles()) {
      for (const m of text.matchAll(/\bemit(?:Cancelable)?\(\s*([^,)\s]+)/g)) {
        const arg = m[1];
        const lit = /^["'`](\w+)["'`]$/.exec(arg);
        if (lit) names.add(lit[1]);
        else if (arg !== "name") dynamic++; // emit/emitCancelable 정의의 매개변수 name은 뺀다
      }
    }
    // _onBodyClick(e, type)은 this.emit(type, ...)으로 부르고, type은 _bind에서 넘기는 글자다
    const grid = readFileSync(join(SRC, "grid.js"), "utf8");
    for (const m of grid.matchAll(/_onBodyClick\(e,\s*"(\w+)"\)/g)) names.add(m[1]);
    expect(dynamic).toBe(2); // _onBodyClick 안의 emit(type, ...) 두 번. 늘어나면 위에서 이름을 찾아 넣는다

    expect(sorted(names)).toEqual(sorted([
      "click", "dblclick",
      "selectionchange", "rangechange", "sortchange", "filterchange", "pagechange",
      "change", "batchchange",
      "beforeedit", "editstart", "editend", "keydown",
      "copy", "paste", "undo", "redo",
      "rowsadd", "rowsremove", "rowsdelete",
      "treetoggle", "columnresize", "scroll", "datachange",
    ]));
  });
});
