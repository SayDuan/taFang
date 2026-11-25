/**
 * 把地图字节收成背景层和路层，再按邻居拼图、抽变体。
 * 规则对齐原版 BackgroundMap 的 create / shapen / variation。
 */

export const CANYON_IMAGE_REMAP = [-1, 9, 6, 0, 8, 3, -1, 10, 7, -1, 1, 5, 2, 11, 4, -1];
export const WATER_IMAGE_REMAP = CANYON_IMAGE_REMAP;
export const STREET_IMAGE_REMAP = [7, 10, 8, 4, 9, 2, 1, 15, 11, 3, 0, 13, 5, 12, 14, 6];

export interface TerrainMaps {
    cols: number;
    rows: number;
    raw: Uint8Array;
    background: Int16Array;
    street: Int16Array;
}

function at(cols: number, col: number, row: number): number {
    return row * cols + col;
}

function random(n: number): number {
    return Math.floor(Math.random() * n);
}

function getRaw(maps: TerrainMaps, col: number, row: number): number {
    if (col < 0 || row < 0 || col >= maps.cols || row >= maps.rows) {
        return -1;
    }
    return maps.raw[at(maps.cols, col, row)];
}

function getLayer(maps: TerrainMaps, col: number, row: number, layer: 0 | 1): number {
    if (col < 0 || row < 0 || col >= maps.cols || row >= maps.rows) {
        return -1;
    }
    const arr = layer === 0 ? maps.background : maps.street;
    return arr[at(maps.cols, col, row)];
}

/**
 * 当前格在 [selfMin, selfMax] 时，看邻居是否落在 [neighMin, neighMax]。
 * 上 1、下 2、左 4、右 8、右上 16、右下 32、左下 64、左上 128。
 */
function overlayValue(
    maps: TerrainMaps,
    col: number,
    row: number,
    selfMin: number,
    selfMax: number,
    neighMin: number,
    neighMax: number,
    layer: 0 | 1,
): number {
    const self = getLayer(maps, col, row, layer);
    if (self < selfMin || self > selfMax) {
        return 0;
    }
    const inRange = (c: number, r: number): boolean => {
        if (c < 0 || r < 0 || c >= maps.cols || r >= maps.rows) {
            return false;
        }
        const v = getLayer(maps, c, r, layer);
        return v >= neighMin && v <= neighMax;
    };
    let mask = 0;
    if (inRange(col, row - 1)) mask += 1;
    if (inRange(col, row + 1)) mask += 2;
    if (inRange(col - 1, row)) mask += 4;
    if (inRange(col + 1, row)) mask += 8;
    if (inRange(col + 1, row - 1)) mask += 16;
    if (inRange(col + 1, row + 1)) mask += 32;
    if (inRange(col - 1, row + 1)) mask += 64;
    if (inRange(col - 1, row - 1)) mask += 128;
    return mask;
}

function foldCornerMask(bits: number): number {
    const nw = (bits & 4) === 4 || (bits & 128) === 128 || (bits & 1) === 1;
    const ne = (bits & 1) === 1 || (bits & 16) === 16 || (bits & 8) === 8;
    const sw = (bits & 2) === 2 || (bits & 64) === 64 || (bits & 4) === 4;
    const se = (bits & 8) === 8 || (bits & 32) === 32 || (bits & 2) === 2;
    let mask = 0;
    if (nw) mask += 1;
    if (ne) mask += 2;
    if (sw) mask += 4;
    if (se) mask += 8;
    return mask;
}

function createBackgroundMap(maps: TerrainMaps): void {
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const b = getRaw(maps, col, row);
            // 没写进 switch 的字节（含 0、16、装饰和建筑）保持沙地 0。只有下面这些才收成峡谷底。
            let v = 0;
            switch (b) {
                case 32:
                case 40: case 41: case 42: case 43: case 44: case 45: case 46:
                case 48:
                case 52: case 53: case 54: case 55: case 56: case 57: case 58:
                case 59: case 60: case 61: case 62: case 63: case 64: case 65: case 66:
                case 80: case 81:
                case 110:
                    v = 48;
                    break;
                case 36:
                    v = 0;
                    break;
                case 88:
                case 89: {
                    const above = getRaw(maps, col, row - 1);
                    v = above === 88 || above === 89 ? 48 : 0;
                    break;
                }
                case 120: case 121: case 122: case 123: case 124: case 125: case 126:
                    v = 96;
                    break;
                case 160:
                    v = 160;
                    break;
                default:
                    v = 0;
                    break;
            }
            maps.background[at(maps.cols, col, row)] = v;
        }
    }
}

function createStreetLayerMap(maps: TerrainMaps): void {
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const b = getRaw(maps, col, row);
            let v = 0;
            switch (b) {
                case 16:
                case 112:
                case 113:
                case 114:
                case 150:
                    v = 16;
                    break;
                case 80:
                    v = 64;
                    break;
                case 81:
                    v = 68;
                    break;
                case 82: case 83: case 84: case 85:
                    v = 72;
                    break;
                case 88:
                    v = 76;
                    break;
                case 89:
                    v = 80;
                    break;
                case 90: case 91: case 92: case 93:
                    v = 84;
                    break;
                default:
                    v = 0;
                    break;
            }
            maps.street[at(maps.cols, col, row)] = v;
        }
    }
}

function shapenBackgroundMap(maps: TerrainMaps): void {
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const bits = overlayValue(maps, col, row, 0, 15, 48, 91, 0);
            const mask = foldCornerMask(bits);
            if (CANYON_IMAGE_REMAP[mask] > -1) {
                maps.background[at(maps.cols, col, row)] = mask;
            }
        }
    }
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const bits = overlayValue(maps, col, row, 48, 95, 0, 15, 0);
            let shadow = -1;
            if ((bits & 145) === 129 || (bits & 145) === 17 || (bits & 145) === 145) {
                shadow = 0;
            }
            if ((bits & 56) === 40 || (bits & 56) === 24 || (bits & 56) === 56) {
                shadow = 1;
            }
            if ((bits & 25) === 16 && col > 0) {
                shadow = 5;
            }
            if ((bits & 25) === 1 && col < maps.cols - 1) {
                shadow = 6;
            }
            if ((bits & 149) === 149) {
                shadow = 2;
            }
            if ((bits & 25) === 25) {
                shadow = 3;
            }
            if ((bits & 24) === 8 && row > 0) {
                shadow = 4;
            }
            if (shadow >= 0) {
                maps.background[at(maps.cols, col, row)] = shadow + 56;
            }
        }
    }
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const bits = overlayValue(maps, col, row, 0, 15, 96, 96, 0);
            const mask = foldCornerMask(bits);
            if (WATER_IMAGE_REMAP[mask] > -1) {
                maps.background[at(maps.cols, col, row)] = mask + 96;
            }
        }
    }
}

function shapenStreetLayerMap(maps: TerrainMaps): void {
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const v = getLayer(maps, col, row, 1);
            if (v >= 16 && v < 32) {
                const bits = overlayValue(maps, col, row, 16, 31, 16, 31, 1);
                maps.street[at(maps.cols, col, row)] = (bits & 15) + 16;
            }
        }
    }
}

function createVariationMap(maps: TerrainMaps): void {
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const i = at(maps.cols, col, row);
            const v = maps.background[i];
            if (v === 0) maps.background[i] = random(4) + 16;
            if (v === 48) maps.background[i] = random(4) + 64;
            if (v === 12) maps.background[i] = random(4) + 20;
            if (v === 5) maps.background[i] = random(4) + 24;
            if (v === 3) maps.background[i] = random(4) + 28;
            if (v === 10) maps.background[i] = random(4) + 32;
            if (v === 56) maps.background[i] = random(4) + 68;
            if (v === 57) maps.background[i] = random(4) + 72;
            if (v === 108) maps.background[i] = random(4) + 112;
            if (v === 101) maps.background[i] = random(4) + 116;
            if (v === 99) maps.background[i] = random(4) + 120;
            if (v === 106) maps.background[i] = random(4) + 124;
            if (v === 160) maps.background[i] = random(3) + 160;
        }
    }
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const i = at(maps.cols, col, row);
            const v = maps.street[i];
            if (v === 28) {
                const r = random(4);
                if (r > 0) maps.street[i] = r + 32;
            }
            if (v === 19) {
                const r = random(4);
                if (r > 0) maps.street[i] = r + 36;
            }
        }
    }
    for (let row = 0; row < maps.rows; row++) {
        for (let col = 0; col < maps.cols; col++) {
            const i = at(maps.cols, col, row);
            const v = maps.background[i];
            if (v === 64) maps.background[i] = 48;
            if (v === 68) maps.background[i] = 56;
            if (v === 72) maps.background[i] = 57;
            if (v === 20) maps.background[i] = 12;
            if (v === 24) maps.background[i] = 5;
            if (v === 28) maps.background[i] = 3;
            if (v === 32) maps.background[i] = 10;
            if (v === 16) maps.background[i] = 0;
            if (v === 112) maps.background[i] = 108;
            if (v === 116) maps.background[i] = 101;
            if (v === 120) maps.background[i] = 99;
            if (v === 124) maps.background[i] = 106;
        }
    }
}

export function buildTerrain(cols: number, rows: number, cells: Uint8Array): TerrainMaps {
    const maps: TerrainMaps = {
        cols,
        rows,
        raw: cells,
        background: new Int16Array(cols * rows),
        street: new Int16Array(cols * rows),
    };
    createBackgroundMap(maps);
    createStreetLayerMap(maps);
    shapenBackgroundMap(maps);
    shapenStreetLayerMap(maps);
    createVariationMap(maps);
    return maps;
}

/** 横向桥 64 或横向铁路 68：这一段的第一格加左桥墩，段落后一格加右桥墩。 */
export function horizontalPierAt(maps: TerrainMaps, col: number, row: number): 'left' | 'right' | null {
    const i = at(maps.cols, col, row);
    const v = maps.street[i];
    const isRun = (s: number): boolean => s === 64 || s === 68;
    if (isRun(v)) {
        const left = col === 0 ? 0 : maps.street[at(maps.cols, col - 1, row)];
        if (!isRun(left)) {
            return 'left';
        }
    } else {
        const left = col === 0 ? 0 : maps.street[at(maps.cols, col - 1, row)];
        if (isRun(left)) {
            return 'right';
        }
    }
    return null;
}
