import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FilterPopup, FILTER_RENDER_MAX } from "../../src/features/filter.js";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout } from "./helpers.js";

// 그리는 개수(renderMax)보다 값이 많을 때: 검색·전체 선택·확인은 전체 값 기준이어야 한다
const values = Array.from({ length: 50 }, (_, i) => "V" + String(i).padStart(3, "0"));

function open(opts = {}) {
  const res = { applied: undefined };
  const pop = new FilterPopup({
    title: "값", values, label: (v) => v, current: null, renderMax: 10,
    onApply: (a) => (res.applied = a), onClose: () => {}, ...opts,
  });
  return { pop, res, el: pop.el };
}
const search = (el, q) => {
  const s = el.querySelector(".pyo-f-search");
  s.value = q;
  s.dispatchEvent(new Event("input"));
};
const labels = (el) => [...el.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim());

afterEach(() => document.querySelectorAll(".pyo-popup").forEach((p) => p.remove()));

describe("값이 많은 필터", () => {
  it("앞의 renderMax개만 그리고 안내를 보이지만, 그대로 확인하면 조건 없음", () => {
    const { el, res } = open();
    expect(labels(el)).toHaveLength(10);
    expect(el.querySelector(".pyo-f-note").hidden).toBe(false);
    expect(el.querySelector(".pyo-f-note").textContent).toContain("Showing the first 10 of 50");
    el.querySelector(".pyo-f-ok").click();
    expect(res.applied).toBeNull();
  });

  it("검색은 그리지 않은 값까지 전체에서 찾는다", () => {
    const { el, res } = open();
    search(el, "V049");
    expect(labels(el)).toEqual(["V049"]);
    expect(el.querySelector(".pyo-f-note").hidden).toBe(true);
    el.querySelector(".pyo-f-ok").click();
    expect([...res.applied]).toEqual(["V049"]);
  });

  it("그린 값 하나만 해제하면 나머지(그리지 않은 값 포함)는 남는다", () => {
    const { el, res } = open();
    el.querySelector('.pyo-f-list input[data-i="0"]').click();
    expect(el.querySelector(".pyo-f-all input").checked).toBe(false);
    el.querySelector(".pyo-f-ok").click();
    expect(res.applied.size).toBe(49);
    expect(res.applied.has("V000")).toBe(false);
    expect(res.applied.has("V049")).toBe(true);
  });

  it("전체 선택 해제는 그리지 않은 값까지, 검색 중이면 검색에 걸린 값만", () => {
    const { el, res } = open();
    const all = el.querySelector(".pyo-f-all input");
    all.click(); // 전부 해제
    search(el, "V04"); // V040~V049 (10개)
    expect(all.checked).toBe(false);
    all.click(); // 검색 결과만 체크
    search(el, "");
    expect(el.querySelectorAll(".pyo-f-list input:checked")).toHaveLength(0); // 앞 10개는 여전히 해제
    el.querySelector(".pyo-f-ok").click();
    expect([...res.applied].sort()).toEqual(values.slice(40));
  });

  it("검색 중 확인은 검색에 걸리고 체크된 값만 (Excel과 같음), 전부 걸리면 조건 없음", () => {
    let o = open();
    search(o.el, "V00");
    o.el.querySelector(".pyo-f-ok").click();
    expect(o.res.applied.size).toBe(10);
    o = open();
    search(o.el, "V");
    o.el.querySelector(".pyo-f-ok").click();
    expect(o.res.applied).toBeNull();
  });

  it("이미 걸린 조건을 그리지 않은 값까지 이어받는다", () => {
    const { el, res } = open({ current: new Set(["V045", "V046"]) });
    expect(el.querySelectorAll(".pyo-f-list input:checked")).toHaveLength(0);
    el.querySelector(".pyo-f-ok").click();
    expect([...res.applied].sort()).toEqual(["V045", "V046"]);
  });
});

describe("그리드: 값이 기본 한도(2,000)보다 많은 컬럼", () => {
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

  it("그대로 확인하면 행이 줄지 않고, 마지막 값도 검색된다", () => {
    const n = FILTER_RENDER_MAX + 500;
    const grid = new PyoGrid(host, { columns: [{ key: "code", label: "코드" }], filter: true });
    grid.setData(Array.from({ length: n }, (_, i) => ({ code: "C" + String(i).padStart(5, "0") })));
    grid.openFilter(0);
    document.querySelector(".pyo-f-ok").click();
    expect(grid.getRows()).toHaveLength(n);
    expect(grid.isFilterActive()).toBe(false);
    grid.openFilter(0);
    search(document.querySelector(".pyo-filter"), "C02499");
    document.querySelector(".pyo-f-ok").click();
    expect(grid.getRows().map((r) => r.code)).toEqual(["C02499"]);
  });
});
