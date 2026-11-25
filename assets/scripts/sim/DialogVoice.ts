/**
 * 原版 InGameGeneralMessageDialog.setUpDialog(text, portrait) 的头像语音 switch。
 * 只用于两参数版本（dialog 0/10/14/16/17/19）；三参数雇佣框和单参数升级框原版不播音。
 */
import { playSfx } from './Sound';

const PORTRAIT_VOICE: Record<string, string | readonly string[]> = {
    oregon_dakota_portrait_boss: 'sound_cattle_baron',
    oregon_dakota_portrait_calamity: 'sound_sniper_laughing',
    oregon_dakota_portrait_dynamite: 'sound_remote_dynamite',
    oregon_dakota_portrait_geezer: 'sound_grandpa_coughing',
    portrait_deserter: 'sound_deserter_yes_sir',
    portrait_doc: ['sound_doc_1', 'sound_doc_2'],
    portrait_gambler: ['sound_gambler_1', 'sound_gambler_2'],
    portrait_gunslinger: 'sound_desperado_yihaa',
    portrait_indian: 'sound_indian_hugh',
    portrait_mexican: 'sound_mexican_arriba',
    portrait_pedro: 'sound_pedro',
    portrait_pyromaniac: ['sound_pyromaniac_1', 'sound_pyromaniac_2'],
    portrait_salesman: ['sound_snakeoilsalesman_1', 'sound_snakeoilsalesman_2'],
    portrait_settlers: 'sound_siedler',
    portrait_sheriff: 'sound_sheriff',
};

/** 返回原版这段语音的正式文件名；没有对应头像时返回 null。 */
export function portraitVoiceClip(portraitFile: string | null | undefined): string | null {
    if (!portraitFile) {
        return null;
    }
    const clip = PORTRAIT_VOICE[portraitFile];
    if (!clip) {
        return null;
    }
    return typeof clip === 'string' ? clip : clip[Math.random() < 0.5 ? 0 : 1];
}

/** 弹两参数消息框时调用；名字与 assets/resources/audio/音效/ 下的原版文件名一致。 */
export function playPortraitVoice(portraitFile: string | null | undefined): boolean {
    const clip = portraitVoiceClip(portraitFile);
    return clip ? playSfx(clip) : false;
}
