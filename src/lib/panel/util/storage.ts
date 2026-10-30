/**
 * The browser's localStorage, guarded: where site data is blocked, or on a server, a read
 * answers null and a write keeps nothing.
 *
 * ```ts
 * writeStored('rz-panel-collapsed', 'true');
 * readStored('rz-panel-collapsed'); // 'true', or null where storage is blocked
 * writeStored('rz-open:abc', null); // removes the key
 * ```
 */
export const readStored = (key: string): string | null => {
  // Node 25+ warns on any read of its own `localStorage`: a server reads nothing
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Keeps `value` under `key`, or removes the key for `null`. */
export const writeStored = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage blocked: the choice holds for the visit, it is just not remembered
  }
};
