import { defineConfig } from "@playwright/test";

const PORT = 5179;

export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    // 설치된 Chrome을 쓴다 (브라우저를 따로 내려받지 않음)
    channel: "chrome",
    headless: true,
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1400, height: 900 },
    locale: "ko-KR",
    acceptDownloads: true,
  },
  webServer: {
    command: `node tools/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/demo/`,
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
