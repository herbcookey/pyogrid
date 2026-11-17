// 팝업 위치
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { FilterPopup } from "../../src/features/filter.js";
import { mockLayout, unmockLayout } from "./helpers.js";

describe("7. 팝업이 페이지 스크롤을 따라간다", () => {
  // review-fixes4.test.js의 공통 준비
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
  });
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: k, bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const rect = (top, bottom, left = 100, right = 200) => ({ top, bottom, left, right, width: right - left, height: bottom - top });

  it("필터 팝업은 아래 공간이 모자라면 위로 뒤집는다", () => {
    const p = new FilterPopup({ title: "T", values: ["a"], label: (v) => v, current: null, onApply() {}, onClose() {} });
    Object.defineProperty(p.el, "offsetHeight", { configurable: true, value: 300 });
    Object.defineProperty(p.el, "offsetWidth", { configurable: true, value: 200 });
    const vh = window.innerHeight;
    p.place(rect(vh - 40, vh - 20), false);
    expect(parseFloat(p.el.style.top)).toBe(vh - 40 - 300 - 2);
    p.place(rect(10, 30), false);
    expect(parseFloat(p.el.style.top)).toBe(32);
    p.close();
  });

  it("바깥 스크롤·창 크기 변화에 열린 팝업 위치를 다시 잡고, 팝업 안 스크롤은 무시한다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "d", editor: { type: "date" } }], filter: true });
    grid.setData([{ d: "2026-11-13" }]);
    let calls = 0;
    const orig = grid.editing.placePopup.bind(grid.editing);
    grid.editing.placePopup = () => (calls++, orig());
    grid.setRange(0, 0);
    key(grid.editing.input, "F2");
    const pop = document.querySelector(".pyo-calendar");
    expect(pop).not.toBeNull();
    calls = 0;
    document.dispatchEvent(new Event("scroll"));
    expect(calls).toBe(1);
    window.dispatchEvent(new Event("resize"));
    const afterResize = calls;
    expect(afterResize).toBeGreaterThanOrEqual(2);
    pop.dispatchEvent(new Event("scroll"));
    expect(calls).toBe(afterResize);
    key(grid.editing.input, "Escape");
    // 필터 팝업도
    let placed = 0;
    grid.openFilter(0);
    const fp = grid._filterPopup;
    const op = fp.place.bind(fp);
    fp.place = (a, f) => (placed++, op(a, f));
    document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(placed).toBe(1);
    grid.destroy();
    document.dispatchEvent(new Event("scroll"));
    expect(placed).toBe(1);
  });
});
