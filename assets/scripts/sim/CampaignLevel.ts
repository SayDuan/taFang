/**
 * 60 关共用的数据入口：关卡号决定地图号、地区图集、音乐、浮冰和雪地装饰。
 * 不要为某一关开分支，也不要手写 60 个场景。
 * 第 1 到 10 关地图号等于关卡号；第 11 关起地图号 = 关卡号 + 3。
 * td_map_11 / td_map_12 / td_map_13 不进任何关。
 */
import { regionMusicForLevel, DEFAULT_REGION_MUSIC, type RegionMusicRow } from './SoundTable';

export const TOTAL_LEVELS = 60;
export const LEVELS_PER_REGION = 10;

export const SPOT_CHECK_LEVELS = [1, 6, 8, 10, 11, 17, 21, 31, 41, 51, 60] as const;
export const SPOT_CHECK_MAP_IDS = [1, 6, 8, 10, 14, 20, 24, 34, 44, 54, 63] as const;

/** 字节 76 是草（灌木 e_1x1_bush），达科他和阿拉斯加换成雪树。 */
export const GRASS_BYTE = 76;
export const ROCK_A_BYTE = 69;
export const ROCK_B_BYTE = 70;
export const DESERT_GRASS_FILE = 'decor/e_1x1_bush';
export const SNOW_GRASS_FILE = 'decor/e_1x1_tree_snow';
export const DESERT_ROCK_A_FILE = 'decor/e_1x1_rocks_a';
export const DESERT_ROCK_B_FILE = 'decor/e_1x1_rocks_b';
export const SNOW_ROCK_A_FILE = 'decor/e_1x1_rocks_snow_a';
export const SNOW_ROCK_B_FILE = 'decor/e_1x1_rocks_snow_b';

export interface RegionDef {
    index: number;
    name: string;
    firstLevel: number;
    lastLevel: number;
    bundle: 'new-mexico' | 'mississippi' | 'oregon' | 'dakota' | 'nevada' | 'alaska';
    prefix: 'tiles_' | 'miss_tiles_' | 'oregon_dakota_tiles_';
    ice: boolean;
    snowDecor: boolean;
}

export const REGION_DEFS: readonly RegionDef[] = [
    { index: 0, name: '新墨西哥', firstLevel: 1, lastLevel: 10, bundle: 'new-mexico', prefix: 'tiles_', ice: false, snowDecor: false },
    { index: 1, name: '密西西比', firstLevel: 11, lastLevel: 20, bundle: 'mississippi', prefix: 'miss_tiles_', ice: false, snowDecor: false },
    { index: 2, name: '俄勒冈州', firstLevel: 21, lastLevel: 30, bundle: 'oregon', prefix: 'miss_tiles_', ice: false, snowDecor: false },
    { index: 3, name: '达科塔', firstLevel: 31, lastLevel: 40, bundle: 'dakota', prefix: 'oregon_dakota_tiles_', ice: false, snowDecor: true },
    { index: 4, name: '内华达', firstLevel: 41, lastLevel: 50, bundle: 'nevada', prefix: 'tiles_', ice: false, snowDecor: false },
    { index: 5, name: '阿拉斯加', firstLevel: 51, lastLevel: 60, bundle: 'alaska', prefix: 'oregon_dakota_tiles_', ice: true, snowDecor: true },
];

export interface RegionPack {
    /** 1 到 60。 */
    level: number;
    /** 例如 td_map_01、td_map_14。 */
    mapName: string;
    /** 地图号，第 60 关是 63。 */
    mapId: number;
    /** 地区资源包名：new-mexico、mississippi 等。 */
    bundle: RegionDef['bundle'];
    /** 地面图前缀：tiles_、miss_tiles_、oregon_dakota_tiles_。 */
    prefix: RegionDef['prefix'];
    regionName: string;
    regionIndex: number;
    /** 只有阿拉斯加（第 51 关起）才画浮冰。 */
    ice: boolean;
    /** 树和石头是否换雪地那套（达科他、阿拉斯加）。草是字节 76。 */
    snowDecor: boolean;
    /** 地区循环音乐，按 地区音乐.tsv。 */
    music: string[];
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

/** 第 1 到 10 关用地图同号，第 11 关起用关卡号加 3。不要把 td_map_11 当成第 11 关。 */
export function mapIdForLevel(level: number): number {
    return level <= 10 ? level : level + 3;
}

export function mapNameForLevel(level: number): string {
    return `td_map_${pad2(mapIdForLevel(level))}`;
}

export function regionDefForLevel(level: number): RegionDef {
    const found = REGION_DEFS.find((r) => level >= r.firstLevel && level <= r.lastLevel);
    if (found) {
        return found;
    }
    if (level < 1) {
        return REGION_DEFS[0];
    }
    return REGION_DEFS[REGION_DEFS.length - 1];
}

/**
 * 官方地图尺寸。第 1 关 17×17，第 2 关 20×18，第 3 关 22×17，
 * 第 6、8 关 17×24，其余第 4 关起都是 32×24。
 */
export function officialMapSize(level: number): { cols: number; rows: number } {
    if (level === 1) {
        return { cols: 17, rows: 17 };
    }
    if (level === 2) {
        return { cols: 20, rows: 18 };
    }
    if (level === 3) {
        return { cols: 22, rows: 17 };
    }
    if (level === 6 || level === 8) {
        return { cols: 17, rows: 24 };
    }
    return { cols: 32, rows: 24 };
}

export function packForLevel(level: number, musicRows: readonly RegionMusicRow[] = DEFAULT_REGION_MUSIC): RegionPack {
    const def = regionDefForLevel(level);
    const mapId = mapIdForLevel(level);
    return {
        level,
        mapId,
        mapName: mapNameForLevel(level),
        bundle: def.bundle,
        prefix: def.prefix,
        regionName: def.name,
        regionIndex: def.index,
        ice: def.ice,
        snowDecor: def.snowDecor,
        music: regionMusicForLevel(level, musicRows),
    };
}

/** 第 51 关起（阿拉斯加）按官方规则画浮冰：背景 160–162 用 tiles_icefloes，列 = 值减 160。 */
export function iceEnabledForLevel(level: number): boolean {
    return regionDefForLevel(level).ice;
}

export function snowDecorForLevel(level: number): boolean {
    return regionDefForLevel(level).snowDecor;
}

/** 达科他和阿拉斯加：草和两块石头换雪地图，枯树和仙人掌不换。 */
export function snowDecorFile(byte: number, snowDecor: boolean): string | null {
    if (byte === GRASS_BYTE) {
        return snowDecor ? SNOW_GRASS_FILE : DESERT_GRASS_FILE;
    }
    if (byte === ROCK_A_BYTE) {
        return snowDecor ? SNOW_ROCK_A_FILE : DESERT_ROCK_A_FILE;
    }
    if (byte === ROCK_B_BYTE) {
        return snowDecor ? SNOW_ROCK_B_FILE : DESERT_ROCK_B_FILE;
    }
    return null;
}

/** 关卡表里「赌徒时间」缺列或空单元格时，这一关没有赌徒。第 17 关就是这样。 */
export function canUseGamblerTime(gamblerTime: number | undefined | null): boolean {
    return gamblerTime != null && Number.isFinite(gamblerTime) && gamblerTime > 0;
}

/** 验收用：把 1/11/21/31/41/51 关的图集对照打到控制台。 */
export function logPackAcceptance(): void {
    for (const level of [1, 11, 21, 31, 41, 51]) {
        const pack = packForLevel(level);
        const extra = pack.ice ? '，加浮冰' : pack.snowDecor ? '，树和石头换雪地' : '';
        console.log(`[Terrain] 第${level}关 ${pack.mapName} 图集 ${pack.prefix} 包 ${pack.bundle}${extra}`);
    }
}

export { regionMusicForLevel };
