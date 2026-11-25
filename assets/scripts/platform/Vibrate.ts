/**
 * 漏人振动。画面.tsv：振动开着时，有人漏出去就震 800 毫秒。
 * 编辑器里至少要走到这一行；没有设备时不报错。不依赖 Creator。
 */

export const LEAK_VIBRATE_MS = 800;

export interface VibrateBackend {
    vibrate(ms: number): void;
}

let backend: VibrateBackend | null = null;
let lastVibrateMs: number | null = null;
let vibrateCallCount = 0;

export function hookVibrateBackend(next: VibrateBackend | null): void {
    backend = next;
}

export function lastVibrate(): number | null {
    return lastVibrateMs;
}

export function vibrateCalls(): number {
    return vibrateCallCount;
}

export function resetVibrateForTests(): void {
    backend = null;
    lastVibrateMs = null;
    vibrateCallCount = 0;
}

/**
 * 调用振动。没有后端、没有 navigator、或设备接口抛错时都吞掉，不往外抛。
 * 只要走到这里，lastVibrate 就会被记下，方便编辑器和自检查这一行有没有执行。
 */
export function vibrate(ms: number): boolean {
    lastVibrateMs = ms;
    vibrateCallCount += 1;
    try {
        if (backend) {
            backend.vibrate(ms);
            return true;
        }
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        const fn = nav && typeof (nav as { vibrate?: (n: number) => boolean }).vibrate === 'function'
            ? (nav as { vibrate: (n: number) => boolean }).vibrate
            : null;
        if (fn) {
            fn.call(nav, ms);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function vibrateIfEnabled(enabled: boolean, ms: number = LEAK_VIBRATE_MS): boolean {
    if (!enabled) {
        return false;
    }
    return vibrate(ms);
}
