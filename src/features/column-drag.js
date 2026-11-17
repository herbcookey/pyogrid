// @ts-check
// 헤더를 끌어 컬럼 옮기기 (columnReorder 옵션). 마우스·펜만 받는다 (터치는 가로 스크롤과 부딪친다).
// 5px 넘게 움직여야 끌기가 시작되므로 그 전에 놓으면 지금처럼 click(정렬)이 된다.
// 끄는 동안에는 반투명 헤더(.pyo-col-ghost)와 놓을 자리 줄(.pyo-col-drop)만 움직이고, 놓을 때 한 번 다시 그린다.
import { h, clamp } from "../util.js";

/** 이만큼(px) 넘게 움직여야 끌기 */
const THRESHOLD = 5;
/** 스크롤 영역 양 끝 안쪽 이 폭(px)에 들어가면 가로로 자동 스크롤 */
const EDGE = 30;
/** 자동 스크롤 한 프레임 최대 px (셀 범위 끌기와 같음) */
const MAX_STEP = 60;

/**
 * @typedef {import("../core/columns.js").ColumnDef} ColumnDef
 * @typedef {import("./column-order.js").MoveCandidate} MoveCandidate
 * @typedef {MoveCandidate & {side: "fz"|"sc", center: number, dropX: number}} DropTarget
 *   center: 그 자리에 놓았을 때 컬럼 가운데 x, dropX: 지금 화면에서 놓을 자리 줄의 x (둘 다 고정·스크롤 영역 기준)
 * @typedef {{
 *   targets: (def: ColumnDef) => MoveCandidate[],
 *   apply: (keys: string[], ev: {column: ColumnDef, from: number, to: number}) => boolean,
 *   dragged: () => void,
 *   setCleanup: (fn: (() => void) | null) => void,
 * }} DragHooks
 */

/**
 * 헤더 pointerdown에서 부른다. 끌 수 있는 칸이 아니면 아무것도 하지 않는다.
 * @param {import("../grid.js").PyoGrid} grid
 * @param {PointerEvent} e
 * @param {DragHooks} hooks
 */
export function startColumnDrag(grid, e, hooks) {
  if (e.button !== 0 || e.pointerType === "touch") return;
  const t = /** @type {HTMLElement} */ (e.target);
  if (!t || !t.closest || t.closest(".pyo-filter-btn, .pyo-resizer, .pyo-aside, .pyo-check")) return;
  const cell = /** @type {HTMLElement|null} */ (t.closest(".pyo-hcell"));
  if (!cell) return;
  /** @type {ColumnDef|null} */
  let def = null;
  if (cell.dataset.leaf !== undefined) {
    const leaf = grid.leaves[Number(cell.dataset.leaf)];
    def = leaf ? leaf.def : null;
  } else if (cell.dataset.h !== undefined) {
    const hc = grid.headerCells[Number(cell.dataset.h)];
    def = hc ? hc.def : null;
  }
  if (!def || def.reorderable === false) return;
  const column = def;

  const s = grid.el.scroll;
  const root = grid.el.root;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let lastX = x0;
  let started = false;
  let cancelled = false;
  /** @type {DropTarget[]} */
  let targets = [];
  /** @type {DropTarget|null} */
  let cur = null;
  /** @type {DropTarget|null} */
  let pick = null;
  /** @type {HTMLElement|null} */
  let ghost = null;
  /** @type {HTMLElement|null} */
  let drop = null;
  let grab = 0;
  let raf = 0;

  /** 고정·스크롤 영역 기준 x → 화면 x */
  const screenX = (/** @type {DropTarget} */ c, /** @type {number} */ v) => {
    const sr = s.getBoundingClientRect();
    return c.side === "fz" ? sr.left + v : sr.left + grid.fzWidth + v - s.scrollLeft;
  };

  /** 놓을 수 있는 자리마다 위치를 잰다. 옮길 자리가 없으면 false */
  const begin = () => {
    if (grid.editing.active && !grid.editing.commit()) grid.editing.cancel();
    const cands = hooks.targets(column);
    const now = cands.find((c) => c.same);
    if (!now) return false;
    /** @type {Map<ColumnDef, number>} */
    const widthOf = new Map(grid.leaves.map((l, i) => [l.def, grid.widths[i]]));
    const head = grid.headerCells.find((c) => c.def === column);
    const span = head ? head.colSpan : 1;
    const frozen = grid.frozenCount;
    const seen = new Set();
    targets = [];
    for (const c of cands) {
      if (seen.has(c.index)) continue;
      seen.add(c.index);
      const side = c.index < frozen ? "fz" : "sc";
      let x = side === "fz" ? grid.asideWidth : 0;
      for (let j = side === "fz" ? 0 : frozen; j < c.index; j++) x += widthOf.get(c.leaves[j].def) || 0;
      let w = 0;
      for (let j = c.index; j < c.index + span; j++) w += widthOf.get(c.leaves[j].def) || 0;
      const end = c.index + span - 1;
      const dropX = c.index < now.index ? grid.leafX[c.index] : grid.leafX[end] + grid.widths[end];
      targets.push({ ...c, side, center: x + w / 2, dropX });
    }
    cur = targets.find((c) => c.same) || null;
    if (!cur || targets.length < 2) return false;
    const rr = root.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    let width = 0;
    for (let j = cur.index; j < cur.index + span; j++) width += grid.widths[j];
    grab = x0 - cr.left;
    ghost = h("div", "pyo-col-ghost");
    const label = cell.querySelector(".pyo-hlabel");
    ghost.textContent = label ? label.textContent : "";
    ghost.style.width = width + "px";
    ghost.style.height = (cell.offsetHeight || grid.options.headerRowHeight) + "px";
    ghost.style.top = cr.top - rr.top + "px";
    drop = h("div", "pyo-col-drop");
    drop.style.top = sr.top - rr.top + "px";
    drop.style.height = s.clientHeight + "px";
    drop.hidden = true;
    root.append(ghost, drop);
    root.classList.add("pyo-col-dragging");
    return true;
  };

  const update = () => {
    if (!ghost || !drop) return;
    let best = Infinity;
    for (const c of targets) {
      const d = Math.abs(screenX(c, c.center) - lastX);
      if (d < best) {
        best = d;
        pick = c;
      }
    }
    const rr = root.getBoundingClientRect();
    ghost.style.left = lastX - grab - rr.left + "px";
    drop.hidden = !pick || pick.same;
    if (pick && !pick.same) drop.style.left = screenX(pick, pick.dropX) - rr.left - 1 + "px";
  };

  /** 스크롤 영역 끝 근처에서 가로 자동 스크롤 (고정 영역 컬럼은 하지 않는다) */
  const autoScroll = () => {
    raf = 0;
    if (!started || cancelled || !cur || cur.side !== "sc" || !root.isConnected) return;
    const sr = s.getBoundingClientRect();
    const left = sr.left + grid.fzWidth;
    const right = sr.left + s.clientWidth;
    const d = lastX < left + EDGE ? lastX - (left + EDGE) : lastX > right - EDGE ? lastX - (right - EDGE) : 0;
    const step = clamp(Math.round(d), -MAX_STEP, MAX_STEP);
    const can = step < 0 ? s.scrollLeft > 0 : step > 0 && s.scrollLeft < s.scrollWidth - s.clientWidth;
    if (!can) return;
    s.scrollLeft += step;
    update();
    raf = requestAnimationFrame(autoScroll);
  };

  const removeVisual = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ghost) ghost.remove();
    if (drop) drop.remove();
    ghost = drop = null;
    root.classList.remove("pyo-col-dragging");
  };

  const finish = () => {
    removeVisual();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
    document.removeEventListener("keydown", key, true);
    hooks.setCleanup(null);
  };

  /** @param {PointerEvent} ev */
  const move = (ev) => {
    lastX = ev.clientX;
    if (cancelled) return;
    if (!started) {
      if (Math.max(Math.abs(ev.clientX - x0), Math.abs(ev.clientY - y0)) <= THRESHOLD) return;
      if (!begin()) {
        finish();
        return;
      }
      started = true;
    }
    ev.preventDefault();
    update();
    if (!raf) raf = requestAnimationFrame(autoScroll);
  };

  /** @param {PointerEvent} ev */
  const up = (ev) => {
    if (!started) return finish();
    hooks.dragged(); // 이어지는 click이 정렬하지 않게
    if (cancelled) return finish();
    lastX = ev.clientX;
    update();
    const p = pick;
    finish();
    if (p && cur && !p.same) hooks.apply(p.keys, { column, from: cur.index, to: p.index });
  };

  const cancel = () => {
    if (started) hooks.dragged();
    finish();
  };

  /** @param {KeyboardEvent} ev Esc: 취소. 놓을 때까지 포인터는 기다린다 (그 뒤 click이 정렬하지 않게) */
  const key = (ev) => {
    if (!started || cancelled || ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    cancelled = true;
    removeVisual();
  };

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
  document.addEventListener("keydown", key, true);
  hooks.setCleanup(finish);
}
