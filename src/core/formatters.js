// @ts-check
/**
 * 기본 formatter. this와 첫 인자 모두 {value, row, key, rowIndex, column, grid}.
 * 반환값은 HTML로 그대로 들어간다. 사용자 값을 넣을 때는 escapeHtml을 쓴다.
 */

/**
 * 숫자를 지수 표기 없는 글자로. 부동소수 끝자리 오차(0.1 + 0.7 = 0.7999999999999999)는
 * 유효 숫자 15자리로 지운다. 글자 값은 손대지 않는다.
 * @param {any} value
 */
function plain(value) {
  if (typeof value !== "number") return "" + value;
  if (!isFinite(value)) return "";
  const n = Number(value.toPrecision(15));
  const s = String(n);
  return /e/i.test(s) ? n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }) : s;
}

/** money: 숫자 외 문자 제거, 천 단위 쉼표, 소수 2자리까지 자름(반올림 아님). */
export function money(ctx) {
  const value = (ctx || this).value;
  if (value === undefined) return "";
  const val = plain(value).replace(/[^0-9^.^-]/g, "");
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
