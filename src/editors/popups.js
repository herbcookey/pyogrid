// @ts-check
import { escapeHtml } from "../util.js";
import { toDate, formatDate } from "./types.js";

/**
 * 편집기 팝업(선택 목록, 달력). document.body에 붙이고 position:fixed로 셀 아래에 둔다.
 * mousedown 기본 동작을 막아서 포커스가 그리드 입력칸에 그대로 남는다 (한글 입력·키보드 처리 유지).
 */
class Popup {
  /** @param {string} cls */
  constructor(cls) {
    this.el = document.createElement("div");
    this.el.className = "pyo-popup " + cls;
    this.el.addEventListener("mousedown", (e) => e.preventDefault());
    document.body.append(this.el);
  }

  /**
   * 셀 사각형(화면 좌표) 아래에 둔다. 아래 공간이 모자라면 위로.
   * @param {{left:number, top:number, bottom:number, width:number}} rect
   */
  place(rect) {
    const el = this.el;
    el.style.minWidth = Math.max(rect.width, 0) + "px";
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let top = rect.bottom + 1;
    if (top + h > vh - 4 && rect.top - h - 1 >= 4) top = rect.top - h - 1;
    const left = Math.max(4, Math.min(rect.left, vw - w - 4));
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  destroy() {
    this.el.remove();
  }
}

/* ------------------------------------------------------------------
 * 선택 목록
 * ---------------------------------------------------------------- */

export class Dropdown extends Popup {
  /**
   * @param {{value:any, text:string}[]} options
   * @param {any} current
   * @param {(value: any) => void} onPick
   */
  constructor(options, current, onPick) {
    super("pyo-dropdown");
    this.options = options;
    this.onPick = onPick;
    this.el.setAttribute("role", "listbox");
    this.el.innerHTML = options.length
      ? options
          .map((o, i) => `<div class="pyo-option" role="option" data-i="${i}">${escapeHtml(o.text) || "&nbsp;"}</div>`)
          .join("")
      : '<div class="pyo-option-empty">항목 없음</div>';
    this.index = options.findIndex((o) => String(o.value) === String(current));
    this._paint();
    this.el.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target).closest(".pyo-option");
      if (!t) return;
      this.index = Number(/** @type {HTMLElement} */ (t).dataset.i);
      this.pick();
    });
  }

  /** @param {number} delta */
  move(delta) {
    if (!this.options.length) return;
    const n = this.options.length;
    this.index = this.index < 0 ? (delta > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, this.index + delta));
    this._paint();
  }

  /**
   * 글자로 찾기: 앞부분이 같은 항목, 없으면 포함하는 항목.
   * @param {string} q
   */
  search(q) {
    const s = q.trim().toLowerCase();
    if (!s) return;
    let i = this.options.findIndex((o) => o.text.toLowerCase().startsWith(s) || String(o.value).toLowerCase().startsWith(s));
    if (i < 0) i = this.options.findIndex((o) => o.text.toLowerCase().includes(s));
    if (i >= 0) {
      this.index = i;
      this._paint();
    }
  }

  get current() {
    return this.index >= 0 ? this.options[this.index] : null;
  }

  pick() {
    const o = this.current;
    if (o) this.onPick(o.value);
  }

  _paint() {
    const items = this.el.querySelectorAll(".pyo-option");
    items.forEach((el, i) => {
      const on = i === this.index;
      el.classList.toggle("pyo-option-active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
      if (on && /** @type {any} */ (el).scrollIntoView) /** @type {any} */ (el).scrollIntoView({ block: "nearest" });
    });
  }
}

/* ------------------------------------------------------------------
 * 달력
 * ---------------------------------------------------------------- */

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export class Calendar extends Popup {
  /**
   * @param {any} value  "yyyy-MM-dd"
   * @param {(value: string) => void} onPick
   */
  constructor(value, onPick) {
    super("pyo-calendar");
    this.onPick = onPick;
    this.selected = toDate(value);
    const base = this.selected || new Date();
    this.year = base.getFullYear();
    this.month = base.getMonth();
    this.el.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target).closest("[data-cal]");
      if (!t) return;
      const act = /** @type {HTMLElement} */ (t).dataset.cal;
      if (act === "prev") this._shift(-1);
      else if (act === "next") this._shift(1);
      else if (act === "today") this.onPick(formatDate(new Date()));
      else if (act === "day") this.onPick(/** @type {HTMLElement} */ (t).dataset.date);
    });
    this.render();
  }

  /** 입력칸에 친 날짜를 따라간다. @param {any} value */
  show(value) {
    const d = toDate(value);
    this.selected = d;
    if (d) {
      this.year = d.getFullYear();
      this.month = d.getMonth();
    }
    this.render();
  }

  /** @param {number} delta */
  _shift(delta) {
    const d = new Date(this.year, this.month + delta, 1);
    this.year = d.getFullYear();
    this.month = d.getMonth();
    this.render();
  }

  render() {
    const first = new Date(this.year, this.month, 1);
    const start = new Date(this.year, this.month, 1 - first.getDay());
    const today = formatDate(new Date());
    const sel = this.selected ? formatDate(this.selected) : "";
    let s =
      `<div class="pyo-cal-head"><button type="button" class="pyo-cal-nav" data-cal="prev" aria-label="이전 달">‹</button>` +
      `<span class="pyo-cal-title">${this.year}년 ${this.month + 1}월</span>` +
      `<button type="button" class="pyo-cal-nav" data-cal="next" aria-label="다음 달">›</button></div>` +
      `<div class="pyo-cal-grid">` +
      WEEK.map((w, i) => `<span class="pyo-cal-week${i === 0 ? " pyo-sun" : i === 6 ? " pyo-sat" : ""}">${w}</span>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const v = formatDate(d);
      let cls = "pyo-cal-day";
      if (d.getMonth() !== this.month) cls += " pyo-other";
      if (d.getDay() === 0) cls += " pyo-sun";
      if (d.getDay() === 6) cls += " pyo-sat";
      if (v === today) cls += " pyo-today";
      if (v === sel) cls += " pyo-picked";
      s += `<button type="button" class="${cls}" data-cal="day" data-date="${v}">${d.getDate()}</button>`;
    }
    s += `</div><div class="pyo-cal-foot"><button type="button" class="pyo-cal-today" data-cal="today">오늘</button></div>`;
    this.el.innerHTML = s;
  }
}
