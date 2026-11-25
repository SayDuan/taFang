import {
    _decorator,
    BlockInputEvents,
    Camera,
    Canvas,
    Color,
    Component,
    EventTouch,
    Graphics,
    Label,
    Layers,
    Node,
    UITransform,
    Widget,
} from 'cc';
import { FINE_PER_TILE, fineToPixels, getDesignSize, tileCenterFine } from '../platform/DisplayConfig';
import { GameTime } from '../sim/GameTime';
import { BattlefieldCamera, UiTouchGuard } from './BattlefieldCamera';

const { ccclass } = _decorator;

const MAP_COLS = 32;
const MAP_ROWS = 24;
const TILE = 32;
/** 验收用移动物：每秒走 1 格，暂停时停下。 */
const MARKER_SPEED_FINE = FINE_PER_TILE;

/**
 * 第 4 步验收用的网格、暂停按钮和小地图。第 5 步铺上真实地形后会去掉。
 * 不要把这个组件写进场景文件，由 Boot 在运行时挂上。
 */
@ccclass('Step4DebugView')
export class Step4DebugView extends Component {
    private _lens: BattlefieldCamera | null = null;
    private _marker: Node | null = null;
    private _markerFineX = 0;
    private _markerFineY = 0;
    private _pauseLabel: Label | null = null;
    private _infoLabel: Label | null = null;
    private _viewRect: Graphics | null = null;

    onLoad(): void {
        this._lens = this.getComponent(BattlefieldCamera);
        this._drawGrid();
        this._createMarker();
        this._createUi();
        // 开局先对准第 1 列，避免镜头停在地图中间时看起来像从屏幕中部才开始。
        this._lens?.lookAtLeft();
        console.log('[TimeCam] 缩放=1，一格 32 像素，地图 32x24。开局先看到第 1 列，往右拖能看到第 32 列。');
    }

    update(): void {
        const dt = GameTime.dtMs;
        const minX = tileCenterFine(0, 0).x;
        const maxX = tileCenterFine(MAP_COLS - 1, 0).x;
        this._markerFineX += MARKER_SPEED_FINE * dt / 1000;
        if (this._markerFineX > maxX) {
            this._markerFineX = minX;
        }
        if (this._marker) {
            this._marker.setPosition(fineToPixels(this._markerFineX), fineToPixels(this._markerFineY), 0);
        }
        this._updateHud();
    }

    private _worldRoot(): Node {
        const scene = this.node.scene;
        if (!scene) {
            throw new Error('[TimeCam] 没有场景，无法创建地图层');
        }
        const playName = 'Playfield';
        const oldPlay = scene.getChildByName(playName);
        if (oldPlay) {
            oldPlay.destroy();
        }
        const playfield = new Node(playName);
        scene.addChild(playfield);
        playfield.layer = Layers.Enum.DEFAULT;
        playfield.setPosition(0, 0, 0);

        const node = new Node('WorldCanvas');
        playfield.addChild(node);
        node.layer = Layers.Enum.DEFAULT;
        const width = MAP_COLS * TILE;
        const height = MAP_ROWS * TILE;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 0);
        ut.setContentSize(width, height);
        node.setPosition(0, 0, 0);
        const canvas = node.addComponent(Canvas);
        canvas.alignCanvasWithScreen = false;
        const cam = this.getComponent(Camera) ?? this.node.getComponent(Camera);
        if (cam) {
            canvas.cameraComponent = cam;
        }
        return node;
    }

    private _drawGrid(): void {
        const root = this._worldRoot();
        const node = this._child(root, 'DebugGrid');
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 0);
        ut.setContentSize(MAP_COLS * TILE, MAP_ROWS * TILE);
        node.setPosition(0, 0, 0);
        const g = node.addComponent(Graphics);
        const width = MAP_COLS * TILE;
        const height = MAP_ROWS * TILE;
        g.lineWidth = 1;
        g.strokeColor = new Color(160, 170, 180, 255);
        for (let c = 0; c <= MAP_COLS; c++) {
            g.moveTo(c * TILE, 0);
            g.lineTo(c * TILE, height);
        }
        for (let r = 0; r <= MAP_ROWS; r++) {
            g.moveTo(0, r * TILE);
            g.lineTo(width, r * TILE);
        }
        g.stroke();

        g.lineWidth = 3;
        g.strokeColor = new Color(220, 200, 60, 255);
        g.rect(0, 0, TILE, height);
        g.stroke();
        g.strokeColor = new Color(80, 200, 120, 255);
        g.rect((MAP_COLS - 1) * TILE, 0, TILE, height);
        g.stroke();

        for (const col of [1, 8, 16, 24, 32]) {
            this._worldLabel(node, `C${col}`, (col - 0.5) * TILE, 14, 28, 18);
        }
        for (const row of [1, 8, 16, 24]) {
            this._worldLabel(node, `R${row}`, 16, (row - 0.5) * TILE, 28, 18);
        }
    }

    private _worldLabel(parent: Node, text: string, x: number, y: number, width: number, fontSize: number): void {
        const labelNode = this._child(parent, `Label_${text}`);
        labelNode.layer = Layers.Enum.DEFAULT;
        const ut = labelNode.addComponent(UITransform);
        ut.setContentSize(width, fontSize + 4);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 2;
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.color = Color.WHITE;
        label.overflow = Label.Overflow.SHRINK;
        labelNode.setPosition(x, y, 0);
    }

    private _createMarker(): void {
        const start = tileCenterFine(0, Math.floor(MAP_ROWS / 2));
        this._markerFineX = start.x;
        this._markerFineY = start.y;
        const root = this.node.scene?.getChildByName('Playfield')?.getChildByName('WorldCanvas') ?? this._worldRoot();
        const node = this._child(root, 'DebugMarker');
        node.layer = Layers.Enum.DEFAULT;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(24, 24);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(255, 196, 0, 255);
        g.rect(-12, -12, 24, 24);
        g.fill();
        node.setPosition(fineToPixels(this._markerFineX), fineToPixels(this._markerFineY), 0);
        this._marker = node;
    }

    private _createUi(): void {
        const canvas = this.node.scene?.getChildByName('Canvas');
        if (!canvas) {
            return;
        }
        const root = this._child(canvas, 'Step4Hud');
        root.layer = Layers.Enum.UI_2D;
        const size = getDesignSize();
        const rootUt = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        rootUt.setContentSize(size.width, size.height);
        const widget = root.getComponent(Widget) ?? root.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.updateAlignment();

        this._pauseLabel = this._makeButton(root, 'PauseButton', '暂停', 24, 16, 160, 56, () => {
            const paused = GameTime.togglePaused();
            if (this._pauseLabel) {
                this._pauseLabel.string = paused ? '继续' : '暂停';
            }
            console.log(paused ? '[TimeCam] 已暂停，dt=0' : '[TimeCam] 已继续');
        });

        this._infoLabel = this._makeLabel(root, 'CamInfo', '', 200, size.height - 24, 480, 48, 22);
        const infoUt = this._infoLabel.node.getComponent(UITransform);
        if (infoUt) {
            infoUt.setAnchorPoint(0.5, 1);
        }
        this._infoLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._makeMinimap(root, size);
    }

    private _makeMinimap(parent: Node, size: { width: number; height: number }): void {
        const scale = 4;
        const w = MAP_COLS * scale;
        const h = MAP_ROWS * scale;
        const pad = 16;
        const node = this._child(parent, 'MiniMap');
        node.layer = Layers.Enum.UI_2D;
        const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(1, 0);
        node.setPosition(size.width / 2 - pad, -size.height / 2 + pad, 0);
        node.addComponent(BlockInputEvents);

        const bg = node.addComponent(Graphics);
        bg.fillColor = new Color(16, 18, 24, 200);
        bg.rect(-w, 0, w, h);
        bg.fill();
        bg.strokeColor = new Color(180, 180, 180, 255);
        bg.lineWidth = 2;
        bg.rect(-w, 0, w, h);
        bg.stroke();

        const viewNode = this._child(node, 'ViewRect');
        viewNode.layer = Layers.Enum.UI_2D;
        const viewUt = viewNode.addComponent(UITransform);
        viewUt.setContentSize(w, h);
        viewUt.setAnchorPoint(1, 0);
        viewNode.setPosition(0, 0, 0);
        this._viewRect = viewNode.addComponent(Graphics);

        const caption = this._makeLabel(parent, 'MiniMapCaption', '小地图（拖动为 8 倍）', 0, 0, 220, 28, 16);
        const capNode = caption.node;
        capNode.layer = Layers.Enum.UI_2D;
        const capUt = capNode.getComponent(UITransform)!;
        capUt.setAnchorPoint(1, 0);
        capNode.setPosition(size.width / 2 - pad, -size.height / 2 + pad + h + 4, 0);

        node.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
            UiTouchGuard.blocked = true;
            this._lens?.consumeTouch();
            ev.propagationStopped = true;
        }, this);
        node.on(Node.EventType.TOUCH_MOVE, (ev: EventTouch) => {
            UiTouchGuard.blocked = true;
            const delta = ev.getUIDelta();
            this._lens?.panByMinimapPixels(delta.x, delta.y);
            ev.propagationStopped = true;
        }, this);
        const release = () => {
            UiTouchGuard.blocked = false;
        };
        node.on(Node.EventType.TOUCH_END, release, this);
        node.on(Node.EventType.TOUCH_CANCEL, release, this);
    }

    private _updateHud(): void {
        const lens = this._lens;
        if (!lens || !this._infoLabel) {
            return;
        }
        const size = getDesignSize();
        const halfW = pixelsOfHalf(size.width);
        const leftPx = fineToPixels(lens.lookFineX) - size.width / 2;
        const rightPx = fineToPixels(lens.lookFineX) + size.width / 2;
        const colL = Math.max(1, Math.floor(leftPx / TILE) + 1);
        const colR = Math.min(MAP_COLS, Math.ceil(rightPx / TILE));
        const pauseText = GameTime.paused ? '  已暂停' : '';
        this._infoLabel.string = `可见列 ${colL}–${colR}${pauseText}`;
        void halfW;

        if (this._viewRect) {
            const g = this._viewRect;
            g.clear();
            const scale = 4;
            const mapW = MAP_COLS * TILE;
            const mapH = MAP_ROWS * TILE;
            const viewW = size.width;
            const viewH = Math.min(size.height, mapH);
            const x = (fineToPixels(lens.lookFineX) - viewW / 2) / TILE * scale;
            const y = (fineToPixels(lens.lookFineY) - viewH / 2) / TILE * scale;
            const rw = (viewW / TILE) * scale;
            const rh = (viewH / TILE) * scale;
            g.strokeColor = new Color(255, 220, 80, 255);
            g.lineWidth = 2;
            // 小地图锚点在右下，原点在自身右下，世界网格从左下开始。
            const left = x - MAP_COLS * scale;
            g.rect(left, y, rw, rh);
            g.stroke();
        }
    }

    private _makeButton(
        parent: Node,
        name: string,
        text: string,
        left: number,
        top: number,
        width: number,
        height: number,
        onClick: () => void,
    ): Label {
        const size = getDesignSize();
        const node = this._child(parent, name);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        ut.setContentSize(width, height);
        ut.setAnchorPoint(0, 1);
        node.setPosition(-size.width / 2 + left, size.height / 2 - top, 0);
        node.addComponent(BlockInputEvents);
        const bg = node.addComponent(Graphics);
        bg.fillColor = new Color(30, 30, 30, 200);
        bg.rect(0, -height, width, height);
        bg.fill();
        const label = this._makeLabel(node, 'Label', text, width / 2, -height / 2, width, height, 26);
        const labelUt = label.node.getComponent(UITransform)!;
        labelUt.setAnchorPoint(0.5, 0.5);
        label.node.setPosition(width / 2, -height / 2, 0);
        node.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
            UiTouchGuard.blocked = true;
            this._lens?.consumeTouch();
            ev.propagationStopped = true;
        }, this);
        node.on(Node.EventType.TOUCH_END, (ev: EventTouch) => {
            UiTouchGuard.blocked = false;
            onClick();
            ev.propagationStopped = true;
        }, this);
        node.on(Node.EventType.TOUCH_CANCEL, () => {
            UiTouchGuard.blocked = false;
        }, this);
        return label;
    }

    private _makeLabel(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
    ): Label {
        const node = this._child(parent, name);
        node.layer = Layers.Enum.UI_2D;
        const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        ut.setContentSize(width, height);
        const label = node.getComponent(Label) ?? node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.useSystemFont = true;
        label.fontFamily = 'Microsoft YaHei';
        label.color = Color.WHITE;
        label.overflow = Label.Overflow.SHRINK;
        node.setPosition(x, y, 0);
        return label;
    }

    private _child(parent: Node, name: string): Node {
        const old = parent.getChildByName(name);
        if (old) {
            old.destroy();
        }
        const node = new Node(name);
        parent.addChild(node);
        return node;
    }
}

function pixelsOfHalf(width: number): number {
    return width / 2;
}
