import {
    _decorator,
    Asset,
    AssetManager,
    Button,
    Camera,
    Canvas,
    Color,
    Component,
    EventMouse,
    EventTouch,
    Graphics,
    ImageAsset,
    Input,
    input,
    Label,
    Layers,
    Mask,
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    Tween,
    tween,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    Widget,
    EditBox,
    sys,
} from 'cc';
import { loadAsset, loadBundle, loadText } from '../data/AssetBytes';
import { TsvTable } from '../data/Tsv';
import { GameTables } from '../data/GameTables';
import { GS_MINIMAP_HEIGHT, GS_MINIMAP_WIDTH, TILE_PIXELS, battleHudLayout, fineToPixels, isHoverFourCornersEnabled, minimapObjectSize, pixelsToFine, shouldShowHoverSelector, stageSize } from '../platform/DisplayConfig';
import { contentBand } from '../sim/MainMenuModel';
import {
    dialogScrollBox,
    estimateTextHeight,
    stackDialogSections,
    type DialogSection,
} from '../sim/DialogLayout';
import { GameTime } from '../sim/GameTime';
import {
    CROSSHAIR_FRAME_ORDER,
    CURSOR_FRAME_ORDER,
    HUD_BOTTOM,
    HUD_CROSSHAIR,
    HUD_CURSOR,
    HUD_FONT_NUMBERS_SCALED,
    HUD_ICONS_ENEMIES,
    HUD_ICONS_THUMBS,
    HUD_PAUSE,
    HUD_PAUSE_PRESSED,
    HUD_SELECTOR,
    HUD_STAR_COVER,
    HUD_STAR_FULL,
    HUD_TOP,
    HUD_TOP_LEFT,
    HUD_TOP_RIGHT,
    SELECTOR_FRAME_ORDER,
    argbToRgba,
    bottomBarIcons,
    createCrosshair,
    CrosshairState,
    cursorCornerDistance,
    cursorCornerOffsets,
    isHorseType,
    lookFineAfterMinimapDrag,
    minimapCameraFrame,
    minimapTileColor,
    minimapUnitColor,
    starOverlayClip,
    starShakeOffset,
    tickCrosshair,
    tickCursorAngle,
} from '../sim/BattleHud';
import { GameSim, collectVehiclesFromRaw, createOfficialSim, type PlacedOccupant } from '../sim/GameSim';
import { parseSpawnPoolRows } from '../sim/SpawnPool';
import { formatCooldownLabel, DYNAMITE_TRIGGER_TYPE } from '../sim/Dynamite';
import {
    CARD_REVEAL_TITLE,
    GAMBLER_TYPE,
    parseGamblerHandsRows,
    tickCardReveal,
} from '../sim/Gambler';
import {
    MODE_EASY,
    MODE_HARD,
    MODE_NORMAL,
} from '../sim/EnemyCatalog';
import { TALLY_GROUP_NAMES } from '../sim/ClearTally';
import {
    HUD_FONT_DOLLAR,
    HUD_FONT_NUMBERS,
    HUD_UPGRADE_ARROW,
    HUD_UPGRADE_ICON,
    HUD_WOODEN_SIGN,
    HUD_WOODEN_SIGN_RIGHT,
    PRICE_DOLLAR_CELLS,
    PRICE_NUMBER_CELLS,
    UPGRADE_ARROW_FRAMES,
    UPGRADE_ARROW_FOOT_ANCHOR_X,
    UPGRADE_ARROW_FOOT_ANCHOR_Y,
    UPGRADE_ARROW_GATLING_ANCHOR_X,
    UPGRADE_ARROW_GATLING_ANCHOR_Y,
    UPGRADE_ARROW_GATLING_OFFSET_X,
    UPGRADE_ARROW_GATLING_OFFSET_Y,
    UPGRADE_IMPROVES_HEADING,
    UPGRADE_SIGN_HEIGHT,
    UPGRADE_SIGN_ICON_OFFSET_Y,
    UPGRADE_SIGN_PIVOT_X,
    UPGRADE_SIGN_PIVOT_Y,
    UPGRADE_SIGN_WIDTH,
    isHireableActivity,
    isGatlingUpgradeArrow,
    priceGlyphs,
    shouldDrawUpgradeArrow,
    upgradeArrowFile,
    upgradeArrowFrame,
    upgradeSignAngle,
    upgradeSignProgress,
} from '../sim/HireUpgrade';

import { kindForType } from '../sim/UnitEntity';
import { JavaMillisRng, fineToWorld, tileCenterX, tileCenterY, worldToFine } from '../sim/Fine';
import { campaignProgress, regionIndex } from '../sim/CampaignProgress';
import { isUnitUnlocked } from '../sim/UnitUnlock';
import { DIFFICULTY_LABELS, highScores } from '../sim/Difficulty';
import { takePendingBattleEntry } from '../sim/LevelSelect';
import { loadOptions, createMenuSettings } from '../sim/MenuSettings';
import { playGameSfx, playLevelMusic } from '../sim/SoundEvents';
import { playPortraitVoice } from '../sim/DialogVoice';
import { WAVE_TEXT_PORTRAIT } from '../sim/WavePortrait';
import { applySoundEnabled, clickThenToggleSound, isSoundEnabled } from '../sim/Sound';
import { installGameAudio } from './GameAudio';
import { SaveSession, applyBattle, createLocalStore } from '../sim/SaveGame';
import { BattlefieldCamera, UiTouchGuard } from './BattlefieldCamera';
import {
    CANYON_IMAGE_REMAP,
    STREET_IMAGE_REMAP,
    TerrainMaps,
    WATER_IMAGE_REMAP,
    buildTerrain,
    horizontalPierAt,
} from './terrain/TerrainBuild';
import { RegionPack, logPackAcceptance, packForLevel } from './terrain/RegionPack';
import {
    collectMapObjects,
    logStep6Acceptance,
    MapObjectSet,
    PlacedSprite,
} from './terrain/MapObjects';
import {
    SHOOT_FRAMES,
    enemyWalkFacing,
    frameFromTimeline,
    playerShootFacing,
    playerWalkFacing,
    sleepHatFrame,
    walkFrameForStep,
} from './units/Facing';
import { collectMapUnits, logStep7Acceptance, MapUnit } from './units/MapUnits';
import {
    ACTIVITY_FOR_SALE,
    ACTIVITY_WORKING,
    SLEEP_HAT_ABOVE,
    SLEEP_HAT_FILE,
    SLEEP_HAT_FRAME_H,
    SLEEP_HAT_FRAME_W,
    ENEMY_VISUAL,
    HORSE_WHITE_WALK,
    UnitVisual,
    bodyFileFor,
    visualFor,
    enemyTurnFile,
} from './units/UnitCatalog';
import {
    BULLET_COLOR,
    FIRE_LINE_COLOR,
    FX_TEXTURES,
    SFX_CANNON_SMOKE,
    SFX_DEATH_PIONEERS,
    SFX_EXPLODING_PARTS,
    SFX_EXPLOSION,
    SFX_FIRE,
    SFX_HEAL,
    SFX_POISON,
    SFX_ROCKET_EXPLOSION,
    SFX_ROCKET_SPARKLES,
    SFX_SMOKE_EXPLOSION,
    SFX_LOK_STEAM,
    SFX_STUN,
    STEAM_FRAMES,
    deathBodyVisible,
    deathVisualFor,
    fireOverlayFrame,
    flightFrame,
    healOverlayFrame,
    landingFrame,
    muzzleSmokeFrame,
    pioneerDeathFrame,
    poisonCloudFrame,
    rocketDirection,
    rocketSparkleFrame,
    shotStyleVisual,
    smokeDeathFrame,
    explosionFrame,
    stunOverlayFrame,
} from '../sim/ShotVisual';
import {
    CHEST_ICON_PX,
    CHEST_TEXTURES,
    ChestEntity,
    bonusOverheadFrame,
    chestIconFrame,
    chestIconWobblePx,
    chestVisual,
    iconForChestType,
} from '../sim/ChestSystem';
import { SPEECH_BUBBLE_IMAGE } from '../sim/ChestSystem';
import { bubbleAlpha, bubbleScale } from '../sim/SpeechBubble';

const { ccclass } = _decorator;

const TILE = TILE_PIXELS;

const UI_TEXTBOX_LARGE = 'gng_hud_2_textbox_large';
const UI_TEXTBOX_SMALL = 'gng_hud_2_textbox_small';
const UI_YES = 'gng_hud_2_yes';
const UI_YES_PRESSED = 'gng_hud_2_yes_pressed';
const UI_NO = 'gng_hud_2_no';
const UI_NO_PRESSED = 'gng_hud_2_no_pressed';
const UI_RENAME = 'gng_hud_2_rename';
const UI_RENAME_PRESSED = 'gng_hud_2_rename_pressed';
const UI_HIGHSCORE_BOX = 'gng_highscore_0_box';
const UI_HIGHSCORE_BUTTON = 'gng_highscore_2_button';
const UI_HIGHSCORE_BUTTON_PRESSED = 'gng_highscore_2_button_pressed';
const UI_MENU_BOX = 'gng_startmenu_2_menu_0_box';
const UI_MENU_BUTTON = 'gng_startmenu_2_menu_1_button';
const UI_MENU_BUTTON_PRESSED = 'gng_startmenu_2_menu_1_button_pressed';
const UI_SOUND_ON = 'gng_startmenu_2_menu_2_sound_on';
const UI_SOUND_OFF = 'gng_startmenu_2_menu_2_sound_off';
const UI_SOUND_ON_PRESSED = 'gng_startmenu_2_menu_2_sound_on_pressed';
const UI_SOUND_OFF_PRESSED = 'gng_startmenu_2_menu_2_sound_off_pressed';
const DIALOG_SMALL_WIDTH = 384;
const DIALOG_SMALL_HEIGHT = 128;
/** apk GameObjectSpawnLocation.getImage / overlayOffset：开门图按出生口类型叠在建筑上。 */
const SPAWN_DOOR_FILES: Record<number, string> = {
    1: 'buildings/b_3x2_saloon_open',
    2: 'buildings/b_3x2_fort_open',
    3: 'buildings/b_2x1_tipi_open',
    4: 'buildings/b_3x2_saloon_open',
};
const SPAWN_DOOR_OFFSETS: Record<number, { x: number; y: number }> = {
    1: { x: 3, y: -16 },
    2: { x: -1, y: -8 },
    3: { x: 12, y: 0 },
    4: { x: 3, y: -16 },
};
const DIALOG_LARGE_WIDTH = 384;
const DIALOG_LARGE_HEIGHT = 192;
/** apk：TextAppearance.WidgetGunsAndGloryDialogTextView → android:textColor=@android:color/black（0x0106000c）。 */
const DIALOG_TEXT_COLOR = new Color(0, 0, 0, 255);
const DIALOG_DIFFICULTY_PADDING = 18;
const DIALOG_DIFFICULTY_BUTTON_SPACER = 20;
/** 官方 dialog_select_difficulty.xml：三张头像原图 96×110。 */
const DIFFICULTY_PORTRAIT_FILES = ['portrait_settlers', 'portrait_pedro', 'oregon_dakota_portrait_boss'] as const;
/**
 * 雇佣对话框顺序：对应 T_UNIT_NAME_01…10 / T_UNIT_HIRE_01…10。
 * 单位编号依次是亡命之徒、暴徒、加农炮、本地人、加特林、蒸汽船双炮、猎枪老人、女射手、纵火狂、蛇油商人。
 */
const HIRE_ORDER = [1, 2, 3, 4, 12, 32, 6, 5, 35, 36] as const;
const HIRE_NAMES = [
    '亡命之徒', '暴徒', '加农炮', '本地人', '加特林机枪',
    '斯廷博特双精度加农炮', '猎枪老人', '女神枪手', '纵火狂', '蛇油商人',
] as const;
const HIRE_MESSAGES = [
    '你好啊兄弟！想让我帮你干掉谁？',
    '头儿，干嘛不让我上场？难道没有什么需要炸掉的么？',
    '我的加农炮已经准备好了，头儿！你听到我的请求了没？',
    '勇士们帮忙赶走了白人入侵者、',
    '太棒了',
    '甲板刚被擦洗过，来一个强大的双精度加农炮吧！',
    '我的猎枪充满了胡椒粉，你要我射击这些移民么？',
    '用我的来福枪可以射击那些远到你看不见的移民！',
    '你想看更大的烟花吗？',
    '女士们先生们，来亲自尝试我这有效的令人惊讶的滋补药吧！',
] as const;
const CANNOT_HIRE_MESSAGES = [
    '先去伏击几个当地人，这样你就有钱支付给我了！',
    '如果我是你的话，我可不会这么干。这么热的天，为了这点钱可不值。',
    '没有钱补充弹药的话大炮可不会开火，头儿！',
    '额，巫医说白人都是身携巨款的，你看起来可不像。',
    '我找不到我的扳手了。如果你能找到你装金子的袋子，我也能找到我的扳手了。',
    '火药可不是免费的！',
    '你说什么？我没听到。',
    '价格不可以商量！',
    '没有美元，没有火箭炮！',
    '（咳嗽声），不，孩子们，没有了钱的独特香味我不能呼吸！',
] as const;
/**
 * apk getPortraitResId()：3 号是 deserter（加农炮）、5 号是 calamity（女神枪手）、
 * 6 号是 geezer（猎枪老人）；12/22 火车加特林继承 portrait_engineer，32 是 portrait_captain。
 * 旧表把 3/5/6/12 错位成 engineer/sheriff/deserter/captain，弹窗头像全错。
 */
const UNIT_PORTRAIT: Record<number, string> = {
    1: 'portrait_gunslinger',
    2: 'portrait_mexican',
    3: 'portrait_deserter',
    4: 'portrait_indian',
    5: 'oregon_dakota_portrait_calamity',
    6: 'oregon_dakota_portrait_geezer',
    9: 'portrait_gambler',
    12: 'portrait_engineer',
    22: 'portrait_engineer',
    32: 'portrait_captain',
    35: 'portrait_pyromaniac',
    36: 'portrait_salesman',
};
const UNIT_PORTRAIT_FILES = Object.values(UNIT_PORTRAIT);
/** dialog_content_margin_left = 57dip。 */
const DIALOG_CONTENT_MARGIN = 57;
/** 难度.tsv：一项会按百分比缩放的数值，简单/普通/困难 = 75/100/150。 */
const DIFFICULTY_PERCENT = [75, 100, 150] as const;
function difficultyPercent(tier: number): number {
    return DIFFICULTY_PERCENT[tier] ?? 100;
}
const DIFFICULTY_PORTRAIT_WIDTH = 96;
const DIFFICULTY_PORTRAIT_HEIGHT = 110;
/** 官方 mapscreen_font_size 默认 6dip；另一套尺寸表是 15sp。系统字用 15，才压得进头像底部。 */
const MAPSCREEN_FONT_SIZE = 15;
const DIALOG_LEFT_BUTTON_MARGIN_LEFT = 20;
const DIALOG_RIGHT_BUTTON_MARGIN_RIGHT = 20;
const DIALOG_BUTTON_MARGIN_BOTTOM = 25;
const YES_NO_SIZE = 32;
const MENU_BUTTON_WIDTH = 212;
const MENU_BUTTON_HEIGHT = 52;
const MENU_BOX_WIDTH = 182;
const MENU_BOX_HEIGHT = 252;
const SOUND_BUTTON_WIDTH = 107;
const SOUND_BUTTON_HEIGHT = 60;
const MAIN_MENU_BUTTON_AREA_MARGIN_TOP = 37;
const MAIN_MENU_SOUND_MARGIN_TOP = -28;
const MAIN_MENU_SOUND_MARGIN_RIGHT = 3;
// 原版 dialog_new_highscore.xml + dimen_default.tsv：384×192 弹窗，
// paddingTop=30，标题与输入框同宽 330、水平居中，输入框 marginTop=10。
const HIGHSCORE_NAME_WIDTH = 330;
const HIGHSCORE_PADDING_TOP = 30;
const HIGHSCORE_EDIT_MARGIN_TOP = 10;
const HIGHSCORE_EDIT_HEIGHT = 36;
const HIGHSCORE_YES_MARGIN_LEFT = 10;
const HIGHSCORE_YES_MARGIN_BOTTOM = 5;
const UI_DIALOG_FILES = [
    UI_TEXTBOX_LARGE,
    UI_TEXTBOX_SMALL,
    UI_YES,
    UI_YES_PRESSED,
    UI_NO,
    UI_NO_PRESSED,
    UI_RENAME,
    UI_RENAME_PRESSED,
    UI_HIGHSCORE_BOX,
    UI_HIGHSCORE_BUTTON,
    UI_HIGHSCORE_BUTTON_PRESSED,
    UI_MENU_BOX,
    UI_MENU_BUTTON,
    UI_MENU_BUTTON_PRESSED,
    UI_SOUND_ON,
    UI_SOUND_OFF,
    UI_SOUND_ON_PRESSED,
    UI_SOUND_OFF_PRESSED,
];


interface TileSheet {
    /** 每张图单独编号。不能只用宽高当缓存键，否则 32×32 的水和沙地会画成同一张。 */
    id: number;
    texture: Texture2D;
    /** 这张图在贴图里的左上角。单张 png 是 0，进了合图则是该图在大图里的位置。 */
    originX: number;
    originY: number;
    width: number;
    height: number;
}

let nextSheetId = 1;

/** 地图字节上的装饰、房子、火车和船。脚踩在格子底边，水平以格子中心对齐。占两格宽的小屋再向左偏半格。 */

interface TileBlit {
    sheet: TileSheet;
    col: number;
    row: number;
    width: number;
    height: number;
}

type TerrainDepthNode = Node & { __terrainDrawOrder?: number };

interface UnitBinding {
    id: number;
    /** 单位类型编号，用来取开枪时间轴。 */
    type: number;
    root: Node;
    body: Node;
    bodySprite: Sprite;
    hat: Node | null;
    vis: UnitVisual;
    lastActivity: number;
    /** Java animStep：按走过的 fine 距离累加，0–3072 循环。 */
    animStep: number;
    lastFineX: number;
    lastFineY: number;
    /** apk animFrmY：站立时保持上一次行走/开枪的朝向，不会自己转回朝下。 */
    lastFaceRow: number;
    lastFaceFlip: boolean;
    fire?: Node | null;
    stun?: Node | null;
    heal?: Node | null;
    deathFx?: Node | null;
    upgradeArrow?: Node | null;
    /** 敌人头顶血条（GunsAndGloryThread.drawEnemies 里的红底/渐变条）。 */
    hpBar?: Graphics | null;
    /** apk GameObjectUnit.draw：bonusAttribute>0 && bonusCounter>0 时头顶的奖励图标。 */
    bonus?: Node | null;
    /** 头顶图标的摆动相位（apk animTime，0–1 往返）。 */
    bonusAnimTime?: number;
    bonusAnimDir?: number;
}

/**
 * 第 5–7 步：把地形、物件和地图上的单位铺到 Playfield 上。
 * 不要把这个组件写进场景文件，由 Boot 在运行时挂上。
 */
@ccclass('TerrainView')
export class TerrainView extends Component {
    private _lens: BattlefieldCamera | null = null;
    private _sheets = new Map<string, TileSheet>();
    private _frameCache = new Map<string, SpriteFrame>();
    private _sleepHats: Sprite[] = [];
    private _lastSleepFrame = -1;
    /** 出生口开门图：屏幕节点 + 对应垫子坐标，spawningMode 时显示。 */
    private _spawnDoors: Array<{ col: number; row: number; node: Node }> = [];
    private _sim: GameSim | null = null;
    private _levelLoading = false;
    private _maps: TerrainMaps | null = null;
    private _bindings: UnitBinding[] = [];
    private _enemyBindings: UnitBinding[] = [];
    /** APK drawWeapon()：vehicles type 12/22/32 的炮管节点，unitId→Node。activityStatus>4 时显示。 */
    private _vehicleWeapons = new Map<number, Node>();
    /**
     * 车身贴图。原版每节车厢/船体都是 GameObjectCompoundUnit 单位，draw 用自己的坐标，所以整列跟着走；
     * 项目里车身是 MapObjects 生成的静态 PlacedSprite，之前建关摆完就不动，只有炮管在跟着单位跑。
     */
    private _vehicleBodies: Array<{
        unitId: number;
        unitType: number;
        col: number;
        row: number;
        maps: TerrainMaps;
        node: Node;
        offX: number;
        offY: number;
        baseOrder: number;
        fineY0: number;
    }> = [];
    private _arrow: Node | null = null;
    /** apk mWaveArrowAnimator / mWaveArrowAnimationdirection：1..9 往返。 */
    private _waveArrowAnim = 1;
    private _waveArrowDir = 1;
    private _spawnArrows: Array<{ arrow: Node; hat: Node | null; file: string } | undefined> = [];
    private _worldCanvas: Node | null = null;
    private _decorLayer: Node | null = null;
    /** 敌人/友军单位层：在 Background 之上、Frame/Street/Piers/Decor 之下。 */
    private _unitLayer: Node | null = null;
    private _draggingUnit = false;
    private _livesLabel: Label | null = null;
    private _livesBaseX = 0;
    private _livesBaseY = 0;
    private _waveLabel: Label | null = null;
    private _countdownLabel: Label | null = null;
    private _cashSlot: Node | null = null;
    private _currentWaveSlot: Node | null = null;
    private _maxWaveSlot: Node | null = null;
    private _countdownRoot: Node | null = null;
    /** apk signal_rotate_*_right：倒计时牌子绕“宽度中间、高度 130%”的点旋转进出。 */
    private _countdownPivot: Node | null = null;
    private _countdownDigits: Node | null = null;
    /** 倒计时当前是否处于可见（进入）状态，用来只在 0→正数 / 正数→0 时各播一次动画。 */
    private _countdownShown = false;
    /** 上一次画到牌子上的数字，避免每帧重建数字精灵。 */
    private _countdownText = '';
    private _rangeCircle: Node | null = null;
    private _shotGfx: Graphics | null = null;
    private _shotSprites = new Map<number, Node>();
    private _fxSprites = new Map<string, Node>();
    private _chestSprites = new Map<string, Node>();
    private _chestLayer: Node | null = null;
    private _bubbleRoot: Node | null = null;
    private _cashLabel: Label | null = null;
    private _hudRoot: Node | null = null;
    private _topHudGroup: Node | null = null;
    private _shopDialog: Node | null = null;
    private _cardDialog: Node | null = null;
    private _cooldownLabels = new Map<number, Label>();
    private _upgradeSign: Node | null = null;
    /** signal_rotate_in_left 的旋转节点：绕 (50%, 130%) 摆动，命中框保持不动。 */
    private _upgradeSignPivot: Node | null = null;
    private _signWanted = false;
    private _signHiding = false;
    private _signAnimMs = 0;
    private _signReady = false;
    /** apk mStartedOnUpgradeSign：按下落在牌子上就吃掉这次触摸，抬起不再选中单位。 */
    private _signPressed = false;
    private _touchMoved = false;
    private _touchStartX = 0;
    private _touchStartY = 0;
    private _playLevel = 1;
    private _mapObjects: MapObjectSet | null = null;
    private _mapUnits: MapUnit[] = [];
    private _tables: GameTables | null = null;
    private _outcomeDialog: Node | null = null;
    private _tallyLabel: Label | null = null;
    /** 结算对话框里逐行刷新的数字。 */
    private _statRows: { group: number; count: Label; cash: Label }[] = [];
    private _statCashLabel: Label | null = null;
    private _statTotalLabel: Label | null = null;
    private _statTier = MODE_NORMAL;
    /** 波次对话（Pedro）。 */
    private _messageDialog: Node | null = null;
    private _strings = new Map<string, string>();
    private _stringsLoaded = false;
    private _shownWaveTexts = new Set<string>();
    /** apk CustomDialog 的 dialog_slide_out：同一节点不重复起退出动画。 */
    private _dialogClosing = new WeakSet<Node>();
    private _nameBox: EditBox | null = null;
    private _saves: SaveSession | null = null;
    private _continuePending = false;
    private _pauseButton: Node | null = null;
    private _pausePressed = false;
    private _pauseDialog: Node | null = null;
    private _pauseQuestionDialog: Node | null = null;
    private _pauseOptionsDialog: Node | null = null;
    private _starFull: Node | null = null;
    private _starCover: Node | null = null;
    private _starDigits: Node | null = null;
    private _starDigitsDrawn = '';
    private _starArea: Node | null = null;
    private _starShakeDir = 0;
    private _starShakeLastBucket = -1;
    private _bottomBar: Node | null = null;
    /** 底栏裁剪层：只露出停靠线以上的部分，让滑入动画从边框“后面”冒出。 */
    private _bottomClip: Node | null = null;
    private _countdownClip: Node | null = null;
    private _signClip: Node | null = null;
    /** 底栏滑入进度 0（收起）–1（完全露出）。 */
    private _bottomBarAnim = 0;
    private _minimap: Node | null = null;
    private _minimapGfx: Graphics | null = null;
    private _minimapObjectSize = 4;
    private _draggingMinimap = false;
    private _touchMode = true;
    private _cursorRoot: Node | null = null;
    private _selectorRoot: Node | null = null;
    private _crosshairRoot: Node | null = null;
    private _cursorAngle = 0;
    private _crosshair: CrosshairState = createCrosshair();
    private _hoverFineX = 0;
    private _hoverFineY = 0;
    private _hasHover = false;


    onLoad(): void {
        this._lens = this.node.scene?.getChildByName('BattleRoot')?.getComponent(BattlefieldCamera) ?? null;
    }

    onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        input.on(Input.EventType.MOUSE_MOVE, this._onMouseMove, this);
    }

    onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        input.off(Input.EventType.MOUSE_MOVE, this._onMouseMove, this);
        UiTouchGuard.blocked = false;
    }

    update(dt?: number): void {
        if (!GameTime.dialogOpen) {
            GameTime.setBattleUiFocused(true);
        }
        if (this._sim && GameTime.dtMs > 0) {
            this._sim.tick(GameTime.dtMs);
        }
        // apk 主循环 GunsAndGloryThread.run L812：每帧（不是只在触摸回调里）
        // 检查选中单位是否越过 mSafeArea，并按 speed*dt 渐进推动镜头。
        if (this._sim && this._lens && this._sim.arrowVisible() && GameTime.dtMs > 0) {
            const selected = this._sim.unitById(this._sim.selectedId);
            if (selected && selected.alive) {
                this._lens.edgePushSelected(
                    selected.fineX,
                    this._maps!.rows * 7680 - selected.fineY,
                    selected.speed,
                    selected.bonusAttribute,
                    GameTime.dtMs,
                );
            }
        }
        this._syncUnits();
        this._syncVehicleWeapons();
        this._syncVehicleBodies();
        this._syncEnemies();
        this._syncShots();
        this._syncFx();
        this._syncSleepHats();
        this._syncSpawnDoors();
        this._syncArrow();
        this._syncSpawnArrows((dt ?? 0) * 1000);
        this._syncLives();
        this._syncWaveHud();
        this._syncRangeCircle();
        this._syncCashHud();
        this._syncUpgradeArrows();
        this._syncChests();
        this._syncSpeechBubble();
        this._syncTopHudAnchor();
        this._syncBottomBar();
        this._syncLowerHudAnchors();
        this._syncSelectionOverlays();
        this._syncMinimap();
        let uiMs = (dt ?? 0) * 1000;
        if (uiMs < 0) {
            uiMs = 0;
        } else if (uiMs > 100) {
            uiMs = 100;
        }
        this._syncUpgradeSign(uiMs);
        this._tickCardReveal(uiMs);
        this._syncCooldownLabels();
        this._syncOutcomeUi(uiMs);
        this._syncWaveText();
    }

    public async showLevel(level: number, options?: { resume?: boolean }): Promise<void> {
        this._levelLoading = true;
        const pending = takePendingBattleEntry();
        const resume = options?.resume === true || pending?.resume === true;
        if (resume && pending?.level && pending.level >= 1) {
            level = pending.level;
        }
        installGameAudio();
        playLevelMusic(level);
        const pack = packForLevel(level);
        logPackAcceptance();
        const tables = GameTables.current ?? await GameTables.load();
        const grid = await tables.loadMap(pack.mapName);
        const maps = buildTerrain(grid.cols, grid.rows, grid.cells);
        const finished = campaignProgress.finishedLevels();
        const objects = collectMapObjects(maps.cols, maps.rows, maps.raw, pack.snowDecor, isUnitUnlocked(9, level, finished));
        // apk GameObjectUnit.create 对未解锁单位返回 null，地图字节里的这些格子不生成单位。
        const units = collectMapUnits(maps.cols, maps.rows, maps.raw)
            .filter((u) => isUnitUnlocked(u.type, level, finished));
        const gamblersUnlocked = isUnitUnlocked(9, level, finished);
        for (let row = 0; row < maps.rows; row++) {
            for (let col = 0; col < maps.cols; col++) {
                if (maps.raw[row * maps.cols + col] !== 132 || !gamblersUnlocked) {
                    continue;
                }
                if (units.some((u) => u.col === col && u.row === row && u.type === 9)) {
                    continue;
                }
                const vis = visualFor(9, false);
                units.push({
                    col,
                    row,
                    type: 9,
                    activity: ACTIVITY_WORKING,
                    isEnemy: false,
                    name: vis?.name ?? '赌徒',
                });
            }
        }
        this._maps = maps;
        this._playLevel = level;
        this._shownWaveTexts.clear();
        void this._loadStrings();
        this._mapObjects = objects;
        this._mapUnits = units;
        this._tables = tables;
        this._buildSim(level, maps, objects, units, tables);
        await this._loadTextures(pack);
        await this._loadObjects(objects);
        await this._loadUnits(units);
        await this._loadFxTextures();
        await this._loadMoveArrow();
        await this._loadHireHudTextures();
        await this._loadBattleHudTextures();
        if (this._lens) {
            this._lens.setMapSize(maps.cols, maps.rows);
            this._lens.lookAtLeft();
        }
        this._paint(maps, pack, objects, units);
        this._hud(level, pack, maps);
        logStep6Acceptance(level, maps.cols, maps.rows, maps.raw, objects);
        logStep7Acceptance(level, maps.cols, maps.rows, maps.raw, units);
        console.log(`[Terrain] 正在播放第${level}关 ${pack.mapName} ${maps.cols}x${maps.rows} 图集 ${pack.prefix}`);
        console.log('[Walk] 第8步：已雇的人可以拖，待售的人点了不会叫醒；第1关没有酒馆，2→3→4 由自检验证');
        const waves = this._sim?.waves;
        console.log(`[Wave] 第10步：第 ${level} 关共 ${waves?.waveCount ?? 0} 波，第 1 波按表出兵，点倒计时可加快等待`);
        this._continuePending = false;
        this._levelLoading = false;
        if (resume) {
            this._applyMidSaveIfAny();
        } else {
            this._openDifficultyDialog();
        }
    }

    private async _loadTextures(pack: RegionPack): Promise<void> {
        this._sheets.clear();
        this._frameCache.clear();
        const base = await loadBundle('base');
        const region = await loadBundle(pack.bundle);
        // 峡谷地面六个地区都用原来的 tiles_canyon_floor，只存在于新墨西哥/内华达包，不在 base。
        const floorSource = pack.bundle === 'nevada' ? region : await loadBundle('new-mexico');
        const regionNames = [
            'canyon', 'canyon_wall_var', 'desert', 'desert_var',
            'waterside', 'waterside_var', 'path', 'path_var',
        ];
        for (const name of regionNames) {
            await this._loadFirst(pack.prefix + name, [
                [region, `tiles/${pack.prefix}${name}`],
            ]);
        }
        const sharedFromBase = [
            'tiles_shadow', 'tiles_shadow_var',
            'tiles_water',
            'tiles_bridge_hori', 'tiles_bridge_verti',
            'tiles_bridge_pier_left', 'tiles_bridge_pier_right',
            'tiles_railway_hori', 'tiles_railway_verti',
        ];
        for (const name of sharedFromBase) {
            await this._loadFirst(name, [
                [base, `tiles-shared/${name}`],
                [region, `tiles/${name}`],
                [floorSource, `tiles/${name}`],
            ]);
        }
        for (const name of ['tiles_canyon_floor', 'tiles_canyon_floor_var']) {
            await this._loadFirst(name, [
                [region, `tiles/${name}`],
                [floorSource, `tiles/${name}`],
                [base, `tiles-shared/${name}`],
            ]);
        }
        if (pack.ice) {
            await this._loadFirst('tiles_icefloes', [
                [region, 'tiles/tiles_icefloes'],
            ]);
        }
        await this._loadFirst('gng_frame', [
            [base, 'ui/其他/gng_frame'],
        ]);
    }

    private async _loadFirst(key: string, candidates: Array<[AssetManager.Bundle, string]>): Promise<void> {
        const tried: string[] = [];
        for (const [bundle, path] of candidates) {
            tried.push(path);
            try {
                this._sheets.set(key, sheetFrom(await loadAsset(bundle, path)));
                return;
            } catch {
                // 换下一个位置再试。
            }
        }
        console.error('[Terrain] 读图失败', key, tried.join(' | '));
    }

    private _paint(maps: TerrainMaps, pack: RegionPack, objects: MapObjectSet, units: MapUnit[]): void {
        this._spawnDoors = [];
        this._vehicleBodies = [];
        const root = this._worldRoot(maps.cols, maps.rows);
        const bgNode = this._layer(root, 'Background', maps);
        // GunsAndGloryThread_run 绘制顺序：背景 → 敌人 → 边框 → 吊桥/栈桥 → 物件。
        // 单位层必须夹在背景和 Frame 之间，敌人和马车才会被边框与吊桥压住。
        const unitNode = this._layer(root, 'Units', maps);
        const frameNode = this._layer(root, 'Frame', maps);
        const streetNode = this._layer(root, 'Street', maps);
        const pierNode = this._layer(root, 'Piers', maps);
        const decorNode = this._layer(root, 'Decor', maps);
        this._unitLayer = unitNode;

        for (let row = 0; row < maps.rows; row++) {
            for (let col = 0; col < maps.cols; col++) {
                const bg = maps.background[row * maps.cols + col];
                const blit = this._backgroundBlit(bg, pack);
                if (blit) {
                    this._place(bgNode, `bg_${col}_${row}`, col, row, maps.rows, blit, 32, 32);
                }
            }
        }

        this._paintFrame(frameNode, maps);

        for (let row = 0; row < maps.rows; row++) {
            for (let col = 0; col < maps.cols; col++) {
                const st = maps.street[row * maps.cols + col];
                const blit = this._streetBlit(st);
                if (blit) {
                    this._place(streetNode, `st_${col}_${row}`, col, row, maps.rows, blit, blit.width, blit.height, true);
                }
                const pier = horizontalPierAt(maps, col, row);
                if (pier === 'left') {
                    this._placePier(pierNode, `pierL_${col}_${row}`, col, row, maps.rows, 'left');
                } else if (pier === 'right') {
                    this._placePier(pierNode, `pierR_${col}_${row}`, col, row, maps.rows, 'right');
                }
            }
        }

        this._decorLayer = decorNode;
        this._paintObjects(decorNode, maps, objects, units);
    }

    private async _loadNamedSheet(bundle: AssetManager.Bundle, key: string): Promise<boolean> {
        if (this._sheets.has(key)) {
            return true;
        }
        for (const path of assetPathCandidates(key)) {
            try {
                this._sheets.set(key, sheetFrom(await loadAsset(bundle, path)));
                return true;
            } catch {
                // 试下一个路径
            }
        }
        return false;
    }

    private async _loadObjects(objects: MapObjectSet): Promise<void> {
        const needed = new Set<string>();
        for (const sprite of objects.sprites) {
            needed.add(sprite.file);
            if (sprite.kind === 'building') {
                const door = SPAWN_DOOR_FILES[sprite.unitType];
                if (door) {
                    needed.add(door);
                }
            }
        }
        // APK：drawWeapon() 运行时绘制炮管，不再作为静态 map sprite 加载。
        // 这里硬编码需要的炮管贴图。
        needed.add('units/player_gatling');
        needed.add('units/player_double_cannon');
        if (needed.size === 0) {
            return;
        }
        const base = await loadBundle('base');
        for (const file of needed) {
            if (!(await this._loadNamedSheet(base, file))) {
                console.error('[Terrain] 装饰读图失败', file, assetPathCandidates(file).join(' | '));
            }
        }
    }

    private _paintObjects(parent: Node, maps: TerrainMaps, objects: MapObjectSet, units: MapUnit[]): void {
        type PaintItem = { order: number; place: () => void };
        const items: PaintItem[] = [];
        for (const item of objects.sprites) {
            items.push({ order: placedObjectDrawOrder(item), place: () => this._placeObject(parent, maps, item) });
        }
        for (const unit of units) {
            items.push({ order: mapUnitDrawOrder(unit.type, unit.row * 7680 + 5760), place: () => this._placeUnit(parent, maps, unit) });
        }
        // GameObjectManager.insertDrawOrder：按 fineY + drawingOffsetY + fineZ * 100，而不是按 row/col。
        items.sort((a, b) => a.order - b.order);
        for (const item of items) {
            item.place();
        }
    }

    private _placeObject(parent: Node, maps: TerrainMaps, item: PlacedSprite): void {
        const sheet = this._sheets.get(item.file);
        if (!sheet) {
            return;
        }
        const sliced = item.sliceRow >= 0;
        const width = sliced ? TILE : sheet.width;
        const height = sliced ? TILE : sheet.height;
        const blit: TileBlit = {
            sheet,
            col: 0,
            row: sliced ? item.sliceRow : 0,
            width,
            height,
        };
        const origin = tileBottomLeft(item.col, item.row, maps.rows);
        const centerX = origin.x + TILE / 2 - (item.wide - 1) * (TILE / 2);
        const nodeWidth = width + item.extraRight;
        const node = this._sprite(parent, item.name, this._frame(blit), nodeWidth, height);
        (node as TerrainDepthNode).__terrainDrawOrder = placedObjectDrawOrder(item);
        node.setPosition(centerX - width / 2, origin.y, 0);
        if (item.kind === 'vehicle') {
            this._bindVehicleBody(node, item, maps, placedObjectDrawOrder(item));
        }
        if (item.kind === 'building') {
            const doorFile = SPAWN_DOOR_FILES[item.unitType];
            const doorSheet = doorFile ? this._sheets.get(doorFile) : undefined;
            if (doorSheet) {
                // apk：开门图叠在建筑上，overlayOffset 相对建筑底边；默认关着，垫子 spawningMode 时打开。
                const off = SPAWN_DOOR_OFFSETS[item.unitType] ?? { x: 0, y: 0 };
                const door = this._sprite(parent, `${item.name}_open`, this._frame({
                    sheet: doorSheet,
                    col: 0,
                    row: 0,
                    width: doorSheet.width,
                    height: doorSheet.height,
                }), doorSheet.width, doorSheet.height);
                (door as TerrainDepthNode).__terrainDrawOrder = placedObjectDrawOrder(item) + 1;
                door.setPosition(centerX + off.x - doorSheet.width / 2, origin.y + off.y, 0);
                door.active = false;
                this._spawnDoors.push({ col: item.col, row: item.row, node: door });
            }
        }
    }

    /** apk GameObjectSpawnLocation.draw：开门期间在建筑上叠开门图，人走出来、计数归零后关门。 */
    private _syncSpawnDoors(): void {
        if (!this._sim || this._spawnDoors.length === 0) {
            return;
        }
        for (const door of this._spawnDoors) {
            if (!door.node.isValid) {
                continue;
            }
            const mat = this._sim.mats.find((m) => m.col === door.col && m.row === door.row);
            const open = mat?.spawningMode === true;
            if (door.node.active !== open) {
                door.node.active = open;
            }
        }
    }

    private async _loadUnits(units: MapUnit[]): Promise<void> {
        this._sleepHats = [];
        this._lastSleepFrame = -1;
        this._bindings = [];
        const needed = new Set<string>();
        let anySale = false;
        for (const unit of units) {
            const vis = visualFor(unit.type, unit.isEnemy);
            if (!vis) {
                continue;
            }
            needed.add(bodyFileFor(vis, unit.activity));
            if (vis.walk) {
                needed.add(vis.walk);
            }
            if (vis.shot) {
                needed.add(vis.shot);
            }
            if (unit.activity === ACTIVITY_FOR_SALE) {
                anySale = true;
            }
        }
        if (anySale) {
            needed.add(SLEEP_HAT_FILE);
        }
        for (const vis of Object.values(ENEMY_VISUAL)) {
            if (vis.walk) {
                needed.add(vis.walk);
            }
        }
        // 马有一半概率用白马图（apk setImageForUnit case 8），不在 ENEMY_VISUAL 里，必须一起预载，
        // 否则 _showWalk/_placeEnemy 取不到 sheet 会直接不画 → 有棚无马。
        needed.add(HORSE_WHITE_WALK);
        // 载具炮管开火时整张换 *_shot（apk setImageForUnitShoot），没预载就只能一直画静态炮管。
        for (const weaponFile of ['units/player_gatling', 'units/player_double_cannon']) {
            needed.add(weaponFile);
            needed.add(`${weaponFile}_shot`);
        }
        // 转向横条（apk setImageForTurningUnit 用到的 *_turn）拐弯那一帧才画，缺图就画成上一帧的走路图。
        for (let type = 1; type <= 9; type++) {
            for (const white of [false, true]) {
                const turn = enemyTurnFile(type, white);
                if (turn) {
                    needed.add(turn);
                }
            }
        }
        if (needed.size === 0) {
            return;
        }
        const base = await loadBundle('base');
        for (const file of needed) {
            if (!(await this._loadNamedSheet(base, file))) {
                console.error('[Units] 读图失败', file, assetPathCandidates(file).join(' | '));
            }
        }
    }

    private _placeUnit(parent: Node, maps: TerrainMaps, unit: MapUnit): void {
        const vis = visualFor(unit.type, unit.isEnemy);
        if (!vis) {
            return;
        }
        const file = bodyFileFor(vis, unit.activity);
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return;
        }
        const sale = unit.activity === ACTIVITY_FOR_SALE;
        const width = sale || !vis.walk ? sheet.width : vis.frameW;
        const height = sale || !vis.walk ? sheet.height : vis.frameH;
        const frameCol = 0;
        const frameRow = sale || !vis.walk ? 0 : (vis.isEnemy ? 1 : 3);
        const bodyFrame = this._sheetFrame(sheet, frameCol, frameRow, width, height);
        const origin = tileBottomLeft(unit.col, unit.row, maps.rows);
        const centerX = origin.x + TILE / 2;
        const root = new Node(`unit_${unit.col}_${unit.row}_${unit.type}`);
        parent.addChild(root);
        root.layer = Layers.Enum.DEFAULT;
        (root as TerrainDepthNode).__terrainDrawOrder = mapUnitDrawOrder(unit.type, unit.row * 7680 + 5760);
        root.setPosition(centerX, origin.y, 0);

        const body = this._sprite(root, 'body', bodyFrame, width, height);
        const bodyUt = body.getComponent(UITransform);
        if (bodyUt) {
            bodyUt.setAnchorPoint(0.5, 0);
        }
        body.setPosition(0, 0, 0);

        let hatNode: Node | null = null;
        if (sale) {
            hatNode = this._buildSleepHat(root);
        }
        const simUnit = this._sim?.units.find((u) => u.type === unit.type && u.fullX === unit.col && u.fullY === unit.row);
        const bodySprite = body.getComponent(Sprite);
        if (simUnit && bodySprite) {
            this._bindings.push({
                id: simUnit.id,
                type: simUnit.type,
                root,
                body,
                bodySprite,
                hat: hatNode,
                vis,
                lastActivity: unit.activity,
                animStep: 0,
                lastFineX: simUnit.fineX,
                lastFineY: simUnit.fineY,
                lastFaceRow: 3,
                lastFaceFlip: false,
            });
            const pos = fineToWorld(simUnit.fineX, simUnit.fineY, maps.rows);
            (root as TerrainDepthNode).__terrainDrawOrder = mapUnitDrawOrder(simUnit.type, simUnit.fineY);
            root.setPosition(pos.x, pos.y, 0);
        }
    }

    /** 按这一帧的真实宽高切，人物高 44、移民高 24，不能再用 32 当行距。 */
    private _sheetFrame(sheet: TileSheet, col: number, row: number, frameW: number, frameH: number): SpriteFrame {
        const key = `${sheet.id}_${col}_${row}_${frameW}x${frameH}`;
        const cached = this._frameCache.get(key);
        if (cached) {
            return cached;
        }
        const tex = sheet.texture;
        tex.packable = false;
        const x = sheet.originX + col * frameW;
        const y = sheet.originY + row * frameH;
        const sf = new SpriteFrame();
        sf.texture = tex;
        sf.rect = new Rect(x, y, frameW, frameH);
        sf.originalSize = new Size(frameW, frameH);
        sf.offset = new Vec2(0, 0);
        sf.packable = false;
        this._frameCache.set(key, sf);
        return sf;
    }

    private _backgroundBlit(value: number, pack: RegionPack): TileBlit | null {
        if (value === 0) {
            return this._tile('tiles_desert', pack, 0, 0);
        }
        if (value >= 1 && value <= 15) {
            const rem = CANYON_IMAGE_REMAP[value];
            if (rem < 0) {
                return null;
            }
            return this._tile('tiles_canyon', pack, rem % 4, Math.floor(rem / 4));
        }
        if (value >= 17 && value <= 19) {
            return this._tile('tiles_desert_var', pack, value - 17, 0);
        }
        if (value >= 21 && value <= 23) {
            return this._tile('tiles_canyon_wall_var', pack, value - 21, 0);
        }
        if (value >= 25 && value <= 27) {
            return this._tile('tiles_canyon_wall_var', pack, value - 25 + 3, 0);
        }
        if (value >= 29 && value <= 31) {
            return this._tile('tiles_canyon_wall_var', pack, value - 29, 1);
        }
        if (value >= 33 && value <= 35) {
            return this._tile('tiles_canyon_wall_var', pack, value - 33 + 3, 1);
        }
        if (value >= 48 && value < 56) {
            return this._shared('tiles_canyon_floor', 0, 0);
        }
        if (value >= 56 && value < 64) {
            return this._shared('tiles_shadow', value - 56, 0);
        }
        if (value >= 65 && value <= 67) {
            return this._shared('tiles_canyon_floor_var', value - 65, 0);
        }
        if (value >= 69 && value <= 71) {
            return this._shared('tiles_shadow_var', value - 69, 0);
        }
        if (value >= 73 && value <= 75) {
            return this._shared('tiles_shadow_var', value - 73 + 3, 0);
        }
        if (value === 96) {
            return this._shared('tiles_water', 0, 0);
        }
        if (value >= 97 && value <= 111) {
            const rem = WATER_IMAGE_REMAP[value - 96];
            if (rem < 0) {
                return null;
            }
            return this._tile('tiles_waterside', pack, rem % 4, Math.floor(rem / 4));
        }
        if (value >= 113 && value <= 115) {
            return this._tile('tiles_waterside_var', pack, value - 113, 0);
        }
        if (value >= 117 && value <= 119) {
            return this._tile('tiles_waterside_var', pack, value - 117 + 3, 0);
        }
        if (value >= 121 && value <= 123) {
            return this._tile('tiles_waterside_var', pack, value - 121, 1);
        }
        if (value >= 125 && value <= 127) {
            return this._tile('tiles_waterside_var', pack, value - 125 + 3, 1);
        }
        if (pack.ice && value >= 160 && value <= 162) {
            return this._shared('tiles_icefloes', value - 160, 0);
        }
        return null;
    }

    private _streetBlit(value: number): TileBlit | null {
        if (value >= 16 && value < 32) {
            const rem = STREET_IMAGE_REMAP[value - 16];
            return this._shared('tiles_path', rem % 4, Math.floor(rem / 4));
        }
        if (value >= 33 && value <= 35) {
            return this._shared('tiles_path_var', value - 33 + 3, 0);
        }
        if (value >= 37 && value <= 39) {
            return this._shared('tiles_path_var', value - 37, 0);
        }
        if (value === 64) {
            return this._whole('tiles_bridge_hori');
        }
        if (value === 68 || value === 72) {
            return this._whole('tiles_railway_hori');
        }
        if (value === 76) {
            return this._whole('tiles_bridge_verti');
        }
        if (value === 80 || value === 84) {
            return this._whole('tiles_railway_verti');
        }
        return null;
    }

    private _tile(logical: string, pack: RegionPack, col: number, row: number): TileBlit | null {
        const key = logical.replace(/^tiles_/, pack.prefix);
        const sheet = this._sheets.get(key) ?? this._sheets.get(logical);
        if (!sheet) {
            return null;
        }
        return { sheet, col, row, width: TILE, height: TILE };
    }

    private _shared(key: string, col: number, row: number): TileBlit | null {
        // 路图在地区包里，可能是 tiles_path / miss_tiles_path。
        const sheet = this._sheets.get(key)
            ?? this._findBySuffix(key.replace(/^tiles_/, ''));
        if (!sheet) {
            return null;
        }
        return { sheet, col, row, width: TILE, height: TILE };
    }

    private _whole(key: string): TileBlit | null {
        const sheet = this._sheets.get(key);
        if (!sheet) {
            return null;
        }
        return { sheet, col: 0, row: 0, width: sheet.width, height: sheet.height };
    }

    private _findBySuffix(suffix: string): TileSheet | undefined {
        for (const [key, sheet] of this._sheets) {
            if (key.endsWith(suffix) || key.endsWith(`_${suffix}`)) {
                return sheet;
            }
        }
        return undefined;
    }

    private _place(
        parent: Node,
        name: string,
        col: number,
        row: number,
        mapRows: number,
        blit: TileBlit,
        drawW: number,
        drawH: number,
        centerIfOversized = false,
    ): void {
        const origin = tileBottomLeft(col, row, mapRows);
        let x = origin.x;
        let y = origin.y;
        const w = centerIfOversized ? drawW : TILE;
        const h = centerIfOversized ? drawH : TILE;
        if (centerIfOversized) {
            x += (TILE - drawW) / 2;
            y += (TILE - drawH) / 2;
        }
        const node = this._sprite(parent, name, this._frame(blit), w, h);
        node.setPosition(x, y, 0);
    }

    private _placePier(parent: Node, name: string, col: number, row: number, mapRows: number, side: 'left' | 'right'): void {
        const key = side === 'left' ? 'tiles_bridge_pier_left' : 'tiles_bridge_pier_right';
        const sheet = this._sheets.get(key);
        if (!sheet) {
            return;
        }
        const blit: TileBlit = { sheet, col: 0, row: 0, width: sheet.width, height: sheet.height };
        const origin = tileBottomLeft(col, row, mapRows);
        const w = sheet.width;
        const h = sheet.height;
        let x: number;
        let y: number;
        if (side === 'left') {
            // 左桥墩：相对这一格左边再往左 8 像素；底边比格子底边低 16 像素（原版 24 高的图，顶在格子底边上 8 像素）。
            x = origin.x - 8;
            y = origin.y - 16;
        } else {
            // 右桥墩画在段落后一格：右缘超出前一格右缘 8 像素。
            const prevRight = origin.x;
            x = prevRight - w + 8;
            y = origin.y - 16;
        }
        const node = this._sprite(parent, name, this._frame(blit), w, h);
        node.setPosition(x, y, 0);
    }

    private _paintFrame(parent: Node, maps: TerrainMaps): void {
        const sheet = this._sheets.get('gng_frame');
        if (!sheet) {
            return;
        }
        const rows = maps.rows;
        const cols = maps.cols;
        const put = (name: string, frameCol: number, frameRow: number, mapCol: number, mapRow: number): void => {
            const blit: TileBlit = { sheet, col: frameCol, row: frameRow, width: TILE, height: TILE };
            const origin = tileBottomLeft(mapCol, mapRow, rows);
            const node = this._sprite(parent, name, this._frame(blit), TILE, TILE);
            node.setPosition(origin.x, origin.y, 0);
        };
        // 紧贴地图的一圈。
        put('f_tl', 0, 0, -1, -1);
        put('f_tr', 2, 0, cols, -1);
        put('f_bl', 2, 1, -1, rows);
        put('f_br', 0, 1, cols, rows);
        for (let c = 0; c < cols; c++) {
            put(`f_top_${c}`, 1, 0, c, -1);
            put(`f_bot_${c}`, 1, 1, c, rows);
        }
        for (let r = 0; r < rows; r++) {
            put(`f_left_${r}`, 3, 1, -1, r);
            put(`f_right_${r}`, 3, 0, cols, r);
        }
        // 再往外一格。
        put('f2_tl', 0, 2, -2, -2);
        put('f2_tr', 2, 2, cols + 1, -2);
        put('f2_bl', 2, 3, -2, rows + 1);
        put('f2_br', 0, 3, cols + 1, rows + 1);
        for (let c = -1; c <= cols; c++) {
            put(`f2_top_${c}`, 1, 2, c, -2);
            put(`f2_bot_${c}`, 1, 3, c, rows + 1);
        }
        for (let r = -1; r <= rows; r++) {
            put(`f2_left_${r}`, 3, 3, -2, r);
            put(`f2_right_${r}`, 3, 2, cols + 1, r);
        }
    }

    private _frame(blit: TileBlit): SpriteFrame {
        const sheet = blit.sheet;
        const key = `${sheet.id}@${sheet.originX},${sheet.originY}:${blit.col},${blit.row},${blit.width}x${blit.height}`;
        const cached = this._frameCache.get(key);
        if (cached) {
            return cached;
        }
        // 源图一律按 32 切：x = 列×32，y = 行×32，从上沿往下数。不要用整张图宽高或除以 4。
        // 顺序必须是：先关贴图合图，再设 texture（会重置 rect），再设 rect，最后再把 packable 设回 false。
        const tex = sheet.texture;
        tex.packable = false;
        const w = blit.width;
        const h = blit.height;
        const x = sheet.originX + blit.col * TILE;
        const y = sheet.originY + blit.row * TILE;
        const sf = new SpriteFrame();
        sf.texture = tex;
        sf.rect = new Rect(x, y, w, h);
        sf.originalSize = new Size(w, h);
        sf.offset = new Vec2(0, 0);
        sf.packable = false;
        this._frameCache.set(key, sf);
        return sf;
    }

    private _sprite(parent: Node, name: string, frame: SpriteFrame, width: number, height: number): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 0);
        ut.setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        sprite.type = Sprite.Type.SIMPLE;
        return node;
    }

    private _layer(parent: Node, name: string, maps: TerrainMaps): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 0);
        ut.setContentSize(maps.cols * TILE, maps.rows * TILE);
        node.setPosition(0, 0, 0);
        return node;
    }

    private _worldRoot(cols: number, rows: number): Node {
        const scene = this.node.scene;
        if (!scene) {
            throw new Error('[Terrain] 没有场景，无法创建地图层');
        }
        const oldPlay = scene.getChildByName('Playfield');
        if (oldPlay) {
            oldPlay.destroy();
        }
        const playfield = new Node('Playfield');
        scene.addChild(playfield);
        playfield.layer = Layers.Enum.DEFAULT;
        playfield.setPosition(0, 0, 0);

        const node = new Node('WorldCanvas');
        playfield.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 0);
        ut.setContentSize(cols * TILE, rows * TILE);
        node.setPosition(0, 0, 0);
        const canvas = node.addComponent(Canvas);
        canvas.alignCanvasWithScreen = false;
        const battle = scene.getChildByName('BattleRoot');
        const cam = battle?.getComponent(Camera) ?? this.getComponent(Camera);
        if (cam) {
            canvas.cameraComponent = cam;
        }
        this._worldCanvas = node;
        return node;
    }

    private _hud(level: number, pack: RegionPack, maps: TerrainMaps): void {
        const canvas = this.node.scene?.getChildByName('Canvas');
        if (!canvas) {
            return;
        }
        const old = canvas.getChildByName('TerrainHud');
        if (old) {
            old.destroy();
        }
        const size = stageSize();
        const root = new Node('TerrainHud');
        canvas.addChild(root);
        root.layer = Layers.Enum.UI_2D;
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(size.width, size.height);
        const widget = root.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.updateAlignment();
        this._livesLabel = null;
        this._waveLabel = null;
        this._countdownLabel = null;
        this._cashLabel = null;
        this._cashSlot = null;
        this._currentWaveSlot = null;
        this._maxWaveSlot = null;
        this._countdownRoot = null;
        this._countdownPivot = null;
        this._countdownDigits = null;
        this._countdownShown = false;
        this._countdownText = '';
        this._bottomClip = null;
        this._countdownClip = null;
        this._signClip = null;
        this._hudRoot = root;
        this._buildUpgradeSign(root, size);
        this._buildOfficialBattleHud(root, size);
        void level;
        void pack;
        void maps;
    }

    private _buildSim(level: number, maps: TerrainMaps, objects: MapObjectSet, units: MapUnit[], tables: GameTables): void {
        const occupants: PlacedOccupant[] = [];
        for (const sprite of objects.sprites) {
            if (sprite.kind === 'decor') {
                occupants.push({ col: sprite.col, row: sprite.row, decorType: sprite.unitType });
            } else if (sprite.kind === 'building') {
                occupants.push({ col: sprite.col, row: sprite.row, spawnType: sprite.unitType });
            } else if (sprite.kind === 'dynamite') {
                // 箱子由下面的 mapUnits 占格，这里不再额外铺一层空装饰。
            }
        }
        const mapUnits = units.map((unit) => ({
            col: unit.col,
            row: unit.row,
            type: unit.type,
            activity: unit.activity,
            name: unit.name,
            forSale: unit.activity !== 5,
        }));
        for (const sprite of objects.sprites) {
            if (sprite.kind !== 'dynamite') {
                continue;
            }
            if (mapUnits.some((u) => u.type === 8 && u.col === sprite.col && u.row === sprite.row)) {
                continue;
            }
            mapUnits.push({
                col: sprite.col,
                row: sprite.row,
                type: 8,
                activity: 5,
                name: '炸药箱',
                forSale: false,
            });
        }
        for (const vehicle of collectVehiclesFromRaw(maps.cols, maps.rows, maps.raw)) {
            if (mapUnits.some((u) => u.col === vehicle.col && u.row === vehicle.row && u.type === vehicle.type)) {
                continue;
            }
            mapUnits.push(vehicle);
        }
        const lvStats = tables.getLevel(level);
        const poolTable = tables.table('出生池');
        const spawnPoolActions = poolTable
            ? parseSpawnPoolRows(poolTable.rows).filter((row) => row.level === level)
            : [];
        const weapons = tables.units.map((u) => ({
            name: u.name,
            code: unitCodes(u)[0] ?? u.code,
            codes: unitCodes(u),
            level: u.level,
            speed: u.speed ?? 0,
            price: u.price ?? 0,
            damageType: u.damageType ?? 0,
            damage: u.damage ?? 0,
            range: u.range ?? 0,
            splash: u.splash ?? 0,
            dot: u.dot ?? 0,
            dotTime: u.dotTime ?? 0,
            reload: u.reload ?? 0,
            bulletSpeed: u.bulletSpeed ?? 0,
            specialReload: u.specialReload ?? 0,
            specialRate: u.specialRate ?? 0,
            damageStyle: u.damageStyle ?? 0,
            slowTime: u.slowTime ?? 0,
            poisonTime: u.poisonTime ?? 0,
            poisonDamage: u.poisonDamage ?? 0,
            rangeTiles: u.rangeTiles,
            splashTiles: u.splashTiles,
        }));
        const saves = this._ensureSaves();
        const sim = createOfficialSim({
            data: {
                maps,
                occupants,
                mapUnits,
                weapons,
                stats: {
                    level,
                    startGold: lvStats?.startGold ?? 65,
                    leakLives: lvStats?.leakLives ?? 50,
                    chestCap: lvStats?.chestCap ?? 0,
                    chestTime: lvStats?.chestTime ?? 10000,
                    upgradeCap: lvStats?.upgradeCap ?? 0,
                    praiseUnit: lvStats?.praiseUnit ?? 4,
                    chestOnFieldCap: lvStats?.chestOnFieldCap ?? 17,
                    hpFactor: lvStats?.hpFactor ?? 100,
                    midHpFactor: lvStats?.midHpFactor ?? 125,
                    hardHpFactor: lvStats?.hardHpFactor ?? 155,
                    gamblerTime: lvStats?.gamblerTime,
                },
                waves: tables.waves.filter((row) => row.level === level),
                spawnPoolActions,
            },
            rng: new JavaMillisRng(),
            saver: saves,
            progress: campaignProgress,
            scores: highScores,
            vibrateOn: loadOptions(createLocalStore(sys.localStorage as unknown as { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }), { vibraSupported: true }).vibra,
            offerDifficulty: true,
        });
        this._continuePending = false;
        this._sim = sim;
        this._enemyBindings = [];
    }

    private _ensureSaves(): SaveSession {
        if (!this._saves) {
            this._saves = new SaveSession(createLocalStore(sys.localStorage as unknown as { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }));
            this._saves.hydrate(campaignProgress, highScores);
        }
        return this._saves;
    }

    private async _loadMoveArrow(): Promise<void> {
        const base = await loadBundle('base');
        if (await this._loadNamedSheet(base, 'gng_move_arrow')) {
            return;
        }
        console.warn('[Walk] 没有找到 gng_move_arrow，拖动时改画一条线');
    }

    private _uiToFine(uiX: number, uiY: number): { fineX: number; fineY: number } | null {
        if (!this._maps || !this._lens) {
            return null;
        }
        // 用设计分辨率和镜头中心换算，避开预览里 screenToWorld 和画面对不齐的问题。
        const size = stageSize();
        const worldX = fineToPixels(this._lens.lookFineX) + (uiX - size.width / 2);
        const worldY = fineToPixels(this._lens.lookFineY) + (uiY - size.height / 2);
        return worldToFine(worldX, worldY, this._maps.rows);
    }

    private _touchToFine(event: EventTouch): { fineX: number; fineY: number } | null {
        const ui = event.getUILocation();
        return this._uiToFine(ui.x, ui.y);
    }


    private _hitCountdown(event: EventTouch): boolean {
        const node = this._countdownRoot;
        if (!node || !node.isValid || !node.active) {
            return false;
        }
        const ut = node.getComponent(UITransform);
        return !!ut && ut.hitTest(event.getLocation());
    }

    private _onTouchStart(event: EventTouch): void {
        this._touchMode = true;
        if (GameTime.dialogOpen) {
            return;
        }
        const ui = event.getUILocation();
        this._touchStartX = ui.x;
        this._touchStartY = ui.y;
        this._touchMoved = false;
        if (this._hitPauseButton(event)) {
            this._setPausePressed(true);
            this._lens?.consumeTouch();
            UiTouchGuard.blocked = true;
            return;
        }
        if (this._hitMinimap(event)) {
            this._draggingMinimap = true;
            this._lens?.consumeTouch();
            UiTouchGuard.blocked = true;
            return;
        }
        if (!this._sim || UiTouchGuard.blocked) {
            return;
        }
        if (this._hitCountdown(event)) {
            this._sim.waves?.accelerateDelay();
            return;
        }
        if (this._hitUpgradeSign(event)) {
            // apk onTouchDown：命中 mUpgradeSignRect → mStartedOnUpgradeSign=true + cancelTouch，
            // 不走 onSelectPosition（否则点牌子会先取消/改选单位）。
            this._signPressed = true;
            return;
        }
        const fine = this._touchToFine(event);
        if (!fine) {
            return;
        }
        if (this._sim.trySelectPrioEnemy(fine.fineX, fine.fineY)) {
            this._draggingUnit = false;
            return;
        }
        const hit = this._sim.onTouchStart(fine.fineX, fine.fineY);
        if (hit && hit.activity === ACTIVITY_WORKING && hit.canWalk) {
            this._draggingUnit = true;
            this._lens?.consumeTouch();
            UiTouchGuard.blocked = true;
        } else {
            this._draggingUnit = false;
        }
    }

    private _onTouchMove(event: EventTouch): void {
        const ui = event.getUILocation();
        // GunsAndGloryThread.java:144 mMoveTolerance=20（:1665 赋值）：手指抖动 20px 以内仍算点击，
        // 之前用 8px，9–20px 的抖动会被判成拖动而取消雇佣。
        if (Math.abs(ui.x - this._touchStartX) > 20 || Math.abs(ui.y - this._touchStartY) > 20) {
            this._touchMoved = true;
        }
        if (this._draggingMinimap && this._lens) {
            const delta = event.getUIDelta();
            this._lens.panByMinimapPixels(delta.x, delta.y);
            this._lens.consumeTouch();
            return;
        }
        if (!this._sim || !this._draggingUnit) {
            return;
        }
        const fine = this._touchToFine(event);
        if (!fine) {
            return;
        }
        this._sim.onTouchMove(fine.fineX, fine.fineY);
        this._lens?.consumeTouch();
        // apk 不在 TOUCH_MOVE 里瞬间吸镜头，而是主循环每帧按 speed*dt 渐进推
        // （见 update() 里的 edgePushSelected）。这里只保留箭头方向更新。
    }

    private _onTouchEnd(event?: EventTouch): void {
        const wasPause = this._pausePressed;
        const wasMinimap = this._draggingMinimap;
        if (wasPause) {
            this._setPausePressed(false);
            if (event && this._hitPauseButton(event) && !this._touchMoved) {
                this._openPauseDialog();
            }
        }
        this._draggingMinimap = false;
        const wasDragging = this._draggingUnit;
        if (this._sim) {
            this._sim.onTouchEnd();
        }
        if (wasDragging) {
            this._lens?.resetEdgePush();
        }
        this._draggingUnit = false;
        UiTouchGuard.blocked = false;
        if (wasMinimap || wasPause || GameTime.dialogOpen) {
            return;
        }
        const signPressed = this._signPressed;
        this._signPressed = false;
        if (this._sim && !this._touchMoved && event) {
            if (signPressed && this._hitUpgradeSign(event)) {
                const unit = this._sim.unitById(this._sim.selectedId);
                if (unit) {
                    this._openShopDialog(this._sim.requestUpgrade(unit));
                }
            } else if (!signPressed) {
                const unit = this._sim.unitById(this._sim.selectedId);
                const kind = this._sim.maybeHandleTap(unit);
                if (kind && kind !== 'none') {
                    this._openShopDialog(kind);
                }
                if (kind === 'gamble-cards') {
                    this._openCardDialog();
                }
            }
        }
    }

    private _syncSleepHats(): void {
        if (this._sleepHats.length === 0) {
            return;
        }
        const frame = sleepHatFrame(GameTime.elapsedMs);
        if (frame === this._lastSleepFrame) {
            return;
        }
        const sheet = this._sheets.get(SLEEP_HAT_FILE);
        if (!sheet) {
            return;
        }
        this._lastSleepFrame = frame;
        const sf = this._sheetFrame(sheet, frame, 0, SLEEP_HAT_FRAME_W, SLEEP_HAT_FRAME_H);
        for (const sprite of this._sleepHats) {
            if (sprite.isValid) {
                sprite.spriteFrame = sf;
            }
        }
    }

    /** apk GameObjectUnit.draw L936-944：sfx_sleeping 3 帧/200ms，位置 bodyTop - 1 tile。 */
    private _buildSleepHat(parent: Node): Node | null {
        const sheet = this._sheets.get(SLEEP_HAT_FILE);
        if (!sheet) return null;
        const frame = this._sheetFrame(sheet, sleepHatFrame(GameTime.elapsedMs), 0, SLEEP_HAT_FRAME_W, SLEEP_HAT_FRAME_H);
        const node = this._sprite(parent, 'sleep', frame, SLEEP_HAT_FRAME_W, SLEEP_HAT_FRAME_H);
        const ut = node.getComponent(UITransform);
        if (ut) ut.setAnchorPoint(0.5, 0);
        node.setPosition(0, SLEEP_HAT_ABOVE, 0);
        const sprite = node.getComponent(Sprite);
        if (sprite) this._sleepHats.push(sprite);
        return node;
    }

    private _syncUnits(): void {
        const sim = this._sim;
        const maps = this._maps;
        if (!sim || !maps) {
            return;
        }
        this._sleepHats = this._sleepHats.filter((s) => s.isValid && s.node.active);
        this._bindMissingUnits();
        for (const bind of this._bindings) {
            const unit = sim.unitById(bind.id);
            if (!unit || !unit.alive) {
                bind.root.active = false;
                continue;
            }
            const pos = fineToWorld(unit.fineX, unit.fineY, maps.rows);
            (bind.root as TerrainDepthNode).__terrainDrawOrder = mapUnitDrawOrder(unit.type, unit.fineY);
            bind.root.setPosition(pos.x, pos.y, 0);
            if (unit.activity === ACTIVITY_FOR_SALE) {
                if (bind.lastActivity !== ACTIVITY_FOR_SALE) {
                    this._showSleep(bind);
                }
                if (bind.hat) {
                    bind.hat.active = true;
                } else {
                    // 营地新生成的单位初始 activity=2/3，_placeSimUnit 未创建 hat，
                    // 等 activity 切到 4 时补上 zzz 节点（APK sfx_sleeping，3 帧/200ms）。
                    bind.hat = this._buildSleepHat(bind.body);
                }
            } else {
                if (bind.hat) {
                    bind.hat.active = false;
                }
                this._showWalk(
                    bind,
                    unit.xDir,
                    unit.yDir,
                    unit.activity === ACTIVITY_WORKING && unit.xDir === 0 && unit.yDir === 0,
                    unit.fineX,
                    unit.fineY,
                    unit.shootMs ?? 0,
                    unit.shootDirX ?? 0,
                    unit.shootDirY ?? 0,
                );
            }
            bind.lastActivity = unit.activity;
            this._syncUnitBonusIcon(bind, unit);
        }
        this._syncDecorDrawOrder();
    }

    /**
     * APK drawWeapon() 运行时绘制载具炮管（非静态 map sprite）。
     * 条件：activityStatus > 4（即 ACTIVITY_WORKING/6/7）且 hasWeaponSlot()。
     * hasWeaponSlot 规则：trainH type==12, trainV type==22, steamer type==32。
     * Y 偏移 offsetGatlingY（fineY 向下系统，炮管画在载具顶部 = 底部 - offsetGatlingY）：
     *   steamer-32 = 7680 (1 tile), trainH-12 = 6912, trainV-22 = 4992。
     */
    /**
     * apk：载具是复合单位，每节车厢/船体本身是被 draw 的单位，所以整列跟着车头走。
     * 建关时车身只是 MapObjects 的静态贴图，得绑到对应单位上；绑定不要求此刻已有 sim，
     * 因为 _paint 可能早于 createOfficialSim，留到每帧同步里再认。
     * 偏移按「静态贴图位置 − 单位脚点」量一次并记住，静止时和原来的摆图完全一致。
     */
    private _bindVehicleBody(node: Node, item: PlacedSprite, maps: TerrainMaps, baseOrder: number): void {
        this._vehicleBodies.push({
            unitId: -1,
            unitType: item.unitType,
            col: item.col,
            row: item.row,
            node,
            maps,
            offX: 0,
            offY: 0,
            baseOrder,
            fineY0: 0,
        });
    }

    /** 每帧：还没认上单位的先认一次，认上的挪到单位当前位置。层叠序号只按移动量平移，避免遮挡关系突变。 */
    private _syncVehicleBodies(): void {
        const sim = this._sim;
        if (!sim || this._vehicleBodies.length === 0) {
            return;
        }
        for (const body of this._vehicleBodies) {
            if (!body.node.isValid) {
                continue;
            }
            if (body.unitId < 0) {
                const found = sim.units.find((u) => u.type === body.unitType && u.fullX === body.col && u.fullY === body.row);
                if (!found) {
                    continue;
                }
                const p0 = fineToWorld(found.fineX, found.fineY, body.maps.rows);
                body.unitId = found.id;
                body.offX = body.node.position.x - p0.x;
                body.offY = body.node.position.y - p0.y;
                body.fineY0 = found.fineY;
            }
            const unit = sim.units.find((u) => u.id === body.unitId);
            if (!unit || !unit.alive) {
                continue;
            }
            const p = fineToWorld(unit.fineX, unit.fineY, body.maps.rows);
            body.node.setPosition(p.x + body.offX, p.y + body.offY, 0);
            (body.node as TerrainDepthNode).__terrainDrawOrder = body.baseOrder + (unit.fineY - body.fineY0);
        }
    }

    private _syncVehicleWeapons(): void {
        const sim = this._sim;
        const maps = this._maps;
        // apk GameObjectCompoundUnit.draw()：先画车身、紧接 drawWeapon()、最后 lokSfx。
        // 车身贴图在 Decor 层，炮管必须和车身同层才能靠 __terrainDrawOrder 叠在车身之上；
        // 旧代码把炮管放进 Units 层（在 Decor 之前创建），于是永远被车厢盖住。
        const parent = this._decorLayer ?? this._unitLayer ?? this._worldCanvas;
        if (!sim || !maps || !parent) {
            return;
        }
        // APK 原始数据：(type, offsetGatlingY, file, sliceRow, drawingOffsetY)
        // offsetGatlingY 是炮塔中心到车身图底边的距离；drawingOffsetY 决定车身底边锚点：
        // TrainHorizontal.java:7 = UNIT_PLACEMENT_OFFSET_Y(1920)，TrainVertical.java:7 = 3840，Steamer 不设 = 0。
        const WEAPON_SPECS: Array<{
            type: number;
            offsetGatlingY: number;
            file: string;
            sliceRow: number;
            drawingOffsetY: number;
        }> = [
            { type: 32, offsetGatlingY: 7680, file: 'units/player_double_cannon', sliceRow: 3, drawingOffsetY: 0 }, // steamer gatling
            { type: 12, offsetGatlingY: 6912, file: 'units/player_gatling', sliceRow: 0, drawingOffsetY: 1920 },        // trainH gatling
            { type: 22, offsetGatlingY: 4992, file: 'units/player_gatling', sliceRow: 3, drawingOffsetY: 3840 },        // trainV gatling
        ];

        const wantedIds = new Set<number>();
        for (const unit of sim.units) {
            if (!unit.alive || unit.isEnemy) {
                continue;
            }
            // activityStatus > 4 → >= 5 → ACTIVITY_WORKING(5), ACTIVITY_RETURNING(6), ACTIVITY_GOING_TO_WORK(7)
            if (unit.activity <= 4) {
                continue;
            }
            const spec = WEAPON_SPECS.find((s) => s.type === unit.type);
            if (!spec) {
                continue;
            }
            wantedIds.add(unit.id);
            let node = this._vehicleWeapons.get(unit.id);
            if (!node || !node.isValid) {
                const sheet = this._sheets.get(spec.file);
                if (!sheet) {
                    continue; // 贴图还没加载
                }
                const width = TILE;
                const height = TILE;
                const blit: TileBlit = { sheet, col: 0, row: spec.sliceRow, width, height };
                const frame = this._frame(blit);
                node = new Node(`weapon_${unit.id}`);
                parent.addChild(node);
                node.layer = Layers.Enum.DEFAULT;
                node.addComponent(UITransform).setContentSize(width, height);
                const sp = node.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = frame;
                sp.type = Sprite.Type.SIMPLE;
                (node as TerrainDepthNode).__terrainDrawOrder = mapUnitDrawOrder(unit.type, unit.fineY + spec.drawingOffsetY);
                this._vehicleWeapons.set(unit.id, node);
            }
            const sp = node.getComponent(Sprite);
            if (!sp) {
                continue;
            }
            const cached = node as TerrainDepthNode & {
                __weaponKey?: string;
                __gunRow?: number;
                __gunFlip?: boolean;
                __gunX?: number;
                __gunY?: number;
            };
            if (cached.__gunRow === undefined) {
                // 地图摆出来的车 Java 里 animFrmY 默认 0，雇来的在 hire() 里被设成 3，这里按原来的摆图行起步。
                cached.__gunRow = spec.sliceRow;
                cached.__gunFlip = false;
            }
            // apk GameObjectUnit.update L709/L729：这一帧真的动了就先把 isInShootingAnimation 清掉，
            // 行号改按位移方向；没动才轮到开枪那一发的方向（L741-773）。
            // 开枪动画结束后行号不重置，所以停着的车会一直指着刚才打的方向，和步兵一样。
            const dx = unit.fineX - (cached.__gunX ?? unit.fineX);
            const dy = unit.fineY - (cached.__gunY ?? unit.fineY);
            cached.__gunX = unit.fineX;
            cached.__gunY = unit.fineY;
            const moved = dx !== 0 || dy !== 0;
            const firing = !moved && (unit.shootMs ?? 0) > 0;
            if (firing) {
                const aim = playerShootFacing(unit.shootDirX ?? 0, unit.shootDirY ?? 0);
                cached.__gunRow = aim.row;
                cached.__gunFlip = aim.flip;
            } else if (moved) {
                const walk = playerWalkFacing(dx, dy);
                cached.__gunRow = walk.row;
                cached.__gunFlip = walk.flip;
            }
            const shotFile = `${spec.file}_shot`;
            // apk setImageForUnitShoot（TrainHorizontal.java:24-30 / TrainVertical.java:95-97 / Steamer.java:24-31）：
            // 开火时整张换成 *_shot，行号和左右翻转都按射击方向。
            const useShot = firing && this._sheets.has(shotFile);
            const useFile = useShot ? shotFile : spec.file;
            let col = 0;
            if (useShot) {
                // apk animationShootGatling = {0,50,1,100} 给 12、22 两帧；双炮没有配置，走 animationShootNone = {0,100}，只有第 0 帧。
                const pairs = SHOOT_FRAMES[unit.type] ?? [0, 100];
                col = frameFromTimeline(Math.max(0, pairs[pairs.length - 1] - (unit.shootMs ?? 0)), pairs);
            }
            const row = cached.__gunRow;
            const key = `${useFile}:${row}:${col}`;
            if (cached.__weaponKey !== key) {
                const sheet = this._sheets.get(useFile);
                if (!sheet) {
                    continue;
                }
                sp.spriteFrame = this._frame({ sheet, col, row, width: TILE, height: TILE });
                cached.__weaponKey = key;
            }
            // drawWeapon 里 mMirrored 走同一套镜像矩阵，朝右就是朝左那张再左右翻。
            node.setScale(cached.__gunFlip ? -1 : 1, 1, 1);
            // apk GameObjectCompoundUnit.draw L28-38 把车身图底边钉在 fineY+drawingOffsetY，
            // drawWeapon L129 再把炮塔中心放在同一锚点上方 offsetGatlingY。
            // 本工程车身是地图静态贴图（底边贴格子下沿线），所以炮塔按车身节点看得见的底边量；
            // 没绑上车身的（比如没有摆图的车）退回 fine 公式，含 drawingOffsetY。
            const body = this._vehicleBodies.find((b) => b.unitId === unit.id && b.node.isValid);
            const gunX = fineToWorld(unit.fineX, 0, maps.rows).x;
            const gunY = body
                ? body.node.position.y + (spec.offsetGatlingY / 7680) * TILE
                : fineToWorld(unit.fineX, unit.fineY + spec.drawingOffsetY - spec.offsetGatlingY, maps.rows).y;
            // 炮塔是车身 draw 里顺笔画的，层叠序号跟着车身，不再单独按炮口高度插队。
            // 加 0.5 保证排序时炮管严格紧跟自己的车身之后：所有装饰的 drawOrder 都是整数，
            // 半个单位既能压住车身，又不会插到相邻的下一件装饰前面。
            const bodyOrder = body ? (body.node as TerrainDepthNode).__terrainDrawOrder : undefined;
            (node as TerrainDepthNode).__terrainDrawOrder = bodyOrder === undefined
                ? mapUnitDrawOrder(unit.type, unit.fineY + spec.drawingOffsetY)
                : bodyOrder + 0.5;
            node.setPosition(gunX, gunY, 0);
            node.active = true;
        }
        // 隐藏不在 wanted 列表中的炮管（activity 降为 <=4 或 unit 死亡）
        for (const [id, node] of this._vehicleWeapons) {
            if (!node.isValid) {
                this._vehicleWeapons.delete(id);
                continue;
            }
            if (!wantedIds.has(id)) {
                node.active = false;
            }
        }
    }

    /**
     * apk GameObjectUnit.draw L982-1014：bonusAttribute>0 且 bonusCounter>0 时，
     * 在脚点上方“当前帧高”处画 hud_bonus_* 图标（16×16，帧号 %帧数+1，等于帧数改 1），
     * 摆动快速往返，图标中心再向上偏 sin(animTime)*1.25。待售/睡觉（activity 4）不画。
     */
    private _syncUnitBonusIcon(
        bind: UnitBinding,
        unit: { bonusAttribute: number; bonusCounter: number; activity: number },
    ): void {
        const sim = this._sim;
        const show = !!sim && unit.bonusAttribute > 0 && unit.bonusCounter > 0 && unit.activity !== ACTIVITY_FOR_SALE;
        if (!show) {
            if (bind.bonus && bind.bonus.isValid) {
                bind.bonus.active = false;
            }
            return;
        }
        const icon = iconForChestType(unit.bonusAttribute);
        const sheet = this._sheets.get(icon.file);
        if (!sheet) {
            return;
        }
        let node = bind.bonus;
        if (!node || !node.isValid) {
            node = this._sprite(
                bind.root,
                'bonus',
                this._sheetFrame(sheet, 0, 0, CHEST_ICON_PX, CHEST_ICON_PX),
                CHEST_ICON_PX,
                CHEST_ICON_PX,
            );
            const ut = node.getComponent(UITransform);
            if (ut) {
                ut.setAnchorPoint(0.5, 0.5);
            }
            bind.bonus = node;
            bind.bonusAnimTime = 0;
            bind.bonusAnimDir = 1;
        }
        node.active = true;
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const frame = bonusOverheadFrame(sim!.nowMs, icon.frames);
            sprite.spriteFrame = this._sheetFrame(sheet, frame, 0, CHEST_ICON_PX, CHEST_ICON_PX);
        }
        let anim = bind.bonusAnimTime ?? 0;
        let dir = bind.bonusAnimDir ?? 1;
        anim += dir * 0.1;
        if (anim < 0) {
            anim = 0;
            dir = 1;
        } else if (anim > 1) {
            anim = 1;
            dir = -1;
        }
        bind.bonusAnimTime = anim;
        bind.bonusAnimDir = dir;
        const bodyH = bind.body.getComponent(UITransform)?.height ?? 0;
        node.setPosition(0, bodyH + Math.sin(anim) * 1.25, 0);
    }

    private _syncDecorDrawOrder(): void {
        const parent = this._decorLayer;
        if (!parent) {
            return;
        }
        const ordered = parent.children.filter((node) => (node as TerrainDepthNode).__terrainDrawOrder !== undefined);
        ordered.sort((a, b) => ((a as TerrainDepthNode).__terrainDrawOrder ?? 0) - ((b as TerrainDepthNode).__terrainDrawOrder ?? 0));
        // 只重排原版 drawObjects 序列；选择框、出生箭头等覆盖物继续留在其上。
        for (let i = 0; i < ordered.length; i++) {
            ordered[i].setSiblingIndex(i);
        }
    }

    private _showSleep(bind: UnitBinding): void {
        const file = bodyFileFor(bind.vis, ACTIVITY_FOR_SALE);
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return;
        }
        const sf = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
        bind.bodySprite.spriteFrame = sf;
        const ut = bind.body.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(sheet.width, sheet.height);
        }
        bind.body.setScale(1, 1, 1);
        if (bind.hat) {
            bind.hat.active = true;
        }
    }

    /**
     * 走路帧按距离推进（apk animStep），开枪时换成 shoot 图并朝目标方向。
     * mx/my 是 fine 坐标，用来累计 animStep。
     */
    private _showWalk(
        bind: UnitBinding,
        xDir: number,
        yDir: number,
        standing: boolean,
        mx?: number,
        my?: number,
        shootMs = 0,
        shootDirX = 0,
        shootDirY = 0,
    ): void {
        const vis = bind.vis;
        // Java：isInShootingAnimation 优先于走路/站立，站着开火也要切 shoot 图并转向目标。
        const shooting = shootMs > 0 && !!vis.shot;
        const file = shooting ? vis.shot : vis.walk;
        if (!file) {
            return;
        }
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return;
        }
        let facingRow: number;
        let facingFlip: boolean;
        let frame: number;
        if (shooting) {
            const pairs = SHOOT_FRAMES[bind.type] ?? [0, 100, 1, 200, 0, 1000];
            const period = pairs[pairs.length - 1];
            const aim = playerShootFacing(shootDirX, shootDirY);
            facingRow = aim.row;
            facingFlip = aim.flip;
            frame = frameFromTimeline(Math.max(0, period - shootMs), pairs);
        } else if (standing) {
            // apk move()：不移动时 animFrmY 保持上一次行走/开枪的行，不会自己转回朝下。
            facingRow = bind.lastFaceRow;
            facingFlip = bind.lastFaceFlip;
            if (mx != null && my != null) {
                bind.lastFineX = mx;
                bind.lastFineY = my;
            }
            frame = 0;
        } else {
            const walk = vis.isEnemy ? enemyWalkFacing(xDir, yDir) : playerWalkFacing(xDir, yDir);
            facingRow = walk.row;
            facingFlip = walk.flip;
            if (mx != null && my != null) {
                const dx = Math.abs(mx - bind.lastFineX);
                const dy = Math.abs(my - bind.lastFineY);
                const step = dx >= dy ? dx : dy;
                if (step > 0) {
                    bind.animStep = (bind.animStep + step) % 3072;
                }
                bind.lastFineX = mx;
                bind.lastFineY = my;
            }
            frame = walkFrameForStep(bind.animStep, vis.walkFourFrames);
        }
        // 开枪结束或走完停下后沿用刚才面向敌人的方位。
        bind.lastFaceRow = facingRow;
        bind.lastFaceFlip = facingFlip;
        const sf = this._sheetFrame(sheet, frame, facingRow, vis.frameW, vis.frameH);
        bind.bodySprite.spriteFrame = sf;
        const ut = bind.body.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(vis.frameW, vis.frameH);
        }
        bind.body.setScale(facingFlip ? -1 : 1, 1, 1);
    }


    private _spawnPreviewGroup(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._unitLayer ?? this._decorLayer ?? this._worldCanvas;
        if (!sim?.enemies || !maps || !parent) {
            return;
        }
        const result = sim.enemies.trySpawnGroup([1, 2], 0);
        if (!result.spawned) {
            console.warn('[Enemy] 预览组没放出来');
            return;
        }
        for (const enemy of result.enemies) {
            this._placeEnemy(parent, maps, enemy);
        }
        const lead = result.enemies[0];
        console.log(`[Enemy] 预览 2 人一组 血量 ${lead.maxHp} 速度 ${lead.speed} 出现在 (${lead.fullX},${lead.fullY})`);
    }

    private _placeEnemy(parent: Node, maps: TerrainMaps, enemy: { id: number; type: number; fineX: number; fineY: number; drawOffX?: number; drawOffY?: number; white?: boolean }): void {
        const vis = visualFor(enemy.type, true, enemy.white);
        if (!vis || !vis.walk) {
            return;
        }
        const sheet = this._sheets.get(vis.walk);
        if (!sheet) {
            return;
        }
        const bodyFrame = this._sheetFrame(sheet, 0, 1, vis.frameW, vis.frameH);
        const root = new Node(`enemy_${enemy.id}`);
        parent.addChild(root);
        root.layer = Layers.Enum.DEFAULT;
        const pos = fineToWorld(enemy.fineX + (enemy.drawOffX ?? 0), enemy.fineY + (enemy.drawOffY ?? 0), maps.rows);
        root.setPosition(pos.x, pos.y, 0);
        const body = this._sprite(root, 'body', bodyFrame, vis.frameW, vis.frameH);
        const bodyUt = body.getComponent(UITransform);
        if (bodyUt) {
            bodyUt.setAnchorPoint(0.5, 0);
        }
        body.setPosition(0, 0, 0);
        const bodySprite = body.getComponent(Sprite);
        if (!bodySprite) {
            return;
        }
        this._enemyBindings.push({
            id: enemy.id,
            type: enemy.type,
            root,
            body,
            bodySprite,
            hat: null,
            vis,
            lastActivity: ACTIVITY_WORKING,
            animStep: 0,
            lastFineX: enemy.fineX,
            lastFineY: enemy.fineY,
            lastFaceRow: 1,
            lastFaceFlip: false,
            fire: null,
            stun: null,
            heal: null,
            deathFx: null,
        });
    }

    private _syncEnemies(): void {
        const sim = this._sim;
        const maps = this._maps;
        const sys = sim?.enemies;
        if (!sim || !maps || !sys) {
            return;
        }
        const parent = this._unitLayer ?? this._decorLayer ?? this._worldCanvas;
        if (parent) {
            for (const enemy of sys.enemies) {
                if (!enemy.alive) {
                    continue;
                }
                if (!this._enemyBindings.some((b) => b.id === enemy.id)) {
                    this._placeEnemy(parent, maps, enemy);
                }
            }
        }
        for (const bind of this._enemyBindings) {
            const enemy = sys.enemies.find((e) => e.id === bind.id);
            const dying = !!enemy && !enemy.alive && (enemy.deathAnimationCounter ?? 0) >= 0 && (enemy.deathAnimationStyle ?? 0) > 0;
            if (!enemy || (!enemy.alive && !dying)) {
                bind.root.active = false;
                continue;
            }
            const vis = deathVisualFor(enemy.type);
            const style = enemy.deathAnimationStyle || vis.style;
            const showBody = deathBodyVisible(style, enemy.deathAnimationCounter, enemy.alive);
            bind.root.active = showBody || !enemy.alive;
            const pos = fineToWorld(enemy.fineX + (enemy.drawOffX ?? 0), enemy.fineY + (enemy.drawOffY ?? 0), maps.rows);
            bind.root.setPosition(pos.x, pos.y, 0);
            if (enemy.alive) {
                // apk move() L325-357：转弯那 100/200ms 走路帧不推进，但位置照常积分，
                // 所以这里用 standing 把 animStep 冻住，再把横条图盖上去。
                const turning = (enemy.turnMs ?? 0) > 0;
                bind.body.active = true;
                this._showWalk(bind, enemy.xDir, enemy.yDir, turning || (enemy.xDir === 0 && enemy.yDir === 0), enemy.fineX, enemy.fineY);
                if (turning) {
                    this._drawEnemyTurn(bind, enemy.type, enemy.white, enemy.turnFrame ?? 0, enemy.turnFlip === true);
                }
            } else if (style === 1) {
                bind.body.active = true;
                this._showPioneerDeath(bind, enemy.deathAnimationCounter);
            } else {
                bind.body.active = showBody;
                if (showBody) {
                    this._showWalk(bind, enemy.xDir, enemy.yDir, true, enemy.fineX, enemy.fineY);
                }
            }
            this._syncEnemyOverlays(bind, enemy, GameTime.elapsedMs);
            this._syncEnemyHpBar(bind, enemy);
        }
        const ordered = this._enemyBindings.slice().sort((a, b) => {
            const ea = sys.enemies.find((e) => e.id === a.id);
            const eb = sys.enemies.find((e) => e.id === b.id);
            const da = (ea?.fineY ?? 0) + (ea?.drawOffY ?? 0);
            const db = (eb?.fineY ?? 0) + (eb?.drawOffY ?? 0);
            return da - db;
        });
        for (let i = 0; i < ordered.length; i++) {
            ordered[i].root.setSiblingIndex(i);
        }
    }

    /**
     * apk setImageForTurningUnit L247-282：转弯期间换成 *_turn 横条，
     * 帧号是 setTurningFrame 一次性写好的 0/1，行恒 0，水平方向靠 mMirrored 翻。
     * 7 号没有转向横条，直接沿用刚画好的走路图。
     */
    private _drawEnemyTurn(bind: UnitBinding, type: number, white: boolean, frame: number, flip: boolean): void {
        const file = enemyTurnFile(type, white);
        const sheet = file ? this._sheets.get(file) : undefined;
        if (!sheet) {
            return;
        }
        const vis = bind.vis;
        bind.bodySprite.spriteFrame = this._sheetFrame(sheet, frame, 0, vis.frameW, vis.frameH);
        const ut = bind.body.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(vis.frameW, vis.frameH);
        }
        bind.body.setScale(flip ? -1 : 1, 1, 1);
    }

    /**
     * GunsAndGloryThread.drawEnemies（L1202-1211）的敌人血条：
     * 只给 unit>2 且 !=9、血量低于 95%、仍存活的敌人画。
     * 底条 36×12dp 深红 rgb(63,0,0)，填充高 6dp、宽度 30dp*hp/max，
     * 颜色随剩余血在红→绿之间插值；整条位于脚点上方 1.5 格（48dp）。
     */
    private _syncEnemyHpBar(bind: UnitBinding, enemy: { type: number; hp: number; maxHp: number; alive: boolean }): void {
        const show = enemy.alive
            && enemy.type > 2
            && enemy.type !== 9
            && enemy.maxHp > 0
            && enemy.hp > 0
            && enemy.hp < Math.trunc((enemy.maxHp * 95) / 100);
        if (!show) {
            if (bind.hpBar && bind.hpBar.isValid) {
                bind.hpBar.node.active = false;
            }
            return;
        }
        let bar = bind.hpBar;
        if (!bar || !bar.isValid) {
            const node = new Node(`hp_${bind.id}`);
            bind.root.addChild(node);
            node.setPosition(0, 48, 0);
            node.layer = Layers.Enum.DEFAULT;
            bar = node.addComponent(Graphics);
            bind.hpBar = bar;
        }
        bar.node.active = true;
        const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        bar.clear();
        bar.fillColor = new Color(63, 0, 0, 255);
        bar.rect(-18, -6, 36, 12);
        bar.fill();
        bar.fillColor = new Color(Math.round(255 * (1 - ratio)), Math.round(255 * ratio), 0, 255);
        bar.rect(-15, -3, 30 * ratio, 6);
        bar.fill();
    }

    private _syncLives(): void {
        const sys = this._sim?.enemies;
        if (!sys) {
            return;
        }
        if (this._livesLabel && this._livesLabel.isValid) {
            this._livesLabel.node.active = !this._starArea;
            if (!this._starArea) {
                this._livesLabel.string = `命 ${sys.lives}`;
            }
        }
        this._syncSheriffStar(sys.lives, sys.maxLives, sys.starShakeMs);
    }


    private _syncCashHud(): void {
        if (!this._sim) {
            return;
        }
        // $ 已经画在 gng_hud_0_top 上，这里只填金币数字。
        this._paintHudNumber(this._cashSlot, String(Math.max(0, this._sim.cash)));
    }

    private _bindMissingUnits(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._decorLayer ?? this._unitLayer ?? this._worldCanvas;
        if (!sim || !maps || !parent) {
            return;
        }
        for (const unit of sim.units) {
            if (!unit.alive || unit.isEnemy) {
                continue;
            }
            if (this._bindings.some((b) => b.id === unit.id)) {
                continue;
            }
            this._placeSimUnit(parent, maps, unit);
        }
    }

    private _placeSimUnit(parent: Node, maps: TerrainMaps, unit: { id: number; type: number; activity: number; fineX: number; fineY: number }): void {
        const vis = visualFor(unit.type, false);
        if (!vis) {
            return;
        }
        const file = bodyFileFor(vis, unit.activity);
        const sheet = this._sheets.get(file) ?? (vis.walk ? this._sheets.get(vis.walk) : undefined);
        if (!sheet) {
            return;
        }
        // 待售单位是整张睡姿图，不能按走路帧切；否则重开后这些“可雇佣单位”会切错图看不见。
        const sale = unit.activity === ACTIVITY_FOR_SALE;
        const width = sale || !vis.walk ? sheet.width : (vis.frameW || sheet.width);
        const height = sale || !vis.walk ? sheet.height : (vis.frameH || sheet.height);
        const bodyFrame = this._sheetFrame(sheet, 0, sale || !vis.walk ? 0 : 3, width, height);
        const root = new Node(`unit_sim_${unit.id}`);
        parent.addChild(root);
        root.layer = Layers.Enum.DEFAULT;
        const pos = fineToWorld(unit.fineX, unit.fineY, maps.rows);
        (root as TerrainDepthNode).__terrainDrawOrder = mapUnitDrawOrder(unit.type, unit.fineY);
        root.setPosition(pos.x, pos.y, 0);
        const body = this._sprite(root, 'body', bodyFrame, width, height);
        const bodyUt = body.getComponent(UITransform);
        if (bodyUt) {
            bodyUt.setAnchorPoint(0.5, 0);
        }
        body.setPosition(0, 0, 0);
        let hatNode: Node | null = null;
        if (sale) {
            hatNode = this._buildSleepHat(root);
        }
        const bodySprite = body.getComponent(Sprite);
        if (!bodySprite) {
            return;
        }
        this._bindings.push({
            id: unit.id,
            type: unit.type,
            root,
            body,
            bodySprite,
            hat: hatNode,
            vis,
            lastActivity: unit.activity,
            animStep: 0,
            lastFineX: unit.fineX,
            lastFineY: unit.fineY,
            lastFaceRow: 3,
            lastFaceFlip: false,
            upgradeArrow: null,
        });
    }

    private async _loadHireHudTextures(): Promise<void> {
        const files = [
            HUD_FONT_NUMBERS,
            HUD_FONT_DOLLAR,
            HUD_WOODEN_SIGN,
            HUD_UPGRADE_ICON,
            ...HUD_UPGRADE_ARROW,
        ];
        const base = await loadBundle('base');
        for (const file of files) {
            if (this._sheets.has(file)) {
                continue;
            }
            await this._loadNamedSheet(base, file);
        }
    }

    private _buildUpgradeSign(hud: Node, size: { width: number; height: number }): void {
        const old = this._upgradeSign;
        if (old && old.isValid) {
            old.destroy();
        }
        const oldClip = this._signClip;
        if (oldClip && oldClip.isValid) {
            oldClip.destroy();
        }
        const clip = this._makeBorderClip(hud, 'UpgradeSignClip');
        this._signClip = clip;
        const sheet = this._sheets.get(HUD_WOODEN_SIGN);
        const w = sheet?.width ?? UPGRADE_SIGN_WIDTH;
        const h = sheet?.height ?? UPGRADE_SIGN_HEIGHT;
        // apk mUpgradeSignRect.set(0, (H - adH) - signH, signW, H - adH)：
        // 木板左沿贴画布左边 x=0，底边压停靠线，命中框就是 60×54 原图。
        const sign = new Node('UpgradeSign');
        clip.addChild(sign);
        sign.layer = Layers.Enum.UI_2D;
        const ut = sign.addComponent(UITransform);
        ut.setAnchorPoint(0, 0);
        ut.setContentSize(w, h);
        sign.setPosition(-size.width / 2, 0, 0);
        sign.active = false;
        // signal_rotate_in_left：pivot=(50%, 130%)，牌子底边再往下 0.3 个高度。
        const pivot = new Node('pivot');
        sign.addChild(pivot);
        pivot.layer = Layers.Enum.UI_2D;
        const put = pivot.addComponent(UITransform);
        put.setAnchorPoint(0.5, 0.5);
        put.setContentSize(w, h);
        pivot.setPosition(w * UPGRADE_SIGN_PIVOT_X, -(UPGRADE_SIGN_PIVOT_Y - 1) * h, 0);
        this._upgradeSignPivot = pivot;
        if (sheet) {
            const board = this._uiSprite(pivot, 'board', this._sheetFrame(sheet, 0, 0, w, h), w, h);
            const boardUt = board.getComponent(UITransform);
            if (boardUt) {
                boardUt.setAnchorPoint(0.5, 0.5);
            }
            board.setPosition(0, h * (UPGRADE_SIGN_PIVOT_Y - 0.5), 0);
        }
        const iconSheet = this._sheets.get(HUD_UPGRADE_ICON);
        if (iconSheet) {
            const icon = this._uiSprite(pivot, 'icon', this._sheetFrame(iconSheet, 0, 0, iconSheet.width, iconSheet.height), iconSheet.width, iconSheet.height);
            const iconUt = icon.getComponent(UITransform);
            if (iconUt) {
                iconUt.setAnchorPoint(0.5, 0.5);
            }
            icon.setPosition(0, h * (UPGRADE_SIGN_PIVOT_Y - 0.5) + UPGRADE_SIGN_ICON_OFFSET_Y, 0);
        }
        this._upgradeSign = sign;
        this._signWanted = false;
        this._signHiding = false;
        this._signAnimMs = 0;
        this._signReady = false;
    }


    private _uiSprite(parent: Node, name: string, frame: SpriteFrame, width: number, height: number): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        ut.setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        sprite.type = Sprite.Type.SIMPLE;
        return node;
    }

    private _uiNamedFrame(...names: string[]): SpriteFrame | null {
        for (const name of names) {
            const sheet = this._sheets.get(name);
            if (sheet) {
                return this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
            }
        }
        return null;
    }

    private _uiFrameSize(frame: SpriteFrame, fallbackW: number, fallbackH: number): { w: number; h: number } {
        const w = frame.rect?.width || fallbackW;
        const h = frame.rect?.height || fallbackH;
        if (w <= 0 || h <= 0) {
            return { w: fallbackW, h: fallbackH };
        }
        return { w, h };
    }

    private _paintUiBg(bg: Node, frame: SpriteFrame | null, w: number, h: number, fallback: Color): void {
        const ut = bg.getComponent(UITransform) ?? bg.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        const g = bg.getComponent(Graphics);
        if (frame) {
            if (g) {
                g.destroy();
            }
            const sprite = bg.getComponent(Sprite) ?? bg.addComponent(Sprite);
            // 按调用方给出的官方 wrap_content / mdpi 尺寸画，不改成另一份自然尺寸，也不按 720/480 放大。
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            sprite.color = Color.WHITE;
            return;
        }
        const old = bg.getComponent(Sprite);
        if (old) {
            old.destroy();
        }
        const gfx = g ?? bg.addComponent(Graphics);
        gfx.clear();
        gfx.fillColor = fallback;
        gfx.rect(-w / 2, -h / 2, w, h);
        gfx.fill();
    }

    private _dialogButtonKind(text: string): 'yes' | 'no' | 'menu' {
        // 暂停里的「离开／退出」要用木纹菜单按钮，不能当成取消用的 no 按钮。
        if (text === '取消' || text === '不了' || text === '关闭') {
            return 'no';
        }
        if (text === '确定' || text === '开始' || text === '继续' || text === '好的' || text === '写下纪录' || text === '重试' || text === '知道了') {
            return 'yes';
        }
        return 'menu';
    }

    private _dialogButtonArt(text: string): { normal: SpriteFrame | null; pressed: SpriteFrame | null } {
        const kind = this._dialogButtonKind(text);
        if (kind === 'yes') {
            return { normal: this._uiNamedFrame(UI_YES), pressed: this._uiNamedFrame(UI_YES_PRESSED) };
        }
        if (kind === 'no') {
            return { normal: this._uiNamedFrame(UI_NO), pressed: this._uiNamedFrame(UI_NO_PRESSED) };
        }
        return { normal: this._uiNamedFrame(UI_MENU_BUTTON), pressed: this._uiNamedFrame(UI_MENU_BUTTON_PRESSED) };
    }

    private _yesNoCenter(dialogW: number, dialogH: number, which: 'yes' | 'no'): { x: number; y: number } {
        const y = -dialogH / 2 + DIALOG_BUTTON_MARGIN_BOTTOM + YES_NO_SIZE / 2;
        if (which === 'yes') {
            return { x: -dialogW / 2 + DIALOG_LEFT_BUTTON_MARGIN_LEFT + YES_NO_SIZE / 2, y };
        }
        return { x: dialogW / 2 - DIALOG_RIGHT_BUTTON_MARGIN_RIGHT - YES_NO_SIZE / 2, y };
    }

    private _dialogBgFrame(width: number, height: number): SpriteFrame | null {
        if (width === MENU_BOX_WIDTH && height === MENU_BOX_HEIGHT) {
            return this._uiNamedFrame(UI_MENU_BOX);
        }
        if (width === 480 && height === 320) {
            return this._uiNamedFrame(UI_HIGHSCORE_BOX);
        }
        if (width === DIALOG_SMALL_WIDTH && height === DIALOG_SMALL_HEIGHT) {
            return this._uiNamedFrame(UI_TEXTBOX_SMALL);
        }
        if (width === DIALOG_LARGE_WIDTH && height === DIALOG_LARGE_HEIGHT) {
            return this._uiNamedFrame(UI_TEXTBOX_LARGE);
        }
        return null;
    }

    private _wireUiPressed(node: Node, normal: SpriteFrame, pressed: SpriteFrame): void {
        const state = node as unknown as { __uiNormal?: SpriteFrame; __uiPressed?: SpriteFrame; __uiWired?: boolean };
        state.__uiNormal = normal;
        state.__uiPressed = pressed;
        if (state.__uiWired) {
            const sprite = node.getChildByName('bg')?.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = normal;
            }
            return;
        }
        state.__uiWired = true;
        const apply = (which: 'normal' | 'pressed'): void => {
            const sprite = node.getChildByName('bg')?.getComponent(Sprite);
            const frame = which === 'pressed' ? state.__uiPressed : state.__uiNormal;
            if (sprite?.isValid && frame) {
                sprite.spriteFrame = frame;
            }
        };
        node.on(Node.EventType.TOUCH_START, () => apply('pressed'));
        node.on(Node.EventType.TOUCH_END, () => apply('normal'));
        node.on(Node.EventType.TOUCH_CANCEL, () => apply('normal'));
    }

    private _hitUpgradeSign(event: EventTouch): boolean {
        const sign = this._upgradeSign;
        if (!sign || !sign.isValid || !sign.active || !this._signReady) {
            return false;
        }
        const ut = sign.getComponent(UITransform);
        if (!ut) {
            return false;
        }
        return ut.hitTest(event.getLocation());
    }

    private _syncUpgradeSign(dtMs: number): void {
        const sign = this._upgradeSign;
        const pivot = this._upgradeSignPivot;
        const sim = this._sim;
        if (!sign || !sign.isValid || !pivot || !pivot.isValid || !sim) {
            return;
        }
        const unit = sim.unitById(sim.selectedId);
        const want = !!unit && unit.activity === ACTIVITY_WORKING && sim.canUpgrade(unit);
        // 木板贴在裁剪层里的屏幕左沿，底边压在停靠线上；裁剪层本身就是停靠线 y=0。
        sign.setPosition(-stageSize().width / 2, 0, 0);
        if (want !== this._signWanted) {
            this._signWanted = want;
            this._signHiding = !want;
            this._signAnimMs = 0;
            this._signReady = false;
            if (want) {
                sign.active = true;
            }
        }
        if (!this._signWanted && !sign.active && this._signHiding && this._signAnimMs <= 0) {
            pivot.angle = upgradeSignAngle(0, false);
            return;
        }
        this._signAnimMs += dtMs;
        const t = upgradeSignProgress(this._signAnimMs);
        pivot.angle = upgradeSignAngle(t, this._signHiding);
        if (t >= 1) {
            if (this._signHiding) {
                sign.active = false;
                this._signReady = false;
            } else {
                this._signReady = true;
            }
        }
    }

    private _syncUpgradeArrows(): void {
        const sim = this._sim;
        if (!sim) {
            return;
        }
        const frame = upgradeArrowFrame(GameTime.elapsedMs);
        for (const bind of this._bindings) {
            const unit = sim.unitById(bind.id);
            const show = !!unit && unit.alive
                && shouldDrawUpgradeArrow(unit.upgradeLevel ?? 1, unit.activity, unit.type);
            if (!show) {
                if (bind.upgradeArrow) {
                    bind.upgradeArrow.active = false;
                }
                continue;
            }
            const file = upgradeArrowFile(unit!.upgradeLevel ?? 1);
            if (!file) {
                continue;
            }
            const sheet = this._sheets.get(file);
            if (!sheet) {
                continue;
            }
            const fw = Math.trunc(sheet.width / UPGRADE_ARROW_FRAMES) || sheet.width;
            const fh = sheet.height;
            const sf = this._sheetFrame(sheet, frame, 0, fw, fh);
            const gatling = isGatlingUpgradeArrow(unit!.type);
            // apk 普通单位在 GameObjectUnit.draw() 里把箭头右下角贴在单位脚点；
            // 加特林/双炮（12/22/32）在 drawWeapon() 里以炮塔中心为基准另加 (9,6) 偏移。
            // 两者不在同一个父节点上，类型固定的绑定不会中途切换父节点。
            const wantParent = gatling
                ? (this._decorLayer ?? this._unitLayer ?? this._worldCanvas)
                : bind.root;
            let node = bind.upgradeArrow;
            if (!node || !node.isValid) {
                node = this._sprite(wantParent, 'upgradeArrow', sf, fw, fh);
                bind.upgradeArrow = node;
            } else if (node.parent !== wantParent) {
                node.removeFromParent();
                wantParent.addChild(node);
            }
            node.active = true;
            const ut = node.getComponent(UITransform);
            if (gatling) {
                if (ut) {
                    ut.setAnchorPoint(UPGRADE_ARROW_GATLING_ANCHOR_X, UPGRADE_ARROW_GATLING_ANCHOR_Y);
                }
                const weapon = this._vehicleWeapons.get(unit!.id);
                if (weapon && weapon.isValid) {
                    node.setPosition(
                        weapon.position.x + UPGRADE_ARROW_GATLING_OFFSET_X,
                        weapon.position.y + UPGRADE_ARROW_GATLING_OFFSET_Y,
                        0,
                    );
                    const weaponOrder = (weapon as TerrainDepthNode).__terrainDrawOrder;
                    (node as TerrainDepthNode).__terrainDrawOrder = weaponOrder === undefined
                        ? mapUnitDrawOrder(unit!.type, unit!.fineY) + 0.7
                        : weaponOrder + 0.1;
                } else {
                    // 炮塔贴图还没加载/activity 已降到 4：apk 此时 drawWeapon() 根本不会被调用。
                    node.active = false;
                }
            } else {
                if (ut) {
                    ut.setAnchorPoint(UPGRADE_ARROW_FOOT_ANCHOR_X, UPGRADE_ARROW_FOOT_ANCHOR_Y);
                }
                node.setPosition(0, 0, 0);
            }
            const sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = sf;
            }
        }
    }

    /**
     * 原版 dialog_upgrade/hire/message/gambler 都用 MyScrollView（ds_scroll_view）把全部文字
     * 纵向排进 (384-57-57)×(192-30-35)=270×127 的可滚动区；内容超出时往下拖即可看到后面段落。
     * 这里按同一布局造一个带 GRAPHICS_RECT 裁剪的 view + content，并挂拖拽滚动条。
     */
    private _makeDialogScroller(
        dialog: Node,
        viewW: number,
        viewH: number,
        atX: number,
        atY: number,
    ): { view: Node; content: Node } {
        const view = new Node('ds_scroll_view');
        dialog.addChild(view);
        view.layer = Layers.Enum.UI_2D;
        const viewUt = view.addComponent(UITransform);
        viewUt.setAnchorPoint(0.5, 0.5);
        viewUt.setContentSize(viewW, viewH);
        view.setPosition(atX, atY, 0);
        const mask = view.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;

        const content = new Node('ds_scroll_view_layout');
        view.addChild(content);
        content.layer = Layers.Enum.UI_2D;
        const contentUt = content.addComponent(UITransform);
        contentUt.setAnchorPoint(0.5, 1);
        contentUt.setContentSize(viewW, viewH);
        content.setPosition(0, viewH / 2, 0);
        return { view, content };
    }

    /** 复刻 MyScrollView 的拖动：内容高度超出视口时把 content 上移，右侧画 scrollbar_thumb/track。 */
    private _attachDialogScroll(
        dialog: Node,
        view: Node,
        content: Node,
        viewW: number,
        viewH: number,
        atX: number,
        atY: number,
        contentH: number,
    ): void {
        const maxScroll = Math.max(0, contentH - viewH);
        // 原版 MyScrollView 是 android.widget.ScrollView：内容高度 <= 视口时不产生滚动，
        // 也不画 thumb/track；文字按 TextView 的 gravity 垂直居中（dialog_message.xml 的
        // dialog_general_message_text gravity=0x11 = CENTER）。超高时才贴视口顶并可拖动。
        const baseTop = maxScroll > 0 ? viewH / 2 : contentH / 2;
        content.setPosition(0, baseTop, 0);
        if (maxScroll <= 0) {
            return;
        }
        const barX = atX + viewW / 2 - 3;
        const barTop = atY + viewH / 2;
        const track = new Node('scrollbar_track');
        dialog.addChild(track);
        track.layer = Layers.Enum.UI_2D;
        const trackUt = track.addComponent(UITransform);
        trackUt.setAnchorPoint(0.5, 1);
        trackUt.setContentSize(6, viewH);
        track.setPosition(barX, barTop, 0);
        const trackG = track.addComponent(Graphics);
        trackG.fillColor = new Color(0, 0, 0, 30);
        trackG.rect(-3, -viewH, 6, viewH);
        trackG.fill();
        const thumbH = Math.max(16, viewH * Math.min(1, viewH / Math.max(1, contentH)));
        const thumb = new Node('scrollbar_thumb');
        dialog.addChild(thumb);
        thumb.layer = Layers.Enum.UI_2D;
        const thumbUt = thumb.addComponent(UITransform);
        thumbUt.setAnchorPoint(0.5, 1);
        thumbUt.setContentSize(6, thumbH);
        thumb.setPosition(barX, barTop, 0);
        const thumbG = thumb.addComponent(Graphics);
        thumbG.fillColor = new Color(170, 130, 89, 255);
        thumbG.roundRect(-3, -thumbH, 6, thumbH, 3);
        thumbG.fill();
        let dragging = false;
        let lastY = 0;
        let offset = 0;
        view.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
            dragging = true;
            lastY = ev.getUILocation().y;
        }, this);
        view.on(Node.EventType.TOUCH_MOVE, (ev: EventTouch) => {
            if (!dragging) {
                return;
            }
            const y = ev.getUILocation().y;
            // Cocos y 向上为正：手指向上拖（dy>0）把内容往上推，露出下面被裁掉的段落。
            // content 顶部初始在视口顶 viewH/2，向上移动 = 加上 offset。
            offset = Math.min(maxScroll, Math.max(0, offset + (y - lastY)));
            lastY = y;
            content.setPosition(0, baseTop + offset, 0);
            thumb.setPosition(barX, barTop - offset * (viewH - thumbH) / maxScroll, 0);
        }, this);
        const stop = (): void => {
            dragging = false;
        };
        view.on(Node.EventType.TOUCH_END, stop, this);
        view.on(Node.EventType.TOUCH_CANCEL, stop, this);
    }

    private _openShopDialog(kind: string): void {
        this._closeShopDialog(false);
        if (kind === 'none' || !kind) {
            return;
        }
        const canvas = this._hudRoot ?? this.node.scene?.getChildByName('Canvas');
        if (!canvas) {
            return;
        }
        const sim = this._sim;
        const unit = sim?.unitById(sim.pendingUnitId >= 0 ? sim.pendingUnitId : sim.selectedId);
        const dialog = new Node('ShopDialog');
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        ut.setAnchorPoint(0.5, 0.5);
        // apk：父布局 272 高、文本框贴底，所以 192 高的框比屏幕中心低 40。
        this._slideDialogIn(dialog, 0, -40, DIALOG_LARGE_HEIGHT);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        bgUt.setAnchorPoint(0.5, 0.5);
        this._paintUiBg(bg, this._dialogBgFrame(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT), DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, new Color(40, 28, 16, 230));
        // 原版 dialog_upgrade/hire 的 ds_scroll_view：全部文字在一个纵向可滚动区里，
        // 段落顺序 标题→正文→价格→(升级才有的)改进标题→改进正文，超出 127 高可下滑。
        const box = dialogScrollBox();
        const scroller = this._makeDialogScroller(
            dialog, box.width, box.height, box.x, box.y,
        );
        const textX = box.textX;
        const textW = box.textWidth;
        const headline = this._dialogHeadline(kind, unit);
        const body = kind === 'upgrade-confirm' && unit && sim
            ? sim.upgradeDialogText(unit)
            : this._dialogBody(kind, unit);
        const improvements = kind === 'upgrade-confirm' && unit && sim
            ? sim.upgradeImprovementLines(unit)
            : [];
        const titleH = 20;
        const bodyH = body ? estimateTextHeight(body, textW, 14, 18) : 0;
        const priceH = 20;
        const improvesHeadingH = 16;
        const improvesTextH = improvements.length
            ? estimateTextHeight(improvements.join('\n'), textW, 13, 14)
            : 0;

        let amount: number | null = null;
        let canAfford = true;
        if (unit && sim && (kind === 'hire-confirm' || kind === 'upgrade-confirm' || kind === 'gamble-confirm')) {
            amount = kind === 'upgrade-confirm'
                ? (sim.upgradePriceOf(unit) ?? 0)
                : kind === 'gamble-confirm'
                    ? (sim.pendingStake || sim.stakeOf(unit))
                    : sim.priceOf(unit);
            canAfford = sim.cash >= amount;
        } else if (unit && sim && kind === 'no-money') {
            amount = sim.priceOf(unit);
            canAfford = false;
        }

        const sections: DialogSection[] = [{ height: titleH }];
        if (body) {
            sections.push({ height: bodyH, gap: 10 });
        }
        if (amount !== null) {
            sections.push({ height: priceH, gap: 10 });
        }
        if (improvements.length) {
            sections.push({ height: improvesHeadingH, gap: 10 });
            sections.push({ height: improvesTextH, gap: 0 });
        }
        const stack = stackDialogSections(sections, box.height);

        const title = this._uiLabel(scroller.content, 'title', headline, 15, DIALOG_TEXT_COLOR);
        const titleLabel = title.getComponent(Label);
        if (titleLabel) {
            titleLabel.isBold = true;
            // 原版 dialog_upgrade.xml 标题 gravity=0x00000003（LEFT）。
            titleLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        }
        const utTitle = title.getComponent(UITransform);
        if (utTitle) {
            utTitle.setAnchorPoint(0.5, 0.5);
            utTitle.setContentSize(textW, titleH);
        }
        title.setPosition(textX, stack.centers[0], 0);
        let sectionIndex = 1;
        if (body) {
            const bodyNode = this._uiLabel(scroller.content, 'body', body, 14, DIALOG_TEXT_COLOR);
            const bodyLabel = bodyNode.getComponent(Label);
            if (bodyLabel) {
                bodyLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
                bodyLabel.verticalAlign = Label.VerticalAlign.TOP;
                bodyLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
                bodyLabel.lineHeight = 18;
            }
            const bodyUt = bodyNode.getComponent(UITransform);
            if (bodyUt) {
                bodyUt.setAnchorPoint(0.5, 1);
                bodyUt.setContentSize(textW, bodyH);
            }
            bodyNode.setPosition(textX, stack.centers[sectionIndex] + bodyH / 2, 0);
            sectionIndex += 1;
        }
        if (amount !== null) {
            // 价格文字 + HirePriceImage 紧跟正文下方，段内按原版 marginLeft=10 的相对位置。
            this._placePriceRow(
                scroller.content, amount,
                textX - textW / 2, stack.centers[sectionIndex], canAfford,
            );
            sectionIndex += 1;
        }
        if (improvements.length) {
            const heading = this._uiLabel(scroller.content, 'improves_heading', UPGRADE_IMPROVES_HEADING, 13, DIALOG_TEXT_COLOR);
            const headingLabel = heading.getComponent(Label);
            if (headingLabel) {
                headingLabel.isBold = true;
                headingLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
            }
            const headingUt = heading.getComponent(UITransform);
            if (headingUt) {
                headingUt.setAnchorPoint(0.5, 0.5);
                headingUt.setContentSize(textW, improvesHeadingH);
            }
            heading.setPosition(textX, stack.centers[sectionIndex], 0);
            sectionIndex += 1;
            const bodyNode = this._uiLabel(scroller.content, 'improves_text', improvements.join('\n'), 13, DIALOG_TEXT_COLOR);
            const bodyLabel = bodyNode.getComponent(Label);
            if (bodyLabel) {
                bodyLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
                bodyLabel.verticalAlign = Label.VerticalAlign.TOP;
                bodyLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
                bodyLabel.lineHeight = 14;
            }
            const bodyUt = bodyNode.getComponent(UITransform);
            if (bodyUt) {
                bodyUt.setAnchorPoint(0.5, 1);
                bodyUt.setContentSize(textW, improvesTextH);
            }
            bodyNode.setPosition(textX, stack.centers[sectionIndex] + improvesTextH / 2, 0);
        }
        const contentUt = scroller.content.getComponent(UITransform);
        if (contentUt) {
            contentUt.setContentSize(textW, Math.max(box.height, stack.contentHeight));
        }
        this._attachDialogScroll(
            dialog, scroller.view, scroller.content,
            box.width, box.height, box.x, box.y, stack.contentHeight,
        );
        // apk GameScreenActivity.onPrepareDialog case 7 无条件 setUpDialog(unit.getPortraitResId())：
        // 升级确认框必须画单位头像（含 12/22 工程师、32 船长）。旧代码漏掉了这一句。
        if (unit && (kind === 'hire-confirm' || kind === 'no-money' || kind === 'upgrade-confirm')) {
            this._dialogPortrait(dialog, unit.type);
        } else if (kind === 'dynamite-not-ready') {
            // apk case 10：setUpDialog(T_TRAP_CANNOT_USE_01, dynamite, T_SPECIAL_UNIT_NAME_01)。
            this._dialogPortrait(dialog, -1, 'oregon_dakota_portrait_dynamite');
            playPortraitVoice('oregon_dakota_portrait_dynamite');
        } else if (kind === 'gamble-confirm' || kind === 'gamble-not-ready' || kind === 'gamble-no-money') {
            // apk case 14/15/17：头像都是 portrait_gambler。
            this._dialogPortrait(dialog, -1, 'portrait_gambler');
            // 只有 case 14 走两参数 setUpDialog 会播音；15/17 是三参数，不播。
            if (kind === 'gamble-not-ready') {
                playPortraitVoice('portrait_gambler');
            }
        }
        if (kind === 'no-money' || kind === 'gamble-no-money') {
            // apk case 3/17：dialog_ok.setVisibility(4)，只剩右下 dialog_cancel（but_no_xml 返回键）。
            this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'no', '取消', () => this._dismissShop());
        } else if (kind === 'gamble-not-ready' || kind === 'dynamite-not-ready') {
            // apk case 10/14：没有隐藏任何按钮，确认和返回都在。
            this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '确定', () => this._dismissShop());
            this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'no', '取消', () => this._dismissShop());
        } else if (kind === 'gamble-cards') {
            this._closeShopDialog(false);
            this._openCardDialog();
            return;
        } else {
            this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '确定', () => this._confirmShop());
            this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'no', '取消', () => this._dismissShop());
        }
        this._shopDialog = dialog;
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
    }

    private _placePriceRow(parent: Node, amount: number, x: number, y: number, canAfford = true): void {
        // apk：先「价格」文字，空 10dip，再 $ + 数字；$ 两格，买得起用金色第 0 格，买不起用第 1 格。
        const priceLabel = this._uiLabel(parent, 'price_label', '价格：', 14, DIALOG_TEXT_COLOR);
        const priceLab = priceLabel.getComponent(Label);
        if (priceLab) {
            priceLab.horizontalAlign = Label.HorizontalAlign.LEFT;
        }
        const labelUt = priceLabel.getComponent(UITransform);
        if (labelUt) {
            labelUt.setAnchorPoint(0, 0.5);
            labelUt.setContentSize(48, 20);
        }
        priceLabel.setPosition(x, y, 0);
        const glyphs = priceGlyphs(amount, canAfford ? 0 : 1);
        const numSheet = this._sheets.get(HUD_FONT_NUMBERS);
        const dolSheet = this._sheets.get(HUD_FONT_DOLLAR);
        if (!numSheet || !dolSheet) {
            const label = this._uiLabel(parent, 'price', `$${amount}`, 16, DIALOG_TEXT_COLOR);
            label.setPosition(x + 72, y, 0);
            return;
        }
        const numW = Math.trunc(numSheet.width / PRICE_NUMBER_CELLS) || numSheet.width;
        const numH = numSheet.height;
        const dolW = Math.trunc(dolSheet.width / PRICE_DOLLAR_CELLS) || dolSheet.width;
        const dolH = dolSheet.height;
        const widths = glyphs.map((g) => (g.kind === 'dollar' ? dolW : numW));
        let cursor = x + 58;
        for (let i = 0; i < glyphs.length; i++) {
            const glyph = glyphs[i];
            const sheet = glyph.kind === 'dollar' ? dolSheet : numSheet;
            const w = widths[i];
            const h = glyph.kind === 'dollar' ? dolH : numH;
            const sf = this._sheetFrame(sheet, glyph.cell, 0, w, h);
            const node = this._uiSprite(parent, `glyph_${i}`, sf, w, h);
            node.setPosition(cursor + w / 2, y, 0);
            cursor += w;
        }
    }

    private _hireIndex(type: number): number {
        const i = HIRE_ORDER.indexOf(type as typeof HIRE_ORDER[number]);
        return i < 0 ? 0 : i;
    }

    private _dialogHeadline(kind: string, unit: { type: number } | null): string {
        if (unit) {
            const name = HIRE_NAMES[this._hireIndex(unit.type)] ?? '';
            if (kind === 'hire-confirm' || kind === 'no-money') {
                return name;
            }
            if (kind === 'upgrade-confirm') {
                // apk case 7：ask_for_upgrade_dialog_heading 只印单位名（getUnitNameResId）。
                return name;
            }
            if (kind === 'gamble-confirm') {
                return this._officialString('T_SPECIAL_UNIT_NAME_01') || '赌徒';
            }
        }
        if (kind === 'dynamite-not-ready' || kind === 'gamble-not-ready'
            || kind === 'gamble-no-money' || kind === 'gamble-confirm') {
            // apk case 10/14/15/17：special-unit 弹窗标题都用 T_SPECIAL_UNIT_NAME_01。
            return this._officialString('T_SPECIAL_UNIT_NAME_01') || '赌徒';
        }
        return shopTitle(kind);
    }

    private _dialogBody(kind: string, unit: { type: number } | null): string {
        if (kind === 'dynamite-not-ready') {
            return this._officialString('T_TRAP_CANNOT_USE_01') || '你必须在阳光照到这里前埋好炸药。';
        }
        if (kind === 'gamble-not-ready') {
            return this._officialString('T_SPECIAL_UNIT_CANNOT_USE_01') || '外国佬！赌场已经关闭，你必须等我洗牌完成！';
        }
        if (kind === 'gamble-no-money') {
            return this._officialString('T_SPECIAL_UNIT_CANNOT_USE_02') || '在你进入我们的小扑克游戏之前你必须完一场赌注更多的赌博！';
        }
        if (kind === 'gamble-confirm') {
            const games = (unit as { games?: number } | null)?.games ?? 0;
            const key = games === 0 || games > 5 ? 'T_SPECIAL_UNIT_USE_01' : 'T_SPECIAL_UNIT_USE_02';
            return this._officialString(key) || '想玩扑克吗？来吧，挑战命运！这个房间需要人！';
        }
        if (!unit) {
            return '';
        }
        const idx = this._hireIndex(unit.type);
        if (kind === 'hire-confirm') {
            return HIRE_MESSAGES[idx] ?? '';
        }
        if (kind === 'no-money') {
            return CANNOT_HIRE_MESSAGES[idx] ?? '';
        }
        if (kind === 'gamble-confirm') {
            return '押上赌注，翻牌定输赢。';
        }
        return '';
    }

    /** apk：头像挂在对话框右上角，左 230、上 -80（相对 384×192 的盒子）。 */
    private _dialogPortrait(dialog: Node, type: number, fileOverride?: string): void {
        const file = fileOverride ?? UNIT_PORTRAIT[type];
        if (!file) {
            return;
        }
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return;
        }
        const frame = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
        const node = this._uiSprite(dialog, 'portrait', frame, sheet.width, sheet.height);
        // dialog_message/hire/upgrade/final_stats：头像先声明，messagebox 后声明；重叠处由背景盖住头像。
        node.setSiblingIndex(0);
        const ut = node.getComponent(UITransform);
        if (ut) {
            ut.setAnchorPoint(0, 0);
        }
        // 盒子中心在 y=-40（父布局 272 高、盒子贴底），头像底边 = 盒顶 + 80 − 头像高。
        node.setPosition(
            -DIALOG_LARGE_WIDTH / 2 + 230,
            DIALOG_LARGE_HEIGHT / 2 + 80 - sheet.height,
            0,
        );
    }

    private _uiLabel(parent: Node, name: string, text: string, fontSize: number, color?: Color): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(360, 48);
        ut.setAnchorPoint(0.5, 0.5);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        if (color) {
            label.color = color;
        }
        return node;
    }

    private _uiButton(
        parent: Node,
        text: string,
        x: number,
        y: number,
        onClick: () => void,
        artOverride?: { normal: SpriteFrame | null; pressed: SpriteFrame | null },
    ): void {
        const kind = this._dialogButtonKind(text);
        const fallback = kind === 'yes' || kind === 'no'
            ? { w: YES_NO_SIZE, h: YES_NO_SIZE }
            : { w: MENU_BUTTON_WIDTH, h: MENU_BUTTON_HEIGHT };
        const node = new Node(`btn_${text}`);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        const bg = new Node('bg');
        node.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const art = artOverride ?? this._dialogButtonArt(text);
        const size = fallback;
        ut.setContentSize(size.w, size.h);
        this._paintUiBg(bg, art.normal, size.w, size.h, new Color(180, 130, 60, 255));
        if (art.normal && art.pressed) {
            this._wireUiPressed(node, art.normal, art.pressed);
        }
        // apk PsxImageButton 构造函数第一行是 if (GunsAndGloryApp.hasPSXKeys)；
        // hasPSXKeys 只在 Sony Ericsson R800 上置 true，模拟器/普通 Android 恒为 false，
        // 所以原版在这些设备上 yes/no 按钮不叠 gng_hud_2_ps_1/ps_2 图标。
        if (kind !== 'yes' && kind !== 'no') {
            const label = this._uiLabel(node, 'label', text, 22);
            const lab = label.getComponent(Label);
            if (lab) {
                lab.color = new Color(255, 255, 255, 255);
            }
        }
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        node.on(Node.EventType.TOUCH_END, (ev: EventTouch) => {
            ev.propagationStopped = true;
            onClick();
        }, this);
    }

    private _uiYesNo(
        parent: Node,
        dialogW: number,
        dialogH: number,
        which: 'yes' | 'no',
        text: string,
        onClick: () => void,
        artOverride?: { normal: SpriteFrame | null; pressed: SpriteFrame | null },
    ): void {
        const at = this._yesNoCenter(dialogW, dialogH, which);
        this._uiButton(parent, text, at.x, at.y, onClick, artOverride);
    }

    private _uiMenuButton(parent: Node, text: string, x: number, y: number, onClick: () => void): void {
        const node = new Node(`menu_${text}`);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        const bg = new Node('bg');
        node.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const normal = this._uiNamedFrame(UI_MENU_BUTTON);
        const pressed = this._uiNamedFrame(UI_MENU_BUTTON_PRESSED);
        const size = { w: MENU_BUTTON_WIDTH, h: MENU_BUTTON_HEIGHT };
        ut.setContentSize(size.w, size.h);
        this._paintUiBg(bg, normal, size.w, size.h, new Color(180, 130, 60, 255));
        if (normal && pressed) {
            this._wireUiPressed(node, normal, pressed);
        }
        const label = this._uiLabel(node, 'label', text, 22);
        const lab = label.getComponent(Label);
        if (lab) {
            lab.color = new Color(255, 255, 255, 255);
        }
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        node.on(Node.EventType.TOUCH_END, (ev: EventTouch) => {
            ev.propagationStopped = true;
            onClick();
        }, this);
    }

    private _confirmShop(): void {
        const sim = this._sim;
        if (!sim) {
            this._closeShopDialog(true);
            return;
        }
        if (sim.dialog === 'hire-confirm') {
            sim.confirmHire();
            this._closeShopDialog(true);
        } else if (sim.dialog === 'upgrade-confirm') {
            sim.confirmUpgrade();
            this._closeShopDialog(true);
        } else if (sim.dialog === 'gamble-confirm') {
            const ok = sim.confirmGamble();
            this._closeShopDialog(!ok);
            if (ok) {
                this._openCardDialog();
            } else if (sim.dialog !== 'none') {
                this._openShopDialog(sim.dialog);
            }
        } else {
            this._closeShopDialog(true);
        }
        this._syncCashHud();
    }

    private _dismissShop(): void {
        this._sim?.cancelDialog();
        this._closeShopDialog(true);
    }

    private _closeShopDialog(resume: boolean): void {
        if (this._shopDialog && this._shopDialog.isValid) {
            this._shopDialog.destroy();
        }
        this._shopDialog = null;
        if (resume && !this._cardDialog) {
            GameTime.setDialogOpen(false);
            UiTouchGuard.blocked = false;
        }
    }

    private _openCardDialog(): void {
        this._closeCardDialog(false);
        const sim = this._sim;
        const canvas = this._hudRoot ?? this.node.scene?.getChildByName('Canvas');
        if (!sim || !canvas || !sim.cardReveal) {
            GameTime.setDialogOpen(true);
            UiTouchGuard.blocked = true;
            return;
        }
        const dialog = new Node('GamblerCardDialog');
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        ut.setAnchorPoint(0.5, 0.5);
        // apk：父布局 272 高、文本框贴底，所以 192 高的框比屏幕中心低 40。
        this._slideDialogIn(dialog, 0, -40, DIALOG_LARGE_HEIGHT);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        this._paintUiBg(bg, this._dialogBgFrame(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT), DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, new Color(28, 18, 12, 236));
        const title = this._uiLabel(dialog, 'title', this._officialString('T_SPECIAL_UNIT_NAME_01') || CARD_REVEAL_TITLE, 24, DIALOG_TEXT_COLOR);
        title.setPosition(0, 50, 0);
        // apk dialog 16：setUpDialog(resultText, portrait_gambler, T_SPECIAL_UNIT_NAME_01)，三参数不播语音。
        this._dialogPortrait(dialog, -1, 'portrait_gambler');
        const resultNo = Math.max(1, Math.min(10, sim.lastGambleResult || 10));
        const resultKey = `T_SPECIAL_UNIT_RESULT_${String(resultNo).padStart(2, '0')}`;
        const resultNode = this._uiLabel(dialog, 'result', this._officialString(resultKey), 12, DIALOG_TEXT_COLOR);
        const resultUt = resultNode.getComponent(UITransform);
        if (resultUt) {
            resultUt.setContentSize(DIALOG_LARGE_WIDTH - DIALOG_CONTENT_MARGIN * 2, 24);
        }
        resultNode.setPosition(0, -58, 0);
        const row = new Node('cards');
        dialog.addChild(row);
        row.layer = Layers.Enum.UI_2D;
        row.setPosition(0, 8, 0);
        for (let i = 0; i < 5; i++) {
            const card = this._makeCardNode(row, i);
            card.setPosition(-140 + i * 70, 0, 0);
        }
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '好的', () => this._closeCardDialog(true));
        this._cardDialog = dialog;
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
        this._paintCards();
    }

    private _makeCardNode(parent: Node, index: number): Node {
        const node = new Node(`card_${index}`);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(80, 112);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(240, 236, 220, 255);
        g.rect(-40, -56, 80, 112);
        g.fill();
        g.strokeColor = new Color(80, 40, 20, 255);
        g.lineWidth = 2;
        g.rect(-40, -56, 80, 112);
        g.stroke();
        const tl = this._uiLabel(node, 'tl', '', 16, DIALOG_TEXT_COLOR);
        tl.setPosition(-22, 40, 0);
        const br = this._uiLabel(node, 'br', '', 16, DIALOG_TEXT_COLOR);
        br.setPosition(22, -40, 0);
        const mid = this._uiLabel(node, 'mid', '', 28, DIALOG_TEXT_COLOR);
        mid.setPosition(0, 0, 0);
        return node;
    }

    private _paintCards(): void {
        const dialog = this._cardDialog;
        const reveal = this._sim?.cardReveal;
        if (!dialog || !dialog.isValid || !reveal) {
            return;
        }
        const row = dialog.getChildByName('cards');
        if (!row) {
            return;
        }
        for (let i = 0; i < reveal.cards.length; i++) {
            const node = row.getChildByName(`card_${i}`);
            if (!node) {
                continue;
            }
            const card = reveal.cards[i];
            node.setPosition(-180 + i * 90, -card.y, 0);
            const tl = node.getChildByName('tl')?.getComponent(Label);
            const br = node.getChildByName('br')?.getComponent(Label);
            const mid = node.getChildByName('mid')?.getComponent(Label);
            const text = card.revealed ? `${card.suitGlyph}${card.rankLabel}` : '';
            if (tl) {
                tl.string = text;
            }
            if (br) {
                br.string = text;
            }
            if (mid) {
                mid.string = card.revealed ? card.suitGlyph : '';
            }
        }
    }

    private _tickCardReveal(dtMs: number): void {
        const sim = this._sim;
        if (!sim?.cardReveal || !this._cardDialog) {
            return;
        }
        if (sim.cardReveal.phase !== 'done') {
            const previous = sim.cardReveal.phase;
            sim.cardReveal = tickCardReveal(sim.cardReveal, dtMs);
            if (previous === 'slide' && sim.cardReveal.phase !== 'slide') {
                playGameSfx('cards_deal');
            }
        }
        this._paintCards();
    }

    private _closeCardDialog(resume: boolean): void {
        const dialog = this._cardDialog;
        this._cardDialog = null;
        if (this._sim && this._sim.dialog === 'gamble-cards') {
            this._sim.dialog = 'none';
            this._sim.pendingUnitId = -1;
        }
        const finish = () => {
            if (dialog && dialog.isValid) {
                dialog.destroy();
            }
            if (resume && !this._shopDialog && !this._outcomeDialog && !this._cardDialog) {
                GameTime.setDialogOpen(false);
                UiTouchGuard.blocked = false;
            }
        };
        if (dialog && dialog.isValid) {
            this._slideDialogOut(dialog, DIALOG_LARGE_HEIGHT, finish);
        } else {
            finish();
        }
    }


    private _canvasRoot(): Node | null {
        return this._hudRoot ?? this.node.scene?.getChildByName('Canvas') ?? null;
    }

    private _closeOutcomeDialog(resume: boolean): void {
        const dialog = this._outcomeDialog;
        this._outcomeDialog = null;
        this._tallyLabel = null;
        this._statRows = [];
        this._statCashLabel = null;
        this._statTotalLabel = null;
        this._nameBox = null;
        const finish = () => {
            if (dialog && dialog.isValid) {
                dialog.destroy();
            }
            if (resume && !this._shopDialog && !this._cardDialog && !this._outcomeDialog) {
                GameTime.setDialogOpen(false);
                UiTouchGuard.blocked = false;
            }
        };
        if (dialog && dialog.isValid) {
            this._slideDialogOut(dialog, DIALOG_LARGE_HEIGHT, finish);
        } else {
            finish();
        }
    }

    /**
     * apk CustomDialog.startFadeInAnimation：dialog_slide_in，600ms 从下方 100% 高度滑入，
     * accelerate_decelerate（sineInOut）。所有战斗内对话框都走这里。
     */
    private _slideDialogIn(dialog: Node, x: number, y: number, height: number): void {
        dialog.setPosition(x, y - height, 0);
        tween(dialog)
            .to(0.6, { position: new Vec3(x, y, 0) }, { easing: 'sineInOut' })
            .start();
    }

    /**
     * apk CustomDialog.onOk/onCancel/fadeOut：先播 dialog_slide_out（600ms 回到下方 100%），
     * 动画结束才销毁节点并回调。interpolator 同样是 accelerate_decelerate。
     */
    private _slideDialogOut(dialog: Node, height: number, done: () => void): void {
        if (this._dialogClosing.has(dialog)) {
            return;
        }
        this._dialogClosing.add(dialog);
        const from = dialog.position.clone();
        tween(dialog)
            .to(0.6, { position: new Vec3(from.x, from.y - height, from.z) }, { easing: 'sineInOut' })
            .call(done)
            .start();
    }

    private _openPanel(name: string, width: number, height: number): Node | null {
        this._closeOutcomeDialog(false);
        const canvas = this._canvasRoot();
        if (!canvas) {
            return null;
        }
        const dialog = new Node(name);
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(width, height);
        ut.setAnchorPoint(0.5, 0.5);
        this._slideDialogIn(dialog, 0, 0, height);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(width, height);
        bgUt.setAnchorPoint(0.5, 0.5);
        const frame = this._dialogBgFrame(width, height);
        this._paintUiBg(bg, frame, width, height, new Color(40, 28, 16, 230));
        this._outcomeDialog = dialog;
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
        return dialog;
    }

    private _syncOutcomeUi(dtMs: number): void {
        const sim = this._sim;
        if (!sim || this._levelLoading) {
            return;
        }
        if ((sim.outcome === 'clear' || sim.outcome === 'fail') && sim.tally && !sim.tally.countingDone) {
            sim.tickTally(dtMs);
            this._refreshTallyLabel();
        }
        if (this._outcomeDialog && this._outcomeDialog.isValid) {
            return;
        }
        if (this._continuePending) {
            this._openContinueDialog();
            return;
        }
        if (sim.outcome === 'difficulty' || sim.canOfferDifficultyPick()) {
            this._openDifficultyDialog();
        } else if (sim.outcome === 'fail') {
            this._openFailDialog();
        } else if (sim.outcome === 'end-message') {
            this._openEndMessageDialog();
        } else if (sim.outcome === 'clear') {
            this._openClearDialog();
        } else if (sim.outcome === 'name') {
            this._openNameDialog();
        } else if (sim.outcome === 'unlock') {
            this._openUnlockDialog();
        }
    }

    private _openContinueDialog(): void {
        if (!this._continuePending) {
            return;
        }
        const dialog = this._openPanel('ContinueDialog', DIALOG_SMALL_WIDTH, DIALOG_SMALL_HEIGHT);
        if (!dialog) {
            return;
        }
        const title = this._uiLabel(dialog, 'title', '要继续上次的战斗吗？', 24, DIALOG_TEXT_COLOR);
        title.setPosition(0, 16, 0);
        this._uiYesNo(dialog, DIALOG_SMALL_WIDTH, DIALOG_SMALL_HEIGHT, 'yes', '继续', () => this._onContinueYes());
        this._uiYesNo(dialog, DIALOG_SMALL_WIDTH, DIALOG_SMALL_HEIGHT, 'no', '不了', () => this._onContinueNo());
    }

    private _applyMidSaveIfAny(): void {
        const sim = this._sim;
        const save = this._saves?.getMidSave(regionIndex(this._playLevel));
        this._continuePending = false;
        if (sim && save) {
            applyBattle(sim, save);
            this._clearStaleUnitBindings();
        }
    }

    private _onContinueYes(): void {
        this._applyMidSaveIfAny();
        this._closeOutcomeDialog(true);
    }

    private _onContinueNo(): void {
        // 选关界面已经接手继续询问。这里若仍走到「不了」，按原版对话框 1 取消：不删档。
        this._saves?.declineContinue(regionIndex(this._playLevel));
        this._continuePending = false;
        this._closeOutcomeDialog(false);
    }

    private _clearStaleUnitBindings(): void {
        const sim = this._sim;
        if (!sim) {
            return;
        }
        const live = new Set(sim.units.filter((u) => u.alive).map((u) => u.id));
        const keep: typeof this._bindings = [];
        for (const bind of this._bindings) {
            if (live.has(bind.id) && bind.root?.isValid) {
                keep.push(bind);
            } else if (bind.root?.isValid) {
                bind.root.destroy();
            }
        }
        this._bindings = keep;
        for (const bind of this._enemyBindings) {
            if (bind.root?.isValid) {
                bind.root.destroy();
            }
        }
        this._enemyBindings = [];
    }

    private _uiDifficultyChoice(
        parent: Node,
        text: string,
        portrait: string,
        x: number,
        y: number,
        w: number,
        iconH: number,
        textH: number,
        locked: boolean,
        onClick: () => void,
    ): void {
        // apk MapSelectionButton.onMeasure：按钮高 = 文字行高 + 图标高；图标在上，文字行在下。
        const h = iconH + textH;
        const node = new Node(`diff_${text}`);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        let portraitSprite: Sprite | null = null;
        const frame = this._uiNamedFrame(portrait);
        if (frame) {
            const bg = new Node('portrait');
            node.addChild(bg);
            bg.layer = Layers.Enum.UI_2D;
            // apk DifficultyButton.onLayout：mapIcon.setBounds(0,0,iconW,iconH) → 画在按钮顶部。
            this._paintUiBg(bg, frame, w, iconH, new Color(40, 28, 16, 255));
            const bgUt = bg.getComponent(UITransform);
            if (bgUt) {
                bgUt.setAnchorPoint(0.5, 1);
            }
            bg.setPosition(0, h / 2, 0);
            portraitSprite = bg.getComponent(Sprite);
        }
        // 未解锁的难度整张头像压暗。
        if (portraitSprite) {
            portraitSprite.color = locked ? new Color(96, 96, 96, 255) : Color.WHITE;
        }
        const label = this._uiLabel(node, 'label', text, MAPSCREEN_FONT_SIZE);
        const labelUt = label.getComponent(UITransform);
        if (labelUt) {
            labelUt.setContentSize(w, textH);
        }
        // apk：TextView gravity=bottom，文字在图标下方的独立一行。
        label.setPosition(0, -h / 2 + textH / 2, 0);
        const lab = label.getComponent(Label);
        if (lab) {
            lab.color = locked ? new Color(204, 204, 204, 255) : new Color(255, 255, 255, 255);
            lab.lineHeight = MAPSCREEN_FONT_SIZE + 2;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
        }
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        const setPressed = (pressed: boolean): void => {
            if (!portraitSprite || locked) {
                return;
            }
            portraitSprite.color = pressed ? new Color(255, 226, 150, 255) : Color.WHITE;
        };
        node.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
            ev.propagationStopped = true;
            setPressed(true);
        }, this);
        node.on(Node.EventType.TOUCH_CANCEL, (ev: EventTouch) => {
            ev.propagationStopped = true;
            setPressed(false);
        }, this);
        node.on(Node.EventType.TOUCH_END, (ev: EventTouch) => {
            ev.propagationStopped = true;
            setPressed(false);
            onClick();
        }, this);
    }

    private _openDifficultyDialog(): void {
        const sim = this._sim;
        if (!sim || !sim.canOfferDifficultyPick()) {
            return;
        }
        sim.outcome = 'difficulty';
        const dialogH = DIALOG_LARGE_HEIGHT;
        const dialog = this._openPanel('DifficultyDialog', DIALOG_LARGE_WIDTH, dialogH);
        if (!dialog) {
            return;
        }
        // APK: title layout_alignParentTop + layout_centerHorizontal，marginTop = paddingTop。
        const title = this._uiLabel(dialog, 'title', '选择难度', MAPSCREEN_FONT_SIZE);
        title.setPosition(0, dialogH / 2 - DIALOG_DIFFICULTY_PADDING - 10, 0);
        const labels = DIFFICULTY_LABELS ?? ['容易', '中等', '困难'];
        const tiers = [MODE_EASY, MODE_NORMAL, MODE_HARD];
        const btnW = DIFFICULTY_PORTRAIT_WIDTH;
        const iconH = DIFFICULTY_PORTRAIT_HEIGHT;
        // 模拟器实测按钮高 404px/3 = 134.7dp：头像 110 + 文字行约 24.7（15sp 带字体上下留白）。
        const textH = 24;
        const btnH = iconH + textH;
        // APK: 中间按钮 layout_alignParentBottom + layout_marginBottom=dialog_difficulty_padding_bottom(18)，
        // 左右两个 toLeftOf/toRightOf 中间那个且 alignBottom。三个按钮底部对齐对话框底 + 18。
        const y = -dialogH / 2 + DIALOG_DIFFICULTY_PADDING + btnH / 2;
        const hardLocked = !(sim.progress?.hardUnlocked ?? false);
        for (let i = 0; i < 3; i++) {
            const tier = tiers[i];
            const x = (i - 1) * (btnW + DIALOG_DIFFICULTY_BUTTON_SPACER);
            const locked = tier === MODE_HARD && hardLocked;
            this._uiDifficultyChoice(dialog, labels[i], DIFFICULTY_PORTRAIT_FILES[i], x, y, btnW, iconH, textH, locked, () => this._onPickDifficulty(tier));
        }
    }

    private _onPickDifficulty(tier: number): void {
        const sim = this._sim;
        if (!sim) {
            return;
        }
        const result = sim.pickDifficulty(tier);
        if (result.ok) {
            this._closeOutcomeDialog(true);
            return;
        }
        if (result.reason === 'locked') {
            // apk GameScreenActivity case 11：点未解锁的困难走 displayDialog(12) + T_DIFFICULTY_LOCKED，
            // 弹出提示框，难度选择框还留在下面。
            // apk 解锁条件（GunsAndGloryThread.onLevelFinished）：totalLevelId % 10 == 0，
            // 即完成第 10/20/30… 关解锁，不要求通关、不限难度。T_DIFFICULTY_LOCKED 各语言也都写“完成 Oregon（前 10 关）”。
            sim.purchaseOffered = false;
            sim.outcome = 'difficulty';
            this._openMessageDialog(this._officialString('T_DIFFICULTY_LOCKED') || '这个难度未解锁，你必须先完成低级的关卡！', null);
        }
    }

    /** 波次开始时弹出的 Pedro 对话框（dialog_message.xml）。portrait 传 null 时不画头像（如难度未解锁提示）。 */
    private _openMessageDialog(text: string, portrait: string | null = 'portrait_pedro'): void {
        const canvas = this._canvasRoot();
        if (!canvas) {
            return;
        }
        this._closeMessageDialog();
        const dialog = new Node('MessageDialog');
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        ut.setAnchorPoint(0.5, 0.5);
        this._slideDialogIn(dialog, 0, -40, DIALOG_LARGE_HEIGHT);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        bgUt.setAnchorPoint(0.5, 0.5);
        this._paintUiBg(bg, this._dialogBgFrame(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT), DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, new Color(40, 28, 16, 230));
        if (portrait) {
            this._dialogPortrait(dialog, -1, portrait);
            // apk InGameGeneralMessageDialog.setUpDialog(text, portrait) 两参数版本会按头像播音。
            playPortraitVoice(portrait);
        }
        // apk dialog_message.xml：dialog_general_message_text 放在 ds_scroll_view 里，
        // gravity=0x11（居中），超出 127 高可下滑；不再是固定 100 高的静态文本。
        const box = dialogScrollBox();
        const scroller = this._makeDialogScroller(dialog, box.width, box.height, box.x, box.y);
        const textH = estimateTextHeight(text, box.textWidth, 14, 18);
        const bodyNode = this._uiLabel(scroller.content, 'body', text, 14, DIALOG_TEXT_COLOR);
        const bodyLabel = bodyNode.getComponent(Label);
        if (bodyLabel) {
            bodyLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            bodyLabel.verticalAlign = Label.VerticalAlign.TOP;
            bodyLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
            bodyLabel.lineHeight = 18;
        }
        const bodyUt = bodyNode.getComponent(UITransform);
        if (bodyUt) {
            bodyUt.setAnchorPoint(0.5, 1);
            bodyUt.setContentSize(box.textWidth, textH);
        }
        bodyNode.setPosition(box.textX, 0, 0);
        const contentUt = scroller.content.getComponent(UITransform);
        if (contentUt) {
            contentUt.setContentSize(box.textWidth, Math.max(box.height, textH));
        }
        this._attachDialogScroll(
            dialog, scroller.view, scroller.content,
            box.width, box.height, box.x, box.y, textH,
        );
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '好的', () => this._closeMessageDialog());
        this._messageDialog = dialog;
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
    }

    private _closeMessageDialog(): void {
        const dialog = this._messageDialog;
        this._messageDialog = null;
        const finish = () => {
            if (dialog && dialog.isValid) {
                dialog.destroy();
            }
            if (!this._pauseDialog && !this._shopDialog && !this._outcomeDialog && !this._messageDialog) {
                GameTime.setDialogOpen(false);
            }
        };
        if (dialog && dialog.isValid) {
            this._slideDialogOut(dialog, DIALOG_LARGE_HEIGHT, finish);
        } else {
            finish();
        }
    }

    /** 数据显示层的 @string/xxx → 中文文案。 */
    private _officialString(id: string): string {
        const key = id.replace(/^@string\//, '').trim();
        if (!key) {
            return '';
        }
        return this._strings.get(key) ?? '';
    }

    private async _loadStrings(): Promise<void> {
        if (this._stringsLoaded) {
            return;
        }
        this._stringsLoaded = true;
        try {
            const bundle = await loadBundle('base');
            const text = await loadText(bundle, 'data/strings/strings_default');
            const table = TsvTable.parse('strings', text);
            for (const row of table.rows) {
                const key = (row.key ?? '').trim();
                if (key) {
                    this._strings.set(key, row.text ?? '');
                }
            }
        } catch (err) {
            console.warn('[Strings] 读取失败', err);
        }
    }

    /** 每波第一次出现时弹一次对话，内容取「波次文案」。 */
    private _syncWaveText(): void {
        const sim = this._sim;
        const wave = sim?.waves?.current;
        if (!sim || !wave || !wave.waveText || this._messageDialog) {
            return;
        }
        if (GameTime.dialogOpen || sim.outcome !== 'none' || this._pauseDialog) {
            return;
        }
        const key = `${sim.waves!.waveIndex}:${wave.waveText}`;
        if (this._shownWaveTexts.has(key)) {
            return;
        }
        const text = this._officialString(wave.waveText);
        if (!text) {
            return;
        }
        this._shownWaveTexts.add(key);
        // apk GameScreenActivity case 0：setUpDialog(wm.getCurrentText(), wm.getCurrentImage())。
        // 头像按原版 GameDesignWaves.newWave() 的第二参数逐条对齐，不再固定 Pedro。
        this._openMessageDialog(text, WAVE_TEXT_PORTRAIT[wave.waveText] ?? 'portrait_pedro');
    }

    private _tallyText(sim: GameSim): string {
        const tally = sim.tally;
        if (!tally) {
            return '结算 $0';
        }
        const lines: string[] = [];
        for (let i = 0; i < tally.counted.length; i++) {
            if (tally.counted[i] <= 0 && tally.remain[i] <= 0) {
                continue;
            }
            lines.push(`${TALLY_GROUP_NAMES[i]} x ${tally.counted[i]}  $${tally.cashDone[i]}`);
        }
        lines.push(`赏金合计 $${tally.cashTotal}`);
        return lines.join('\n') || '结算 $0';
    }

    private _refreshTallyLabel(): void {
        const sim = this._sim;
        const tally = sim?.tally;
        if (!sim || !tally) {
            return;
        }
        for (const row of this._statRows) {
            row.count.string = `x ${tally.counted[row.group]}`;
            row.cash.string = `${tally.cashDone[row.group]}`;
        }
        if (this._statCashLabel) {
            this._statCashLabel.string = `$ ${sim.cash}`;
        }
        if (this._statTotalLabel) {
            const total = Math.round((tally.cashTotal + sim.cash) * difficultyPercent(this._statTier) / 100);
            this._statTotalLabel.string = `= $ ${total}`;
        }
    }

    private _openFailDialog(): void {
        this._openStatsDialog(false);
    }

    private _openClearDialog(): void {
        this._openStatsDialog(true);
    }

    /** apk dialog 19：最后一波打完，先按 dialog_message 弹一段台词，点「好的」才进结算 8。 */
    private _openEndMessageDialog(): void {
        const sim = this._sim;
        if (!sim) {
            return;
        }
        const message = sim.endMessage;
        if (!message) {
            sim.outcome = 'clear';
            return;
        }
        const dialog = this._openPanel('EndMessageDialog', DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        if (!dialog) {
            return;
        }
        this._dialogPortrait(dialog, -1, message.portrait);
        // apk dialog 19 走 InGameGeneralMessageDialog.setUpDialog(text, portrait)。
        playPortraitVoice(message.portrait);
        // apk case 19 也是 dialog_message.xml 的 ds_scroll_view，文本超出可下滑。
        const box = dialogScrollBox();
        const scroller = this._makeDialogScroller(dialog, box.width, box.height, box.x, box.y);
        const textH = estimateTextHeight(message.text, box.textWidth, 14, 18);
        const bodyNode = this._uiLabel(scroller.content, 'body', message.text, 14, DIALOG_TEXT_COLOR);
        const bodyLabel = bodyNode.getComponent(Label);
        if (bodyLabel) {
            bodyLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            bodyLabel.verticalAlign = Label.VerticalAlign.TOP;
            bodyLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
            bodyLabel.lineHeight = 18;
        }
        const bodyUt = bodyNode.getComponent(UITransform);
        if (bodyUt) {
            bodyUt.setAnchorPoint(0.5, 1);
            bodyUt.setContentSize(box.textWidth, textH);
        }
        bodyNode.setPosition(box.textX, 0, 0);
        const contentUt = scroller.content.getComponent(UITransform);
        if (contentUt) {
            contentUt.setContentSize(box.textWidth, Math.max(box.height, textH));
        }
        this._attachDialogScroll(
            dialog, scroller.view, scroller.content,
            box.width, box.height, box.x, box.y, textH,
        );
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '好的', () => {
            this._closeOutcomeDialog(false);
            sim.acknowledgeEndMessage();
        });
    }

    /**
     * dialog_final_stats.xml：标题 + 每种敌人的小图标 / x N / 金额，底下是身上的钱、
     * 难度折算和「= $总计」，内容超出时右侧有滚动条。
     */
    private _openStatsDialog(clear: boolean): void {
        const sim = this._sim;
        if (!sim) {
            return;
        }
        const W = DIALOG_LARGE_WIDTH;
        const H = DIALOG_LARGE_HEIGHT;
        this._statRows = [];
        this._statCashLabel = null;
        this._statTotalLabel = null;
        const dialog = this._openPanel(clear ? 'ClearDialog' : 'FailDialog', W, H);
        if (!dialog) {
            return;
        }
        // apk GameScreenActivity case 8：通关用 portrait_pedro，失败用 portrait_sheriff。
        this._dialogPortrait(dialog, 0, clear ? 'portrait_pedro' : 'portrait_sheriff');
        playPortraitVoice(clear ? 'portrait_pedro' : 'portrait_sheriff');
        const heading = this._uiLabel(dialog, 'heading', clear ? '漂亮的伏击' : '惨痛的失败！', 16, DIALOG_TEXT_COLOR);
        heading.setPosition(0, H / 2 - 30 - 9, 0);

        const viewTop = H / 2 - 30 - 26;
        const viewBottom = -H / 2 + 32;
        const viewH = viewTop - viewBottom;
        const contentW = W - 2 * DIALOG_CONTENT_MARGIN;
        const rowH = 24;
        const view = new Node('statsView');
        dialog.addChild(view);
        view.layer = Layers.Enum.UI_2D;
        const viewUt = view.addComponent(UITransform);
        viewUt.setAnchorPoint(0.5, 1);
        viewUt.setContentSize(contentW, viewH);
        view.setPosition(0, viewTop, 0);
        const mask = view.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        const content = new Node('statsContent');
        view.addChild(content);
        content.layer = Layers.Enum.UI_2D;
        const contentUt = content.addComponent(UITransform);
        contentUt.setAnchorPoint(0.5, 1);
        contentUt.setContentSize(contentW, 10);
        content.setPosition(0, 0, 0);

        const rows: Node[] = [];
        const tally = sim.tally;
        if (tally) {
            const icons = this._sheets.get(HUD_ICONS_ENEMIES);
            const cellH = icons?.height ?? 24;
            const cellW = icons ? Math.trunc(icons.width / 7) : 24;
            let row = 0;
            for (let g = 0; g < tally.counted.length; g++) {
                if (tally.counted[g] <= 0 && tally.remain[g] <= 0) {
                    continue;
                }
                const y = -row * rowH - rowH / 2;
                const rowNode = new Node(`row_${g}`);
                content.addChild(rowNode);
                rowNode.layer = Layers.Enum.UI_2D;
                const rUt = rowNode.addComponent(UITransform);
                rUt.setAnchorPoint(0.5, 0.5);
                rUt.setContentSize(contentW, rowH);
                rowNode.setPosition(0, y, 0);
                if (icons) {
                    const icon = this._uiSprite(rowNode, 'icon', this._sheetFrame(icons, g, 0, cellW, cellH), cellH, cellH);
                    const iconUt = icon.getComponent(UITransform);
                    if (iconUt) {
                        iconUt.setAnchorPoint(0.5, 0.5);
                    }
                    icon.setPosition(-contentW / 2 + cellH / 2, 0, 0);
                }
                const count = this._uiLabel(rowNode, 'count', `x ${tally.counted[g]}`, 14, DIALOG_TEXT_COLOR);
                count.setPosition(-contentW / 2 + cellH + 24, 0, 0);
                const cash = this._uiLabel(rowNode, 'cash', `${tally.cashDone[g]}`, 14, DIALOG_TEXT_COLOR);
                cash.setPosition(contentW / 2 - 34, 0, 0);
                this._statRows.push({
                    group: g,
                    count: count.getComponent(Label)!,
                    cash: cash.getComponent(Label)!,
                });
                rows.push(rowNode);
                row += 1;
            }
            const cashRow = new Node('cashRow');
            content.addChild(cashRow);
            cashRow.layer = Layers.Enum.UI_2D;
            const cUt = cashRow.addComponent(UITransform);
            cUt.setAnchorPoint(0.5, 0.5);
            cUt.setContentSize(contentW, rowH);
            const cashY = -row * rowH - rowH / 2;
            cashRow.setPosition(0, cashY, 0);
            const line = new Node('divider');
            cashRow.addChild(line);
            line.layer = Layers.Enum.UI_2D;
            const lineUt = line.addComponent(UITransform);
            lineUt.setAnchorPoint(0.5, 0.5);
            lineUt.setContentSize(contentW, 2);
            const lg = line.addComponent(Graphics);
            lg.fillColor = new Color(80, 52, 28, 255);
            lg.rect(-contentW / 2, 0, contentW, 2);
            lg.fill();
            line.setPosition(0, rowH / 2 - 2, 0);
            const cashLabel = this._uiLabel(cashRow, 'cash', `$ ${sim.cash}`, 14, DIALOG_TEXT_COLOR);
            cashLabel.setPosition(contentW / 2 - 34, -2, 0);
            this._statCashLabel = cashLabel.getComponent(Label);
            rows.push(cashRow);

            const totalRow = new Node('totalRow');
            content.addChild(totalRow);
            totalRow.layer = Layers.Enum.UI_2D;
            const tUt = totalRow.addComponent(UITransform);
            tUt.setAnchorPoint(0.5, 0.5);
            tUt.setContentSize(contentW, rowH);
            totalRow.setPosition(0, cashY - rowH, 0);
            const sep = new Node('sep');
            totalRow.addChild(sep);
            sep.layer = Layers.Enum.UI_2D;
            const sepUt = sep.addComponent(UITransform);
            sepUt.setAnchorPoint(0.5, 0.5);
            sepUt.setContentSize(contentW, 2);
            const sg = sep.addComponent(Graphics);
            sg.fillColor = new Color(80, 52, 28, 255);
            sg.rect(-contentW / 2, 0, contentW, 2);
            sg.fill();
            sep.setPosition(0, rowH / 2 + 1, 0);
            const tier = sim.difficultyTier ?? MODE_NORMAL;
            this._statTier = tier;
            const diffName = this._uiLabel(totalRow, 'diff', DIFFICULTY_LABELS[tier] ?? '', 13, DIALOG_TEXT_COLOR);
            diffName.setPosition(-contentW / 2 + 22, 0, 0);
            const total = Math.round((tally.cashTotal + sim.cash) * difficultyPercent(tier) / 100);
            const totalLabel = this._uiLabel(totalRow, 'total', `= $ ${total}`, 14, DIALOG_TEXT_COLOR);
            totalLabel.setPosition(contentW / 2 - 40, 0, 0);
            this._statTotalLabel = totalLabel.getComponent(Label);
            rows.push(totalRow);
            contentUt.setContentSize(contentW, (row + 2) * rowH);
            this._scrollStats(dialog, viewTop, contentW / 2 - 6, view, content, (row + 2) * rowH, viewH);
        }

        // apk GameScreenActivity case 8：高分显示 T_NEW_HIGHSCORE，失败再显示 T_STATS_TRY_AGAIN。
        if (sim.promptName) {
            const hi = this._uiLabel(dialog, 'highscore', this._officialString('@string/T_NEW_HIGHSCORE') || '你是这里的头号通缉犯', 12, DIALOG_TEXT_COLOR);
            hi.setPosition(0, clear ? viewBottom - 2 : viewBottom + 14, 0);
        }
        if (!clear) {
            const again = this._uiLabel(dialog, 'again', '你确定要重新开始本关么？', 12, DIALOG_TEXT_COLOR);
            again.setPosition(0, viewBottom - 2, 0);
        }

        this._uiYesNo(dialog, W, H, 'yes', clear ? '继续' : '重试', () => {
            if (clear) {
                this._onClearConfirm();
            } else {
                this._onFailConfirm();
            }
        });
        if (!clear) {
            // apk dialog_final_stats.xml：右下 dialog_cancel = but_no_xml（gng_hud_2_no 的 X 图），
            // 和左边重试按钮一样只画图标；点叉回关卡地图。
            this._uiYesNo(dialog, W, H, 'no', '取消', () => {
                this._closeOutcomeDialog(false);
                this.onLeaveBattle?.();
            });
        }
    }

    /** 结算内容比可视区高时，用拖动滚动，并在右侧画滚动条。 */
    private _scrollStats(dialog: Node, topY: number, barX: number, view: Node, content: Node, contentH: number, viewH: number): void {
        const maxScroll = Math.max(0, contentH - viewH);
        const track = new Node('scrollTrack');
        dialog.addChild(track);
        track.layer = Layers.Enum.UI_2D;
        const trackUt = track.addComponent(UITransform);
        trackUt.setAnchorPoint(0.5, 1);
        trackUt.setContentSize(6, viewH);
        track.setPosition(barX, topY, 0);
        const tg = track.addComponent(Graphics);
        tg.fillColor = new Color(0, 0, 0, 25);
        tg.roundRect(-3, -viewH, 6, viewH, 3);
        tg.fill();
        const thumbH = Math.max(16, viewH * Math.min(1, viewH / Math.max(1, contentH)));
        const thumb = new Node('scrollThumb');
        dialog.addChild(thumb);
        thumb.layer = Layers.Enum.UI_2D;
        const thumbUt = thumb.addComponent(UITransform);
        thumbUt.setAnchorPoint(0.5, 1);
        thumbUt.setContentSize(6, thumbH);
        thumb.setPosition(barX, topY, 0);
        const thg = thumb.addComponent(Graphics);
        thg.fillColor = new Color(170, 130, 89, 255);
        thg.roundRect(-3, -thumbH, 6, thumbH, 3);
        thg.fill();
        if (maxScroll <= 0) {
            return;
        }
        let dragging = false;
        let lastY = 0;
        let offset = 0;
        view.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
            dragging = true;
            lastY = ev.getUILocation().y;
        }, this);
        view.on(Node.EventType.TOUCH_MOVE, (ev: EventTouch) => {
            if (!dragging) {
                return;
            }
            const y = ev.getUILocation().y;
            offset = Math.min(maxScroll, Math.max(0, offset + (y - lastY)));
            lastY = y;
            content.setPosition(0, offset, 0);
            thumb.setPosition(barX, topY - offset * (viewH - thumbH) / Math.max(1, maxScroll), 0);
        }, this);
        const stop = (): void => {
            dragging = false;
        };
        view.on(Node.EventType.TOUCH_END, stop, this);
        view.on(Node.EventType.TOUCH_CANCEL, stop, this);
    }

    private _onFailConfirm(): void {
        const sim = this._sim;
        if (!sim) {
            this._closeOutcomeDialog(true);
            return;
        }
        if (sim.promptName) {
            sim.outcome = 'name';
            this._closeOutcomeDialog(false);
            this._openNameDialog();
            return;
        }
        this._closeOutcomeDialog(false);
        this._restartCurrentLevel();
    }

    private _onClearConfirm(): void {
        const sim = this._sim;
        if (!sim) {
            this._closeOutcomeDialog(true);
            return;
        }
        if (sim.promptName) {
            sim.outcome = 'name';
            this._closeOutcomeDialog(false);
            this._openNameDialog();
            return;
        }
        this._afterClear();
    }

    /** 过关后按 APK：先解锁对话框，再直接进下一关的难度选择。 */
    private _afterClear(): void {
        const sim = this._sim;
        if (!sim) {
            this._closeOutcomeDialog(true);
            return;
        }
        if (sim.pendingUnlocks.length > 0) {
            sim.outcome = 'unlock';
            this._closeOutcomeDialog(false);
            this._openUnlockDialog();
            return;
        }
        this._advanceAfterClear();
    }

    private _advanceAfterClear(): void {
        const level = this._playLevel;
        const local = ((level - 1) % 10) + 1;
        this._closeOutcomeDialog(true);
        if (this._sim) {
            this._sim.outcome = 'none';
        }
        if (local >= 10) {
            // 这个地区的 10 关打完了，回选关。
            this.onLeaveBattle?.();
            return;
        }
        const next = level + 1;
        this.hideBattle();
        void this.showLevel(next);
    }

    private _openNameDialog(): void {
        const sim = this._sim;
        if (!sim || !sim.promptName) {
            this._closeOutcomeDialog(true);
            return;
        }
        const W = DIALOG_LARGE_WIDTH;
        const H = DIALOG_LARGE_HEIGHT;
        const dialog = this._openPanel('HighScoreDialog', W, H);
        if (!dialog) {
            return;
        }
        // dialog_new_highscore.xml：标题在上、输入框在下，两者都宽 330、水平居中；
        // 标题 gravity=0x11（居中），输入框 marginTop=10 紧随其后，两个小按钮贴底。
        const titleH = 24;
        const titleY = H / 2 - HIGHSCORE_PADDING_TOP - titleH / 2;
        const title = this._uiLabel(dialog, 'title', '你准备用什么名字来扬名立万？', 14, DIALOG_TEXT_COLOR);
        const titleUt = title.getComponent(UITransform);
        if (titleUt) {
            titleUt.setContentSize(HIGHSCORE_NAME_WIDTH, titleH);
        }
        title.setPosition(0, titleY, 0);

        // 输入框中心：标题下沿再退 marginTop=10。
        const boxY = titleY - titleH / 2 - HIGHSCORE_EDIT_MARGIN_TOP - HIGHSCORE_EDIT_HEIGHT / 2;
        // 先画一层可见底框（原生 EditBox 在部分小游戏内核里不画 background），再叠输入层。
        const frameNode = new Node('nameBoxFrame');
        dialog.addChild(frameNode);
        frameNode.layer = Layers.Enum.UI_2D;
        const frameUt = frameNode.addComponent(UITransform);
        frameUt.setContentSize(HIGHSCORE_NAME_WIDTH, HIGHSCORE_EDIT_HEIGHT);
        frameUt.setAnchorPoint(0.5, 0.5);
        frameNode.setPosition(0, boxY, 0);
        const frameSprite = frameNode.addComponent(Sprite);
        frameSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        frameSprite.spriteFrame = this._uiNamedFrame(UI_TEXTBOX_SMALL);
        frameSprite.color = Color.WHITE;

        const boxNode = new Node('nameBox');
        dialog.addChild(boxNode);
        boxNode.layer = Layers.Enum.UI_2D;
        const boxUt = boxNode.addComponent(UITransform);
        boxUt.setContentSize(HIGHSCORE_NAME_WIDTH, HIGHSCORE_EDIT_HEIGHT);
        boxUt.setAnchorPoint(0.5, 0.5);
        boxNode.setPosition(0, boxY, 0);
        const box = boxNode.addComponent(EditBox);
        // GameScreenActivity L619：显示时预填上一次输入过的名字。
        box.string = sim.highscoreDefaultName;
        box.placeholder = '';
        box.maxLength = 15;
        // 原版 EditText 用弹窗同款文字样式：14 号、深色、居中；没有专门输入框背景，
        // 但 Cocos EditBox 必须给可见 background 才画得出框体，用项目自带的小文本框贴图和同色兜底。
        box.fontSize = 14;
        box.fontColor = DIALOG_TEXT_COLOR;
        this._nameBox = box;
        this._uiYesNo(dialog, W, H, 'yes', '确定', () => this._submitHighScoreName());
        this._uiYesNo(dialog, W, H, 'no', '取消', () => {
            // CustomDialog L154-163：原版取消根本点不掉——重新聚焦输入框并弹键盘，只能命名。
            this._nameBox?.focus();
        }, {
            // apk dialog_new_highscore.xml：右按钮 src=but_rename_xml（本项目原名 gng_hud_2_rename）。
            normal: this._uiNamedFrame(UI_RENAME),
            pressed: this._uiNamedFrame(UI_RENAME_PRESSED),
        });
    }

    private _submitHighScoreName(): void {
        const sim = this._sim;
        if (!sim) {
            this._closeOutcomeDialog(true);
            return;
        }
        // 原版没有兜底名：留空就按空串写进这一关的名字，只影响显示。
        const name = this._nameBox?.string?.trim() ?? '';
        sim.submitHighScoreName(name);
        if (sim.failed) {
            this._closeOutcomeDialog(false);
            this._restartCurrentLevel();
            return;
        }
        this._afterClear();
    }

    private _openUnlockDialog(): void {
        const sim = this._sim;
        if (!sim) {
            return;
        }
        const names = sim.pendingUnlocks.map((row) => row.name || `#${row.type}`).join('、');
        const dialog = this._openPanel('UnlockDialog', DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        if (!dialog) {
            return;
        }
        const title = this._uiLabel(dialog, 'title', '解锁', 26);
        title.setPosition(0, 40, 0);
        const body = this._uiLabel(dialog, 'body', names ? `解锁了：${names}` : '没有新解锁', 20);
        body.setPosition(0, 8, 0);
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '好的', () => {
            if (this._sim) {
                this._sim.pendingUnlocks = [];
                this._sim.outcome = 'none';
            }
            this._closeOutcomeDialog(true);
            this._advanceAfterClear();
        });
    }

    private _restartCurrentLevel(): void {
        const tables = this._tables;
        const maps = this._maps;
        const objects = this._mapObjects;
        const units = this._mapUnits;
        if (!tables || !maps || !objects) {
            this._sim?.restartLevel();
            this._openDifficultyDialog();
            return;
        }
        this._closeOutcomeDialog(false);
        this._shownWaveTexts.clear();
        this._clearViewBindings();
        this._buildSim(this._playLevel, maps, objects, units, tables);
        this._openDifficultyDialog();
    }

    private _clearViewBindings(): void {
        for (const bind of this._bindings) {
            if (bind.root?.isValid) {
                bind.root.destroy();
            }
        }
        this._bindings = [];
        for (const bind of this._enemyBindings) {
            if (bind.root?.isValid) {
                bind.root.destroy();
            }
        }
        this._enemyBindings = [];
        for (const node of this._shotSprites.values()) {
            if (node.isValid) {
                node.destroy();
            }
        }
        this._shotSprites.clear();
        for (const node of this._fxSprites.values()) {
            if (node.isValid) {
                node.destroy();
            }
        }
        this._fxSprites.clear();
        for (const node of this._chestSprites.values()) {
            if (node.isValid) {
                node.destroy();
            }
        }
        this._chestSprites.clear();
        const chestLayer = this._chestLayer;
        if (chestLayer && chestLayer.isValid) {
            chestLayer.destroy();
        }
        this._chestLayer = null;
        this._sleepHats = [];
        this._cooldownLabels.clear();
        this._spawnArrows = [];
    }

    private _syncCooldownLabels(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._worldCanvas;
        if (!sim || !maps || !parent) {
            return;
        }
        const wanted = new Set<number>();
        for (const unit of sim.units) {
            if (!unit.alive) {
                continue;
            }
            if (unit.type !== DYNAMITE_TRIGGER_TYPE && unit.type !== GAMBLER_TYPE) {
                continue;
            }
            const text = formatCooldownLabel(unit.currentWeaponCooldown);
            if (!text) {
                continue;
            }
            wanted.add(unit.id);
            let label = this._cooldownLabels.get(unit.id);
            if (!label || !label.isValid) {
                const node = new Node(`cd_${unit.id}`);
                parent.addChild(node);
                node.layer = Layers.Enum.DEFAULT;
                const ut = node.addComponent(UITransform);
                ut.setContentSize(80, 28);
                ut.setAnchorPoint(0.5, 0);
                const lb = node.addComponent(Label);
                lb.fontSize = 16;
                lb.lineHeight = 20;
                lb.useSystemFont = true;
                lb.fontFamily = 'Arial';
                lb.horizontalAlign = Label.HorizontalAlign.CENTER;
                lb.color = new Color(255, 255, 210, 255);
                this._cooldownLabels.set(unit.id, lb);
                label = lb;
            }
            label.string = text;
            const world = fineToWorld(unit.fineX, unit.fineY, maps.rows);
            label.node.setPosition(world.x, world.y + 36, 0);
            label.node.active = true;
        }
        for (const [id, label] of this._cooldownLabels) {
            if (!wanted.has(id)) {
                if (label.isValid) {
                    label.node.destroy();
                }
                this._cooldownLabels.delete(id);
            }
        }
    }

    private _syncWaveHud(): void {
        const waves = this._sim?.waves;
        const current = waves?.waveNumber ?? 0;
        const max = waves?.waveCount ?? 0;
        this._paintHudNumber(this._currentWaveSlot, this._twoDigit(current));
        this._paintHudNumber(this._maxWaveSlot, this._twoDigit(max));
        const count = waves?.countdown() ?? 0;
        const root = this._countdownRoot;
        if (root && root.isValid) {
            if (count > 0) {
                if (!this._countdownShown) {
                    this._countdownShown = true;
                    this._playCountdownRotate(true);
                }
                const text = this._twoDigit(count);
                if (this._countdownText !== text) {
                    this._countdownText = text;
                    this._paintHudNumber(this._countdownDigits, text);
                }
            } else if (this._countdownShown) {
                this._countdownShown = false;
                // apk 退出时 setNumber(formatStringForImageTextView(0,true)) → 双零，动画结束才隐藏。
                this._countdownText = '00';
                this._paintHudNumber(this._countdownDigits, '00');
                this._playCountdownRotate(false);
            }
        }
        if (this._countdownLabel && this._countdownLabel.isValid) {
            this._countdownLabel.string = '';
        }
    }

    private _syncArrow(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._decorLayer ?? this._worldCanvas;
        if (!sim || !maps || !parent) {
            return;
        }
        const arrow = sim.arrowFromTo(maps.rows);
        if (!arrow) {
            if (this._arrow) {
                this._arrow.active = false;
            }
            return;
        }
        if (!this._arrow || !this._arrow.isValid) {
            this._arrow = this._makeArrow(parent);
        }
        if (!this._arrow) {
            return;
        }
        parent.addChild(this._arrow);
        this._arrow.active = true;
        const from = fineToWorld(arrow.fromX, arrow.fromY, maps.rows);
        // apk MoveArrow.setStart 取角色碰撞盒中心：person 盒比脚底高 3072 fine（0.4 格）。
        from.y += TILE * 0.4;
        const to = fineToWorld(arrow.toX, arrow.toY, maps.rows);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len <= 0.0001) {
            this._arrow.active = false;
            return;
        }
        // apk MoveArrow.draw：preRotate(θ-180, (1.5w, 0.5h)) + postTranslate(-12w/13, 0)，
        // 得到位图中心 = 碰撞盒中心 + w·方向 + w/13·x̂（y 向下坐标，翻到 Cocos 后 y 取负）。
        const sheet = this._sheets.get('gng_move_arrow');
        const w = sheet ? sheet.width : 31;
        this._arrow.setPosition(
            from.x + dx / len * w + w / 13,
            from.y + dy / len * w,
            0,
        );
        this._arrow.angle = Math.atan2(dy, dx) * 180 / Math.PI + 180;
    }

    private _makeArrow(parent: Node): Node {
        const sheet = this._sheets.get('gng_move_arrow');
        const node = new Node('MoveArrow');
        parent.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        if (sheet) {
            const sf = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
            const sprite = this._sprite(node, 'img', sf, sheet.width, sheet.height);
            const ut = sprite.getComponent(UITransform);
            if (ut) {
                // 节点位置按位图中心计算（apk 矩阵把图整体旋转平移）。
                ut.setAnchorPoint(0.5, 0.5);
            }
            sprite.setPosition(0, 0, 0);
        } else {
            const g = node.addComponent(Graphics);
            g.strokeColor.fromHEX('#f4d35e');
            g.lineWidth = 3;
            g.moveTo(0, 0);
            g.lineTo(-28, 0);
            g.moveTo(-20, 6);
            g.lineTo(-28, 0);
            g.lineTo(-20, -6);
            g.stroke();
        }
        return node;
    }

    /**
     * apk GunsAndGloryThread L893-993：waveSpawnActive 的出生口画来回伸缩的红箭头，
     * mWaveArrowAnimator 按 direction * ((dt/50)%10) 在 1..9 往返；
     * waveSpawnPool[actionID][10] > 0 时再叠一张 boss_hat。
     */
    private _syncSpawnArrows(dtMs: number): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._decorLayer ?? this._worldCanvas;
        if (!sim || !maps || !parent || !sim.waves || !sim.enemies) {
            return;
        }
        const wave = sim.waves.current;
        // apk mWaveArrowVisible：关闭时整组出生箭头都不画（本波第一次开火后关闭，下一波重新打开）。
        if (!sim.waves.waveArrowVisible) {
            for (const entry of this._spawnArrows) {
                if (!entry) {
                    continue;
                }
                entry.arrow.active = false;
                if (entry.hat) {
                    entry.hat.active = false;
                }
            }
            return;
        }
        let ms = dtMs;
        if (ms < 0) {
            ms = 0;
        } else if (ms > 100) {
            ms = 100;
        }
        if (!GameTime.paused && !GameTime.dialogOpen && GameTime.dtMs > 0) {
            this._waveArrowAnim += this._waveArrowDir * ((ms / 50) % 10);
        }
        if (this._waveArrowAnim >= 10 && this._waveArrowDir > 0) {
            this._waveArrowDir = -this._waveArrowDir;
            this._waveArrowAnim = 9;
        } else if (this._waveArrowAnim <= 0 && this._waveArrowDir < 0) {
            this._waveArrowAnim = 1;
            this._waveArrowDir = -this._waveArrowDir;
        }
        const points = sim.enemies.spawnPoints;
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const slot = wave?.slots[point.slot];
            const entry = this._spawnArrows[i];
            if (!slot?.active) {
                if (entry) {
                    entry.arrow.active = false;
                    if (entry.hat) {
                        entry.hat.active = false;
                    }
                }
                continue;
            }
            const dirX = point.dirX;
            const dirY = point.dirY;
            if (dirX === 0 && dirY === 0) {
                continue;
            }
            const file = dirX > 0 ? 'gng_wave_arrow_d'
                : dirX < 0 ? 'gng_wave_arrow_b'
                    : dirY > 0 ? 'gng_wave_arrow_a' : 'gng_wave_arrow_c';
            let arrow = entry;
            if (!arrow || !arrow.arrow.isValid) {
                const node = this._makeSpawnSprite(parent, `spawn_arrow_${i}`, file);
                if (!node) {
                    continue;
                }
                arrow = { arrow: node, hat: null, file };
                this._spawnArrows[i] = arrow;
            } else if (arrow.file !== file) {
                const sheet = this._sheets.get(file);
                const sprite = arrow.arrow.getComponent(Sprite);
                if (sheet && sprite) {
                    sprite.spriteFrame = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
                    arrow.file = file;
                }
            }
            const world = fineToWorld(tileCenterX(point.col), tileCenterY(point.row), maps.rows);
            let horizontalOffset = 0;
            let verticalOffset = 0;
            let hatOffsetX = 0;
            let hatOffsetY = 0;
            if (dirX !== 0) {
                horizontalOffset = (TILE * this._waveArrowAnim) / 15 - TILE / 2;
                verticalOffset = -TILE / 2;
                if (dirX > 0) {
                    hatOffsetX = TILE;
                } else {
                    hatOffsetX = -TILE;
                    horizontalOffset -= TILE / 2;
                }
            } else {
                verticalOffset = (TILE * this._waveArrowAnim) / 15 - TILE / 2;
                horizontalOffset = -TILE / 2;
                if (dirY > 0) {
                    hatOffsetY = TILE;
                } else {
                    hatOffsetY = -TILE;
                    verticalOffset -= TILE / 2;
                }
            }
            arrow.arrow.active = true;
            arrow.arrow.setPosition(world.x + horizontalOffset, world.y - verticalOffset, 0);
            if ((slot.values[10] ?? 0) > 0) {
                if (!arrow.hat || !arrow.hat.isValid) {
                    arrow.hat = this._makeSpawnSprite(parent, `spawn_hat_${i}`, 'boss_hat');
                }
                if (arrow.hat) {
                    arrow.hat.active = true;
                    arrow.hat.setPosition(
                        world.x + horizontalOffset + hatOffsetX,
                        world.y - verticalOffset - hatOffsetY,
                        0,
                    );
                }
            } else if (arrow.hat) {
                arrow.hat.active = false;
            }
        }
    }

    /** apk 用 drawBitmap 的左上角定位箭头图，所以锚点在左上。 */
    private _makeSpawnSprite(parent: Node, name: string, file: string): Node | null {
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return null;
        }
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 1);
        ut.setContentSize(TILE, TILE);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
        return node;
    }

    private _ensureRangeCircle(): Node | null {
        const parent = this._decorLayer ?? this._worldCanvas;
        if (!parent) {
            return null;
        }
        if (this._rangeCircle && this._rangeCircle.isValid) {
            if (this._rangeCircle.parent !== parent) {
                parent.addChild(this._rangeCircle);
                this._rangeCircle.setSiblingIndex(0);
            }
            return this._rangeCircle;
        }
        const node = new Node('RangeCircle');
        parent.addChild(node);
        node.setSiblingIndex(0);
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        ut.setContentSize(0, 0);
        node.addComponent(Graphics);
        this._rangeCircle = node;
        return node;
    }

    private _syncRangeCircle(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._decorLayer ?? this._worldCanvas;
        if (!sim || !maps || !parent) {
            if (this._rangeCircle && this._rangeCircle.isValid) {
                this._rangeCircle.active = false;
            }
            return;
        }
        const unit = sim.unitById(sim.selectedId);
        if (!unit || !unit.alive || unit.isEnemy || unit.maxSquareRange <= 0) {
            if (this._rangeCircle && this._rangeCircle.isValid) {
                this._rangeCircle.active = false;
            }
            return;
        }
        const node = this._ensureRangeCircle();
        if (!node) {
            return;
        }
        node.active = true;
        const world = fineToWorld(unit.fineX, unit.fineY, maps.rows);
        node.setPosition(world.x, world.y, 0);
        const radius = sim.rangeCircleRadiusPx(unit);
        const g = node.getComponent(Graphics);
        if (!g) {
            return;
        }
        g.clear();
        g.fillColor = new Color(255, 255, 255, 40);
        g.circle(0, 0, radius);
        g.fill();
    }

    private async _loadFxTextures(): Promise<void> {
        const base = await loadBundle('base');
        const files = [...FX_TEXTURES, ...CHEST_TEXTURES];
        for (const file of files) {
            if (!(await this._loadNamedSheet(base, file))) {
                console.warn('[Shot] 读图失败', file, assetPathCandidates(file).join(' | '));
            }
        }
    }

    private _syncChests(): void {
        const sim = this._sim;
        const maps = this._maps;
        const fxParent = this._fxParent();
        if (!sim || !maps || !fxParent) {
            return;
        }
        // 补给箱单独一层：箱体和它的浮动图标要按原版顺序紧邻排列，层内 sibling 才是可控的。
        // 原先箱体/图标写死 1800 与 1810，超出父节点子树数量后被 setSiblingIndex 夹到末尾，
        // 真实顺序退化成 sim.chests 的生成顺序，于是后生成的上方箱子会盖住下方箱子的图标。
        let layer = this._chestLayer;
        if (!layer || !layer.isValid) {
            layer = this._layer(fxParent, 'ChestLayer', maps);
            this._chestLayer = layer;
        }
        const live = new Set<string>();
        const now = sim.nowMs;
        // apk GameObjectManager.getValueByObject 423：value = fineY + drawingOffsetY + fineZ * 100；
        // drawObjects 1284 按该值升序绘制。补给箱 fineZ 恒为 7680、drawingOffsetY 为 0，
        // 故箱子之间只比 fineY；同一箱子先画箱体再画浮标（GameObjectCollectable.draw 151 与 201）。
        const visible = sim.chests.filter((chest) => !(chest as ChestEntity).chestRemove);
        visible.sort((a, b) => a.fineY - b.fineY);
        let sibling = 0;
        for (const chest of visible) {
            const state = chest as ChestEntity;
            const vis = chestVisual(state);
            const world = fineToWorld(chest.fineX, chest.fineY, maps.rows);
            const boxKey = `chest_${chest.id}`;
            live.add(boxKey);
            this._placeStripSprite(layer, this._chestSprites, boxKey, vis.file, vis.frame, vis.frames, world.x, world.y, sibling++);
            const iconKey = `chest_icon_${chest.id}`;
            if (vis.showIcon) {
                const icon = iconForChestType(chest.type);
                const wobble = chestIconWobblePx(state.animTime ?? 0);
                const frame = chestIconFrame(now, icon.frames);
                live.add(iconKey);
                this._placeChestIcon(layer, iconKey, icon.file, frame, icon.frames, world.x, world.y + wobble, sibling++);
            }
        }
        for (const [key, node] of this._chestSprites) {
            if (!live.has(key)) {
                node.active = false;
            }
        }
    }

    private _placeChestIcon(parent: Node, key: string, file: string, frame: number, frames: number, x: number, y: number, sibling: number): void {
        this._placeStripSprite(parent, this._chestSprites, key, file, frame, frames, x, y, sibling);
        const node = this._chestSprites.get(key);
        if (!node || !node.isValid) {
            return;
        }
        const ut = node.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(CHEST_ICON_PX, CHEST_ICON_PX);
            ut.setAnchorPoint(0.5, 0);
        }
    }

    private _syncSpeechBubble(): void {
        const sim = this._sim;
        const canvas = this._hudRoot ?? this.node.scene?.getChildByName('Canvas');
        if (!sim || !canvas) {
            return;
        }
        const bubble = sim.bubbles[0];
        if (!bubble || bubble.ended) {
            if (this._bubbleRoot && this._bubbleRoot.isValid) {
                this._bubbleRoot.active = false;
            }
            return;
        }
        let root = this._bubbleRoot;
        if (!root || !root.isValid) {
            root = new Node('SpeechBubble');
            root.layer = canvas.layer;
            const ut = root.addComponent(UITransform);
            ut.setAnchorPoint(0.5, 0.5);
            canvas.addChild(root);
            const img = new Node('image');
            img.layer = canvas.layer;
            img.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
            img.addComponent(Sprite);
            root.addChild(img);
            const labelNode = new Node('text');
            labelNode.layer = canvas.layer;
            const lut = labelNode.addComponent(UITransform);
            lut.setAnchorPoint(0.5, 0.5);
            const label = labelNode.addComponent(Label);
            label.useSystemFont = true;
            label.fontFamily = 'serif';
            label.fontSize = 22;
            label.lineHeight = 28;
            label.color = Color.WHITE;
            label.enableShadow = true;
            label.shadowColor = Color.BLACK;
            label.shadowOffset = new Vec2(1, -1);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.SHRINK;
            root.addChild(labelNode);
            this._bubbleRoot = root;
        }
        if (root.parent !== canvas) {
            canvas.addChild(root);
        }
        root.active = true;
        const sheet = this._sheets.get(SPEECH_BUBBLE_IMAGE);
        const img = root.getChildByName('image');
        const textNode = root.getChildByName('text');
        let width = 180;
        let height = 80;
        if (sheet && img) {
            const sf = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
            width = sheet.width;
            height = sheet.height;
            const sprite = img.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = sf;
            }
            const ut = img.getComponent(UITransform) ?? img.addComponent(UITransform);
            ut.setContentSize(width, height);
        }
        root.getComponent(UITransform)?.setContentSize(width, height);
        if (textNode) {
            const label = textNode.getComponent(Label);
            if (label) {
                // apk 用 getResources().getString(message)；这里把 @string/KEY 换成当前语言文案。
                const text = bubble.text.startsWith('@string/')
                    ? (this._officialString(bubble.text) || bubble.text)
                    : bubble.text;
                label.string = text;
                label.color = new Color(255, 255, 255, 255);
            }
            textNode.getComponent(UITransform)?.setContentSize(width - 16, height - 16);
        }
        const scale = bubbleScale(bubble.elapsedMs, bubble.durationMs);
        const alpha = bubbleAlpha(bubble.elapsedMs, bubble.durationMs);
        root.setScale(scale, scale, 1);
        const byte = Math.max(0, Math.min(255, Math.round(alpha * 255)));
        if (img) {
            const sprite = img.getComponent(Sprite);
            if (sprite) {
                sprite.color = new Color(255, 255, 255, byte);
            }
        }
        if (textNode) {
            const label = textNode.getComponent(Label);
            if (label) {
                label.color = new Color(255, 255, 255, byte);
            }
        }
        const size = canvas.getComponent(UITransform)?.contentSize;
        root.setPosition(0, 0, 0);
        if (size) {
            // 放在 HUD 画布中心。Canvas 若锚在左下则改用宽高一半。
            const cut = canvas.getComponent(UITransform);
            const ax = cut?.anchorPoint.x ?? 0.5;
            const ay = cut?.anchorPoint.y ?? 0.5;
            root.setPosition((0.5 - ax) * (size.width ?? 0), (0.5 - ay) * (size.height ?? 0), 0);
        }
        root.setSiblingIndex(canvas.children.length - 1);
    }

    private _fxParent(): Node | null {
        return this._decorLayer ?? this._worldCanvas;
    }

    private _ensureShotGraphics(): Graphics | null {
        const parent = this._fxParent();
        if (!parent) {
            return null;
        }
        if (this._shotGfx && this._shotGfx.isValid) {
            return this._shotGfx;
        }
        const node = new Node('ShotGraphics');
        parent.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        node.addComponent(UITransform).setAnchorPoint(0, 0);
        node.setPosition(0, 0, 0);
        const g = node.addComponent(Graphics);
        this._shotGfx = g;
        return g;
    }

    private _syncShots(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._fxParent();
        const g = this._ensureShotGraphics();
        if (!sim || !maps || !parent || !g) {
            return;
        }
        const combat = sim.combat;
        g.clear();
        const live = new Set<number>();
        const now = GameTime.elapsedMs;
        if (combat) {
            combat.shots.forEach((shot, index) => {
                const id = shot.viewId ?? (index + 1);
                const lift = shot.drawingLift ?? 0;
                const world = fineToWorld(shot.fineX, shot.fineY - lift, maps.rows);
                const style = shot.damageStyle;
                if (style === 0 && !shot.resolve) {
                    const s = 2;
                    g.fillColor = new Color(BULLET_COLOR.r, BULLET_COLOR.g, BULLET_COLOR.b, BULLET_COLOR.a);
                    g.rect(world.x - s / 2, world.y - s / 2, s, s);
                    g.fill();
                    this._hideShotSprite(id);
                    return;
                }
                if ((style === 1 || style === 2) && !shot.resolve) {
                    const prev = fineToWorld(shot.oldX ?? shot.fineX, (shot.oldY ?? shot.fineY) - lift, maps.rows);
                    g.strokeColor = new Color(FIRE_LINE_COLOR.r, FIRE_LINE_COLOR.g, FIRE_LINE_COLOR.b, FIRE_LINE_COLOR.a);
                    g.lineWidth = 2;
                    g.moveTo(prev.x, prev.y);
                    g.lineTo(world.x, world.y);
                    g.stroke();
                    if (style === 2) {
                        live.add(id);
                        this._placeStripSprite(parent, this._shotSprites, id, SFX_FIRE, flightFrame(2, now), 5, world.x, world.y, 2000 + id);
                    } else {
                        this._hideShotSprite(id);
                    }
                    return;
                }
                const vis = shotStyleVisual(style);
                const resolving = !!shot.resolve || shot.currentStepsToTarget <= 0;
                let file = vis.flightImage;
                let frames = vis.flightFrames;
                let frame = 0;
                if (resolving && vis.landingImage) {
                    file = vis.landingImage;
                    frames = vis.landingFrames;
                    frame = landingFrame(style, shot.currentStepsToResolve);
                } else if (file) {
                    const dir = style === 6 ? rocketDirection(shot.fineX, shot.fineY, shot.endX ?? shot.fineX, shot.endY ?? shot.fineY) : 0;
                    frame = flightFrame(style, now, dir);
                }
                if (!file) {
                    this._hideShotSprite(id);
                    return;
                }
                live.add(id);
                this._placeStripSprite(parent, this._shotSprites, id, file, frame, Math.max(1, frames), world.x, world.y, 2000 + id);
            });
        }
        for (const [id, node] of this._shotSprites) {
            if (!live.has(id)) {
                node.active = false;
            }
        }
    }

    private _syncFx(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._fxParent();
        const combat = sim?.combat;
        if (!sim || !maps || !parent || !combat) {
            return;
        }
        const live = new Set<string>();
        for (const fx of combat.sparkles) {
            const key = `sparkle_${fx.id}`;
            const world = fineToWorld(fx.fineX, fx.fineY, maps.rows);
            const frame = rocketSparkleFrame(fx.anim, fx.animMax);
            if (frame < 0) {
                continue;
            }
            live.add(key);
            this._placeStripSprite(parent, this._fxSprites, key, SFX_ROCKET_SPARKLES, frame, 3, world.x, world.y, 2100);
        }
        for (const fx of combat.muzzleSmokes) {
            const key = `smoke_${fx.id}`;
            const world = fineToWorld(fx.fineX, fx.fineY, maps.rows);
            const frame = muzzleSmokeFrame(fx.anim);
            live.add(key);
            this._placeStripSprite(parent, this._fxSprites, key, SFX_CANNON_SMOKE, frame, 5, world.x, world.y, 2100);
        }
        for (const fx of combat.spriteFx) {
            if (fx.visible === false) {
                continue;
            }
            const key = `ring_${fx.id}`;
            const world = fineToWorld(fx.fineX, fx.fineY, maps.rows);
            if (fx.kind === 'blast') {
                const frame = explosionFrame(fx.anim, fx.animMax);
                if (frame < 0) {
                    continue;
                }
                live.add(key);
                this._placeStripSprite(parent, this._fxSprites, key, SFX_EXPLOSION, frame, 8, world.x, world.y, 2100);
            } else {
                const frame = poisonCloudFrame(fx.anim, fx.animMax);
                if (frame < 0) {
                    continue;
                }
                live.add(key);
                this._placeStripSprite(parent, this._fxSprites, key, SFX_POISON, frame, 6, world.x, world.y, 2100);
            }
        }
        for (const group of combat.wagonPartGroups) {
            group.parts.forEach((part, i) => {
                const key = `part_${group.id}_${i}`;
                const world = fineToWorld(part.xpos, part.ypos - part.zpos, maps.rows);
                live.add(key);
                this._placeStripSprite(parent, this._fxSprites, key, SFX_EXPLODING_PARTS, part.part, 6, world.x, world.y, 2200);
            });
        }
        for (const cloud of sim.steamClouds()) {
            const key = `steam_${cloud.id}`;
            const world = fineToWorld(cloud.x, cloud.y, maps.rows);
            live.add(key);
            this._placeStripSprite(parent, this._fxSprites, key, SFX_LOK_STEAM, cloud.animFrm, STEAM_FRAMES, world.x, world.y, 2050);
        }
        for (const [key, node] of this._fxSprites) {
            if (!live.has(key)) {
                node.active = false;
            }
        }
    }

    private _hideShotSprite(id: number): void {
        const node = this._shotSprites.get(id);
        if (node) {
            node.active = false;
        }
    }

    private _placeStripSprite(
        parent: Node,
        store: Map<number | string, Node>,
        key: number | string,
        file: string,
        frame: number,
        frames: number,
        x: number,
        y: number,
        sibling: number,
    ): void {
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return;
        }
        const fw = Math.max(1, Math.trunc(sheet.width / Math.max(1, frames)));
        const fh = sheet.height;
        const fr = Math.max(0, Math.min(frames - 1, frame));
        const sf = this._sheetFrame(sheet, fr, 0, fw, fh);
        let node = store.get(key) ?? null;
        if (!node || !node.isValid) {
            node = this._sprite(parent, `fx_${key}`, sf, fw, fh);
            const ut = node.getComponent(UITransform);
            if (ut) {
                ut.setAnchorPoint(0.5, 0);
            }
            store.set(key, node);
        }
        if (node.parent !== parent) {
            parent.addChild(node);
        }
        node.active = true;
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = sf;
        }
        const ut = node.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(fw, fh);
        }
        node.setPosition(x, y, 0);
        node.setSiblingIndex(sibling);
    }

    private _showPioneerDeath(bind: UnitBinding, counter: number): void {
        const sheet = this._sheets.get(SFX_DEATH_PIONEERS);
        if (!sheet) {
            return;
        }
        const frames = 6;
        const fw = Math.max(1, Math.trunc(sheet.width / frames));
        const fh = sheet.height;
        const frame = Math.max(0, Math.min(frames - 1, pioneerDeathFrame(counter)));
        const sf = this._sheetFrame(sheet, frame, 0, fw, fh);
        bind.bodySprite.spriteFrame = sf;
        const ut = bind.body.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(fw, fh);
            ut.setAnchorPoint(0.5, 0);
        }
        bind.body.setScale(1, 1, 1);
    }

    private _syncEnemyOverlays(bind: UnitBinding, enemy: { type: number; alive: boolean; damageOverTime: number; slowDownTimeCounter: number; showHealFx?: boolean; healTimeCounter?: number; deathAnimationStyle: number; deathAnimationCounter: number }, nowMs: number): void {
        const maps = this._maps;
        if (!maps) {
            return;
        }
        if (enemy.alive && enemy.damageOverTime > 0) {
            const frame = fireOverlayFrame(nowMs);
            bind.fire = this._ensureOverlay(bind, 'fire', bind.fire ?? null, SFX_FIRE, frame, 5, 0, 0);
            if (bind.fire) {
                bind.fire.active = true;
            }
            // apk GameObjectEnemy.draw 548-565：篷车/金车/驿马车燃烧时除身上那条外，再补两条错开的火苗。
            const wagon = enemy.type === 4 || enemy.type === 6 || enemy.type === 5;
            if (wagon) {
                const fire2 = this._ensureOverlay(bind, 'fire2', bind.root.getChildByName('fire2'), SFX_FIRE, frame, 5, -640, 640);
                if (fire2) {
                    fire2.active = true;
                }
                // 原版第三条的 dst 左边界不做 -frmWidth/2 居中（558 行做了、561 行没做），
                // 等于整条右移半个帧宽；两条若放在同一偏移上会完全重合，看起来就只剩两团火。
                // 项目里 1 像素 = 7680/32 微单位，所以半个帧宽 = 帧宽 * 120 微单位。
                const fireSheet = this._sheets.get(SFX_FIRE);
                const halfFrameFine = fireSheet ? Math.max(1, Math.trunc(fireSheet.width / 5)) * 120 : 0;
                const fire3 = this._ensureOverlay(bind, 'fire3', bind.root.getChildByName('fire3'), SFX_FIRE, frame, 5, -640 + halfFrameFine, 640);
                if (fire3) {
                    fire3.active = true;
                }
            }
        } else {
            if (bind.fire) {
                bind.fire.active = false;
            }
            for (const name of ['fire2', 'fire3']) {
                const extra = bind.root.getChildByName(name);
                if (extra) {
                    extra.active = false;
                }
            }
        }
        if (enemy.alive && enemy.slowDownTimeCounter > 0) {
            bind.stun = this._ensureOverlay(bind, 'stun', bind.stun ?? null, SFX_STUN, stunOverlayFrame(nowMs), 6, 0, 0);
            if (bind.stun) {
                bind.stun.active = true;
            }
        } else if (bind.stun) {
            bind.stun.active = false;
        }
        if (enemy.alive && enemy.showHealFx && (enemy.healTimeCounter ?? 0) > 0) {
            bind.heal = this._ensureOverlay(bind, 'heal', bind.heal ?? null, SFX_HEAL, healOverlayFrame(enemy.healTimeCounter ?? 0), 7, 0, 0);
            if (bind.heal) {
                bind.heal.active = true;
            }
        } else if (bind.heal) {
            bind.heal.active = false;
        }
        const style = enemy.deathAnimationStyle;
        if (!enemy.alive && (style === 11 || style === 21)) {
            bind.deathFx = this._ensureOverlay(bind, 'deathSmoke', bind.deathFx ?? null, SFX_SMOKE_EXPLOSION, smokeDeathFrame(enemy.deathAnimationCounter), 8, 0, 0);
            if (bind.deathFx) {
                bind.deathFx.active = true;
            }
        } else if (bind.deathFx) {
            bind.deathFx.active = false;
        }
    }

    private _ensureOverlay(bind: UnitBinding, name: string, existing: Node | null, file: string, frame: number, frames: number, offsetFineX: number, offsetFineY: number): Node | null {
        const sheet = this._sheets.get(file);
        if (!sheet) {
            return existing;
        }
        const fw = Math.max(1, Math.trunc(sheet.width / Math.max(1, frames)));
        const fh = sheet.height;
        const fr = Math.max(0, Math.min(frames - 1, frame));
        const sf = this._sheetFrame(sheet, fr, 0, fw, fh);
        let node = existing;
        if (!node || !node.isValid) {
            node = bind.root.getChildByName(name);
        }
        if (!node || !node.isValid) {
            node = this._sprite(bind.root, name, sf, fw, fh);
            const ut = node.getComponent(UITransform);
            if (ut) {
                ut.setAnchorPoint(0.5, 0);
            }
        }
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = sf;
        }
        const ut = node.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(fw, fh);
        }
        const ox = (offsetFineX / 7680) * 32;
        // 原版火/眩晕/治疗 dst 底边在脚点上方 1 帧高；死亡烟雾底边在脚点。
        const stretch = name === 'deathSmoke' ? 0 : 1;
        const oy = -(offsetFineY / 7680) * 32 + fh * stretch;
        node.setPosition(ox, oy, 0);
        node.active = true;
        return node;
    }

    private async _loadBattleHudTextures(): Promise<void> {
        const files = [
            HUD_TOP,
            HUD_TOP_LEFT,
            HUD_TOP_RIGHT,
            HUD_PAUSE,
            HUD_PAUSE_PRESSED,
            HUD_STAR_FULL,
            HUD_STAR_COVER,
            HUD_FONT_NUMBERS_SCALED,
            HUD_WOODEN_SIGN_RIGHT,
            HUD_BOTTOM,
            HUD_ICONS_THUMBS,
            HUD_ICONS_ENEMIES,
            HUD_CURSOR,
            HUD_SELECTOR,
            HUD_CROSSHAIR,
            'gng_wave_arrow_a',
            'gng_wave_arrow_b',
            'gng_wave_arrow_c',
            'gng_wave_arrow_d',
            'boss_hat',
            ...UI_DIALOG_FILES,
            ...DIFFICULTY_PORTRAIT_FILES,
            ...UNIT_PORTRAIT_FILES,
        ];
        const base = await loadBundle('base');
        for (const file of files) {
            if (this._sheets.has(file)) {
                continue;
            }
            await this._loadNamedSheet(base, file);
        }
    }

    private _battleLayout(maps?: { cols: number; rows: number } | null) {
        return battleHudLayout(undefined, {
            screen: stageSize(),
            mapCols: maps?.cols,
            mapRows: maps?.rows,
        });
    }

    /** 地图双圈外框在当前屏幕中的上下沿；超出屏幕时钳到显示边界。 */
    private _hudMapVerticalAnchors(): { top: number; bottom: number } {
        const size = stageSize();
        const screenTop = size.height / 2;
        const screenBottom = -screenTop;
        const maps = this._maps;
        const lens = this._lens;
        if (!maps || !lens) {
            return { top: screenTop, bottom: screenBottom };
        }
        const lookY = fineToPixels(lens.lookFineY);
        const border = TILE * 2;
        return {
            top: Math.min(screenTop, maps.rows * TILE + border - lookY),
            bottom: Math.max(screenBottom, -border - lookY),
        };
    }

    /** 底栏停靠线：外圈边框下沿往上 2 格（= 内圈边框上沿 / 地图底边），地图越界时贴显示下沿。 */
    private _hudBarRestingBottom(): number {
        return this._hudMapVerticalAnchors().bottom + TILE * 2;
    }

    /** 下方弹窗/倒计时/升级按钮停靠线：与选中角色后的底部信息栏同一条线（内圈边框上沿）。 */
    private _hudLowerContentBottom(): number {
        return this._hudBarRestingBottom();
    }

    /**
     * 边框遮挡裁剪层：底边压在停靠线上，只露出内圈边框上沿以上的内容，
     * 让进出动画从边框“后面”冒出，而不是盖着边框滑过。
     * 挂在裁剪层里的内容以停靠线为 y=0，落到线以下即被裁掉。
     */
    private _makeBorderClip(parent: Node, name: string): Node {
        const size = stageSize();
        const clip = new Node(name);
        parent.addChild(clip);
        clip.layer = Layers.Enum.UI_2D;
        const ut = clip.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0);
        ut.setContentSize(size.width, size.height);
        const mask = clip.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        this._syncBorderClip(clip);
        return clip;
    }

    /** 停靠线跟镜头上下移动，裁剪层每帧重新压在线上。 */
    private _syncBorderClip(clip: Node | null): void {
        if (clip && clip.isValid) {
            clip.setPosition(0, this._hudLowerContentBottom(), 0);
        }
    }

    private _syncTopHudAnchor(): void {
        const group = this._topHudGroup;
        if (!group || !group.isValid) {
            return;
        }
        const size = stageSize();
        group.setPosition(0, this._hudMapVerticalAnchors().top - size.height / 2, 0);
    }

    /** 倒计时等“下方内容”每帧跟随地图内圈边框上沿 +1 格停靠。 */
    private _syncLowerHudAnchors(): void {
        this._syncBorderClip(this._countdownClip);
        this._syncBorderClip(this._signClip);
        const cd = this._countdownRoot;
        if (cd && cd.isValid) {
            // countdown 锚点 (1,0)：右下角，水平贴屏幕右边。挂在裁剪层里后，y=0 就是停靠线。
            cd.setPosition(stageSize().width / 2, 0, 0);
        }
    }

    private _buildOfficialBattleHud(root: Node, size: { width: number; height: number }): void {
        const topGroup = new Node('HudTopGroup');
        root.addChild(topGroup);
        topGroup.layer = Layers.Enum.UI_2D;
        topGroup.addComponent(UITransform).setContentSize(size.width, size.height);
        this._topHudGroup = topGroup;
        this._buildTopBar(topGroup, size);
        this._buildPauseButton(topGroup, size);
        this._buildSheriffStar(topGroup, size);
        this._buildCashAndWaveSlots(topGroup, size);
        this._buildMinimap(topGroup, size);
        this._buildBottomBar(root, size);
        this._buildWaveCountdown(root, size);
        this._syncTopHudAnchor();
        this._syncLowerHudAnchors();
        this._syncCashHud();
        this._syncWaveHud();
    }

    private _pinTop(node: Node, anchorX: number, anchorY: number, x: number, y: number, width: number, height: number): void {
        const ut = node.getComponent(UITransform);
        if (ut) {
            ut.setAnchorPoint(anchorX, anchorY);
            ut.setContentSize(width, height);
        }
        node.setPosition(x, y, 0);
    }

    private _buildTopBar(root: Node, size: { width: number; height: number }): void {
        const layout = this._battleLayout();
        const left = this._sheets.get(HUD_TOP_LEFT);
        const mid = this._sheets.get(HUD_TOP);
        const right = this._sheets.get(HUD_TOP_RIGHT);
        const topY = layout.topBar.y;
        const midW = mid?.width ?? 480;
        const midH = mid?.height ?? 67;
        const leftW = left?.width ?? 30;
        const leftH = left?.height ?? midH;
        const rightW = right?.width ?? 30;
        const rightH = right?.height ?? midH;
        // 中间装饰条按 mdpi 原尺寸居中，绝不拉成整屏宽（图上有 $、波次凹槽和篷车）。
        const midLeft = -midW / 2;
        const midRight = midW / 2;
        if (mid) {
            const node = this._uiSprite(root, 'HudTop', this._sheetFrame(mid, 0, 0, mid.width, mid.height), midW, midH);
            this._pinTop(node, 0.5, 1, 0, topY, midW, midH);
        }
        if (left) {
            const node = this._uiSprite(root, 'HudTopLeft', this._sheetFrame(left, 0, 0, left.width, left.height), leftW, leftH);
            this._pinTop(node, 1, 1, midLeft, topY, leftW, leftH);
        }
        if (right) {
            const node = this._uiSprite(root, 'HudTopRight', this._sheetFrame(right, 0, 0, right.width, right.height), rightW, rightH);
            this._pinTop(node, 0, 1, midRight, topY, rightW, rightH);
        }
        // 官方只画 480dip 顶栏 + 左右 30dip 端帽，合计 540dip，居中留边；不再向屏幕两端补条。
        if (!mid && !left && !right) {
            const node = new Node('HudTopFallback');
            root.addChild(node);
            node.layer = Layers.Enum.UI_2D;
            this._pinTop(node, 0.5, 1, 0, topY, 480, layout.topBar.height);
            const g = node.addComponent(Graphics);
            g.fillColor = new Color(80, 50, 28, 230);
            g.rect(-240, -layout.topBar.height, 480, layout.topBar.height);
            g.fill();
        }
    }

    private _makeBarCapFill(parent: Node, name: string, sheet: { width: number; height: number } | undefined, width: number, height: number, fallback: Color): Node {
        const left = this._sheets.get(HUD_TOP_LEFT);
        const right = this._sheets.get(HUD_TOP_RIGHT);
        const src = sheet === right ? right : left;
        if (src) {
            const node = this._uiSprite(parent, name, this._sheetFrame(src, 0, 0, src.width, src.height), width, height);
            const sp = node.getComponent(Sprite);
            if (sp) {
                sp.type = Sprite.Type.SLICED;
            }
            return node;
        }
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(width, height);
        const g = node.addComponent(Graphics);
        g.fillColor = fallback;
        g.rect(-width / 2, -height / 2, width, height);
        g.fill();
        return node;
    }

    private _buildSheriffStar(root: Node, size: { width: number; height: number }): void {
        void size;
        const areaW = 78;
        const areaH = 74;
        const area = new Node('SheriffStar');
        root.addChild(area);
        area.layer = Layers.Enum.UI_2D;
        const ut = area.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        ut.setContentSize(areaW, areaH);
        const layout = this._battleLayout();
        this._livesBaseX = layout.sheriff.x + layout.sheriff.width / 2;
        this._livesBaseY = layout.sheriff.y - layout.sheriff.height / 2;
        area.setPosition(this._livesBaseX, this._livesBaseY, 0);
        this._starArea = area;

        const fullSheet = this._sheets.get(HUD_STAR_FULL);
        const coverSheet = this._sheets.get(HUD_STAR_COVER);
        const sw = fullSheet?.width ?? coverSheet?.width ?? 64;
        const sh = fullSheet?.height ?? coverSheet?.height ?? 64;
        if (fullSheet) {
            const full = this._uiSprite(area, 'star0', this._sheetFrame(fullSheet, 0, 0, fullSheet.width, fullSheet.height), sw, sh);
            full.setPosition(0, 0, 0);
            this._starFull = full;
        } else {
            const full = new Node('star0');
            area.addChild(full);
            full.layer = Layers.Enum.UI_2D;
            const fut = full.addComponent(UITransform);
            fut.setContentSize(sw, sh);
            const g = full.addComponent(Graphics);
            g.fillColor = new Color(240, 200, 60, 255);
            g.circle(0, 0, sh / 2);
            g.fill();
            this._starFull = full;
        }
        const cover = new Node('starCover');
        area.addChild(cover);
        cover.layer = Layers.Enum.UI_2D;
        const cut = cover.addComponent(UITransform);
        cut.setAnchorPoint(0.5, 0);
        cut.setContentSize(sw, 0);
        cover.setPosition(0, -sh / 2, 0);
        cover.addComponent(Sprite);
        cover.active = false;
        this._starCover = cover;

        const digits = new Node('starDigits');
        area.addChild(digits);
        digits.layer = Layers.Enum.UI_2D;
        const dut = digits.addComponent(UITransform);
        dut.setAnchorPoint(0.5, 0.5);
        dut.setContentSize(areaW, areaH);
        digits.setPosition(0, 0, 0);
        this._starDigits = digits;
        void coverSheet;
    }

    private _buildPauseButton(root: Node, size: { width: number; height: number }): void {
        void size;
        const sheet = this._sheets.get(HUD_PAUSE) ?? this._sheets.get(HUD_PAUSE_PRESSED);
        const layout = this._battleLayout();
        const w = sheet?.width ?? layout.pause.width;
        const h = sheet?.height ?? layout.pause.height;
        const node = new Node('PauseButton');
        root.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(layout.pause.anchorX, layout.pause.anchorY);
        ut.setContentSize(w, h);
        node.setPosition(layout.pause.x, layout.pause.y, 0);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sheet) {
            sprite.spriteFrame = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
        }
        this._pauseButton = node;
        this._setPausePressed(false);
        if (!sheet) {
            const bg = new Node('fallback');
            node.addChild(bg);
            bg.layer = Layers.Enum.UI_2D;
            const bgUt = bg.addComponent(UITransform);
            bgUt.setContentSize(w, h);
            bgUt.setAnchorPoint(0.5, 0.5);
            const g = bg.addComponent(Graphics);
            g.fillColor = new Color(120, 40, 40, 255);
            g.rect(-w / 2, -h / 2, w, h);
            g.fill();
            const label = this._uiLabel(node, 'pauseText', '暂停', 18);
            label.setPosition(0, 0, 0);
        }
    }

    private _buildCashAndWaveSlots(root: Node, _size: { width: number; height: number }): void {
        const layout = this._battleLayout();
        this._cashSlot = this._makeHudSlot(root, 'DollarText', layout.dollar);
        this._currentWaveSlot = this._makeHudSlot(root, 'CurrentWaveText', layout.currentWave);
        this._maxWaveSlot = this._makeHudSlot(root, 'MaxWaveText', layout.maxWave);
    }

    private _makeHudSlot(root: Node, name: string, slot: { x: number; y: number; width: number; height: number; anchorX: number; anchorY: number }): Node {
        const node = new Node(name);
        root.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(slot.anchorX, slot.anchorY);
        ut.setContentSize(slot.width, slot.height);
        node.setPosition(slot.x, slot.y, 0);
        return node;
    }

    private _twoDigit(n: number): string {
        const v = Math.max(0, Math.trunc(n));
        return v < 100 ? String(v).padStart(2, '0') : String(v);
    }

    private _paintHudNumber(slot: Node | null, text: string, fontSheet = HUD_FONT_NUMBERS): void {
        if (!slot || !slot.isValid) {
            return;
        }
        const leftover = slot.getComponent(Label);
        if (leftover) {
            leftover.destroy();
        }
        slot.removeAllChildren();
        // 顶栏金币、波次都是 hud_font_numbers（8×16）；只有警长星用 hud_font_numbers_scaled（12×24）。
        const sheet = this._sheets.get(fontSheet) ?? this._sheets.get(HUD_FONT_NUMBERS);
        const ut = slot.getComponent(UITransform);
        const boxW = ut?.contentSize.width ?? 24;
        const boxH = ut?.contentSize.height ?? 24;
        if (!sheet) {
            const label = slot.addComponent(Label);
            label.string = text;
            label.fontSize = 18;
            label.lineHeight = 20;
            label.useSystemFont = true;
            label.fontFamily = 'Arial';
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.color = new Color(255, 255, 255, 255);
            label.overflow = Label.Overflow.SHRINK;
            return;
        }
        const cellW = Math.trunc(sheet.width / 10) || sheet.width;
        const cellH = sheet.height;
        const totalW = cellW * text.length;
        // ImageTextView mAlign=0：在槽里水平、垂直居中。XML 没写对齐，截图里 107 / 03 / 08 都是居中。
        const ax = ut?.anchorX ?? 0;
        const ay = ut?.anchorY ?? 1;
        const left = -ax * boxW;
        const top = (1 - ay) * boxH;
        const originX = left + (boxW - totalW) / 2;
        const originY = top - boxH / 2;
        for (let i = 0; i < text.length; i++) {
            const d = text.charCodeAt(i) - 48;
            if (d < 0 || d > 9) {
                continue;
            }
            const node = this._uiSprite(slot, `d${i}`, this._sheetSubframe(sheet, d * cellW, 0, cellW, cellH), cellW, cellH);
            node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
            node.setPosition(originX + i * cellW, originY, 0);
        }
    }

    private _buildWaveCountdown(root: Node, _size: { width: number; height: number }): void {
        const layout = this._battleLayout();
        const slot = layout.countdown;
        const node = new Node('WaveCountdown');
        const clip = this._makeBorderClip(root, 'WaveCountdownClip');
        clip.addChild(node);
        this._countdownClip = clip;
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(slot.anchorX, slot.anchorY);
        ut.setContentSize(slot.width, slot.height);
        node.setPosition(slot.x, slot.y, 0);
        // apk signal_rotate_in_right / out_right：pivot=(50%, 130%)，即宽度中间、牌子底边再往下 0.3 个高度。
        const pivot = new Node('pivot');
        node.addChild(pivot);
        pivot.layer = Layers.Enum.UI_2D;
        const pivotUt = pivot.addComponent(UITransform);
        pivotUt.setAnchorPoint(0.5, 0.5);
        pivotUt.setContentSize(slot.width, slot.height);
        pivot.setPosition(-slot.width / 2, -slot.height * 0.3, 0);
        const centerX = 0;
        const centerY = slot.height * 0.8;
        const sign = this._sheets.get(HUD_WOODEN_SIGN_RIGHT);
        if (sign) {
            const bg = this._uiSprite(pivot, 'sign', this._sheetFrame(sign, 0, 0, sign.width, sign.height), slot.width, slot.height);
            const bgUt = bg.getComponent(UITransform);
            if (bgUt) {
                bgUt.setAnchorPoint(0.5, 0.5);
            }
            bg.setPosition(centerX, centerY, 0);
        } else {
            const bg = new Node('sign');
            pivot.addChild(bg);
            bg.layer = Layers.Enum.UI_2D;
            const bgUt = bg.addComponent(UITransform);
            bgUt.setAnchorPoint(0.5, 0.5);
            bgUt.setContentSize(slot.width, slot.height);
            bg.setPosition(centerX, centerY, 0);
            const g = bg.addComponent(Graphics);
            g.fillColor = new Color(120, 80, 40, 255);
            g.rect(-slot.width / 2, -slot.height / 2, slot.width, slot.height);
            g.fill();
        }
        const digits = new Node('digits');
        pivot.addChild(digits);
        digits.layer = Layers.Enum.UI_2D;
        const dut = digits.addComponent(UITransform);
        dut.setAnchorPoint(0.5, 0.5);
        dut.setContentSize(slot.width, slot.height);
        digits.setPosition(centerX, centerY, 0);
        this._countdownRoot = node;
        this._countdownPivot = pivot;
        this._countdownDigits = digits;
        this._countdownShown = false;
        this._countdownText = '';
        node.active = false;
    }

    /**
     * apk Playfield.setWaveCountDown + signal_rotate_in/out_right.xml：
     * 800ms，绕 pivot 旋转 180°，AccelerateDecelerate（sineInOut），退出结束隐藏。
     * Android 角度以屏幕 y 向下为正（顺时针）；Cocos y 向上，angle 正值逆时针，
     * 因此 from 180 → to 0 要写成 -180 → 0 才是同向（逆时针转正）。
     */
    private _playCountdownRotate(entering: boolean): void {
        const root = this._countdownRoot;
        const pivot = this._countdownPivot;
        if (!root || !root.isValid || !pivot || !pivot.isValid) {
            return;
        }
        Tween.stopAllByTarget(pivot);
        if (entering) {
            pivot.angle = -180;
            root.active = true;
            tween(pivot).to(0.8, { angle: 0 }, { easing: 'sineInOut' }).start();
        } else {
            pivot.angle = 0;
            tween(pivot)
                .to(0.8, { angle: -180 }, { easing: 'sineInOut' })
                .call(() => {
                    if (root.isValid) {
                        root.active = false;
                    }
                    if (pivot.isValid) {
                        pivot.angle = 0;
                    }
                })
                .start();
        }
    }

    private _setPausePressed(pressed: boolean): void {
        this._pausePressed = pressed;
        const node = this._pauseButton;
        if (!node || !node.isValid) {
            return;
        }
        const file = pressed ? HUD_PAUSE_PRESSED : HUD_PAUSE;
        const sheet = this._sheets.get(file) ?? this._sheets.get(HUD_PAUSE);
        const sprite = node.getComponent(Sprite);
        if (sprite && sheet) {
            sprite.spriteFrame = this._sheetFrame(sheet, 0, 0, sheet.width, sheet.height);
        }
    }

    private _hitPauseButton(event: EventTouch): boolean {
        const node = this._pauseButton;
        if (!node || !node.isValid) {
            return false;
        }
        const ut = node.getComponent(UITransform);
        return !!ut && ut.hitTest(event.getLocation());
    }

    private _openPauseDialog(): void {
        if (GameTime.dialogOpen) {
            return;
        }
        this._dismissPauseDialog();
        const canvas = this._canvasRoot();
        if (!canvas) {
            return;
        }
        const dialog = new Node('PauseDialog');
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        const size = stageSize();
        ut.setContentSize(size.width, size.height);
        dialog.setPosition(0, 0, 0);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(size.width, size.height);
        const bgOpacity = bg.addComponent(UIOpacity);
        bgOpacity.opacity = 0;
        tween(bgOpacity).to(0.6, { opacity: 160 }).start();
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 160);
        g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        g.fill();
        const clip = this._makeBorderClip(dialog, 'PauseBoxClip');
        const box = new Node('PauseBox');
        clip.addChild(box);
        box.layer = Layers.Enum.UI_2D;
        const boxW = MENU_BOX_WIDTH;
        const boxH = MENU_BOX_HEIGHT;
        const boxUt = box.addComponent(UITransform);
        boxUt.setContentSize(boxW, boxH);
        boxUt.setAnchorPoint(0.5, 0.5);
        // 官方暂停盒 480×320 水平居中；底边与选中角色后的底部信息栏压在同一条边框线上。
        const band = contentBand(size.width, size.height);
        // 挂在裁剪层里后 y=0 就是停靠线：停稳时木板底边压线，收起时为负、整块藏进边框后面。
        const boxY = boxH / 2;
        // dialog_slide_in.xml：600ms 从停靠线下方滑上来，从边框后面冒出。
        this._pauseBoxClosedY = -boxH / 2;
        box.setPosition(band.x, this._pauseBoxClosedY, 0);
        tween(box)
            .to(0.6, { position: new Vec3(band.x, boxY, 0) }, { easing: 'sineInOut' })
            .start();
        this._paintUiBg(box, this._uiNamedFrame(UI_MENU_BOX), boxW, boxH, new Color(40, 28, 16, 230));
        const boxTop = boxY + boxH / 2;
        const startY = boxTop - MAIN_MENU_BUTTON_AREA_MARGIN_TOP - MENU_BUTTON_HEIGHT / 2;
        this._uiMenuButton(box, this._officialString('T_IA_PAUSE_CONTINUE') || '继续', 0, startY - boxY, () => this._dismissPauseDialog());
        this._uiMenuButton(box, this._officialString('T_IA_PAUSE_RESTART') || '重新开始', 0, startY - MENU_BUTTON_HEIGHT - boxY, () => this._confirmRestartFromPause());
        this._uiMenuButton(box, this._officialString('T_IA_MENU_OPTIONS') || '选项', 0, startY - MENU_BUTTON_HEIGHT * 2 - boxY, () => this._openPauseOptions());
        this._uiMenuButton(box, this._officialString('T_IA_MENU_CLOSE') || '离开', 0, startY - MENU_BUTTON_HEIGHT * 3 - boxY, () => this._confirmLeaveFromPause());
        const soundEnabled = isSoundEnabled();
        const soundOn = this._uiNamedFrame(...(soundEnabled ? [UI_SOUND_ON, UI_SOUND_OFF] : [UI_SOUND_OFF, UI_SOUND_ON]));
        const soundPressed = this._uiNamedFrame(...(soundEnabled ? [UI_SOUND_ON_PRESSED, UI_SOUND_OFF_PRESSED] : [UI_SOUND_OFF_PRESSED, UI_SOUND_ON_PRESSED]));
        const soundTop = boxTop - MAIN_MENU_SOUND_MARGIN_TOP;
        const soundRight = boxW / 2 - MAIN_MENU_SOUND_MARGIN_RIGHT;
        const soundX = soundRight - SOUND_BUTTON_WIDTH / 2;
        const soundY = soundTop - SOUND_BUTTON_HEIGHT / 2 - boxY;
        if (soundOn) {
            const soundNode = new Node('PauseSound');
            box.addChild(soundNode);
            soundNode.layer = Layers.Enum.UI_2D;
            const sUt = soundNode.addComponent(UITransform);
            sUt.setContentSize(SOUND_BUTTON_WIDTH, SOUND_BUTTON_HEIGHT);
            sUt.setAnchorPoint(0.5, 0.5);
            soundNode.setPosition(soundX, soundY, 0);
            const sBg = new Node('bg');
            soundNode.addChild(sBg);
            sBg.layer = Layers.Enum.UI_2D;
            this._paintUiBg(sBg, soundOn, SOUND_BUTTON_WIDTH, SOUND_BUTTON_HEIGHT, new Color(60, 40, 20, 220));
            if (soundPressed) {
                this._wireUiPressed(soundNode, soundOn, soundPressed);
            }
            const sBtn = soundNode.addComponent(Button);
            sBtn.transition = Button.Transition.NONE;
            soundNode.on(Node.EventType.TOUCH_END, (ev: EventTouch) => {
                ev.propagationStopped = true;
                this._togglePauseSound(soundNode);
            }, this);
        }
        this._pauseDialog = dialog;
        GameTime.setPaused(true);
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
    }

    private _dismissPauseDialog(animate = true): void {
        this._dismissPauseQuestion();
        this._dismissPauseOptions();
        const dialog = this._pauseDialog;
        this._pauseDialog = null;
        if (dialog && dialog.isValid) {
            const box = dialog.getChildByName('PauseBoxClip')?.getChildByName('PauseBox');
            const bg = dialog.getChildByName('bg');
            const bgOpacity = bg?.getComponent(UIOpacity);
            if (bgOpacity) {
                tween(bgOpacity).to(0.6, { opacity: 0 }).start();
            }
            if (animate && box) {
                // dialog_slide_out.xml：600ms 滑回屏幕下沿后销毁。
                const endY = this._pauseBoxClosedY;
                tween(box)
                    .to(0.6, { position: new Vec3(box.position.x, endY, 0) }, { easing: 'sineInOut' })
                    .call(() => {
                        if (dialog.isValid) {
                            dialog.destroy();
                        }
                    })
                    .start();
            } else {
                dialog.destroy();
            }
        }
        GameTime.setPaused(false);
        if (GameTime.dialogOpen && !this._shopDialog && !this._cardDialog && !this._outcomeDialog) {
            GameTime.setDialogOpen(false);
        }
        UiTouchGuard.blocked = false;
    }

    /** 暂停盒完全收起时的 y（裁剪层坐标，y=0 即边框停靠线，负值被裁掉）。 */
    private _pauseBoxClosedY = 0;

    onLeaveBattle: (() => void) | null = null;

    /** 当前正在打的关卡号，离开战斗后用来回到对应地区的选关。 */
    get currentLevel(): number {
        return this._playLevel;
    }

    /**
     * 清掉 TerrainView 自己建的地图和战斗 UI，但不销毁 BattleRoot 相机、
     * BattlefieldCamera，也不销毁本组件，以便再次 showLevel。
     */
    public hideBattle(): void {
        this._dismissPauseDialog(false);
        this._closeMessageDialog();
        this._closeShopDialog(false);
        this._closeCardDialog(false);
        this._closeOutcomeDialog(false);
        this._clearViewBindings();
        this._clearPaintedBattle();
        this._sim = null;
        GameTime.setPaused(false);
        GameTime.setDialogOpen(false);
        GameTime.setBattleUiFocused(false);
        UiTouchGuard.blocked = false;
    }

    private _clearPaintedBattle(): void {
        const scene = this.node.scene;
        const playfield = scene?.getChildByName('Playfield');
        if (playfield?.isValid) {
            playfield.destroy();
        }
        this._worldCanvas = null;
        this._decorLayer = null;
        this._unitLayer = null;
        if (this._hudRoot?.isValid) {
            this._hudRoot.destroy();
        }
        const leftoverHud = scene?.getChildByName('Canvas')?.getChildByName('TerrainHud');
        if (leftoverHud?.isValid) {
            leftoverHud.destroy();
        }
        this._hudRoot = null;
        this._topHudGroup = null;
        this._pauseButton = null;
        this._bottomBar = null;
        this._bottomBarAnim = 0;
        this._minimap = null;
        this._minimapGfx = null;
        this._livesLabel = null;
        this._waveLabel = null;
        this._countdownLabel = null;
        this._cashLabel = null;
        this._rangeCircle = null;
        this._shotGfx = null;
        this._arrow = null;
        this._upgradeSign = null;
        this._bubbleRoot = null;
        this._starFull = null;
        this._starCover = null;
        this._starDigits = null;
        this._starArea = null;
        this._cursorRoot = null;
        this._selectorRoot = null;
        this._crosshairRoot = null;
    }

    private _confirmRestartFromPause(): void {
        const text = this._officialString('T_MENU_RESTART_QUESTION') || '你确定要重新开始本关么？';
        this._openPauseQuestion(text, () => this._restartFromPause());
    }

    private _confirmLeaveFromPause(): void {
        const text = this._officialString('T_MENU_CLOSE_QUESTION') || '你确定要离开游戏么？尚未保存的成绩将会丢失！';
        this._openPauseQuestion(text, () => this._leaveBattleFromPause());
    }

    private _openPauseQuestion(text: string, onYes: () => void): void {
        const canvas = this._canvasRoot();
        if (!canvas) {
            return;
        }
        this._dismissPauseQuestion();
        this._dismissPauseOptions();
        const dialog = new Node('PauseQuestion');
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        ut.setAnchorPoint(0.5, 0.5);
        this._slideDialogIn(dialog, 0, -40, DIALOG_LARGE_HEIGHT);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        bgUt.setAnchorPoint(0.5, 0.5);
        this._paintUiBg(bg, this._dialogBgFrame(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT), DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, new Color(40, 28, 16, 230));
        // apk dialog_question_large.xml 同样把 question_dialog_text 放进 ds_scroll_view。
        const box = dialogScrollBox();
        const scroller = this._makeDialogScroller(dialog, box.width, box.height, box.x, box.y);
        const textH = estimateTextHeight(text, box.textWidth, 14, 18);
        const bodyNode = this._uiLabel(scroller.content, 'body', text, 14, DIALOG_TEXT_COLOR);
        const bodyLabel = bodyNode.getComponent(Label);
        if (bodyLabel) {
            bodyLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            bodyLabel.verticalAlign = Label.VerticalAlign.TOP;
            bodyLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
            bodyLabel.lineHeight = 18;
        }
        const bodyUt = bodyNode.getComponent(UITransform);
        if (bodyUt) {
            bodyUt.setAnchorPoint(0.5, 1);
            bodyUt.setContentSize(box.textWidth, textH);
        }
        bodyNode.setPosition(box.textX, 0, 0);
        const contentUt = scroller.content.getComponent(UITransform);
        if (contentUt) {
            contentUt.setContentSize(box.textWidth, Math.max(box.height, textH));
        }
        this._attachDialogScroll(
            dialog, scroller.view, scroller.content,
            box.width, box.height, box.x, box.y, textH,
        );
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes', '确定', () => {
            this._dismissPauseQuestion();
            onYes();
        });
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'no', '取消', () => this._dismissPauseQuestion());
        this._pauseQuestionDialog = dialog;
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
    }

    private _dismissPauseQuestion(): void {
        if (this._pauseQuestionDialog?.isValid) {
            this._pauseQuestionDialog.destroy();
        }
        this._pauseQuestionDialog = null;
    }

    private _openPauseOptions(): void {
        const canvas = this._canvasRoot();
        if (!canvas) {
            return;
        }
        this._dismissPauseOptions();
        this._dismissPauseQuestion();
        const settings = createMenuSettings(createLocalStore());
        const dialog = new Node('PauseOptions');
        canvas.addChild(dialog);
        dialog.layer = Layers.Enum.UI_2D;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        ut.setAnchorPoint(0.5, 0.5);
        this._slideDialogIn(dialog, 0, -40, DIALOG_LARGE_HEIGHT);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        bgUt.setAnchorPoint(0.5, 0.5);
        this._paintUiBg(bg, this._dialogBgFrame(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT), DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, new Color(40, 28, 16, 230));
        const title = this._uiLabel(dialog, 'title', this._officialString('T_IA_MENU_OPTIONS') || '选项', 15, DIALOG_TEXT_COLOR);
        title.setPosition(0, DIALOG_LARGE_HEIGHT / 2 - 30, 0);

        const rows: { name: string; title: string; value: () => boolean; click: () => void }[] = [
            {
                name: 'sound',
                title: this._officialString('T_MENU_OPTIONS_SOUND') || '声音',
                value: () => settings.isSoundEnabled(),
                click: () => {
                    settings.switchSound();
                    const soundNode = this._pauseDialog?.getChildByName('PauseBoxClip')?.getChildByName('PauseBox')?.getChildByName('PauseSound');
                    if (soundNode) {
                        this._refreshPauseSoundButton(soundNode);
                    }
                },
            },
            {
                name: 'wake',
                title: '屏幕常亮',
                value: () => settings.isWakeLockEnabled(),
                click: () => settings.switchWakeLock(),
            },
        ];
        if (settings.shouldShowVibraSwitch()) {
            rows.splice(1, 0, {
                name: 'vibra',
                title: this._officialString('T_MENU_OPTIONS_VIBRATION') || '震动',
                value: () => settings.isVibraEnabled(),
                click: () => settings.switchVibra(),
            });
        }

        const labels: { node: Node; row: typeof rows[number] }[] = [];
        const refresh = () => {
            for (const item of labels) {
                const lab = item.node.getComponent(Label);
                if (lab) {
                    lab.string = `${item.row.title}：${item.row.value() ? '开' : '关'}`;
                }
            }
        };
        rows.forEach((row, i) => {
            const node = this._uiLabel(dialog, row.name, `${row.title}：${row.value() ? '开' : '关'}`, 14, DIALOG_TEXT_COLOR);
            node.setPosition(0, 24 - i * 28, 0);
            const hit = node.getComponent(UITransform);
            if (hit) {
                hit.setContentSize(DIALOG_LARGE_WIDTH - 80, 24);
            }
            node.on(Node.EventType.TOUCH_END, () => {
                row.click();
                refresh();
            }, this);
            labels.push({ node, row });
        });
        this._uiYesNo(dialog, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'no', '取消', () => this._dismissPauseOptions());
        this._pauseOptionsDialog = dialog;
        GameTime.setDialogOpen(true);
        UiTouchGuard.blocked = true;
    }

    private _dismissPauseOptions(): void {
        if (this._pauseOptionsDialog?.isValid) {
            this._pauseOptionsDialog.destroy();
        }
        this._pauseOptionsDialog = null;
    }

    private _leaveBattleFromPause(): void {
        // 中途档按表只在每一波开始时写，离开不另开一套存档。
        this._dismissPauseDialog(false);
        this.onLeaveBattle?.();
    }

    private _restartFromPause(): void {
        this._dismissPauseDialog(false);
        this._restartCurrentLevel();
    }

    private _togglePauseSound(button: Node): void {
        clickThenToggleSound(() => {
            const next = !isSoundEnabled();
            applySoundEnabled(next);
            return next;
        });
        this._refreshPauseSoundButton(button);
    }

    private _refreshPauseSoundButton(button: Node): void {
        const enabled = isSoundEnabled();
        const normal = this._uiNamedFrame(...(enabled ? [UI_SOUND_ON, UI_SOUND_OFF] : [UI_SOUND_OFF, UI_SOUND_ON]));
        const pressed = this._uiNamedFrame(...(enabled ? [UI_SOUND_ON_PRESSED, UI_SOUND_OFF_PRESSED] : [UI_SOUND_OFF_PRESSED, UI_SOUND_ON_PRESSED]));
        const bg = button.getChildByName('bg');
        if (bg && normal) {
            this._paintUiBg(bg, normal, SOUND_BUTTON_WIDTH, SOUND_BUTTON_HEIGHT, new Color(60, 40, 20, 220));
            if (pressed) {
                this._wireUiPressed(button, normal, pressed);
            }
        }
    }

    private _buildBottomBar(root: Node, size: { width: number; height: number }): void {
        // 裁剪层：只露出底栏停靠线（内圈边框上沿）以上的部分，让滑入动画从边框“后面”冒出，
        // 而不是飘在边框上方。底栏挂在裁剪层里，y=0 即停靠线，收起时为负被裁掉。
        const clip = this._makeBorderClip(root, 'UnitInfoBarClip');
        this._bottomClip = clip;

        const bar = new Node('UnitInfoBar');
        clip.addChild(bar);
        bar.layer = Layers.Enum.UI_2D;
        const layout = this._battleLayout();
        const ut = bar.addComponent(UITransform);
        ut.setAnchorPoint(layout.bottomBar.anchorX, layout.bottomBar.anchorY);
        ut.setContentSize(size.width, layout.bottomBar.height);
        bar.setPosition(0, 0, 0);
        bar.active = false;
        this._bottomBar = bar;
    }

    private _syncBottomBar(): void {
        const bar = this._bottomBar;
        const sim = this._sim;
        if (!bar || !bar.isValid || !sim) {
            return;
        }
        const unit = sim.unitById(sim.selectedId);
        const icons = unit && !unit.isEnemy ? sim.bottomBarIconsFor(unit) : [];
        const board = this._sheets.get(HUD_BOTTOM);
        const thumbs = this._sheets.get(HUD_ICONS_THUMBS);
        const enemies = this._sheets.get(HUD_ICONS_ENEMIES);
        const cap = board ? Math.trunc(board.width / 3) : 32;
        const capH = board?.height ?? 48;
        // GunsAndGloryThread_run：showUnitOffsetY 用 800ms 正弦缓动，底栏从屏幕下沿滑上来。
        const show = !!unit && !unit.isEnemy;
        const frozen = GameTime.paused || GameTime.dialogOpen || GameTime.dtMs <= 0;
        const step = frozen ? 0 : GameTime.dtMs / 800;
        this._bottomBarAnim = show
            ? Math.min(1, this._bottomBarAnim + step)
            : Math.max(0, this._bottomBarAnim - step);
        const rise = Math.sin(this._bottomBarAnim * Math.PI / 2) * capH;
        this._syncBorderClip(this._bottomClip);
        // bar 挂在裁剪层内，相对其底边定位：y=0 贴停靠线，收起时 y = -(capH - rise) 落到裁剪区外被隐藏。
        bar.setPosition(0, -(capH - rise), 0);
        if (!show || this._bottomBarAnim <= 0) {
            bar.active = false;
            bar.removeAllChildren();
            return;
        }
        bar.active = true;
        bar.removeAllChildren();
        const thumbW = thumbs ? Math.trunc(thumbs.width / 2) : 24;
        const thumbH = thumbs?.height ?? 24;
        const iconW = enemies ? Math.trunc(enemies.width / 7) : 24;
        const iconH = enemies?.height ?? 24;
        let contentW = 0;
        for (const id of icons) {
            contentW += (id === 0 || id === 1) ? thumbW : iconW;
        }
        // apk：底栏背景宽 = Math.max(20, midCount * 54)。没有图标时也要有至少一块中间板，
        // 不然只剩两端盖看起来就是"一截很短的背景"。
        if (contentW <= 0) {
            contentW = iconW;
        }
        const midCount = Math.max(1, Math.round(contentW / cap));
        const barW = (midCount + 2) * cap;
        const leftX = -barW / 2;
        const y = 0;
        if (board) {
            const left = this._uiSprite(bar, 'capL', this._sheetSubframe(board, 0, 0, cap, capH), cap, capH);
            left.getComponent(UITransform)?.setAnchorPoint(0, 0);
            left.setPosition(leftX, y, 0);
            for (let i = 0; i < midCount; i++) {
                const mid = this._uiSprite(bar, `capM${i}`, this._sheetSubframe(board, cap, 0, cap, capH), cap, capH);
                mid.getComponent(UITransform)?.setAnchorPoint(0, 0);
                mid.setPosition(leftX + (i + 1) * cap, y, 0);
            }
            const right = this._uiSprite(bar, 'capR', this._sheetSubframe(board, cap * 2, 0, cap, capH), cap, capH);
            right.getComponent(UITransform)?.setAnchorPoint(0, 0);
            right.setPosition(leftX + (midCount + 1) * cap, y, 0);
        } else {
            const gnode = new Node('barBg');
            bar.addChild(gnode);
            gnode.layer = Layers.Enum.UI_2D;
            const gut = gnode.addComponent(UITransform);
            gut.setAnchorPoint(0.5, 0);
            gut.setContentSize(barW, capH);
            gnode.setPosition(0, 0, 0);
            const g = gnode.addComponent(Graphics);
            g.fillColor = new Color(70, 45, 25, 230);
            g.rect(-barW / 2, 0, barW, capH);
            g.fill();
        }
        let x = -contentW / 2;
        // apk drawUnitInfo：drawY2 = barTop + (bgHeight - iconHeight)，即图标底边与背景栏底边对齐。
        const iconY = 0;
        icons.forEach((id, idx) => {
            if (id === 0 || id === 1) {
                if (thumbs) {
                    const node = this._uiSprite(bar, `thumb${idx}`, this._sheetSubframe(thumbs, id * thumbW, 0, thumbW, thumbH), thumbW, thumbH);
                    node.getComponent(UITransform)?.setAnchorPoint(0, 0);
                    node.setPosition(x, iconY + (iconH - thumbH) / 2, 0);
                } else {
                    const node = this._fallbackIcon(bar, `thumb${idx}`, id === 0 ? '#88cc44' : '#cc4444', thumbW, thumbH);
                    node.setPosition(x + thumbW / 2, iconY + thumbH / 2, 0);
                }
                x += thumbW;
            } else {
                const group = id - 16;
                if (enemies) {
                    const node = this._uiSprite(bar, `eicon${idx}`, this._sheetSubframe(enemies, group * iconW, 0, iconW, iconH), iconW, iconH);
                    node.getComponent(UITransform)?.setAnchorPoint(0, 0);
                    node.setPosition(x, iconY, 0);
                } else {
                    const node = this._fallbackIcon(bar, `eicon${idx}`, '#dddddd', iconW, iconH);
                    node.setPosition(x + iconW / 2, iconY + iconH / 2, 0);
                }
                x += iconW;
            }
        });
        void bottomBarIcons;
    }

    private _fallbackIcon(parent: Node, name: string, hex: string, w: number, h: number): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX(hex);
        g.rect(-w / 2, -h / 2, w, h);
        g.fill();
        return node;
    }

    private _buildMinimap(root: Node, size: { width: number; height: number }): void {
        const maps = this._maps;
        if (!maps) {
            return;
        }
        void size;
        const layout = this._battleLayout(maps);
        // apk Minimap.initMiniMap：objectSize 固定由 66×50 画布推出（min(66/32,50/24)=2），不随地图尺寸变化。
        const objectSize = minimapObjectSize(maps.cols, maps.rows);
        this._minimapObjectSize = objectSize;
        const node = new Node('MiniMap');
        root.addChild(node);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(layout.minimap.anchorX, layout.minimap.anchorY);
        // 画布固定 66×50，位图在画布内居中（layout.minimap 的 x/y 已含居中偏移）。
        ut.setContentSize(GS_MINIMAP_WIDTH, GS_MINIMAP_HEIGHT);
        node.setPosition(layout.minimap.x, layout.minimap.y, 0);
        const g = node.addComponent(Graphics);
        this._minimap = node;
        this._minimapGfx = g;
        this._syncMinimap();
    }

    private _hitMinimap(event: EventTouch): boolean {
        const node = this._minimap;
        if (!node || !node.isValid) {
            return false;
        }
        const ut = node.getComponent(UITransform);
        return !!ut && ut.hitTest(event.getLocation());
    }

    private _syncMinimap(): void {
        const node = this._minimap;
        const g = this._minimapGfx;
        const maps = this._maps;
        const sim = this._sim;
        if (!node || !node.isValid || !g || !maps || !sim) {
            return;
        }
        const size = this._minimapObjectSize;
        const w = maps.cols * size;
        const h = maps.rows * size;
        g.clear();
        // 节点锚点在画布左上 (0,1)，画布 Y 向下为负：apk 位图 y = row*size 向下排。
        for (let row = 0; row < maps.rows; row++) {
            for (let col = 0; col < maps.cols; col++) {
                const i = row * maps.cols + col;
                const bg = maps.background[i] ?? 0;
                const street = maps.street[i] ?? 0;
                const rgba = argbToRgba(minimapTileColor(bg, street));
                g.fillColor = new Color(rgba.r, rgba.g, rgba.b, rgba.a);
                const x = col * size;
                const y = -(row * size + size);
                g.rect(x, y, size, size);
                g.fill();
            }
        }
        for (const enemy of sim.enemies?.enemies ?? []) {
            if (!enemy.alive) {
                continue;
            }
            const rgba = argbToRgba(minimapUnitColor('enemy'));
            g.fillColor = new Color(rgba.r, rgba.g, rgba.b, rgba.a);
            g.rect(enemy.fullX * size, -(enemy.fullY * size + size), size, size);
            g.fill();
        }
        for (const unit of sim.units) {
            if (!unit.alive || unit.isEnemy) {
                continue;
            }
            const rgba = argbToRgba(minimapUnitColor('friendly', unit.activity));
            g.fillColor = new Color(rgba.r, rgba.g, rgba.b, rgba.a);
            g.rect(unit.fullX * size, -(unit.fullY * size + size), size, size);
            g.fill();
        }
        const lens = this._lens;
        const view = stageSize();
        if (!lens) {
            return;
        }
        const viewFineW = pixelsToFine(view.width);
        const viewFineH = pixelsToFine(view.height);
        const mapH = maps.rows * 7680;
        const leftFine = lens.lookFineX - viewFineW / 2;
        const topFineUp = lens.lookFineY + viewFineH / 2;
        const topFineDown = mapH - topFineUp;
        const frame = minimapCameraFrame({
            cameraLeftFine: leftFine,
            cameraTopFine: topFineDown,
            viewWidthPx: view.width,
            viewHeightPx: view.height,
            objectSize: size,
            originX: 0,
            originY: 0,
            minimapWidth: w,
            minimapHeight: h,
        });
        // Graphics 的 Y 向上，minimapCameraFrame 的 top 按「从上往下」的格子算；
        // 节点锚点(0,1) 在画布左上，所以 local y = -down。
        const whiteY = -frame.white.bottom;
        const whiteH = frame.white.bottom - frame.white.top;
        const blackY = -frame.black.bottom;
        const blackH = frame.black.bottom - frame.black.top;
        g.strokeColor = new Color(255, 255, 255, 255);
        g.lineWidth = 1;
        g.rect(frame.white.left, whiteY, frame.white.right - frame.white.left, whiteH);
        g.stroke();
        g.strokeColor = new Color(0, 0, 0, 255);
        g.rect(frame.black.left, blackY, frame.black.right - frame.black.left, blackH);
        g.stroke();
        void lookFineAfterMinimapDrag;
    }

    private _syncSheriffStar(lives: number, maxLives: number, shakeMs: number): void {
        const area = this._starArea;
        const cover = this._starCover;
        if (!area || !area.isValid) {
            return;
        }
        const fullSheet = this._sheets.get(HUD_STAR_FULL);
        const coverSheet = this._sheets.get(HUD_STAR_COVER);
        const sh = fullSheet?.height ?? coverSheet?.height ?? 64;
        const sw = fullSheet?.width ?? coverSheet?.width ?? 64;
        const clip = starOverlayClip(lives, maxLives, sh);
        if (cover && cover.isValid) {
            if (!clip.draw) {
                cover.active = false;
            } else {
                cover.active = true;
                const ut = cover.getComponent(UITransform);
                if (ut) {
                    ut.setContentSize(sw, clip.coverHeight);
                }
                const sprite = cover.getComponent(Sprite);
                if (sprite && coverSheet) {
                    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    sprite.spriteFrame = this._sheetSubframe(coverSheet, 0, clip.srcTop, sw, clip.coverHeight);
                } else if (!coverSheet) {
                    let gnode = cover.getChildByName('fallback');
                    if (!gnode) {
                        gnode = new Node('fallback');
                        cover.addChild(gnode);
                        gnode.layer = Layers.Enum.UI_2D;
                        const gut = gnode.addComponent(UITransform);
                        gut.setAnchorPoint(0.5, 0);
                        gut.setContentSize(sw, clip.coverHeight);
                        gnode.addComponent(Graphics);
                    }
                    const gut = gnode.getComponent(UITransform);
                    if (gut) {
                        gut.setContentSize(sw, clip.coverHeight);
                    }
                    const g = gnode.getComponent(Graphics);
                    if (g) {
                        g.clear();
                        g.fillColor = new Color(80, 40, 20, 220);
                        g.rect(-sw / 2, 0, sw, clip.coverHeight);
                        g.fill();
                    }
                }
                cover.setPosition(0, -sh / 2, 0);
            }
        }
        this._drawStarDigits(lives, maxLives);
        const bucket = Math.trunc(shakeMs / 100);
        if (shakeMs > 0 && bucket !== this._starShakeLastBucket) {
            let dir = this._starShakeDir;
            let next = (dir + 1 + Math.trunc(Math.random() * 3)) % 4;
            if (next === dir) {
                next = (dir + 1) % 4;
            }
            this._starShakeDir = next;
            this._starShakeLastBucket = bucket;
        }
        if (shakeMs <= 0) {
            this._starShakeLastBucket = -1;
        }
        const off = starShakeOffset(shakeMs, lives, this._starShakeDir, 1);
        area.setPosition(this._livesBaseX + off.x, this._livesBaseY + off.y, 0);
    }

    private _drawStarDigits(lives: number, _maxLives: number): void {
        const root = this._starDigits;
        if (!root || !root.isValid) {
            return;
        }
        const text = String(Math.max(0, lives));
        const sheet = this._sheets.get(HUD_FONT_NUMBERS_SCALED);
        if (!sheet) {
            if (root.children.length > 0) {
                root.removeAllChildren();
            }
            let label = root.getComponent(Label);
            if (!label) {
                label = root.addComponent(Label);
                label.fontSize = 22;
                label.lineHeight = 26;
                label.useSystemFont = true;
                label.horizontalAlign = Label.HorizontalAlign.CENTER;
                label.verticalAlign = Label.VerticalAlign.CENTER;
                label.color = new Color(255, 255, 255, 255);
            }
            label.string = text;
            this._starDigitsDrawn = text;
            return;
        }
        const leftover = root.getComponent(Label);
        if (leftover) {
            leftover.destroy();
        }
        if (!leftover && this._starDigitsDrawn === text && root.children.length > 0) {
            return;
        }
        this._starDigitsDrawn = text;
        root.removeAllChildren();
        const cellW = Math.trunc(sheet.width / 10);
        const cellH = sheet.height;
        const totalW = cellW * text.length;
        let x = -totalW / 2;
        for (let i = 0; i < text.length; i++) {
            const d = text.charCodeAt(i) - 48;
            if (d < 0 || d > 9) {
                x += cellW;
                continue;
            }
            const node = this._uiSprite(root, `d${i}`, this._sheetSubframe(sheet, d * cellW, 0, cellW, cellH), cellW, cellH);
            node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
            node.setPosition(x, 0, 0);
            x += cellW;
        }
    }

    private _sheetSubframe(sheet: TileSheet, x: number, y: number, w: number, h: number): SpriteFrame {
        const key = `${sheet.id}_sub_${x}_${y}_${w}x${h}`;
        const cached = this._frameCache.get(key);
        if (cached) {
            return cached;
        }
        const tex = sheet.texture;
        tex.packable = false;
        const sf = new SpriteFrame();
        sf.texture = tex;
        sf.rect = new Rect(sheet.originX + x, sheet.originY + y, w, h);
        sf.originalSize = new Size(w, h);
        sf.offset = new Vec2(0, 0);
        sf.packable = false;
        this._frameCache.set(key, sf);
        return sf;
    }

    private _onMouseMove(event: EventMouse): void {
        if (!isHoverFourCornersEnabled()) {
            return;
        }
        this._touchMode = false;
        const fine = this._eventToFine(event);
        if (!fine) {
            this._hasHover = false;
            return;
        }
        this._hoverFineX = fine.fineX;
        this._hoverFineY = fine.fineY;
        this._hasHover = true;
    }

    private _eventToFine(event: EventTouch | EventMouse): { fineX: number; fineY: number } | null {
        const ui = event.getUILocation();
        return this._uiToFine(ui.x, ui.y);
    }

    private _syncSelectionOverlays(): void {
        const sim = this._sim;
        const maps = this._maps;
        const parent = this._decorLayer ?? this._worldCanvas;
        if (!sim || !maps || !parent) {
            return;
        }
        const selected = sim.unitById(sim.selectedId);
        if (selected && selected.alive && !selected.isEnemy) {
            this._cursorAngle = tickCursorAngle(this._cursorAngle, true);
            const selFrameH = visualFor(selected.type, false)?.frameH ?? 44;
            this._showCornerSet(parent, 'cursor', this._cursorRoot, HUD_CURSOR, CURSOR_FRAME_ORDER, selected.fineX + (selected.drawOffX ?? 0), selected.fineY + (selected.drawOffY ?? 0), maps.rows, selFrameH);
            this._cursorRoot = parent.getChildByName('HudCursor');
            if (this._selectorRoot && this._selectorRoot.isValid) {
                this._selectorRoot.active = false;
            }
        } else {
            if (this._cursorRoot && this._cursorRoot.isValid) {
                this._cursorRoot.active = false;
            }
            const hover = this._hoverTarget();
            const showSel = shouldShowHoverSelector({
                touchMode: this._touchMode,
                hovered: !!hover,
                isHorse: !!hover && hover.isHorse,
            });
            if (showSel && hover) {
                this._showCornerSet(parent, 'selector', this._selectorRoot, HUD_SELECTOR, SELECTOR_FRAME_ORDER, hover.fineX, hover.fineY, maps.rows, hover.frameH);
                this._selectorRoot = parent.getChildByName('HudSelector');
            } else if (this._selectorRoot && this._selectorRoot.isValid) {
                this._selectorRoot.active = false;
            }
        }

        const frozen = GameTime.paused || GameTime.dialogOpen || GameTime.dtMs <= 0 || !GameTime.battleUiFocused;
        this._crosshair = tickCrosshair(this._crosshair, GameTime.dtMs, frozen);
        const enemy = sim.selectedPrioEnemy();
        if (enemy && enemy.alive) {
            const enemyFrameH = visualFor(enemy.type, true, enemy.white)?.frameH ?? 44;
            this._showCrosshair(
                parent,
                enemy.fineX + (enemy.drawOffX ?? 0),
                enemy.fineY + (enemy.drawOffY ?? 0),
                maps.rows,
                this._crosshair.offset,
                enemyFrameH,
            );
            this._crosshairRoot = parent.getChildByName('HudCrosshair');
        } else if (this._crosshairRoot && this._crosshairRoot.isValid) {
            this._crosshairRoot.active = false;
        }
    }

    private _hoverTarget(): { fineX: number; fineY: number; isHorse: boolean; frameH: number } | null {
        const sim = this._sim;
        if (!sim || !this._hasHover) {
            return null;
        }
        const unit = sim.pickAt(this._hoverFineX, this._hoverFineY);
        if (unit && unit.alive) {
            return {
                fineX: unit.fineX + (unit.drawOffX ?? 0),
                fineY: unit.fineY + (unit.drawOffY ?? 0),
                isHorse: isHorseType(unit.type),
                frameH: visualFor(unit.type, false)?.frameH ?? 44,
            };
        }
        let best: { fineX: number; fineY: number; isHorse: boolean; frameH: number; dist: number } | null = null;
        for (const e of sim.enemies?.enemies ?? []) {
            if (!e.alive) {
                continue;
            }
            const dx = e.fineX - this._hoverFineX;
            const dy = e.fineY - this._hoverFineY;
            const dist = dx * dx + dy * dy;
            if (dist > 64 * 64) {
                continue;
            }
            if (!best || dist < best.dist) {
                best = {
                    fineX: e.fineX + (e.drawOffX ?? 0),
                    fineY: e.fineY + (e.drawOffY ?? 0),
                    isHorse: isHorseType(e.type),
                    frameH: visualFor(e.type, true, e.white)?.frameH ?? 44,
                    dist,
                };
            }
        }
        return best;
    }

    private _ensureHudOverlay(parent: Node, name: string): Node {
        let node = parent.getChildByName(name);
        if (node && node.isValid) {
            return node;
        }
        node = new Node(name);
        parent.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        node.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
        return node;
    }

    private _showCornerSet(
        parent: Node,
        kind: 'cursor' | 'selector',
        _old: Node | null,
        file: string,
        frames: readonly number[],
        fineX: number,
        fineY: number,
        rows: number,
        frameH = 0,
    ): void {
        const name = kind === 'cursor' ? 'HudCursor' : 'HudSelector';
        const root = this._ensureHudOverlay(parent, name);
        root.active = true;
        const world = fineToWorld(fineX, fineY, rows);
        // GameCursor_update.java：光标中心抬高半个当前帧高，围住人物而不是踩在脚点。
        root.setPosition(world.x, world.y + frameH / 2, 0);
        const sheet = this._sheets.get(file);
        const cornerW = sheet ? Math.trunc(sheet.width / 4) : 16;
        const cornerH = sheet?.height ?? 16;
        const dist = cursorCornerDistance(cornerW, kind === 'cursor' ? this._cursorAngle : this._cursorAngle);
        const offs = cursorCornerOffsets(dist);
        for (let i = 0; i < 4; i++) {
            const childName = `c${i}`;
            let child = root.getChildByName(childName);
            if (!child) {
                child = new Node(childName);
                root.addChild(child);
                child.layer = Layers.Enum.DEFAULT;
                child.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
                child.addComponent(Sprite);
            }
            const ut = child.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(cornerW, cornerH);
            }
            const sprite = child.getComponent(Sprite);
            if (sprite && sheet) {
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = this._sheetSubframe(sheet, frames[i] * cornerW, 0, cornerW, cornerH);
            }
            child.setPosition(offs[i].x, offs[i].y, 0);
        }
    }

    private _showCrosshair(parent: Node, fineX: number, fineY: number, rows: number, offset: number, frameH = 0): void {
        const root = this._ensureHudOverlay(parent, 'HudCrosshair');
        root.active = true;
        const world = fineToWorld(fineX, fineY, rows);
        // drawCrossHair：准星中心在脚点往上半个帧高。
        root.setPosition(world.x, world.y + frameH / 2, 0);
        const sheet = this._sheets.get(HUD_CROSSHAIR);
        const pieceW = sheet ? Math.trunc(sheet.width / 4) : 16;
        const pieceH = sheet?.height ?? 16;
        const places = [
            { x: 0, y: pieceH / 2 + offset },
            { x: 0, y: -(pieceH / 2 + offset) },
            { x: -(pieceW / 2 + offset), y: 0 },
            { x: pieceW / 2 + offset, y: 0 },
        ];
        for (let i = 0; i < 4; i++) {
            const childName = `p${i}`;
            let child = root.getChildByName(childName);
            if (!child) {
                child = new Node(childName);
                root.addChild(child);
                child.layer = Layers.Enum.DEFAULT;
                child.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
                child.addComponent(Sprite);
            }
            const ut = child.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(pieceW, pieceH);
            }
            const sprite = child.getComponent(Sprite);
            if (sprite && sheet) {
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = this._sheetSubframe(sheet, CROSSHAIR_FRAME_ORDER[i] * pieceW, 0, pieceW, pieceH);
            }
            child.setPosition(places[i].x, places[i].y, 0);
        }
    }
}


/** 第 0 行在地图最上沿。格子左下角的像素坐标。 */

function shopTitle(kind: string): string {
    if (kind === 'no-money' || kind === 'gamble-no-money') {
        return '钱不够';
    }
    if (kind === 'upgrade-confirm') {
        return '确认升级？';
    }
    if (kind === 'gamble-confirm') {
        return '确认下注？';
    }
    if (kind === 'gamble-not-ready' || kind === 'dynamite-not-ready') {
        return '还没好';
    }
    if (kind === 'gamble-cards') {
        return CARD_REVEAL_TITLE;
    }
    return '确认雇佣？';
}

function unitCodes(unit: { name?: string; code?: number; codes?: number[] }): number[] {
    if (unit.codes && unit.codes.length) {
        return unit.codes;
    }
    const code = unit.code;
    if (code === 10 || code === 11 || code === 20 || code === 21) {
        return [10, 11, 20, 21];
    }
    if (code === 12 || code === 22) {
        return [12, 22];
    }
    if (code === 30 || code === 31 || code === 33) {
        return [30, 31, 33];
    }
    if (code === 7 || code === 8) {
        return [7, 8];
    }
    if (typeof code === 'number' && Number.isFinite(code)) {
        return [code];
    }
    const name = unit.name ?? '';
    if (name === '火车') {
        return [10, 11, 20, 21];
    }
    if (name === '加特林') {
        return [12, 22];
    }
    if (name === '蒸汽船') {
        return [30, 31, 33];
    }
    if (name === '蒸汽船双炮') {
        return [32];
    }
    if (name === '炸药') {
        return [7, 8];
    }
    return [];
}

const ASSET_NAME_ALIASES: Record<string, string> = {
    sky_left: 'gng_startmenu_0_bg_0_sky_left',
    sky_right: 'gng_startmenu_0_bg_0_sky_right',
    sky_top: 'gng_startmenu_0_bg_0_sky_top',
    cloud_1: 'gng_startmenu_0_bg_1_cloud_1',
    cloud_2: 'gng_startmenu_0_bg_1_cloud_2',
    cloud_3: 'gng_startmenu_0_bg_1_cloud_3',
    gng_startmenu_3_bandit_4_head_1: 'gng_startmenu_3_bandit_4_head_1_angry_1',
    gng_startmenu_3_bandit_4_head_2: 'gng_startmenu_3_bandit_4_head_2_tic',
    gng_startmenu_3_bandit_6_hand_right: 'gng_startmenu_3_bandit_5_hand_right',
    gng_startmenu_3_bandit_6_hand_right_shoot: 'gng_startmenu_3_bandit_5_hand_right_shoot',
    gng_startmenu_3_bandit_7_smoke_1: 'gng_startmenu_3_bandit_6_smoke_1',
    gng_startmenu_3_bandit_7_smoke_2: 'gng_startmenu_3_bandit_6_smoke_2',
    gng_startmenu_3_bandit_7_smoke_3: 'gng_startmenu_3_bandit_6_smoke_3',
    gng_startmenu_3_bandit_7_smoke_4: 'gng_startmenu_3_bandit_6_smoke_4',
    gng_startmenu_3_bandit_7_smoke_5: 'gng_startmenu_3_bandit_6_smoke_5',
    gng_startmenu_3_bandit_7_smoke_6: 'gng_startmenu_3_bandit_6_smoke_6',
    gng_startmenu_3_bandit_7_smoke_7: 'gng_startmenu_3_bandit_6_smoke_7',
    gng_startmenu_3_bandit_7_smoke_8: 'gng_startmenu_3_bandit_6_smoke_8',
};

function assetPathCandidates(file: string): string[] {
    if (file.startsWith('tiles-shared/')) {
        return [file];
    }
    const slash = file.lastIndexOf('/');
    const name = slash >= 0 ? file.slice(slash + 1) : file;
    const alias = ASSET_NAME_ALIASES[name];
    const names = alias && alias !== name ? [alias, name] : [name];
    const paths: string[] = [];
    const add = (path: string): void => {
        if (path && paths.indexOf(path) < 0) {
            paths.push(path);
        }
    };
    add(file);
    for (const n of names) {
        if (n.startsWith('sfx_')) {
            add(`sprites/fx/${n}`);
        } else if (n.startsWith('hud_') || n.startsWith('gng_hud_')) {
            add(`ui/战斗界面/${n}`);
            add(`ui/其他/${n}`);
        } else if (n.startsWith('gng_startmenu_') || n.startsWith('gng_wd_startmenu_')) {
            add(`ui/主菜单/${n}`);
        } else if (n.startsWith('gng_tutorial_')) {
            add(`ui/教程/${n}`);
        } else if (n.startsWith('gng_levelmap_') || n.startsWith('gng_usmap_')) {
            add(`thumbs/${n}`);
            add(`ui/select/${n}`);
        } else if (n.startsWith('icons_')) {
            add(`ui/其他/${n}`);
            add(`sprites/enemies/${n}`);
            add(`ui/图标/${n}`);
        } else if (
            n.startsWith('gng_')
            || n === 'bonus_box'
            || n === 'cursor'
            || n === 'selector'
            || n === 'upgrade_icon'
        ) {
            add(`ui/其他/${n}`);
            add(`ui/战斗界面/${n}`);
            add(`ui/主菜单/${n}`);
        } else {
            add(`sprites/units/${n}`);
            add(`sprites/enemies/${n}`);
            add(`sprites/vehicles/${n}`);
            add(`sprites/buildings/${n}`);
            add(`sprites/decor/${n}`);
            add(`sprites/portraits/${n}`);
            add(`sprites/fx/${n}`);
            add(`ui/其他/${n}`);
            add(`ui/战斗界面/${n}`);
            add(`ui/主菜单/${n}`);
        }
        add(`sprites/${n}`);
        add(n);
    }
    return paths;
}

/** GameObjectManager.getValueByObject：fineY + drawingOffsetY + fineZ * 100。 */
function mapUnitDrawOrder(type: number, fineY: number): number {
    const drawingOffsetY = type === 7 || type === 8 || type === 9 ? 1920 : 0;
    const fineZ = type === 8 ? 0 : 7680;
    return fineY + drawingOffsetY + fineZ * 100;
}

function placedObjectDrawOrder(item: PlacedSprite): number {
    if (item.kind === 'decor') {
        return (item.row + 1) * 7680 + 7680 * 100;
    }
    if (item.kind === 'building') {
        return item.row * 7680 + 3840 + 1536 + 7680 * 100;
    }
    if (item.kind === 'dynamite') {
        return mapUnitDrawOrder(8, item.row * 7680 + 5760);
    }
    const drawingOffsetY = item.unitType >= 20 && item.unitType < 30
        ? 3840
        : item.unitType >= 10 && item.unitType < 20
            ? 1920
            : 0;
    return item.row * 7680 + 5760 + drawingOffsetY + 7680 * 100;
}

function tileBottomLeft(col: number, row: number, mapRows: number): { x: number; y: number } {
    return {
        x: col * TILE,
        y: (mapRows - 1 - row) * TILE,
    };
}

function clampTexture(tex: Texture2D): Texture2D {
    tex.packable = false;
    tex.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
    return tex;
}

function sheetFrom(asset: Asset): TileSheet {
    if (asset instanceof Texture2D) {
        const tex = clampTexture(asset);
        return { id: nextSheetId++, texture: tex, originX: 0, originY: 0, width: tex.width, height: tex.height };
    }
    if (asset instanceof SpriteFrame) {
        const tex = clampTexture(asset.texture as Texture2D);
        asset.packable = false;
        const r = asset.rect;
        return { id: nextSheetId++, texture: tex, originX: r.x, originY: r.y, width: r.width, height: r.height };
    }
    if (asset instanceof ImageAsset) {
        const tex = new Texture2D();
        tex.image = asset;
        clampTexture(tex);
        return { id: nextSheetId++, texture: tex, originX: 0, originY: 0, width: tex.width, height: tex.height };
    }
    const anyA = asset as any;
    if (anyA.spriteFrame instanceof SpriteFrame) {
        return sheetFrom(anyA.spriteFrame);
    }
    if (anyA.texture instanceof Texture2D) {
        return sheetFrom(anyA.texture);
    }
    throw new Error(`[Terrain] 不是图片 ${asset?.name ?? ''} ${asset?.constructor?.name ?? ''}`);
}
