import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { editorTypes, sameValue } from "../../src/editors/types.js";
import { mockLayout, unmockLayout } from "./helpers.js";

let host;
beforeEach(() => {
  mockLayout();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  unmockLayout();
});

// 서버에서 온 값이 편집기 제한(min·decimal) 밖에 있는 경우
const cols = () => [
  { key: "a", editor: { type: "number", config: { min: 0 } } },
  { key: "b", editor: { type: "number", config: { decimal: 0 } } },
  { key: "t", editor: { type: "text" } },
  { key: "m", editor: { type: "money" } },
];
const setup = () => {
  const grid = new PyoGrid(host, { columns: cols() });
  const rows = [{ a: -5, b: 1.5, t: 0, m: "1,200" }];
  grid.setData(rows);
  return { grid, rows, input: grid.editing.input };
};
const edit = (grid, c, text) => {
  grid.startEdit(0, c);
  if (text !== undefined) grid.editing.input.value = text;
  return grid.commitEdit();
};

describe("sameValue: 보정이 일어나면 같은 값이 아니다", () => {
  it("min·decimal로 바뀐 기존 값", () => {
    expect(sameValue(editorTypes.number, { min: 0 }, -5, 0)).toBe(false);
    expect(sameValue(editorTypes.number, { decimal: 0 }, 1.5, 2)).toBe(false);
    expect(sameValue(editorTypes.number, { min: 0 }, -5, -5)).toBe(true);
  });
  it("서식만 다른 값은 여전히 같다", () => {
    expect(sameValue(editorTypes.text, {}, 0, "0")).toBe(true);
    expect(sameValue(editorTypes.money, {}, "1,200", 1200)).toBe(true);
    expect(sameValue(editorTypes.number, { min: 0 }, "5", 5)).toBe(true);
  });
});

describe("편집기 제한 밖의 기존 값을 고칠 수 있다", () => {
  it("편집: -5 → 0, 1.5 → 2", () => {
    const { grid, rows } = setup();
    expect(edit(grid, 0, "0")).toBe(true);
    expect(rows[0].a).toBe(0);
    expect(edit(grid, 1, "2")).toBe(true);
    expect(rows[0].b).toBe(2);
    expect(rows[0].__modified__).toBe(true);
    expect(grid.canUndo).toBe(true);
  });

  it("편집: 글자를 그대로 두고 Enter면 기존 값을 보정하지 않는다", () => {
    const { grid, rows } = setup();
    for (const c of [0, 1, 2, 3]) expect(edit(grid, c)).toBe(true);
    expect(rows[0]).toEqual({ a: -5, b: 1.5, t: 0, m: "1,200" });
    expect(grid.canUndo).toBe(false);
  });

  it("편집: 글자를 지웠다 같은 뜻으로 다시 치면 그대로 (text 0)", () => {
    const { grid, rows } = setup();
    edit(grid, 2, "0");
    edit(grid, 3, "1200");
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("붙여넣기: -5 칸에 0, 1.5 칸에 2", () => {
    const { grid, rows } = setup();
    grid.setRange(0, 0);
    expect(grid.paste("0\t2")).toMatchObject({ applied: 2, skipped: 0 });
    expect(rows[0]).toMatchObject({ a: 0, b: 2 });
  });

  it("붙여넣기: 같은 뜻의 값은 여전히 수정이 아니다", () => {
    const { grid, rows } = setup();
    grid.setRange(0, 2);
    expect(grid.paste("0\t1200")).toMatchObject({ applied: 0 });
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("타이핑으로 시작한 편집도 경계값으로 고친다", () => {
    const { grid, rows, input } = setup();
    grid.setRange(0, 0);
    grid.startEdit(0, 0, { mode: "type" });
    input.value = "0";
    grid.commitEdit();
    expect(rows[0].a).toBe(0);
  });
});
