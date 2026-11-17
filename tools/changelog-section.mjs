// CHANGELOG.md에서 한 버전의 절을 꺼낸다. 릴리스 워크플로가 GitHub Release 본문으로 쓴다.
//   node tools/changelog-section.mjs 0.10.0      표준 출력으로 (앞의 v는 있어도 된다)
// 그 버전의 절이 없거나 비었으면 실패한다 (CHANGELOG를 쓰지 않은 채 배포하지 않게).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * "## 0.9.0" 절의 본문 (제목 줄 빼고, 다음 "## " 제목 앞까지, 앞뒤 빈 줄 없이). 없으면 null.
 * 제목 뒤에 " - 날짜"처럼 다른 글자가 붙어도 된다.
 * @param {string} text
 * @param {string} version
 * @returns {string|null}
 */
export function changelogSection(text, version) {
  const v = version.replace(/^v/, "");
  // 버전 모양(1.2.3, 1.2.3-beta.1)만 찾는다. "Unreleased" 같은 절은 릴리스 본문이 아니다
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const head = new RegExp(`^## \\[?${esc}\\]?(\\s|$)`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  if (!version) {
    console.error("사용법: node tools/changelog-section.mjs <version>");
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const body = changelogSection(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), version);
  if (!body) {
    console.error(`[changelog-section] CHANGELOG.md에 "## ${version.replace(/^v/, "")}" 절이 없거나 비었습니다.`);
    process.exit(1);
  }
  process.stdout.write(body + "\n");
}
