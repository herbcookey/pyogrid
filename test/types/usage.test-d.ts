// 타입 테스트: npm run build 뒤 npm run typecheck:types로 검사한다 (실행하지 않는다).
// "pyogrid"는 package.json exports의 types(dist/types/index.d.ts)로 풀린다. 사용자가 받는 선언 파일 그대로다.
// 잘못된 사용은 // @ts-expect-error로 적는다. 오류가 나지 않으면 그 줄이 오히려 오류가 된다.
import { PyoGrid } from "pyogrid";
import type { AppliedChange, ColumnDef, FilterCondition, GridEvents, GridOptions, ViewRow } from "pyogrid";

/** A와 B가 정확히 같은 타입이면 true */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_?: T): void {}

declare const el: HTMLElement;

/* ------------------------------------------------------------------
 * 1. 행 타입을 준 그리드
 * ---------------------------------------------------------------- */

interface Order {
  SKU: string;
  QTY: number;
  LOCKED?: "Y" | "N";
}

const columns: ColumnDef<Order>[] = [
  {
    key: "SKU",
    formatter: (c) => c.row.SKU.toUpperCase(),
    cellClass(c) {
      assertType<Equal<typeof this, typeof c>>();
      return this.row.QTY < 0 ? "minus" : "";
    },
  },
  {
    key: "QTY",
    editor: { type: "number", disabled: (c) => c.row.LOCKED === "Y" },
    headerClass: (col) => (col.key === "QTY" ? "num" : ""),
  },
  { label: "Group", columns: [{ key: "a.b['c']", formatter: "money" }] },
];

const options: GridOptions<Order> = {
  columns,
  rowClass(row, index) {
    assertType<Equal<typeof row, Order>>();
    return index % 2 ? "odd" : "";
  },
};
const grid = new PyoGrid<Order>(el, options);

// 이벤트 이름으로 핸들러 인자가 정해진다
grid.on("change", (e) => e.row.SKU);
grid.on("change", (e) => {
  assertType<Equal<typeof e.row, Order>>();
  const sku: string = e.row.SKU;
  const source: string = e.source;
  const batch: boolean = e.batch;
  return [sku, source, batch];
});
grid.on("batchchange", (e) => {
  assertType<Equal<typeof e.changes, AppliedChange<Order>[]>>();
});
grid.on("rowsadd", (e) => e.rows.map((r) => r.QTY));
grid.on("beforeedit", (e) => {
  assertType<Equal<typeof e.mode, "edit" | "type">>();
  return e.row.LOCKED !== "Y";
});
grid.on("editend", (e) => e.committed && e.column.key);
grid.on("keydown", (e) => (e.event.key === "F9" ? false : undefined));
grid.on("click", (e) => {
  assertType<Equal<typeof e.colIndex, number | undefined>>();
  assertType<Equal<typeof e.row, ViewRow<Order>>>();
  return e.special === "rowSelector";
});
grid.on("sortchange", (e) => e.sort.map((s) => s.key + s.dir));
grid.on("datachange", function (e) {
  assertType<Equal<typeof this, PyoGrid<Order>>>();
  return e.rows.length;
});
const onPage = (e: GridEvents<Order>["pagechange"]) => e.page + e.current;
grid.on("pagechange", onPage).off("pagechange", onPage).off("pagechange");

// 행을 주고받는 메서드
assertType<Equal<ReturnType<typeof grid.getRows>, Order[]>>();
assertType<Equal<ReturnType<typeof grid.getAllRows>, Order[]>>();
assertType<Equal<ReturnType<typeof grid.getSelectedRows>, Order[]>>();
assertType<Equal<ReturnType<typeof grid.getModifiedRows>, Order[]>>();
assertType<Equal<ReturnType<typeof grid.getAddedRows>, Order[]>>();
assertType<Equal<ReturnType<typeof grid.getDeletedRows>, Order[]>>();
assertType<Equal<ReturnType<typeof grid.getRow>, ViewRow<Order> | undefined>>();
assertType<Equal<ReturnType<typeof grid.setValues>, AppliedChange<Order>[]>>();
assertType<Equal<ReturnType<typeof grid.getChanges>, { added: Order[]; modified: Order[]; deleted: Order[] }>>();
assertType<Equal<ReturnType<typeof grid.cleanRow>, Order>>();

const first = grid.getRows()[0];
grid.setData([{ SKU: "A", QTY: 1 }]).addRow({ SKU: "B", QTY: 2 }, "first", { focus: true });
grid.addRow([first], 0);
grid.setValue(first, "QTY", 3);
grid.setValue(0, "a.b", 3); // 경로 키는 그냥 string
grid.setValues([{ row: first, key: "QTY", value: 4 }, { rowIndex: 1, key: "SKU", value: "C" }], { source: "import" });
grid.deleteRows([first, 0]).removeRows(1);
grid.selectAll(true, (row) => row.QTY > 0);

// 모르는 이벤트 이름도 받는다 (0.x 호환 오버로드)
grid.on("my-event", (e) => e.anything);

/* ------------------------------------------------------------------
 * 2. 잘못된 사용은 컴파일 오류
 * ---------------------------------------------------------------- */

// @ts-expect-error Order에 없는 속성
grid.on("change", (e) => e.row.NOPE);
// @ts-expect-error change 인자에 없는 속성
grid.on("change", (e) => e.nothing);
// @ts-expect-error keydown 인자에 row는 없다
grid.on("keydown", (e) => e.row);
// @ts-expect-error 핸들러가 함수가 아니다
grid.on("change", 123);
// @ts-expect-error 행 모양이 다르다
grid.setData([{ SKU: 1, QTY: 1 }]);
// @ts-expect-error QTY가 없다
grid.addRow({ SKU: "A" });
// @ts-expect-error cleanRow는 Order를 받는다
grid.cleanRow({ SKU: 1, QTY: 1 });

const badColumns: ColumnDef<Order>[] = [
  // @ts-expect-error formatter의 row는 Order
  { key: "SKU", formatter: (c) => c.row.NOPE },
  // @ts-expect-error editor.disabled의 row는 Order
  { key: "QTY", editor: { type: "number", disabled: (c) => c.row.NOPE } },
];

/* ------------------------------------------------------------------
 * 3. 타입을 주지 않은 기존 코드 (README 예시) 는 그대로 통과한다
 * ---------------------------------------------------------------- */

const plain = new PyoGrid(document.getElementById("grid")!, {
  rowSelector: true,
  frozenColumns: 2,
  sortable: true,
  headerAlign: "center",
  columns: [
    { key: "SKU", label: "SKU", width: 120, align: "center" },
    { key: "NAME", label: "Product", width: "*" },
    {
      label: "This week",
      columns: [{ key: "QTY", label: "Qty", width: 80, align: "right", formatter: "money", editor: { type: "number" } }],
    },
    {
      key: "STATUS",
      html: true,
      formatter: function (c) {
        return '<span style="color:' + (c.value === "Done" ? "green" : "gray") + '">' + c.value + "</span>";
      },
      cellClass: function (c) {
        return c.value < 0 ? "minus" : "";
      },
      editor: {
        type: "text",
        disabled: function (c) {
          return c.row.LOCKED === "Y";
        },
        attributes: { maxlength: 30 },
      },
    },
  ],
  footSum: [[{ label: "Total", colspan: 2, align: "center" }, { key: "QTY", collector: "sum", formatter: "money", align: "right" }]],
});
assertType<Equal<ReturnType<typeof plain.getRows>, any[]>>();

plain.setData([{ SKU: "SKU-A1001", NAME: "Ballpoint pen 0.5mm", QTY: 12000 }]);
plain.getRows()[0].ANY_KEY;
plain.getRow(0).ANY_KEY;
plain.on("change", function (e) {
  console.log(e.rowIndex, e.key, e.oldValue, "→", e.value);
  if (!e.batch) plain.refreshRow(e.rowIndex);
});
plain.on("batchchange", function () {
  plain.refresh();
});
plain.on("pagechange", function (e) {
  return [e.page, plain.getSort()];
});
plain.on("change", (e: any) => e.whatever); // Angular 예시처럼 e를 any로 적은 코드
const handler: Function = () => {};
plain.on("change", handler).off("change", handler);
plain.on("anything", function (e) {
  return e;
});
plain.addRow({ SKU: "", QTY: 0 }, "last", { focus: true });
plain.deleteRows(plain.getSelectedRows());
plain.setValue(0, "QTY", 1);
const changed = plain.getModifiedRows().filter(function (r) {
  return !r.__added__;
});
void changed;

// React 예시: 옵션 객체를 따로 만들어 넘긴다
const reactColumns: any[] = [];
let ref: PyoGrid | null = new PyoGrid(el, { columns: reactColumns });
ref.destroy();
ref = null;

void badColumns;

/* ------------------------------------------------------------------
 * 4. README의 TypeScript 절 예시 (README를 고치면 여기도 고친다)
 * ---------------------------------------------------------------- */

namespace readmeExample {
  interface Order {
    SKU: string;
    NAME: string;
    QTY: number;
    LOCKED?: "Y" | "N";
  }

  const columns: ColumnDef<Order>[] = [
    { key: "SKU", label: "SKU", width: 120 },
    { key: "NAME", label: "Product", cellClass: (c) => (c.row.QTY < 0 ? "minus" : "") },
    { key: "QTY", label: "Qty", formatter: "money", editor: { type: "number", disabled: (c) => c.row.LOCKED === "Y" } },
  ];

  const grid = new PyoGrid<Order>("#grid", { columns });
  grid.setData([{ SKU: "SKU-A1001", NAME: "Ballpoint pen", QTY: 12000 }]);
  grid.on("change", (e) => console.log(e.row.SKU, e.key, e.oldValue, "→", e.value));
  grid.on("beforeedit", (e) => e.row.LOCKED !== "Y");
  const changed: Order[] = grid.getModifiedRows();
  void changed;
}

/* ------------------------------------------------------------------
 * 조건 필터
 * ---------------------------------------------------------------- */
{
  const g = new PyoGrid<Order>(el, { filter: true, filterConditions: true, columns: [{ key: "QTY", filterType: "number", filterConditions: false }] });
  g.setFilterCondition("SKU", { type: "text", op: "contains", value: "a" });
  g.setFilterCondition("QTY", { type: "number", op: "between", from: 1 });
  g.setFilterCondition("QTY", { type: "number", op: "ge", value: 1 });
  g.setFilterCondition("D", { type: "date", from: "2026-03-01", to: "2026-03-31" });
  g.setFilterCondition("QTY", null);
  // @ts-expect-error 숫자 비교는 value가 숫자다
  g.setFilterCondition("QTY", { type: "number", op: "ge", value: "1" });
  // @ts-expect-error 없는 연산자
  g.setFilterCondition("SKU", { type: "text", op: "like", value: "a" });
  const conds: Record<string, FilterCondition> = g.getFilterConditions();
  void conds;
  g.on("filterchange", (e) => {
    const c: Record<string, FilterCondition> = e.conditions;
    const f: Record<string, any[]> = e.filters;
    const n: number = e.count;
    void c, f, n;
  });
}
