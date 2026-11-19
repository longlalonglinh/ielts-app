/**
 * Sandbox-resilient Web Storage wrapper.
 * Safely degrades to an in-memory Map when localStorage / sessionStorage is:
 * - undefined (Node.js / SSR / Web Workers)
 * - blocked by strict iframe sandbox / Safari ITP / third-party cookie policies (SecurityError)
 * - full (QuotaExceededError)
 */

const memoryLocal = new Map<string, string>();
const memorySession = new Map<string, string>();

function getNativeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const storage = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

export interface SafeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): void;
  keys(): string[];
}

function createSafeStorage(kind: 'local' | 'session', fallback: Map<string, string>): SafeStorageLike {
  return {
    getItem(key: string): string | null {
      try {
        const native = getNativeStorage(kind);
        if (native) {
          const val = native.getItem(key);
          if (val !== null) return val;
        }
      } catch {
        // Fall through to in-memory fallback
      }
      return fallback.has(key) ? fallback.get(key)! : null;
    },

    setItem(key: string, value: string): boolean {
      const strVal = String(value);
      fallback.set(key, strVal);
      try {
        const native = getNativeStorage(kind);
        if (native) {
          native.setItem(key, strVal);
          return true;
        }
      } catch {
        // SecurityError or QuotaExceededError — retained in memory fallback
      }
      return false;
    },

    removeItem(key: string): void {
      fallback.delete(key);
      try {
        const native = getNativeStorage(kind);
        if (native) {
          native.removeItem(key);
        }
      } catch {
        // Ignore storage errors
      }
    },

    keys(): string[] {
      const keySet = new Set<string>(fallback.keys());
      try {
        const native = getNativeStorage(kind);
        if (native) {
          for (let i = 0; i < native.length; i++) {
            const k = native.key(i);
            if (k !== null) keySet.add(k);
          }
        }
      } catch {
        // Ignore storage errors
      }
      return Array.from(keySet);
    }
  };
}

export const safeLocalStorage = createSafeStorage('local', memoryLocal);
export const safeSessionStorage = createSafeStorage('session', memorySession);

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}
