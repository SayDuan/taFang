import { FINE_PER_TILE, TILE_PIXELS } from './Fine';

/** 与 GameTables.UnitStats 以及单位数值表列一致，不依赖 Cocos。 */
export interface WeaponStats {
    name: string;
    code?: number;
    codes: number[];
    level: number;
    speed: number;
    price: number;
    damageType: number;
    damage: number;
    range: number;
    splash: number;
    dot: number;
    dotTime: number;
    reload: number;
    bulletSpeed: number;
    specialReload: number;
    specialRate: number;
    damageStyle: number;
    slowTime: number;
    poisonTime: number;
    poisonDamage: number;
    rangeTiles?: number;
    splashTiles?: number;
}

export interface EnemyDesign {
    type: number;
    name: string;
    speed: number;
    hp: number;
    bounty: number;
    /** 轻武器、火焰、重武器、毒。 */
    pierce: [number, number, number, number];
}

const UNIT_COLS = [
    '单位', '代码编号', '等级', '速度', '价格', '伤害类型', '伤害', '射程', '溅射范围',
    '持续伤害', '持续伤害时间', '装填', '弹速', '特殊装填时间', '特殊装填频率',
    '伤害样式', '减速时间', '毒持续时间', '毒伤害', '射程_格', '溅射_格',
] as const;

function splitTsvLine(line: string): string[] {
    return line.split('\t');
}

function num(cells: string[], header: string[], name: string): number {
    const i = header.indexOf(name);
    if (i < 0) {
        return 0;
    }
    const v = Number(cells[i]);
    return Number.isFinite(v) ? v : 0;
}

function str(cells: string[], header: string[], name: string): string {
    const i = header.indexOf(name);
    return i >= 0 ? (cells[i] ?? '').trim() : '';
}

export function parseCodes(raw: string): number[] {
    return raw
        .split(/[、,，/]/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n));
}

export function parseUnitStatsTsv(text: string): WeaponStats[] {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
        return [];
    }
    const header = splitTsvLine(lines[0]);
    const out: WeaponStats[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitTsvLine(lines[i]);
        const name = str(cells, header, '单位');
        const level = num(cells, header, '等级');
        if (!name || !level) {
            continue;
        }
        const codes = parseCodes(str(cells, header, '代码编号'));
        out.push({
            name,
            code: codes[0],
            codes,
            level,
            speed: num(cells, header, '速度'),
            price: num(cells, header, '价格'),
            damageType: num(cells, header, '伤害类型'),
            damage: num(cells, header, '伤害'),
            range: num(cells, header, '射程'),
            splash: num(cells, header, '溅射范围'),
            dot: num(cells, header, '持续伤害'),
            dotTime: num(cells, header, '持续伤害时间'),
            reload: num(cells, header, '装填'),
            bulletSpeed: num(cells, header, '弹速'),
            specialReload: num(cells, header, '特殊装填时间'),
            specialRate: num(cells, header, '特殊装填频率'),
            damageStyle: num(cells, header, '伤害样式'),
            slowTime: num(cells, header, '减速时间'),
            poisonTime: num(cells, header, '毒持续时间'),
            poisonDamage: num(cells, header, '毒伤害'),
            rangeTiles: num(cells, header, '射程_格'),
            splashTiles: num(cells, header, '溅射_格'),
        });
    }
    void UNIT_COLS;
    return out;
}

export function parseEnemyDesignTsv(text: string): EnemyDesign[] {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
        return [];
    }
    const header = splitTsvLine(lines[0]);
    const out: EnemyDesign[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitTsvLine(lines[i]);
        const type = num(cells, header, '类型编号');
        if (!type) {
            continue;
        }
        out.push({
            type,
            name: str(cells, header, '敌人'),
            speed: num(cells, header, '速度'),
            hp: num(cells, header, '血量'),
            bounty: num(cells, header, '赏金'),
            pierce: [
                num(cells, header, '轻武器穿透'),
                num(cells, header, '火焰穿透'),
                num(cells, header, '重武器穿透'),
                num(cells, header, '毒穿透'),
            ],
        });
    }
    return out;
}

export function normalizeWeapon(row: Partial<WeaponStats> & { name: string; level: number }): WeaponStats {
    const codes = row.codes ?? (row.code != null ? [row.code] : []);
    return {
        name: row.name,
        code: row.code ?? codes[0],
        codes,
        level: row.level,
        speed: row.speed ?? 0,
        price: row.price ?? 0,
        damageType: row.damageType ?? 0,
        damage: row.damage ?? 0,
        range: row.range ?? 0,
        splash: row.splash ?? 0,
        dot: row.dot ?? 0,
        dotTime: row.dotTime ?? 0,
        reload: row.reload ?? 0,
        bulletSpeed: row.bulletSpeed ?? 0,
        specialReload: row.specialReload ?? 0,
        specialRate: row.specialRate ?? 0,
        damageStyle: row.damageStyle ?? 0,
        slowTime: row.slowTime ?? 0,
        poisonTime: row.poisonTime ?? 0,
        poisonDamage: row.poisonDamage ?? 0,
        rangeTiles: row.rangeTiles,
        splashTiles: row.splashTiles,
    };
}

export function findWeapon(list: readonly WeaponStats[], type: number, level = 1): WeaponStats | undefined {
    const row = list.find((u) => u.level === level && (u.codes.includes(type) || u.code === type));
    return row;
}

/** 射程平方：表里的射程（fine）× 10 ÷ 7680，再平方。一格是 10。 */
export function maxSquareRangeOf(rangeFine: number): number {
    const units = Math.trunc((rangeFine * 10) / FINE_PER_TILE);
    return units * units;
}

export function aoeSquareRangeOf(aoeFine: number): number {
    const units = Math.trunc((aoeFine * 10) / FINE_PER_TILE);
    return units * units;
}

/** 距离单位：10 表示一格。对两个 fine 坐标做整数换算后再平方。 */
export function combatDistSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.trunc((ax * 10) / FINE_PER_TILE) - Math.trunc((bx * 10) / FINE_PER_TILE);
    const dy = Math.trunc((ay * 10) / FINE_PER_TILE) - Math.trunc((by * 10) / FINE_PER_TILE);
    return dx * dx + dy * dy;
}

/**
 * 画圆半径（像素）= sqrt(射程平方) / 10 * 瓦片像素。
 * 不先取整。奖励 4 时用 sqrt(射程平方 × 1.5)。
 */
export function rangeCircleRadiusPx(rangeSq: number, bonusAttribute = -1, tilePx = TILE_PIXELS): number {
    const under = bonusAttribute === 4 ? rangeSq * 1.5 : rangeSq;
    return Math.sqrt(Math.max(0, under)) / 10 * tilePx;
}

export function hasBurningAmmo(stats: WeaponStats | null | undefined): boolean {
    return !!stats && stats.dot > 0;
}

export const POISON_DELAY_MS = 250;
export const MIN_SHOOT_DIST_SQ = 50;
/**
 * 开枪动作持续时间，取自 动画.tsv。时间轴最后一项就是动作总时长。
 * 到期后单位回到走路/待机图；中途开始移动也会被打断。
 */
export const SHOOT_ANIM_MS: Record<number, number> = {
    1: 1000,
    2: 400,
    3: 200,
    4: 1500,
    5: 1500,
    6: 1500,
    12: 100,
    22: 100,
    35: 1500,
    36: 1500,
};

/** 表里没有的单位走 GameDesignOptics.animationShootNone = {0,100}，蒸汽船双炮（32）就是这一档。 */
export function shootAnimMs(type: number): number {
    return SHOOT_ANIM_MS[type] ?? 100;
}
export const PRIO_CLICK_DIST_SQ = 64;
export const KILL_WEIGHT: Record<number, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 6,
    5: 8,
    6: 10,
    7: 15,
    8: 1,
    9: 1,
};

export function killWeight(type: number): number {
    return KILL_WEIGHT[type] ?? 1;
}
