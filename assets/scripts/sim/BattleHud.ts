/**
 * 第 19 步战斗界面纯函数：星星、拇指底栏、准星、选中光标、小地图颜色和镜头框。
 * 不依赖 Cocos，自检可直接引用。数值以 Java / 画面.tsv 为准。
 */
import { ENEMY_STATS } from './EnemyCatalog';
import { ACTIVITY_WORKING } from './Fine';

/** 敌人图标顺序：移民、骑兵、篷车、驿马车、金车、头目、医生。 */
export const ENEMY_ICON_ORDER = ['移民', '骑兵', '篷车', '驿马车', '金车', '头目', '医生'] as const;

/** 组下标对应的单位类型编号，与 WaveManager.translationTableGroupToUnit 一致。 */
export const ENEMY_GROUP_UNIT_TYPES = [1, 3, 4, 5, 6, 7, 9];

/** 单位类型 → 组。女移民和男移民都是 0，马是 -1。 */
export const UNIT_TYPE_TO_ENEMY_GROUP = [-1, 0, 0, 1, 2, 3, 4, 5, -1, 6];

export const THUMB_UPRIGHT = 0;
export const THUMB_INVERTED = 1;
export const ENEMY_ICON_BASE = 16;
export const PIERCE_THUMB_UP = 70;
export const PIERCE_THUMB_DOWN = 35;

export const HUD_TOP = 'gng_hud_0_top';
export const HUD_TOP_LEFT = 'gng_hud_0_top_left';
export const HUD_TOP_RIGHT = 'gng_hud_0_top_right';
export const HUD_PAUSE = 'gng_hud_1_top_pause';
export const HUD_PAUSE_PRESSED = 'gng_hud_1_top_pause_pressed';
/**
 * SheriffStarWidget.java L76-77：先整张画 _0 当底，再把彩色星的下半截盖上去。
 * 漏掉的命越多，那条彩色越往上涨；满命时下沿裁剪框等于星高，第二张不画。
 */
export const HUD_STAR_FULL = 'gng_hud_1_top_star_0';
export const HUD_STAR_COVER = 'gng_hud_1_top_star';
export const HUD_FONT_NUMBERS_SCALED = 'hud_font_numbers_scaled';
export const HUD_BOTTOM = 'hud_bottom';
export const HUD_ICONS_THUMBS = 'icons_thumbs';
export const HUD_ICONS_ENEMIES = 'icons_enemies';
export const HUD_CURSOR = 'cursor';
export const HUD_SELECTOR = 'selector';
export const HUD_CROSSHAIR = 'hud_crosshair';

/** cursor 四角帧：左上、右上、左下、右下。 */
export const CURSOR_FRAME_ORDER = [0, 1, 2, 3] as const;
/** selector 四角帧围法：左上、右上、右下、左下。 */
export const SELECTOR_FRAME_ORDER = [0, 1, 3, 2] as const;
/** hud_crosshair 四格：上、下、左、右。 */
export const CROSSHAIR_FRAME_ORDER = [0, 1, 2, 3] as const;

export const CROSSHAIR_MIN = 0;
export const CROSSHAIR_MAX = 20;
export const CROSSHAIR_BOUNCE_HIGH = 18;
export const CROSSHAIR_BOUNCE_LOW = 2;
/** Java：animator += direction * ((dt / 50) % 10) */
export const CROSSHAIR_STEP_DIVISOR = 50;
export const CROSSHAIR_STEP_MOD = 10;

export const CURSOR_ANGLE_STEP = 5;

export const MINIMAP_DRAG_SCALE = 8;
export const FINE_PER_TILE = 7680;
export const TILE_PIXELS = 32;

/** 画面表 / color_default 里的小地图色，含 alpha。 */
export const MINIMAP_COLOR_DESERT = 0xfffbd19f;
export const MINIMAP_COLOR_CANYON = 0xffbc8156;
export const MINIMAP_COLOR_WATER = 0xff609db3;
export const MINIMAP_COLOR_ICE = 0xff8bcfe5;
export const MINIMAP_COLOR_STREET = 0xfff2b780;
/** Java 未匹配到分类时的默认底色 14401188，补上不透明。 */
export const MINIMAP_COLOR_DEFAULT = 0xffdbb424;
export const MINIMAP_COLOR_ENEMY = 0xffffffff;
export const MINIMAP_COLOR_FRIENDLY_IDLE = 0xff000000;
export const MINIMAP_COLOR_FRIENDLY_SHOOTING = 0xffff0000;

export type ThumbKind = 'upright' | 'inverted' | 'none';

export function unitTypeToEnemyGroup(type: number): number {
    if (type < 0 || type >= UNIT_TYPE_TO_ENEMY_GROUP.length) {
        return -1;
    }
    return UNIT_TYPE_TO_ENEMY_GROUP[type];
}

/**
 * 星星第二张图的裁剪。Java：
 * srcTop = (int)(starHeight + ((lives - maxLives) / maxLives) * starHeight)
 * 即从「剩余比例」那一行往下盖住失去的命。满命时 top == height，第二张不画。
 */
export function starOverlayClip(lives: number, maxLives: number, starHeight: number): {
    srcTop: number;
    srcBottom: number;
    coverHeight: number;
    coverRatio: number;
    draw: boolean;
} {
    if (starHeight <= 0 || maxLives <= 0) {
        return { srcTop: 0, srcBottom: 0, coverHeight: 0, coverRatio: 0, draw: false };
    }
    const srcTop = Math.trunc(starHeight + ((lives - maxLives) / maxLives) * starHeight);
    const srcBottom = starHeight;
    const coverHeight = srcBottom - srcTop;
    const coverRatio = 1 - lives / maxLives;
    return {
        srcTop,
        srcBottom,
        coverHeight,
        coverRatio,
        draw: coverHeight > 0 && srcTop < starHeight,
    };
}

export function thumbForPierce(pierce: number): ThumbKind {
    if (pierce >= PIERCE_THUMB_UP) {
        return 'upright';
    }
    if (pierce < PIERCE_THUMB_DOWN) {
        return 'inverted';
    }
    return 'none';
}

export function enemyGroupPierce(group: number, damageType: number): number {
    const unitType = ENEMY_GROUP_UNIT_TYPES[group];
    const stats = unitType != null ? ENEMY_STATS[unitType] : undefined;
    if (!stats) {
        return 0;
    }
    return stats.pierce[damageType] ?? 0;
}

/**
 * 底栏图标序列。0 竖拇指，1 倒拇指，16+组下标是敌人。
 * 先收集「还会出现且穿透≥70」的竖拇指组，再收集「还会出现且穿透<35」的倒拇指组。
 * 35 到 69 不放。顺序按移民→医生。
 */
export function bottomBarIcons(
    damageType: number,
    available: readonly boolean[],
    pierceOf: (group: number) => number = (g) => enemyGroupPierce(g, damageType),
): number[] {
    const hasHigh = [false, false];
    for (let g = 0; g < 7; g++) {
        if (!available[g]) {
            continue;
        }
        const pierce = pierceOf(g);
        if (pierce >= PIERCE_THUMB_UP) {
            hasHigh[0] = true;
        }
        if (pierce < PIERCE_THUMB_DOWN) {
            hasHigh[1] = true;
        }
    }
    const icons: number[] = [];
    for (let thumb = 0; thumb < 2; thumb++) {
        if (!hasHigh[thumb]) {
            continue;
        }
        icons.push(thumb);
        for (let g = 0; g < 7; g++) {
            if (!available[g]) {
                continue;
            }
            const pierce = pierceOf(g);
            if ((pierce >= PIERCE_THUMB_UP && thumb === 0) || (pierce < PIERCE_THUMB_DOWN && thumb === 1)) {
                icons.push(ENEMY_ICON_BASE + g);
            }
        }
    }
    return icons;
}

export function iconIsThumb(icon: number): boolean {
    return icon === THUMB_UPRIGHT || icon === THUMB_INVERTED;
}

export function iconEnemyGroup(icon: number): number {
    return icon - ENEMY_ICON_BASE;
}

export interface CrosshairState {
    offset: number;
    direction: number;
}

export function createCrosshair(offset = 0, direction = 1): CrosshairState {
    return { offset, direction };
}

function clampDt(dtMs: number): number {
    if (dtMs < 0) {
        return 0;
    }
    if (dtMs > 100) {
        return 100;
    }
    return dtMs;
}

/**
 * 准星张合。未暂停且 dt>0 时：offset += direction * ((dt / 50) % 10)。
 * 到 20 改成 18 并往回收，到 0 改成 2 并往外张。暂停或 dt 为 0 时停住。
 */
export function tickCrosshair(state: CrosshairState, dtMs: number, frozen: boolean): CrosshairState {
    if (frozen || dtMs <= 0) {
        return { offset: state.offset, direction: state.direction };
    }
    const dt = clampDt(dtMs);
    let offset = state.offset + state.direction * ((dt / CROSSHAIR_STEP_DIVISOR) % CROSSHAIR_STEP_MOD);
    let direction = state.direction;
    if (offset >= CROSSHAIR_MAX && direction > 0) {
        direction = -direction;
        offset = CROSSHAIR_BOUNCE_HIGH;
    } else if (offset <= CROSSHAIR_MIN && direction < 0) {
        offset = CROSSHAIR_BOUNCE_LOW;
        direction = -direction;
    }
    return { offset, direction };
}

export function tickCursorAngle(angle: number, selected: boolean): number {
    if (selected) {
        let next = angle + CURSOR_ANGLE_STEP;
        if (next >= 360) {
            next -= 360;
        }
        return next;
    }
    if (angle > 0) {
        if (angle >= 180) {
            angle -= 180;
        }
        angle += CURSOR_ANGLE_STEP;
        if (angle >= 180) {
            return 0;
        }
        return angle;
    }
    return angle;
}

/** 角离人的距离 = 半个角宽 ×（1 + |sin(角度)|），角度按度数。 */
export function cursorCornerDistance(cornerWidth: number, angleDeg: number): number {
    const half = cornerWidth / 2;
    const rad = (angleDeg * Math.PI) / 180;
    return half * (1 + Math.abs(Math.sin(rad)));
}

/**
 * 四个角相对中心的偏移。cursor：左上、右上、左下、右下。
 * selector 用同一套距离，只是贴图帧序不同。
 */
export function cursorCornerOffsets(distance: number): { x: number; y: number }[] {
    return [
        { x: -distance, y: distance },
        { x: distance, y: distance },
        { x: -distance, y: -distance },
        { x: distance, y: -distance },
    ];
}

export function shouldShowSelector(opts: { touchMode: boolean; hovered: boolean; isHorse: boolean }): boolean {
    return !opts.touchMode && opts.hovered && !opts.isHorse;
}

export function cursorShouldDraw(state: number): boolean {
    return state !== 1 && state !== 4;
}

/** 状态 2 淡出（每次 ×0.8，到 10 以下藏起），状态 3 淡入（每次 ×1.2，到 255 停）。 */
export function tickCursorFade(state: number, alpha: number): { state: number; alpha: number } {
    if (state === 2) {
        let next = Math.trunc((alpha * 80) / 100);
        if (next <= 10) {
            return { state: 1, alpha: 0 };
        }
        return { state, alpha: next };
    }
    if (state === 3) {
        let next = Math.trunc((alpha * 120) / 100);
        if (next < 10) {
            next = 10;
        }
        if (next >= 255) {
            return { state: 0, alpha: 255 };
        }
        return { state, alpha: next };
    }
    return { state, alpha };
}

export function minimapTileColor(background: number, street: number): number {
    if (street > 0) {
        return MINIMAP_COLOR_STREET;
    }
    const bg = background;
    if (bg === 0 || (bg >= 17 && bg <= 35)) {
        return MINIMAP_COLOR_DESERT;
    }
    if (bg >= 48 && bg < 96) {
        return MINIMAP_COLOR_CANYON;
    }
    if (bg === 96) {
        return MINIMAP_COLOR_WATER;
    }
    if ((bg > 96 && bg < 128) || (bg >= 160 && bg < 164)) {
        return MINIMAP_COLOR_ICE;
    }
    return MINIMAP_COLOR_DEFAULT;
}

export function minimapUnitColor(kind: 'enemy' | 'friendly', activity?: number): number {
    if (kind === 'enemy') {
        return MINIMAP_COLOR_ENEMY;
    }
    if (activity === ACTIVITY_WORKING) {
        return MINIMAP_COLOR_FRIENDLY_SHOOTING;
    }
    return MINIMAP_COLOR_FRIENDLY_IDLE;
}

export function argbToRgba(argb: number): { r: number; g: number; b: number; a: number } {
    return {
        a: (argb >>> 24) & 0xff,
        r: (argb >>> 16) & 0xff,
        g: (argb >>> 8) & 0xff,
        b: argb & 0xff,
    };
}

export interface CameraFrameRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/** 白框套黑框：先画白边，再往里缩 1 像素画黑边。超出小地图的边会被裁掉。 */
export function minimapCameraFrame(opts: {
    cameraLeftFine: number;
    cameraTopFine: number;
    viewWidthPx: number;
    viewHeightPx: number;
    objectSize: number;
    originX: number;
    originY: number;
    minimapWidth: number;
    minimapHeight: number;
}): { white: CameraFrameRect; black: CameraFrameRect } {
    const leftRaw = opts.originX + (opts.cameraLeftFine / FINE_PER_TILE) * opts.objectSize;
    const topRaw = opts.originY + (opts.cameraTopFine / FINE_PER_TILE) * opts.objectSize;
    const width = (opts.viewWidthPx / TILE_PIXELS) * opts.objectSize;
    const height = (opts.viewHeightPx / TILE_PIXELS) * opts.objectSize;
    const minX = opts.originX;
    const minY = opts.originY;
    const maxX = opts.originX + opts.minimapWidth;
    const maxY = opts.originY + opts.minimapHeight;
    const white: CameraFrameRect = {
        left: Math.max(leftRaw, minX),
        top: Math.max(topRaw, minY),
        right: Math.min(leftRaw + width, maxX),
        bottom: Math.min(topRaw + height, maxY),
    };
    const black: CameraFrameRect = {
        left: white.left + 1,
        top: white.top + 1,
        right: white.right - 1,
        bottom: white.bottom - 1,
    };
    return { white, black };
}

/** 小地图拖动：方向与空地拖动相反，同样的像素再乘 8。镜头 fine += 像素 × 7680/32 × 8。 */
export function lookFineAfterMinimapDrag(
    lookFineX: number,
    lookFineY: number,
    dxPixels: number,
    dyPixels: number,
): { x: number; y: number } {
    const k = (FINE_PER_TILE / TILE_PIXELS) * MINIMAP_DRAG_SCALE;
    return { x: lookFineX + dxPixels * k, y: lookFineY + dyPixels * k };
}

/**
 * 星星晃动：每 100 毫秒换一个与上次不同的方向，只动一条轴。
 * 偏移 = min(剩余计时, 500) × scale ÷ 400。人命为 0 时不再晃。
 */
export function starShakeOffset(
    remainMs: number,
    lives: number,
    direction: number,
    scale = 1,
): { x: number; y: number } {
    if (lives === 0 || remainMs <= 0) {
        return { x: 0, y: 0 };
    }
    const v1 = remainMs > 500 ? 500 : remainMs;
    const amp = Math.trunc((v1 * scale) / 400);
    switch (direction) {
        case 0:
            return { x: amp, y: 0 };
        case 1:
            return { x: -amp, y: 0 };
        case 2:
            return { x: 0, y: amp };
        default:
            return { x: 0, y: -amp };
    }
}

export function isHorseType(type: number): boolean {
    return type === 8;
}
