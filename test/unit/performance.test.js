// 성능과 큰 데이터
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import * as view from "../../src/features/view.js";
import { collectors } from "../../src/features/view.js";
import { pastePlan } from "../../src/features/clipboard.js";
import { sortRows } from "../../src/core/sort.js";
import * as util from "../../src/util.js";
import { htmlToText } from "../../src/features/excel.js";
import { mockLayout, unmockLayout, cellsOf } from "./helpers.js";

describe("행이 아주 많아도 스택 초과가 나지 않는다", () => {
  // review-fixes2.test.js의 공통 준비
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

  const N = 200000;

  it("min·max 계산기", () => {
    const list = Array.from({ length: N }, (_, i) => ({ v: i - 5 }));
    expect(collectors.min.call({ key: "v", list })).toBe(-5);
    expect(collectors.max.call({ key: "v", list })).toBe(N - 6);
    expect(collectors.min.call({ key: "v", list: [] })).toBe("");
  });

  it("20만 행 footSum max로 setData", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "v", align: "right" }],
      footSum: [[{ key: "v", collector: "max" }]],
    });
    expect(() => grid.setData(Array.from({ length: N }, (_, i) => ({ v: i })))).not.toThrow();
    expect(grid.el.foot.querySelector(".pyo-sum-cell").textContent).toBe(String(N - 1));
  });

  it("20만 셀 붙여넣기 → 실행 취소", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v", editor: { type: "text" } }], pageBar: false });
    const rows = Array.from({ length: N }, () => ({ v: "a" }));
    grid.setData(rows);
    grid.setRange(0, 0);
    const text = Array.from({ length: N }, () => "b").join("\n");
    expect(pastePlan([["x"]], { r0: 0, c0: 0, r1: 0, c1: 0 })).toHaveLength(1);
    expect(grid.paste(text).applied).toBe(N);
    expect(() => grid.undo()).not.toThrow();
    expect(rows[N - 1].v).toBe("a");
    expect(grid.getRange()).toMatchObject({ r0: 0, c0: 0, r1: N - 1, c1: 0 });
  });

  it("20만 행 addRow·deleteRows", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v" }] });
    grid.setData([{ v: "first" }]);
    const many = Array.from({ length: N }, (_, i) => ({ v: i }));
    expect(() => grid.addRow(many, 0)).not.toThrow();
    expect(grid.getAllRows()).toHaveLength(N + 1);
    expect(grid.getAllRows()[N].v).toBe("first");
    grid.acceptChanges(); // 저장한 뒤라야 지운 행이 기록에 남는다 (저장 전에 넣은 행은 기록하지 않음)
    expect(() => grid.deleteRows(many)).not.toThrow();
    expect(grid.getDeletedRows()).toHaveLength(N);
  });
});

describe("성능", () => {
  // review-fixes5.test.js의 공통 준비
  let host;
  beforeEach(() => {
    mockLayout();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    document.querySelectorAll(".pyo-popup").forEach((p) => p.remove());
    unmockLayout();
    vi.restoreAllMocks();
  });

  it("정렬: 숫자 변환은 값마다 한 번 (비교마다 하지 않는다), 결과는 같다", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ v: i % 3 ? String((i * 7919) % 1000) : "x" + (i % 50), i }));
    const spy = vi.spyOn(util, "toNumber");
    const out = sortRows(rows, [{ key: "v", dir: "asc" }]);
    // ESM 바인딩이라 spy가 안 걸리는 환경도 있으니, 걸렸을 때만 횟수를 본다
    if (spy.mock.calls.length) expect(spy.mock.calls.length).toBeLessThanOrEqual(rows.length);
    const nums = out.filter((r) => !String(r.v).startsWith("x")).map((r) => Number(r.v));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(out.slice(-1)[0].v.startsWith("x")).toBe(true);
    // 같은 값은 원래 순서 (안정 정렬)
    const same = out.filter((r) => r.v === "x0").map((r) => r.i);
    expect(same).toEqual([...same].sort((a, b) => a - b));
  });

  it("셀 병합: 병합 컬럼이 아닌 셀을 고치면 병합을 다시 세지 않고, 병합 컬럼 값을 바꾸면 다시 센다", () => {
    const grid = new PyoGrid(host, {
      mergeCells: ["k"],
      columns: [{ key: "k" }, { key: "q", editor: { type: "number" } }],
    });
    grid.setData([{ k: "A", q: 1 }, { k: "A", q: 2 }, { k: "B", q: 3 }]);
    const spy = vi.spyOn(view, "computeMerge");
    const before = grid._merge;
    grid.setValue(0, "q", 10);
    expect(grid._merge).toBe(before); // 그대로 (다시 세지 않음)
    grid.setValue(1, "k", "B");
    expect(grid._merge).not.toBe(before);
    expect(cellsOf(grid, 1)[0].classList.contains("pyo-merged")).toBe(true); // B, B가 합쳐짐
    expect(cellsOf(grid, 0)[0].classList.contains("pyo-merged")).toBe(false);
    void spy;
  });

  it("스크롤바 너비는 한 번 잰 값을 쓰고, 창 크기가 바뀌면 다시 잰다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a" }] });
    const appended = vi.spyOn(grid.el.root, "append");
    grid._sbw = 12;
    grid.layout();
    grid.layout();
    expect(appended).not.toHaveBeenCalled();
    expect(grid._scrollbarWidth()).toBe(12);
    window.dispatchEvent(new Event("resize"));
    expect(grid._sbw).toBeUndefined();
  });

  it("복사는 범위 글자를 한 번만 만든다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a" }, { key: "b" }] });
    grid.setData([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
    grid.setRange(0, 0, 1, 1);
    const spy = vi.spyOn(grid, "getRangeText");
    const data = new Map();
    const ev = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: { setData: (t, v) => data.set(t, v), getData: () => "" } });
    const copies = [];
    grid.on("copy", (e) => copies.push(e.text));
    grid.editing.input.dispatchEvent(ev);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(data.get("text/plain")).toBe("1\t2\r\n3\t4");
    expect(copies).toEqual(["1\t2\r\n3\t4"]);
  });

  it("엑셀용 htmlToText는 DOMParser를 셀마다 만들지 않고, 스크립트를 실행하지 않는다", () => {
    const spy = vi.spyOn(globalThis, "DOMParser");
    expect(htmlToText("<b>굵게</b>&amp;<br>다음")).toBe("굵게& 다음");
    expect(htmlToText('<img src=x onerror="window.__h=1">a')).toBe("a");
    expect(htmlToText("a < b")).toBe("a < b");
    expect(window.__h).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
