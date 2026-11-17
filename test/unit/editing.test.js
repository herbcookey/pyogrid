// 셀 편집·키보드·한글 입력·편집기
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PyoGrid } from "../../src/grid.js";
import { parseDateValue, formatDateAs, editorTypes, sameValue } from "../../src/editors/types.js";
import { mockLayout, unmockLayout, cellsOf, fire } from "./helpers.js";

describe("편집 시작·저장·취소", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());
  const typeChar = (input, ch) => {
    const ev = key(input, ch);
    if (!ev.defaultPrevented) {
      input.value += ch;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
    }
    return ev;
  };
  const type = (input, s) => [...s].forEach((ch) => typeChar(input, ch));

  it("글자를 치면 빈 값으로 편집이 시작되고 첫 글자가 남는다, Enter로 저장 후 아래로", () => {
    const { grid, rows, changes, input } = setup();
    grid.setRange(1, 0);
    const ev = typeChar(input, "김");
    expect(ev.defaultPrevented).toBe(false);
    expect(grid.isEditing).toBe(true);
    expect(input.classList.contains("pyo-input-on")).toBe(true);
    type(input, "철수");
    expect(input.value).toBe("김철수");
    key(input, "Enter");
    expect(grid.isEditing).toBe(false);
    expect(rows[1].name).toBe("김철수");
    expect(rows[1].__modified__).toBe(true);
    expect(changes[0]).toMatchObject({ rowIndex: 1, key: "name", value: "김철수", oldValue: "나", source: "edit", batch: false });
    expect(grid.getRange().active).toEqual({ r: 2, c: 0 });
    expect(cellsOf(grid, 1)[0].textContent).toBe("김철수");
    expect(input.value).toBe("");
  });

  it("F2는 지금 값으로 시작하고 커서는 끝, Esc는 취소", () => {
    const { grid, rows, changes, input } = setup();
    grid.setRange(0, 0);
    key(input, "F2");
    expect(input.value).toBe("가");
    expect(input.selectionStart).toBe(1);
    input.value = "바뀜";
    key(input, "Escape");
    expect(rows[0].name).toBe("가");
    expect(changes).toEqual([]);
    expect(grid.isEditing).toBe(false);
  });

  it("Enter·Space도 지금 값으로 편집, Shift+Enter는 위로, Tab은 오른쪽", () => {
    const { grid, input } = setup();
    grid.setRange(1, 0);
    key(input, "Enter");
    expect(grid.isEditing).toBe(true);
    expect(input.value).toBe("나");
    key(input, "Enter", { shiftKey: true });
    expect(grid.getRange().active).toEqual({ r: 0, c: 0 });
    key(input, " ");
    expect(grid.isEditing).toBe(true);
    key(input, "Tab");
    expect(grid.getRange().active).toEqual({ r: 0, c: 1 });
    expect(grid.isEditing).toBe(false);
  });

  it("값이 같으면 change를 알리지 않고 __modified__도 붙지 않는다", () => {
    const { grid, rows, changes, input } = setup();
    grid.setRange(0, 0);
    key(input, "F2");
    key(input, "Enter");
    expect(changes).toEqual([]);
    expect(rows[0].__modified__).toBeUndefined();
  });

  it("편집기 없는 셀·disabled 셀은 편집되지 않고 글자도 막는다", () => {
    const { grid, input } = setup();
    grid.setRange(0, 6);
    expect(typeChar(input, "a").defaultPrevented).toBe(true);
    expect(grid.isEditing).toBe(false);
    grid.setRange(0, 7); // locked
    key(input, "F2");
    expect(grid.isEditing).toBe(false);
    grid.setRange(1, 7);
    key(input, "F2");
    expect(grid.isEditing).toBe(true);
  });

  it("편집 중 다른 셀을 누르면 저장하고 그 셀로", () => {
    const { grid, rows, input } = setup();
    grid.setRange(0, 0);
    type(input, "x");
    fire(cellsOf(grid, 2)[1], "pointerdown");
    expect(rows[0].name).toBe("x");
    expect(grid.getRange().active).toEqual({ r: 2, c: 1 });
  });

  it("입력칸에서 포커스가 나가면 저장", () => {
    const { grid, rows, input } = setup();
    grid.setRange(0, 0);
    grid.focus();
    type(input, "y");
    input.dispatchEvent(new FocusEvent("blur"));
    expect(rows[0].name).toBe("y");
  });

  it("더블클릭으로 편집, 편집 셀은 dblclick을 알리지 않는다", () => {
    const { grid, input } = setup();
    const dbl = vi.fn();
    grid.on("dblclick", dbl);
    cellsOf(grid, 2)[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(grid.isEditing).toBe(true);
    expect(input.value).toBe("다");
    expect(dbl).not.toHaveBeenCalled();
    grid.cancelEdit();
    cellsOf(grid, 2)[6].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(dbl).toHaveBeenCalledTimes(1);
  });

  it("beforeedit에서 false면 시작하지 않는다, editstart/editend", () => {
    const { grid, input } = setup();
    const log = [];
    grid.on("beforeedit", (e) => (e.rowIndex === 0 ? false : undefined));
    grid.on("editstart", (e) => log.push("start" + e.rowIndex));
    grid.on("editend", (e) => log.push("end" + e.committed));
    grid.setRange(0, 0);
    key(input, "F2");
    expect(grid.isEditing).toBe(false);
    grid.setRange(1, 0);
    key(input, "F2");
    key(input, "Escape");
    expect(log).toEqual(["start1", "endfalse"]);
  });

  it("editor.attributes를 입력칸에 붙였다가 끝나면 뗀다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text", attributes: { maxlength: 5 } } }] });
    grid.setData([{ a: "" }]);
    grid.setRange(0, 0);
    grid.startEdit(0, 0);
    expect(grid.editing.input.getAttribute("maxlength")).toBe("5");
    grid.cancelEdit();
    expect(grid.editing.input.hasAttribute("maxlength")).toBe(false);
  });

  it("편집 중 setData는 편집을 버린다", () => {
    const { grid, input } = setup();
    grid.setRange(0, 0);
    type(input, "zz");
    grid.setData(data());
    expect(grid.isEditing).toBe(false);
    expect(grid.getRow(0).name).toBe("가");
  });
});

describe("숫자·금액·날짜", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());
  const typeChar = (input, ch) => {
    const ev = key(input, ch);
    if (!ev.defaultPrevented) {
      input.value += ch;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
    }
    return ev;
  };
  const type = (input, s) => [...s].forEach((ch) => typeChar(input, ch));

  it("number: 숫자가 아닌 글자는 지워지고 숫자로 저장", () => {
    const { grid, rows, input } = setup();
    grid.setRange(0, 1);
    type(input, "1a2b3");
    expect(input.value).toBe("123");
    key(input, "Enter");
    expect(rows[0].qty).toBe(123);
  });

  it("money: 입력 중 쉼표, 저장은 숫자, 화면은 money 서식", () => {
    const { grid, rows, input } = setup();
    grid.setRange(1, 2);
    type(input, "1234567");
    expect(input.value).toBe("1,234,567");
    key(input, "Enter");
    expect(rows[1].amt).toBe(1234567);
    expect(cellsOf(grid, 1)[2].textContent).toBe("1,234,567");
    grid.setRange(1, 2);
    key(input, "F2");
    expect(input.value).toBe("1,234,567");
  });

  it("잘못된 값은 저장하지 않고 편집을 계속한다 (빨간 테두리)", () => {
    const { grid, rows, input } = setup();
    grid.setRange(1, 3);
    type(input, "20260230");
    expect(input.value).toBe("2026-02-30");
    key(input, "Enter");
    expect(grid.isEditing).toBe(true);
    expect(input.classList.contains("pyo-invalid")).toBe(true);
    expect(rows[1].dt).toBe("");
    // 고치면 저장
    input.value = "";
    type(input, "20260228");
    key(input, "Enter");
    expect(rows[1].dt).toBe("2026-02-28");
  });

  it("date: 달력 팝업에서 날짜를 누르면 저장", () => {
    const { grid, rows, input } = setup();
    grid.setRange(0, 3);
    key(input, "F2");
    const pop = document.querySelector(".pyo-calendar");
    expect(pop).not.toBeNull();
    expect(pop.querySelector(".pyo-cal-title").textContent).toBe("November 2026");
    expect(pop.querySelector(".pyo-picked").dataset.date).toBe("2026-11-12");
    pop.querySelector('[data-date="2026-11-20"]').click();
    expect(rows[0].dt).toBe("2026-11-20");
    expect(document.querySelector(".pyo-calendar")).toBeNull();
  });

  it("date: 다음 달 버튼, 입력한 날짜로 달력 이동", () => {
    const { grid, input } = setup();
    grid.setRange(0, 3);
    key(input, "F2");
    const pop = document.querySelector(".pyo-calendar");
    pop.querySelector('[data-cal="next"]').click();
    expect(pop.querySelector(".pyo-cal-title").textContent).toBe("December 2026");
    input.value = "";
    type(input, "20250301");
    expect(pop.querySelector(".pyo-cal-title").textContent).toBe("March 2025");
  });
});

describe("선택 목록", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());
  const typeChar = (input, ch) => {
    const ev = key(input, ch);
    if (!ev.defaultPrevented) {
      input.value += ch;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
    }
    return ev;
  };

  it("formatter가 없으면 항목 글자를 보여 준다", () => {
    const { grid } = setup();
    expect(cellsOf(grid, 0)[4].textContent).toBe("가공");
  });

  it("Enter로 열고 방향키로 고른 뒤 Enter로 저장", () => {
    const { grid, rows, input } = setup();
    grid.setRange(0, 4);
    key(input, "Enter");
    const dd = document.querySelector(".pyo-dropdown");
    expect(dd.querySelector(".pyo-option-active").textContent).toBe("가공");
    key(input, "ArrowDown");
    key(input, "ArrowDown");
    expect(dd.querySelector(".pyo-option-active").textContent).toBe("조립");
    key(input, "Enter");
    expect(rows[0].cd).toBe("C");
    expect(document.querySelector(".pyo-dropdown")).toBeNull();
    expect(grid.getRange().active).toEqual({ r: 1, c: 4 });
  });

  it("글자로 찾기 (한글 포함), 클릭으로 고르기, Esc 취소", () => {
    const { grid, rows, input } = setup();
    grid.setRange(1, 4);
    typeChar(input, "조");
    const dd = document.querySelector(".pyo-dropdown");
    expect(dd.querySelector(".pyo-option-active").textContent).toBe("조립");
    dd.querySelectorAll(".pyo-option")[0].click();
    expect(rows[1].cd).toBe("A");
    grid.setRange(2, 4);
    key(input, "Enter");
    key(input, "ArrowUp");
    key(input, "Escape");
    expect(rows[2].cd).toBe("C");
  });
});

describe("체크박스", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());

  it("클릭하면 trueValue/falseValue로 바뀐다", () => {
    const { grid, rows, changes } = setup();
    const cb = () => cellsOf(grid, 1)[5].querySelector(".pyo-cb");
    expect(cb().classList.contains("pyo-checked")).toBe(false);
    cellsOf(grid, 1)[5].click();
    expect(rows[1].use).toBe("Y");
    expect(cb().classList.contains("pyo-checked")).toBe(true);
    cellsOf(grid, 1)[5].click();
    expect(rows[1].use).toBe("N");
    expect(changes.map((c) => c.value)).toEqual(["Y", "N"]);
  });

  it("Space·Enter로 바뀐다, 기본값은 true/false", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "ok", editor: { type: "checkbox" } }] });
    const rows = [{ ok: false }];
    grid.setData(rows);
    grid.setRange(0, 0);
    key(grid.editing.input, " ");
    expect(rows[0].ok).toBe(true);
    key(grid.editing.input, "Enter");
    expect(rows[0].ok).toBe(false);
  });
});

describe("Delete·Backspace", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());

  it("Delete는 범위 안의 편집 가능한 셀만 비우고 batchchange 한 번", () => {
    const { grid, rows, changes } = setup();
    const batches = [];
    grid.on("batchchange", (e) => batches.push(e));
    grid.setRange(0, 0, 2, 7);
    key(grid.editing.input, "Delete");
    // 이름·수량·금액·일자·구분 3행 (빈 일자 2개 제외) + 잠금(1,2행)
    expect(rows.map((r) => r.name)).toEqual(["", "", ""]);
    expect(rows.map((r) => r.amt)).toEqual(["", "", ""]);
    expect(rows.map((r) => r.ro)).toEqual(["x", "y", "z"]);
    expect(rows.map((r) => r.use)).toEqual(["Y", "N", "N"]);
    expect(rows.map((r) => r.lock)).toEqual(["a", "", ""]);
    expect(batches).toHaveLength(1);
    expect(batches[0].source).toBe("clear");
    expect(batches[0].changes).toHaveLength(changes.length);
    expect(changes.every((c) => c.batch && c.source === "clear")).toBe(true);
    expect(changes).toHaveLength(3 + 3 + 3 + 1 + 3 + 2);
  });

  it("Backspace는 빈 값으로 편집 시작", () => {
    const { grid, input } = setup();
    grid.setRange(0, 0);
    key(input, "Backspace");
    expect(grid.isEditing).toBe(true);
    expect(input.value).toBe("");
  });
});

describe("방향키 이동", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());
  const typeChar = (input, ch) => {
    const ev = key(input, ch);
    if (!ev.defaultPrevented) {
      input.value += ch;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
    }
    return ev;
  };
  const type = (input, s) => [...s].forEach((ch) => typeChar(input, ch));

  it("방향키·Shift 범위·Ctrl 끝·Home/End·Tab 줄바꿈", () => {
    const { grid, input } = setup();
    grid.setRange(1, 1);
    key(input, "ArrowRight");
    expect(grid.getRange().active).toEqual({ r: 1, c: 2 });
    key(input, "ArrowDown", { shiftKey: true });
    expect(grid.getRange()).toMatchObject({ r0: 1, c0: 2, r1: 2, c1: 2 });
    key(input, "ArrowUp", { ctrlKey: true });
    expect(grid.getRange().active).toEqual({ r: 0, c: 2 });
    key(input, "End");
    expect(grid.getRange().active).toEqual({ r: 0, c: 7 });
    key(input, "Tab");
    expect(grid.getRange().active).toEqual({ r: 1, c: 0 });
    key(input, "Tab", { shiftKey: true });
    expect(grid.getRange().active).toEqual({ r: 0, c: 7 });
    key(input, "Home", { ctrlKey: true });
    expect(grid.getRange().active).toEqual({ r: 0, c: 0 });
    key(input, "ArrowUp");
    expect(grid.getRange().active).toEqual({ r: 0, c: 0 });
  });

  it("선택 셀이 없으면 첫 키에 첫 셀, Ctrl+A는 전체", () => {
    const { grid, input } = setup();
    key(input, "ArrowDown");
    expect(grid.getRange().active).toEqual({ r: 0, c: 0 });
    key(input, "a", { ctrlKey: true });
    expect(grid.getRange()).toMatchObject({ r0: 0, c0: 0, r1: 2, c1: 7 });
  });

  it("편집 중 위·아래 방향키는 저장하고 이동, 좌우는 글자 안에서", () => {
    const { grid, rows, input } = setup();
    grid.setRange(1, 0);
    type(input, "q");
    const left = key(input, "ArrowLeft");
    expect(left.defaultPrevented).toBe(false);
    expect(grid.isEditing).toBe(true);
    key(input, "ArrowUp");
    expect(rows[1].name).toBe("q");
    expect(grid.getRange().active).toEqual({ r: 0, c: 0 });
  });
});

describe("한글 조합 (IME)", () => {
  // stage3.test.js의 공통 준비
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
  const columns = () => [
    { key: "name", label: "이름", editor: { type: "text" } },
    { key: "qty", label: "수량", align: "right", editor: { type: "number" } },
    { key: "amt", label: "금액", align: "right", formatter: "money", editor: { type: "money" } },
    { key: "dt", label: "일자", editor: { type: "date" } },
    {
      key: "cd", label: "구분",
      editor: { type: "select", config: { columnKeys: { optionValue: "CD", optionText: "NM" }, options: [{ CD: "A", NM: "가공" }, { CD: "B", NM: "부품" }, { CD: "C", NM: "조립" }] } },
    },
    { key: "use", label: "사용", editor: { type: "checkbox", config: { trueValue: "Y", falseValue: "N" } } },
    { key: "ro", label: "읽기 전용" },
    { key: "lock", label: "잠금", editor: { type: "text", disabled: (c) => c.row.locked } },
  ];
  const data = () => [
    { name: "가", qty: 1, amt: 1000, dt: "2026-11-12", cd: "A", use: "Y", ro: "x", lock: "a", locked: true },
    { name: "나", qty: 2, amt: 2000, dt: "", cd: "B", use: "N", ro: "y", lock: "b", locked: false },
    { name: "다", qty: 3, amt: 3000, dt: "", cd: "C", use: "N", ro: "z", lock: "c", locked: false },
  ];
  function setup(opts = {}) {
    const grid = new PyoGrid(host, { columns: columns(), ...opts });
    const rows = data();
    grid.setData(rows);
    const changes = [];
    grid.on("change", (e) => changes.push(e));
    return { grid, rows, changes, input: grid.editing.input };
  }
  const key = (input, k, init = {}) => {
    const ev = new KeyboardEvent("keydown", { key: k, code: init.code || codeOf(k), bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(ev);
    return ev;
  };
  const codeOf = (k) => ({ Enter: "Enter", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", F2: "F2", Delete: "Delete", Backspace: "Backspace", " ": "Space" }[k] || "Key" + k.toUpperCase());

  const compose = (input, steps, final) => {
    key(input, "Process", { keyCode: 229, code: "KeyG" });
    input.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
    for (const s of steps) {
      input.value = input.value.replace(/[ㄱ-ㅎ가-힣]$/, "") + s;
      input.dispatchEvent(new InputEvent("input", { isComposing: true, data: s, inputType: "insertCompositionText" }));
    }
    input.dispatchEvent(new CompositionEvent("compositionend", { data: final }));
    input.dispatchEvent(new InputEvent("input", { isComposing: false, data: final, inputType: "insertCompositionText" }));
  };

  it("조합 첫 키(229)에서 편집이 시작되고 입력칸 값을 건드리지 않는다", () => {
    const { grid, rows, input } = setup();
    grid.setRange(2, 0);
    compose(input, ["ㅎ", "하", "한"], "한");
    expect(grid.isEditing).toBe(true);
    expect(input.value).toBe("한");
    key(input, "Enter");
    expect(rows[2].name).toBe("한");
  });

  it("조합 중 누른 Enter는 조합이 끝난 뒤 저장·이동한다 (한 번만)", async () => {
    const { grid, rows, input } = setup();
    grid.setRange(1, 0);
    key(input, "Process", { keyCode: 229, code: "KeyG" });
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "글";
    input.dispatchEvent(new InputEvent("input", { isComposing: true }));
    // 조합 중 Enter (Windows Chrome: keyCode 229, code Enter)
    key(input, "Process", { keyCode: 229, code: "Enter", isComposing: true });
    expect(grid.isEditing).toBe(true);
    input.dispatchEvent(new CompositionEvent("compositionend", { data: "글" }));
    await new Promise((r) => setTimeout(r, 5));
    expect(rows[1].name).toBe("글");
    expect(grid.getRange().active).toEqual({ r: 2, c: 0 });
    // macOS처럼 조합 뒤 Enter가 한 번 더 오면 무시
    const dup = key(input, "Enter");
    expect(dup.defaultPrevented).toBe(true);
    expect(grid.isEditing).toBe(false);
    expect(grid.getRange().active).toEqual({ r: 2, c: 0 });
  });

  it("편집할 수 없는 셀에서 조합한 글자는 버린다", () => {
    const { grid, input } = setup();
    grid.setRange(0, 6);
    key(input, "Process", { keyCode: 229, code: "KeyG" });
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "ㅎ";
    input.dispatchEvent(new CompositionEvent("compositionend", { data: "ㅎ" }));
    expect(grid.isEditing).toBe(false);
    expect(input.value).toBe("");
  });

  it("숫자 칸에 한글을 조합하면 조합이 끝날 때 지운다", () => {
    const { grid, input } = setup();
    grid.setRange(0, 1);
    compose(input, ["ㄱ"], "ㄱ");
    expect(input.value).toBe("");
  });
});

describe("10. Tab으로 그리드를 빠져나간다", () => {
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

  const setup = () => {
    const grid = new PyoGrid(host, { columns: [{ key: "a", editor: { type: "text" } }, { key: "b", editor: { type: "text" } }] });
    grid.setData([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
    return grid;
  };
  it("마지막 셀의 Tab, 첫 셀의 Shift+Tab은 막지 않는다 (가운데에서는 다음 셀로)", () => {
    const grid = setup();
    const input = grid.editing.input;
    grid.setRange(1, 1);
    expect(key(input, "Tab").defaultPrevented).toBe(false);
    grid.setRange(0, 0);
    expect(key(input, "Tab", { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(input, "Tab").defaultPrevented).toBe(true);
    expect(grid.getRange().active).toEqual({ r: 0, c: 1 });
  });

  it("편집 중 마지막 셀의 Tab은 저장하고 막지 않는다, 잘못된 값이면 막는다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "n", editor: { type: "number" } }] });
    const rows = [{ n: 1 }];
    grid.setData(rows);
    const input = grid.editing.input;
    grid.startEdit(0, 0);
    input.value = "5";
    expect(key(input, "Tab").defaultPrevented).toBe(false);
    expect(rows[0].n).toBe(5);
    expect(grid.isEditing).toBe(false);
    grid.startEdit(0, 0);
    input.value = "abc";
    expect(key(input, "Tab").defaultPrevented).toBe(true);
    expect(grid.isEditing).toBe(true);
  });

  it("범위가 없을 때 Shift+Tab은 막지 않는다", () => {
    const grid = setup();
    expect(key(grid.editing.input, "Tab", { shiftKey: true }).defaultPrevented).toBe(false);
  });
});

describe("11. date 편집기 저장 형식 (config.valueFormat)", () => {
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

  it("형식 글자와 함수", () => {
    const d = new Date(2026, 10, 3);
    expect(formatDateAs(d)).toBe("2026-11-03");
    expect(formatDateAs(d, "yyyyMMdd")).toBe("20261103");
    expect(formatDateAs(d, "yyyy.MM.dd")).toBe("2026.11.03");
    expect(formatDateAs(d, (x) => x.getTime())).toBe(d.getTime());
    expect(parseDateValue("2026-11-03", { valueFormat: "yyyyMMdd" })).toEqual({ ok: true, value: "20261103" });
    expect(parseDateValue("", { valueFormat: "yyyyMMdd" })).toEqual({ ok: true, value: "" });
    expect(parseDateValue("2026-02-30", { valueFormat: "yyyyMMdd" })).toEqual({ ok: false });
    expect(parseDateValue("20261103")).toEqual({ ok: true, value: "2026-11-03" });
  });

  it("편집·붙여넣기는 서버 형식 그대로 저장하고, 입력칸에는 yyyy-MM-dd로 보인다", () => {
    const grid = new PyoGrid(host, { columns: [{ key: "d", editor: { type: "date", config: { valueFormat: "yyyyMMdd" } } }] });
    const rows = [{ d: "20261113" }, { d: "20261114" }];
    grid.setData(rows);
    const input = grid.editing.input;
    grid.startEdit(0, 0);
    expect(input.value).toBe("2026-11-13");
    input.value = "2026-12-01";
    grid.commitEdit();
    expect(rows[0].d).toBe("20261201");
    // 그대로 Enter는 값을 건드리지 않는다 (수정된 행이 되지 않음)
    grid.startEdit(1, 0);
    grid.commitEdit();
    expect(rows[1].__modified__).toBeUndefined();
    grid.setRange(1, 0);
    grid.paste("2026.01.02");
    expect(rows[1].d).toBe("20260102");
    expect(sameValue(editorTypes.date, { valueFormat: "yyyyMMdd" }, "20260102", "20260102")).toBe(true);
  });
});

describe("조합 직후 같은 키 무시는 처리 시간과 관계없다", () => {
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
  const keydown = (k, init = {}) => new KeyboardEvent("keydown", { key: k, code: init.code || k, bubbles: true, cancelable: true, ...init });

  it("change 핸들러가 100ms 걸려도 조합 직후의 두 번째 Enter를 버린다", () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const grid = new PyoGrid(host, { columns: [{ key: "name", editor: { type: "text" } }] });
    const rows = [{ name: "가" }, { name: "나" }, { name: "다" }];
    grid.setData(rows);
    // 저장 뒤 다시 계산하는 화면처럼 change 처리가 오래 걸린다 (실제 시간)
    grid.on("change", () => {
      const t = Date.now();
      while (Date.now() - t < 100);
    });
    const input = grid.editing.input;
    grid.setRange(0, 0);
    input.dispatchEvent(keydown("Process", { keyCode: 229, code: "KeyG" }));
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "글";
    input.dispatchEvent(new InputEvent("input", { isComposing: true }));
    input.dispatchEvent(keydown("Process", { keyCode: 229, code: "Enter", isComposing: true }));
    input.dispatchEvent(new CompositionEvent("compositionend", { data: "글" }));
    // macOS 입력기가 조합을 끝내며 바로 보내는 Enter. 만들어진 시각은 지금이고, 처리는 저장이 끝난 뒤다
    const dup = keydown("Enter");
    vi.runOnlyPendingTimers();
    input.dispatchEvent(dup);
    expect(rows[0].name).toBe("글");
    expect(dup.defaultPrevented).toBe(true);
    expect(grid.isEditing).toBe(false);
    expect(grid.getRange().active).toEqual({ r: 1, c: 0 });
  });
});