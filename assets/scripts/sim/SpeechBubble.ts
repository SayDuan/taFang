/**
 * 第 15 步：夸赞气泡。句子和下标按 Java EnemyDirector 与 敌人规则.tsv。
 * 动画：总长 1200 毫秒，前 600 放大并淡入，后 600 淡出。不依赖 Cocos。
 */

export const PRAISE_PHRASES = ['耶！', '耶哈！', '命中！', '直接命中！', '咔嘭！'] as const;
export const BUBBLE_DURATION_MS = 1200;
export const BUBBLE_HALF_MS = 600;
export const PRAISE_DIFFICULTY_MIN = 800;

export interface SpeechBubbleState {
    text: string;
    elapsedMs: number;
    durationMs: number;
    started: boolean;
    ended: boolean;
}

/** Java SinInterpolator 常见写法：前半段加速、后半段减速。 */
export function sinInterpolate(t: number): number {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    return (1 - Math.cos(Math.PI * x)) / 2;
}

/**
 * 句子下标 = random(3) + (平均难度 - 900) / 100 - 1，再夹到 0 到 4。
 * random3 是 Util.random(3)，即 0、1、2。整数除法向 0 取整。
 * 刚过 800 时 (avg-900)/100 = 0，下标变成 -1/0/1，夹成 0 或 1，
 * 也就是「耶！」或「耶哈！」。其中 random3=2 时是「耶哈！」。
 */
export function praisePhraseIndex(averageDifficulty: number, random3: number): number {
    const roll = Math.trunc(random3);
    const shift = Math.trunc((Math.trunc(averageDifficulty) - 900) / 100);
    let index = roll + shift - 1;
    if (index < 0) {
        index = 0;
    }
    if (index > 4) {
        index = 4;
    }
    return index;
}

export function praisePhrase(averageDifficulty: number, random3: number): string {
    return PRAISE_PHRASES[praisePhraseIndex(averageDifficulty, random3)];
}

export function canPraise(killedType: number, praiseUnit: number, averageDifficulty: number, bubbleShowing: boolean): boolean {
    return killedType >= praiseUnit && averageDifficulty > PRAISE_DIFFICULTY_MIN && !bubbleShowing;
}

export function createSpeechBubble(text: string, durationMs = BUBBLE_DURATION_MS): SpeechBubbleState {
    return {
        text,
        elapsedMs: 0,
        durationMs,
        started: true,
        ended: false,
    };
}

export function bubbleScale(elapsedMs: number, durationMs = BUBBLE_DURATION_MS): number {
    const half = Math.trunc(durationMs / 2);
    if (elapsedMs <= 0) {
        return 0;
    }
    if (elapsedMs >= half) {
        return 1;
    }
    return sinInterpolate(elapsedMs / half);
}

export function bubbleAlpha(elapsedMs: number, durationMs = BUBBLE_DURATION_MS): number {
    const half = Math.trunc(durationMs / 2);
    if (elapsedMs <= 0) {
        return 0;
    }
    if (elapsedMs < half) {
        return sinInterpolate(elapsedMs / half);
    }
    if (elapsedMs >= durationMs) {
        return 0;
    }
    return 1 - sinInterpolate((elapsedMs - half) / half);
}

export function tickSpeechBubble(bubble: SpeechBubbleState, dtMs: number): void {
    if (!bubble.started || bubble.ended) {
        return;
    }
    let dt = dtMs;
    if (dt < 0) {
        dt = 0;
    } else if (dt > 100) {
        dt = 100;
    }
    bubble.elapsedMs += dt;
    if (bubble.elapsedMs >= bubble.durationMs) {
        bubble.elapsedMs = bubble.durationMs;
        bubble.ended = true;
    }
}
