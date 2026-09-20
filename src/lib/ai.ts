import type { IdentificationHypothesis, Lang } from "./types";

/**
 * Multimodal AI client. Reads provider keys from environment (server-side only):
 *   OPENAI_API_KEY    -> gpt-4o-mini / gpt-4o (vision)
 *   ANTHROPIC_API_KEY -> claude-sonnet (vision)
 *   GEMINI_API_KEY    -> gemini-2.0-flash (vision)
 * If none is configured, identification falls back to manual assisted input.
 */

export type AIProvider = "openai" | "anthropic" | "gemini";

export function getAIProvider(): { name: AIProvider; key: string } | null {
  const openai = process.env.OPENAI_API_KEY;
  if (openai) return { name: "openai", key: openai };
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { name: "anthropic", key: anthropic };
  const gemini = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (gemini) return { name: "gemini", key: gemini };
  return null;
}

export interface IdentificationResult {
  hypotheses: IdentificationHypothesis[];
  readText: string[];
  category: string | null;
  suspicious: string | null;
}

function idPrompt(lang: Lang, notes: string | undefined): string {
  const notesPart = notes?.trim()
    ? lang === "en"
      ? `\nUser notes about the item: "${notes.trim()}"`
      : `\nNotes de l'utilisateur sur l'objet : "${notes.trim()}"`
    : "";
  const sys =
    lang === "en"
      ? `You are an expert appraiser for second-hand resale (flea markets, thrift stores, Vinted, Leboncoin, eBay). Analyze the photo(s) and identify the object for resale.
Rules:
- Identify: object nature, brand, model/reference, material, estimated era if relevant.
- READ any visible text/label (OCR) to refine brand/reference/size.
- If unsure, give 2-3 distinct hypotheses with honest confidence (0..1), sum may be < 1. Never overstate certainty.
- If the item seems counterfeit, stolen, illegal or unsafe to resell, set "suspicious" with a short explanation.
${notesPart}
Reply ONLY with JSON (no markdown): {"hypotheses":[{"label":"...","brand":"...","model":"...","category":"...","confidence":0.0,"rationale":"..."}],"readText":["..."],"category":"...","suspicious":null}
Categories: mode, high-tech, electro-menager, mobilier, deco, jouets, jeux-video, livres-media, sport, bricolage, auto-moto, collection, enfant, jardin, beaute, musique, art-antiquite, autre.`
      : `Tu es un expert en estimation d'objets d'occasion (brocante, friperie, Vinted, Leboncoin, eBay). Analyse la/les photo(s) pour identifier l'objet en vue d'une revente.
Règles :
- Identifie : nature de l'objet, marque, modèle/référence, matière, époque estimée si pertinent.
- LIS tout texte/étiquette visible (OCR) pour affiner marque/référence/taille.
- Si incertain, donne 2-3 hypothèses distinctes avec une confiance honnête (0..1). Ne surestime jamais ta certitude.
- Si l'objet semble contrefait, volé, illégal ou dangereux à revendre, renseigne "suspicious" avec une courte explication.
${notesPart}
Réponds UNIQUEMENT en JSON (sans markdown) : {"hypotheses":[{"label":"...","brand":"...","model":"...","category":"...","confidence":0.0,"rationale":"..."}],"readText":["..."],"category":"...","suspicious":null}
Catégories : mode, high-tech, electro-menager, mobilier, deco, jouets, jeux-video, livres-media, sport, bricolage, auto-moto, collection, enfant, jardin, beaute, musique, art-antiquite, autre.`;
  return sys;
}

function stripDataUrl(u: string): { data: string; mime: string } {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(u);
  if (m) return { mime: m[1], data: m[2] };
  return { mime: "image/jpeg", data: u };
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json in ai response");
  return text.slice(start, end + 1);
}

function normalizeResult(parsed: unknown): IdentificationResult {
  const p = parsed as Record<string, unknown>;
  const hyps: IdentificationHypothesis[] = Array.isArray(p.hypotheses)
    ? (p.hypotheses as Record<string, unknown>[]).slice(0, 3).map((h) => ({
        label: String(h.label ?? "Objet inconnu"),
        brand: h.brand ? String(h.brand) : undefined,
        model: h.model ? String(h.model) : undefined,
        category: h.category ? String(h.category) : undefined,
        confidence: Math.max(0, Math.min(1, Number(h.confidence) || 0)),
        rationale: h.rationale ? String(h.rationale) : undefined,
      }))
    : [];
  return {
    hypotheses: hyps,
    readText: Array.isArray(p.readText) ? (p.readText as unknown[]).map(String).slice(0, 8) : [],
    category: p.category ? String(p.category) : hyps[0]?.category ?? null,
    suspicious: typeof p.suspicious === "string" ? p.suspicious : null,
  };
}

async function callOpenAI(key: string, images: string[], sys: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: sys },
            ...images.map((u) => ({ type: "image_url", image_url: { url: u } })),
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = j.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty OpenAI response");
  return content;
}

async function callAnthropic(key: string, images: string[], sys: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_VISION_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((u) => {
              const { data, mime } = stripDataUrl(u);
              return {
                type: "image",
                source: { type: "base64", media_type: mime, data },
              };
            }),
            { type: "text", text: sys },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = j.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("empty Anthropic response");
  return text;
}

async function callGemini(key: string, images: string[], sys: string): Promise<string> {
  const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...images.map((u) => {
                const { data, mime } = stripDataUrl(u);
                return { inline_data: { mime_type: mime, data } };
              }),
              { text: sys },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const j = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("empty Gemini response");
  return text;
}

export async function identifyFromImages(
  images: string[],
  lang: Lang,
  notes?: string,
): Promise<IdentificationResult | null> {
  const provider = getAIProvider();
  if (!provider || images.length === 0) return null;
  const sys = idPrompt(lang, notes);
  try {
    const raw =
      provider.name === "openai"
        ? await callOpenAI(provider.key, images, sys)
        : provider.name === "anthropic"
          ? await callAnthropic(provider.key, images, sys)
          : await callGemini(provider.key, images, sys);
    const result = normalizeResult(JSON.parse(extractJson(raw)));
    return result.hypotheses.length ? result : null;
  } catch {
    return null;
  }
}
