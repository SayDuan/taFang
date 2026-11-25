/**
 * 出生池：按 出生池.tsv 的 86 条动作改剩余个数和本关上限，
 * 15 秒抽一次，从对应垫子走出己方单位。
 * 不依赖 Cocos。
 */
import { FINE_PER_TILE, HALF_TILE, Rng, spawnPadFineY, tileCenterX } from './Fine';

export const SPAWN_POOL_SIZE = 37;
export const SPAWN_POOL_TIMER_MAX = 15000;
/** apk GameObjectSpawnLocation.MAX_RESPAWN_COUNTER：开门 1500ms，计数低于 1/3 时出人。 */
export const SPAWN_MAT_MAX_RESPAWN_COUNTER = 1500;

/** 与 Java SpawnPoolManager.performActionsForWave 的 case 一致。 */
export const SPAWN_POOL_ADD = 0;
export const SPAWN_POOL_SET = 1;
export const SPAWN_POOL_ADD_CAP = 2;
export const SPAWN_POOL_SET_CAP = 3;

/** 表里四列依次是 1 亡命之徒、2 暴徒、3 加农炮、4 本地人。 */
export const SPAWN_POOL_COLUMNS = [1, 2, 3, 4] as const;
export const SPAWN_POOL_COLUMN_NAMES = ['亡命之徒', '暴徒', '加农炮', '本地人'] as const;

export type SpawnPoolActionKind = 0 | 1 | 2 | 3;

export interface SpawnPoolAction {
    level: number;
    wave: number;
    action: SpawnPoolActionKind;
    /** 长度 37，只在 1–4 号写入表内四列，其余为 0。 */
    units: number[];
}

export interface SpawnMat {
    col: number;
    row: number;
    /** 1 酒馆、2 堡垒、3 帐篷、4 赌场。赌场出人时不改这个值，人写在 instantSpawnType。 */
    spawnType: number;
    spawningMode: boolean;
    /** 赌场垫子。 */
    isCasino?: boolean;
    /** 赢单位后马上要刷出的类型，-1 或未设表示没有。 */
    instantSpawnType?: number;
    /** 出人活动，instantSpawn 是 6。 */
    unitActivity?: number;
    respawnCounter?: number;
}

export interface SpawnAttempt {
    tried: boolean;
    type: number;
    spawned: boolean;
    col: number;
    row: number;
    fineX: number;
    fineY: number;
    consumed: boolean;
}

const ACTION_NAMES: Record<string, SpawnPoolActionKind> = {
    '追加这一波可刷出的个数': 0,
    '把这一波可刷出的个数改成': 1,
    '追加本关最多刷出个数': 2,
    '把本关最多刷出个数改成': 3,
    add: 0,
    swap: 1,
    set: 1,
    'add-to-cap': 2,
    'set-cap': 3,
};

export function emptyPoolArray(): number[] {
    return new Array(SPAWN_POOL_SIZE).fill(0);
}

export function packColumnValues(gunslinger: number, thug: number, cannon: number, native: number): number[] {
    const units = emptyPoolArray();
    units[1] = gunslinger;
    units[2] = thug;
    units[3] = cannon;
    units[4] = native;
    return units;
}

export function actionNameToKind(name: string): SpawnPoolActionKind | undefined {
    return ACTION_NAMES[name.trim()];
}

export function parseSpawnPoolTsv(text: string): SpawnPoolAction[] {
    let src = text;
    if (src.charCodeAt(0) === 0xfeff) {
        src = src.slice(1);
    }
    const lines = src.split(/\r\n|\n|\r/).filter((l, i, arr) => l.length > 0 || i < arr.length - 1);
    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    if (lines.length < 2) {
        return [];
    }
    const header = lines[0].split('\t');
    const idx = (name: string) => header.indexOf(name);
    const iLevel = idx('关卡');
    const iWave = idx('波次');
    const iAction = idx('动作');
    const iCols = SPAWN_POOL_COLUMN_NAMES.map((n) => idx(n));
    const out: SpawnPoolAction[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) {
            continue;
        }
        const cells = lines[i].split('\t');
        const level = Number(cells[iLevel]);
        const wave = Number(cells[iWave]);
        const kind = actionNameToKind(cells[iAction] ?? '');
        if (!Number.isFinite(level) || !Number.isFinite(wave) || kind === undefined) {
            continue;
        }
        const vals = iCols.map((c) => {
            const n = Number(c >= 0 ? cells[c] : 0);
            return Number.isFinite(n) ? n : 0;
        });
        out.push({
            level,
            wave,
            action: kind,
            units: packColumnValues(vals[0] ?? 0, vals[1] ?? 0, vals[2] ?? 0, vals[3] ?? 0),
        });
    }
    return out;
}

export function parseSpawnPoolRows(rows: ReadonlyArray<Readonly<Record<string, string>>>): SpawnPoolAction[] {
    const out: SpawnPoolAction[] = [];
    for (const row of rows) {
        const level = Number(row['关卡']);
        const wave = Number(row['波次']);
        const kind = actionNameToKind(row['动作'] ?? '');
        if (!Number.isFinite(level) || !Number.isFinite(wave) || kind === undefined) {
            continue;
        }
        out.push({
            level,
            wave,
            action: kind,
            units: packColumnValues(
                Number(row['亡命之徒'] || 0) || 0,
                Number(row['暴徒'] || 0) || 0,
                Number(row['加农炮'] || 0) || 0,
                Number(row['本地人'] || 0) || 0,
            ),
        });
    }
    return out;
}

/** 1、2 号从酒馆（垫子 1），3 号从堡垒（2），4 号从帐篷（3）。其它编号对不上垫子。 */
export function matTypeForUnit(unitType: number): number {
    if (unitType === 1 || unitType === 2) {
        return 1;
    }
    if (unitType === 3) {
        return 2;
    }
    if (unitType === 4) {
        return 3;
    }
    return -1;
}

export function matCenterFineX(col: number): number {
    return tileCenterX(col);
}

/**
 * apk GameObjectSpawnLocation.update：create(fullX*7680+3840, fullY*7680+5760)，
 * 单位构造函数再加 UNIT_PLACEMENT_OFFSET_Y(1920)，最终 fineY = 行*7680+7680（垫子底边）。
 */
export function matCenterFineY(row: number): number {
    return spawnPadFineY(row);
}

export function isFreeMat(mat: SpawnMat, unitType: number): boolean {
    return !mat.spawningMode && mat.spawnType === matTypeForUnit(unitType);
}

/** apk GameObjectSpawnLocation.initSpawn：开门 1500ms，人从垫子中心走出来。 */
export function initSpawnOnMat(mat: SpawnMat, unitType: number): void {
    mat.spawningMode = true;
    mat.instantSpawnType = unitType;
    mat.unitActivity = 2;
    mat.respawnCounter = SPAWN_MAT_MAX_RESPAWN_COUNTER;
}

export class SpawnPoolManager {
    readonly units: number[] = emptyPoolArray();
    readonly unitsSpawned: number[] = emptyPoolArray();
    readonly maxUnits: number[] = emptyPoolArray();
    /** 该编号是否被「设上限 / 加到上限」写过。出兵判定不看它，只为存档还原保留。 */
    readonly capConfigured: boolean[] = new Array(SPAWN_POOL_SIZE).fill(false);
    readonly actions: SpawnPoolAction[];
    spawnPoolTimer: number = SPAWN_POOL_TIMER_MAX;
    spawnPoolTimerMax = SPAWN_POOL_TIMER_MAX;
    lastAttempt: SpawnAttempt | null = null;

    constructor(actions: readonly SpawnPoolAction[] = []) {
        this.actions = actions.slice();
    }

    /** 重打这一关时清掉剩余、已刷和上限，计时回到 15000。 */
    reset(): void {
        for (let i = 0; i < SPAWN_POOL_SIZE; i++) {
            this.units[i] = 0;
            this.unitsSpawned[i] = 0;
            this.maxUnits[i] = 0;
            this.capConfigured[i] = false;
        }
        this.spawnPoolTimer = this.spawnPoolTimerMax;
        this.lastAttempt = null;
    }

        addUnitToSpawnPool(type: number): void {
        if (type < 0 || type >= SPAWN_POOL_SIZE) {
            return;
        }
        this.units[type] = (this.units[type] ?? 0) + 1;
    }

    addSetToSpawnPool(values: number[]): void {
        const n = Math.min(this.units.length, values.length);
        for (let i = 0; i < n; i++) {
            this.units[i] = (this.units[i] ?? 0) + (values[i] ?? 0);
        }
    }

    setSpawnPool(values: number[]): void {
        const next = emptyPoolArray();
        const n = Math.min(next.length, values.length);
        for (let i = 0; i < n; i++) {
            next[i] = values[i] ?? 0;
        }
        for (let i = 0; i < SPAWN_POOL_SIZE; i++) {
            this.units[i] = next[i];
        }
    }

    addSetToSpawnPoolMax(values: number[]): void {
        const n = Math.min(this.maxUnits.length, values.length);
        for (let i = 0; i < n; i++) {
            this.maxUnits[i] = (this.maxUnits[i] ?? 0) + (values[i] ?? 0);
            this.capConfigured[i] = true;
        }
    }

    setSpawnPoolMax(values: number[]): void {
        const next = emptyPoolArray();
        const n = Math.min(next.length, values.length);
        for (let i = 0; i < n; i++) {
            next[i] = values[i] ?? 0;
        }
        for (let i = 0; i < SPAWN_POOL_SIZE; i++) {
            this.maxUnits[i] = next[i];
            this.capConfigured[i] = true;
        }
    }

    /** 进入第 N 波（从 1 起算）时执行波次等于 N 的动作。 */
    performActionsForWave(wave: number): void {
        for (const action of this.actions) {
            if (action.wave !== wave) {
                continue;
            }
            switch (action.action) {
                case SPAWN_POOL_ADD:
                    this.addSetToSpawnPool(action.units);
                    break;
                case SPAWN_POOL_SET:
                    this.setSpawnPool(action.units);
                    break;
                case SPAWN_POOL_ADD_CAP:
                    this.addSetToSpawnPoolMax(action.units);
                    break;
                case SPAWN_POOL_SET_CAP:
                    this.setSpawnPoolMax(action.units);
                    break;
            }
        }
    }

    canPickType(type: number): boolean {
        if (type < 0 || type >= SPAWN_POOL_SIZE) {
            return false;
        }
        if ((this.units[type] ?? 0) <= 0) {
            return false;
        }
        // apk SpawnPoolManager L121：maxUnits 初值全 0，只有波次里的上限动作能抬高，
        // 没配上限的编号在原版永远走不出营地。
        if ((this.unitsSpawned[type] ?? 0) >= (this.maxUnits[type] ?? 0)) {
            return false;
        }
        return true;
    }

    /**
     * 计时减 dt。到点后从随机编号起转一圈抽人。
     * 有空垫子才扣剩余、已刷 +1；没有空垫子不扣数量，计时仍然重置。
     */
    update(dtMs: number, mats: SpawnMat[], rng: Rng): SpawnAttempt | null {
        let dt = dtMs;
        if (dt < 0) {
            dt = 0;
        } else if (dt > 100) {
            dt = 100;
        }
        this.spawnPoolTimer = Math.trunc(this.spawnPoolTimer - dt);
        if (this.spawnPoolTimer >= 0) {
            return null;
        }
        const attempt = this.trySpawn(mats, rng);
        this.lastAttempt = attempt;
        this.spawnPoolTimer = this.spawnPoolTimerMax;
        return attempt;
    }

    private trySpawn(mats: SpawnMat[], rng: Rng): SpawnAttempt {
        const empty: SpawnAttempt = {
            tried: true,
            type: -1,
            spawned: false,
            col: 0,
            row: 0,
            fineX: 0,
            fineY: 0,
            consumed: false,
        };
        let left = SPAWN_POOL_SIZE;
        let type = rng.int(SPAWN_POOL_SIZE);
        let found = false;
        while (!found && left > 0) {
            if (this.canPickType(type)) {
                found = true;
            } else {
                type = (type + 1) % SPAWN_POOL_SIZE;
                left -= 1;
            }
        }
        if (!found) {
            return empty;
        }
        empty.type = type;
        const free: SpawnMat[] = [];
        for (const mat of mats) {
            if (isFreeMat(mat, type)) {
                free.push(mat);
            }
        }
        if (free.length === 0) {
            return empty;
        }
        // apk SpawnPoolManager.update 里 locationNr 从不递减，实际总是取第一个空闲垫子。
        const mat = free[0];
        mat.spawningMode = true;
        this.units[type] = (this.units[type] ?? 0) - 1;
        this.unitsSpawned[type] = (this.unitsSpawned[type] ?? 0) + 1;
        return {
            tried: true,
            type,
            spawned: true,
            col: mat.col,
            row: mat.row,
            fineX: matCenterFineX(mat.col),
            fineY: matCenterFineY(mat.row),
            consumed: true,
        };
    }
}

export function actionsForLevel(all: readonly SpawnPoolAction[], level: number): SpawnPoolAction[] {
    return all.filter((a) => a.level === level);
}

void FINE_PER_TILE;
void HALF_TILE;
