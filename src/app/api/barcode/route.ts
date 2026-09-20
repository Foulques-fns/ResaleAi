import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = "PriceSnap/1.0 (+https://pricesnap.local)";

/**
 * Resolves an EAN/ISBN/UPC code against open product databases (real lookup):
 *  - Open Library (ISBN books)
 *  - Open Food Facts (food EAN)
 *  - Open Beauty Facts (cosmetics)
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{8,14}$/.test(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  // Books (ISBN-10/13)
  if (code.length === 10 || code.length === 13) {
    try {
      const res = await fetch(`https://openlibrary.org/isbn/${code}.json`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { title?: string; authors?: { key: string }[] };
        if (j.title) {
          return NextResponse.json({
            found: true,
            name: j.title,
            brand: null,
            category: "livres-media",
            source: "Open Library",
          });
        }
      }
    } catch {
      /* continue */
    }
  }

  // Food
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,generic_name_fr`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), cache: "no-store" },
    );
    if (res.ok) {
      const j = (await res.json()) as {
        status?: number;
        product?: { product_name?: string; brands?: string };
      };
      if (j.status === 1 && j.product?.product_name) {
        return NextResponse.json({
          found: true,
          name: j.product.product_name,
          brand: j.product.brands?.split(",")[0]?.trim() ?? null,
          category: null,
          source: "Open Food Facts",
        });
      }
    }
  } catch {
    /* continue */
  }

  // Beauty
  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), cache: "no-store" },
    );
    if (res.ok) {
      const j = (await res.json()) as {
        status?: number;
        product?: { product_name?: string; brands?: string };
      };
      if (j.status === 1 && j.product?.product_name) {
        return NextResponse.json({
          found: true,
          name: j.product.product_name,
          brand: j.product.brands?.split(",")[0]?.trim() ?? null,
          category: "beaute",
          source: "Open Beauty Facts",
        });
      }
    }
  } catch {
    /* continue */
  }

  return NextResponse.json({ found: false });
}
