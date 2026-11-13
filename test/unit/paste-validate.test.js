import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { convertPasteValue } from "../../src/features/clipboard.js";
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
  delete editorTypes.upper;
  unmockLayout();
});

describe("붙여넣기는 편집기 검증을 거친다", () => {
  it("number min·max·decimal: 편집할 때와 같은 값", () => {
    const ed = { type: "number", config: { min: 0, decimal: 0 } };
    expect(convertPasteValue(ed, "-5.5")).toEqual({ ok: true, value: 0 });
    expect(convertPasteValue(ed, "7.6")).toEqual({ ok: true, value: 8 });
    expect(convertPasteValue({ type: "money", config: { max: 100 } }, "1,200")).toEqual({ ok: true, value: 100 });
    expect(convertPasteValue({ type: "number" }, "abc")).toEqual({ ok: false });
    // 편집 저장과 같은 결과
    expect(convertPasteValue(ed, "-5.5")).toEqual(editorTypes.number.parse("-5.5", ed.config));
  });

  it("maxlength로 자른다 (text는 공백 유지)", () => {
    const ed = { type: "text", attributes: { maxlength: 3 } };
    expect(convertPasteValue(ed, "12345678")).toEqual({ ok: true, value: "123" });
    expect(convertPasteValue({ type: "text", attributes: { maxLength: "4" } }, " ab ")).toEqual({ ok: true, value: " ab " });
    expect(convertPasteValue({ type: "number", attributes: { maxlength: 2 } }, "12345")).toEqual({ ok: true, value: 12 });
  });

  it("사용자 편집기의 parse를 쓴다 (ok:false면 건너뜀)", () => {
    editorTypes.upper = {
      kind: "input", typeToEdit: true, clearable: true,
      format: (v) => (v == null ? "" : String(v)),
      parse: (s) => (/^[a-z]+$/i.test(s) ? { ok: true, value: s.toUpperCase() } : { ok: false }),
    };
    expect(convertPasteValue({ type: "upper" }, "abc")).toEqual({ ok: true, value: "ABC" });
    expect(convertPasteValue({ type: "upper" }, "a-1")).toEqual({ ok: false });
  });

  it("그리드: 막힌 값은 건너뛰고 나머지는 검증한 값으로", () => {
    editorTypes.upper = { kind: "input", format: (v) => String(v ?? ""), parse: (s) => (/^[a-z]*$/i.test(s) ? { ok: true, value: s.toUpperCase() } : { ok: false }) };
    const grid = new PyoGrid(host, {
      columns: [
        { key: "qty", editor: { type: "number", config: { min: 0, decimal: 0 } } },
        { key: "code", editor: { type: "text", attributes: { maxlength: 3 } } },
        { key: "tag", editor: { type: "upper" } },
      ],
    });
    const rows = [{ qty: 1, code: "", tag: "" }];
    grid.setData(rows);
    grid.setRange(0, 0);
    const r = grid.paste("-5.5\tABCDEFGH\tok-1");
    expect(rows[0]).toMatchObject({ qty: 0, code: "ABC", tag: "" });
    expect(r).toEqual({ applied: 2, skipped: 1, rows: 1 });
  });
});

describe("값을 안 바꾸면 수정된 행이 되지 않는다", () => {
  it("sameValue", () => {
    expect(sameValue(editorTypes.text, {}, 0, "0")).toBe(true);
    expect(sameValue(editorTypes.money, {}, "1,200", 1200)).toBe(true);
    expect(sameValue(editorTypes.number, {}, "", "")).toBe(true);
    expect(sameValue(editorTypes.number, {}, 5, 6)).toBe(false);
    expect(sameValue(editorTypes.text, {}, 0, "00")).toBe(false);
    expect(sameValue({ kind: "list" }, {}, 1, "1")).toBe(true);
  });

  it("F2 → Enter: text 칸의 0, money 칸의 \"1,200\"은 그대로, 기록·이벤트 없음", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "t", editor: { type: "text" } }, { key: "m", formatter: "money", editor: { type: "money" } }, { key: "d", editor: { type: "date" } }],
    });
    const rows = [{ t: 0, m: "1,200", d: "2026-11-12" }];
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    for (const c of [0, 1, 2]) {
      grid.startEdit(0, c);
      expect(grid.commitEdit()).toBe(true);
    }
    expect(rows[0]).toEqual({ t: 0, m: "1,200", d: "2026-11-12" });
    expect(rows[0].__modified__).toBeUndefined();
    expect(grid.canUndo).toBe(false);
    expect(changes).toEqual([]);
    // 실제로 바꾸면 기록된다
    grid.startEdit(0, 1);
    grid.editing.input.value = "1,300";
    grid.commitEdit();
    expect(rows[0].m).toBe(1300);
    expect(rows[0].__modified__).toBe(true);
    expect(grid.canUndo).toBe(true);
  });

  it("같은 값을 붙여넣어도 수정되지 않는다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "t", editor: { type: "text" } }, { key: "m", editor: { type: "money" } }] });
    const rows = [{ t: 0, m: "1,200" }];
    grid.setData(rows);
    grid.setRange(0, 0);
    expect(grid.paste("0\t1200")).toMatchObject({ applied: 0, skipped: 0 });
    expect(rows[0].__modified__).toBeUndefined();
    expect(grid.canUndo).toBe(false);
  });
});
