import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * Node 22 defines a global `localStorage` that is unavailable without
 * --localstorage-file, and it shadows the jsdom one. Anything reading storage
 * then throws in tests while working perfectly in a browser, so install a
 * plain in-memory implementation over the top.
 */
const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
  key: (index) => [...store.keys()][index] ?? null,
  removeItem: (key) => void store.delete(key),
  setItem: (key, value) => void store.set(key, String(value)),
};

for (const target of [globalThis, window]) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    writable: true,
    value: memoryStorage,
  });
}
