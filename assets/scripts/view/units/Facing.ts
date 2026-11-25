/**
 * 走路、开枪朝向和拐弯帧，规则按 朝向.tsv、动画.tsv。
 * dx、dy 用地图坐标：x 往右为正，y 往下（行号增大）为正。
 */

/** 能走路的单位：0 走到 768，再 1 走到 1536，再 0 走到 2304，再 2 走到 3072，然后循环。 */
export const WALK_FRAMES_3 = [0, 768, 1, 1536, 0, 2304, 2, 3072];

/** 骑兵和马（类型 3、8）用四帧顺着走。 */
export const WALK_FRAMES_4 = [0, 768, 1, 1536, 2, 2304, 3, 3072];

export const SHOOT_FRAMES: Record<number, number[]> = {
    1: [0, 100, 1, 200, 0, 1000],
    2: [0, 200, 1, 400],
    3: [0, 100, 1, 200],
    4: [0, 100, 1, 300, 0, 1500],
    5: [0, 100, 1, 300, 0, 1500],
    6: [0, 100, 1, 300, 0, 1500],
    12: [0, 50, 1, 100],
    22: [0, 50, 1, 100],
    35: [0, 100, 1, 300, 0, 1500],
    36: [0, 100, 1, 300, 0, 1500],
};

export interface Facing {
    row: number;
    flip: boolean;
}

export type Cardinal = 'W' | 'E' | 'N' | 'S';

/** 成对读：帧号、这一帧停到的时间。时间到最后一个值后从头循环。 */
export function frameFromTimeline(elapsedMs: number, pairs: number[]): number {
    if (pairs.length < 2) {
        return 0;
    }
    const period = pairs[pairs.length - 1];
    if (period <= 0) {
        return pairs[0];
    }
    const t = ((elapsedMs % period) + period) % period;
    for (let i = 0; i + 1 < pairs.length; i += 2) {
        if (t < pairs[i + 1]) {
            return pairs[i];
        }
    }
    return pairs[pairs.length - 2];
}

export function walkTimeline(fourFrames: boolean): number[] {
    return fourFrames ? WALK_FRAMES_4 : WALK_FRAMES_3;
}

/**
 * Java 的走路帧不是按时间，而是按走过的 fine 距离累加：
 * animStep += max(|dx|, |dy|)，0–768 画第 0 帧，768–1536 第 1 帧，依此类推。
 * 所以走得越快，腿摆得越快，和 apk 一致。
 */
export function walkFrameForStep(step: number, fourFrames: boolean): number {
    const s = ((step % 3072) + 3072) % 3072;
    if (s < 768) {
        return 0;
    }
    if (s < 1536) {
        return 1;
    }
    if (s < 2304) {
        return fourFrames ? 2 : 0;
    }
    return fourFrames ? 3 : 2;
}

/** 开枪动作持续到时间轴最后一个值。TextView 之外这里直接取末项。 */
export function shootPeriod(type: number): number {
    const pairs = SHOOT_FRAMES[type];
    if (!pairs || pairs.length < 2) {
        return 400;
    }
    return pairs[pairs.length - 1];
}

/**
 * 人走路朝向。往下默认第 3 行，往上第 4 行，往左第 1 行，往右第 1 行再翻转。
 * 横向超过纵向一半、或纵向超过横向一半时，改用斜向那一行。
 */
export function playerWalkFacing(dx: number, dy: number): Facing {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const right = dx > 0;
    if (ay >= ax) {
        if (dy >= 0) {
            if (ax > ay / 2) {
                return { row: 0, flip: right };
            }
            return { row: 3, flip: false };
        }
        if (ax > ay / 2) {
            return { row: 2, flip: right };
        }
        return { row: 4, flip: false };
    }
    if (right) {
        if (ay > ax / 2) {
            return { row: dy < 0 ? 2 : 0, flip: true };
        }
        return { row: 1, flip: true };
    }
    if (ay > ax / 2) {
        return { row: dy < 0 ? 0 : 2, flip: false };
    }
    return { row: 1, flip: false };
}

/**
 * 人开枪：方向每轴是 -1、0 或 1。
 * 左上第 2 行，正左第 1 行，左下第 0 行，正上第 4 行，正下第 3 行。朝右用同一行再翻转。
 */
export function playerShootFacing(dirX: number, dirY: number): Facing {
    const flip = dirX > 0;
    if (dirX === 0) {
        return { row: dirY >= 0 ? 3 : 4, flip: false };
    }
    if (dirY < 0) {
        return { row: 2, flip };
    }
    if (dirY > 0) {
        return { row: 0, flip };
    }
    return { row: 1, flip };
}

/**
 * 敌人走路。横向不超过纵向时，往下第 1 行、往上第 2 行；否则第 0 行，往右再翻转。
 * 一行按这张图实际有几帧来切，不再按 16 去一张大图集里取。
 */
export function enemyWalkFacing(dx: number, dy: number): Facing {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax <= ay) {
        return { row: dy >= 0 ? 1 : 2, flip: false };
    }
    return { row: 0, flip: dx > 0 };
}

/**
 * 西↔南用第 0 帧，东↔南用第 0 帧再翻转，西↔北第 1 帧，东↔北第 1 帧再翻转。
 * 不是这两种直角弯则没有转向帧。
 */
export function turnPose(from: Cardinal, to: Cardinal): { frame: number; flip: boolean } | null {
    const set = `${from}${to}`;
    if (set === 'WS' || set === 'SW') {
        return { frame: 0, flip: false };
    }
    if (set === 'ES' || set === 'SE') {
        return { frame: 0, flip: true };
    }
    if (set === 'WN' || set === 'NW') {
        return { frame: 1, flip: false };
    }
    if (set === 'EN' || set === 'NE') {
        return { frame: 1, flip: true };
    }
    return null;
}

export function cardinalFromDelta(dx: number, dy: number): Cardinal {
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'E' : 'W';
    }
    return dy >= 0 ? 'S' : 'N';
}

export function sleepHatFrame(nowMs: number): number {
    const n = Math.floor(nowMs / 200);
    return ((n % 3) + 3) % 3;
}
