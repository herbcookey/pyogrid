// @ts-check
import { editorTypes, selectOptions, isChecked, checkboxValue, sameValue } from "../editors/types.js";
import { Dropdown, Calendar } from "../editors/popups.js";
import { getValue, isFn, clamp } from "../util.js";
import { headerHeight, viewportHeight } from "../grid/layout.js";

/**
 * 셀 편집과 키보드.
 *
 * 그리드에는 입력칸(textarea)이 하나 있고, 그리드가 포커스를 가진 동안 늘 이 입력칸에 포커스가 있다.
 * 편집하지 않을 때는 보이지 않게 활성 셀 위에 놓여 있다가, 글자를 치면 그 자리에서 보이게 바뀐다.
 * 포커스를 옮기지 않으므로 한글 조합이 끊기지 않고 첫 글자도 사라지지 않는다.
 */

const MOVE_CODES = { Enter: 1, NumpadEnter: 1, Tab: 1, ArrowUp: 1, ArrowDown: 1 };

export class Editing {
  /** @param {import("../grid.js").PyoGrid} grid */
  constructor(grid) {
    this.grid = grid;
    /** @type {null | {r:number, c:number, key:any, def:any, type:any, cfg:any, mode:"edit"|"type", original:any, popup:any, attrs:string[], initialText:string|null}} */
    this.edit = null;
    /** 조합 중에 누른 Enter·Tab·방향키 (조합이 끝나면 처리) */
    this._pending = null;
    /** 조합이 끝난 직후 같은 키가 한 번 더 오는 브라우저(macOS)용 */
    this._suppress = null;
    this._discardComposition = false;
    this._searchTimer = 0;

    const input = document.createElement("textarea");
    input.className = "pyo-input";
    input.setAttribute("aria-label", grid.messages.cellInput);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("rows", "1");
    input.setAttribute("wrap", "off");
    input.tabIndex = 0;
    this.input = input;
    grid.el.root.append(input);

    input.addEventListener("keydown", (e) => this.onKeyDown(e));
    input.addEventListener("input", (e) => this.onInput(/** @type {InputEvent} */ (e)));
    input.addEventListener("compositionstart", () => this.onCompositionStart());
    input.addEventListener("compositionend", () => this.onCompositionEnd());
    input.addEventListener("blur", () => this.onBlur());
    input.addEventListener("focus", () => grid.el.root.classList.add("pyo-focused"));
    // 복사·잘라내기·붙여넣기: 편집 중이면 입력칸 기본 동작, 아니면 선택 범위
    input.addEventListener("copy", (e) => this.onClipboard(e, "copy"));
    input.addEventListener("cut", (e) => this.onClipboard(e, "cut"));
    input.addEventListener("paste", (e) => this.onClipboard(e, "paste"));
    // 루트는 overflow:hidden이라 입력칸이 바깥쪽에 있으면 브라우저가 루트를 스크롤할 수 있다
    grid.el.root.addEventListener("scroll", () => {
      grid.el.root.scrollTop = 0;
      grid.el.root.scrollLeft = 0;
    });
  }

  get active() {
    return !!this.edit;
  }

  /** 그리드에 키보드 포커스를 준다 (페이지는 스크롤하지 않음) */
  focus() {
    if (document.activeElement === this.input) return;
    try {
      this.input.focus({ preventScroll: true });
    } catch (e) {
      this.input.focus();
    }
  }

  /* ==================================================================
   * 편집 가능 여부
   * ================================================================ */

  /**
   * @param {number} r
   * @param {number} c
   * @returns {null | {def:any, type:any, cfg:any, key:any, row:any}}
   */
  editable(r, c) {
    const g = this.grid;
    const leaf = g.leaves[c];
    const row = g.rows[r];
    if (!leaf || !row || row.__isGrouping || !g.options.editable) return null;
    const def = leaf.def;
    const ed = def.editor;
    if (!ed || def.key === undefined || def.key === null) return null;
    const type = editorTypes[ed.type];
    if (!type) return null;
    if (ed.disabled !== undefined) {
      const ctx = g.cellContext(r, c);
      if (isFn(ed.disabled) ? ed.disabled.call(ctx, ctx) : ed.disabled === true) return null;
    }
    return { def, type, cfg: ed.config || {}, key: def.key, row };
  }

  /* ==================================================================
   * 시작·끝
   * ================================================================ */

  /**
   * @param {number} r
   * @param {number} c
   * @param {{mode?: "edit"|"type", initial?: string}} [opts]
   *   mode "edit": 지금 값으로 시작 (F2, Enter, 더블클릭)
   *   mode "type": 빈 값으로 시작. 입력칸 값을 건드리지 않아서 누른 글자·한글 조합이 그대로 들어간다.
   * @returns {boolean}
   */
  start(r, c, opts = {}) {
    const g = this.grid;
    if (this.edit && !this.commit()) return false;
    const info = this.editable(r, c);
    if (!info) return false;
    const mode = opts.mode || "edit";
    if (info.type.kind === "toggle") {
      this.toggle(r, c);
      return false;
    }
    if (g.emitCancelable("beforeedit", { ...g.cellContext(r, c), mode }) === false) return false;

    g.setRange(r, c);
    g.scrollToCell(r, c);
    const value = getValue(info.row, info.key);
    const input = this.input;
    const attrs = [];
    const ed = info.def.editor;
    if (ed.attributes && typeof ed.attributes === "object") {
      for (const k of Object.keys(ed.attributes)) {
        input.setAttribute(k, String(ed.attributes[k]));
        attrs.push(k);
      }
    }
    this.edit = { r, c, key: info.key, def: info.def, type: info.type, cfg: info.cfg, mode, original: value, popup: null, attrs, initialText: null };
    const root = g.el.root;
    root.classList.add("pyo-editing");
    input.dataset.editor = info.def.editor.type;
    input.dataset.align = info.def.align || g.options.align || "left";

    if (info.type.kind === "input") {
      input.classList.add("pyo-input-on");
      if (opts.initial !== undefined) input.value = opts.initial;
      else if (mode === "edit") input.value = info.type.format(value, info.cfg);
      // 지금 값으로 시작했으면 그 글자를 기억해 둔다: 저장할 때 글자가 같으면 값을 건드리지 않는다.
      // (min·decimal 밖의 기존 값 -5, 1.5를 F2 → Enter만으로 0, 2로 바꾸지 않게)
      this.edit.initialText = mode === "edit" && opts.initial === undefined ? input.value : null;
      // mode "type"이면 비어 있는 입력칸에 지금 누른 글자가 들어온다
      this.position();
      if (mode === "edit") {
        const n = input.value.length;
        input.setSelectionRange(n, n);
      }
      if (info.type.popup === "calendar") {
        const cal = new Calendar(
          input.value || value,
          (v) => {
            input.value = v;
            this.commit();
          },
          g.messages,
        );
        this.edit.popup = cal;
        this.placePopup();
      }
    } else if (info.type.kind === "list") {
      input.classList.remove("pyo-input-on");
      if (mode === "edit") input.value = "";
      const dd = new Dropdown(selectOptions(info.cfg), value, (v) => this.commit({ value: v }), g.messages);
      this.edit.popup = dd;
      this.position();
      this.placePopup();
    }
    this.focus();
    g.emit("editstart", { ...g.cellContext(r, c), mode });
    return true;
  }

  /**
   * 편집한 값을 저장한다. 잘못된 값이면 false (편집 계속).
   * @param {{move?: "up"|"down"|"left"|"right", value?: any}} [opts]
   */
  commit(opts = {}) {
    const e = this.edit;
    if (!e) return true;
    const g = this.grid;
    let value;
    if (e.type.kind === "list") {
      if ("value" in opts) value = opts.value;
      else {
        const cur = e.popup && e.popup.current;
        if (!cur) {
          this.cancel();
          if (opts.move) this.moveAfterEdit(e.r, e.c, opts.move);
          return true;
        }
        value = cur.value;
      }
    } else {
      // 지금 값으로 시작해 글자를 그대로 두었으면 값을 건드리지 않는다
      // (기존 값이 편집기 제한 밖이어도 보정하지 않고, 검증 오류도 내지 않는다)
      if (e.initialText !== null && e.initialText !== undefined && this.input.value === e.initialText) {
        const { r, c } = e;
        this._finish();
        this.grid.refreshRow(r);
        g.emit("editend", { ...g.cellContext(r, c), committed: true });
        if (opts.move) this.moveAfterEdit(r, c, opts.move);
        return true;
      }
      const p = e.type.parse(this.input.value, e.cfg);
      if (!p.ok) {
        this.input.classList.add("pyo-invalid");
        this.input.setAttribute("aria-invalid", "true");
        return false;
      }
      value = p.value;
    }
    const { r, c, key } = e;
    this._finish();
    // 글자를 바꿨으면: 같은 뜻의 값(text 칸에 0을 지우고 다시 0)만 그대로 두고, 나머지는 저장한다
    if (sameValue(e.type, e.cfg, e.original, value)) this.grid.refreshRow(r);
    else g.setValue(r, key, value, { source: "edit" });
    g.emit("editend", { ...g.cellContext(r, c), committed: true });
    if (opts.move) this.moveAfterEdit(r, c, opts.move);
    return true;
  }

  cancel() {
    const e = this.edit;
    if (!e) return;
    this._finish();
    this.grid.refreshRow(e.r);
    this.grid.emit("editend", { ...this.grid.cellContext(e.r, e.c), committed: false });
  }

  _finish() {
    const e = this.edit;
    const input = this.input;
    if (e && e.popup) e.popup.destroy();
    if (e) for (const a of e.attrs) input.removeAttribute(a);
    this.edit = null;
    this._pending = null;
    input.classList.remove("pyo-input-on", "pyo-invalid");
    input.removeAttribute("aria-invalid");
    input.style.width = "";
    delete input.dataset.editor;
    input.value = "";
    this.grid.el.root.classList.remove("pyo-editing");
    this.position();
  }

  /**
   * @param {number} r
   * @param {number} c
   * @param {"up"|"down"|"left"|"right"} dir
   */
  moveAfterEdit(r, c, dir) {
    const g = this.grid;
    const nr = clamp(r + (dir === "down" ? 1 : dir === "up" ? -1 : 0), 0, g.rows.length - 1);
    let nc = c;
    let rr = nr;
    if (dir === "right" || dir === "left") ({ r: rr, c: nc } = this._tabTarget(r, c, dir === "left"));
    g.setRange(rr, nc);
    g.scrollToCell(rr, nc);
    this.position();
  }

  /** Tab: 오른쪽 셀, 줄 끝이면 다음 줄 처음 */
  _tabTarget(r, c, back) {
    const g = this.grid;
    const last = g.leaves.length - 1;
    if (!back) {
      if (c < last) return { r, c: c + 1 };
      if (r < g.rows.length - 1) return { r: r + 1, c: 0 };
      return { r, c };
    }
    if (c > 0) return { r, c: c - 1 };
    if (r > 0) return { r: r - 1, c: last };
    return { r, c };
  }

  /**
   * 체크박스 값을 바꾼다.
   * @param {number} r
   * @param {number} c
   */
  toggle(r, c) {
    const info = this.editable(r, c);
    if (!info || info.type.kind !== "toggle") return false;
    const cur = getValue(info.row, info.key);
    this.grid.setValue(r, info.key, checkboxValue(!isChecked(cur, info.cfg), info.cfg), { source: "edit" });
    return true;
  }

  /**
   * 선택 범위에서 지울 수 있는 셀을 빈 값으로 (Delete, 잘라내기)
   * @param {string} [source]
   */
  clearRange(source = "clear") {
    const g = this.grid;
    const rng = g.range;
    if (!rng) return 0;
    const changes = [];
    for (let r = rng.r0; r <= rng.r1; r++) {
      for (let c = rng.c0; c <= rng.c1; c++) {
        const info = this.editable(r, c);
        if (!info || !info.type.clearable) continue;
        const v = getValue(info.row, info.key);
        if (v === "" || v === null || v === undefined) continue;
        changes.push({ rowIndex: r, key: info.key, value: "" });
      }
    }
    if (changes.length) g.setValues(changes, { source });
    return changes.length;
  }

  /* ==================================================================
   * 위치
   * ================================================================ */

  /** 활성 셀의 루트 기준 사각형 (그리지 않은 행이어도 계산된다) */
  cellRect(r, c) {
    const g = this.grid;
    const s = g.el.scroll;
    const top = headerHeight(g) + r * g.options.rowHeight - s.scrollTop;
    const left = c < g.frozenCount ? g.leafX[c] : g.fzWidth + g.leafX[c] - s.scrollLeft;
    return { left, top, width: g.widths[c], height: g.options.rowHeight };
  }

  /** 입력칸을 활성 셀 위로 옮긴다. 편집하지 않을 때는 보이는 영역 안에 머문다 (한글 후보 창 위치용). */
  position() {
    const g = this.grid;
    const input = this.input;
    const a = this.edit ? { r: this.edit.r, c: this.edit.c } : g.range ? g.range.active : null;
    if (!a || !g.leaves[a.c]) {
      input.style.left = "0px";
      input.style.top = headerHeight(g) + "px";
      return;
    }
    const rc = this.cellRect(a.r, a.c);
    const root = g.el.root;
    let { left, top } = rc;
    if (!this.edit) {
      left = clamp(left, 0, Math.max(0, root.clientWidth - 20));
      top = clamp(top, headerHeight(g), Math.max(headerHeight(g), root.clientHeight - rc.height));
    }
    input.style.left = left + "px";
    input.style.top = top + "px";
    input.style.height = rc.height + "px";
    input.style.minWidth = rc.width + "px";
    if (this.edit && this.edit.type.kind === "input") this.autosize();
    if (this.edit) this.placePopup();
  }

  /** 긴 글자는 오른쪽으로 늘려 보여 준다 (보이는 영역까지) */
  autosize() {
    const input = this.input;
    const root = this.grid.el.root;
    const left = parseFloat(input.style.left) || 0;
    input.style.width = "0px";
    const want = input.scrollWidth + 4;
    const min = parseFloat(input.style.minWidth) || 0;
    input.style.width = Math.max(min, Math.min(want, root.clientWidth - left - 2)) + "px";
  }

  placePopup() {
    const e = this.edit;
    if (!e || !e.popup) return;
    const rr = this.grid.el.root.getBoundingClientRect();
    const rc = this.cellRect(e.r, e.c);
    e.popup.place({ left: rr.left + rc.left, top: rr.top + rc.top, bottom: rr.top + rc.top + rc.height, width: rc.width });
  }

  /* ==================================================================
   * 이벤트
   * ================================================================ */

  onBlur() {
    this.grid.el.root.classList.remove("pyo-focused");
    // 팝업은 mousedown을 막아 포커스를 가져가지 않는다. 다른 곳을 눌러 포커스가 나가면 저장한다.
    if (this.edit && !this.commit()) this.cancel();
  }

  onCompositionStart() {
    if (this.edit) return;
    // 키다운에서 편집을 시작하지 못한 경우(키다운 없이 조합이 시작되는 환경)
    const a = this.grid.range && this.grid.range.active;
    if (a && this._typeStartable(a.r, a.c)) this.start(a.r, a.c, { mode: "type" });
    else this._discardComposition = true;
  }

  onCompositionEnd() {
    if (this._discardComposition || !this.edit) {
      this._discardComposition = false;
      if (!this.edit) this.input.value = "";
      return;
    }
    const e = this.edit;
    if (e.type.kind === "list") this._search();
    else if (e.type.sanitize) this._sanitize();
    if (e.type.kind === "input") this.autosize();
    const p = this._pending;
    this._pending = null;
    if (p) {
      // 조합을 확정한 키(Enter 등)를 이어서 처리한다
      setTimeout(() => {
        this._suppress = { code: p.code, until: Date.now() + 80 };
        this._editKey(p.code, p.shift);
      }, 0);
    }
  }

  /** @param {InputEvent} e */
  onInput(e) {
    const ed = this.edit;
    if (!ed) {
      if (e.isComposing) return;
      // 키다운 없이 글자가 들어온 경우 (받아쓰기, 이모지 창, 일부 입력기): 편집할 수 있는 셀이면 이어서 편집
      const a = this.grid.range && this.grid.range.active;
      if (this.input.value && a && this._typeStartable(a.r, a.c)) {
        this.start(a.r, a.c, { mode: "type" });
        this.onInput(e);
      } else this.input.value = "";
      return;
    }
    if (e.isComposing) {
      if (ed.type.kind === "input") this.autosize();
      return;
    }
    this.input.classList.remove("pyo-invalid");
    if (ed.type.kind === "list") return this._search();
    if (ed.type.sanitize) this._sanitize();
    if (ed.popup && ed.popup.show) ed.popup.show(this.input.value);
    this.autosize();
  }

  /** 입력 정리 + 커서 위치 유지 (쉼표가 들어가도 숫자 기준으로 같은 자리) */
  _sanitize() {
    const ed = this.edit;
    const input = this.input;
    const before = input.value;
    const after = ed.type.sanitize(before, ed.cfg);
    if (after === before) return;
    const caret = input.selectionStart ?? before.length;
    // 쉼표·하이픈처럼 서식으로 들어간 글자는 빼고, 의미 있는 글자 수로 커서 자리를 맞춘다
    const sig = ed.type.sig || /[0-9.\-]/;
    const keep = [...before.slice(0, caret)].filter((ch) => sig.test(ch)).length;
    let pos = 0;
    let seen = 0;
    while (pos < after.length && seen < keep) {
      if (sig.test(after[pos])) seen++;
      pos++;
    }
    input.value = after;
    input.setSelectionRange(pos, pos);
  }

  _search() {
    const ed = this.edit;
    if (!ed || !ed.popup) return;
    ed.popup.search(this.input.value);
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      // 잠시 멈추면 검색어를 비운다 (다음 글자부터 새로 찾기)
      if (this.edit === ed) this.input.value = "";
    }, 900);
  }

  _typeStartable(r, c) {
    const info = this.editable(r, c);
    return !!(info && info.type.typeToEdit);
  }

  /**
   * @param {ClipboardEvent} e
   * @param {"copy"|"cut"|"paste"} type
   */
  onClipboard(e, type) {
    const g = this.grid;
    if (this.edit || !g.options.clipboard || !g.range) return;
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    if (type === "paste") {
      g.paste(cd.getData("text/plain"));
      return;
    }
    // 범위 글자는 한 번만 만든다 (범위가 크면 비용이 크다)
    const text = g.getRangeText();
    cd.setData("text/plain", text);
    if (type === "cut") this.clearRange("cut");
    else g._afterCopy(text);
  }

  /** @param {KeyboardEvent} e */
  onKeyDown(e) {
    const g = this.grid;
    if (g.emitCancelable("keydown", { event: e, editing: !!this.edit }) === false) return;
    // 한글 조합 중
    if (e.isComposing || e.keyCode === 229) {
      if (this.edit) {
        if (MOVE_CODES[e.code]) this._pending = { code: e.code, shift: e.shiftKey };
        return;
      }
      const a = g.range && g.range.active;
      if (a && this._typeStartable(a.r, a.c)) this.start(a.r, a.c, { mode: "type" });
      else this._discardComposition = true;
      return;
    }
    if (this._suppress && this._suppress.code === e.code && Date.now() < this._suppress.until) {
      this._suppress = null;
      e.preventDefault();
      return;
    }
    this._suppress = null;
    if (this.edit) this._editingKeyDown(e);
    else this._idleKeyDown(e);
  }

  /** @param {KeyboardEvent} e */
  _editingKeyDown(e) {
    const ed = this.edit;
    const key = e.key;
    if (key === "Escape") {
      e.preventDefault();
      this.cancel();
      return;
    }
    if (key === "Enter") {
      if (e.altKey && ed.def.multiLine && ed.type.kind === "input") {
        e.preventDefault();
        this._insertText("\n");
        return;
      }
      e.preventDefault();
      this._editKey("Enter", e.shiftKey);
      return;
    }
    if (key === "Tab") {
      const t = this._tabTarget(ed.r, ed.c, e.shiftKey);
      if (t.r === ed.r && t.c === ed.c) {
        // 끝 셀: 저장하고 막지 않아 포커스가 그리드 밖으로 나간다. 잘못된 값이면 편집을 계속한다.
        if (!this.commit()) e.preventDefault();
        return;
      }
      e.preventDefault();
      this._editKey("Tab", e.shiftKey);
      return;
    }
    if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      if (ed.type.kind === "list") ed.popup.move(key === "ArrowUp" ? -1 : 1);
      else this._editKey(key, e.shiftKey);
      return;
    }
    if (ed.type.kind === "list" && (key === "PageUp" || key === "PageDown")) {
      e.preventDefault();
      ed.popup.move(key === "PageUp" ? -8 : 8);
    }
  }

  /**
   * 편집 중 저장·이동 키
   * @param {string} code
   * @param {boolean} shift
   */
  _editKey(code, shift) {
    if (!this.edit) return;
    if (code === "Enter" || code === "NumpadEnter") this.commit({ move: shift ? "up" : "down" });
    else if (code === "Tab") this.commit({ move: shift ? "left" : "right" });
    else if (code === "ArrowUp") this.commit({ move: "up" });
    else if (code === "ArrowDown") this.commit({ move: "down" });
  }

  /** @param {string} text */
  _insertText(text) {
    const input = this.input;
    const s = input.selectionStart ?? input.value.length;
    const t = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + text + input.value.slice(t);
    input.setSelectionRange(s + text.length, s + text.length);
  }

  /** @param {KeyboardEvent} e */
  _idleKeyDown(e) {
    const g = this.grid;
    const key = e.key;
    const mod = e.ctrlKey || e.metaKey;
    const n = g.rows.length;
    const last = g.leaves.length - 1;
    if (!n || last < 0) return;
    const rng = g.range;
    const a = rng ? rng.active : { r: 0, c: 0 };
    const page = Math.max(1, Math.floor((viewportHeight(g) - headerHeight(g)) / g.options.rowHeight) - 1);
    const NAV = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Home: 1, End: 1, PageUp: 1, PageDown: 1, Tab: 1 };
    if (!rng && NAV[key]) {
      // Shift+Tab으로 들어온 그리드에서 다시 Shift+Tab: 막지 않아 앞 입력 요소로 나간다
      if (key === "Tab" && e.shiftKey) return;
      // 처음 키보드로 들어오면 첫 셀부터
      e.preventDefault();
      g.setRange(0, 0);
      g.scrollToCell(0, 0);
      this.position();
      return;
    }

    /** @param {number} r @param {number} c @param {boolean} [extend] */
    const go = (r, c, extend = e.shiftKey) => {
      e.preventDefault();
      r = clamp(r, 0, n - 1);
      c = clamp(c, 0, last);
      if (extend && rng) g.setRange(rng.anchor.r, rng.anchor.c, r, c);
      else g.setRange(r, c);
      g.scrollToCell(r, c);
      this.position();
    };

    switch (key) {
      case "ArrowUp":
        return go(mod ? 0 : a.r - 1, a.c);
      case "ArrowDown":
        return go(mod ? n - 1 : a.r + 1, a.c);
      case "ArrowLeft":
        return go(a.r, mod ? 0 : a.c - 1);
      case "ArrowRight":
        return go(a.r, mod ? last : a.c + 1);
      case "Home":
        return go(mod ? 0 : a.r, 0);
      case "End":
        return go(mod ? n - 1 : a.r, last);
      case "PageUp":
        return go(a.r - page, a.c);
      case "PageDown":
        return go(a.r + page, a.c);
      case "Tab": {
        const t = this._tabTarget(a.r, a.c, e.shiftKey);
        // 마지막 셀의 Tab, 첫 셀의 Shift+Tab: 막지 않아 다음(앞) 입력 요소로 포커스가 나간다
        if (t.r === a.r && t.c === a.c) return;
        return go(t.r, t.c, false);
      }
    }
    if (!rng) {
      if (key.length === 1 && !mod && !e.altKey) e.preventDefault();
      return;
    }
    if (mod && (key === "a" || key === "A")) {
      e.preventDefault();
      g.setRange(0, 0, n - 1, last);
      return;
    }
    if (mod && g.options.undo && (key === "z" || key === "Z" || key === "y" || key === "Y")) {
      e.preventDefault();
      if ((key === "z" || key === "Z") && !e.shiftKey) g.undo();
      else g.redo();
      return;
    }
    // Ctrl+C·X·V는 기본 동작을 두어 브라우저 copy·cut·paste 이벤트로 처리한다 (onClipboard)
    if (key === "Enter" || key === "F2" || key === " ") {
      e.preventDefault();
      const info = this.editable(a.r, a.c);
      if (info) this.start(a.r, a.c, { mode: "edit" });
      else if (key === "Enter") go(a.r + (e.shiftKey ? -1 : 1), a.c, false);
      return;
    }
    if (key === "Delete") {
      e.preventDefault();
      this.clearRange();
      return;
    }
    if (key === "Backspace") {
      e.preventDefault();
      if (this._typeStartable(a.r, a.c)) this.start(a.r, a.c, { mode: "type", initial: "" });
      return;
    }
    if (key.length === 1 && !mod && !e.altKey) {
      // 글자 키: 편집을 시작하고 기본 동작을 두어 글자가 입력칸에 들어가게 한다
      if (this._typeStartable(a.r, a.c)) this.start(a.r, a.c, { mode: "type" });
      else e.preventDefault();
    }
  }
}
