import {
    TURN_TABLE,
    entryDir,
    isExitByte,
    isJunctionByte,
    isSpawnByte,
    junctionIndex,
} from './EnemyCatalog';

export const ACTION_SPAWN = 1;
export const ACTION_JUNCTION = 2;
export const ACTION_EXIT = 3;

export interface Redirector {
    fullX: number;
    fullY: number;
    action: number;
    actionID: number;
}

export interface RawGrid {
    cols: number;
    rows: number;
    raw: Uint8Array | number[];
}

function toShort(n: number): number {
    let v = n % 65536;
    if (v < 0) {
        v += 65536;
    }
    if (v >= 32768) {
        v -= 65536;
    }
    return v;
}

function dirToActionId(dirX: number, dirY: number): number {
    if (dirX > 0) {
        return 3;
    }
    if (dirX < 0) {
        return 2;
    }
    if (dirY > 0) {
        return 1;
    }
    return 0;
}

/** 与 EnemyDirectorField.directionMapping 一致：0 北 1 南 2 西 3 东，其后是路口多方向。 */
export const DIRECTION_MAPPING: Array<Array<{ x: number; y: number }>> = TURN_TABLE;

export function collectRedirectors(maps: RawGrid): Redirector[] {
    const points: Redirector[] = [];
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const byte = maps.raw[row * maps.cols + col] & 255;
            if (isSpawnByte(byte)) {
                const dir = entryDir(col, row, maps.cols, maps.rows);
                points.push({ fullX: col, fullY: row, action: ACTION_SPAWN, actionID: dirToActionId(dir.x, dir.y) });
            } else if (isJunctionByte(byte)) {
                points.push({ fullX: col, fullY: row, action: ACTION_JUNCTION, actionID: junctionIndex(byte) });
            } else if (isExitByte(byte)) {
                points.push({ fullX: col, fullY: row, action: ACTION_EXIT, actionID: 0 });
            }
        }
    }
    return points;
}

/**
 * 优先路：从每个出生点沿进图方向递归到出口。
 * 出口格 255，往回每格减 1，越靠近出口越大。没走到的格是 0。
 * 只用于选目标和击杀位置分，不改玩家走路。
 */
export class PriorityMap {
    readonly cols: number;
    readonly rows: number;
    readonly map: number[];
    /** Java 只在路口分支更新；位置分改用全图写入过的最小值。 */
    javaMinValue = 255;
    minValue = 255;

    constructor(maps: RawGrid) {
        this.cols = maps.cols;
        this.rows = maps.rows;
        this.map = new Array(maps.cols * maps.rows).fill(0);
        const points = collectRedirectors(maps);
        for (const spawn of points) {
            if (spawn.action === ACTION_SPAWN) {
                this.startLengthTracking(spawn, points);
            }
        }
        this.minValue = this.computeWrittenMin();
    }

    private computeWrittenMin(): number {
        let min = 255;
        let found = false;
        for (const v of this.map) {
            if (v > 0 && v < min) {
                min = v;
                found = true;
            }
        }
        return found ? min : this.javaMinValue;
    }

    private at(col: number, row: number): number {
        return this.map[row * this.cols + col];
    }

    private setIfGreater(col: number, row: number, value: number): void {
        const i = row * this.cols + col;
        if (this.map[i] < value) {
            this.map[i] = value;
        }
    }

    private findPoint(points: Redirector[], col: number, row: number): Redirector | null {
        for (const p of points) {
            if (p.fullX === col && p.fullY === row) {
                return p;
            }
        }
        return null;
    }

    /**
     * 起点分数参数是 0，方向用出生点朝地图里面的方向。
     * 出生格本身也按退回后的分数写入，保证沿途每一格都有分。
     */
    private startLengthTracking(spawn: Redirector, points: Redirector[]): void {
        const dirs = DIRECTION_MAPPING[spawn.actionID] ?? [{ x: 1, y: 0 }];
        for (const d of dirs) {
            let p13 = this.recursiveLengthTracking(spawn.fullX, spawn.fullY, d.x, d.y, 0, points, 0);
            p13 = toShort(p13 - 1);
            if (this.javaMinValue > p13) {
                this.javaMinValue = p13;
            }
            this.setIfGreater(spawn.fullX, spawn.fullY, p13);
        }
    }

    private recursiveLengthTracking(
        x: number,
        y: number,
        dx: number,
        dy: number,
        length: number,
        points: Redirector[],
        depth: number,
    ): number {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) {
            return length;
        }
        if (depth > this.cols * this.rows + 2) {
            return length;
        }
        const here = this.findPoint(points, nx, ny);
        let isExit = false;
        let isJunction = false;
        if (here) {
            if (here.action === ACTION_EXIT) {
                isExit = true;
            }
            if (here.action === ACTION_JUNCTION) {
                isJunction = true;
            }
        }
        let p13 = length;
        if (isExit) {
            p13 = 255;
            this.setIfGreater(nx, ny, 255);
        } else if (isJunction && here) {
            const dirs = DIRECTION_MAPPING[here.actionID] ?? [];
            for (const d of dirs) {
                p13 = toShort(this.recursiveLengthTracking(nx, ny, d.x, d.y, p13, points, depth + 1) - 1);
                if (this.javaMinValue > p13) {
                    this.javaMinValue = p13;
                }
                this.setIfGreater(nx, ny, p13);
            }
        } else {
            p13 = toShort(this.recursiveLengthTracking(nx, ny, dx, dy, p13, points, depth + 1) - 1);
            this.setIfGreater(nx, ny, p13);
        }
        return p13;
    }

    /** 出界是 -1。图内没走到仍是 0。 */
    getPrio(col: number, row: number): number {
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
            return -1;
        }
        return this.at(col, row);
    }

    /**
     * 位置分 = 1500 - (这一格优先路 - 全图最小优先路) × 1000 / (255 - 全图最小优先路)。
     * 越靠近出口优先路越大，位置分越低。
     */
    positionScore(col: number, row: number): number {
        const pri = this.getPrio(col, row);
        if (pri <= 0) {
            return 1500;
        }
        const minPri = this.minValue;
        const denom = 255 - minPri;
        if (denom <= 0) {
            return 1500;
        }
        return 1500 - Math.trunc((pri - minPri) * 1000 / denom);
    }
}
