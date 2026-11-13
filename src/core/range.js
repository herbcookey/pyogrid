// @ts-check
/**
 * 셀 범위 선택. 좌표는 (화면 행 순번, 잎 컬럼 순번).
 * anchor는 선택을 시작한 셀, active는 지금 포커스된 셀 (Excel과 같음).
 */
export class CellRange {
  /**
   * @param {{r: number, c: number}} anchor
   * @param {{r: number, c: number}} [active]
   */
  constructor(anchor, active) {
    this.anchor = { r: anchor.r, c: anchor.c };
    this.active = active ? { r: active.r, c: active.c } : { r: anchor.r, c: anchor.c };
  }

  get r0() {
    return Math.min(this.anchor.r, this.active.r);
  }
  get r1() {
    return Math.max(this.anchor.r, this.active.r);
  }
  get c0() {
    return Math.min(this.anchor.c, this.active.c);
  }
  get c1() {
    return Math.max(this.anchor.c, this.active.c);
  }
  get rowCount() {
    return this.r1 - this.r0 + 1;
  }
  get colCount() {
    return this.c1 - this.c0 + 1;
  }
  get size() {
    return this.rowCount * this.colCount;
  }

  /**
   * @param {number} r
   * @param {number} c
   */
  contains(r, c) {
    return r >= this.r0 && r <= this.r1 && c >= this.c0 && c <= this.c1;
  }

  /**
   * 행 수·컬럼 수가 줄었을 때 범위를 안으로 들인다. 비면 null.
   * @param {number} rows
   * @param {number} cols
   * @returns {CellRange|null}
   */
  clamp(rows, cols) {
    if (rows <= 0 || cols <= 0) return null;
    const f = (p) => ({ r: Math.min(Math.max(0, p.r), rows - 1), c: Math.min(Math.max(0, p.c), cols - 1) });
    return new CellRange(f(this.anchor), f(this.active));
  }
}
