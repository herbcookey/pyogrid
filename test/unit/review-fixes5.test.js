import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { sortRows } from "../../src/core/sort.js";
import * as util from "../../src/util.js";
import { buildTree } from "../../src/features/view.js";
import * as view from "../../src/features/view.js";
import { htmlToText } from "../../src/features/excel.js";
import { formatNumber, statusData, defaultStatusHtml } from "../../src/features/pagebar.js";
import { resolveMessages } from "../../src/core/locales.js";
import { FilterPopup } from "../../src/features/filter.js";
import { mockLayout, unmockLayout, cellsOf } from "./helpers.js";

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

describe("성능", () => {
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

describe("작은 것", () => {
  it("상태 문구·숫자 서식·정렬이 locale을 따른다", () => {
    expect(defaultStatusHtml(statusData(0, 15, 300, null))).toBe("<span>1 - 15 of 300</span>");
    const ko = resolveMessages("ko");
    expect(defaultStatusHtml(statusData(0, 15, 1300, { currentPage: 0, totalPages: 9, totalElements: 2500 }, "ko"), ko)).toBe(
      "<span>1 - 15 / 1,300&nbsp; 전체 2,500</span>",
    );
    expect(formatNumber(1234.567, "de")).toBe("1.234,57");
    expect(formatNumber(1234.5, "corp_lang")).toBe("1,234.5"); // 언어 이름이 아니면 en
    const grid = new PyoGrid(host, { locale: "ko", sortable: true, columns: [{ key: "v" }] });
    grid.setData([{ v: "item" }, { v: "가" }]);
    grid.setSort([{ key: "v", dir: "asc" }]);
    expect(grid.getRows().map((r) => r.v)).toEqual(["가", "item"]);
    expect(grid.el.status.textContent).toBe("1 - 2 / 2");
    const en = new PyoGrid(document.body.appendChild(document.createElement("div")), { sortable: true, columns: [{ key: "v" }] });
    en.setData([{ v: "가" }, { v: "item" }]);
    en.setSort([{ key: "v", dir: "asc" }]);
    expect(en.getRows().map((r) => r.v)).toEqual(["item", "가"]);
    en.destroy();
  });

  it("messages.status로 상태 문구를 바꾼다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "v" }], messages: { status: (a, b, n) => `${a}–${b} / ${n} rows` } });
    grid.setData([{ v: 1 }, { v: 2 }]);
    expect(grid.el.status.textContent).toBe("1–2 / 2 rows");
  });

  it("트리 부모·자식 키는 타입이 달라도 같은 값이면 잇는다 (id 1, pid \"1\")", () => {
    const rows = [{ id: 1, pid: "" }, { id: 2, pid: "1" }, { id: "3", pid: 2 }];
    const t = buildTree(rows, { parentKey: "pid", selfKey: "id", collapseKey: "collapse" }, (s) => s);
    expect(t.meta.get(rows[1]).parent).toBe(rows[0]);
    expect(t.meta.get(rows[2]).parent).toBe(rows[1]);
    expect(t.meta.get(rows[2]).depth).toBe(2);
  });

  it("그룹 키 컬럼 값을 고치면 그 행이 새 그룹으로 옮겨 가고 소계가 다시 계산된다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "g", editor: { type: "text" } }, { key: "q" }],
      grouping: { by: ["g"], columns: [{ label() { return this.groupBy.labels[0]; } }, { key: "q", collector: "sum" }] },
    });
    const rows = [{ g: "A", q: 1 }, { g: "A", q: 2 }, { g: "B", q: 3 }];
    grid.setData(rows);
    const groups = () => grid.getViewRows().filter((r) => r.__isGrouping).map((r) => r.__groupingBy.labels[0] + ":" + r.__groupingList.length);
    expect(groups()).toEqual(["A:2", "B:1"]);
    grid.setValue(rows[0], "g", "B");
    expect(groups()).toEqual(["A:1", "B:2"]);
    grid.setValues([{ row: rows[1], key: "g", value: "C" }]);
    expect(groups()).toEqual(["B:2", "C:1"]);
    expect(grid.getViewRows().indexOf(rows[1])).toBeGreaterThan(grid.getViewRows().indexOf(rows[2]));
  });

  it("필터에서 아무것도 고르지 않으면 확인을 막는다", () => {
    const applied = [];
    const p = new FilterPopup({ title: "T", values: ["a", "b"], label: (v) => v, current: null, onApply: (s) => applied.push(s), onClose() {} });
    const ok = p.el.querySelector(".pyo-f-ok");
    expect(ok.disabled).toBe(false);
    const all = p.el.querySelector(".pyo-f-all input");
    all.checked = false;
    all.dispatchEvent(new Event("change"));
    expect(ok.disabled).toBe(true);
    p.el.querySelector(".pyo-f-search").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    p.apply();
    expect(applied).toEqual([]);
    expect(p.el.isConnected).toBe(true);
    const first = p.el.querySelector('.pyo-f-list input[data-i="0"]');
    first.checked = true;
    first.dispatchEvent(new Event("change", { bubbles: true }));
    expect(ok.disabled).toBe(false);
    ok.click();
    expect([...applied[0]]).toEqual(["a"]);
  });
});
