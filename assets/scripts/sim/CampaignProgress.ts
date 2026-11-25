/** 六个地区各 10 关。每个地区第 1 关一开始就能进，只升不降。 */

export const REGION_COUNT = 6;
export const LEVELS_PER_REGION = 10;

export function regionIndex(globalLevel: number): number {
    return Math.floor((globalLevel - 1) / LEVELS_PER_REGION);
}

export function localLevel(globalLevel: number): number {
    return ((globalLevel - 1) % LEVELS_PER_REGION) + 1;
}

export function globalLevel(region: number, local: number): number {
    return region * LEVELS_PER_REGION + local;
}

export class CampaignProgress {
    /** 每个地区已经开放到第几关，至少是 1。 */
    readonly available: number[] = [1, 1, 1, 1, 1, 1];
    /** 是否已经看过该地区的提醒。六个地区互不影响。 */
    readonly introSeen: boolean[] = [false, false, false, false, false, false];
    /** 0 没有中途档，1 有中途档。过关或选关点开始写成 0，进入下一波写成 1。 */
    readonly savegameStatus: number[] = [0, 0, 0, 0, 0, 0];
    /** 中途档版本。现写 12；没有档时按原版缺省 10。 */
    readonly saveGameVersion: number[] = [10, 10, 10, 10, 10, 10];
    hardUnlocked = false;

    isLevelOpen(level: number): boolean {
        if (level < 1 || level > REGION_COUNT * LEVELS_PER_REGION) {
            return false;
        }
        const region = regionIndex(level);
        return localLevel(level) <= this.available[region];
    }

    /** 该地区开放关卡已经超过这一关的本地关号，说明这一关打过了。 */
    isLevelFinished(level: number): boolean {
        if (level < 1 || level > REGION_COUNT * LEVELS_PER_REGION) {
            return false;
        }
        return localLevel(level) < this.available[regionIndex(level)];
    }

    finishedLevels(): number[] {
        const out: number[] = [];
        for (let level = 1; level <= REGION_COUNT * LEVELS_PER_REGION; level++) {
            if (this.isLevelFinished(level)) {
                out.push(level);
            }
        }
        return out;
    }

    /** 过关后把该地区开放关卡数升到本地关卡号 + 1。每 10 关（GunsAndGloryThread.onLevelFinished: totalLevelId % 10 == 0）解锁困难模式。返回是否真的升了。 */
    completeLevel(level: number): boolean {
        if (level < 1 || level > REGION_COUNT * LEVELS_PER_REGION) {
            return false;
        }
        const region = regionIndex(level);
        const next = localLevel(level) + 1;
        let raised = false;
        if (next > this.available[region]) {
            this.available[region] = next;
            raised = true;
        }
        if (level % 10 === 0) {
            this.hardUnlocked = true;
        }
        return raised;
    }

    warningDisplayed(region: number): boolean {
        return !!this.introSeen[region];
    }

    setWarningDisplayed(region: number): void {
        if (region < 0 || region >= REGION_COUNT) {
            return;
        }
        this.introSeen[region] = true;
    }

    hasMidSaveFlag(region: number): boolean {
        return this.savegameStatus[region] === 1;
    }

    setSaveGameStatus(region: number, status: number): void {
        if (region < 0 || region >= REGION_COUNT) {
            return;
        }
        this.savegameStatus[region] = status;
    }

    setSaveGameVersion(region: number, version: number): void {
        if (region < 0 || region >= REGION_COUNT) {
            return;
        }
        this.saveGameVersion[region] = version;
    }
}

export const campaignProgress = new CampaignProgress();
