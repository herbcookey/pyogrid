import { defineConfig, devices } from "@playwright/test";

const PORT = 5179;

export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    headless: true,
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1400, height: 900 },
    locale: "ko-KR",
    acceptDownloads: true,
  },
  // 한 브라우저만: npx playwright test --project=firefox
  projects: [
    // 설치된 Chrome을 쓴다 (Playwright의 Chromium을 따로 내려받지 않음)
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1400, height: 900 } } },
    // Firefox·WebKit(Safari 엔진)은 Playwright 브라우저: npx playwright install firefox webkit
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1400, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1400, height: 900 } } },
  ],
  webServer: {
    command: `node tools/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/demo/`,
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
