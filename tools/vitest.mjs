// vitest 실행기.
// Windows에서 작업 경로가 소문자 드라이브(c:\...)이면 vitest가 자기 모듈을
// C:\ 경로와 c:\ 경로로 두 번 불러와 "Vitest failed to find the runner"로
// 모든 테스트 파일이 실패한다. 드라이브 문자를 대문자로 맞춘 뒤 vitest를 띄운다.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const upperDrive = (p) => p.replace(/^[a-z]:/, (d) => d.toUpperCase());
const root = upperDrive(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const require = createRequire(path.join(root, "package.json"));
const cli = upperDrive(path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs"));

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
