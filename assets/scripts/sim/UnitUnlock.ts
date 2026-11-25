/**
 * 解锁表：出现关卡还没到，并且「通关后解锁」那一关还没打过，就不能用。
 * 表里没有的编号（含赌徒池里的 -1 赢钱、-2 什么都没有，以及 1–4 号）视为已解锁。
 */

export interface UnlockRow {
    type: number;
    appearLevel: number;
    finishLevel: number;
    name?: string;
}

/** 与 解锁.tsv 一致，自检和战斗都可以直接用，不必先读文件。 */
export const UNLOCK_ROWS: readonly UnlockRow[] = [
    { type: 6, appearLevel: 21, finishLevel: 30, name: '猎枪老人' },
    { type: 7, appearLevel: 21, finishLevel: 30, name: '炸药引爆器' },
    { type: 8, appearLevel: 21, finishLevel: 30, name: '炸药箱' },
    { type: 5, appearLevel: 31, finishLevel: 40, name: '女射手' },
    { type: 35, appearLevel: 41, finishLevel: 50, name: '纵火狂' },
    { type: 36, appearLevel: 51, finishLevel: 60, name: '蛇油商人' },
    { type: 9, appearLevel: 41, finishLevel: 50, name: '赌徒' },
];

const UNLOCK_BY_TYPE = new Map<number, UnlockRow>(UNLOCK_ROWS.map((row) => [row.type, row]));

export function parseUnlockTsv(text: string): UnlockRow[] {
    let src = text;
    if (src.charCodeAt(0) === 0xfeff) {
        src = src.slice(1);
    }
    const lines = src.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
    if (lines.length < 2) {
        return [];
    }
    const header = lines[0].split('\t');
    const iType = header.indexOf('编号');
    const iAppear = header.indexOf('出现关卡');
    const iFinish = header.indexOf('通关后解锁');
    const iName = header.indexOf('单位');
    const out: UnlockRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        const type = Number(cells[iType]);
        const appearLevel = Number(cells[iAppear]);
        const finishLevel = Number(cells[iFinish]);
        if (!Number.isFinite(type) || !Number.isFinite(appearLevel) || !Number.isFinite(finishLevel)) {
            continue;
        }
        const name = iName >= 0 ? (cells[iName] ?? '').trim() : '';
        const row: UnlockRow = { type, appearLevel, finishLevel };
        if (name) {
            row.name = name;
        }
        out.push(row);
    }
    return out;
}

export function isUnitUnlocked(
    type: number,
    currentLevel: number,
    finishedLevels: ReadonlySet<number> | readonly number[] = [],
    hasAllUnitsUnlock = false,
    rows: readonly UnlockRow[] = UNLOCK_ROWS,
): boolean {
    if (hasAllUnitsUnlock) {
        return true;
    }
    const table = rows === UNLOCK_ROWS ? UNLOCK_BY_TYPE : new Map(rows.map((r) => [r.type, r]));
    const row = table.get(type);
    if (!row) {
        return true;
    }
    const finished = finishedLevels instanceof Set
        ? finishedLevels
        : new Set(finishedLevels);
    if (row.appearLevel > currentLevel && !finished.has(row.finishLevel)) {
        return false;
    }
    return true;
}

/**
 * apk UserProfile.showLevelUnlockPopup 只在 unlockUnitData 第 3 列（文案 id）>= 0 时弹窗：
 * 炸药引爆器(7)、炸药箱(8)、赌徒(9) 三行是 -1，原版打完 30/50 关不弹这三种提示。
 */
const NO_UNLOCK_TIP_TYPES = new Set([7, 8, 9]);

/** 打完的全局关卡号等于「通关后解锁」时，给出这些单位的解锁提示。 */
export function unlockTipsForLevel(completedLevel: number, rows: readonly UnlockRow[] = UNLOCK_ROWS): UnlockRow[] {
    return rows.filter((row) => row.finishLevel === completedLevel && !NO_UNLOCK_TIP_TYPES.has(row.type));
}

