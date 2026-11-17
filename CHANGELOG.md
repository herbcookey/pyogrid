# Changelog

All notable changes to pyogrid. Versions follow [semver](https://semver.org/); before 1.0, a minor release (0.x.0) may include breaking changes, which are listed first.

## Unreleased

The JavaScript API only gains new options, methods, and fields (see Added and Changed); the TypeScript declarations are more precise. One input bug is fixed (see Fixed).

### Type changes that can show new compile errors

TypeScript code that only uses what the README documents keeps compiling. These now fail to compile, because the types used to be `any` or `Function`:

- Reading a property an event doesn't have, such as `e.foo` in a `change` handler.
- A `formatter`, `cellClass`, `headerClass`, `editor.disabled`, or `rowClass` function whose parameter type doesn't match what the grid passes.

### Added

- **Typed rows.** `PyoGrid<Row>` takes the row type (default `any`, so existing code compiles as before). Methods that take or return rows use it: `setData`, `getRows`, `getAllRows`, `getRow`, `getViewRows`, `getSelectedRows`, `getModifiedRows`, `getAddedRows`, `getDeletedRows`, `addRow`, `removeRows`, `deleteRows`, `replaceRow`, `setValue`, `setValues`, `toggleNode`, `getTreeInfo`, and `selectAll`'s filter. `ColumnDef<Row>` types `c.row` in `formatter`, `cellClass`, and `editor.disabled`, and `GridOptions<Row>` types `rowClass`.
- **Typed events.** `GridEvents<Row>` lists every event and its argument, taken from the grid's own `emit` calls. `grid.on("change", (e) => e.row.SKU)` infers `e`. Event names that aren't in the list are still accepted.
- **Accessibility.** The grid has `aria-rowcount` and `aria-colcount`; rendered rows have `aria-rowindex` and cells `aria-colindex` counted from the start of the grid, also while virtual scrolling. Automated checks (axe) pass; NVDA and VoiceOver have not been checked on real devices yet. The input box's `aria-activedescendant` points at the focused cell. Header, footer, and subtotal rows use `role="row"` and `role="gridcell"`, and checkboxes have names. See [Accessibility](README.md#accessibility).
- **Condition filters.** `setFilterCondition(key, condition)` and `getFilterConditions()` filter a column by text (`contains`, `startsWith`, `equals`, `notEquals`), number (`eq`, `ne`, `gt`, `ge`, `lt`, `le`, `between`), or date range. They work together with the value list (both must pass). Dates are compared as `"yyyy-MM-dd"` text, so time zones can't move a value to another day. The `filterConditions` option (default `false`) shows a condition section in the header filter popup; column options `filterType` and `filterConditions` choose the kind of condition or hide the section. `clearFilters()` and the popup's Clear also remove conditions. New `messages` keys: `filterCondition`, `filterNoCondition`, `condContains`, `condStartsWith`, `condEquals`, `condNotEquals`, `condGt`, `condGe`, `condLt`, `condLe`, `condBetween`, `condValue`, `condFrom`, `condTo` (English and Korean). Type export `FilterCondition`. See [Conditions](README.md#conditions).
- **Undoing row changes.** `addRow`, `deleteRows`, and `removeRows` take `{ undoable: true }` to record the call as one Ctrl+Z step (by default nothing changes: calls from code aren't recorded). Undoing a delete puts the rows back where they were, out of `getDeletedRows()`, with their marker keys and tree descendants; undoing an add takes the rows out, and redo puts them back at the same place. Rows your code changed in between are skipped, and a step with no row left is dropped so Ctrl+Z goes on to the step before it. After `clearModified()` or `clearDeleted()` without `acceptChanges()`, undo keeps `getChanges()` correct. New `messages` keys `undoneRows` and `redoneRows`, and `actions.addRow`, `actions.deleteRows`, `actions.removeRows` (English and Korean). See [Undoing row changes](README.md#undoing-row-changes).
- **Column reordering.** `moveColumn(column, toIndex)`, `getColumnOrder()`, and `setColumnOrder(keys | null)` change the screen order of columns without touching the definitions: `getColumns()`, group definitions, `footSum`, and `grouping.columns` stay as passed. A leaf moves within its group and a group within its parent; nothing crosses the frozen edge; columns without a `key` and columns with the new `reorderable: false` keep their place. Sort, filters, user-resized widths, and the current cell follow the column. Footer and subtotal cells are matched to columns in definition order and drawn as pieces in the current order, with the text in the leftmost piece. With the new `columnReorder` option (default `false`), headers can be dragged (mouse and pen; auto-scrolls near the edges; Esc cancels) and Alt+Shift+←/→ moves the current cell's column. New event `columnmove {column, from, to, order}`. With `stateKey` the order is saved too; values saved by earlier versions still load, and `resetState()` clears the order. See [Reordering columns](README.md#reordering-columns).
- `getChanges()` returns `{added, modified, deleted}` for saving, as shallow copies of the rows without the grid's marker keys (`__selected__`, `__modified__`, `__added__`, `__deleted__`, or the names set in `selectedKey`, `modifiedKey`, `addedKey`, and `deletedKey`). `modified` leaves out added rows. `cleanRow(row)` copies one row the same way (a value that isn't an object is returned as it is). The rows in the grid are not changed, and `getModifiedRows()` and the other getters work as before.
- Type exports from `pyogrid`: `GridOptions`, `ColumnDef`, `ColumnEditor`, `CellContext`, `GridCellInfo`, `GridEvents`, `GridClickEvent`, `ViewRow`, `GroupingRow`, `AppliedChange`, `RangeInfo`, `SortItem`, `SortCompare`, `PageInfo`. See [TypeScript](README.md#typescript).

### Changed

- The `rowsadd`, `rowsremove`, and `rowsdelete` events have a new `source` field: `"api"` for method calls, `"undo"` or `"redo"` when Ctrl+Z / Ctrl+Y moved the rows. Existing fields are unchanged.
- The `filterchange` event has a new `conditions` field (the same as `getFilterConditions()`), so its payload is now `{filters, conditions, count}`. Existing fields are unchanged. Code that compares the whole payload exactly will see the new field.
- `setFilter(key, null)` removes only that column's value list; a condition set with `setFilterCondition` stays. Without conditions this is the same as before.
- **`role="grid"` moved from the outer `.pyo` element to `.pyo-canvas`** (the element that holds only the header, body, and footer rows), so the input box and the bottom bar are no longer inside the grid role. Header cells are now wrapped in `div.pyo-hrow` row elements inside the frozen and scrolling header boxes. Layout is unchanged. Code that looked up `[role="grid"]` or walked the header's DOM may need updating; the DOM structure is not covered by Stability.

### Performance

- Horizontal scrolling no longer rebuilds every rendered row when the visible column range changes. Each row drops the cells that left and adds the ones that came in; frozen columns and group subtotal rows are untouched. With 240 columns, rendering a horizontal scroll step went from about 4 ms to 1 ms in Chrome, and the 95th-percentile frame time from 28 ms to 17 ms.

### Fixed

- With an IME that sends the confirming key again after composition ends (macOS), pressing Enter, Tab, ↑, or ↓ to finish a word could be handled twice when saving was slow (for example, a `change` handler taking 100 ms): the cell was saved and the next cell started editing. The repeat is now detected by the events' `timeStamp`, so the time spent saving no longer counts.

### Documentation

- README [Stability](README.md#stability) says that adding a field to an event payload or a returned object is not a breaking change; renaming, removing, or changing the type or meaning of an existing field is. README.ko.md has the same rule in its summary.
- `CONTRIBUTING.md` and GitHub issue forms for bug reports and feature requests.
- `docs/a11y-manual-check.md`: what to check by hand with NVDA and VoiceOver.
- `demo/input-log.html` logs the grid input's keyboard, composition, and input events for checking IME input by hand; `docs/ime-manual-check.md` is the checklist for macOS and Windows.
- `docs/api.ko.md`: the Grid options, Column options, Methods, and Events sections in Korean. README.ko.md links to it. `npm run docs:check` (also in CI) fails when its sections, table names, row counts, or code blocks no longer match README.md.
- README has a new [Stability](README.md#stability) section: what is covered between releases (documented options, methods, events, `messages` keys, CSS custom properties, and row marker keys), what is not (`_` members, DOM structure and `pyo-*` classes, undocumented exports, the shape of saved `localStorage` state), and the version rules before 1.0. README.ko.md has a summary.
- `docs/api-surface.md` lists every export, method, property, option, and event, and whether the README documents it. `docs/roadmap-1.0.md` lists what has to happen before 1.0, including the undocumented exports planned for removal (none are removed yet).

### Internal

- `src/grid.js` is split into modules under `src/grid/` (data, selection, values, layout, render). `PyoGrid` keeps every documented method; the class methods now call the module functions.
- Unit and e2e tests are grouped by feature (`selection`, `editing`, `clipboard-undo`, `filter`, `summary`, ...) instead of by development stage. Tests that were missing for documented methods were added: `getActiveCell`, `selectRowRange`, `clearHistory`, `copy`, `cut`, `getColumns`, `setHeight`, `setPage`, `off`, and `clearDeleted`.
- Some undocumented internal `_` methods were removed from `PyoGrid` (28 that nothing called from outside their module, such as `_createRow`, `_cellHtml`, and `_trackModified`). Members starting with `_` are not covered by [Stability](README.md#stability).
- `test/unit/api-surface.test.js` pins the names of the `src/index.js` exports, `PyoGrid` static properties, public `PyoGrid.prototype` methods, default option keys, and emitted events.
- `deprecate(id, message)` in `src/util.js` logs a `console.warn` once per id. It is not exported and not used yet.
- e2e tests run [axe](https://github.com/dequelabs/axe-core) (WCAG 2.1 A and AA rules) on every demo page in Chrome, Firefox, and WebKit (`test/e2e/a11y.spec.js`).
- `npm run typecheck:types` checks `test/types/usage.test-d.ts` against the built `dist/types` with `strict: true`. It runs in `test:all` and CI.
- ESLint and Prettier (`npm run lint`, `npm run format`), set up to match the existing code. Lint runs in `test:all` and CI. The one formatting-only commit is listed in `.git-blame-ignore-revs`.
- Coverage: `npm run test:coverage` measures `src/` with V8. CI runs the unit tests this way, shows the numbers in the job summary, and fails if they drop below the thresholds in `vitest.config.js` (set to the current numbers: statements 91.3%, branches 85.2%, functions 93.5%, lines 94.8%).
- Release workflow (`.github/workflows/release.yml`): pushing a `v*` tag checks the version and CHANGELOG, runs the whole test workflow, stages the package on npm through trusted publishing, and creates a GitHub Release from the CHANGELOG section. Setup steps are in `docs/releasing.md`.
- Performance check: `npm run perf` times `demo/big.html` (50,000 rows × 30 columns) five times and compares the medians with `tools/perf-baseline.json`. CI runs it as a separate job that only warns, because CI machines vary a lot. `tools/probe-big.mjs` and `tools/probe-frames.mjs` work as before and now also export their measuring functions.
- `npm run typecheck` also runs `tsconfig.strict.json`, which turns on `strictNullChecks` for `src/util.js`, `src/core/*.js`, `src/editors/*.js`, and the `src/features/` files that don't import the grid (`history`, `pagebar`, `state`, `clipboard`, `filter`, `view`). The remaining files are listed in `docs/roadmap-1.0.md`.

## 0.9.0

### Breaking changes

- **Formatter output, header labels, and footer/subtotal labels are inserted as text by default.** A formatter that returns HTML now needs `html: true` on its column (or footer cell). `cellClass`, `headerClass`, and `className` values are always escaped.
- **Text sorting follows the grid's `locale`.** With the default `"en"`, Latin text sorts before Korean. Set `locale: "ko"` to keep the Korean order.
- **Korean status text** is now `"1 - 15 / 300"` (and `"전체 1,234"` with server paging). Change it with `messages.status` / `messages.statusTotal`.
- **`avg`, `min`, and `max` in footer totals skip empty cells** instead of counting them as 0. `avg` is empty when a column has no numbers.
- **Rows added with `addRow` and deleted before saving are not recorded** in `getDeletedRows()`.

### Added

- `addedKey` option (`"__added__"`) and `getAddedRows()` to tell added rows from modified ones.
- `setValue` and `setValues` accept a row object as well as a view index, so they reach rows hidden by filters and collapsed tree children.
- `html` option on columns and footer cells.
- `editor.config.valueFormat` for the date editor (for example `"yyyyMMdd"`, or a function).
- `messages.status` and `messages.statusTotal`; numbers use the locale's separators.
- `formatNumber(n, locale)` and `sortRows(rows, sort, compare, locale)` take a locale.
- CI workflow that runs the typecheck, unit tests, and e2e tests in Chrome, Firefox, and WebKit. `npm publish` also runs the Chrome e2e tests.

### Fixed

- Rows added with `addRow` stay visible under header filters until saved, and `focus: true` reaches them.
- Footer sums no longer show floating-point noise (`0.1 + 0.2` shows `0.3`); `money` shows `0.1 + 0.7` as `0.8`.
- Undo on rows hidden by a filter now fires `change` and updates the footer.
- An exception in an event handler no longer stops redraws, undo recording, or `batchchange`.
- Popups follow page and modal scrolling; the filter popup opens above when there is no room below.
- Enter on the filter popup's buttons presses that button; Enter during IME composition is ignored.
- OK in the filter popup is disabled when nothing is checked.
- Tab on the last cell (and Shift+Tab on the first) moves focus out of the grid.
- Editing a group key moves the row to its new group.
- Tree parent and child keys match across types (`1` and `"1"`).

### Performance

- Sorting converts each value once before comparing (200,000 rows, two keys: about 3× faster).
- Merged-cell blocks are recalculated only when rows, columns, or merged values change (editing one cell on 50,000 rows: 7 ms → 0.1 ms).
- The scrollbar width is measured once per window size.
- Copy builds the clipboard text once.
- Excel export reuses one HTML parser (20,000 rows: about 3× faster).

## 0.8.0

### Breaking changes

- **Built-in UI text is English by default.** Add `locale: "ko"` to keep Korean.

### Added

- `locale` and `messages` options, `PyoGrid.locales` for adding languages.
- Firefox and Safari (WebKit) support; e2e tests run in Chrome, Firefox, and WebKit.

## 0.7.2

- English README on npm, Korean README in `README.ko.md`.

## 0.7.1

- Repository, homepage, and issue links in `package.json`.

## 0.7.0

- First public release.
