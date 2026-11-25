import { Asset, AssetManager, BufferAsset, TextAsset, assetManager } from 'cc';

// 真机小游戏运行时（JSCore）没有 Web API TextDecoder/TextEncoder，顶层 new 会直接抛
// ReferenceError 导致整个模块加载失败（开发者工具的浏览器内核有，所以只在真机复现）。
// 表格已改为 text importer，assetToText 主路径走 TextAsset.text，正常不会用到解码；
// 这里保留一个纯 JS 的 UTF-8 解码兜底，彻底去掉对平台缺失 API 的依赖。
function utf8Decode(bytes: Uint8Array): string {
    let out = '';
    const len = bytes.length;
    for (let i = 0; i < len;) {
        const b0 = bytes[i];
        if (b0 < 0x80) {
            out += String.fromCharCode(b0);
            i += 1;
        } else if ((b0 & 0xe0) === 0xc0 && i + 1 < len) {
            const b1 = bytes[i + 1];
            if ((b1 & 0xc0) !== 0x80) { out += '\ufffd'; i += 1; continue; }
            out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
            i += 2;
        } else if ((b0 & 0xf0) === 0xe0 && i + 2 < len) {
            const b1 = bytes[i + 1];
            const b2 = bytes[i + 2];
            if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) { out += '\ufffd'; i += 1; continue; }
            out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
            i += 3;
        } else if ((b0 & 0xf8) === 0xf0 && i + 3 < len) {
            const b1 = bytes[i + 1];
            const b2 = bytes[i + 2];
            const b3 = bytes[i + 3];
            if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) { out += '\ufffd'; i += 1; continue; }
            const cp = (((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)) - 0x10000;
            out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
            i += 4;
        } else {
            out += '\ufffd';
            i += 1;
        }
    }
    return out;
}

// 地图二进制资源统一用 .bin（buffer importer → cc.BufferAsset）。
// 早期用自定义扩展名 .tdm + 注册 downloader 强制 arraybuffer，在浏览器预览可用；
// 但抖音/微信小游戏构建后，包内 .tdm 不在平台适配器的本地读取白名单里，
// 被引擎当成远程资源发 tt.request（相对路径不是合法 URL）导致 status: 0 下载失败。
// 改用 .bin 后：引擎按 BufferAsset 从包内文件系统读取，assetToBytes 走 buffer() 分支，
// 不再需要任何自定义 downloader，浏览器预览和小游戏构建行为一致。

export function loadBundle(name: string): Promise<AssetManager.Bundle> {
    return new Promise((resolve, reject) => {
        assetManager.loadBundle(name, (err, bundle) => {
            if (err || !bundle) {
                reject(err ?? new Error(`[Assets] 找不到包 ${name}`));
                return;
            }
            resolve(bundle);
        });
    });
}

export function loadAsset(bundle: AssetManager.Bundle, path: string): Promise<Asset> {
    return new Promise((resolve, reject) => {
        bundle.load(path, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`[Assets] 读不到 ${path}`));
                return;
            }
            resolve(asset as Asset);
        });
    });
}

async function nativeBytes(asset: Asset): Promise<Uint8Array> {
    const url = asset.nativeUrl;
    if (!url) {
        throw new Error(`[Assets] ${asset.name} 没有 nativeUrl`);
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`[Assets] 拉取 ${url} 失败 ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
}

export async function assetToBytes(asset: Asset): Promise<Uint8Array> {
    if (asset instanceof BufferAsset) {
        return new Uint8Array(asset.buffer());
    }
    const anyA = asset as any;
    if (typeof anyA.buffer === 'function') {
        const buf = anyA.buffer();
        if (buf) {
            return new Uint8Array(buf);
        }
    }
    if (anyA._file instanceof ArrayBuffer) {
        return new Uint8Array(anyA._file);
    }
    if (anyA._file instanceof Uint8Array) {
        return anyA._file;
    }
    if (typeof anyA._nativeAsset === 'string') {
        return nativeBytes(asset);
    }
    if (anyA._nativeAsset instanceof ArrayBuffer) {
        return new Uint8Array(anyA._nativeAsset);
    }
    if (anyA._nativeAsset instanceof Uint8Array) {
        return anyA._nativeAsset;
    }
    return nativeBytes(asset);
}

export async function assetToText(asset: Asset): Promise<string> {
    if (asset instanceof TextAsset) {
        return asset.text;
    }
    const anyA = asset as any;
    if (typeof anyA.text === 'string') {
        return anyA.text;
    }
    if (typeof anyA._nativeAsset === 'string') {
        return anyA._nativeAsset;
    }
    const bytes = await assetToBytes(asset);
    let text = utf8Decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }
    return text;
}

export async function loadText(bundle: AssetManager.Bundle, path: string): Promise<string> {
    try {
        return await assetToText(await loadAsset(bundle, path));
    } catch (err) {
        console.error('[Assets] 读表失败', path, err);
        throw err;
    }
}

export async function loadBytes(bundle: AssetManager.Bundle, path: string): Promise<Uint8Array> {
    try {
        return await assetToBytes(await loadAsset(bundle, path));
    } catch (err) {
        console.error('[Assets] 读文件失败', path, err);
        throw err;
    }
}
