import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { estimations } from "@/db/schema";
import { rowToEstimateResult } from "@/lib/serialize";
export const dynamic = "force-dynamic";
export async function GET(_req, ctx) {
    const { id } = await ctx.params;
    try {
        const rows = await db.select().from(estimations).where(eq(estimations.id, id)).limit(1);
        if (!rows.length)
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        return NextResponse.json(rowToEstimateResult(rows[0]));
    }
    catch {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
}
export async function DELETE(_req, ctx) {
    const { id } = await ctx.params;
    try {
        await db.delete(estimations).where(eq(estimations.id, id));
        return NextResponse.json({ ok: true });
    }
    catch {
        return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
}
export async function PATCH(req, ctx) {
    const { id } = await ctx.params;
    let body;
    try {
        body = await req.json();
    }
    catch {
        return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }
    const soldPrice = body.soldPrice;
    if (soldPrice !== null && (typeof soldPrice !== "number" || soldPrice < 0 || soldPrice > 1000000)) {
        return NextResponse.json({ error: "invalid soldPrice" }, { status: 400 });
    }
    try {
        const [row] = await db
            .update(estimations)
            .set({
            soldPrice: soldPrice ?? null,
            soldPlatform: soldPrice ? (body.soldPlatform ?? null) : null,
            soldAt: soldPrice ? new Date() : null,
        })
            .where(eq(estimations.id, id))
            .returning();
        if (!row)
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        return NextResponse.json(rowToEstimateResult(row));
    }
    catch {
        return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
}
