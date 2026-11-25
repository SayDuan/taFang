/**
 * 整关模拟的统一入口。
 * GameSim.tick(dt) 就是 BattleSim.tick：同一拍推进波次、移动、战斗、宝箱、
 * 出生池、雇佣后的状态和胜负；中途档仍按表在每一波开始时写入。
 * 视图只调用这一拍和玩家输入（雇、拖、暂停、选难度），不另写一套关卡脚本。
 */
import { BattleSim, PlacedOccupant, SimOptions } from './BattleSim';
import { CampaignProgress } from './CampaignProgress';
import { HighScoreBoard } from './Difficulty';
import { MODE_NORMAL } from './EnemyCatalog';
import { loadAsciiMap, RawMaps, collectSpawnPoints } from './EnemySystem';
import { TURN_TABLE, entryDir, isExitByte, isJunctionByte, junctionIndex } from './EnemyCatalog';
import { ACTIVITY_FOR_SALE, ACTIVITY_WORKING, Rng } from './Fine';
import { parseSpawnPoolRows, SpawnPoolAction } from './SpawnPool';
import { findWeapon, parseUnitStatsTsv, WeaponStats } from './UnitDesign';
import { WaveRow } from './WaveSystem';
import { SaveSession } from './SaveGame';
import { officialMapSize } from './CampaignLevel';
import { isUnitUnlocked } from './UnitUnlock';

export { BattleSim, type PlacedOccupant, type SimOptions };

export class GameSim extends BattleSim {}

export interface OfficialLevelStats {
    level: number;
    startGold: number;
    leakLives: number;
    chestCap: number;
    chestTime: number;
    upgradeCap: number;
    praiseMin?: number;
    praiseUnit: number;
    chestOnFieldCap: number;
    hpFactor: number;
    midHpFactor: number;
    hardHpFactor: number;
    gamblerTime?: number;
}

export interface LayoutUnit {
    col: number;
    row: number;
    type: number;
    activity: number;
    name: string;
    forSale: boolean;
}

export interface OfficialLevelData {
    maps: RawMaps;
    occupants: PlacedOccupant[];
    mapUnits: LayoutUnit[];
    weapons: WeaponStats[];
    stats: OfficialLevelStats;
    waves: WaveRow[];
    spawnPoolActions: SpawnPoolAction[];
}

export interface TsvTable {
    header: string[];
    rows: Record<string, string>[];
}

export function parseTsv(text: string): TsvTable {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    const header = (lines[0] ?? '').split('\t');
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        const row: Record<string, string> = {};
        for (let c = 0; c < header.length; c++) {
            row[header[c]] = cells[c] ?? '';
        }
        rows.push(row);
    }
    return { header, rows };
}

export function tsvNum(row: Record<string, string>, key: string): number | undefined {
    const raw = row[key];
    if (raw === undefined || raw === '') {
        return undefined;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

export function parseLevelStatsTsv(text: string): OfficialLevelStats[] {
    const table = parseTsv(text);
    const out: OfficialLevelStats[] = [];
    for (const row of table.rows) {
        const level = tsvNum(row, '关卡');
        if (level === undefined) {
            continue;
        }
        out.push({
            level,
            startGold: tsvNum(row, '起始金钱') ?? 0,
            leakLives: tsvNum(row, '可漏人数') ?? 0,
            chestCap: tsvNum(row, '宝箱上限') ?? 0,
            chestTime: tsvNum(row, '宝箱时间') ?? 10000,
            upgradeCap: tsvNum(row, '升级上限') ?? 0,
            praiseMin: tsvNum(row, '赞赏下限'),
            praiseUnit: tsvNum(row, '赞赏单位') ?? 4,
            chestOnFieldCap: tsvNum(row, '场上宝箱上限') ?? 17,
            hpFactor: tsvNum(row, '血量系数') ?? 100,
            midHpFactor: tsvNum(row, '中等血量系数') ?? 125,
            hardHpFactor: tsvNum(row, '困难血量系数') ?? 155,
            gamblerTime: tsvNum(row, '赌徒时间'),
        });
    }
    return out;
}

export function parseWaveTsv(text: string): WaveRow[] {
    const table = parseTsv(text);
    const out: WaveRow[] = [];
    for (const row of table.rows) {
        const level = tsvNum(row, '关卡');
        const wave = tsvNum(row, '波次');
        if (level === undefined || wave === undefined) {
            continue;
        }
        out.push({
            level,
            wave,
            wait: tsvNum(row, '等待') ?? 0,
            hpFactor: tsvNum(row, '血量系数') ?? 100,
            speedFactor: tsvNum(row, '速度系数') ?? 100,
            spawnPoint: tsvNum(row, '出生点') ?? 0,
            interval: tsvNum(row, '出兵间隔') ?? 0,
            settler1: tsvNum(row, '移民1人组') ?? 0,
            settler2: tsvNum(row, '移民2人组') ?? 0,
            settler3: tsvNum(row, '移民3人组') ?? 0,
            settler4: tsvNum(row, '移民4人组') ?? 0,
            cavalry: tsvNum(row, '骑兵') ?? 0,
            wagon: tsvNum(row, '篷车') ?? 0,
            stagecoach: tsvNum(row, '驿马车') ?? 0,
            goldWagon: tsvNum(row, '金车') ?? 0,
            boss: tsvNum(row, '头目') ?? 0,
            doctor: tsvNum(row, '医生') ?? 0,
            waveText: (row['波次文案'] ?? '').trim() || undefined,
        });
    }
    return out;
}

const DECOR_TYPE_BY_BYTE: Record<number, number> = {
    68: 1, 69: 2, 70: 3, 71: 4, 72: 5, 73: 6, 74: 7, 75: 8, 76: 9, 77: 10,
    79: 15, 86: 16, 87: 17, 94: 18, 95: 19, 115: 48, 116: 12, 117: 13,
    118: 51, 119: 52, 126: 20,
};

const BUILDING_TYPE_BY_BYTE: Record<number, number> = {
    112: 1,
    113: 2,
    114: 3,
    150: 4,
};

const UNIT_TYPE_BY_NAME: Record<string, number> = {
    亡命之徒: 1,
    暴徒: 2,
    加农炮: 3,
    本地人: 4,
    女射手: 5,
    猎枪老人: 6,
    炸药引爆器: 7,
    炸药箱: 8,
    赌徒: 9,
    纵火狂: 35,
    蛇油商人: 36,
};

/** 和地图字节表、第 7 步收单位规则一致。 */
export function unitTypeFromByte(byte: number): { type: number; activity: number } | null {
    if ((byte >= 96 && byte <= 101) || byte === 130 || byte === 131) {
        return { type: byte - 95, activity: ACTIVITY_FOR_SALE };
    }
    if ((byte >= 104 && byte <= 109) || byte === 138 || byte === 139) {
        return { type: byte - 103, activity: ACTIVITY_WORKING };
    }
    if (byte === 102) {
        return { type: 7, activity: ACTIVITY_WORKING };
    }
    if (byte === 110) {
        return { type: 8, activity: ACTIVITY_WORKING };
    }
    if (byte === 132) {
        return { type: 9, activity: ACTIVITY_WORKING };
    }
    return null;
}

export function collectMapUnitsFromRaw(cols: number, rows: number, raw: Uint8Array | number[]): LayoutUnit[] {
    const units: LayoutUnit[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const found = unitTypeFromByte(raw[row * cols + col] & 255);
            if (!found) {
                continue;
            }
            units.push({
                col,
                row,
                type: found.type,
                activity: found.activity,
                name: `单位${found.type}`,
                forSale: found.activity === ACTIVITY_FOR_SALE,
            });
        }
    }
    return units;
}


/** 地图字节串出的火车和蒸汽船。规则与第 6 步、地图字节表一致，进入同一套 GameSim，不为某一关开分支。 */
export function collectVehiclesFromRaw(cols: number, rows: number, raw: Uint8Array | number[]): LayoutUnit[] {
    const units: LayoutUnit[] = [];
    const visited = new Array(cols * rows).fill(false);
    const at = (col: number, row: number): number => raw[row * cols + col] & 255;
    const push = (col: number, row: number, type: number, activity: number, name: string): void => {
        units.push({ col, row, type, activity, name, forSale: activity === ACTIVITY_FOR_SALE });
    };

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
                    engine += 1;
                    push(c, row, typ, ACTIVITY_WORKING, typ === 10 ? '火车头' : '火车车厢');
                    visited[vi] = true;
                    c += 1;
                    continue;
                }
                if (byte === 84 || byte === 85) {
                    push(c, row, 12, byte === 84 ? ACTIVITY_FOR_SALE : ACTIVITY_WORKING, '火车加特林');
                    visited[vi] = true;
                    c += 1;
                    continue;
                }
                break;
            }
        }
    }

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
                    engine += 1;
                    push(col, r, typ, ACTIVITY_WORKING, typ === 20 ? '火车头' : '火车车厢');
                    visited[vi] = true;
                    r += 1;
                    continue;
                }
                if (byte === 92 || byte === 93) {
                    push(col, r, 22, byte === 92 ? ACTIVITY_FOR_SALE : ACTIVITY_WORKING, '火车加特林');
                    visited[vi] = true;
                    r += 1;
                    continue;
                }
                break;
            }
        }
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const i = row * cols + col;
            if (visited[i] || at(col, row) !== 120) {
                continue;
            }
            push(col, row, 30, ACTIVITY_WORKING, '蒸汽船');
            visited[i] = true;
            if (col + 1 < cols) {
                push(col + 1, row, 31, ACTIVITY_WORKING, '蒸汽船');
                visited[row * cols + col + 1] = true;
            }
            let c = col + 1;
            let stop = false;
            while (!stop && c < cols) {
                const byte = at(c, row);
                const vi = row * cols + c;
                if (byte === 124) {
                    c += 1;
                    continue;
                }
                if (byte === 121 || byte === 122) {
                    push(c, row, 32, byte === 121 ? ACTIVITY_FOR_SALE : ACTIVITY_WORKING, '蒸汽船双炮');
                    visited[vi] = true;
                    c += 1;
                    continue;
                }
                if (byte === 123) {
                    push(c, row, 33, ACTIVITY_WORKING, '蒸汽船船尾');
                    visited[vi] = true;
                    stop = true;
                    continue;
                }
                c += 1;
            }
        }
    }
    units.sort((a, b) => a.row - b.row || a.col - b.col);
    return units;
}

export function collectOccupantsFromRaw(cols: number, rows: number, raw: Uint8Array | number[]): PlacedOccupant[] {
    const occupants: PlacedOccupant[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const byte = raw[row * cols + col] & 255;
            const building = BUILDING_TYPE_BY_BYTE[byte];
            if (building !== undefined) {
                occupants.push({ col, row, spawnType: building });
                continue;
            }
            const decor = DECOR_TYPE_BY_BYTE[byte];
            if (decor !== undefined) {
                occupants.push({ col, row, decorType: decor });
            }
        }
    }
    return occupants;
}

export function parseCharByte(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (!trimmed) {
        return undefined;
    }
    const hashed = /^#(\d+)$/.exec(trimmed);
    if (hashed) {
        return Number(hashed[1]);
    }
    if (trimmed.length === 1) {
        return trimmed.charCodeAt(0) & 255;
    }
    return undefined;
}

export function parseLayoutTsv(text: string, level: number): { units: LayoutUnit[]; occupants: PlacedOccupant[] } {
    const table = parseTsv(text);
    const units: LayoutUnit[] = [];
    const occupants: PlacedOccupant[] = [];
    for (const row of table.rows) {
        if (tsvNum(row, '关卡') !== level) {
            continue;
        }
        const col = tsvNum(row, '列');
        const r = tsvNum(row, '行');
        if (col === undefined || r === undefined) {
            continue;
        }
        const kind = (row['类别'] ?? '').trim();
        const name = (row['名称'] ?? '').trim();
        const status = (row['状态'] ?? '').trim();
        const byte = parseCharByte(row['字符'] ?? '');
        if (kind === '单位') {
            let type = UNIT_TYPE_BY_NAME[name];
            if (type === undefined && byte !== undefined) {
                type = unitTypeFromByte(byte)?.type;
            }
            if (type === undefined) {
                continue;
            }
            const working = status.includes('干活') || status.includes('已放置');
            const activity = working ? ACTIVITY_WORKING : ACTIVITY_FOR_SALE;
            units.push({ col, row: r, type, activity, name, forSale: !working });
            continue;
        }
        if (kind === '装饰') {
            const typed = /类型\s*(\d+)/.exec(status);
            const decorType = typed ? Number(typed[1]) : (byte !== undefined ? DECOR_TYPE_BY_BYTE[byte] : undefined);
            if (decorType !== undefined) {
                occupants.push({ col, row: r, decorType });
            }
            continue;
        }
        if (kind === '火车' || kind === '蒸汽船') {
            const found = vehicleFromLayout(kind, name, status, byte);
            if (found) {
                units.push({ col, row: r, type: found.type, activity: found.activity, name, forSale: found.activity === ACTIVITY_FOR_SALE });
            }
        }
    }
    return { units, occupants };
}

function vehicleFromLayout(kind: string, name: string, status: string, byte: number | undefined): { type: number; activity: number } | null {
    const forSale = status.includes('待购买') || status.includes('待售');
    const activity = forSale ? ACTIVITY_FOR_SALE : ACTIVITY_WORKING;
    if (kind === '火车') {
        const vertical = byte === 91 || byte === 92 || byte === 93;
        if (name === '火车头') {
            return { type: vertical ? 20 : 10, activity: ACTIVITY_WORKING };
        }
        if (name === '火车车厢') {
            return { type: vertical ? 21 : 11, activity: ACTIVITY_WORKING };
        }
        if (name === '火车加特林') {
            return { type: vertical ? 22 : 12, activity };
        }
        return null;
    }
    if (name === '蒸汽船') {
        return { type: status.includes('叠在右边') ? 31 : 30, activity: ACTIVITY_WORKING };
    }
    if (name === '蒸汽船双炮') {
        return { type: 32, activity };
    }
    if (name === '蒸汽船船尾') {
        return { type: 33, activity: ACTIVITY_WORKING };
    }
    return null;
}

function mergeUnits(primary: LayoutUnit[], extra: LayoutUnit[]): LayoutUnit[] {
    const out = primary.slice();
    for (const unit of extra) {
        if (out.some((u) => u.col === unit.col && u.row === unit.row && u.type === unit.type)) {
            continue;
        }
        // 文本地图会丢掉高位字节（例如第 1 关 11,16 的纵火狂 130），布置表补上。
        const sameCell = out.find((u) => u.col === unit.col && u.row === unit.row);
        if (sameCell) {
            sameCell.type = unit.type;
            sameCell.activity = unit.activity;
            sameCell.name = unit.name;
            sameCell.forSale = unit.forSale;
            continue;
        }
        out.push(unit);
    }
    out.sort((a, b) => a.row - b.row || a.col - b.col);
    return out;
}

function mergeOccupants(primary: PlacedOccupant[], extra: PlacedOccupant[]): PlacedOccupant[] {
    const out = primary.slice();
    for (const occ of extra) {
        if (out.some((o) => o.col === occ.col && o.row === occ.row && o.decorType === occ.decorType && o.spawnType === occ.spawnType)) {
            continue;
        }
        out.push(occ);
    }
    return out;
}

/** 按格子数组建图：路格记进 street 层，$ 和转向、出生、离场都算街。60 关共用，不另写一套。 */
export function mapsFromGrid(cols: number, rows: number, raw: Uint8Array | number[]): RawMaps {
    const cells = raw instanceof Uint8Array ? raw : Uint8Array.from(raw, (v) => v & 255);
    const street = new Array(cols * rows).fill(0);
    const background = new Array(cols * rows).fill(0);
    const maps: RawMaps = { cols, rows, raw: cells, street, background };
    for (let i = 0; i < cells.length; i++) {
        const b = cells[i] & 255;
        if (b === 36 || (b >= 40 && b <= 45) || b === 48 || (b >= 52 && b <= 65) || b === 88 || b === 89) {
            street[i] = 16;
        }
        if (b === 124 || b === 125) {
            background[i] = 96;
        }
    }
    markCorridorStreets(maps);
    markEnemyRoutesAsStreet(maps);
    return maps;
}

/** 文本地图只需要走路和寻路：路格记进 street 层，$ 和转向、出生、离场都算街。 */
export function mapsFromAscii(text: string): RawMaps {
    const maps = loadAsciiMap(text);
    return mapsFromGrid(maps.cols, maps.rows, maps.raw);
}

/** 用关卡布置表把官方尺寸的格子填上字节，没有写到的格是沙地 0。 */
export function buildRawMapFromLayout(layoutText: string, level: number, cols: number, rows: number): Uint8Array {
    const raw = new Uint8Array(cols * rows);
    const table = parseTsv(layoutText);
    for (const row of table.rows) {
        if (tsvNum(row, '关卡') !== level) {
            continue;
        }
        const col = tsvNum(row, '列');
        const r = tsvNum(row, '行');
        if (col === undefined || r === undefined) {
            continue;
        }
        if (col < 0 || r < 0 || col >= cols || r >= rows) {
            continue;
        }
        const byte = parseCharByte(row['字符'] ?? '');
        if (byte !== undefined) {
            raw[r * cols + col] = byte;
        }
    }
    return raw;
}

function markEnemyRoutesAsStreet(maps: RawMaps): void {
    const spawns = collectSpawnPoints(maps);
    const queue: { col: number; row: number; dx: number; dy: number }[] = [];
    const seen = new Set<string>();
    for (const spawn of spawns) {
        const dir = entryDir(spawn.col, spawn.row, maps.cols, maps.rows);
        queue.push({ col: spawn.col, row: spawn.row, dx: dir.x, dy: dir.y });
    }
    const paint = (col: number, row: number): void => {
        if (col >= 0 && row >= 0 && col < maps.cols && row < maps.rows) {
            maps.street[row * maps.cols + col] = 16;
        }
    };
    while (queue.length > 0) {
        const start = queue.pop()!;
        let col = start.col;
        let row = start.row;
        let dx = start.dx;
        let dy = start.dy;
        for (let step = 0; step < 400; step++) {
            const key = `${col},${row},${dx},${dy}`;
            if (seen.has(key)) {
                break;
            }
            seen.add(key);
            paint(col, row);
            if (col < -3 || row < -3 || col > maps.cols + 2 || row > maps.rows + 2) {
                break;
            }
            if (col >= 0 && row >= 0 && col < maps.cols && row < maps.rows) {
                const byte = maps.raw[row * maps.cols + col] & 255;
                if (isExitByte(byte)) {
                    paint(col + dx, row + dy);
                    paint(col + dx * 2, row + dy * 2);
                    break;
                }
                if (isJunctionByte(byte)) {
                    const options = TURN_TABLE[junctionIndex(byte)] ?? [];
                    for (const opt of options) {
                        queue.push({ col: col + opt.x, row: row + opt.y, dx: opt.x, dy: opt.y });
                    }
                    break;
                }
            }
            col += dx;
            row += dy;
        }
    }
}

/** 两个出兵路标之间的直线空格也是敌人走的路，记进 street，己方不能穿路拖过去。 */
function isPathFeature(byte: number): boolean {
    return byte === 36 || (byte >= 40 && byte <= 45) || byte === 48 || (byte >= 52 && byte <= 65) || byte === 88 || byte === 89;
}

function isPathFill(byte: number): boolean {
    return byte === 0 || byte === 32;
}

function markCorridorStreets(maps: RawMaps): void {
    const at = (col: number, row: number): number => maps.raw[row * maps.cols + col] & 255;
    const paint = (col: number, row: number): void => {
        maps.street[row * maps.cols + col] = 16;
    };
    for (let row = 0; row < maps.rows; row++) {
        const feats: number[] = [];
        for (let col = 0; col < maps.cols; col++) {
            if (isPathFeature(at(col, row))) {
                feats.push(col);
            }
        }
        for (let i = 0; i < feats.length - 1; i++) {
            const a = feats[i];
            const b = feats[i + 1];
            let ok = true;
            for (let c = a + 1; c < b; c++) {
                if (!isPathFill(at(c, row)) && !isPathFeature(at(c, row))) {
                    ok = false;
                    break;
                }
            }
            if (ok && b - a > 1) {
                for (let c = a; c <= b; c++) {
                    paint(c, row);
                }
            }
        }
    }
    for (let col = 0; col < maps.cols; col++) {
        const feats: number[] = [];
        for (let row = 0; row < maps.rows; row++) {
            if (isPathFeature(at(col, row))) {
                feats.push(row);
            }
        }
        for (let i = 0; i < feats.length - 1; i++) {
            const a = feats[i];
            const b = feats[i + 1];
            let ok = true;
            for (let r = a + 1; r < b; r++) {
                if (!isPathFill(at(col, r)) && !isPathFeature(at(col, r))) {
                    ok = false;
                    break;
                }
            }
            if (ok && b - a > 1) {
                for (let r = a; r <= b; r++) {
                    paint(col, r);
                }
            }
        }
    }
}

export interface OfficialTexts {
    mapText: string;
    levelStatsText: string;
    wavesText: string;
    unitsText: string;
    layoutText?: string;
    spawnPoolText?: string;
}

function assembleOfficialLevelData(level: number, maps: RawMaps, texts: Omit<OfficialTexts, 'mapText'> & { mapText?: string }): OfficialLevelData {
    const fromRawUnits = collectMapUnitsFromRaw(maps.cols, maps.rows, maps.raw);
    const fromRawOcc = collectOccupantsFromRaw(maps.cols, maps.rows, maps.raw);
    const fromRawVehicles = collectVehiclesFromRaw(maps.cols, maps.rows, maps.raw);
    let mapUnits = mergeUnits(fromRawUnits, fromRawVehicles);
    let occupants = fromRawOcc;
    if (texts.layoutText) {
        const layout = parseLayoutTsv(texts.layoutText, level);
        mapUnits = mergeUnits(mapUnits, layout.units);
        occupants = mergeOccupants(fromRawOcc, layout.occupants);
    }
    const stats = parseLevelStatsTsv(texts.levelStatsText).find((row) => row.level === level);
    if (!stats) {
        throw new Error(`关卡数值里没有第 ${level} 关`);
    }
    const waves = parseWaveTsv(texts.wavesText).filter((row) => row.level === level);
    const weapons = parseUnitStatsTsv(texts.unitsText);
    const spawnPoolActions = texts.spawnPoolText
        ? parseSpawnPoolRows(parseTsv(texts.spawnPoolText).rows).filter((row) => row.level === level)
        : [];
    return { maps, occupants, mapUnits, weapons, stats, waves, spawnPoolActions };
}

export function loadOfficialLevelData(level: number, texts: OfficialTexts): OfficialLevelData {
    const maps = mapsFromAscii(texts.mapText);
    return assembleOfficialLevelData(level, maps, texts);
}

/**
 * 按关卡号进入官方关：有地图文本就用地图文件，否则按官方尺寸和布置表铺格子。
 * 出兵、数值、图集都不在这里分关卡写死。
 */
export function loadOfficialLevel(
    level: number,
    texts: Omit<OfficialTexts, 'mapText'> & { mapText?: string },
): OfficialLevelData {
    let maps: RawMaps;
    if (texts.mapText && texts.mapText.trim().length > 0) {
        maps = mapsFromAscii(texts.mapText);
    } else {
        if (!texts.layoutText) {
            throw new Error(`第 ${level} 关没有地图文本，也没有关卡布置表`);
        }
        const size = officialMapSize(level);
        maps = mapsFromGrid(size.cols, size.rows, buildRawMapFromLayout(texts.layoutText, level, size.cols, size.rows));
    }
    return assembleOfficialLevelData(level, maps, texts);
}

export interface CreateOfficialOptions {
    data: OfficialLevelData;
    rng?: Rng;
    saver?: SaveSession | null;
    progress?: CampaignProgress;
    scores?: HighScoreBoard;
    vibrateOn?: boolean;
    offerDifficulty?: boolean;
}

export function createOfficialSim(opts: CreateOfficialOptions): GameSim {
    const { data } = opts;
    const stats = data.stats;
    const weapons = data.weapons;
    const hireCost = (type: number): number => findWeapon(weapons, type, 1)?.price ?? 75;
    const speedFor = (type: number, _isEnemy: boolean): number => findWeapon(weapons, type, 1)?.speed ?? 1500;
    const finished = opts.progress?.finishedLevels() ?? [];
    const occupants = data.occupants.filter((occ) => {
        if (occ.spawnType !== 4) {
            return true;
        }
        // 赌场格要等赌徒解锁后才出现（解锁.tsv：出现关 41 或打完第 50 关）。
        return isUnitUnlocked(9, stats.level, finished, false);
    });
    const sim = new GameSim({
        maps: data.maps,
        occupants,
        rng: opts.rng,
        cash: stats.startGold,
        hireCost,
        speedFor,
        weapons,
        maxUpgrades: stats.upgradeCap,
        level: stats.level,
        chestCap: stats.chestCap,
        chestTime: stats.chestTime,
        chestOnFieldCap: stats.chestOnFieldCap,
        praiseUnit: stats.praiseUnit,
        maxLives: stats.leakLives,
        spawnPoolActions: data.spawnPoolActions,
        gamblerTime: stats.gamblerTime,
    });
    for (const unit of data.mapUnits) {
        // 未到出现关的可雇佣单位不放进战场（apk 的关卡过滤，避免第一关出现猎枪老人/纵火狂）。
        if (unit.activity === ACTIVITY_FOR_SALE && !isUnitUnlocked(unit.type, stats.level, finished, false)) {
            continue;
        }
        sim.addMapUnit(unit.col, unit.row, unit.type, unit.activity);
    }
    sim.bindSpecials();
    sim.groupMapVehicles();
    const wave1 = data.waves.find((row) => row.wave === 1);
    sim.attachEnemies({
        lives: stats.leakLives,
        difficulty: 1000,
        mode: MODE_NORMAL,
        levelHpEasy: stats.hpFactor,
        levelHpMid: stats.midHpFactor,
        levelHpHard: stats.hardHpFactor,
        waveHpFactor: wave1?.hpFactor ?? 70,
        waveSpeedFactor: wave1?.speedFactor ?? 100,
        vibrateOn: opts.vibrateOn,
    });
    if (opts.progress) {
        sim.progress = opts.progress;
    }
    if (opts.scores) {
        sim.scores = opts.scores;
    }
    sim.attachWaves({
        rows: data.waves,
        difficulty: 1000,
        level: stats.level,
        progress: sim.progress,
    });
    if (opts.saver) {
        sim.saver = opts.saver;
    }
    if (opts.offerDifficulty !== false) {
        sim.enableDifficultyPick();
    } else {
        sim.captureStartLayout();
    }
    return sim;
}

export function tickGame(sim: BattleSim, dtMs: number): void {
    sim.tick(dtMs);
}
