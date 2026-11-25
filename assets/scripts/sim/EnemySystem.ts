import { FINE_PER_TILE, HALF_TILE, Rng, defaultRng, fullXOf, fullYOf, passesFieldCenter, tileCenterX, tileCenterY } from './Fine';
import { LEAK_VIBRATE_MS, vibrateIfEnabled } from '../platform/Vibrate';
import { playGameSfx } from './SoundEvents';
import { CollisionBox, boxesOverlap, enemyBox, moveBox, relocateBox } from './Collision';
import { TerrainMapsLike } from './WalkGrid';
// 拐弯动画时长和方位→帧号判定来自视图层的贴图/动画表（apk enemyDesignData[·][7] 与 setTurningFrame）。
import { ENEMY_TURN_MS } from '../view/units/UnitCatalog';
import { cardinalFromDelta, turnPose } from '../view/units/Facing';
import {
    DIFFICULTY_START,
    DOCTOR_TYPE,
    ENEMY_STATS,
    EnemyStats,
    HEAL_DELAY_MS,
    HEAL_VFX_MS,
    LEAVE_AFTER_CENTERS,
    MODE_NORMAL,
    OFF_MAP_TILES,
    STAR_SHAKE_MAX_MS,
    STAR_SHAKE_PER_LIFE,
    TURN_TABLE,
    calcHpFactor,
    calcMaxHp,
    calcSpeed,
    canDoctorHealTarget,
    doctorHealAmount,
    entryDir,
    isExitByte,
    isJunctionByte,
    isSpawnByte,
    junctionIndex,
    leakPenalty,
    levelHpFactorForMode,
    spawnSlot,
} from './EnemyCatalog';

export interface RawMaps extends TerrainMapsLike {
    raw: Uint8Array | number[];
}

export interface EnemyEntity {
    id: number;
    type: number;
    groupId: number;
    indexInGroup: number;
    fineX: number;
    fineY: number;
    /** 只影响画在哪，不参加拐弯和碰撞。移民四角、马的 2880 都在这里。 */
    drawOffX: number;
    drawOffY: number;
    /** 马有一半概率是白马（horse_wagon_white）。 */
    white: boolean;
    prevFineX: number;
    prevFineY: number;
    fullX: number;
    fullY: number;
    xDir: number;
    yDir: number;
    speed: number;
    speedMul: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    leaked: boolean;
    /** -1 还没到出口；到了出口是 2，再过两个中心后漏掉。 */
    leaveCenters: number;
    /** 官方 turningAnimationCounter：拐弯时冻结走路帧的剩余毫秒（enemyDesignData[unit-1][7]）。 */
    turnMs?: number;
    /** 官方 animFrame / mMirrored：setTurningFrame 一次性写好的转向横条帧号与镜像。 */
    turnFrame?: number;
    turnFlip?: boolean;
    occupyCol: number;
    occupyRow: number;
    box: CollisionBox;
    stats: EnemyStats;
    frozenThisFrame: boolean;
    maxSpeed: number;
    /** 轻武器、火焰、重武器、毒。 */
    pierce: [number, number, number, number];
    damageOverTime: number;
    damageOverTimeCounter: number;
    poisoned: boolean;
    damagePoison: number;
    slowDownTimeCounter: number;
    deathAnimationStyle: number;
    deathAnimationCounter: number;
    wagonPartsCreated: boolean;
    showHealFx: boolean;
    healTimeCounter: number;
    hpFactor: number;
    healTimer: number;
    isBeingHealed: boolean;
    isHealingOthers: boolean;
}

export interface SpawnPoint {
    col: number;
    row: number;
    slot: number;
    dirX: number;
    dirY: number;
}

export interface SpawnRequest {
    types: number[];
    slot?: number;
}

export interface SpawnResult {
    spawned: boolean;
    /** 失败时这一次等待要乘的系数，成功时按类型系数。 */
    waitMul: number;
    enemies: EnemyEntity[];
}

/** 官方 addEnemyAtSpawnPoint：移民/医生在退后 2 格的中心再落到这四个角之一。 */
export const SETTLER_SPAWN_CORNERS: ReadonlyArray<readonly [number, number]> = [
    [-2560, -2080],
    [2560, -2080],
    [-2560, 4000],
    [2560, 4000],
];

/** 官方骑兵、头目、马和车子在出生坐标上再加的偏移。 */
export const MOUNTED_SPAWN_OFFSET: readonly [number, number] = [0, 2880];

export interface EnemySystemOptions {
    maps: RawMaps;
    rng?: Rng;
    lives?: number;
    difficulty?: number;
    mode?: number;
    levelHpEasy?: number;
    levelHpMid?: number;
    levelHpHard?: number;
    waveHpFactor?: number;
    waveSpeedFactor?: number;
    vibrateOn?: boolean;
}

export class EnemySystem {
    readonly maps: RawMaps;
    readonly spawnPoints: SpawnPoint[] = [];
    readonly enemies: EnemyEntity[] = [];
    lives: number;
    maxLives: number;
    starShakeMs = 0;
    vibrateMs = 0;
    vibrateOn: boolean;
    difficulty: number;
    mode: number;
    waveHpFactor: number;
    waveSpeedFactor: number;
    levelHpEasy: number;
    levelHpMid: number;
    levelHpHard: number;
    leakedTypes: number[] = [];
    rng: Rng;
    private nextId = 1;
    private nextGroup = 1;
    private occupied = new Map<string, number>();

    constructor(opts: EnemySystemOptions) {
        this.maps = opts.maps;
        this.rng = opts.rng ?? defaultRng;
        this.lives = opts.lives ?? 50;
        this.maxLives = this.lives;
        this.difficulty = opts.difficulty ?? DIFFICULTY_START;
        this.mode = opts.mode ?? MODE_NORMAL;
        this.levelHpEasy = opts.levelHpEasy ?? 100;
        this.levelHpMid = opts.levelHpMid ?? 125;
        this.levelHpHard = opts.levelHpHard ?? 155;
        this.waveHpFactor = opts.waveHpFactor ?? 70;
        this.waveSpeedFactor = opts.waveSpeedFactor ?? 100;
        this.vibrateOn = !!opts.vibrateOn;
        this.spawnPoints = collectSpawnPoints(opts.maps);
    }

    levelHpFactor(): number {
        return levelHpFactorForMode(this.mode, this.levelHpEasy, this.levelHpMid, this.levelHpHard);
    }

    private rawAt(col: number, row: number): number {
        if (col < 0 || row < 0 || col >= this.maps.cols || row >= this.maps.rows) {
            return -1;
        }
        return this.maps.raw[row * this.maps.cols + col] & 255;
    }

    pointsForSlot(slot: number): SpawnPoint[] {
        const all = this.spawnPoints.filter((p) => p.slot === slot);
        return all.length ? all : this.spawnPoints;
    }

    pickSpawnPoint(slot = 0): SpawnPoint | null {
        const list = this.pointsForSlot(slot);
        if (list.length === 0) {
            return null;
        }
        if (list.length === 1) {
            return list[0];
        }
        return list[this.rng.int(list.length)];
    }

    /** 出生点外面、逆着进图方向的那一格。第 1 关是第 -1 列。 */
    outsideCell(point: SpawnPoint): { col: number; row: number } {
        return { col: point.col - point.dirX, row: point.row - point.dirY };
    }

    private collidingEnemyOnCell(col: number, row: number): EnemyEntity | null {
        for (const e of this.enemies) {
            if (!e.alive) {
                continue;
            }
            const left = Math.floor(e.box.startX / FINE_PER_TILE);
            const right = Math.floor((e.box.endX - 1) / FINE_PER_TILE);
            const top = Math.floor(e.box.startY / FINE_PER_TILE);
            const bottom = Math.floor((e.box.endY - 1) / FINE_PER_TILE);
            if (col >= left && col <= right && row >= top && row <= bottom) {
                return e;
            }
        }
        return null;
    }

    /**
     * 尝试在出生点放一组。骑兵、车、头目发现外面那一格有带碰撞的敌人时失败，等待减半再乘类型系数。
     * 移民和医生不查这一格。
     */
    trySpawnGroup(types: number[], slot = 0): SpawnResult {
        const point = this.pickSpawnPoint(slot);
        const typ0 = types[0] ?? 1;
        const stats0 = ENEMY_STATS[typ0];
        const baseMul = stats0?.spawnIntervalMul ?? 1;
        if (!point) {
            return { spawned: false, waitMul: 0.5 * baseMul, enemies: [] };
        }
        const needsCheck = types.some((t) => ENEMY_STATS[t]?.checksSpawnOutside);
        if (needsCheck) {
            const out = this.outsideCell(point);
            if (this.collidingEnemyOnCell(out.col, out.row)) {
                return { spawned: false, waitMul: 0.5 * baseMul, enemies: [] };
            }
        }
        const created: EnemyEntity[] = [];
        const usedCorners = [false, false, false, false];
        const offsets: Array<readonly [number, number]> = types.map((type) => this._spawnOffset(type, usedCorners));
        // 同一组（马＋车）必须用同一个速度骰子，否则走两步就错位。
        const speedRoll = this.rng.int(20);
        const white = this.rng.int(2) === 1;
        let groupId = 0;
        for (let i = 0; i < types.length; i++) {
            const type = types[i];
            // apk addEnemyAtSpawnPoint：每个 addEnemy 都 nextGroup=true，只有马(8)带 nextGroup=false，
            // 所以只有“马＋篷车/驿马车/金车”同一个 unitGroup，同批的其它人各自独立成组。
            const followsHorse = i > 0 && types[i - 1] === 8;
            if (!followsHorse) {
                groupId = this.nextGroup++;
            }
            // 官方：人从出生点中心沿进图反方向退 2 格；马在前，篷车/驿马车/金车再退 1 格。
            // 四角和 (0, 2880) 只是绘制偏移，走路坐标仍在路的中线上，否则会偏到旁边那一行，错过路口。
            const back = isVehicleType(type) ? 3 : 2;
            const off = offsets[i] ?? [0, 0];
            const enemy = this.createEnemy(type, groupId, i, point, back, off[0], off[1], speedRoll, white);
            created.push(enemy);
            this.enemies.push(enemy);
        }
        return { spawned: true, waitMul: baseMul, enemies: created };
    }

    createEnemy(
        type: number,
        groupId: number,
        index: number,
        point: SpawnPoint,
        tilesBack: number,
        offX = 0,
        offY = 0,
        speedRoll?: number,
        whiteHorse?: boolean,
    ): EnemyEntity {
        const stats = ENEMY_STATS[type] ?? ENEMY_STATS[1];
        const roll = speedRoll ?? this.rng.int(20);
        const speed = calcSpeed(stats.speed, this.waveSpeedFactor, roll);
        const hpFactor = calcHpFactor(this.difficulty, this.levelHpFactor(), this.waveHpFactor);
        const maxHp = calcMaxHp(stats.hp, this.difficulty, this.levelHpFactor(), this.waveHpFactor);
        const fineX = tileCenterX(point.col) - point.dirX * tilesBack * FINE_PER_TILE;
        const fineY = tileCenterY(point.row) - point.dirY * tilesBack * FINE_PER_TILE;
        const id = this.nextId++;
        const enemy: EnemyEntity = {
            id,
            type,
            groupId,
            indexInGroup: index,
            fineX,
            fineY,
            drawOffX: offX,
            drawOffY: offY,
            white: type === 8 ? whiteHorse ?? this.rng.int(2) === 1 : false,
            prevFineX: fineX,
            prevFineY: fineY,
            fullX: fullXOf(fineX),
            fullY: fullYOf(fineY),
            xDir: point.dirX,
            yDir: point.dirY,
            speed,
            speedMul: 1,
            hp: maxHp,
            maxHp,
            alive: true,
            leaked: false,
            leaveCenters: -1,
            turnMs: 0,
            turnFrame: 0,
            turnFlip: false,
            occupyCol: -999,
            occupyRow: -999,
            box: enemyBox(fineX, fineY, id),
            stats,
            frozenThisFrame: false,
            maxSpeed: speed,
            pierce: stats.pierce.slice() as [number, number, number, number],
            damageOverTime: 0,
            damageOverTimeCounter: 0,
            poisoned: false,
            damagePoison: 0,
            slowDownTimeCounter: 0,
            deathAnimationStyle: 0,
            deathAnimationCounter: 0,
            wagonPartsCreated: false,
            showHealFx: false,
            healTimeCounter: 0,
            hpFactor,
            healTimer: 0,
            isBeingHealed: false,
            isHealingOthers: false,
        };
        relocateEnemyBox(enemy);
        return enemy;
    }

    /** 自检或预览：不走出生失败检查，直接按给定坐标和方向放一个。 */
    addFixture(opts: { type: number; fineX?: number; fineY?: number; col?: number; row?: number; xDir?: number; yDir?: number; groupId?: number; index?: number; speed?: number }): EnemyEntity {
        const point: SpawnPoint = {
            col: opts.col ?? 0,
            row: opts.row ?? 0,
            slot: 0,
            dirX: opts.xDir ?? 1,
            dirY: opts.yDir ?? 0,
        };
        const groupId = opts.groupId ?? this.nextGroup++;
        const enemy = this.createEnemy(opts.type, groupId, opts.index ?? 0, point, 0);
        if (opts.fineX !== undefined) {
            enemy.fineX = opts.fineX;
        }
        if (opts.fineY !== undefined) {
            enemy.fineY = opts.fineY;
        }
        if (opts.speed !== undefined) {
            enemy.speed = opts.speed;
            enemy.maxSpeed = opts.speed;
        }
        enemy.prevFineX = enemy.fineX;
        enemy.prevFineY = enemy.fineY;
        enemy.fullX = fullXOf(enemy.fineX);
        enemy.fullY = fullYOf(enemy.fineY);
        relocateEnemyBox(enemy);
        this.enemies.push(enemy);
        return enemy;
    }

    /** 车被打爆后，按偏移在四个角洒出移民，方向沿车子原来的方向。 */
    spillSettlers(wagon: EnemyEntity, count: number): EnemyEntity[] {
        const offs: Array<[number, number]> = [
            [-1280, -1760],
            [1280, -1760],
            [-1280, 800],
            [1280, 800],
        ];
        const out: EnemyEntity[] = [];
        const dirX = wagon.xDir !== 0 ? Math.trunc(wagon.xDir / Math.abs(wagon.xDir)) : 0;
        const dirY = wagon.yDir !== 0 ? Math.trunc(wagon.yDir / Math.abs(wagon.yDir)) : 0;
        const n = count < 0 ? 0 : count > 4 ? 4 : count;
        for (let i = 0; i < n; i++) {
            const typ = this.rng.int(2) + 1;
            const spawned = this.addFixture({
                type: typ,
                fineX: wagon.fineX,
                fineY: wagon.fineY,
                xDir: dirX,
                yDir: dirY,
            });
            spawned.drawOffX = offs[i][0];
            spawned.drawOffY = offs[i][1];
            out.push(spawned);
        }
        return out;
    }

    removeDead(enemy: EnemyEntity): void {
        this.releaseOccupy(enemy);
        const i = this.enemies.indexOf(enemy);
        if (i >= 0) {
            this.enemies.splice(i, 1);
        }
    }

    private _spawnOffset(type: number, usedCorners: boolean[]): readonly [number, number] {
        if (isSettlerOrDoctor(type)) {
            for (let guard = 0; guard < 16; guard++) {
                const i = this.rng.int(4);
                if (!usedCorners[i]) {
                    usedCorners[i] = true;
                    return SETTLER_SPAWN_CORNERS[i];
                }
            }
            const fallback = usedCorners.findIndex((used) => !used);
            const i = fallback >= 0 ? fallback : 0;
            usedCorners[i] = true;
            return SETTLER_SPAWN_CORNERS[i];
        }
        if (isMountedSpawn(type)) {
            return MOUNTED_SPAWN_OFFSET;
        }
        return [0, 0];
    }

    tick(dtMs: number): void {
        if (dtMs <= 0) {
            return;
        }
        if (this.starShakeMs > 0) {
            this.starShakeMs = Math.max(0, this.starShakeMs - dtMs);
        }
        if (this.vibrateMs > 0) {
            this.vibrateMs = Math.max(0, this.vibrateMs - dtMs);
        }
        for (const e of this.enemies) {
            e.frozenThisFrame = false;
        }
        const groups = this.groupOrder();
        for (const members of groups) {
            for (let i = 0; i < members.length; i++) {
                const e = members[i];
                if (!e.alive || e.frozenThisFrame) {
                    continue;
                }
                this.tickOne(e, members[i - 1], members[i + 1], dtMs);
            }
        }
        tickDoctorHeals(this.enemies, dtMs);
    }

    private groupOrder(): EnemyEntity[][] {
        const map = new Map<number, EnemyEntity[]>();
        for (const e of this.enemies) {
            if (!e.alive) {
                continue;
            }
            const list = map.get(e.groupId) ?? [];
            list.push(e);
            map.set(e.groupId, list);
        }
        const groups: EnemyEntity[][] = [];
        map.forEach((list) => {
            list.sort((a, b) => a.indexInGroup - b.indexInGroup);
            groups.push(list);
        });
        return groups;
    }

    private tickOne(e: EnemyEntity, leader: EnemyEntity | undefined, follower: EnemyEntity | undefined, dtMs: number): void {
        const step = Math.trunc((e.xDir * e.speed * e.speedMul * dtMs) / 100);
        const stepY = Math.trunc((e.yDir * e.speed * e.speedMul * dtMs) / 100);
        const oldX = e.fineX;
        const oldY = e.fineY;
        e.prevFineX = oldX;
        e.prevFineY = oldY;
        e.fineX += step;
        e.fineY += stepY;
        relocateEnemyBox(e);

        const heldXDir = e.xDir;
        const heldYDir = e.yDir;
        e.fullX = fullXOf(e.fineX);
        e.fullY = fullYOf(e.fineY);

        // apk moveEnemys L204-282：跨格中心那一帧才依次做 —— 先查路口改方向，
        // 再测前方碰撞 / 抢占下一个路口，撞了就 undoMove 回到帧首坐标并冻住同组后一辆。
        // 原版平时照常前进，所以排队车辆停在路口前一格的中心，车间隔恒定 1 格。
        if (passesFieldCenter(oldX, oldY, e.fineX, e.fineY)) {
            this.onPassedCenter(e, leader);
            if (e.stats.collision && this.hitsAnother(e)) {
                this.undoMove(e, oldX, oldY, heldXDir, heldYDir);
                if (follower) {
                    follower.frozenThisFrame = true;
                }
            } else if (e.stats.occupiesJunction) {
                // apk L256-278 用的是 getXDirection()，是符号而不是 xDir 本身：
                // 车队被拉长后分量可能大于 1，用 xDir 会看错到隔几格的路口。
                const nextCol = e.fullX + Math.sign(e.xDir);
                const nextRow = e.fullY + Math.sign(e.yDir);
                if (isJunctionByte(this.rawAt(nextCol, nextRow))) {
                    const key = cellKey(nextCol, nextRow);
                    const owner = this.occupied.get(key);
                    if (owner !== undefined && owner !== e.id) {
                        this.undoMove(e, oldX, oldY, heldXDir, heldYDir);
                        if (follower) {
                            follower.frozenThisFrame = true;
                        }
                    } else {
                        this.releaseOccupy(e);
                        this.occupied.set(key, e.id);
                        e.occupyCol = nextCol;
                        e.occupyRow = nextRow;
                    }
                }
            }
        }

        // apk GameObjectEnemy.move() L315-323 的递减早于 L325 的画图判定，所以这一句和位置积分同帧做，
        // 即使这一帧在跨格中心被改向或抢占打断也不跳过。
        if ((e.turnMs ?? 0) > 0) {
            e.turnMs = Math.max(0, (e.turnMs ?? 0) - dtMs);
        }

        if (!e.alive) {
            return;
        }

        // apk EnemyDirector L222：owner 到路口中心就 edf.block(en,false)，
        // 而不是等到下一个路口才释放，否则后面的马车组会被永久卡住。
        if (e.occupyCol === e.fullX && e.occupyRow === e.fullY) {
            this.releaseOccupy(e);
        }

        if (this.isOffMap(e)) {
            this.leak(e);
        }
    }

    /** 官方 GameObjectEnemy.undoMove：回到帧首坐标、还原方向，碰撞盒跟着走。 */
    private undoMove(e: EnemyEntity, oldX: number, oldY: number, oldXDir: number, oldYDir: number): void {
        e.fineX = oldX;
        e.fineY = oldY;
        e.fullX = fullXOf(oldX);
        e.fullY = fullYOf(oldY);
        e.xDir = oldXDir;
        e.yDir = oldYDir;
        relocateEnemyBox(e);
    }

    /** apk：只有 3–8 类敌人在 cmEnemys 里；且 ignoreSameUnitGroup=false，同组（马＋车）互不挡。 */
    private hitsAnother(e: EnemyEntity): boolean {
        for (const other of this.enemies) {
            if (!other.alive || other.id === e.id || !other.stats.collision) {
                continue;
            }
            if (other.groupId === e.groupId) {
                continue;
            }
            if (boxesOverlap(e.box, other.box)) {
                return true;
            }
        }
        return false;
    }

    private onPassedCenter(e: EnemyEntity, _leader: EnemyEntity | undefined): void {
        const col = e.fullX;
        const row = e.fullY;
        const byte = this.rawAt(col, row);
        if (e.leaveCenters >= 0) {
            e.leaveCenters -= 1;
            if (e.leaveCenters <= 0) {
                this.leak(e);
                return;
            }
        } else if (isExitByte(byte)) {
            e.leaveCenters = LEAVE_AFTER_CENTERS;
        }

        if (!e.alive) {
            return;
        }
        // 原版只在路口（redirector action 2，字节 52–65）改方向。普通格子保持当前方向。
        if (!isJunctionByte(byte)) {
            return;
        }
        this.applyJunction(e, byte);
    }

    /** apk EnemyDirector L225-231：只看紧挨在前一个元素，同 unitGroup 才跟。 */
    private previousSameGroup(e: EnemyEntity): EnemyEntity | undefined {
        const index = this.enemies.indexOf(e);
        if (index <= 0) {
            return undefined;
        }
        const prev = this.enemies[index - 1];
        if (prev && prev.alive && prev.groupId === e.groupId) {
            return prev;
        }
        return undefined;
    }

    /**
     * apk moveEnemys L217-238：先从转向表抽一个方向；紧挨着的前一个同组敌人存在时，
     * 直接改成"前一个的格子 - 自己的格子"（原版没有额外避让，格子差可以大于 1）。
     * 然后用 sign(当前方向) 比较，两个分量都不同才 changeEnemyDirection。
     */
    private applyJunction(e: EnemyEntity, byte: number): void {
        const options = TURN_TABLE[junctionIndex(byte)];
        if (!options || options.length === 0) {
            return;
        }
        const pick = options[this.rng.int(options.length)];
        let nx = pick.x;
        let ny = pick.y;
        const prev = this.previousSameGroup(e);
        if (prev) {
            const dx = prev.fullX - e.fullX;
            const dy = prev.fullY - e.fullY;
            if (dx === 0 && dy === 0) {
                // 原版这里会拿到 (0,0) 让敌人原地停住；项目保留“沿用前一个方向”的兜底。
                if (prev.xDir !== e.xDir || prev.yDir !== e.yDir) {
                    nx = prev.xDir;
                    ny = prev.yDir;
                }
            } else {
                nx = dx;
                ny = dy;
            }
        }
        const curX = Math.sign(e.xDir);
        const curY = Math.sign(e.yDir);
        if ((e.xDir !== 0 || e.yDir !== 0) && nx !== curX && ny !== curY) {
            // apk EnemyDirector L232-237：只有方向真的变了才起 turningAnimationCounter = enemyDesignData[unit-1][7]，
            // 并由 setTurningFrame 一次性写好转向横条的帧号和镜像（同轴掉头原版只是把 animFrame 取反，这里保持上一帧）。
            e.turnMs = ENEMY_TURN_MS[e.type] ?? 0;
            const pose = turnPose(cardinalFromDelta(curX, curY), cardinalFromDelta(nx, ny));
            if (pose) {
                e.turnFrame = pose.frame;
                e.turnFlip = pose.flip;
            }
            this.changeEnemyDirection(e, nx, ny);
        }
    }

    /** 官方 changeEnemyDirection。只有分量正好是 ±1 才把坐标收到格子中心再挪 2。 */
    private changeEnemyDirection(e: EnemyEntity, p6: number, p7: number): void {
        const oldX = e.fineX;
        const oldY = e.fineY;
        e.xDir = p6;
        e.yDir = p7;
        e.speedMul = 1;
        if (p6 === 1 || p6 === -1) {
            e.fineY = tileCenterY(e.fullY);
            e.fineX = tileCenterX(e.fullX) + p6 * 2;
        }
        if (p7 === 1 || p7 === -1) {
            e.fineX = tileCenterX(e.fullX);
            e.fineY = tileCenterY(e.fullY) + p7 * 2;
        }
        moveBox(e.box, e.fineX - oldX, e.fineY - oldY);
        relocateEnemyBox(e);
        e.fullX = fullXOf(e.fineX);
        e.fullY = fullYOf(e.fineY);
    }

    private isOffMap(e: EnemyEntity): boolean {
        return e.fullX < -OFF_MAP_TILES
            || e.fullY < -OFF_MAP_TILES
            || e.fullX >= this.maps.cols + OFF_MAP_TILES
            || e.fullY >= this.maps.rows + OFF_MAP_TILES;
    }

    private leak(e: EnemyEntity): void {
        if (!e.alive) {
            return;
        }
        e.alive = false;
        e.leaked = true;
        this.releaseOccupy(e);
        const penalty = leakPenalty(e.type);
        this.leakedTypes.push(e.type);
        if (penalty > 0) {
            this.lives = Math.max(0, this.lives - penalty);
            this.starShakeMs = Math.max(this.starShakeMs, Math.min(penalty * STAR_SHAKE_PER_LIFE, STAR_SHAKE_MAX_MS));
            playGameSfx('leak');
            if (this.vibrateOn) {
                this.vibrateMs = Math.max(this.vibrateMs, LEAK_VIBRATE_MS);
                vibrateIfEnabled(true, LEAK_VIBRATE_MS);
            }
        }
    }

    private releaseOccupy(e: EnemyEntity): void {
        if (e.occupyCol === -999) {
            return;
        }
        const key = cellKey(e.occupyCol, e.occupyRow);
        if (this.occupied.get(key) === e.id) {
            this.occupied.delete(key);
        }
        e.occupyCol = -999;
        e.occupyRow = -999;
    }
}

function cellKey(col: number, row: number): string {
    return `${col},${row}`;
}

function isVehicleType(type: number): boolean {
    return type === 4 || type === 5 || type === 6;
}

function isSettlerOrDoctor(type: number): boolean {
    return type === 1 || type === 2 || type === 9;
}

function isMountedSpawn(type: number): boolean {
    return type === 3 || type === 4 || type === 5 || type === 6 || type === 7 || type === 8;
}

function relocateEnemyBox(e: EnemyEntity): void {
    relocateBox(e.box, e.fineX - 3839, e.fineY - 3839);
    e.box.endX = e.box.startX + 7678;
    e.box.endY = e.box.startY + 7678;
}

export function collectSpawnPoints(maps: RawMaps): SpawnPoint[] {
    const points: SpawnPoint[] = [];
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const byte = maps.raw[row * maps.cols + col] & 255;
            if (!isSpawnByte(byte)) {
                continue;
            }
            const dir = entryDir(col, row, maps.cols, maps.rows);
            points.push({ col, row, slot: spawnSlot(byte), dirX: dir.x, dirY: dir.y });
        }
    }
    return points;
}

export function loadAsciiMap(text: string): RawMaps {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    const header = lines[0];
    const m = /width=(\d+)\s+height=(\d+)/.exec(header);
    const cols = m ? Number(m[1]) : lines[1].length;
    const rows = m ? Number(m[2]) : lines.length - 1;
    const body = m ? lines.slice(1, 1 + rows) : lines.slice(0, rows);
    const raw = new Uint8Array(cols * rows);
    const background = new Array(cols * rows).fill(0);
    const street = new Array(cols * rows).fill(0);
    for (let row = 0; row < rows; row++) {
        const line = body[row] ?? '';
        for (let col = 0; col < cols; col++) {
            let ch = (line.charCodeAt(col) || 32) & 255;
            // 文本示意图里的点号是空地，不是出生点 6。真正的 46 只出现在二进制地图里。
            if (ch === 46) {
                ch = 0;
            }
            raw[row * cols + col] = ch;
        }
    }
    return { cols, rows, raw, background, street };
}

/** 先让所有医生标记目标，再统一加血，避免名单顺序影响同一帧能不能治到。 */
export function tickDoctorHeals(enemies: EnemyEntity[], dtMs: number): void {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    if (dt <= 0) {
        return;
    }
    for (const doctor of enemies) {
        doctor.isHealingOthers = false;
        if (!doctor.alive || doctor.type !== DOCTOR_TYPE) {
            continue;
        }
        doctor.healTimer += dt;
        if (doctor.healTimer > HEAL_DELAY_MS) {
            doctor.healTimer -= HEAL_DELAY_MS;
            for (const target of enemies) {
                if (canDoctorHealTarget(doctor, target)) {
                    target.isBeingHealed = true;
                    doctor.isHealingOthers = true;
                }
            }
            if (doctor.isHealingOthers) {
                playGameSfx('heal');
            }
        }
    }
    for (const enemy of enemies) {
        applyEnemyHeal(enemy, dt);
    }
}

export function applyEnemyHeal(enemy: EnemyEntity, dtMs: number): void {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    enemy.healTimeCounter = Math.trunc(enemy.healTimeCounter - dt);
    if (enemy.healTimeCounter < 0) {
        enemy.healTimeCounter = 0;
        enemy.showHealFx = false;
    }
    if (!enemy.isBeingHealed) {
        if (enemy.isHealingOthers) {
            enemy.healTimeCounter = HEAL_VFX_MS;
        }
    } else {
        if (enemy.alive && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
            enemy.showHealFx = true;
            enemy.hp += doctorHealAmount(enemy.hpFactor);
            if (enemy.hp > enemy.maxHp) {
                enemy.hp = enemy.maxHp;
            }
            enemy.healTimeCounter = HEAL_VFX_MS;
        }
        enemy.isBeingHealed = false;
    }
    enemy.isHealingOthers = false;
}

