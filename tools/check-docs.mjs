// README.md(영어)의 레퍼런스 절과 docs/api.ko.md(한국어)의 구성이 같은지 본다.
//   node tools/check-docs.mjs        (npm run docs:check)
// 비교하는 것: 절(##, ###)의 목록과 순서, 표 첫 칸에 적힌 이름(옵션·속성·메서드·이벤트), 표 행 수, 코드 블록 수.
// 한국어 문서의 제목 바로 다음 줄에는 <!-- en: 영어 절 이름 -->을 적어 어느 영어 절과 짝인지 표시한다.
// 글의 내용(번역)은 비교하지 않는다. 다르면 무엇이 다른지 찍고 1로 끝난다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** README.md에서 docs/api.ko.md로 옮긴 절 */
export const SECTIONS = ["Grid options", "Column options", "Methods", "Events"];

/**
 * @typedef {{title: string|null, level: number, heading: string, names: string[], rows: number, codeBlocks: number}} DocSection
 */

/** 표 한 줄을 칸으로 나눈다 (\| 는 칸 구분이 아니다) */
const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/);

/** 표 첫 칸의 `이름` 들 (`setData(rows)` → setData, `a` / `b` → a, b) */
function namesOf(cell) {
  const out = [];
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    const id = /^[A-Za-z_$][\w$]*/.exec(m[1].trim());
    if (id) out.push(id[0]);
  }
  return out;
}

/**
 * @param {string} text
 * @param {{lang: "en"|"ko", sections?: string[]}} opts  en이면 sections에 있는 ## 절과 그 아래 ###만 본다. ko는 모든 ##, ### 절을 본다
 * @returns {DocSection[]}
 */
export function docStructure(text, opts) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  /** @type {DocSection[]} */
  const out = [];
  /** @type {DocSection|null} */
  let cur = null;
  let parent = null; // 지금 ## 절의 영어 이름 (ko는 표시에서 읽은 이름)
  let include = false;
  let fence = false;
  let tableLine = 0; // 지금 표의 몇째 줄인지 (0이면 표 밖)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      if (!fence && cur) cur.codeBlocks++;
      fence = !fence;
      tableLine = 0;
      continue;
    }
    if (fence) continue;
    const h = /^(#{2,3}) (.+?)\s*$/.exec(line);
    if (h) {
      tableLine = 0;
      const level = h[1].length;
      let own;
      if (opts.lang === "en") own = h[2];
      else {
        const mk = /^<!--\s*en:\s*(.+?)\s*-->\s*$/.exec(lines[i + 1] || "");
        own = mk ? mk[1] : null;
      }
      if (level === 2) {
        parent = own;
        include = opts.lang === "ko" || (opts.sections || []).includes(own);
      }
      if (!include) {
        cur = null;
        continue;
      }
      const title = own === null ? null : level === 2 ? own : `${parent === null ? "?" : parent} > ${own}`;
      cur = { title, level, heading: line.trim(), names: [], rows: 0, codeBlocks: 0 };
      out.push(cur);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      tableLine++;
      // 1째 줄은 머리, 2째 줄은 |---|
      if (cur && tableLine > 2) {
        cur.rows++;
        cur.names.push(...namesOf(cells(line)[0] || ""));
      }
    } else tableLine = 0;
  }
  return out;
}

/**
 * @param {DocSection[]} en  README.md
 * @param {DocSection[]} ko  docs/api.ko.md
 * @returns {string[]} 다른 점 (같으면 빈 배열)
 */
export function compareDocs(en, ko) {
  const problems = [];
  for (const s of ko) if (s.title === null) problems.push(`Korean heading "${s.heading}" has no <!-- en: ... --> line under it`);
  const kk = ko.filter((s) => s.title !== null);
  const enTitles = en.map((s) => s.title);
  const koTitles = kk.map((s) => s.title);
  for (const t of enTitles) if (!koTitles.includes(t)) problems.push(`Section missing in Korean: "${t}"`);
  for (const t of koTitles) if (!enTitles.includes(t)) problems.push(`Section only in Korean: "${t}"`);
  const sameSet = enTitles.length === koTitles.length && enTitles.every((t) => koTitles.includes(t));
  if (sameSet && enTitles.some((t, i) => t !== koTitles[i])) problems.push("Section order differs from README.md");
  for (const e of en) {
    const k = kk.find((s) => s.title === e.title);
    if (!k) continue;
    const missing = [...new Set(e.names.filter((n) => !k.names.includes(n)))];
    const extra = [...new Set(k.names.filter((n) => !e.names.includes(n)))];
    if (missing.length || extra.length) {
      const parts = [];
      if (missing.length) parts.push(`missing in Korean: ${missing.join(", ")}`);
      if (extra.length) parts.push(`only in Korean: ${extra.join(", ")}`);
      problems.push(`"${e.title}": ${parts.join("; ")}`);
    }
    if (e.rows !== k.rows) problems.push(`"${e.title}": table rows: README.md ${e.rows}, Korean ${k.rows}`);
    if (e.codeBlocks !== k.codeBlocks) problems.push(`"${e.title}": code blocks: README.md ${e.codeBlocks}, Korean ${k.codeBlocks}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  const en = docStructure(read("README.md"), { lang: "en", sections: SECTIONS });
  const ko = docStructure(read("docs/api.ko.md"), { lang: "ko" });
  const missingTop = SECTIONS.filter((s) => !en.some((x) => x.title === s));
  const problems = [...missingTop.map((s) => `README.md has no "## ${s}" section (update SECTIONS in tools/check-docs.mjs)`), ...compareDocs(en, ko)];
  if (problems.length) {
    console.error("[check-docs] docs/api.ko.md differs from README.md:");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log(`[check-docs] docs/api.ko.md matches README.md (${en.length} sections).`);
}
