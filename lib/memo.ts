import "server-only";

/**
 * Tiny in-memory cache for data read on every page (text edits, images, business info).
 * Admin saves call `.clear()`, so changes show at once on this server; other server
 * instances pick them up within `ttlMs`.
 */
export function memo<K, V>(ttlMs: number, load: (key: K) => Promise<V>) {
  const entries = new Map<K, { at: number; value: Promise<V> }>();
  return {
    get(key: K): Promise<V> {
      const hit = entries.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      const value = load(key);
      entries.set(key, { at: Date.now(), value });
      // Never cache a failure (e.g. database down): the next request tries again.
      value.catch(() => entries.delete(key));
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}
