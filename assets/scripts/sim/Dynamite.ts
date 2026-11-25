/**
 * 炸药引爆器和炸药箱。数值只取单位表那一行：伤害 5000，范围 23040（3 格），冷却 59000。
 * 不依赖 Cocos。
 */
export const DYNAMITE_TRIGGER_TYPE = 7;
export const DYNAMITE_BOX_TYPE = 8;
export const HORSE_TYPE = 8;
export const DYNAMITE_DAMAGE = 5000;
export const DYNAMITE_DAMAGE_TYPE = 2;
export const DYNAMITE_RANGE_FINE = 23040;
export const DYNAMITE_RANGE_TILES = 3;
export const DYNAMITE_COOLDOWN_MS = 59000;
export const DYNAMITE_RESPAWN_ANIM_MS = 500;
export const DYNAMITE_RESPAWN_FRAMES = 5;
export const DIALOG_DYNAMITE_NOT_READY = 10;

export interface FinePos {
    fineX: number;
    fineY: number;
}

export interface DynamiteTarget {
    type: number;
    fineX: number;
    fineY: number;
    hp: number;
    pierce: readonly number[];
    alive?: boolean;
}

/** fine 坐标直线距离的平方，不用格子距离。 */
export function fineDistSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

export function dynamiteRangeSq(rangeFine = DYNAMITE_RANGE_FINE): number {
    return rangeFine * rangeFine;
}

export function explosionDamage(damage: number, pierce: number): number {
    return Math.trunc((damage * pierce) / 100);
}

export function settlerExplosionHit(damage = DYNAMITE_DAMAGE, heavyPierce = 25): number {
    return explosionDamage(damage, heavyPierce);
}

/**
 * 从敌人列表最后面往前找，第一个距离平方不超过 range²、并且不是马的。
 */
export function findDynamiteTarget<T extends DynamiteTarget>(
    origin: FinePos,
    enemies: readonly T[],
    rangeFine = DYNAMITE_RANGE_FINE,
): T | null {
    const limit = dynamiteRangeSq(rangeFine);
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e || e.alive === false) {
            continue;
        }
        if (e.type === HORSE_TYPE) {
            continue;
        }
        if (fineDistSq(origin.fineX, origin.fineY, e.fineX, e.fineY) > limit) {
            continue;
        }
        return e;
    }
    return null;
}

export function canDetonate(bound: boolean, cooldownMs: number): boolean {
    return bound && cooldownMs <= 0;
}

/**
 * 按钮数字：trunc(剩余毫秒 / 1000) + 1。
 * 满 1 分钟写成「分:秒」，秒始终两位数（和 Java 画冒号后再画十位、个位一致）。
 * 不到 1 分钟只写秒，且小于 10 不补零。
 * 例如 59000 → 60 → "1:00"；58999 → 59 → "59"；119000 → 120 → "2:00"；118000 → 119 → "1:59"。
 */
export function cooldownDisplaySeconds(remainingMs: number): number {
    if (remainingMs <= 0) {
        return 0;
    }
    return Math.trunc(remainingMs / 1000) + 1;
}

export function formatCooldownLabel(remainingMs: number): string {
    const total = cooldownDisplaySeconds(remainingMs);
    if (total <= 0) {
        return '';
    }
    const minutes = Math.trunc(total / 60);
    const seconds = total % 60;
    if (minutes > 0) {
        const tens = Math.trunc(seconds / 10);
        const ones = seconds % 10;
        return `${minutes}:${tens}${ones}`;
    }
    return String(total);
}

export interface Bindable {
    fineX: number;
    fineY: number;
}

/**
 * 从列表末尾往前找最近的一个，绑上并把它从列表里拿掉。没有就返回 -1。
 */
export function selectNearestIndex(origin: FinePos, list: readonly Bindable[]): number {
    let best = Number.POSITIVE_INFINITY;
    let index = -1;
    for (let i = list.length - 1; i >= 0; i--) {
        const d = fineDistSq(origin.fineX, origin.fineY, list[i].fineX, list[i].fineY);
        if (d < best) {
            best = d;
            index = i;
        }
    }
    return index;
}
