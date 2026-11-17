// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { changelogSection } from "../../tools/changelog-section.mjs";

const text = `# Changelog

Intro text.

## Unreleased

- Not yet.

## 10.9.0

- Ten.

## 0.9.0

### Breaking changes

- One.

### Added

- Two.

## 0.9.01

- Not a real version.

## 0.8.0

- Old.
`;

describe("changelogSection", () => {
  it("그 버전 절의 본문만 돌려준다 (제목 줄 빼고, 다음 ## 앞까지)", () => {
    expect(changelogSection(text, "0.9.0")).toBe("### Breaking changes\n\n- One.\n\n### Added\n\n- Two.");
  });
  it("앞뒤가 비슷한 버전(10.9.0, 0.9.01)과 헷갈리지 않는다", () => {
    expect(changelogSection(text, "10.9.0")).toBe("- Ten.");
    expect(changelogSection(text, "0.8.0")).toBe("- Old.");
  });
  it("앞의 v는 떼고 찾는다", () => {
    expect(changelogSection(text, "v0.8.0")).toBe("- Old.");
  });
  it("없는 버전은 null", () => {
    expect(changelogSection(text, "0.7.0")).toBeNull();
    expect(changelogSection(text, "Unreleased")).toBeNull();
  });
  it("CRLF 파일도 읽는다", () => {
    expect(changelogSection(text.replace(/\n/g, "\r\n"), "0.8.0")).toBe("- Old.");
  });
  it("제목 뒤에 날짜가 붙어도 찾는다", () => {
    expect(changelogSection("## 1.0.0 - 2027-01-02\n\n- A.\n", "1.0.0")).toBe("- A.");
  });
  it("저장소 CHANGELOG.md에서 0.9.0 절을 찾는다", () => {
    const real = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
    expect(changelogSection(real, "0.9.0")).toMatch(/^### Breaking changes/);
  });
});
