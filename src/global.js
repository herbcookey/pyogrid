// @ts-check
// <script> 태그용 진입점: 전역 PyoGrid를 만든다.
import * as api from "./index.js";

const PyoGrid = /** @type {any} */ (api.PyoGrid);
PyoGrid.version = api.version;
PyoGrid.escapeHtml = api.escapeHtml;
PyoGrid.sortRows = api.sortRows;
PyoGrid.formatNumber = api.formatNumber;
PyoGrid.editors = api.editorTypes;
PyoGrid.collectors = api.userCollectors;
PyoGrid.util = { getValue: api.getValue, setValue: api.setValue, parseKeyPath: api.parseKeyPath, toNumber: api.toNumber };
/** @type {any} */ (window).PyoGrid = PyoGrid;
