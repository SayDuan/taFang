import { EnemySystem, SpawnResult } from './EnemySystem';
import { CampaignProgress } from './CampaignProgress';
import { defaultRng, Rng } from './Fine';
import { clampDifficulty, isDifficultyTier } from './Difficulty';
import { playGameSfx } from './SoundEvents';

/** 出兵表一行。同一波可以有多行，分别对应不同出生点。 */
export interface WaveRow {
    level?: number;
    wave: number;
    wait?: number;
    hpFactor?: number;
    speedFactor?: number;
    spawnPoint?: number;
    interval?: number;
    settler1?: number;
    settler2?: number;
    settler3?: number;
    settler4?: number;
    cavalry?: number;
    wagon?: number;
    stagecoach?: number;
    goldWagon?: number;
    boss?: number;
    doctor?: number;
    /** 出兵表「波次文案」列：@string/T_CAMPAIGN_xx_yy。 */
    waveText?: string;
}

/** 池子下标：0 间隔，1 剩余等待，2–5 移民 1–4 人组，6 骑兵，7 篷车，8 驿马车，9 金车，10 头目，11 医生。 */
const POOL_INTERVAL = 0;
const POOL_WAIT = 1;
const POOL_FIRST = 2;
const POOL_LAST = 11;

const SLOT_COUNT = 7;

/** 和第 9 步一样：篷车、驿马车、金车等待系数是 2，其他是 1。 */
const WAIT_COEFF = [0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1];

export function scaleCount(count: number, difficulty: number): number {
    if (count <= 0) {
        return 0;
    }
    const prod = count * difficulty;
    const rounded = Math.trunc(prod / 1000) + ((prod % 1000) >= 500 ? 1 : 0);
    return Math.max(rounded, 1);
}

export function countdownFromDelay(delay: number): number {
    if (delay <= 0) {
        return 0;
    }
    return Math.trunc(delay / 1000) + 1;
}

interface SlotPool {
    active: boolean;
    values: number[];
}

interface WaveState {
    wave: number;
    delay: number;
    hpFactor: number;
    speedFactor: number;
    slots: SlotPool[];
    waveText?: string;
}

function emptySlot(): SlotPool {
    return { active: false, values: new Array(12).fill(0) };
}

function fillSlot(slot: SlotPool, row: WaveRow): void {
    slot.active = true;
    slot.values[POOL_INTERVAL] = row.interval ?? 0;
    slot.values[POOL_WAIT] = 0;
    slot.values[2] = row.settler1 ?? 0;
    slot.values[3] = row.settler2 ?? 0;
    slot.values[4] = row.settler3 ?? 0;
    slot.values[5] = row.settler4 ?? 0;
    slot.values[6] = row.cavalry ?? 0;
    slot.values[7] = row.wagon ?? 0;
    slot.values[8] = row.stagecoach ?? 0;
    slot.values[9] = row.goldWagon ?? 0;
    slot.values[10] = row.boss ?? 0;
    slot.values[11] = row.doctor ?? 0;
}

export function buildWaves(rows: WaveRow[]): WaveState[] {
    const byWave = new Map<number, WaveState>();
    const order: number[] = [];
    for (const row of rows) {
        let wave = byWave.get(row.wave);
        if (!wave) {
            wave = {
                wave: row.wave,
                delay: row.wait ?? 0,
                hpFactor: row.hpFactor ?? 100,
                speedFactor: row.speedFactor ?? 100,
                slots: Array.from({ length: SLOT_COUNT }, emptySlot),
                waveText: row.waveText,
            };
            byWave.set(row.wave, wave);
            order.push(row.wave);
        }
        const slot = Math.max(0, Math.min(SLOT_COUNT - 1, row.spawnPoint ?? 0));
        fillSlot(wave.slots[slot], row);
    }
    order.sort((a, b) => a - b);
    return order.map((n) => byWave.get(n)!);
}

export interface WaveSystemOptions {
    rows: WaveRow[];
    enemies: EnemySystem;
    rng?: Rng;
    difficulty?: number;
    progress?: CampaignProgress;
    level?: number;
    /** 清波时如果还没有击杀/漏人样本，就用当前难度当平均难度。 */
    averageDifficulty?: () => number;
    /** 选了简单/普通/困难之后才按表夹紧强度。 */
    difficultyTier?: number | null;
}


/** 组：0 移民、1 骑兵、2 篷车、3 驿马车、4 金车、5 头目、6 医生。马没有组。 */
export const ENEMY_GROUP_UNIT_TYPES = [1, 3, 4, 5, 6, 7, 9];
export const UNIT_TYPE_TO_ENEMY_GROUP = [-1, 0, 0, 1, 2, 3, 4, 5, -1, 6];

export function unitTypeToEnemyGroup(type: number): number {
    if (type < 0 || type >= UNIT_TYPE_TO_ENEMY_GROUP.length) {
        return -1;
    }
    return UNIT_TYPE_TO_ENEMY_GROUP[type];
}

/** 当前波剩余池子里，某一组还要出多少。移民把 1–4 人组加在一起。 */
export function groupRemainingInWave(wave: WaveState, group: number): number {
    let n = 0;
    for (const slot of wave.slots) {
        if (!slot.active) {
            continue;
        }
        if (group === 0) {
            n += slot.values[2] + slot.values[3] + slot.values[4] + slot.values[5];
        } else {
            n += slot.values[group + 5] ?? 0;
        }
    }
    return n;
}

export class WaveSystem {
    waves: WaveState[];
    readonly enemies: EnemySystem;
    readonly progress: CampaignProgress;
    readonly level: number;
    readonly sourceRows: WaveRow[];
    rng: Rng;
    /** 从 0 起算。 */
    waveIndex = 0;
    waveEmpty = false;
    accelerate = false;
    difficulty: number;
    startDifficulty: number;
    difficultyTier: number | null;
    levelCleared = false;
    lastSpawn: SpawnResult | null = null;
    /** apk GunsAndGloryThread.mWaveArrowVisible：进入关卡/下一波时显示，本波第一次开火后隐藏。 */
    waveArrowVisible = true;
    private averageDifficulty: () => number;

    constructor(opts: WaveSystemOptions) {
        this.sourceRows = opts.rows;
        this.waves = buildWaves(opts.rows);
        this.enemies = opts.enemies;
        this.rng = opts.rng ?? defaultRng;
        this.difficulty = opts.difficulty ?? 1000;
        this.startDifficulty = this.difficulty;
        this.difficultyTier = opts.difficultyTier ?? null;
        this.progress = opts.progress ?? new CampaignProgress();
        this.level = opts.level ?? 1;
        this.averageDifficulty = opts.averageDifficulty ?? (() => this.difficulty);
        this.waveEmpty = this.waves.length === 0;
    }

    get current(): WaveState | null {
        return this.waves[this.waveIndex] ?? null;
    }

    get waveNumber(): number {
        return this.waveIndex + 1;
    }

    get waveCount(): number {
        return this.waves.length;
    }

    countdown(): number {
        if (this.waveEmpty) {
            return 0;
        }
        const wave = this.current;
        if (!wave || wave.delay <= 0) {
            return 0;
        }
        return countdownFromDelay(wave.delay);
    }

    accelerateDelay(): void {
        this.accelerate = true;
    }

    /** 第 1 波人数原样；进入下一波时把还大于 0 的人数按难度四舍五入，至少 1。 */
    applyScale(wave: WaveState, difficulty: number): void {
        for (const slot of wave.slots) {
            if (!slot.active) {
                continue;
            }
            for (let i = POOL_FIRST; i <= POOL_LAST; i++) {
                if (slot.values[i] > 0) {
                    slot.values[i] = scaleCount(slot.values[i], difficulty);
                }
            }
        }
    }

    counts(wave: WaveState, poolIndex: number): number {
        let n = 0;
        for (const slot of wave.slots) {
            if (slot.active) {
                n += slot.values[poolIndex];
            }
        }
        return n;
    }

    tick(dtMs: number): void {
        if (this.levelCleared || this.waves.length === 0) {
            return;
        }
        if (!this.waveEmpty) {
            this.updateCurrent(dtMs);
        }
    }

    /** 这一波已经出完、场上没敌人、还有命：更新难度并进入下一波；没有下一波就过关。 */
    checkAdvance(lives: number): 'next' | 'cleared' | 'none' {
        if (this.levelCleared) {
            return 'cleared';
        }
        if (lives <= 0) {
            return 'none';
        }
        if (!this.waveEmpty) {
            return 'none';
        }
        if (this.enemies.enemies.some((e) => e.alive)) {
            return 'none';
        }
        this.difficulty = Math.trunc((this.difficulty + this.averageDifficulty()) / 2);
        if (isDifficultyTier(this.difficultyTier ?? -1)) {
            this.difficulty = clampDifficulty(this.difficulty, this.difficultyTier as number);
        }
        this.enemies.difficulty = this.difficulty;
        if (this.nextWave(this.difficulty)) {
            return 'next';
        }
        this.levelCleared = true;
        this.progress.completeLevel(this.level);
        return 'cleared';
    }

    /** 重打这一关：回到第 1 波、初始人数和起始难度。 */
    reset(): void {
        this.waves = buildWaves(this.sourceRows);
        this.waveIndex = 0;
        this.waveEmpty = this.waves.length === 0;
        this.accelerate = false;
        this.difficulty = this.startDifficulty;
        this.levelCleared = false;
        this.lastSpawn = null;
        this.waveArrowVisible = true;
        this.enemies.difficulty = this.difficulty;
        this.syncEnemyWaveFactors();
    }

    /** 读档：按表重建波次，跳到存下来的波（从 0 起算），第 2 波起按存档难度缩放人数。 */
    restoreFromSave(waveIndex: number, difficulty: number): void {
        this.waves = buildWaves(this.sourceRows);
        const last = Math.max(0, this.waves.length - 1);
        this.waveIndex = Math.max(0, Math.min(Math.trunc(waveIndex), last));
        this.waveEmpty = this.waves.length === 0;
        this.accelerate = false;
        this.difficulty = difficulty;
        this.levelCleared = false;
        this.lastSpawn = null;
        this.waveArrowVisible = true;
        const wave = this.current;
        if (wave && this.waveIndex > 0) {
            this.applyScale(wave, difficulty);
        }
        this.enemies.difficulty = this.difficulty;
        this.syncEnemyWaveFactors();
    }

    nextWave(difficulty: number): boolean {
        if (this.waveIndex >= this.waves.length - 1) {
            return false;
        }
        this.waveIndex += 1;
        this.waveEmpty = false;
        this.accelerate = false;
        this.waveArrowVisible = true;
        const wave = this.current!;
        this.applyScale(wave, difficulty);
        this.syncEnemyWaveFactors();
        return true;
    }

    private syncEnemyWaveFactors(): void {
        const wave = this.current;
        if (!wave) {
            return;
        }
        this.enemies.waveHpFactor = wave.hpFactor;
        this.enemies.waveSpeedFactor = wave.speedFactor;
        this.enemies.difficulty = this.difficulty;
    }

    private updateCurrent(dtMs: number): void {
        const wave = this.current;
        if (!wave) {
            this.waveEmpty = true;
            return;
        }
        this.waveEmpty = true;
        if (wave.delay > 0) {
            wave.delay = wave.delay - dtMs;
            if (this.accelerate) {
                wave.delay = wave.delay - (dtMs * 9 + wave.delay / 10);
            }
            this.waveEmpty = false;
            if (wave.delay <= 0) {
                wave.delay = -1000;
                this.syncEnemyWaveFactors();
                playGameSfx('wave');
            }
            return;
        }
        for (let slot = 0; slot < SLOT_COUNT; slot++) {
            this.updateSlot(wave, slot, dtMs);
            if (wave.slots[slot].active) {
                this.waveEmpty = false;
            }
        }
    }

    private updateSlot(wave: WaveState, slotIndex: number, dtMs: number): void {
        const slot = wave.slots[slotIndex];
        if (!slot.active) {
            return;
        }
        if (slot.values[POOL_WAIT] > 0) {
            slot.values[POOL_WAIT] -= dtMs;
            return;
        }
        let remaining = 0;
        for (let i = POOL_FIRST; i <= POOL_LAST; i++) {
            remaining += slot.values[i];
        }
        if (remaining <= 0) {
            slot.active = false;
            return;
        }
        const pick = this.rng.int(remaining);
        let acc = 0;
        let chosen = POOL_FIRST;
        for (let i = POOL_FIRST; i <= POOL_LAST; i++) {
            acc += slot.values[i];
            if (acc > pick) {
                chosen = i;
                break;
            }
        }
        const coeff = WAIT_COEFF[chosen] ?? 1;
        const interval = slot.values[POOL_INTERVAL];
        const result = this.spawnKind(chosen, slotIndex);
        this.lastSpawn = result;
        if (!result.spawned) {
            slot.values[POOL_WAIT] = Math.trunc(interval / 2) * coeff;
        } else {
            slot.values[chosen] -= 1;
            slot.values[POOL_WAIT] = interval * coeff;
        }
    }

    private spawnKind(poolIndex: number, slot: number): SpawnResult {
        switch (poolIndex) {
            case 2:
                return this.spawnSettlers(1, slot);
            case 3:
                return this.spawnSettlers(2, slot);
            case 4:
                return this.spawnSettlers(3, slot);
            case 5:
                return this.spawnSettlers(4, slot);
            case 6:
                return this.enemies.trySpawnGroup([3], slot);
            case 7:
                return this.enemies.trySpawnGroup([8, 4], slot);
            case 8:
                return this.enemies.trySpawnGroup([8, 5], slot);
            case 9:
                return this.enemies.trySpawnGroup([8, 6], slot);
            case 10:
                return this.enemies.trySpawnGroup([7], slot);
            case 11:
                return this.enemies.trySpawnGroup([9], slot);
            default:
                return { spawned: false, waitMul: 1, enemies: [] };
        }
    }

    private spawnSettlers(size: number, slot: number): SpawnResult {
        const types: number[] = [];
        for (let i = 0; i < size; i++) {
            types.push(this.rng.int(2) + 1);
        }
        return this.enemies.trySpawnGroup(types, slot);
    }

    /**
     * 本关还会出现的敌人：当前及以后波次池子里还有，或者场上还活着。
     * 对应 Java WaveManager.isEnemyAvailable。
     */
    isEnemyAvailable(group: number): boolean {
        if (group < 0 || group > 6) {
            return false;
        }
        for (let i = this.waveIndex; i < this.waves.length; i++) {
            if (groupRemainingInWave(this.waves[i], group) > 0) {
                return true;
            }
        }
        for (const enemy of this.enemies.enemies) {
            if (enemy.alive && unitTypeToEnemyGroup(enemy.type) === group) {
                return true;
            }
        }
        return false;
    }

    availableEnemyGroups(): boolean[] {
        return [0, 1, 2, 3, 4, 5, 6].map((g) => this.isEnemyAvailable(g));
    }
}
