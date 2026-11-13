// jsdom은 레이아웃을 계산하지 않으므로 그리드가 읽는 크기와 스크롤 위치만 흉내 낸다.
export const SIZE = { width: 800, height: 400 };
const restore = [];

export function mockLayout() {
  const proto = HTMLElement.prototype;
  for (const prop of ["clientWidth", "clientHeight", "offsetHeight"]) {
    const orig = Object.getOwnPropertyDescriptor(proto, prop);
    restore.push([prop, orig, proto]);
    Object.defineProperty(proto, prop, {
      configurable: true,
      get() {
        if (!this.classList || !(this.classList.contains("pyo") || this.classList.contains("pyo-scroll"))) return 0;
        return prop === "clientWidth" ? SIZE.width : SIZE.height;
      },
    });
  }
  for (const prop of ["scrollTop", "scrollLeft"]) {
    const orig = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    restore.push([prop, orig, Element.prototype]);
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get() {
        return this["_" + prop] || 0;
      },
      set(v) {
        this["_" + prop] = v;
      },
    });
  }
}

export function unmockLayout() {
  while (restore.length) {
    const [prop, desc, target] = restore.pop();
    if (desc) Object.defineProperty(target, prop, desc);
  }
}

export const makeRows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: "행" + (i + 1), qty: i * 1000 }));

export const rowEl = (grid, i) => grid.el.body.querySelector(`.pyo-row[data-row="${i}"]`);

export const cellsOf = (grid, i) => {
  const row = rowEl(grid, i);
  return row ? [...row.querySelectorAll(".pyo-cell")] : null;
};

/** jsdom에 PointerEvent가 없을 수 있어 MouseEvent에 같은 이름을 붙여 보낸다 */
export function fire(el, type, init = {}) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }));
}
