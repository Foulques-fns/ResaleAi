import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { priceAlerts } from "@/db/schema";
import { liveSearchComparables } from "@/lib/search";
import { marketMedian } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * Re-runs a REAL live web search for the alert query and compares the
 * current market median against the baseline stored at creation.
 */
export async function POST(req: Request) {
  let body: { id?: string; lang?: "fr" | "en" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const lang = body.lang === "en" ? "en" : "fr";
if (!db) {
  return NextResponse.json(
    { error: "database_unavailable" },
    { status: 503 }
  );
}

  const rows = await db
  .select()
  .from(priceAlerts)
  .where(eq(priceAlerts.id, body.id))
  .limit(1);
  const alert = rows[0];
  if (!alert) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { listings, logs } = await liveSearchComparables(alert.query, lang);
  const snap = marketMedian(listings, alert.query);
  const currentMid = snap.sample >= 2 ? snap.mid : alert.baselineMid;
  const changePct =
    alert.baselineMid > 0 ? Math.round(((currentMid - alert.baselineMid) / alert.baselineMid) * 1000) / 10 : 0;

  const triggered =
    Math.abs(changePct) >= 8 &&
    (alert.direction === "any" || (alert.direction === "rise" && changePct > 0) || (alert.direction === "drop" && changePct < 0));

  await db
    .update(priceAlerts)
    .set({ lastCheckedAt: new Date(), lastMid: currentMid, lastChangePct: changePct })
    .where(eq(priceAlerts.id, alert.id));

  return NextResponse.json({
    triggered,
    changePct,
    currentMid,
    baselineMid: alert.baselineMid,
    sampleSize: snap.sample,
    currency: alert.currency,
    logs: logs.map((l) => ({ provider: l.provider, status: l.status, count: l.count })),
    topListings: listings.slice(0, 5),
  });
}
