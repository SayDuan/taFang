/**
 * 雇佣、升级规则，以及升级箭头、木牌、价格数字的可测常量。
 * 不依赖 Cocos。
 */
import { ACTIVITY_FOR_SALE, ACTIVITY_GOING_TO_SLEEP, ACTIVITY_IDLE_WANDER } from './Fine';
import { WeaponStats } from './UnitDesign';
import { UnitEntity } from './UnitEntity';

export const DIALOG_HIRE_CONFIRM = 2;
export const DIALOG_NO_MONEY = 3;
export const DIALOG_UPGRADE_CONFIRM = 7;

export type ShopDialog = 'none' | 'hire-confirm' | 'no-money' | 'upgrade-confirm' | 'dynamite-not-ready' | 'gamble-not-ready' | 'gamble-confirm' | 'gamble-no-money' | 'gamble-cards';

export const HUD_FONT_NUMBERS = 'hud_font_numbers';
export const HUD_FONT_DOLLAR = 'hud_font_dollar';
export const PRICE_NUMBER_CELLS = 10;
export const PRICE_DOLLAR_CELLS = 2;

export const HUD_UPGRADE_ARROW = ['hud_upgrade_arrow_1', 'hud_upgrade_arrow_2', 'hud_upgrade_arrow_3'] as const;
export const UPGRADE_ARROW_FRAMES = 3;
export const UPGRADE_ARROW_FRAME_MS = 100;
export const UPGRADE_ARROW_ORDER = [0, 1, 2, 1] as const;

/**
 * apk GameObjectUnit.draw L974-976：dst 从 (posRoundedX - w*f, posRoundedY - h*f)
 * 到 (posRoundedX, posRoundedY)，即箭头右下角贴单位中心 X / 脚底 Y。
 * 项目世界坐标 Y 向上，Cocos 锚点 (1,0) = 右下角贴节点原点（单位脚底）。
 */
export const UPGRADE_ARROW_FOOT_ANCHOR_X = 1;
export const UPGRADE_ARROW_FOOT_ANCHOR_Y = 0;
/**
 * apk TrainHorizontal.drawWeapon L148-152（22/32 同）：箭头以炮塔中心为中心，
 * 再偏移 ((scale*3)/2, (scale*2)/2) * mScalingFactor 屏幕像素。
 * realTilesize = 32*mScalingFactor，换算到项目 TILE=32 逻辑像素恰好是 (9, 6)，与缩放无关。
 * apk Y 向下 +6，项目 Y 向上因此取 -6。
 */
export const UPGRADE_ARROW_GATLING_ANCHOR_X = 0.5;
export const UPGRADE_ARROW_GATLING_ANCHOR_Y = 0.5;
export const UPGRADE_ARROW_GATLING_OFFSET_X = 9;
export const UPGRADE_ARROW_GATLING_OFFSET_Y = -6;

export const HUD_WOODEN_SIGN = 'hud_wooden_sign_left';
export const HUD_WOODEN_SIGN_RIGHT = 'hud_wooden_sign_right';
export const HUD_UPGRADE_ICON = 'upgrade_icon';
export const UPGRADE_SIGN_ROTATE_MS = 800;
/**
 * signal_rotate_in_left：fromDegrees=-180→0。Android 正角是顺指针（屏幕 y 向下），
 * Cocos 正角是逆时针，所以同一视觉摆动在 Cocos 里取反 = +180→0。
 * 右侧倒计时的 signal_rotate_in_right（+180→0）因此对应 Cocos 的 -180→0。
 */
export const UPGRADE_SIGN_FROM_DEG = 180;
export const UPGRADE_SIGN_TO_DEG = 0;
export const UPGRADE_SIGN_PIVOT_X = 0.5;
export const UPGRADE_SIGN_PIVOT_Y = 1.3;
/** 图标相对木牌中心再往下 3 个缩放像素。 */
export const UPGRADE_SIGN_ICON_OFFSET_Y = -3;
/** GunsAndGloryThread.resetHUDLayout：命中框 = hud_wooden_sign_left 原图 60×54，不是放大框。 */
export const UPGRADE_SIGN_WIDTH = 60;
export const UPGRADE_SIGN_HEIGHT = 54;
/** Android AccelerateDecelerateInterpolator.getInterpolation：cos((t+1)*PI)/2 + 0.5。 */
export function accelerateDecelerate(t: number): number {
    let x = t;
    if (x < 0) {
        x = 0;
    } else if (x > 1) {
        x = 1;
    }
    return Math.cos((x + 1) * Math.PI) / 2 + 0.5;
}

export function isHireableActivity(activity: number): boolean {
    return activity === ACTIVITY_FOR_SALE
        || activity === ACTIVITY_IDLE_WANDER
        || activity === ACTIVITY_GOING_TO_SLEEP;
}

export function hirePriceOf(stats: WeaponStats | undefined, fallback: number): number {
    return stats?.price ?? fallback;
}

/**
 * 已升级次数（upgradeLevel 从 1 起算）必须低于关卡升级上限，
 * 且必须还有下一行。
 */
export function isUpgradePossible(
    upgradeLevel: number,
    maxUpgrades: number,
    hasNextRow: boolean,
): boolean {
    if (!hasNextRow) {
        return false;
    }
    return (upgradeLevel - 1) < maxUpgrades;
}

export function nextUpgradeLevel(upgradeLevel: number): number {
    return (upgradeLevel ?? 1) + 1;
}

/**
 * 复合单位中只有带武器槽的 12/22/32 会在 drawWeapon() 里画升级箭头；
 * 10/11/20/21/30/31/33 的 GameObjectCompoundUnit.draw() 覆盖了基类，不调 super.draw()，
 * 也没有 weapon slot，因此原版这些单位永远不画脚下箭头。
 */
export function hasUpgradeArrow(type: number, activity: number): boolean {
    if (type === 12 || type === 22 || type === 32) {
        // apk GameObjectCompoundUnit.draw L42：activityStatus > 4 才会进入 drawWeapon()。
        return activity > 4;
    }
    if ((type >= 10 && type <= 12) || (type >= 20 && type <= 22) || (type >= 30 && type <= 33)) {
        return false;
    }
    return true;
}

export function isGatlingUpgradeArrow(type: number): boolean {
    return type === 12 || type === 22 || type === 32;
}

export function shouldDrawUpgradeArrow(upgradeLevel: number, activity: number, type?: number): boolean {
    if ((upgradeLevel ?? 1) <= 1) {
        return false;
    }
    // apk GameObjectUnit.draw L924：仅 activityStatus==4 提前 return；原版 3 仍会画箭头。
    if (activity === ACTIVITY_FOR_SALE) {
        return false;
    }
    if (type !== undefined && !hasUpgradeArrow(type, activity)) {
        return false;
    }
    return true;
}

/** 已经升过 1/2/3 级时分别用 arrow_1/2/3。 */
export function upgradeArrowFile(upgradeLevel: number): string | null {
    const n = (upgradeLevel ?? 1) - 1;
    if (n < 1) {
        return null;
    }
    return HUD_UPGRADE_ARROW[Math.min(n, 3) - 1];
}

/**
 * 帧号是（当前毫秒 ÷ 100）除以 4 的余数，余数是 3 时改画第 1 帧。
 * 顺序 0、1、2、1。
 */
export function upgradeArrowFrame(elapsedMs: number): number {
    const r = Math.trunc(Math.trunc(elapsedMs) / UPGRADE_ARROW_FRAME_MS) % 4;
    return r === 3 ? 1 : r;
}

export function upgradeSignAngle(progress01: number, hiding: boolean): number {
    // showUpgradeSign/hideUpgradeSign 都 setInterpolator(AccelerateDecelerateInterpolator)。
    const t = accelerateDecelerate(progress01);
    if (hiding) {
        return UPGRADE_SIGN_TO_DEG + (UPGRADE_SIGN_FROM_DEG - UPGRADE_SIGN_TO_DEG) * t;
    }
    return UPGRADE_SIGN_FROM_DEG + (UPGRADE_SIGN_TO_DEG - UPGRADE_SIGN_FROM_DEG) * t;
}

export function upgradeSignProgress(elapsedMs: number, durationMs = UPGRADE_SIGN_ROTATE_MS): number {
    if (durationMs <= 0) {
        return 1;
    }
    const t = elapsedMs / durationMs;
    if (t < 0) {
        return 0;
    }
    if (t > 1) {
        return 1;
    }
    return t;
}

export function priceDigitCell(digit: number | string): number | null {
    const n = typeof digit === 'number' ? digit : Number.parseInt(String(digit), 10);
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
}

export type PriceGlyph = { kind: 'dollar'; cell: number } | { kind: 'digit'; cell: number };

/** 雇人价格：$ + 十进制数字。美元用 hud_font_dollar 第 0 格，数字用 hud_font_numbers 第 0–9 格。 */
export function priceGlyphs(amount: number, dollarCell = 0): PriceGlyph[] {
    const out: PriceGlyph[] = [{ kind: 'dollar', cell: dollarCell }];
    const raw = String(Math.trunc(Math.abs(amount)));
    for (const ch of raw) {
        const cell = priceDigitCell(ch);
        if (cell !== null) {
            out.push({ kind: 'digit', cell });
        }
    }
    return out;
}

export function unitRowPrice(
    weaponFor: (type: number, level: number) => WeaponStats | undefined,
    unit: Pick<UnitEntity, 'type' | 'upgradeLevel'>,
    fallback = 0,
): number {
    return weaponFor(unit.type, unit.upgradeLevel ?? 1)?.price ?? fallback;
}

export function upgradeRowPrice(
    weaponFor: (type: number, level: number) => WeaponStats | undefined,
    unit: Pick<UnitEntity, 'type' | 'upgradeLevel'>,
): number | undefined {
    return weaponFor(unit.type, nextUpgradeLevel(unit.upgradeLevel ?? 1))?.price;
}

/** dialog_upgrade.xml 里 ask_for_upgrade_dialog_heading2 的固定文案（T_IA_UNIT_IMPROVES）。 */
export const UPGRADE_IMPROVES_HEADING = '升级提高：';

/** GameObjectUnit.getUpgradeText：钱够时按单位编号取 T_UNIT_UPGRADE_xx，5 号取 08、6 号取 07。 */
const UPGRADE_TEXT_PAID: Record<number, string> = {
    1: '没有更好的弹药给我了么？左轮手枪可应付不了下一轮攻击',
    2: '廉价的炸药只会产生一个小爆炸。强大的炸药能产生巨大的余波！',
    3: '头儿，这就是你要的重型加农炮！我们有了一个重型加农炮！',
    4: '给部落勇士配上强弓燃烧的箭，他能把移民射到大洋那边去！',
    5: '如果你要去的话，我能找到一个新地方',
    6: '我的猎枪塞满了新鲜的胡椒粉',
    12: '想让他们尝到更多苦头？没问题，让我给你创造一个真正的屠杀武器！',
    22: '想让他们尝到更多苦头？没问题，让我给你创造一个真正的屠杀武器！',
    32: '强化的加农炮真的太给力了',
    35: '要看更大的烟花，给钱吧！',
    36: '我当然可以酿造更多这样的环保材料, 但这可都是要钱的！',
};

/** 钱不够走同一个 switch 的下半段，取 T_UNIT_CANNOT_UPGRADE_xx。 */
const UPGRADE_TEXT_UNPAID: Record<number, string> = {
    1: '我们现在支付不起一个新的左轮枪手。',
    2: '没钱买更好的炸药？这简直是耻辱啊，头儿！',
    3: '视野里看不到有新的加农炮，或许我应该先刷层新漆。',
    4: '不开火的话你的钱甚至连水都买不起。',
    5: '想要更多，就付更多的钱吧！',
    6: '我古老的猎枪已经用了60年，但它依然还能够继续使用',
    12: '加特林的新部件可是价格不菲。',
    22: '加特林的新部件可是价格不菲。',
    32: '我们的金子可支付不起这个加农炮的弹药了！',
    35: '更强的火箭炮没有钱可买不来！',
    36: '很不幸，我丢失了那份最重要的美元清单',
};

export function upgradeFlavorText(type: number, canAfford: boolean): string {
    const table = canAfford ? UPGRADE_TEXT_PAID : UPGRADE_TEXT_UNPAID;
    return table[type] ?? '';
}

/**
 * apk GameScreenActivity case 7 L517-587：拿本级和下一级两行数逐列比。
 * 顺序固定是速度、伤害、射程、第 6 列、第 7 列、第 5 列、装填、特殊装填、毒、减速；
 * 第 5、6 列原版都印成「破坏区域」，装填和特殊装填要数值变小才算改进。
 */
export function upgradeImprovementLines(
    current: WeaponStats | undefined,
    next: WeaponStats | undefined,
): string[] {
    if (!current || !next) {
        return [];
    }
    const out: string[] = [];
    const add = (label: string): void => {
        out.push(`+ ${label}`);
    };
    if (next.speed > current.speed) {
        add('速度');
    }
    if (next.damage > current.damage) {
        add('伤害');
    }
    if (next.range > current.range) {
        add('范围');
    }
    if (next.dot > current.dot) {
        add('破坏区域');
    }
    if (next.dotTime > current.dotTime) {
        add('持续燃烧');
    }
    if (next.splash > current.splash) {
        add('破坏区域');
    }
    if (next.reload < current.reload) {
        add('火力范围');
    }
    if (next.specialReload < current.specialReload) {
        add('装弹速度');
    }
    if (next.poisonTime > current.poisonTime || next.poisonDamage > current.poisonDamage) {
        add('毒药');
    }
    if (next.slowTime > current.slowTime) {
        add('减速效果');
    }
    return out;
}
