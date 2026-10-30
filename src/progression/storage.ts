/** LocalStorage wrapper that never throws (private mode, blocked storage, quota). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}
export function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}
