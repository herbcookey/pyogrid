import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { locales, resolveMessages } from "../../src/core/locales.js";
import { summaryText } from "../../src/features/pagebar.js";
import { mockLayout, unmockLayout } from "./helpers.js";

// 화면 문구: locale(기본 영어)과 messages로 바꾼다
let host;
beforeEach(() => {
  mockLayout();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  document.querySelectorAll(".pyo-popup").forEach((p) => p.remove());
  delete locales.ja;
  unmockLayout();
});

const cols = [
  { key: "team", label: "Team" },
  { key: "qty", label: "Qty", editor: { type: "number" } },
  { key: "dt", label: "Date", editor: { type: "date" } },
  { key: "cd", label: "Code", editor: { type: "select", config: { options: [] } } },
];
const rows = () => [
  { team: "A", qty: 1, dt: "2026-11-12", cd: "" },
  { team: "", qty: 2, dt: "", cd: "" },
];
const key = (input, k, init = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k, bubbles: true, cancelable: true, ...init }));

describe("resolveMessages", () => {
  it("기본은 영어, 모르는 locale도 영어, 지역 이름(ko-KR)은 언어로 찾는다", () => {
    expect(resolveMessages(undefined).empty).toBe("No data");
    expect(resolveMessages("xx").empty).toBe("No data");
    expect(resolveMessages("ko").empty).toBe("조회된 데이터가 없습니다.");
    expect(resolveMessages("ko-KR").ok).toBe("확인");
  });

  it("messages는 일부만 덮고, actions도 일부만 덮는다", () => {
    const m = resolveMessages("ko", { ok: "적용", actions: { paste: "붙이기" } });
    expect(m.ok).toBe("적용");
    expect(m.cancel).toBe("취소");
    expect(m.actions).toEqual({ edit: "셀 편집", clear: "지우기", paste: "붙이기", cut: "잘라내기", addRow: "행 추가", deleteRows: "행 삭제", removeRows: "행 빼기" });
    expect(locales.ko.ok).toBe("확인"); // 내장 문구는 바뀌지 않는다
  });

  it("새 언어를 locales에 넣으면 이름으로 쓰고, 빠진 문구는 영어", () => {
    locales.ja = { ok: "OK!", weekdays: ["日", "月", "火", "水", "木", "金", "土"] };
    const m = resolveMessages("ja");
    expect(m.ok).toBe("OK!");
    expect(m.weekdays[1]).toBe("月");
    expect(m.cancel).toBe("Cancel");
  });

  it("영어 단수·복수", () => {
    const en = locales.en;
    expect(en.copied("1")).toBe("Copied 1 cell");
    expect(en.pasted("3", "0")).toBe("Pasted 3 cells");
    expect(en.pasted("3", "2")).toBe("Pasted 3 cells (2 skipped)");
    expect(summaryText({ count: 2, numCount: 0, sum: 0 })).toBe("2 cells selected");
    expect(summaryText({ count: 2, numCount: 2, sum: 3 }, resolveMessages("ko"))).toBe("선택 2셀 · 숫자 2 · 합계 3 · 평균 1.5");
  });
});

describe("그리드 화면 문구", () => {
  it("기본은 영어: 빈 데이터, 필터 팝업, 필터 단추, 입력칸 이름", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true });
    expect(grid.el.empty.textContent).toBe("No data");
    expect(grid.editing.input.getAttribute("aria-label")).toBe("Cell input");
    grid.setData(rows());
    const btn = grid.el.headSc.querySelector('[data-filter="0"]');
    expect(btn.getAttribute("title")).toBe("Filter");
    btn.click();
    const pop = document.querySelector(".pyo-filter");
    expect(pop.getAttribute("aria-label")).toBe("Filter Team");
    expect(pop.querySelector(".pyo-f-search").placeholder).toBe("Search");
    expect(pop.querySelector(".pyo-f-all").textContent.trim()).toBe("(Select all)");
    expect([...pop.querySelectorAll(".pyo-f-list label")].map((l) => l.textContent.trim())).toEqual(["A", "(Blank)"]);
    expect([...pop.querySelectorAll(".pyo-f-btns button")].map((b) => b.textContent)).toEqual(["Clear", "OK", "Cancel"]);
  });

  it('locale: "ko"면 한국어', () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true, locale: "ko" });
    expect(grid.el.empty.textContent).toBe("조회된 데이터가 없습니다.");
    grid.setData(rows());
    grid.el.headSc.querySelector('[data-filter="0"]').click();
    const pop = document.querySelector(".pyo-filter");
    expect([...pop.querySelectorAll(".pyo-f-btns button")].map((b) => b.textContent)).toEqual(["초기화", "확인", "취소"]);
    expect(pop.querySelector(".pyo-f-all").textContent.trim()).toBe("(전체 선택)");
  });

  it("emptyText가 locale 문구보다 우선하고, null이면 표시하지 않는다", () => {
    const a = new PyoGrid(host, { columns: cols, locale: "ko", emptyText: "Nothing here" });
    expect(a.el.empty.textContent).toBe("Nothing here");
    a.destroy();
    const b = new PyoGrid(host, { columns: cols, emptyText: null });
    expect(b.el.empty.hidden).toBe(true);
  });

  it("messages로 바꾼 문구: 필터 결과 없음, 아래 바 문구", () => {
    const grid = new PyoGrid(host, {
      columns: cols,
      filter: true,
      messages: { noFilterMatch: "Nothing matches", nothingToUndo: "No undo" },
    });
    grid.setData(rows());
    grid.setFilter("team", ["zzz"]);
    expect(grid.el.empty.textContent).toBe("Nothing matches");
    grid.undo();
    expect(grid.el.summary.textContent).toBe("No undo");
  });

  it("달력과 빈 선택 목록도 locale을 따른다", () => {
    const en = new PyoGrid(host, { columns: cols });
    en.setData(rows());
    en.setRange(0, 2);
    key(en.editing.input, "F2");
    let cal = document.querySelector(".pyo-calendar");
    expect(cal.querySelector(".pyo-cal-title").textContent).toBe("November 2026");
    expect([...cal.querySelectorAll(".pyo-cal-week")].map((w) => w.textContent)).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expect(cal.querySelector(".pyo-cal-today").textContent).toBe("Today");
    expect(cal.querySelector('[data-cal="prev"]').getAttribute("aria-label")).toBe("Previous month");
    key(en.editing.input, "Escape");
    en.setRange(0, 3);
    key(en.editing.input, "F2");
    expect(document.querySelector(".pyo-dropdown").textContent).toBe("No options");
    key(en.editing.input, "Escape");
    en.destroy();

    const ko = new PyoGrid(host, { columns: cols, locale: "ko" });
    ko.setData(rows());
    ko.setRange(0, 2);
    key(ko.editing.input, "F2");
    cal = document.querySelector(".pyo-calendar");
    expect(cal.querySelector(".pyo-cal-title").textContent).toBe("2026년 11월");
    expect(cal.querySelector(".pyo-cal-week").textContent).toBe("일");
    expect(cal.querySelector(".pyo-cal-today").textContent).toBe("오늘");
  });

  it("문구는 HTML로 해석하지 않는다", () => {
    const grid = new PyoGrid(host, { columns: cols, filter: true, messages: { ok: "<b>OK</b>", filter: '"><i>x' } });
    grid.setData(rows());
    const btn = grid.el.headSc.querySelector('[data-filter="0"]');
    expect(btn.getAttribute("title")).toBe('"><i>x');
    btn.click();
    const ok = document.querySelector(".pyo-f-ok");
    expect(ok.textContent).toBe("<b>OK</b>");
    expect(ok.querySelector("b")).toBeNull();
  });
});
