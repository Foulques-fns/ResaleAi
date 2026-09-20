import type { EstimationRow } from "@/db/schema";
import { getAIProvider } from "./ai";
import { filterOutliers } from "./pricing";
import { usedPool } from "./relevance";
import type { Anomaly, EstimateResult, HistoryItem, Lang } from "./types";

function recomputeAnomalies(row: EstimationRow): Anomaly[] {
  const lang = row.lang === "en" ? "en" : "fr";
  const all = row.listings ?? [];
  const { used } = usedPool(all);
  const pool = used.length >= 3 ? used : all;
  const { lowOutliers, highOutliers } = filterOutliers(pool);
  return [
    ...lowOutliers.map((l) => ({
      listing: l,
      kind: "suspicious_low" as const,
      reason:
        lang === "fr"
          ? "Prix anormalement bas — possible contrefaçon, pièce défectueuse ou erreur de saisie."
          : "Abnormally low price — possible counterfeit, defective item or typo.",
    })),
    ...highOutliers.map((l) => ({
      listing: l,
      kind: "suspicious_high" as const,
      reason:
        lang === "fr"
          ? "Prix très au-dessus du marché — vendeur optimiste ou édition spéciale."
          : "Price well above the market — optimistic seller or special edition.",
    })),
  ];
}

export function rowToEstimateResult(row: EstimationRow): EstimateResult {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    lang: (row.lang === "en" ? "en" : "fr") as Lang,
    itemName: row.itemName,
    brand: row.brand,
    model: row.model,
    category: row.category,
    confidence: row.confidence ?? 0,
    aiSource: row.aiSource === "ai" ? "ai" : "manual",
    aiAvailable: getAIProvider() !== null,
    hypotheses: row.hypotheses,
    photos: row.input.photos ?? [],
    condition: row.condition,
    queryText: row.queryText,
    listings: row.listings,
    stats: row.stats,
    priceLow: row.priceLow,
    priceMid: row.priceMid,
    priceHigh: row.priceHigh,
    currency: row.currency,
    insights: {
      rarity: (row.rarity as EstimateResult["insights"]["rarity"]) ?? "unknown",
      demand: (row.demand as EstimateResult["insights"]["demand"]) ?? "unknown",
      sellDaysLow: row.sellDaysLow,
      sellDaysHigh: row.sellDaysHigh,
      anomalies: recomputeAnomalies(row),
    },
    advice: row.advice,
    listingCopy: row.listingCopy,
    warnings: row.warnings,
    searchLog: row.searchLog,
    soldPrice: row.soldPrice,
    soldPlatform: row.soldPlatform,
    soldAt: row.soldAt ? row.soldAt.toISOString() : null,
  };
}

export function rowToHistoryItem(row: EstimationRow): HistoryItem {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    itemName: row.itemName,
    brand: row.brand,
    thumb: row.input.thumb ?? row.input.photos?.[0] ?? null,
    priceLow: row.priceLow,
    priceMid: row.priceMid,
    priceHigh: row.priceHigh,
    currency: row.currency,
    soldPrice: row.soldPrice,
    sampleSize: row.stats?.sampleSize ?? 0,
  };
}
