// Test-only control endpoint for the e2e suite. Returns 404 unless E2E=1.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getDb(): Promise<Record<string, any[]> | null> {
    if (process.env.E2E !== "1") return null;
    const mod: any = await import("@/lib/supabase/server"); // the in-memory stub when E2E=1
    return mod.db ?? null;
}

export async function GET() {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(db);
}

export async function POST(req: NextRequest) {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = await req.json();
    if (b.action === "reset") for (const k of Object.keys(db)) db[k].splice(0);
    if (b.action === "patch") Object.assign(db[b.table].find((x: any) => x.id === b.id) ?? {}, b.values);
    return NextResponse.json({ ok: true });
}
