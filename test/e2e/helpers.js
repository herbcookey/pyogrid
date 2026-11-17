// e2e 공통 도구
import { expect } from "@playwright/test";

/**
 * 요소의 화면 상자 {x, y, width, height}. 페이지 안에서 getBoundingClientRect로 잰다.
 * locator.boundingBox()는 재는 순간 요소가 문서에서 빠져 있거나(그리드가 행·헤더를 다시 그리는 중)
 * 보이지 않으면 기다리지 않고 null을 돌려준다. 느린 CI에서 그 틈에 걸리면 테스트가 실패하므로,
 * 요소가 붙어 있고 크기가 있을 때까지 다시 잰다.
 * @param {import("@playwright/test").Locator} loc
 * @param {{timeout?: number}} [opts]
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
export async function rectOf(loc, opts = {}) {
  /** @type {{x: number, y: number, width: number, height: number} | null} */
  let r = null;
  await expect
    .poll(
      async () => {
        r = await loc
          .evaluate((el) => {
            const b = el.getBoundingClientRect();
            return el.isConnected && (b.width > 0 || b.height > 0) ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
          }, undefined, { timeout: 2000 })
          .catch(() => null);
        return r !== null;
      },
      { timeout: opts.timeout ?? 10000, message: "element box" },
    )
    .toBe(true);
  return /** @type {{x: number, y: number, width: number, height: number}} */ (r);
}
