// E2E ONLY (aliased in when E2E=1, see next.config.js) — in-memory stand-in for the Supabase server client.
// Implements the subset of the PostgREST query builder used by the app's API routes.
/* eslint-disable */
import { randomUUID } from "crypto";

type Row = Record<string, any>;
const g = globalThis as any;
if (!g.__fakeDb) g.__fakeDb = { users: [], interviews: [], answers: [], questions: [], notifications: [] };
export const db: Record<string, Row[]> = g.__fakeDb;

const RELATIONS: Record<string, Record<string, { table: string; fk: string }>> = {
    interviews: { answers: { table: "answers", fk: "interview_id" } },
};

function splitTop(s: string): string[] {
    const out: string[] = []; let depth = 0, cur = "";
    for (const ch of s) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

function project(table: string, row: Row, sel: string): Row {
    const parts = splitTop(sel.replace(/\s+/g, " ").trim() || "*");
    let out: Row = {};
    for (const p of parts) {
        const m = p.match(/^(\w+)\s*\((.*)\)$/);
        if (m) {
            const rel = RELATIONS[table]?.[m[1]];
            if (!rel) throw new Error(`fake db: unknown relation ${table}.${m[1]}`);
            out[m[1]] = db[rel.table].filter((r) => r[rel.fk] === row.id).map((r) => project(rel.table, r, m[2]));
        } else if (p === "*") out = { ...row, ...out };
        else out[p] = row[p];
    }
    return out;
}

const DEFAULTS: Record<string, () => Row> = {
    interviews: () => ({ started_at: new Date().toISOString(), overall_score: null, overall_feedback: null, completed_at: null, duration: null }),
    answers: () => ({ timestamp: new Date().toISOString(), strengths: [], improvements: [] }),
    users: () => ({}),
};

class Query implements PromiseLike<any> {
    private filters: ((r: Row) => boolean)[] = [];
    private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    private sel = "*";
    private payload: any = null;
    private wantSingle = false;
    private orderBy: { col: string; asc: boolean } | null = null;
    private rangeArg: [number, number] | null = null;
    private limitN: number | null = null;
    private countMode = false;
    private returning = false;
    constructor(private table: string) { if (!db[table]) db[table] = []; }

    select(sel = "*", opts?: { count?: string; head?: boolean }) { if (this.op === "select") this.sel = sel; else { this.returning = true; this.sel = sel; } if (opts?.count) this.countMode = true; return this; }
    insert(p: any) { this.op = "insert"; this.payload = p; return this; }
    upsert(p: any) { this.op = "upsert"; this.payload = p; return this; }
    update(p: any) { this.op = "update"; this.payload = p; return this; }
    delete() { this.op = "delete"; return this; }
    eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
    neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
    lt(c: string, v: any) { this.filters.push((r) => r[c] < v); return this; }
    gt(c: string, v: any) { this.filters.push((r) => r[c] > v); return this; }
    or(_expr: string) { return this; }
    order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
    range(a: number, b: number) { this.rangeArg = [a, b]; return this; }
    limit(n: number) { this.limitN = n; return this; }
    single() { this.wantSingle = true; return this; }
    maybeSingle() { this.wantSingle = true; return this; }

    private run(): { data: any; error: any; count?: number } {
        const t = db[this.table];
        const match = (r: Row) => this.filters.every((f) => f(r));
        let rows: Row[] = [];
        if (this.op === "insert" || this.op === "upsert") {
            const items = Array.isArray(this.payload) ? this.payload : [this.payload];
            for (const it of items) {
                const now = new Date().toISOString();
                const row = { id: randomUUID(), created_at: now, updated_at: now, ...(DEFAULTS[this.table]?.() ?? {}), ...it };
                if (this.table === "interviews" && !["technical", "behavioral", "system-design", "mixed"].includes(row.type))
                    return { data: null, error: { message: `invalid enum type: ${row.type}` } };
                t.push(row); rows.push(row);
            }
            if (!this.returning) return { data: null, error: null };
        } else if (this.op === "update") {
            rows = t.filter(match);
            rows.forEach((r) => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
            if (!this.returning) return { data: null, error: null };
        } else if (this.op === "delete") {
            const keep = t.filter((r) => !match(r)); const gone = t.length - keep.length;
            t.splice(0, t.length, ...keep);
            if (this.table === "interviews") { /* cascade */ db.answers = db.answers.filter((a) => t.some((i) => i.id === a.interview_id)); g.__fakeDb.answers = db.answers; }
            return { data: null, error: null, count: gone };
        } else rows = t.filter(match);

        let total = rows.length;
        if (this.orderBy) { const { col, asc } = this.orderBy; rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1)); }
        if (this.rangeArg) rows = rows.slice(this.rangeArg[0], this.rangeArg[1] + 1);
        if (this.limitN != null) rows = rows.slice(0, this.limitN);
        let data: any;
        try { data = rows.map((r) => project(this.table, r, this.sel)); } catch (e: any) { return { data: null, error: { message: e.message } }; }
        if (this.wantSingle) {
            if (data.length === 0) return { data: null, error: { code: "PGRST116", message: "no rows" } };
            data = data[0];
        }
        return { data: JSON.parse(JSON.stringify(data)), error: null, count: this.countMode ? total : undefined };
    }
    then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
        return Promise.resolve().then(() => this.run()).then(ok, bad);
    }
}

export function createClient() {
    return { from: (table: string) => new Query(table) } as any;
}
