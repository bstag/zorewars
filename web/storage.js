// localStorage as JSON, tolerant of private windows and blocked storage.
export function safeGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
