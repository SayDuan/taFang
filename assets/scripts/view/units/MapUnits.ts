/** 从地图字节收出待售和已放好的己方单位。火车和船仍由第 6 步的物件层画，这里不再收一遍。 */

import { ACTIVITY_FOR_SALE, ACTIVITY_WORKING, UNIT_VISUAL, visualFor } from './UnitCatalog';

export interface MapUnit {
    col: number;
    row: number;
    type: number;
    activity: number;
    isEnemy: boolean;
    name: string;
}

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
    return null;
}

export function collectMapUnits(cols: number, rows: number, raw: Uint8Array | number[]): MapUnit[] {
    const units: MapUnit[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const found = unitTypeFromByte(raw[row * cols + col]);
            if (!found) {
                continue;
            }
            const vis = visualFor(found.type, false);
            units.push({
                col,
                row,
                type: found.type,
                activity: found.activity,
                isEnemy: false,
                name: vis?.name ?? `单位${found.type}`,
            });
        }
    }
    units.sort((a, b) => a.row - b.row || a.col - b.col);
    return units;
}

export function logStep7Acceptance(
    level: number,
    cols: number,
    rows: number,
    raw: Uint8Array | number[],
    units: MapUnit[],
): void {
    if (level !== 1) {
        console.log(`[Units] 第${level}关地图单位 ${units.length} 个`, units.map((u) => `${u.name}@${u.col},${u.row} 状态${u.activity}`));
        return;
    }
    const at = (col: number, row: number) => raw[row * cols + col];
    const sale = units.filter((u) => u.activity === ACTIVITY_FOR_SALE);
    const g = sale.find((u) => u.col === 6 && u.row === 16);
    const p = sale.find((u) => u.col === 11 && u.row === 16);
    const m = sale.find((u) => u.col === 13 && u.row === 16);
    const bush = at(14, 16);
    console.log(
        `[Units] 第1关待售 ${sale.length} 个：` +
        `第16行第6列 ${g ? g.name : '缺失'}，` +
        `第11列 ${p ? p.name : '缺失'}，` +
        `第13列 ${m ? m.name : '缺失'}；` +
        `第14列字节 ${bush}（76 是草，帽子不应画在这一格）`,
    );
    if (UNIT_VISUAL[1]) {
        console.log('[Units] 亡命之徒往下走用第 3 行，往右走用第 1 行并左右翻转；篷车西转南用 wagon_turn 第 0 帧持续 200 毫秒；男移民拐弯不换图');
    }
}
