# PyoGrid 설계

사용법은 [README](../README.md)에 있고, 이 문서는 구현 방식과 그렇게 정한 이유를 적는다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 의존성 | 없음. xlsx 내보내기만 SheetJS가 있을 때 쓴다 |
| 브라우저 | Chrome·Edge·Firefox·Safari 최신 (sticky, ResizeObserver). 자동 테스트는 Chrome·Firefox·WebKit |
| 언어 | 순수 JS(ES2020 모듈) + JSDoc + `// @ts-check`, `.d.ts` 생성 |
| 이름 | 전역 `PyoGrid`, CSS 접두사 `pyo-` |
| 화면 문구 | `core/locales.js`의 언어별 문구. 기본 영어, 한국어 내장. `locale`로 고르고 `messages`로 일부를 덮는다 |
| date 편집기 | `yyyy-MM-dd` 입력 정리 + 자체 달력 팝업 (브라우저 `input type=date`는 칸 단위 입력이라 바로 입력·붙여넣기와 맞지 않음) |

## 구조

```
src/
  index.js / global.js      ES 모듈 / <script> 진입점 (window.PyoGrid)
  grid.js                   PyoGrid 클래스: DOM 뼈대, 배치, 헤더, 가상 본문, 공개 API
  util.js                   이스케이프, 경로 키(a['b'].c) 읽기/쓰기, 숫자 해석, 깊은 병합
  core/columns.js           컬럼 정의 → 잎 컬럼 + 다단 헤더 칸, 너비 계산
  core/sort.js              정렬 (smart / plain / 함수)
  core/range.js             셀 범위
  core/formatters.js        money
  core/locales.js           화면 문구 (en, ko), locale + messages 합치기
  editors/types.js          편집기 종류 (입력 정리·값 해석)
  editors/popups.js         달력·선택 목록 팝업
  features/editing.js       셀 편집·키보드·한글 입력
  features/clipboard.js     TSV 해석·만들기, 붙여넣기 배치
  features/history.js       실행 취소 기록
  features/view.js          화면 행 만들기 (필터·정렬·그룹·트리), 합계 계산기, 셀 병합
  features/summary.js       합계 행·그룹 합계 행 그리기
  features/filter.js        헤더 값 필터 팝업
  features/excel.js         xlsx 내보내기
  features/state.js         너비·정렬 기억
  features/pagebar.js       아래 바 (선택 합계, 페이지 이동, 상태 문구)
  css/pyogrid.css           테마
tools/  build.mjs(esbuild + tsc) · vitest.mjs(테스트 실행기) · serve.mjs(데모 서버) · shot.mjs(스크린샷) · screenshots.mjs(README 그림) · probe-*.mjs(성능 측정)
test/unit (vitest + jsdom) · test/e2e (Playwright + 설치된 Chrome)
```

## DOM과 스크롤

```
div.pyo                         (테두리, position:relative)
  div.pyo-scroll                (스크롤 컨테이너 하나, overflow:auto)
    div.pyo-canvas              (너비 = 보조 + 모든 잎 컬럼, 세로 flex)
      div.pyo-head              (sticky top)
        div.pyo-head-fz         (sticky left: 보조 컬럼 + 고정 컬럼 헤더)
        div.pyo-head-sc         (스크롤 컬럼 헤더)
      div.pyo-body              (높이 = 행 수 × 행 높이)
        div.pyo-row             (absolute top, 보이는 행만)
          div.pyo-fz            (sticky left: 보조 + 고정 셀)
          div.pyo-sc            (보이는 스크롤 셀만, 앞쪽은 padding-left로 비움)
      div.pyo-foot              (합계 행, sticky bottom)
  textarea.pyo-input            (셀 입력칸, 늘 포커스를 받음)
  div.pyo-empty                 (데이터 없음 안내)
  div.pyo-resize-guide          (너비 조절 안내선)
  div.pyo-page                  (아래 바)
```

- 브라우저 스크롤 하나에 `position: sticky`를 써서 헤더·고정 컬럼·합계 행이 같은 프레임에 움직인다. 패널 여러 개의 위치를 스크롤마다 스크립트로 맞추지 않으므로 동기화 지연이 없다.
- 세로: 행 높이가 고정이므로 `scrollTop / 행 높이`로 범위를 구하고 위아래 6행을 더 그린다. 범위를 벗어난 행만 지우고 새 행만 만든다.
- 가로: 고정 컬럼은 항상, 스크롤 컬럼은 보이는 범위 ±2열만 그린다. 범위가 바뀌면 보이는 행을 다시 만든다.
- 스크롤바: Chrome·Edge·Safari는 `::-webkit-scrollbar`로 15px. Firefox는 이 선택자가 없어서 브라우저 기본 너비(Windows 17px, 겹쳐 그리는 스크롤바면 0)에 색만 `scrollbar-color`로 맞춘다. Chrome 121+는 `scrollbar-color`가 있으면 `::-webkit-scrollbar`를 무시하므로 `@supports not selector(::-webkit-scrollbar)` 안에만 둔다. 세로 막대는 헤더 아래부터(`::-webkit-scrollbar` 브라우저만).
- 너비: 그리드 너비에서 보조 컬럼과 스크롤바 너비를 빼고 `"*"`·`%`를 계산한다 (행 수에 따라 너비가 바뀌지 않게). 스크롤바 너비는 상수가 아니라, 스크롤 영역과 같은 class의 숨은 상자를 `overflow:scroll`로 만들어 잰다. 잴 수 없으면(화면에 없음, jsdom) 15px. 한 번 잰 값은 기억하고 창 크기가 바뀌면(확대·축소 포함) 다시 잰다. 컨테이너 크기가 바뀌면 ResizeObserver로 다시 계산하고, 사용자가 조절한 너비는 유지한다.
- 행 객체는 복사하지 않는다 (화면 코드가 행을 직접 고치고 다시 그리게 하는 방식에 맞춤).
- 값, formatter 결과, 헤더 label, 합계 칸 label·formatter 결과는 글자로 이스케이프해서 넣는다. 컬럼(또는 합계 칸)에 `html: true`가 있을 때만 HTML로 넣는다. 바코드·서버 글자를 그대로 돌려주는 formatter 하나로 스크립트가 들어오지 않게 기본을 안전한 쪽에 둔다. cellClass·headerClass·className도 속성 값으로 이스케이프한다. 엑셀 내보내기도 화면과 같은 글자를 쓴다.
- **성능:** 스크롤 중에는 스크롤 영역 크기(clientWidth/Height)를 다시 읽지 않는다. 행을 DOM에 넣은 직후 크기를 읽으면 브라우저가 레이아웃을 강제로 계산해서, 화면 밖 행으로 스크롤할 때 15초가 걸린 일이 있었다 (`refresh`에서만 읽도록 고침). 50,000행 × 30열에서 생성+setData 20~50ms, 화면 DOM은 행 26개·셀 약 470개.

## 선택·정렬·페이지

- **데이터:** `source`(setData 순서)와 `rows`(화면 순서)를 따로 둔다. 정렬을 풀면 `source` 순서로 돌아간다.
- **행 선택:** 상태는 행 객체의 `__selected__`에 둔다. 그래서 정렬·필터 뒤에도 선택이 행을 따라간다. 셀 클릭으로는 행을 선택하지 않는다. 단일 선택(`multipleSelect:false`)에서 다른 행을 고르면 화면 행이 아니라 전체 행(`source`)에서 선택을 푼다 (접힌 트리 자식·필터로 숨은 행이 선택된 채 남지 않게). Shift+클릭의 기준 행은 화면 순번이 아니라 행 객체로 기억해서 정렬·필터·행 추가 뒤에도 같은 행에서 범위를 잡고, 기준 행이 지워지거나 숨으면 일반 클릭으로 처리한다.
- **큰 배열:** `Math.min(...배열)`, `push(...배열)`, `splice(i, 0, ...배열)`은 원소가 수십만이면 인자 수 한도를 넘어 RangeError가 난다. min·max 계산기, 실행 취소 범위 계산, 붙여넣기 배치, addRow, deleteRows는 반복문이나 concat을 쓴다.
- **헤더 체크박스:** 선택 가능한 행이 모두 선택됐을 때 체크로 보인다. 체크박스에 상태를 따로 두지 않고 행 상태에서 계산하므로 둘이 어긋나지 않는다.
- **셀 범위:** `CellRange{anchor, active}`. 셀을 그릴 때 범위를 확인하므로 스크롤해서 새로 그린 행에도 표시가 남는다. 범위가 바뀌면 그려진 셀의 class만 고친다.
- **끌기 선택:** 포인터 캡처를 쓰면 Chrome이 click 대상을 캡처한 요소로 바꿔 셀 click·dblclick이 사라져서, document에 이동·놓기 리스너를 단다.
- **정렬 순환:** 없음 → desc → asc → 없음. 다중 정렬은 클릭 순서대로 쌓는다.
- **비교 방식:** 기본 `smart`(숫자 문자열은 숫자로, 그리드 `locale`의 `Intl.Collator(locale, {numeric:true})` 자연 정렬, 빈 값은 방향과 관계없이 맨 뒤). `plain`은 값을 그대로 비교한다 (타입이 다르면 문자열로 바꿔 비교).
- **정렬 속도:** smart 정렬은 정렬 전에 값마다 [빈 값인가, 숫자 변환, 글자 변환]을 한 번만 해 두고 비교에서는 그 결과만 쓴다 (비교마다 toNumber 정규식을 돌지 않게). Collator와 NumberFormat은 언어별로 하나씩 만들어 기억한다. 20만 행 두 키 정렬이 약 1.7초에서 0.57초로 줄었다 (node, 이 PC).
- **페이지 바:** 기본으로 보인다. 상태 문구는 `"1 - 15 of 300"`, 페이지 정보가 있으면 `" Total 1,234"`를 붙인다.

## 편집·키보드

- **입력칸 하나:** 그리드마다 `textarea.pyo-input` 하나를 두고, 그리드가 포커스를 가진 동안 늘 여기에 포커스가 있다. 편집하지 않을 때는 투명하게 활성 셀 위에 있고, 글자를 치면 그 자리에서 보이게 바뀐다. 포커스를 옮기지 않으므로 한글 조합이 끊기지 않고 첫 글자도 사라지지 않는다. 한글 후보 창도 셀 옆에 뜬다. 키보드는 window가 아니라 이 입력칸에서 받으므로 그리드가 여러 개여도 서로 간섭하지 않는다.
- **조합 중 Enter·Tab·방향키:** Windows Chrome은 조합 중 키를 keyCode 229로 보낸다. `e.code`로 어떤 키였는지 기억했다가 compositionend 뒤에 저장·이동한다 (Enter 한 번으로 저장). macOS처럼 조합 뒤 같은 키가 한 번 더 오면 80ms 안의 같은 키는 무시한다.
- **키 없이 들어온 글자:** 받아쓰기·이모지 창 같은 입력은 keydown 없이 input만 온다. 편집할 수 있는 셀이면 그때 편집을 시작한다.
- **값 확인:** 숫자·날짜는 입력 중 허용하지 않는 글자를 지우고(조합 중에는 건드리지 않음), 쉼표·하이픈 같은 서식 글자를 빼고 센 자리로 커서를 되돌린다. 저장할 때 잘못된 값이면 빨간 테두리로 편집을 계속한다. 포커스가 그리드 밖으로 나갈 때 잘못된 값이면 취소한다.
- **팝업:** 달력·선택 목록은 document.body에 position:fixed로 붙이고 mousedown을 막아 포커스가 입력칸에 남는다. document에 캡처 단계 scroll 리스너와 window resize 리스너를 달아, 바깥 페이지·모달 등 어느 요소가 스크롤되어도 팝업(필터 포함)을 셀에 다시 맞춘다 (팝업 안 목록의 스크롤은 무시). 필터 팝업은 단추를 그때마다 다시 찾고, 아래 공간이 모자라면 위로 뒤집는다. 선택 목록은 입력칸으로 받은 글자로 찾으므로 한글로도 찾을 수 있다.
- **수정 추적:** `setValue`가 값이 바뀔 때만 행에 `__modified__`를 붙이고 `change`를 알린다. null·undefined·""는 같은 값으로 본다. 셀마다 처음 값을 기억해 두고, 모든 셀이 처음 값으로 돌아오면(실행 취소, 직접 되돌리기) 표시를 푼다. 바꾸기 전에 이미 표시가 있던 행(addRow, 데이터의 `__modified__`)은 그대로 둔다. 저장 뒤에는 `acceptChanges()`(또는 `clearModified`·`clearDeleted`)로 지금 값을 새 기준으로 삼는다. 여러 셀을 바꾸는 `setValues`는 한 번만 다시 그리고 `batchchange`를 알린다 (셀별 change에는 `batch:true`).
- **추가한 행:** `addRow`는 `__added__`(addedKey)를 붙인다. 저장(`acceptChanges`·`clearModified`) 전까지 이 행은 헤더 필터를 통과하고(`buildView`의 `pass`), `deleteRows`로 지워도 `deleted`에 넣지 않는다 (서버에 없는 행의 삭제 요청이 나가지 않게). 수정한 행과는 `getAddedRows()`로 나눈다.
- **행 객체로 값 바꾸기:** `setValue(row, …)`·`setValues([{row, …}])`는 화면 순번 대신 행 객체도 받는다. 필터로 숨은 행·접힌 트리 자식도 바꾸고 change를 알린다 (rowIndex -1). 실행 취소도 이 길로 가서 숨은 행의 change·batchchange·합계 행 갱신이 빠지지 않는다. 그 뒤에 지운 행만 값만 되돌린다.
- **Tab:** 마지막 셀의 Tab, 첫 셀의 Shift+Tab은 기본 동작을 막지 않아 포커스가 다음(앞) 입력 요소로 나간다. 편집 중이면 저장한 뒤 나가고, 잘못된 값이면 막고 편집을 계속한다.
- **날짜 저장 형식:** date 편집기 `config.valueFormat`("yyyyMMdd" 같은 형식 글자 또는 함수)으로 저장 형식을 정한다. 입력칸에는 늘 yyyy-MM-dd로 보이고, 저장·붙여넣기 때만 이 형식으로 바꾼다. 서버가 20261113으로 주는 컬럼에서 고친 셀만 하이픈 형식이 되지 않게.
- **이벤트 핸들러 예외:** `emit`·`emitCancelable`은 핸들러마다 try/catch로 감싸 `reportError`(없으면 console.error)로 넘기고 계속한다. 붙여넣기 중 change 핸들러 하나가 실패해도 나머지 값·다시 그리기·실행 취소 기록·batchchange가 빠지지 않게.
- **선택 합계:** 값이 number이거나 숫자 컬럼(money formatter, number·money 편집기, `numeric: true`)의 숫자 글자만 더한다. 바코드·품번·"20261113" 같은 코드 글자가 합계에 섞이지 않게.

## 클립보드·실행 취소

- **클립보드:** Ctrl+C·X·V는 막지 않고 입력칸의 copy·cut·paste 이벤트에서 `clipboardData`를 읽고 쓴다. 클립보드 권한 요청 없이 동작하고, 편집 중이면 입력칸 기본 동작을 둔다. 복사는 formatter를 거치지 않은 원래 값이다.
- **붙여넣기 배치 (Excel과 같음):** 1칸을 여러 칸 범위에 붙이면 채우고, 범위가 붙인 묶음의 정수배면 반복하고, 그 밖에는 왼쪽 위부터. 맞지 않는 칸은 건너뛴다.
- **붙여넣기 검증:** 입력칸 편집기(기본 4종과 사용자 등록 편집기)는 편집 저장과 같은 `parse(text, config)`를 거친다 (min·max·decimal, 날짜 확인, 사용자 검증). `editor.attributes.maxlength`로 자른다. `sanitize`는 타이핑 중에만 쓴다 (붙여넣기에 쓰면 숫자 칸에 붙인 "abc"가 칸을 비우는 값이 된다).
- **같은 값은 바꾸지 않음:** 편집은 지금 값으로 시작해 입력칸 글자를 그대로 두었으면 값을 건드리지 않는다 (검증·보정도 하지 않음). 글자를 바꿨거나 붙여넣기면 새 값을 `parse(format(old))`와 비교해, text 칸의 0과 "0", money 칸의 "1,200"과 1200처럼 서식만 다른 값은 같은 값으로 본다. 단, 넣었다 꺼내면서 숫자가 달라졌으면(min·max로 잘림, decimal로 반올림) 같은 값으로 보지 않는다. 서버 값이 편집기 제한 밖일 때(min:0 칸의 -5) 경계값(0)으로 고칠 수 있게 하기 위해서다.
- **실행 취소:** 셀 편집·Delete·붙여넣기·잘라내기를 한 동작씩 최대 50개 기록한다. 코드에서 부른 setValue는 기록하지 않는다. 행 객체에 묶어서 정렬 뒤에도 그 행을 되돌린다. 되돌린 값도 `change`(source "undo"/"redo")와 `batchchange`로 알리므로 화면의 재계산 코드가 그대로 돈다.

## 필터·합계·그룹·트리·병합

- **화면 행 만들기:** `source` → 헤더 값 필터 → 정렬 → 그룹 합계 행 넣기 또는 트리 펼치기 → `rows`. `dataRows`는 그룹 행 없는 데이터 행(트리는 접힌 자식 포함).
- **컬럼이 바뀔 때:** setColumns·addColumn·removeColumn·updateColumn 뒤에 새 컬럼에 없거나 `filter:false`·`sortable:false`가 된 키의 필터·정렬 조건을 지우고 화면 행을 다시 만든다. 지운 조건이 있으면 filterchange·sortchange를 알린다.
- **그룹 합계 행:** 객체 모양은 `{__isGrouping, __groupingList, __groupingBy:{keys,labels}}`. 그룹 키로 먼저 오름차순 정렬하고, 그룹이 끝나는 자리 뒤에 안쪽 단계 소계부터 넣는다. 값을 바꾸면 전체를 다시 그려 소계가 바로 바뀐다. 그룹 키 컬럼 값이 바뀌면(편집·붙여넣기·setValue·실행 취소) 화면 행을 다시 만들어 행을 새 그룹으로 옮긴다.
- **합계 행:** 칸 정의는 `footSum` 옵션으로 받는다. 본문 아래 `sticky bottom`으로 붙어 가로로는 컬럼과 같이 스크롤된다. 필터를 거친 행으로 계산한다. 고정 경계를 걸치는 칸은 고정 쪽에 글자를 둔다.
- **계산기:** sum·avg·min·max는 빈 값(null, undefined, 공백)과 숫자가 없는 글자를 세지 않는다 (아래 바 선택 합계와 같은 기준). 합은 넣은 값의 가장 긴 소수 자리에서 반올림해 부동소수 끝자리 오차(0.1 + 0.2 = 0.30000000000000004)를 지운다. money formatter도 숫자는 유효 숫자 15자리로 정리한 뒤 소수 2자리에서 자른다 (0.7999999999999999 → 0.8).
- **헤더 값 필터:** 목록은 다른 컬럼 조건에 걸린 행의 값만. 체크 상태는 그린 체크박스가 아니라 전체 값 기준으로 들고, 검색도 전체 값에서 한다. 그리는 것만 검색 결과 앞의 2,000개로 자른다 (값이 수만 개인 컬럼에서 확인만 눌러도 행이 줄지 않고, 그리지 않은 값도 검색·전체 선택에 들어간다). 확인 결과가 모든 값을 허용하면 조건 없음. 트리와 서버 페이징에서는 쓰지 않는다. 조건은 setData 뒤에도 남는다. 팝업은 click에서 열리므로 바깥 클릭 리스너를 바로 단다 (한 박자 늦게 달면 곧바로 바깥을 누를 때 닫히지 않았다).
- **필터 팝업 키:** Enter는 검색칸·목록에서만 적용하고, 단추에 포커스가 있으면 브라우저 기본 동작(그 단추 누르기)에 맡긴다. 조합 중(`isComposing`, keyCode 229)의 Enter·Esc는 무시한다.
- **빈 필터:** 아무 값도 고르지 않으면 확인 단추를 막는다 (그대로 누르면 모든 행이 사라진다. Excel과 같음).
- **트리:** 부모 키로 이어진 평평한 목록 (부모가 없거나 비었거나 "top"이면 맨 위, 순환은 맨 위로). 정렬은 형제끼리. 부모·자식 키는 글자로 바꿔 비교한다 (id 1과 pid "1"이 이어지게).
- **셀 병합:** 위 행과 글자가 같고 왼쪽 병합 컬럼도 이어질 때 합친다 (편집기 컬럼 제외). 가상 스크롤과 함께 쓰려고 rowspan 대신 덩어리 안 가로선을 지운다. 글자는 모든 칸에 넣고(`.pyo-merge-text`), 그린 뒤·스크롤할 때마다 덩어리와 보이는 범위가 겹치는 구간의 가운데 행만 보이게 class를 바꾼다. 그래서 화면보다 긴 덩어리에서도 글자가 화면 안에 있고, 행을 다시 만들지 않는다. 덩어리 계산은 행 목록·컬럼·병합 컬럼 값이 바뀔 때만 다시 하고, 그 밖의 셀을 고칠 때는 기억해 둔 결과를 쓴다 (5만 행에서 셀 하나 고치기 7ms → 0.1ms).

## 내보내기·기억

- **xlsx:** SheetJS(`window.XLSX` 또는 `opts.XLSX`)가 있을 때만 쓰고, 없으면 경고와 함께 false. 화면 그대로(필터·정렬·그룹 합계·합계 행) 내보낸다. 숫자 판단: 쉼표 숫자 → 숫자 + `#,##0`, 원래 값이 숫자이거나 money·오른쪽 정렬·합계 칸이면 숫자, 앞자리 0 코드는 글자. 다단 헤더와 합계 칸 colspan은 병합 셀. ".xls" 이름은 ".xlsx"로 바꾼다. 셀 글자에서 HTML을 걷어낼 때는 스크립트를 실행하지 않는 빈 문서 하나를 다시 쓴다 (셀마다 DOMParser를 만들지 않음).
- **너비·정렬 기억:** localStorage `"pyogrid:" + 경로 + ":" + stateKey`에 `{widths: {컬럼키: px}, sort: [{key, dir}]}`. 사용자가 너비를 끌거나 헤더로 정렬할 때 저장하고, 생성·`setColumns` 때 되살린다. 지금 컬럼에 없는 키의 너비는 지우지 않는다. 10px 이하 너비, 정렬할 수 없게 된 컬럼, 깨진 저장값은 무시한다.

## 개발 도구

- **ESLint·Prettier:** 넣을 때 코드가 이미 거의 Prettier 모양(2칸, 큰따옴표, 세미콜론, 끝 쉼표)이었다. 줄 너비를 120~180으로 바꿔 가며 바뀌는 줄 수를 세어 가장 적은 160으로 정했다 (src·tools 합쳐 30여 줄). 서식만 바꾼 커밋은 `.git-blame-ignore-revs`에 적어 blame이 그 커밋을 건너뛰게 한다.
- **Prettier 범위:** src/, tools/, 설정 파일만 맞춘다. test/는 기존 테스트를 서식 때문에 고치지 않으려고, demo/는 한 줄에 한 행씩 쓴 데모 데이터가 수십 줄로 펼쳐져서, CSS는 규칙을 한 줄에 쓰는 모양을 두려고 뺐다. `endOfLine: "auto"`는 Windows 작업 트리(CRLF)와 CI(LF)를 모두 통과시키려는 것이다.
- **JSDoc 타입 변환과 Prettier:** Prettier는 `(/** @type {T} */ (b).x = v)`의 괄호를 `/** @type {T} */ ((b).x = v)`로 옮겨, 타입 변환이 b가 아니라 대입식 전체에 붙는다 (filter.js에서 tsc 오류). 그런 줄은 `// prettier-ignore`로 둔다.
- **ESLint 규칙:** `recommended`에 두 가지만 풀었다. `catch (e)`의 쓰지 않는 e와 `_`로 시작하는 인자는 이 저장소의 관례다. 넣을 때 이미 있던 지적 4곳(쓰지 않는 import·인자, 문자 집합의 `\-`)은 코드를 고치지 않고 그 파일만 경고로 두었다. 고치면 eslint.config.js의 해당 블록을 지운다.
- **커버리지:** vitest의 V8 커버리지로 src/만 센다. 기준은 넣을 때 잰 값을 소수 첫째 자리에서 내린 값이다 (같은 코드를 두 번 재도 같은 값이 나왔다). 기준을 정수로 잡으면 1%가까이 떨어져도 통과하므로 소수 첫째 자리로 했다. 테스트를 더해 수치가 오르면 기준도 손으로 올린다. CI는 단위 테스트를 한 번만 돌리도록 `test:unit` 대신 `test:coverage`를 돌리고 표를 작업 요약에 붙인다.
- **자동 배포:** 테스트는 test.yml을 `workflow_call`로 그대로 불러, push 때와 배포 때 같은 검사를 한다 (따로 적으면 둘이 어긋난다). npm 배포는 토큰 없이 trusted publishing(OIDC)으로 하고, 기본은 `npm stage publish`다. 손으로 배포할 때도 Staged Packages에서 Approve하던 흐름을 그대로 두고, CI가 잘못 올린 것을 공개 전에 막을 수 있다. 배포 작업에서는 `prepublishOnly`를 건너뛴다 (테스트는 앞 작업에서 끝났고, Chrome e2e를 또 돌리려면 브라우저를 설치해야 한다). 확인 단계(태그·버전·CHANGELOG)를 테스트보다 앞에 둬서 CHANGELOG를 빠뜨린 태그는 몇 초 만에 멈춘다. 버전에 `-`가 있으면 dist-tag `next`로 올려 `latest`를 건드리지 않는다.
- **성능 회귀:** probe-big·probe-frames의 측정 부분을 함수로 내보내고(직접 실행하면 전과 같은 출력), perf-check가 big.html을 5번 재서 항목마다 중간값을 `tools/perf-baseline.json`과 비교한다. 기준 × 1.5를 넘으면 경고한다. 처음에는 실패시키지 않는다: 이 PC에서도 `initAndSetData`가 실행마다 28ms에서 60ms까지 오갔다. 기준은 이 PC(Windows, 설치된 Chrome)에서 잰 값이라 CI 기계와 다르다. CI 작업 요약에 잰 값이 JSON으로 찍히므로, 몇 번 돌려 본 뒤 그 값으로 기준을 바꾸고, 편차를 보고 나서 실패시킬지 정한다.
- **기여 안내·이슈 양식:** CONTRIBUTING.md와 이슈 양식은 README처럼 영어로 쓴다 (밖의 기여자가 읽는다). 이슈는 양식으로만 열게 했다 (`blank_issues_enabled: false`). 버그 양식은 재현 코드·버전·브라우저와 함께 IME 입력 여부를 묻는다 (한글 입력 문제는 브라우저·OS마다 달라서). 보안 문제는 공개 이슈 대신 GitHub의 비공개 취약점 신고로 받는다.
- **한국어 API 문서:** README.md의 옵션·컬럼·메서드·이벤트 절을 docs/api.ko.md로 옮겼다. 영어 문서가 기준이다. 번역은 기계로 비교할 수 없으므로, 검사(`tools/check-docs.mjs`)는 구성만 본다: 절 목록과 순서, 표 첫 칸의 이름(옵션·메서드·이벤트), 표 행 수, 코드 블록 수. 영어에 메서드 하나를 더하고 한국어를 잊으면 잡힌다. 한국어 제목은 영어 절 이름과 글자가 달라서, 제목 다음 줄에 `<!-- en: Grid options -->`를 적어 짝을 표시한다 (제목 안에 넣으면 GitHub 앵커가 바뀐다).
