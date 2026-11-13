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
  },
});
