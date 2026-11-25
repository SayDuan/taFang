import { _decorator, Camera, Component, EventTouch, Input, input, Rect } from 'cc';
import { FINE_PER_TILE, fineToPixels, pixelsToFine, stageSize } from '../platform/DisplayConfig';
import { clampLookFine, edgePushLook, followSelectedLook, type EdgePushState } from '../sim/CameraPan';

const { ccclass, property } = _decorator;

/** 小地图拖动相对于战场拖动的倍率，方向相反。 */
export const MINIMAP_DRAG_SCALE = 8;

/**
 * 战场正交相机：缩放固定为 1，一格永远是 32 像素，不把整张图缩小塞进屏幕。
 * 位置按 fine 存放（格子中心是 列 * 7680 + 3840），显示时再换成像素。
 * 空地拖动：手指移动多少像素，镜头就按 像素 * 7680 / 32 跟着走。
 */
@ccclass('BattlefieldCamera')
export class BattlefieldCamera extends Component {
    @property
    public mapCols = 32;

    @property
    public mapRows = 24;

    private _camera: Camera | null = null;
    private _dragging = false;
    private _lookFineX = 0;
    private _lookFineY = 0;
    /** apk cameraXgoal/cameraYgoal：边缘推动的目标值，与当前 look 分开平滑。 */
    private _edgeGoal: EdgePushState = { goalX: 0, goalY: 0 };

    onLoad(): void {
        this._camera = this.getComponent(Camera);
        this.applyLens();
        this._centerOnMap();
    }

    update(): void {
        // orthoHeight 在 applyLens 里已经按当前画布高度设置好，这里不再改 rect。
        // FIXED_WIDTH 模式下 Canvas 自动铺满窗口宽度，高度按比例扩展，不需要 letterbox。
    }

    onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    public setMapSize(cols: number, rows: number): void {
        this.mapCols = cols;
        this.mapRows = rows;
        this.applyLens();
        this._clampAndApply();
    }

    public applyLens(): void {
        const cam = this._camera;
        if (!cam) {
            this._camera = this.getComponent(Camera);
        }
        const lens = this._camera;
        if (!lens) {
            return;
        }
        lens.projection = Camera.ProjectionType.ORTHO;
        const size = stageSize();
        // FIXED_WIDTH 模式：画布宽度固定 640，高度按窗口比例自动扩展。
        // orthoHeight 直接用画布高度一半，就能在纵向显示尽可能多的地图格子。
        lens.orthoHeight = size.height / 2;
        // rect 重置为全画布。
        lens.rect = new Rect(0, 0, 1, 1);
    }

    public get lookFineX(): number {
        return this._lookFineX;
    }

    public get lookFineY(): number {
        return this._lookFineY;
    }

    /**
     * 战场空地拖动：镜头按 像素 * 7680 / 32 跟随手指，方向与手指相反（抓住地面拖）。
     * 对齐原版 updateCamera()：cameraX 和 cameraXgoal 一起改，goal 不许停留在旧位置，
     * 否则下一次拖单位时主循环的 0.7*camera + 0.3*goal 会把镜头猛地拉回旧目标。
     */
    public panByFieldPixels(dxPixels: number, dyPixels: number): void {
        this._lookFineX -= pixelsToFine(dxPixels);
        this._lookFineY -= pixelsToFine(dyPixels);
        this._clampAndApply();
        this.resetEdgePush();
    }

    /** 小地图拖动：相对战场拖动再乘 8，方向相反；同样同步推镜头目标。 */
    public panByMinimapPixels(dxPixels: number, dyPixels: number): void {
        this._lookFineX += pixelsToFine(dxPixels) * MINIMAP_DRAG_SCALE;
        this._lookFineY += pixelsToFine(dyPixels) * MINIMAP_DRAG_SCALE;
        this._clampAndApply();
        this.resetEdgePush();
    }

    /**
     * 选中的人走到离左、右、下边不足 2 格，或离上边不足 4 格时，镜头跟上。
     * 传入该人的 fine 坐标。
     */
    public followSelectedFine(fineX: number, fineY: number): void {
        const size = stageSize();
        const followed = followSelectedLook(this._lookFineX, this._lookFineY, fineX, fineY, size.width, size.height);
        this._lookFineX = followed.lookX;
        this._lookFineY = followed.lookY;
        this._edgeGoal.goalX = this._lookFineX;
        this._edgeGoal.goalY = this._lookFineY;
        this._clampAndApply();
    }

    /**
     * apk 主循环每帧的边缘推镜头：mMoveArrow.isShowing() 时按 speed*dt 累加，0.7/0.3 平滑。
     * 由 TerrainView 在拖动单位的每帧调用；fineYUp 是世界向上坐标。
     */
    public edgePushSelected(
        fineX: number,
        fineYUp: number,
        speed: number,
        bonusAttribute: number,
        dtMs: number,
    ): void {
        if (!(dtMs > 0)) {
            return;
        }
        const size = stageSize();
        const pushed = edgePushLook(
            this._lookFineX,
            this._lookFineY,
            this._edgeGoal,
            fineX,
            fineYUp,
            speed,
            bonusAttribute,
            dtMs,
            size.width,
            size.height,
        );
        this._lookFineX = pushed.lookX;
        this._lookFineY = pushed.lookY;
        this._edgeGoal.goalX = pushed.goalX;
        this._edgeGoal.goalY = pushed.goalY;
        this._clampAndApply();
    }

    /**
     * 把推镜头目标同步到当前镜头位置。
     * - 拖地图/小地图后调用：对应原版 updateCamera() 的 cameraXgoal = cameraX；
     * - 拖单位松手/切关时调用：清掉旧目标，避免下一帧残留推力（apk resetArrow 清 mInvalidateForMovement）。
     */
    public resetEdgePush(): void {
        this._edgeGoal.goalX = this._lookFineX;
        this._edgeGoal.goalY = this._lookFineY;
    }

    public consumeTouch(): void {
        this._dragging = false;
    }

    /** 把镜头移到最左边，竖屏下能立刻看到第 1 列。切关时同步 goal，避免残留旧关目标。 */
    public lookAtLeft(): void {
        this._lookFineX = 0;
        this._lookFineY = this._mapHeightFine() / 2;
        this._clampAndApply();
        this.resetEdgePush();
    }

    private _mapWidthFine(): number {
        return this.mapCols * FINE_PER_TILE;
    }

    private _mapHeightFine(): number {
        return this.mapRows * FINE_PER_TILE;
    }

    private _centerOnMap(): void {
        this._lookFineX = this._mapWidthFine() / 2;
        this._lookFineY = this._mapHeightFine() / 2;
        this._clampAndApply();
    }

    private _onTouchStart(): void {
        if (UiTouchGuard.blocked) {
            this._dragging = false;
            return;
        }
        this._dragging = true;
    }

    private _onTouchMove(event: EventTouch): void {
        if (UiTouchGuard.blocked || !this._dragging) {
            return;
        }
        const delta = event.getUIDelta();
        this.panByFieldPixels(delta.x, delta.y);
    }

    private _onTouchEnd(): void {
        this._dragging = false;
    }

    private _clampAndApply(): void {
        const size = stageSize();
        const viewW = pixelsToFine(size.width);
        const viewH = pixelsToFine(size.height);
        const mapW = this._mapWidthFine();
        const mapH = this._mapHeightFine();
        const next = clampLookFine(this._lookFineX, this._lookFineY, mapW, mapH, viewW, viewH);
        this._lookFineX = next.lookX;
        this._lookFineY = next.lookY;
        const pos = this.node.position;
        this.node.setPosition(fineToPixels(this._lookFineX), fineToPixels(this._lookFineY), pos.z);
    }
}

/** 点在暂停按钮或小地图上时，挡住战场拖动。 */
export class UiTouchGuard {
    static blocked = false;
}
