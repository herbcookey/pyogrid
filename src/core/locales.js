// @ts-check
/**
 * 그리드가 화면에 보여 주는 문구 (locale 옵션으로 고르고, messages 옵션으로 일부를 바꾼다).
 * 숫자 인자는 이미 천 단위 쉼표를 넣은 글자로 넘어온다.
 */

/**
 * @typedef {Object} Messages
 * @property {string} empty                 데이터가 없을 때 (emptyText 옵션이 우선)
 * @property {string} noFilterMatch         필터 조건에 맞는 행이 없을 때
 * @property {string} filter                헤더 필터 단추 이름
 * @property {(column: string) => string} filterDialog  필터 팝업 이름 (스크린 리더)
 * @property {string} filterSearch          필터 검색칸 안내
 * @property {string} selectAll
 * @property {string} blank                 빈 값
 * @property {string} clear                 필터 초기화 단추
 * @property {string} ok
 * @property {string} cancel
 * @property {string} filterCondition       필터 팝업의 조건 고르기 이름
 * @property {string} filterNoCondition     조건 없음 (고르기의 첫 항목)
 * @property {string} condContains
 * @property {string} condStartsWith
 * @property {string} condEquals
 * @property {string} condNotEquals
 * @property {string} condGt
 * @property {string} condGe
 * @property {string} condLt
 * @property {string} condLe
 * @property {string} condBetween
 * @property {string} condValue             값 하나를 받는 조건의 입력칸 이름
 * @property {string} condFrom              범위 시작 입력칸 이름
 * @property {string} condTo                범위 끝 입력칸 이름
 * @property {(shown: string, total: string) => string} filterTruncated  값이 많아 일부만 그릴 때
 * @property {string} noOptions             select 편집기 항목이 없을 때
 * @property {string} cellInput             셀 입력칸 이름 (스크린 리더)
 * @property {string[]} weekdays            일요일부터 7개
 * @property {(year: number, month: number) => string} calendarTitle  month는 1~12
 * @property {string} prevMonth
 * @property {string} nextMonth
 * @property {string} today
 * @property {(count: string) => string} selected                      선택 합계: 셀 수
 * @property {(numCount: string, sum: string, avg: string) => string} selectedNumbers  선택 합계: 숫자
 * @property {(from: string, to: string, count: string) => string} status  오른쪽 상태 문구 (보이는 행 범위와 전체 행 수)
 * @property {(total: string) => string} statusTotal  서버 페이징일 때 상태 문구 뒤에 붙는 전체 건수
 * @property {string} summarySeparator      선택 합계 조각 사이
 * @property {{edit: string, clear: string, paste: string, cut: string}} actions  실행 취소 대상
 * @property {string} nothingToUndo
 * @property {string} nothingToRedo
 * @property {(action: string, count: string) => string} undone
 * @property {(action: string, count: string) => string} redone
 * @property {(count: string) => string} copied
 * @property {(count: string, skipped: string) => string} pasted       skipped가 "0"이면 건너뛴 칸 없음
 */

const cells = (n) => (n === "1" ? "1 cell" : n + " cells");

/** @type {Messages} */
const en = {
  empty: "No data",
  noFilterMatch: "No rows match the filter",
  filter: "Filter",
  filterDialog: (column) => "Filter " + column,
  filterSearch: "Search",
  selectAll: "(Select all)",
  blank: "(Blank)",
  clear: "Clear",
  filterCondition: "Condition",
  filterNoCondition: "(No condition)",
  condContains: "Contains",
  condStartsWith: "Starts with",
  condEquals: "Equals",
  condNotEquals: "Does not equal",
  condGt: "Greater than",
  condGe: "Greater than or equal to",
  condLt: "Less than",
  condLe: "Less than or equal to",
  condBetween: "Between",
  condValue: "Value",
  condFrom: "From",
  condTo: "To",
  ok: "OK",
  cancel: "Cancel",
  filterTruncated: (shown, total) => `Showing the first ${shown} of ${total}. Search to narrow the list.`,
  noOptions: "No options",
  cellInput: "Cell input",
  weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  calendarTitle: (year, month) =>
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1] + " " + year,
  prevMonth: "Previous month",
  nextMonth: "Next month",
  today: "Today",
  selected: (count) => cells(count) + " selected",
  selectedNumbers: (numCount, sum, avg) => `Numbers ${numCount} · Sum ${sum} · Average ${avg}`,
  status: (from, to, count) => `${from} - ${to} of ${count}`,
  statusTotal: (total) => "Total " + total,
  summarySeparator: " · ",
  actions: { edit: "edit", clear: "clear", paste: "paste", cut: "cut" },
  nothingToUndo: "Nothing to undo",
  nothingToRedo: "Nothing to redo",
  undone: (action, count) => `Undo ${action}: ${cells(count)}`,
  redone: (action, count) => `Redo ${action}: ${cells(count)}`,
  copied: (count) => "Copied " + cells(count),
  pasted: (count, skipped) => "Pasted " + cells(count) + (skipped !== "0" ? ` (${skipped} skipped)` : ""),
};

/** @type {Messages} */
const ko = {
  empty: "조회된 데이터가 없습니다.",
  noFilterMatch: "필터 조건에 맞는 데이터가 없습니다.",
  filter: "필터",
  filterDialog: (column) => column + " 필터",
  filterSearch: "검색",
  selectAll: "(전체 선택)",
  blank: "(빈 값)",
  clear: "초기화",
  filterCondition: "조건",
  filterNoCondition: "(조건 없음)",
  condContains: "포함",
  condStartsWith: "시작",
  condEquals: "같음",
  condNotEquals: "같지 않음",
  condGt: "보다 큼",
  condGe: "이상",
  condLt: "보다 작음",
  condLe: "이하",
  condBetween: "범위",
  condValue: "값",
  condFrom: "부터",
  condTo: "까지",
  ok: "확인",
  cancel: "취소",
  filterTruncated: (shown, total) => `${total}개 중 앞의 ${shown}개만 표시 (검색으로 좁히세요)`,
  noOptions: "항목 없음",
  cellInput: "셀 입력",
  weekdays: ["일", "월", "화", "수", "목", "금", "토"],
  calendarTitle: (year, month) => `${year}년 ${month}월`,
  prevMonth: "이전 달",
  nextMonth: "다음 달",
  today: "오늘",
  selected: (count) => `선택 ${count}셀`,
  selectedNumbers: (numCount, sum, avg) => `숫자 ${numCount} · 합계 ${sum} · 평균 ${avg}`,
  status: (from, to, count) => `${from} - ${to} / ${count}`,
  statusTotal: (total) => "전체 " + total,
  summarySeparator: " · ",
  actions: { edit: "셀 편집", clear: "지우기", paste: "붙여넣기", cut: "잘라내기" },
  nothingToUndo: "되돌릴 작업이 없습니다",
  nothingToRedo: "다시 실행할 작업이 없습니다",
  undone: (action, count) => `실행 취소: ${action} ${count}셀`,
  redone: (action, count) => `다시 실행: ${action} ${count}셀`,
  copied: (count) => `복사: ${count}셀`,
  pasted: (count, skipped) => `붙여넣기: ${count}셀` + (skipped !== "0" ? ` (건너뜀 ${skipped})` : ""),
};

/**
 * 내장 문구. 새 언어는 여기에 넣으면 locale 이름으로 쓸 수 있다 (빠진 문구는 영어로 채운다).
 * @type {Record<string, Partial<Messages>>}
 */
export const locales = { en, ko };

/**
 * locale 문구에 messages를 덮어 최종 문구를 만든다. 모르는 locale이면 영어.
 * @param {string|null|undefined} locale
 * @param {Partial<Messages>|null|undefined} [overrides]
 * @returns {Messages}
 */
export function resolveMessages(locale, overrides) {
  const base = (locale && locales[locale]) || (locale && locales[String(locale).split("-")[0].toLowerCase()]) || {};
  const out = /** @type {Messages} */ ({ ...en, ...base, ...(overrides || {}) });
  out.actions = { ...en.actions, ...(base.actions || {}), ...((overrides && overrides.actions) || {}) };
  return out;
}
