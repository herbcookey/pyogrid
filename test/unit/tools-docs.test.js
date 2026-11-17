// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { docStructure, compareDocs, SECTIONS } from "../../tools/check-docs.mjs";

const en = `# Title

## Intro

Not checked.

## Grid options

\`new PyoGrid(target, options)\`.

### Layout

| Option | Default | Description |
|---|---|---|
| \`columns\` | \`[]\` | Columns |
| \`overscanRows\` / \`overscanColumns\` | \`6\` / \`2\` | Extra |

## Methods

### Data

| Method | Description |
|---|---|
| \`setData(rows, page?)\` | Replace |
| \`setValue(rowIndex \\| row, key, value)\` | Set |

\`\`\`js
// | not a table row |
grid.setData([]);
\`\`\`

## Formatters

| \`ignored\` | x |
`;

const ko = `# 제목

머리말.

## 그리드 옵션
<!-- en: Grid options -->

### 배치
<!-- en: Layout -->

| 옵션 | 기본값 | 설명 |
|---|---|---|
| \`columns\` | \`[]\` | 컬럼 |
| \`overscanRows\` / \`overscanColumns\` | \`6\` / \`2\` | 더 그리기 |

## 메서드
<!-- en: Methods -->

### 데이터
<!-- en: Data -->

| 메서드 | 설명 |
|---|---|
| \`setData(rows, page?)\` | 바꾸기 |
| \`setValue(rowIndex \\| row, key, value)\` | 넣기 |

\`\`\`js
grid.setData([]);
\`\`\`
`;

const opts = { sections: ["Grid options", "Methods"] };

describe("docStructure", () => {
  it("영어 문서: 고른 절과 그 아래 ###만, 표 첫 칸의 이름·표 행 수·코드 블록 수", () => {
    expect(docStructure(en, { ...opts, lang: "en" })).toEqual([
      { title: "Grid options", level: 2, heading: "## Grid options", names: [], rows: 0, codeBlocks: 0 },
      { title: "Grid options > Layout", level: 3, heading: "### Layout", names: ["columns", "overscanRows", "overscanColumns"], rows: 2, codeBlocks: 0 },
      { title: "Methods", level: 2, heading: "## Methods", names: [], rows: 0, codeBlocks: 0 },
      { title: "Methods > Data", level: 3, heading: "### Data", names: ["setData", "setValue"], rows: 2, codeBlocks: 1 },
    ]);
  });
  it("한국어 문서: 제목 다음 줄의 <!-- en: ... -->로 영어 절 이름을 읽는다", () => {
    const k = docStructure(ko, { lang: "ko" });
    expect(k.map((s) => s.title)).toEqual(["Grid options", "Grid options > Layout", "Methods", "Methods > Data"]);
    expect(k[3].names).toEqual(["setData", "setValue"]);
  });
  it("한국어 제목에 표시가 없으면 title이 null", () => {
    const k = docStructure("## 이벤트\n\n| a | b |\n|---|---|\n| `click` | x |\n", { lang: "ko" });
    expect(k[0].title).toBeNull();
    expect(k[0].heading).toBe("## 이벤트");
  });
});

describe("compareDocs", () => {
  const E = docStructure(en, { ...opts, lang: "en" });
  it("같으면 문제가 없다", () => {
    expect(compareDocs(E, docStructure(ko, { lang: "ko" }))).toEqual([]);
  });
  it("빠진 이름·더 있는 이름", () => {
    const k = ko.replace("| `setValue(rowIndex \\| row, key, value)` | 넣기 |", "| `setValues(changes)` | 넣기 |");
    expect(compareDocs(E, docStructure(k, { lang: "ko" }))).toEqual(['"Methods > Data": missing in Korean: setValue; only in Korean: setValues']);
  });
  it("빠진 절·더 있는 절", () => {
    const k = ko.replace("### 배치\n<!-- en: Layout -->", "### 배치\n<!-- en: Layouts -->");
    expect(compareDocs(E, docStructure(k, { lang: "ko" }))).toEqual([
      'Section missing in Korean: "Grid options > Layout"',
      'Section only in Korean: "Grid options > Layouts"',
    ]);
  });
  it("절 순서가 다르다", () => {
    const k = ko.slice(ko.indexOf("## 메서드")) + "\n" + ko.slice(ko.indexOf("## 그리드 옵션"), ko.indexOf("## 메서드"));
    expect(compareDocs(E, docStructure(k, { lang: "ko" }))).toEqual(["Section order differs from README.md"]);
  });
  it("코드 블록·표 행 수가 다르다", () => {
    const k = ko.replace("```js\ngrid.setData([]);\n```\n", "").replace("| `columns` | `[]` | 컬럼 |\n", "| `columns` | `[]` | 컬럼 |\n|  | | 빈 이름 |\n");
    expect(compareDocs(E, docStructure(k, { lang: "ko" }))).toEqual([
      '"Grid options > Layout": table rows: README.md 2, Korean 3',
      '"Methods > Data": code blocks: README.md 1, Korean 0',
    ]);
  });
  it("표시 없는 한국어 제목", () => {
    const k = ko + "\n## 더\n";
    expect(compareDocs(E, docStructure(k, { lang: "ko" }))).toEqual(['Korean heading "## 더" has no <!-- en: ... --> line under it']);
  });
});

describe("저장소 문서", () => {
  it("README.md의 옵션·컬럼·메서드·이벤트 절과 docs/api.ko.md의 구성이 같다", () => {
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const api = readFileSync(new URL("../../docs/api.ko.md", import.meta.url), "utf8");
    const E = docStructure(readme, { sections: SECTIONS, lang: "en" });
    expect(E.map((s) => s.title)).toContain("Methods > Data");
    expect(compareDocs(E, docStructure(api, { lang: "ko" }))).toEqual([]);
  });
});
