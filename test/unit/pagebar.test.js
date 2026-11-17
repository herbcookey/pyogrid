// 아래 바: 페이지 이동과 상태 문구
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { formatNumber, statusData, defaultStatusHtml } from "../../src/features/pagebar.js";
import { resolveMessages } from "../../src/core/locales.js";
import { mockLayout, unmockLayout, makeRows } from "./helpers.js";

describe("페이지 바", () => {
  // stage2.test.js의 공통 준비
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
    { key: "id", label: "번호", width: 60 },
    { key: "name", label: "이름", width: 100 },
    { key: "qty", label: "수량", width: 80, sortable: true },
    { key: "memo", label: "메모", width: 80, sortable: false },
  ];

  it("기본: 상태 문구만, 페이지 정보가 있으면 이동 버튼", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(300));
    expect(grid.el.status.textContent).toBe("1 - 15 of 300");
    expect(grid.el.nav.innerHTML).toBe("");
    grid.setData(makeRows(50), { currentPage: 2, pageSize: 50, totalElements: 1234, totalPages: 25 });
    expect(grid.el.status.textContent).toBe("1 - 15 of 50\u00a0 Total 1,234");
    const nums = [...grid.el.nav.querySelectorAll(".pyo-page-nums button")].map((b) => b.textContent);
    expect(nums).toEqual(["1", "2", "3", "4", "5"]);
    expect(grid.el.nav.querySelector('[data-selected="true"]').textContent).toBe("3");
  });

  it("이동 버튼은 pagechange(page는 0부터)를 알리고, 같은 페이지는 무시한다", () => {
    const grid = new PyoGrid(host, { columns: cols, pageIcons: { first: "|«", last: "»|" } });
    grid.setData(makeRows(10), { currentPage: 2, pageSize: 10, totalElements: 100, totalPages: 10 });
    const fn = vi.fn();
    grid.on("pagechange", fn);
    grid.el.nav.querySelector('[data-page-move="next"]').click();
    grid.el.nav.querySelector('[data-page-move="first"]').click();
    grid.el.nav.querySelector('[data-page-move="3"]').click();
    expect(fn.mock.calls.map((c) => c[0].page)).toEqual([3, 0]);
    expect(fn.mock.calls[0][0].current).toBe(2);
  });

  it("pageBar:false면 숨기고 본문이 아래까지, statusFormat으로 문구 바꾸기", () => {
    const grid = new PyoGrid(host, { columns: cols, pageBar: false });
    expect(grid.el.pagebar.hidden).toBe(true);
    expect(grid.el.scroll.style.bottom).toBe("0px");
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), {
      columns: cols,
      statusFormat: (d) => `<b>${d.dataRowCount}건</b>`,
    });
    g2.setData(makeRows(1200));
    expect(g2.el.status.innerHTML).toBe("<b>1,200건</b>");
    expect(g2.el.scroll.style.bottom).toBe("25px");
  });

  it("스크롤하면 상태 문구가 바뀐다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(300));
    grid.el.scroll.scrollTop = 26 * 100;
    grid.scrollToRow(100, "top");
    grid._renderStatus();
    expect(grid.el.status.textContent).toBe("101 - 115 of 300");
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
});

describe("setPage", () => {
  // pagebar.test.js의 공통 준비
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
  const cols = [{ key: "id" }, { key: "name" }];

  it("페이지 정보만 바꾼다: 이동 단추와 상태 문구가 바뀌고, 행·선택·pagechange는 그대로", () => {
    const grid = new PyoGrid(host, { columns: cols });
    const rows = makeRows(50);
    grid.setData(rows, { currentPage: 0, pageSize: 50, totalElements: 120, totalPages: 3 });
    grid.setRange(2, 1);
    const fn = vi.fn();
    grid.on("pagechange", fn);
    expect(grid.setPage({ currentPage: 1, pageSize: 50, totalElements: 1234, totalPages: 25 })).toBe(grid);
    expect(grid.el.status.textContent).toBe("1 - 15 of 50\u00a0 Total 1,234");
    expect(grid.el.nav.querySelector('[data-selected="true"]').textContent).toBe("2");
    expect(grid.getRows()).toEqual(rows);
    expect(grid.getRange()).toMatchObject({ r0: 2, c0: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("null이면 페이지 정보를 지운다: 이동 단추가 없어지고 전체 건수 문구도 빠진다", () => {
    const grid = new PyoGrid(host, { columns: cols });
    grid.setData(makeRows(30), { currentPage: 0, pageSize: 30, totalElements: 90, totalPages: 3 });
    expect(grid.el.nav.innerHTML).not.toBe("");
    grid.setPage(null);
    expect(grid.el.nav.innerHTML).toBe("");
    expect(grid.el.status.textContent).toBe("1 - 15 of 30");
  });
});
