/**
 * 难度档、强度上下限、高分折算。按 难度.tsv / 胜负与操作.tsv。
 * 本复刻没有广告和内购：困难没解锁时只能提示，不会走购买。
 */

import { MODE_EASY, MODE_HARD, MODE_NORMAL } from './EnemyCatalog';

export const DIFFICULTY_LABELS = ['容易', '中等', '困难'] as const;

/** 结果 = 原值 × 这列 ÷ 100。 */
export const DIFFICULTY_PERCENT = [75, 100, 150] as const;

/** 敌人强度不会低于这个。 */
export const DIFFICULTY_MIN = [500, 500, 500] as const;

/** 简单上限 1250，普通和困难 1500。 */
export const DIFFICULTY_MAX = [1250, 1500, 1500] as const;

export type DifficultyTier = 0 | 1 | 2;

export type PickDifficultyReason = 'locked' | 'started' | 'invalid';

export interface PickDifficultyResult {
    ok: boolean;
    tier?: DifficultyTier;
    reason?: PickDifficultyReason;
    /** 永远是 false。困难锁定时也不弹出购买。 */
    purchase: false;
}

export function isDifficultyTier(value: number): value is DifficultyTier {
    return value === MODE_EASY || value === MODE_NORMAL || value === MODE_HARD;
}

export function difficultyPercent(tier: number): number {
    if (isDifficultyTier(tier)) {
        return DIFFICULTY_PERCENT[tier];
    }
    return DIFFICULTY_PERCENT[MODE_NORMAL];
}

export function difficultyMin(tier: number): number {
    if (isDifficultyTier(tier)) {
        return DIFFICULTY_MIN[tier];
    }
    return DIFFICULTY_MIN[MODE_NORMAL];
}

export function difficultyMax(tier: number): number {
    if (isDifficultyTier(tier)) {
        return DIFFICULTY_MAX[tier];
    }
    return DIFFICULTY_MAX[MODE_NORMAL];
}

export function clampDifficulty(value: number, tier: number): number {
    const min = difficultyMin(tier);
    const max = difficultyMax(tier);
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

export function parseDifficultyTsv(text: string): { percent: number[]; min: number[]; max: number[] } {
    let src = text;
    if (src.charCodeAt(0) === 0xfeff) {
        src = src.slice(1);
    }
    const lines = src.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
    const percent = [75, 100, 150];
    const min = [500, 500, 500];
    const max = [1250, 1500, 1500];
    if (lines.length < 2) {
        return { percent, min, max };
    }
    const header = lines[0].split('\t');
    const iEasy = header.indexOf('简单');
    const iNormal = header.indexOf('普通');
    const iHard = header.indexOf('困难');
    const cols = [iEasy, iNormal, iHard];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        const key = cells[0] ?? '';
        const nums = cols.map((c) => Number(cells[c]));
        if (nums.some((n) => !Number.isFinite(n))) {
            continue;
        }
        if (key.includes('百分比') || key.includes('一项会按百分比')) {
            percent[0] = nums[0];
            percent[1] = nums[1];
            percent[2] = nums[2];
        } else if (key.includes('下限')) {
            min[0] = nums[0];
            min[1] = nums[1];
            min[2] = nums[2];
        } else if (key.includes('上限')) {
            max[0] = nums[0];
            max[1] = nums[1];
            max[2] = nums[2];
        }
    }
    return { percent, min, max };
}

/** 第 1 波还没开始时才能选难度。 */
export function canPickDifficulty(waveIndex: number, waveStarted: boolean): boolean {
    return waveIndex === 0 && !waveStarted;
}

export function tryPickDifficulty(
    tier: number,
    opts: { hardUnlocked: boolean; waveIndex: number; waveStarted: boolean },
): PickDifficultyResult {
    if (!isDifficultyTier(tier)) {
        return { ok: false, reason: 'invalid', purchase: false };
    }
    if (!canPickDifficulty(opts.waveIndex, opts.waveStarted)) {
        return { ok: false, reason: 'started', purchase: false };
    }
    if (tier === MODE_HARD && !opts.hardUnlocked) {
        return { ok: false, reason: 'locked', purchase: false };
    }
    return { ok: true, tier, purchase: false };
}

/** 高分 = (击杀累计 + 身上还剩的钱) × 难度百分比 ÷ 100，按整数除法截断。 */
export function computeHighScore(killAccrued: number, remainingCash: number, tier: number): number {
    return Math.trunc(((killAccrued + remainingCash) * difficultyPercent(tier)) / 100);
}

/** 只有新分严格超过纪录才要输入名字。 */
export function shouldPromptName(score: number, record: number): boolean {
    return score > record;
}

export class HighScoreBoard {
    private scores = new Map<number, number>();
    private names = new Map<number, string>();
    /** apk UserProfile 的 lastName：上一次真正输入过的名字，只在前进/重开时保留在内存里。 */
    private lastNameValue = '';

    get(level: number): number {
        return this.scores.get(level) ?? 0;
    }

    /** UserProfile.setDefaultHighscoreName：空字符串不覆盖，原版没有长度上限（截断在 EditBox 的 maxLength=15）。 */
    setDefaultName(name: string): void {
        if (name.length > 0) {
            this.lastNameValue = name;
        }
    }

    getDefaultName(): string {
        return this.lastNameValue;
    }

    getName(level: number): string {
        return this.names.get(level) ?? '';
    }

    beats(level: number, score: number): boolean {
        return shouldPromptName(score, this.get(level));
    }

    record(level: number, score: number, name: string): void {
        this.scores.set(level, score);
        this.names.set(level, name);
    }

    clear(): void {
        this.scores.clear();
        this.names.clear();
    }

    exportAll(): { level: number; score: number; name: string }[] {
        const levels = new Set<number>();
        this.scores.forEach((_v, k) => levels.add(k));
        this.names.forEach((_v, k) => levels.add(k));
        const sorted = Array.from(levels);
        sorted.sort((a, b) => a - b);
        return sorted.map((level) => ({
            level,
            score: this.get(level),
            name: this.getName(level),
        }));
    }

    importAll(rows: readonly { level: number; score: number; name: string }[]): void {
        this.clear();
        for (const row of rows) {
            this.record(row.level, row.score, row.name);
        }
    }
}

export const highScores = new HighScoreBoard();
