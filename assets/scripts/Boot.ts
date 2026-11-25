import { _decorator, Camera, Canvas, Component, Layers, UITransform } from 'cc';
import { GameTables } from './data/GameTables';
import { applyDesignResolution, applyStageResolution, getDesignSize, stageSize } from './platform/DisplayConfig';
import { GameTime } from './sim/GameTime';
import { BattlefieldCamera } from './view/BattlefieldCamera';
import { TerrainView } from './view/TerrainView';
import { attachMainMenu, MainMenuView } from './view/MainMenuView';

const { ccclass } = _decorator;

/** 当前要播放的关卡。改这一处就能换图和第 11/21/31/41/51 关的图集。第七步先看第 1 关右下角三顶睡帽；第六步可改成 2（小帐篷）、4（酒馆堡垒帐篷和火车）、31（雪地树石）。 */
const PLAY_LEVEL = 1;

/**
 * 启动场景唯一入口，只挂主菜单和战场两套视图。不要在这里接第 8 步删掉的旧试玩脚本。
 */
@ccclass('Boot')
export class Boot extends Component {
    private _menu: MainMenuView | null = null;

    onLoad(): void {
        applyDesignResolution();
        this._fitCanvas(getDesignSize());
        this._fitBattleCamera();
        this._hideBattleRoot();
        this._showMenu();
    }

    update(dt: number): void {
        GameTime.tick(dt);
    }

    private _showMenu(): void {
        this._menu = attachMainMenu(this.node, {
            playLevel: PLAY_LEVEL,
            onEnterBattle: (level, options) => {
                void this._startLevel(level, options);
            },
        });
    }

    private async _startLevel(level = PLAY_LEVEL, options?: { resume?: boolean }): Promise<void> {
        try {
            applyStageResolution();
            this._fitCanvas(stageSize());
            this._fitBattleCamera();
            await GameTables.load();
            await GameTables.current?.logAcceptance();
            const battle = this.node.scene?.getChildByName('BattleRoot');
            if (!battle) {
                applyDesignResolution();
                this._fitCanvas(getDesignSize());
                console.error('[Terrain] 场景里没有 BattleRoot');
                return;
            }
            const debug = battle.getComponent('Step4DebugView') as Component | null;
            if (debug) {
                debug.destroy();
            }
            battle.active = true;
            const view = battle.getComponent(TerrainView) ?? battle.addComponent(TerrainView);
            view.onLeaveBattle = () => this._leaveBattle(view.currentLevel);
            await view.showLevel(level, options);
        } catch (err) {
            applyDesignResolution();
            this._fitCanvas(getDesignSize());
            console.error('[Terrain] 启动铺地失败', err);
        }
    }

    private _leaveBattle(level: number): void {
        applyDesignResolution();
        this._fitCanvas(getDesignSize());
        const battle = this.node.scene?.getChildByName('BattleRoot');
        const view = battle?.getComponent(TerrainView) ?? null;
        view?.hideBattle();
        if (battle) {
            battle.active = false;
        }
        this._menu?.returnFromBattle(level);
    }

    private _hideBattleRoot(): void {
        const battle = this.node.scene?.getChildByName('BattleRoot');
        if (battle) {
            battle.active = false;
        }
    }

    private _fitCanvas(size: { width: number; height: number }): void {
        const ut = this.node.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(size.width, size.height);
        }
        const canvas = this.node.getComponent(Canvas);
        if (canvas && canvas.cameraComponent) {
            canvas.cameraComponent.visibility |= Layers.Enum.UI_2D;
            canvas.cameraComponent.priority = 1;
        }
    }

    private _fitBattleCamera(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const battle = scene.getChildByName('BattleRoot');
        if (!battle) {
            return;
        }
        const lens = battle.getComponent(BattlefieldCamera);
        if (lens) {
            lens.applyLens();
        }
        const camera = battle.getComponent(Camera);
        if (camera) {
            const size = stageSize();
            camera.orthoHeight = size.height / 2;
            camera.priority = 0;
        }
    }
}
