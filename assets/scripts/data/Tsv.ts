/**
 * 按表头读 TSV：第一行是列名，取值只用列名，不用从左边数第几列。
 * 缺列或空单元格返回 undefined，不抛错。
 */
export class TsvTable {
    readonly name: string;
    readonly headers: readonly string[];
    readonly rows: ReadonlyArray<Readonly<Record<string, string>>>;
    private readonly _headerSet: Set<string>;

    private constructor(name: string, headers: string[], rows: Record<string, string>[]) {
        this.name = name;
        this.headers = headers;
        this.rows = rows;
        this._headerSet = new Set(headers);
    }

    static parse(name: string, text: string): TsvTable {
        let src = text;
        if (src.charCodeAt(0) === 0xfeff) {
            src = src.slice(1);
        }
        const lines = src.split(/\r\n|\n|\r/);
        while (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        if (lines.length === 0) {
            return new TsvTable(name, [], []);
        }
        const headers = lines[0].split('\t');
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = lines[i].split('\t');
            const rec: Record<string, string> = {};
            for (let c = 0; c < headers.length; c++) {
                rec[headers[c]] = c < cells.length ? cells[c] : '';
            }
            rows.push(rec);
        }
        return new TsvTable(name, headers, rows);
    }

    hasColumn(column: string): boolean {
        return this._headerSet.has(column);
    }

    str(row: Readonly<Record<string, string>>, column: string): string | undefined {
        if (!this._headerSet.has(column)) {
            return undefined;
        }
        return row[column];
    }

    num(row: Readonly<Record<string, string>>, column: string): number | undefined {
        const raw = this.str(row, column);
        if (raw === undefined) {
            return undefined;
        }
        const s = raw.trim();
        if (s === '') {
            return undefined;
        }
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
    }

    findAll(column: string, value: string | number): Readonly<Record<string, string>>[] {
        const want = String(value);
        return this.rows.filter((row) => this.str(row, column) === want);
    }

    find(column: string, value: string | number): Readonly<Record<string, string>> | undefined {
        return this.findAll(column, value)[0];
    }
}
