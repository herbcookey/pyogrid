// @ts-check
/**
 * 실행 취소·다시 실행 기록.
 * 행 번호는 정렬·필터로 바뀌므로 행 객체에 묶어 둔다.
 * 행 작업(addRow·deleteRows·removeRows의 undoable)은 changes 대신 rows에 담는다. 한 호출이 한 묶음이다.
 *
 * @typedef {{row: any, key: string, oldValue: any, value: any}} Change
 * @typedef {Object} RowItem  행 작업 한 행
 * @property {any} row
 * @property {number} at       그때 source 안의 자리 (before가 없어졌을 때 쓴다)
 * @property {any} before      바로 뒤에 남아 있던 행 (null이면 맨 끝). 다시 넣을 때 이 행 앞에 넣는다
 * @property {boolean} done    지금 작업이 적용된 상태인가 (되돌리면 false). 건너뛴 행은 바뀌지 않는다
 * @property {any} [mark]      deleteRows 전의 deletedKey 값
 * @property {null|{type: "deleted"|"added", added: any, modified: any, deleted: any}} [conv]
 *   저장 처리 뒤에 되돌려 지운 행·추가한 행으로 바꾼 경우와 그 전 표시 키 (다시 실행할 때 되돌린다)
 * @typedef {{op: "add"|"delete"|"remove", items: RowItem[]}} RowOp
 * @typedef {{source: string, changes: Change[], rows?: RowOp}} Entry
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
    if (!entry.changes.length && !(entry.rows && entry.rows.items.length)) return;
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
