import { NextResponse } from "next/server";
import { db } from "@/db";
import { estimations } from "@/db/schema";
import { getAIProvider, identifyFromImages } from "@/lib/ai";
import { buildAdvice, buildListingCopy, buildWarnings } from "@/lib/advice";
import { computePrice } from "@/lib/pricing";
import { filterRelevant } from "@/lib/relevance";
import { buildQuery, liveSearchComparables } from "@/lib/search";
import { CONDITIONS } from "@/lib/types";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
function bad(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
export async function POST(req) {
    let body;
    try {
        body = (await req.json());
    }
    catch {
        return bad("invalid JSON");
    }
    const lang = body.lang === "en" ? "en" : "fr";
    const phase = body.phase === "identify" ? "identify" : "estimate";
    const images = Array.isArray(body.images) ? body.images.slice(0, 5) : [];
    const condition = CONDITIONS.includes(body.condition) ? body.condition : "good";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : "";
    const aiAvailable = getAIProvider() !== null;
    /* ------------------------------ Phase 1 : identification ------------------------------ */
    let hypotheses;
    hypotheses = [];
    let aiCategory = null;
    let suspicious = null;
    let aiConfidence = 0;
    if (images.length > 0 && aiAvailable) {
        const id = await identifyFromImages(images, lang, notes);
        if (id) {
            hypotheses = id.hypotheses;
            aiCategory = id.category;
            suspicious = id.suspicious;
            aiConfidence = hypotheses[0]?.confidence ?? 0;
        }
    }
    if (phase === "identify") {
        return NextResponse.json({
            aiAvailable,
            hypotheses,
            suspicious,
            category: aiCategory,
            readText: [],
        });
    }
    /* ------------------------------ Phase 2 : recherche + estimation ------------------------------ */
    const top = hypotheses[0];
    const itemName = (body.confirmedLabel ?? "").trim() ||
        body.manualQuery?.trim() ||
        top?.label ||
        (lang === "en" ? "Unidentified item" : "Objet non identifié");
    const brand = (body.confirmedBrand ?? "").trim() || top?.brand || null;
    const model = (body.confirmedModel ?? "").trim() || top?.model || null;
    const category = body.confirmedLabel ? null : (top?.category ?? aiCategory);
    const queryText = buildQuery({
        name: itemName,
        brand,
        model,
        keywords: body.barcode ? [body.barcode] : undefined,
    });
    // REAL live web search — always fresh, never cached
    const search = await liveSearchComparables(queryText, lang);
    const logs = search.logs;
    // Relevance check: only listings that actually match the identified
    // object (brand / model / keywords) are allowed into the price math.
    const { relevant, dropped, level } = filterRelevant(search.listings, {
        name: itemName,
        brand,
        model,
    });
    const computed = computePrice(relevant, condition, lang);
    computed.stats.droppedIrrelevant = dropped.length;
    computed.stats.relevanceLevel = level;
    const listings = relevant;
    const advice = buildAdvice({
        category,
        lang,
        stats: computed.stats,
        rarity: computed.insights.rarity,
        isEn: lang === "en",
    });
    const warnings = buildWarnings({
        category,
        suspicious,
        stats: computed.stats,
        priceMid: computed.mid,
        lang,
        aiAvailable,
    });
    const listingCopy = buildListingCopy({
        itemName,
        brand,
        model,
        category,
        condition,
        notes,
        priceMid: computed.mid,
        currency: lang === "en" ? "GBP" : "EUR",
        lang,
    });
    const aiSource = aiAvailable && images.length > 0 ? "ai" : "manual";
    const photosStored = images.map((img) => (typeof img === "string" ? img : "")).filter(Boolean).slice(0, 5);
    try {
        const [row] = await db
            .insert(estimations)
            .values({
            lang,
            input: {
                photos: photosStored,
                thumb: body.thumb ?? photosStored[0] ?? "",
                notes,
                condition,
                manualQuery: body.manualQuery,
                barcode: body.barcode,
            },
            itemName,
            brand,
            model,
            category,
            confidence: body.confirmedLabel ? (aiAvailable && top ? top.confidence : 0) : aiConfidence,
            aiSource,
            hypotheses,
            queryText,
            condition,
            listings,
            stats: computed.stats,
            priceLow: computed.low,
            priceMid: computed.mid,
            priceHigh: computed.high,
            currency: lang === "en" ? "GBP" : "EUR",
            rarity: computed.insights.rarity,
            demand: computed.insights.demand,
            sellDaysLow: computed.insights.sellDaysLow,
            sellDaysHigh: computed.insights.sellDaysHigh,
            advice,
            listingCopy,
            warnings,
            searchLog: logs,
        })
            .returning({ id: estimations.id, createdAt: estimations.createdAt });
        return NextResponse.json({
            id: row.id,
            createdAt: row.createdAt.toISOString(),
            lang,
            itemName,
            brand,
            model,
            category,
            confidence: body.confirmedLabel ? (aiAvailable && top ? top.confidence : 0) : aiConfidence,
            aiSource,
            aiAvailable,
            hypotheses,
            condition,
            queryText,
            listings,
            stats: computed.stats,
            priceLow: computed.low,
            priceMid: computed.mid,
            priceHigh: computed.high,
            currency: lang === "en" ? "GBP" : "EUR",
            insights: computed.insights,
            advice,
            listingCopy,
            warnings,
            searchLog: logs,
        });
    }
    catch (e) {
        return NextResponse.json({ error: "database_error", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
