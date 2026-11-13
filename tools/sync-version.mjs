// package.json의 version을 손으로 적은 곳에 맞춘다.
//   node tools/sync-version.mjs          src/index.js와 README.md를 고친다 (npm version이 부른다)
//   node tools/sync-version.mjs --check  다르면 실패만 한다 (npm publish 전에 부른다)
// README의 CDN 주소(@0.8 같은 앞 두 자리)는 사용법이 바뀌는 버전에서 직접 바꾼다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const check = process.argv.includes("--check");

const targets = [
  { file: "src/index.js", re: /^(export const version = ")([^"]+)(";)$/m },
  { file: "README.md", re: /^(> Version )(\S+)( ·)/m },
];

let wrong = 0;
for (const t of targets) {
  const full = path.join(root, t.file);
  const text = fs.readFileSync(full, "utf8");
  const m = text.match(t.re);
  if (!m) {
    console.error(`[sync-version] ${t.file}: 버전 줄을 찾지 못했습니다 (${t.re})`);
    process.exit(1);
  }
  if (m[2] === version) continue;
  if (check) {
    console.error(`[sync-version] ${t.file}: ${m[2]} (package.json은 ${version})`);
    wrong++;
    continue;
  }
  fs.writeFileSync(full, text.replace(t.re, `$1${version}$3`));
  console.log(`[sync-version] ${t.file}: ${m[2]} → ${version}`);
}

if (wrong) {
  console.error("[sync-version] 버전이 맞지 않습니다. node tools/sync-version.mjs 로 맞추세요.");
  process.exit(1);
}
