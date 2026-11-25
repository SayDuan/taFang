/**
 * 音效编号和地区音乐对照。文件名用 音频/ 里的原名，不另起名字。
 * 音效对照.tsv 只覆盖开枪编号和搭话；命中、拾取、赌徒牌、失败等按其它正式表和 Java 资源号补全。
 * 不依赖 Creator。
 */

export type SfxEventName =
    | 'shot'
    | 'hit'
    | 'leak'
    | 'pickup'
    | 'cards_collect'
    | 'cards_deal'
    | 'clear'
    | 'fail'
    | 'button'
    | 'wave'
    | 'heal'
    | 'wagon_explode';

export interface SfxIdRow {
    id: number;
    occasion: string;
    files: string[];
    note: string;
}

export interface RegionMusicRow {
    region: string;
    firstLevel: number;
    lastLevel: number;
    loops: string[];
}

/** 音效对照.tsv 里的开枪 / 爆炸 / 治疗编号。同一编号的搭话行不覆盖开枪行。 */
export const SFX_ID_CLIPS: Record<number, string[]> = {
    0: ['sound_revolver', 'sound_revolver2'],
    1: ['sound_cannon', 'sound_cannon2'],
    2: ['sound_fire_arrow', 'sound_fire_arrow2'],
    3: ['sound_gattling_gun', 'sound_gattling_gun2'],
    4: ['sound_shotgun'],
    5: ['sound_rifle'],
    6: ['sound_rocket_launch_1', 'sound_rocket_launch_2'],
    7: ['sound_rocket_explosion_1', 'sound_rocket_explosion_2'],
    8: ['sound_poison_splash_1', 'sound_poison_splash_2'],
    10: ['sound_dynamite'],
    12: ['sound_wagon_explode'],
    13: ['sound_healing_1'],
};

/**
 * 命名事件用的正式文件。
 * 拾取：宝箱.tsv sound_level_up。
 * 赌徒收牌/发牌：画面.tsv sound_cards_collect / sound_cards_deal。
 * 失败：Java playSound(2131034135)，按 raw 字母序对应 sound_dark_bell。
 * 漏人：音效对照和已抽出的 Java 都没有这一行；移民正式文件是 sound_siedler。
 * 过关：Java 只切背景循环 2131034120；按 raw 字母序（从 0x7f050001 起）对应 music_level_won。
 * 按钮：Java 2131034179 = sound_wood_button。
 * 新波次：Java 2131034154 = sound_new_wave。
 */
export const EVENT_CLIPS: Record<Exclude<SfxEventName, 'shot' | 'hit'>, string> = {
    leak: 'sound_siedler',
    pickup: 'sound_level_up',
    cards_collect: 'sound_cards_collect',
    cards_deal: 'sound_cards_deal',
    clear: 'music_level_won',
    fail: 'sound_dark_bell',
    button: 'sound_wood_button',
    wave: 'sound_new_wave',
    heal: 'sound_healing_1',
    wagon_explode: 'sound_wagon_explode',
};

export const DEFAULT_REGION_MUSIC: RegionMusicRow[] = [
    { region: '新墨西哥', firstLevel: 1, lastLevel: 10, loops: ['music_loop2', 'music_loop3', 'music_loop4'] },
    { region: '密西西比', firstLevel: 11, lastLevel: 20, loops: ['music_loop2_mississippi', 'music_loop2', 'music_loop3'] },
    { region: '俄勒冈', firstLevel: 21, lastLevel: 30, loops: ['music_oregon', 'music_loop2', 'music_loop3'] },
    { region: '达科他', firstLevel: 31, lastLevel: 40, loops: ['music_dakota', 'music_loop2', 'music_loop3'] },
    { region: '内华达', firstLevel: 41, lastLevel: 50, loops: ['music_nevada', 'music_loop3', 'music_loop4'] },
    { region: '阿拉斯加', firstLevel: 51, lastLevel: 60, loops: ['music_alaska', 'music_loop2', 'music_loop3'] },
];

const SHOT_ID_OCCASIONS = new Set(['左轮', '加农炮', '火箭箭', '加特林', '猎枪', '步枪', '火箭发射', '火箭爆炸', '毒液', '爆炸', '车被打爆', '治疗']);

export function splitClipNames(raw: string): string[] {
    return raw
        .split(/[/／,，]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export function parseSfxIdTable(text: string): SfxIdRow[] {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
        return [];
    }
    const header = lines[0].split('\t').map((s) => s.trim());
    const iId = header.indexOf('编号');
    const iOcc = header.indexOf('场合');
    const iFile = header.indexOf('文件');
    const iNote = header.indexOf('说明');
    const out: SfxIdRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        const occasion = (iOcc >= 0 ? cells[iOcc] : '').trim();
        if (!SHOT_ID_OCCASIONS.has(occasion)) {
            continue;
        }
        const idRaw = (iId >= 0 ? cells[iId] : '').trim();
        const id = Number.parseInt(idRaw, 10);
        if (!Number.isFinite(id)) {
            continue;
        }
        out.push({
            id,
            occasion,
            files: splitClipNames(iFile >= 0 ? cells[iFile] ?? '' : ''),
            note: (iNote >= 0 ? cells[iNote] : '').trim(),
        });
    }
    return out;
}

/** 用表里的开枪行覆盖内置对照，搭话行已在 parse 时丢掉。 */
export function applySfxIdTable(rows: readonly SfxIdRow[], target: Record<number, string[]> = { ...SFX_ID_CLIPS }): Record<number, string[]> {
    const next = { ...target };
    for (const row of rows) {
        if (row.files.length > 0) {
            next[row.id] = row.files.slice();
        }
    }
    return next;
}

export function parseRegionMusicTable(text: string): RegionMusicRow[] {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
        return [];
    }
    const header = lines[0].split('\t').map((s) => s.trim());
    const iRegion = header.indexOf('地区');
    const iLevel = header.indexOf('关卡');
    const i1 = header.indexOf('循环1');
    const i2 = header.indexOf('循环2');
    const i3 = header.indexOf('循环3');
    const out: RegionMusicRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        const region = (iRegion >= 0 ? cells[iRegion] : '').trim();
        const span = (iLevel >= 0 ? cells[iLevel] : '').trim();
        const m = span.match(/(\d+)\s*-\s*(\d+)/);
        if (!region || !m) {
            continue;
        }
        const loops = [i1, i2, i3]
            .map((idx) => (idx >= 0 ? (cells[idx] ?? '').trim() : ''))
            .filter((s) => s.length > 0);
        out.push({
            region,
            firstLevel: Number(m[1]),
            lastLevel: Number(m[2]),
            loops,
        });
    }
    return out;
}

export function clipsForSfxId(id: number, table: Record<number, string[]> = SFX_ID_CLIPS): string[] {
    return table[id] ?? [];
}

export function pickClip(files: readonly string[], variation = 0): string | null {
    if (!files.length) {
        return null;
    }
    if (files.length === 1) {
        return files[0];
    }
    const i = variation === 1 ? 1 : 0;
    return files[Math.min(i, files.length - 1)];
}

/**
 * 开枪编号。按 瞄准与子弹.tsv / GameObjectShot_initinit：
 * 样式 0：亡命之徒(1)→0，猎枪老人(6)→4，女射手(5)→5，其余→3。
 * 样式 1、2→2。样式 4（加农炮）→1。样式 6→6。样式 3、5 开枪不播，落地再播命中。
 */
export function sfxIdForShot(unitType: number, damageStyle: number): number | null {
    switch (damageStyle) {
        case 0:
            if (unitType === 1) {
                return 0;
            }
            if (unitType === 6) {
                return 4;
            }
            if (unitType === 5) {
                return 5;
            }
            return 3;
        case 1:
        case 2:
            return 2;
        case 4:
            return 1;
        case 6:
            return 6;
        default:
            return null;
    }
}

/** 打中之后的声音：样式 3、4→10，样式 6→7，样式 5→8。直射和箭没有命中音。 */
export function sfxIdForHit(damageStyle: number): number | null {
    if (damageStyle === 3 || damageStyle === 4) {
        return 10;
    }
    if (damageStyle === 6) {
        return 7;
    }
    if (damageStyle === 5) {
        return 8;
    }
    return null;
}

export function officialShotClip(unitType: number, damageStyle: number, variation = 0, table: Record<number, string[]> = SFX_ID_CLIPS): string | null {
    const id = sfxIdForShot(unitType, damageStyle);
    if (id == null) {
        return null;
    }
    return pickClip(clipsForSfxId(id, table), variation);
}

export function officialHitClip(damageStyle: number, variation = 0, table: Record<number, string[]> = SFX_ID_CLIPS): string | null {
    const id = sfxIdForHit(damageStyle);
    if (id == null) {
        return null;
    }
    return pickClip(clipsForSfxId(id, table), variation);
}

export function officialEventClip(event: Exclude<SfxEventName, 'shot' | 'hit'>): string {
    return EVENT_CLIPS[event];
}

export function regionMusicForLevel(level: number, rows: readonly RegionMusicRow[] = DEFAULT_REGION_MUSIC): string[] {
    const row = rows.find((r) => level >= r.firstLevel && level <= r.lastLevel);
    return row ? row.loops.slice() : [];
}

export function regionMusicByName(name: string, rows: readonly RegionMusicRow[] = DEFAULT_REGION_MUSIC): string[] {
    const row = rows.find((r) => r.region === name);
    return row ? row.loops.slice() : [];
}

/** 下一首循环，环状。切地区时从 0 再开始。 */
export function nextLoopIndex(current: number, length: number): number {
    if (length <= 0) {
        return 0;
    }
    return (current + 1) % length;
}

export type CardRevealPhase = 'slide' | 'flip' | 'settle' | 'done';

/** 收牌在翻牌开始时播，发牌在最后一张停稳转入 flip 时播。 */
export function cardRevealSfx(previous: CardRevealPhase | 'none', next: CardRevealPhase): 'cards_collect' | 'cards_deal' | null {
    if (previous === 'none' && (next === 'slide' || next === 'flip')) {
        return 'cards_collect';
    }
    if (previous === 'slide' && next !== 'slide') {
        return 'cards_deal';
    }
    return null;
}

/**
 * 安装路径（保持原名，不要改名）：
 * 把素材 `音频/音效/` 拷到 `assets/resources/audio/音效/`，
 * 把素材 `音频/音乐/` 拷到 `assets/resources/audio/音乐/`。
 * 也可平铺到 `assets/resources/audio/`。扩展名一般是 .ogg。
 */
export const AUDIO_INSTALL_SFX_DIR = 'assets/resources/audio/音效';
export const AUDIO_INSTALL_MUSIC_DIR = 'assets/resources/audio/音乐';
export const AUDIO_INSTALL_FLAT_DIR = 'assets/resources/audio';

export const AUDIO_RESOURCE_CANDIDATES = [
    'audio/音效/',
    'audio/音乐/',
    'audio/',
] as const;

export function audioResourcePaths(officialName: string, kind: 'sfx' | 'music'): string[] {
    const name = officialName.replace(/\.(ogg|mp3|wav|m4a)$/i, '');
    if (kind === 'music') {
        return [`audio/音乐/${name}`, `audio/${name}`];
    }
    return [`audio/音效/${name}`, `audio/${name}`];
}

export function isMusicName(officialName: string): boolean {
    return officialName.startsWith('music_') || officialName === 'menu' || officialName === 'clear';
}
