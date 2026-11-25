/**
 * 赌徒下注、抽牌和翻牌动画。冷却用关卡「赌徒时间」，不用单位表的 2000。
 * 不依赖 Cocos。
 */
import { Rng } from './Fine';
import { isUnitUnlocked } from './UnitUnlock';
import { SPAWN_MAT_MAX_RESPAWN_COUNTER, SpawnMat } from './SpawnPool';

export const GAMBLER_TYPE = 9;
export const CASINO_SPAWN_TYPE = 4;
export const GAMBLER_BASE_STAKE = 50;
export const GAMBLER_STAKE_STEP = 5;
export const GAMBLER_STAKE_GAMES_CAP = 5;
export const LEVEL1_GAMBLER_TIME = 119000;
export const UNIT_TABLE_GAMBLER_RELOAD = 2000;

export const DIALOG_GAMBLE_NOT_READY = 14;
export const DIALOG_GAMBLE_CONFIRM = 15;
export const DIALOG_GAMBLE_NO_MONEY = 17;

export const CARD_REVEAL_TITLE = '看看你得到了什么！';
export const CARD_SLIDE_BASE_MS = 350;
export const CARD_SLIDE_STEP_MS = 15;
export const CARD_SLIDE_BASE_PX = 60;
export const CARD_SLIDE_STEP_PX = 8;
export const CARD_REST_BASE_PX = 16;
export const CARD_REST_STEP_PX = 1;
export const CARD_COUNT = 5;

/** apk GameObjectSpawnLocation.MAX_RESPAWN_COUNTER = 1500；门动画在 MAX/3，instantSpawn 把计数设成 MAX/3，下一帧就会出人。 */
export const CASINO_MAX_RESPAWN_COUNTER = SPAWN_MAT_MAX_RESPAWN_COUNTER;

export const CARD_CHANCES = [20, 15, 13, 11, 4, 9, 5, 4, 11, 8] as const;
export const CARD_UNITS = [1, 2, 3, 4, 5, 6, 35, 36, -1, -2] as const;

export const RESULT_HAND_KIND = [
    '',
    'ONE_PAIR',
    'TWO_PAIR',
    'THREE_OF_A_KIND',
    'FULL_HOUSE',
    'FOUR_OF_A_KIND',
    'FLUSH',
    'ROYAL_FLUSH',
    'STRAIGHT',
    'HIGH_CARD',
    'LOST',
] as const;

export const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_GRAPHIC_OFFSETS = [0, 256, 512, 768] as const;

export type GamblerDialog = 'none' | 'gamble-not-ready' | 'gamble-confirm' | 'gamble-no-money' | 'gamble-cards';

export interface GamblerCard {
    suitSlot: number;
    rank: number;
    important: boolean;
    /** 打乱后的花色图偏移，对应 card_symbols 四格。 */
    suitGraphic: number;
}

export interface GamblerHand {
    kind: string;
    index: number;
    cards: GamblerCard[];
}

export interface CardRevealCard {
    suitSlot: number;
    rank: number;
    important: boolean;
    suitGraphic: number;
    suitGlyph: string;
    rankLabel: string;
    revealed: boolean;
    y: number;
}

export interface CardRevealState {
    title: string;
    phase: 'slide' | 'flip' | 'settle' | 'done';
    elapsedMs: number;
    cards: CardRevealCard[];
}

export type UnlockFn = (type: number) => boolean;

export function gamblerStake(gamesPlayed: number): number {
    const capped = gamesPlayed < GAMBLER_STAKE_GAMES_CAP ? gamesPlayed : GAMBLER_STAKE_GAMES_CAP;
    const add = capped < 0 ? 0 : capped * GAMBLER_STAKE_STEP;
    return GAMBLER_BASE_STAKE + add;
}

export function canUseGamblerTime(gamblerTime: number | undefined | null): boolean {
    return gamblerTime != null && Number.isFinite(gamblerTime) && gamblerTime > 0;
}

export function cardSlideDurationMs(index: number): number {
    return CARD_SLIDE_BASE_MS + index * CARD_SLIDE_STEP_MS;
}

export function cardSlideDownPx(index: number): number {
    return CARD_SLIDE_BASE_PX + index * CARD_SLIDE_STEP_PX;
}

export function cardRestOffsetPx(index: number, important: boolean): number {
    return important ? 0 : CARD_REST_BASE_PX + index * CARD_REST_STEP_PX;
}

export function lastCardSettleMs(): number {
    return cardSlideDurationMs(CARD_COUNT - 1);
}

export function defaultUnlockedForLevel(
    currentLevel: number,
    finished: ReadonlySet<number> | readonly number[] = [],
    hasAll = false,
): UnlockFn {
    return (type: number) => isUnitUnlocked(type, currentLevel, finished, hasAll);
}

export function gamblerTotalWeight(unlocked: UnlockFn, isFirstRandom: boolean): number {
    let total = 0;
    for (let i = 0; i < CARD_UNITS.length; i++) {
        const unit = CARD_UNITS[i];
        if (unit === -1) {
            total += CARD_CHANCES[i];
        } else if (unit === -2) {
            if (!isFirstRandom) {
                total += CARD_CHANCES[i];
            }
        } else if (unlocked(unit)) {
            total += CARD_CHANCES[i];
        }
    }
    return total;
}

/**
 * 对齐 Java 第二段循环：用 isUnlocked（-1/-2 因表里没有而行返回 true），
 * 累加后若累计仍 <= roll，就把游标推到下一个。返回 1–10。
 */
export function pickGamblerResultIndex(roll: number, unlocked: UnlockFn): number {
    let cursor = 0;
    let acc = 0;
    for (let i = 0; i < CARD_UNITS.length; i++) {
        if (unlocked(CARD_UNITS[i])) {
            acc += CARD_CHANCES[i];
        }
        if (acc <= roll) {
            cursor = i + 1;
        }
    }
    return cursor + 1;
}

export function resultUnitType(resultIndex: number): number {
    if (resultIndex < 1 || resultIndex > CARD_UNITS.length) {
        return -2;
    }
    return CARD_UNITS[resultIndex - 1];
}

export function resultHandKind(resultIndex: number): string {
    return RESULT_HAND_KIND[resultIndex] ?? 'LOST';
}

export interface ParsedHand {
    kind: string;
    index: number;
    raw: Array<{ suitSlot: number; rank: number }>;
    keyIndexes: number[];
}

export function parseGamblerHandsTsv(text: string): ParsedHand[] {
    let src = text;
    if (src.charCodeAt(0) === 0xfeff) {
        src = src.slice(1);
    }
    const lines = src.split(/\r\n|\n|\r/);
    const out: ParsedHand[] = [];
    for (const line of lines) {
        if (!line || line.startsWith('结果') || line.startsWith('说明')) {
            continue;
        }
        const cells = line.split('\t');
        const kind = (cells[0] ?? '').trim();
        const index = Number(cells[1]);
        const cardsRaw = (cells[2] ?? '').trim();
        const keysRaw = (cells[3] ?? '').trim();
        if (!kind || !Number.isFinite(index) || !cardsRaw) {
            continue;
        }
        const raw: Array<{ suitSlot: number; rank: number }> = [];
        for (const part of cardsRaw.split(/\s+/)) {
            const bits = part.split(':');
            if (bits.length < 2) {
                continue;
            }
            raw.push({ suitSlot: Number(bits[0]), rank: Number(bits[1]) });
        }
        if (raw.length !== CARD_COUNT) {
            continue;
        }
        const keyIndexes = keysRaw
            ? keysRaw.split(/[,，\s]+/).map((s) => Number(s)).filter((n) => n >= 1 && n <= CARD_COUNT)
            : [];
        out.push({ kind, index, raw, keyIndexes });
    }
    return out;
}

export function parseGamblerHandsRows(rows: ReadonlyArray<Readonly<Record<string, string>>>): ParsedHand[] {
    const lines = ['结果	第几手	五张牌	关键牌'];
    for (const row of rows) {
        const kind = (row['结果'] ?? '').trim();
        if (!kind || kind === '说明') {
            continue;
        }
        lines.push(`${kind}	${row['第几手'] ?? ''}	${row['五张牌'] ?? ''}	${row['关键牌'] ?? ''}`);
    }
    return parseGamblerHandsTsv(lines.join('\n'));
}

export function handsOfKind(all: readonly ParsedHand[], kind: string): ParsedHand[] {
    return all.filter((h) => h.kind === kind);
}

export function shuffleSuitOffsets(rng: Rng): number[] {
    const pool = SUIT_GRAPHIC_OFFSETS.slice();
    const out: number[] = [];
    while (pool.length > 0) {
        const i = rng.int(pool.length);
        out.push(pool[i]);
        pool.splice(i, 1);
    }
    return out;
}

export function dealHand(hand: ParsedHand, suitOffsets: readonly number[]): GamblerCard[] {
    return hand.raw.map((c, i) => {
        const graphic = suitOffsets[c.suitSlot] ?? SUIT_GRAPHIC_OFFSETS[c.suitSlot] ?? 0;
        return {
            suitSlot: c.suitSlot,
            rank: c.rank,
            important: hand.keyIndexes.indexOf(i + 1) >= 0,
            suitGraphic: graphic,
        };
    });
}

export function pickHandOfKind(all: readonly ParsedHand[], kind: string, rng: Rng): ParsedHand | null {
    const list = handsOfKind(all, kind);
    if (list.length === 0) {
        return null;
    }
    return list[rng.int(list.length)] ?? list[0];
}

export function createCardRevealState(cards: readonly GamblerCard[]): CardRevealState {
    return {
        title: CARD_REVEAL_TITLE,
        phase: 'slide',
        elapsedMs: 0,
        cards: cards.map((c) => ({
            suitSlot: c.suitSlot,
            rank: c.rank,
            important: c.important,
            suitGraphic: c.suitGraphic,
            suitGlyph: SUIT_GLYPHS[suitIndexFromGraphic(c.suitGraphic)] ?? SUIT_GLYPHS[c.suitSlot] ?? '',
            rankLabel: RANK_LABELS[c.rank] ?? String(c.rank),
            revealed: false,
            y: 0,
        })),
    };
}

export function suitIndexFromGraphic(graphic: number): number {
    const i = SUIT_GRAPHIC_OFFSETS.indexOf(graphic as 0 | 256 | 512 | 768);
    return i >= 0 ? i : 0;
}

function slideYAt(index: number, elapsed: number): number {
    const dur = cardSlideDurationMs(index);
    const dest = cardSlideDownPx(index);
    if (elapsed >= dur) {
        return dest;
    }
    if (elapsed <= 0 || dur <= 0) {
        return 0;
    }
    return dest * (elapsed / dur);
}

/**
 * 第一段：五张牌依次滑下，最后一张停稳后翻开，再进入回位。
 * 关键牌回到上面（y=0），其余牌停在 16+i 像素。
 */
export function tickCardReveal(state: CardRevealState, dtMs: number): CardRevealState {
    let dt = dtMs;
    if (dt < 0) {
        dt = 0;
    } else if (dt > 100) {
        dt = 100;
    }
    const next: CardRevealState = {
        title: state.title,
        phase: state.phase,
        elapsedMs: state.elapsedMs + dt,
        cards: state.cards.map((c) => ({ ...c })),
    };
    if (next.phase === 'slide') {
        for (let i = 0; i < next.cards.length; i++) {
            next.cards[i].y = slideYAt(i, next.elapsedMs);
            next.cards[i].revealed = false;
        }
        if (next.elapsedMs >= lastCardSettleMs()) {
            next.phase = 'flip';
            next.elapsedMs = 0;
            for (const card of next.cards) {
                card.revealed = true;
                card.y = cardSlideDownPx(next.cards.indexOf(card));
            }
            // 上面 loop 已按 index 赋值；再按 index 修正一次，避免 indexOf 在相同 y 时出错。
            for (let i = 0; i < next.cards.length; i++) {
                next.cards[i].y = cardSlideDownPx(i);
                next.cards[i].revealed = true;
            }
        }
        return next;
    }
    if (next.phase === 'flip' || next.phase === 'settle') {
        if (next.phase === 'flip') {
            next.phase = 'settle';
        }
        for (let i = 0; i < next.cards.length; i++) {
            const start = cardSlideDownPx(i);
            const dest = cardRestOffsetPx(i, next.cards[i].important);
            const dur = cardSlideDurationMs(i);
            const t = next.elapsedMs >= dur ? 1 : next.elapsedMs / dur;
            next.cards[i].y = start + (dest - start) * t;
            next.cards[i].revealed = true;
        }
        if (next.elapsedMs >= lastCardSettleMs()) {
            next.phase = 'done';
            for (let i = 0; i < next.cards.length; i++) {
                next.cards[i].y = cardRestOffsetPx(i, next.cards[i].important);
                next.cards[i].revealed = true;
            }
        }
        return next;
    }
    for (let i = 0; i < next.cards.length; i++) {
        next.cards[i].y = cardRestOffsetPx(i, next.cards[i].important);
        next.cards[i].revealed = true;
    }
    return next;
}

export interface PlayCardsInput {
    cash: number;
    stake: number;
    rng: Rng;
    unlocked: UnlockFn;
    isFirstRandom: boolean;
    hands: readonly ParsedHand[];
    hasCasino: boolean;
}

export type PlayCardsOutcome =
    | { ok: false; reason: 'no-money' | 'not-ready' | 'disabled' }
    | {
        ok: true;
        cash: number;
        stake: number;
        wonCash: number;
        resultIndex: number;
        resultKind: string;
        unitType: number;
        spawnedUnitType: number | null;
        hand: ParsedHand | null;
        cards: GamblerCard[];
        reveal: CardRevealState;
    };

export function playCards(input: PlayCardsInput): PlayCardsOutcome {
    if (!input.hasCasino) {
        return { ok: false, reason: 'not-ready' };
    }
    if (input.cash < input.stake) {
        return { ok: false, reason: 'no-money' };
    }
    let cash = input.cash - input.stake;
    const weight = gamblerTotalWeight(input.unlocked, input.isFirstRandom);
    const roll = weight > 0 ? input.rng.int(weight) : 0;
    const resultIndex = pickGamblerResultIndex(roll, input.unlocked);
    const unitType = resultUnitType(resultIndex);
    const resultKind = resultHandKind(resultIndex);
    let wonCash = 0;
    let spawnedUnitType: number | null = null;
    if (unitType === -1) {
        wonCash = input.stake * 2;
        cash += wonCash;
    } else if (unitType > 0) {
        spawnedUnitType = unitType;
    }
    const hand = pickHandOfKind(input.hands, resultKind, input.rng) ?? pickHandOfKind(input.hands, 'LOST', input.rng);
    const suits = shuffleSuitOffsets(input.rng);
    const cards = hand ? dealHand(hand, suits) : [];
    return {
        ok: true,
        cash,
        stake: input.stake,
        wonCash,
        resultIndex,
        resultKind,
        unitType,
        spawnedUnitType,
        hand,
        cards,
        reveal: createCardRevealState(cards),
    };
}

export function instantSpawnOnMat(mat: SpawnMat, unitType: number): void {
    mat.spawningMode = true;
    mat.instantSpawnType = unitType;
    mat.unitActivity = 6;
    mat.respawnCounter = Math.trunc(CASINO_MAX_RESPAWN_COUNTER / 3);
}

export function shouldCasinoEmit(mat: SpawnMat): boolean {
    const pending = mat.instantSpawnType ?? -1;
    const counter = mat.respawnCounter ?? 0;
    return !!mat.spawningMode && pending >= 0 && counter < Math.trunc(CASINO_MAX_RESPAWN_COUNTER / 3);
}
