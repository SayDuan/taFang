/** 碰撞盒：人、敌人、箱子、火车、船，以及装饰和房子。被挡住的那一条轴停住。 */

export interface CollisionBox {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    collectable: boolean;
    /** 箱子被走过时由模拟收回。 */
    kind: 'unit' | 'chest' | 'decor' | 'building' | 'vehicle';
    ownerId: number;
    /** 火车/船编组：同一组的车厢互相不挡。 */
    groupId?: number;
}

export const COLLIDE_NONE = -1;
export const COLLIDE_BOTH = 0;
export const COLLIDE_X = 1;
export const COLLIDE_Y = 2;
export const COLLIDE_BACKGROUND = 3;

export function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
    return a0 < b1 && a1 > b0;
}

export function boxesOverlap(a: CollisionBox, b: CollisionBox): boolean {
    return rangesOverlap(a.startX, a.endX, b.startX, b.endX)
        && rangesOverlap(a.startY, a.endY, b.startY, b.endY);
}

/**
 * apk CollisionManager.boxCheckX 原样：c1 沿 X 挪 addX 时，左/右边正好跨进 c2 的 X 范围，
 * 且 Y 方向有接触才算撞上。注意原版第二个条件不带 addX。
 */
export function boxCheckX(c1: CollisionBox, c2: CollisionBox, addX: number): boolean {
    const yTouch = (c1.startY >= c2.startY && c1.startY <= c2.endY)
        || (c1.endY >= c2.startY && c1.endY <= c2.endY)
        || (c1.startY <= c2.startY && c1.endY >= c2.endY);
    if (c1.startX + addX <= c2.endX && c1.startX >= c2.endX) {
        return yTouch;
    }
    if (c1.endX + addX >= c2.startX && c1.endX <= c2.startX) {
        return yTouch;
    }
    return false;
}

/** apk CollisionManager.boxCheckY 原样，X/Y 对调。 */
export function boxCheckY(c1: CollisionBox, c2: CollisionBox, addY: number): boolean {
    const xTouch = (c1.startX >= c2.startX && c1.startX <= c2.endX)
        || (c1.endX >= c2.startX && c1.endX <= c2.endX)
        || (c1.startX <= c2.startX && c1.endX >= c2.endX);
    if (c1.startY + addY <= c2.endY && c1.startY >= c2.endY) {
        return xTouch;
    }
    if (c1.endY + addY >= c2.startY && c1.endY <= c2.startY) {
        return xTouch;
    }
    return false;
}

/**
 * apk CollisionManager.testBasicCollision（xdir = ydir = 0）：
 * 原版生成前占位检测。只用 0 位移的 boxCheckX/boxCheckY 判"盒边正好贴住"，
 * 普通矩形重叠（比如单位盒落在出生口建筑盒里面）不算撞。
 */
export function apkBasicCollision(a: CollisionBox, b: CollisionBox): boolean {
    return boxCheckX(a, b, 0) || boxCheckY(a, b, 0);
}

export function makeBox(startX: number, startY: number, w: number, h: number, kind: CollisionBox['kind'], ownerId: number, collectable = false): CollisionBox {
    return {
        startX,
        startY,
        endX: startX + w,
        endY: startY + h,
        collectable,
        kind,
        ownerId,
    };
}

/** 从细坐标中心套上偏移，得到碰撞盒。 */
export function boxFromCenter(fineX: number, fineY: number, left: number, top: number, w: number, h: number, kind: CollisionBox['kind'], ownerId: number, collectable = false): CollisionBox {
    return makeBox(fineX + left, fineY + top, w, h, kind, ownerId, collectable);
}

export function personBox(fineX: number, fineY: number, ownerId: number): CollisionBox {
    return boxFromCenter(fineX, fineY, -2534, -5376, 5068, 4608, 'unit', ownerId);
}

export function enemyBox(fineX: number, fineY: number, ownerId: number): CollisionBox {
    return boxFromCenter(fineX, fineY, -3839, -3839, 7678, 7678, 'unit', ownerId);
}

export function chestBox(fineX: number, fineY: number, ownerId: number): CollisionBox {
    return boxFromCenter(fineX, fineY, -2534, -4608, 5068, 4224, 'chest', ownerId, true);
}

export function vehicleBox(fineX: number, fineY: number, ownerId: number): CollisionBox {
    return boxFromCenter(fineX, fineY, -3840, -4608, 7680, 4608, 'vehicle', ownerId);
}

/** APK TrainVertical.createCollisionObject()：窄 (±2304) × 高 1 tile (±3840)，竖向火车车厢碰撞盒。 */
export function trainVBox(fineX: number, fineY: number, ownerId: number): CollisionBox {
    return boxFromCenter(fineX, fineY, -2534, -3840, 4608, 7680, 'vehicle', ownerId);
}

/** 装饰碰撞：照 CollisionManager.createCollisionObject 的 GameObjectDecoration 分支。 */
export function decorBox(fineX: number, fineY: number, decorType: number, ownerId: number): CollisionBox {
    if (decorType === 12) {
        return boxFromCenter(fineX, fineY, -7680, -5068, 15360, 3840, 'decor', ownerId);
    }
    if (decorType === 3) {
        return boxFromCenter(fineX, fineY, -2534, -5760, 5068, 3840, 'decor', ownerId);
    }
    if (decorType === 10) {
        return boxFromCenter(fineX, fineY, -3840, -13440, 7680, 11520, 'decor', ownerId);
    }
    if (decorType === 16 || decorType === 17 || decorType === 18 || decorType === 19) {
        return boxFromCenter(fineX, fineY, -3840, -7680, 7680, 7680, 'decor', ownerId);
    }
    return boxFromCenter(fineX, fineY, -1920, -5068, 3840, 2534, 'decor', ownerId);
}

export function buildingBox(fineX: number, fineY: number, spawnType: number, ownerId: number): CollisionBox {
    // CollisionManager.createCollisionObject 的 GameObjectSpawnLocation 分支。
    if (spawnType === 1 || spawnType === 4) {
        return boxFromCenter(fineX, fineY, -6336, -9600, 14592, 6144, 'building', ownerId);
    }
    if (spawnType === 2) {
        return boxFromCenter(fineX, fineY, -9408, -11136, 18048, 7680, 'building', ownerId);
    }
    return boxFromCenter(fineX, fineY, -5184, -7680, 10368, 4224, 'building', ownerId);
}

export function moveBox(box: CollisionBox, dx: number, dy: number): void {
    box.startX += dx;
    box.endX += dx;
    box.startY += dy;
    box.endY += dy;
}

export function relocateBox(box: CollisionBox, startX: number, startY: number): void {
    const w = box.endX - box.startX;
    const h = box.endY - box.startY;
    box.startX = startX;
    box.startY = startY;
    box.endX = startX + w;
    box.endY = startY + h;
}
