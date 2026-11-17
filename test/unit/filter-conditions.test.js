// 조건 필터: setFilterCondition·getFilterConditions, 팝업의 조건 칸 (filterConditions 옵션)
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
  document.querySelectorAll(".pyo-popup").forEach((p) => p.remove());
  unmockLayout();
});

const ids = (grid) => grid.getRows().map((r) => r.id);
const popup = () => document.querySelector(".pyo-filter");

describe("글자 조건", () => {
  const setup = () => {
    const grid = new PyoGrid(host, {
      columns: [
        { key: "id" },
        { key: "name" },
        { key: "kind", editor: { type: "select", config: { options: [{ value: "A", text: "Apple" }, { value: "B", text: "Banana" }] } } },
      ],
    });
    grid.setData([
      { id: 1, name: "Seoul Office", kind: "A" },
      { id: 2, name: "seoul store", kind: "B" },
      { id: 3, name: "Busan", kind: "A" },
      { id: 4, name: "", kind: "" },
      { id: 5, name: null, kind: "B" },
    ]);
    return grid;
  };

  it("contains·startsWith·equals는 대소문자를 가리지 않는다", () => {
    const grid = setup();
    grid.setFilterCondition("name", { type: "text", op: "contains", value: "SEOUL" });
    expect(ids(grid)).toEqual([1, 2]);
    grid.setFilterCondition("name", { type: "text", op: "startsWith", value: "bu" });
    expect(ids(grid)).toEqual([3]);
    grid.setFilterCondition("name", { type: "text", op: "equals", value: "seoul STORE" });
    expect(ids(grid)).toEqual([2]);
  });

  it("notEquals는 equals의 반대다: 빈 칸도 통과한다", () => {
    const grid = setup();
    grid.setFilterCondition("name", { type: "text", op: "notEquals", value: "busan" });
    expect(ids(grid)).toEqual([1, 2, 4, 5]);
  });

  it("필터 목록에 보이는 글자와 비교한다 (select는 항목 이름)", () => {
    const grid = setup();
    grid.setFilterCondition("kind", { type: "text", op: "startsWith", value: "ban" });
    expect(ids(grid)).toEqual([2, 5]);
    grid.setFilterCondition("kind", { type: "text", op: "equals", value: "A" }); // 값 "A"가 아니라 "Apple"과 비교
    expect(ids(grid)).toEqual([]);
  });
});

describe("숫자 조건", () => {
  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "qty", editor: { type: "number" } }] });
    grid.setData([
      { id: 1, qty: 10 },
      { id: 2, qty: "1,200" },
      { id: 3, qty: -5 },
      { id: 4, qty: "" },
      { id: 5, qty: "abc" },
      { id: 6, qty: 10.5 },
    ]);
    return grid;
  };

  it("eq·gt·ge·lt·le은 숫자로 읽어 비교하고, 빈 칸과 숫자가 아닌 값은 통과하지 못한다", () => {
    const grid = setup();
    const run = (op, value) => (grid.setFilterCondition("qty", { type: "number", op, value }), ids(grid));
    expect(run("eq", 1200)).toEqual([2]);
    expect(run("gt", 10)).toEqual([2, 6]);
    expect(run("ge", 10)).toEqual([1, 2, 6]);
    expect(run("lt", 10)).toEqual([3]);
    expect(run("le", 10)).toEqual([1, 3]);
  });

  it("ne는 eq의 반대다: 빈 칸과 숫자가 아닌 값도 통과한다 (엑셀과 같음)", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ne", value: 10 });
    expect(ids(grid)).toEqual([2, 3, 4, 5, 6]);
  });

  it("between은 {from, to} (양 끝 포함), 한쪽만 줘도 된다. 빈 칸은 통과하지 못한다", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "between", from: 0, to: 10.5 });
    expect(ids(grid)).toEqual([1, 6]);
    grid.setFilterCondition("qty", { type: "number", op: "between", from: 11 });
    expect(ids(grid)).toEqual([2]);
    grid.setFilterCondition("qty", { type: "number", op: "between", to: 0 });
    expect(ids(grid)).toEqual([3]);
  });
});

describe("날짜 조건 (yyyy-MM-dd 글자로 맞춰 비교)", () => {
  const rows = () => [
    { id: 1, d: "2026-03-01" },
    { id: 2, d: "20260315" },
    { id: 3, d: "2026.03.31" },
    { id: 4, d: "2026/4/1" },
    { id: 5, d: "2026-03-31T23:30:00+09:00" }, // 시간이 붙으면 날짜 부분만 본다 (시간대로 하루가 밀리지 않는다)
    { id: 6, d: "2026-02-28 23:59" },
    { id: 7, d: new Date(2026, 2, 10, 23, 59) }, // Date는 그 날짜(지역 시각)로
    { id: 8, d: "" },
    { id: 9, d: "not a date" },
    { id: 10, d: "2026-02-30" }, // 없는 날짜
  ];

  it("from·to는 양 끝 포함, 한쪽만 줘도 된다. 날짜로 읽지 못하면 통과하지 못한다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "d", editor: { type: "date" } }] });
    grid.setData(rows());
    grid.setFilterCondition("d", { type: "date", from: "2026-03-01", to: "2026-03-31" });
    expect(ids(grid)).toEqual([1, 2, 3, 5, 7]);
    grid.setFilterCondition("d", { type: "date", from: "2026-04-01" });
    expect(ids(grid)).toEqual([4]);
    grid.setFilterCondition("d", { type: "date", to: "2026-02-28" });
    expect(ids(grid)).toEqual([6]);
  });

  it("from·to도 같은 방식으로 읽는다 (20260301, 2026.3.1)", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "d", editor: { type: "date" } }] });
    grid.setData(rows());
    grid.setFilterCondition("d", { type: "date", from: "20260301", to: "2026.3.10" });
    expect(ids(grid)).toEqual([1, 7]);
    expect(grid.getFilterConditions()).toEqual({ d: { type: "date", op: "between", from: "2026-03-01", to: "2026-03-10" } });
  });

  it("date 편집기의 valueFormat 형식 글자로 저장된 값을 읽는다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "d", editor: { type: "date", config: { valueFormat: "dd/MM/yyyy" } } }] });
    grid.setData([
      { id: 1, d: "01/03/2026" },
      { id: 2, d: "15/03/2026" },
      { id: 3, d: "01/04/2026" },
      { id: 4, d: "2026-03-20" }, // 형식과 다른 값도 기본 규칙으로 읽는다
    ]);
    grid.setFilterCondition("d", { type: "date", from: "2026-03-01", to: "2026-03-31" });
    expect(ids(grid)).toEqual([1, 2, 4]);
  });

  it("valueFormat이 함수면 편집기가 읽는 모양(yyyy가 앞인 글자, Date)으로 읽는다", () => {
    const fmt = (d) => d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "d", editor: { type: "date", config: { valueFormat: fmt } } }] });
    grid.setData([
      { id: 1, d: fmt(new Date(2026, 2, 5)) },
      { id: 2, d: fmt(new Date(2026, 3, 5)) },
    ]);
    grid.setFilterCondition("d", { type: "date", from: "2026-03-01", to: "2026-03-31" });
    expect(ids(grid)).toEqual([1]);
    // 편집기로 고친 값도 같은 함수로 저장되고 읽힌다 (조건을 풀어 두 행이 다 보이게 한 뒤 붙여넣는다)
    grid.setFilterCondition("d", null);
    grid.setRange(1, 1);
    grid.paste("2026-03-20");
    expect(grid.getAllRows()[1].d).toBe("2026/3/20");
    grid.setFilterCondition("d", { type: "date", from: "2026-03-01", to: "2026-03-31" });
    expect(ids(grid)).toEqual([1, 2]);

    const toDateObj = (d) => d;
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), {
      columns: [{ key: "id" }, { key: "d", editor: { type: "date", config: { valueFormat: toDateObj } } }],
    });
    g2.setData([{ id: 1, d: new Date(2026, 2, 31, 23, 0) }, { id: 2, d: new Date(2026, 3, 1, 0, 30) }]);
    g2.setFilterCondition("d", { type: "date", to: "2026-03-31" });
    expect(ids(g2)).toEqual([1]);
    g2.destroy();
  });
});

describe("값 목록 필터와 함께", () => {
  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "team" }, { key: "qty", editor: { type: "number" } }], filter: true });
    grid.setData([
      { id: 1, team: "A", qty: 10 },
      { id: 2, team: "A", qty: 30 },
      { id: 3, team: "B", qty: 20 },
      { id: 4, team: "C", qty: 40 },
    ]);
    return grid;
  };

  it("한 컬럼에서 값 목록과 조건은 AND, 컬럼끼리도 AND", () => {
    const grid = setup();
    grid.setFilter("qty", [10, 20, 30]);
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 20 });
    expect(ids(grid)).toEqual([2, 3]);
    grid.setFilterCondition("team", { type: "text", op: "equals", value: "a" });
    expect(ids(grid)).toEqual([2]);
  });

  it("getFilters()는 지금 모양 그대로 값 목록만, getFilterConditions()는 조건만 (복사본)", () => {
    const grid = setup();
    grid.setFilter("team", ["A", "B"]);
    grid.setFilterCondition("qty", { type: "number", op: "between", from: 15 });
    expect(grid.getFilters()).toEqual({ team: ["A", "B"] });
    const c = grid.getFilterConditions();
    expect(c).toEqual({ qty: { type: "number", op: "between", from: 15 } });
    c.qty.from = 0;
    expect(grid.getFilterConditions().qty.from).toBe(15);
  });

  it("filterchange는 filters·count에 conditions를 더해 알린다", () => {
    const grid = setup();
    const events = [];
    grid.on("filterchange", (e) => events.push(e));
    grid.setFilterCondition("qty", { type: "number", op: "gt", value: 15 });
    grid.setFilter("team", ["A"]);
    expect(events).toEqual([
      { filters: {}, conditions: { qty: { type: "number", op: "gt", value: 15 } }, count: 3 },
      { filters: { team: ["A"] }, conditions: { qty: { type: "number", op: "gt", value: 15 } }, count: 1 },
    ]);
  });

  it("setFilter(key, null)은 값 목록만 지우고, setFilterCondition(key, null)은 조건만 지운다. clearFilters()는 둘 다", () => {
    const grid = setup();
    grid.setFilter("qty", [10, 30]);
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 20 });
    grid.setFilter("qty", null);
    expect(ids(grid)).toEqual([2, 3, 4]);
    grid.setFilter("qty", [10, 30]);
    grid.setFilterCondition("qty", null);
    expect(ids(grid)).toEqual([1, 2]);
    grid.setFilterCondition("team", { type: "text", op: "equals", value: "A" });
    expect(grid.isFilterActive()).toBe(true);
    grid.clearFilters();
    expect(grid.getFilters()).toEqual({});
    expect(grid.getFilterConditions()).toEqual({});
    expect(grid.isFilterActive()).toBe(false);
    expect(ids(grid)).toEqual([1, 2, 3, 4]);
  });

  it("다른 컬럼의 조건에 걸린 행의 값은 필터 목록에 나오지 않는다 (자기 조건으로는 줄이지 않는다)", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 30 });
    grid.setFilterCondition("team", { type: "text", op: "equals", value: "A" });
    grid.openFilter(1); // team
    const labels = [...popup().querySelectorAll(".pyo-f-item")].map((l) => l.textContent.trim());
    expect(labels).toEqual(["A", "C"]); // qty ≥ 30인 행의 팀 (team 조건은 목록에 쓰지 않는다)
  });

  it("저장 전에 addRow로 넣은 행은 조건에 맞지 않아도 보인다", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 30 });
    grid.addRow({ id: 9, team: "Z", qty: "" });
    expect(ids(grid)).toEqual([2, 4, 9]);
  });

  it("컬럼이 바뀌어 없어진 키의 조건은 지우고 filterchange를 알린다", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 30 });
    const fn = vi.fn();
    grid.on("filterchange", fn);
    grid.setColumns([{ key: "id" }, { key: "team" }]);
    expect(grid.getFilterConditions()).toEqual({});
    expect(fn).toHaveBeenCalledWith({ filters: {}, conditions: {}, count: 4 });
  });

  it("트리와 서버 페이징에서는 조건도 쓰지 않는다", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 30 });
    grid.setData(grid.getAllRows(), { currentPage: 0, pageSize: 10, totalElements: 4, totalPages: 1 });
    expect(ids(grid)).toEqual([1, 2, 3, 4]);
    expect(grid.isFilterActive()).toBe(false);
  });
});

describe("조건 검사", () => {
  it("모양이 틀린 조건은 예외를 던지고 지금 필터는 그대로 둔다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }] });
    grid.setData([{ id: 1 }]);
    const bad = [
      { type: "nope", op: "eq", value: 1 },
      { type: "text", op: "gt", value: "a" },
      { type: "text", op: "contains", value: 3 },
      { type: "number", op: "eq", value: "1" },
      { type: "number", op: "eq", value: NaN },
      { type: "number", op: "between" },
      { type: "number", op: "between", from: "1" },
      { type: "date", from: "2026-13-01" },
      { type: "date" },
      "text",
    ];
    for (const c of bad) expect(() => grid.setFilterCondition("id", c), JSON.stringify(c)).toThrow(TypeError);
    expect(grid.getFilterConditions()).toEqual({});
  });
});

describe("filterConditions 옵션이 꺼져 있을 때 (기본)", () => {
  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "qty", editor: { type: "number" } }], filter: true });
    grid.setData([
      { id: 1, qty: 10 },
      { id: 2, qty: 30 },
    ]);
    return grid;
  };
  const btn = (grid, c) => grid.el.head.querySelector(`[data-filter="${c}"]`);

  it("메서드로 건 조건은 그대로 걸리고 헤더 필터 단추가 켜진다. 팝업에는 조건 칸이 없다", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 20 });
    expect(ids(grid)).toEqual([2]);
    expect(btn(grid, 1).classList.contains("pyo-filter-on")).toBe(true);
    expect(btn(grid, 0).classList.contains("pyo-filter-on")).toBe(false);
    btn(grid, 1).click();
    expect(popup()).not.toBeNull();
    expect(popup().querySelector(".pyo-f-cond")).toBeNull();
  });

  it("팝업의 확인은 값 목록만 바꾸고 조건은 남긴다. 초기화는 그 컬럼의 조건까지 지운다", () => {
    const grid = setup();
    grid.setFilterCondition("qty", { type: "number", op: "ge", value: 20 });
    btn(grid, 1).click();
    popup().querySelector(".pyo-f-ok").click();
    expect(grid.getFilterConditions()).toEqual({ qty: { type: "number", op: "ge", value: 20 } });
    btn(grid, 1).click();
    popup().querySelector(".pyo-f-clear").click();
    expect(grid.getFilterConditions()).toEqual({});
    expect(ids(grid)).toEqual([1, 2]);
    expect(btn(grid, 1).classList.contains("pyo-filter-on")).toBe(false);
  });
});

describe("filterConditions 옵션을 켠 팝업", () => {
  const setup = (cols) => {
    const grid = new PyoGrid(host, {
      filter: true,
      filterConditions: true,
      locale: "ko",
      columns: cols || [
        { key: "name", label: "이름" },
        { key: "qty", label: "수량", formatter: "money" },
        { key: "d", label: "일자", editor: { type: "date" } },
        { key: "memo", label: "메모", filterConditions: false },
        { key: "code", label: "코드", filterType: "text", editor: { type: "number" } },
      ],
    });
    grid.setData([
      { name: "서울", qty: 100, d: "2026-03-01", memo: "x", code: 1 },
      { name: "부산", qty: 2000, d: "2026-04-01", memo: "y", code: 22 },
    ]);
    return grid;
  };
  const cond = () => popup().querySelector(".pyo-f-cond");
  const opSel = () => /** @type {HTMLSelectElement} */ (cond().querySelector(".pyo-f-op"));
  const choose = (op) => {
    opSel().value = op;
    opSel().dispatchEvent(new Event("change", { bubbles: true }));
  };
  const type = (sel, text) => {
    const el = /** @type {HTMLInputElement} */ (cond().querySelector(sel));
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el;
  };
  const shown = () => [...cond().querySelectorAll("input")].filter((i) => !i.hidden).map((i) => i.className);

  it("컬럼 종류에 맞는 연산자를 보여 주고, 고르기·입력칸에 이름이 있다", () => {
    const grid = setup();
    const m = grid.messages;
    grid.openFilter(0);
    expect(opSel().getAttribute("aria-label")).toBe(m.filterCondition);
    expect([...opSel().options].map((o) => o.value)).toEqual(["", "contains", "startsWith", "equals", "notEquals"]);
    expect(shown()).toEqual([]);
    choose("contains");
    expect(shown()).toEqual(["pyo-f-value"]);
    expect(cond().querySelector(".pyo-f-value").getAttribute("aria-label")).toBe(m.condValue);
    grid.openFilter(1); // money → 숫자
    expect([...opSel().options].map((o) => o.value)).toEqual(["", "eq", "ne", "gt", "ge", "lt", "le", "between"]);
    choose("between");
    expect(shown()).toEqual(["pyo-f-from", "pyo-f-to"]);
    expect(cond().querySelector(".pyo-f-from").getAttribute("aria-label")).toBe(m.condFrom);
    expect(cond().querySelector(".pyo-f-to").getAttribute("aria-label")).toBe(m.condTo);
    grid.openFilter(2); // date 편집기 → 날짜
    expect([...opSel().options].map((o) => o.value)).toEqual(["", "between"]);
    grid.openFilter(3); // 컬럼 filterConditions:false
    expect(cond()).toBeNull();
    grid.openFilter(4); // filterType으로 글자
    expect([...opSel().options].map((o) => o.value)).toEqual(["", "contains", "startsWith", "equals", "notEquals"]);
  });

  it("조건을 고르고 확인하면 setFilterCondition과 같다. 이미 건 조건이 팝업에 채워진다", () => {
    const grid = setup();
    grid.openFilter(1);
    choose("ge");
    type(".pyo-f-value", "1,000");
    popup().querySelector(".pyo-f-ok").click();
    expect(grid.getFilterConditions()).toEqual({ qty: { type: "number", op: "ge", value: 1000 } });
    expect(grid.getRows().map((r) => r.name)).toEqual(["부산"]);
    grid.openFilter(1);
    expect(opSel().value).toBe("ge");
    expect(/** @type {HTMLInputElement} */ (cond().querySelector(".pyo-f-value")).value).toBe("1000");
    choose("");
    popup().querySelector(".pyo-f-ok").click();
    expect(grid.getFilterConditions()).toEqual({});
  });

  it("날짜 입력칸은 숫자만 쳐도 yyyy-MM-dd로 정리된다", () => {
    const grid = setup();
    grid.openFilter(2);
    choose("between");
    expect(type(".pyo-f-from", "20260301").value).toBe("2026-03-01");
    type(".pyo-f-to", "2026-03-3");
    popup().querySelector(".pyo-f-ok").click();
    expect(grid.getFilterConditions()).toEqual({ d: { type: "date", op: "between", from: "2026-03-01", to: "2026-03-03" } });
  });

  it("잘못된 값이면 팝업을 닫지 않고 그 칸을 aria-invalid로 표시한다", () => {
    const grid = setup();
    grid.openFilter(2);
    choose("between");
    const from = type(".pyo-f-from", "2026-02-30");
    popup().querySelector(".pyo-f-ok").click();
    expect(popup()).not.toBeNull();
    expect(from.getAttribute("aria-invalid")).toBe("true");
    expect(grid.getFilterConditions()).toEqual({});
    type(".pyo-f-from", "2026-02-28");
    expect(from.hasAttribute("aria-invalid")).toBe(false);
  });

  it("조건 입력칸의 Enter는 적용하고, 한글 조합 중 Enter·Esc는 무시한다", () => {
    const grid = setup();
    grid.openFilter(0);
    choose("contains");
    const input = type(".pyo-f-value", "서");
    const key = (k, init = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
    key("Enter", { isComposing: true });
    key("Escape", { keyCode: 229 });
    expect(popup()).not.toBeNull();
    expect(grid.getFilterConditions()).toEqual({});
    key("Enter");
    expect(popup()).toBeNull();
    expect(grid.getFilterConditions()).toEqual({ name: { type: "text", op: "contains", value: "서" } });
  });

  it("초기화는 값 목록과 조건을 둘 다 지운다", () => {
    const grid = setup();
    grid.setFilter("name", ["서울"]);
    grid.setFilterCondition("name", { type: "text", op: "contains", value: "서" });
    grid.openFilter(0);
    popup().querySelector(".pyo-f-clear").click();
    expect(grid.getFilters()).toEqual({});
    expect(grid.getFilterConditions()).toEqual({});
  });

  it("문구는 en·ko 모두 있다", async () => {
    const { locales } = await import("../../src/core/locales.js");
    const keys = ["filterCondition", "filterNoCondition", "condContains", "condStartsWith", "condEquals", "condNotEquals", "condGt", "condGe", "condLt", "condLe", "condBetween", "condValue", "condFrom", "condTo"];
    for (const lang of ["en", "ko"]) for (const k of keys) expect(typeof locales[lang][k], `${lang}.${k}`).toBe("string");
    expect(locales.ko.condContains).not.toBe(locales.en.condContains);
  });
});
