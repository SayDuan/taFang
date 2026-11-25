/**
 * 第 21 步选区和选关的纯规则。对照 进关.tsv 与 Java MapSelection / LevelSelection。
 * 自检不依赖 Creator。
 */
import { CampaignProgress, LEVELS_PER_REGION, REGION_COUNT, globalLevel, localLevel, regionIndex } from './CampaignProgress';
import type { SaveSession } from './SaveGame';

export const REGION_KEYS = ['new-mexico', 'mississippi', 'oregon', 'dakota', 'nevada', 'alaska'] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export interface RegionDef {
    id: number;
    key: RegionKey;
    name: string;
    firstLevel: number;
    xDip: number;
    yDip: number;
    /** XML gravity：0x31=top|center_horizontal，0x37=top|fill_horizontal。 */
    textGravity: 'center' | 'fill';
}

/** 六个地区按钮 00–05，第一关分别是 1、11、21、31、41、51。坐标来自尺寸表，单位 dip，原点在左上。 */
export const REGION_DEFS: readonly RegionDef[] = [
    { id: 0, key: 'new-mexico', name: '新墨西哥', firstLevel: 1, xDip: 182, yDip: 188, textGravity: 'center' },
    { id: 1, key: 'mississippi', name: '密西西比', firstLevel: 11, xDip: 302, yDip: 215, textGravity: 'center' },
    { id: 2, key: 'oregon', name: '俄勒冈州', firstLevel: 21, xDip: 80, yDip: 80, textGravity: 'center' },
    { id: 3, key: 'dakota', name: '达科塔', firstLevel: 31, xDip: 210, yDip: 90, textGravity: 'fill' },
    { id: 4, key: 'nevada', name: '内华达', firstLevel: 41, xDip: 105, yDip: 150, textGravity: 'fill' },
    { id: 5, key: 'alaska', name: '阿拉斯加', firstLevel: 51, xDip: 95, yDip: 250, textGravity: 'fill' },
];

/** 每个地区 10 个关卡按钮的本地布局，尺寸表 level_selection_map_01–10。 */
export const LEVEL_BUTTON_LAYOUT: readonly { local: number; xDip: number; yDip: number }[] = [
    { local: 1, xDip: 25, yDip: 25 },
    { local: 2, xDip: 117, yDip: 54 },
    { local: 3, xDip: 34, yDip: 126 },
    { local: 4, xDip: 84, yDip: 208 },
    { local: 5, xDip: 157, yDip: 137 },
    { local: 6, xDip: 239, yDip: 60 },
    { local: 7, xDip: 341, yDip: 23 },
    { local: 8, xDip: 352, yDip: 118 },
    { local: 9, xDip: 264, yDip: 167 },
    { local: 10, xDip: 362, yDip: 208 },
];

/** 官方地区按钮是 gng_usmap_cross 的 wrap_content，48×48，不是自拟热区。 */
export const REGION_CROSS_SIZE_DIP = 48;
export const REGION_BUTTON_WIDTH_DIP = REGION_CROSS_SIZE_DIP;
export const REGION_BUTTON_HEIGHT_DIP = REGION_CROSS_SIZE_DIP;
/** 官方选关缩略图 wrap_content，常见 91×84，少数 81×75。 */
export const LEVEL_THUMB_WIDTH_DIP = 91;
export const LEVEL_THUMB_HEIGHT_DIP = 84;
export const LEVEL_BUTTON_WIDTH_DIP = LEVEL_THUMB_WIDTH_DIP;
export const LEVEL_BUTTON_HEIGHT_DIP = LEVEL_THUMB_HEIGHT_DIP;
export const SELECT_LAYOUT_WIDTH = 480;
export const SELECT_LAYOUT_HEIGHT = 320;

/** 选关小图官方文件名（不含扩展名）：gng_levelmap_01–60，按关卡号而不是地图号。 */
export const LEVEL_THUMB_PREFIX = 'gng_levelmap_';

export const REGION_TIP_TEXT = '你还没有打完上一个地区，确定要进入吗？';
/** apk LevelSelectionScreenActivity / strings_default.tsv T_LEVEL_LOCKED。 */
export const LOCKED_LEVEL_TIP = '这个级别还未解锁，你必须完成低级的关卡';
export const CONTINUE_TIP = '要继续上次的战斗吗？';

export interface BattleEntry {
    level: number;
    resume: boolean;
}

let pendingBattleEntry: BattleEntry | null = null;

export function setPendingBattleEntry(entry: BattleEntry | null): void {
    pendingBattleEntry = entry;
}

export function peekPendingBattleEntry(): BattleEntry | null {
    return pendingBattleEntry;
}

export function takePendingBattleEntry(): BattleEntry | null {
    const entry = pendingBattleEntry;
    pendingBattleEntry = null;
    return entry;
}

export function regionDef(region: number): RegionDef | null {
    if (region < 0 || region >= REGION_COUNT) {
        return null;
    }
    return REGION_DEFS[region];
}

export function firstLevelOfRegion(region: number): number {
    return region * LEVELS_PER_REGION + 1;
}

export function levelsOfRegion(region: number): number[] {
    const first = firstLevelOfRegion(region);
    return Array.from({ length: LEVELS_PER_REGION }, (_, i) => first + i);
}

/**
 * 选关小图名。第 11 关是 gng_levelmap_11，不是地图 td_map_11 / td_map_14 的缩略图。
 */
export function levelThumbnailName(level: number): string {
    if (level < 1 || level > REGION_COUNT * LEVELS_PER_REGION) {
        return '';
    }
    return `${LEVEL_THUMB_PREFIX}${String(level).padStart(2, '0')}`;
}

/** Java UserProfile.getAvailableLevels：至少是 1。不写内购全开。 */
export function availableLevels(progress: CampaignProgress, region: number): number {
    if (region < 0 || region >= REGION_COUNT) {
        return 1;
    }
    return Math.max(1, progress.available[region] ?? 1);
}

/**
 * 按钮是否开着：已开放数至少是 1，第几个按钮开放看已开放数是否 >= 序号+1。
 * 序号从 0 起，本地第 1 关是按钮 0。
 */
export function isLevelButtonOpen(progress: CampaignProgress, level: number): boolean {
    if (level < 1 || level > REGION_COUNT * LEVELS_PER_REGION) {
        return false;
    }
    const region = regionIndex(level);
    const index = localLevel(level) - 1;
    return availableLevels(progress, region) >= index + 1;
}

/**
 * 点下去能不能进：个位是 1 时总能点（1、11、21、31、41、51）。
 * 其他关要本地区已开放数 >=「关卡号 − 地区号 × 10」。
 */
export function isLevelEnterable(progress: CampaignProgress, level: number): boolean {
    if (level < 1 || level > REGION_COUNT * LEVELS_PER_REGION) {
        return false;
    }
    if (level % 10 === 1) {
        return true;
    }
    const region = regionIndex(level);
    return availableLevels(progress, region) >= (level - region * 10);
}

/**
 * 其他地区：上一地区已开放数还没大于 10，并且没看过提醒，就弹出对话框 3。
 * 新墨西哥没有提示。
 */
export function shouldShowRegionTip(progress: CampaignProgress, region: number): boolean {
    if (region <= 0 || region >= REGION_COUNT) {
        return false;
    }
    if (progress.warningDisplayed(region)) {
        return false;
    }
    return availableLevels(progress, region - 1) <= 10;
}

export type RegionFlow =
    | { kind: 'tip'; region: number }
    | { kind: 'continue'; region: number }
    | { kind: 'levelSelect'; region: number };

export function afterRegionReady(region: number, hasMidSave: boolean): RegionFlow {
    if (hasMidSave) {
        return { kind: 'continue', region };
    }
    return { kind: 'levelSelect', region };
}

/** 点地区按钮。新墨西哥直接按存档规则走；其他地区可能先出提醒。 */
export function onRegionClick(progress: CampaignProgress, region: number, hasMidSave: boolean): RegionFlow {
    if (region < 0 || region >= REGION_COUNT) {
        return { kind: 'levelSelect', region: 0 };
    }
    if (shouldShowRegionTip(progress, region)) {
        return { kind: 'tip', region };
    }
    return afterRegionReady(region, hasMidSave);
}

/** 提醒点确定：记住已经看过，然后仍按存档规则进入，不会挡住。 */
export function confirmRegionTip(
    progress: CampaignProgress,
    region: number,
    hasMidSave: boolean,
    session?: SaveSession,
): RegionFlow {
    progress.setWarningDisplayed(region);
    session?.markIntroSeen(region, progress);
    return afterRegionReady(region, hasMidSave);
}

export type LevelClickResult =
    | { kind: 'locked-tip'; level: number; enterBattle: false }
    | { kind: 'preview'; level: number; thumbnail: string; enterBattle: false };

/** 锁着的关只提示，不进战斗。能点的关先出本关预览。 */
export function onLevelClick(progress: CampaignProgress, level: number): LevelClickResult {
    if (!isLevelEnterable(progress, level)) {
        return { kind: 'locked-tip', level, enterBattle: false };
    }
    return {
        kind: 'preview',
        level,
        thumbnail: levelThumbnailName(level),
        enterBattle: false,
    };
}

export type StartBattleResult = {
    kind: 'fresh-start';
    level: number;
    region: number;
    resume: false;
    saveStatus: 0;
};

/**
 * 选关预览点开始：把该地区存档状态写成 0（新开），再进入战斗，不读中途档。
 */
export function startFromSelect(session: SaveSession, progress: CampaignProgress, level: number): StartBattleResult {
    const region = regionIndex(level);
    session.startNewFromSelect(region, progress);
    setPendingBattleEntry({ level, resume: false });
    return { kind: 'fresh-start', level, region, resume: false, saveStatus: 0 };
}

export type ContinueBattleResult = {
    kind: 'resume';
    level: number;
    region: number;
    resume: true;
};

/** 对话框 1 确定：进游戏接着打中途档。 */
export function continueMidSave(session: SaveSession, region: number): ContinueBattleResult | { kind: 'levelSelect'; region: number } {
    const mid = session.getMidSave(region);
    if (!mid) {
        return { kind: 'levelSelect', region };
    }
    setPendingBattleEntry({ level: mid.level, resume: true });
    return { kind: 'resume', level: mid.level, region, resume: true };
}

/**
 * 对话框 1 取消：不删档（Java 不会改 savegameStatus），进入选关。
 * 之后若在选关点开始，再走 startFromSelect。
 */
export function declineContinuePrompt(session: SaveSession, region: number): { kind: 'levelSelect'; region: number } {
    session.declineContinue(region);
    return { kind: 'levelSelect', region };
}

/** 尺寸表左上原点 dip → 以 480×320 中心为原点、Y 向上的本地坐标。 */
export function topLeftDipToCenter(
    xDip: number,
    yDip: number,
    widthDip: number,
    heightDip: number,
    layoutWidth = SELECT_LAYOUT_WIDTH,
    layoutHeight = SELECT_LAYOUT_HEIGHT,
): { x: number; y: number } {
    return {
        x: xDip + widthDip / 2 - layoutWidth / 2,
        y: layoutHeight / 2 - yDip - heightDip / 2,
    };
}

export { REGION_COUNT, LEVELS_PER_REGION, regionIndex, localLevel, globalLevel };
