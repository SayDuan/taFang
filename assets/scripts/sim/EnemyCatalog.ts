/** 敌军数值、拐弯表、血量速度和漏人扣命。按 敌人规则.tsv。 */

export const DIFFICULTY_START = 1000;
export const MODE_EASY = 0;
export const MODE_NORMAL = 1;
export const MODE_HARD = 2;

export interface EnemyStats {
    type: number;
    name: string;
    speed: number;
    hp: number;
    bounty: number;
    leakPenalty: number;
    /** 出兵间隔系数：车是 2，其他人是 1。 */
    spawnIntervalMul: number;
    /** 骑兵、车、头目要检查出生点外面那一格。 */
    checksSpawnOutside: boolean;
    /** 马、骑兵、头目会占路口。 */
    occupiesJunction: boolean;
    /** apk EnemyDirector：3–8 类才有碰撞对象，移动前要测碰撞。 */
    collision: boolean;
    isHorse: boolean;
    isVehicle: boolean;
    /** 轻武器、火焰、重武器、毒。 */
    pierce: [number, number, number, number];
    killWeight: number;
}

export const ENEMY_STATS: Record<number, EnemyStats> = {
    1: { type: 1, name: '男移民', speed: 500, hp: 18, bounty: 1, leakPenalty: 1, spawnIntervalMul: 1, checksSpawnOutside: false, occupiesJunction: false, collision: false, isHorse: false, isVehicle: false, pierce: [100, 50, 25, 75], killWeight: 1 },
    2: { type: 2, name: '女移民', speed: 500, hp: 18, bounty: 1, leakPenalty: 1, spawnIntervalMul: 1, checksSpawnOutside: false, occupiesJunction: false, collision: false, isHorse: false, isVehicle: false, pierce: [100, 50, 25, 75], killWeight: 1 },
    3: { type: 3, name: '骑兵', speed: 500, hp: 60, bounty: 2, leakPenalty: 1, spawnIntervalMul: 1, checksSpawnOutside: true, occupiesJunction: true, collision: true, isHorse: false, isVehicle: false, pierce: [100, 50, 25, 75], killWeight: 2 },
    4: { type: 4, name: '篷车', speed: 500, hp: 200, bounty: 10, leakPenalty: 2, spawnIntervalMul: 2, checksSpawnOutside: true, occupiesJunction: false, collision: true, isHorse: false, isVehicle: true, pierce: [50, 100, 66, 100], killWeight: 6 },
    5: { type: 5, name: '驿马车', speed: 500, hp: 300, bounty: 15, leakPenalty: 3, spawnIntervalMul: 2, checksSpawnOutside: true, occupiesJunction: false, collision: true, isHorse: false, isVehicle: true, pierce: [50, 100, 66, 100], killWeight: 8 },
    6: { type: 6, name: '金车', speed: 500, hp: 500, bounty: 25, leakPenalty: 4, spawnIntervalMul: 2, checksSpawnOutside: true, occupiesJunction: false, collision: true, isHorse: false, isVehicle: true, pierce: [33, 25, 100, 100], killWeight: 10 },
    7: { type: 7, name: '头目', speed: 500, hp: 2500, bounty: 50, leakPenalty: 10, spawnIntervalMul: 1, checksSpawnOutside: true, occupiesJunction: true, collision: true, isHorse: false, isVehicle: false, pierce: [100, 50, 25, 75], killWeight: 15 },
    8: { type: 8, name: '拉车的马', speed: 500, hp: 200, bounty: 0, leakPenalty: 0, spawnIntervalMul: 1, checksSpawnOutside: false, occupiesJunction: true, collision: true, isHorse: true, isVehicle: false, pierce: [100, 100, 100, 100], killWeight: 1 },
    9: { type: 9, name: '医生', speed: 500, hp: 30, bounty: 3, leakPenalty: 1, spawnIntervalMul: 1, checksSpawnOutside: false, occupiesJunction: false, collision: false, isHorse: false, isVehicle: false, pierce: [100, 50, 15, 10], killWeight: 1 },
};

/** 转向表 0–13，对应地图字节 52–65（字符 4 到 A）。 */
export const TURN_TABLE: Array<Array<{ x: number; y: number }>> = [
    [{ x: 0, y: -1 }],
    [{ x: 0, y: 1 }],
    [{ x: -1, y: 0 }],
    [{ x: 1, y: 0 }],
    [{ x: 0, y: -1 }, { x: -1, y: 0 }],
    [{ x: 0, y: -1 }, { x: 1, y: 0 }],
    [{ x: 0, y: -1 }, { x: 0, y: 1 }],
    [{ x: -1, y: 0 }, { x: 1, y: 0 }],
    [{ x: -1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }],
    [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }],
    [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: -1, y: 0 }],
];

export const JUNCTION_BYTE_MIN = 52;
export const JUNCTION_BYTE_MAX = 65;
export const EXIT_BYTE = 48; // 字符 '0'
export const SPAWN_BYTE_MIN = 40; // 字符 '('
export const SPAWN_BYTE_MAX = 46; // 字符 '.'

export function junctionIndex(byte: number): number {
    if (byte < JUNCTION_BYTE_MIN || byte > JUNCTION_BYTE_MAX) {
        return -1;
    }
    return byte - JUNCTION_BYTE_MIN;
}

export function isJunctionByte(byte: number): boolean {
    return junctionIndex(byte) >= 0;
}

export function isExitByte(byte: number): boolean {
    return byte === EXIT_BYTE;
}

export function isSpawnByte(byte: number): boolean {
    return byte >= SPAWN_BYTE_MIN && byte <= SPAWN_BYTE_MAX;
}

export function spawnSlot(byte: number): number {
    return byte - SPAWN_BYTE_MIN;
}

/** 贴左朝右，贴右朝左，贴上朝下，贴下朝上。同时贴两条边时后判断的覆盖先判断的，上边缘最后生效。 */
export function entryDir(col: number, row: number, cols: number, rows: number): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (col <= 0) {
        x = 1;
        y = 0;
    }
    if (col >= cols - 1) {
        x = -1;
        y = 0;
    }
    if (row >= rows - 1) {
        x = 0;
        y = -1;
    }
    if (row <= 0) {
        x = 0;
        y = 1;
    }
    if (x === 0 && y === 0) {
        x = 1;
    }
    return { x, y };
}

/** 整数除法，跟 Java 一样向 0 取整。 */
export function idiv(a: number, b: number): number {
    return Math.trunc(a / b);
}

export const DOCTOR_TYPE = 9;
export const HORSE_TYPE = 8;
/** 距离平方用「fine×10÷7680」再平方，900 表示整整 3 格；Java 用小于 900。 */
export const HEAL_SQUARE_RANGE = 900;
/** 医生与车子表：治疗间隔常数是 0，活着时每帧都找一次。 */
export const HEAL_DELAY_MS = 0;
/** Java / 医生与车子.tsv：治疗特效计时 699 毫秒。画面帧公式仍按 700。 */
export const HEAL_VFX_MS = 699;

/**
 * 血量系数 = 难度 ×（关卡血量系数 × 波次血量系数 ÷ 100）× 2 ÷ 10。
 * 第 1 关普通难度（中等血量系数 125）、第 1 波 70、难度 1000 时是 17400。
 */
export function calcHpFactor(difficulty: number, levelHpFactor: number, waveHpFactor: number): number {
    const p11 = idiv(levelHpFactor * waveHpFactor, 100);
    return idiv(difficulty * p11 * 2, 10);
}

/** 最大血 = 基础血 × 血量系数 ÷ 2000，至少 1。 */
export function calcMaxHp(baseHp: number, difficulty: number, levelHpFactor: number, waveHpFactor: number): number {
    const hp = idiv(baseHp * calcHpFactor(difficulty, levelHpFactor, waveHpFactor), 2000);
    return hp < 1 ? 1 : hp;
}

/** 每帧回复量 = hpFactor × 4 ÷ 2000，不乘 dt。hpFactor 17400 时是 34。 */
export function doctorHealAmount(hpFactor: number): number {
    return idiv(hpFactor * 4, 2000);
}

/** 和瞄准距离同一套换算：10 表示一格。 */
export function healDistSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.trunc((ax * 10) / 7680) - Math.trunc((bx * 10) / 7680);
    const dy = Math.trunc((ay * 10) / 7680) - Math.trunc((by * 10) / 7680);
    return dx * dx + dy * dy;
}

export interface HealSubject {
    type: number;
    alive: boolean;
    hp: number;
    maxHp: number;
    fineX: number;
    fineY: number;
}

/**
 * 医生找谁：还活着、不是马、血没满、距离平方小于 900。
 * 只扫敌军列表，所以不会给玩家单位加血。
 */
export function canDoctorHealTarget(doctor: HealSubject, target: HealSubject): boolean {
    if (!target.alive || target.hp <= 0) {
        return false;
    }
    if (target.type === HORSE_TYPE) {
        return false;
    }
    if (target.hp >= target.maxHp) {
        return false;
    }
    return healDistSq(doctor.fineX, doctor.fineY, target.fineX, target.fineY) < HEAL_SQUARE_RANGE;
}

/** 最终速度 = 基础速度 ×（波次速度系数 × (90..109)）÷ 100 ÷ 100。 */
export function calcSpeed(baseSpeed: number, waveSpeedFactor: number, roll0to19: number): number {
    const jitter = roll0to19 + 90;
    const p14 = idiv(waveSpeedFactor * jitter, 100);
    return idiv(baseSpeed * p14, 100);
}

export function levelHpFactorForMode(mode: number, easy: number, mid: number, hard: number): number {
    if (mode === MODE_EASY) {
        return easy;
    }
    if (mode === MODE_HARD) {
        return hard;
    }
    return mid;
}

export function leakPenalty(type: number): number {
    return ENEMY_STATS[type]?.leakPenalty ?? 1;
}

export const STAR_SHAKE_PER_LIFE = 1000;
export const STAR_SHAKE_MAX_MS = 2500;
export const VIBRATE_MS = 800;
export const LEAVE_AFTER_CENTERS = 2;
export const OFF_MAP_TILES = 3;
