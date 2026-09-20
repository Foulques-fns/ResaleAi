import type { Lang, Listing, SearchLogEntry } from "./types";

/**
 * Live web search pipeline. Every provider performs a REAL HTTP request
 * against a public source at estimation time — no cached/static data.
 * Each provider is isolated: failures degrade gracefully and are reported
 * in the search log shown to the user (full transparency on sources).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 14000;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€");
}

function parsePrice(raw: string): number | null {
  const clean = raw.replace(/[\s\u00a0]/g, "").replace(",", ".");
  const v = parseFloat(clean);
  if (!Number.isFinite(v) || v <= 0 || v > 500000) return null;
  return Math.round(v * 100) / 100;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {}),
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

type ProviderResult = { listings: Listing[]; log: SearchLogEntry };

/* ---------------------------------- Vinted (SSR catalog) ---------------------------------- */
async function vintedProvider(query: string, lang: Lang): Promise<ProviderResult> {
  const host = lang === "en" ? "www.vinted.co.uk" : "www.vinted.fr";
  const start = Date.now();
  try {
    const html = await fetchText(
      `https://${host}/catalog?search_text=${encodeURIComponent(query)}&order=newest_first`,
    );
    const currency = lang === "en" ? "GBP" : "EUR";
    const listings: Listing[] = [];
    const tileRe = /data-testid="product-item-id-(\d+)"/g;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = tileRe.exec(html)) && listings.length < 20) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const window = html.slice(m.index, m.index + 2600);
      const altMatch = /alt="([^"]{4,300})"/.exec(window);
      if (!altMatch) continue;
      const alt = decodeEntities(altMatch[1]);
      const hrefMatch = /href="(\/items\/[^"]+)"/.exec(window);
      // alt pattern: "Title, Marque: X, État: Y, 25.00 €, 26.95 €" (last = price incl. fees)
      const priceMatches = [...alt.matchAll(/(\d[\d\s.,]*\d|\d)\s?(?:€|£)/g)];
      if (priceMatches.length === 0) continue;
      const price = parsePrice(priceMatches[0][1]);
      if (price === null) continue;
      let title = alt;
      let brand: string | undefined;
      let conditionText: string | undefined;
      const parts = alt.split(",").map((p) => p.trim());
      const label = lang === "en" ? "Brand" : "Marque";
      const condLabel = lang === "en" ? "Condition" : "État";
      title = parts[0] ?? alt;
      for (const p of parts) {
        if (p.startsWith(`${label}:`)) brand = p.slice(label.length + 1).trim();
        if (p.startsWith(`${condLabel}:`)) conditionText = p.slice(condLabel.length + 1).trim();
      }
      listings.push({
        title,
        brand,
        conditionText,
        price,
        currency,
        url: `https://${host}${hrefMatch ? hrefMatch[1] : `/items/${id}`}`,
        source: "vinted",
        sourceLabel: "Vinted",
      });
    }
    return {
      listings,
      log: {
        provider: "vinted",
        status: listings.length ? "ok" : "empty",
        count: listings.length,
        ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      listings: [],
      log: {
        provider: "vinted",
        status: "error",
        count: 0,
        ms: Date.now() - start,
        message: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

/* ---------------------------------- Dealabs (community deals, dated) ---------------------------------- */
async function dealabsProvider(query: string, _lang: Lang): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const html = await fetchText(`https://www.dealabs.com/search?q=${encodeURIComponent(query)}`);
    const listings: Listing[] = [];
    const linkRe =
      /<a[^>]*class="[^"]*thread-link[^"]*"[^>]*title="([^"]{4,220})"[^>]*href="(https:\/\/www\.dealabs\.com\/[^"]+)"[^>]*>/g;
    const matches = [...html.matchAll(linkRe)];
    const seen = new Set<string>();
    for (let i = 0; i < matches.length && listings.length < 15; i++) {
      const m = matches[i];
      const [, title, url] = m;
      if (seen.has(url)) continue;
      seen.add(url);
      // card-local window: stop at the NEXT thread card so prices stay attached to THIS deal
      const nextIdx = i + 1 < matches.length ? (matches[i + 1].index ?? m.index + 8000) : m.index + 8000;
      const window = html.slice(m.index ?? 0, Math.min(nextIdx, (m.index ?? 0) + 8000));
      // skip carrier financing offers ("11,30 €/mois", "dont 30 € par mois") — price is not the item price
      if (/\/\s?mois|par mois|mensualit/i.test(window.slice(0, 2000))) continue;
      // find first euro amount visible in this card (deal price, else description)
      let price: number | null = null;
      const pm = /(\d[\d\s.,]*\d|\d)\s?€/.exec(window);
      if (pm) price = parsePrice(pm[1]);
      if (price === null || price < 1) continue;
      // find a date near the card
      const dm = /(\d{1,2}\s(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\w*\.?\s\d{0,4})/i.exec(window);
      listings.push({
        title: decodeEntities(title),
        price,
        currency: "EUR",
        url,
        source: "dealabs",
        sourceLabel: "Dealabs",
        date: dm ? dm[1] : undefined,
        conditionText: "Neuf / promo",
      });
    }
    return {
      listings,
      log: {
        provider: "dealabs",
        status: listings.length ? "ok" : "empty",
        count: listings.length,
        ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      listings: [],
      log: {
        provider: "dealabs",
        status: "error",
        count: 0,
        ms: Date.now() - start,
        message: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

/* ---------------------------------- eBay FR/UK (best effort) ---------------------------------- */
async function ebayProvider(query: string, lang: Lang): Promise<ProviderResult> {
  const start = Date.now();
  const host = lang === "en" ? "www.ebay.co.uk" : "www.ebay.fr";
  const currency = lang === "en" ? "GBP" : "EUR";
  const priceRe = lang === "en" ? /£\s?(\d[\d\s.,]*\d|\d)/ : /(\d[\d\s.,]*\d|\d)\s?€/;
  try {
    const html = await fetchText(`https://${host}/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=10`);
    const listings: Listing[] = [];
    const itemRe = /<li class="s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(html)) && listings.length < 20) {
      const block = m[1];
      const tm = /class="s-item__title"[^>]*>([^<]{4,200})/.exec(block);
      const pm = /class="s-item__price"[^>]*>([^<]+)/.exec(block);
      const lm = /href="(https:\/\/www\.ebay[^"]*?\/itm\/[^"?]+)/.exec(block);
      if (!tm || !pm || !lm) continue;
      const title = decodeEntities(tm[1]).trim();
      if (/Shop on eBay|Results matching/i.test(title)) continue;
      const pm2 = priceRe.exec(decodeEntities(pm[1]));
      if (!pm2) continue;
      const price = parsePrice(pm2[1]);
      if (price === null) continue;
      listings.push({
        title,
        price,
        currency,
        url: lm[1],
        source: "ebay",
        sourceLabel: "eBay",
      });
    }
    return {
      listings,
      log: {
        provider: "ebay",
        status: listings.length ? "ok" : "empty",
        count: listings.length,
        ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      listings: [],
      log: {
        provider: "ebay",
        status: "error",
        count: 0,
        ms: Date.now() - start,
        message: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

/* ---------------------------------- Leboncoin SSR (best effort) ---------------------------------- */
async function leboncoinProvider(query: string, _lang: Lang): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const html = await fetchText(
      `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(query)}&sort=time`,
    );
    const listings: Listing[] = [];
    // SSR JSON island: look for {"subject":"...","price_cents":NNN ...}
    const re = /"subject":"((?:[^"\\]|\\.){4,180})"[^{}]{0,400}?"price_cents":(\d+)/g;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = re.exec(html)) && listings.length < 20) {
      const title = decodeEntities(m[1].replace(/\\"/g, '"'));
      const price = parseInt(m[2], 10) / 100;
      if (!Number.isFinite(price) || price <= 0) continue;
      const key = title + price;
      if (seen.has(key)) continue;
      seen.add(key);
      listings.push({
        title,
        price,
        currency: "EUR",
        url: `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(query)}`,
        source: "leboncoin",
        sourceLabel: "Leboncoin",
      });
    }
    return {
      listings,
      log: {
        provider: "leboncoin",
        status: listings.length ? "ok" : "empty",
        count: listings.length,
        ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      listings: [],
      log: {
        provider: "leboncoin",
        status: "error",
        count: 0,
        ms: Date.now() - start,
        message: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

/* ---------------------------------- Web search snippets (Bing HTML, best effort) ---------------------------------- */
async function bingProvider(query: string, lang: Lang): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const q =
      lang === "en"
        ? `${query} used price sold`
        : `${query} occasion prix € vendu`;
    const html = await fetchText(
      `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=${lang === "en" ? "en-GB" : "fr-FR"}&cc=${lang === "en" ? "GB" : "FR"}`,
    );
    const listings: Listing[] = [];
    const blockRe = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    const eurRe = lang === "en" ? /£\s?(\d[\d\s.,]*\d|\d)/ : /(\d[\d\s.,]*\d|\d)\s?€/;
    while ((m = blockRe.exec(html)) && listings.length < 12) {
      const block = m[1];
      const tm = /<h2><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
      if (!tm) continue;
      const url = tm[1];
      const title = decodeEntities(tm[2].replace(/<[^>]+>/g, "").trim());
      let domain = "web";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      const pm = eurRe.exec(decodeEntities(block.replace(/<[^>]+>/g, " ")));
      if (!pm) continue;
      const price = parsePrice(pm[1]);
      if (price === null) continue;
      listings.push({
        title,
        price,
        currency: lang === "en" ? "GBP" : "EUR",
        url,
        source: domain.includes("leboncoin")
          ? "leboncoin"
          : domain.includes("vinted")
            ? "vinted"
            : domain.includes("ebay")
              ? "ebay"
              : "web",
        sourceLabel: domain,
      });
    }
    return {
      listings,
      log: {
        provider: "bing",
        status: listings.length ? "ok" : "empty",
        count: listings.length,
        ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      listings: [],
      log: {
        provider: "bing",
        status: "error",
        count: 0,
        ms: Date.now() - start,
        message: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

/* ------------------------------- DuckDuckGo Lite (best effort) ------------------------------- */
async function duckduckgoProvider(query: string, lang: Lang): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const q = lang === "en" ? `${query} used price £` : `${query} prix occasion €`;
    const html = await fetchText("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${encodeURIComponent(q)}&kl=${lang === "en" ? "uk-en" : "fr-fr"}`,
    });
    const listings: Listing[] = [];
    const resRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1500}?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    const eurRe = lang === "en" ? /£\s?(\d[\d\s.,]*\d|\d)/ : /(\d[\d\s.,]*\d|\d)\s?€/;
    while ((m = resRe.exec(html)) && listings.length < 12) {
      let url = decodeEntities(m[1]);
      const ud = /uddg=([^&]+)/.exec(url);
      if (ud) url = decodeURIComponent(ud[1]);
      const title = decodeEntities(m[2].replace(/<[^>]+>/g, "").trim());
      const snippet = decodeEntities(m[3].replace(/<[^>]+>/g, " ").trim());
      const pm = eurRe.exec(snippet);
      if (!pm) continue;
      const price = parsePrice(pm[1]);
      if (price === null) continue;
      let domain = "web";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      listings.push({
        title,
        price,
        currency: lang === "en" ? "GBP" : "EUR",
        url,
        source: "web",
        sourceLabel: domain,
      });
    }
    return {
      listings,
      log: {
        provider: "duckduckgo",
        status: listings.length ? "ok" : "empty",
        count: listings.length,
        ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      listings: [],
      log: {
        provider: "duckduckgo",
        status: "error",
        count: 0,
        ms: Date.now() - start,
        message: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

const PROVIDERS = [vintedProvider, dealabsProvider, ebayProvider, leboncoinProvider, bingProvider, duckduckgoProvider];

export interface LiveSearchOutcome {
  listings: Listing[];
  logs: SearchLogEntry[];
}

/** Runs every provider concurrently with real HTTP calls, merges + dedupes results. */
export async function liveSearchComparables(query: string, lang: Lang): Promise<LiveSearchOutcome> {
  const settled = await Promise.allSettled(PROVIDERS.map((p) => p(query, lang)));
  const listings: Listing[] = [];
  const logs: SearchLogEntry[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      listings.push(...r.value.listings);
      logs.push(r.value.log);
    } else {
      logs.push({ provider: "unknown", status: "error", count: 0, ms: 0, message: String(r.reason) });
    }
  }
  // dedupe by url, then by title+price
  const seen = new Set<string>();
  const deduped = listings.filter((l) => {
    const k1 = l.url;
    const k2 = `${l.title.toLowerCase()}|${l.price}`;
    if (seen.has(k1) || seen.has(k2)) return false;
    seen.add(k1);
    seen.add(k2);
    return true;
  });
  // filter absurd vs query coherence: drop items priced > 4x provisional median later in pricing step
  return { listings: deduped, logs };
}

/** Brand/model-aware query builder */
export function buildQuery(parts: {
  name?: string;
  brand?: string | null;
  model?: string | null;
  keywords?: string[];
}): string {
  const tokens: string[] = [];
  const seen = new Set<string>();
  const push = (t?: string | null) => {
    if (!t) return;
    for (const tok of t.split(/\s+/)) {
      const clean = tok.replace(/[^\p{L}\p{N}'-]/gu, "");
      if (clean.length < 2) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(clean);
    }
  };
  push(parts.brand);
  push(parts.model);
  push(parts.name);
  for (const k of parts.keywords ?? []) push(k);
  return tokens.slice(0, 8).join(" ");
}
