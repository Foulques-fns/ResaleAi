import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { estimations } from "@/db/schema";
import { rowToHistoryItem } from "@/lib/serialize";
export const dynamic = "force-dynamic";
export async function GET() {
    try {
        const rows = await db.select().from(estimations).orderBy(desc(estimations.createdAt)).limit(60);
        return NextResponse.json({ items: rows.map(rowToHistoryItem) });
    }
    catch {
        // DB unavailable (e.g. offline demo) — empty list, client falls back to cache
        return NextResponse.json({ items: [] });
    }
}
