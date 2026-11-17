# 1.0 로드맵

1.0부터는 README의 [Stability](../README.md#stability) 절에 적은 약속을 semver로 지킨다.
1.0 전에 공개 API를 정리하고, 정리하면서 생기는 호환성을 깨는 변경을 0.x.0 릴리스로 미리 끝낸다.
조사 결과는 [api-surface.md](api-surface.md)에 있다.

## 1.0 조건

### 공개 API 정리

- [ ] 문서에 없는 내보내기(아래 "호환성을 깨는 변경 예정")마다 빼거나 README에 적어 남긴다.
- [ ] 문서에 없는 인스턴스 메서드 5개(`isFilterable`, `isSortable`, `isNumericColumn`, `emit`, `emitCancelable`)를 README에 적거나 `_`를 붙여 숨긴다.
- [ ] 문서에 없는 인스턴스 속성(`options`, `rows`, `el` 등 26개)을 정한다. 남길 것은 읽기 전용으로 README에 적고, 나머지는 `_`를 붙인다.
- [ ] 문서에 없는 인자(`selectRow`의 `opts.source`, `setSort`의 `opts`, `openFilter`의 두 번째 인자)를 문서에 넣거나 내부용으로 정한다.
- [ ] 이름만 적힌 `parseTSV`, `buildTSV`에 인자와 돌려주는 값을 적는다.
- [ ] README에 없는 색 CSS 변수 6개(`--pyo-head-hover`, `--pyo-aside-bg`, `--pyo-aside-text`, `--pyo-scroll-track`, `--pyo-scroll-thumb`, `--pyo-scroll-thumb-hover`)를 Theming 표에 넣는다. 높이 변수 3개(`--pyo-row-h`, `--pyo-head-row-h`, `--pyo-head-h`)는 내부용으로 둔다.
- [ ] `dist/types`의 선언 파일이 정리한 공개 API와 맞는지 본다 (빠진 이름이 선언에도 없고, 남긴 이름에 설명이 있는지).
- [ ] [test/unit/api-surface.test.js](../test/unit/api-surface.test.js)의 목록과 README가 같다.

### 타입

- [ ] strictNullChecks를 모든 파일에 켠다. 아래 "strictNullChecks 남은 순서"를 따라 `tsconfig.strict.json`의 include를 늘리고, 다 끝나면 `tsconfig.json`에 켜고 `tsconfig.strict.json`을 지운다.
- [ ] `on`·`off`에서 GridEvents에 없는 이름을 받는 오버로드(`on(name: string, fn: Function | ((e: any) => any))`)를 1.0에서 뺄지 정한다. 빼면 오타 난 이벤트 이름(`"chnage"`)이 컴파일 오류로 잡히지만, 지금 모르는 이름을 넘기는 TypeScript 코드는 컴파일이 깨진다. 런타임은 그대로 아무 이름이나 받는다.

### 폐기 절차

- [ ] 약속한 것을 빼거나 바꿀 때는 적어도 한 번의 0.x.0 릴리스에서 먼저 예고한다. CHANGELOG에 적고, 할 수 있으면 `deprecate(id, message)`(src/util.js)로 한 번 경고한다.
- [ ] 1.0을 내기 전 마지막 0.x.0까지 예고한 항목을 모두 정리한다. 1.0.0에서 처음 깨는 변경은 없게 한다.

### 품질

- [ ] 실제 Safari(macOS, iOS)에서 손으로 확인한다. 지금은 Playwright WebKit만 자동으로 돌린다.
- [ ] Firefox, Safari에서 한글 입력(IME)을 손으로 확인한다. 자동 테스트는 Chromium에서만 된다.
- [ ] CI(Test 워크플로)가 Chrome, Firefox, WebKit에서 연속으로 통과한다.

### 문서

- [ ] README Stability 절에 1.0 이후 규칙(깨는 변경은 메이저 버전에서만)을 더한다.
- [ ] CHANGELOG에 1.0으로 올라올 때 바꿔야 할 것을 한곳에 모은다.

## 호환성을 깨는 변경 예정

README에 없는 내보내기는 Stability 절의 약속 밖이라 예고 없이 빼도 규칙에는 맞다.
그래도 쓰는 사람이 있을 수 있으므로, 한 번의 0.x.0에서 예고한 뒤 다음 0.x.0에서 뺀다.

1. **예고 (다음 0.x.0)**: CHANGELOG에 Deprecated 절을 만들어 아래 이름을 적는다. 함수는 `deprecate`로 감싸 처음 부를 때 경고한다. 객체와 클래스(`collectors`, `CellRange`)는 감싸기 어려우므로 CHANGELOG 예고만 한다.
2. **삭제 (그다음 0.x.0)**: `src/index.js`·`src/global.js`·`grid.js`에서 뺀다. CHANGELOG Breaking changes에 적고, api-surface 테스트와 api-surface.md를 고친다.

남길 이유가 있는 것은 "남긴다면"에 적었다. 남기려면 README에 적어 약속한다.

### ES 모듈 내보내기 (src/index.js)

| 이름 | 나온 곳 | 계획 | 남긴다면 |
|---|---|---|---|
| `buildColumnModel`, `computeWidths`, `parseWidth` | core/columns.js | 뺀다 | |
| `compareSmart`, `comparePlain` | core/sort.js | 뺀다 | `sortCompare` 함수를 직접 만들 때 기본 비교에 덧붙이는 용도 |
| `nextSortDir` | core/sort.js | 뺀다 | |
| `CellRange` | core/range.js | 뺀다 | |
| `summaryText` | features/pagebar.js | 뺀다 | |
| `parseNumber`, `parseDate`, `parseDateValue`, `formatDateAs` | editors/types.js | 뺀다 | 직접 만든 편집기의 `parse`에서 내장 규칙을 다시 쓰는 용도 |
| `sanitizeNumber`, `sanitizeDate`, `addCommas`, `selectOptions` | editors/types.js | 뺀다 | |
| `parseKeyPath` | util.js | 뺀다 | |
| `collectors` | features/view.js | 뺀다 | 사용자 등록용 `userCollectors`(`PyoGrid.collectors`)와 이름이 헷갈린다 |
| `resolveMessages` | core/locales.js | 뺀다 | |
| `toXlsxCell`, `htmlToText` | features/excel.js | 뺀다 | |

### 전역·정적 이름

| 이름 | 나온 곳 | 계획 |
|---|---|---|
| `PyoGrid.parseWidth` | grid.js 끝 | 뺀다 |
| `PyoGrid.util.parseKeyPath` | global.js | 뺀다 |

### 인스턴스 메서드·속성 (정한 뒤 이 목록에 옮긴다)

`_`를 붙여 숨기기로 정한 것은 여기 적고 위와 같은 절차(예고 뒤 삭제)를 따른다.
메서드는 옛 이름을 남겨 `deprecate`로 경고한 뒤 새 이름을 부르게 하고, 속성은 getter로 같은 방법을 쓴다.

| 이름 | 지금 생각 |
|---|---|
| `emit`, `emitCancelable` | 사용자가 그리드 이벤트를 꾸며 낼 이유가 없으므로 숨긴다 |
| `isFilterable`, `isSortable`, `isNumericColumn` | 숨긴다. 쓰임이 있으면 README에 적는다 |
| `options`, `messages` | 읽기 전용으로 남길지 정한다. 바꿔도 다시 그리지 않으므로 쓰기는 약속하지 않는다 |
| 그 밖의 속성 (`rows`, `source`, `dataRows`, `deleted`, `filters`, `sort`, `page`, `range`, `leaves`, `headerCells`, `headerDepth`, `widths`, `leafX`, `aside`, `frozenCount`, `fzWidth`, `scWidth`, `asideWidth`, `totalWidth`, `history`, `editing`, `el`, `id`, `target`) | 숨긴다. 같은 내용을 읽는 메서드가 있다. 단위 테스트가 많이 읽으므로(`grid.el` 등) 테스트도 같이 고친다 |

## strictNullChecks 남은 순서

`tsconfig.strict.json`(strictNullChecks: true)이 검사하는 파일은 아래 표에서 "통과"인 것이다. `npm run typecheck`가 `tsconfig.json`과 이 설정을 둘 다 돌린다.
include에 넣은 파일이 import하는 파일(JSDoc의 `import("...")` 타입 포함)도 같이 검사되므로, 한 파일을 넣으려면 그 파일이 가져오는 파일이 먼저 통과해야 한다.

오류 수는 그 파일만 include에 넣고 strictNullChecks로 검사했을 때의 수다.
"함께 검사되는 오류"는 그 파일이 가져오는 다른 파일에서 나는 오류다.

| 순서 | 파일 | 자기 오류 | 함께 검사되는 오류 | 상태·메모 |
|---|---|---|---|---|
| 1 | `src/util.js`, `src/core/*.js` | 0 | 0 | 통과 |
| 2 | `src/features/history.js`, `src/features/pagebar.js`, `src/features/state.js` | 0 | 0 | 통과 (원래 오류 없음) |
| 3 | `src/editors/types.js`, `src/features/clipboard.js` | 0 (처음 1) | 0 | 통과 |
| 4 | `src/editors/popups.js` | 0 (처음 1) | 0 | 통과 |
| 5 | `src/features/filter.js` | 0 (처음 4) | 0 | 통과 |
| 6 | `src/features/view.js` | 0 (처음 13) | 0 | 통과 |
| 7 | `src/features/excel.js`, `src/features/summary.js` | 0 | 110 (grid.js 85, editing.js 25) | 인자 `g`의 타입으로 grid.js를 가져온다. grid.js 뒤에 넣거나, 쓰는 속성만 담은 타입으로 바꾼다 |
| 8 | `src/features/editing.js` | 25 | 85 (grid.js) | grid.js와 서로 가져오므로 grid.js와 같이 끝낸다 |
| 9 | `src/grid.js` | 85 | 25 (editing.js) | 마지막 |
| 10 | `src/index.js`, `src/global.js` | 0 | 110 | grid.js 뒤 |

3~6번은 JSDoc 타입 변환(`/** @type {...} */ (식)`)과 지역 변수 타입 주석만 넣어 통과시켰다. 빌드 결과(압축한 js)와 dist/types는 바뀌지 않았다.

모두 통과하면 `tsconfig.json`에 strictNullChecks를 켜고 `tsconfig.strict.json`을 지운다.
