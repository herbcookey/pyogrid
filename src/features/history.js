// @ts-check
/**
 * 실행 취소·다시 실행 기록.
 * 행 번호는 정렬·필터로 바뀌므로 행 객체에 묶어 둔다.
 *
 * @typedef {{row: any, key: string, oldValue: any, value: any}} Change
 * @typedef {{source: string, changes: Change[]}} Entry
 */
export class History {
  /** @param {number} limit */
  constructor(limit = 50) {
    this.limit = limit;
    /** @type {Entry[]} */
    this.undoStack = [];
    /** @type {Entry[]} */
    this.redoStack = [];
  }

  /** @param {Entry} entry */
  push(entry) {
    if (!entry.changes.length) return;
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  /** @returns {Entry|null} */
  popUndo() {
    const e = this.undoStack.pop() || null;
    if (e) this.redoStack.push(e);
    return e;
  }

  /** @returns {Entry|null} */
  popRedo() {
    const e = this.redoStack.pop() || null;
    if (e) this.undoStack.push(e);
    return e;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }
}

/** 기록할 변경 출처 (화면 코드의 setValue는 기록하지 않는다). 화면 문구는 locales의 actions */
export const RECORDED_SOURCES = { edit: 1, clear: 1, paste: 1, cut: 1 };
