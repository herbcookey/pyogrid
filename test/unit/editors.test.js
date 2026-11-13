import { describe, it, expect } from "vitest";
import {
  addCommas, sanitizeNumber, parseNumber, sanitizeDate, parseDate, selectOptions, isChecked, checkboxValue, editorTypes,
} from "../../src/editors/types.js";

describe("숫자 편집기", () => {
  it("addCommas", () => {
    expect(addCommas("1234567")).toBe("1,234,567");
    expect(addCommas("-1234.567")).toBe("-1,234.567");
    expect(addCommas("12")).toBe("12");
    expect(addCommas("")).toBe("");
  });
  it("sanitizeNumber: 숫자·맨 앞 -·점 하나만, decimal 제한", () => {
    expect(sanitizeNumber("a1,2-3.4.5ㄱ")).toBe("123.45");
    expect(sanitizeNumber("-12")).toBe("-12");
    expect(sanitizeNumber("1.2345", { decimal: 2 })).toBe("1.23");
    expect(sanitizeNumber("1.5", { decimal: 0 })).toBe("15");
  });
  it("parseNumber: 쉼표 허용, 빈 값은 '', 잘못된 값은 ok:false, min/max/decimal", () => {
    expect(parseNumber("1,200")).toEqual({ ok: true, value: 1200 });
    expect(parseNumber(" ")).toEqual({ ok: true, value: "" });
    expect(parseNumber("12a")).toEqual({ ok: false });
    expect(parseNumber("-")).toEqual({ ok: false });
    expect(parseNumber("150", { max: 100 })).toEqual({ ok: true, value: 100 });
    expect(parseNumber("-5", { min: 0 })).toEqual({ ok: true, value: 0 });
    expect(parseNumber("1.236", { decimal: 2 })).toEqual({ ok: true, value: 1.24 });
  });
  it("money는 편집 시작할 때 쉼표, 입력 중에도 쉼표", () => {
    expect(editorTypes.money.format(1234567)).toBe("1,234,567");
    expect(editorTypes.money.sanitize("12345")).toBe("12,345");
    expect(editorTypes.number.format("1,234")).toBe("1234");
    expect(editorTypes.money.format(null)).toBe("");
  });
});

describe("날짜 편집기", () => {
  it("sanitizeDate: 숫자만 남겨 하이픈", () => {
    expect(sanitizeDate("2026")).toBe("2026");
    expect(sanitizeDate("202611")).toBe("2026-11");
    expect(sanitizeDate("20261112")).toBe("2026-11-12");
    expect(sanitizeDate("2026-11-12x9")).toBe("2026-11-12");
  });
  it("parseDate: 여러 형식, 없는 날짜는 거부", () => {
    expect(parseDate("20261112")).toEqual({ ok: true, value: "2026-11-12" });
    expect(parseDate("2026.1.2")).toEqual({ ok: true, value: "2026-01-02" });
    expect(parseDate("2026/02/30")).toEqual({ ok: false });
    expect(parseDate("2026-13-01")).toEqual({ ok: false });
    expect(parseDate("")).toEqual({ ok: true, value: "" });
    expect(parseDate("abc")).toEqual({ ok: false });
  });
});

describe("선택 목록·체크박스", () => {
  it("selectOptions: columnKeys로 키 바꾸기, 원시값 목록", () => {
    expect(selectOptions({ options: [{ CD: "A", NM: "가" }], columnKeys: { optionValue: "CD", optionText: "NM" } })).toEqual([
      { value: "A", text: "가" },
    ]);
    expect(selectOptions({ options: ["x", 1] })).toEqual([{ value: "x", text: "x" }, { value: 1, text: "1" }]);
    expect(selectOptions(undefined)).toEqual([]);
  });
  it("isChecked / checkboxValue", () => {
    const yn = { trueValue: "Y", falseValue: "N" };
    expect(isChecked("Y", yn)).toBe(true);
    expect(isChecked("N", yn)).toBe(false);
    expect(checkboxValue(true, yn)).toBe("Y");
    expect(checkboxValue(false, yn)).toBe("N");
    expect(isChecked(true)).toBe(true);
    expect(isChecked("true")).toBe(true);
    expect(isChecked("false")).toBe(false);
    expect(checkboxValue(true)).toBe(true);
  });
});
