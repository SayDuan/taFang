/** 第 12 步：子弹飞行、落地帧、抛物线、爆炸圈和死亡表现。数字以 Java 和画面表为准。 */

import { FINE_PER_TILE } from './Fine';

export const ROCKET_SWAY_AMPLITUDE = Math.trunc(FINE_PER_TILE / 5);
export const ROCKET_TILE_RANGE_SQ = FINE_PER_TILE * FINE_PER_TILE;
export const PIONEER_DEATH_MS = 599;
export const SMOKE_DEATH_MS = 799;
export const WAGON_FRAGMENT_COUNT = 20;
export const WAGON_SPILL_MAX = 4;
export const WAGON_PARTS_COUNTER = 500;
export const WAGON_BODY_UNTIL = 350;
export const MUZZLE_SMOKE_MS = 499;
export const ROCKET_SPARKLE_MS = 299;
export const BLAST_PLAY_MS = 799;
export const POISON_SEGMENT_MS = 599;
export const HEAL_FX_MS = 700;
export const SFX_FIRE = 'sfx_fire';
export const SFX_STUN = 'sfx_stun';
export const SFX_HEAL = 'sfx_heal';
export const SFX_DEATH_PIONEERS = 'sfx_death_pioneers';
export const SFX_SMOKE_EXPLOSION = 'sfx_smoke_explosion';
export const SFX_EXPLODING_PARTS = 'sfx_exploding_parts';
export const SFX_EXPLOSION = 'sfx_explosion';
export const SFX_POISON = 'sfx_poison';
export const SFX_ROCKET_EXPLOSION = 'sfx_rocket_explosion';
export const SFX_ROCKET_SPARKLES = 'sfx_rocket_sparkles';
export const SFX_CANNON_SMOKE = 'sfx_cannon_smoke';

export const FX_TEXTURES = [
    SFX_FIRE,
    'sfx_mexican_dynamite',
    SFX_EXPLOSION,
    'sfx_cannon_ball',
    'sfx_salesman_bottle',
    SFX_POISON,
    'sfx_pyromaniac_rocket',
    SFX_ROCKET_EXPLOSION,
    SFX_ROCKET_SPARKLES,
    SFX_CANNON_SMOKE,
    'sfx_lok_steam',
    SFX_DEATH_PIONEERS,
    SFX_SMOKE_EXPLOSION,
    SFX_EXPLODING_PARTS,
    SFX_STUN,
    SFX_HEAL,
] as const;

export interface ShotStyleVisual {
    style: number;
    kind: 'square' | 'line' | 'lineFire' | 'sprite';
    flightImage: string | null;
    flightFrames: number;
    landingImage: string | null;
    landingFrames: number;
    baseTime: number;
}

export const SHOT_STYLES: ShotStyleVisual[] = [
    { style: 0, kind: 'square', flightImage: null, flightFrames: 0, landingImage: null, landingFrames: 0, baseTime: 10 },
    { style: 1, kind: 'line', flightImage: null, flightFrames: 0, landingImage: null, landingFrames: 0, baseTime: 50 },
    { style: 2, kind: 'lineFire', flightImage: SFX_FIRE, flightFrames: 5, landingImage: null, landingFrames: 0, baseTime: 50 },
    { style: 3, kind: 'sprite', flightImage: 'sfx_mexican_dynamite', flightFrames: 3, landingImage: SFX_EXPLOSION, landingFrames: 8, baseTime: 75 },
    { style: 4, kind: 'sprite', flightImage: 'sfx_cannon_ball', flightFrames: 1, landingImage: SFX_EXPLOSION, landingFrames: 8, baseTime: 75 },
    { style: 5, kind: 'sprite', flightImage: 'sfx_salesman_bottle', flightFrames: 3, landingImage: SFX_POISON, landingFrames: 6, baseTime: 75 },
    { style: 6, kind: 'sprite', flightImage: 'sfx_pyromaniac_rocket', flightFrames: 16, landingImage: SFX_ROCKET_EXPLOSION, landingFrames: 8, baseTime: 0 },
];

export function shotStyleVisual(style: number): ShotStyleVisual {
    return SHOT_STYLES[style] ?? SHOT_STYLES[0];
}

export function baseTimeBullet(style: number): number {
    return shotStyleVisual(style).baseTime;
}

/** 非火箭：近处用基础百分比，打到射程边缘用满弹速。火箭按实际距离占最大射程的比例。 */
export function flightTimeMs(style: number, bulletSpeed: number, distSq: number, maxSquareRange: number): number {
    let maxSteps = Math.trunc((bulletSpeed * 100) / 100);
    const base = baseTimeBullet(style);
    if (style !== 6) {
        if (maxSquareRange <= 0) {
            return maxSteps;
        }
        maxSteps = Math.trunc(maxSteps / 10);
        maxSteps = Math.trunc((base * maxSteps + Math.trunc(((100 - base) * maxSteps * distSq) / maxSquareRange)) / 100);
        return maxSteps * 10;
    }
    let rangeSq = maxSquareRange;
    if (rangeSq < distSq) {
        rangeSq = distSq;
    }
    const maxRange = Math.trunc(Math.sqrt(rangeSq));
    if (maxRange <= 0) {
        return maxSteps;
    }
    maxSteps = Math.trunc(maxSteps / 10);
    maxSteps = Math.trunc((base * maxSteps + ((100 - base) * maxSteps * Math.sqrt(distSq)) / maxRange) / 100);
    return maxSteps * 10;
}

export function rocketMaxRange(distSq: number, maxSquareRange: number): number {
    const rangeSq = maxSquareRange < distSq ? distSq : maxSquareRange;
    return Math.trunc(Math.sqrt(rangeSq));
}

/** Java：ceil(flightTime / ((flightTime / v2) * π))，其中 v2 = 弹速 / (maxRange / 10)，中间两次都是整除。 */
export function rocketZigZagFactor(flightTime: number, bulletSpeed: number, maxRange: number): number {
    const denom = Math.trunc(maxRange / 10);
    if (denom <= 0 || flightTime <= 0) {
        return 0;
    }
    const v2 = Math.trunc(Math.trunc((bulletSpeed * 100) / 100) / denom);
    if (v2 <= 0) {
        return 0;
    }
    const cycles = Math.trunc(flightTime / v2);
    if (cycles <= 0) {
        return 0;
    }
    return Math.ceil(flightTime / (cycles * Math.PI));
}

export function rocketSwayOffset(currentSteps: number, zigZagFactor: number, normalX: number, normalY: number): { x: number; y: number } {
    if (zigZagFactor === 0) {
        return { x: 0, y: 0 };
    }
    const wave = Math.sin(currentSteps / zigZagFactor);
    const amp = (wave * ROCKET_SWAY_AMPLITUDE);
    return {
        x: Math.trunc(normalX * amp),
        y: Math.trunc(normalY * amp),
    };
}

/**
 * 抛物线抬高。Java 用剩余时间 / 总时间当进度（起飞时接近 1，落地为 0）。
 * 画面表写成“已经走的步数 / 总步数”，与 Java 相反；这里跟原版运行时。
 */
export function parabolaLift(style: number, currentSteps: number, maxSteps: number): number {
    if (maxSteps <= 0) {
        return 0;
    }
    const progress = currentSteps / maxSteps;
    if (style === 4) {
        return Math.trunc(1920 * progress) + Math.trunc(11520 * Math.sin(progress * Math.PI));
    }
    if (style === 6) {
        return Math.trunc(1920 * progress) + Math.trunc(1536 * Math.sin(progress * Math.PI));
    }
    if (style === 3 || style === 5) {
        return Math.trunc(Math.trunc(1920 * progress) / 256) + Math.trunc(15360 * Math.sin(progress * Math.PI));
    }
    return 0;
}

export function interpolateFine(start: number, end: number, currentSteps: number, maxSteps: number): number {
    if (maxSteps <= 0) {
        return end;
    }
    return Math.trunc((start * currentSteps + end * (maxSteps - currentSteps)) / maxSteps);
}

export function flightFrame(style: number, nowMs: number, directionRad = 0): number {
    if (style === 2) {
        return Math.trunc(nowMs / 100) % 5;
    }
    if (style === 3 || style === 5) {
        // 画面表：只在 0 和 1 之间换。Java 写的是 (NOW/100)%3。
        return Math.trunc(nowMs / 100) % 2;
    }
    if (style === 6) {
        let dir = directionRad;
        if (dir < 0) {
            dir += Math.PI * 2;
        }
        return Math.trunc((dir * 8) / Math.PI);
    }
    return 0;
}

export function rocketDirection(fineX: number, fineY: number, endX: number, endY: number): number {
    return Math.atan2(fineY - endY, fineX - endX);
}

/** 落地帧：样式 3/4/6 是 7 - (剩余时间÷100)；样式 5 是 5 - ((剩余时间÷100)%6)。 */
export function landingFrame(style: number, currentStepsToResolve: number): number {
    if (style === 3 || style === 4 || style === 6) {
        return 7 - Math.trunc(currentStepsToResolve / 100);
    }
    if (style === 5) {
        return 5 - (Math.trunc(currentStepsToResolve / 100) % 6);
    }
    return 0;
}

export function isCanyonByte(background: number): boolean {
    return background >= 48 && background < 96;
}

export function isCanyonAt(width: number, height: number, background: number[] | Uint8Array, col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= width || row >= height) {
        return false;
    }
    return isCanyonByte(background[row * width + col] & 255);
}

export interface RingBurst {
    fineX: number;
    fineY: number;
    delay: number;
}

function collectRings(
    originX: number,
    originY: number,
    aoeRangeFine: number,
    ringMul: number,
    angleSpan: number,
    radiusDiv: number,
    isCanyon: (col: number, row: number) => boolean,
): RingBurst[] {
    const ringCount = Math.trunc(aoeRangeFine / FINE_PER_TILE) * ringMul;
    const out: RingBurst[] = [];
    let angle = 0;
    for (let ring = 1; ring < ringCount; ring++) {
        const step = Math.max(64 - ring * 4, 8);
        const count = Math.trunc(angleSpan / step);
        for (let i = 0; i <= count; i++) {
            angle += step;
            const x = originX + Math.trunc(Math.cos(angle) * ((ring * FINE_PER_TILE) / radiusDiv));
            const y = originY + Math.trunc(Math.sin(angle) * ((ring * FINE_PER_TILE) / radiusDiv));
            if (isCanyon(Math.trunc(x / FINE_PER_TILE), Math.trunc(y / FINE_PER_TILE))) {
                out.push({ fineX: x, fineY: y, delay: ring * 100 });
            }
        }
    }
    return out;
}

/** 爆炸圈：圈数 = 范围格数 × 3。只铺在峡谷格上。第 n 圈延迟 n×100。 */
export function blastRingPlacements(
    originX: number,
    originY: number,
    aoeRangeFine: number,
    isCanyon: (col: number, row: number) => boolean,
): RingBurst[] {
    return collectRings(originX, originY, aoeRangeFine, 3, 512, 3, isCanyon);
}

/** 毒圈：圈数 = 范围格数 × 2。只铺在峡谷格上。 */
export function poisonRingPlacements(
    originX: number,
    originY: number,
    aoeRangeFine: number,
    isCanyon: (col: number, row: number) => boolean,
): RingBurst[] {
    return collectRings(originX, originY, aoeRangeFine, 2, 128, 2, isCanyon);
}

export function explosionFrame(anim: number, animMax = BLAST_PLAY_MS): number {
    if (anim < 0 || anim > animMax) {
        return -1;
    }
    return Math.min(7, Math.trunc((animMax - anim) / 100));
}

export function poisonCloudFrame(anim: number, animMax = POISON_SEGMENT_MS): number {
    if (anim < 0 || anim > animMax) {
        return -1;
    }
    return Math.min(5, Math.trunc((animMax - anim) / 100) % 6);
}

export function rocketSparkleFrame(anim: number, animMax = ROCKET_SPARKLE_MS): number {
    if (anim < 0 || anim > animMax) {
        return -1;
    }
    return Math.min(2, Math.trunc((animMax - anim) / 100));
}

export function muzzleSmokeFrame(anim: number): number {
    let frame = 4 - Math.trunc(anim / 100);
    if (frame > 4) {
        frame = 4;
    }
    return frame;
}

export function fireOverlayFrame(nowMs: number): number {
    return Math.trunc(nowMs / 100) % 5;
}

export function stunOverlayFrame(nowMs: number): number {
    return Math.trunc(nowMs / 100) % 6;
}

export function healOverlayFrame(healTimeCounter: number): number {
    return 6 - Math.trunc((healTimeCounter * 7) / HEAL_FX_MS);
}

export interface DeathVisual {
    style: number;
    duration: number;
    image: string;
    frames: number;
}

export function deathVisualFor(type: number): DeathVisual {
    if (type === 1 || type === 2 || type === 9) {
        return { style: 1, duration: PIONEER_DEATH_MS, image: SFX_DEATH_PIONEERS, frames: 6 };
    }
    if (type === 4 || type === 5 || type === 6) {
        return { style: 11, duration: SMOKE_DEATH_MS, image: SFX_SMOKE_EXPLOSION, frames: 8 };
    }
    return { style: 21, duration: SMOKE_DEATH_MS, image: SFX_SMOKE_EXPLOSION, frames: 8 };
}

export function pioneerDeathFrame(counter: number): number {
    return 5 - Math.trunc(counter / 100);
}

export function smokeDeathFrame(counter: number): number {
    return 7 - Math.trunc(counter / 100);
}

/** 车、骑兵、马、头目：计时还大于 350 时车身还在。移民和医生整段死亡都画。 */
export function deathBodyVisible(style: number, counter: number, alive: boolean): boolean {
    if (alive) {
        return true;
    }
    if (style === 1) {
        return true;
    }
    if ((style === 11 || style === 21) && counter > WAGON_BODY_UNTIL) {
        return true;
    }
    return false;
}

export function shouldSpawnWagonParts(type: number, counter: number, alreadyCreated: boolean): boolean {
    return (type === 4 || type === 5 || type === 6) && counter < WAGON_PARTS_COUNTER && !alreadyCreated;
}

export function wagonSpillBase(type: number): number {
    if (type === 4) {
        return 2;
    }
    if (type === 5) {
        return 4;
    }
    return 0;
}

/** 人数 = random(难度÷50 + 基础人数×10) ÷ 10，最多 4 个。 */
export function wagonSpillCount(difficulty: number, type: number, randomInt: (n: number) => number): number {
    const span = Math.trunc(difficulty / 50) + wagonSpillBase(type) * 10;
    const raw = Math.trunc(randomInt(span) / 10);
    if (raw < 0) {
        return 0;
    }
    return raw > WAGON_SPILL_MAX ? WAGON_SPILL_MAX : raw;
}

export const WAGON_SPILL_OFFSETS: Array<[number, number]> = [
    [-1280, -1760],
    [1280, -1760],
    [-1280, 800],
    [1280, 800],
];

export interface WagonFragment {
    xpos: number;
    ypos: number;
    zpos: number;
    xDir: number;
    yDir: number;
    zDir: number;
    gravity: number;
    part: number;
}

export function createWagonFragments(fineX: number, fineY: number, randomInt: (n: number) => number): WagonFragment[] {
    const parts: WagonFragment[] = [];
    for (let i = -10; i < 10; i++) {
        parts.push({
            xpos: fineX - Math.trunc((i * FINE_PER_TILE) / 20),
            ypos: fineY,
            zpos: 3840,
            gravity: 500,
            xDir: randomInt(2000) - 1000,
            yDir: randomInt(200) - 100,
            zDir: randomInt(4000) + 2500,
            part: randomInt(6),
        });
    }
    return parts;
}

export function updateWagonFragment(part: WagonFragment, dtMs: number): void {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    part.zDir = Math.trunc(part.zDir - (part.gravity * dt) / 100);
    part.xpos += Math.trunc((part.xDir * dt) / 100);
    part.ypos += Math.trunc((part.yDir * dt) / 100);
    part.zpos += Math.trunc((part.zDir * dt) / 100);
    if (part.zpos < 0) {
        part.zpos = 0;
        part.xDir = 0;
        part.yDir = 0;
        part.zDir = 0;
    }
}

export function wagonFragmentGone(part: WagonFragment): boolean {
    return part.zDir <= 0 && part.zpos < FINE_PER_TILE;
}

/**
 * APK Steamer.hasCannonSmoke() 对 **所有 steamer unit（30/31/32/33）** 都返回 true
 * —— 蒸汽船/加特林双炮/马车蒸汽船 开火都有炮管冒烟。
 * GameObjectUnit 基类默认只对 unit==3（加农炮）返回 true。
 */
export function unitHasCannonSmoke(unitType: number): boolean {
    if (unitType >= 30 && unitType <= 33) {
        return true;
    }
    return unitType === 3;
}

export const BULLET_COLOR = { r: 127, g: 0, b: 0, a: 255 };
export const FIRE_LINE_COLOR = { r: 63, g: 0, b: 0, a: 255 };

export const SFX_LOK_STEAM = 'sfx_lok_steam';
export const STEAM_FRAMES = 5;
export const STEAM_ANIM_START = 1499;
export const STEAM_FRAME_MS = 300;
export const STEAM_SPAWN_DX = 1200;
export const STEAM_SPAWN_DY = -1440;
export const STEAM_RISE_PER_100MS = 600;
export const STEAM_SPOUT_DX = -1097;
export const STEAM_SPOUT_DY = -6144;
export const STEAM_INTERVAL_BASE = 500;
export const STEAM_INTERVAL_SPAN = 250;

export interface SteamCloud {
    id: number;
    x: number;
    y: number;
    animCounter: number;
    animFrm: number;
}

export interface LokSteamState {
    unitId: number;
    hOffset: number;
    vOffset: number;
    nextCloudCounter: number;
    nextCloudId: number;
    clouds: SteamCloud[];
}

/**
 * APK 原始行为：只有"机车头"才初始化 LokSteam（持续冒烟）。
 * - TrainHorizontal 构造里只 unit==10 才 this.lokSfx = new LokSteam()
 * - TrainVertical 构造里只 unit==21 才 this.lokSfx = new LokSteam()
 * - Steamer 构造里 switch 只有 case 31 才 this.lokSfx = new LokSteam(UNIT_PLACEMENT_OFFSET_Y, -4608)
 * 车厢/加特林车厢/蒸汽船加特林型等——全都没有 LokSteam。
 */
export function unitHasSteam(type: number, kind?: string): boolean {
    if (kind === 'trainH') {
        return type === 10;
    }
    if (kind === 'trainV') {
        return type === 21;
    }
    if (kind === 'steamer') {
        return type === 31;
    }
    // 兼容：kind 未传时的 type 范围兜底
    return type === 10 || type === 21 || type === 31;
}

export function createLokSteam(unitId: number, hOffset = 0, vOffset = 0): LokSteamState {
    return {
        unitId,
        hOffset,
        vOffset,
        nextCloudCounter: 0,
        nextCloudId: 1,
        clouds: [],
    };
}

/** 喷口：单位脚点再加 Java 里的 -1097、-6144，外加构造时的偏移。 */
export function steamSpoutFine(fineX: number, fineY: number, hOffset = 0, vOffset = 0): { x: number; y: number } {
    return { x: fineX + STEAM_SPOUT_DX + hOffset, y: fineY + STEAM_SPOUT_DY + vOffset };
}

/** 烟从喷口往右 1200、往上 1440 处出现，计时从 1499 开始。 */
export function createSteamCloud(spoutX: number, spoutY: number, id = 1): SteamCloud {
    return {
        id,
        x: spoutX + STEAM_SPAWN_DX,
        y: spoutY + STEAM_SPAWN_DY,
        animCounter: STEAM_ANIM_START,
        animFrm: steamFrame(STEAM_ANIM_START),
    };
}

/** 帧号是 4 减（剩余时间 ÷ 300），最大停在 4。横着切 5 帧。 */
export function steamFrame(animCounter: number): number {
    let frame = 4 - Math.trunc(animCounter / STEAM_FRAME_MS);
    if (frame >= 4) {
        frame = 4;
    }
    if (frame < 0) {
        frame = 0;
    }
    return frame;
}

/** 每 100 毫秒上升 600 fine（fineY 减小）。 */
export function steamRiseDelta(dtMs: number): number {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    return Math.trunc((STEAM_RISE_PER_100MS * dt) / 100);
}

export function updateSteamCloud(cloud: SteamCloud, dtMs: number): void {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    cloud.animCounter = Math.trunc(cloud.animCounter - dt);
    cloud.animFrm = steamFrame(cloud.animCounter);
    cloud.y -= steamRiseDelta(dt);
}

export function steamCloudGone(cloud: SteamCloud): boolean {
    return cloud.animCounter <= 0;
}

/**
 * 计时每帧减一次 dt；单位在动时再减一次，所以开起来时出烟更快。
 * 减到 0 就在喷口冒一朵，间隔是 random(250)+500。
 */
export function tickLokSteam(
    state: LokSteamState,
    unit: { fineX: number; fineY: number; xDir: number; yDir: number },
    dtMs: number,
    randomInt: (n: number) => number,
): void {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    state.nextCloudCounter = Math.trunc(state.nextCloudCounter - dt);
    if (unit.xDir !== 0 || unit.yDir !== 0) {
        state.nextCloudCounter = Math.trunc(state.nextCloudCounter - dt);
    }
    if (state.nextCloudCounter <= 0) {
        const spout = steamSpoutFine(unit.fineX, unit.fineY, state.hOffset, state.vOffset);
        state.clouds.push(createSteamCloud(spout.x, spout.y, state.nextCloudId++));
        state.nextCloudCounter = randomInt(STEAM_INTERVAL_SPAN) + STEAM_INTERVAL_BASE;
    }
    const live: SteamCloud[] = [];
    for (const cloud of state.clouds) {
        updateSteamCloud(cloud, dt);
        if (!steamCloudGone(cloud)) {
            live.push(cloud);
        }
    }
    state.clouds = live;
}
