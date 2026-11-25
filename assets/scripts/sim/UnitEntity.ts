import {
    ACTIVITY_FOR_SALE,
    ACTIVITY_GOING_TO_SLEEP,
    ACTIVITY_GOING_TO_WORK,
    ACTIVITY_IDLE_WANDER,
    ACTIVITY_RETURNING,
    ACTIVITY_WORKING,
    FINE_PER_TILE,
    HALF_TILE,
    UNIT_FOOT_Y,
    mapUnitFineY,
    tileCenterX,
} from './Fine';
import { CollisionBox, personBox, enemyBox, chestBox, vehicleBox, trainVBox, relocateBox } from './Collision';

export type MoveKind = 'ground' | 'steamer' | 'trainH' | 'trainV';

export interface UnitEntity {
    id: number;
    type: number;
    isEnemy: boolean;
    kind: MoveKind;
    activity: number;
    fineX: number;
    fineY: number;
    /** 上一帧位置，用来判断有没有跨过格子中线。 */
    prevFineX: number;
    prevFineY: number;
    fullX: number;
    fullY: number;
    xDir: number;
    yDir: number;
    /** 闲逛离散方向：0 东 1 西 2 南 3 北。 */
    walkDir: number;
    speed: number;
    /** 奖励 3：步长再乘 150/100。 */
    bonusAttribute: number;
    inactiveUnitReturnsToBase: number;
    box: CollisionBox;
    alive: boolean;
    hired: boolean;
    /** 类型 7 炸药引爆器、类型 8 炸药箱、类型 9 赌徒不走路。 */
    canWalk: boolean;
    upgradeLevel: number;
    maxRange: number;
    maxSquareRange: number;
    maxWeaponCooldown: number;
    currentWeaponCooldown: number;
    specialCoolDownCounter: number;
    bonusCounter: number;
    /** 默认能射；炸药引爆器、炸药箱、赌徒为 false。 */
    canShootWeapon: boolean;
    /** 炸药箱是否还在。引爆后为 false，冷却尾声再生成。 */
    dynamiteActive?: boolean;
    /** 引爆器绑着的炸药箱 id。 */
    dynamiteBoxId?: number;
    dynamiteRespawnAnim?: number;
    /** 赌徒已经玩过的局数，用来算下注。 */
    games?: number;
    wonCash?: number;
    gamblerResult?: number;
    casinoMatIndex?: number;
    /** 同一列火车或同一艘船共用这个编号，被拖时一起走。默认等于自己的 id。 */
    groupId: number;
    /** 开枪后剩余动画时间；>0 时画 shoot 图，朝向 shootDirX/Y。 */
    shootMs?: number;
    shootDirX?: number;
    shootDirY?: number;
    /** 宝箱落下/消失动画。普通单位没有这些字段。 */
    chestSpawn?: boolean;
    chestDespawn?: boolean;
    chestRemove?: boolean;
    animationTimer?: number;
    animTime?: number;
    animDir?: number;
}

export function kindForType(type: number, isEnemy: boolean): MoveKind {
    if (isEnemy) {
        return 'ground';
    }
    if (type >= 30 && type <= 33) {
        return 'steamer';
    }
    if (type >= 10 && type <= 12) {
        return 'trainH';
    }
    if (type >= 20 && type <= 22) {
        return 'trainV';
    }
    return 'ground';
}

export function canTypeWalk(type: number, isEnemy: boolean): boolean {
    if (isEnemy) {
        return true;
    }
    if (type === 7 || type === 8 || type === 9) {
        return false;
    }
    return true;
}

function makeBoxFor(kind: MoveKind, isEnemy: boolean, isChest: boolean, fineX: number, fineY: number, id: number): CollisionBox {
    if (isChest) {
        return chestBox(fineX, fineY, id);
    }
    if (kind === 'steamer' || kind === 'trainH') {
        return vehicleBox(fineX, fineY, id);
    }
    if (kind === 'trainV') {
        return trainVBox(fineX, fineY, id);
    }
    if (isEnemy) {
        return enemyBox(fineX, fineY, id);
    }
    return personBox(fineX, fineY, id);
}

export function createUnit(opts: {
    id: number;
    type: number;
    isEnemy?: boolean;
    isChest?: boolean;
    kind?: MoveKind;
    activity: number;
    col?: number;
    row?: number;
    fineX?: number;
    fineY?: number;
    speed?: number;
    fromMapByte?: boolean;
    groupId?: number;
}): UnitEntity {
    const isEnemy = !!opts.isEnemy;
    const kind = opts.kind ?? kindForType(opts.type, isEnemy);
    let fineX = opts.fineX;
    let fineY = opts.fineY;
    if (fineX === undefined || fineY === undefined) {
        const col = opts.col ?? 0;
        const row = opts.row ?? 0;
        fineX = tileCenterX(col);
        fineY = opts.fromMapByte === false ? (row * FINE_PER_TILE + HALF_TILE + UNIT_FOOT_Y) : mapUnitFineY(row);
        if (opts.fromMapByte === false) {
            fineY = row * FINE_PER_TILE + HALF_TILE + UNIT_FOOT_Y;
        }
    }
    const box = makeBoxFor(kind, isEnemy, !!opts.isChest, fineX, fineY, opts.id);
    const unit: UnitEntity = {
        id: opts.id,
        type: opts.type,
        isEnemy,
        kind,
        activity: opts.activity,
        fineX,
        fineY,
        prevFineX: fineX,
        prevFineY: fineY,
        fullX: Math.floor(fineX / FINE_PER_TILE),
        fullY: Math.floor(fineY / FINE_PER_TILE),
        xDir: 0,
        yDir: 0,
        walkDir: 2,
        speed: opts.speed ?? 1500,
        bonusAttribute: -1,
        inactiveUnitReturnsToBase: 0,
        box,
        alive: true,
        hired: opts.activity === ACTIVITY_WORKING,
        canWalk: canTypeWalk(opts.type, isEnemy) && !opts.isChest,
        upgradeLevel: 1,
        maxRange: 0,
        maxSquareRange: 0,
        maxWeaponCooldown: 0,
        currentWeaponCooldown: 0,
        specialCoolDownCounter: 0,
        bonusCounter: 0,
        canShootWeapon: true,
        groupId: opts.groupId ?? opts.id,
    };
    if (opts.activity === ACTIVITY_IDLE_WANDER || opts.activity === ACTIVITY_RETURNING) {
        unit.xDir = 0;
        unit.yDir = 1;
        unit.walkDir = 2;
    }
    return unit;
}

export function syncFullAndBox(unit: UnitEntity): void {
    unit.fullX = Math.floor(unit.fineX / FINE_PER_TILE);
    unit.fullY = Math.floor(unit.fineY / FINE_PER_TILE);
    const w = unit.box.endX - unit.box.startX;
    const h = unit.box.endY - unit.box.startY;
    let left = -2534;
    let top = -5376;
    if (unit.box.kind === 'chest') {
        left = -2534;
        top = -4608;
    } else if (unit.box.kind === 'vehicle' || unit.kind !== 'ground') {
        left = -3840;
        top = -4608;
    } else if (unit.isEnemy) {
        left = -3839;
        top = -3839;
    }
    relocateBox(unit.box, unit.fineX + left, unit.fineY + top);
    unit.box.endX = unit.box.startX + w;
    unit.box.endY = unit.box.startY + h;
}

export function setDirection(unit: UnitEntity, xDir: number, yDir: number): void {
    unit.xDir = xDir;
    unit.yDir = yDir;
    // 一迈步就打断开枪动作，apk 里 isInShootingAnimation 在移动时清 0。
    if (xDir !== 0 || yDir !== 0) {
        unit.shootMs = 0;
    }
    if (xDir > 0) {
        unit.walkDir = 0;
    } else if (xDir < 0) {
        unit.walkDir = 1;
    } else if (yDir > 0) {
        unit.walkDir = 2;
    } else if (yDir < 0) {
        unit.walkDir = 3;
    }
}

export function setUnitActivity(unit: UnitEntity, activity: number): void {
    unit.activity = activity;
    if (activity === ACTIVITY_IDLE_WANDER || activity === ACTIVITY_RETURNING) {
        setDirection(unit, 0, 1);
    }
    if (activity === ACTIVITY_FOR_SALE || activity === ACTIVITY_GOING_TO_SLEEP) {
        unit.hired = false;
    }
    if (activity === ACTIVITY_WORKING || activity === ACTIVITY_GOING_TO_WORK) {
        if (activity === ACTIVITY_WORKING) {
            unit.hired = true;
        }
    }
}

export function hireUnit(unit: UnitEntity): boolean {
    if (unit.activity !== ACTIVITY_FOR_SALE
        && unit.activity !== ACTIVITY_IDLE_WANDER
        && unit.activity !== ACTIVITY_GOING_TO_SLEEP) {
        return false;
    }
    setUnitActivity(unit, ACTIVITY_WORKING);
    setDirection(unit, 0, 0);
    unit.hired = true;
    if (unit.maxWeaponCooldown > 0) {
        unit.currentWeaponCooldown = Math.trunc(unit.maxWeaponCooldown / 2);
    }
    return true;
}

export function isOnWater(unit: UnitEntity): boolean {
    return unit.kind === 'steamer';
}

export const SLEEPING_OR_FOR_SALE = [ACTIVITY_FOR_SALE, ACTIVITY_GOING_TO_SLEEP];

export function isVehicleKind(kind: MoveKind): boolean {
    return kind === 'steamer' || kind === 'trainH' || kind === 'trainV';
}

export function isHorizontalVehicle(unit: UnitEntity): boolean {
    return unit.kind === 'trainH' || unit.kind === 'steamer';
}

/** 把地图上挨着的车厢或船体编成同一组。横向只认同一行、竖向火车只认同一列。 */
export function assignAdjacentVehicleGroups(units: UnitEntity[]): void {
    const live = units.filter((u) => u.alive && isVehicleKind(u.kind));
    if (live.length === 0) {
        return;
    }
    const parent = new Map<number, number>();
    for (const u of live) {
        parent.set(u.id, u.id);
    }
    const find = (id: number): number => {
        let cur = parent.get(id) ?? id;
        if (cur !== id) {
            cur = find(cur);
            parent.set(id, cur);
        }
        return cur;
    };
    const union = (a: number, b: number): void => {
        const pa = find(a);
        const pb = find(b);
        if (pa !== pb) {
            parent.set(pa, pb);
        }
    };
    for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
            const a = live[i];
            const b = live[j];
            if (isHorizontalVehicle(a) && isHorizontalVehicle(b) && a.kind === b.kind && a.fullY === b.fullY && Math.abs(a.fullX - b.fullX) === 1) {
                union(a.id, b.id);
            }
            if (a.kind === 'trainV' && b.kind === 'trainV' && a.fullX === b.fullX && Math.abs(a.fullY - b.fullY) === 1) {
                union(a.id, b.id);
            }
        }
    }
    const members = new Map<number, UnitEntity[]>();
    for (const u of live) {
        const root = find(u.id);
        const list = members.get(root) ?? [];
        list.push(u);
        members.set(root, list);
    }
    for (const list of members.values()) {
        const gid = Math.min(...list.map((u) => u.id));
        for (const u of list) {
            u.groupId = gid;
        }
    }
}

