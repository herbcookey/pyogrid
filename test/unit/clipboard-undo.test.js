// 복사·잘라내기·붙여넣기와 실행 취소
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
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
  vi.useRealTimers();
});

const cols = [
  { key: "code", label: "코드" }, // 편집기 없음
  { key: "name", label: "이름", editor: { type: "text" } },
  { key: "qty", label: "수량", editor: { type: "number" } },
];
const data = () => [
  { code: "A", name: "가", qty: 1 },
  { code: "B", name: "나", qty: 2 },
];

/** navigator.clipboard를 잠시 바꾼다 */
function withClipboard(writeText) {
  const desc = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return () => (desc ? Object.defineProperty(navigator, "clipboard", desc) : delete navigator.clipboard);
}

describe("clearHistory", () => {
  it("실행 취소·다시 실행 기록을 비우고 그리드를 돌려준다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = data();
    grid.setData(rows);
    grid.setRange(0, 1);
    grid.paste("다");
    grid.setRange(1, 1);
    grid.paste("라");
    grid.undo();
    expect(grid.canUndo).toBe(true);
    expect(grid.canRedo).toBe(true);
    expect(grid.clearHistory()).toBe(grid);
    expect(grid.canUndo).toBe(false);
    expect(grid.canRedo).toBe(false);
    expect(grid.undo()).toBe(false);
    expect(grid.redo()).toBe(false);
    expect(rows.map((r) => r.name)).toEqual(["다", "나"]); // 값은 그대로
  });
});

describe("copy", () => {
  it("성공하면 범위를 원래 값 TSV로 클립보드에 쓰고 true, copy 이벤트와 아래 바 문구", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const restore = withClipboard(writeText);
    try {
      const grid = new PyoGrid(host, { columns: cols });
      grid.setData(data());
      grid.setRange(0, 0, 1, 2);
      const events = [];
      grid.on("copy", (e) => events.push(e));
      await expect(grid.copy()).resolves.toBe(true);
      expect(writeText).toHaveBeenCalledWith("A\t가\t1\r\nB\t나\t2");
      expect(events).toEqual([{ range: grid.getRange(), text: "A\t가\t1\r\nB\t나\t2" }]);
      expect(grid.el.summary.textContent).toBe("Copied 6 cells");
    } finally {
      restore();
    }
  });

  it("클립보드 쓰기가 실패하면 false, copy 이벤트 없음", async () => {
    const restore = withClipboard(() => Promise.reject(new Error("NotAllowedError")));
    try {
      const grid = new PyoGrid(host, { columns: cols });
      grid.setData(data());
      grid.setRange(0, 0);
      const fn = vi.fn();
      grid.on("copy", fn);
      await expect(grid.copy()).resolves.toBe(false);
      expect(fn).not.toHaveBeenCalled();
      expect(grid.el.summary.textContent).not.toBe("Copied 1 cell");
    } finally {
      restore();
    }
  });

  it("범위가 없으면 클립보드를 건드리지 않고 false", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const restore = withClipboard(writeText);
    try {
      const grid = new PyoGrid(host, { columns: cols });
      grid.setData(data());
      await expect(grid.copy()).resolves.toBe(false);
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

describe("cut", () => {
  it("범위를 글자로 돌려주고 편집할 수 있는 셀을 비운다 (change source cut, 실행 취소로 되돌림)", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = data();
    grid.setData(rows);
    grid.setRange(0, 0, 1, 2);
    const sources = [];
    grid.on("change", (e) => sources.push(e.source));
    expect(grid.cut()).toBe("A\t가\t1\r\nB\t나\t2");
    expect(rows).toEqual([
      // 편집기가 없는 code는 비우지 않는다
      { code: "A", name: "", qty: "", __modified__: true },
      { code: "B", name: "", qty: "", __modified__: true },
    ]);
    expect(new Set(sources)).toEqual(new Set(["cut"]));
    expect(grid.undo()).toBe(true);
    expect(rows).toEqual(data());
  });

  it("범위가 없으면 빈 글자를 돌려주고 아무것도 바꾸지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = data();
    grid.setData(rows);
    expect(grid.cut()).toBe("");
    expect(rows).toEqual(data());
    expect(grid.canUndo).toBe(false);
  });
});
