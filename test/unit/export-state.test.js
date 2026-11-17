// 엑셀 내보내기와 너비·정렬 기억
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import * as XLSX from "xlsx";
import { toXlsxCell, htmlToText, toWorksheet } from "../../src/features/excel.js";
import { storageKey } from "../../src/features/state.js";
import { mockLayout, unmockLayout, fire } from "./helpers.js";

describe("toXlsxCell", () => {
  // stage6.test.js의 공통 준비
  let host;
  beforeEach(() => {
    mockLayout();
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    unmockLayout();
  });

  it("쉼표 숫자는 숫자 + 서식", () => {
    expect(toXlsxCell("1,234", "1,234", null, "body")).toEqual({ t: "n", v: 1234, z: "#,##0" });
    expect(toXlsxCell("-1,234.50", null, null, "body")).toEqual({ t: "n", v: -1234.5, z: "#,##0.00" });
  });
  it("원래 값이 숫자이거나 money·오른쪽 정렬·합계면 숫자", () => {
    expect(toXlsxCell("12", 12, null, "body")).toEqual({ t: "n", v: 12 });
    expect(toXlsxCell("12", "12", { align: "right" }, "body")).toEqual({ t: "n", v: 12 });
    expect(toXlsxCell("12", "12", { formatter: "money" }, "body")).toEqual({ t: "n", v: 12, z: "#,##0" });
    expect(toXlsxCell("99", undefined, null, "sum")).toEqual({ t: "n", v: 99 });
  });
  it("코드·글자·헤더는 글자, 빈 칸은 null", () => {
    expect(toXlsxCell("0012", "0012", { align: "right" }, "body")).toEqual({ t: "s", v: "0012" });
    expect(toXlsxCell("12", "12", null, "body")).toEqual({ t: "s", v: "12" });
    expect(toXlsxCell("1,000", undefined, null, "header")).toEqual({ t: "s", v: "1,000" });
    expect(toXlsxCell("<b>굵게</b>&nbsp;", "x", null, "body")).toEqual({ t: "s", v: "굵게" });
    expect(toXlsxCell("", "", null, "body")).toBeNull();
    expect(htmlToText("a<br>b")).toBe("a b");
  });
});

describe("엑셀 내보내기", () => {
  // stage6.test.js의 공통 준비
  let host;
  beforeEach(() => {
    mockLayout();
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    unmockLayout();
  });
  const columns = () => [
    { key: "code", label: "코드", width: 60 },
    { label: "이번 주", columns: [
      { key: "qty", label: "수량", width: 70, align: "right", formatter: "money" },
      { key: "amt", label: "금액", width: 90, align: "right", formatter: "money" },
    ] },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "memo", label: "비고", html: true, formatter: (c) => "<i>" + c.value + "</i>" },
  ];
  const rows = () => [
    { code: "0012", qty: 1200, amt: 3500000, use: "Y", memo: "가" },
    { code: "0034", qty: 30, amt: "1,000", use: "N", memo: "나" },
  ];

  it("다단 헤더 병합·숫자 셀·합계 행 (SheetJS로 다시 읽어 확인)", () => {
    const grid = new PyoGrid(host, {
      columns: columns(),
      footSum: [[{ label: "합계", align: "center" }, { key: "qty", collector: "sum", formatter: "money" }, { key: "amt", collector: "sum", formatter: "money" }]],
    });
    grid.setData(rows());
    const data = grid.getExportData();
    expect(data.headerRows).toBe(2);
    const ws = toWorksheet(data, XLSX);
    // SheetJS로 실제 파일 바이트를 만들고 다시 읽는다
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const back = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" }).Sheets.S;
    expect(back.A1.v).toBe("코드");
    expect(back.B1.v).toBe("이번 주");
    expect(back.B2.v).toBe("수량");
    expect(back["!merges"].map((m) => XLSX.utils.encode_range(m)).sort()).toEqual(["A1:A2", "B1:C1", "D1:D2", "E1:E2"]);
    expect(back.A3).toMatchObject({ t: "s", v: "0012" });
    expect(back.B3).toMatchObject({ t: "n", v: 1200 });
    expect(back.C3).toMatchObject({ t: "n", v: 3500000 });
    expect(back.C4).toMatchObject({ t: "n", v: 1000 });
    expect(back.D3).toMatchObject({ t: "s", v: "Y" });
    expect(back.E3).toMatchObject({ t: "s", v: "가" });
    expect(back.A5.v).toBe("합계");
    expect(back.B5).toMatchObject({ t: "n", v: 1230 });
    expect(back.C5).toMatchObject({ t: "n", v: 3501000 });
    expect(back["!ref"]).toBe("A1:E5");
  });

  it("그룹 합계 행과 colspan 병합", () => {
    const grid = new PyoGrid(host, {
      columns: [{ key: "g", label: "그룹" }, { key: "n", label: "이름" }, { key: "v", label: "값", align: "right" }],
      grouping: { by: ["g"], columns: [{ label: "소계", colspan: 2 }, { key: "v", collector: "sum" }] },
    });
    grid.setData([{ g: "A", n: "a", v: 1 }, { g: "A", n: "b", v: 2 }]);
    const d = grid.getExportData();
    expect(d.rows.map((r) => r.map((c) => (c ? c.v : null)))).toEqual([["그룹", "이름", "값"], ["A", "a", 1], ["A", "b", 2], ["소계", null, 3]]);
    expect(d.merges).toContainEqual({ s: { r: 3, c: 0 }, e: { r: 3, c: 1 } });
  });

  it("exportExcel: 파일 이름 .xls → .xlsx, 시트 이름, SheetJS 없으면 false", () => {
    const writeFile = vi.fn();
    const fake = { ...XLSX, writeFile, utils: XLSX.utils };
    const grid = new PyoGrid(host, { columns: columns(), sheetName: "주간[1]" });
    grid.setData(rows());
    expect(grid.exportExcel("목록.xls", { XLSX: fake })).toBe(true);
    expect(writeFile.mock.calls[0][1]).toBe("목록.xlsx");
    expect(writeFile.mock.calls[0][0].SheetNames).toEqual(["주간1"]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(grid.exportExcel("x")).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("컬럼 너비·정렬 기억", () => {
  // stage6.test.js의 공통 준비
  let host;
  beforeEach(() => {
    mockLayout();
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    unmockLayout();
  });

  const cols = () => [
    { key: "a", label: "A", width: 80, sortable: true },
    { key: "b", label: "B", width: 80, sortable: true },
  ];

  it("너비 조절·정렬을 저장하고 새 그리드에서 되살린다", () => {
    const g1 = new PyoGrid(host, { columns: cols(), stateKey: "t1" });
    g1.setData([{ a: 2, b: "x" }, { a: 1, b: "y" }]);
    const handle = g1.el.headSc.querySelector('[data-resize="1"]');
    fire(handle, "pointerdown", { clientX: 160 });
    fire(handle, "pointerup", { clientX: 200 });
    g1.toggleSort(0); // a desc
    const saved = JSON.parse(localStorage.getItem(storageKey("t1")));
    expect(saved).toEqual({ widths: { b: 120 }, sort: [{ key: "a", dir: "desc" }] });
    g1.destroy();

    const g2 = new PyoGrid(host, { columns: cols(), stateKey: "t1" });
    g2.setData([{ a: 1 }, { a: 3 }, { a: 2 }]);
    expect(g2.getColumnWidths()).toEqual([80, 120]);
    expect(g2.getSort()).toEqual([{ key: "a", dir: "desc" }]);
    expect(g2.getRows().map((r) => r.a)).toEqual([3, 2, 1]);
    expect(g2.el.headSc.querySelector('[data-key="a"]').dataset.sort).toBe("desc");
  });

  it("setColumns로 컬럼이 바뀌어도 같은 키는 되살리고, 없는 키 너비는 지우지 않는다", () => {
    const g = new PyoGrid(host, { columns: cols(), stateKey: "t2" });
    g.setColumnWidth(0, 150);
    g.setColumns([{ key: "b", width: 80 }, { key: "c", width: 80 }]);
    g.setColumnWidth(1, 200);
    expect(JSON.parse(localStorage.getItem(storageKey("t2"))).widths).toEqual({ a: 150, c: 200 });
    g.setColumns(cols());
    expect(g.getColumnWidths()[0]).toBe(150);
  });

  it("정렬할 수 없게 바뀐 컬럼, 10px 이하 너비, 깨진 저장값은 무시. resetState", () => {
    localStorage.setItem(storageKey("t3"), JSON.stringify({ widths: { a: 5, b: 99 }, sort: [{ key: "a", dir: "asc" }, { key: "zz", dir: "asc" }] }));
    const g = new PyoGrid(host, { columns: [{ key: "a", width: 80, sortable: false }, { key: "b", width: 80 }], stateKey: "t3" });
    expect(g.getColumnWidths()).toEqual([80, 99]);
    expect(g.getSort()).toEqual([]);
    g.resetState();
    expect(localStorage.getItem(storageKey("t3"))).toBeNull();
    localStorage.setItem(storageKey("t4"), "{깨짐");
    expect(() => new PyoGrid(document.body.appendChild(document.createElement("div")), { columns: cols(), stateKey: "t4" })).not.toThrow();
  });

  it("stateKey가 없으면 저장하지 않는다", () => {
    const g = new PyoGrid(host, { columns: cols() });
    g.setColumnWidth(0, 150);
    expect(localStorage.length).toBe(0);
  });
});
