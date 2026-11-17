// 컬럼 목록과 크기
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { mockLayout, unmockLayout, makeRows } from "./helpers.js";

describe("getColumns", () => {
  // layout.test.js의 공통 준비
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

  it("지금의 컬럼 정의(묶음 포함)를 돌려주고, addColumn·removeColumn·setColumns를 따라간다", () => {
    const a = { key: "a", label: "A" };
    const group = { label: "묶음", columns: [{ key: "b" }, { key: "c" }] };
    const grid = new PyoGrid(host, { columns: [a, group] });
    expect(grid.getColumns()).toEqual([a, group]);
    expect(grid.getColumns()[1]).toBe(group);
    const d = { key: "d" };
    grid.addColumn(d);
    expect(grid.getColumns().map((c) => c.key || c.label)).toEqual(["a", "묶음", "d"]);
    grid.removeColumn(0);
    expect(grid.getColumns().map((c) => c.key || c.label)).toEqual(["묶음", "d"]);
    const next = [{ key: "x" }];
    grid.setColumns(next);
    expect(grid.getColumns()).toEqual(next);
  });
});

describe("setHeight", () => {
  // layout.test.js의 공통 준비
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

  it("숫자는 px, CSS 값은 그대로, null이면 대상 요소를 채운다. 그리드를 돌려준다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }] });
    grid.setData(makeRows(3));
    const root = grid.el.root;
    expect(root.style.height).toBe("");
    expect(grid.setHeight(240)).toBe(grid);
    expect(root.style.height).toBe("240px");
    grid.setHeight("50vh");
    expect(root.style.height).toBe("50vh");
    grid.setHeight(null);
    expect(root.style.height).toBe("");
  });

  it("height 옵션으로 만든 그리드도 setHeight(null)로 대상 요소를 채운다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }], height: 300 });
    expect(grid.el.root.style.height).toBe("300px");
    grid.setHeight(null);
    expect(grid.el.root.style.height).toBe("");
  });
});
