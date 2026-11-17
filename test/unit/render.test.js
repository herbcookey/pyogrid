// 셀·헤더·합계 글자 그리기
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { buildExportData } from "../../src/features/excel.js";
import { mockLayout, unmockLayout, cellsOf } from "./helpers.js";

describe("9. formatter·label·합계 label·cellClass는 기본으로 이스케이프한다", () => {
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

  const evil = '<img src=x onerror="window.__x=1">';
  it("헤더 label, 합계 label·formatter, cellClass, headerClass", () => {
    const grid = new PyoGrid(host, {
      columns: [
        { key: "a", label: evil, cellClass: () => '" onmouseover="x', headerClass: '"><b>' },
        { key: "b", label: "<b>B</b>", html: true },
      ],
      footSum: [[{ label: evil }, { key: "b", collector: "sum", formatter: () => evil }]],
      grouping: { by: ["a"], columns: [{ label() { return this.groupBy.labels[0]; } }] },
    });
    grid.setData([{ a: evil, b: 1 }]);
    const root = grid.el.root;
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".pyo-hlabel").textContent).toBe(evil);
    expect(root.querySelectorAll(".pyo-hlabel")[1].querySelector("b").textContent).toBe("B");
    expect(grid.el.foot.textContent).toContain(evil);
    expect(root.querySelector(".pyo-group-row").textContent).toContain(evil);
    const cell = cellsOf(grid, 0)[0];
    expect(cell.getAttribute("onmouseover")).toBeNull();
    expect(root.querySelector(".pyo-hcell b")).toBe(root.querySelectorAll(".pyo-hlabel")[1].querySelector("b"));
  });

  it("합계 칸 html: true만 HTML로, 내보내기는 화면 글자 그대로", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "a", label: "<u>A</u>" }],
      footSum: [[{ label: "<b>T</b>", html: true }]],
    });
    grid.setData([{ a: "<i>x</i>" }]);
    expect(grid.el.foot.querySelector("b").textContent).toBe("T");
    const data = buildExportData(grid);
    expect(data.rows[0][0].v).toBe("<u>A</u>");
    expect(data.rows[1][0].v).toBe("<i>x</i>");
    expect(data.rows[2][0].v).toBe("T");
  });
});
