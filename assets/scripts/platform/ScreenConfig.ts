/**
 * 设计分辨率、战斗 HUD 锚点和镜头安全区。
 * 改 CURRENT_ORIENTATION 这一个常量即可在竖屏 720×1280 和横屏 1280×720 之间切换。
 * 一格永远是 32 像素。不依赖 Creator。
 */

import { view } from 'cc';

export enum ScreenOrientation {
    Portrait = 0,
    Landscape = 1,
}

/** 默认先用竖屏（抖音）。改这一处就能切到横屏（TapTap），不必复制场景。 */
export const CURRENT_ORIENTATION: ScreenOrientation = ScreenOrientation.Portrait;

export const TILE_PIXELS = 32;
export const FINE_PER_TILE = 7680;

export const PORTRAIT_WIDTH = 720;
export const PORTRAIT_HEIGHT = 1280;
export const LANDSCAPE_WIDTH = 1280;
export const LANDSCAPE_HEIGHT = 720;

/** Java mSafeArea：左右和下边留 2 格，上边留 4 格。 */
export const FOLLOW_MARGIN_SIDE_TILES = 2;
export const FOLLOW_MARGIN_TOP_TILES = 4;

/** dimen_default：顶栏里最高的是警长星 74dip。底栏底板高度以图为准，缺图时 48。 */
export const HUD_SHERIFF_WIDTH = 78;
export const HUD_SHERIFF_HEIGHT = 74;
export const HUD_SHERIFF_LEFT_MARGIN = 0;
export const HUD_PAUSE_WIDTH = 74;
export const HUD_PAUSE_HEIGHT = 49;
export const HUD_BOTTOM_BAR_HEIGHT = 48;
export const HUD_TOP_BAR_HEIGHT = HUD_SHERIFF_HEIGHT;

/** 官方战斗顶栏控件带：480dip 宽，水平居中，贴在画布最上沿。 */
export const HUD_BAND_WIDTH = 480;

export const GS_MINIMAP_WIDTH = 66;
export const GS_MINIMAP_HEIGHT = 50;
/**
 * dimen gs_mini_map_left_margin 是 174dip，但 GunsAndGloryThread 里是
 * `initMiniMap((mCanvasWidth/2) + gs_mini_map_left_margin, ...)`：从屏幕中线往右 174dip，
 * 不是从 480 控件带左端算。换算到控件带就是 240 + 174 = 414，右端正好贴住 480。
 */
export const GS_MINIMAP_LEFT_MARGIN = 174;
export const GS_MINIMAP_TOP_MARGIN = 2;
export const GS_MINIMAP_BAND_LEFT = HUD_BAND_WIDTH / 2 + GS_MINIMAP_LEFT_MARGIN;
/** GunsAndGloryThread.resetHUDLayout：暂停键 x = 480 控件带左端 + 5dip。 */
export const HUD_PAUSE_BAND_LEFT = 5;

export const GS_DOLLAR_TEXT_WIDTH = 48;
export const GS_DOLLAR_TEXT_HEIGHT = 24;
export const GS_DOLLAR_TEXT_LEFT_MARGIN = 136;
export const GS_CURRENT_WAVE_TEXT_WIDTH = 24;
export const GS_CURRENT_WAVE_TEXT_HEIGHT = 24;
export const GS_CURRENT_WAVE_TEXT_LEFT_MARGIN = 292;
export const GS_MAX_WAVE_TEXT_WIDTH = 24;
export const GS_MAX_WAVE_TEXT_HEIGHT = 24;
export const GS_MAX_WAVE_TEXT_LEFT_MARGIN = 326;
export const GS_MAX_WAVE_TEXT_TOP_MARGIN = 6;
export const GS_WAVE_COUNTDOWN_TEXT_WIDTH = 60;
export const GS_WAVE_COUNTDOWN_TEXT_HEIGHT = 54;

/**
 * 警长星 78×74，dimen gs_sheriff_image_left_margin = 0。
 * GunsAndGloryThread 是 `resetSheriffStarWidget((mCanvasWidth/2) + margin)`，所以星在屏幕正中，
 * 换算到控件带就是 (480 - 78) / 2。
 */
export const HUD_SHERIFF_BAND_LEFT = (HUD_BAND_WIDTH - HUD_SHERIFF_WIDTH) / 2;

export interface DesignSize {
    width: number;
    height: number;
}

export function getDesignSize(orientation: ScreenOrientation = CURRENT_ORIENTATION): DesignSize {
    if (orientation === ScreenOrientation.Landscape) {
        return { width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT };
    }
    return { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT };
}

/** 官方逻辑舞台 640×360（1920×1080 @480dpi / 3 = 640×360dp）。镜头按窗口短边留边时用这两个常量。 */
export const STAGE_WIDTH = 640;
export const STAGE_HEIGHT = 360;

/**
 * 官方逻辑舞台宽度 640（固定），高度按屏幕比例动态扩展。
 * 菜单仍用 getDesignSize() 的 720×1280；战场镜头、顶栏和点选取舞台宽度 640，
 * 纵向能显示多少显示多少，多出来的才拖动。
 * 瓦片永远 32 像素一格（FINE_PER_TILE = 7680 = 32×240）。
 */
export function stageSize(_orientation: ScreenOrientation = CURRENT_ORIENTATION): DesignSize {
    // applyStageResolution 已用 FIXED_WIDTH 设置好 view 设计分辨率（宽 640，高按窗口比例）。
    // getVisibleSize() 返回画布真实宽高。
    try {
        const visible = view.getVisibleSize();
        if (visible && visible.width > 0 && visible.height > 0) {
            return { width: visible.width, height: visible.height };
        }
    } catch {
        // 编辑器环境下可能抛异常。
    }
    // 兜底：读 view 设计分辨率，再兜底到 640×360。
    try {
        const design = view.getDesignResolutionSize();
        if (design && design.width > 0 && design.height > 0) {
            return { width: design.width, height: design.height };
        }
    } catch {
        // 忽略。
    }
    return { width: STAGE_WIDTH, height: 360 };
}

export function isPortrait(orientation: ScreenOrientation = CURRENT_ORIENTATION): boolean {
    return orientation !== ScreenOrientation.Landscape;
}

export function fineToPixels(fine: number): number {
    return fine * TILE_PIXELS / FINE_PER_TILE;
}

export function pixelsToFine(pixels: number): number {
    return pixels * FINE_PER_TILE / TILE_PIXELS;
}

/** 格子中心的 fine 坐标。列、行从 0 起算：中心是 列 * 7680 + 3840。 */
export function tileCenterFine(col: number, row: number): { x: number; y: number } {
    return {
        x: col * FINE_PER_TILE + FINE_PER_TILE / 2,
        y: row * FINE_PER_TILE + FINE_PER_TILE / 2,
    };
}

/** 设计分辨率里一屏能看到多少列，不按地图裁。竖屏 720/32=22.5，横屏 1280/32=40。 */
export function visibleColumns(orientation: ScreenOrientation = CURRENT_ORIENTATION): number {
    return getDesignSize(orientation).width / TILE_PIXELS;
}

export function visibleRows(orientation: ScreenOrientation = CURRENT_ORIENTATION): number {
    return getDesignSize(orientation).height / TILE_PIXELS;
}

/** 当前镜头下一屏实际能看到的列数，不超过地图宽度。 */
export function visibleMapColumns(cols: number, orientation: ScreenOrientation = CURRENT_ORIENTATION): number {
    return Math.min(cols, visibleColumns(orientation));
}

export interface ScreenRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface AnchorRect {
    /** Cocos 锚点，0–1。顶栏 (0.5, 1)，底栏 (0.5, 0)。 */
    anchorX: number;
    anchorY: number;
    /** 锚点在画布里的位置：原点在屏幕中心，Y 向上。 */
    x: number;
    y: number;
    width: number;
    height: number;
}

export function screenRectOf(anchor: AnchorRect, screenWidth: number, screenHeight: number): ScreenRect {
    const leftCenter = anchor.x - anchor.anchorX * anchor.width;
    const bottomCenter = anchor.y - anchor.anchorY * anchor.height;
    const left = leftCenter + screenWidth / 2;
    const bottomFromBottom = bottomCenter + screenHeight / 2;
    const top = screenHeight - (bottomFromBottom + anchor.height);
    return {
        left,
        top,
        right: left + anchor.width,
        bottom: top + anchor.height,
    };
}

/**
 * Java Minimap.initMiniMap：objectSize = min(floor(canvasW/32), max(floor(canvasH/24), 1))。
 * 画布按 dimen 的 66×50。
 */
export function minimapObjectSize(
    cols: number,
    rows: number,
    canvasW = GS_MINIMAP_WIDTH,
    canvasH = GS_MINIMAP_HEIGHT,
): number {
    void cols;
    void rows;
    return Math.min(Math.floor(canvasW / 32), Math.max(Math.floor(canvasH / 24), 1));
}

export interface BattleHudLayout {
    orientation: ScreenOrientation;
    screenWidth: number;
    screenHeight: number;
    tilePixels: number;
    visibleColumns: number;
    visibleRows: number;
    topBar: AnchorRect;
    bottomBar: AnchorRect;
    minimap: AnchorRect;
    pause: AnchorRect;
    sheriff: AnchorRect;
    dollar: AnchorRect;
    currentWave: AnchorRect;
    maxWave: AnchorRect;
    countdown: AnchorRect;
    bandWidth: number;
    /** 屏幕坐标，原点在左上、Y 向下。 */
    topBarScreen: ScreenRect;
    bottomBarScreen: ScreenRect;
    /** Java mSafeArea，屏幕坐标。 */
    safeArea: ScreenRect;
    /** 顶栏下沿到（可见的）底栏上沿，屏幕坐标。 */
    playfield: ScreenRect;
}

export function battleHudLayout(
    orientation: ScreenOrientation = CURRENT_ORIENTATION,
    opts?: { mapCols?: number; mapRows?: number; screen?: DesignSize },
): BattleHudLayout {
    const size = opts?.screen ?? getDesignSize(orientation);
    const sw = size.width;
    const sh = size.height;
    const topBar: AnchorRect = {
        anchorX: 0.5,
        anchorY: 1,
        x: 0,
        y: sh / 2,
        // 官方只画 480dip 的顶栏，水平居中；左右各留 (画布宽-480)/2 的空隙，不向两边延伸。
        width: HUD_BAND_WIDTH,
        height: HUD_TOP_BAR_HEIGHT,
    };
    const bottomBar: AnchorRect = {
        anchorX: 0.5,
        anchorY: 0,
        x: 0,
        y: -sh / 2,
        width: sw,
        height: HUD_BOTTOM_BAR_HEIGHT,
    };
    const objectSize = minimapObjectSize(opts?.mapCols ?? 32, opts?.mapRows ?? 24);
    const miniW = (opts?.mapCols ?? 32) * objectSize;
    const miniH = (opts?.mapRows ?? 24) * objectSize;
    // 480 控件带水平居中：Cocos X 永远是 [-240, 240]，和 720 / 1280 画布都兼容。
    const bandLeft = -HUD_BAND_WIDTH / 2;
    const boxLeft = bandLeft + GS_MINIMAP_BAND_LEFT;
    const boxTop = sh / 2 - GS_MINIMAP_TOP_MARGIN;
    const minimap: AnchorRect = {
        anchorX: 0,
        anchorY: 1,
        x: boxLeft + (GS_MINIMAP_WIDTH - miniW) / 2,
        y: boxTop - (GS_MINIMAP_HEIGHT - miniH) / 2,
        width: miniW,
        height: miniH,
    };
    const pause: AnchorRect = {
        anchorX: 0,
        anchorY: 1,
        x: bandLeft + HUD_PAUSE_BAND_LEFT,
        y: sh / 2,
        width: HUD_PAUSE_WIDTH,
        height: HUD_PAUSE_HEIGHT,
    };
    const sheriff: AnchorRect = {
        anchorX: 0,
        anchorY: 1,
        x: bandLeft + HUD_SHERIFF_BAND_LEFT,
        y: sh / 2,
        width: HUD_SHERIFF_WIDTH,
        height: HUD_SHERIFF_HEIGHT,
    };
    const dollar: AnchorRect = {
        anchorX: 0,
        anchorY: 1,
        x: bandLeft + GS_DOLLAR_TEXT_LEFT_MARGIN,
        y: sh / 2 - GS_MAX_WAVE_TEXT_TOP_MARGIN,
        width: GS_DOLLAR_TEXT_WIDTH,
        height: GS_DOLLAR_TEXT_HEIGHT,
    };
    const currentWave: AnchorRect = {
        anchorX: 0,
        anchorY: 1,
        x: bandLeft + GS_CURRENT_WAVE_TEXT_LEFT_MARGIN,
        y: sh / 2 - GS_MAX_WAVE_TEXT_TOP_MARGIN,
        width: GS_CURRENT_WAVE_TEXT_WIDTH,
        height: GS_CURRENT_WAVE_TEXT_HEIGHT,
    };
    const maxWave: AnchorRect = {
        anchorX: 0,
        anchorY: 1,
        x: bandLeft + GS_MAX_WAVE_TEXT_LEFT_MARGIN,
        y: sh / 2 - GS_MAX_WAVE_TEXT_TOP_MARGIN,
        width: GS_MAX_WAVE_TEXT_WIDTH,
        height: GS_MAX_WAVE_TEXT_HEIGHT,
    };
    // screen_ingame.xml：倒计时贴在整张屏幕右下角，不在 480 顶栏里。
    const countdown: AnchorRect = {
        anchorX: 1,
        anchorY: 0,
        x: sw / 2,
        y: -sh / 2,
        width: GS_WAVE_COUNTDOWN_TEXT_WIDTH,
        height: GS_WAVE_COUNTDOWN_TEXT_HEIGHT,
    };
    const topBarScreen = screenRectOf(topBar, sw, sh);
    const bottomBarScreen = screenRectOf(bottomBar, sw, sh);
    const tile = TILE_PIXELS;
    const safeArea: ScreenRect = {
        left: FOLLOW_MARGIN_SIDE_TILES * tile,
        top: FOLLOW_MARGIN_TOP_TILES * tile,
        right: sw - FOLLOW_MARGIN_SIDE_TILES * tile,
        bottom: sh - FOLLOW_MARGIN_SIDE_TILES * tile,
    };
    const playfield: ScreenRect = {
        left: 0,
        top: topBarScreen.bottom,
        right: sw,
        bottom: bottomBarScreen.top,
    };
    return {
        orientation,
        screenWidth: sw,
        screenHeight: sh,
        tilePixels: TILE_PIXELS,
        visibleColumns: visibleColumns(orientation),
        visibleRows: visibleRows(orientation),
        topBar,
        bottomBar,
        minimap,
        pause,
        sheriff,
        dollar,
        currentWave,
        maxWave,
        countdown,
        bandWidth: HUD_BAND_WIDTH,
        topBarScreen,
        bottomBarScreen,
        safeArea,
        playfield,
    };
}

export function pointInRect(x: number, y: number, rect: ScreenRect): boolean {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * 人的屏幕坐标（左上原点、Y 向下）。
 * unitFineY 是模拟向下增大的 fine；lookFineYUp 是镜头中心的世界向上 fine（第 0 行在上）。
 */
export function unitScreenPos(
    unitFineX: number,
    unitFineY: number,
    lookFineX: number,
    lookFineYUp: number,
    mapRows: number,
    viewWidth: number,
    viewHeight: number,
): { x: number; y: number } {
    const unitYUp = mapRows * FINE_PER_TILE - unitFineY;
    return {
        x: viewWidth / 2 + fineToPixels(unitFineX - lookFineX),
        y: viewHeight / 2 - fineToPixels(unitYUp - lookFineYUp),
    };
}

/** 点选的人在画面上的落点是否被顶栏或底栏盖住。底栏只在选中己方单位时出现。 */
export function selectedUnitClearOfHud(opts: {
    unitFineX: number;
    unitFineY: number;
    lookFineX: number;
    lookFineYUp: number;
    mapRows: number;
    orientation?: ScreenOrientation;
    bottomBarVisible?: boolean;
}): boolean {
    const orientation = opts.orientation ?? CURRENT_ORIENTATION;
    const layout = battleHudLayout(orientation);
    const pos = unitScreenPos(
        opts.unitFineX,
        opts.unitFineY,
        opts.lookFineX,
        opts.lookFineYUp,
        opts.mapRows,
        layout.screenWidth,
        layout.screenHeight,
    );
    if (pointInRect(pos.x, pos.y, layout.topBarScreen)) {
        return false;
    }
    if ((opts.bottomBarVisible ?? true) && pointInRect(pos.x, pos.y, layout.bottomBarScreen)) {
        return false;
    }
    return true;
}

/** 官方安全区完全包住顶栏和底栏，选中的人只要留在安全区里就不会被栏盖住。 */
export function hudFitsInSafeMargins(orientation: ScreenOrientation = CURRENT_ORIENTATION): boolean {
    const layout = battleHudLayout(orientation);
    return layout.topBar.height <= FOLLOW_MARGIN_TOP_TILES * TILE_PIXELS
        && layout.bottomBar.height <= FOLLOW_MARGIN_SIDE_TILES * TILE_PIXELS;
}

let desktopPreviewOverride: boolean | null = null;

export function hookDesktopPreview(value: boolean | null): void {
    desktopPreviewOverride = value;
}

/** 横屏桌面预览才开鼠标悬停。抖音竖屏包和触摸设备都不要。 */
export function isDesktopPreview(): boolean {
    if (desktopPreviewOverride !== null) {
        return desktopPreviewOverride;
    }
    try {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (!nav) {
            return false;
        }
        const ua = nav.userAgent ?? '';
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export function isHoverFourCornersEnabled(
    orientation: ScreenOrientation = CURRENT_ORIENTATION,
    desktopPreview: boolean = isDesktopPreview(),
): boolean {
    return orientation === ScreenOrientation.Landscape && desktopPreview;
}

/** 鼠标悬停四角只在横屏桌面预览里出现。触摸路径两边都在。 */
export function shouldShowHoverSelector(opts: {
    touchMode: boolean;
    hovered: boolean;
    isHorse: boolean;
    orientation?: ScreenOrientation;
    desktopPreview?: boolean;
}): boolean {
    if (!isHoverFourCornersEnabled(opts.orientation, opts.desktopPreview ?? isDesktopPreview())) {
        return false;
    }
    return !opts.touchMode && opts.hovered && !opts.isHorse;
}
