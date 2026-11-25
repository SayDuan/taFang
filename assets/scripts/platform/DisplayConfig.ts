/**
 * 设计分辨率入口。Boot 和画面都从这里读 CURRENT_ORIENTATION。
 * 纯布局和切换规则在 ScreenConfig，本文件再加上引擎里的 setDesignResolutionSize。
 */
import { ResolutionPolicy, view } from 'cc';
import { getDesignSize, stageSize } from './ScreenConfig';

export {
    CURRENT_ORIENTATION,
    FINE_PER_TILE,
    FOLLOW_MARGIN_SIDE_TILES,
    FOLLOW_MARGIN_TOP_TILES,
    GS_CURRENT_WAVE_TEXT_HEIGHT,
    GS_CURRENT_WAVE_TEXT_LEFT_MARGIN,
    GS_CURRENT_WAVE_TEXT_WIDTH,
    GS_DOLLAR_TEXT_HEIGHT,
    GS_DOLLAR_TEXT_LEFT_MARGIN,
    GS_DOLLAR_TEXT_WIDTH,
    GS_MAX_WAVE_TEXT_HEIGHT,
    GS_MAX_WAVE_TEXT_LEFT_MARGIN,
    GS_MAX_WAVE_TEXT_TOP_MARGIN,
    GS_MAX_WAVE_TEXT_WIDTH,
    GS_MINIMAP_BAND_LEFT,
    GS_MINIMAP_HEIGHT,
    GS_MINIMAP_LEFT_MARGIN,
    GS_MINIMAP_TOP_MARGIN,
    GS_MINIMAP_WIDTH,
    GS_WAVE_COUNTDOWN_TEXT_HEIGHT,
    GS_WAVE_COUNTDOWN_TEXT_WIDTH,
    HUD_BAND_WIDTH,
    HUD_BOTTOM_BAR_HEIGHT,
    HUD_PAUSE_HEIGHT,
    HUD_PAUSE_WIDTH,
    HUD_SHERIFF_BAND_LEFT,
    HUD_SHERIFF_HEIGHT,
    HUD_SHERIFF_LEFT_MARGIN,
    HUD_SHERIFF_WIDTH,
    HUD_TOP_BAR_HEIGHT,
    LANDSCAPE_HEIGHT,
    LANDSCAPE_WIDTH,
    PORTRAIT_HEIGHT,
    PORTRAIT_WIDTH,
    ScreenOrientation,
    STAGE_HEIGHT,
    STAGE_WIDTH,
    TILE_PIXELS,
    battleHudLayout,
    fineToPixels,
    getDesignSize,
    hookDesktopPreview,
    hudFitsInSafeMargins,
    isDesktopPreview,
    isHoverFourCornersEnabled,
    isPortrait,
    minimapObjectSize,
    pixelsToFine,
    pointInRect,
    screenRectOf,
    selectedUnitClearOfHud,
    shouldShowHoverSelector,
    stageSize,
    tileCenterFine,
    unitScreenPos,
    visibleColumns,
    visibleMapColumns,
    visibleRows,
    type AnchorRect,
    type BattleHudLayout,
    type DesignSize,
    type ScreenRect,
} from './ScreenConfig';

export function applyDesignResolution(): void {
    const size = getDesignSize();
    view.setDesignResolutionSize(size.width, size.height, ResolutionPolicy.SHOW_ALL);
}

/** 进关后改成屏幕宽 × 屏幕比例高，保持瓦片 32 像素、横向铺满屏幕，纵向能显示多少显示多少。 */
export function applyStageResolution(): void {
    const frame = view.getFrameSize();
    const fw = Math.max(1, frame.width);
    const fh = Math.max(1, frame.height);
    // 固定设计宽度 640（瓦片 32 × 20 格基准），高度按窗口比例算出。
    // 用 FIXED_WIDTH 让宽度始终等于 640，高度随窗口自动适配。
    const stageW = 640;
    const stageH = Math.max(240, Math.round(stageW * fh / fw));
    view.setDesignResolutionSize(stageW, stageH, ResolutionPolicy.FIXED_WIDTH);
}
