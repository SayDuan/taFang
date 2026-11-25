/**
 * 第 15 步：宝箱生成、六种奖励和落地帧。数字以 宝箱.tsv、写死与公式.tsv、画面.tsv 和 Java 为准。
 * 不依赖 Cocos。
 */
import { FINE_PER_TILE, HALF_TILE, Rng } from './Fine';
import { CollisionBox, chestBox } from './Collision';
import { UnitEntity } from './UnitEntity';
import { TerrainMapsLike, isFreeToWalk } from './WalkGrid';

export const CHEST_LIFE = 1;
export const CHEST_GOLD = 2;
export const CHEST_HASTE = 3;
export const CHEST_DAMAGE = 4;
export const CHEST_SLOW = 5;
export const CHEST_BURN = 6;
export const CHEST_QUESTION = 7;

export const CHEST_LIFE_GAIN = 5;
export const CHEST_GOLD_GAIN = 25;
export const BONUS_DURATION_MS = 60000;
export const BONUS_PERCENT = 150;
export const SLOW_DURATION_MIN_MS = 2000;
export const BURN_DURATION_MIN_MS = 5000;
export const BURN_DAMAGE_MIN = 12;

export const CHEST_ANIM_START_MS = 499;
export const CHEST_FALL_FRAMES = 5;
export const SFX_BONUS_BOX = 'sfx_bonus_box';
export const BONUS_BOX = 'bonus_box';
export const SPEECH_BUBBLE_IMAGE = 'gng_speechbubble';
export const MAP_BYTE_N = 78;
export const CHEST_ICON_PX = 16;

export const CHEST_ICON: Record<number, { file: string; frames: number }> = {
    1: { file: 'hud_bonus_sheriff', frames: 3 },
    2: { file: 'hud_bonus_cash', frames: 3 },
    3: { file: 'hud_bonus_speed', frames: 3 },
    4: { file: 'hud_bonus_damage', frames: 3 },
    5: { file: 'hud_bonus_stun', frames: 6 },
    6: { file: 'hud_bonus_fire', frames: 5 },
    7: { file: 'hud_bonus_random', frames: 3 },
};

export const CHEST_TEXTURES = [
    SFX_BONUS_BOX,
    BONUS_BOX,
    SPEECH_BUBBLE_IMAGE,
    ...Object.values(CHEST_ICON).map((icon) => icon.file),
] as const;

export interface LevelChestConfig {
    chestCap: number;
    chestTime: number;
    chestOnFieldCap: number;
    praiseUnit: number;
    maxLives: number;
}

export const LEVEL1_CHEST: LevelChestConfig = {
    chestCap: 0,
    chestTime: 10000,
    chestOnFieldCap: 17,
    praiseUnit: 4,
    maxLives: 50,
};

export const LEVEL3_CHEST: LevelChestConfig = {
    chestCap: 10,
    chestTime: 10,
    chestOnFieldCap: 22,
    praiseUnit: 5,
    maxLives: 50,
};

export interface ChestEntity extends UnitEntity {
    chestSpawn: boolean;
    chestDespawn: boolean;
    chestRemove: boolean;
    animationTimer: number;
    animTime: number;
    animDir: number;
}

export interface ChestWorld {
    maps: TerrainMapsLike & { raw?: Uint8Array | number[] };
    fieldIsBlocked(col: number, row: number, ignoreId?: number): boolean;
    lives: number;
    maxLives: number;
    cash: number;
    addCash(amount: number): void;
    addLives(amount: number): void;
    rng: Rng;
}

export interface BonusShotStats {
    damage: number;
    postDamage: number;
    poisonDamage: number;
    postSlowDownDuration: number;
    postDamageDuration: number;
}

export function chestFineX(col: number): number {
    return col * FINE_PER_TILE + HALF_TILE;
}

export function chestFineY(row: number): number {
    return row * FINE_PER_TILE + HALF_TILE;
}

export function isChestCollectable(chest: { alive: boolean; chestSpawn?: boolean; chestDespawn?: boolean }): boolean {
    return chest.alive && !chest.chestSpawn && !chest.chestDespawn;
}

export function livesNearCap(lives: number, maxLives: number): boolean {
    return lives > maxLives - CHEST_LIFE_GAIN;
}

export function typeMaxForLevel(level: number): number {
    return level < 41 ? 4 : 7;
}

/** Util.random(n) 是 0..n-1；Util.random(a, b) 是 a..b 两边包含。 */
export function rngRange(rng: Rng, min: number, max: number): number {
    if (max < min) {
        return min;
    }
    return min + rng.int(max - min + 1);
}

export function rollChestType(rng: Rng, level: number, lives: number, maxLives: number): number {
    const typeMax = typeMaxForLevel(level);
    let type = rng.int(typeMax) + 1;
    while (type === CHEST_LIFE && livesNearCap(lives, maxLives)) {
        type = rngRange(rng, 2, typeMax);
    }
    return type;
}

/** 问号箱：人命还剩得多（大于上限减 5）时变成 2 到 6，否则 1 到 6。 */
export function resolveQuestionType(rng: Rng, lives: number, maxLives: number): number {
    const min = livesNearCap(lives, maxLives) ? 2 : 1;
    return rngRange(rng, min, 6);
}

export function canDropOnCell(
    maps: TerrainMapsLike & { raw?: Uint8Array | number[] },
    col: number,
    row: number,
    blocked: boolean,
): boolean {
    if (!isFreeToWalk(maps, col, row)) {
        return false;
    }
    const street = maps.street[row * maps.cols + col] & 255;
    if (street !== 0) {
        return false;
    }
    const raw = maps.raw;
    if (raw) {
        const byte = raw[row * maps.cols + col] & 255;
        if (byte === MAP_BYTE_N) {
            return false;
        }
    }
    if (blocked) {
        return false;
    }
    return true;
}

export function pickChestCell(
    maps: TerrainMapsLike & { raw?: Uint8Array | number[] },
    rng: Rng,
    fieldIsBlocked: (col: number, row: number) => boolean,
    maxTries = 10000,
): { col: number; row: number } | null {
    const width = maps.cols;
    const height = maps.rows;
    if (width < 3 || height < 4) {
        return null;
    }
    for (let i = 0; i < maxTries; i++) {
        const col = rng.int(width - 2) + 1;
        const row = rng.int(height - 3) + 2;
        if (canDropOnCell(maps, col, row, fieldIsBlocked(col, row))) {
            return { col, row };
        }
    }
    return null;
}

export function createChest(id: number, col: number, row: number, type: number, falling = true): ChestEntity {
    const fineX = chestFineX(col);
    const fineY = chestFineY(row);
    const box: CollisionBox = chestBox(fineX, fineY, id);
    return {
        id,
        type,
        isEnemy: false,
        kind: 'ground',
        activity: 5,
        fineX,
        fineY,
        prevFineX: fineX,
        prevFineY: fineY,
        fullX: col,
        fullY: row,
        xDir: 0,
        yDir: 0,
        walkDir: 2,
        speed: 0,
        bonusAttribute: -1,
        inactiveUnitReturnsToBase: 0,
        box,
        alive: true,
        hired: false,
        canWalk: false,
        upgradeLevel: 1,
        maxRange: 0,
        maxSquareRange: 0,
        maxWeaponCooldown: 0,
        currentWeaponCooldown: 0,
        specialCoolDownCounter: 0,
        bonusCounter: 0,
        canShootWeapon: false,
        groupId: id,
        chestSpawn: falling,
        chestDespawn: false,
        chestRemove: false,
        animationTimer: falling ? CHEST_ANIM_START_MS : 0,
        animTime: 0,
        animDir: 1,
    };
}

export function tickChest(chest: ChestEntity, dtMs: number): void {
    let dt = dtMs;
    if (dt < 0) {
        dt = 0;
    } else if (dt > 100) {
        dt = 100;
    }
    if (chest.chestSpawn) {
        chest.animationTimer = Math.trunc(chest.animationTimer - dt);
        if (chest.animationTimer <= 0) {
            chest.animationTimer = 0;
            chest.chestSpawn = false;
        }
    }
    if (chest.chestDespawn) {
        chest.animationTimer = Math.trunc(chest.animationTimer - dt);
        if (chest.animationTimer <= 0) {
            chest.animationTimer = 0;
            chest.chestDespawn = false;
            chest.chestRemove = true;
            chest.alive = false;
        }
    }
    if (!chest.chestSpawn && !chest.chestDespawn && chest.alive) {
        wobbleChestIcon(chest);
    }
}

export function wobbleChestIcon(chest: ChestEntity): void {
    chest.animTime += chest.animDir * 0.1;
    if (chest.animTime < 0) {
        chest.animTime = 0;
        chest.animDir = 1;
    }
    if (chest.animTime > 1) {
        chest.animTime = 1;
        chest.animDir = -1;
    }
}

export function chestIconWobblePx(animTime: number, scale = 1): number {
    // apk GameObjectCollectable.draw：图标底边 = 箱子底边 + 箱子高(32) + sin(animTime)，
    // 也就是紧贴箱子上沿；图标本身 16px，所以这里取 2 个图标高。
    return CHEST_ICON_PX * 2 + Math.sin(animTime) * scale;
}

/** 落下：帧号 (500 − 剩余时间) ÷ 100。消失：剩余时间 ÷ 100。 */
export function chestFallFrame(animationTimer: number): number {
    let frame = Math.trunc((500 - animationTimer) / 100);
    if (frame < 0) {
        frame = 0;
    }
    if (frame > 4) {
        frame = 4;
    }
    return frame;
}

export function chestDespawnFrame(animationTimer: number): number {
    let frame = Math.trunc(animationTimer / 100);
    if (frame < 0) {
        frame = 0;
    }
    if (frame > 4) {
        frame = 4;
    }
    return frame;
}

export function chestVisual(chest: ChestEntity): { file: string; frame: number; frames: number; showIcon: boolean } {
    if (chest.chestSpawn) {
        return { file: SFX_BONUS_BOX, frame: chestFallFrame(chest.animationTimer), frames: CHEST_FALL_FRAMES, showIcon: false };
    }
    if (chest.chestDespawn) {
        return { file: SFX_BONUS_BOX, frame: chestDespawnFrame(chest.animationTimer), frames: CHEST_FALL_FRAMES, showIcon: false };
    }
    return { file: BONUS_BOX, frame: 0, frames: 1, showIcon: true };
}

/** 宝箱图标：(当前毫秒 ÷ 100) 对 (帧数 + 1) 取余，余数等于帧数时改画第 1 帧。 */
export function chestIconFrame(nowMs: number, frames: number): number {
    const count = Math.max(1, frames);
    let frame = Math.trunc(nowMs / 100) % (count + 1);
    if (frame === count) {
        frame = 1;
    }
    return frame;
}

/** 头顶奖励图标：先 +1，加完等于帧数时改画第 1 帧，第 0 帧不出现。 */
export function bonusOverheadFrame(nowMs: number, frames: number): number {
    const count = Math.max(1, frames);
    let frame = (Math.trunc(nowMs / 100) % count) + 1;
    if (frame === count) {
        frame = 1;
    }
    return frame;
}

export function iconForChestType(type: number): { file: string; frames: number } {
    return CHEST_ICON[type] ?? CHEST_ICON[7];
}

/** apk GameObjectCollectable.determineRandomMessage：拾取后气泡文案。 */
export function bonusMessageKey(type: number): string {
    switch (type) {
        case CHEST_LIFE:
            return '@string/T_BONUS_04';
        case CHEST_GOLD:
            return '@string/T_BONUS_01';
        case CHEST_HASTE:
            return '@string/T_BONUS_02';
        case CHEST_DAMAGE:
            return '@string/T_BONUS_03';
        case CHEST_SLOW:
            return '@string/T_BONUS_05';
        case CHEST_BURN:
            return '@string/T_BONUS_06';
        default:
            return '';
    }
}

export function clampLives(lives: number, maxLives: number): number {
    if (lives > maxLives) {
        return maxLives;
    }
    if (lives < 0) {
        return 0;
    }
    return lives;
}

export function applyLifeReward(lives: number, maxLives: number, amount = CHEST_LIFE_GAIN): number {
    return clampLives(lives + amount, maxLives);
}

export function setUnitBonus(unit: UnitEntity, kind: number, duration = BONUS_DURATION_MS): void {
    unit.bonusAttribute = kind;
    unit.bonusCounter = duration;
}

export function hasteCooldown(cooldown: number): number {
    return Math.trunc((cooldown * 100) / BONUS_PERCENT);
}

export function hasteStep(step: number): number {
    return Math.trunc((step * BONUS_PERCENT) / 100);
}

export function applyBonusToShot(bonusAttribute: number, stats: BonusShotStats): BonusShotStats {
    const out = { ...stats };
    if (bonusAttribute === CHEST_DAMAGE) {
        out.damage = Math.trunc((out.damage * BONUS_PERCENT) / 100);
        out.postDamage = Math.trunc((out.postDamage * BONUS_PERCENT) / 100);
        out.poisonDamage = Math.trunc((out.poisonDamage * BONUS_PERCENT) / 100);
    } else if (bonusAttribute === CHEST_SLOW) {
        out.postSlowDownDuration = Math.max(Math.trunc((out.postSlowDownDuration * BONUS_PERCENT) / 100), SLOW_DURATION_MIN_MS);
    } else if (bonusAttribute === CHEST_BURN) {
        out.postDamageDuration = Math.max(Math.trunc((out.postDamageDuration * BONUS_PERCENT) / 100), BURN_DURATION_MIN_MS);
        out.postDamage = Math.max(out.postDamage, BURN_DAMAGE_MIN);
    }
    return out;
}

export function bonusRangeLimit(rangeSq: number, bonusAttribute: number): number {
    if (bonusAttribute === CHEST_DAMAGE) {
        return Math.trunc((rangeSq * BONUS_PERCENT) / 100);
    }
    return rangeSq;
}

export function beginChestDespawn(chest: ChestEntity): void {
    chest.chestSpawn = false;
    chest.chestDespawn = true;
    chest.animationTimer = CHEST_ANIM_START_MS;
    chest.box.collectable = false;
}

export function collectChestReward(
    chest: ChestEntity,
    walker: UnitEntity,
    world: { lives: number; maxLives: number; addCash(amount: number): void; addLives(amount: number): void; rng: Rng },
): number {
    let type = chest.type;
    if (type === CHEST_QUESTION) {
        type = resolveQuestionType(world.rng, world.lives, world.maxLives);
        chest.type = type;
    }
    switch (type) {
        case CHEST_LIFE:
            world.addLives(CHEST_LIFE_GAIN);
            break;
        case CHEST_GOLD:
            world.addCash(CHEST_GOLD_GAIN);
            break;
        case CHEST_HASTE:
        case CHEST_DAMAGE:
        case CHEST_SLOW:
        case CHEST_BURN:
            setUnitBonus(walker, type, BONUS_DURATION_MS);
            break;
        default:
            break;
    }
    chest.alive = false;
    beginChestDespawn(chest);
    return type;
}
