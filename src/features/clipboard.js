// @ts-check
import { selectOptions, isChecked, checkboxValue, editorTypes, maxLengthOf } from "../editors/types.js";

/**
 * Excel 클립보드(TSV) 해석. 큰따옴표로 감싼 칸 안의 탭·줄바꿈·""를 지원한다.
 * 끝의 빈 줄(Excel이 붙이는 줄바꿈)은 버린다.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseTSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuote = false;
  const s = String(text || "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuote = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") inQuote = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** 값 하나를 TSV 칸으로 (탭·줄바꿈·큰따옴표가 있으면 감싼다) */
export function tsvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[\t\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** @param {any[][]} rows */
export function buildTSV(rows) {
  return rows.map((r) => r.map(tsvCell).join("\t")).join("\r\n");
}

/**
 * 붙여넣은 글자를 편집기 종류에 맞는 값으로 바꾼다. 맞지 않으면 {ok:false} (그 칸은 건너뜀).
 * 입력칸 편집기(text·number·money·date와 PyoGrid.editors에 등록한 kind:"input" 편집기)는
 * 편집할 때와 같은 parse(text, config)를 거친다 (min·max·decimal, 날짜 확인, 사용자 검증).
 * editor.attributes.maxlength가 있으면 그 길이로 자른다 (입력칸에 붙여넣을 때와 같음).
 * sanitize는 타이핑 중에만 쓴다. 붙여넣기에 쓰면 "abc"가 숫자 칸을 비우는 값이 되기 때문이다.
 * @param {{type: string, config?: any, attributes?: any}} editor
 * @param {string} raw
 */
export function convertPasteValue(editor, raw) {
  const cfg = editor.config || {};
  const type = editorTypes[editor.type];
  if (type && type.kind === "input" && type.parse) {
    // text는 공백·줄바꿈을 그대로 두고, 그 밖에는 앞뒤 공백을 지운다
    let text = editor.type === "text" ? String(raw).replace(/\r/g, "") : String(raw).trim();
    const max = maxLengthOf(editor);
    if (max && text.length > max) text = text.slice(0, max);
    return type.parse(text, cfg);
  }
  const s = String(raw).trim();
  switch (editor.type) {
    case "select": {
      if (s === "") return { ok: true, value: "" };
      const opt = selectOptions(cfg).find((o) => String(o.value) === s || o.text === s);
      return opt ? { ok: true, value: opt.value } : { ok: false };
    }
    case "checkbox": {
      const t = s.toLowerCase();
      if (cfg.trueValue !== undefined && (s === String(cfg.trueValue) || s === String(cfg.falseValue))) {
        return { ok: true, value: s === String(cfg.trueValue) ? cfg.trueValue : cfg.falseValue };
      }
      if (["true", "y", "1", "o", "예"].includes(t)) return { ok: true, value: checkboxValue(true, cfg) };
      if (["false", "n", "0", "x", "아니오", ""].includes(t)) return { ok: true, value: checkboxValue(false, cfg) };
      return { ok: false };
    }
    default:
      return { ok: true, value: s };
  }
}

/**
 * 붙여넣을 칸 배치. Excel처럼:
 *  - 1칸을 여러 칸 범위에 붙이면 범위를 채운다
 *  - 범위가 붙인 묶음의 정수배면 반복해서 채운다
 *  - 그 밖에는 범위 왼쪽 위부터 묶음 크기대로
 * @param {string[][]} data
 * @param {{r0:number,c0:number,r1:number,c1:number}} range
 * @returns {{r:number, c:number, text:string}[]}
 */
export function pastePlan(data, range) {
  const dr = data.length;
  let dc = 0;
  for (const r of data) if (r.length > dc) dc = r.length; // 줄이 수십만이어도 스택 초과가 나지 않게 반복문으로
  if (!dr || !dc) return [];
  const rr = range.r1 - range.r0 + 1;
  const rc = range.c1 - range.c0 + 1;
  const tile = (rr > 1 || rc > 1) && rr % dr === 0 && rc % dc === 0;
  const rows = tile ? rr : dr;
  const cols = tile ? rc : dc;
  const out = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const src = data[i % dr];
      const text = src[j % dc];
      if (text === undefined) continue;
      out.push({ r: range.r0 + i, c: range.c0 + j, text });
    }
  }
  return out;
}

export { isChecked };
