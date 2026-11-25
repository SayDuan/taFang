/**
 * 第 20 步主菜单纯规则：帮助翻页、人像帧表、云和天空补边。
 * 帧表和速度按 Java / 画面.tsv，不依赖 Creator。
 */

/** 帮助四页，顺序与 HelpScreenActivity.helpScreens 中间四项一致。 */
export const HELP_PAGE_LAYOUTS = [
    'hs_zero_page_layout',
    'hs_first_page_layout',
    'hs_second_page_layout',
    'hs_third_page_layout',
] as const;

export type HelpPageLayout = (typeof HELP_PAGE_LAYOUTS)[number];

/** Java 数组两端是 -1 哨兵，pageIndex 从 1 起。 */
export const HELP_SCREEN_SENTINELS = [-1, 0, 1, 2, 3, -1] as const;

export type HelpNavResult =
    | { kind: 'page'; page: number; layout: HelpPageLayout }
    | { kind: 'menu' };

export function helpLayout(page: number): HelpPageLayout {
    const i = Math.max(0, Math.min(HELP_PAGE_LAYOUTS.length - 1, Math.trunc(page)));
    return HELP_PAGE_LAYOUTS[i];
}

/**
 * 帮助翻页。Java：
 * 向右翻过最后一页（helpScreens[length-2]）调用 onBack，回到主菜单。
 * 向左在第一页（helpScreens[1]）也调用 onBack，回到主菜单。
 */
export function navigateHelp(page: number, dir: 'left' | 'right'): HelpNavResult {
    const cur = Math.trunc(page);
    if (dir === 'right') {
        if (cur >= HELP_PAGE_LAYOUTS.length - 1) {
            return { kind: 'menu' };
        }
        const next = cur + 1;
        return { kind: 'page', page: next, layout: helpLayout(next) };
    }
    if (cur <= 0) {
        return { kind: 'menu' };
    }
    const prev = cur - 1;
    return { kind: 'page', page: prev, layout: helpLayout(prev) };
}

/** 人像 20 张图，顺序与 MainMenuAnimatedPortrait 里 0–19 的常量一一对应。 */
export const PORTRAIT_IMAGE_NAMES = [
    'gng_startmenu_3_bandit_1_wanted_1',
    'gng_startmenu_3_bandit_1_wanted_2',
    'gng_startmenu_3_bandit_2_hole',
    'gng_startmenu_3_bandit_3_body',
    'gng_startmenu_3_bandit_4_head_0',
    'gng_startmenu_3_bandit_4_head_1_angry_1',
    'gng_startmenu_3_bandit_4_head_1_angry_2',
    'gng_startmenu_3_bandit_4_head_2_tic',
    'gng_startmenu_3_bandit_5_hand_left',
    'gng_startmenu_3_bandit_5_hand_left_shoot',
    'gng_startmenu_3_bandit_5_hand_right',
    'gng_startmenu_3_bandit_5_hand_right_shoot',
    'gng_startmenu_3_bandit_6_smoke_1',
    'gng_startmenu_3_bandit_6_smoke_2',
    'gng_startmenu_3_bandit_6_smoke_3',
    'gng_startmenu_3_bandit_6_smoke_4',
    'gng_startmenu_3_bandit_6_smoke_5',
    'gng_startmenu_3_bandit_6_smoke_6',
    'gng_startmenu_3_bandit_6_smoke_7',
    'gng_startmenu_3_bandit_6_smoke_8',
] as const;

export const PORTRAIT_IMAGE_COUNT = 20;
export const PORTRAIT_STEP_MS = 100;
export const PORTRAIT_HIDDEN = -1;

export const PORTRAIT_LAYER = {
    poster: 0,
    hole: 1,
    body: 2,
    head: 3,
    leftHand: 4,
    rightHand: 5,
    smoke: 6,
} as const;

export type PortraitLayer = (typeof PORTRAIT_LAYER)[keyof typeof PORTRAIT_LAYER];

/** FrameAnimationRecord：海报、洞、身体、头、左手、右手、烟，时长毫秒。 */
export interface PortraitFrame {
    poster: number;
    hole: number;
    body: number;
    head: number;
    leftHand: number;
    rightHand: number;
    smoke: number;
    durationMs: number;
}

function rec(
    poster: number,
    hole: number,
    body: number,
    head: number,
    leftHand: number,
    rightHand: number,
    smoke: number,
    durationMs = PORTRAIT_STEP_MS,
): PortraitFrame {
    return { poster, hole, body, head, leftHand, rightHand, smoke, durationMs };
}

/** 开场 26 帧，与 MainMenuAnimatedPortrait.setupStartAnimationFrames 完全一致。 */
export const INTRO_FRAMES: readonly PortraitFrame[] = [
    rec(-1, -1, -1, -1, -1, -1, -1),
    rec(0, -1, -1, -1, -1, -1, -1),
    rec(1, -1, -1, -1, -1, -1, -1),
    rec(0, -1, -1, -1, -1, -1, -1),
    rec(-1, -1, -1, -1, -1, -1, -1),
    rec(0, -1, -1, -1, -1, -1, -1),
    rec(1, -1, -1, -1, -1, -1, -1),
    rec(0, -1, -1, -1, -1, -1, -1),
    rec(-1, -1, -1, -1, -1, -1, -1),
    rec(0, -1, -1, -1, -1, -1, -1),
    rec(1, -1, -1, -1, -1, -1, 12),
    rec(-1, -1, -1, -1, -1, -1, 13),
    rec(-1, -1, -1, -1, -1, -1, 14),
    rec(-1, 2, -1, -1, -1, -1, 15),
    rec(-1, 2, 3, 4, 8, -1, 16),
    rec(-1, 2, 3, 4, 8, 10, 17),
    rec(-1, 2, 3, 4, 8, 10, 18),
    rec(-1, 2, 3, 4, 8, 10, 19),
    rec(-1, 2, 3, 4, 8, 10, -1),
    rec(-1, 2, 3, 5, 9, 10, -1),
    rec(-1, 2, 3, 6, 8, 11, -1),
    rec(-1, 2, 3, 6, 9, 10, -1),
    rec(-1, 2, 3, 6, 8, 11, -1),
    rec(-1, 2, 3, 6, 8, 10, -1),
    rec(-1, 2, 3, 5, 8, 10, -1),
    rec(-1, 2, 3, 4, 8, 10, -1),
];

/** 开枪四步。 */
export const SHOOT_FRAMES: readonly PortraitFrame[] = [
    rec(-1, 2, 3, 4, 8, 10, -1),
    rec(-1, 2, 3, 4, 9, 10, -1),
    rec(-1, 2, 3, 4, 8, 11, -1),
    rec(-1, 2, 3, 4, 8, 10, -1),
];

/** 生气五步，头 4、5、6、5、4。 */
export const ANGRY_FRAMES: readonly PortraitFrame[] = [
    rec(-1, 2, 3, 4, 8, 10, -1),
    rec(-1, 2, 3, 5, 8, 10, -1),
    rec(-1, 2, 3, 6, 8, 10, -1),
    rec(-1, 2, 3, 5, 8, 10, -1),
    rec(-1, 2, 3, 4, 8, 10, -1),
];

/** 摇头（TicTac）五步，头在 4 和 7 之间换。 */
export const SHAKE_FRAMES: readonly PortraitFrame[] = [
    rec(-1, 2, 3, 4, 8, 10, -1),
    rec(-1, 2, 3, 7, 8, 10, -1),
    rec(-1, 2, 3, 4, 8, 10, -1),
    rec(-1, 2, 3, 7, 8, 10, -1),
    rec(-1, 2, 3, 4, 8, 10, -1),
];

export type PortraitPhase = 'intro' | 'shoot' | 'angry' | 'shake';

export const PORTRAIT_FRAMES: Record<PortraitPhase, readonly PortraitFrame[]> = {
    intro: INTRO_FRAMES,
    shoot: SHOOT_FRAMES,
    angry: ANGRY_FRAMES,
    shake: SHAKE_FRAMES,
};

export interface PortraitState {
    phase: PortraitPhase;
    frame: number;
    elapsedMs: number;
}

export function createPortraitState(): PortraitState {
    return { phase: 'intro', frame: 0, elapsedMs: 0 };
}

export function framesForPhase(phase: PortraitPhase): readonly PortraitFrame[] {
    return PORTRAIT_FRAMES[phase];
}

export function currentPortraitFrame(state: PortraitState): PortraitFrame {
    const frames = framesForPhase(state.phase);
    const index = Math.max(0, Math.min(frames.length - 1, state.frame));
    return frames[index];
}

export function portraitLayerIndices(frame: PortraitFrame): readonly number[] {
    return [frame.poster, frame.hole, frame.body, frame.head, frame.leftHand, frame.rightHand, frame.smoke];
}

export function nextPortraitPhase(phase: PortraitPhase): PortraitPhase {
    if (phase === 'intro') {
        return 'shoot';
    }
    if (phase === 'shoot') {
        return 'angry';
    }
    if (phase === 'angry') {
        return 'shake';
    }
    return 'shoot';
}

/**
 * 推进人像动画。开场只播一遍，然后循环开枪、生气、摇头。
 * 原版 update() 未反编译，循环顺序按验收「先开场，然后开枪、生气、摇头」。
 */
export function tickPortrait(state: PortraitState, dtMs: number): PortraitState {
    let dt = dtMs;
    if (dt < 0) {
        dt = 0;
    }
    let phase = state.phase;
    let frame = state.frame;
    let elapsed = state.elapsedMs + dt;
    let guard = 0;
    while (guard < 64) {
        const frames = framesForPhase(phase);
        const current = frames[Math.max(0, Math.min(frames.length - 1, frame))];
        const step = current.durationMs > 0 ? current.durationMs : PORTRAIT_STEP_MS;
        if (elapsed < step) {
            break;
        }
        elapsed -= step;
        frame += 1;
        if (frame >= frames.length) {
            phase = nextPortraitPhase(phase);
            frame = 0;
        }
        guard += 1;
    }
    return { phase, frame, elapsedMs: elapsed };
}

export function portraitIsAnimated(frames: readonly PortraitFrame[]): boolean {
    if (frames.length <= 1) {
        return false;
    }
    const first = portraitLayerIndices(frames[0]).join(',');
    return frames.some((f) => portraitLayerIndices(f).join(',') !== first);
}

export const SKY_CENTER = 'gng_startmenu_0_bg_0_sky';
export const SKY_LEFT = 'sky_left';
export const SKY_RIGHT = 'sky_right';
export const SKY_TOP = 'sky_top';
export const CLOUD_NAMES = ['cloud_1', 'cloud_2', 'cloud_3'] as const;

export const MENU_BASE_WIDTH = 480;
export const MENU_BASE_HEIGHT = 320;
export const SKY_SIDE_WIDTH = 100;
export const SKY_TOP_WIDTH = 680;
export const SKY_TOP_HEIGHT = 50;
export const CLOUD_SIZES = [
    { width: 149, height: 31 },
    { width: 136, height: 32 },
    { width: 154, height: 44 },
] as const;

/**
 * 资源表里偶发把负数 dip 编成接近 2^24 的打包值，例如 16777188 = -28。
 * 大于 2^23 的按 24 位有符号还原，其余原样返回。
 */
export function packedDip(value: number): number {
    if (value > 0x800000) {
        return value - 0x1000000;
    }
    return value;
}

export interface ContentBand {
    width: number;
    height: number;
    /** 画布坐标：原点在屏幕中心，Y 向上。 */
    x: number;
    y: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/**
 * 官方 480×320 内容带：在设计画布上水平和垂直都居中（原点在屏幕中心时 x=0、y=0）。
 * 不按 720/480 放大。竖屏 720×1280 时左右各留 120，上下各留 480；
 * 横屏 1280×720 时左右各留 400，上下各留 200。
 * 内容带内可按原版组合 sky_left/sky_right/sky_top，内容带以外不再拉伸图片填屏。
 */
export function contentBand(screenWidth: number, screenHeight: number): ContentBand {
    const width = MENU_BASE_WIDTH;
    const height = MENU_BASE_HEIGHT;
    const x = 0;
    const y = 0;
    return {
        width,
        height,
        x,
        y,
        left: x - width / 2,
        right: x + width / 2,
        top: y + height / 2,
        bottom: y - height / 2,
    };
}

/**
 * 官方主菜单整屏逻辑尺寸。screen_main_menu.xml 是 640×360 的 TableLayout：
 * 左列 ms_column_0 341dip、右列 ms_buttons_layout 299dip。
 * 选关/选地图仍是 480×320 居中，所以不能改 contentBand。
 */
export const MENU_BAND_WIDTH = 640;
export const MENU_BAND_HEIGHT = 360;
export const MENU_LEFT_COLUMN_WIDTH = 341;
export const MENU_RIGHT_COLUMN_WIDTH = 299;

export function menuBand(): ContentBand {
    const width = MENU_BAND_WIDTH;
    const height = MENU_BAND_HEIGHT;
    const x = 0;
    const y = 0;
    return {
        width,
        height,
        x,
        y,
        left: x - width / 2,
        right: x + width / 2,
        top: y + height / 2,
        bottom: y - height / 2,
    };
}

/** 图按比例缩小后放进框里；比按钮窄就保持缩小后的宽，由调用方水平居中。 */
export function fitUniform(srcW: number, srcH: number, boxW: number, boxH: number): { w: number; h: number } {
    if (srcW <= 0 || srcH <= 0) {
        return { w: boxW, h: boxH };
    }
    const scale = Math.min(boxW / srcW, boxH / srcH);
    return { w: srcW * scale, h: srcH * scale };
}

export const CLOUD_DIP_FROM_TOP = [15, 60, 110] as const;
export const CLOUD_SPEED_RANDOM_SPAN = 500;
export const CLOUD_SPEED_WIDTH_FACTOR = 3500;
export const CLOUD_SPEED_BIAS = 250;
export const CLOUD_WRAP_EXTRA_MAX = 160;
export const CLOUD_SKIP_DT_MS = 1000;

export interface SkyPadding {
    padLeft: boolean;
    padRight: boolean;
    padTop: boolean;
}

/** 逻辑宽度超过 480 补左右，逻辑高度超过 320 补顶。不超过则不补。 */
export function skyPadding(logicalWidth: number, logicalHeight: number): SkyPadding {
    const padSides = logicalWidth > MENU_BASE_WIDTH;
    const padTop = logicalHeight > MENU_BASE_HEIGHT;
    return {
        padLeft: padSides,
        padRight: padSides,
        padTop,
    };
}

/**
 * MenuBackground.onMeasure 的逐行复刻（单位统一用 dip，因为原版比的是 widthPixels/density）：
 * 中心带贴屏幕底边、水平居中；左右条和中心带同高、紧贴中心带两侧；顶条贴在中心带上方、自己再水平居中。
 * scale 同时夹到 ≥1，再取两轴的大者；中心带和顶条的宽高各 +2，用来消掉缩放后相邻边的缝。
 */
export interface SkyPiece {
    /** 画布坐标：原点在屏幕中心，Y 向上。 */
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SkyLayout {
    imageScale: number;
    center: SkyPiece;
    left: SkyPiece | null;
    right: SkyPiece | null;
    top: SkyPiece | null;
}

export function skyLayout(screenWidth: number, screenHeight: number): SkyLayout {
    const pad = skyPadding(screenWidth, screenHeight);
    const imageWidth = MENU_BASE_WIDTH + (pad.padLeft ? SKY_SIDE_WIDTH * 2 : 0);
    const imageHeight = MENU_BASE_HEIGHT + (pad.padTop ? SKY_TOP_HEIGHT : 0);
    const scale = Math.max(Math.max(1, screenWidth / imageWidth), Math.max(1, screenHeight / imageHeight));
    const piece = (leftDip: number, topDip: number, width: number, height: number): SkyPiece => ({
        x: leftDip + width / 2 - screenWidth / 2,
        y: screenHeight / 2 - (topDip + height / 2),
        width,
        height,
    });
    const centerWidth = Math.round(MENU_BASE_WIDTH * scale) + 2;
    const centerHeight = Math.round(MENU_BASE_HEIGHT * scale) + 2;
    const centerTop = screenHeight - centerHeight;
    const centerLeft = (screenWidth - centerWidth) / 2;
    const center = piece(centerLeft, centerTop, centerWidth, centerHeight);
    const sideWidth = Math.round(SKY_SIDE_WIDTH * scale);
    const topHeight = Math.round(SKY_TOP_HEIGHT * scale);
    const topWidth = Math.round(SKY_TOP_WIDTH * scale) + 2;
    return {
        imageScale: scale,
        center,
        left: pad.padLeft ? piece(centerLeft - sideWidth, centerTop, sideWidth, centerHeight) : null,
        right: pad.padRight ? piece(centerLeft + centerWidth, centerTop, sideWidth, centerHeight) : null,
        top: pad.padTop ? piece((screenWidth - topWidth) / 2, centerTop - topHeight, topWidth, topHeight) : null,
    };
}

/** Android：像素 = dip × density。Cocos 设计分辨率下默认 density 为 1。 */
export function dipToPixels(dip: number, density = 1): number {
    return dip * density;
}

export function cloudTopPx(index: number, density = 1): number {
    const dip = CLOUD_DIP_FROM_TOP[index] ?? CLOUD_DIP_FROM_TOP[0];
    return dipToPixels(dip, density);
}

/**
 * 云速度单位：random(500) + 屏幕像素宽 × 3500 ÷ 480 − 250。
 * random(500) 按 Java Util.random(n)，是 [0, n)。
 */
export function cloudSpeedUnits(widthPixels: number, random500: number): number {
    const roll = Math.max(0, Math.min(CLOUD_SPEED_RANDOM_SPAN - 1, Math.trunc(random500)));
    return Math.trunc(roll + (widthPixels * CLOUD_SPEED_WIDTH_FACTOR) / MENU_BASE_WIDTH - CLOUD_SPEED_BIAS);
}

/** 每毫秒走「屏幕宽 ÷ 速度」像素。两次刷新隔了超过 1 秒，这一拍不移动。 */
export function cloudDeltaX(widthPixels: number, speed: number, dtMs: number): number {
    if (dtMs > CLOUD_SKIP_DT_MS || dtMs < 0) {
        return 0;
    }
    if (speed === 0) {
        return 0;
    }
    return (widthPixels / speed) * dtMs;
}

export function cloudPixelsPerSecond(widthPixels: number, speed: number): number {
    if (speed === 0) {
        return 0;
    }
    return (widthPixels / speed) * 1000;
}

/** 取 random(500)=250 时，宽 480 大约每秒 137 像素，验收说大约 130。 */
export function typicalCloudPixelsPerSecond(widthPixels = MENU_BASE_WIDTH): number {
    return cloudPixelsPerSecond(widthPixels, cloudSpeedUnits(widthPixels, CLOUD_SPEED_BIAS));
}

export function shouldWrapCloud(left: number, screenWidth: number): boolean {
    return left > screenWidth;
}

/** 飞出右边缘后从左边外面再进来，再减去 0 到 250 的随机像素。 */
export function wrapCloudLeft(cloudWidth: number, imageScale: number, extraRandom: number): number {
    const extra = Math.max(0, Math.min(CLOUD_WRAP_EXTRA_MAX, extraRandom));
    return -cloudWidth * imageScale - extra;
}

export interface CloudState {
    index: number;
    left: number;
    top: number;
    width: number;
    height: number;
    speed: number;
    imageScale: number;
}

export function createCloud(
    index: number,
    screenWidth: number,
    density: number,
    startLeft: number,
    random500: number,
    width: number,
    height: number,
    imageScale = 1,
): CloudState {
    return {
        index,
        left: startLeft,
        top: cloudTopPx(index, density),
        width,
        height,
        speed: cloudSpeedUnits(screenWidth, random500),
        imageScale,
    };
}

export function tickCloud(
    cloud: CloudState,
    dtMs: number,
    screenWidth: number,
    wrapExtraRandom: number,
    respawnSpeedRandom500?: number,
): CloudState {
    const dx = cloudDeltaX(screenWidth, cloud.speed, dtMs);
    let left = cloud.left + dx;
    let speed = cloud.speed;
    if (shouldWrapCloud(left, screenWidth)) {
        left = wrapCloudLeft(cloud.width, cloud.imageScale, wrapExtraRandom);
        if (respawnSpeedRandom500 !== undefined) {
            speed = cloudSpeedUnits(screenWidth, respawnSpeedRandom500);
        }
    }
    return { ...cloud, left, speed };
}

export const MENU_SCREEN = {
    main: 'main',
    help: 'help',
    options: 'options',
    regionSelect: 'regionSelect',
    levelSelect: 'levelSelect',
} as const;

export type MenuScreen = (typeof MENU_SCREEN)[keyof typeof MENU_SCREEN];
