// 접근성 자동 검사: 데모 페이지를 axe(WCAG 2.1 A·AA 규칙)로 검사하고, 그리드의 ARIA 속성을 실제 브라우저에서 확인한다.
// 사람이 스크린 리더로 확인할 항목은 docs/a11y-manual-check.md에 있다.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["index", "weekly", "editors", "summary", "paging", "big", "input-log"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
// scrollable-region-focusable: 그리드의 스크롤 영역(.pyo-scroll)에는 포커스를 받는 요소가 없다.
// 포커스는 늘 그리드 입력칸에 있고, 방향키·PageUp·PageDown으로 스크롤하므로 키보드로 스크롤할 수 있다.
// axe는 이것을 알 수 없다. 스크롤 영역에 tabindex를 주면 Tab 순서가 바뀌므로 이 규칙은 끈다.
const DISABLED = ["scrollable-region-focusable"];

const summarize = (violations) => violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);

for (const name of PAGES) {
  test(`axe: ${name}.html (WCAG 2.1 A·AA)`, async ({ page }) => {
    await page.goto(`/demo/${name}.html?lang=ko`);
    if (name !== "index") await page.locator(".pyo-row").first().waitFor();
    const result = await new AxeBuilder({ page }).withTags(TAGS).disableRules(DISABLED).analyze();
    expect(summarize(result.violations)).toEqual([]);
  });
}

test("axe: 셀을 고르고 편집하는 중에도 위반이 없다", async ({ page }) => {
  await page.goto("/demo/editors.html?lang=ko");
  await page.locator('#grid .pyo-row[data-row="1"] .pyo-cell[data-c="1"]').click();
  await page.keyboard.press("F2");
  const result = await new AxeBuilder({ page }).withTags(TAGS).disableRules(DISABLED).include("#grid").analyze();
  expect(summarize(result.violations)).toEqual([]);
});

test("axe: 조건 칸이 있는 필터 팝업에도 위반이 없다", async ({ page }) => {
  await page.goto("/demo/weekly.html?lang=ko&date=2026-11-12&rows=300");
  await page.locator(".pyo-row").first().waitFor();
  const check = async () => {
    const result = await new AxeBuilder({ page }).withTags(TAGS).disableRules(DISABLED).include(".pyo-filter").analyze();
    expect(summarize(result.violations)).toEqual([]);
  };
  // 글자 컬럼: 연산자 고르기 + 값 칸
  await page.locator('#gridWrap .pyo-hcell[data-key="OWNER"] .pyo-filter-btn').click();
  const pop = page.locator(".pyo-filter");
  await expect(pop.locator(".pyo-f-cond select.pyo-f-op")).toHaveAccessibleName("조건");
  await pop.locator("select.pyo-f-op").selectOption("contains");
  await expect(pop.locator(".pyo-f-value")).toBeVisible();
  await expect(pop.locator(".pyo-f-value")).toHaveAccessibleName("값");
  await check();
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);

  // 숫자 컬럼: 범위(시작·끝 칸). 둘 다 비운 채 확인을 눌러 aria-invalid가 붙은 상태까지 검사
  await page.locator('#gridWrap .pyo-hcell[data-key="ORDER_QTY"] .pyo-filter-btn').click();
  await pop.locator("select.pyo-f-op").selectOption("between");
  await expect(pop.locator(".pyo-f-from")).toHaveAccessibleName("부터");
  await expect(pop.locator(".pyo-f-to")).toHaveAccessibleName("까지");
  await check();
  await pop.locator(".pyo-f-ok").click();
  await expect(pop.locator(".pyo-f-from")).toHaveAttribute("aria-invalid", "true");
  await check();
});

test("ARIA: 그리드 크기, 행·칸 번호, 활성 칸 가리키기", async ({ page }) => {
  await page.goto("/demo/big.html?lang=ko");
  await page.locator(".pyo-row").first().waitFor();
  const info = await page.evaluate(() => {
    const g = window.grid;
    const el = document.querySelector('#grid [role="grid"]');
    return {
      rowcount: Number(el.getAttribute("aria-rowcount")),
      colcount: Number(el.getAttribute("aria-colcount")),
      depth: g.headerDepth,
      expectRows: g.headerDepth + g.rowCount,
      expectCols: g.getColumnWidths().length + 1, // 줄 번호 칸
    };
  });
  expect(info.rowcount).toBe(info.expectRows);
  expect(info.colcount).toBe(info.expectCols);

  // 가운데로 스크롤해도 번호는 전체 기준
  await page.evaluate(() => window.grid.scrollToRow(25000, "top"));
  const row = page.locator('#grid .pyo-row[data-row="25000"]');
  await expect(row).toHaveAttribute("aria-rowindex", String(info.depth + 25000 + 1));

  // 칸을 누르면 입력칸이 그 칸을 가리킨다
  await row.locator('.pyo-cell[data-c="3"]').click();
  const input = page.locator("#grid .pyo-input");
  const id = await input.getAttribute("aria-activedescendant");
  expect(id).toBeTruthy();
  await expect(page.locator(`[id="${id}"]`)).toHaveAttribute("aria-colindex", String(1 + 3 + 1));
  await expect(page.locator(`[id="${id}"]`)).toHaveClass(/pyo-active/);

  // 방향키로 옮기면 따라간다
  await page.keyboard.press("ArrowDown");
  const id2 = await input.getAttribute("aria-activedescendant");
  expect(id2).not.toBe(id);
  await expect(page.locator(`[id="${id2}"]`)).toHaveAttribute("aria-colindex", String(1 + 3 + 1));
  expect(await page.locator(`[id="${id2}"]`).evaluate((el) => el.closest(".pyo-row").dataset.row)).toBe("25001");

  // 화면 밖으로 스크롤하면 떼고, 돌아오면 다시 가리킨다
  await page.evaluate(() => window.grid.scrollToRow(0, "top"));
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.+/);
  await page.evaluate(() => window.grid.scrollToRow(25001, "nearest"));
  await expect(input).toHaveAttribute("aria-activedescendant", id2);
});
