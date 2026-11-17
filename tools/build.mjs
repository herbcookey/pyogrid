// dist/pyogrid.js (IIFE, 전역 PyoGrid), pyogrid.min.js, pyogrid.esm.js, pyogrid.css, pyogrid.min.css
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const banner = `/*! pyogrid ${pkg.version} | MIT | 외부 의존성 없음 */`;
const out = (f) => path.join(root, "dist", f);

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });

const common = { bundle: true, target: "es2020", legalComments: "none", banner: { js: banner }, charset: "utf8" };

await esbuild.build({ ...common, entryPoints: [path.join(root, "src/global.js")], format: "iife", outfile: out("pyogrid.js") });
await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "src/global.js")],
  format: "iife",
  minify: true,
  sourcemap: true,
  outfile: out("pyogrid.min.js"),
});
await esbuild.build({ ...common, entryPoints: [path.join(root, "src/index.js")], format: "esm", outfile: out("pyogrid.esm.js") });
await esbuild.build({
  entryPoints: [path.join(root, "src/css/pyogrid.css")],
  bundle: true,
  banner: { css: banner },
  outfile: out("pyogrid.css"),
  charset: "utf8",
});
await esbuild.build({
  entryPoints: [path.join(root, "src/css/pyogrid.css")],
  bundle: true,
  minify: true,
  banner: { css: banner },
  outfile: out("pyogrid.min.css"),
  charset: "utf8",
});

for (const f of fs.readdirSync(path.join(root, "dist"))) {
  const full = out(f);
  if (fs.statSync(full).isDirectory()) continue;
  const size = fs.statSync(full).size;
  console.log(`dist/${f.padEnd(22)} ${(size / 1024).toFixed(1)} KB`);
}

// 타입 선언 (dist/types). 다른 프로젝트에서 ESM으로 쓸 때 자동 완성용
const { execFileSync } = await import("node:child_process");
try {
  execFileSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "-p", path.join(root, "tsconfig.types.json")], { stdio: "inherit" });
  console.log("dist/types/                 .d.ts");
} catch (e) {
  console.error("타입 선언 생성 실패");
  process.exitCode = 1;
}
