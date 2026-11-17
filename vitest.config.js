import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/unit/**/*.test.js"],
    // jsdom 환경을 파일마다 새로 띄우므로, CPU 수만큼 동시에 띄우면
    // 다른 프로세스가 많은 PC에서 환경 시작이 밀려 전부 실패할 수 있다.
    pool: "threads",
    maxWorkers: 4,
    // 20만 행 테스트처럼 무거운 케이스가 부하 상황에서 5초를 넘길 수 있다.
    testTimeout: 30000,
    hookTimeout: 30000,
    // npm run test:coverage에서만 잰다 (npm run test:unit은 재지 않음). src/만 센다.
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      // 넣을 때(0.9.0 뒤) 잰 값을 소수 첫째 자리에서 내린 것. 이보다 낮아지면 실패한다.
      // 테스트를 더해 올라가면 손으로 올린다 (내리지 않는다).
      thresholds: {
        statements: 91.3,
        branches: 85.2,
        functions: 93.5,
        lines: 94.8,
      },
    },
  },
});
