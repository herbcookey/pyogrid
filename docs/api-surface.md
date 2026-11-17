# 공개 API 목록 (0.9.0 기준)

1.0을 앞두고 사용자에게 보이는 이름을 모두 모아 README에 적혀 있는지 나눈 표다.
"문서에 있음"은 README.md에 이름과 쓰는 법이 적혀 있다는 뜻이다. 이 문서를 만들 때 코드는 바꾸지 않았다.

- **뺄 후보**: 문서에 없는 내보내기. 1.0 전에 내보내기에서 빼거나 README에 적어 약속할지 정한다. 아직 빼지 않았다.
- **정할 것**: 문서에 없는 인스턴스 메서드·속성. 내보내기는 아니지만 누구나 부를 수 있으므로, 1.0 전에 문서에 넣을지 `_`를 붙여 숨길지 정한다.

[test/unit/api-surface.test.js](../test/unit/api-surface.test.js)가 이 목록 중 내보내기, 프로토타입 메서드, 옵션 키, 이벤트 이름을 고정한다.
목록이 바뀌면 그 테스트가 실패하므로, 이 문서와 테스트를 같이 고친다.

## 1. ES 모듈 내보내기 (src/index.js)

README의 Global extensions 절은 "ES 모듈도 같은 것을 이름으로 내보낸다"며 몇 이름을 적고 나머지는 "and more (see src/index.js)"로 넘긴다.
이름이 적힌 것과 전역 표(2절)에 있는 것만 "문서에 있음"으로 셌다.

| 이름 | 나온 곳 | README | 표시 |
|---|---|---|---|
| `PyoGrid` | grid.js | 있음 | |
| `version` | index.js | 있음 (`PyoGrid.version`) | |
| `formatters` | core/formatters.js | 있음 | |
| `editorTypes` | editors/types.js | 있음 (`PyoGrid.editors`) | |
| `userCollectors` | features/summary.js | 있음 (`PyoGrid.collectors`) | |
| `locales` | core/locales.js | 있음 | |
| `escapeHtml` | util.js | 있음 | |
| `sortRows` | core/sort.js | 있음 | |
| `formatNumber` | features/pagebar.js | 있음 | |
| `getValue`, `setValue`, `toNumber` | util.js | 있음 (`PyoGrid.util`) | |
| `parseTSV`, `buildTSV` | features/clipboard.js | 이름만 있음 | |
| `buildColumnModel`, `computeWidths`, `parseWidth` | core/columns.js | 없음 | 뺄 후보 |
| `compareSmart`, `comparePlain`, `nextSortDir` | core/sort.js | 없음 | 뺄 후보 |
| `CellRange` | core/range.js | 없음 | 뺄 후보 |
| `summaryText` | features/pagebar.js | 없음 | 뺄 후보 |
| `parseNumber`, `parseDate`, `parseDateValue`, `formatDateAs` | editors/types.js | 없음 | 뺄 후보 |
| `sanitizeNumber`, `sanitizeDate`, `addCommas`, `selectOptions` | editors/types.js | 없음 | 뺄 후보 |
| `parseKeyPath` | util.js | 없음 | 뺄 후보 |
| `collectors` | features/view.js | 없음 | 뺄 후보 (내장 합계 계산기. 사용자 등록용인 `userCollectors`와 이름이 헷갈린다) |
| `resolveMessages` | core/locales.js | 없음 | 뺄 후보 |
| `toXlsxCell`, `htmlToText` | features/excel.js | 없음 | 뺄 후보 |

`parseTSV`, `buildTSV`는 이름만 적혀 있고 인자와 돌려주는 값은 설명이 없다. 남길 거라면 1.0 전에 설명을 넣는다.

## 2. 전역 이름 (src/global.js, `<script>` 빌드)

| 이름 | 실제 값 | README | 표시 |
|---|---|---|---|
| `window.PyoGrid` | `PyoGrid` 클래스 | 있음 | |
| `PyoGrid.version` | `version` | 있음 | |
| `PyoGrid.escapeHtml` | `escapeHtml` | 있음 | |
| `PyoGrid.sortRows` | `sortRows` | 있음 | |
| `PyoGrid.formatNumber` | `formatNumber` | 있음 | |
| `PyoGrid.editors` | `editorTypes` | 있음 | |
| `PyoGrid.collectors` | `userCollectors` | 있음 | |
| `PyoGrid.locales` | `locales` | 있음 | |
| `PyoGrid.util.getValue`, `.setValue`, `.toNumber` | util.js | 있음 | |
| `PyoGrid.util.parseKeyPath` | util.js | 없음 | 뺄 후보 |

## 3. PyoGrid 정적 속성 (src/grid.js 끝)

ES 모듈과 `<script>` 빌드 모두에서 보인다.

| 이름 | README | 표시 |
|---|---|---|
| `PyoGrid.formatters` | 있음 (formatter 등록) | |
| `PyoGrid.parseWidth` | 없음 | 뺄 후보 |

## 4. 인스턴스 메서드 (PyoGrid.prototype)

`_`로 시작하지 않는 것은 92개다 (메서드 88개, getter 4개). README의 Methods 절에 87개가 있고, 아래 5개가 없다. (0.9.0 뒤 `getChanges`, `cleanRow`, `setFilterCondition`, `getFilterConditions`, `moveColumn`, `getColumnOrder`, `setColumnOrder`를 더했다)

| 이름 | 하는 일 | 표시 |
|---|---|---|
| `isFilterable(leaf)` | 잎 컬럼에 헤더 필터 단추를 그릴지 | 정할 것 |
| `isSortable(leaf)` | 잎 컬럼을 헤더 클릭으로 정렬할 수 있는지 | 정할 것 |
| `isNumericColumn(def)` | 선택 합계에서 숫자 컬럼으로 볼지 | 정할 것 |
| `emit(name, detail)` | 이벤트 핸들러를 부른다 | 정할 것 |
| `emitCancelable(name, detail)` | 핸들러 중 하나가 false면 false | 정할 것 |

문서에 있는 87개 (README 절 순서):

| README 절 | 메서드 |
|---|---|
| Data | `setData`, `getRows`, `getViewRows`, `getAllRows`, `getRow`, `addRow`, `removeRows`, `deleteRows`, `getDeletedRows`, `getAddedRows`, `getModifiedRows`, `getChanges`, `cleanRow`, `clearModified`, `clearDeleted`, `acceptChanges`, `replaceRow`, `setValue`, `setValues` |
| Row selection | `selectRow`, `selectRowRange`, `selectAll`, `clearSelection`, `getSelectedRows`, `getSelectedIndexes`, `isRowSelected`, `isRowSelectable` |
| Cell range | `setRange`, `clearRange`, `getRange`, `getActiveCell`, `getRangeCells`, `getSelectionSummary`, `getRangeText` |
| Sorting, filtering, tree | `setSort`, `getSort`, `toggleSort`, `setFilter`, `setFilterCondition`, `getFilterConditions`, `clearFilters`, `getFilters`, `openFilter`, `isFilterActive`, `toggleNode`, `expandAll`, `collapseAll`, `getTreeInfo` |
| Editing, clipboard, undo | `startEdit`, `commitEdit`, `cancelEdit`, `focus`, `copy`, `paste`, `cut`, `undo`, `redo`, `clearHistory` |
| Columns and layout | `setColumns`, `getColumns`, `addColumn`, `removeColumn`, `updateColumn`, `setColumnWidth`, `getColumnWidths`, `moveColumn`, `getColumnOrder`, `setColumnOrder`, `layout`, `refresh`, `refreshRow`, `scrollToRow`, `scrollToCell`, `setHeight`, `setPage`, `cellContext`, `cellText` |
| Export, persistence, misc | `exportExcel`, `getExportData`, `resetState`, `on`, `off`, `destroy` |
| 읽기 전용 속성 (getter) | `rowCount`, `isEditing`, `canUndo`, `canRedo` |

문서에 없는 인자도 있다. `selectRow(index, selected, opts)`의 `opts.source`, `setSort(sort, opts)`의 `opts`, `openFilter(leafIndex, _anchor)`의 두 번째 인자다. 1.0 전에 문서에 넣거나 내부용으로 정한다.

## 5. 인스턴스 속성

생성자 등에서 `this.이름 = ...`으로 만드는 속성 중 `_`로 시작하지 않는 것이다. getter 4개(4절)를 빼면 README에 하나도 없다.

| 이름 | 내용 | 표시 |
|---|---|---|
| `id` | 그리드마다 붙는 `"pyo1"` 같은 이름 (`data-pyo` 속성 값) | 정할 것 |
| `target` | 생성자에 준 요소 | 정할 것 |
| `options` | DEFAULTS와 합친 옵션 객체 | 정할 것 |
| `messages` | locale과 messages를 합친 화면 문구 | 정할 것 |
| `source`, `rows`, `dataRows`, `deleted` | 원래 순서 행, 화면 행, 필터·정렬을 거친 데이터 행, 지운 행 | 정할 것 (같은 내용은 `getAllRows`·`getViewRows`·`getRows`·`getDeletedRows`로 읽는다) |
| `filters`, `sort`, `page`, `range` | 값 목록 필터(Map), 정렬, 페이지 정보, 셀 범위(CellRange) | 정할 것 (같은 내용은 `getFilters`·`getSort`·`getRange`로 읽는다. 조건 필터는 `_filterConds`이고 `getFilterConditions`로 읽는다) |
| `leaves`, `headerCells`, `headerDepth` | 컬럼 모델 | 정할 것 |
| `widths`, `leafX`, `aside`, `frozenCount`, `fzWidth`, `scWidth`, `asideWidth`, `totalWidth` | 배치 계산 결과 | 정할 것 |
| `history`, `editing` | 실행 취소 기록, 편집·키보드 처리 객체 | 정할 것 |
| `el` | 그리드 DOM 요소 묶음 (`root`, `scroll`, `body` 등) | 정할 것 (DOM 구조는 약속하지 않는다) |

데모(demo/)는 이 속성들을 쓰지 않는다. 테스트(test/)는 `grid.el`, `grid.rows`, `grid.editing` 같은 것을 읽는다.

## 6. 옵션 (DEFAULTS, src/grid.js)

키 53개가 모두 README의 Grid options 절에 있다. (0.9.0 뒤 `filterConditions`, `columnReorder`를 더했다)

`columns`, `frozenColumns`, `rowHeight`, `headerRowHeight`, `lineNumber`, `lineNumberWidth`, `rowSelector`, `rowSelectorWidth`, `headerSelector`, `multipleSelect`, `selectedKey`, `disableSelectionKey`, `sortable`, `multiSort`, `sortCompare`, `remoteSort`, `cellSelect`, `editable`, `modifiedKey`, `undo`, `undoLimit`, `clipboard`, `filter`, `filterConditions`, `footSum`, `grouping`, `tree`, `mergeCells`, `deletedKey`, `addedKey`, `markAddedModified`, `stateKey`, `sheetName`, `pageBar`, `pageHeight`, `statusDisplay`, `pageNavigationCount`, `pageIcons`, `statusFormat`, `selectionSummary`, `defaultColumnWidth`, `minColumnWidth`, `resizable`, `columnReorder`, `emptyText`, `locale`, `messages`, `overscanRows`, `overscanColumns`, `headerAlign`, `align`, `rowClass`, `height`

컬럼 옵션, 편집기 정의, 합계 칸, 트리 설정의 하위 키도 README의 각 절에 있다.

## 7. 이벤트

소스에서 `emit`·`emitCancelable`로 부르는 이름은 25개이고 모두 README의 Events 절에 있다.
`click`·`dblclick`은 `this.emit(type, ...)`으로 부르며, `type`은 `_bind`에서 넘기는 `"click"`·`"dblclick"`이다.

| 이벤트 | 부르는 곳 | 인자 | README |
|---|---|---|---|
| `click`, `dblclick` | grid.js `_onBodyClick` | `{row, item, rowIndex, dindex, colIndex, column, key, value, event, grid}`. 줄 번호·행 선택 칸은 `special`이 붙고 `colIndex`·`column`·`key`·`value`가 없다 | 있음 |
| `selectionchange` | grid.js `_afterSelection` | `{index, row, selected, source, changed, indexes}` | 있음 |
| `rangechange` | grid.js `_setRangeInternal` | `{range}` | 있음 |
| `sortchange` | grid.js `setSort`, `_afterColumnsChanged` | `{sort}` | 있음 |
| `filterchange` | grid.js `_afterFilter`, `_afterColumnsChanged` | `{filters, conditions, count}` | 있음 |
| `pagechange` | grid.js `_onPageNavClick` | `{page, current, info}` | 있음 |
| `change` | grid.js `_setRowValue` | `{row, item, rowIndex, dindex, key, value, oldValue, source, batch}` | 있음 |
| `batchchange` | grid.js `setValues` | `{source, changes}` | 있음 |
| `beforeedit` | editing.js (취소 가능) | 셀 정보(`cellContext`) + `mode` | 있음 |
| `editstart` | editing.js | 셀 정보 + `mode` | 있음 |
| `editend` | editing.js | 셀 정보 + `committed` | 있음 |
| `keydown` | editing.js (취소 가능) | `{event, editing}` | 있음 |
| `copy` | grid.js `_afterCopy` | `{range, text}` | 있음 |
| `paste` | grid.js `paste` | `{applied, skipped, rows}` | 있음 |
| `undo`, `redo` | grid.js `undo`, `redo` | `{source, count}` | 있음 |
| `rowsadd`, `rowsremove`, `rowsdelete` | grid/data.js `addRow`, `removeRows`, `deleteRows`, `_applyRowHistory`(실행 취소·다시 실행) | `{rows, source}` | 있음 |
| `treetoggle` | grid.js `toggleNode` | `{row, collapsed}` | 있음 |
| `columnresize` | grid.js `setColumnWidth` | `{index, column, width}` | 있음 |
| `columnmove` | grid/layout.js `_applyColumnOrder` (moveColumn, setColumnOrder, 헤더 끌기, Alt+Shift+←/→) | `{column, from, to, order}` | 있음 |
| `scroll` | grid.js `_bind` | `{top, left}` | 있음 |
| `datachange` | grid.js `setData` | `{rows}` | 있음 |

## 8. 그 밖에 사용자에게 보이는 것

| 항목 | 개수 | README | 비고 |
|---|---|---|---|
| `messages` 키 (`locales.en`) | 30 | 모두 있음 | `locales.ko`도 같은 키 |
| 행 표시 키 | 6 | 모두 있음 | `__selected__`, `__modified__`, `__added__`, `__deleted__`, `__disable_selection__`, 트리 `collapse`. 옵션으로 이름을 바꿀 수 있다 |
| 그룹 합계 행 속성 | 3 | 있음 | `__isGrouping`, `__groupingList`, `__groupingBy` |
| CSS 변수 | 24 | 16개 있음 | 아래 표 |
| `pyo-*` 클래스 | 많음 | 일부 있음 | Theming 절에 "Main classes"로 몇 개를 적었다. Stability 절에서 약속하지 않는다고 적었다 |
| localStorage 키 | 1 | 있음 | `"pyogrid:" + 경로 + ":" + stateKey`. 저장하는 값의 모양은 적지 않았다 |

README에 없는 CSS 변수 8개:

| 변수 | 쓰임 |
|---|---|
| `--pyo-row-h`, `--pyo-head-row-h`, `--pyo-head-h` | 그리드가 옵션(`rowHeight`, `headerRowHeight`)과 헤더 높이로 직접 넣는 값. 사용자가 바꾸는 값이 아니다 |
| `--pyo-head-hover` | 헤더에 마우스를 올렸을 때 배경 |
| `--pyo-aside-bg`, `--pyo-aside-text` | 줄 번호·행 선택 칸 배경과 글자 |
| `--pyo-scroll-track`, `--pyo-scroll-thumb`, `--pyo-scroll-thumb-hover` | 스크롤바 색 |

색 변수 6개(`--pyo-head-hover`부터)는 1.0 전에 README에 넣을지 정한다. 높이 변수 3개는 내부용으로 둔다.
