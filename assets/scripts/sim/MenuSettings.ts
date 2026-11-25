/**
 * 第 20 步选项：声音、振动、屏幕常亮。
 * 键名和默认值按 画面.tsv / UserProfile.loadOptions。不依赖 Creator。
 */
import { KeyValueStore, MemoryStore, createLocalStore } from './SaveGame';
import { applySoundEnabled } from './Sound';
import { applyWakeLock } from '../platform/WakeLock';

export const OPTION_KEY_SOUND = 'sound';
export const OPTION_KEY_WAKE_LOCK = 'wakeLock';
export const OPTION_KEY_VIBRA = 'vibra';

export interface DeviceFlags {
    vibraSupported: boolean;
}

export interface MenuOptions {
    sound: boolean;
    wakeLock: boolean;
    vibra: boolean;
}

/** 默认：声音开、常亮开，振动看这台机器有没有震动器。 */
export function defaultOptions(device: DeviceFlags): MenuOptions {
    return {
        sound: true,
        wakeLock: true,
        vibra: !!device.vibraSupported,
    };
}

export function parseStoredBool(raw: string | null, fallback: boolean): boolean {
    if (raw === null || raw === undefined) {
        return fallback;
    }
    if (raw === '1' || raw === 'true' || raw === 'TRUE') {
        return true;
    }
    if (raw === '0' || raw === 'false' || raw === 'FALSE') {
        return false;
    }
    return fallback;
}

function writeBool(value: boolean): string {
    return value ? 'true' : 'false';
}

export function loadOptions(store: KeyValueStore, device: DeviceFlags): MenuOptions {
    const defaults = defaultOptions(device);
    return {
        sound: parseStoredBool(store.getItem(OPTION_KEY_SOUND), defaults.sound),
        wakeLock: parseStoredBool(store.getItem(OPTION_KEY_WAKE_LOCK), defaults.wakeLock),
        vibra: parseStoredBool(store.getItem(OPTION_KEY_VIBRA), defaults.vibra),
    };
}

export function persistOptions(store: KeyValueStore, options: MenuOptions): void {
    store.setItem(OPTION_KEY_SOUND, writeBool(options.sound));
    store.setItem(OPTION_KEY_WAKE_LOCK, writeBool(options.wakeLock));
    store.setItem(OPTION_KEY_VIBRA, writeBool(options.vibra));
}

export function switchFlag(value: boolean): boolean {
    return !value;
}

/**
 * 可读写的选项会话。改开关后立刻写入 store，并同步声音静音接口。
 */
export class MenuSettings {
    sound: boolean;
    wakeLock: boolean;
    vibra: boolean;
    readonly device: DeviceFlags;

    constructor(
        private readonly store: KeyValueStore,
        device: DeviceFlags,
    ) {
        this.device = { vibraSupported: !!device.vibraSupported };
        const loaded = loadOptions(store, this.device);
        this.sound = loaded.sound;
        this.wakeLock = loaded.wakeLock;
        this.vibra = loaded.vibra;
        applySoundEnabled(this.sound);
        applyWakeLock(this.wakeLock);
    }

    snapshot(): MenuOptions {
        return { sound: this.sound, wakeLock: this.wakeLock, vibra: this.vibra };
    }

    persist(): void {
        persistOptions(this.store, this.snapshot());
    }

    /** 声音按钮和选项里的声音勾共用：同时开关音效和音乐。 */
    switchSound(): boolean {
        this.sound = switchFlag(this.sound);
        this.persist();
        applySoundEnabled(this.sound);
        return this.sound;
    }

    switchWakeLock(): boolean {
        this.wakeLock = switchFlag(this.wakeLock);
        this.persist();
        applyWakeLock(this.wakeLock);
        return this.wakeLock;
    }

    switchVibra(): boolean {
        this.vibra = switchFlag(this.vibra);
        this.persist();
        return this.vibra;
    }

    isSoundEnabled(): boolean {
        return this.sound;
    }

    isWakeLockEnabled(): boolean {
        return this.wakeLock;
    }

    isVibraEnabled(): boolean {
        return this.vibra;
    }

    /** Java：设备没有震动器时隐藏振动开关。 */
    shouldShowVibraSwitch(): boolean {
        return this.device.vibraSupported;
    }
}

export function createMenuSettings(store?: KeyValueStore | null, device: DeviceFlags = { vibraSupported: true }): MenuSettings {
    return new MenuSettings(store ?? createLocalStore(), device);
}

export { MemoryStore, createLocalStore };
