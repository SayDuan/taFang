/** 关卡用哪张地图、哪一套地面图集。实现集中在 CampaignLevel，这里只转出给 TerrainView。 */
export {
    type RegionPack,
    mapNameForLevel,
    packForLevel,
    logPackAcceptance,
} from '../../sim/CampaignLevel';
