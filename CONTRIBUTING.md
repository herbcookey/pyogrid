# Contributing to pyogrid

Thanks for helping. Bug reports, fixes, docs, and translations are all welcome.

## Before you start

- **Bugs:** open an issue with the bug form. A short page or code snippet that shows the problem helps most. Include the pyogrid version and the browser.
- **New features or larger changes:** open an issue first, so we can agree on the approach before you spend time on it. pyogrid has no runtime dependencies and keeps it that way.
- **Security problems:** don't open a public issue. Use "Report a vulnerability" on the repository's Security tab.

## Setup

Node.js 22 or later.

```bash
git clone https://github.com/herbcookey/pyogrid.git
cd pyogrid
npm install
npm run build
npx playwright install firefox webkit   # once, for the Firefox and WebKit e2e tests (Chrome uses your installed Chrome)
npm run demo                            # http://127.0.0.1:5179/demo/
```

The [Development](README.md#development) section of the README lists every script and the source layout. [docs/design.md](docs/design.md) (in Korean) explains why things are built the way they are.

## Making a change

1. **Write a failing test first.** For a bug, add a test that reproduces it and check that it fails before you fix the code. Unit tests are in `test/unit` (vitest + jsdom), browser tests in `test/e2e` (Playwright).
2. **Keep the change focused.** One topic per pull request. Don't mix reformatting or unrelated refactoring into a fix.
3. **Don't change existing tests to make them pass.** If a test has to change, say why in the pull request.
4. **Run the checks:**

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run test:e2e:chrome      # or npm run test:e2e for Chrome, Firefox, and WebKit
   npm run typecheck:types      # after a build, if you changed types
   npm run docs:check           # if you changed the README reference sections
   ```

   CI runs all of these on every pull request, plus coverage (it fails if coverage drops) and a performance check (warning only).

5. **Update the docs.**
   - `CHANGELOG.md`: add a line under "Unreleased". A change that alters existing behavior goes under "Breaking changes".
   - `README.md` is the English reference. If you change an option, column property, method, or event, update the README. `docs/api.ko.md` is the Korean copy of those sections, and `npm run docs:check` fails if its sections or the names in its tables no longer match the README. If you can't write the Korean, say so in the pull request and the maintainer will.
   - The public API is listed in `test/unit/api-surface.test.js` and `docs/api-surface.md`. Adding or removing a name there is a public API change; see [Stability](README.md#stability).

## Style

- Plain JavaScript (ES2020 modules) with JSDoc types and `// @ts-check`. No TypeScript source files.
- Prettier formats `src/`, `tools/`, and the config files (`npm run format`). Tests, demos, and CSS are formatted by hand.
- Code comments and `docs/design.md` are written in Korean. English comments are fine in a pull request; the maintainer may translate them.
- User-facing text in the grid goes through `src/core/locales.js` (English and Korean).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
