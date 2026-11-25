/**
 * 声音开关和静音接口。第 22 步把正式音效和地区音乐接到这套 API 上，不再另做开关。
 * 关掉声音后，按钮音效、战斗音效和背景音乐都静音；再打开会恢复上次的背景循环。
 * 切歌时先停正在播的循环，再开始下一首，两首不会叠在一起。
 * 不依赖 Creator。
 */

export type SoundId = string | number;

/** 0 表示停止正在播放的背景循环，和 Java Sound.setBackgroundLoop(0) 一样。 */
export const BACKGROUND_LOOP_STOP = 0;

export interface SoundBackend {
    playSfx?(id: SoundId): void;
    setBackgroundLoop?(id: SoundId): void;
    stopBackgroundLoop?(): void;
}

let soundEnabled = true;
/** Java 的 currentBackgroundLoop：选中的曲子，关掉声音时不会清掉。 */
let currentLoop: SoundId = BACKGROUND_LOOP_STOP;
/** 当前真正在响的循环。静音或 setBackgroundLoop(0) 时为 0。 */
let musicPlaying: SoundId = BACKGROUND_LOOP_STOP;
let backend: SoundBackend | null = null;
let lastPlayedSfx: SoundId | null = null;
let lastBlockedSfx: SoundId | null = null;

export function isSoundEnabled(): boolean {
    return soundEnabled;
}

export function isSfxMuted(): boolean {
    return !soundEnabled;
}

export function isMusicMuted(): boolean {
    return !soundEnabled;
}

export function getCurrentBackgroundLoop(): SoundId {
    return currentLoop;
}

export function getPlayingBackgroundLoop(): SoundId {
    return musicPlaying;
}

export function lastSfx(): SoundId | null {
    return lastPlayedSfx;
}

export function lastMutedSfx(): SoundId | null {
    return lastBlockedSfx;
}

export function hookSoundBackend(next: SoundBackend | null): void {
    backend = next;
}

function stopPlayingLoop(): void {
    musicPlaying = BACKGROUND_LOOP_STOP;
    backend?.stopBackgroundLoop?.();
}

function startPlayingLoop(id: SoundId): void {
    if (musicPlaying !== BACKGROUND_LOOP_STOP) {
        stopPlayingLoop();
    }
    musicPlaying = id;
    backend?.setBackgroundLoop?.(id);
}

/** 选项或声音按钮改开关时调用。关掉会停 BGM，打开会恢复 currentBackgroundLoop。 */
export function applySoundEnabled(enabled: boolean): void {
    soundEnabled = !!enabled;
    if (!soundEnabled) {
        stopPlayingLoop();
        return;
    }
    if (currentLoop !== BACKGROUND_LOOP_STOP) {
        startPlayingLoop(currentLoop);
    }
}

export function playSfx(id: SoundId = 'button'): boolean {
    if (isSfxMuted()) {
        lastBlockedSfx = id;
        return false;
    }
    lastPlayedSfx = id;
    lastBlockedSfx = null;
    backend?.playSfx?.(id);
    return true;
}

/**
 * 设置或停止背景循环。
 * id 为 0 时只停止正在播放的，不修改 currentBackgroundLoop，这样才能再打开时恢复。
 */
export function setBackgroundLoop(id: SoundId): void {
    if (id === BACKGROUND_LOOP_STOP) {
        stopPlayingLoop();
        return;
    }
    currentLoop = id;
    if (isMusicMuted()) {
        stopPlayingLoop();
        return;
    }
    startPlayingLoop(id);
}

/**
 * 主菜单背景循环用素材 音频/音乐/music_maintheme.ogg 的原名。
 * 同目录还有较短的 music_intro，留给开场，不拿来循环主菜单。
 */
export const MENU_BACKGROUND_LOOP = 'music_maintheme';

export const BUTTON_SFX = 'sound_wood_button';

/**
 * Java 声音按钮：先播按钮音，再切换开关。
 * 把声音关掉的那一下还能听到点击；关掉之后再点就没声了。
 */
export function clickThenToggleSound(toggle: () => boolean): boolean {
    playSfx(BUTTON_SFX);
    const enabled = toggle();
    if (!enabled) {
        setBackgroundLoop(BACKGROUND_LOOP_STOP);
    } else {
        const resume = currentLoop !== BACKGROUND_LOOP_STOP ? currentLoop : MENU_BACKGROUND_LOOP;
        setBackgroundLoop(resume);
    }
    return enabled;
}

export function resetSoundForTests(): void {
    soundEnabled = true;
    currentLoop = BACKGROUND_LOOP_STOP;
    musicPlaying = BACKGROUND_LOOP_STOP;
    backend = null;
    lastPlayedSfx = null;
    lastBlockedSfx = null;
}
