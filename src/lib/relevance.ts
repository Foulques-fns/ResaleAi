import type { Listing } from "./types";

/**
 * Relevance engine: checks that a fetched listing actually matches the
 * identified object (brand / model / keywords) before it is allowed to
 * influence the price range. Progressive relaxation guarantees we never
 * end up with an empty sample when strict matching is too aggressive.
 */

const STOPWORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "au", "aux", "et", "en", "pour", "avec", "sans", "sur", "par", "d", "l",
  "the", "a", "an", "of", "for", "with", "and", "to", "in", "on",
]);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of normalizeText(s).split(" ")) {
    if (raw.length < 2 || STOPWORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/** Accessory / spam noise (multilingual: fr/en/de/it/es): titles that mention
 *  these while the object itself doesn't are never comparable. */
const ACCESSORY_NOISE = [
  // cases / covers / sleeves
  "coque", "coques", "housse", "housses", "etui", "case", "cover", "covers", "custodia", "carcasa",
  "funda", "fundas", "hulle", "hullen", "schutzhulle", "tasche", "tas ", "porta", "sleeve",
  // protections
  "protection", "protector", "verre", "vitre", "film", "sticker", "skin", "panzerglas", "pellicola",
  // generic accessories
  "pochette", "sacoche", "accessoire", "accessoires", "accessori", "accesori", "accessorios",
  "accessories", "accessory", "zubehor", "dock", "docking", "ladestation", "laccetti",
  "strap", "straps", "laniere", "grip", "grips", "stand", "support", "supporto", "halterung",
  "joystick", "joycon", "joy con", "manette seule", "volant", "wheel",
  // power / cables
  "chargeur", "charger", "cable", "adaptateur", "adapter", "alimentation",
];

/** Defective / parts noise: item is not a working comparable. */
const DEFECT_NOISE = [
  "pour piece", "pieces detachees", "piece detachee", "en panne", "hors service", " hs ",
  "defectueux", "defectueuse", "ne fonctionne pas", "ne s allume plus", "bloque",
  "for parts", "spares", "broken", "defekt", "kaputt", "scherm", "ecran casse", "fissure",
];

/** True when the listing is accessory/noise relative to the searched object. */
export function isAccessoryNoise(title: string, queryTokens: string[]): boolean {
  const norm = normalizeText(title);
  const words = new Set(norm.split(" "));
  for (const noise of ACCESSORY_NOISE) {
    const clean = normalizeText(noise);
    if (clean.length < 3) continue;
    if (clean.includes(" ")) {
      if (norm.includes(clean) && !queryTokens.some((t) => clean.includes(t))) return true;
    } else if (words.has(clean) && !queryTokens.some((t) => t === clean || t.startsWith(clean))) {
      return true;
    }
  }
  for (const noise of DEFECT_NOISE) {
    const clean = normalizeText(noise);
    if (clean.length < 2) continue;
    const hit = clean.includes(" ") ? norm.includes(clean) : words.has(clean);
    if (hit && !queryTokens.some((t) => clean.includes(t))) return true;
  }
  return false;
}

/** Builds matching tokens from the identified object. */
export function buildQueryTokens(parts: {
  name?: string;
  brand?: string | null;
  model?: string | null;
}): { tokens: string[]; brandTokens: string[]; modelTokens: string[] } {
  const brandTokens = tokenize(parts.brand ?? "");
  const modelTokens = tokenize(parts.model ?? "");
  const nameTokens = tokenize(parts.name ?? "");
  const seen = new Set<string>([...brandTokens, ...modelTokens]);
  const tokens = [...brandTokens, ...modelTokens];
  for (const t of nameTokens) {
    if (!seen.has(t)) {
      seen.add(t);
      tokens.push(t);
    }
  }
  return { tokens, brandTokens, modelTokens };
}

function listingHaystack(l: Listing): string {
  return normalizeText(`${l.title} ${l.brand ?? ""}`);
}

function tokenMatch(haystack: string, token: string): boolean {
  // substring match handles concatenations ("Levi's" -> "levis" vs "levi") and model refs
  if (haystack.includes(token)) return true;
  // token may itself contain the haystack word with extra chars — tolerate stems ≥5
  if (token.length >= 5) {
    for (const w of haystack.split(" ")) {
      if (w.length >= 5 && (token.startsWith(w) || w.startsWith(token))) return true;
    }
  }
  return false;
}

/**
 * Model-reference match: avoids false positives like "RAM 12 Go" for model "12".
 * Short numeric refs must appear as an exact word ADJACENT (±1 word) to another
 * query token (brand/name) — e.g. "iphone 12 pro", "levis 501 w34".
 */
function modelTokenMatch(haystack: string, modelToken: string, queryTokens: string[]): boolean {
  const words = haystack.split(" ");
  const others = queryTokens.filter((t) => t !== modelToken);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // concatenated forms: "iphone12", "12mini" — model + another query token fused in one word
    if (w.length > modelToken.length && w.includes(modelToken) && others.some((t) => t.length >= 3 && w.includes(t))) {
      return true;
    }
    const exact =
      modelToken.length <= 4
        ? w === modelToken || (/^\d+$/.test(modelToken) && w.startsWith(modelToken) && /^[a-z]+$/.test(w.slice(modelToken.length)))
        : tokenMatch(w, modelToken);
    if (!exact) continue;
    // adjacency check: another query token within ±1 word
    const windowWords = [words[i - 1], words[i + 1]].filter(Boolean) as string[];
    if (others.some((t) => windowWords.some((ww) => tokenMatch(ww, t)))) return true;
  }
  return false;
}

export interface ScoredListing extends Listing {
  score: number;
}

function scoreOne(l: Listing, tokens: string[], brandTokens: string[], modelTokens: string[], requireBrand: boolean, requireModel: boolean, coverage: number): ScoredListing | null {
  if (tokens.length === 0) return { ...l, score: 1 };
  const hay = listingHaystack(l);
  let matched = 0;
  for (const t of tokens) if (tokenMatch(hay, t)) matched++;
  const brandOk =
    brandTokens.length === 0 ||
    brandTokens.some((b) => tokenMatch(hay, b)) ||
    (l.brand ? brandTokens.some((b) => tokenMatch(normalizeText(l.brand!), b)) : false);
  const modelOk = modelTokens.length === 0 || modelTokens.some((m) => modelTokenMatch(hay, m, tokens));
  if (requireBrand && brandTokens.length > 0 && !brandOk) return null;
  if (requireModel && modelTokens.length > 0 && !modelOk) return null;
  const cov = matched / tokens.length;
  if (cov < coverage) return null;
  const score = cov + (brandOk && brandTokens.length ? 0.3 : 0) + (modelOk && modelTokens.length ? 0.3 : 0);
  return { ...l, score };
}

export interface RelevanceResult {
  relevant: Listing[];
  dropped: Listing[];
  level: number; // 0 strict .. 3 no filter
}

/**
 * Filters listings by relevance to the identified item.
 * Levels:
 *  0 = brand + model required, ≥50% token coverage
 *  1 = brand required, ≥40% coverage
 *  2 = ≥45% coverage, no hard brand/model requirement
 *  3 = accept everything (relevance impossible to prove)
 */
export function filterRelevant(
  listings: Listing[],
  parts: { name?: string; brand?: string | null; model?: string | null },
  minKeep = 3,
): RelevanceResult {
  const { tokens, brandTokens, modelTokens } = buildQueryTokens(parts);
  if (tokens.length === 0 || listings.length === 0) {
    return { relevant: listings, dropped: [], level: 3 };
  }

  // Hard pre-filter: accessory/spam noise (e.g. "coque iPhone 12" for "iPhone 12")
  const clean: Listing[] = [];
  const noiseDropped: Listing[] = [];
  for (const l of listings) {
    if (isAccessoryNoise(l.title, tokens)) noiseDropped.push(l);
    else clean.push(l);
  }
  if (clean.length === 0) {
    return { relevant: listings, dropped: [], level: 3 };
  }

  const levels: { requireBrand: boolean; requireModel: boolean; coverage: number }[] = [
    { requireBrand: true, requireModel: true, coverage: 0.5 },
    { requireBrand: true, requireModel: false, coverage: 0.4 },
    { requireBrand: false, requireModel: false, coverage: 0.45 },
  ];

  for (let level = 0; level < levels.length; level++) {
    if (level === 0 && brandTokens.length === 0 && modelTokens.length === 0) continue;
    if (level === 1 && brandTokens.length === 0) continue;
    const cfg = levels[level];
    const kept: ScoredListing[] = [];
    const dropped: Listing[] = [];
    for (const l of clean) {
      const s = scoreOne(l, tokens, brandTokens, modelTokens, cfg.requireBrand, cfg.requireModel, cfg.coverage);
      if (s) kept.push(s);
      else dropped.push(l);
    }
    if (kept.length >= Math.min(minKeep, clean.length)) {
      kept.sort((a, b) => b.score - a.score || a.price - b.price);
      return { relevant: kept, dropped: [...dropped, ...noiseDropped], level };
    }
  }
  return { relevant: clean, dropped: noiseDropped, level: 3 };
}

/* ------------------------------ new vs used classification ------------------------------ */

const NEW_PATTERNS = /neuf( avec| sans| sous)?|neuve|brand new|new with tags|new without tags|sealed|promo/i;

/**
 * True when the listing is actually a NEW (retail/promo) item —
 * its price should inform the "new price hint", not the used range.
 */
export function isNewListing(l: Listing): boolean {
  if (l.source === "dealabs") return true; // deals = retail promos
  return NEW_PATTERNS.test(`${l.conditionText ?? ""} ${l.title}`);
}

export function usedPool(listings: Listing[]): { used: Listing[]; newItems: Listing[] } {
  const used: Listing[] = [];
  const newItems: Listing[] = [];
  for (const l of listings) {
    if (isNewListing(l)) newItems.push(l);
    else used.push(l);
  }
  return { used, newItems };
}

/** Maps Vinted/marketplace condition text to our condition buckets. */
export function mapConditionText(conditionText?: string): "new" | "like_new" | "good" | "fair" | "poor" | null {
  if (!conditionText) return null;
  const c = normalizeText(conditionText);
  if (/neuf|new/.test(c)) return "new";
  if (/tres bon|very good/.test(c)) return "like_new";
  if (/bon etat|^good$/.test(c)) return "good";
  if (/satisfaisant|correct|satisfactory|fair/.test(c)) return "fair";
  if (/use|mauvais|worn|poor/.test(c)) return "poor";
  return null;
}

const CONDITION_ORDER = ["new", "like_new", "good", "fair", "poor"] as const;

/**
 * Soft condition proximity filter: keeps listings whose condition is at
 * most 1 bucket away from the declared one (unknown conditions pass),
 * provided enough data remains.
 */
export function conditionProximity(pool: Listing[], declared: string): Listing[] {
  const idx = CONDITION_ORDER.indexOf(declared as (typeof CONDITION_ORDER)[number]);
  // only worth filtering when the pool is comfortably large
  if (idx < 0 || pool.length < 10) return pool;
  const close = pool.filter((l) => {
    const mapped = mapConditionText(l.conditionText);
    if (!mapped) return true; // unknown condition → keep
    return Math.abs(CONDITION_ORDER.indexOf(mapped) - idx) <= 1;
  });
  return close.length >= 6 ? close : pool;
}
