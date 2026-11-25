import { AssetManager } from 'cc';
import { loadBytes, loadBundle, loadText } from './AssetBytes';
import { MapGrid } from './MapData';
import { TsvTable } from './Tsv';

/** 启动时一次读完的数据表（规则表不在这里做成数值）。 */
const TABLE_FILES: ReadonlyArray<{ key: string; file: string }> = [
    { key: '单位数值', file: '单位数值' },
    { key: '敌军数值', file: '敌军数值' },
    { key: '关卡数值', file: '关卡数值' },
    { key: '出兵', file: '出兵' },
    { key: '出生池', file: '出生池' },
    { key: '出生池规则', file: '出生池规则' },
    { key: '解锁', file: '解锁' },
    { key: '难度', file: '难度' },
    { key: '赌徒', file: '赌徒' },
    { key: '赌徒牌面', file: '赌徒牌面' },
    { key: '音效对照', file: '音效对照' },
    { key: '动画', file: '动画' },
    { key: '朝向', file: '朝向' },
    { key: '地形图块', file: '地形图块' },
    { key: '地图字节', file: '地图字节' },
    { key: '关卡布置', file: '关卡布置' },
    { key: '地区音乐', file: '地区音乐' },
    { key: '尺寸_默认', file: '尺寸_默认' },
    { key: '颜色', file: 'color_default' },
];

export interface LevelStats {
    level: number;
    startGold?: number;
    leakLives?: number;
    chestCap?: number;
    chestTime?: number;
    upgradeCap?: number;
    praiseMin?: number;
    praiseUnit?: number;
    chestOnFieldCap?: number;
    hpFactor?: number;
    midHpFactor?: number;
    hardHpFactor?: number;
    /** 缺列或空单元格为 undefined，此时赌徒入口不可用。 */
    gamblerTime?: number;
}

export interface WaveSpawn {
    level: number;
    wave: number;
    waveText?: string;
    wait?: number;
    hpFactor?: number;
    speedFactor?: number;
    spawnPoint?: number;
    interval?: number;
    settler1?: number;
    settler2?: number;
    settler3?: number;
    settler4?: number;
    cavalry?: number;
    wagon?: number;
    stagecoach?: number;
    goldWagon?: number;
    boss?: number;
    doctor?: number;
}

export interface UnitStats {
    name: string;
    code?: number;
    level: number;
    speed?: number;
    price?: number;
    damageType?: number;
    damage?: number;
    range?: number;
    splash?: number;
    dot?: number;
    dotTime?: number;
    reload?: number;
    bulletSpeed?: number;
    specialReload?: number;
    specialRate?: number;
    damageStyle?: number;
    slowTime?: number;
    poisonTime?: number;
    poisonDamage?: number;
    rangeTiles?: number;
    splashTiles?: number;
}

export function canUseGambler(level: LevelStats | undefined): boolean {
    return level?.gamblerTime != null;
}

export class GameTables {
    static current: GameTables | null = null;

    readonly bundle: AssetManager.Bundle;
    readonly tables: Readonly<Record<string, TsvTable>>;
    readonly levels: ReadonlyMap<number, LevelStats>;
    readonly waves: readonly WaveSpawn[];
    readonly units: readonly UnitStats[];

    private constructor(
        bundle: AssetManager.Bundle,
        tables: Record<string, TsvTable>,
        levels: Map<number, LevelStats>,
        waves: WaveSpawn[],
        units: UnitStats[],
    ) {
        this.bundle = bundle;
        this.tables = tables;
        this.levels = levels;
        this.waves = waves;
        this.units = units;
    }

    static async load(): Promise<GameTables> {
        const bundle = await loadBundle('base');
        const tables: Record<string, TsvTable> = {};
        const failed: string[] = [];
        await Promise.all(
            TABLE_FILES.map(async ({ key, file }) => {
                const path = `data/tables/${file}`;
                try {
                    tables[key] = TsvTable.parse(key, await loadText(bundle, path));
                } catch (err) {
                    failed.push(file);
                    console.error('[Tables] 读表失败', path, err);
                }
            }),
        );
        if (failed.length > 0 && !tables['关卡数值']) {
            throw new Error(`[Tables] 必要表读取失败：${failed.join(', ')}`);
        }
        const levels = parseLevels(tables['关卡数值']);
        const waves = parseWaves(tables['出兵']);
        const units = parseUnits(tables['单位数值']);
        const loaded = new GameTables(bundle, tables, levels, waves, units);
        GameTables.current = loaded;
        return loaded;
    }

    table(name: string): TsvTable | undefined {
        return this.tables[name];
    }

    getLevel(level: number): LevelStats | undefined {
        return this.levels.get(level);
    }

    getWave(level: number, wave: number): WaveSpawn | undefined {
        return this.waves.find((row) => row.level === level && row.wave === wave);
    }

    getUnit(name: string, level: number): UnitStats | undefined {
        return this.units.find((row) => row.name === name && row.level === level);
    }

    async loadMap(mapName: string): Promise<MapGrid> {
        const path = mapName.startsWith('maps/') ? mapName : `maps/${mapName}`;
        // 地图资源是 .bin（buffer importer，运行时按 BufferAsset 读），加载路径不带扩展名。
        // 兼容旧调用里偶尔带后缀的写法；正常调用都传 td_map_NN。
        const stem = path.replace(/\.(tdm|bin)$/i, '');
        return MapGrid.parse(stem, await loadBytes(this.bundle, stem));
    }

    async logAcceptance(): Promise<void> {
        const lv = this.getLevel(1);
        console.log('[Tables] 第1关', {
            起始金钱: lv?.startGold,
            可漏人数: lv?.leakLives,
            宝箱上限: lv?.chestCap,
            升级上限: lv?.upgradeCap,
            中等血量系数: lv?.midHpFactor,
            赌徒时间: lv?.gamblerTime,
            赌徒可用: canUseGambler(lv),
        });

        const wave = this.getWave(1, 1);
        console.log('[Tables] 第1关第1波', {
            等待: wave?.wait,
            血量系数: wave?.hpFactor,
            速度系数: wave?.speedFactor,
            出生点: wave?.spawnPoint,
            间隔: wave?.interval,
            移民1人组: wave?.settler1,
            移民2人组: wave?.settler2,
            移民3人组: wave?.settler3,
            移民4人组: wave?.settler4,
        });

        const unit = this.getUnit('亡命之徒', 1);
        console.log('[Tables] 亡命之徒第1级', {
            装填: unit?.reload,
            特殊装填: unit?.specialReload,
            特殊装填频率: unit?.specialRate,
        });

        for (const n of [17, 18]) {
            const row = this.getLevel(n);
            console.log(`[Tables] 第${n}关`, {
                赌徒时间: row?.gamblerTime,
                赌徒可用: canUseGambler(row),
                缺赌徒时间列: row ? !this.tables['关卡数值']?.hasColumn('赌徒时间') || this.tables['关卡数值']?.num(this.tables['关卡数值'].find('关卡', n) ?? {}, '赌徒时间') === undefined : true,
            });
        }

        try {
            const map = await this.loadMap('td_map_01');
            console.log('[Tables] 第1关地图', `${map.cols}x${map.rows}`);
        } catch (err) {
            console.error('[Tables] 读地图失败', 'td_map_01', err);
        }
    }
}

function parseLevels(table?: TsvTable): Map<number, LevelStats> {
    const out = new Map<number, LevelStats>();
    if (!table) {
        return out;
    }
    for (const row of table.rows) {
        const level = table.num(row, '关卡');
        if (level === undefined) {
            continue;
        }
        out.set(level, {
            level,
            startGold: table.num(row, '起始金钱'),
            leakLives: table.num(row, '可漏人数'),
            chestCap: table.num(row, '宝箱上限'),
            chestTime: table.num(row, '宝箱时间'),
            upgradeCap: table.num(row, '升级上限'),
            praiseMin: table.num(row, '赞赏下限'),
            praiseUnit: table.num(row, '赞赏单位'),
            chestOnFieldCap: table.num(row, '场上宝箱上限'),
            hpFactor: table.num(row, '血量系数'),
            midHpFactor: table.num(row, '中等血量系数'),
            hardHpFactor: table.num(row, '困难血量系数'),
            gamblerTime: table.num(row, '赌徒时间'),
        });
    }
    return out;
}

function parseWaves(table?: TsvTable): WaveSpawn[] {
    if (!table) {
        return [];
    }
    const out: WaveSpawn[] = [];
    for (const row of table.rows) {
        const level = table.num(row, '关卡');
        const wave = table.num(row, '波次');
        if (level === undefined || wave === undefined) {
            continue;
        }
        out.push({
            level,
            wave,
            waveText: table.str(row, '波次文案'),
            wait: table.num(row, '等待'),
            hpFactor: table.num(row, '血量系数'),
            speedFactor: table.num(row, '速度系数'),
            spawnPoint: table.num(row, '出生点'),
            interval: table.num(row, '出兵间隔'),
            settler1: table.num(row, '移民1人组'),
            settler2: table.num(row, '移民2人组'),
            settler3: table.num(row, '移民3人组'),
            settler4: table.num(row, '移民4人组'),
            cavalry: table.num(row, '骑兵'),
            wagon: table.num(row, '篷车'),
            stagecoach: table.num(row, '驿马车'),
            goldWagon: table.num(row, '金车'),
            boss: table.num(row, '头目'),
            doctor: table.num(row, '医生'),
        });
    }
    return out;
}

function parseUnits(table?: TsvTable): UnitStats[] {
    if (!table) {
        return [];
    }
    const out: UnitStats[] = [];
    for (const row of table.rows) {
        const name = table.str(row, '单位');
        const level = table.num(row, '等级');
        if (!name || level === undefined) {
            continue;
        }
        out.push({
            name,
            code: table.num(row, '代码编号'),
            level,
            speed: table.num(row, '速度'),
            price: table.num(row, '价格'),
            damageType: table.num(row, '伤害类型'),
            damage: table.num(row, '伤害'),
            range: table.num(row, '射程'),
            splash: table.num(row, '溅射范围'),
            dot: table.num(row, '持续伤害'),
            dotTime: table.num(row, '持续伤害时间'),
            reload: table.num(row, '装填'),
            bulletSpeed: table.num(row, '弹速'),
            specialReload: table.num(row, '特殊装填时间'),
            specialRate: table.num(row, '特殊装填频率'),
            damageStyle: table.num(row, '伤害样式'),
            slowTime: table.num(row, '减速时间'),
            poisonTime: table.num(row, '毒持续时间'),
            poisonDamage: table.num(row, '毒伤害'),
            rangeTiles: table.num(row, '射程_格'),
            splashTiles: table.num(row, '溅射_格'),
        });
    }
    return out;
}
