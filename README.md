# pyogrid

외부 라이브러리 없이 동작하는 순수 JavaScript 데이터 그리드입니다.
수만 행을 가상 스크롤로 보여 주고, 셀 편집(한글 바로 입력), Excel 붙여넣기, 실행 취소, 헤더 값 필터, 합계 행, 그룹 합계, 트리, xlsx 내보내기를 지원합니다.

- 의존성 없음. xlsx 내보내기만 [SheetJS](https://sheetjs.com/)가 있을 때 씁니다.
- `<script>` 태그 하나(전역 `PyoGrid`)로 쓰거나 ES 모듈로 가져옵니다.

> 버전 0.7.0 · 지원 브라우저: Chrome, Edge 최신 (테스트는 이 두 브라우저에서만 합니다)

## 목차

- [빠른 시작](#빠른-시작)
- [설치와 빌드](#설치와-빌드)
- [기본 개념](#기본-개념)
- [그리드 옵션](#그리드-옵션)
- [컬럼 옵션](#컬럼-옵션)
- [formatter와 셀 서식](#formatter와-셀-서식)
- [셀 편집기](#셀-편집기)
- [키보드](#키보드)
- [메서드](#메서드)
- [이벤트](#이벤트)
- [합계 행·그룹 합계](#합계-행그룹-합계)
- [트리](#트리)
- [헤더 값 필터](#헤더-값-필터)
- [셀 병합](#셀-병합)
- [복사·붙여넣기·실행 취소](#복사붙여넣기실행-취소)
- [서버 페이징·서버 정렬](#서버-페이징서버-정렬)
- [엑셀 내보내기](#엑셀-내보내기)
- [컬럼 너비·정렬 기억](#컬럼-너비정렬-기억)
- [수정·추가·삭제 행 모으기](#수정추가삭제-행-모으기)
- [전역 확장](#전역-확장)
- [테마 (CSS)](#테마-css)
- [개발](#개발)

---

## 빠른 시작

```html
<link rel="stylesheet" href="dist/pyogrid.min.css">
<script src="dist/pyogrid.min.js"></script>

<div id="grid" style="height: 400px"></div>

<script>
  var grid = new PyoGrid(document.getElementById("grid"), {
    rowSelector: true,         // 왼쪽 행 선택 체크박스
    frozenColumns: 2,          // 왼쪽 2개 컬럼 틀 고정
    sortable: true,            // 헤더 클릭 정렬
    headerAlign: "center",
    columns: [
      { key: "SKU", label: "상품 코드", width: 120, align: "center" },
      { key: "NAME", label: "상품명", width: "*" },
      { label: "이번 주", columns: [                       // 다단 헤더
        { key: "QTY", label: "수량", width: 80, align: "right", formatter: "money",
          editor: { type: "number" } },
        { key: "AMT", label: "금액", width: 100, align: "right", formatter: "money" }
      ] }
    ],
    footSum: [[
      { label: "합계", colspan: 2, align: "center" },
      { key: "QTY", collector: "sum", formatter: "money", align: "right" },
      { key: "AMT", collector: "sum", formatter: "money", align: "right" }
    ]]
  });

  grid.setData([
    { SKU: "SKU-A1001", NAME: "볼펜 0.5mm", QTY: 12000, AMT: 3500000 },
    { SKU: "SKU-A1002", NAME: "스프링 노트", QTY: 8000, AMT: 1200000 }
  ]);

  grid.on("change", function (e) {
    console.log(e.rowIndex, e.key, e.oldValue, "→", e.value);
  });
</script>
```

ES 모듈로 쓸 때:

```js
import { PyoGrid } from "pyogrid";             // npm으로 설치했을 때
// import { PyoGrid } from "./dist/pyogrid.esm.js";  // 직접 빌드한 파일
const grid = new PyoGrid("#grid", { columns: [...] });
```

대상 요소에는 높이를 주세요. 그리드는 대상 요소의 크기를 채우고, 크기가 바뀌면(창 크기, 부모 레이아웃) 스스로 다시 배치합니다.

## 설치와 빌드

npm으로 설치합니다.

```bash
npm install pyogrid
```

```js
import { PyoGrid } from "pyogrid";
import "pyogrid/css";            // 번들러(Vite, webpack 등)에서 CSS 불러오기
```

빌드 도구 없이 CDN으로 쓸 수도 있습니다.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pyogrid/dist/pyogrid.min.css">
<script src="https://cdn.jsdelivr.net/npm/pyogrid/dist/pyogrid.min.js"></script>
```

저장소에서 직접 빌드하려면 Node.js 22 이상이 필요합니다. `dist/`는 저장소에 넣지 않으므로 처음 한 번 빌드합니다.

```bash
npm install
npm run build
```

| 파일 | 용도 |
|---|---|
| `dist/pyogrid.js` / `pyogrid.min.js` | `<script>` 태그용 (전역 `PyoGrid`) |
| `dist/pyogrid.esm.js` | ES 모듈 |
| `dist/pyogrid.css` / `pyogrid.min.css` | 테마 |
| `dist/types/` | TypeScript 선언 (`.d.ts`) |

엑셀 내보내기를 쓰려면 SheetJS를 그리드보다 먼저 불러옵니다.

```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
```

## 기본 개념

**행 객체는 복사하지 않습니다.** `setData(rows)`에 넘긴 객체를 그대로 쓰고, 편집하면 그 객체의 값이 바뀝니다. 그리드가 붙이는 표시는 행 객체의 속성으로 남습니다.

| 속성 (옵션으로 이름 변경) | 뜻 |
|---|---|
| `__selected__` (`selectedKey`) | 행 선택 상태. 데이터에 넣어 두면 선택된 채로 보입니다 |
| `__modified__` (`modifiedKey`) | 값이 바뀌었거나 `addRow`로 넣은 행 |
| `__deleted__` (`deletedKey`) | `deleteRows`로 지운 행 |
| `__disable_selection__` (`disableSelectionKey`) | true면 선택할 수 없는 행 |
| `collapse` (`tree.collapseKey`) | 트리에서 접힌 노드 |

**행 순번(rowIndex)은 화면 순번입니다.** 정렬·필터·그룹·트리를 거쳐 화면에 그린 순서이고, 그룹 합계 행도 한 줄로 셉니다. 정렬하면 순번이 바뀌므로 오래 들고 있을 값이면 행 객체를 쓰세요.

**컬럼 순번(colIndex)은 잎 컬럼 순번입니다.** 다단 헤더의 묶음은 세지 않고, 줄 번호·행 선택 칸도 세지 않습니다.

**행 목록 세 가지**

| 메서드 | 내용 |
|---|---|
| `getRows()` | 필터·정렬을 거친 데이터 행. 그룹 합계 행은 빠지고, 트리는 접힌 자식도 들어갑니다 |
| `getViewRows()` | 화면에 그리는 행 그대로 (그룹 합계 행 포함, 트리는 펼친 행만) |
| `getAllRows()` | setData·addRow로 받은 전체 (필터로 숨은 행 포함, 지운 행 제외) |

## 그리드 옵션

`new PyoGrid(target, options)`의 `options`입니다. `target`은 요소 또는 CSS 선택자입니다.

### 화면

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `columns` | `[]` | [컬럼 정의](#컬럼-옵션) |
| `frozenColumns` | `0` | 왼쪽부터 고정할 잎 컬럼 수 |
| `rowHeight` | `26` | 본문 행 높이(px) |
| `headerRowHeight` | `26` | 헤더 한 줄 높이(px) |
| `height` | `null` | 숫자면 그 높이(px), null이면 대상 요소 높이를 채움 |
| `lineNumber` | `false` | 왼쪽 줄 번호 칸 |
| `lineNumberWidth` | `30` | |
| `rowSelector` | `false` | 왼쪽 행 선택 체크박스 칸 |
| `rowSelectorWidth` | `26` | |
| `headerSelector` | `true` | 행 선택 칸 헤더의 전체 선택 체크박스 |
| `headerAlign` | `null` | 헤더 기본 정렬 `"left"`·`"center"`·`"right"` |
| `align` | `null` | 본문 기본 정렬 |
| `rowClass` | `null` | 행 class. 문자열 또는 `function (row, rowIndex)` |
| `defaultColumnWidth` | `100` | width가 없는 컬럼 너비 |
| `minColumnWidth` | `10` | 너비 조절 최솟값 |
| `resizable` | `true` | 헤더 경계를 끌어 너비 조절 |
| `emptyText` | `"조회된 데이터가 없습니다."` | 데이터가 없을 때 문구. null이면 표시 안 함 |
| `overscanRows` / `overscanColumns` | `6` / `2` | 보이는 범위 밖으로 더 그려 둘 행·열 수 |

### 선택·정렬

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `multipleSelect` | `true` | false면 행을 하나만 선택 |
| `cellSelect` | `true` | 셀 클릭·끌기로 범위 선택 |
| `selectionSummary` | `true` | 셀을 둘 이상 고르면 아래 바에 개수·합계·평균. 값이 number이거나 숫자 컬럼(money formatter, number·money 편집기, 컬럼 `numeric: true`)의 숫자 글자만 더한다. 바코드·품번 같은 코드 글자는 세지 않는다 |
| `sortable` | `false` | 헤더 클릭 정렬 (컬럼 `sortable`이 우선) |
| `multiSort` | `false` | 여러 컬럼 정렬 (클릭한 순서대로 우선) |
| `sortCompare` | `"smart"` | `"smart"`: "1,200" 같은 숫자 문자열은 숫자로, 한글 자연 정렬, 빈 값은 항상 맨 뒤. `"plain"`: 값을 그대로 비교 (타입이 다르면 문자열로 바꿔 비교). 함수: `(a, b) => number` |
| `remoteSort` | `false` | true면 순서를 바꾸지 않고 `sortchange`만 알림 (서버 정렬) |

### 편집·클립보드

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `editable` | `true` | false면 모든 편집기를 끔 |
| `clipboard` | `true` | Ctrl+C·X·V |
| `undo` | `true` | Ctrl+Z·Ctrl+Y |
| `undoLimit` | `50` | 실행 취소 기록 수 |
| `modifiedKey` | `"__modified__"` | |
| `deletedKey` | `"__deleted__"` | |
| `selectedKey` | `"__selected__"` | |
| `disableSelectionKey` | `"__disable_selection__"` | |
| `markAddedModified` | `true` | `addRow`로 넣은 행에 `modifiedKey`를 붙임 |

### 합계·그룹·트리·필터·병합

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `footSum` | `null` | 아래 합계 행. [합계 행](#합계-행그룹-합계) |
| `grouping` | `null` | `{ by: [키...], columns: [칸...] }` 그룹 합계 행 |
| `tree` | `null` | [트리](#트리) 설정 객체 |
| `filter` | `false` | 헤더 값 필터 단추 |
| `mergeCells` | `false` | true(모든 컬럼) 또는 키 배열. 위아래 같은 값 합치기 |

### 페이지 바 (아래쪽)

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `pageBar` | `true` | 아래 바 표시 (선택 합계·페이지 이동·상태 문구) |
| `pageHeight` | `25` | |
| `statusDisplay` | `true` | 오른쪽 `"1 - 15 of 300"` 문구 |
| `statusFormat` | `null` | 상태 문구 HTML을 만드는 함수 `(d) => string`. `d = {fromRowIndex, toRowIndex, dataRowCount, totalElements}` (모두 쉼표 넣은 글자, totalElements는 페이지 정보가 없으면 false) |
| `pageNavigationCount` | `5` | 페이지 번호 버튼 수 |
| `pageIcons` | `{first:null, prev:"«", next:"»", last:null}` | 이동 버튼 HTML. null이면 그 버튼 없음 |

### 기억·내보내기

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `stateKey` | `null` | 주면 컬럼 너비·정렬을 브라우저에 기억 |
| `sheetName` | `null` | 엑셀 시트 이름 |

## 컬럼 옵션

```js
{
  key: "QTY",            // 행 속성. "a.b", "a['한글 키']", "list[0].name" 같은 경로도 됩니다
  label: "수량",          // 헤더 글자 (HTML로 들어갑니다)
  width: 80,             // 숫자, "120", "50px", "*", "30%"
  align: "right",        // 본문 정렬
  headerAlign: "center", // 이 컬럼 헤더 정렬
  formatter: "money",    // 이름 또는 함수
  cellClass: function (c) { return c.value < 0 ? "minus" : ""; },
  headerClass: "my-head",
  editor: { type: "number" },
  sortable: true,        // false면 정렬 안 함, true면 그리드 sortable과 관계없이 정렬
  filter: false,         // false면 헤더 필터 없음, true면 이 컬럼만 필터
  multiLine: false,      // true면 줄바꿈해서 보여 줌
  resizable: true,
  hidden: false,
  treeControl: false,    // 트리 펼침 단추를 그릴 컬럼
  columns: [...]         // 있으면 묶음 헤더 (하위 컬럼)
}
```

| 속성 | 설명 |
|---|---|
| `key` | 값을 읽고 쓸 행 속성. 없으면 빈 칸 (formatter로만 그리는 칸) |
| `label` | 헤더 글자. HTML로 넣으므로 사용자 입력을 그대로 넣지 마세요 |
| `width` | 숫자·`"120"`·`"50px"`는 픽셀, `"*"`는 남은 너비를 나눔, `"30%"`는 그리드 너비 기준. 없으면 `defaultColumnWidth` |
| `align`, `headerAlign` | `"left"`·`"center"`·`"right"` |
| `formatter` | [formatter](#formatter와-셀-서식) |
| `cellClass` | 셀 class. 문자열 또는 함수 (formatter와 같은 인자) |
| `headerClass` | 헤더 칸 class. 문자열 또는 `function (column)` |
| `editor` | [셀 편집기](#셀-편집기) |
| `sortable`, `filter`, `resizable` | 위 설명 |
| `multiLine` | 셀 안 줄바꿈 허용 (편집할 때 Alt+Enter로 줄바꿈) |
| `numeric` | 선택 합계에서 숫자 컬럼으로 볼지. 없으면 money formatter·number/money 편집기 컬럼이 숫자 컬럼 |
| `hidden` | true면 그리지 않음 |
| `columns` | 묶음 헤더. 몇 단이든 됩니다. 틀 고정 경계를 걸치면 양쪽에 같은 제목이 나뉘어 보입니다 |

## formatter와 셀 서식

formatter가 돌려준 글자는 **HTML로** 셀에 들어갑니다. formatter가 없으면 값을 이스케이프해서 넣습니다. 사용자가 입력한 값을 formatter에서 쓸 때는 `PyoGrid.escapeHtml`로 감싸세요.

```js
{
  key: "STATUS",
  formatter: function (c) {
    // c와 this는 같습니다
    // c.value, c.row(= c.item), c.key, c.rowIndex(= c.dindex), c.column, c.grid
    var color = c.value === "완료" ? "green" : "gray";
    return '<span style="color:' + color + '">' + PyoGrid.escapeHtml(c.value) + "</span>";
  }
}
```

기본 formatter는 `"money"` 하나입니다. 숫자가 아닌 글자를 지우고 천 단위 쉼표를 넣으며, 소수는 둘째 자리까지 자릅니다. 직접 등록하려면 [전역 확장](#전역-확장)을 보세요.

## 셀 편집기

컬럼에 `editor`를 주면 편집할 수 있습니다.

```js
editor: {
  type: "text",                      // 아래 표
  config: { ... },                   // 종류별 설정
  disabled: function (c) {           // true면 그 셀은 편집 안 함 (값도 됩니다)
    return c.row.LOCKED === "Y";
  },
  attributes: { maxlength: 30 }      // 입력칸에 붙일 속성
}
```

| type | 저장되는 값 | config |
|---|---|---|
| `text` | 입력한 글자 | |
| `number` | 숫자 (빈 칸은 `""`) | `decimal` 소수 자리 수(0이면 정수만), `min`, `max` |
| `money` | 숫자 (빈 칸은 `""`). 입력하는 동안 쉼표가 붙음 | `decimal`, `min`, `max` |
| `date` | `"yyyy-MM-dd"` 글자. 숫자만 쳐도 하이픈이 들어가고, 셀 아래에 달력이 열림 | |
| `select` | 고른 항목 값. 목록에서 방향키·Enter·클릭, 글자(한글 포함)로 찾기 | `options` 배열, `columnKeys: { optionValue: "value", optionText: "text" }` |
| `checkbox` | `trueValue`/`falseValue` (없으면 `true`/`false`). 셀을 누르거나 Space로 바뀜 | `trueValue`, `falseValue` |

- 숫자·날짜 칸에서 잘못된 값으로 Enter를 누르면 빨간 테두리가 생기고 편집이 계속됩니다. 포커스가 그리드 밖으로 나가면 취소됩니다.
- `select` 컬럼에 formatter가 없으면 셀에 값 대신 항목 글자를 보여 줍니다.
- `checkbox`는 formatter보다 우선해서 체크박스로 그립니다. `disabled`인 셀은 값을 글자로 보여 줍니다.
- 편집기가 있는 셀을 더블클릭하면 편집이 시작되고, 이때 `dblclick` 이벤트는 나가지 않습니다.

```js
// select 예
{ key: "KIND", label: "구분", editor: { type: "select", config: {
    columnKeys: { optionValue: "CD", optionText: "NM" },
    options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }]
} } }
```

**한글 바로 입력:** 셀을 고르고 그냥 치면 그 자리에서 편집이 시작되고 첫 글자부터 들어갑니다. 한글 조합 중에 누른 Enter·Tab·방향키도 조합이 끝난 뒤 처리하므로 Enter 한 번으로 저장됩니다.

## 키보드

그리드 셀을 누르면 키보드 포커스가 그리드로 옵니다 (`grid.focus()`로도 줄 수 있음).

**편집하지 않을 때**

| 키 | 동작 |
|---|---|
| 방향키 | 이동 |
| Shift+방향키 | 범위 넓히기 |
| Ctrl+방향키 | 끝까지 이동 |
| Home / End | 줄 처음 / 끝 |
| Ctrl+Home / Ctrl+End | 첫 셀 / 마지막 셀 |
| PageUp / PageDown | 한 화면씩 |
| Tab / Shift+Tab | 오른쪽 / 왼쪽 (줄 끝이면 다음 줄) |
| 글자 키 | 빈 값으로 편집 시작 (그 글자가 들어감) |
| F2, Enter, Space | 지금 값으로 편집 시작 (체크박스는 바꾸기, 목록은 열기). 편집기가 없으면 Enter는 아래로 |
| Backspace | 비우고 편집 시작 |
| Delete | 선택 범위에서 편집할 수 있는 셀 비우기 (체크박스 제외) |
| Ctrl+A | 전체 셀 선택 |
| Ctrl+C / Ctrl+X / Ctrl+V | 복사 / 잘라내기 / 붙여넣기 |
| Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | 실행 취소 / 다시 실행 |

**편집 중**

| 키 | 동작 |
|---|---|
| Enter / Shift+Enter | 저장하고 아래 / 위 |
| Tab / Shift+Tab | 저장하고 오른쪽 / 왼쪽 |
| ↑ / ↓ | 저장하고 위 / 아래 (목록은 항목 이동) |
| ← / → | 글자 안에서 커서 이동 |
| Esc | 취소 |
| Alt+Enter | 줄바꿈 (`multiLine` 컬럼만) |

다른 셀을 누르거나 그리드 밖을 누르면 편집 중인 값이 저장됩니다.

## 메서드

대부분 그리드 자신을 돌려주므로 이어 쓸 수 있습니다 (`grid.setData(rows).scrollToRow(0)`).

### 데이터

| 메서드 | 설명 |
|---|---|
| `setData(rows, page?)` | 데이터를 바꾼다. 선택 범위·실행 취소 기록·지운 행 기록을 비우고 맨 위로 스크롤. `page`는 [서버 페이징](#서버-페이징서버-정렬) 정보. 필터 조건과 정렬은 유지 |
| `getRows()` | 필터·정렬 뒤 데이터 행 (배열은 복사본, 행은 원본 객체) |
| `getViewRows()` | 화면 행 (그룹 합계 행 포함) |
| `getAllRows()` | 전체 행 (필터로 숨은 행 포함) |
| `getRow(rowIndex)` | 화면 순번의 행 |
| `rowCount` | 화면 행 수 (읽기 전용 속성) |
| `addRow(rows, at?, opts?)` | 행(또는 배열)을 넣는다. `at`: `"last"`(기본)·`"first"`·화면 순번(그 행 앞). `opts.focus: true`면 넣은 행으로 이동 |
| `removeRows(targets)` | 목록에서 뺀다 (지운 행 기록에 남지 않음). 행 객체·화면 순번·그 배열 |
| `deleteRows(targets)` | 지운다. 목록에서 빠지고 `getDeletedRows()`에 남는다. 트리는 자손도 |
| `getDeletedRows()` | 지운 행 |
| `getModifiedRows()` | 값이 바뀌었거나 넣은 행. 실행 취소 등으로 모든 셀이 처음 값으로 돌아오면 빠진다 |
| `clearModified(rows?)` | 수정 표시를 지운다 (rows가 없으면 전부). 저장한 뒤 부른다 |
| `clearDeleted()` | 지운 행 기록을 비운다 |
| `acceptChanges()` | 저장한 뒤: 수정 표시·지운 행 기록·실행 취소 기록을 모두 비운다 |
| `replaceRow(rowIndex, row)` | 그 자리의 행을 다른 객체로 바꾼다 |
| `setValue(rowIndex, key, value)` | 셀 값을 바꾼다. 바뀌면 true, `__modified__`를 붙이고 `change`를 알린다. null·undefined·""는 같은 값으로 본다 |
| `setValues([{rowIndex, key, value}], {source?})` | 여러 셀을 한 번에 바꾸고 한 번만 다시 그린다. 실제로 바뀐 목록을 돌려준다 |

### 행 선택

| 메서드 | 설명 |
|---|---|
| `selectRow(rowIndex, selected?)` | 선택·해제. selected를 빼면 반전. 바뀐 뒤 상태를 돌려준다 |
| `selectRowRange(from, to, selected)` | from~to를 같은 상태로 |
| `selectAll(selected = true, filter?)` | 전체 선택·해제. `filter(row, i)`가 true인 행만 |
| `clearSelection()` | 전체 해제 |
| `getSelectedRows()` | 선택된 행 (getRows 순서) |
| `getSelectedIndexes()` | 선택된 행의 화면 순번 |
| `isRowSelected(row)` / `isRowSelectable(row)` | |

### 셀 범위

| 메서드 | 설명 |
|---|---|
| `setRange(r0, c0, r1?, c1?)` | 범위 선택. 표 밖 좌표는 안으로 맞춤 |
| `clearRange()` | |
| `getRange()` | `{r0, c0, r1, c1, active: {r, c}}` 또는 null |
| `getActiveCell()` | `{rowIndex, colIndex, row, column, key, value}` 또는 null |
| `getRangeCells()` | 범위 안 셀 목록 `[{rowIndex, colIndex, row, key, value}]` |
| `getSelectionSummary()` | `{count, numCount, sum, avg}` |
| `getRangeText()` | 범위를 Excel 형식(탭·줄바꿈) 글자로. 원래 값 기준 |

### 정렬·필터·트리

| 메서드 | 설명 |
|---|---|
| `setSort([{key, dir}])` | 정렬. dir은 `"asc"`·`"desc"`. 빈 배열이면 원래 순서 |
| `getSort()` | |
| `toggleSort(colIndex)` | 헤더 클릭과 같음: 없음 → 내림 → 오름 → 없음 |
| `setFilter(key, values \| null)` | 그 컬럼에서 보여 줄 값 목록. null이면 조건 지움 |
| `clearFilters()` | |
| `getFilters()` | `{key: [값...]}` |
| `openFilter(colIndex)` | 필터 팝업 열기 |
| `isFilterActive()` | |
| `toggleNode(rowIndex \| row, collapsed?)` | 트리 접기·펼치기 |
| `expandAll()` / `collapseAll()` | |
| `getTreeInfo(row)` | `{depth, children, parent}` |

### 편집·클립보드·실행 취소

| 메서드 | 설명 |
|---|---|
| `startEdit(rowIndex, colIndex, {mode?})` | 편집 시작. mode `"edit"`(지금 값, 기본) 또는 `"type"`(빈 값) |
| `commitEdit()` | 저장. 잘못된 값이면 false |
| `cancelEdit()` | |
| `isEditing` | 편집 중인가 (속성) |
| `focus()` | 그리드에 키보드 포커스 |
| `copy()` | 범위를 클립보드로 (Promise, 클립보드 권한 필요. Ctrl+C는 권한 없이 됨) |
| `paste(text)` | 글자를 범위 왼쪽 위부터 붙여넣기. `{applied, skipped, rows}` |
| `cut()` | 범위 글자를 돌려주고 비운다 |
| `undo()` / `redo()` | 되돌릴 것이 없으면 false |
| `canUndo` / `canRedo` | (속성) |
| `clearHistory()` | |

### 컬럼·화면

| 메서드 | 설명 |
|---|---|
| `setColumns(columns)` | 컬럼을 통째로 바꾼다 (사용자가 조절한 너비는 초기화, `stateKey` 저장값은 되살림). 새 컬럼에 없거나 필터·정렬할 수 없게 된 키의 필터·정렬은 지우고 `filterchange`·`sortchange`를 알린다 (addColumn·removeColumn·updateColumn도 같음) |
| `getColumns()` | |
| `addColumn(column, index?)` | 맨 위 수준에 넣는다. index가 없으면 맨 끝 |
| `removeColumn(index?)` | index가 없으면 마지막 컬럼 |
| `updateColumn(column, index)` | |
| `setColumnWidth(colIndex, px)` | |
| `getColumnWidths()` | 잎 컬럼 너비 배열 |
| `layout()` | 크기·컬럼을 다시 계산하고 그린다 |
| `refresh()` | 보이는 행을 다시 그린다 (행 객체 값을 직접 바꾼 뒤) |
| `refreshRow(rowIndex)` | 한 행만 다시 그린다 |
| `scrollToRow(rowIndex, align?)` | `"nearest"`(기본)·`"top"` |
| `scrollToCell(rowIndex, colIndex)` | |
| `setHeight(px \| css 값 \| null)` | |
| `setPage(page)` | 페이지 정보만 바꾼다 |
| `cellContext(r, c)` / `cellText(r, c)` | 셀 정보 / 화면 글자 |

### 내보내기·기억·기타

| 메서드 | 설명 |
|---|---|
| `exportExcel(fileName, {sheetName?, XLSX?})` | xlsx 저장. SheetJS가 없으면 false |
| `getExportData()` | 내보낼 표 (`{rows, merges, widths, headerRows}`) |
| `resetState()` | 기억한 너비·정렬 지우기 |
| `on(name, fn)` / `off(name, fn?)` | 이벤트 |
| `destroy()` | 그리드를 지우고 이벤트를 푼다 |

## 이벤트

```js
grid.on("change", function (e) { ... });   // this는 grid
grid.off("change", handler);               // handler를 빼면 그 이벤트 전부
```

| 이벤트 | 언제 | 내용 |
|---|---|---|
| `click` / `dblclick` | 셀 클릭 | `{row, item, rowIndex, dindex, colIndex, column, key, value, event, grid}`. 줄 번호·행 선택 칸이면 `special`이 붙고 colIndex가 없음 |
| `selectionchange` | 행 선택이 바뀜 | `{index, row, selected, source, changed: [행], indexes: [순번]}`. source: `"click"`·`"range"`·`"all"`·`"api"` |
| `rangechange` | 셀 범위가 바뀜 | `{range}` |
| `sortchange` | 정렬이 바뀜 | `{sort}` |
| `filterchange` | 필터가 바뀜 | `{filters, count}` |
| `pagechange` | 페이지 버튼 클릭 | `{page, current, info}` (page는 0부터) |
| `change` | 셀 값이 바뀜 | `{row, item, rowIndex, dindex, key, value, oldValue, source, batch}`. source: `"edit"`·`"clear"`·`"paste"`·`"cut"`·`"undo"`·`"redo"`·`"api"` |
| `batchchange` | 여러 셀이 한 번에 바뀜 (Delete, 붙여넣기 등) | `{source, changes: [{rowIndex, row, key, value, oldValue}]}` |
| `beforeedit` | 편집 시작 전 | 셀 정보 + `mode`. **false를 돌려주면 시작하지 않음** |
| `editstart` / `editend` | 편집 시작 / 끝 | 셀 정보 + `mode` / `committed` |
| `keydown` | 그리드에서 키를 누름 | `{event, editing}`. **false를 돌려주면 그리드가 처리하지 않음** |
| `copy` / `paste` | 복사 / 붙여넣기 | `{range, text}` / `{applied, skipped, rows}` |
| `undo` / `redo` | | `{source, count}` |
| `rowsadd` / `rowsremove` / `rowsdelete` | 행 넣기 / 빼기 / 지우기 | `{rows}` |
| `treetoggle` | 트리 접기·펼치기 | `{row, collapsed}` |
| `columnresize` | 너비 조절 | `{index, column, width}` |
| `scroll` | 스크롤 | `{top, left}` |
| `datachange` | setData | `{rows}` |

**여러 셀 변경과 change:** Delete·붙여넣기·실행 취소는 셀마다 `change`(`batch: true`)를 보내고 끝에 `batchchange`를 한 번 보냅니다. 셀마다 무거운 계산을 하는 화면은 `batch`인 change를 건너뛰고 `batchchange`에서 한 번에 처리하세요.

```js
grid.on("change", function (e) {
  if (e.key !== "QTY") return;
  recalc(e.row);
  if (!e.batch) grid.refreshRow(e.rowIndex);
});
grid.on("batchchange", function () { grid.refresh(); });
```

## 합계 행·그룹 합계

**합계 행 (`footSum`)**은 본문 아래에 붙어 있고, 가로로는 컬럼과 같이 스크롤됩니다. 배열 하나가 한 줄입니다.

```js
footSum: [[
  { label: "합계", colspan: 3, align: "center" },          // key가 없으면 label
  { key: "QTY", collector: "sum", formatter: "money", align: "right" },
  { key: "AMT", collector: function () {                   // 직접 계산
      return this.list.reduce(function (s, r) { return s + (r.AMT || 0); }, 0);
    }, formatter: "money", align: "right" }
]]
```

| 칸 속성 | 설명 |
|---|---|
| `label` | key가 없을 때 글자 (HTML) 또는 함수 (`this = {key, list, groupBy}`) |
| `key` + `collector` | 계산값. 이름(`"sum"`·`"avg"`·`"count"`·`"min"`·`"max"`) 또는 함수 (`this = {key, list}`) |
| `formatter` | 계산값에 적용 (`this.value`) |
| `colspan` | 왼쪽 잎 컬럼부터 차지할 칸 수 (줄 번호·행 선택 칸은 세지 않음) |
| `align`, `className` | |

합계는 필터를 거친 행(`getRows()`)으로 계산하고, 값을 바꾸면 다시 계산됩니다. `avg`는 소수 둘째 자리에서 반올림합니다.

**그룹 합계 (`grouping`)**는 그룹 키로 먼저 오름차순 정렬하고, 그룹이 끝나는 자리 뒤에 소계 행을 넣습니다. 키가 여러 개면 안쪽 단계 소계가 먼저 옵니다. 칸 정의는 footSum과 같습니다.

```js
grouping: {
  by: ["STORE", "SECTION"],
  columns: [
    { label: function () { return this.groupBy.labels.join(" / ") + " 소계"; }, colspan: 3 },
    { key: "QTY", collector: "sum", formatter: "money", align: "right" }
  ]
}
```

`this.groupBy`는 `{keys: [...], labels: [...]}`입니다. 소계 행은 `{__isGrouping: true, __groupingList, __groupingBy}` 모양의 객체로 화면 행에 들어가고, 선택·편집·붙여넣기 대상이 아니며 줄 번호도 세지 않습니다.

## 트리

부모 키로 이어진 평평한 목록을 트리로 보여 줍니다. 부모 값이 없거나 비었거나 `"top"`이면 맨 위 노드입니다.

```js
var grid = new PyoGrid("#grid", {
  tree: {
    parentKey: "parentId",    // 기본 "pid"
    selfKey: "id",            // 기본 "id"
    collapseKey: "collapse",  // 접힘 상태를 담는 행 속성
    indentWidth: 14,          // 기본 10
    arrowWidth: 15,
    iconWidth: 18,
    icons: {                  // HTML도 됩니다. 빈 글자면 아이콘 없음
      openedArrow: "▾", collapsedArrow: "▸",
      groupIcon: "⊚", collapsedGroupIcon: "⊚", itemIcon: "⊙"
    }
  },
  columns: [
    { key: "id", label: "분류 코드", width: 220, treeControl: true },
    { key: "name", label: "분류명" }
  ]
});
grid.setData([
  { id: "C-100", parentId: "", name: "문구" },
  { id: "C-110", parentId: "C-100", name: "필기구" },
  { id: "C-111", parentId: "C-110", name: "볼펜", collapse: false }
]);
```

정렬은 형제끼리 합니다. 트리에서는 헤더 값 필터를 쓰지 않습니다.

## 헤더 값 필터

`filter: true`면 헤더마다 ▾ 단추가 생기고, Excel 자동 필터처럼 값 목록에서 고릅니다 (검색, 전체 선택, 초기화·확인·취소, Enter·Esc).

- 목록에는 다른 컬럼 조건에 걸린 행의 값만 나옵니다. 값이 많으면 앞의 2,000개만 그리지만, 검색·전체 선택·확인은 모든 값을 대상으로 합니다 (그대로 확인하면 조건이 생기지 않습니다).
- select 편집기 컬럼은 항목 이름, money 컬럼은 쉼표 넣은 숫자로 보입니다. 빈 값은 "(빈 값)".
- 조건은 `setData` 뒤에도 유지됩니다. 조건에 맞는 행이 없으면 "필터 조건에 맞는 데이터가 없습니다."
- 트리와 서버 페이징(`setData(rows, page)`)에서는 쓰지 않습니다.
- 코드로: `grid.setFilter("MANAGER", ["홍길동", "김철수"])`, `grid.clearFilters()`

## 셀 병합

```js
mergeCells: ["KIND", "SUB"]   // 또는 true (모든 컬럼)
```

위 행과 글자가 같고 왼쪽 병합 컬럼도 이어질 때 합칩니다. 편집기가 있는 컬럼과 그룹 합계 행은 합치지 않습니다. 가상 스크롤과 함께 쓰려고 칸을 실제로 합치지 않고, 덩어리 안 가로선을 지우고 글자는 덩어리 중 화면에 보이는 부분의 가운데 행에만 보입니다. 덩어리가 화면보다 길어도 스크롤하면 글자가 따라옵니다.

## 복사·붙여넣기·실행 취소

- **복사 (Ctrl+C):** 선택 범위를 Excel 형식(탭·줄바꿈)으로. formatter를 거치지 않은 원래 값이라 다시 붙여넣으면 그대로 돌아옵니다.
- **붙여넣기 (Ctrl+V):** Excel에서 복사한 여러 셀을 범위 왼쪽 위부터 넣습니다.
  - 따옴표로 감싼 칸(칸 안 줄바꿈·탭), "1,234" 같은 쉼표 숫자, `2026.11.12` 같은 날짜를 알아듣습니다.
  - 1칸을 여러 칸 범위에 붙이면 채우고, 범위가 붙인 묶음의 정수배면 반복합니다.
  - 편집기가 없거나 막힌 칸, 종류에 맞지 않는 값(숫자 칸의 글자, 목록에 없는 항목), 표 밖 칸은 건너뛰고 아래 바에 "붙여넣기: n셀 (건너뜀 m)"을 보여 줍니다.
  - 붙인 값은 편집할 때와 같은 검증을 거칩니다: number·money의 `min`·`max`·`decimal`, 날짜 확인, `editor.attributes.maxlength`(넘치면 자름), 사용자 편집기의 `parse`.
  - 지금 값과 같은 뜻의 값(text 칸의 0과 "0", money 칸의 "1,200"과 1200)은 바꾸지 않아서 수정된 행이 되지 않습니다. 편집에서 값을 안 바꾸고 Enter를 눌러도 마찬가지입니다.
  - select 칸은 항목 값이나 이름, checkbox 칸은 trueValue/falseValue·Y/N·true/false·1/0을 받습니다.
- **잘라내기 (Ctrl+X):** 복사하고 비웁니다.
- **실행 취소 (Ctrl+Z):** 셀 편집·Delete·붙여넣기·잘라내기를 한 동작씩(붙여넣기는 통째로) 되돌립니다. 다시 실행은 Ctrl+Y. 정렬로 순서가 바뀌어도 그 행을 되돌립니다. 코드에서 부른 `setValue`는 기록하지 않습니다.

## 서버 페이징·서버 정렬

```js
var grid = new PyoGrid("#grid", {
  sortable: true,
  remoteSort: true,                         // 정렬은 서버가
  pageIcons: { first: "|«", prev: "«", next: "»", last: "»|" },
  columns: [...]
});

function load(pageNo, sort) {
  fetch("/api/list?page=" + pageNo + "&sort=" + encodeURIComponent(JSON.stringify(sort || [])))
    .then(function (r) { return r.json(); })
    .then(function (res) {
      grid.setData(res.list, {
        currentPage: pageNo,                // 0부터
        pageSize: 50,
        totalElements: res.total,
        totalPages: Math.ceil(res.total / 50)
      });
    });
}
grid.on("pagechange", function (e) { load(e.page, grid.getSort()); });
grid.on("sortchange", function (e) { load(0, e.sort); });
load(0);
```

페이지 정보를 주면 아래 바에 페이지 번호가 생기고 상태 문구에 `Total 1,234`가 붙습니다.

## 엑셀 내보내기

```js
grid.exportExcel("주간출고_W46.xlsx");          // ".xls"로 주어도 .xlsx로 저장
grid.exportExcel("목록", { sheetName: "목록" });
```

- SheetJS(`window.XLSX`)가 필요합니다. 모듈로 쓸 때는 `{ XLSX }`로 넘길 수 있습니다. 없으면 콘솔에 경고를 남기고 false를 돌려줍니다.
- 화면 그대로 내보냅니다: 필터·정렬, 그룹 합계 행, 합계 행, 컬럼 너비.
- 다단 헤더와 합계 칸의 colspan은 병합 셀로 남습니다.
- 셀 글자는 formatter 결과에서 HTML을 걷어낸 것입니다. 숫자는 숫자 셀로 넣습니다:
  - "1,234"처럼 쉼표 숫자 → 숫자 + `#,##0` 서식
  - 원래 값이 숫자이거나, money formatter·오른쪽 정렬 컬럼·합계 칸의 숫자 모양 글자 → 숫자
  - 앞자리 0이 있는 코드(`0012`)는 글자
- 줄 번호·행 선택 칸은 넣지 않습니다. 트리는 펼친 행만 들어갑니다.

## 컬럼 너비·정렬 기억

```js
new PyoGrid("#grid", { stateKey: "weekly-grid", columns: [...] });
```

사용자가 너비를 끌어 바꾸거나 헤더로 정렬하면 localStorage(`"pyogrid:" + 화면 경로 + ":" + stateKey`)에 저장하고, 그리드를 만들 때와 `setColumns` 때 되살립니다. 컬럼은 key로 찾으므로 컬럼 구성이 바뀌어도(예: 주차별 헤더) 같은 key는 남습니다. `grid.resetState()`로 지웁니다.

## 수정·추가·삭제 행 모으기

저장 버튼에서 서버로 보낼 행을 모으는 예입니다.

```js
function save() {
  if (!grid.commitEdit()) return;               // 편집 중인 값이 잘못됐으면 멈춤
  var changed = grid.getModifiedRows();         // 수정 + addRow로 넣은 행
  var deleted = grid.getDeletedRows();          // deleteRows로 지운 행
  return fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changed: changed, deleted: deleted })
  }).then(function (res) {
    if (res.ok) grid.acceptChanges();           // 저장한 값이 새 기준: 수정 표시·지운 행 기록을 비움
  });
}

document.getElementById("btnAdd").onclick = function () {
  grid.addRow({ SKU: "", QTY: 0 }, "last", { focus: true });
};
document.getElementById("btnDelete").onclick = function () {
  grid.deleteRows(grid.getSelectedRows());
};
```

## 전역 확장

`<script>`로 불러오면 `PyoGrid`에 다음이 붙어 있습니다.

```js
// formatter 등록: 컬럼에서 formatter: "yn"으로 씀
PyoGrid.formatters.yn = function (c) { return c.value === "Y" ? "예" : "아니오"; };

// 합계 계산기 등록: collector: "nonZeroCount"
PyoGrid.collectors.nonZeroCount = function () {
  var k = this.key;
  return this.list.filter(function (r) { return Number(r[k]) !== 0; }).length;
};

// 입력칸 편집기 등록: editor: { type: "upper" }
PyoGrid.editors.upper = {
  kind: "input",                 // 그리드 입력칸으로 편집
  typeToEdit: true,              // 셀에서 바로 타이핑
  clearable: true,               // Delete로 비우기
  format: function (v) { return v == null ? "" : String(v); },          // 편집 시작 글자
  parse: function (s) { return { ok: true, value: s.toUpperCase() }; }, // 저장 값 (ok:false면 거부). 붙여넣기도 이 함수를 거침
  sanitize: function (s) { return s.replace(/[^A-Za-z0-9]/g, ""); }    // 타이핑 중 정리 (선택, 붙여넣기에는 쓰지 않음)
};
```

| 이름 | 설명 |
|---|---|
| `PyoGrid.version` | |
| `PyoGrid.escapeHtml(v)` | HTML 이스케이프 |
| `PyoGrid.formatNumber(n)` | 천 단위 쉼표, 소수 2자리 |
| `PyoGrid.sortRows(rows, sort, compare?)` | 그리드와 같은 규칙으로 배열 정렬 (새 배열) |
| `PyoGrid.util.getValue(row, key)` / `setValue(row, key, v)` | 경로 키 읽기·쓰기 |
| `PyoGrid.util.toNumber(v)` | "1,200" → 1200, 숫자가 아니면 null |

ES 모듈에서는 같은 기능을 이름으로 가져옵니다: `formatters`, `editorTypes`, `userCollectors`, `escapeHtml`, `sortRows`, `parseTSV`, `buildTSV` 등 (`src/index.js` 참고).

## 테마 (CSS)

기본 테마는 밝은 회색 헤더에 파란 강조색입니다. `.pyo`의 CSS 변수로 바꿀 수 있습니다.

```css
#myGrid .pyo {
  --pyo-accent: #0f766e;        /* 포커스·선택·정렬 표시 */
  --pyo-head-bg: #f0fdfa;
  --pyo-row-odd: #fafafa;
}
/* 화면별 셀 서식은 cellClass로 붙인 class에 */
#myGrid .minus { color: #c9302c !important; }
```

| 변수 | 기본값 | 쓰는 곳 |
|---|---|---|
| `--pyo-border` | `#cfd6de` | 그리드 테두리 |
| `--pyo-text` | `#1f2937` | 글자 |
| `--pyo-head-bg` / `--pyo-head-text` | `#f4f6f9` / `#344054` | 헤더 |
| `--pyo-head-line` / `--pyo-head-bottom` | `#dde2e8` / `#c9d1da` | 헤더 선 |
| `--pyo-cell-line` | `#e6e9ee` | 셀 선 |
| `--pyo-row-even` / `--pyo-row-odd` | `#fff` / `#f8fafc` | 줄무늬 |
| `--pyo-row-hover` / `--pyo-row-selected` | `#eef4fd` / `#e3edfc` | 행 강조·선택 |
| `--pyo-range-bg` / `--pyo-active-bg` | `#cfe0fa` / `#eaf2fe` | 셀 범위·포커스 셀 |
| `--pyo-accent` | `#2f6fd6` | 강조색 |
| `--pyo-frozen-line` | `#b9c3cf` | 틀 고정 경계·합계 행 위 선 |

주요 class: `.pyo-row`(`.pyo-selected`, `.pyo-group-row`), `.pyo-cell`(`.pyo-in-range`, `.pyo-active`, `.pyo-merged`), `.pyo-hcell`, `.pyo-foot`, `.pyo-page`, `.pyo-popup`(편집기·필터 팝업).

## 개발

```bash
npm install
npm run build        # dist/ (js, min.js, esm.js, css, min.css, types)
npm run typecheck    # JSDoc 타입 검사 (// @ts-check)
npm test             # 단위 테스트 (vitest + jsdom)
npm run test:e2e     # 빌드 후 헤드리스 Chrome 테스트 (Playwright, 설치된 Chrome 사용)
npm run test:all     # 위 셋 모두
npm run demo         # 데모 서버 http://127.0.0.1:5179/demo/
```

데모 페이지 (`demo/`, 모든 데이터는 가상 데이터):

| 페이지 | 내용 |
|---|---|
| `weekly.html` | 주간 주문·출고 현황(가상 데이터): 다단 헤더, 틀 고정, 편집, 붙여넣기, 필터, 합계 행, 엑셀, 상태 기억 |
| `editors.html` | 편집기 6종, 키보드, 한글 입력, 변경 기록 |
| `summary.html` | 그룹 합계, 트리, 셀 병합 |
| `paging.html` | 서버 페이징·서버 정렬 흉내 |
| `big.html` | 50,000행 × 30열 성능 확인 |

소스 구조:

```
src/
  index.js / global.js      ES 모듈 / <script> 진입점
  grid.js                   PyoGrid 클래스 (DOM, 배치, 가상 스크롤, 공개 API)
  core/                     컬럼 모델·너비, 정렬, 셀 범위, formatter
  editors/                  편집기 종류, 달력·선택 목록 팝업
  features/                 편집·키보드, 클립보드, 실행 취소, 필터, 합계, 화면 행 만들기, 엑셀, 상태 기억, 페이지 바
  css/pyogrid.css
test/unit, test/e2e         단위 / Chrome 테스트
docs/                       설계 문서
tools/                      빌드, 테스트 실행기, 데모 서버, 성능 측정, 스크린샷
```

설계 결정은 [docs/design.md](docs/design.md)에 적어 두었습니다.

## 라이선스

[MIT](LICENSE) © Donghyeon Shin
