/** 模拟坐标：一格 7680 fine，格子中心是 col*7680+3840、row*7680+3840。地图单位落脚再抬 1920，所以 fineY 从 row*7680+5760 起步。fineY 向下增大，和原版一致。 */

export const FINE_PER_TILE = 7680;
export const HALF_TILE = 3840;
export const UNIT_FOOT_Y = 1920;
export const TILE_PIXELS = 32;

export const DIR_EAST = 0;
export const DIR_WEST = 1;
export const DIR_SOUTH = 2;
export const DIR_NORTH = 3;

export const ACTIVITY_IDLE_WANDER = 2;
export const ACTIVITY_GOING_TO_SLEEP = 3;
export const ACTIVITY_FOR_SALE = 4;
export const ACTIVITY_WORKING = 5;
export const ACTIVITY_RETURNING = 6;
export const ACTIVITY_GOING_TO_WORK = 7;

export function tileCenterX(col: number): number {
    return col * FINE_PER_TILE + HALF_TILE;
}

export function tileCenterY(row: number): number {
    return row * FINE_PER_TILE + HALF_TILE;
}

/** 地图物件生成单位时的 fineY：格子中心再加 1920。 */
export function mapUnitFineY(row: number): number {
    return row * FINE_PER_TILE + HALF_TILE + UNIT_FOOT_Y;
}

export function fullXOf(fineX: number): number {
    return Math.floor(fineX / FINE_PER_TILE);
}

export function fullYOf(fineY: number): number {
    return Math.floor(fineY / FINE_PER_TILE);
}

/** 出生垫生成：先按 (fullX*7680+3840, fullY*7680+5760) 再由构造函数加 1920，等于中心再加 3840。这里直接给出最终 fine。 */
export function spawnPadFineY(row: number): number {
    return row * FINE_PER_TILE + HALF_TILE + UNIT_FOOT_Y * 2;
}

export function dirToDelta(dir: number): { x: number; y: number } {
    if (dir === DIR_EAST) {
        return { x: 1, y: 0 };
    }
    if (dir === DIR_WEST) {
        return { x: -1, y: 0 };
    }
    if (dir === DIR_SOUTH) {
        return { x: 0, y: 1 };
    }
    return { x: 0, y: -1 };
}

export function deltaToDir(xDir: number, yDir: number): number {
    if (xDir > 0) {
        return DIR_EAST;
    }
    if (xDir < 0) {
        return DIR_WEST;
    }
    if (yDir > 0) {
        return DIR_SOUTH;
    }
    return DIR_NORTH;
}

export function isOppositeDir(a: number, b: number): boolean {
    return (a === DIR_EAST && b === DIR_WEST)
        || (a === DIR_WEST && b === DIR_EAST)
        || (a === DIR_SOUTH && b === DIR_NORTH)
        || (a === DIR_NORTH && b === DIR_SOUTH);
}

export function nextColRow(col: number, row: number, dir: number): { col: number; row: number } {
    if (dir === DIR_EAST) {
        return { col: col + 1, row };
    }
    if (dir === DIR_WEST) {
        return { col: col - 1, row };
    }
    if (dir === DIR_SOUTH) {
        return { col, row: row + 1 };
    }
    return { col, row: row - 1 };
}

/**
 * 敌人的「过格心」判定：apk GameObjectEnemy.passesFieldCenter() 两轴都用 +15360。
 * EnemySystem 调这个，保持原样。
 */
export function passesFieldCenter(oldX: number, oldY: number, fineX: number, fineY: number): boolean {
    return crossesMid(oldX, fineX) || crossesMid(oldY, fineY);
}

function crossesMid(oldV: number, newV: number): boolean {
    return crossesMidWithOffset(oldV, newV, FINE_PER_TILE * 2);
}

/**
 * 己方单位的「过格心」判定：apk GameObjectUnit.passesFieldCenter() 的 X 轴不加偏移，
 * Y 轴减 UNIT_PLACEMENT_OFFSET_Y(1920)。旧实现两轴都套了敌人的 +15360，
 * 导致出生后重选方向和 3→4、7→5 比原版早 1920 fine（四分之一格）。
 */
export function passesUnitFieldCenter(oldX: number, oldY: number, fineX: number, fineY: number): boolean {
    return crossesMidWithOffset(oldX, fineX, 0)
        || crossesMidWithOffset(oldY, fineY, -UNIT_FOOT_Y);
}

function crossesMidWithOffset(oldV: number, newV: number, offset: number): boolean {
    const oldM = modFine(oldV + offset);
    const newM = modFine(newV + offset);
    if (oldM < HALF_TILE && newM >= HALF_TILE && newV > oldV) {
        return true;
    }
    if (oldM > HALF_TILE && newM <= HALF_TILE && newV < oldV) {
        return true;
    }
    return false;
}

function modFine(v: number): number {
    return ((v % FINE_PER_TILE) + FINE_PER_TILE) % FINE_PER_TILE;
}

/** 显示坐标：fineX 向右，fineY 向下；世界 Y 向上，第 0 行在最上。 */
export function fineToWorld(fineX: number, fineY: number, mapRows: number): { x: number; y: number } {
    return {
        x: (fineX / FINE_PER_TILE) * TILE_PIXELS,
        y: ((mapRows * FINE_PER_TILE - fineY) / FINE_PER_TILE) * TILE_PIXELS,
    };
}

export function worldToFine(worldX: number, worldY: number, mapRows: number): { fineX: number; fineY: number } {
    return {
        fineX: (worldX / TILE_PIXELS) * FINE_PER_TILE,
        fineY: mapRows * FINE_PER_TILE - (worldY / TILE_PIXELS) * FINE_PER_TILE,
    };
}

export interface RngState {
    kind: string;
    [key: string]: unknown;
}

export interface Rng {
    int(n: number): number;
    isFirstRandom?(): boolean;
    getState?(): RngState;
    setState?(state: RngState): void;
    reset?(seed?: number): void;
}

export const defaultRng: Rng = {
    int(n: number): number {
        return Math.floor(Math.random() * n);
    },
};

/** 自检用：按给定序列取值，用完后一直返回 0，保证闲逛每次到中心都会重选。 */
export class ScriptedRng implements Rng {
    private i = 0;
    private used = false;
    private values: number[];

    constructor(values: number[] = []) {
        this.values = values.slice();
    }

    int(n: number): number {
        this.used = true;
        let v = 0;
        if (this.i < this.values.length) {
            v = this.values[this.i];
            this.i += 1;
        }
        if (n <= 0) {
            return 0;
        }
        return ((v % n) + n) % n;
    }

    isFirstRandom(): boolean {
        return !this.used;
    }

    getState(): RngState {
        return {
            kind: 'scripted',
            i: this.i,
            used: this.used,
            values: this.values.slice(),
        };
    }

    setState(state: RngState): void {
        this.i = Number(state.i ?? 0);
        this.used = !!state.used;
        const values = state.values;
        this.values = Array.isArray(values) ? values.map((v) => Number(v)) : [];
    }
}

/** 记下有没有抽过随机，供赌徒第 10 项进池判断。 */
export class TrackingRng implements Rng {
    private used = false;

    constructor(private readonly inner: Rng) {}

    int(n: number): number {
        this.used = true;
        return this.inner.int(n);
    }

    isFirstRandom(): boolean {
        return !this.used;
    }

    get innerRng(): Rng {
        return this.inner;
    }

    getState(): RngState {
        const inner = this.inner.getState?.() ?? { kind: 'unknown' };
        return {
            kind: 'tracking',
            used: this.used,
            inner,
        };
    }

    setState(state: RngState): void {
        this.used = !!state.used;
        const inner = state.inner;
        if (inner && typeof inner === 'object' && this.inner.setState) {
            this.inner.setState(inner as RngState);
        }
    }

    reset(seed?: number): void {
        this.used = false;
        this.inner.reset?.(seed);
    }
}

const LCG_MASK = (1n << 48n) - 1n;
const LCG_MULT = 0x5DEECE66Dn;
const LCG_INC = 0xBn;

/**
 * 开局用当前毫秒做种子，之后每次随机都往前走。
 * 算法按 java.util.Random 的 48 位线性同余，读档只恢复内部种子，不再重新搅拌，这样下一串和存档时接着的一样。
 */
export class JavaMillisRng implements Rng {
    private seed = 0n;

    constructor(seedMs?: number) {
        this.reset(seedMs);
    }

    reset(seedMs?: number): void {
        const raw = BigInt(Math.trunc(seedMs ?? Date.now()));
        this.seed = (raw ^ LCG_MULT) & LCG_MASK;
    }

    /** 直接装上已经搅拌过的内部种子（读档用）。 */
    loadSeed(internal: string | number | bigint): void {
        this.seed = BigInt(internal) & LCG_MASK;
    }

    private next(bits: number): number {
        this.seed = (this.seed * LCG_MULT + LCG_INC) & LCG_MASK;
        return Number(this.seed >> (48n - BigInt(bits)));
    }

    int(n: number): number {
        const bound = Math.trunc(n);
        if (bound <= 0) {
            return 0;
        }
        if ((bound & -bound) === bound) {
            return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
        }
        let bits = 0;
        let val = 0;
        do {
            bits = this.next(31);
            val = bits % bound;
        } while (bits - val + (bound - 1) < 0);
        return val;
    }

    getState(): RngState {
        return {
            kind: 'java-millis',
            seed: this.seed.toString(),
        };
    }

    setState(state: RngState): void {
        const seed = state.seed;
        if (seed === undefined || seed === null) {
            return;
        }
        this.loadSeed(seed as string | number | bigint);
    }
}

export function captureRng(rng: Rng): RngState {
    if (rng.getState) {
        return rng.getState();
    }
    return { kind: 'none' };
}

export function applyRng(rng: Rng, state: RngState | null | undefined): void {
    if (!state || !rng.setState) {
        return;
    }
    rng.setState(state);
}
