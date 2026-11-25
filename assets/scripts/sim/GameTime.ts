/**
 * 模拟时钟。每帧 dt 用毫秒：小于 0 当 0，大于 100 当 100。
 * 暂停、对话框打开、或战斗界面还没有焦点时，dt 为 0。
 * 关掉对话框并且战斗界面重新得到焦点后，时间才继续走。
 */
export class GameTime {
    static paused = false;
    static dialogOpen = false;
    /** 战斗界面是否拥有焦点。对话框弹出时会被清掉。 */
    static battleUiFocused = true;
    /** 本帧可用的模拟时间，毫秒。 */
    static dtMs = 0;
    static elapsedMs = 0;

    static tick(dtSeconds: number): number {
        let ms = dtSeconds * 1000;
        if (ms < 0) {
            ms = 0;
        }
        if (ms > 100) {
            ms = 100;
        }
        if (GameTime.paused || GameTime.dialogOpen || !GameTime.battleUiFocused) {
            ms = 0;
        }
        GameTime.dtMs = ms;
        GameTime.elapsedMs += ms;
        return ms;
    }

    static setPaused(paused: boolean): void {
        GameTime.paused = paused;
        if (paused) {
            GameTime.dtMs = 0;
        }
    }

    static setDialogOpen(open: boolean): void {
        GameTime.dialogOpen = open;
        if (open) {
            GameTime.battleUiFocused = false;
            GameTime.dtMs = 0;
        }
    }

    static setBattleUiFocused(focused: boolean): void {
        GameTime.battleUiFocused = focused;
        if (!focused) {
            GameTime.dtMs = 0;
        }
    }

    static togglePaused(): boolean {
        GameTime.setPaused(!GameTime.paused);
        return GameTime.paused;
    }

    /** 战斗模拟这一帧是否应该前进。 */
    static get battleRunning(): boolean {
        return !GameTime.paused && !GameTime.dialogOpen && GameTime.battleUiFocused;
    }
}
