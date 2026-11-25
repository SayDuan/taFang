/** 单位类型、图文件和一帧的宽高。切走路图时按这个宽高，不要一律按 32。 */

export const ACTIVITY_FOR_SALE = 4;
export const ACTIVITY_WORKING = 5;

export interface UnitVisual {
    name: string;
    /** 走路或待机图，在 sprites/ 下。没有走路图时为空。 */
    walk: string;
    shot: string;
    /** 待售时用的整张图。没有睡觉图时用这张全身图。 */
    sleep: string;
    frameW: number;
    frameH: number;
    /** 走路表：3 帧来回或 4 帧顺着走。 */
    walkFourFrames: boolean;
    isEnemy: boolean;
}

const PLAYER_WALK = false;

export const UNIT_VISUAL: Record<number, UnitVisual> = {
    1: { name: '亡命之徒', walk: 'units/player_gunslinger', shot: 'units/player_gunslinger_shot', sleep: 'units/player_gunslinger_sleep', frameW: 32, frameH: 44, walkFourFrames: PLAYER_WALK, isEnemy: false },
    2: { name: '暴徒', walk: 'units/player_mexican', shot: 'units/player_mexican_shot', sleep: 'units/player_mexican_sleep', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
    3: { name: '加农炮', walk: 'units/player_cannon', shot: 'units/player_cannon_shot', sleep: 'units/player_cannon_sleep', frameW: 32, frameH: 32, walkFourFrames: false, isEnemy: false },
    4: { name: '本地人', walk: 'units/player_indian', shot: 'units/player_indian_shot', sleep: 'units/player_indian_sleep', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
    5: { name: '女射手', walk: 'units/player_scout', shot: 'units/player_scout_shot', sleep: 'units/player_scout_sleep', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
    6: { name: '猎枪老人', walk: 'units/player_geezer', shot: 'units/player_geezer_shot', sleep: 'units/player_geezer_sleep', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
    7: { name: '炸药引爆器', walk: '', shot: '', sleep: 'fx/dynamite_detonator', frameW: 32, frameH: 40, walkFourFrames: false, isEnemy: false },
    8: { name: '炸药箱', walk: '', shot: '', sleep: 'fx/dynamite_box', frameW: 32, frameH: 32, walkFourFrames: false, isEnemy: false },
    9: { name: '赌徒', walk: 'units/player_gambler', shot: '', sleep: 'units/player_gambler', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
    35: { name: '纵火狂', walk: 'units/player_pyromaniac', shot: 'units/player_pyromaniac_shot', sleep: 'units/player_pyromaniac_sleep', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
    36: { name: '蛇油商人', walk: 'units/player_salesman', shot: 'units/player_salesman_shot', sleep: 'units/player_salesman_sleep', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: false },
};

export const ENEMY_VISUAL: Record<number, UnitVisual> = {
    1: { name: '男移民', walk: 'enemies/pioneer_male', shot: '', sleep: '', frameW: 16, frameH: 24, walkFourFrames: false, isEnemy: true },
    2: { name: '女移民', walk: 'enemies/pioneer_female', shot: '', sleep: '', frameW: 16, frameH: 24, walkFourFrames: false, isEnemy: true },
    3: { name: '骑兵', walk: 'enemies/horseman', shot: '', sleep: '', frameW: 32, frameH: 40, walkFourFrames: true, isEnemy: true },
    4: { name: '篷车', walk: 'enemies/wagon', shot: '', sleep: '', frameW: 32, frameH: 40, walkFourFrames: false, isEnemy: true },
    5: { name: '驿马车', walk: 'enemies/stagecoach', shot: '', sleep: '', frameW: 32, frameH: 48, walkFourFrames: false, isEnemy: true },
    6: { name: '金车', walk: 'enemies/goldtransport', shot: '', sleep: '', frameW: 32, frameH: 48, walkFourFrames: false, isEnemy: true },
    7: { name: '头目', walk: 'portraits/boss', shot: '', sleep: '', frameW: 32, frameH: 44, walkFourFrames: false, isEnemy: true },
    8: { name: '马', walk: 'enemies/horse_wagon', shot: '', sleep: '', frameW: 32, frameH: 40, walkFourFrames: true, isEnemy: true },
    9: { name: '医生', walk: 'portraits/doc', shot: '', sleep: '', frameW: 16, frameH: 24, walkFourFrames: false, isEnemy: true },
};

export const HORSE_WHITE_WALK = 'enemies/horse_wagon_white';
export const HORSE_WHITE_TURN = 'enemies/horse_wagon_turn_white';
export const HORSE_TURN = 'enemies/horse_wagon_turn';

/** 只有「有转向动画」大于 0 才换图。移民和医生是 0。 */
export const ENEMY_TURN_MS: Record<number, number> = {
    1: 0,
    2: 0,
    3: 100,
    4: 200,
    5: 100,
    6: 200,
    7: 100,
    8: 100,
    9: 0,
};

/** 头目仍用 boss 这张图，只改帧。7 号没有转向图。 */
export const ENEMY_TURN_FILE: Record<number, string> = {
    3: 'enemies/horseman_turn',
    4: 'enemies/wagon_turn',
    5: 'enemies/stagecoach_turn',
    6: 'enemies/goldtransport_turn',
    8: HORSE_TURN,
};

/**
 * apk setImageForTurningUnit L272-279：白马取的是 enemyDesignData[7][2]（horse_wagon 再按 mMirrored 翻），
 * 黑马走 default 分支 enemyDesignData[8][2] = horse_wagon_turn。和走路时的白/黑判定正好相反。
 */
export function enemyTurnFile(type: number, white: boolean): string | undefined {
    if (type === 8) {
        return white ? HORSE_WHITE_TURN : HORSE_TURN;
    }
    return ENEMY_TURN_FILE[type];
}

export const SLEEP_HAT_FILE = 'fx/sfx_sleeping';
export const SLEEP_HAT_FRAMES = 3;
export const SLEEP_HAT_FRAME_MS = 200;
export const SLEEP_HAT_FRAME_W = 24;
export const SLEEP_HAT_FRAME_H = 16;
export const SLEEP_HAT_ABOVE = 32;

export function visualFor(type: number, isEnemy: boolean, horseWhite = false): UnitVisual | null {
    if (isEnemy) {
        const vis = ENEMY_VISUAL[type];
        if (!vis) {
            return null;
        }
        if (type === 8 && horseWhite) {
            return { ...vis, walk: HORSE_WHITE_WALK };
        }
        return vis;
    }
    return UNIT_VISUAL[type] ?? null;
}

export function bodyFileFor(vis: UnitVisual, activity: number): string {
    if (activity === ACTIVITY_FOR_SALE && vis.sleep) {
        return vis.sleep;
    }
    return vis.walk || vis.sleep;
}
