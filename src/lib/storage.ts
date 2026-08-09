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

export function getLocalStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {}
  if (!memoryStorage) {
    memoryStorage = createMemoryStorage();
  }
  return memoryStorage;
}
