import { describe, it, expect, vi, afterEach } from "vitest";
import { parseKeyPath, getValue, setValue, escapeHtml, toNumber, deepMerge, deprecate } from "../../src/util.js";
import { money } from "../../src/core/formatters.js";

describe("parseKeyPath / getValue / setValue", () => {
  it("일반 키는 경로가 아니다", () => {
    expect(parseKeyPath("CODE")).toBeNull();
  });
  it("점·대괄호(따옴표, 한글, 숫자) 경로를 해석한다", () => {
    expect(parseKeyPath("a.b.c")).toEqual(["a", "b", "c"]);
    expect(parseKeyPath("companyJson['대표자명']")).toEqual(["companyJson", "대표자명"]);
    expect(parseKeyPath('x["a b"].y')).toEqual(["x", "a b", "y"]);
    expect(parseKeyPath("list[0].name")).toEqual(["list", "0", "name"]);
  });
  it("경로 값을 읽고 쓴다", () => {
    const row = { companyJson: { 대표자명: "홍길동" }, list: [{ name: "a" }] };
    expect(getValue(row, "companyJson['대표자명']")).toBe("홍길동");
    expect(getValue(row, "list[0].name")).toBe("a");
    expect(getValue(row, "none.x")).toBeUndefined();
    expect(setValue(row, "companyJson['대표자명']", "김")).toBe(true);
    expect(row.companyJson.대표자명).toBe("김");
    expect(setValue(row, "none.x", 1)).toBe(false);
  });
});

describe("escapeHtml / toNumber / deepMerge", () => {
  it("escapeHtml", () => {
    expect(escapeHtml('<b a="1">&\'')).toBe("&lt;b a=&quot;1&quot;&gt;&amp;&#39;");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(0)).toBe("0");
  });
  it("toNumber는 쉼표 숫자 문자열만 숫자로 본다", () => {
    expect(toNumber("1,200")).toBe(1200);
    expect(toNumber(" -12.5 ")).toBe(-12.5);
    expect(toNumber("12,00")).toBeNull();
    expect(toNumber("0012")).toBe(12);
    expect(toNumber("abc")).toBeNull();
  });
  it("deepMerge는 일반 객체만 병합하고 배열은 대입한다", () => {
    const cols = [{ key: "a" }];
    const out = deepMerge({}, { body: { a: 1 }, list: [1] }, { body: { b: 2 }, columns: cols });
    expect(out).toEqual({ body: { a: 1, b: 2 }, list: [1], columns: cols });
    expect(out.columns).toBe(cols);
  });
});

describe("money formatter", () => {
  const f = (v) => money({ value: v });
  it.each([
    [1234567, "1,234,567"],
    ["1234567", "1,234,567"],
    [0, "0"],
    [-1234, "-1,234"],
    ["1234.567", "1,234.56"],
    [12.5, "12.5"],
    ["1,200", "1,200"],
    [undefined, ""],
    [null, ""],
    ["", ""],
  ])("%s → %s", (v, expected) => {
    expect(f(v)).toBe(expected);
  });
});

describe("deprecate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("같은 id는 한 번만 console.warn으로 알린다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    deprecate("test-once", "oldOption is deprecated. Use newOption instead.");
    deprecate("test-once", "oldOption is deprecated. Use newOption instead.");
    deprecate("test-once", "다른 문구여도 id가 같으면 다시 알리지 않는다");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[pyogrid] oldOption is deprecated. Use newOption instead.");
  });

  it("id가 다르면 따로 알린다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    deprecate("test-a", "a is deprecated.");
    deprecate("test-b", "b is deprecated.");
    deprecate("test-a", "a is deprecated.");
    expect(warn.mock.calls).toEqual([["[pyogrid] a is deprecated."], ["[pyogrid] b is deprecated."]]);
  });

  it("아무것도 돌려주지 않고 예외도 던지지 않는다", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(deprecate("test-return", "x")).toBeUndefined();
  });
});
