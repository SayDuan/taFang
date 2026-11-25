/** 第 6 步：装饰、房子、火车、船、炸药箱的收格和占格。画的时候仍用格子底边和水平中心。 */

export interface DecorSpec {
    file: string;
    type: number;
    wide: number;
    /** 左车挡画完后右边缘再加 1 像素。 */
    extraRight: number;
    /** 在 base 包的 tiles-shared 下，不在 sprites 下。 */
    sharedTile: boolean;
}

export const DECOR_BY_BYTE: Record<number, DecorSpec> = {
    68: { file: 'decor/e_1x1_cactus_a', type: 1, wide: 1, extraRight: 0, sharedTile: false },
    69: { file: 'decor/e_1x1_rocks_a', type: 2, wide: 1, extraRight: 0, sharedTile: false },
    70: { file: 'decor/e_1x1_rocks_b', type: 3, wide: 1, extraRight: 0, sharedTile: false },
    71: { file: 'decor/e_1x1_tree', type: 4, wide: 1, extraRight: 0, sharedTile: false },
    72: { file: 'buildings/b_1x1_stake', type: 5, wide: 1, extraRight: 0, sharedTile: false },
    73: { file: 'decor/e_1x1_cactus_b', type: 6, wide: 1, extraRight: 0, sharedTile: false },
    74: { file: 'buildings/b_1x1_windmill', type: 7, wide: 1, extraRight: 0, sharedTile: false },
    75: { file: 'buildings/b_1x1_watertower', type: 8, wide: 1, extraRight: 0, sharedTile: false },
    76: { file: 'decor/e_1x1_bush', type: 9, wide: 1, extraRight: 0, sharedTile: false },
    77: { file: 'decor/e_1x2_bones', type: 10, wide: 1, extraRight: 0, sharedTile: false },
    79: { file: 'decor/e_1x1_tree_green_a', type: 15, wide: 1, extraRight: 0, sharedTile: false },
    86: { file: 'tiles-shared/tiles_railway_buffers_hori_left', type: 16, wide: 1, extraRight: 1, sharedTile: true },
    87: { file: 'tiles-shared/tiles_railway_buffers_hori_right', type: 17, wide: 1, extraRight: 0, sharedTile: true },
    94: { file: 'tiles-shared/tiles_railway_buffers_verti_up', type: 18, wide: 1, extraRight: 0, sharedTile: true },
    95: { file: 'tiles-shared/tiles_railway_buffers_verti_down', type: 19, wide: 1, extraRight: 0, sharedTile: true },
    115: { file: 'decor/e_1x1_tree_green_b', type: 48, wide: 1, extraRight: 0, sharedTile: false },
    116: { file: 'buildings/b_2x1_shack', type: 12, wide: 2, extraRight: 0, sharedTile: false },
    117: { file: 'buildings/b_1x1_tipi_small', type: 13, wide: 1, extraRight: 0, sharedTile: false },
    118: { file: 'decor/e_1x1_tree_stump', type: 51, wide: 1, extraRight: 0, sharedTile: false },
    119: { file: 'decor/e_1x1_tree_green_c', type: 52, wide: 1, extraRight: 0, sharedTile: false },
    126: { file: 'decor/e_1x1_rocks_water', type: 20, wide: 1, extraRight: 0, sharedTile: false },
};

export interface BuildingSpec {
    file: string;
    spawnType: number;
    kind: 'saloon' | 'fort' | 'tipi' | 'casino';
}

export const BUILDING_BY_BYTE: Record<number, BuildingSpec> = {
    112: { file: 'buildings/b_3x2_saloon', spawnType: 1, kind: 'saloon' },
    113: { file: 'buildings/b_3x2_fort', spawnType: 2, kind: 'fort' },
    114: { file: 'buildings/b_2x1_tipi', spawnType: 3, kind: 'tipi' },
    150: { file: 'buildings/b_3x2_casino', spawnType: 4, kind: 'casino' },
};

/** 一张要画在格子上的图。同一格可以有车身和炮两张。 */
export interface PlacedSprite {
    kind: 'decor' | 'building' | 'vehicle' | 'dynamite';
    col: number;
    row: number;
    file: string;
    wide: number;
    extraRight: number;
    /** 加特林、双炮图是竖着 5 帧，给要切的那一行。整张图则是 -1。 */
    sliceRow: number;
    name: string;
    unitType: number;
}

export interface MapObjectSet {
    sprites: PlacedSprite[];
    blocked: boolean[];
}

export function decorFileFor(byte: number, snowDecor: boolean): string | null {
    if (snowDecor) {
        if (byte === 76) {
            return 'decor/e_1x1_tree_snow';
        }
        if (byte === 69) {
            return 'decor/e_1x1_rocks_snow_a';
        }
        if (byte === 70) {
            return 'decor/e_1x1_rocks_snow_b';
        }
    }
    return DECOR_BY_BYTE[byte]?.file ?? null;
}

/** 赌徒解锁之前不画赌场。存档还没接上时按未解锁处理。 */
export function isGamblerUnlocked(): boolean {
    return false;
}

export function collectMapObjects(
    cols: number,
    rows: number,
    raw: Uint8Array | number[],
    snowDecor: boolean,
    gamblerUnlocked: boolean = isGamblerUnlocked(),
): MapObjectSet {
    const sprites: PlacedSprite[] = [];
    const blocked = new Array(cols * rows).fill(false);
    const visited = new Array(cols * rows).fill(false);

    const at = (col: number, row: number): number => raw[row * cols + col];

    const occupy = (col: number, row: number): void => {
        if (col >= 0 && row >= 0 && col < cols && row < rows) {
            blocked[row * cols + col] = true;
        }
    };

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const byte = at(col, row);
            const decor = DECOR_BY_BYTE[byte];
            if (decor) {
                const file = decorFileFor(byte, snowDecor) ?? decor.file;
                sprites.push({
                    kind: 'decor',
                    col,
                    row,
                    file,
                    wide: decor.wide,
                    extraRight: decor.extraRight,
                    sliceRow: -1,
                    name: `decor_${col}_${row}`,
                    unitType: decor.type,
                });
                if (decor.type === 12) {
                    occupy(col - 1, row);
                    occupy(col, row);
                    occupy(col + 1, row);
                } else if (decor.type === 10) {
                    occupy(col, row);
                    occupy(col, row - 1);
                } else {
                    occupy(col, row);
                }
            }

            const building = BUILDING_BY_BYTE[byte];
            if (building) {
                if (building.kind === 'casino' && !gamblerUnlocked) {
                    continue;
                }
                sprites.push({
                    kind: 'building',
                    col,
                    row,
                    file: building.file,
                    wide: 1,
                    extraRight: 0,
                    sliceRow: -1,
                    name: `build_${building.kind}_${col}_${row}`,
                    unitType: building.spawnType,
                });
                if (building.kind === 'tipi') {
                    occupy(col, row);
                    occupy(col - 1, row);
                } else {
                    occupy(col - 1, row);
                    occupy(col, row);
                    occupy(col + 1, row);
                    occupy(col - 1, row - 1);
                    occupy(col, row - 1);
                    occupy(col + 1, row - 1);
                }
            }

            if (byte === 110) {
                sprites.push({
                    kind: 'dynamite',
                    col,
                    row,
                    file: 'fx/dynamite_box',
                    wide: 1,
                    extraRight: 0,
                    sliceRow: -1,
                    name: `dyna_${col}_${row}`,
                    unitType: 8,
                });
                occupy(col, row);
            }
        }
    }

    collectHorizontalTrains(cols, rows, at, visited, sprites, occupy);
    collectVerticalTrains(cols, rows, at, visited, sprites, occupy);
    collectSteamers(cols, rows, at, visited, sprites, occupy);

    sprites.sort((a, b) => a.row - b.row || a.col - b.col);
    return { sprites, blocked };
}

function collectHorizontalTrains(
    cols: number,
    rows: number,
    at: (c: number, r: number) => number,
    visited: boolean[],
    sprites: PlacedSprite[],
    occupy: (c: number, r: number) => void,
): void {
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const i = row * cols + col;
            if (visited[i] || at(col, row) !== 83) {
                continue;
            }
            let engine = 0;
            let c = col;
            while (c < cols) {
                const byte = at(c, row);
                const vi = row * cols + c;
                if (byte === 83) {
                    const typ = engine + 10;
                    engine++;
                    const file = typ === 10
                        ? 'vehicles/lok_hori_1of2'
                        : typ === 11
                            ? 'vehicles/lok_hori_2of2'
                            : 'vehicles/lok_wagon_hori';
                    sprites.push(vehicle(c, row, file, typ, `trainH_${c}_${row}_${typ}`));
                    visited[vi] = true;
                    occupy(c, row);
                    c++;
                    continue;
                }
                if (byte === 84 || byte === 85) {
                    sprites.push(vehicle(c, row, 'vehicles/lok_wagon_hori', 12, `trainH_wagon_${c}_${row}`));
                    // APK: drawWeapon() 运行时绘制，只在 activityStatus>4 && hasWeaponSlot()(unit==12) 时显示
                    visited[vi] = true;
                    occupy(c, row);
                    c++;
                    continue;
                }
                break;
            }
        }
    }
}

function collectVerticalTrains(
    cols: number,
    rows: number,
    at: (c: number, r: number) => number,
    visited: boolean[],
    sprites: PlacedSprite[],
    occupy: (c: number, r: number) => void,
): void {
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const i = row * cols + col;
            const start = at(col, row);
            // 91 本身不启动扫描，要碰到下面的 92 或 93 才从那里往下收。
            if (visited[i] || (start !== 92 && start !== 93)) {
                continue;
            }
            let engine = 0;
            let r = row;
            while (r < rows) {
                const byte = at(col, r);
                const vi = r * cols + col;
                if (byte === 91) {
                    const typ = engine + 20;
                    engine++;
                    const file = typ === 20
                        ? 'vehicles/lok_verti_1of2'
                        : typ === 21
                            ? 'vehicles/lok_verti_2of2'
                            : 'vehicles/lok_wagon_verti';
                    sprites.push(vehicle(col, r, file, typ, `trainV_${col}_${r}_${typ}`));
                    visited[vi] = true;
                    occupy(col, r);
                    r++;
                    continue;
                }
                if (byte === 92 || byte === 93) {
                    sprites.push(vehicle(col, r, 'vehicles/lok_wagon_verti', 22, `trainV_wagon_${col}_${r}`));
                    // APK: drawWeapon() 运行时绘制，只在 activityStatus>4 && hasWeaponSlot()(unit==22) 时显示
                    visited[vi] = true;
                    occupy(col, r);
                    r++;
                    continue;
                }
                break;
            }
        }
    }
}

function collectSteamers(
    cols: number,
    rows: number,
    at: (c: number, r: number) => number,
    visited: boolean[],
    sprites: PlacedSprite[],
    occupy: (c: number, r: number) => void,
): void {
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const i = row * cols + col;
            if (visited[i] || at(col, row) !== 120) {
                continue;
            }
            // 120 放类型 30，并在右边一格（通常是水）再放类型 31。
            sprites.push(vehicle(col, row, 'vehicles/steamboat_1', 30, `boat_${col}_${row}_30`));
            visited[i] = true;
            occupy(col, row);
            if (col + 1 < cols) {
                sprites.push(vehicle(col + 1, row, 'vehicles/steamboat_2', 31, `boat_${col + 1}_${row}_31`));
                occupy(col + 1, row);
            }
            let c = col + 1;
            let stop = false;
            while (!stop && c < cols) {
                const byte = at(c, row);
                const vi = row * cols + c;
                if (byte === 124) {
                    c++;
                    continue;
                }
                if (byte === 121 || byte === 122) {
                    sprites.push(vehicle(c, row, 'vehicles/steamboat_3', 32, `boat_${c}_${row}_32`));
                    // APK: drawWeapon() 运行时绘制，只在 activityStatus>4 && hasWeaponSlot()(unit==32) 时显示
                    visited[vi] = true;
                    occupy(c, row);
                    c++;
                    continue;
                }
                if (byte === 123) {
                    sprites.push(vehicle(c, row, 'vehicles/steamboat_4a', 33, `boat_${c}_${row}_33`));
                    visited[vi] = true;
                    occupy(c, row);
                    stop = true;
                    continue;
                }
                c++;
            }
        }
    }
}

function vehicle(col: number, row: number, file: string, unitType: number, name: string): PlacedSprite {
    return {
        kind: 'vehicle',
        col,
        row,
        file,
        wide: 1,
        extraRight: 0,
        sliceRow: -1,
        name,
        unitType,
    };
}

export function logStep6Acceptance(
    level: number,
    cols: number,
    rows: number,
    raw: Uint8Array | number[],
    objects: MapObjectSet,
): void {
    const at = (c: number, r: number): number => raw[r * cols + c];
    if (level === 2) {
        const tipis = objects.sprites.filter((s) => s.file.endsWith('b_1x1_tipi_small'));
        console.log('[Step6] 第 2 关小帐篷', tipis.map((s) => `${s.col},${s.row}`).join(' '));
    }
    if (level === 4) {
        const names = objects.sprites
            .filter((s) => s.kind === 'building' || s.file.includes('railway_buffers') || s.kind === 'vehicle')
            .map((s) => `${s.name}@${s.col},${s.row}`);
        console.log('[Step6] 第 4 关房子车挡火车', names.join(' | '));
        const tavern = objects.sprites.find((s) => s.file.endsWith('b_3x2_saloon'));
        if (tavern) {
            const cells: string[] = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (objects.blocked[r * cols + c]) {
                        const near = Math.abs(c - tavern.col) <= 1 && (r === tavern.row || r === tavern.row - 1);
                        if (near) {
                            cells.push(`${c},${r}`);
                        }
                    }
                }
            }
            console.log('[Step6] 酒馆占格', cells.join(' '));
        }
    }
    if (level === 31) {
        const snow = objects.sprites.filter((s) => s.file.includes('_snow'));
        const warm = objects.sprites.filter((s) => s.file.endsWith('e_1x1_tree') || s.file.includes('cactus'));
        console.log('[Step6] 第 31 关雪地图', snow.map((s) => `${s.file}@${s.col},${s.row}`).join(' | '));
        console.log('[Step6] 第 31 关未换的枯树仙人掌', warm.map((s) => `${s.file}@${s.col},${s.row}`).join(' | '));
    }
    void at;
}
