/** 走路格子：地面和水面能不能踩，闲逛能不能进这一格，以及地图边界。 */

export interface TerrainMapsLike {
    cols: number;
    rows: number;
    background: Uint8Array | number[];
    street: Uint8Array | number[];
}

function at(layer: Uint8Array | number[], cols: number, rows: number, col: number, row: number): number {
    if (col < 0 || row < 0 || col >= cols || row >= rows) {
        return -1;
    }
    return layer[row * cols + col] & 255;
}

function inBand(v: number, lo: number, hi: number): boolean {
    return v >= lo && v <= hi;
}

/** 背景是 12–14、20–23、48–75，或正好是 96，并且这一格路层是 0，地面单位不能踩。沙漠 0 能走；路层不是 0 时峡谷和水也能踩。 */
export function isReachableGround(maps: TerrainMapsLike, col: number, row: number): boolean {
    const bg = at(maps.background, maps.cols, maps.rows, col, row);
    if (bg < 0) {
        return false;
    }
    const street = at(maps.street, maps.cols, maps.rows, col, row);
    const blockedTerrain = inBand(bg, 12, 14) || inBand(bg, 20, 23) || inBand(bg, 48, 75) || bg === 96;
    if (blockedTerrain && street === 0) {
        return false;
    }
    return true;
}

/** 水面左右：12–14、16–19、20–23、48–75、97–127、160–163 挡；纯水 96 能走。 */
export function isReachableXWater(maps: TerrainMapsLike, col: number, row: number): boolean {
    const bg = at(maps.background, maps.cols, maps.rows, col, row);
    if (bg < 0) {
        return false;
    }
    if (inBand(bg, 12, 14) || inBand(bg, 16, 19) || inBand(bg, 20, 23) || inBand(bg, 48, 75) || inBand(bg, 97, 127) || inBand(bg, 160, 163)) {
        return false;
    }
    return true;
}

/** 水面上下：只挡 12–14、16–19、20–23、48–75。岸 97–127 和冰 160–163 上下能走。 */
export function isReachableYWater(maps: TerrainMapsLike, col: number, row: number): boolean {
    const bg = at(maps.background, maps.cols, maps.rows, col, row);
    if (bg < 0) {
        return false;
    }
    if (inBand(bg, 12, 14) || inBand(bg, 16, 19) || inBand(bg, 20, 23) || inBand(bg, 48, 75)) {
        return false;
    }
    return true;
}

/** 闲逛落脚：在图内，并且背景是 0 或 16–19。 */
export function isFreeToWalk(maps: TerrainMapsLike, col: number, row: number): boolean {
    const bg = at(maps.background, maps.cols, maps.rows, col, row);
    if (bg < 0) {
        return false;
    }
    return bg === 0 || inBand(bg, 16, 19);
}

/** 路层 16–39 算街，闲逛第一轮不会主动走进去。 */
export function isStreet(maps: TerrainMapsLike, col: number, row: number): boolean {
    const street = at(maps.street, maps.cols, maps.rows, col, row);
    return street >= 16 && street <= 39;
}

/**
 * 四角探测：人不是整格移动，按碰撞盒四个角所在的格子检查。
 * axis 为 'x' 或 'y'，水面时左右和上下规则不同。
 */
export function cornersReachable(
    maps: TerrainMapsLike,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    onWater: boolean,
    axis: 'x' | 'y',
): boolean {
    const points: Array<[number, number]> = [
        [startX, startY],
        [endX - 1, startY],
        [startX, endY - 1],
        [endX - 1, endY - 1],
    ];
    for (const [fx, fy] of points) {
        const col = Math.floor(fx / 7680);
        const row = Math.floor(fy / 7680);
        if (onWater) {
            const ok = axis === 'x' ? isReachableXWater(maps, col, row) : isReachableYWater(maps, col, row);
            if (!ok) {
                return false;
            }
        } else if (!isReachableGround(maps, col, row)) {
            return false;
        }
    }
    return true;
}

/** X 不能小于 2880，也不能大于 cols*7680-3840+960。Y 不能小于 6720，也不能大于 rows*7680+960。 */
export function clampToMapBounds(fineX: number, fineY: number, cols: number, rows: number): { fineX: number; fineY: number } {
    const minX = 2880;
    const maxX = cols * 7680 - 3840 + 960;
    const minY = 6720;
    const maxY = rows * 7680 + 960;
    let x = fineX;
    let y = fineY;
    if (x < minX) {
        x = minX;
    }
    if (x > maxX) {
        x = maxX;
    }
    if (y < minY) {
        y = minY;
    }
    if (y > maxY) {
        y = maxY;
    }
    return { fineX: x, fineY: y };
}

export function inMapBounds(fineX: number, fineY: number, cols: number, rows: number): boolean {
    const minX = 2880;
    const maxX = cols * 7680 - 3840 + 960;
    const minY = 6720;
    const maxY = rows * 7680 + 960;
    return fineX >= minX && fineX <= maxX && fineY >= minY && fineY <= maxY;
}
