/**
 * dialog 19：最后一波打完，先弹一段台词（dialog_message），点「好的」再进结算弹窗 8。
 * 对应 apk LevelPack.getSuccessTextId 和六个地区的 override。
 */

export interface CampaignEndMessage {
    text: string;
    portrait: string;
}

/** T_END_LEVEL：每关打完都会说的一句。 */
export const END_LEVEL_TEXT = '哈，我们痛宰了那些可恶的移民们！现在我们该换个地方了！';

/** 地区 id 与 LevelSelect.REGION_DEFS 同序：0 新墨西哥、1 密西西比、2 俄勒冈、3 达科塔、4 内华达、5 阿拉斯加。 */
const CAMPAIGN_END_TEXT: Record<number, string> = {
    0: '我们做到了！那些烦人的移民听到你名字就会发抖！你现在已经是西边最危险的劫持者了！',
    1: '耶！密西西比河是我们的！整个州都控制在我们的手中！至少，我可以在河里游泳！但是我们必须马上行动了，因为西部仍有整堆整堆的黄金等待着我们去打劫！',
    2: '去往俄勒冈州的移民正在进入我们的埋伏，我们将拥有大批的金子和物资！',
    3: '哈哈哈，我知道我们在做什么，冬天前我们就能占领这里了！我们将瓜分这里的战利品！',
    4: '用这些黄金我们连整个阿拉斯加都买的下来了！',
    5: '在这种情况下…为您服务,头儿!',
};

export function campaignEndMessage(level: number): CampaignEndMessage {
    const region = Math.floor((level - 1) / 10);
    const local = ((level - 1) % 10) + 1;
    if (local !== 10) {
        return { text: END_LEVEL_TEXT, portrait: 'portrait_pedro' };
    }
    return {
        text: CAMPAIGN_END_TEXT[region] ?? END_LEVEL_TEXT,
        // 只有 Alaska.getSuccessTextId 把头像换成警长。
        portrait: region === 5 ? 'portrait_sheriff' : 'portrait_pedro',
    };
}
