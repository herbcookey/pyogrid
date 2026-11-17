// ESLint 설정 (flat config). 서식은 Prettier가 맡으므로 서식 규칙은 eslint-config-prettier로 끈다.
// npm run lint가 ESLint와 Prettier 검사를 함께 돌린다.
import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist/", "ref/", "node_modules/", "test-results/", "playwright-report/", "coverage/", "_site/", "site/"] },
  js.configs.recommended,
  {
    rules: {
      // catch (e) {}의 e와 _로 시작하는 인자(쓰지 않는다는 표시)는 이 저장소의 관례라 허용한다
      "no-unused-vars": ["error", { caughtErrors: "none", argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // 라이브러리: 브라우저에서 도는 ES 모듈
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.browser },
  },
  {
    // 도구·설정 파일: node. Playwright의 page.evaluate 안은 브라우저에서 돌아서 브라우저 전역도 둔다
    files: ["tools/**/*.mjs", "*.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
  },
  {
    // 단위 테스트는 jsdom(브라우저 전역) + node, e2e는 node에서 돌고 page.evaluate 안은 브라우저에서 돈다
    files: ["test/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser, ...globals.node } },
  },
  {
    // 데모 공통 스크립트: <script>로 불러오는 전역 스크립트
    files: ["demo/**/*.js"],
    languageOptions: { ecmaVersion: 2020, sourceType: "script", globals: { ...globals.browser, PyoGrid: "readonly", XLSX: "readonly" } },
  },
  {
    // ESLint를 넣을 때 이미 있던 지적. 코드를 고치지 않고 이 파일들만 경고로 둔다. 정리하면 이 블록을 지운다.
    //   src/grid.js: JSDoc 타입에만 쓰는 import CellRange, FilterPopup (grid.d.ts가 이 이름으로 import하므로 typedef로 바꾸지 않는다)
    //   test/unit/grid.test.js: 쓰지 않는 콜백 인자 r
    files: ["src/grid.js", "test/unit/grid.test.js"],
    rules: { "no-unused-vars": ["warn", { caughtErrors: "none", argsIgnorePattern: "^_" }] },
  },
  {
    //   문자 집합 끝의 \- (/[0-9.\-]/): 지워도 뜻은 같다
    files: ["src/features/editing.js", "src/features/view.js"],
    rules: { "no-useless-escape": "warn" },
  },
  prettier,
];
