// @ts-check
import { escapeHtml } from "../util.js";
import { compareSmart } from "../core/sort.js";
import { locales } from "../core/locales.js";
import { formatNumber } from "./pagebar.js";

/**
 * 헤더 값 필터 팝업 (Excel 자동 필터와 같은 방식: 값 목록에서 고르기).
 * 확인을 누르면 onApply(허용 값 Set | null). null은 "조건 없음"(모두 선택).
 *
 * 체크 상태는 화면의 체크박스가 아니라 전체 값 목록 기준으로 들고 있다 (unchecked).
 * 검색은 전체 값에서 하고, 그리는 것만 앞의 MAX개로 자른다. 그래서 값이 많아도
 * 확인만 누르면 조건이 생기지 않고, 그리지 않은 값도 검색·전체 선택·확인에 들어간다.
 */

export const FILTER_RENDER_MAX = 2000;

export class FilterPopup {
  /**
   * @param {Object} o
   * @param {string} o.title
   * @param {string[]} o.values      filterKey 값 (중복 없음)
   * @param {(v: string) => string} o.label
   * @param {Set<string>|null} o.current
   * @param {(allowed: Set<string>|null) => void} o.onApply
   * @param {() => void} o.onClose
   * @param {number} [o.renderMax]
   * @param {import("../core/locales.js").Messages} [o.messages]
   */
  constructor(o) {
    this.o = o;
    const m = (this.m = o.messages || /** @type {import("../core/locales.js").Messages} */ (locales.en));
    this.max = o.renderMax || FILTER_RENDER_MAX;
    /** @type {string[]} 전체 값 (정렬, 빈 값은 맨 뒤) */
    this.values = o.values.slice().sort((a, b) => (a === "" ? 1 : b === "" ? -1 : compareSmart(a, b)));
    /** @type {string[]} 화면 글자 */
    this.labels = this.values.map((v) => (v === "" ? m.blank : o.label(v)));
    /** @type {string[]} 검색용 (글자 + 원래 값, 소문자) */
    this.search_ = this.values.map((v, i) => (this.labels[i] + "\u0000" + v).toLowerCase());
    /** @type {Set<number>} 체크를 푼 값의 순번 */
    this.unchecked = new Set();
    if (o.current) this.values.forEach((v, i) => !o.current.has(v) && this.unchecked.add(i));
    /** @type {number[]} 지금 검색에 걸린 값의 순번 (전체) */
    this.matching = this.values.map((_, i) => i);

    const el = (this.el = document.createElement("div"));
    el.className = "pyo-popup pyo-filter";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", m.filterDialog(o.title));
    el.innerHTML =
      `<div class="pyo-f-title">${escapeHtml(o.title)}</div>` +
      `<input type="text" class="pyo-f-search" placeholder="${escapeHtml(m.filterSearch)}" aria-label="${escapeHtml(m.filterSearch)}">` +
      `<label class="pyo-f-all"><input type="checkbox"> ${escapeHtml(m.selectAll)}</label>` +
      `<div class="pyo-f-list"></div>` +
      `<div class="pyo-f-note" hidden></div>` +
      `<div class="pyo-f-btns"><button type="button" class="pyo-f-clear">${escapeHtml(m.clear)}</button>` +
      `<button type="button" class="pyo-f-ok">${escapeHtml(m.ok)}</button><button type="button" class="pyo-f-cancel">${escapeHtml(m.cancel)}</button></div>`;
    document.body.append(el);

    this.search = /** @type {HTMLInputElement} */ (el.querySelector(".pyo-f-search"));
    this.all = /** @type {HTMLInputElement} */ (el.querySelector(".pyo-f-all input"));
    this.list = /** @type {HTMLElement} */ (el.querySelector(".pyo-f-list"));
    this.note = /** @type {HTMLElement} */ (el.querySelector(".pyo-f-note"));
    this._render();

    // 전체 선택: 그리지 않은 값까지 검색에 걸린 값 전부
    this.all.addEventListener("change", () => {
      for (const i of this.matching) {
        if (this.all.checked) this.unchecked.delete(i);
        else this.unchecked.add(i);
      }
      this.list.querySelectorAll("input").forEach((b) => (/** @type {HTMLInputElement} */ (b).checked = this.all.checked));
    });
    this.list.addEventListener("change", (e) => {
      const b = /** @type {HTMLInputElement} */ (e.target);
      const i = Number(b.dataset.i);
      if (b.checked) this.unchecked.delete(i);
      else this.unchecked.add(i);
      this._syncAll();
    });
    this.search.addEventListener("input", () => {
      const q = this.search.value.trim().toLowerCase();
      this.matching = [];
      for (let i = 0; i < this.values.length; i++) if (!q || this.search_[i].includes(q)) this.matching.push(i);
      this._render();
    });
    el.querySelector(".pyo-f-cancel").addEventListener("click", () => this.close());
    el.querySelector(".pyo-f-clear").addEventListener("click", () => {
      this.o.onApply(null);
      this.close();
    });
    el.querySelector(".pyo-f-ok").addEventListener("click", () => this.apply());
    el.addEventListener("keydown", (e) => {
      // 한글 등 조합 중의 Enter·Esc는 조합을 확정·취소하는 키다 (macOS는 isComposing, Windows Chrome은 keyCode 229)
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "Enter") {
        // 단추(초기화·확인·취소)에서는 브라우저 기본 동작으로 그 단추를 누른다
        if (/** @type {HTMLElement} */ (e.target).tagName === "BUTTON") return;
        e.preventDefault();
        this.apply();
      }
    });
    this._outside = (e) => {
      if (!el.contains(/** @type {Node} */ (e.target))) this.close();
    };
    // 팝업은 click에서 열리므로 여는 동작의 mousedown은 이미 지나갔다. 바로 달아야 곧바로 바깥을 눌러도 닫힌다.
    document.addEventListener("mousedown", this._outside);
  }

  /** 검색에 걸린 값 중 앞의 max개만 그린다 */
  _render() {
    const shown = this.matching.length > this.max ? this.matching.slice(0, this.max) : this.matching;
    this.list.innerHTML = shown
      .map((i) => `<label class="pyo-f-item"><input type="checkbox" data-i="${i}"${this.unchecked.has(i) ? "" : " checked"}> ${escapeHtml(this.labels[i])}</label>`)
      .join("");
    const cut = this.matching.length - shown.length;
    this.note.hidden = cut <= 0;
    this.note.textContent = cut > 0 ? this.m.filterTruncated(formatNumber(this.max), formatNumber(this.matching.length)) : "";
    this._syncAll();
  }

  _syncAll() {
    this.all.checked = this.matching.length > 0 && this.matching.every((i) => !this.unchecked.has(i));
  }

  /**
   * 검색 중이면 검색에 걸린 값 중 체크한 것만 허용 (Excel과 같음).
   * 결과가 모든 값을 허용하면 조건 없음(null).
   */
  apply() {
    const allowed = new Set();
    for (const i of this.matching) if (!this.unchecked.has(i)) allowed.add(this.values[i]);
    this.o.onApply(allowed.size === this.values.length ? null : allowed);
    this.close();
  }

  /** 버튼 아래, 화면 밖으로 나가지 않게 @param {DOMRect} anchor */
  place(anchor) {
    const w = this.el.offsetWidth;
    const left = Math.max(4, Math.min(anchor.right - w, window.innerWidth - w - 4));
    this.el.style.left = left + "px";
    this.el.style.top = anchor.bottom + 2 + "px";
    this.search.focus();
  }

  close() {
    if (!this.el.isConnected) return;
    document.removeEventListener("mousedown", this._outside);
    this.el.remove();
    this.o.onClose();
  }
}
