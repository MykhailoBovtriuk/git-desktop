// Storage abstraction that degrades gracefully outside a browser environment
// (Node/jsdom test runs, SSR-like contexts). Without this, touching
// `localStorage` directly throws a ReferenceError and breaks the test suite.

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

let memoryStorage: Storage | undefined;

/**
 * Returns the real `localStorage` when available, otherwise a process-local
 * in-memory fallback. Never throws and never returns undefined, so callers
 * (and Zustand's persist middleware) can use it unconditionally.
 */
export function getLocalStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Accessing localStorage can throw (e.g. disabled storage) — fall through.
  }
  if (!memoryStorage) {
    memoryStorage = createMemoryStorage();
  }
  return memoryStorage;
}
