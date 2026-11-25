/**
 * 屏幕常亮。选项键名 wakeLock，默认开。
 * 编辑器和没有设备时走到这一行但不报错。不依赖 Creator。
 */

export interface WakeLockBackend {
    setKeepAwake(enabled: boolean): void;
}

let backend: WakeLockBackend | null = null;
let lastApplied: boolean | null = null;
let callCount = 0;

export function hookWakeLockBackend(next: WakeLockBackend | null): void {
    backend = next;
}

export function lastWakeLock(): boolean | null {
    return lastApplied;
}

export function wakeLockCalls(): number {
    return callCount;
}

export function resetWakeLockForTests(): void {
    backend = null;
    lastApplied = null;
    callCount = 0;
}

/**
 * 打开或关闭常亮。没有后端、没有 Wake Lock API、或接口抛错时都吞掉。
 * 只要走到这里，lastWakeLock 就会被记下。
 */
export function applyWakeLock(enabled: boolean): boolean {
    lastApplied = enabled;
    callCount += 1;
    try {
        if (backend) {
            backend.setKeepAwake(enabled);
            return true;
        }
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        const api = nav
            ? (nav as { wakeLock?: { request?: (type: string) => Promise<unknown> } }).wakeLock
            : undefined;
        if (enabled && api && typeof api.request === 'function') {
            void Promise.resolve(api.request('screen')).catch(() => undefined);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}
