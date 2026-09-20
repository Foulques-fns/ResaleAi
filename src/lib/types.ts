export type Lang = "fr" | "en";

export type Condition = "new" | "like_new" | "good" | "fair" | "poor";

export const CONDITIONS: Condition[] = ["new", "like_new", "good", "fair", "poor"];

export interface Listing {
  title: string;
  price: number;
  currency: string;
  url: string;
  source: string; // vinted | dealabs | ebay | leboncoin | web
  sourceLabel: string; // "Vinted", "eBay", ...
  brand?: string;
  conditionText?: string;
  image?: string;
  date?: string;
  soldOut?: boolean;
}

export interface IdentificationHypothesis {
  label: string;
  brand?: string;
  model?: string;
  category?: string;
  confidence: number; // 0..1
  rationale?: string;
}

export interface SearchLogEntry {
  provider: string;
  status: "ok" | "empty" | "error";
  count: number;
  ms: number;
  message?: string;
}

export interface PriceStats {
  sampleSize: number; // annonces PERTINENTES ayant servi au calcul
  keptSample: number; // aprés tri neuf/occasion, proximité d'état et outliers
  usedSample?: number; // annonces d'occasion dans le pool pertinent
  droppedIrrelevant?: number; // annonces écartées car ne correspondant pas à l'objet
  relevanceLevel?: number; // 0 strict → 3 sans filtre
  sources: { source: string; label: string; count: number }[];
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  outliersRemoved: number;
  newPriceHint?: number; // prix du neuf repéré sur le web (indicatif)
}

export type Anomaly = { listing: Listing; kind: "suspicious_low" | "suspicious_high"; reason: string };

export interface PriceInsights {
  rarity: "rare" | "uncommon" | "common" | "very_common" | "unknown";
  demand: "high" | "medium" | "low" | "unknown";
  sellDaysLow: number;
  sellDaysHigh: number;
  anomalies: Anomaly[];
}

export interface EstimateAdvice {
  platforms: { name: string; reason: string; url?: string }[];
  keywords: string[];
  photoTips: string[];
  periodNote: string;
  negociationTip?: string;
}

export interface EstimatePayload {
  images: string[];
  condition: Condition;
  notes?: string;
  lang: Lang;
  manualQuery?: string;
  barcode?: string;
  confirmedLabel?: string;
  confirmedBrand?: string;
  confirmedModel?: string;
}

export interface EstimateResult {
  id: string;
  createdAt: string;
  lang: Lang;
  itemName: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  confidence: number;
  aiSource: "ai" | "manual";
  aiAvailable: boolean;
  hypotheses: IdentificationHypothesis[];
  photos: string[];
  condition: Condition;
  queryText: string;
  listings: Listing[];
  stats: PriceStats;
  priceLow: number;
  priceMid: number;
  priceHigh: number;
  currency: string;
  insights: PriceInsights;
  advice: EstimateAdvice;
  listingCopy: string;
  warnings: string[];
  searchLog: SearchLogEntry[];
  soldPrice: number | null;
  soldPlatform: string | null;
  soldAt: string | null;
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  itemName: string;
  brand: string | null;
  thumb: string | null;
  priceLow: number;
  priceMid: number;
  priceHigh: number;
  currency: string;
  soldPrice: number | null;
  sampleSize: number;
}
