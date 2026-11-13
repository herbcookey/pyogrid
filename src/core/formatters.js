// @ts-check
/**
 * 기본 formatter. this와 첫 인자 모두 {value, row, key, rowIndex, column, grid}.
 * 반환값은 HTML로 그대로 들어간다. 사용자 값을 넣을 때는 escapeHtml을 쓴다.
 */

/** money: 숫자 외 문자 제거, 천 단위 쉼표, 소수 2자리까지 자름(반올림 아님). */
export function money(ctx) {
  const value = (ctx || this).value;
  if (value === undefined) return "";
  const val = ("" + value).replace(/[^0-9^.^-]/g, "");
  const re = /([0-9])([0-9][0-9][0-9][,.])/;
  const parts = val.split(".");
  parts[0] += ".";
  do {
    parts[0] = parts[0].replace(re, "$1,$2");
  } while (re.test(parts[0]));
  return parts.length > 1 ? parts[0] + parts[1].substring(0, 2) : parts[0].split(".")[0];
}

/** @type {Record<string, (ctx: any) => any>} */
export const formatters = { money };
