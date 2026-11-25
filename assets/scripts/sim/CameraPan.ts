/**
 * 战场镜头拖动范围。不依赖 Cocos，自检和 BattlefieldCamera 共用这一套。
 * 缩放固定为 1，一格 32 像素。竖屏 720×1280 下 32×24 的图必须能拖到四边。
 */
import { FINE_PER_TILE, TILE_PIXELS } from './Fine';

export const PORTRAIT_WIDTH = 720;
export const PORTRAIT_HEIGHT = 1280;
export const LANDSCAPE_WIDTH = 1280;
export const LANDSCAPE_HEIGHT = 720;

/** Java mSafeArea：左右和下边留 2 格，上边留 4 格。 */
export const FOLLOW_MARGIN_SIDE_TILES = 2;
export const FOLLOW_MARGIN_TOP_TILES = 4;

/**
 * Java 的 camMinX/camMaxX 比「地图刚好贴屏幕边」再往外放 2 格：
 * 镜头能拖到地图外面，露出 gng_frame 画的内外两圈边框。
 * drawTiledFrame 里用 realTilesize 和 2*realTilesize 两档判断，就是这两格。
 */
export const MAP_OVERSCROLL_TILES = 2;

export function pixelsToFine(pixels: number): number {
    return pixels * FINE_PER_TILE / TILE_PIXELS;
}

export function fineToPixels(fine: number): number {
    return fine * TILE_PIXELS / FINE_PER_TILE;
}

export function mapWidthFine(cols: number): number {
    return cols * FINE_PER_TILE;
}

export function mapHeightFine(rows: number): number {
    return rows * FINE_PER_TILE;
}

export interface LookRange {
    min: number;
    max: number;
    /** 图比屏幕还短时，镜头锁在中线。 */
    locked: boolean;
}

/** 镜头中心可取的范围，使可视区域落在地图内；图比屏幕小则锁在中点。 */
export function lookRange(mapFine: number, viewFine: number): LookRange {
    if (mapFine <= viewFine) {
        const mid = mapFine / 2;
        return { min: mid, max: mid, locked: true };
    }
    const half = viewFine / 2;
    return { min: half, max: mapFine - half, locked: false };
}

export function clampLookAxis(look: number, mapFine: number, viewFine: number): number {
    const range = lookRange(mapFine, viewFine);
    if (look < range.min) {
        return range.min;
    }
    if (look > range.max) {
        return range.max;
    }
    return look;
}

export function clampLookFine(
    lookX: number,
    lookY: number,
    mapW: number,
    mapH: number,
    viewW: number,
    viewH: number,
): { lookX: number; lookY: number } {
    return {
        lookX: clampLookAxisWithOverscroll(lookX, mapW, viewW),
        lookY: clampLookAxisWithOverscroll(lookY, mapH, viewH),
    };
}

/**
 * 对齐原版 updateCamDimensions：地图与视口相差不足 4 格时，也允许查看两格外边框。
 * 只有地图比视口小至少 4 格，原版才把该轴锁在地图中线。
 */
export function clampLookAxisWithOverscroll(look: number, mapFine: number, viewFine: number): number {
    const over = MAP_OVERSCROLL_TILES * FINE_PER_TILE;
    if (mapFine + over * 2 <= viewFine) {
        return mapFine / 2;
    }
    const half = viewFine / 2;
    const min = half - over;
    const max = mapFine - half + over;
    if (look < min) {
        return min;
    }
    if (look > max) {
        return max;
    }
    return look;
}

export interface VisibleSpan {
    start: number;
    end: number;
}

export function visibleSpan(look: number, viewFine: number): VisibleSpan {
    return { start: look - viewFine / 2, end: look + viewFine / 2 };
}

export interface PanCoverage {
    cols: number;
    rows: number;
    viewWidth: number;
    viewHeight: number;
    mapWidthPx: number;
    mapHeightPx: number;
    /** 最小镜头时能看到地图左/下边。 */
    coversOrigin: boolean;
    /** 最大镜头时能看到地图右/上边。 */
    coversFarEdge: boolean;
    /** 竖屏下整张图都能拖进画面。 */
    coversMap: boolean;
    minLookX: number;
    maxLookX: number;
    minLookY: number;
    maxLookY: number;
}

export function panCoverage(
    cols: number,
    rows: number,
    viewWidth = PORTRAIT_WIDTH,
    viewHeight = PORTRAIT_HEIGHT,
): PanCoverage {
    const mapW = mapWidthFine(cols);
    const mapH = mapHeightFine(rows);
    const viewW = pixelsToFine(viewWidth);
    const viewH = pixelsToFine(viewHeight);
    const x = lookRange(mapW, viewW);
    const y = lookRange(mapH, viewH);
    const atMin = {
        x: visibleSpan(x.min, viewW),
        y: visibleSpan(y.min, viewH),
    };
    const atMax = {
        x: visibleSpan(x.max, viewW),
        y: visibleSpan(y.max, viewH),
    };
    const coversOrigin = atMin.x.start <= 0 && atMin.y.start <= 0;
    const coversFarEdge = atMax.x.end >= mapW && atMax.y.end >= mapH;
    return {
        cols,
        rows,
        viewWidth,
        viewHeight,
        mapWidthPx: cols * TILE_PIXELS,
        mapHeightPx: rows * TILE_PIXELS,
        coversOrigin,
        coversFarEdge,
        coversMap: coversOrigin && coversFarEdge,
        minLookX: x.min,
        maxLookX: x.max,
        minLookY: y.min,
        maxLookY: y.max,
    };
}

/** 竖屏 720×1280 下，32×24 这类大图必须能拖完全图。 */
export function portraitCoversMap(cols: number, rows: number): boolean {
    return panCoverage(cols, rows, PORTRAIT_WIDTH, PORTRAIT_HEIGHT).coversMap;
}

/** apk GunsAndGloryThread.filterKernel = 0.7f，目标权重 0.3f。 */
export const EDGE_FILTER_KERNEL = 0.7;
export const EDGE_GOAL_WEIGHT = 0.3;
/** apk bonusAttribute==3（加速补给）时镜头推动速度 ×150%，否则 ×100%。 */
export const EDGE_HASTE_BONUS = 3;
export const EDGE_HASTE_MODIFIER = 150;
export const EDGE_NORMAL_MODIFIER = 100;

export interface EdgePushState {
    goalX: number;
    goalY: number;
}

export interface EdgePushResult extends EdgePushState {
    lookX: number;
    lookY: number;
    /** 本帧是否有单位越过安全区（apk mInvalidateForMovement）。 */
    pushed: boolean;
}

/**
 * apk GunsAndGloryThread.run() L812-845：仅 mMoveArrow.isShowing() 时，
 * 单位越过 mSafeArea（左右下 2 格、上 4 格）就按 speed*modifier*dt 逐帧累加 goto，
 * 再 camera = 0.7*prev + 0.3*goal；停住时把 goal 拉回 camera。
 * 项目 look 是视口中心 fine（Y 向上），apk camera 是左上角偏移（Y 向下），
 * 所以左右/上下推动方向要按视口中心坐标换算。
 */
export function edgePushLook(
    lookX: number,
    lookY: number,
    state: EdgePushState,
    unitFineX: number,
    unitFineYUp: number,
    unitSpeed: number,
    bonusAttribute: number,
    dtMs: number,
    viewWidthPx: number,
    viewHeightPx: number,
): EdgePushResult {
    const halfW = pixelsToFine(viewWidthPx) / 2;
    const halfH = pixelsToFine(viewHeightPx) / 2;
    const side = FOLLOW_MARGIN_SIDE_TILES * FINE_PER_TILE;
    const topMargin = FOLLOW_MARGIN_TOP_TILES * FINE_PER_TILE;
    const modifier = bonusAttribute === EDGE_HASTE_BONUS ? EDGE_HASTE_MODIFIER : EDGE_NORMAL_MODIFIER;
    const step = Math.trunc(((unitSpeed * modifier) / 100) * dtMs / 100);
    let gotoX = 0;
    let gotoY = 0;
    if (unitFineX < lookX - halfW + side) {
        gotoX = -step;
    } else if (unitFineX > lookX + halfW - side) {
        gotoX = step;
    }
    if (unitFineYUp > lookY + halfH - topMargin) {
        gotoY = step;
    } else if (unitFineYUp < lookY - halfH + side) {
        gotoY = -step;
    }
    const pushed = gotoX !== 0 || gotoY !== 0;
    let goalX = state.goalX + gotoX;
    let goalY = state.goalY + gotoY;
    const nextX = Math.trunc(EDGE_FILTER_KERNEL * lookX + EDGE_GOAL_WEIGHT * goalX);
    const nextY = Math.trunc(EDGE_FILTER_KERNEL * lookY + EDGE_GOAL_WEIGHT * goalY);
    if (nextX === lookX) {
        goalX = nextX;
    }
    if (nextY === lookY) {
        goalY = nextY;
    }
    return { lookX: nextX, lookY: nextY, goalX, goalY, pushed };
}

/**
 * 选中的人走到离左、右、下边不足 2 格，或离上边不足 4 格时，镜头跟上。
 * unitFineYUp 和 lookY 用世界向上的 fine（第 0 行在上）。
 */
export function followSelectedLook(
    lookX: number,
    lookY: number,
    unitFineX: number,
    unitFineYUp: number,
    viewWidthPx: number,
    viewHeightPx: number,
): { lookX: number; lookY: number } {
    const halfW = pixelsToFine(viewWidthPx) / 2;
    const halfH = pixelsToFine(viewHeightPx) / 2;
    const left = lookX - halfW;
    const right = lookX + halfW;
    const bottom = lookY - halfH;
    const top = lookY + halfH;
    const side = FOLLOW_MARGIN_SIDE_TILES * FINE_PER_TILE;
    const topMargin = FOLLOW_MARGIN_TOP_TILES * FINE_PER_TILE;
    let nextX = lookX;
    let nextY = lookY;
    if (unitFineX < left + side) {
        nextX -= left + side - unitFineX;
    } else if (unitFineX > right - side) {
        nextX += unitFineX - (right - side);
    }
    if (unitFineYUp < bottom + side) {
        nextY -= bottom + side - unitFineYUp;
    } else if (unitFineYUp > top - topMargin) {
        nextY += unitFineYUp - (top - topMargin);
    }
    return { lookX: nextX, lookY: nextY };
}

