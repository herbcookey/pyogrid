import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PyoGrid } from "../../src/grid.js";

// jsdom은 레이아웃을 계산하지 않으므로 그리드가 읽는 크기만 흉내 낸다.
const SIZE = { width: 800, height: 400 };
const restore = [];
function mockLayout() {
  const proto = HTMLElement.prototype;
  for (const prop of ["clientWidth", "clientHeight", "offsetHeight"]) {
    const orig = Object.getOwnPropertyDescriptor(proto, prop);
    restore.push([prop, orig]);
    Object.defineProperty(proto, prop, {
      configurable: true,
      get() {
        if (!this.classList || !(this.classList.contains("pyo") || this.classList.contains("pyo-scroll"))) return 0;
        return prop === "clientWidth" ? SIZE.width : SIZE.height;
      },
    });
  }
  for (const prop of ["scrollTop", "scrollLeft"]) {
    const orig = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    restore.push([prop, orig, Element.prototype]);
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get() {
        return this["_" + prop] || 0;
      },
      set(v) {
        this["_" + prop] = v;
      },
    });
  }
}
function unmockLayout() {
  while (restore.length) {
    const [prop, desc, target] = restore.pop();
    if (desc) Object.defineProperty(target || HTMLElement.prototype, prop, desc);
  }
}

const makeRows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: "행" + (i + 1), qty: i * 1000 }));

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

const cellsOf = (grid, rowIndex) => {
  const row = grid.el.body.querySelector(`.pyo-row[data-row="${rowIndex}"]`);
  return row ? [...row.querySelectorAll(".pyo-cell")] : null;
};

describe("PyoGrid 렌더링", () => {
  it("보이는 행만 그린다 (세로 가상 스크롤)", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }, { key: "name" }] });
    grid.setData(makeRows(10000));
    const rows = grid.el.body.querySelectorAll(".pyo-row");
    // 400px - 헤더 27px(26 + 아래 선 1) = 373px → 15행 + 아래 여유 6행
    expect(rows.length).toBe(21);
    expect(grid.el.body.style.height).toBe(10000 * 26 + "px");

    grid.el.scroll.scrollTop = 26 * 5000;
    grid.refresh();
    const indexes = [...grid.el.body.querySelectorAll(".pyo-row")].map((r) => Number(r.dataset.row));
    expect(Math.min(...indexes)).toBe(5000 - 6);
    expect(Math.max(...indexes)).toBe(5000 + 15 + 6 - 1);
    expect(cellsOf(grid, 5000)[1].textContent).toBe("행5001");
    expect(grid.el.body.querySelector('[data-row="5000"]').style.top).toBe(5000 * 26 + "px");
  });

  it("formatter 없는 값은 이스케이프하고, formatter 결과는 HTML로 넣는다", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "a" }, { key: "b", formatter: (c) => "<b>" + c.value + "</b>" }, { key: "c", formatter: "money" }],
    });
    grid.setData([{ a: "<script>x</script>", b: "굵게", c: 1234567 }]);
    const cells = cellsOf(grid, 0);
    expect(cells[0].innerHTML).toBe("&lt;script&gt;x&lt;/script&gt;");
    expect(cells[1].querySelector("b").textContent).toBe("굵게");
    expect(cells[2].textContent).toBe("1,234,567");
  });

  it("formatter·cellClass의 this와 인자에 value, row, item, key, rowIndex, dindex가 있다", () => {
    let seen;
    const grid = new PyoGrid(host, {
      columns: [{ key: "x", formatter() { seen = { ...this }; return ""; }, cellClass: (c) => (c.row.x > 1 ? "big" : "") }],
    });
    const rows = [{ x: 1 }, { x: 2 }];
    grid.setData(rows);
    expect(seen).toMatchObject({ value: 2, row: rows[1], item: rows[1], key: "x", rowIndex: 1, dindex: 1 });
    expect(cellsOf(grid, 0)[0].classList.contains("big")).toBe(false);
    expect(cellsOf(grid, 1)[0].classList.contains("big")).toBe(true);
  });

  it("rowClass, 줄 번호, 행 선택 칸", () => {
    const grid = new PyoGrid(host, {
      lineNumber: true,
      rowSelector: true,
      rowClass: (row, i) => (i === 1 ? "hl" : ""),
      columns: [{ key: "id" }],
    });
    grid.setData(makeRows(3));
    const row1 = grid.el.body.querySelector('[data-row="1"]');
    expect(row1.classList.contains("hl")).toBe(true);
    expect(row1.classList.contains("pyo-odd")).toBe(true);
    const aside = row1.querySelectorAll(".pyo-aside");
    expect(aside[0].textContent).toBe("2");
    expect(aside[1].querySelector(".pyo-check")).not.toBeNull();
    expect(grid.el.headFz.querySelector('[data-special="rowSelector"] .pyo-check')).not.toBeNull();
  });

  it("데이터가 없으면 안내 문구를 보여 준다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }] });
    grid.setData([]);
    expect(grid.el.empty.hidden).toBe(false);
    expect(grid.el.empty.textContent).toBe("조회된 데이터가 없습니다.");
    grid.setData(makeRows(1));
    expect(grid.el.empty.hidden).toBe(true);
    const g2 = new PyoGrid(document.body.appendChild(document.createElement("div")), { emptyText: null });
    g2.setData([]);
    expect(g2.el.empty.hidden).toBe(true);
  });

  it("행 객체를 복사하지 않는다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "id" }] });
    const rows = makeRows(3);
    grid.setData(rows);
    expect(grid.getRow(1)).toBe(rows[1]);
    expect(grid.getRows()).not.toBe(rows);
    rows[1].id = 99;
    grid.refreshRow(1);
    expect(cellsOf(grid, 1)[0].textContent).toBe("99");
  });
});

describe("다단 헤더와 틀 고정", () => {
  const columns = [
    { key: "a", label: "A", width: 100 },
    { key: "b", label: "B", width: 100 },
    { label: "묶음", columns: [{ key: "c", label: "C", width: 50 }, { key: "d", label: "D", width: 60 }] },
    { key: "e", label: "E", width: 70 },
  ];

  it("헤더 칸 위치·크기", () => {
    const grid = new PyoGrid(host, { columns, headerRowHeight: 30 });
    expect(grid.el.head.style.height).toBe("61px");
    const g = [...grid.el.headSc.querySelectorAll(".pyo-hcell")].find((c) => c.textContent === "묶음");
    expect(g.style.left).toBe("200px");
    expect(g.style.width).toBe("110px");
    expect(g.style.height).toBe("30px");
    const a = grid.el.headSc.querySelector('[data-key="a"]');
    expect(a.style.height).toBe("60px");
    const d = grid.el.headSc.querySelector('[data-key="d"]');
    expect(d.style.top).toBe("30px");
    expect(d.style.left).toBe("250px");
  });

  it("틀 고정 경계를 걸치는 묶음은 양쪽으로 나뉜다", () => {
    const grid = new PyoGrid(host, { columns, frozenColumns: 3, rowSelector: true });
    expect(grid.fzWidth).toBe(26 + 250);
    const fzGroup = [...grid.el.headFz.querySelectorAll(".pyo-hgroup")];
    const scGroup = [...grid.el.headSc.querySelectorAll(".pyo-hgroup")];
    expect(fzGroup).toHaveLength(1);
    expect(scGroup).toHaveLength(1);
    expect(fzGroup[0].style.left).toBe("226px");
    expect(fzGroup[0].style.width).toBe("50px");
    expect(scGroup[0].style.left).toBe("0px");
    expect(scGroup[0].style.width).toBe("60px");
    grid.setData(makeRows(2).map((r) => ({ a: 1, b: 2, c: 3, d: 4, e: 5 })));
    const row = grid.el.body.querySelector('[data-row="0"]');
    expect(row.querySelector(".pyo-fz").querySelectorAll(".pyo-cell")).toHaveLength(4); // 행 선택 + a,b,c
    expect(row.querySelector(".pyo-sc").querySelectorAll(".pyo-cell")).toHaveLength(2);
    expect(grid.el.root.classList.contains("pyo-has-frozen")).toBe(true);
  });

  it("보이는 컬럼만 그린다 (가로 가상 스크롤)", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ key: "k" + i, width: 100 }));
    const grid = new PyoGrid(host, { columns: many, frozenColumns: 1 });
    grid.setData([Object.fromEntries(many.map((c, i) => [c.key, i]))]);
    let sc = grid.el.body.querySelector(".pyo-sc");
    // 고정 1열(100px) 뒤 보이는 700px → 7~8열 + 여유 2열
    expect(sc.querySelectorAll(".pyo-cell").length).toBeLessThanOrEqual(11);
    grid.el.scroll.scrollLeft = 100 * 100;
    grid.refresh();
    sc = grid.el.body.querySelector(".pyo-sc");
    const first = sc.querySelector(".pyo-cell");
    expect(Number(first.dataset.c)).toBe(101 - 2);
    expect(sc.style.paddingLeft).toBe((101 - 2 - 1) * 100 + "px");
    expect(grid.el.body.querySelector(".pyo-fz .pyo-cell").textContent).toBe("0");
  });
});

describe("컬럼 추가·삭제·너비", () => {
  const base = () => [
    { key: "a", width: 100 },
    { key: "b", width: "*" },
    { key: "c", width: "25%" },
  ];

  it('"*"와 %는 그리드 너비 기준 (스크롤바 15px 제외)', () => {
    const grid = new PyoGrid(host, { columns: base(), lineNumber: true });
    const avail = 800 - 30 - 15;
    expect(grid.getColumnWidths()).toEqual([100, avail - 100 - Math.floor(avail * 0.25), Math.floor(avail * 0.25)]);
  });

  it("addColumn / removeColumn / updateColumn", () => {
    const grid = new PyoGrid(host, { columns: base() });
    grid.addColumn({ key: "x", width: 40 });
    expect(grid.leaves.map((l) => l.key)).toEqual(["a", "b", "c", "x"]);
    grid.addColumn({ key: "y", width: 40 }, 0);
    expect(grid.leaves.map((l) => l.key)).toEqual(["y", "a", "b", "c", "x"]);
    grid.removeColumn();
    expect(grid.leaves.map((l) => l.key)).toEqual(["y", "a", "b", "c"]);
    grid.removeColumn(0);
    grid.updateColumn({ key: "z", width: 10 }, 2);
    expect(grid.leaves.map((l) => l.key)).toEqual(["a", "b", "z"]);
    grid.removeColumn(99);
    expect(grid.leaves).toHaveLength(3);
  });

  it("사용자가 조절한 너비는 컬럼을 추가해도 유지된다", () => {
    const cols = base();
    const grid = new PyoGrid(host, { columns: cols });
    const events = [];
    grid.on("columnresize", (e) => events.push(e));
    grid.setColumnWidth(0, 180);
    expect(events).toEqual([{ index: 0, column: cols[0], width: 180 }]);
    grid.addColumn({ key: "new", width: 50 }, 0);
    expect(grid.getColumnWidths()[1]).toBe(180);
    grid.setColumnWidth(1, 3);
    expect(grid.getColumnWidths()[1]).toBe(10); // minColumnWidth
  });

  it("헤더 리사이저를 끌면 너비가 바뀐다", () => {
    const grid = new PyoGrid(host, { columns: base() });
    const handle = grid.el.headSc.querySelector('[data-resize="0"]');
    const fire = (type, x) => handle.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x }));
    // jsdom에는 PointerEvent가 없을 수 있어 MouseEvent에 같은 이름을 붙인다
    fire("pointerdown", 100);
    fire("pointermove", 140);
    expect(grid.el.guide.style.display).toBe("block");
    fire("pointerup", 150);
    expect(grid.getColumnWidths()[0]).toBe(150);
    expect(grid.el.guide.style.display).toBe("none");
  });

  it("destroy는 DOM과 핸들러를 정리한다", () => {
    const grid = new PyoGrid(host, { columns: base() });
    grid.destroy();
    expect(host.innerHTML).toBe("");
    expect(host.classList.contains("pyo-host")).toBe(false);
    grid.destroy();
  });
});
