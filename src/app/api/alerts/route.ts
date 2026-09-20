import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { priceAlerts } from "@/db/schema";
import { liveSearchComparables, buildQuery } from "@/lib/search";
import { computePrice, marketMedian } from "@/lib/pricing";
import { filterRelevant } from "@/lib/relevance";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(priceAlerts).orderBy(desc(priceAlerts.createdAt)).limit(50);
    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        query: r.query,
        itemLabel: r.itemLabel,
        currency: r.currency,
        baselineMid: r.baselineMid,
        baselineLow: r.baselineLow,
        baselineHigh: r.baselineHigh,
        direction: r.direction,
        active: r.active,
        lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
        lastMid: r.lastMid,
        lastChangePct: r.lastChangePct,
      })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: Request) {
  let body: { query?: string; itemLabel?: string; direction?: string; lang?: Lang };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (query.length < 3) return NextResponse.json({ error: "query too short" }, { status: 400 });
  const lang: Lang = body.lang === "en" ? "en" : "fr";
  const direction = ["rise", "drop", "any"].includes(body.direction ?? "") ? body.direction! : "any";

  // Baseline from a REAL live search at creation time: relevance-filtered,
  // used-only market median — the exact same metric used by /api/alerts/check.
  const { listings } = await liveSearchComparables(buildQuery({ name: query }), lang);
  const snap = marketMedian(listings, query);
  const { relevant } = filterRelevant(listings, { name: query });
  const computed = computePrice(relevant, "good", lang);
  const baseline = snap.mid || computed.stats.median || computed.mid;

  try {
    const [row] = await db
      .insert(priceAlerts)
      .values({
        query,
        itemLabel: (body.itemLabel ?? query).trim(),
        currency: lang === "en" ? "GBP" : "EUR",
        baselineMid: baseline,
        baselineLow: computed.low,
        baselineHigh: computed.high,
        direction,
        lastCheckedAt: new Date(),
        lastMid: baseline,
        lastChangePct: 0,
      })
      .returning();
    return NextResponse.json({
      id: row.id,
      baselineMid: row.baselineMid,
      sampleSize: snap.sample || computed.stats.sampleSize,
    });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
