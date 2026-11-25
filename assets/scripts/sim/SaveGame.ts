/**
 * 第 18 步存档：六个地区各自记进度和中途档。
 * 中途档字段按 时间与存档.tsv，版本号 12。纯序列化，不依赖 Creator。
 */
import { FINE_PER_TILE, Rng, RngState, applyRng, captureRng } from './Fine';
import {
    CampaignProgress,
    LEVELS_PER_REGION,
    REGION_COUNT,
    campaignProgress,
    regionIndex,
} from './CampaignProgress';
import { HighScoreBoard, highScores } from './Difficulty';
import { SPAWN_POOL_SIZE } from './SpawnPool';
import { TALLY_GROUP_COUNT } from './ClearTally';
import { UnitEntity, setDirection, syncFullAndBox } from './UnitEntity';
import { createChest } from './ChestSystem';
import type { BattleSim } from './BattleSim';
import type { KeyValueStore } from '../platform/LocalStore';

export const SAVE_VERSION = 12;
export const CAMPAIGN_STORE_KEY = 'gng.user.profile';

/** 时间与存档.tsv 里中途档必须有的字段。 */
export const MID_SAVE_REQUIRED_KEYS = [
    'version',
    'level',
    'difficulty',
    'wave',
    'cash',
    'cashMade',
    'unitCount',
    'units',
    'chestCount',
    'chests',
    'spawnPool',
    'lives',
    'killCounts',
    'remainingChests',
    'spawnPoolTimer',
    'chestSpawnTimer',
    'difficultyTier',
    'rng',
] as const;

export {
    MemoryStore,
    createLocalStore,
    type KeyValueStore,
} from '../platform/LocalStore';
export interface MidUnitExtra {
    speed?: number;
    walkDir?: number;
    hired?: boolean;
    alive?: boolean;
    canWalk?: boolean;
    canShootWeapon?: boolean;
    currentWeaponCooldown?: number;
    specialCoolDownCounter?: number;
    maxRange?: number;
    maxSquareRange?: number;
    maxWeaponCooldown?: number;
    prevFineX?: number;
    prevFineY?: number;
    inactiveUnitReturnsToBase?: number;
    dynamiteActive?: boolean;
    dynamiteBoxId?: number;
    dynamiteRespawnAnim?: number;
    games?: number;
    wonCash?: number;
    gamblerResult?: number;
    casinoMatIndex?: number;
    id?: number;
}

export interface MidUnitSave {
    type: number;
    activity: number;
    fineX: number;
    fineY: number;
    xDir: number;
    yDir: number;
    group: number;
    upgradeLevel: number;
    bonusAttribute: number;
    bonusCounter: number;
    extra?: MidUnitExtra;
}

export interface MidChestSave {
    type: number;
    fineX: number;
    fineY: number;
}

export interface MidSpawnSlot {
    remaining: number;
    spawned: number;
    max: number;
    capConfigured?: boolean;
}

export interface MidLevelSave {
    version: number;
    level: number;
    difficulty: number;
    /** 从 0 起算，和原版 GunsAndGloryThread.wave 一样。第 2 波是 1。 */
    wave: number;
    cash: number;
    cashMade: number;
    unitCount: number;
    units: MidUnitSave[];
    chestCount: number;
    chests: MidChestSave[];
    spawnPool: MidSpawnSlot[];
    lives: number;
    killCounts: number[];
    remainingChests: number;
    spawnPoolTimer: number;
    chestSpawnTimer: number;
    difficultyTier: number | null;
    rng: RngState;
}

export interface RegionSaveSlot {
    available: number;
    savegameStatus: number;
    introSeen: boolean;
    saveGameVersion: number;
    midSave: MidLevelSave | null;
}

export interface CampaignSave {
    version: number;
    regions: RegionSaveSlot[];
    hardUnlocked: boolean;
    highScores: { level: number; score: number; name: string }[];
}

export function emptyRegionSlot(): RegionSaveSlot {
    return {
        available: 1,
        savegameStatus: 0,
        introSeen: false,
        saveGameVersion: 10,
        midSave: null,
    };
}

export function emptyCampaignSave(): CampaignSave {
    return {
        version: SAVE_VERSION,
        regions: Array.from({ length: REGION_COUNT }, () => emptyRegionSlot()),
        hardUnlocked: false,
        highScores: [],
    };
}

function clampRegion(region: number): number | null {
    const r = Math.trunc(region);
    if (r < 0 || r >= REGION_COUNT) {
        return null;
    }
    return r;
}

export function midSaveHasRequiredFields(payload: object | null | undefined): boolean {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    const rec = payload as Record<string, unknown>;
    return MID_SAVE_REQUIRED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(rec, key));
}

export function captureBattle(sim: BattleSim): MidLevelSave {
    const units = sim.units.filter((u) => u.alive && !u.isEnemy).map(captureUnit);
    const chests = sim.chests.filter((c) => !c.chestRemove).map((c) => ({
        type: c.type,
        fineX: c.fineX,
        fineY: c.fineY,
    }));
    const pool = sim.spawnPool;
    const spawnPool: MidSpawnSlot[] = [];
    for (let i = 0; i < SPAWN_POOL_SIZE; i++) {
        spawnPool.push({
            remaining: pool.units[i] ?? 0,
            spawned: pool.unitsSpawned[i] ?? 0,
            max: pool.maxUnits[i] ?? 0,
            capConfigured: pool.capConfigured[i] ?? false,
        });
    }
    const kills = Array.from({ length: TALLY_GROUP_COUNT }, (_, i) => sim.killCounts[i] ?? 0);
    return {
        version: SAVE_VERSION,
        level: sim.level,
        difficulty: sim.waves?.difficulty ?? 1000,
        wave: sim.waves?.waveIndex ?? 0,
        cash: sim.cash,
        cashMade: sim.killAccrued,
        unitCount: units.length,
        units,
        chestCount: chests.length,
        chests,
        spawnPool,
        lives: sim.enemies?.lives ?? sim.storedLives,
        killCounts: kills,
        remainingChests: sim.remainingChests,
        spawnPoolTimer: pool.spawnPoolTimer,
        chestSpawnTimer: sim.chestSpawnTimer,
        difficultyTier: sim.difficultyTier,
        rng: captureRng(sim.rng),
    };
}

function captureUnit(unit: UnitEntity): MidUnitSave {
    return {
        type: unit.type,
        activity: unit.activity,
        fineX: unit.fineX,
        fineY: unit.fineY,
        xDir: unit.xDir,
        yDir: unit.yDir,
        group: unit.groupId,
        upgradeLevel: unit.upgradeLevel,
        bonusAttribute: unit.bonusAttribute,
        bonusCounter: unit.bonusCounter,
        extra: {
            id: unit.id,
            speed: unit.speed,
            walkDir: unit.walkDir,
            hired: unit.hired,
            alive: unit.alive,
            canWalk: unit.canWalk,
            canShootWeapon: unit.canShootWeapon,
            currentWeaponCooldown: unit.currentWeaponCooldown,
            specialCoolDownCounter: unit.specialCoolDownCounter,
            maxRange: unit.maxRange,
            maxSquareRange: unit.maxSquareRange,
            maxWeaponCooldown: unit.maxWeaponCooldown,
            prevFineX: unit.prevFineX,
            prevFineY: unit.prevFineY,
            inactiveUnitReturnsToBase: unit.inactiveUnitReturnsToBase,
            dynamiteActive: unit.dynamiteActive,
            dynamiteBoxId: unit.dynamiteBoxId,
            dynamiteRespawnAnim: unit.dynamiteRespawnAnim,
            games: unit.games,
            wonCash: unit.wonCash,
            gamblerResult: unit.gamblerResult,
            casinoMatIndex: unit.casinoMatIndex,
        },
    };
}

export function applyBattle(sim: BattleSim, save: MidLevelSave): void {
    sim.level = save.level;
    sim.cash = save.cash;
    sim.killAccrued = save.cashMade;
    sim.difficultyTier = save.difficultyTier;
    sim.killCounts = Array.from({ length: TALLY_GROUP_COUNT }, (_, i) => save.killCounts[i] ?? 0);
    sim.remainingChests = save.remainingChests;
    sim.chestSpawnTimer = save.chestSpawnTimer;
    sim.storedLives = save.lives;
    if (sim.enemies) {
        sim.enemies.lives = save.lives;
        sim.enemies.difficulty = save.difficulty;
        if (save.difficultyTier !== null && save.difficultyTier !== undefined) {
            sim.enemies.mode = save.difficultyTier;
        }
        sim.enemies.enemies.length = 0;
    }
    if (sim.waves) {
        sim.waves.difficultyTier = save.difficultyTier;
        sim.waves.restoreFromSave(save.wave, save.difficulty);
    }
    const pool = sim.spawnPool;
    for (let i = 0; i < SPAWN_POOL_SIZE; i++) {
        const slot = save.spawnPool[i] ?? { remaining: 0, spawned: 0, max: 0 };
        pool.units[i] = slot.remaining ?? 0;
        pool.unitsSpawned[i] = slot.spawned ?? 0;
        pool.maxUnits[i] = slot.max ?? 0;
        if (slot.capConfigured !== undefined) {
            pool.capConfigured[i] = !!slot.capConfigured;
        } else {
            pool.capConfigured[i] = (slot.max ?? 0) > 0;
        }
    }
    pool.spawnPoolTimer = save.spawnPoolTimer;
    applyUnits(sim, save.units);
    applyChests(sim, save.chests);
    applyRng(sim.rng, save.rng);
    sim.waitingToStart = false;
    sim.waitForDifficulty = false;
    sim.waveStarted = true;
    sim.failed = false;
    sim.levelCleared = false;
    sim.outcome = 'none';
}

function applyUnits(sim: BattleSim, rows: MidUnitSave[]): void {
    sim.units.length = 0;
    sim.steamStates.length = 0;
    for (const row of rows) {
        const extra = row.extra ?? {};
        const unit = sim.addUnit({
            id: extra.id,
            type: row.type,
            activity: row.activity,
            fineX: row.fineX,
            fineY: row.fineY,
            speed: extra.speed,
            groupId: row.group,
        });
        unit.upgradeLevel = row.upgradeLevel;
        unit.bonusAttribute = row.bonusAttribute;
        unit.bonusCounter = row.bonusCounter;
        unit.groupId = row.group;
        setDirection(unit, row.xDir, row.yDir);
        if (extra.walkDir !== undefined) {
            unit.walkDir = extra.walkDir;
        }
        if (extra.hired !== undefined) {
            unit.hired = extra.hired;
        }
        if (extra.alive !== undefined) {
            unit.alive = extra.alive;
        }
        if (extra.canWalk !== undefined) {
            unit.canWalk = extra.canWalk;
        }
        if (extra.canShootWeapon !== undefined) {
            unit.canShootWeapon = extra.canShootWeapon;
        }
        if (extra.currentWeaponCooldown !== undefined) {
            unit.currentWeaponCooldown = extra.currentWeaponCooldown;
        }
        if (extra.specialCoolDownCounter !== undefined) {
            unit.specialCoolDownCounter = extra.specialCoolDownCounter;
        }
        if (extra.maxRange !== undefined) {
            unit.maxRange = extra.maxRange;
        }
        if (extra.maxSquareRange !== undefined) {
            unit.maxSquareRange = extra.maxSquareRange;
        }
        if (extra.maxWeaponCooldown !== undefined) {
            unit.maxWeaponCooldown = extra.maxWeaponCooldown;
        }
        if (extra.prevFineX !== undefined) {
            unit.prevFineX = extra.prevFineX;
        }
        if (extra.prevFineY !== undefined) {
            unit.prevFineY = extra.prevFineY;
        }
        if (extra.inactiveUnitReturnsToBase !== undefined) {
            unit.inactiveUnitReturnsToBase = extra.inactiveUnitReturnsToBase;
        }
        if (extra.dynamiteActive !== undefined) {
            unit.dynamiteActive = extra.dynamiteActive;
        }
        if (extra.dynamiteBoxId !== undefined) {
            unit.dynamiteBoxId = extra.dynamiteBoxId;
        }
        if (extra.dynamiteRespawnAnim !== undefined) {
            unit.dynamiteRespawnAnim = extra.dynamiteRespawnAnim;
        }
        if (extra.games !== undefined) {
            unit.games = extra.games;
        }
        if (extra.wonCash !== undefined) {
            unit.wonCash = extra.wonCash;
        }
        if (extra.gamblerResult !== undefined) {
            unit.gamblerResult = extra.gamblerResult;
        }
        if (extra.casinoMatIndex !== undefined) {
            unit.casinoMatIndex = extra.casinoMatIndex;
        }
        syncFullAndBox(unit);
    }
    sim.bindSpecials();
    sim.groupMapVehicles();
}

function applyChests(sim: BattleSim, rows: MidChestSave[]): void {
    sim.chests.length = 0;
    for (const row of rows) {
        const col = Math.floor(row.fineX / FINE_PER_TILE);
        const rowY = Math.floor(row.fineY / FINE_PER_TILE);
        const chest = createChest(sim.takeNextId(), col, rowY, row.type, false);
        chest.fineX = row.fineX;
        chest.fineY = row.fineY;
        chest.prevFineX = row.fineX;
        chest.prevFineY = row.fineY;
        chest.fullX = col;
        chest.fullY = rowY;
        syncFullAndBox(chest);
        sim.chests.push(chest);
    }
}

export function applyCampaign(progress: CampaignProgress, data: CampaignSave): void {
    for (let i = 0; i < REGION_COUNT; i++) {
        const slot = data.regions[i] ?? emptyRegionSlot();
        progress.available[i] = Math.max(1, Math.min(LEVELS_PER_REGION + 1, Math.trunc(slot.available ?? 1)));
        progress.introSeen[i] = !!slot.introSeen;
        progress.savegameStatus[i] = slot.savegameStatus === 1 ? 1 : 0;
        progress.saveGameVersion[i] = Math.trunc(slot.saveGameVersion ?? 10);
    }
    progress.hardUnlocked = !!data.hardUnlocked;
}

export function captureCampaign(progress: CampaignProgress, scores: HighScoreBoard, midByRegion: (RegionSaveSlot['midSave'])[]): CampaignSave {
    const regions: RegionSaveSlot[] = [];
    for (let i = 0; i < REGION_COUNT; i++) {
        regions.push({
            available: progress.available[i] ?? 1,
            savegameStatus: progress.savegameStatus[i] ?? 0,
            introSeen: !!progress.introSeen[i],
            saveGameVersion: progress.saveGameVersion[i] ?? 10,
            midSave: midByRegion[i] ?? null,
        });
    }
    return {
        version: SAVE_VERSION,
        regions,
        hardUnlocked: progress.hardUnlocked,
        highScores: scores.exportAll(),
    };
}

function parseCampaign(raw: string | null): CampaignSave {
    const empty = emptyCampaignSave();
    if (!raw) {
        return empty;
    }
    try {
        const parsed = JSON.parse(raw) as Partial<CampaignSave>;
        const regions = empty.regions.map((slot, i) => {
            const src = parsed.regions?.[i];
            if (!src) {
                return slot;
            }
            return {
                available: Math.max(1, Math.trunc(src.available ?? 1)),
                savegameStatus: src.savegameStatus === 1 ? 1 : 0,
                introSeen: !!src.introSeen,
                saveGameVersion: Math.trunc(src.saveGameVersion ?? 10),
                midSave: src.midSave && midSaveHasRequiredFields(src.midSave) ? src.midSave : (src.savegameStatus === 1 ? src.midSave ?? null : null),
            };
        });
        return {
            version: Math.trunc(parsed.version ?? SAVE_VERSION),
            regions,
            hardUnlocked: !!parsed.hardUnlocked,
            highScores: Array.isArray(parsed.highScores) ? parsed.highScores.map((row) => ({
                level: Number(row.level),
                score: Number(row.score),
                name: String(row.name ?? ''),
            })) : [],
        };
    } catch {
        return empty;
    }
}

/**
 * 地区进度和中途档的读写。
 *
 * 拒绝继续：原版对话框 1 点取消不会改存档状态，中途档仍在，再进这个地区还会问继续。
 * 真正清掉中途档的是过关（状态写成 0）以及选关预览里点「开始」（进关.tsv：把该地区存档状态写成 0 再进战斗）。
 */
export class SaveSession {
    private data: CampaignSave;

    constructor(
        readonly store: KeyValueStore,
        readonly key = CAMPAIGN_STORE_KEY,
    ) {
        this.data = parseCampaign(store.getItem(key));
    }

    reload(): CampaignSave {
        this.data = parseCampaign(this.store.getItem(this.key));
        return this.data;
    }

    persist(): void {
        this.store.setItem(this.key, JSON.stringify(this.data));
    }

    hydrate(progress: CampaignProgress = campaignProgress, scores: HighScoreBoard = highScores): void {
        applyCampaign(progress, this.data);
        scores.importAll(this.data.highScores);
    }

    syncFrom(progress: CampaignProgress, scores: HighScoreBoard): void {
        const mids = this.data.regions.map((r) => r.midSave);
        this.data = captureCampaign(progress, scores, mids);
        this.persist();
    }

    regionSlot(region: number): RegionSaveSlot {
        const r = clampRegion(region);
        if (r === null) {
            return emptyRegionSlot();
        }
        return this.data.regions[r];
    }

    hasMidSave(region: number): boolean {
        const slot = this.regionSlot(region);
        return slot.savegameStatus === 1 && !!slot.midSave && midSaveHasRequiredFields(slot.midSave);
    }

    shouldOfferContinue(region: number): boolean {
        return this.hasMidSave(region);
    }

    getMidSave(region: number): MidLevelSave | null {
        if (!this.hasMidSave(region)) {
            return null;
        }
        return this.regionSlot(region).midSave;
    }

    writeMidSave(region: number, payload: MidLevelSave, progress?: CampaignProgress): void {
        const r = clampRegion(region);
        if (r === null) {
            return;
        }
        const slot = this.data.regions[r];
        slot.midSave = payload;
        slot.savegameStatus = 1;
        slot.saveGameVersion = SAVE_VERSION;
        if (progress) {
            progress.setSaveGameStatus(r, 1);
            progress.setSaveGameVersion(r, SAVE_VERSION);
            slot.available = progress.available[r] ?? slot.available;
            slot.introSeen = !!progress.introSeen[r];
            this.data.hardUnlocked = progress.hardUnlocked;
        }
        this.persist();
    }

    /** 过关，或选关点「开始」：状态写成 0，中途档清掉。 */
    clearMidSave(region: number, progress?: CampaignProgress): void {
        const r = clampRegion(region);
        if (r === null) {
            return;
        }
        const slot = this.data.regions[r];
        slot.midSave = null;
        slot.savegameStatus = 0;
        if (progress) {
            progress.setSaveGameStatus(r, 0);
            slot.available = progress.available[r] ?? slot.available;
            slot.introSeen = !!progress.introSeen[r];
            this.data.hardUnlocked = progress.hardUnlocked;
        }
        this.persist();
    }

    /**
     * 拒绝继续：不读中途档，也不删档。原版取消对话框后回到选区/选关，中途档还在。
     * 之后若在选关点「开始」，再走 startNewFromSelect。
     */
    declineContinue(_region: number): void {
        return;
    }

    /** 选关预览点开始：存档状态写成 0，进入这一关的新开局。 */
    startNewFromSelect(region: number, progress?: CampaignProgress): void {
        this.clearMidSave(region, progress);
    }

    markIntroSeen(region: number, progress?: CampaignProgress): void {
        const r = clampRegion(region);
        if (r === null) {
            return;
        }
        this.data.regions[r].introSeen = true;
        progress?.setWarningDisplayed(r);
        this.persist();
    }

    introSeen(region: number): boolean {
        return !!this.regionSlot(region).introSeen;
    }

    persistScores(scores: HighScoreBoard, progress?: CampaignProgress): void {
        this.data.highScores = scores.exportAll();
        if (progress) {
            this.data.hardUnlocked = progress.hardUnlocked;
            for (let i = 0; i < REGION_COUNT; i++) {
                this.data.regions[i].available = progress.available[i] ?? 1;
            }
        }
        this.persist();
    }
}

export function regionOfLevel(level: number): number {
    return regionIndex(level);
}

/** 给自检用：从任意对象取出已保存的随机状态再灌进另一份 Rng。 */
export function cloneRngState(state: RngState): RngState {
    return JSON.parse(JSON.stringify(state)) as RngState;
}

export function restoreRngFromSave(rng: Rng, state: RngState): void {
    applyRng(rng, state);
}

export { regionIndex, REGION_COUNT };
