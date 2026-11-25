/**
 * 过关结算：按敌人种类一档一档数。每一拍至少 1 个，dt 超过 50 毫秒就更快。
 * 种类对照 Java WaveManager.translationTableGroupToUnit。
 */

import { ENEMY_STATS } from './EnemyCatalog';

/** 组号到单位类型：移民、骑兵、篷车、驿马车、金车、头目、医生。 */
export const GROUP_TO_UNIT = [1, 3, 4, 5, 6, 7, 9] as const;

/** 单位类型到组号。男女移民都算第 0 组，马不计入。 */
export const UNIT_TO_GROUP = [-1, 0, 0, 1, 2, 3, 4, 5, -1, 6] as const;

export const TALLY_GROUP_COUNT = 7;
export const TALLY_GROUP_NAMES = ['移民', '骑兵', '篷车', '驿马车', '金车', '头目', '医生'] as const;

export function groupForUnit(type: number): number {
    if (type < 0 || type >= UNIT_TO_GROUP.length) {
        return -1;
    }
    return UNIT_TO_GROUP[type];
}

export function bountyForGroup(group: number): number {
    const type = GROUP_TO_UNIT[group];
    if (type == null) {
        return 0;
    }
    return ENEMY_STATS[type]?.bounty ?? 0;
}

/**
 * 这一拍要数几个。默认 1；dt > 50 时底数为 dt/20。
 * 再乘上剩余/10（整数除法），不超过剩余，至少 1。
 */
export function tallyCountThisTick(remain: number, dtMs: number): number {
    if (remain <= 0) {
        return 0;
    }
    let dt = dtMs;
    if (dt < 0) {
        dt = 0;
    } else if (dt > 100) {
        dt = 100;
    }
    let base = 1;
    if (dt > 50) {
        base = Math.trunc(dt / 20);
        if (base < 1) {
            base = 1;
        }
    }
    let n = base * Math.trunc(remain / 10);
    if (n > remain) {
        n = remain;
    }
    if (n < 1) {
        n = 1;
    }
    return n;
}

export interface ClearTallyState {
    remain: number[];
    counted: number[];
    cashDone: number[];
    cashTotal: number;
    category: number;
    countingDone: boolean;
}

export function createClearTally(kills: readonly number[]): ClearTallyState {
    const remain = Array.from({ length: TALLY_GROUP_COUNT }, (_, i) => Math.max(0, Math.trunc(kills[i] ?? 0)));
    return {
        remain,
        counted: new Array(TALLY_GROUP_COUNT).fill(0),
        cashDone: new Array(TALLY_GROUP_COUNT).fill(0),
        cashTotal: 0,
        category: 0,
        countingDone: remain.every((n) => n <= 0),
    };
}

export function tickClearTally(state: ClearTallyState, dtMs: number): ClearTallyState {
    if (state.countingDone) {
        return state;
    }
    const remain = state.remain.slice();
    const counted = state.counted.slice();
    const cashDone = state.cashDone.slice();
    let cashTotal = state.cashTotal;
    let category = state.category;
    let countingDone = false;

    if (remain[category] <= 0) {
        if (category >= TALLY_GROUP_COUNT - 1) {
            countingDone = true;
        } else {
            category += 1;
        }
    } else {
        const n = tallyCountThisTick(remain[category], dtMs);
        const bounty = bountyForGroup(category);
        remain[category] -= n;
        counted[category] += n;
        cashDone[category] += n * bounty;
        cashTotal += n * bounty;
    }

    return { remain, counted, cashDone, cashTotal, category, countingDone };
}
