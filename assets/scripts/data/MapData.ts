/**
 * 地图文件：第 1 字节是列数，第 2 字节是行数，后面是逐格字节（行优先）。
 */
export class MapGrid {
    readonly name: string;
    readonly cols: number;
    readonly rows: number;
    readonly cells: Uint8Array;

    private constructor(name: string, cols: number, rows: number, cells: Uint8Array) {
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.cells = cells;
    }

    static parse(name: string, bytes: Uint8Array): MapGrid {
        if (bytes.length < 2) {
            throw new Error(`[Map] ${name} 太短`);
        }
        const cols = bytes[0];
        const rows = bytes[1];
        const expect = cols * rows;
        const got = bytes.length - 2;
        if (got < expect) {
            throw new Error(`[Map] ${name} 格子不够：${cols}x${rows} 需要 ${expect}，实际 ${got}`);
        }
        return new MapGrid(name, cols, rows, bytes.subarray(2, 2 + expect));
    }

    at(col: number, row: number): number | undefined {
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
            return undefined;
        }
        return this.cells[row * this.cols + col];
    }
}
