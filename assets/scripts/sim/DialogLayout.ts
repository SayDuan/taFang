/**
 * 游戏内大弹窗的滚动内容区布局。数值逐项来自原版：
 * - 布局 D:\gameDemo\新版准备材料\界面\布局\dialog_upgrade.xml / dialog_hire.xml /
 *   dialog_message.xml / dialog_gambler.xml 的 @id/ds_scroll_view（com.hg.gunsandglory.widget.MyScrollView）
 * - 数值 D:\gameDemo\新版准备材料\数值\dimen_default.tsv（dialog_scale_factore=1.0 那套 mdpi 值）
 *
 * 原版 messagebox 为 dialog_large_width×dialog_large_height = 384×192；
 * MyScrollView 的 marginLeft/Right = dialog_content_margin_left/right = 57，
 * marginTop = dialog_large_padding_top = 30，marginBottom = dialog_large_padding_bottom = 35。
 * 所以滚动视口 = (384-57-57) × (192-30-35) = 270×127，视口中心相对 box 中心 (0, 2.5)。
 */

export const DIALOG_BOX_WIDTH = 384;
export const DIALOG_BOX_HEIGHT = 192;
/** 父布局 dialog_large_layout_height=272，文本框贴底，所以 192 高的框比屏幕中心低 40。 */
export const DIALOG_BOX_OFFSET_Y = -40;

export const DIALOG_SCROLL_MARGIN_LEFT = 57;
export const DIALOG_SCROLL_MARGIN_RIGHT = 57;
export const DIALOG_SCROLL_MARGIN_TOP = 30;
export const DIALOG_SCROLL_MARGIN_BOTTOM = 35;
export const DIALOG_SCROLL_PADDING_RIGHT = 10;

/** dialog_upgrade.xml 里各 TextView 相对上一个的 layout_marginTop="10.000000dip"。 */
export const DIALOG_SECTION_GAP = 10;

export interface DialogScrollBox {
    /** 滚动视口宽 = 270。 */
    width: number;
    /** 滚动视口高 = 127。 */
    height: number;
    /** 视口中心相对 messagebox 中心的 x 偏移。 */
    x: number;
    /** 视口中心相对 messagebox 中心的 y 偏移。 */
    y: number;
    /** 文字可用宽 = 270-10 = 260（scrollarea_padding_right）。 */
    textWidth: number;
    /** 文字区中心相对 messagebox 中心的 x = -5（左边缘 -135 + 260/2）。 */
    textX: number;
}

export function dialogScrollBox(boxW = DIALOG_BOX_WIDTH, boxH = DIALOG_BOX_HEIGHT): DialogScrollBox {
    const width = boxW - DIALOG_SCROLL_MARGIN_LEFT - DIALOG_SCROLL_MARGIN_RIGHT;
    const height = boxH - DIALOG_SCROLL_MARGIN_TOP - DIALOG_SCROLL_MARGIN_BOTTOM;
    const left = -boxW / 2 + DIALOG_SCROLL_MARGIN_LEFT;
    const top = boxH / 2 - DIALOG_SCROLL_MARGIN_TOP;
    const textWidth = width - DIALOG_SCROLL_PADDING_RIGHT;
    return {
        width,
        height,
        x: left + width / 2,
        y: top - height / 2,
        textWidth,
        textX: left + textWidth / 2,
    };
}

export interface DialogSection {
    /** 段落高度（dip）。 */
    height: number;
    /** 与上一个段落的间距；默认 DIALOG_SECTION_GAP（原版每段 marginTop=10）。 */
    gap?: number;
}

export interface DialogStackResult {
    /** 每段中心相对内容顶（anchor 0.5,1）的 y 坐标，均为非正数。 */
    centers: number[];
    /** 内容总高。 */
    contentHeight: number;
    /** 可滚动距离 = max(0, contentHeight - 视口高)。 */
    maxScroll: number;
}

/**
 * 按原版 RelativeLayout 的纵向 layout_below + marginTop 顺序堆段落。
 * 第一段顶边贴视口顶（scrollY=0），之后每段间隔 gap。
 */
/**
 * 估算一段文字在给定宽度下占多少高。用于创建 Label 前先排布滚动内容：
 * 中文按每字 fontSize 宽、英文按 0.55 倍估算，遇到换行符强制起新行。
 * 这是布局排版用的保守估算，实际渲染由 Cocos Label.Overflow.RESIZE_HEIGHT 兜底。
 */
export function estimateTextHeight(text: string, width: number, fontSize: number, lineHeight: number): number {
    if (!text || width <= 0 || fontSize <= 0) {
        return lineHeight;
    }
    let lines = 0;
    for (const paragraph of text.split('\n')) {
        let used = 0;
        let count = 1;
        for (const ch of paragraph) {
            const w = ch.charCodeAt(0) <= 0xff ? fontSize * 0.55 : fontSize;
            if (used + w > width && used > 0) {
                count += 1;
                used = 0;
            }
            used += w;
        }
        lines += count;
    }
    return Math.max(1, lines) * lineHeight;
}

export function stackDialogSections(sections: readonly DialogSection[], viewHeight: number): DialogStackResult {
    const centers: number[] = [];
    let cursor = 0;
    for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        if (i > 0) {
            cursor += section.gap ?? DIALOG_SECTION_GAP;
        }
        centers.push(-(cursor + section.height / 2));
        cursor += section.height;
    }
    return {
        centers,
        contentHeight: cursor,
        maxScroll: Math.max(0, cursor - viewHeight),
    };
}
