import {
    ACTIVITY_FOR_SALE,
    ACTIVITY_GOING_TO_SLEEP,
    ACTIVITY_GOING_TO_WORK,
    ACTIVITY_IDLE_WANDER,
    ACTIVITY_RETURNING,
    ACTIVITY_WORKING,
    DIR_EAST,
    FINE_PER_TILE,
    HALF_TILE,
    Rng,
    defaultRng,
    dirToDelta,
    isOppositeDir,
    nextColRow,
    passesUnitFieldCenter,
} from './Fine';
import {
    COLLIDE_BACKGROUND,
    COLLIDE_BOTH,
    COLLIDE_NONE,
    COLLIDE_X,
    COLLIDE_Y,
    CollisionBox,
    boxCheckX,
    boxCheckY,
    boxesOverlap,
    moveBox,
} from './Collision';
import { UnitEntity, hireUnit, isOnWater, isVehicleKind, setDirection, setUnitActivity, syncFullAndBox } from './UnitEntity';
import {
    TerrainMapsLike,
    clampToMapBounds,
    cornersReachable,
    inMapBounds,
    isFreeToWalk,
    isStreet,
} from './WalkGrid';

export interface Occupancy {
    fieldIsBlocked(col: number, row: number, ignoreId?: number): boolean;
    unitOnCell(col: number, row: number, ignoreId?: number): boolean;
}

export interface MoveWorld {
    maps: TerrainMapsLike;
    occupancy: Occupancy;
    boxes: CollisionBox[];
    chests: UnitEntity[];
    collectChest(chest: UnitEntity, walker: UnitEntity): void;
}

function bonusMul(unit: UnitEntity): number {
    return unit.bonusAttribute === 3 ? 150 : 100;
}

/** 步长 = 方向 * 速度 * 奖励倍率 * dt / 10000。dt=16、速度 1500 时大约 240 fine，半秒走一格。 */
export function computeStep(dir: number, speed: number, bonusAttribute: number, dtMs: number): number {
    const mul = bonusAttribute === 3 ? 150 : 100;
    return Math.trunc((dir * speed * mul * dtMs) / 10000);
}

export function makeMoveCheck(unit: UnitEntity, dtMs: number): { dx: number; dy: number } {
    // 待售的加特林/双炮仍是火车或船的一节，被拖时要跟着走。
    if (!unit.canWalk || (unit.activity === ACTIVITY_FOR_SALE && !isVehicleKind(unit.kind))) {
        return { dx: 0, dy: 0 };
    }
    if (unit.kind === 'trainH' || unit.kind === 'steamer') {
        return { dx: computeStep(unit.xDir, unit.speed, unit.bonusAttribute, dtMs), dy: 0 };
    }
    if (unit.kind === 'trainV') {
        return { dx: 0, dy: computeStep(unit.yDir, unit.speed, unit.bonusAttribute, dtMs) };
    }
    return {
        dx: computeStep(unit.xDir, unit.speed, unit.bonusAttribute, dtMs),
        dy: computeStep(unit.yDir, unit.speed, unit.bonusAttribute, dtMs),
    };
}

function terrainBlocked(unit: UnitEntity, world: MoveWorld, startX: number, startY: number, endX: number, endY: number, axis: 'x' | 'y'): boolean {
    return !cornersReachable(world.maps, startX, startY, endX, endY, isOnWater(unit), axis);
}

/**
 * 先看别的盒子，再看地形。能捡的箱子先收走再重试这一步。
 * 返回这一帧实际走出的位移。
 */
export function applyMove(unit: UnitEntity, world: MoveWorld, dx: number, dy: number): { dx: number; dy: number; edge: number } {
    if (dx === 0 && dy === 0) {
        return { dx: 0, dy: 0, edge: COLLIDE_NONE };
    }

    for (let retry = 0; retry < 8; retry += 1) {
        const blockedX = dx !== 0 && hitsAxis(unit, world, dx, dy, 'x');
        const blockedY = dy !== 0 && hitsAxis(unit, world, dx, dy, 'y');

        const collected = collectAlong(unit, world, dx, dy);
        if (collected) {
            continue;
        }

        let useX = dx;
        let useY = dy;
        let edge = COLLIDE_NONE;
        if (blockedX && blockedY) {
            useX = 0;
            useY = 0;
            edge = COLLIDE_BOTH;
        } else if (blockedX) {
            useX = 0;
            edge = COLLIDE_X;
        } else if (blockedY) {
            useY = 0;
            edge = COLLIDE_Y;
        }

        const nextX = unit.fineX + useX;
        const nextY = unit.fineY + useY;
        const clamped = clampToMapBounds(nextX, nextY, world.maps.cols, world.maps.rows);
        const outX = clamped.fineX - unit.fineX;
        const outY = clamped.fineY - unit.fineY;
        if (outX !== useX || outY !== useY) {
            if (outX === 0 && useX !== 0) {
                edge = edge === COLLIDE_Y ? COLLIDE_BOTH : COLLIDE_X;
            }
            if (outY === 0 && useY !== 0) {
                edge = edge === COLLIDE_X ? COLLIDE_BOTH : COLLIDE_Y;
            }
        }
        unit.prevFineX = unit.fineX;
        unit.prevFineY = unit.fineY;
        unit.fineX = clamped.fineX;
        unit.fineY = clamped.fineY;
        moveBox(unit.box, unit.fineX - unit.prevFineX, unit.fineY - unit.prevFineY);
        syncFullAndBox(unit);
        return { dx: unit.fineX - unit.prevFineX, dy: unit.fineY - unit.prevFineY, edge };
    }
    unit.prevFineX = unit.fineX;
    unit.prevFineY = unit.fineY;
    return { dx: 0, dy: 0, edge: COLLIDE_BOTH };
}

function hitsAxis(unit: UnitEntity, world: MoveWorld, dx: number, dy: number, axis: 'x' | 'y'): boolean {
    const trial: CollisionBox = {
        startX: unit.box.startX + (axis === 'x' ? dx : 0),
        startY: unit.box.startY + (axis === 'y' ? dy : 0),
        endX: unit.box.endX + (axis === 'x' ? dx : 0),
        endY: unit.box.endY + (axis === 'y' ? dy : 0),
        collectable: false,
        kind: unit.box.kind,
        ownerId: unit.id,
    };
    if (axis === 'x' ? terrainBlocked(unit, world, trial.startX, unit.box.startY, trial.endX, unit.box.endY, 'x')
        : terrainBlocked(unit, world, unit.box.startX, trial.startY, unit.box.endX, trial.endY, 'y')) {
        return true;
    }
    for (const other of world.boxes) {
        if (other.ownerId === unit.id || other.collectable) {
            continue;
        }
        if (isVehicleKind(unit.kind) && other.kind === 'vehicle' && other.groupId != null && other.groupId === unit.groupId) {
            continue;
        }
        if (axis === 'x' ? boxCheckX(unit.box, other, dx) : boxCheckY(unit.box, other, dy)) {
            return true;
        }
    }
    return false;
}

function collectAlong(unit: UnitEntity, world: MoveWorld, dx: number, dy: number): boolean {
    let got = false;
    for (const chest of world.chests) {
        if (!chest.alive || chest.chestSpawn || chest.chestDespawn) {
            continue;
        }
        const moved: CollisionBox = {
            startX: unit.box.startX + dx,
            startY: unit.box.startY + dy,
            endX: unit.box.endX + dx,
            endY: unit.box.endY + dy,
            collectable: false,
            kind: unit.box.kind,
            ownerId: unit.id,
        };
        if (boxesOverlap(moved, chest.box) || boxesOverlap(unit.box, chest.box)) {
            const wasAlive = chest.alive;
            world.collectChest(chest, unit);
            if (wasAlive && !chest.alive) {
                // apk GameObjectUnit.makeMoveCheck L576-579：拾取后立刻
                // cmUnits.removeCollisionObject(c)，随后同一帧重测碰撞。
                // 项目 world.boxes 是本拍开头的一次性快照；只把 collectable 置 false
                // 会让这个箱子在同一拍变成实体障碍，applyMove 的 continue 重试被挡成零位移。
                const idx = world.boxes.indexOf(chest.box);
                if (idx >= 0) {
                    world.boxes.splice(idx, 1);
                }
                got = true;
            }
        }
    }
    return got;
}

function cellInMaps(maps: TerrainMapsLike, col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < maps.cols && row < maps.rows;
}

/**
 * apk UnitDirector L252-336：沿街继续走。四方向只排除"回头"和不是街的格子，不查占用。
 * 原版每个格中心都会走这一段，所以雇佣单位不会闷头撞进空地然后原地卡死。
 * 下标和原版 possibilitys2 一致：0=东 1=西 2=南 3=北。
 */
function pickStreetDirection(unit: UnitEntity, world: MoveWorld, rng: Rng): boolean {
    const possible = [true, true, true, true];
    if (unit.xDir > 0) {
        possible[1] = false;
    }
    if (unit.xDir < 0) {
        possible[0] = false;
    }
    if (unit.yDir > 0) {
        possible[3] = false;
    }
    if (unit.yDir < 0) {
        possible[2] = false;
    }
    for (let dir = 0; dir < 4; dir += 1) {
        if (!possible[dir]) {
            continue;
        }
        const next = nextColRow(unit.fullX, unit.fullY, dir);
        if (!cellInMaps(world.maps, next.col, next.row) || !isStreet(world.maps, next.col, next.row)) {
            possible[dir] = false;
        }
    }
    let trysLeft = 4;
    let dir = rng.int(4);
    while (trysLeft > 0 && !possible[dir]) {
        dir = (dir + 1) % 4;
        trysLeft -= 1;
    }
    if (!possible[dir]) {
        return false;
    }
    const oldX = unit.fineX;
    const oldY = unit.fineY;
    if (dir === 0 || dir === 1) {
        unit.fineY = (unit.fullY * FINE_PER_TILE) + HALF_TILE + 1920;
    } else {
        unit.fineX = (unit.fullX * FINE_PER_TILE) + HALF_TILE;
    }
    const delta = dirToDelta(dir);
    setDirection(unit, delta.x, delta.y);
    moveBox(unit.box, unit.fineX - oldX, unit.fineY - oldY);
    syncFullAndBox(unit);
    return true;
}

/**
 * 闲逛到格子中心时重选方向。
 * 先 1/8 概率（正在回家或状态 6 则每次都选）找一块不回头、不出图、不占用、能走进去的空地；
 * 没找到（或这 7/8 根本没抽中）就沿街继续走；四条街路全不可走才掉头并记正在回家。
 */
export function pickIdleDirection(unit: UnitEntity, world: MoveWorld, rng: Rng): boolean {
    const shouldPick = unit.inactiveUnitReturnsToBase !== 0
        || unit.activity === ACTIVITY_RETURNING
        || rng.int(8) === 0;
    if (shouldPick && tryPick(unit, world, rng.int(4))) {
        return true;
    }
    if (pickStreetDirection(unit, world, rng)) {
        return true;
    }
    // apk L331-335：直接取反当前速度分量，不重算朝向。
    unit.xDir = -unit.xDir;
    unit.yDir = -unit.yDir;
    unit.inactiveUnitReturnsToBase = 1;
    return false;
}

function tryPick(unit: UnitEntity, world: MoveWorld, startDir: number): boolean {
    for (let i = 0; i < 4; i += 1) {
        const dir = (startDir + i) % 4;
        if (isOppositeDir(dir, unit.walkDir)) {
            continue;
        }
        const next = nextColRow(unit.fullX, unit.fullY, dir);
        if (!cellInMaps(world.maps, next.col, next.row)) {
            continue;
        }
        if (isStreet(world.maps, next.col, next.row)) {
            continue;
        }
        if (!isFreeToWalk(world.maps, next.col, next.row)) {
            continue;
        }
        if (world.occupancy.fieldIsBlocked(next.col, next.row, unit.id)) {
            continue;
        }
        if (world.occupancy.unitOnCell(next.col, next.row, unit.id)) {
            continue;
        }
        const nx = next.col * FINE_PER_TILE + HALF_TILE;
        const ny = next.row * FINE_PER_TILE + HALF_TILE + 1920;
        const oldX = unit.fineX;
        const oldY = unit.fineY;
        if (dir === 0 || dir === 1) {
            unit.fineY = unit.fullY * FINE_PER_TILE + HALF_TILE + 1920;
            moveBox(unit.box, 0, unit.fineY - oldY);
        } else {
            unit.fineX = unit.fullX * FINE_PER_TILE + HALF_TILE;
            moveBox(unit.box, unit.fineX - oldX, 0);
        }
        const delta = dirToDelta(dir);
        setDirection(unit, delta.x, delta.y);
        if (unit.activity === ACTIVITY_IDLE_WANDER) {
            setUnitActivity(unit, ACTIVITY_GOING_TO_SLEEP);
        } else if (unit.activity === ACTIVITY_RETURNING) {
            setUnitActivity(unit, ACTIVITY_GOING_TO_WORK);
        }
        syncFullAndBox(unit);
        void ny;
        void nx;
        return true;
    }
    return false;
}

export function tickIdleOrTransit(unit: UnitEntity, world: MoveWorld, dtMs: number, rng: Rng): void {
    if (isVehicleKind(unit.kind)) {
        if (unit.xDir !== 0 || unit.yDir !== 0) {
            const step = makeMoveCheck(unit, dtMs);
            applyMove(unit, world, step.dx, step.dy);
            return;
        }
        unit.prevFineX = unit.fineX;
        unit.prevFineY = unit.fineY;
        return;
    }
    if (unit.activity === ACTIVITY_FOR_SALE) {
        unit.prevFineX = unit.fineX;
        unit.prevFineY = unit.fineY;
        return;
    }
    if (unit.activity === ACTIVITY_IDLE_WANDER || unit.activity === ACTIVITY_RETURNING) {
        const step = makeMoveCheck(unit, dtMs);
        applyMove(unit, world, step.dx, step.dy);
        if (passesUnitFieldCenter(unit.prevFineX, unit.prevFineY, unit.fineX, unit.fineY)) {
            pickIdleDirection(unit, world, rng);
        }
        return;
    }
    if (unit.activity === ACTIVITY_GOING_TO_SLEEP) {
        const step = makeMoveCheck(unit, dtMs);
        applyMove(unit, world, step.dx, step.dy);
        if (passesUnitFieldCenter(unit.prevFineX, unit.prevFineY, unit.fineX, unit.fineY)) {
            setUnitActivity(unit, ACTIVITY_FOR_SALE);
            setDirection(unit, 0, 0);
        }
        return;
    }
    if (unit.activity === ACTIVITY_GOING_TO_WORK) {
        const step = makeMoveCheck(unit, dtMs);
        applyMove(unit, world, step.dx, step.dy);
        if (passesUnitFieldCenter(unit.prevFineX, unit.prevFineY, unit.fineX, unit.fineY)) {
            setUnitActivity(unit, ACTIVITY_WORKING);
            setDirection(unit, 0, 0);
        }
    }
}

/** 返回这一节是否被挡住：apk UnitDirector L43-50 用这个判定让整编组一起停。 */
export function tickWorkingMove(unit: UnitEntity, world: MoveWorld, dtMs: number): boolean {
    if (unit.activity !== ACTIVITY_WORKING || !unit.canWalk) {
        return false;
    }
    const step = makeMoveCheck(unit, dtMs);
    return applyMove(unit, world, step.dx, step.dy).edge !== COLLIDE_NONE;
}

/**
 * apk GameObjectUnit.makeMoveCheck() 的探测版：只算这一帧按当前方向会不会撞，
 * 不真的移动。UnitDirector.moveUnits() 先对全场做一遍这个探测，任一复合单位
 * 被挡就整组 setDirection(0,0)，然后第二轮 handleUnit() 才真的移动。
 * 必须在任何单位移动之前探测，否则前车停下后后车这一帧仍会挤上来。
 */
export function probeVehicleBlocked(unit: UnitEntity, world: MoveWorld, dtMs: number): boolean {
    // apk makeMoveCheck() 按当前方向做纯几何探测，不看 activity；只要这一节有方向就要探。
    // 拖车时同组每节都被 followVehicleGroup 设了方向，队尾(activity 4)那节先撞墙时也要能停整组。
    if (!unit.canWalk) {
        return false;
    }
    const step = makeMoveCheck(unit, dtMs);
    if (step.dx === 0 && step.dy === 0) {
        return false;
    }
    const blockedX = step.dx !== 0 && hitsAxis(unit, world, step.dx, step.dy, 'x');
    const blockedY = step.dy !== 0 && hitsAxis(unit, world, step.dx, step.dy, 'y');
    const nextX = unit.fineX + (blockedX ? 0 : step.dx);
    const nextY = unit.fineY + (blockedY ? 0 : step.dy);
    const clamped = clampToMapBounds(nextX, nextY, world.maps.cols, world.maps.rows);
    return blockedX || blockedY || clamped.fineX !== nextX || clamped.fineY !== nextY;
}

/**
 * 手指拖：每帧把方向设成指向手指的向量。某一轴和手指相差不到 10 像素（2400 fine）时，这一轴停住。
 * 箭头水平向右是 0 度。
 */
export const AXIS_STOP_FINE = 10 * (7680 / 32);

/** 火车和蒸汽船只留横向；竖向火车只留纵向。斜着拖时另一轴是 0。 */
export function vehicleDragDir(kind: UnitEntity['kind'], dx: number, dy: number): { x: number; y: number } {
    let x = dx;
    let y = dy;
    if (kind === 'trainH' || kind === 'steamer') {
        y = 0;
    }
    if (kind === 'trainV') {
        x = 0;
    }
    const len = Math.sqrt(x * x + y * y);
    if (len < 1) {
        return { x: 0, y: 0 };
    }
    return { x: x / len, y: y / len };
}

export function aimAtFinger(unit: UnitEntity, fingerFineX: number, fingerFineY: number): void {
    let dx = fingerFineX - unit.fineX;
    let dy = fingerFineY - unit.fineY;
    if (Math.abs(dx) < AXIS_STOP_FINE) {
        dx = 0;
    }
    if (Math.abs(dy) < AXIS_STOP_FINE) {
        dy = 0;
    }
    const dir = vehicleDragDir(unit.kind, dx, dy);
    setDirection(unit, dir.x, dir.y);
}

/** 同一编组的车厢或船体跟着龙头/船头的方向走。 */
export function followVehicleGroup(leader: UnitEntity, units: readonly UnitEntity[]): void {
    if (!isVehicleKind(leader.kind)) {
        return;
    }
    for (const unit of units) {
        if (unit === leader || !unit.alive || unit.groupId !== leader.groupId) {
            continue;
        }
        setDirection(unit, leader.xDir, leader.yDir);
    }
}

export function arrowAngleRad(fromX: number, fromY: number, toX: number, toY: number): number {
    return Math.atan2(toY - fromY, toX - fromX);
}

export function tapDoesNotWake(unit: UnitEntity): void {
    if (unit.activity === ACTIVITY_FOR_SALE) {
        return;
    }
}

export function tryHire(unit: UnitEntity): boolean {
    return hireUnit(unit);
}

export { defaultRng, inMapBounds };
