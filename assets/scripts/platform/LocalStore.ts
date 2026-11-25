/**
 * 本地存档后端。编辑器里走 localStorage，没有存储时退回内存。
 * 不依赖 Creator。战斗中途档的字段和读写仍在 sim/SaveGame。
 */
export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
    private readonly data = new Map<string, string>();

    getItem(key: string): string | null {
        return this.data.has(key) ? this.data.get(key)! : null;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }

    removeItem(key: string): void {
        this.data.delete(key);
    }

    clear(): void {
        this.data.clear();
    }
}

/** 编辑器用 Cocos sys.localStorage 或浏览器 localStorage；没有时退回内存。 */
export function createLocalStore(storage?: KeyValueStore | null): KeyValueStore {
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
        return storage;
    }
    const globalObj = globalThis as unknown as { localStorage?: KeyValueStore };
    if (globalObj.localStorage && typeof globalObj.localStorage.getItem === 'function') {
        return globalObj.localStorage;
    }
    return new MemoryStore();
}
