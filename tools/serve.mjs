// 데모·테스트용 정적 서버. 저장소 루트를 / 로 내보낸다.
// 사용법: node tools/serve.mjs [--port 5179]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 5179;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** URL 경로 → 저장소 안의 파일. 저장소 밖이면 null */
function resolve(urlPath) {
  const p = decodeURIComponent(urlPath.split("?")[0]);
  const full = path.resolve(root, "." + p);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

http
  .createServer((req, res) => {
    let file = resolve(req.url);
    if (!file) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/demo/`));
