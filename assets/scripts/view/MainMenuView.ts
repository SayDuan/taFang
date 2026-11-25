/**
 * 第 20–21 步主菜单、帮助、设置、选区和选关。挂在 Canvas 下运行，不作为世界节点的子节点。
 * 开始进入选区，不跳过菜单，也不按 PLAY_LEVEL 直接进战斗。
 */
import {
    _decorator,
    Asset,
    Button,
    Color,
    Component,
    Graphics,
    ImageAsset,
    Label,
    Layers,
    Mask,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    tween,
    UITransform,
    Vec3,
    Widget,
    sys,
    view,
} from 'cc';
import { loadAsset, loadBundle, loadBytes } from '../data/AssetBytes';
import { getDesignSize } from '../platform/DisplayConfig';
import {
    ANGRY_FRAMES,
    CLOUD_NAMES,
    CLOUD_SPEED_RANDOM_SPAN,
    CLOUD_WRAP_EXTRA_MAX,
    CloudState,
    HELP_PAGE_LAYOUTS,
    INTRO_FRAMES,
    CLOUD_SIZES,
    MENU_BASE_HEIGHT,
    MENU_BASE_WIDTH,
    MENU_LEFT_COLUMN_WIDTH,
    MENU_RIGHT_COLUMN_WIDTH,
    MENU_SCREEN,
    MenuScreen,
    PORTRAIT_IMAGE_NAMES,
    PORTRAIT_LAYER,
    SHAKE_FRAMES,
    SHOOT_FRAMES,
    SKY_CENTER,
    SKY_LEFT,
    SKY_RIGHT,
    SKY_TOP,
    createCloud,
    createPortraitState,
    currentPortraitFrame,
    helpLayout,
    menuBand,
    navigateHelp,
    packedDip,
    portraitLayerIndices,
    skyLayout,
    tickCloud,
    tickPortrait,
    type ContentBand,
    type PortraitState,
    type SkyPiece,
} from '../sim/MainMenuModel';
import { MenuSettings, createMenuSettings } from '../sim/MenuSettings';
import {
    BUTTON_SFX,
    clickThenToggleSound,
    playSfx,
} from '../sim/Sound';
import { playLevelMusic, playMenuMusic } from '../sim/SoundEvents';
import { installGameAudio } from './GameAudio';
import { campaignProgress } from '../sim/CampaignProgress';
import {
    CONTINUE_TIP,
    LEVEL_BUTTON_LAYOUT,
    LEVEL_THUMB_HEIGHT_DIP,
    LEVEL_THUMB_WIDTH_DIP,
    LOCKED_LEVEL_TIP,
    REGION_CROSS_SIZE_DIP,
    REGION_DEFS,
    REGION_TIP_TEXT,
    SELECT_LAYOUT_HEIGHT,
    SELECT_LAYOUT_WIDTH,
    confirmRegionTip,
    continueMidSave,
    declineContinuePrompt,
    isLevelButtonOpen,
    levelThumbnailName,
    levelsOfRegion,
    onLevelClick,
    onRegionClick,
    regionIndex,
    startFromSelect,
    topLeftDipToCenter,
    type RegionDef,
} from '../sim/LevelSelect';
import { SaveSession, createLocalStore } from '../sim/SaveGame';
import { highScores } from '../sim/Difficulty';
import { officialLevelInfo, officialLevelName, officialString } from '../sim/OfficialStrings';
import { argbToRgba, minimapTileColor } from '../sim/BattleHud';
import { mapNameForLevel } from '../sim/CampaignLevel';
import { MapGrid } from '../data/MapData';
import { buildTerrain } from './terrain/TerrainBuild';

const { ccclass } = _decorator;

export interface MainMenuAttachOptions {
    playLevel: number;
    onEnterBattle: (level: number, options?: { resume?: boolean }) => void | Promise<void>;
    onRegionSelect?: () => void;
    vibraSupported?: boolean;
}


const UI_LOGO = 'gng_startmenu_1_logo';
const UI_MENU_BOX = 'gng_startmenu_2_menu_0_box';
const UI_MENU_BUTTON = 'gng_startmenu_2_menu_1_button';
const UI_MENU_BUTTON_PRESSED = 'gng_startmenu_2_menu_1_button_pressed';
const UI_MENU_BUTTON_SELECTED = 'gng_startmenu_2_menu_1_button_selected';
const UI_MENU_BUTTON_SELECTED_PRESSED = 'gng_startmenu_2_menu_1_button_selected_pressed';
const UI_SOUND_ON_NAMES = [
    'gng_startmenu_2_menu_2_sound_on',
    'gng_startmenu_2_sound_on',
    'gng_startmenu_sound_on',
];
const UI_SOUND_OFF_NAMES = [
    'gng_startmenu_2_menu_2_sound_off',
    'gng_startmenu_2_sound_off',
    'gng_startmenu_sound_off',
];
const UI_SOUND_ON_PRESSED_NAMES = [
    'gng_startmenu_2_menu_2_sound_on_pressed',
    'gng_startmenu_2_sound_on_pressed',
];
const UI_SOUND_OFF_PRESSED_NAMES = [
    'gng_startmenu_2_menu_2_sound_off_pressed',
    'gng_startmenu_2_sound_off_pressed',
];
const UI_TEXTBOX_LARGE = 'gng_hud_2_textbox_large';
const UI_TEXTBOX_SMALL = 'gng_hud_2_textbox_small';
const UI_YES = 'gng_hud_2_yes';
const UI_YES_PRESSED = 'gng_hud_2_yes_pressed';
const UI_NO = 'gng_hud_2_no';
const UI_NO_PRESSED = 'gng_hud_2_no_pressed';
const UI_HIGHSCORE_BOX = 'gng_highscore_0_box';
const UI_HIGHSCORE_BUTTON = 'gng_highscore_2_button';
const UI_HIGHSCORE_BUTTON_PRESSED = 'gng_highscore_2_button_pressed';
const UI_LEFT = 'left_button';
const UI_LEFT_PRESSED = 'left_button_pressed';
const UI_RIGHT = 'right_button';
const UI_RIGHT_PRESSED = 'right_button_pressed';
const UI_PORTRAIT_BOX = 'gng_startmenu_3_bandit_0_box';
const UI_SETTINGS_VIBRA_ON = 'settings_vibra_on';
const UI_SETTINGS_VIBRA_OFF = 'settings_vibra_off';
const UI_SETTINGS_BACKLIGHT_ON = 'settings_backlight_on';
const UI_SETTINGS_BACKLIGHT_OFF = 'settings_backlight_off';
const UI_USMAP_BOX = 'gng_usmap_00_box';
const UI_USMAP_CROSS = 'gng_usmap_cross';
const UI_LEVELMAP_BOX = 'gng_levelmap_box_00';
const UI_HIGHSCORE_WANTED = 'gng_highscore_1_wanted';
const UI_TUTORIAL_BOX = 'gng_tutorial_0_box';
const UI_LVL_LOCKED = 'lvl_locked';
const UI_HELP_PAGE_IMAGES: readonly (readonly string[])[] = [
    [],
    ['gng_tutorial_1_buying', 'gng_tutorial_2_moving'],
    ['gng_tutorial_3_scrolling', 'gng_tutorial_6_aiming_manual'],
    [],
];
const HELP_IMAGE_SIZE = { w: 153, h: 152 };
const HELP_ITEM_PADDING = 10;
const HELP_TABLE_PADDING = 55;
const DIALOG_SMALL_WIDTH = 384;
const DIALOG_SMALL_HEIGHT = 128;
const DIALOG_LARGE_WIDTH = 384;
const DIALOG_LARGE_HEIGHT = 192;
const LEVEL_OVERVIEW_WIDTH = 480;
const LEVEL_OVERVIEW_HEIGHT = 320;
const DIALOG_LEFT_BUTTON_MARGIN_LEFT = 20;
const DIALOG_RIGHT_BUTTON_MARGIN_RIGHT = 20;
const DIALOG_BUTTON_MARGIN_BOTTOM = 25;
const MAIN_MENU_BUTTON_AREA_MARGIN_TOP = 37;
const MAIN_MENU_SOUND_MARGIN_TOP = packedDip(16777188);
const MAIN_MENU_SOUND_MARGIN_RIGHT = 3;
const MENU_BUTTON_WIDTH = 212;
const MENU_BUTTON_HEIGHT = 52;
const SOUND_BUTTON_WIDTH = 107;
const SOUND_BUTTON_HEIGHT = 60;
const YES_NO_SIZE = 32;
const LOCK_ICON_SIZE = 44;
const NAV_BUTTON_SIZE = 36;
const SETTINGS_ICON_SIZE = 32;
const LOGO_WIDTH = 254;
const LOGO_HEIGHT = 110;
const MENU_BOX_WIDTH = 182;
const MENU_BOX_HEIGHT = 252;
const PORTRAIT_BOX_WIDTH = 230;
const PORTRAIT_BOX_HEIGHT = 216;
const ANIM_PORTRAIT_SIZE = 250;
const LEVEL_OVERVIEW_PLAY_MARGIN_LEFT = 306;
const LEVEL_OVERVIEW_PLAY_MARGIN_TOP = 221;
const LEVEL_OVERVIEW_BACK_MARGIN_LEFT = 23;
const LEVEL_OVERVIEW_BACK_MARGIN_TOP = 275;
const LEVEL_OVERVIEW_HEADING_MARGIN_LEFT = 52;
const LEVEL_OVERVIEW_HEADING_MARGIN_TOP = 47;
const LEVEL_OVERVIEW_DESC_WIDTH = 213;
const LEVEL_OVERVIEW_DESC_HEIGHT = 111;
const LEVEL_OVERVIEW_IMAGES_MIN_HEIGHT = 75;
const LEVEL_OVERVIEW_IMAGES_MARGIN_TOP = 68;
const LEVEL_OVERVIEW_DESC_MARGIN_TOP = 152;
const MINIMAP_PREVIEW_WIDTH = 66;
const MINIMAP_PREVIEW_HEIGHT = 50;
const LEVEL_OVERVIEW_HIGHSCORE_IMAGE_MARGIN_LEFT = 318;
const LEVEL_OVERVIEW_HIGHSCORE_IMAGE_MARGIN_TOP = 49;
const LEVEL_OVERVIEW_HIGHSCORE_TEXT_MARGIN_LEFT = 314;
const LEVEL_OVERVIEW_HIGHSCORE_TEXT_WIDTH = 120;
const LEVEL_OVERVIEW_NO_HIGHSCORE_HEIGHT = 160;
const LEVEL_OVERVIEW_WANTED_WIDTH = 108;
const LEVEL_OVERVIEW_WANTED_HEIGHT = 91;
const LEVEL_OVERVIEW_PLAY_WIDTH = 134;
const LEVEL_OVERVIEW_PLAY_HEIGHT = 70;
// mapscreen_font_size 6dip 再乘 customScale，实测州名约 4 字 78dip（每字约 20dip）；
// 州名中心在十字中心上方约 36dip（视图顶 = yDip-48.7，文字高约 24.7）。
const REGION_LABEL_FONT = 20;
const REGION_LABEL_OFFSET_ABOVE = 36;
// w/h 已按工程里 mdpi PNG 原尺寸核对：通缉纸 132×132、破洞 162×136、身体 92×44、
// 头 128×118、左手 102×124、右手 90×118、烟 152×206。x/y 是官方 250×250 里的左上角偏移，不改。
const PORTRAIT_LAYER_DEFS = [
    { w: 132, h: 132, x: 0, y: 52 },
    { w: 162, h: 136, x: 0, y: 50 },
    { w: 92, h: 44, x: 0, y: 109 },
    { w: 128, h: 118, x: 0, y: 8 },
    { w: 102, h: 124, x: 0, y: 12 },
    { w: 90, h: 118, x: packedDip(16777208), y: 30 },
    { w: 152, h: 206, x: 0, y: 0 },
] as const;

function allUiArtNames(): string[] {
    const names = [
        UI_MENU_BOX,
        UI_MENU_BUTTON,
        UI_MENU_BUTTON_PRESSED,
        UI_MENU_BUTTON_SELECTED,
        UI_MENU_BUTTON_SELECTED_PRESSED,
        UI_TEXTBOX_LARGE,
        UI_TEXTBOX_SMALL,
        UI_YES,
        UI_YES_PRESSED,
        UI_NO,
        UI_NO_PRESSED,
        UI_HIGHSCORE_BOX,
        UI_HIGHSCORE_BUTTON,
        UI_HIGHSCORE_BUTTON_PRESSED,
        UI_LEFT,
        UI_LEFT_PRESSED,
        UI_RIGHT,
        UI_RIGHT_PRESSED,
        UI_PORTRAIT_BOX,
        UI_SETTINGS_VIBRA_ON,
        UI_SETTINGS_VIBRA_OFF,
        UI_SETTINGS_BACKLIGHT_ON,
        UI_SETTINGS_BACKLIGHT_OFF,
        UI_USMAP_BOX,
        UI_USMAP_CROSS,
        UI_LEVELMAP_BOX,
        UI_HIGHSCORE_WANTED,
        UI_TUTORIAL_BOX,
        UI_LOGO,
        UI_LVL_LOCKED,
        ...UI_SOUND_ON_NAMES,
        ...UI_SOUND_OFF_NAMES,
        ...UI_SOUND_ON_PRESSED_NAMES,
        ...UI_SOUND_OFF_PRESSED_NAMES,
    ];
    for (const page of UI_HELP_PAGE_IMAGES) {
        names.push(...page);
    }
    return names;
}

const LAYER_COLORS = [
    new Color(180, 140, 80, 255),
    new Color(40, 40, 40, 255),
    new Color(90, 70, 50, 255),
    new Color(210, 170, 120, 255),
    new Color(80, 60, 40, 255),
    new Color(80, 60, 40, 255),
    new Color(220, 220, 220, 180),
];

/**
 * 把主菜单挂到 Canvas 节点上。Boot.ts 只需在 onLoad 里调用这个函数，不必改 Boot.scene。
 */
export function attachMainMenu(canvasNode: Node, options: MainMenuAttachOptions): MainMenuView {
    let host = canvasNode.getChildByName('MainMenuRoot');
    if (!host) {
        host = new Node('MainMenuRoot');
        host.layer = Layers.Enum.UI_2D;
        canvasNode.addChild(host);
    }
    const view = host.getComponent(MainMenuView) ?? host.addComponent(MainMenuView);
    view.configure(options);
    return view;
}

@ccclass('MainMenuView')
export class MainMenuView extends Component {
    private _playLevel = 1;
    private _onEnterBattle: ((level: number, options?: { resume?: boolean }) => void | Promise<void>) | null = null;
    private _onRegionSelect: (() => void) | null = null;
    private _settings: MenuSettings | null = null;
    private _screen: MenuScreen = MENU_SCREEN.main;
    private _helpPage = 0;
    private _portrait: PortraitState = createPortraitState();
    private _clouds: CloudState[] = [];
    private _cloudNodes: Node[] = [];
    private _layerNodes: Node[] = [];
    private _frames = new Map<string, SpriteFrame>();
    private _screenSize = { width: MENU_BASE_WIDTH, height: MENU_BASE_HEIGHT };
    private _density = 1;
    private _built = false;
    private _helpRoot: Node | null = null;
    private _helpLabel: Label | null = null;
    private _optionsRoot: Node | null = null;
    private _regionRoot: Node | null = null;
    private _levelRoot: Node | null = null;
    private _dialogRoot: Node | null = null;
    private _levelButtons: Node[] = [];
    private _selectRegion = 0;
    private _saves: SaveSession | null = null;
    private _soundLabel: Label | null = null;
    private _optionLabels: Label[] = [];
    private _skyImageScale = 1;
    /** 天空与云的裁剪层，尺寸=设计框，防止天空溢出画到长边留空区。 */
    private _skyLayer: Node | null = null;
    private _helpArt: Node | null = null;
    private _helpArt2: Node | null = null;
    private _soundButton: Node | null = null;
    private _chrome: Node | null = null;
    private _band: ContentBand = menuBand();
    /** 主体内容容器：640x360 逻辑带，按屏幕短边等比缩放居中。对话框等全屏覆盖层留在 this.node 上不缩放。 */
    private _body: Node | null = null;

    configure(options: MainMenuAttachOptions): void {
        this._playLevel = options.playLevel;
        this._onEnterBattle = options.onEnterBattle;
        this._onRegionSelect = options.onRegionSelect ?? null;
        const store = createLocalStore(sys.localStorage as unknown as {
            getItem(k: string): string | null;
            setItem(k: string, v: string): void;
            removeItem(k: string): void;
        });
        this._saves = new SaveSession(store);
        this._saves.hydrate(campaignProgress);
        this._settings = createMenuSettings(store, {
            vibraSupported: options.vibraSupported ?? true,
        });
        if (this._built) {
            this._syncSoundButton();
            this._showScreen(MENU_SCREEN.main);
        }
        playMenuMusic();
    }

    onLoad(): void {
        if (!this._built) {
            void this._build();
        }
    }

    update(dt: number): void {
        if (!this._built) {
            return;
        }
        const dtMs = dt * 1000;
        if (this._screen === MENU_SCREEN.main) {
            this._portrait = tickPortrait(this._portrait, dtMs);
            this._syncPortraitLayers();
        }
        // template_background.xml 的 MenuBackground 在主菜单/帮助/选区/选关都在，onDraw 每帧 invalidate，云一直飘。
        const width = this._skyScreen().width;
        for (let i = 0; i < this._clouds.length; i++) {
            this._clouds[i] = tickCloud(
                this._clouds[i],
                dtMs,
                width,
                Math.random() * CLOUD_WRAP_EXTRA_MAX,
                Math.floor(Math.random() * CLOUD_SPEED_RANDOM_SPAN),
            );
            this._placeCloud(i);
        }
    }

    private async _build(): Promise<void> {
        installGameAudio();
        const size = getDesignSize();
        this._screenSize = { width: size.width, height: size.height };
        this._density = 1;
        this._band = menuBand();
        this._fitRoot();
        await this._loadArt();
        this._drawSky();
        this._spawnClouds();
        this._drawPortrait();
        this._drawButtons();
        this._drawHelp();
        this._drawOptions();
        this._drawRegionSelect();
        this._drawLevelSelect();
        // _build 期间创建的都是主体内容（天空/云/肖像/按钮/各界面），统一收进 _body 后按短边缩放。
        // 之后动态创建的对话框/遮罩走 _overlay，仍挂 this.node，保持全屏不缩放。
        if (this._body) {
            for (const child of [...this.node.children]) {
                if (child === this._body) {
                    continue;
                }
                this._body.addChild(child);
            }
            this._applyBodyScale();
        }
        this._built = true;
        this._showScreen(MENU_SCREEN.main);
        this._syncSoundButton();
        if (!this._settings) {
            this._settings = createMenuSettings(createLocalStore(), { vibraSupported: true });
        }
        playMenuMusic();
    }

    private _fitRoot(): void {
        const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        ut.setContentSize(this._screenSize.width, this._screenSize.height);
        ut.setAnchorPoint(0.5, 0.5);
        this.node.layer = Layers.Enum.UI_2D;
        this.node.setPosition(0, 0, 0);
        const widget = this.node.getComponent(Widget) ?? this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        if (!this._body || !this._body.isValid) {
            const body = new Node('MenuBody');
            body.layer = Layers.Enum.UI_2D;
            this.node.addChild(body);
            const but = body.addComponent(UITransform);
            but.setContentSize(this._band.width, this._band.height);
            but.setAnchorPoint(0.5, 0.5);
            body.setPosition(0, 0, 0);
            this._body = body;
        }
    }

    /** 主体带按显示器短边等比缩放：短边填满，长边居中留空。缩放只看 640x360 主体，不计入浮动到主体外的云。 */
    private _applyBodyScale(): void {
        const body = this._body;
        if (!body) {
            return;
        }
        const scale = this._bodyScaleValue();
        if (scale > 0) {
            body.setScale(scale, scale, 1);
        }
    }

    private async _loadArt(): Promise<void> {
        const names = [
            SKY_CENTER,
            SKY_LEFT,
            SKY_RIGHT,
            SKY_TOP,
            ...CLOUD_NAMES,
            ...PORTRAIT_IMAGE_NAMES,
            ...allUiArtNames(),
        ];
        try {
            const base = await loadBundle('base');
            for (const name of names) {
                const loaded = await this._tryLoad(base, name);
                if (loaded) {
                    this._frames.set(name, loaded);
                }
            }
        } catch (err) {
            console.warn('[Menu] 主菜单图集暂不可用，改用色块', err);
        }
    }

    private async _tryLoad(bundle: { load: Function }, name: string): Promise<SpriteFrame | null> {
        const aliases: Record<string, string> = {
            sky_left: 'gng_startmenu_0_bg_0_sky_left',
            sky_right: 'gng_startmenu_0_bg_0_sky_right',
            sky_top: 'gng_startmenu_0_bg_0_sky_top',
            cloud_1: 'gng_startmenu_0_bg_1_cloud_1',
            cloud_2: 'gng_startmenu_0_bg_1_cloud_2',
            cloud_3: 'gng_startmenu_0_bg_1_cloud_3',
        };
        const resolved = aliases[name] ?? name;
        const candidates = [
            `ui/主菜单/${resolved}`,
            `ui/其他/${resolved}`,
            `ui/战斗界面/${resolved}`,
            `ui/select/${resolved}`,
            `ui/教程/${resolved}`,
            `thumbs/${resolved}`,
            `sprites/portraits/${resolved}`,
            `sprites/${resolved}`,
            resolved,
            `ui/主菜单/${name}`,
            `thumbs/${name}`,
            name,
        ];
        for (const path of candidates) {
            try {
                const asset = await loadAsset(bundle as never, path);
                return this._toFrame(asset);
            } catch {
                // 试下一个路径
            }
        }
        return null;
    }

    private _toFrame(asset: Asset): SpriteFrame {
        if (asset instanceof SpriteFrame) {
            return asset;
        }
        if (asset instanceof ImageAsset) {
            const tex = new Texture2D();
            tex.image = asset;
            tex.packable = false;
            const sf = new SpriteFrame();
            sf.texture = tex;
            return sf;
        }
        const anyA = asset as unknown as { spriteFrame?: SpriteFrame; texture?: Texture2D };
        if (anyA.spriteFrame instanceof SpriteFrame) {
            return anyA.spriteFrame;
        }
        if (anyA.texture instanceof Texture2D) {
            const sf = new SpriteFrame();
            sf.texture = anyA.texture;
            return sf;
        }
        throw new Error(`[Menu] 不是图片 ${asset?.name ?? ''}`);
    }

    private _frame(...names: string[]): SpriteFrame | null {
        for (const name of names) {
            const sf = this._frames.get(name);
            if (sf) {
                return sf;
            }
        }
        return null;
    }

    /**
     * 原版取的是 getIntrinsicWidth/Height，即 PNG 未裁剪的原始像素。
     * SpriteFrame.width 是贴图宽度（动态合图后是 2048 图集宽），不能用；
     * originalSize 才是导入时的原始尺寸，rect 是裁剪后的区域。
     */
    private _frameSize(sf: SpriteFrame, fallbackW: number, fallbackH: number): { w: number; h: number } {
        const w = sf.originalSize?.width || sf.rect?.width || fallbackW;
        const h = sf.originalSize?.height || sf.rect?.height || fallbackH;
        return { w, h };
    }

    private _applySprite(bg: Node, frame: SpriteFrame | null, w: number, h: number, fallback: Color): void {
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

    private _wirePressed(node: Node, normal: SpriteFrame, pressed: SpriteFrame): void {
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

    private _kindForButton(text: string): 'yes' | 'no' | 'navLeft' | 'navRight' | 'menu' | 'play' {
        if (text === '向左' || text === '返回') {
            return 'navLeft';
        }
        if (text === '向右') {
            return 'navRight';
        }
        if (text === '取消' || text === '不了' || text === '关闭') {
            return 'no';
        }
        if (text === '确定' || text === '继续' || text === '好的' || text === '写下纪录' || text === '重试') {
            return 'yes';
        }
        return 'menu';
    }

    private _artForButton(text: string): { normal: SpriteFrame | null; pressed: SpriteFrame | null } {
        const kind = this._kindForButton(text);
        if (kind === 'yes') {
            return { normal: this._frame(UI_YES), pressed: this._frame(UI_YES_PRESSED) };
        }
        if (kind === 'no') {
            return { normal: this._frame(UI_NO), pressed: this._frame(UI_NO_PRESSED) };
        }
        if (kind === 'navLeft') {
            return { normal: this._frame(UI_LEFT), pressed: this._frame(UI_LEFT_PRESSED) };
        }
        if (kind === 'navRight') {
            return { normal: this._frame(UI_RIGHT), pressed: this._frame(UI_RIGHT_PRESSED) };
        }
        if (kind === 'play') {
            return { normal: this._frame(UI_HIGHSCORE_BUTTON, UI_MENU_BUTTON), pressed: this._frame(UI_HIGHSCORE_BUTTON_PRESSED, UI_MENU_BUTTON_PRESSED) };
        }
        return { normal: this._frame(UI_MENU_BUTTON), pressed: this._frame(UI_MENU_BUTTON_PRESSED) };
    }

    private _officialButtonSize(text: string, fallbackW: number, fallbackH: number): { w: number; h: number } {
        const kind = this._kindForButton(text);
        if (kind === 'yes' || kind === 'no') {
            return { w: YES_NO_SIZE, h: YES_NO_SIZE };
        }
        if (kind === 'navLeft' || kind === 'navRight') {
            return { w: NAV_BUTTON_SIZE, h: NAV_BUTTON_SIZE };
        }
        if (kind === 'menu') {
            return { w: MENU_BUTTON_WIDTH, h: MENU_BUTTON_HEIGHT };
        }
        const art = this._artForButton(text);
        if (art.normal) {
            return this._frameSize(art.normal, fallbackW, fallbackH);
        }
        return { w: fallbackW, h: fallbackH };
    }

    private _yesNoCenter(dialogW: number, dialogH: number, which: 'yes' | 'no'): { x: number; y: number } {
        const y = -dialogH / 2 + DIALOG_BUTTON_MARGIN_BOTTOM + YES_NO_SIZE / 2;
        if (which === 'yes') {
            return { x: -dialogW / 2 + DIALOG_LEFT_BUTTON_MARGIN_LEFT + YES_NO_SIZE / 2, y };
        }
        return { x: dialogW / 2 - DIALOG_RIGHT_BUTTON_MARGIN_RIGHT - YES_NO_SIZE / 2, y };
    }


    /**
     * MenuBackground.onMeasure 的布局复刻：中心带贴屏幕底边、左右条同高紧贴中心带两侧、
     * 顶条压在中心带上方，scale 取两轴大者（≥1）。原版传的是真实屏幕尺寸，会连长边一起铺满；
     * 本项目按用户适配方案把「屏幕」定为设计框 menuBand 640×360，_body 再按短边整体缩放，
     * 天空只铺设计框，长边留空区不做处理。坐标用 _body 的局部单位，等价原版的 dip。
     */
    private _drawSky(): void {
        const screen = this._skyScreen();
        // 天空与云套一层设计框大的裁剪矩形：skyLayout 的左右/顶条会略超出设计框，
        // 超出部分裁掉，不画进长边留空区。
        const layer = this._skyLayerNode(screen.width, screen.height);
        const sky = skyLayout(screen.width, screen.height);
        this._skyImageScale = sky.imageScale;
        const pieces: Array<{ piece: SkyPiece; name: string; art: string; color: Color }> = [
            { piece: sky.center, name: 'SkyCenter', art: SKY_CENTER, color: new Color(90, 160, 210, 255) },
        ];
        if (sky.left) {
            pieces.push({ piece: sky.left, name: 'SkyLeft', art: SKY_LEFT, color: new Color(80, 150, 200, 255) });
        }
        if (sky.right) {
            pieces.push({ piece: sky.right, name: 'SkyRight', art: SKY_RIGHT, color: new Color(80, 150, 200, 255) });
        }
        if (sky.top) {
            pieces.push({ piece: sky.top, name: 'SkyTop', art: SKY_TOP, color: new Color(70, 140, 200, 255) });
        }
        for (const item of pieces) {
            const piece = item.piece;
            this._spriteOrColor(item.name, item.art, piece.x, piece.y, piece.width, piece.height, item.color, layer);
        }
    }

    /** 天空与云共用的裁剪层：尺寸=设计框在 _body 局部单位下的大小，GraphicsRect 裁剪。 */
    private _skyLayerNode(width: number, height: number): Node {
        const old = this._skyLayer;
        if (old && old.isValid) {
            old.destroy();
        }
        const layer = new Node('SkyLayer');
        layer.layer = Layers.Enum.UI_2D;
        this.node.addChild(layer);
        const ut = layer.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        ut.setContentSize(width, height);
        layer.setPosition(0, 0, 0);
        const mask = layer.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        this._skyLayer = layer;
        return layer;
    }

    /**
     * 天空与云共用的逻辑屏幕尺寸 = 设计框 menuBand 640×360。
     * 原版 MenuBackground 用真实 dm.widthPixels/heightPixels 做 cover，长边也会铺满；
     * 本项目适配方案是按设计框短边铺满、长边不做处理，_body 已整体按短边缩放，
     * 所以这里直接返回设计框尺寸，天空不再按真实屏幕长边放大。
     */
    private _skyScreen(): { width: number; height: number } {
        return { width: this._band.width, height: this._band.height };
    }

    /** _body 的等比缩放：按设计框短边铺满，长边居中留空，天空和云按这个缩换算到 _body 单位。 */
    private _bodyScaleValue(): number {
        return Math.min(this._screenSize.width / this._band.width, this._screenSize.height / this._band.height);
    }

    private _spawnClouds(): void {
        const width = this._skyScreen().width;
        const density = this._density;
        this._clouds = [];
        this._cloudNodes = [];
        for (let i = 0; i < 3; i++) {
            const official = CLOUD_SIZES[i] ?? CLOUD_SIZES[0];
            const size = { w: official.width, h: official.height };
            const startLeft = Math.random() * width;
            const cloud = createCloud(i, width, density, startLeft, Math.floor(Math.random() * CLOUD_SPEED_RANDOM_SPAN), size.w, size.h, this._skyImageScale);
            this._clouds.push(cloud);
            const node = this._spriteOrColor(`Cloud${i + 1}`, CLOUD_NAMES[i], 0, 0, cloud.width, cloud.height, new Color(255, 255, 255, 230), this._skyLayer ?? this.node);
            this._cloudNodes.push(node);
            this._placeCloud(i);
        }
    }

    private _placeCloud(index: number): void {
        const cloud = this._clouds[index];
        const node = this._cloudNodes[index];
        if (!cloud || !node) {
            return;
        }
        // 原版 RectF 在整屏坐标里：left 从屏左 0 起算，top = R.dimen.ls_cloud_0N_margin_top（离屏顶的 dip）。
        const screen = this._skyScreen();
        const x = cloud.left + cloud.width * cloud.imageScale / 2 - screen.width / 2;
        const y = screen.height / 2 - cloud.top - cloud.height / 2;
        node.setPosition(x, y, 0);
    }

    /**
     * MainMenuAnimatedPortrait.setDrawingBounds 的逐层规则：
     * 通缉纸/洞/身体/头/烟 居中 (250-w)/2+offsetX，左手贴左 offsetX，右手贴右 (250-w)+offsetX，top 就是 offsetY。
     * 这里换算成以 250×250 中心为原点、Y 向上的 Cocos 坐标。
     */
    private _portraitLayerCenter(index: number, width: number, height: number): { x: number; y: number } {
        const def = PORTRAIT_LAYER_DEFS[index] ?? PORTRAIT_LAYER_DEFS[0];
        let left = (ANIM_PORTRAIT_SIZE - width) / 2 + def.x;
        if (index === PORTRAIT_LAYER.leftHand) {
            left = def.x;
        } else if (index === PORTRAIT_LAYER.rightHand) {
            left = ANIM_PORTRAIT_SIZE - width + def.x;
        }
        return {
            x: left + width / 2 - ANIM_PORTRAIT_SIZE / 2,
            y: ANIM_PORTRAIT_SIZE / 2 - def.y - height / 2,
        };
    }

    private _drawPortrait(): void {
        const band = this._band;
        const chrome = this._ensureChrome();
        const leftX = band.left + MENU_LEFT_COLUMN_WIDTH / 2;
        const boxFrame = this._frame(UI_PORTRAIT_BOX);
        const boxSize = { w: PORTRAIT_BOX_WIDTH, h: PORTRAIT_BOX_HEIGHT };
        this._spriteOn(chrome, 'PortraitBox', boxFrame, leftX, band.bottom + boxSize.h / 2, boxSize.w, boxSize.h, new Color(40, 28, 16, 220));
        const logoFrame = this._frame(UI_LOGO);
        const logoSize = { w: LOGO_WIDTH, h: LOGO_HEIGHT };
        const logoY = band.bottom + boxSize.h + logoSize.h / 2;
        this._spriteOn(chrome, 'MenuLogo', logoFrame, leftX, logoY, logoSize.w, logoSize.h, new Color(200, 180, 80, 255));
        const box = new Node('Portrait');
        box.layer = Layers.Enum.UI_2D;
        chrome.addChild(box);
        const ut = box.addComponent(UITransform);
        ut.setContentSize(ANIM_PORTRAIT_SIZE, ANIM_PORTRAIT_SIZE);
        ut.setAnchorPoint(0.5, 0.5);
        box.setPosition(leftX, band.bottom + ANIM_PORTRAIT_SIZE / 2, 0);
        this._layerNodes = [];
        for (let i = 0; i < PORTRAIT_LAYER_DEFS.length; i++) {
            const def = PORTRAIT_LAYER_DEFS[i];
            const layer = new Node(`PortraitLayer${i}`);
            layer.layer = Layers.Enum.UI_2D;
            box.addChild(layer);
            const lut = layer.addComponent(UITransform);
            lut.setContentSize(def.w, def.h);
            lut.setAnchorPoint(0.5, 0.5);
            const at = this._portraitLayerCenter(i, def.w, def.h);
            layer.setPosition(at.x, at.y, 0);
            const sprite = layer.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = LAYER_COLORS[i];
            this._layerNodes.push(layer);
        }
        this._syncPortraitLayers();
    }

    private _ensureChrome(): Node {
        if (this._chrome && this._chrome.isValid) {
            return this._chrome;
        }
        const chrome = new Node('MainChrome');
        chrome.layer = Layers.Enum.UI_2D;
        this.node.addChild(chrome);
        this._chrome = chrome;
        return chrome;
    }

    private _spriteOn(parent: Node, name: string, frame: SpriteFrame | null, x: number, y: number, w: number, h: number, fallback: Color): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        this._applySprite(node, frame, w, h, fallback);
        return node;
    }

    private _syncPortraitLayers(): void {
        const frame = currentPortraitFrame(this._portrait);
        const indices = portraitLayerIndices(frame);
        for (let i = 0; i < this._layerNodes.length; i++) {
            const node = this._layerNodes[i];
            const id = indices[i];
            if (id < 0) {
                node.active = false;
                continue;
            }
            node.active = true;
            const sprite = node.getComponent(Sprite);
            if (!sprite) {
                continue;
            }
            const name = PORTRAIT_IMAGE_NAMES[id];
            const sf = name ? this._frames.get(name) : undefined;
            if (sf) {
                const def = PORTRAIT_LAYER_DEFS[i];
                const natural = this._frameSize(sf, def.w, def.h);
                const lut = node.getComponent(UITransform);
                if (lut) {
                    lut.setContentSize(natural.w, natural.h);
                    const at = this._portraitLayerCenter(i, natural.w, natural.h);
                    node.setPosition(at.x, at.y, 0);
                }
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = sf;
                sprite.color = Color.WHITE;
            } else {
                sprite.color = LAYER_COLORS[i];
            }
            void PORTRAIT_LAYER.poster;
            void INTRO_FRAMES;
            void SHOOT_FRAMES;
            void ANGRY_FRAMES;
            void SHAKE_FRAMES;
        }
    }

    private _drawButtons(): void {
        const band = this._band;
        const chrome = this._ensureChrome();
        const rightX = band.right - MENU_RIGHT_COLUMN_WIDTH / 2;
        const boxFrame = this._frame(UI_MENU_BOX);
        const boxSize = { w: MENU_BOX_WIDTH, h: MENU_BOX_HEIGHT };
        const boxY = band.bottom + boxSize.h / 2;
        this._spriteOn(chrome, 'MenuBox', boxFrame, rightX, boxY, boxSize.w, boxSize.h, new Color(80, 50, 20, 220));
        const boxTop = band.bottom + boxSize.h;
        const boxRight = rightX + boxSize.w / 2;
        const startY = boxTop - MAIN_MENU_BUTTON_AREA_MARGIN_TOP - MENU_BUTTON_HEIGHT / 2;
        this._makeButton(chrome, 'StartButton', officialString('T_IA_MENU_START', '开始'), rightX, startY, () => this._onStart());
        const helpY = startY - MENU_BUTTON_HEIGHT;
        this._makeButton(chrome, 'HelpButton', officialString('T_IA_MENU_HELP', '帮助和关于'), rightX, helpY, () => this._onHelp());
        const optionsY = helpY - MENU_BUTTON_HEIGHT;
        this._makeButton(chrome, 'OptionsButton', officialString('T_IA_MENU_OPTIONS', '选项'), rightX, optionsY, () => this._onOptions());
        const soundW = SOUND_BUTTON_WIDTH;
        const soundH = SOUND_BUTTON_HEIGHT;
        const soundTop = boxTop - MAIN_MENU_SOUND_MARGIN_TOP;
        const soundRight = boxRight - MAIN_MENU_SOUND_MARGIN_RIGHT;
        const sound = this._makeIconButton(
            chrome,
            'SoundButton',
            soundRight - soundW / 2,
            soundTop - soundH / 2,
            soundW,
            soundH,
            this._frame(...UI_SOUND_ON_NAMES),
            this._frame(...UI_SOUND_ON_PRESSED_NAMES),
            () => this._onSound(),
        );
        this._soundButton = sound;
        this._soundLabel = null;
        this._syncSoundButton();
    }

    private _makeButton(parent: Node, name: string, text: string, x: number, y: number, onClick: () => void): Node {
        const size = this._officialButtonSize(text, MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT);
        return this._placeButton(parent, name, text, x, y, size.w, size.h, onClick);
    }

    private _makeIconButton(
        parent: Node,
        name: string,
        x: number,
        y: number,
        w: number,
        h: number,
        normal: SpriteFrame | null,
        pressed: SpriteFrame | null,
        onClick: () => void,
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        const bg = new Node('bg');
        node.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        this._applySprite(bg, normal, w, h, new Color(60, 40, 20, 220));
        if (normal && pressed) {
            this._wirePressed(node, normal, pressed);
        }
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.node.on(Button.EventType.CLICK, onClick, this);
        return node;
    }

    private _drawHelp(): void {
        const root = this._overlay('HelpRoot', true);
        this._helpRoot = root;
        const band = this._band;
        const box = this._frame(UI_TUTORIAL_BOX);
        const frame = new Node('HelpBox');
        root.addChild(frame);
        frame.layer = Layers.Enum.UI_2D;
        frame.setPosition(band.x, band.y, 0);
        this._applySprite(frame, box, LEVEL_OVERVIEW_WIDTH, LEVEL_OVERVIEW_HEIGHT, new Color(30, 20, 10, 220));
        const art = new Node('HelpArt');
        frame.addChild(art);
        art.layer = Layers.Enum.UI_2D;
        this._applySprite(art, null, HELP_IMAGE_SIZE.w, HELP_IMAGE_SIZE.h, new Color(0, 0, 0, 0));
        this._helpArt = art;
        const art2 = new Node('HelpArt2');
        frame.addChild(art2);
        art2.layer = Layers.Enum.UI_2D;
        art2.active = false;
        this._applySprite(art2, null, HELP_IMAGE_SIZE.w, HELP_IMAGE_SIZE.h, new Color(0, 0, 0, 0));
        this._helpArt2 = art2;
        this._helpLabel = this._text(frame, 'HelpText', '', 0, LEVEL_OVERVIEW_HEIGHT / 2 - HELP_TABLE_PADDING / 2, LEVEL_OVERVIEW_DESC_WIDTH + 80, 36);
        const left = this._makeButton(root, 'HelpLeft', '向左', band.left + NAV_BUTTON_SIZE / 2, band.bottom + NAV_BUTTON_SIZE / 2, () => this._onHelpLeft());
        const right = this._makeButton(root, 'HelpRight', '向右', band.right - NAV_BUTTON_SIZE / 2, band.bottom + NAV_BUTTON_SIZE / 2, () => this._onHelpRight());
        void left;
        void right;
        root.active = false;
    }

    private _drawOptions(): void {
        const root = this._overlay('OptionsRoot', true);
        this._optionsRoot = root;
        const band = this._band;
        const panel = new Node('OptionsPanel');
        root.addChild(panel);
        panel.layer = Layers.Enum.UI_2D;
        panel.setPosition(band.x, band.y, 0);
        const box = this._frame(UI_TEXTBOX_LARGE);
        const put = panel.addComponent(UITransform);
        put.setContentSize(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT);
        this._applySprite(panel, box, DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, new Color(30, 20, 10, 230));
        this._text(panel, 'OptionsTitle', '选项', 0, DIALOG_LARGE_HEIGHT / 2 - 36, 260, 32);
        this._optionLabels = [];
        const rows: Array<{ name: string; title: string; click: () => void }> = [
            { name: 'OptionSound', title: '声音', click: () => this._onOptionSound() },
            { name: 'OptionVibra', title: '振动', click: () => this._onOptionVibra() },
            { name: 'OptionWakeLock', title: '屏幕常亮', click: () => this._onOptionWakeLock() },
        ];
        const ys = [28, -8, -44];
        for (let i = 0; i < rows.length; i++) {
            const row = this._placeOptionRow(panel, rows[i].name, rows[i].title, 0, ys[i], rows[i].click);
            this._optionLabels.push(row);
        }
        const closeAt = this._yesNoCenter(DIALOG_LARGE_WIDTH, DIALOG_LARGE_HEIGHT, 'yes');
        this._makeButton(panel, 'OptionsClose', '确定', closeAt.x, closeAt.y, () => this._onOptionsClose());
        root.active = false;
    }

    private _placeOptionRow(parent: Node, name: string, title: string, x: number, y: number, onClick: () => void): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(260, 32);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        const icon = new Node('icon');
        node.addChild(icon);
        icon.layer = Layers.Enum.UI_2D;
        icon.setPosition(-110, 0, 0);
        this._applySprite(icon, null, SETTINGS_ICON_SIZE, SETTINGS_ICON_SIZE, new Color(80, 60, 40, 255));
        const label = this._text(node, 'Label', title, 20, 0, 200, 32);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.node.on(Button.EventType.CLICK, onClick, this);
        return label;
    }

    private _drawRegionSelect(): void {
        const root = this._overlay('RegionSelectRoot', false);
        this._regionRoot = root;
        const stage = this._selectStage(root, UI_USMAP_BOX);
        for (const def of REGION_DEFS) {
            this._placeRegionButton(stage, def, () => this._handleRegionClick(def.id));
        }
        const band = this._band;
        this._makeButton(root, 'RegionBack', '返回', band.left + NAV_BUTTON_SIZE / 2, band.bottom + NAV_BUTTON_SIZE / 2, () => this._onRegionBack());
        root.active = false;
    }

    private _drawLevelSelect(): void {
        const root = this._overlay('LevelSelectRoot', false);
        this._levelRoot = root;
        const stage = this._selectStage(root, UI_LEVELMAP_BOX);
        this._levelButtons = [];
        for (const layout of LEVEL_BUTTON_LAYOUT) {
            const pos = topLeftDipToCenter(layout.xDip, layout.yDip, LEVEL_THUMB_WIDTH_DIP, LEVEL_THUMB_HEIGHT_DIP);
            const btn = this._placeLevelButton(
                stage,
                `LevelButton${layout.local}`,
                `${layout.local}`,
                pos.x,
                pos.y,
                layout.xDip,
                layout.yDip,
                () => this._handleLevelClick(layout.local),
            );
            this._levelButtons.push(btn);
        }
        const band = this._band;
        this._makeButton(root, 'LevelBack', '返回', band.left + NAV_BUTTON_SIZE / 2, band.bottom + NAV_BUTTON_SIZE / 2, () => this._onLevelBack());
        root.active = false;
    }

    private _selectStage(parent: Node, artName?: string): Node {
        const band = this._band;
        const stage = new Node('SelectStage');
        stage.layer = Layers.Enum.UI_2D;
        parent.addChild(stage);
        const ut = stage.addComponent(UITransform);
        ut.setContentSize(SELECT_LAYOUT_WIDTH, SELECT_LAYOUT_HEIGHT);
        ut.setAnchorPoint(0.5, 0.5);
        stage.setPosition(band.x, band.y, 0);
        const frame = artName ? this._frame(artName) : null;
        const bg = new Node('SelectBg');
        stage.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        bg.setPosition(0, 0, 0);
        this._applySprite(bg, frame, SELECT_LAYOUT_WIDTH, SELECT_LAYOUT_HEIGHT, new Color(20, 14, 8, 180));
        return stage;
    }

    /**
     * MapSelectionButton：十字中心 = (xDip, yDip)（onLayout 把视图平移成 mapIcon 居中于 margins）；
     * 州名画在视图顶部，中心约在十字中心上方 36dip；十字内画 tag 的地区编号。
     */
    private _placeRegionButton(parent: Node, def: RegionDef, onClick: () => void): Node {
        const cross = REGION_CROSS_SIZE_DIP;
        const pos = topLeftDipToCenter(def.xDip, def.yDip, cross, cross);
        const node = new Node(`RegionButton${def.id}`);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(cross, cross);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(pos.x, pos.y, 0);
        const icon = new Node('Cross');
        icon.layer = Layers.Enum.UI_2D;
        node.addChild(icon);
        icon.setPosition(0, 0, 0);
        this._applySprite(icon, this._frame(UI_USMAP_CROSS), cross, cross, Color.WHITE);
        // MapSelectionButton.onTouchEvent：按下时 src 套 LightingColorFilter(-1, 0x4B4B4B)，即每通道 +75。
        this._wireGlowPress(
            node,
            this._thumbOverlay(icon, 'Press', cross, cross, new Color(255, 255, 255, 75), this._frame(UI_USMAP_CROSS)),
        );
        const index = this._text(node, 'Index', `${def.id + 1}`, 0, 0, cross, cross);
        index.fontSize = REGION_LABEL_FONT;
        index.lineHeight = REGION_LABEL_FONT + 2;
        index.color = Color.WHITE;
        index.enableOutline = true;
        index.outlineColor = new Color(78, 46, 18, 255);
        index.outlineWidth = 2;
        const nameNode = new Node('Label');
        nameNode.layer = Layers.Enum.UI_2D;
        node.addChild(nameNode);
        nameNode.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
        nameNode.setPosition(0, REGION_LABEL_OFFSET_ABOVE, 0);
        const name = nameNode.addComponent(Label);
        name.string = def.name;
        name.fontSize = REGION_LABEL_FONT;
        name.lineHeight = REGION_LABEL_FONT + 2;
        name.color = new Color(255, 250, 235, 255);
        name.enableOutline = true;
        name.outlineColor = new Color(78, 46, 18, 255);
        name.outlineWidth = 2;
        name.horizontalAlign = Label.HorizontalAlign.CENTER;
        name.verticalAlign = Label.VerticalAlign.CENTER;
        name.overflow = Label.Overflow.NONE;
        name.useSystemFont = true;
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.node.on(Button.EventType.CLICK, onClick, this);
        return node;
    }

    private _placeLevelButton(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        xDip: number,
        yDip: number,
        onClick: () => void,
    ): Node {
        const w = LEVEL_THUMB_WIDTH_DIP;
        const h = LEVEL_THUMB_HEIGHT_DIP;
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        (node as unknown as { __xDip?: number; __yDip?: number }).__xDip = xDip;
        (node as unknown as { __xDip?: number; __yDip?: number }).__yDip = yDip;
        const labelNode = new Node('Label');
        labelNode.layer = Layers.Enum.UI_2D;
        node.addChild(labelNode);
        const lut = labelNode.addComponent(UITransform);
        lut.setContentSize(w, h);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 18;
        label.color = new Color(24, 16, 10, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(255, 246, 214, 220);
        label.outlineWidth = 1;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.useSystemFont = true;
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.node.on(Button.EventType.CLICK, onClick, this);
        return node;
    }

    private _placeButton(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        onClick: () => void,
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        const bg = new Node('bg');
        node.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(w, h);
        bgUt.setAnchorPoint(0.5, 0.5);
        const art = this._artForButton(text);
        const kind = this._kindForButton(text);
        const iconOnly = kind === 'yes' || kind === 'no' || kind === 'navLeft' || kind === 'navRight';
        this._applySprite(bg, art.normal, w, h, new Color(60, 40, 20, 220));
        if (art.normal && art.pressed) {
            this._wirePressed(node, art.normal, art.pressed);
        }
        const labelNode = new Node('Label');
        labelNode.layer = Layers.Enum.UI_2D;
        node.addChild(labelNode);
        const lut = labelNode.addComponent(UITransform);
        lut.setContentSize(w, h);
        const label = labelNode.addComponent(Label);
        label.string = iconOnly ? '' : text;
        label.fontSize = 20;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        labelNode.active = !iconOnly;
        const button = node.addComponent(Button);
        button.node.on(Button.EventType.CLICK, onClick, this);
        return node;
    }

    private _ensureSaves(): SaveSession {
        if (!this._saves) {
            const store = createLocalStore(sys.localStorage as unknown as {
                getItem(k: string): string | null;
                setItem(k: string, v: string): void;
                removeItem(k: string): void;
            });
            this._saves = new SaveSession(store);
            this._saves.hydrate(campaignProgress);
        }
        return this._saves;
    }

    private _openRegionSelect(): void {
        this._closeSelectDialog();
        this._showScreen(MENU_SCREEN.regionSelect);
    }

    private _openLevelSelect(region: number): void {
        this._selectRegion = region;
        this._closeSelectDialog();
        this._syncLevelButtons();
        this._showScreen(MENU_SCREEN.levelSelect);
    }

    private _syncLevelButtons(): void {
        const region = this._selectRegion;
        const levels = levelsOfRegion(region);
        for (let i = 0; i < this._levelButtons.length; i++) {
            const btn = this._levelButtons[i];
            const level = levels[i];
            const open = isLevelButtonOpen(campaignProgress, level);
            const thumb = levelThumbnailName(level);
            btn.name = `LevelButton${level}`;
            const text = btn.getChildByName('Label')?.getComponent(Label);
            if (text) {
                text.string = `${level}`;
                text.color = open ? new Color(24, 16, 10, 255) : new Color(80, 80, 80, 255);
                text.node.active = true;
            }
            void this._loadThumb(thumb, btn, open);
        }
    }

    private async _loadThumb(name: string, btn: Node, open: boolean): Promise<void> {
        if (!name) {
            return;
        }
        if (this._frames.has(name)) {
            this._applyThumb(btn, name, open);
            return;
        }
        const loaded = await this._loadThumbFrame(name);
        if (loaded && btn.isValid) {
            this._applyThumb(btn, name, open);
        }
    }

    private async _loadThumbFrame(name: string): Promise<SpriteFrame | null> {
        if (this._frames.has(name)) {
            return this._frames.get(name) ?? null;
        }
        const bundles: Array<{ load: Function }> = [];
        try {
            bundles.push(await loadBundle('base'));
        } catch {
            // base 暂时不可用时再试地区包
        }
        const regionKey = REGION_DEFS[this._selectRegion]?.key;
        if (regionKey) {
            try {
                bundles.push(await loadBundle(regionKey));
            } catch {
                // 地区包没有再跳过
            }
        }
        for (const bundle of bundles) {
            const loaded = await this._tryLoad(bundle, name);
            if (loaded) {
                this._frames.set(name, loaded);
                return loaded;
            }
        }
        return null;
    }

    private _applyThumb(btn: Node, name: string, open: boolean): void {
        const sf = this._frames.get(name);
        const number = btn.getChildByName('Label');
        (btn as unknown as { __open?: boolean }).__open = open;
        if (!sf) {
            if (number) {
                number.active = true;
            }
            this._syncLockIcon(btn, open);
            return;
        }
        const natural = this._frameSize(sf, LEVEL_THUMB_WIDTH_DIP, LEVEL_THUMB_HEIGHT_DIP);
        const slot = btn as unknown as { __xDip?: number; __yDip?: number };
        const xDip = slot.__xDip ?? 0;
        const yDip = slot.__yDip ?? 0;
        const pos = topLeftDipToCenter(xDip, yDip, natural.w, natural.h);
        const but = btn.getComponent(UITransform);
        if (but) {
            but.setContentSize(natural.w, natural.h);
        }
        btn.setPosition(pos.x, pos.y, 0);
        let thumbNode = btn.getChildByName('thumb');
        if (!thumbNode) {
            thumbNode = new Node('thumb');
            btn.insertChild(thumbNode, 0);
            thumbNode.layer = Layers.Enum.UI_2D;
            thumbNode.addComponent(UITransform);
        }
        this._applySprite(thumbNode, sf, natural.w, natural.h, Color.WHITE);
        // 图已经画上就不再叠关卡号；没画上则保留号码。
        if (number) {
            number.active = false;
        }
        this._thumbOverlay(thumbNode, 'Sepia', natural.w, natural.h, new Color(228, 180, 126, 224), sf);
        this._thumbOverlay(thumbNode, 'Press', natural.w, natural.h, new Color(255, 255, 255, 75), sf);
        this._wireThumbPress(btn);
        this._paintThumb(btn);
        this._syncLockIcon(btn, open);
    }

    /** LevelSelectionButton.setStatus：未开锁时压 lvl_locked 44×44，居中压在缩略图上。 */
    private _syncLockIcon(btn: Node, open: boolean): void {
        let lock = btn.getChildByName('Lock');
        if (!open) {
            if (!lock) {
                lock = new Node('Lock');
                btn.addChild(lock);
                lock.layer = Layers.Enum.UI_2D;
            }
            lock.active = true;
            lock.setPosition(0, 0, 0);
            // ImageButton 默认 CENTER，lvl_locked 44×44 不缩放。
            this._applySprite(lock, this._frame(UI_LVL_LOCKED), LOCK_ICON_SIZE, LOCK_ICON_SIZE, Color.WHITE);
        } else if (lock) {
            lock.active = false;
        }
    }

    /**
     * LevelSelectionButton 只给背景（缩略图）加滤镜，锁定图标始终原色。
     * 未开锁 = LightingColorFilter(30,30,30, 198,150,96)，用「原图 + (228,180,126) α224」等效：
     * c=0 时约 200、c=255 时约 231，与原版 198/228 基本吻合，同时保留约 12% 的纹理。
     * 按下 = LightingColorFilter(-1, 0x4B4B4B)（每通道 +75），用白色 α75 叠加近似。
     */
    private _paintThumb(btn: Node): void {
        const open = (btn as unknown as { __open?: boolean }).__open !== false;
        const pressed = (btn as unknown as { __pressed?: boolean }).__pressed === true;
        const thumb = btn.getChildByName('thumb');
        const base = thumb?.getComponent(Sprite);
        if (base) {
            base.color = Color.WHITE;
        }
        const sepia = thumb?.getChildByName('Sepia');
        if (sepia) {
            sepia.active = !open && !pressed;
        }
        const glow = thumb?.getChildByName('Press');
        if (glow) {
            glow.active = pressed;
        }
    }

    /** 原版 onTouchEvent 按下时换 LightingColorFilter(-1, 0x4B4B4B)，等于每个通道 +75。 */
    private _wireThumbPress(btn: Node): void {
        const state = btn as unknown as { __pressWired?: boolean };
        if (state.__pressWired) {
            return;
        }
        state.__pressWired = true;
        const set = (pressed: boolean): void => {
            (btn as unknown as { __pressed?: boolean }).__pressed = pressed;
            this._paintThumb(btn);
        };
        btn.on(Node.EventType.TOUCH_START, () => set(true), this);
        btn.on(Node.EventType.TOUCH_END, () => set(false), this);
        btn.on(Node.EventType.TOUCH_CANCEL, () => set(false), this);
    }

    private _wireGlowPress(node: Node, glow: Node): void {
        const state = node as unknown as { __glowWired?: boolean };
        if (state.__glowWired) {
            return;
        }
        state.__glowWired = true;
        node.on(Node.EventType.TOUCH_START, () => {
            glow.active = true;
        }, this);
        node.on(Node.EventType.TOUCH_END, () => {
            glow.active = false;
        }, this);
        node.on(Node.EventType.TOUCH_CANCEL, () => {
            glow.active = false;
        }, this);
    }

    /**
     * LevelSelectionButton 的滤镜是逐通道运算，不是拿缩略图自己调色：
     * 锁定 = LightingColorFilter(mul 30,30,30 / add 198,150,96)，即压到 12% 再加 (198,150,96)，
     * 所以看上去是发白的奶咖色而不是变暗；按下 = LightingColorFilter(mul -1 / add 75,75,75)，纯加 75。
     * 纯色块只能用 alpha 混合近似「加」：a=224/255 时 0.12c+(200,158,111)，和原版基本重合。
     * setColorFilter 是逐像素的，透明处仍然透明，而 gng_levelmap_* 是不规则的羊皮纸团（四角和边都透明），
     * 直接画矩形会在图外面露出一圈方形蒙层，原版没有。所以拿同一张图当 SPRITE_STENCIL 蒙版，
     * 让色块被裁成缩略图自己的轮廓；蒙版节点只写模板不画自己。
     */
    private _thumbOverlay(parent: Node, name: string, w: number, h: number, color: Color, stencil: SpriteFrame | null): Node {
        let node = parent.getChildByName(name);
        if (!node) {
            node = new Node(name);
            node.layer = Layers.Enum.UI_2D;
            parent.addChild(node);
        }
        node.setPosition(0, 0, 0);
        let ut = node.getComponent(UITransform);
        if (!ut) {
            ut = node.addComponent(UITransform);
        }
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        let fill = node.getChildByName('Fill');
        if (!fill) {
            fill = new Node('Fill');
            node.addChild(fill);
            fill.addComponent(UITransform);
            fill.addComponent(Graphics);
        }
        fill.layer = Layers.Enum.UI_2D;
        fill.setPosition(0, 0, 0);
        const fillUt = fill.getComponent(UITransform);
        if (fillUt) {
            fillUt.setContentSize(w, h);
            fillUt.setAnchorPoint(0.5, 0.5);
        }
        const g = fill.getComponent(Graphics);
        if (g) {
            g.clear();
            g.fillColor = color;
            g.rect(-w / 2, -h / 2, w, h);
            g.fill();
        }
        if (stencil) {
            const sp = node.getComponent(Sprite) ?? node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = stencil;
            const mask = node.getComponent(Mask) ?? node.addComponent(Mask);
            mask.type = Mask.Type.SPRITE_STENCIL;
        }
        node.active = false;
        return node;
    }

    /**
     * LevelSelectionScreenActivity.generatePreviewMinimap：
     * pixelSize = min(floor(宽/列), floor(高/行))（至少 1），整张图居中；
     * 背景按 BackgroundMap 的颜色分段，地图字节 96–101 画成单位，102/104–110 画成已激活单位；最后描一圈黑边。
     */
    private async _drawPreviewMinimap(g: Graphics, level: number, w: number, h: number): Promise<void> {
        try {
            const name = mapNameForLevel(level);
            const bundle = await loadBundle('base');
            const grid = MapGrid.parse(name, await loadBytes(bundle, `maps/${name}`));
            const maps = buildTerrain(grid.cols, grid.rows, grid.cells);
            const pixel = Math.max(Math.min(Math.floor(w / grid.cols), Math.floor(h / grid.rows)), 1);
            const totalW = pixel * grid.cols;
            const totalH = pixel * grid.rows;
            const ox = Math.floor((w - totalW) / 2);
            const oy = Math.floor((h - totalH) / 2);
            g.clear();
            for (let row = 0; row < grid.rows; row += 1) {
                for (let col = 0; col < grid.cols; col += 1) {
                    const i = row * grid.cols + col;
                    const raw = grid.cells[i];
                    let argb = minimapTileColor(maps.background[i], maps.street[i]);
                    if (raw >= 96 && raw < 102) {
                        argb = 0xff000000;
                    } else if (raw === 102 || (raw >= 104 && raw < 111)) {
                        argb = 0xffff0000;
                    }
                    const rgba = argbToRgba(argb);
                    g.fillColor = new Color(rgba.r, rgba.g, rgba.b, rgba.a);
                    g.rect(-w / 2 + ox + col * pixel, h / 2 - oy - (row + 1) * pixel, pixel, pixel);
                    g.fill();
                }
            }
            g.strokeColor = new Color(0, 0, 0, 255);
            g.lineWidth = 1;
            g.rect(-w / 2 + ox, h / 2 - oy - totalH, totalW, totalH);
            g.stroke();
        } catch (err) {
            console.error('[Menu] 小地图生成失败', level, err);
        }
    }

    private _handleRegionClick(region: number): void {
        playSfx(BUTTON_SFX);
        const saves = this._ensureSaves();
        const flow = onRegionClick(campaignProgress, region, saves.shouldOfferContinue(region));
        this._applyRegionFlow(flow);
    }

    private _applyRegionFlow(flow: ReturnType<typeof onRegionClick>): void {
        if (flow.kind === 'tip') {
            this._openSelectDialog(REGION_TIP_TEXT, [
                { name: 'TipConfirm', text: '确定', x: 80, click: () => this._onTipConfirm(flow.region) },
                { name: 'TipCancel', text: '取消', x: -80, click: () => this._closeSelectDialog() },
            ]);
            return;
        }
        if (flow.kind === 'continue') {
            this._openContinueDialog(flow.region);
            return;
        }
        this._openLevelSelect(flow.region);
    }

    private _onTipConfirm(region: number): void {
        playSfx(BUTTON_SFX);
        const saves = this._ensureSaves();
        const flow = confirmRegionTip(campaignProgress, region, saves.shouldOfferContinue(region), saves);
        this._closeSelectDialog();
        this._applyRegionFlow(flow);
    }

    private _openContinueDialog(region: number): void {
        this._openSelectDialog(CONTINUE_TIP, [
            { name: 'ContinueYes', text: '继续', x: -80, click: () => this._onContinueYes(region) },
            { name: 'ContinueNo', text: '不了', x: 80, click: () => this._onContinueNo(region) },
        ]);
    }

    private _onContinueYes(region: number): void {
        playSfx(BUTTON_SFX);
        const saves = this._ensureSaves();
        const result = continueMidSave(saves, region);
        this._closeSelectDialog();
        if (result.kind !== 'resume') {
            this._openLevelSelect(region);
            return;
        }
        this._enterBattle(result.level, { resume: true });
    }

    private _onContinueNo(region: number): void {
        playSfx(BUTTON_SFX);
        const saves = this._ensureSaves();
        declineContinuePrompt(saves, region);
        this._closeSelectDialog();
        this._openLevelSelect(region);
    }

    private _handleLevelClick(local: number): void {
        playSfx(BUTTON_SFX);
        const level = levelsOfRegion(this._selectRegion)[local - 1];
        const result = onLevelClick(campaignProgress, level);
        if (result.kind === 'locked-tip') {
            this._openSelectDialog(LOCKED_LEVEL_TIP, [
                { name: 'LockedOk', text: '确定', x: 0, click: () => this._closeSelectDialog() },
            ]);
            return;
        }
        this._openPreview(result.level, result.thumbnail);
    }

    private _openPreview(level: number, thumbnail: string): void {
        void this._showLevelOverview(level, thumbnail);
    }

    /** apk dialog_slide_in：600ms 从下方 100% 高度滑入，accelerate_decelerate（sineInOut）。 */
    private _slideDialogIn(dialog: Node, x: number, y: number, height: number): void {
        dialog.setPosition(x, y - height, 0);
        tween(dialog)
            .to(0.6, { position: new Vec3(x, y, 0) }, { easing: 'sineInOut' })
            .start();
    }

    private async _showLevelOverview(level: number, thumbnail: string): Promise<void> {
        this._closeSelectDialog();
        if (thumbnail) {
            await this._loadThumbFrame(thumbnail);
        }
        const host = this._levelRoot?.active ? this._levelRoot : this._regionRoot;
        if (!host) {
            return;
        }
        const dialog = new Node('SelectDialog');
        dialog.layer = Layers.Enum.UI_2D;
        host.addChild(dialog);
        const dw = LEVEL_OVERVIEW_WIDTH;
        const dh = LEVEL_OVERVIEW_HEIGHT;
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(dw, dh);
        ut.setAnchorPoint(0.5, 0.5);
        const band = this._band;
        this._slideDialogIn(dialog, band.x, band.y, dh);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        this._applySprite(bg, this._frame(UI_HIGHSCORE_BOX), dw, dh, new Color(20, 14, 8, 230));

        const headingX = -dw / 2 + LEVEL_OVERVIEW_HEADING_MARGIN_LEFT + LEVEL_OVERVIEW_DESC_WIDTH / 2;
        const headingY = dh / 2 - LEVEL_OVERVIEW_HEADING_MARGIN_TOP - 11;
        this._labeled(
            dialog,
            'DialogTitle',
            officialLevelName(level),
            headingX,
            headingY,
            LEVEL_OVERVIEW_DESC_WIDTH,
            22,
            { fontSize: 18, hAlign: Label.HorizontalAlign.CENTER },
        );

        // dialog_level_overview：images 是 213 宽的横向 LinearLayout，两个 wrap_content ImageView 各 weight=1，
        // 多余宽度平分；都是 FIT_CENTER，所以图片在各自槽位居中。
        const imageRowTop = LEVEL_OVERVIEW_IMAGES_MARGIN_TOP;
        const descLeft = -dw / 2 + LEVEL_OVERVIEW_HEADING_MARGIN_LEFT;
        const thumbFrame = thumbnail ? this._frame(thumbnail) : null;
        const thumbSize = thumbFrame ? this._frameSize(thumbFrame, LEVEL_THUMB_WIDTH_DIP, LEVEL_THUMB_HEIGHT_DIP) : { w: LEVEL_THUMB_WIDTH_DIP, h: LEVEL_THUMB_HEIGHT_DIP };
        const spare = Math.max(0, LEVEL_OVERVIEW_DESC_WIDTH - thumbSize.w - MINIMAP_PREVIEW_WIDTH) / 2;
        const rowHeight = Math.max(LEVEL_OVERVIEW_IMAGES_MIN_HEIGHT, thumbSize.h, MINIMAP_PREVIEW_HEIGHT);
        const rowCenterY = dh / 2 - imageRowTop - rowHeight / 2;
        const thumb = new Node('PreviewThumb');
        dialog.addChild(thumb);
        thumb.layer = Layers.Enum.UI_2D;
        thumb.setPosition(descLeft + (thumbSize.w + spare) / 2, rowCenterY, 0);
        this._applySprite(thumb, thumbFrame, thumbSize.w, thumbSize.h, Color.WHITE);

        // 第二个 ImageView：level_overview_dialog_minimap_preview，66×50 FIT_CENTER。
        const mini = new Node('PreviewMinimap');
        dialog.addChild(mini);
        mini.layer = Layers.Enum.UI_2D;
        mini.setPosition(
            descLeft + thumbSize.w + spare + (MINIMAP_PREVIEW_WIDTH + spare) / 2,
            rowCenterY,
            0,
        );
        const miniUt = mini.addComponent(UITransform);
        miniUt.setContentSize(MINIMAP_PREVIEW_WIDTH, MINIMAP_PREVIEW_HEIGHT);
        void this._drawPreviewMinimap(mini.addComponent(Graphics), level, MINIMAP_PREVIEW_WIDTH, MINIMAP_PREVIEW_HEIGHT);

        const descY = dh / 2 - LEVEL_OVERVIEW_DESC_MARGIN_TOP - LEVEL_OVERVIEW_DESC_HEIGHT / 2;
        this._labeled(
            dialog,
            'DialogInfo',
            officialLevelInfo(level),
            -dw / 2 + LEVEL_OVERVIEW_HEADING_MARGIN_LEFT + LEVEL_OVERVIEW_DESC_WIDTH / 2,
            descY,
            LEVEL_OVERVIEW_DESC_WIDTH,
            LEVEL_OVERVIEW_DESC_HEIGHT,
            {
                fontSize: 14,
                hAlign: Label.HorizontalAlign.LEFT,
                vAlign: Label.VerticalAlign.TOP,
                overflow: Label.Overflow.CLAMP,
            },
        );

        const score = highScores.get(level);
        const scoreName = highScores.getName(level);
        const hasScore = score > 0;
        if (!hasScore) {
            const noX = -dw / 2 + LEVEL_OVERVIEW_HIGHSCORE_TEXT_MARGIN_LEFT + LEVEL_OVERVIEW_HIGHSCORE_TEXT_WIDTH / 2;
            const noY = dh / 2 - LEVEL_OVERVIEW_HIGHSCORE_IMAGE_MARGIN_TOP - LEVEL_OVERVIEW_NO_HIGHSCORE_HEIGHT / 2;
            this._labeled(
                dialog,
                'NoHighscore',
                officialString('T_IA_LEVEL_NO_HIGHSCORE', '你的最高分会在第一时间被展示在这里。'),
                noX,
                noY,
                LEVEL_OVERVIEW_HIGHSCORE_TEXT_WIDTH,
                LEVEL_OVERVIEW_NO_HIGHSCORE_HEIGHT,
                { fontSize: 14, hAlign: Label.HorizontalAlign.CENTER, overflow: Label.Overflow.CLAMP },
            );
        } else {
            const wantedX = -dw / 2 + LEVEL_OVERVIEW_HIGHSCORE_IMAGE_MARGIN_LEFT + LEVEL_OVERVIEW_WANTED_WIDTH / 2;
            const wantedY = dh / 2 - LEVEL_OVERVIEW_HIGHSCORE_IMAGE_MARGIN_TOP - LEVEL_OVERVIEW_WANTED_HEIGHT / 2;
            const wanted = new Node('Wanted');
            dialog.addChild(wanted);
            wanted.layer = Layers.Enum.UI_2D;
            wanted.setPosition(wantedX, wantedY, 0);
            this._applySprite(
                wanted,
                this._frame(UI_HIGHSCORE_WANTED),
                LEVEL_OVERVIEW_WANTED_WIDTH,
                LEVEL_OVERVIEW_WANTED_HEIGHT,
                new Color(90, 40, 20, 255),
            );
            const textX = -dw / 2 + LEVEL_OVERVIEW_HIGHSCORE_TEXT_MARGIN_LEFT + LEVEL_OVERVIEW_HIGHSCORE_TEXT_WIDTH / 2;
            this._labeled(dialog, 'HighscoreName', scoreName, textX, wantedY - LEVEL_OVERVIEW_WANTED_HEIGHT / 2 - 14, LEVEL_OVERVIEW_HIGHSCORE_TEXT_WIDTH, 24, { fontSize: 14 });
            this._labeled(dialog, 'HighscoreValue', `$ ${score}`, textX, wantedY - LEVEL_OVERVIEW_WANTED_HEIGHT / 2 - 38, LEVEL_OVERVIEW_HIGHSCORE_TEXT_WIDTH, 24, { fontSize: 16 });
        }

        const playNormal = this._frame(UI_HIGHSCORE_BUTTON, UI_MENU_BUTTON);
        const playPressed = this._frame(UI_HIGHSCORE_BUTTON_PRESSED, UI_MENU_BUTTON_PRESSED);
        const playSize = { w: LEVEL_OVERVIEW_PLAY_WIDTH, h: LEVEL_OVERVIEW_PLAY_HEIGHT };
        const playX = -dw / 2 + LEVEL_OVERVIEW_PLAY_MARGIN_LEFT + playSize.w / 2;
        const playY = dh / 2 - LEVEL_OVERVIEW_PLAY_MARGIN_TOP - playSize.h / 2;
        const playBtn = this._placeButton(dialog, 'PreviewStart', officialString('T_IA_LEVEL_PLAY', '开始'), playX, playY, playSize.w, playSize.h, () => this._onPreviewStart(level));
        const playBg = playBtn.getChildByName('bg');
        if (playBg && playNormal) {
            this._applySprite(playBg, playNormal, playSize.w, playSize.h, new Color(60, 40, 20, 220));
            if (playPressed) {
                this._wirePressed(playBtn, playNormal, playPressed);
            }
        }
        const closeX = -dw / 2 + LEVEL_OVERVIEW_BACK_MARGIN_LEFT + YES_NO_SIZE / 2;
        const closeY = dh / 2 - LEVEL_OVERVIEW_BACK_MARGIN_TOP - YES_NO_SIZE / 2;
        this._placeButton(dialog, 'PreviewClose', '关闭', closeX, closeY, YES_NO_SIZE, YES_NO_SIZE, () => this._closeSelectDialog());
        this._dialogRoot = dialog;
    }

    private _onPreviewStart(level: number): void {
        playSfx(BUTTON_SFX);
        const saves = this._ensureSaves();
        const result = startFromSelect(saves, campaignProgress, level);
        this._closeSelectDialog();
        this._enterBattle(result.level, { resume: false });
    }

    private _enterBattle(level: number, options: { resume?: boolean }): void {
        this._closeSelectDialog();
        playLevelMusic(level);
        this.node.active = false;
        void this._onEnterBattle?.(level, options);
    }

    public returnFromBattle(level?: number): void {
        this.node.active = true;
        playMenuMusic();
        const region = level && level >= 1 ? regionIndex(level) : this._selectRegion;
        if (region >= 0 && region < REGION_DEFS.length) {
            this._openLevelSelect(region);
            return;
        }
        this._openRegionSelect();
    }

    private _openSelectDialog(
        title: string,
        buttons: Array<{ name: string; text: string; x: number; click: () => void }>,
        thumbnail?: string,
    ): void {
        this._closeSelectDialog();
        const host = this._levelRoot?.active ? this._levelRoot : this._regionRoot;
        if (!host) {
            return;
        }
        const dialog = new Node('SelectDialog');
        dialog.layer = Layers.Enum.UI_2D;
        host.addChild(dialog);
        const preview = !!thumbnail;
        const dw = preview ? LEVEL_OVERVIEW_WIDTH : DIALOG_SMALL_WIDTH;
        const dh = preview ? LEVEL_OVERVIEW_HEIGHT : DIALOG_SMALL_HEIGHT;
        const box = preview ? this._frame(UI_HIGHSCORE_BOX) : this._frame(UI_TEXTBOX_SMALL);
        const ut = dialog.addComponent(UITransform);
        ut.setContentSize(dw, dh);
        ut.setAnchorPoint(0.5, 0.5);
        const band = this._band;
        this._slideDialogIn(dialog, band.x, band.y, dh);
        const bg = new Node('bg');
        dialog.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        this._applySprite(bg, box, dw, dh, new Color(20, 14, 8, 230));
        if (preview) {
            const headingX = -dw / 2 + LEVEL_OVERVIEW_HEADING_MARGIN_LEFT + LEVEL_OVERVIEW_DESC_WIDTH / 2;
            const headingY = dh / 2 - LEVEL_OVERVIEW_HEADING_MARGIN_TOP - 16;
            this._text(dialog, 'DialogTitle', title, headingX, headingY, LEVEL_OVERVIEW_DESC_WIDTH, 32);
        } else {
            this._text(dialog, 'DialogTitle', title, 0, 16, dw - 114, 48);
        }
        if (thumbnail) {
            const thumbFrame = this._frame(thumbnail);
            const natural = thumbFrame ? this._frameSize(thumbFrame, LEVEL_THUMB_WIDTH_DIP, LEVEL_THUMB_HEIGHT_DIP) : { w: LEVEL_THUMB_WIDTH_DIP, h: LEVEL_THUMB_HEIGHT_DIP };
            const thumb = this._spriteOrColor('PreviewThumb', thumbnail, 0, 0, natural.w, natural.h, new Color(80, 60, 40, 255));
            thumb.removeFromParent();
            dialog.addChild(thumb);
            const thumbX = -dw / 2 + LEVEL_OVERVIEW_HEADING_MARGIN_LEFT + natural.w / 2;
            const headingBottom = dh / 2 - LEVEL_OVERVIEW_HEADING_MARGIN_TOP - 16;
            const thumbY = headingBottom - natural.h / 2;
            thumb.setPosition(thumbX, thumbY, 0);
        }
        if (preview) {
            for (const btn of buttons) {
                const kind = this._kindForButton(btn.text);
                if (btn.text === '开始' || kind === 'yes' || kind === 'play') {
                    const playNormal = this._frame(UI_HIGHSCORE_BUTTON, UI_MENU_BUTTON);
                    const playPressed = this._frame(UI_HIGHSCORE_BUTTON_PRESSED, UI_MENU_BUTTON_PRESSED);
                    const playSize = { w: LEVEL_OVERVIEW_PLAY_WIDTH, h: LEVEL_OVERVIEW_PLAY_HEIGHT };
                    const x = -dw / 2 + LEVEL_OVERVIEW_PLAY_MARGIN_LEFT + playSize.w / 2;
                    const y = dh / 2 - LEVEL_OVERVIEW_PLAY_MARGIN_TOP - playSize.h / 2;
                    const playBtn = this._placeButton(dialog, btn.name, '开始', x, y, playSize.w, playSize.h, btn.click);
                    const bg = playBtn.getChildByName('bg');
                    if (bg && playNormal) {
                        this._applySprite(bg, playNormal, playSize.w, playSize.h, new Color(60, 40, 20, 220));
                        if (playPressed) {
                            this._wirePressed(playBtn, playNormal, playPressed);
                        }
                    }
                } else {
                    const x = -dw / 2 + LEVEL_OVERVIEW_BACK_MARGIN_LEFT + YES_NO_SIZE / 2;
                    const y = dh / 2 - LEVEL_OVERVIEW_BACK_MARGIN_TOP - YES_NO_SIZE / 2;
                    this._placeButton(dialog, btn.name, '取消', x, y, YES_NO_SIZE, YES_NO_SIZE, btn.click);
                }
            }
        } else {
            const yesNo = buttons.some((b) => this._kindForButton(b.text) === 'yes') && buttons.some((b) => this._kindForButton(b.text) === 'no');
            for (const btn of buttons) {
                const kind = this._kindForButton(btn.text);
                const size = this._officialButtonSize(btn.text, YES_NO_SIZE, YES_NO_SIZE);
                let x = btn.x;
                let y = -dh / 2 + DIALOG_BUTTON_MARGIN_BOTTOM + size.h / 2;
                if (kind === 'yes' || kind === 'no') {
                    const at = this._yesNoCenter(dw, dh, kind);
                    x = at.x;
                    y = at.y;
                } else if (yesNo) {
                    const at = this._yesNoCenter(dw, dh, btn === buttons[0] ? 'yes' : 'no');
                    x = at.x;
                    y = at.y;
                }
                this._placeButton(dialog, btn.name, btn.text, x, y, size.w, size.h, btn.click);
            }
        }
        this._dialogRoot = dialog;
    }

    private _closeSelectDialog(): void {
        if (this._dialogRoot?.isValid) {
            this._dialogRoot.destroy();
        }
        this._dialogRoot = null;
    }

    private _onLevelBack(): void {
        playSfx(BUTTON_SFX);
        this._openRegionSelect();
    }

    private _overlay(name: string, dim = true): Node {
        // 这几个根节点建完会被收进 _body，尺寸用 _body 局部单位才盖得住整块窗口。
        const cover = this._skyScreen();
        const root = new Node(name);
        root.layer = Layers.Enum.UI_2D;
        this.node.addChild(root);
        const ut = root.addComponent(UITransform);
        ut.setContentSize(cover.width, cover.height);
        const shade = new Node('shade');
        root.addChild(shade);
        shade.layer = Layers.Enum.UI_2D;
        const sUt = shade.addComponent(UITransform);
        sUt.setContentSize(cover.width, cover.height);
        const g = shade.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, dim ? 160 : 0);
        g.rect(-cover.width / 2, -cover.height / 2, cover.width, cover.height);
        g.fill();
        return root;
    }

    private _text(parent: Node, name: string, text: string, x: number, y: number, w: number, h: number): Label {
        return this._labeled(parent, name, text, x, y, w, h, { fontSize: 28, color: Color.WHITE });
    }

    private _labeled(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        opts?: {
            fontSize?: number;
            color?: Color;
            hAlign?: number;
            vAlign?: number;
            overflow?: number;
        },
    ): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        node.setPosition(x, y, 0);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = opts?.fontSize ?? 18;
        label.lineHeight = (opts?.fontSize ?? 18) + 4;
        label.color = opts?.color ?? new Color(40, 28, 16, 255);
        label.horizontalAlign = opts?.hAlign ?? Label.HorizontalAlign.CENTER;
        label.verticalAlign = opts?.vAlign ?? Label.VerticalAlign.CENTER;
        label.overflow = opts?.overflow ?? Label.Overflow.SHRINK;
        label.useSystemFont = true;
        return label;
    }

    private _spriteOrColor(name: string, art: string, x: number, y: number, w: number, h: number, fallback: Color, parent?: Node): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        (parent ?? this.node).addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        node.setPosition(x, y, 0);
        const sf = this._frames.get(art);
        if (sf) {
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = sf;
            sprite.color = Color.WHITE;
        } else {
            const g = node.addComponent(Graphics);
            g.fillColor = fallback;
            g.rect(-w / 2, -h / 2, w, h);
            g.fill();
        }
        return node;
    }

    private _showScreen(screen: MenuScreen): void {
        const was = this._screen;
        this._screen = screen;
        if (screen === MENU_SCREEN.main && was !== MENU_SCREEN.main) {
            playMenuMusic();
        }
        if (this._chrome) {
            this._chrome.active = screen === MENU_SCREEN.main;
        }
        if (this._helpRoot) {
            this._helpRoot.active = screen === MENU_SCREEN.help;
        }
        if (this._optionsRoot) {
            this._optionsRoot.active = screen === MENU_SCREEN.options;
        }
        if (this._regionRoot) {
            this._regionRoot.active = screen === MENU_SCREEN.regionSelect;
        }
        if (this._levelRoot) {
            this._levelRoot.active = screen === MENU_SCREEN.levelSelect;
        }
        if (screen !== MENU_SCREEN.regionSelect && screen !== MENU_SCREEN.levelSelect) {
            this._closeSelectDialog();
        }
        if (screen === MENU_SCREEN.help) {
            this._syncHelp();
        }
        if (screen === MENU_SCREEN.options) {
            this._syncOptions();
        }
    }

    private _syncHelp(): void {
        const layout = helpLayout(this._helpPage);
        if (this._helpLabel) {
            this._helpLabel.string = `帮助 ${this._helpPage + 1} / ${HELP_PAGE_LAYOUTS.length}`;
        }
        if (this._helpRoot) {
            this._helpRoot.name = layout;
        }
        const images = UI_HELP_PAGE_IMAGES[this._helpPage] ?? [];
        const first = this._frame(...images.slice(0, 1));
        const second = images.length > 1 ? this._frame(...images.slice(1)) : null;
        const imgW = HELP_IMAGE_SIZE.w;
        const imgH = HELP_IMAGE_SIZE.h;
        if (this._helpArt) {
            if (first) {
                const size = this._frameSize(first, imgW, imgH);
                this._applySprite(this._helpArt, first, size.w, size.h, new Color(0, 0, 0, 0));
                this._helpArt.active = true;
                const pairW = size.w + (second ? HELP_ITEM_PADDING + imgW : 0);
                this._helpArt.setPosition(second ? -pairW / 2 + size.w / 2 : 0, 0, 0);
            } else {
                this._helpArt.active = false;
            }
        }
        if (this._helpArt2) {
            if (second) {
                const size = this._frameSize(second, imgW, imgH);
                this._applySprite(this._helpArt2, second, size.w, size.h, new Color(0, 0, 0, 0));
                const firstW = first ? this._frameSize(first, imgW, imgH).w : imgW;
                const pairW = firstW + HELP_ITEM_PADDING + size.w;
                this._helpArt2.setPosition(pairW / 2 - size.w / 2, 0, 0);
            } else {
                this._helpArt2.active = false;
            }
        }
    }

    private _paintOptionIcon(name: string, on: boolean, onNames: readonly string[], offNames: readonly string[], size: number): void {
        const row = this._optionsRoot?.getChildByName('OptionsPanel')?.getChildByName(name)
            ?? this._optionsRoot?.getChildByName(name);
        const icon = row?.getChildByName('icon');
        if (!icon) {
            return;
        }
        const frame = this._frame(...(on ? onNames : offNames));
        this._applySprite(icon, frame, size, size, new Color(80, 60, 40, 255));
    }

    private _syncOptions(): void {

        const s = this._settings;
        if (!s || this._optionLabels.length < 3) {
            return;
        }
        this._optionLabels[0].string = `声音：${s.isSoundEnabled() ? '开' : '关'}`;
        this._optionLabels[1].string = `振动：${s.isVibraEnabled() ? '开' : '关'}`;
        this._optionLabels[2].string = `屏幕常亮：${s.isWakeLockEnabled() ? '开' : '关'}`;
        this._paintOptionIcon('OptionSound', s.isSoundEnabled(), UI_SOUND_ON_NAMES, UI_SOUND_OFF_NAMES, SETTINGS_ICON_SIZE);
        this._paintOptionIcon('OptionVibra', s.isVibraEnabled(), [UI_SETTINGS_VIBRA_ON], [UI_SETTINGS_VIBRA_OFF], SETTINGS_ICON_SIZE);
        this._paintOptionIcon('OptionWakeLock', s.isWakeLockEnabled(), [UI_SETTINGS_BACKLIGHT_ON], [UI_SETTINGS_BACKLIGHT_OFF], SETTINGS_ICON_SIZE);
        const vibraBtn = this._optionsRoot?.getChildByName('OptionsPanel')?.getChildByName('OptionVibra')
            ?? this._optionsRoot?.getChildByName('OptionVibra');
        if (vibraBtn) {
            vibraBtn.active = s.shouldShowVibraSwitch();
        }
    }

    private _syncSoundButton(): void {
        const on = this._settings?.isSoundEnabled() !== false;
        const normal = this._frame(...(on ? UI_SOUND_ON_NAMES : UI_SOUND_OFF_NAMES));
        const pressed = this._frame(...(on ? UI_SOUND_ON_PRESSED_NAMES : UI_SOUND_OFF_PRESSED_NAMES)) ?? this._frame(UI_MENU_BUTTON_PRESSED);
        if (this._soundButton && normal) {
            const size = this._frameSize(normal, SOUND_BUTTON_WIDTH, SOUND_BUTTON_HEIGHT);
            const bg = this._soundButton.getChildByName('bg');
            const ut = this._soundButton.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(size.w, size.h);
            }
            if (bg) {
                this._applySprite(bg, normal, size.w, size.h, new Color(60, 40, 20, 220));
            }
            if (pressed) {
                this._wirePressed(this._soundButton, normal, pressed);
            }
            if (this._soundLabel) {
                this._soundLabel.string = '';
            }
            return;
        }
        if (this._soundLabel && this._settings) {
            this._soundLabel.string = `声音：${this._settings.isSoundEnabled() ? '开' : '关'}`;
        }
    }

    private _onStart(): void {
        playSfx(BUTTON_SFX);
        this._onRegionSelect?.();
        this._openRegionSelect();
    }

    private _onHelp(): void {
        playSfx(BUTTON_SFX);
        this._helpPage = 0;
        this._showScreen(MENU_SCREEN.help);
    }

    private _onSound(): void {
        if (!this._settings) {
            return;
        }
        const settings = this._settings;
        clickThenToggleSound(() => settings.switchSound());
        this._syncSoundButton();
        this._syncOptions();
    }

    private _onOptions(): void {
        playSfx(BUTTON_SFX);
        this._showScreen(MENU_SCREEN.options);
    }

    private _onHelpLeft(): void {
        playSfx(BUTTON_SFX);
        const result = navigateHelp(this._helpPage, 'left');
        if (result.kind === 'menu') {
            this._showScreen(MENU_SCREEN.main);
            return;
        }
        this._helpPage = result.page;
        this._syncHelp();
    }

    private _onHelpRight(): void {
        playSfx(BUTTON_SFX);
        const result = navigateHelp(this._helpPage, 'right');
        if (result.kind === 'menu') {
            this._showScreen(MENU_SCREEN.main);
            return;
        }
        this._helpPage = result.page;
        this._syncHelp();
    }

    private _onOptionSound(): void {
        if (!this._settings) {
            return;
        }
        const settings = this._settings;
        clickThenToggleSound(() => settings.switchSound());
        this._syncOptions();
        this._syncSoundButton();
    }

    private _onOptionVibra(): void {
        playSfx(BUTTON_SFX);
        this._settings?.switchVibra();
        this._syncOptions();
    }

    private _onOptionWakeLock(): void {
        playSfx(BUTTON_SFX);
        this._settings?.switchWakeLock();
        this._syncOptions();
    }

    private _onOptionsClose(): void {
        playSfx(BUTTON_SFX);
        this._showScreen(MENU_SCREEN.main);
    }

    private _onRegionBack(): void {
        playSfx(BUTTON_SFX);
        this._showScreen(MENU_SCREEN.main);
    }
}
