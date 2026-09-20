import { conditionProximity, filterRelevant, usedPool } from "./relevance";
import type { Anomaly, Condition, Listing, PriceInsights, PriceStats } from "./types";

/**
 * Raw market median for price alerts: relevance-filtered + used-only,
 * symmetric between alert creation and live re-checks.
 */
export function marketMedian(listings: Listing[], queryName: string): { mid: number; sample: number } {
  const { relevant } = filterRelevant(listings, { name: queryName });
  const { used } = usedPool(relevant);
  const pool = used.length >= 2 ? used : relevant;
  const prices = pool.map((l) => l.price).filter((p) => p > 0);
  return { mid: prices.length ? median(prices) : 0, sample: prices.length };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Remove statistical outliers via IQR; returns kept listings + flagged anomalies. */
export function filterOutliers(listings: Listing[]): {
  kept: Listing[];
  lowOutliers: Listing[];
  highOutliers: Listing[];
} {
  const withPrice = listings.filter((l) => Number.isFinite(l.price) && l.price > 0);
  if (withPrice.length < 5) {
    return { kept: withPrice, lowOutliers: [], highOutliers: [] };
  }
  const prices = withPrice.map((l) => l.price);
  const q1 = percentile(prices, 0.25);
  const q3 = percentile(prices, 0.75);
  const iqr = q3 - q1;
  const lowFence = Math.max(0, q1 - 1.8 * iqr);
  const highFence = q3 + 2.2 * iqr;
  const kept: Listing[] = [];
  const lowOutliers: Listing[] = [];
  const highOutliers: Listing[] = [];
  for (const l of withPrice) {
    if (l.price < lowFence) lowOutliers.push(l);
    else if (l.price > highFence) highOutliers.push(l);
    else kept.push(l);
  }
  return { kept, lowOutliers, highOutliers };
}

export function roundNice(n: number): number {
  if (n <= 0) return 0;
  if (n < 10) return Math.round(n * 2) / 2; // .5 steps
  if (n < 30) return Math.round(n);
  if (n < 100) return Math.round(n / 2) * 2;
  if (n < 500) return Math.round(n / 5) * 5;
  if (n < 2000) return Math.round(n / 10) * 10;
  return Math.round(n / 50) * 50;
}

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "Neuf",
  like_new: "Très bon état",
  good: "Bon état",
  fair: "État correct",
  poor: "Mauvais état / abîmé",
};

const CONDITION_FACTORS: Record<Condition, { low: number; mid: number; high: number }> = {
  new: { low: 1.0, mid: 1.18, high: 1.45 },
  like_new: { low: 0.9, mid: 1.0, high: 1.2 },
  good: { low: 0.72, mid: 0.85, high: 1.0 },
  fair: { low: 0.5, mid: 0.62, high: 0.8 },
  poor: { low: 0.28, mid: 0.4, high: 0.55 },
};

export interface ComputedPrice {
  stats: PriceStats;
  insights: PriceInsights;
  low: number;
  mid: number;
  high: number;
}

export function computePrice(
  listings: Listing[],
  condition: Condition,
  lang: "fr" | "en" = "fr",
): ComputedPrice {
  // 1) split neuf vs occasion — le neuf n'influe PAS sur la fourchette de revente
  const { used, newItems } = usedPool(listings);
  // 2) pool de base = occasion si suffisamment de données, sinon tout
  const basePool = used.length >= 3 ? used : listings.filter((l) => l.price > 0);
  // 3) proximité d'état déclaré (souple)
  const proximityPool = conditionProximity(basePool, condition);
  // 4) outliers statistiques
  const { kept, lowOutliers, highOutliers } = filterOutliers(proximityPool);
  const pool = kept.length >= 3 ? kept : proximityPool.filter((l) => l.price > 0);
  const prices = pool.map((l) => l.price).sort((a, b) => a - b);
  const n = prices.length;

  const anomalies: Anomaly[] = [
    ...lowOutliers.map((l) => ({
      listing: l,
      kind: "suspicious_low" as const,
      reason:
        lang === "fr"
          ? "Prix anormalement bas — possible contrefaçon, pièce défectueuse ou erreur de saisie. Prudence : à ne pas utiliser comme référence."
          : "Abnormally low price — possible counterfeit, defective item or typo. Do not use as a reference.",
    })),
    ...highOutliers.map((l) => ({
      listing: l,
      kind: "suspicious_high" as const,
      reason:
        lang === "fr"
          ? "Prix très au-dessus du marché — vendeur optimiste ou édition spéciale. Peu représentatif."
          : "Price well above the market — optimistic seller or special edition. Not representative.",
    })),
  ];

  const sourceMap = new Map<string, { source: string; label: string; count: number }>();
  for (const l of listings) {
    const cur = sourceMap.get(l.source) ?? { source: l.source, label: l.sourceLabel, count: 0 };
    cur.count += 1;
    sourceMap.set(l.source, cur);
  }

  const stats: PriceStats = {
    sampleSize: listings.length,
    keptSample: pool.length,
    usedSample: used.length,
    sources: [...sourceMap.values()],
    min: n ? prices[0] : 0,
    p25: n ? percentile(prices, 0.25) : 0,
    median: n ? median(prices) : 0,
    p75: n ? percentile(prices, 0.75) : 0,
    max: n ? prices[n - 1] : 0,
    outliersRemoved: lowOutliers.length + highOutliers.length,
    newPriceHint:
      newItems.length > 0
        ? median(newItems.map((l) => l.price).filter((p) => p > 0))
        : undefined,
  };

  const f = CONDITION_FACTORS[condition];
  let low = roundNice(stats.p25 * f.low);
  let mid = roundNice(stats.median * f.mid);
  let high = roundNice(stats.p75 * f.high);
  if (n > 0) {
    if (mid <= 0) mid = roundNice(stats.median * 0.85) || stats.median;
    if (low <= 0) low = roundNice(mid * 0.7);
    if (high < mid) high = mid;
    if (low > mid) low = roundNice(mid * 0.6);
  }

  // ---- insights : rareté / demande / délai
  let rarity: PriceInsights["rarity"] = "unknown";
  if (n === 0) rarity = "unknown";
  else if (n <= 3) rarity = "rare";
  else if (n <= 7) rarity = "uncommon";
  else if (n <= 15) rarity = "common";
  else rarity = "very_common";

  let demand: PriceInsights["demand"] = "unknown";
  if (n >= 12) demand = "high";
  else if (n >= 6) demand = "medium";
  else if (n >= 2) demand = "low";
  else if (n > 0) demand = "low";

  let sellDaysLow = 7;
  let sellDaysHigh = 45;
  if (demand === "high" && condition !== "poor") {
    sellDaysLow = 1;
    sellDaysHigh = 10;
  } else if (demand === "high") {
    sellDaysLow = 3;
    sellDaysHigh = 21;
  } else if (demand === "medium") {
    sellDaysLow = 5;
    sellDaysHigh = 30;
  } else if (demand === "low" && rarity === "rare") {
    sellDaysLow = 21;
    sellDaysHigh = 180;
  } else if (demand === "low") {
    sellDaysLow = 14;
    sellDaysHigh = 75;
  } else {
    sellDaysLow = 7;
    sellDaysHigh = 60;
  }

  return {
    stats,
    insights: { rarity, demand, sellDaysLow, sellDaysHigh, anomalies },
    low,
    mid,
    high,
  };
}
