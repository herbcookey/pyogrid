import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { parseTSV, buildTSV, tsvCell, convertPasteValue, pastePlan } from "../../src/features/clipboard.js";
import { History } from "../../src/features/history.js";
import { mockLayout, unmockLayout, cellsOf } from "./helpers.js";

describe("TSV", () => {
  it("parseTSV: 탭·줄바꿈, 따옴표 칸 안의 탭·줄바꿈·\"\", 끝 줄바꿈 무시, CRLF", () => {
    expect(parseTSV("a\tb\r\nc\td\r\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseTSV('"x\ty"\t"줄1\n줄2"\t"그는 ""네"""')).toEqual([["x\ty", "줄1\n줄2", '그는 "네"']]);
    expect(parseTSV("a\t\tc")).toEqual([["a", "", "c"]]);
    expect(parseTSV("")).toEqual([]);
    expect(parseTSV("1,200")).toEqual([["1,200"]]);
  });
  it("buildTSV는 parseTSV로 되돌아온다", () => {
    const data = [["a", 'b"c', "d\te"], [1, null, "줄\n바꿈"]];
    expect(tsvCell(null)).toBe("");
    const back = parseTSV(buildTSV(data));
    expect(back).toEqual([["a", 'b"c', "d\te"], ["1", "", "줄\n바꿈"]]);
  });
  it("convertPasteValue", () => {
    expect(convertPasteValue({ type: "money" }, " 1,200 ")).toEqual({ ok: true, value: 1200 });
    expect(convertPasteValue({ type: "number" }, "abc")).toEqual({ ok: false });
    expect(convertPasteValue({ type: "number" }, "")).toEqual({ ok: true, value: "" });
    expect(convertPasteValue({ type: "date" }, "2026.11.12")).toEqual({ ok: true, value: "2026-11-12" });
    expect(convertPasteValue({ type: "date" }, "내일")).toEqual({ ok: false });
    const sel = { type: "select", config: { options: [{ value: "A", text: "가공" }] } };
    expect(convertPasteValue(sel, "가공")).toEqual({ ok: true, value: "A" });
    expect(convertPasteValue(sel, "A")).toEqual({ ok: true, value: "A" });
    expect(convertPasteValue(sel, "없음")).toEqual({ ok: false });
    const yn = { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } };
    expect(convertPasteValue(yn, "Y")).toEqual({ ok: true, value: "Y" });
    expect(convertPasteValue(yn, "TRUE")).toEqual({ ok: true, value: "Y" });
    expect(convertPasteValue(yn, "몰라")).toEqual({ ok: false });
    expect(convertPasteValue({ type: "text" }, "  공백 유지 ")).toEqual({ ok: true, value: "  공백 유지 " });
  });
  it("pastePlan: 묶음 그대로 / 1칸 채우기 / 정수배 반복", () => {
    const one = pastePlan([["x"]], { r0: 1, c0: 1, r1: 2, c1: 2 });
    expect(one.map((p) => [p.r, p.c, p.text])).toEqual([[1, 1, "x"], [1, 2, "x"], [2, 1, "x"], [2, 2, "x"]]);
    const block = pastePlan([["a", "b"], ["c", "d"]], { r0: 5, c0: 0, r1: 5, c1: 0 });
    expect(block.map((p) => [p.r, p.c, p.text])).toEqual([[5, 0, "a"], [5, 1, "b"], [6, 0, "c"], [6, 1, "d"]]);
    const tile = pastePlan([["a", "b"]], { r0: 0, c0: 0, r1: 1, c1: 3 });
    expect(tile.map((p) => p.text).join("")).toBe("ababab" + "ab");
    const ragged = pastePlan([["a", "b"], ["c"]], { r0: 0, c0: 0, r1: 0, c1: 0 });
    expect(ragged).toHaveLength(3);
  });
});

describe("History", () => {
  it("한도, 새 기록은 다시 실행 목록을 지운다", () => {
    const h = new History(2);
    const e = (n) => ({ source: "edit", changes: [{ row: {}, key: "k", oldValue: n, value: n + 1 }] });
    h.push(e(1));
    h.push(e(2));
    h.push(e(3));
    expect(h.undoStack.map((x) => x.changes[0].oldValue)).toEqual([2, 3]);
    h.popUndo();
    expect(h.canRedo).toBe(true);
    h.push(e(4));
    expect(h.canRedo).toBe(false);
    h.push({ source: "edit", changes: [] });
    expect(h.undoStack).toHaveLength(2);
  });
});

let host;
beforeEach(() => {
  mockLayout();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  unmockLayout();
  vi.useRealTimers();
});

const columns = [
  { key: "name", editor: { type: "text" } },
  { key: "qty", editor: { type: "number" } },
  { key: "amt", formatter: "money", editor: { type: "money" } },
  { key: "ro" },
  { key: "use", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
];
const data = () => Array.from({ length: 5 }, (_, i) => ({ name: "n" + i, qty: i, amt: i * 1000, ro: "r" + i, use: "N" }));
const key = (input, k, init = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
function clip(input, type, text) {
  const store = { "text/plain": text || "" };
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", { value: { getData: (t) => store[t] || "", setData: (t, v) => (store[t] = v) } });
  input.dispatchEvent(ev);
  return { ev, text: store["text/plain"] };
}

describe("복사·붙여넣기·잘라내기", () => {
  it("복사는 formatter를 거치지 않은 값을 TSV로", () => {
    const grid = new PyoGrid(host, { columns });
    grid.setData(data());
    grid.setRange(1, 0, 2, 3);
    expect(grid.getRangeText()).toBe("n1\t1\t1000\tr1\r\nn2\t2\t2000\tr2");
    const { ev, text } = clip(grid.editing.input, "copy");
    expect(ev.defaultPrevented).toBe(true);
    expect(text).toBe("n1\t1\t1000\tr1\r\nn2\t2\t2000\tr2");
  });

  it("붙여넣기: 편집 가능한 칸만, 맞지 않는 값은 건너뛰고, 한 번의 batchchange", () => {
    const grid = new PyoGrid(host, { columns });
    const rows = data();
    grid.setData(rows);
    const batches = [];
    const pastes = [];
    grid.on("batchchange", (e) => batches.push(e));
    grid.on("paste", (e) => pastes.push(e));
    grid.setRange(0, 0);
    clip(grid.editing.input, "paste", "가\t10\t1,500\tX\tY\r\n나\tabc\t2,000\tX\tN\r\n");
    expect(rows[0]).toMatchObject({ name: "가", qty: 10, amt: 1500, ro: "r0", use: "Y" });
    expect(rows[1]).toMatchObject({ name: "나", qty: 1, amt: 2000, ro: "r1", use: "N" });
    expect(pastes[0]).toEqual({ applied: 6, skipped: 3, rows: 2 }); // ro 2칸 + abc 1칸
    expect(batches).toHaveLength(1);
    expect(batches[0].source).toBe("paste");
    expect(grid.getRange()).toMatchObject({ r0: 0, c0: 0, r1: 1, c1: 4 });
    expect(cellsOf(grid, 0)[2].textContent).toBe("1,500");
  });

  it("표 밖으로 넘치는 칸은 건너뛴다, 1칸은 선택 범위를 채운다", () => {
    const grid = new PyoGrid(host, { columns });
    const rows = data();
    grid.setData(rows);
    grid.setRange(4, 1);
    expect(grid.paste("7\n8\n9")).toEqual({ applied: 1, skipped: 2, rows: 3 });
    grid.setRange(0, 1, 2, 2);
    grid.paste("0");
    expect(rows.slice(0, 3).map((r) => [r.qty, r.amt])).toEqual([[0, 0], [0, 0], [0, 0]]);
  });

  it("편집 중이면 붙여넣기는 입력칸 기본 동작", () => {
    const grid = new PyoGrid(host, { columns });
    grid.setData(data());
    grid.setRange(0, 0);
    grid.startEdit(0, 0);
    const { ev } = clip(grid.editing.input, "paste", "a\tb");
    expect(ev.defaultPrevented).toBe(false);
  });

  it("잘라내기: 복사하고 지운다 (편집 가능한 칸만)", () => {
    const grid = new PyoGrid(host, { columns });
    const rows = data();
    grid.setData(rows);
    grid.setRange(0, 0, 0, 3);
    const { text } = clip(grid.editing.input, "cut");
    expect(text).toBe("n0\t0\t0\tr0");
    expect(rows[0]).toMatchObject({ name: "", qty: "", amt: "", ro: "r0" }); // 0도 값이므로 지운다
  });
});

describe("실행 취소·다시 실행", () => {
  it("붙여넣기를 한 번에 되돌리고 다시 적용, 아래 바 문구", () => {
    vi.useFakeTimers();
    const grid = new PyoGrid(host, { columns });
    const rows = data();
    grid.setData(rows);
    grid.setRange(0, 0);
    grid.paste("a\t1\nb\t2");
    expect(rows.slice(0, 2).map((r) => r.name)).toEqual(["a", "b"]);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    key(grid.editing.input, "z", { ctrlKey: true });
    expect(rows.slice(0, 2).map((r) => [r.name, r.qty])).toEqual([["n0", 0], ["n1", 1]]);
    expect(changes.every((c) => c.source === "undo")).toBe(true);
    expect(grid.el.summary.textContent).toBe("실행 취소: 붙여넣기 4셀");
    expect(grid.getRange()).toMatchObject({ r0: 0, c0: 0, r1: 1, c1: 1 });
    key(grid.editing.input, "y", { ctrlKey: true });
    expect(rows.slice(0, 2).map((r) => [r.name, r.qty])).toEqual([["a", 1], ["b", 2]]);
    key(grid.editing.input, "Z", { ctrlKey: true, shiftKey: true }); // 다시 실행할 것 없음
    expect(grid.el.summary.textContent).toBe("다시 실행할 작업이 없습니다");
    vi.advanceTimersByTime(3000);
    expect(grid.el.summary.dataset.flash).toBeUndefined();
  });

  it("여러 단계: 편집 → Delete → 붙여넣기를 차례로 되돌린다", () => {
    const grid = new PyoGrid(host, { columns });
    const rows = data();
    grid.setData(rows);
    grid.setValue(0, "name", "프로그램"); // API 변경은 기록하지 않는다
    grid.setRange(1, 0);
    grid.startEdit(1, 0);
    grid.editing.input.value = "편집";
    grid.commitEdit();
    grid.setRange(2, 0);
    key(grid.editing.input, "Delete");
    grid.setRange(3, 0);
    grid.paste("붙임");
    expect(rows.map((r) => r.name)).toEqual(["프로그램", "편집", "", "붙임", "n4"]);
    grid.undo();
    grid.undo();
    grid.undo();
    expect(rows.map((r) => r.name)).toEqual(["프로그램", "n1", "n2", "n3", "n4"]);
    expect(grid.undo()).toBe(false);
    expect(grid.canRedo).toBe(true);
  });

  it("정렬로 행 순서가 바뀌어도 그 행을 되돌린다, 같은 셀 여러 번은 처음 값으로", () => {
    const grid = new PyoGrid(host, { columns, sortable: true });
    const rows = data();
    grid.setData(rows);
    grid.setRange(0, 1);
    grid.paste("100");
    grid.setSort([{ key: "qty", dir: "desc" }]);
    expect(grid.getRow(0)).toBe(rows[0]);
    grid.undo();
    expect(rows[0].qty).toBe(0);
    // 한 붙여넣기 안에서 같은 셀이 두 번 바뀌는 일은 없지만, 기록 순서가 거꾸로 적용되는지 확인
    grid.history.push({ source: "edit", changes: [{ row: rows[1], key: "qty", oldValue: 1, value: 5 }, { row: rows[1], key: "qty", oldValue: 5, value: 9 }] });
    rows[1].qty = 9;
    grid.undo();
    expect(rows[1].qty).toBe(1);
  });

  it("setData는 기록을 지운다, undo:false면 Ctrl+Z 무시", () => {
    const grid = new PyoGrid(host, { columns });
    grid.setData(data());
    grid.setRange(0, 0);
    grid.paste("x");
    grid.setData(data());
    expect(grid.canUndo).toBe(false);
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), { columns, undo: false });
    const rows = data();
    g2.setData(rows);
    g2.setRange(0, 0);
    g2.paste("x");
    key(g2.editing.input, "z", { ctrlKey: true });
    expect(rows[0].name).toBe("x");
  });
});
