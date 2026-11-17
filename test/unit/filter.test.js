// 헤더 값 필터
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { FilterPopup } from "../../src/features/filter.js";
import { mockLayout, unmockLayout } from "./helpers.js";

describe("헤더 값 필터", () => {
  // stage5.test.js의 공통 준비
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
    vi.useRealTimers();
  });
  const cols = [
    { key: "team", label: "팀", width: 80 },
    { key: "name", label: "이름", width: 80 },
    { key: "qty", label: "수량", width: 80, editor: { type: "number" } },
  ];
  const data = () => [
    { team: "A", name: "가", qty: 10 },
    { team: "B", name: "나", qty: 20 },
    { team: "A", name: "다", qty: 30 },
    { team: "C", name: "라", qty: 40 },
  ];

  it("필터 단추 → 팝업 값 목록 → 일부 해제 → 확인", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData(data());
    const events = [];
    grid.on("filterchange", (e) => events.push(e));
    grid.el.headSc.querySelector('[data-filter="0"]').click();
    const pop = document.querySelector(".pyo-filter");
    const labels = [...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim());
    expect(labels).toEqual(["A", "B", "C"]);
    pop.querySelectorAll(".pyo-f-list input")[1].click(); // B 해제
    pop.querySelector(".pyo-f-ok").click();
    expect(grid.getRows().map((r) => r.name)).toEqual(["가", "다", "라"]);
    expect(events[0]).toEqual({ filters: { team: ["A", "C"] }, conditions: {}, count: 3 });
    expect(grid.el.headSc.querySelector('[data-filter="0"]').classList.contains("pyo-filter-on")).toBe(true);
    expect(document.querySelector(".pyo-filter")).toBeNull();
  });

  it("다른 컬럼 조건에 걸린 값만 목록에, 검색 뒤 확인은 검색 결과 중 체크한 것만", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData(data());
    grid.setFilter("team", ["A"]);
    grid.openFilter(1);
    let pop = document.querySelector(".pyo-filter");
    expect([...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim())).toEqual(["가", "다"]);
    pop.querySelector(".pyo-f-cancel").click();
    grid.clearFilters();
    grid.openFilter(1);
    pop = document.querySelector(".pyo-filter");
    const search = pop.querySelector(".pyo-f-search");
    search.value = "다";
    search.dispatchEvent(new Event("input"));
    pop.querySelector(".pyo-f-ok").click();
    expect(grid.getRows().map((r) => r.name)).toEqual(["다"]);
    expect(grid.el.empty.hidden).toBe(true);
    grid.setFilter("name", ["없음"]);
    expect(grid.el.empty.textContent).toBe("No rows match the filter");
  });

  it("초기화, 빈 값 표시, filter:false 컬럼, 트리에서는 필터 없음", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a", label: "A" }, { key: "b", filter: false }], filter: true });
    grid.setData([{ a: "" }, { a: "x" }]);
    expect(grid.el.headSc.querySelector('[data-filter="1"]')).toBeNull();
    grid.openFilter(0);
    const pop = document.querySelector(".pyo-filter");
    expect([...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim())).toEqual(["x", "(Blank)"]);
    pop.querySelectorAll(".pyo-f-list input")[0].click();
    pop.querySelector(".pyo-f-ok").click();
    expect(grid.getRows()).toHaveLength(1);
    grid.openFilter(0);
    document.querySelector(".pyo-f-clear").click();
    expect(grid.getRows()).toHaveLength(2);
    const t = new PyoGrid(document.body.appendChild(document.createElement("div")), { columns: [{ key: "a" }], filter: true, tree: {} });
    expect(t.el.headSc.querySelector("[data-filter]")).toBeNull();
  });

  it("setData 뒤에도 조건이 남는다, 필터로 숨은 행은 getAllRows에 있다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setFilter("team", ["B"]);
    grid.setData(data());
    expect(grid.getRows().map((r) => r.name)).toEqual(["나"]);
    expect(grid.getAllRows()).toHaveLength(4);
  });
});

describe("1. 필터가 걸린 상태에서 addRow", () => {
  // review-fixes3.test.js의 공통 준비
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
  const cols = [{ key: "team", label: "Team" }, { key: "qty", label: "Qty", editor: { type: "number" } }];

  it("새 행은 필터 조건에 맞지 않아도 보이고, focus로 그 행에 간다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData([{ team: "A", qty: 1 }, { team: "B", qty: 2 }]);
    grid.setFilter("team", ["A"]);
    expect(grid.getRows().map((r) => r.team)).toEqual(["A"]);
    const row = { team: "", qty: 0 };
    grid.addRow(row, "last", { focus: true });
    expect(grid.getRows()).toContain(row);
    expect(grid.getRange()).toMatchObject({ r0: grid.getRows().indexOf(row), c0: 0 });
    // 편집해서 조건에 안 맞는 값이 되어도 저장 전까지는 보인다
    grid.setValue(grid.getRows().indexOf(row), "team", "Z");
    grid.setFilter("team", ["A"]);
    expect(grid.getRows()).toContain(row);
  });

  it("저장(acceptChanges) 뒤에는 다시 필터를 따른다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    grid.setData([{ team: "A", qty: 1 }]);
    grid.setFilter("team", ["A"]);
    const row = { team: "", qty: 0 };
    grid.addRow(row);
    grid.acceptChanges();
    expect(row.__added__).toBeUndefined();
    expect(grid.getRows()).not.toContain(row);
  });
});

describe("5. 필터 팝업의 Enter", () => {
  // review-fixes3.test.js의 공통 준비
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

  const open = () => {
    const applied = [];
    let closed = 0;
    const p = new FilterPopup({ title: "T", values: ["a", "b"], label: (v) => v, current: null, onApply: (s) => applied.push(s), onClose: () => closed++ });
    return { p, applied, get closed() { return closed; } };
  };
  const press = (target, init) => {
    const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    return ev;
  };

  it("단추에 포커스가 있으면 Enter는 그 단추를 누른다 (팝업이 가로채지 않음)", () => {
    const s = open();
    const cancel = s.p.el.querySelector(".pyo-f-cancel");
    const ev = press(cancel, { key: "Enter" });
    expect(ev.defaultPrevented).toBe(false);
    expect(s.applied).toEqual([]);
  });

  it("조합 중 Enter는 무시하고, 검색칸의 Enter는 적용한다", () => {
    const s = open();
    const search = s.p.el.querySelector(".pyo-f-search");
    press(search, { key: "Enter", isComposing: true });
    press(search, { key: "Enter", keyCode: 229 });
    expect(s.applied).toEqual([]);
    press(search, { key: "Enter" });
    expect(s.applied).toEqual([null]);
  });
});

describe("작은 것", () => {
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
