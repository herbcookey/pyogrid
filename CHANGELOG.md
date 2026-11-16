# Changelog

All notable changes to pyogrid. Versions follow [semver](https://semver.org/); before 1.0, a minor release (0.x.0) may include breaking changes, which are listed first.

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
