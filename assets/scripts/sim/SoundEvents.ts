/**
 * 把正式事件接到已有的 Sound 静音接口上，不再另做一套开关。
 * 切关或回主菜单时先停再播，两首不会叠在一起。
 */
import {
    MENU_BACKGROUND_LOOP,
    playSfx,
    setBackgroundLoop,
} from './Sound';
import {
    EVENT_CLIPS,
    officialEventClip,
    officialHitClip,
    officialShotClip,
    regionMusicForLevel,
    type SfxEventName,
} from './SoundTable';

export const CLEAR_BACKGROUND_LOOP = EVENT_CLIPS.clear;

let regionLoops: string[] = [];
let regionLoopIndex = 0;

export function playShotSfx(unitType: number, damageStyle: number, variation?: number): boolean {
    const clip = officialShotClip(unitType, damageStyle, variation ?? pickVariation());
    if (!clip) {
        return false;
    }
    return playSfx(clip);
}

export function playHitSfx(damageStyle: number, variation?: number): boolean {
    const clip = officialHitClip(damageStyle, variation ?? pickVariation());
    if (!clip) {
        return false;
    }
    return playSfx(clip);
}

export function playGameSfx(event: Exclude<SfxEventName, 'shot' | 'hit'>): boolean {
    return playSfx(officialEventClip(event));
}

export function playMenuMusic(): void {
    regionLoops = [];
    regionLoopIndex = 0;
    setBackgroundLoop(MENU_BACKGROUND_LOOP);
}

export function playLevelMusic(level: number, startIndex = 0): string | null {
    regionLoops = regionMusicForLevel(level);
    if (regionLoops.length === 0) {
        return null;
    }
    regionLoopIndex = ((startIndex % regionLoops.length) + regionLoops.length) % regionLoops.length;
    const clip = regionLoops[regionLoopIndex];
    setBackgroundLoop(clip);
    return clip;
}

export function playNextRegionLoop(): string | null {
    if (regionLoops.length === 0) {
        return null;
    }
    regionLoopIndex = (regionLoopIndex + 1) % regionLoops.length;
    const clip = regionLoops[regionLoopIndex];
    setBackgroundLoop(clip);
    return clip;
}

export function playClearMusic(): void {
    setBackgroundLoop(CLEAR_BACKGROUND_LOOP);
}

export function currentRegionLoops(): string[] {
    return regionLoops.slice();
}

export function currentRegionLoopIndex(): number {
    return regionLoopIndex;
}

export function resetMusicDirectorForTests(): void {
    regionLoops = [];
    regionLoopIndex = 0;
}

function pickVariation(): number {
    return Math.random() < 0.5 ? 0 : 1;
}
