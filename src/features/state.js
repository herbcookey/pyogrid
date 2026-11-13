// @ts-check
/**
 * 컬럼 너비·정렬 기억 (localStorage). 화면 경로 + stateKey 기준.
 * 저장 모양: { widths: { 컬럼키: px }, sort: [{key, dir}] }
 */

/** @param {string|null|undefined} stateKey */
export function storageKey(stateKey) {
  if (!stateKey) return null;
  const path = typeof location !== "undefined" ? location.pathname : "";
  return "pyogrid:" + path + ":" + stateKey;
}

/**
 * @param {string|null} key
 * @returns {{widths: Record<string, number>, sort: {key: string, dir: "asc"|"desc"}[]}|null}
 */
export function loadState(key) {
  if (!key) return null;
  try {
    const s = JSON.parse(window.localStorage.getItem(key) || "null");
    if (!s || typeof s !== "object") return null;
    return { widths: s.widths && typeof s.widths === "object" ? s.widths : {}, sort: Array.isArray(s.sort) ? s.sort : [] };
  } catch (e) {
    return null;
  }
}

/**
 * @param {string|null} key
 * @param {any} state
 */
export function saveState(key, state) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    /* 저장 공간이 없거나 막힌 경우 무시 */
  }
}

/** @param {string|null} key */
export function removeState(key) {
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    /* 무시 */
  }
}
