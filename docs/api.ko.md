# pyogrid API (한국어)

[README.md](../README.md)의 [Grid options](../README.md#grid-options), [Column options](../README.md#column-options), [Methods](../README.md#methods), [Events](../README.md#events) 절을 한국어로 옮긴 문서입니다.
기준은 영어 문서이고, 둘이 다르면 영어 문서가 맞습니다. 그 밖의 절(formatter, 편집기, 합계, 트리, 필터 등)은 [README.ko.md의 자세한 문서](../README.ko.md#자세한-문서)에서 영어 문서로 이어집니다.

각 제목 아래의 `<!-- en: ... -->` 줄은 짝이 되는 영어 절 이름입니다. `npm run docs:check`가 이 표시로 두 문서의 절, 표에 적힌 이름, 표 행 수, 코드 블록 수가 같은지 확인합니다.

## 그리드 옵션
<!-- en: Grid options -->

`new PyoGrid(target, options)`. `target`은 요소 또는 CSS 선택자입니다.

### 배치
<!-- en: Layout -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `columns` | `[]` | [컬럼 정의](#컬럼-옵션) |
| `frozenColumns` | `0` | 왼쪽에 고정할 잎 컬럼 수 |
| `rowHeight` | `26` | 본문 행 높이 (px) |
| `headerRowHeight` | `26` | 헤더 한 줄의 높이 (px) |
| `height` | `null` | 숫자면 그 높이(px). `null`이면 대상 요소를 채웁니다 |
| `lineNumber` | `false` | 왼쪽 줄 번호 컬럼 |
| `lineNumberWidth` | `30` | |
| `rowSelector` | `false` | 왼쪽 행 선택 체크박스 컬럼 |
| `rowSelectorWidth` | `26` | |
| `headerSelector` | `true` | 행 선택 컬럼 헤더의 "전체 선택" 체크박스 |
| `headerAlign` | `null` | 헤더 기본 정렬: `"left"`, `"center"`, `"right"` |
| `align` | `null` | 본문 기본 정렬 |
| `rowClass` | `null` | 행 class: 글자 또는 `function (row, rowIndex)` |
| `defaultColumnWidth` | `100` | `width`가 없는 컬럼의 너비 |
| `minColumnWidth` | `10` | 너비를 조절할 때의 최소 너비 |
| `resizable` | `true` | 헤더 경계를 끌어 컬럼 너비 조절 |
| `emptyText` | `undefined` | 행이 없을 때의 안내 문구. 주지 않으면 locale의 문구를 쓰고, `null`이면 아무것도 보이지 않습니다 |
| `locale` | `"en"` | 기본 문구의 언어: `"en"`, `"ko"`, 또는 `PyoGrid.locales`에 등록한 이름. [Localization](../README.md#localization) 참고 |
| `messages` | `null` | 기본 문구를 하나씩 바꿉니다. [Localization](../README.md#localization) 참고 |
| `overscanRows` / `overscanColumns` | `6` / `2` | 보이는 영역 밖에 더 그려 두는 행·열 수 |

### 선택과 정렬
<!-- en: Selection and sorting -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `multipleSelect` | `true` | false면 행을 하나만 선택할 수 있습니다 |
| `cellSelect` | `true` | 클릭과 끌기로 셀 범위 선택 |
| `selectionSummary` | `true` | 셀을 둘 이상 고르면 아래 바에 개수·합계·평균을 보여 줍니다. 숫자, 또는 숫자 컬럼(money formatter, number·money 편집기, 컬럼 `numeric: true`)의 숫자 글자만 더하므로 바코드·품번 같은 코드는 빠집니다 |
| `sortable` | `false` | 헤더를 눌러 정렬 (컬럼의 `sortable`이 우선) |
| `multiSort` | `false` | 누른 순서대로 여러 컬럼으로 정렬 |
| `sortCompare` | `"smart"` | `"smart"`: "1,200" 같은 숫자 글자는 숫자로 비교하고, 글자는 그리드 `locale`의 자연 정렬, 빈 값은 늘 맨 뒤. `"plain"`: 값을 그대로 비교 (타입이 다르면 글자로 바꿔 비교). 또는 함수 `(a, b) => number` |
| `remoteSort` | `false` | true면 행 순서는 그대로 두고 `sortchange`만 알립니다 (서버에서 정렬) |

### 편집과 클립보드
<!-- en: Editing and clipboard -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `editable` | `true` | false면 모든 편집기를 끕니다 |
| `clipboard` | `true` | Ctrl+C, X, V |
| `undo` | `true` | Ctrl+Z, Ctrl+Y |
| `undoLimit` | `50` | 실행 취소 기록을 남기는 단계 수 |
| `modifiedKey` | `"__modified__"` | |
| `deletedKey` | `"__deleted__"` | |
| `selectedKey` | `"__selected__"` | |
| `disableSelectionKey` | `"__disable_selection__"` | |
| `markAddedModified` | `true` | `addRow`로 넣은 행에 `modifiedKey`를 붙입니다 |
| `addedKey` | `"__added__"` | `addRow`로 넣은 행에 저장 전까지 붙는 속성 |

### 합계, 그룹, 트리, 필터, 병합
<!-- en: Totals, groups, tree, filters, merging -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `footSum` | `null` | 아래 합계 행. [Footer totals](../README.md#footer-totals-and-group-subtotals) 참고 |
| `grouping` | `null` | 그룹 합계 행: `{ by: [키...], columns: [칸...] }` |
| `tree` | `null` | [트리](../README.md#tree) 설정 |
| `filter` | `false` | 헤더 필터 단추 |
| `mergeCells` | `false` | `true`(모든 컬럼) 또는 키 배열. 위아래로 같은 값을 합칩니다 |

### 아래 바
<!-- en: Bottom bar -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `pageBar` | `true` | 아래 바 보이기 (선택 합계, 페이지 이동, 상태 문구) |
| `pageHeight` | `25` | |
| `statusDisplay` | `true` | 오른쪽 상태 문구 (예: `"1 - 15 of 300"`) |
| `statusFormat` | `null` | 상태 HTML을 돌려주는 함수 `(d) => string`. `d = {fromRowIndex, toRowIndex, dataRowCount, totalElements}` (모두 천 단위 구분 기호가 들어간 글자, 페이지 정보가 없으면 `totalElements`는 false) |
| `pageNavigationCount` | `5` | 페이지 단추 수 |
| `pageIcons` | `{first:null, prev:"«", next:"»", last:null}` | 이동 단추의 HTML. `null`이면 그 단추를 숨깁니다 |

### 기억과 내보내기
<!-- en: Persistence and export -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `stateKey` | `null` | 주면 컬럼 너비와 정렬을 브라우저에 기억합니다 |
| `sheetName` | `null` | 엑셀 내보내기의 시트 이름 |

## 컬럼 옵션
<!-- en: Column options -->

```js
{
  key: "QTY",            // 행 속성. "a.b", "a['공백 있는 키']", "list[0].name" 같은 경로도 됩니다
  label: "수량",          // 헤더 글자 (글자로 넣습니다. HTML은 html: true)
  width: 80,             // 숫자, "120", "50px", "*", "30%"
  align: "right",        // 본문 정렬
  headerAlign: "center", // 이 컬럼의 헤더 정렬
  formatter: "money",    // 이름 또는 함수
  html: false,           // true: label과 formatter 결과를 HTML로 넣기
  cellClass: function (c) { return c.value < 0 ? "minus" : ""; },
  headerClass: "my-head",
  editor: { type: "number" },
  sortable: true,        // false: 정렬 안 함, true: 그리드 sortable이 꺼져 있어도 정렬
  filter: false,         // false: 헤더 필터 없음, true: 이 컬럼만 필터
  multiLine: false,      // true: 셀 안에서 줄바꿈
  resizable: true,
  hidden: false,
  treeControl: false,    // 트리 펼침 단추를 그릴 컬럼
  columns: [...]         // 하위 컬럼이 있으면 헤더 묶음
}
```

| 속성 | 설명 |
|---|---|
| `key` | 읽고 쓰는 행 속성. 없으면 셀이 비어 있습니다 (formatter로만 그리는 셀에 씁니다) |
| `label` | 헤더 글자. 글자로 넣고, `html: true`면 HTML로 넣습니다 |
| `width` | 숫자·`"120"`·`"50px"`는 픽셀, `"*"`는 남은 너비를 나눠 갖고, `"30%"`는 그리드 너비 기준. 없으면 `defaultColumnWidth` |
| `align`, `headerAlign` | `"left"`, `"center"`, `"right"` |
| `formatter` | [Formatters](../README.md#formatters) 참고 |
| `html` | true면 `label`과 formatter 결과를 HTML로 넣습니다. 기본은 꺼져 있어서, 서버 글자를 돌려주는 formatter로 태그나 스크립트가 들어오지 않습니다 |
| `cellClass` | 셀 class: 글자 또는 함수 (인자는 formatter와 같음) |
| `headerClass` | 헤더 칸 class: 글자 또는 `function (column)` |
| `editor` | [Cell editors](../README.md#cell-editors) 참고 |
| `sortable`, `filter`, `resizable` | 위 참고 |
| `multiLine` | 셀 안 줄바꿈 허용 (편집 중 Alt+Enter) |
| `numeric` | 선택 합계에서 숫자 컬럼으로 봅니다. 기본으로 money formatter, number·money 편집기가 있는 컬럼은 숫자 컬럼입니다 |
| `hidden` | true면 그리지 않습니다 |
| `columns` | 헤더 묶음. 몇 단이든 됩니다. 고정 경계를 걸치는 묶음은 양쪽에 제목을 보여 줍니다 |

## 메서드
<!-- en: Methods -->

대부분의 메서드는 그리드를 돌려주므로 이어서 부를 수 있습니다 (`grid.setData(rows).scrollToRow(0)`).

### 데이터
<!-- en: Data -->

| 메서드 | 설명 |
|---|---|
| `setData(rows, page?)` | 데이터를 바꿉니다. 셀 범위, 실행 취소 기록, 지운 행 목록을 비우고 맨 위로 스크롤합니다. `page`는 [서버 페이징](../README.md#server-side-paging-and-sorting) 정보. 필터와 정렬은 그대로입니다 |
| `getRows()` | 필터·정렬을 거친 데이터 행 (원래 행 객체를 담은 새 배열) |
| `getViewRows()` | 화면의 행 (그룹 합계 행 포함) |
| `getAllRows()` | 모든 행 (필터로 숨은 행 포함) |
| `getRow(rowIndex)` | 화면 순번의 행 |
| `rowCount` | 화면의 행 수 (읽기 전용 속성) |
| `addRow(rows, at?, opts?)` | 행 하나 또는 행 배열을 넣습니다. `at`: `"last"`(기본), `"first"`, 또는 화면 순번(그 행 앞에 넣음). `opts.focus: true`면 넣은 행으로 이동합니다 |
| `removeRows(targets)` | 행을 목록에서 빼되 지운 행으로 기록하지 않습니다. 행 객체, 화면 순번, 또는 그 배열 |
| `deleteRows(targets)` | 행을 지웁니다. 목록에서 빠지고 `getDeletedRows()`에 남습니다. `addRow`로 넣고 저장하지 않은 행은 서버에 없으므로 남기지 않습니다. 트리면 자손도 지웁니다 |
| `getDeletedRows()` | 원래 있던 행 중 지운 행 (삭제로 보낼 행) |
| `getAddedRows()` | 마지막 저장 뒤 `addRow`로 넣은 행 (추가로 보낼 행). `getModifiedRows()`에도 들어 있습니다 |
| `getModifiedRows()` | 바뀌었거나 추가된 행. 모든 셀이 처음 값으로 돌아오면 (예: 실행 취소 뒤) 빠집니다 |
| `clearModified(rows?)` | 수정 표시와 추가 표시를 지웁니다 (`rows`가 없으면 모든 행). 저장한 뒤 부릅니다. 추가 표시가 빠진 행은 다시 헤더 필터를 따릅니다 |
| `clearDeleted()` | 지운 행 목록을 비웁니다 |
| `acceptChanges()` | 저장한 뒤: 수정·추가 표시, 지운 행 목록, 실행 취소 기록을 모두 비웁니다 |
| `replaceRow(rowIndex, row)` | 그 자리의 행을 다른 객체로 바꿉니다 |
| `setValue(rowIndex \| row, key, value)` | 셀 값을 바꿉니다. 화면 순번이나 행 객체를 줍니다. 행 객체면 필터로 숨은 행과 접힌 트리 자식도 바꿀 수 있습니다 (이때 `change`의 `rowIndex`는 -1). 바뀌면 true를 돌려주고, 행에 `__modified__`를 붙이고, `change`를 알립니다. `null`, `undefined`, `""`는 같은 값으로 봅니다 |
| `setValues([{rowIndex \| row, key, value}], {source?})` | 여러 셀을 바꾸고 한 번만 다시 그립니다. 항목마다 `rowIndex` 또는 `row`를 줍니다. 실제로 바뀐 셀 목록을 돌려줍니다 (화면에 없는 행은 `rowIndex: -1`) |

### 행 선택
<!-- en: Row selection -->

| 메서드 | 설명 |
|---|---|
| `selectRow(rowIndex, selected?)` | 선택하거나 풉니다. `selected`가 없으면 반대로 바꿉니다. 바뀐 뒤 상태를 돌려줍니다 |
| `selectRowRange(from, to, selected)` | `from`부터 `to`까지의 행을 같은 상태로 |
| `selectAll(selected = true, filter?)` | 모두 선택하거나 풉니다. `filter(row, i)`가 true인 행만 |
| `clearSelection()` | 모두 풀기 |
| `getSelectedRows()` | 선택된 행 (`getRows()` 순서) |
| `getSelectedIndexes()` | 선택된 행의 화면 순번 |
| `isRowSelected(row)` / `isRowSelectable(row)` | |

### 셀 범위
<!-- en: Cell range -->

| 메서드 | 설명 |
|---|---|
| `setRange(r0, c0, r1?, c1?)` | 범위를 고릅니다. 표 밖의 좌표는 안쪽으로 맞춥니다 |
| `clearRange()` | |
| `getRange()` | `{r0, c0, r1, c1, active: {r, c}}` 또는 null |
| `getActiveCell()` | `{rowIndex, colIndex, row, column, key, value}` 또는 null |
| `getRangeCells()` | 범위 안의 셀: `[{rowIndex, colIndex, row, key, value}]` |
| `getSelectionSummary()` | `{count, numCount, sum, avg}` |
| `getRangeText()` | 범위를 엑셀식 글자(탭과 줄바꿈)로. 원래 값을 씁니다 |

### 정렬, 필터, 트리
<!-- en: Sorting, filtering, tree -->

| 메서드 | 설명 |
|---|---|
| `setSort([{key, dir}])` | 정렬. `dir`은 `"asc"` 또는 `"desc"`. 빈 배열이면 원래 순서로 |
| `getSort()` | |
| `toggleSort(colIndex)` | 헤더를 누른 것과 같습니다: 없음 → desc → asc → 없음 |
| `setFilter(key, values \| null)` | 그 컬럼에서 보여 줄 값. `null`이면 조건을 지웁니다 |
| `clearFilters()` | |
| `getFilters()` | `{key: [값...]}` |
| `openFilter(colIndex)` | 필터 팝업 열기 |
| `isFilterActive()` | |
| `toggleNode(rowIndex \| row, collapsed?)` | 트리 노드 접기·펼치기 |
| `expandAll()` / `collapseAll()` | |
| `getTreeInfo(row)` | `{depth, children, parent}` |

### 편집, 클립보드, 실행 취소
<!-- en: Editing, clipboard, undo -->

| 메서드 | 설명 |
|---|---|
| `startEdit(rowIndex, colIndex, {mode?})` | 편집 시작. `mode`는 `"edit"`(지금 값, 기본) 또는 `"type"`(빈 값) |
| `commitEdit()` | 저장. 값이 잘못됐으면 false |
| `cancelEdit()` | |
| `isEditing` | 셀을 편집 중인지 (속성) |
| `focus()` | 그리드에 키보드 포커스 주기 |
| `copy()` | 범위를 클립보드에 복사 (Promise를 돌려주고 클립보드 권한이 필요합니다. Ctrl+C는 필요 없음) |
| `paste(text)` | 범위 왼쪽 위부터 글자를 붙여넣습니다. `{applied, skipped, rows}`를 돌려줍니다 |
| `cut()` | 범위를 글자로 돌려주고 비웁니다 |
| `undo()` / `redo()` | 되돌릴(다시 할) 것이 없으면 false |
| `canUndo` / `canRedo` | (속성) |
| `clearHistory()` | |

### 컬럼과 배치
<!-- en: Columns and layout -->

| 메서드 | 설명 |
|---|---|
| `setColumns(columns)` | 컬럼을 모두 바꿉니다 (사용자가 조절한 너비는 처음으로, `stateKey`에 저장한 너비는 되살림). 없어진 키, 또는 필터·정렬을 못 하게 된 키의 필터·정렬 조건은 지우고 `filterchange` / `sortchange`를 알립니다. `addColumn`, `removeColumn`, `updateColumn`도 같습니다 |
| `getColumns()` | |
| `addColumn(column, index?)` | 맨 위 단계에 컬럼을 넣습니다. `index`가 없으면 끝에 |
| `removeColumn(index?)` | 컬럼을 뺍니다. `index`가 없으면 마지막 컬럼 |
| `updateColumn(column, index)` | |
| `setColumnWidth(colIndex, px)` | |
| `getColumnWidths()` | 잎 컬럼의 너비 |
| `layout()` | 크기와 컬럼을 다시 계산하고 다시 그립니다 |
| `refresh()` | 보이는 행을 다시 그립니다 (행 객체를 직접 고친 뒤) |
| `refreshRow(rowIndex)` | 한 행 다시 그리기 |
| `scrollToRow(rowIndex, align?)` | `"nearest"`(기본) 또는 `"top"` |
| `scrollToCell(rowIndex, colIndex)` | |
| `setHeight(px \| css value \| null)` | |
| `setPage(page)` | 페이지 정보만 바꿉니다 |
| `cellContext(r, c)` / `cellText(r, c)` | 셀 정보 / 화면에 보이는 글자 |

### 내보내기, 기억, 기타
<!-- en: Export, persistence, misc -->

| 메서드 | 설명 |
|---|---|
| `exportExcel(fileName, {sheetName?, XLSX?})` | xlsx로 저장. SheetJS가 없으면 false |
| `getExportData()` | 내보낼 표 (`{rows, merges, widths, headerRows}`) |
| `resetState()` | 저장한 너비와 정렬을 잊습니다 |
| `on(name, fn)` / `off(name, fn?)` | 이벤트 |
| `destroy()` | 그리드와 리스너를 없앱니다 |

## 이벤트
<!-- en: Events -->

```js
grid.on("change", function (e) { ... });   // this는 그리드
grid.off("change", handler);               // handler를 빼면 그 이벤트의 핸들러를 모두 뗍니다
```

| 이벤트 | 언제 | 인자 |
|---|---|---|
| `click` / `dblclick` | 셀을 눌렀을 때 | `{row, item, rowIndex, dindex, colIndex, column, key, value, event, grid}`. 줄 번호·행 선택 컬럼이면 `special`이 있고 `colIndex`가 없습니다 |
| `selectionchange` | 행 선택이 바뀔 때 | `{index, row, selected, source, changed: [행], indexes: [순번]}`. `source`: `"click"`, `"range"`, `"all"`, `"api"` |
| `rangechange` | 셀 범위가 바뀔 때 | `{range}` |
| `sortchange` | 정렬이 바뀔 때 | `{sort}` |
| `filterchange` | 필터가 바뀔 때 | `{filters, count}` |
| `pagechange` | 페이지 단추를 눌렀을 때 | `{page, current, info}` (`page`는 0부터) |
| `change` | 셀 값이 바뀔 때 | `{row, item, rowIndex, dindex, key, value, oldValue, source, batch}`. 행이 화면에 없으면 (필터로 숨었거나 접힌 트리 자식) `rowIndex`는 -1. `source`: `"edit"`, `"clear"`, `"paste"`, `"cut"`, `"undo"`, `"redo"`, `"api"` |
| `batchchange` | 여러 셀이 한 번에 바뀔 때 (Delete, 붙여넣기 등) | `{source, changes: [{rowIndex, row, key, value, oldValue}]}` |
| `beforeedit` | 편집을 시작하기 전 | 셀 정보 + `mode`. **false를 돌려주면 편집하지 않습니다** |
| `editstart` / `editend` | 편집 시작 / 끝 | 셀 정보 + `mode` / `committed` |
| `keydown` | 그리드에서 키를 눌렀을 때 | `{event, editing}`. **false를 돌려주면 그리드가 그 키를 처리하지 않습니다** |
| `copy` / `paste` | 복사 / 붙여넣기 | `{range, text}` / `{applied, skipped, rows}` |
| `undo` / `redo` | | `{source, count}` |
| `rowsadd` / `rowsremove` / `rowsdelete` | 행을 넣었을 때 / 뺐을 때 / 지웠을 때 | `{rows}` |
| `treetoggle` | 트리 노드를 접거나 펼쳤을 때 | `{row, collapsed}` |
| `columnresize` | 컬럼 너비를 바꿨을 때 | `{index, column, width}` |
| `scroll` | 스크롤 | `{top, left}` |
| `datachange` | `setData` | `{rows}` |

**한꺼번에 바꿀 때의 `change`:** Delete, 붙여넣기, 실행 취소는 셀마다 `batch: true`인 `change`를 알리고, 끝에 `batchchange`를 한 번 알립니다. 셀마다 무거운 일을 한다면 batch인 `change`는 건너뛰고 `batchchange`에서 한 번만 처리하세요.

```js
grid.on("change", function (e) {
  if (e.key !== "QTY") return;
  recalc(e.row);
  if (!e.batch) grid.refreshRow(e.rowIndex);
});
grid.on("batchchange", function () { grid.refresh(); });
```

**핸들러의 오류:** 핸들러가 예외를 던지면 오류를 알리고(`reportError`, 콘솔에 보이고 `window.onerror`로도 갑니다) 그리드는 계속 동작합니다. 다른 핸들러도 불리고, 다시 그리기, 실행 취소 기록, `batchchange`도 빠지지 않습니다. `beforeedit`나 `keydown`에서 예외를 던진 것은 false를 돌려준 것으로 보지 않습니다.
