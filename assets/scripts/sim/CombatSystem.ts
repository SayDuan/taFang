import { ACTIVITY_WORKING } from './Fine';
import { EnemyEntity } from './EnemySystem';
import { UnitEntity } from './UnitEntity';
import { PriorityMap } from './PriorityMap';
import {
    MIN_SHOOT_DIST_SQ,
    POISON_DELAY_MS,
    PRIO_CLICK_DIST_SQ,
    WeaponStats,
    aoeSquareRangeOf,
    combatDistSq,
    hasBurningAmmo,
    killWeight,
    maxSquareRangeOf,
    rangeCircleRadiusPx,
    shootAnimMs,
} from './UnitDesign';
import { playGameSfx, playHitSfx, playShotSfx } from './SoundEvents';
import {
    BLAST_PLAY_MS,
    MUZZLE_SMOKE_MS,
    POISON_SEGMENT_MS,
    ROCKET_SPARKLE_MS,
    ROCKET_TILE_RANGE_SQ,
    RingBurst,
    WagonFragment,
    createWagonFragments,
    deathVisualFor,
    flightTimeMs,
    interpolateFine,
    parabolaLift,
    blastRingPlacements,
    poisonRingPlacements,
    rocketMaxRange,
    rocketSwayOffset,
    rocketZigZagFactor,
    shouldSpawnWagonParts,
    unitHasCannonSmoke,
    updateWagonFragment,
    wagonFragmentGone,
    wagonSpillCount,
} from './ShotVisual';

const HORSE_TYPE = 8;
const CLICK_Y_ADJUST = 1920;

export interface CombatShot {
    shooterId: number;
    targetId: number;
    fineX: number;
    fineY: number;
    damage: number;
    damageType: number;
    damageStyle: number;
    postDamage: number;
    postDamageDuration: number;
    postSlowDownDuration: number;
    poisonDuration: number;
    poisonDamage: number;
    aoeSquareRange: number;
    currentStepsToTarget: number;
    currentStepsToResolve: number;
    damageDone: boolean;
    followTarget: boolean;
    fogActive: boolean;
    viewId?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    maxStepsToTarget?: number;
    oldX?: number;
    oldY?: number;
    zigZagFactor?: number;
    normalX?: number;
    normalY?: number;
    lastRocketX?: number;
    lastRocketY?: number;
    doRocketDamage?: boolean;
    hasRocketJumped?: boolean;
    maxRange?: number;
    maxSquareRange?: number;
    bulletSpeed?: number;
    aoeRangeFine?: number;
    resolve?: boolean;
    drawingLift?: number;
}

export interface SparkleFx {
    id: number;
    fineX: number;
    fineY: number;
    anim: number;
    animMax: number;
}

export interface MuzzleSmokeFx {
    id: number;
    fineX: number;
    fineY: number;
    anim: number;
}

export interface TimedSpriteFx {
    id: number;
    kind: 'blast' | 'poison';
    fineX: number;
    fineY: number;
    anim: number;
    animMax: number;
    delayLeft: number;
    poisonDuration?: number;
    originX?: number;
    originY?: number;
    rangeFine?: number;
    visible?: boolean;
}

export interface WagonPartGroup {
    id: number;
    parts: WagonFragment[];
}

export interface DifficultyAccum {
    num: number;
    den: number;
}

export interface CombatHooks {
    units: () => UnitEntity[];
    enemies: () => EnemyEntity[];
    weaponFor: (type: number, level: number) => WeaponStats | undefined;
    onKill?: (enemy: EnemyEntity, positionScore: number, weight: number) => void;
    onCash?: (amount: number) => void;
    isCanyon?: (col: number, row: number) => boolean;
    difficulty?: () => number;
    randomInt?: (n: number) => number;
    spawnWagonSpill?: (wagon: EnemyEntity, count: number) => void;
    removeEnemy?: (enemy: EnemyEntity) => void;
}

export function fireTickDamage(dot: number, dtMs: number, firePierce: number): number {
    const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
    return Math.trunc(firePierce * Math.trunc((dot * dt) / 100) / 100);
}

export function hitDamage(damage: number, pierce: number): number {
    return Math.trunc((damage * pierce) / 100);
}

export function shootRangeLimit(rangeSq: number, bonusAttribute: number): number {
    if (bonusAttribute === 4) {
        return Math.trunc((rangeSq * 150) / 100);
    }
    return rangeSq;
}

export class CombatSystem {
    readonly priority: PriorityMap | null;
    selectedPrioEnemyId = -1;
    shots: CombatShot[] = [];
    poisonTimer = 0;
    difficulty: DifficultyAccum = { num: 0, den: 0 };
    sparkles: SparkleFx[] = [];
    muzzleSmokes: MuzzleSmokeFx[] = [];
    spriteFx: TimedSpriteFx[] = [];
    wagonPartGroups: WagonPartGroup[] = [];
    nowMs = 0;
    /** 本次 tick 内是否有单位开火（apk 开火后隐藏出生口箭头）。 */
    firedThisTick = false;
    private hooks: CombatHooks;
    private nextFxId = 1;

    constructor(hooks: CombatHooks, priority: PriorityMap | null) {
        this.hooks = hooks;
        this.priority = priority;
    }

    getPrio(col: number, row: number): number {
        return this.priority ? this.priority.getPrio(col, row) : 0;
    }

    averageDifficulty(fallback = 1000): number {
        if (this.difficulty.den <= 0) {
            return fallback;
        }
        return Math.trunc(this.difficulty.num / this.difficulty.den);
    }

    recordKill(enemy: EnemyEntity): void {
        const pri = this.getPrio(enemy.fullX, enemy.fullY);
        const pos = this.priority ? this.priority.positionScore(enemy.fullX, enemy.fullY) : 1500;
        const weight = killWeight(enemy.type);
        this.difficulty.num += pos * weight;
        this.difficulty.den += weight;
        this.hooks.onKill?.(enemy, pos, weight);
        if (enemy.stats.bounty > 0) {
            this.hooks.onCash?.(enemy.stats.bounty);
        }
    }

    recordLeak(penalty: number, maxLives: number): void {
        if (penalty <= 0 || maxLives <= 0) {
            return;
        }
        this.difficulty.den += Math.trunc((200 / maxLives) * penalty);
    }

    /**
     * 点选优先目标。点马时选同一组里不是马的那个。再点同一个取消。
     * 点击 Y 按 Java 加 1920。判定距离平方小于 64（10=1 格）。
     */
    setEnemyAsTopPrio(fineX: number, fineY: number): boolean {
        const clickY = fineY + CLICK_Y_ADJUST;
        const enemies = this.hooks.enemies();
        let best: EnemyEntity | null = null;
        let bestDist = PRIO_CLICK_DIST_SQ;
        for (const e of enemies) {
            if (!e.alive) {
                continue;
            }
            const dist = combatDistSq(e.fineX, e.fineY, fineX, clickY);
            if (dist >= bestDist) {
                continue;
            }
            if (e.type === HORSE_TYPE) {
                const partner = enemies.find((o) => o.alive && o.type !== HORSE_TYPE && o.groupId === e.groupId);
                if (partner) {
                    best = partner;
                    bestDist = dist;
                }
            } else {
                best = e;
                bestDist = dist;
            }
        }
        if (!best) {
            return false;
        }
        if (this.selectedPrioEnemyId === best.id) {
            this.selectedPrioEnemyId = -1;
        } else {
            this.selectedPrioEnemyId = best.id;
        }
        return true;
    }

    applyWeaponStats(unit: UnitEntity, stats: WeaponStats, halfCooldown: boolean): void {
        unit.upgradeLevel = stats.level;
        unit.maxRange = stats.range;
        unit.maxSquareRange = maxSquareRangeOf(stats.range);
        unit.maxWeaponCooldown = Math.trunc((stats.reload * 100) / 100);
        unit.specialCoolDownCounter = stats.specialRate;
        if (halfCooldown) {
            unit.currentWeaponCooldown = Math.trunc(unit.maxWeaponCooldown / 2);
        }
    }

    beginHalfCooldown(unit: UnitEntity): void {
        unit.currentWeaponCooldown = Math.trunc(unit.maxWeaponCooldown / 2);
    }

    upgradeUnit(unit: UnitEntity): boolean {
        const nextLevel = (unit.upgradeLevel ?? 1) + 1;
        const stats = this.hooks.weaponFor(unit.type, nextLevel);
        if (!stats) {
            return false;
        }
        this.applyWeaponStats(unit, stats, true);
        return true;
    }

    canUnitShoot(unit: UnitEntity): boolean {
        return unit.canShootWeapon !== false;
    }

    private weaponOf(unit: UnitEntity): WeaponStats | undefined {
        return this.hooks.weaponFor(unit.type, unit.upgradeLevel ?? 1);
    }

    targetScore(unit: UnitEntity, enemy: EnemyEntity, stats: WeaponStats): number {
        const pierce = enemy.pierce[stats.damageType] ?? 0;
        let score = this.getPrio(enemy.fullX, enemy.fullY) * (pierce + 1400);
        if (enemy.damageOverTimeCounter > 0 && hasBurningAmmo(stats)) {
            score = Math.trunc(score / 2);
        }
        if (enemy.id === this.selectedPrioEnemyId) {
            score *= 10;
        }
        return score;
    }

    pickTarget(unit: UnitEntity): { enemy: EnemyEntity; distSq: number; score: number } | null {
        const stats = this.weaponOf(unit);
        if (!stats) {
            return null;
        }
        const limit = shootRangeLimit(unit.maxSquareRange, unit.bonusAttribute);
        let best: EnemyEntity | null = null;
        let bestScore = -1;
        let bestDist = 0;
        for (const enemy of this.hooks.enemies()) {
            if (!enemy.alive || enemy.hp <= 0 || enemy.type === HORSE_TYPE) {
                continue;
            }
            const distSq = combatDistSq(unit.fineX, unit.fineY, enemy.fineX, enemy.fineY);
            if (distSq >= limit || distSq <= MIN_SHOOT_DIST_SQ) {
                continue;
            }
            const score = this.targetScore(unit, enemy, stats);
            if (score > bestScore) {
                bestScore = score;
                best = enemy;
                bestDist = distSq;
            }
        }
        return best ? { enemy: best, distSq: bestDist, score: bestScore } : null;
    }

    /** 冷却递减、停稳且状态 5 时选目标开火。 */
    tickUnits(dtMs: number): void {
        const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
        this.firedThisTick = false;
        for (const unit of this.hooks.units()) {
            // 开枪动画计时对所有单位生效（包括刚被打断的），到期自动回走路图。
            if (unit.shootMs != null && unit.shootMs > 0) {
                unit.shootMs = Math.max(0, unit.shootMs - dt);
            }
            if (!unit.alive || unit.isEnemy || unit.activity !== ACTIVITY_WORKING) {
                continue;
            }
            if (unit.currentWeaponCooldown > 0) {
                unit.currentWeaponCooldown = Math.trunc(unit.currentWeaponCooldown - dt);
            }
            if (unit.bonusCounter <= 0) {
                unit.bonusAttribute = -1;
            } else {
                unit.bonusCounter = Math.trunc(unit.bonusCounter - dt);
            }
            if (unit.xDir !== 0 || unit.yDir !== 0 || unit.currentWeaponCooldown > 0 || !this.canUnitShoot(unit)) {
                continue;
            }
            const picked = this.pickTarget(unit);
            if (!picked) {
                continue;
            }
            this.fireShot(unit, picked.enemy, picked.distSq);
        }
    }

    fireShot(unit: UnitEntity, target: EnemyEntity, distSq: number): CombatShot | null {
        const stats = this.weaponOf(unit);
        if (!stats) {
            return null;
        }
        unit.currentWeaponCooldown = unit.maxWeaponCooldown;
        unit.specialCoolDownCounter -= 1;
        if (unit.specialCoolDownCounter <= 0) {
            unit.specialCoolDownCounter = stats.specialRate;
            unit.currentWeaponCooldown += Math.trunc((stats.specialReload * 100) / 100);
        }
        if (unit.bonusAttribute === 3) {
            unit.currentWeaponCooldown = Math.trunc((unit.currentWeaponCooldown * 100) / 150);
        }
        let damage = stats.damage;
        let postDamage = stats.dot;
        let postDamageDuration = Math.trunc((stats.dotTime * 100) / 100);
        let postSlow = Math.trunc((stats.slowTime * 100) / 100);
        let poisonDamage = stats.poisonDamage;
        if (unit.bonusAttribute === 4) {
            damage = Math.trunc((damage * 150) / 100);
            postDamage = Math.trunc((postDamage * 150) / 100);
            poisonDamage = Math.trunc((poisonDamage * 150) / 100);
        } else if (unit.bonusAttribute === 5) {
            postSlow = Math.max(Math.trunc((postSlow * 150) / 100), 2000);
        } else if (unit.bonusAttribute === 6) {
            postDamageDuration = Math.max(Math.trunc((postDamageDuration * 150) / 100), 5000);
            postDamage = Math.max(postDamage, 12);
        }
        const style = stats.damageStyle;
        let resolve = 0;
        if (style === 3 || style === 4 || style === 6) {
            resolve = 799;
        } else if (style === 5) {
            resolve = Math.trunc((stats.poisonTime * 100) / 100);
        }
        const startX = unit.fineX;
        const startY = unit.fineY;
        let endX = target.fineX;
        let endY = target.fineY;
        if (style === 0 || style === 1 || style === 2) {
            endY = endY - 1920;
        }
        // apk 在开火时记下目标方向，先把人转向敌人再画 shoot 图，子弹之后才飞出去。
        // 方向量化与 GameObjectShot.getShotSpawningOffset 一致：主轴取 ±1，次轴超过主轴一半才给 ±1。
        {
            const xdif = endX - startX;
            const ydif = endY - startY;
            let ox = 0;
            let oy = 0;
            if (Math.abs(xdif) > Math.abs(ydif)) {
                ox = xdif > 0 ? 1 : xdif < 0 ? -1 : 0;
                if (ydif < 0 && -ydif > ox * xdif / 2) {
                    oy = -1;
                } else if (ydif > 0 && ydif > ox * xdif / 2) {
                    oy = 1;
                }
            } else {
                oy = ydif > 0 ? 1 : ydif < 0 ? -1 : 0;
                if (xdif < 0 && -xdif > oy * ydif / 2) {
                    ox = -1;
                } else if (xdif > 0 && xdif > oy * ydif / 2) {
                    ox = 1;
                }
            }
            unit.shootDirX = ox;
            unit.shootDirY = oy;
        }
        unit.shootMs = shootAnimMs(unit.type);
        this.firedThisTick = true;
        const travel = flightTimeMs(style, stats.bulletSpeed, distSq, unit.maxSquareRange);
        let zigZagFactor = 0;
        let normalX = 0;
        let normalY = 0;
        let maxRange = 0;
        if (style === 6) {
            maxRange = rocketMaxRange(distSq, unit.maxSquareRange);
            const dx = endX - startX;
            const dy = endY - startY;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                normalX = -dy / len;
                normalY = dx / len;
            }
            zigZagFactor = rocketZigZagFactor(travel, stats.bulletSpeed, maxRange);
        }
        const shot: CombatShot = {
            shooterId: unit.id,
            targetId: target.id,
            fineX: startX,
            fineY: startY,
            damage,
            damageType: stats.damageType,
            damageStyle: style,
            postDamage,
            postDamageDuration,
            postSlowDownDuration: postSlow,
            poisonDuration: Math.trunc((stats.poisonTime * 100) / 100),
            poisonDamage,
            aoeSquareRange: aoeSquareRangeOf(stats.splash),
            currentStepsToTarget: travel,
            currentStepsToResolve: resolve,
            damageDone: false,
            followTarget: true,
            fogActive: style === 5,
            startX,
            startY,
            endX,
            endY,
            maxStepsToTarget: travel,
            oldX: startX,
            oldY: startY,
            zigZagFactor,
            normalX,
            normalY,
            lastRocketX: startX,
            lastRocketY: startY,
            doRocketDamage: false,
            hasRocketJumped: false,
            maxRange,
            maxSquareRange: unit.maxSquareRange,
            bulletSpeed: stats.bulletSpeed,
            aoeRangeFine: stats.splash,
            resolve: false,
            drawingLift: 0,
            viewId: this.nextFxId++,
        };
        this.shots.push(shot);
        playShotSfx(unit.type, style);
        if (unitHasCannonSmoke(unit.type)) {
            this.muzzleSmokes.push({
                id: this.nextFxId++,
                fineX: startX,
                fineY: startY,
                anim: MUZZLE_SMOKE_MS,
            });
        }
        return shot;
    }

    tickShots(dtMs: number): void {
        const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
        this.nowMs += dt;
        const remain: CombatShot[] = [];
        for (const shot of this.shots) {
            this.moveShot(shot, dt);
            if (shot.doRocketDamage) {
                shot.doRocketDamage = false;
                this.sparkles.push({
                    id: this.nextFxId++,
                    fineX: shot.fineX,
                    fineY: shot.fineY,
                    anim: ROCKET_SPARKLE_MS,
                    animMax: ROCKET_SPARKLE_MS,
                });
                this.applyRocketPathHits(shot);
            }
            if (shot.currentStepsToTarget > 0) {
                remain.push(shot);
                continue;
            }
            if (!shot.damageDone) {
                this.applyShotHits(shot);
                shot.damageDone = true;
                if (shot.damageStyle === 5) {
                    this.spawnPoisonRings(shot);
                }
            } else if (shot.fogActive && shot.poisonDuration > 0 && shot.currentStepsToResolve > 0) {
                // 验收：毒雾持续期间每帧重新挂毒；扣血仍由敌人侧 250ms 跳一次。
                this.applyShotPoison(shot);
            }
            if (shot.currentStepsToResolve > 0) {
                shot.currentStepsToResolve = Math.trunc(shot.currentStepsToResolve - dt);
            }
            if (shot.currentStepsToResolve > 0 || shot.currentStepsToTarget > 0) {
                remain.push(shot);
            }
        }
        this.shots = remain;
        this.tickVisualFx(dt);
    }

    /** 自检用：立刻落地结算尚未命中的子弹。 */
    resolvePendingHits(): void {
        for (const shot of this.shots) {
            shot.currentStepsToTarget = 0;
            if (!shot.damageDone) {
                this.applyShotHits(shot);
                shot.damageDone = true;
            }
        }
    }

    private shotTargets(shot: CombatShot): EnemyEntity[] {
        const enemies = this.hooks.enemies();
        const main = enemies.find((e) => e.id === shot.targetId) ?? null;
        if (shot.aoeSquareRange <= 0 && shot.followTarget) {
            return main && main.hp > 0 ? [main] : [];
        }
        const hits: EnemyEntity[] = [];
        for (const e of enemies) {
            if (!e || e.hp <= 0) {
                continue;
            }
            const dist = combatDistSq(shot.fineX, shot.fineY, e.fineX, e.fineY);
            if (dist < shot.aoeSquareRange || (main && e.id === main.id)) {
                hits.push(e);
            }
        }
        return hits;
    }

    private applyShotHits(shot: CombatShot): void {
        playHitSfx(shot.damageStyle);
        for (const e of this.shotTargets(shot)) {
            this.getsDamaged(e, shot);
        }
        if (shot.poisonDamage > 0 && shot.damageStyle !== 5) {
            for (const e of this.shotTargets(shot)) {
                this.getsPoisoned(e, shot.poisonDamage);
            }
        }
        if (shot.fogActive) {
            this.applyShotPoison(shot);
        }
    }

    private applyShotPoison(shot: CombatShot): void {
        for (const e of this.shotTargets(shot)) {
            this.getsPoisoned(e, shot.poisonDamage);
        }
    }

    getsDamaged(enemy: EnemyEntity, shot: CombatShot): void {
        if (enemy.type === HORSE_TYPE) {
            return;
        }
        if (enemy.hp <= 0) {
            return;
        }
        const pierce = enemy.pierce[shot.damageType] ?? 0;
        enemy.hp -= hitDamage(shot.damage, pierce);
        if (shot.postDamage > 0) {
            enemy.damageOverTime = shot.postDamage;
            if (shot.postDamageDuration > enemy.damageOverTimeCounter) {
                enemy.damageOverTimeCounter = shot.postDamageDuration;
            }
        }
        if (shot.postSlowDownDuration > 0) {
            if (shot.postSlowDownDuration > enemy.slowDownTimeCounter) {
                enemy.slowDownTimeCounter = shot.postSlowDownDuration;
            }
        }
    }

    getsPoisoned(enemy: EnemyEntity, poisonDamage: number): void {
        if (enemy.type === HORSE_TYPE) {
            return;
        }
        enemy.poisoned = true;
        enemy.damagePoison = poisonDamage;
    }

    /** 燃烧、中毒跳伤害、减速整组、死亡。放在敌人走动之后。 */
    tickEffects(dtMs: number): void {
        const dt = dtMs < 0 ? 0 : dtMs > 100 ? 100 : dtMs;
        let triggerPoison = false;
        this.poisonTimer += dt;
        if (this.poisonTimer > POISON_DELAY_MS) {
            triggerPoison = true;
            this.poisonTimer -= POISON_DELAY_MS;
        }
        const enemies = this.hooks.enemies();
        for (const e of enemies) {
            if (!e.alive) {
                continue;
            }
            if (e.damageOverTime > 0) {
                const firePierce = e.pierce[1] ?? 0;
                e.hp -= fireTickDamage(e.damageOverTime, dt, firePierce);
                e.damageOverTimeCounter = Math.trunc(e.damageOverTimeCounter - dt);
                if (e.damageOverTimeCounter <= 0) {
                    e.damageOverTime = 0;
                    e.damageOverTimeCounter = 0;
                }
            }
            if (e.poisoned && triggerPoison) {
                e.hp -= hitDamage(e.damagePoison, e.pierce[3] ?? 0);
                e.poisoned = false;
                e.damagePoison = 0;
            }
            if (e.slowDownTimeCounter > 0) {
                this.applyGroupSlow(e, enemies, true);
                e.slowDownTimeCounter = Math.trunc(e.slowDownTimeCounter - dt);
                if (e.slowDownTimeCounter <= 0) {
                    e.slowDownTimeCounter = 0;
                    this.applyGroupSlow(e, enemies, false);
                }
            }
            if (e.hp <= 0 && e.alive) {
                this.recordKill(e);
                this.beginDeath(e);
            }
        }
        this.tickDeaths(dt);
    }

    private applyGroupSlow(source: EnemyEntity, enemies: EnemyEntity[], slowed: boolean): void {
        const speed = slowed ? Math.trunc(source.maxSpeed / 2) : source.maxSpeed;
        for (const o of enemies) {
            if (o.groupId === source.groupId) {
                o.speed = speed;
            }
        }
    }

    rangeCircleRadiusPx(unit: UnitEntity, tilePx?: number): number {
        return rangeCircleRadiusPx(unit.maxSquareRange, unit.bonusAttribute, tilePx);
    }

    private isCanyonCol(col: number, row: number): boolean {
        return this.hooks.isCanyon ? this.hooks.isCanyon(col, row) : false;
    }

    private rand(n: number): number {
        return this.hooks.randomInt ? this.hooks.randomInt(n) : 0;
    }

    private moveShot(shot: CombatShot, dt: number): void {
        shot.oldX = shot.fineX;
        shot.oldY = shot.fineY;
        if (shot.maxStepsToTarget == null || shot.startX == null || shot.startY == null || shot.endX == null || shot.endY == null) {
            if (shot.currentStepsToTarget > 0) {
                shot.currentStepsToTarget = Math.trunc(shot.currentStepsToTarget - dt);
            }
            return;
        }
        if (shot.followTarget && !shot.resolve) {
            const target = this.hooks.enemies().find((e) => e.id === shot.targetId) ?? null;
            if (target && target.alive) {
                shot.endX = target.fineX;
                shot.endY = target.fineY;
                if (shot.damageStyle === 0 || shot.damageStyle === 1 || shot.damageStyle === 2) {
                    shot.endY = shot.endY - 1920;
                }
            } else if (!target) {
                shot.followTarget = false;
            }
        }
        shot.currentStepsToTarget = Math.trunc(shot.currentStepsToTarget - dt);
        if (shot.currentStepsToTarget <= 0) {
            shot.currentStepsToTarget = 0;
        }
        let x = interpolateFine(shot.startX, shot.endX, shot.currentStepsToTarget, shot.maxStepsToTarget);
        let y = interpolateFine(shot.startY, shot.endY, shot.currentStepsToTarget, shot.maxStepsToTarget);
        if (shot.zigZagFactor) {
            const sway = rocketSwayOffset(shot.currentStepsToTarget, shot.zigZagFactor, shot.normalX ?? 0, shot.normalY ?? 0);
            x += sway.x;
            y += sway.y;
        }
        shot.fineX = x;
        shot.fineY = y;
        shot.drawingLift = parabolaLift(shot.damageStyle, shot.currentStepsToTarget, shot.maxStepsToTarget);
        if (shot.hasRocketJumped && !this.isCanyonCol(Math.trunc(shot.fineX / 7680), Math.trunc(shot.fineY / 7680))) {
            shot.endX = shot.fineX;
            shot.endY = shot.fineY;
            shot.currentStepsToTarget = 0;
        }
        if (shot.currentStepsToTarget <= 0) {
            const flownSq = this.rocketFlownSq(shot);
            const rangeSq = shot.maxSquareRange ?? 0;
            if (shot.damageStyle !== 6 || shot.hasRocketJumped || flownSq >= rangeSq) {
                shot.currentStepsToTarget = 0;
                if (!shot.resolve) {
                    if (shot.damageStyle === 6) {
                        shot.doRocketDamage = true;
                    }
                    shot.resolve = true;
                }
            } else {
                this.extendRocket(shot, flownSq);
            }
        }
        if (shot.damageStyle === 6) {
            const lx = shot.lastRocketX ?? shot.startX;
            const ly = shot.lastRocketY ?? shot.startY;
            const span = (shot.fineX - lx) * (shot.fineX - lx) + (shot.fineY - ly) * (shot.fineY - ly);
            if (span > ROCKET_TILE_RANGE_SQ) {
                shot.doRocketDamage = true;
                shot.lastRocketX = shot.fineX;
                shot.lastRocketY = shot.fineY;
            }
        }
    }

    private rocketFlownSq(shot: CombatShot): number {
        const startX = shot.startX ?? shot.fineX;
        const startY = shot.startY ?? shot.fineY;
        const dx = Math.trunc(((shot.fineX - startX) * 10) / 7680);
        const dy = Math.trunc(((shot.fineY - startY) * 10) / 7680);
        return dx * dx + dy * dy;
    }

    private extendRocket(shot: CombatShot, flownSq: number): void {
        shot.hasRocketJumped = true;
        shot.followTarget = false;
        shot.targetId = -1;
        const startX = shot.startX ?? shot.fineX;
        const startY = shot.startY ?? shot.fineY;
        const maxRange = shot.maxRange ?? 0;
        const speed = Math.trunc(((shot.bulletSpeed ?? 0) * 100) / 100);
        if (flownSq >= 10) {
            const scale = maxRange / Math.sqrt(flownSq);
            shot.endX = Math.trunc((shot.endX! - startX) * scale) + startX;
            shot.endY = Math.trunc((shot.endY! - startY) * scale) + startY;
            shot.maxStepsToTarget = speed;
            shot.currentStepsToTarget = Math.trunc(speed * (1 - 1 / scale));
        } else {
            const ang = (this.rand(1000) / 1000) * 2 * Math.PI;
            shot.endX = startX + Math.trunc((Math.cos(ang) * maxRange * 7680) / 10);
            shot.endY = startY + Math.trunc((Math.sin(ang) * maxRange * 7680) / 10);
            shot.maxStepsToTarget = speed;
            shot.currentStepsToTarget = speed;
        }
    }

    /** 火箭沿途：溅射圈里的活人各扣一次，不打马。不含圈外的原目标。 */
    private applyRocketPathHits(shot: CombatShot): void {
        if (shot.aoeSquareRange <= 0 && shot.followTarget) {
            return;
        }
        for (const e of this.hooks.enemies()) {
            if (!e || e.hp <= 0) {
                continue;
            }
            const dist = combatDistSq(shot.fineX, shot.fineY, e.fineX, e.fineY);
            if (dist < shot.aoeSquareRange) {
                this.getsDamaged(e, shot);
            }
        }
    }

    private spawnPoisonRings(shot: CombatShot): void {
        const range = shot.aoeRangeFine ?? 0;
        const rings = poisonRingPlacements(shot.fineX, shot.fineY, range, (col, row) => this.isCanyonCol(col, row));
        for (const ring of rings) {
            this.spriteFx.push({
                id: this.nextFxId++,
                kind: 'poison',
                fineX: ring.fineX,
                fineY: ring.fineY,
                anim: POISON_SEGMENT_MS + ring.delay,
                animMax: POISON_SEGMENT_MS,
                delayLeft: shot.currentStepsToResolve,
                poisonDuration: shot.currentStepsToResolve,
                originX: shot.fineX,
                originY: shot.fineY,
                rangeFine: range,
                visible: true,
            });
        }
    }

    spawnBlastRings(originX: number, originY: number, aoeRangeFine: number): number {
        const rings = blastRingPlacements(originX, originY, aoeRangeFine, (col, row) => this.isCanyonCol(col, row));
        for (const ring of rings) {
            this.spriteFx.push({
                id: this.nextFxId++,
                kind: 'blast',
                fineX: ring.fineX,
                fineY: ring.fineY,
                anim: BLAST_PLAY_MS + ring.delay,
                animMax: BLAST_PLAY_MS,
                delayLeft: 0,
                visible: true,
            });
        }
        return rings.length;
    }

    private tickVisualFx(dt: number): void {
        const sparks: SparkleFx[] = [];
        for (const fx of this.sparkles) {
            fx.anim = Math.trunc(fx.anim - dt);
            if (fx.anim >= 0) {
                sparks.push(fx);
            }
        }
        this.sparkles = sparks;
        const smokes: MuzzleSmokeFx[] = [];
        for (const fx of this.muzzleSmokes) {
            fx.anim = Math.trunc(fx.anim - dt);
            if (fx.anim > 0) {
                smokes.push(fx);
            }
        }
        this.muzzleSmokes = smokes;
        const sprites: TimedSpriteFx[] = [];
        for (const fx of this.spriteFx) {
            fx.anim = Math.trunc(fx.anim - dt);
            if (fx.kind === 'poison') {
                fx.delayLeft = Math.trunc((fx.delayLeft ?? 0) - dt);
                if (fx.anim < 0) {
                    fx.anim = POISON_SEGMENT_MS;
                    if (Math.trunc((fx.anim * 3) / 4) <= (fx.delayLeft ?? 0)) {
                        this.relocatePoison(fx);
                        sprites.push(fx);
                    }
                    continue;
                }
            }
            if (fx.anim >= 0) {
                sprites.push(fx);
            }
        }
        this.spriteFx = sprites;
        const groups: WagonPartGroup[] = [];
        for (const group of this.wagonPartGroups) {
            const live: WagonFragment[] = [];
            for (const part of group.parts) {
                updateWagonFragment(part, dt);
                if (!wagonFragmentGone(part)) {
                    live.push(part);
                }
            }
            group.parts = live;
            if (live.length > 0) {
                groups.push(group);
            }
        }
        this.wagonPartGroups = groups;
    }

    private relocatePoison(fx: TimedSpriteFx): void {
        const ox = fx.originX ?? fx.fineX;
        const oy = fx.originY ?? fx.fineY;
        const range = fx.rangeFine ?? 0;
        const ang = (this.rand(1000) / 1000) * 2 * Math.PI;
        const dist = (this.rand(1000) / 1000) * range;
        fx.fineX = ox + Math.trunc(Math.cos(ang) * dist);
        fx.fineY = oy + Math.trunc(Math.sin(ang) * dist);
        fx.visible = this.isCanyonCol(Math.trunc(fx.fineX / 7680), Math.trunc(fx.fineY / 7680));
    }

    beginDeath(enemy: EnemyEntity): void {
        this.killOne(enemy);
        // apk：unitGroup 相同的马和车是一体，一个开始死，同组的全部一起死，不会出现棚炸了马还在走。
        if (isVehicleGroupType(enemy.type)) {
            for (const peer of this.hooks.enemies()) {
                if (peer === enemy || !peer.alive || peer.groupId !== enemy.groupId) {
                    continue;
                }
                if (isVehicleGroupType(peer.type)) {
                    this.killOne(peer);
                }
            }
        }
    }

    private killOne(enemy: EnemyEntity): void {
        if (!enemy.alive) {
            return;
        }
        enemy.alive = false;
        enemy.hp = 0;
        if (enemy.type === 4 || enemy.type === 5 || enemy.type === 6) {
            playGameSfx('wagon_explode');
        }
        const vis = deathVisualFor(enemy.type);
        enemy.deathAnimationStyle = vis.style;
        enemy.deathAnimationCounter = vis.duration;
        enemy.wagonPartsCreated = false;
    }

    private tickDeaths(dt: number): void {
        const leftovers: EnemyEntity[] = [];
        for (const e of this.hooks.enemies()) {
            if (e.alive || e.deathAnimationCounter == null) {
                continue;
            }
            e.deathAnimationCounter = Math.trunc(e.deathAnimationCounter - dt);
            if (shouldSpawnWagonParts(e.type, e.deathAnimationCounter, !!e.wagonPartsCreated)) {
                e.wagonPartsCreated = true;
                this.wagonPartGroups.push({
                    id: this.nextFxId++,
                    parts: createWagonFragments(e.fineX, e.fineY, (n) => this.rand(n)),
                });
                const difficulty = this.hooks.difficulty ? this.hooks.difficulty() : 1000;
                const count = wagonSpillCount(difficulty, e.type, (n) => this.rand(n));
                this.hooks.spawnWagonSpill?.(e, count);
            }
            if (e.deathAnimationCounter < 0) {
                leftovers.push(e);
            }
        }
        for (const e of leftovers) {
            this.hooks.removeEnemy?.(e);
        }
    }
}

/** 马（8）和三种车（4/5/6）算一个整体；移民组不跟着一起死。 */
function isVehicleGroupType(type: number): boolean {
    return type === 4 || type === 5 || type === 6 || type === 8;
}
