import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, cellsOf, SIZE } from "./helpers.js";

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

describe("선택 합계는 코드 글자를 더하지 않는다", () => {
  it("number 값과 숫자 컬럼의 숫자 글자만 센다", () => {
    const grid = new PyoGrid(host, {
      columns: [
        { key: "barcode" },                                  // 숫자 글자 코드
        { key: "date" },                                     // "20261113"
        { key: "amt", formatter: "money" },                  // 숫자 컬럼: "1,200"도 숫자
        { key: "qty", editor: { type: "number" } },          // 숫자 컬럼
        { key: "n" },                                        // number 값은 어느 컬럼이든 숫자
        { key: "code", numeric: true },                      // 직접 숫자 컬럼으로 지정
        { key: "price", formatter: "money", numeric: false }, // 직접 제외
      ],
    });
    grid.setData([{ barcode: "8800000010017", date: "20261113", amt: "1,200", qty: "3", n: 5, code: "7", price: 100 }]);
    grid.setRange(0, 0, 0, 6);
    // price는 numeric:false지만 값이 number라 센다
    expect(grid.getSelectionSummary()).toEqual({ count: 7, numCount: 5, sum: 1200 + 3 + 5 + 7 + 100, avg: (1200 + 3 + 5 + 7 + 100) / 5 });
    grid.setRange(0, 0, 0, 1);
    expect(grid.getSelectionSummary().numCount).toBe(0);
  });

  it("그룹 합계 행은 세지 않는다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "g" }, { key: "v" }],
      grouping: { by: ["g"], columns: [{ label: "소계" }, { key: "v", collector: "sum" }] },
    });
    grid.setData([{ g: "A", v: 1 }, { g: "A", v: 2 }]);
    grid.setRange(0, 1, 2, 1);
    expect(grid.getSelectionSummary()).toMatchObject({ count: 3, numCount: 2, sum: 3 });
  });
});

describe("큰 병합 덩어리도 글자가 보인다", () => {
  it("200행 덩어리: 보이는 부분 가운데 행에 글자, 스크롤하면 따라온다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "k" }, { key: "i" }], mergeCells: ["k"], pageBar: false });
    grid.setData(Array.from({ length: 200 }, (_, i) => ({ k: "같은 값", i })));
    const shown = () =>
      [...grid.el.body.querySelectorAll('.pyo-cell[data-c="0"]')]
        .filter((c) => !c.classList.contains("pyo-merge-hide"))
        .map((c) => Number(c.closest(".pyo-row").dataset.row));
    // 높이 400 - 헤더 27 = 373px → 0~14행이 보임, 가운데 7행
    expect(shown()).toEqual([7]);
    grid.el.scroll.scrollTop = 26 * 100;
    grid.refresh();
    const s = shown();
    expect(s).toHaveLength(1);
    expect(s[0]).toBeGreaterThanOrEqual(100);
    expect(s[0]).toBeLessThanOrEqual(100 + 14);
    // 덩어리 끝이 화면 안에 걸치면 보이는 부분의 가운데
    grid.el.scroll.scrollTop = 26 * 195;
    grid.refresh();
    expect(shown()).toEqual([197]);
    void SIZE;
  });

  it("짧은 덩어리는 전처럼 덩어리 가운데", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "k" }], mergeCells: true });
    grid.setData([{ k: "A" }, { k: "A" }, { k: "A" }, { k: "B" }, { k: "B" }]);
    const vis = [0, 1, 2, 3, 4].map((i) => !cellsOf(grid, i)[0].classList.contains("pyo-merge-hide"));
    expect(vis).toEqual([false, true, false, true, false]);
  });
});

describe("수정 표시", () => {
  const cols = [{ key: "a", editor: { type: "text" } }, { key: "b", editor: { type: "number" } }];

  it("실행 취소로 처음 값으로 돌아오면 __modified__가 풀린다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x", b: 1 }];
    grid.setData(rows);
    grid.setRange(0, 0);
    grid.paste("y\t2");
    expect(rows[0].__modified__).toBe(true);
    grid.undo();
    expect(rows[0]).toEqual({ a: "x", b: 1 });
    expect(grid.getModifiedRows()).toEqual([]);
    grid.redo();
    expect(rows[0].__modified__).toBe(true);
  });

  it("한 셀만 되돌리면 다른 셀이 바뀐 동안은 수정된 행", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x", b: 1 }];
    grid.setData(rows);
    grid.setValue(0, "a", "y");
    grid.setValue(0, "b", 2);
    grid.setValue(0, "a", "x"); // 직접 되돌림
    expect(rows[0].__modified__).toBe(true);
    grid.setValue(0, "b", 1);
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("addRow로 넣은 행·처음부터 표시가 있던 행은 되돌려도 표시가 남는다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x", __modified__: true }];
    grid.setData(rows);
    grid.addRow({ a: "새" });
    grid.setValue(0, "a", "y");
    grid.setValue(0, "a", "x");
    grid.setValue(1, "a", "z");
    grid.setValue(1, "a", "새");
    expect(grid.getModifiedRows()).toHaveLength(2);
  });

  it("필터로 숨은 행도 되돌리면 표시가 풀린다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    const rows = [{ a: "x", b: 1 }, { a: "q", b: 2 }];
    grid.setData(rows);
    grid.setRange(0, 1);
    grid.paste("9");
    grid.setFilter("a", ["q"]);
    grid.undo();
    expect(rows[0].b).toBe(1);
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("clearModified·clearDeleted·acceptChanges", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = [{ a: "x" }, { a: "y" }, { a: "z" }];
    grid.setData(rows);
    grid.setValue(0, "a", "1");
    grid.setValue(1, "a", "2");
    grid.deleteRows(2);
    grid.clearModified([rows[0]]);
    expect(grid.getModifiedRows()).toEqual([rows[1]]);
    grid.acceptChanges();
    expect(grid.getModifiedRows()).toEqual([]);
    expect(grid.getDeletedRows()).toEqual([]);
    expect(grid.canUndo).toBe(false);
    // 저장 뒤 값이 기준: 다시 바꾸고 되돌리면 표시가 풀린다
    grid.setValue(0, "a", "3");
    grid.setValue(0, "a", "1");
    expect(rows[0].__modified__).toBeUndefined();
  });
});
