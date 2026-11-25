import {
    ACTIVITY_IDLE_WANDER,
    ACTIVITY_RETURNING,
    ACTIVITY_WORKING,
    FINE_PER_TILE,
    HALF_TILE,
    Rng,
    TrackingRng,
    defaultRng,
    tileCenterX,
} from './Fine';
import { CollisionBox, apkBasicCollision, buildingBox, decorBox, personBox } from './Collision';
import { UnitEntity, assignAdjacentVehicleGroups, createUnit, hireUnit, setDirection, syncFullAndBox } from './UnitEntity';
import {
    MoveWorld,
    Occupancy,
    aimAtFinger,
    arrowAngleRad,
    followVehicleGroup,
    probeVehicleBlocked,
    tickIdleOrTransit,
    tickWorkingMove,
    tryHire,
} from './UnitMovement';
import { TerrainMapsLike, isReachableGround } from './WalkGrid';
import { EnemyEntity, EnemySystem, EnemySystemOptions, RawMaps } from './EnemySystem';
import { CampaignProgress, campaignProgress } from './CampaignProgress';
import { WaveSystem, WaveSystemOptions } from './WaveSystem';
import { bottomBarIcons } from './BattleHud';
import { CombatSystem } from './CombatSystem';
import { playClearMusic, playGameSfx } from './SoundEvents';
import { LokSteamState, createLokSteam, isCanyonAt, tickLokSteam, unitHasSteam } from './ShotVisual';
import { PriorityMap } from './PriorityMap';
import { WeaponStats, findWeapon, normalizeWeapon } from './UnitDesign';
import {
    SPAWN_MAT_MAX_RESPAWN_COUNTER,
    SpawnMat,
    SpawnPoolAction,
    SpawnPoolManager,
    initSpawnOnMat,
    matCenterFineX,
    matCenterFineY,
} from './SpawnPool';
import {
    ShopDialog,
    isHireableActivity,
    isUpgradePossible,
    nextUpgradeLevel,
    unitRowPrice,
    upgradeFlavorText,
    upgradeImprovementLines,
    upgradeRowPrice,
} from './HireUpgrade';
import {
    ChestEntity,
    LEVEL1_CHEST,
    bonusMessageKey,
    collectChestReward,
    createChest,
    isChestCollectable,
    pickChestCell,
    rollChestType,
    tickChest,
} from './ChestSystem';
import {
    SpeechBubbleState,
    canPraise,
    createSpeechBubble,
    praisePhrase,
    tickSpeechBubble,
} from './SpeechBubble';
import {
    DYNAMITE_BOX_TYPE,
    DYNAMITE_COOLDOWN_MS,
    DYNAMITE_DAMAGE,
    DYNAMITE_DAMAGE_TYPE,
    DYNAMITE_RANGE_FINE,
    DYNAMITE_RESPAWN_ANIM_MS,
    DYNAMITE_TRIGGER_TYPE,
    canDetonate,
    explosionDamage,
    findDynamiteTarget,
    formatCooldownLabel,
    selectNearestIndex,
} from './Dynamite';
import {
    CASINO_SPAWN_TYPE,
    CardRevealState,
    GAMBLER_TYPE,
    GamblerCard,
    ParsedHand,
    canUseGamblerTime,
    defaultUnlockedForLevel,
    gamblerStake,
    instantSpawnOnMat,
    parseGamblerHandsTsv,
    playCards,
} from './Gambler';
import { isUnitUnlocked, unlockTipsForLevel, UnlockRow } from './UnitUnlock';
import { CampaignEndMessage, campaignEndMessage } from './CampaignEndText';
import {
    DIFFICULTY_START,
    MODE_NORMAL,
} from './EnemyCatalog';
import {
    HighScoreBoard,
    PickDifficultyResult,
    canPickDifficulty,
    computeHighScore,
    highScores,
    tryPickDifficulty,
} from './Difficulty';
import { ClearTallyState, TALLY_GROUP_COUNT, createClearTally, groupForUnit, tickClearTally } from './ClearTally';
import { MidLevelSave, SaveSession, applyBattle, captureBattle, regionOfLevel } from './SaveGame';


export interface PlacedOccupant {
    col: number;
    row: number;
    /** 装饰类型，12 棚屋占自身和左右；10 尸骨占自身和上一行。其它装饰占自身。 */
    decorType?: number;
    /** 出生点 1/2/4 占自身左右和上一行三格；3 帐篷占自身和左。 */
    spawnType?: number;
}

export interface SimOptions {
    maps: TerrainMapsLike;
    occupants?: PlacedOccupant[];
    rng?: Rng;
    cash?: number;
    hireCost?: (type: number) => number;
    speedFor?: (type: number, isEnemy: boolean) => number;
    weapons?: readonly WeaponStats[];
    weaponFor?: (type: number, level: number) => WeaponStats | undefined;
    /** 关卡「升级上限」。不传则不限制，留给旧自检。第 1 关应传 0。 */
    maxUpgrades?: number;
    spawnPoolActions?: readonly SpawnPoolAction[];
    /** 构造时按这一波执行出生池动作，默认 1。 */
    spawnPoolWave?: number;
    /** 关卡号，41 关起宝箱种类变成 1 到 7。默认 1。 */
    level?: number;
    chestCap?: number;
    chestTime?: number;
    chestOnFieldCap?: number;
    praiseUnit?: number;
    maxLives?: number;
    /** 关卡「赌徒时间」。缺列或 0 时赌徒入口不可用。第 1 关是 119000。 */
    gamblerTime?: number;
    finishedLevels?: readonly number[];
    hasAllUnitsUnlock?: boolean;
    gamblerHands?: readonly ParsedHand[];
    gamblerHandsText?: string;
}

export class BattleSim implements Occupancy {
    readonly maps: TerrainMapsLike;
    readonly units: UnitEntity[] = [];
    readonly chests: UnitEntity[] = [];
    readonly staticBoxes: CollisionBox[] = [];
    /** 出生口保留格：挡放人，但不挡敌人（apk 里这些只是临时 CollisionObject，不进 coList）。 */
    readonly spawnBoxes: CollisionBox[] = [];
    collectedChestIds: number[] = [];
    enemies: EnemySystem | null = null;
    waves: WaveSystem | null = null;
    combat: CombatSystem | null = null;
    progress: CampaignProgress = campaignProgress;
    levelCleared = false;
    cash: number;
    maxUpgrades: number;
    spawnPool: SpawnPoolManager;
    readonly mats: SpawnMat[] = [];
    level: number;
    chestCap: number;
    chestTime: number;
    chestOnFieldCap: number;
    praiseUnit: number;
    gamblerTime?: number;
    finishedLevels: number[] = [];
    hasAllUnitsUnlock = false;
    gamblerHands: ParsedHand[] = [];
    pendingStake = 0;
    cardReveal: CardRevealState | null = null;
    lastGambleCards: GamblerCard[] = [];
    lastGambleResult = 0;
    storedLives: number;
    storedMaxLives: number;
    remainingChests: number;
    chestSpawnTimer: number;
    nowMs = 0;
    readonly bubbles: SpeechBubbleState[] = [];
    dialog: ShopDialog = 'none';
    startingCash: number;
    startingLives: number;
    killAccrued = 0;
    killCounts: number[] = new Array(TALLY_GROUP_COUNT).fill(0);
    waitForDifficulty = false;
    difficultyPickEnabled = false;
    waitingToStart = false;
    waveStarted = false;
    difficultyTier: number | null = null;
    failed = false;
    purchaseOffered = false;
    outcome: 'none' | 'difficulty' | 'fail' | 'clear' | 'end-message' | 'name' | 'unlock' | 'hard-locked' = 'none';
    tally: ClearTallyState | null = null;
    pendingUnlocks: UnlockRow[] = [];
    /** apk dialog 19：结算 8 之前那段台词，只有 outcome 是 'end-message' 时有效。 */
    endMessage: CampaignEndMessage | null = null;
    promptName = false;
    highScoreValue = 0;
    scores: HighScoreBoard = highScores;
    pendingUnitId = -1;
    selectedId = -1;
    dragging = false;
    private touchMoved = false;
    fingerFineX = 0;
    fingerFineY = 0;
    readonly steamStates: LokSteamState[] = [];
    rng: Rng;
    saver: SaveSession | null = null;
    private startLayout: { type: number; activity: number; col: number; row: number; fromMapByte: boolean }[] = [];
    private startLayoutCaptured = false;
    private nextId = 1;
    private blocked: boolean[];
    private hireCost: (type: number) => number;
    private speedFor: (type: number, isEnemy: boolean) => number;
    private weaponFor: (type: number, level: number) => WeaponStats | undefined;
    private weapons: readonly WeaponStats[];

    constructor(opts: SimOptions) {
        this.maps = opts.maps;
        this.rng = new TrackingRng(opts.rng ?? defaultRng);
        this.cash = opts.cash ?? 65;
        this.startingCash = this.cash;
        this.hireCost = opts.hireCost ?? ((_t) => 75);
        this.weapons = (opts.weapons ?? []).map((w) => normalizeWeapon(w));
        this.speedFor = opts.speedFor ?? ((type, _isEnemy) => findWeapon(this.weapons, type, 1)?.speed ?? 1500);
        this.weaponFor = opts.weaponFor ?? ((type, level) => findWeapon(this.weapons, type, level));
        this.maxUpgrades = opts.maxUpgrades ?? Number.POSITIVE_INFINITY;
        this.spawnPool = new SpawnPoolManager(opts.spawnPoolActions ?? []);
        this.level = opts.level ?? 1;
        // apk 里宝箱参数恒取 gameDesignData[关卡-1]，也就是调用方传进来的 opts；原版没有任何按关卡写死的分支。
        const table = LEVEL1_CHEST;
        this.chestCap = opts.chestCap ?? table.chestCap;
        this.chestTime = opts.chestTime ?? table.chestTime;
        this.chestOnFieldCap = opts.chestOnFieldCap ?? table.chestOnFieldCap;
        this.praiseUnit = opts.praiseUnit ?? table.praiseUnit;
        this.gamblerTime = opts.gamblerTime;
        this.finishedLevels = [...(opts.finishedLevels ?? this.progress.finishedLevels())];
        this.hasAllUnitsUnlock = !!opts.hasAllUnitsUnlock;
        if (opts.gamblerHands) {
            this.gamblerHands = [...opts.gamblerHands];
        } else if (opts.gamblerHandsText) {
            this.gamblerHands = parseGamblerHandsTsv(opts.gamblerHandsText);
        }
        this.storedMaxLives = opts.maxLives ?? table.maxLives;
        this.storedLives = this.storedMaxLives;
        this.startingLives = this.storedLives;
        this.remainingChests = this.chestCap;
        this.chestSpawnTimer = this.chestTime;
        this.blocked = new Array(opts.maps.cols * opts.maps.rows).fill(false);
        if (opts.occupants) {
            for (const occ of opts.occupants) {
                this.markOccupant(occ);
                this.addStaticBox(occ);
                if (occ.spawnType !== undefined) {
                    this.mats.push({
                        col: occ.col,
                        row: occ.row,
                        spawnType: occ.spawnType,
                        spawningMode: false,
                        isCasino: occ.spawnType === CASINO_SPAWN_TYPE,
                    });
                }
            }
        }
        const startWave = opts.spawnPoolWave ?? 1;
        this.spawnPool.performActionsForWave(startWave);
    }

    private idx(col: number, row: number): number {
        return row * this.maps.cols + col;
    }

    private markCell(col: number, row: number): void {
        if (col < 0 || row < 0 || col >= this.maps.cols || row >= this.maps.rows) {
            return;
        }
        this.blocked[this.idx(col, row)] = true;
    }

    markOccupant(occ: PlacedOccupant): void {
        const { col, row } = occ;
        if (occ.spawnType === 1 || occ.spawnType === 2 || occ.spawnType === 4) {
            this.markCell(col, row);
            this.markCell(col - 1, row);
            this.markCell(col + 1, row);
            this.markCell(col - 1, row - 1);
            this.markCell(col, row - 1);
            this.markCell(col + 1, row - 1);
            return;
        }
        if (occ.spawnType === 3) {
            this.markCell(col, row);
            this.markCell(col - 1, row);
            return;
        }
        if (occ.decorType === 12) {
            this.markCell(col, row);
            this.markCell(col - 1, row);
            this.markCell(col + 1, row);
            return;
        }
        if (occ.decorType === 10) {
            this.markCell(col, row);
            this.markCell(col, row - 1);
            return;
        }
        this.markCell(col, row);
    }

    private addStaticBox(occ: PlacedOccupant): void {
        const fineX = tileCenterX(occ.col);
        const id = -this.nextId;
        if (occ.spawnType !== undefined) {
            const fineY = occ.row * FINE_PER_TILE + HALF_TILE;
            this.spawnBoxes.push(buildingBox(fineX, fineY, occ.spawnType, id));
        } else if (occ.decorType !== undefined) {
            // apk GameObjectDecoration 构造函数：
            //   fineX = xpixel - (fieldWidth - 1) * 3840
            //   fineY = ypixel + 3840
            // xpixel / ypixel 是格中心。只有 unit 12（shack，2 格宽）的 fieldWidth=2，
            // fineX 取格左边；其余装饰 fieldWidth=1，fineX 保持格中心。
            // 所有关卡统一按 fieldWidth 处理，不针对单关/单物件特判。
            const decorFineX = occ.decorType === 12 ? fineX - HALF_TILE : fineX;
            const fineY = (occ.row + 1) * FINE_PER_TILE;
            this.staticBoxes.push(decorBox(decorFineX, fineY, occ.decorType, id));
        }
    }

    fieldIsBlocked(col: number, row: number, ignoreId = -1): boolean {
        if (col < 0 || row < 0 || col >= this.maps.cols || row >= this.maps.rows) {
            return true;
        }
        if (this.blocked[this.idx(col, row)]) {
            return true;
        }
        for (const u of this.units) {
            if (!u.alive || u.id === ignoreId) {
                continue;
            }
            if (u.fullX === col && u.fullY === row) {
                return true;
            }
        }
        for (const c of this.chests) {
            if (!c.alive || c.id === ignoreId) {
                continue;
            }
            if (c.fullX === col && c.fullY === row) {
                return true;
            }
        }
        return false;
    }

    unitOnCell(col: number, row: number, ignoreId = -1): boolean {
        for (const u of this.units) {
            if (u.alive && u.id !== ignoreId && u.fullX === col && u.fullY === row) {
                return true;
            }
        }
        return false;
    }

    addUnit(opts: Omit<Parameters<typeof createUnit>[0], 'id' | 'speed'> & { speed?: number; id?: number }): UnitEntity {
        const id = opts.id ?? this.nextId++;
        if (id >= this.nextId) {
            this.nextId = id + 1;
        }
        const unit = createUnit({
            ...opts,
            id,
            speed: opts.speed ?? this.speedFor(opts.type, !!opts.isEnemy),
        });
        syncFullAndBox(unit);
        const stats = this.weaponFor(unit.type, unit.upgradeLevel ?? 1);
        if (stats && !unit.isEnemy) {
            this.ensureCombat().applyWeaponStats(unit, stats, true);
        }
        this.configureSpecialUnit(unit);
        this.units.push(unit);
        this.ensureSteam(unit);
        if (unit.type === 7 || unit.type === 8 || unit.type === 9) {
            this.bindSpecials();
        }
        return unit;
    }

    addChest(col: number, row: number, type = 2, falling = false): UnitEntity {
        const chest = createChest(this.nextId++, col, row, type, falling);
        this.chests.push(chest);
        return chest;
    }

    private livesNow(): number {
        return this.enemies?.lives ?? this.storedLives;
    }

    private maxLivesNow(): number {
        return this.enemies?.maxLives ?? this.storedMaxLives;
    }

    addCash(amount: number): void {
        this.cash += amount;
    }

    addLives(amount: number): void {
        const cap = this.maxLivesNow();
        const next = Math.min(cap, this.livesNow() + amount);
        if (this.enemies) {
            this.enemies.lives = next < 0 ? 0 : next;
        }
        this.storedLives = next < 0 ? 0 : next;
    }

    enqueueBubble(text: string): void {
        this.bubbles.push(createSpeechBubble(text));
    }

    bubbleShowing(): boolean {
        return this.bubbles.some((b) => b.started && !b.ended);
    }

    tryPraise(killedType: number): string | null {
        const avg = this.ensureCombat().averageDifficulty(0);
        if (!canPraise(killedType, this.praiseUnit, avg, this.bubbleShowing())) {
            return null;
        }
        const phrase = praisePhrase(avg, this.rng.int(3));
        this.enqueueBubble(phrase);
        return phrase;
    }

    /** 从地图字节生成单位：待售 4，已放置 5。fineY = row*7680+5760。 */
    addMapUnit(col: number, row: number, type: number, activity: number): UnitEntity {
        return this.addUnit({
            type,
            activity,
            col,
            row,
            fromMapByte: true,
        });
    }

    /** 出生垫生成：最终 fineY 是格子中心再加 3840。默认闲逛待售。 */
    spawnFromPad(col: number, row: number, type: number, activity = ACTIVITY_IDLE_WANDER): UnitEntity {
        const fineX = tileCenterX(col);
        const fineY = row * FINE_PER_TILE + HALF_TILE + 1920 * 2;
        return this.addUnit({ type, activity, fineX, fineY, fromMapByte: false });
    }

    /** 单位侧的碰撞集合（cmUnits）：装饰、出生口、其他单位、宝箱。敌人不在这里，单位不会撞敌人。 */
    private world(): MoveWorld {
        const self = this;
        const boxes: CollisionBox[] = this.staticBoxes.concat(this.spawnBoxes);
        for (const u of this.units) {
            if (u.alive) {
                u.box.groupId = u.groupId;
                boxes.push(u.box);
            }
        }
        for (const c of this.chests) {
            if (c.alive) {
                boxes.push(c.box);
            }
        }
        return {
            maps: this.maps,
            occupancy: this,
            boxes,
            chests: this.chests,
            collectChest(chest: UnitEntity, walker: UnitEntity): void {
                if (!isChestCollectable(chest)) {
                    return;
                }
                const type = collectChestReward(chest as ChestEntity, walker, {
                    lives: self.livesNow(),
                    maxLives: self.maxLivesNow(),
                    addCash: (n) => self.addCash(n),
                    addLives: (n) => self.addLives(n),
                    rng: self.rng,
                });
                playGameSfx('pickup');
                // apk collectReward：每个箱子都会把对应奖励文案塞进气泡队列。
                const message = bonusMessageKey(type);
                if (message) {
                    self.enqueueBubble(message);
                }
                self.collectedChestIds.push(chest.id);
            },
        };
    }

    /**
     * 整关唯一推进拍，也就是 GameSim.tick(dt)。
     * 同一拍里走波次、移动、战斗、宝箱、出生池、雇佣后的冷却和胜负；中途档在每一波开始时写入。
     * 视图只调用这一拍和玩家输入，不另写关卡脚本。
     */
    tick(dtMs: number): void {
        if (dtMs < 0) {
            dtMs = 0;
        } else if (dtMs > 100) {
            dtMs = 100;
        }
        if (dtMs <= 0) {
            return;
        }
        if (this.failed || this.levelCleared) {
            return;
        }
        const world = this.world();
        const selected = this.unitById(this.selectedId);
        if (this.dragging && selected && selected.activity === ACTIVITY_WORKING && selected.canWalk) {
            aimAtFinger(selected, this.fingerFineX, this.fingerFineY);
            followVehicleGroup(selected, this.units);
        }
        // apk UnitDirector.moveUnits() 严格分两轮，顺序不可交换：
        // 第一轮对所有单位做 makeMoveCheck()（只探测、不移动）；任一复合单位（火车/船）
        // 被挡，就 setDirection(0,0) 并 handleMultiMovements(un,0,0) 把整组方向立刻清零。
        // 第二轮才 handleUnit() 真正移动。这样前车撞墙那一帧，后车还没动，整组一起停住。
        // 旧实现边移动边记录，等这一轮所有车都走完才停组，于是前车停下后后车继续挤上来，
        // 间距被一节节压缩到 180，正是往一个方向拖就堆叠的根因。
        const blockedVehicleGroups = new Set<number>();
        for (const unit of this.units) {
            if (!unit.alive) {
                continue;
            }
            if (unit.kind === 'trainH' || unit.kind === 'trainV' || unit.kind === 'steamer') {
                if (probeVehicleBlocked(unit, world, dtMs)) {
                    blockedVehicleGroups.add(unit.groupId);
                }
            }
        }
        if (blockedVehicleGroups.size > 0) {
            // handleMultiMovements(un,0,0)：同组每节都 setDirection(0,0)。
            for (const unit of this.units) {
                if (unit.alive
                    && (unit.kind === 'trainH' || unit.kind === 'trainV' || unit.kind === 'steamer')
                    && blockedVehicleGroups.has(unit.groupId)) {
                    setDirection(unit, 0, 0);
                }
            }
        }
        // 第二轮：方向已被第一轮的整组叫停修正过，此时才真正移动。
        for (const unit of this.units) {
            if (!unit.alive) {
                continue;
            }
            if (unit.activity === ACTIVITY_WORKING) {
                tickWorkingMove(unit, world, dtMs);
            } else {
                tickIdleOrTransit(unit, world, dtMs, this.rng);
            }
            this.tickSteamFor(unit, dtMs);
        }
        const combat = this.ensureCombat();
        combat.tickUnits(dtMs);
        // apk UnitDirector：本波第一次开火后关闭出生口箭头，进入下一波时重新打开。
        if (combat.firedThisTick && this.waves) {
            this.waves.waveArrowVisible = false;
        }
        combat.tickShots(dtMs);
        if (this.enemies) {
            this.enemies.tick(dtMs);
        }
        combat.tickEffects(dtMs);
        if ((this.enemies?.lives ?? this.storedLives) <= 0) {
            this.enterFail();
            return;
        }
        if (this.waves && !this.waitingToStart) {
            const justStarted = !this.waveStarted;
            this.waveStarted = true;
            if (justStarted) {
                this.persistMidSave();
            }
            this.waves.tick(dtMs);
            const lives = this.enemies?.lives ?? 0;
            const adv = this.waves.checkAdvance(lives);
            if (adv === 'next') {
                this.spawnPool.performActionsForWave(this.waves.waveNumber);
                this.persistMidSave();
            }
            if (adv === 'cleared') {
                this.enterClear();
            }
        }
        this.tickDynamite(dtMs);
        // apk GunsAndGloryThread L748-753：mWaitStartLevel 只挡住 wm.updateWave()，
        // spm.update()（出生池、宝箱计时）和垫子刷人从进关第一帧起就跟着主循环走，不等第一波。
        this.tickSpawnLocations(dtMs);
        this.tickSpawnPool(dtMs);
        this.tickChests(dtMs);
        this.tickBubbles(dtMs);
    }

    private tickSpawnPool(dtMs: number): void {
        const attempt = this.spawnPool.update(dtMs, this.mats, this.rng);
        if (!attempt?.spawned) {
            return;
        }
        // apk SpawnPoolManager.update：只调垫子的 initSpawn 开门，人到 1000ms 后才从垫子里走出来。
        const mat = this.mats.find((m) => m.col === attempt.col && m.row === attempt.row);
        if (mat) {
            initSpawnOnMat(mat, attempt.type);
        }
    }

    /**
     * apk GameObjectSpawnLocation.update：垫子开门 1500ms，计数低于 1/3 时从垫子中心出人；
     * 出生点被占就重置计数下一轮再试，计数归零关门。普通刷出（活动 2）和赌场即时刷出（活动 6）共用这套逻辑。
     */
    private tickSpawnLocations(dtMs: number): void {
        for (const mat of this.mats) {
            if (!mat.spawningMode) {
                continue;
            }
            mat.respawnCounter = Math.trunc((mat.respawnCounter ?? 0) - dtMs);
            const pending = mat.instantSpawnType ?? -1;
            if ((mat.respawnCounter ?? 0) < Math.trunc(SPAWN_MAT_MAX_RESPAWN_COUNTER / 3) && pending >= 0) {
                const activity = mat.unitActivity ?? ACTIVITY_IDLE_WANDER;
                const fineX = matCenterFineX(mat.col);
                const fineY = matCenterFineY(mat.row);
                // apk：活动 6（赌场奖励）不测碰撞，普通刷出要 testBasicCollision。
                if (activity === ACTIVITY_RETURNING || this.canSpawnUnitAt(fineX, fineY)) {
                    this.addUnit({ type: pending, activity, fineX, fineY, fromMapByte: false });
                    mat.instantSpawnType = -1;
                } else {
                    mat.respawnCounter = SPAWN_MAT_MAX_RESPAWN_COUNTER;
                }
            }
            if ((mat.respawnCounter ?? 0) <= 0) {
                mat.spawningMode = false;
            }
        }
    }

    /**
     * apk GameObjectSpawnLocation.update 的出人前检测：gom.cmUnits.testBasicCollision(spawn.co)。
     * 1) 与 cmUnits（装饰、出生口、单位、宝箱）做 0 位移 boxCheck，只有盒边正好贴住才算被占，
     *    普通矩形重叠不算——出生口自己的建筑盒虽然罩住人盒，原版也不会因此挡住刷人；
     * 2) cmUnits 构造时 checkBackgroundMapCollisions = true，人盒四角落在不可走地形也算被占。
     */
    private canSpawnUnitAt(fineX: number, fineY: number): boolean {
        const box = personBox(fineX, fineY, -1);
        for (const other of this.world().boxes) {
            if (apkBasicCollision(box, other)) {
                return false;
            }
        }
        const corners: Array<[number, number]> = [
            [box.startX, box.startY],
            [box.endX, box.endY],
            [box.startX, box.endY],
            [box.endX, box.startY],
        ];
        for (const [x, y] of corners) {
            if (!isReachableGround(this.maps, Math.floor(x / FINE_PER_TILE), Math.floor(y / FINE_PER_TILE))) {
                return false;
            }
        }
        return true;
    }

    private tickChests(dtMs: number): void {
        // 难度未选时不推进补给箱：不减计时、不生成、不播落地/浮动动画。
        // 原版 spm.update() 虽不受 mWaitStartLevel 门控，但其 dt 来自主循环；
        // 本项目在选难度弹窗期间把补给箱整体冻结，保证弹窗关掉后才开始出现补给箱。
        if (this.waitForDifficulty) {
            return;
        }
        this.nowMs += dtMs;
        this.chestSpawnTimer = Math.trunc(this.chestSpawnTimer - dtMs);
        if (this.chestSpawnTimer < 0) {
            const onField = this.chests.filter((c) => !c.chestRemove).length;
            if (this.remainingChests > 0 && onField < this.chestOnFieldCap) {
                const type = rollChestType(this.rng, this.level, this.livesNow(), this.maxLivesNow());
                const cell = pickChestCell(this.maps, this.rng, (col, row) => this.fieldIsBlocked(col, row));
                if (cell) {
                    this.addChest(cell.col, cell.row, type, true);
                    this.remainingChests -= 1;
                }
            }
            this.chestSpawnTimer = this.chestTime;
        }
        const remain: UnitEntity[] = [];
        for (const chest of this.chests) {
            tickChest(chest as ChestEntity, dtMs);
            if (!(chest as ChestEntity).chestRemove) {
                remain.push(chest);
            }
        }
        this.chests.length = 0;
        this.chests.push(...remain);
    }

    private tickBubbles(dtMs: number): void {
        const first = this.bubbles[0];
        if (!first) {
            return;
        }
        if (!first.started) {
            first.started = true;
            first.elapsedMs = 0;
        }
        tickSpeechBubble(first, dtMs);
        if (first.ended) {
            this.bubbles.shift();
            if (this.bubbles[0]) {
                this.bubbles[0].started = true;
                this.bubbles[0].elapsedMs = 0;
                this.bubbles[0].ended = false;
            }
        }
    }

    unitById(id: number): UnitEntity | null {
        for (const u of this.units) {
            if (u.id === id) {
                return u;
            }
        }
        return null;
    }

    /** 点到碰撞盒、所在格子、脚底为底的立着选中盒，或中心附近半格内的单位。待售的只选中，不叫醒。 */
    pickAt(fineX: number, fineY: number): UnitEntity | null {
        let best: UnitEntity | null = null;
        let bestDist = Infinity;
        // 切图人物高 44 像素，官方 beenHit 再加 gs_selection_tolerance 15dip。
        const hitH = Math.round((44 * FINE_PER_TILE) / 32);
        const pad = Math.round((15 * FINE_PER_TILE) / 32);
        const halfW = Math.round(hitH / 2) + pad;
        for (const u of this.units) {
            if (!u.alive) {
                continue;
            }
            const inBox = fineX >= u.box.startX && fineX < u.box.endX && fineY >= u.box.startY && fineY < u.box.endY;
            const inTile = Math.floor(fineX / FINE_PER_TILE) === u.fullX && Math.floor(fineY / FINE_PER_TILE) === u.fullY;
            const nearCenter = Math.abs(fineX - u.fineX) < HALF_TILE && Math.abs(fineY - u.fineY) < HALF_TILE;
            const inSprite = fineX >= u.fineX - halfW && fineX < u.fineX + halfW
                && fineY >= u.fineY - hitH - pad && fineY <= u.fineY + pad;
            if (!inBox && !inTile && !nearCenter && !inSprite) {
                continue;
            }
            const dist = Math.abs(fineX - u.fineX) + Math.abs(fineY - u.fineY);
            if (dist < bestDist) {
                bestDist = dist;
                best = u;
            }
        }
        return best;
    }

    onTouchStart(fineX: number, fineY: number): UnitEntity | null {
        const hit = this.pickAt(fineX, fineY);
        this.fingerFineX = fineX;
        this.fingerFineY = fineY;
        this.touchMoved = false;
        if (!hit) {
            this.selectedId = -1;
            this.dragging = false;
            return null;
        }
        this.selectedId = hit.id;
        if (hit.activity === ACTIVITY_WORKING && hit.canWalk) {
            this.dragging = true;
            aimAtFinger(hit, fineX, fineY);
            followVehicleGroup(hit, this.units);
        } else {
            this.dragging = false;
        }
        return hit;
    }

    onTouchMove(fineX: number, fineY: number): void {
        if (Math.abs(fineX - this.fingerFineX) > 64 || Math.abs(fineY - this.fingerFineY) > 64) {
            this.touchMoved = true;
        }
        this.fingerFineX = fineX;
        this.fingerFineY = fineY;
        const selected = this.unitById(this.selectedId);
        if (this.dragging && selected && selected.activity === ACTIVITY_WORKING) {
            aimAtFinger(selected, fineX, fineY);
            followVehicleGroup(selected, this.units);
        }
    }

    onTouchEnd(): void {
        this.dragging = false;
        const selected = this.unitById(this.selectedId);
        if (selected && selected.activity === ACTIVITY_WORKING) {
            setDirection(selected, 0, 0);
            followVehicleGroup(selected, this.units);
        }
    }

    groupMapVehicles(): void {
        assignAdjacentVehicleGroups(this.units);
    }

    private ensureSteam(unit: UnitEntity): void {
        if (!unitHasSteam(unit.type, unit.kind) || unit.isEnemy) {
            return;
        }
        if (this.steamStates.some((s) => s.unitId === unit.id)) {
            return;
        }
        // APK：Steamer(type==31) 构造 LokSteam(UNIT_PLACEMENT_OFFSET_Y=1920, -4608)
        //         TrainHorizontal/TrainVertical 基类默认 LokSteam() offset=(0,0)
        if (unit.kind === 'steamer' && unit.type === 31) {
            this.steamStates.push(createLokSteam(unit.id, 1920, -4608));
        } else {
            this.steamStates.push(createLokSteam(unit.id));
        }
    }

    private tickSteamFor(unit: UnitEntity, dtMs: number): void {
        if (!unitHasSteam(unit.type, unit.kind) || unit.isEnemy) {
            return;
        }
        this.ensureSteam(unit);
        const state = this.steamStates.find((s) => s.unitId === unit.id);
        if (!state) {
            return;
        }
        tickLokSteam(state, unit, dtMs, (n) => this.rng.int(n));
    }

    steamClouds(): LokSteamState['clouds'] {
        const out: LokSteamState['clouds'] = [];
        for (const state of this.steamStates) {
            out.push(...state.clouds);
        }
        return out;
    }

    priceOf(unit: UnitEntity): number {
        return unitRowPrice(this.weaponFor, unit, this.hireCost(unit.type));
    }

    upgradePriceOf(unit: UnitEntity): number | undefined {
        return upgradeRowPrice(this.weaponFor, unit);
    }

    canUpgrade(unit: UnitEntity): boolean {
        const next = this.weaponFor(unit.type, nextUpgradeLevel(unit.upgradeLevel ?? 1));
        return isUpgradePossible(unit.upgradeLevel ?? 1, this.maxUpgrades, !!next);
    }

    /** apk dialog 7 的「升级提高：」列表：本级和下一级逐列比。 */
    upgradeImprovementLines(unit: UnitEntity): string[] {
        return upgradeImprovementLines(
            this.weaponFor(unit.type, unit.upgradeLevel ?? 1),
            this.weaponFor(unit.type, nextUpgradeLevel(unit.upgradeLevel ?? 1)),
        );
    }

    /** apk getUpgradeText(possible)：possible 只看这一关的升级价付不付得起。 */
    upgradeDialogText(unit: UnitEntity): string {
        const price = this.upgradePriceOf(unit) ?? 0;
        return upgradeFlavorText(unit.type, this.cash >= price);
    }

    /** 点待购买的人：钱够进入确认，不够提示没钱。不改活动、不扣钱。 */
    requestHire(unit: UnitEntity): ShopDialog {
        if (!isHireableActivity(unit.activity)) {
            this.dialog = 'none';
            this.pendingUnitId = -1;
            return 'none';
        }
        this.pendingUnitId = unit.id;
        this.selectedId = unit.id;
        if (this.cash < this.priceOf(unit)) {
            this.dialog = 'no-money';
            return 'no-money';
        }
        this.dialog = 'hire-confirm';
        return 'hire-confirm';
    }

    confirmHire(): boolean {
        if (this.dialog !== 'hire-confirm') {
            return false;
        }
        const unit = this.unitById(this.pendingUnitId);
        this.dialog = 'none';
        this.pendingUnitId = -1;
        if (!unit) {
            return false;
        }
        return this.hire(unit);
    }

    cancelDialog(): void {
        this.dialog = 'none';
        this.pendingUnitId = -1;
    }

    /** 点升级木牌：上限为 0 或已到最后一行则无效。 */
    requestUpgrade(unit: UnitEntity): ShopDialog {
        if (!this.canUpgrade(unit)) {
            return 'none';
        }
        this.pendingUnitId = unit.id;
        this.selectedId = unit.id;
        this.dialog = 'upgrade-confirm';
        return 'upgrade-confirm';
    }

    /** 先换成新的一行，再扣这一行的价格。 */
    confirmUpgrade(): boolean {
        if (this.dialog !== 'upgrade-confirm') {
            return false;
        }
        const unit = this.unitById(this.pendingUnitId);
        this.dialog = 'none';
        this.pendingUnitId = -1;
        if (!unit) {
            return false;
        }
        return this.tryUpgrade(unit);
    }

    tryUpgrade(unit: UnitEntity): boolean {
        if (!this.canUpgrade(unit)) {
            return false;
        }
        const price = this.upgradePriceOf(unit);
        if (price === undefined) {
            return false;
        }
        if (!this.ensureCombat().upgradeUnit(unit)) {
            return false;
        }
        this.cash -= price;
        return true;
    }

    hireSelected(): boolean {
        const unit = this.unitById(this.selectedId);
        if (!unit) {
            return false;
        }
        return this.hire(unit);
    }

    hire(unit: UnitEntity): boolean {
        const cost = this.priceOf(unit);
        if (this.cash < cost) {
            return false;
        }
        if (!tryHire(unit) && !hireUnit(unit)) {
            return false;
        }
        this.cash -= cost;
        // apk GameObjectCompoundUnit.canSpawn()==false：火车/轮船买下来就是场上这一列，不再回到营地出生池，
        // 否则每 15 秒会从酒馆再刷一辆免费火车。
        if (unit.kind !== 'trainH' && unit.kind !== 'trainV' && unit.kind !== 'steamer') {
            this.spawnPool.addUnitToSpawnPool(unit.type);
        }
        if (unit.maxWeaponCooldown > 0) {
            this.beginHalfCooldown(unit);
        }
        return true;
    }

    /** 松手且没拖动时，若点的是待雇佣的人，弹出确认或没钱提示。 */
    maybeOpenHireOnTap(unit: UnitEntity | null): ShopDialog {
        if (this.touchMoved || !unit || !isHireableActivity(unit.activity)) {
            return 'none';
        }
        return this.requestHire(unit);
    }

    arrowVisible(): boolean {
        return this.dragging && this.selectedId >= 0;
    }

    arrowAngle(): number {
        return arrowAngleRad(0, 0, this.fingerFineX, this.fingerFineY);
    }

    /** 箭头从单位指向手指，水平向右为 0。fineY 向下，世界 Y 向上，视图里再取反 Y。 */
    arrowFromTo(mapRows: number): { fromX: number; fromY: number; toX: number; toY: number; angle: number } | null {
        const unit = this.unitById(this.selectedId);
        if (!unit || !this.dragging) {
            return null;
        }
        return {
            fromX: unit.fineX,
            fromY: unit.fineY,
            toX: this.fingerFineX,
            toY: this.fingerFineY,
            angle: arrowAngleRad(unit.fineX, unit.fineY, this.fingerFineX, this.fingerFineY),
        };
    }

    attachEnemies(opts: Omit<EnemySystemOptions, 'maps'>): EnemySystem {
        const maps = this.maps as RawMaps;
        this.enemies = new EnemySystem({ ...opts, maps, rng: opts.rng ?? this.rng });
        this.storedLives = this.enemies.lives;
        this.storedMaxLives = this.enemies.maxLives;
        this.startingLives = this.enemies.lives;
        this.rebuildCombat();
        return this.enemies;
    }

    attachWaves(opts: Omit<WaveSystemOptions, 'enemies'>): WaveSystem | null {
        if (!this.enemies) {
            return null;
        }
        this.waves = new WaveSystem({
            ...opts,
            enemies: this.enemies,
            rng: opts.rng ?? this.rng,
            progress: opts.progress ?? this.progress,
            averageDifficulty: opts.averageDifficulty ?? (() => this.combat?.averageDifficulty(this.waves?.difficulty ?? 1000) ?? 1000),
        });
        return this.waves;
    }

    ensureCombat(): CombatSystem {
        if (!this.combat) {
            this.rebuildCombat();
        }
        return this.combat!;
    }

    rebuildCombat(): CombatSystem {
        let priority: PriorityMap | null = null;
        const maps = this.maps as RawMaps;
        if (maps && maps.raw) {
            priority = new PriorityMap(maps);
        }
        this.combat = new CombatSystem({
            units: () => this.units,
            enemies: () => this.enemies?.enemies ?? [],
            weaponFor: (type, level) => this.weaponFor(type, level),
            onCash: (amount) => {
                this.cash += amount;
            },
            onKill: (enemy) => {
                if (enemy.stats.bounty > 0) {
                    this.killAccrued += enemy.stats.bounty;
                }
                const group = groupForUnit(enemy.type);
                if (group >= 0) {
                    this.killCounts[group] += 1;
                }
                this.tryPraise(enemy.type);
            },
            isCanyon: (col, row) => {
                const m = this.maps;
                if (!m) {
                    return false;
                }
                return isCanyonAt(m.cols, m.rows, m.background, col, row);
            },
            difficulty: () => this.enemies?.difficulty ?? this.waves?.difficulty ?? 1000,
            randomInt: (n) => this.rng.int(n),
            spawnWagonSpill: (wagon, count) => {
                this.enemies?.spillSettlers(wagon, count);
            },
            removeEnemy: (enemy) => {
                this.enemies?.removeDead(enemy);
            },
        }, priority);
        return this.combat;
    }

    trySelectPrioEnemy(fineX: number, fineY: number): boolean {
        return this.ensureCombat().setEnemyAsTopPrio(fineX, fineY);
    }

    upgradeUnit(unit: UnitEntity): boolean {
        return this.ensureCombat().upgradeUnit(unit);
    }

    beginHalfCooldown(unit: UnitEntity): void {
        this.ensureCombat().beginHalfCooldown(unit);
    }

    rangeCircleRadiusPx(unit: UnitEntity): number {
        return this.ensureCombat().rangeCircleRadiusPx(unit);
    }

    selectedPrioEnemyId(): number {
        return this.ensureCombat().selectedPrioEnemyId;
    }

    selectedPrioEnemy(): EnemyEntity | null {
        const id = this.selectedPrioEnemyId();
        if (id < 0 || !this.enemies) {
            return null;
        }
        return this.enemies.enemies.find((e) => e.id === id && e.alive) ?? null;
    }

    availableEnemyGroups(): boolean[] {
        if (this.waves) {
            return this.waves.availableEnemyGroups();
        }
        return [false, false, false, false, false, false, false];
    }

    /** 选中单位的底栏图标：竖/倒拇指加上本关还会出现、且打得很疼或很不疼的敌人。 */
    bottomBarIconsFor(unit: UnitEntity | null): number[] {
        if (!unit || unit.isEnemy) {
            return [];
        }
        const stats = this.weaponFor(unit.type, unit.upgradeLevel ?? 1);
        if (!stats) {
            return [];
        }
        return bottomBarIcons(stats.damageType, this.availableEnemyGroups());
    }

    damageTypeOf(unit: UnitEntity): number {
        return this.weaponFor(unit.type, unit.upgradeLevel ?? 1)?.damageType ?? 0;
    }

    private configureSpecialUnit(unit: UnitEntity): void {
        if (unit.type === DYNAMITE_TRIGGER_TYPE || unit.type === DYNAMITE_BOX_TYPE || unit.type === GAMBLER_TYPE) {
            unit.canShootWeapon = false;
        }
        if (unit.type === DYNAMITE_BOX_TYPE) {
            unit.dynamiteActive = true;
            if (!unit.maxWeaponCooldown) {
                unit.maxWeaponCooldown = DYNAMITE_COOLDOWN_MS;
            }
        }
        if (unit.type === DYNAMITE_TRIGGER_TYPE && !unit.maxWeaponCooldown) {
            unit.maxWeaponCooldown = DYNAMITE_COOLDOWN_MS;
        }
        if (unit.type === GAMBLER_TYPE) {
            unit.games = unit.games ?? 0;
            unit.wonCash = unit.wonCash ?? 0;
            if (canUseGamblerTime(this.gamblerTime)) {
                unit.maxWeaponCooldown = this.gamblerTime!;
                unit.currentWeaponCooldown = 0;
            }
        }
    }

    /** 把引爆器绑到最近的未绑箱子，把赌徒绑到最近的未绑赌场。数量对不上时仍尽量成对，不抛异常。 */
    bindSpecials(): void {
        const boxes = this.units.filter((u) => u.alive && u.type === DYNAMITE_BOX_TYPE && u.dynamiteBoxId == null);
        const triggers = this.units.filter((u) => u.alive && u.type === DYNAMITE_TRIGGER_TYPE);
        for (const trigger of triggers) {
            if (trigger.dynamiteBoxId != null) {
                continue;
            }
            const idx = selectNearestIndex(trigger, boxes);
            if (idx < 0) {
                continue;
            }
            const box = boxes.splice(idx, 1)[0];
            trigger.dynamiteBoxId = box.id;
            box.dynamiteBoxId = trigger.id;
        }
        const casinos = this.mats
            .map((mat, index) => ({ mat, index }))
            .filter((x) => x.mat.isCasino || x.mat.spawnType === CASINO_SPAWN_TYPE);
        const gamblers = this.units.filter((u) => u.alive && u.type === GAMBLER_TYPE);
        const unbound = casinos.filter((c) => !this.units.some((u) => u.casinoMatIndex === c.index));
        for (const gambler of gamblers) {
            if (gambler.casinoMatIndex != null) {
                continue;
            }
            const list = unbound.map((c) => ({
                fineX: tileCenterX(c.mat.col),
                fineY: c.mat.row * FINE_PER_TILE + HALF_TILE,
                index: c.index,
            }));
            const idx = selectNearestIndex(gambler, list);
            if (idx < 0) {
                continue;
            }
            const picked = unbound.splice(idx, 1)[0];
            gambler.casinoMatIndex = picked.index;
        }
    }

    addCasinoMat(col: number, row: number): SpawnMat {
        const mat: SpawnMat = {
            col,
            row,
            spawnType: CASINO_SPAWN_TYPE,
            spawningMode: false,
            isCasino: true,
        };
        this.mats.push(mat);
        this.addStaticBox({ col, row, spawnType: CASINO_SPAWN_TYPE });
        this.bindSpecials();
        return mat;
    }

    private tickDynamite(dtMs: number): void {
        for (const unit of this.units) {
            if (!unit.alive || unit.type !== DYNAMITE_TRIGGER_TYPE) {
                continue;
            }
            const box = unit.dynamiteBoxId != null ? this.unitById(unit.dynamiteBoxId) : null;
            if (box && box.dynamiteActive === false && unit.currentWeaponCooldown <= DYNAMITE_RESPAWN_ANIM_MS) {
                box.dynamiteActive = true;
                box.dynamiteRespawnAnim = 0;
            }
            if (box && box.dynamiteRespawnAnim != null && box.dynamiteRespawnAnim >= 0) {
                box.dynamiteRespawnAnim = (box.dynamiteRespawnAnim ?? 0) + dtMs;
                if (box.dynamiteRespawnAnim >= DYNAMITE_RESPAWN_ANIM_MS) {
                    box.dynamiteRespawnAnim = -1;
                }
            }
        }
    }

    detonateCooldownLabel(unit: UnitEntity): string {
        return formatCooldownLabel(unit.currentWeaponCooldown);
    }

    tryDetonate(trigger: UnitEntity): boolean {
        if (trigger.type !== DYNAMITE_TRIGGER_TYPE) {
            return false;
        }
        const box = trigger.dynamiteBoxId != null ? this.unitById(trigger.dynamiteBoxId) : null;
        if (!canDetonate(!!box, trigger.currentWeaponCooldown)) {
            this.dialog = 'dynamite-not-ready';
            this.pendingUnitId = trigger.id;
            return false;
        }
        this.dialog = 'none';
        trigger.currentWeaponCooldown = trigger.maxWeaponCooldown || DYNAMITE_COOLDOWN_MS;
        const stats = this.weaponFor(DYNAMITE_BOX_TYPE, trigger.upgradeLevel ?? 1)
            ?? this.weaponFor(DYNAMITE_TRIGGER_TYPE, trigger.upgradeLevel ?? 1);
        const damage = stats?.damage ?? DYNAMITE_DAMAGE;
        const damageType = stats?.damageType ?? DYNAMITE_DAMAGE_TYPE;
        const range = stats?.range ?? DYNAMITE_RANGE_FINE;
        if (box) {
            box.dynamiteActive = false;
            box.dynamiteRespawnAnim = -1;
            this.applyDynamiteBlast(box, damage, damageType, range);
        }
        return true;
    }

    applyDynamiteBlast(origin: UnitEntity, damage: number, damageType: number, rangeFine: number): { hitId: number | null; rings: number } {
        const combat = this.ensureCombat();
        const rings = combat.spawnBlastRings(origin.fineX, origin.fineY, rangeFine);
        const enemies = this.enemies?.enemies ?? [];
        const target = findDynamiteTarget(origin, enemies, rangeFine);
        if (target) {
            const pierce = target.pierce[damageType] ?? 0;
            target.hp -= explosionDamage(damage, pierce);
        }
        return { hitId: target ? target.id : null, rings };
    }

    gamblingEnabled(): boolean {
        return canUseGamblerTime(this.gamblerTime);
    }

    stakeOf(gambler: UnitEntity): number {
        return gamblerStake(gambler.games ?? 0);
    }

    isUnitUnlocked(type: number): boolean {
        return isUnitUnlocked(type, this.level, this.finishedLevels, this.hasAllUnitsUnlock);
    }

    private casinoMatOf(gambler: UnitEntity) {
        if (gambler.casinoMatIndex == null) {
            return null;
        }
        return this.mats[gambler.casinoMatIndex] ?? null;
    }

    /** 点赌徒：关卡没有赌徒时间则什么都不做。没赌场或冷却没好弹 14，钱不够弹 17，否则弹确认 15。都不扣钱。 */
    requestGamble(gambler: UnitEntity): ShopDialog {
        this.pendingUnitId = gambler.id;
        this.selectedId = gambler.id;
        this.pendingStake = 0;
        if (gambler.type !== GAMBLER_TYPE || !this.gamblingEnabled()) {
            this.dialog = 'none';
            this.pendingUnitId = -1;
            return 'none';
        }
        const stake = this.stakeOf(gambler);
        const casino = this.casinoMatOf(gambler);
        if (!casino || gambler.currentWeaponCooldown > 0) {
            this.dialog = 'gamble-not-ready';
            return 'gamble-not-ready';
        }
        if (this.cash < stake) {
            this.dialog = 'gamble-no-money';
            return 'gamble-no-money';
        }
        this.pendingStake = stake;
        this.dialog = 'gamble-confirm';
        return 'gamble-confirm';
    }

    confirmGamble(): boolean {
        if (this.dialog !== 'gamble-confirm') {
            return false;
        }
        const unit = this.unitById(this.pendingUnitId);
        if (!unit || unit.type !== GAMBLER_TYPE || !this.gamblingEnabled()) {
            this.dialog = 'none';
            this.pendingUnitId = -1;
            this.pendingStake = 0;
            return false;
        }
        const stake = this.pendingStake || this.stakeOf(unit);
        const casino = this.casinoMatOf(unit);
        const first = this.rng.isFirstRandom?.() ?? false;
        const outcome = playCards({
            cash: this.cash,
            stake,
            rng: this.rng,
            unlocked: defaultUnlockedForLevel(this.level, this.finishedLevels, this.hasAllUnitsUnlock),
            isFirstRandom: first,
            hands: this.gamblerHands,
            hasCasino: !!casino && unit.currentWeaponCooldown <= 0,
        });
        if (!outcome.ok) {
            this.dialog = outcome.reason === 'no-money' ? 'gamble-no-money' : 'gamble-not-ready';
            this.pendingStake = 0;
            return false;
        }
        this.cash = outcome.cash;
        unit.currentWeaponCooldown = unit.maxWeaponCooldown || this.gamblerTime || 0;
        unit.games = (unit.games ?? 0) + 1;
        unit.wonCash = outcome.wonCash;
        unit.gamblerResult = outcome.resultIndex;
        this.lastGambleResult = outcome.resultIndex;
        this.lastGambleCards = outcome.cards;
        this.cardReveal = outcome.reveal;
        if (outcome.spawnedUnitType != null && casino) {
            instantSpawnOnMat(casino, outcome.spawnedUnitType);
        }
        this.dialog = 'gamble-cards';
        playGameSfx('cards_collect');
        this.pendingStake = 0;
        return true;
    }

    /** 松手且没拖动时处理炸药引爆、赌徒开局、或雇佣确认。 */
    maybeHandleTap(unit: UnitEntity | null): ShopDialog {
        if (this.touchMoved || !unit) {
            return 'none';
        }
        if (unit.type === DYNAMITE_TRIGGER_TYPE) {
            this.tryDetonate(unit);
            return this.dialog === 'dynamite-not-ready' ? 'dynamite-not-ready' : 'none';
        }
        if (unit.type === GAMBLER_TYPE) {
            return this.requestGamble(unit);
        }
        if (isHireableActivity(unit.activity)) {
            return this.requestHire(unit);
        }
        return 'none';
    }

    /** 进关后、第 1 波开始前弹出选难度。不改默认自检的立即开波行为。 */
    /** 记下开局场上的人，失败重开时按这个布局还原，不沿用中途雇下或拖走的位置。 */
    captureStartLayout(): void {
        if (this.startLayoutCaptured) {
            return;
        }
        this.startLayout = this.units.filter((u) => u.alive && !u.isEnemy).map((u) => ({
            type: u.type,
            activity: u.activity,
            col: u.fullX,
            row: u.fullY,
            fromMapByte: !!u.fromMapByte,
        }));
        this.startLayoutCaptured = true;
    }

    enableDifficultyPick(): void {
        this.captureStartLayout();
        this.difficultyPickEnabled = true;
        this.waitForDifficulty = true;
        this.waitingToStart = true;
        this.waveStarted = false;
        this.outcome = 'difficulty';
        this.purchaseOffered = false;
    }

    canOfferDifficultyPick(): boolean {
        return canPickDifficulty(this.waves?.waveIndex ?? 0, this.waveStarted) && !this.failed && !this.levelCleared;
    }

    pickDifficulty(tier: number): PickDifficultyResult {
        const result = tryPickDifficulty(tier, {
            hardUnlocked: this.progress.hardUnlocked,
            waveIndex: this.waves?.waveIndex ?? 0,
            waveStarted: this.waveStarted,
        });
        this.purchaseOffered = false;
        if (!result.ok) {
            if (result.reason === 'locked') {
                this.outcome = 'hard-locked';
            }
            return result;
        }
        this.difficultyTier = result.tier!;
        if (this.enemies) {
            this.enemies.mode = this.difficultyTier;
        }
        if (this.waves) {
            this.waves.difficultyTier = this.difficultyTier;
        }
        this.waitingToStart = false;
        this.waitForDifficulty = false;
        this.waveStarted = true;
        this.outcome = 'none';
        this.persistMidSave();
        return result;
    }

    enterFail(): void {
        if (this.failed || this.levelCleared) {
            return;
        }
        if (this.enemies) {
            this.enemies.lives = 0;
        }
        this.storedLives = 0;
        this.failed = true;
        this.outcome = 'fail';
        playGameSfx('fail');
        this.beginSettlement();
    }

    enterClear(): void {
        this.levelCleared = true;
        this.failed = false;
        this.endMessage = campaignEndMessage(this.level);
        this.outcome = 'end-message';
        playClearMusic();
        this.pendingUnlocks = unlockTipsForLevel(this.level);
        this.clearRegionMidSave();
        this.persistCampaign();
        this.beginSettlement();
    }

    /** apk dialog 19 的「好的」→ showDialog(8)。 */
    acknowledgeEndMessage(): void {
        this.endMessage = null;
        this.outcome = 'clear';
    }

    private beginSettlement(): void {
        this.tally = createClearTally(this.killCounts);
        this.highScoreValue = computeHighScore(this.killAccrued, this.cash, this.difficultyTier ?? MODE_NORMAL);
        this.promptName = this.scores.beats(this.level, this.highScoreValue);
    }

    tickTally(dtMs: number): ClearTallyState | null {
        if (!this.tally || this.tally.countingDone) {
            return this.tally;
        }
        this.tally = tickClearTally(this.tally, dtMs);
        return this.tally;
    }

    /** apk UserProfile 的 lastName，用来预填高分命名框。 */
    get highscoreDefaultName(): string {
        return this.scores.getDefaultName();
    }

    submitHighScoreName(name: string): boolean {
        if (!this.promptName) {
            return false;
        }
        const trimmed = name.trim();
        // 原版 OK：这一关的名字无条件写入（空串也写），全局 lastName 只在非空时才更新，没有 '玩家' 兜底。
        this.scores.setDefaultName(trimmed);
        this.scores.record(this.level, this.highScoreValue, trimmed);
        this.promptName = false;
        this.persistCampaign();
        return true;
    }

    takeNextId(): number {
        const id = this.nextId;
        this.nextId += 1;
        return id;
    }

    captureMidSave(): MidLevelSave {
        return captureBattle(this);
    }

    applyMidSave(save: MidLevelSave): void {
        applyBattle(this, save);
    }

    persistMidSave(): void {
        if (!this.saver) {
            return;
        }
        this.saver.writeMidSave(regionOfLevel(this.level), this.captureMidSave(), this.progress);
    }

    clearRegionMidSave(): void {
        if (!this.saver) {
            return;
        }
        this.saver.clearMidSave(regionOfLevel(this.level), this.progress);
    }

    persistCampaign(): void {
        if (!this.saver) {
            return;
        }
        this.saver.syncFrom(this.progress, this.scores);
    }

    continueFromSave(): boolean {
        const save = this.saver?.getMidSave(regionOfLevel(this.level));
        if (!save) {
            return false;
        }
        this.applyMidSave(save);
        return true;
    }

    /** 重打这一关：钱、波次、命回到开头，清掉中途状态。难度要重新选。 */
    restartLevel(): void {
        this.cash = this.startingCash;
        this.killAccrued = 0;
        this.killCounts = new Array(TALLY_GROUP_COUNT).fill(0);
        this.failed = false;
        this.levelCleared = false;
        this.dialog = 'none';
        this.tally = null;
        this.pendingUnlocks = [];
        this.promptName = false;
        this.highScoreValue = 0;
        this.purchaseOffered = false;
        this.difficultyTier = null;
        this.waveStarted = false;
        const reoffer = this.difficultyPickEnabled;
        this.outcome = 'none';
        if (this.enemies) {
            this.enemies.enemies.length = 0;
            this.enemies.lives = this.startingLives;
            this.enemies.maxLives = this.startingLives;
            this.enemies.difficulty = DIFFICULTY_START;
            this.enemies.mode = MODE_NORMAL;
            this.enemies.leakedTypes = [];
            this.enemies.starShakeMs = 0;
        }
        this.storedLives = this.startingLives;
        this.waves?.reset();
        if (this.waves) {
            this.waves.difficultyTier = null;
        }
        this.rebuildCombat();
        this.selectedId = -1;
        this.dragging = false;
        this.pendingUnitId = -1;
        this.pendingStake = 0;
        this.cardReveal = null;
        this.bubbles.length = 0;
        this.chests.length = 0;
        this.collectedChestIds = [];
        this.steamStates.length = 0;
        this.nowMs = 0;
        this.remainingChests = this.chestCap;
        this.chestSpawnTimer = this.chestTime;
        this.spawnPool.reset();
        this.spawnPool.performActionsForWave(1);
        this.restoreStartUnits();
        if (reoffer || this.waitForDifficulty) {
            this.waitForDifficulty = true;
            this.waitingToStart = true;
            this.outcome = 'difficulty';
        } else {
            this.waitingToStart = false;
            this.waitForDifficulty = false;
        }
    }

    private restoreStartUnits(): void {
        this.units.length = 0;
        this.nextId = 1;
        if (!this.startLayoutCaptured) {
            this.bindSpecials();
            this.groupMapVehicles();
            this.rebuildCombat();
            return;
        }
        const layout = this.startLayout.slice();
        for (const row of layout) {
            if (row.fromMapByte) {
                this.addMapUnit(row.col, row.row, row.type, row.activity);
            } else {
                this.addUnit({ type: row.type, activity: row.activity, col: row.col, row: row.row, fromMapByte: false });
            }
        }
        this.bindSpecials();
        this.groupMapVehicles();
        this.rebuildCombat();
    }
}
