"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Camera,
  Check,
  Copy,
  Gem,
  Layers,
  ListChecks,
  PackagePlus,
  Plus,
  RefreshCw,
  SearchCode,
  ShieldAlert,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { addToLot, cacheEstimate, getLot, readCachedEstimate, timeAgo } from "@/lib/client-utils";
import { isNewListing } from "@/lib/relevance";
import type { EstimateResult } from "@/lib/types";
import { ChangeTag, CopyButton, ListingRow, Price, RangeBar, SectionTitle, Spinner } from "@/components/ui";
import { useIsOnline } from "@/components/pwa";

function SoldDialog({ result, onClose, onSaved }: { result: EstimateResult; onClose: () => void; onSaved: (r: EstimateResult) => void }) {
  const { t } = useLang();
  const [price, setPrice] = useState<string>(result.priceMid > 0 ? String(result.priceMid) : "");
  const [platform, setPlatform] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="card w-full max-w-sm space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-display font-bold">{t.result.markSold}</p>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-ink-3">
            <X className="size-4" />
          </button>
        </div>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
          inputMode="decimal"
          placeholder={t.result.soldPricePh}
          className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none focus:border-acid/50"
        />
        <input
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder={t.result.soldPlatformPh}
          className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none focus:border-acid/50"
        />
        <button
          className="btn-acid w-full"
          disabled={busy || !price.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch(`/api/estimate/${result.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ soldPrice: parseFloat(price.replace(",", ".")), soldPlatform: platform || null }),
              });
              const j = await res.json();
              cacheEstimate(j.id, j);
              onSaved(j);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner className="size-4" /> : <Check className="size-4" />} {t.result.save}
        </button>
      </div>
    </div>
  );
}

function EstimationViewInner({ id }: { id: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const online = useIsOnline();
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [offline, setOffline] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [lotIds, setLotIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/estimate/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("404");
        return r.json();
      })
      .then((j: EstimateResult) => {
        if (!alive) return;
        setResult(j);
        cacheEstimate(j.id, j);
      })
      .catch(() => {
        if (!alive) return;
        const cached = readCachedEstimate<EstimateResult>(id);
        setResult(cached);
        setOffline(true);
      });
    setLotIds(getLot());
    return () => {
      alive = false;
    };
  }, [id]);

  const inLot = useMemo(() => lotIds.includes(id), [lotIds, id]);
  const cameFromLot = params.get("lot") === "1";

  if (!result) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Spinner className="text-acid" />
      </div>
    );
  }

  const cur = result.currency;
  const hypoConf = Math.round(result.confidence * 100);
  const scaleMin = result.stats.min > 0 ? result.stats.min * 0.9 : 0;
  const scaleMax = result.stats.max > 0 ? result.stats.max * 1.05 : result.priceHigh * 1.2 || 1;

  async function refreshSearch() {
    if (!online || !result) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "estimate",
          images: [],
          condition: result.condition,
          notes: "",
          lang,
          confirmedLabel: result.itemName,
          confirmedBrand: result.brand ?? "",
          confirmedModel: result.model ?? "",
        }),
      });
      const j = await res.json();
      if (j.id) router.push(`/estimation/${j.id}`);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-7">
      {cameFromLot && inLot && (
        <div className="reveal rounded-2xl border border-acid/40 bg-acid/10 p-3.5 text-sm">
          <span className="font-bold text-acid">{t.scan.lotMode}</span>
          <span className="text-fog"> · {lotIds.length} objets — </span>
          <Link href="/history#lot" className="font-semibold text-bone underline underline-offset-2">
            {t.scan.viewLot}
          </Link>
        </div>
      )}

      {/* identity */}
      <section className="reveal">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${result.aiSource === "ai" && hypoConf >= 75 ? "border-mint/40 text-mint" : hypoConf >= 50 ? "border-warn/40 text-warn" : "text-fog"}`}>
            <BadgeCheck className="size-3" />
            {result.aiSource === "ai" ? `${hypoConf}% ${t.result.confidence}` : t.scan.aiMissingTitle}
          </span>
          {result.category && <span className="chip">{result.category}</span>}
          <span className="chip">{t.cond[result.condition]}</span>
        </div>
        <h1 className="text-display mt-3 text-3xl font-bold leading-tight">{result.itemName}</h1>
        {(result.brand || result.model) && (
          <p className="mt-1 text-sm text-fog">{[result.brand, result.model].filter(Boolean).join(" · ")}</p>
        )}
      </section>

      {/* photos */}
      {result.photos.length > 0 && (
        <section className="reveal reveal-1 -mx-4 overflow-x-auto px-4 no-scrollbar">
          <div className="flex gap-2.5">
            {result.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" className="h-28 w-28 shrink-0 rounded-2xl border border-line object-cover" />
            ))}
          </div>
        </section>
      )}

      {/* price range */}
      <section className="reveal reveal-2 card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-acid/10 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{t.result.range}</p>
            <p className="text-display mt-2 text-4xl font-bold tracking-tight">
              <Price value={result.priceLow} currency={cur} />
              <span className="mx-1.5 text-fog">–</span>
              <Price value={result.priceHigh} currency={cur} />
            </p>
            <p className="mt-1.5 text-sm text-fog">
              {t.result.median} : <Price value={result.priceMid} currency={cur} className="font-bold text-bone" />
              {" · "}
              {t.result.basedOn} <span className="font-bold text-bone">{result.stats.sampleSize}</span> {t.result.listings}
            </p>
            {(result.stats.droppedIrrelevant ?? 0) > 0 && (
              <p className="mt-1 text-xs text-fog/80">
                {result.stats.droppedIrrelevant} {t.result.irrelevantDropped}
                {(result.stats.usedSample ?? 0) > 0 && (
                  <>
                    {" · "}
                    {result.stats.usedSample} {t.result.basedUsed}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        {result.stats.sampleSize > 0 ? (
          <div className="mt-5">
            <RangeBar low={result.priceLow} mid={result.priceMid} high={result.priceHigh} min={scaleMin} max={scaleMax} currency={cur} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: t.result.low, v: result.priceLow },
                { k: t.result.mid, v: result.priceMid },
                { k: t.result.high, v: result.priceHigh },
              ].map((x, i) => (
                <div key={x.k} className="rounded-xl border border-line bg-ink-2 py-2.5">
                  <p className="text-[0.625rem] font-bold uppercase tracking-wider text-fog">{x.k}</p>
                  <Price value={x.v} currency={cur} className={`num text-sm font-bold ${i === 1 ? "text-acid" : "text-bone"}`} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-warn">{t.result.noListings}</p>
        )}
        {/* sources */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.stats.sources.map((s) => (
            <span key={s.source} className="chip">
              {s.label} · {s.count}
            </span>
          ))}
        </div>
        {result.stats.sampleSize > 0 && <p className="mt-2.5 text-[0.6875rem] text-fog/70">{t.result.usedCalcNote}</p>}
        {result.stats.newPriceHint ? (
          <p className="mt-3 text-xs text-fog">
            {t.result.newPrice}: <Price value={result.stats.newPriceHint} currency={cur} className="font-bold text-bone" />
          </p>
        ) : null}
      </section>

      {/* sold state */}
      <section className="reveal reveal-3 flex flex-wrap gap-2.5">
        {result.soldPrice != null ? (
          <div className="card flex w-full items-center justify-between p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-mint">{t.result.soldAt}</p>
              <p className="text-display mt-1 text-2xl font-bold text-mint">
                <Price value={result.soldPrice} currency={cur} />
              </p>
              {result.soldPlatform && <p className="text-xs text-fog">{result.soldPlatform}</p>}
            </div>
            <ChangeTag pct={result.priceMid > 0 ? ((result.soldPrice - result.priceMid) / result.priceMid) * 100 : 0} />
          </div>
        ) : (
          <>
            <button onClick={() => setShowSold(true)} className="btn-ghost flex-1 text-sm">
              <Tag className="size-4" /> {t.result.markSold}
            </button>
            <button
              onClick={() => setLotIds(addToLot(id))}
              disabled={inLot}
              className="btn-ghost flex-1 text-sm disabled:opacity-50"
            >
              {inLot ? <Check className="size-4 text-mint" /> : <PackagePlus className="size-4" />}
              {t.scan.addToLot}
            </button>
          </>
        )}
      </section>

      {/* insights */}
      <section className="reveal reveal-3">
        <SectionTitle>{t.result.insights}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3.5 text-center">
            <Gem className="mx-auto size-4 text-acid" />
            <p className="mt-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-fog">{t.result.rarity}</p>
            <p className="text-sm font-bold">{t.result.rarities[result.insights.rarity]}</p>
          </div>
          <div className="card p-3.5 text-center">
            <SearchCode className="mx-auto size-4 text-acid" />
            <p className="mt-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-fog">{t.result.demand}</p>
            <p className="text-sm font-bold">{t.result.demands[result.insights.demand]}</p>
          </div>
          <div className="card p-3.5 text-center">
            <CalendarClock className="mx-auto size-4 text-acid" />
            <p className="mt-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-fog">{t.result.sellTime}</p>
            <p className="num text-sm font-bold">
              {result.insights.sellDaysLow}–{result.insights.sellDaysHigh} {t.result.days}
            </p>
          </div>
        </div>
      </section>

      {/* anomalies */}
      {result.insights.anomalies.length > 0 && (
        <section className="reveal reveal-4">
          <SectionTitle>{t.result.anomalies}</SectionTitle>
          <div className="space-y-2">
            {result.insights.anomalies.map((a, i) => (
              <div key={i} className="rounded-2xl border border-warn/40 bg-warn/5 p-3.5">
                <p className="flex items-center gap-2 text-sm font-bold text-warn">
                  <ShieldAlert className="size-4" />
                  {a.listing.title.slice(0, 70)} — <Price value={a.listing.price} currency={a.listing.currency} />
                </p>
                <p className="mt-1 text-xs text-fog">{a.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* listings */}
      <section className="reveal reveal-4">
        <SectionTitle
          right={
            online ? (
              <button onClick={refreshSearch} disabled={refreshing} className="flex items-center gap-1 text-xs font-semibold text-acid disabled:opacity-50">
                <RefreshCw className={`size-3 ${refreshing ? "spin" : ""}`} /> {t.result.refresh}
              </button>
            ) : undefined
          }
        >
          {t.result.comparables} ({result.listings.length})
        </SectionTitle>
        <div className="space-y-2">
          {/* occasion d'abord (stables), puis le neuf affiché pour référence */}
          {[...result.listings]
            .sort((a, b) => Number(isNewListing(a)) - Number(isNewListing(b)))
            .slice(0, 12)
            .map((l, i) => (
              <ListingRow key={i} listing={l} />
            ))}
        </div>
        {result.listings.length === 0 && <p className="text-sm text-fog">{t.result.noListings}</p>}
      </section>

      {/* search trace */}
      <section className="reveal reveal-5">
        <SectionTitle>{t.result.searchTrace}</SectionTitle>
        <div className="card divide-y divide-line/60">
          {result.searchLog.map((log, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="font-semibold">{log.provider}</span>
              <span className="flex items-center gap-2 text-fog">
                {log.status === "ok" ? (
                  <span className="chip border-mint/40 text-mint">{log.count}</span>
                ) : log.status === "empty" ? (
                  <span className="chip">0</span>
                ) : (
                  <span className="chip border-danger/40 text-danger">{log.message ?? "error"}</span>
                )}
                <span className="num w-14 text-right">{log.ms} {t.result.ms}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[0.6875rem] text-fog/70">« {result.queryText} » · {timeAgo(result.createdAt, lang)}</p>
      </section>

      {/* advice */}
      <section className="reveal reveal-5 space-y-3">
        <SectionTitle>{t.result.advice}</SectionTitle>
        <div className="card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <ListChecks className="size-4 text-acid" /> {t.result.platforms}
          </p>
          <ul className="space-y-1.5">
            {result.advice.platforms.map((p) => (
              <li key={p.name} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-acid" />
                <span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-fog"> — {p.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <SearchCode className="size-4 text-acid" /> {t.result.keywords}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.advice.keywords.map((k) => (
              <span key={k} className="chip normal-case tracking-normal">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Camera className="size-4 text-acid" /> {t.result.photosTip}
          </p>
          <ul className="space-y-1.5">
            {result.advice.photoTips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-fog">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fog" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold">
            <CalendarClock className="size-4 text-acid" /> {t.result.period}
          </p>
          <p className="text-sm text-fog">{result.advice.periodNote}</p>
          {result.advice.negociationTip && <p className="mt-2 text-xs text-fog/80">💡 {result.advice.negociationTip}</p>}
        </div>
      </section>

      {/* listing copy */}
      <section className="reveal reveal-5">
        <SectionTitle right={<CopyButton text={result.listingCopy} />}>{t.result.listingCopy}</SectionTitle>
        <div className="card relative p-4">
          <Copy className="absolute right-4 top-4 size-4 text-fog/40" />
          <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed text-bone/90">{result.listingCopy}</pre>
        </div>
      </section>

      {/* warnings */}
      <section className="reveal reveal-5">
        <SectionTitle>{t.result.warnings}</SectionTitle>
        <div className="space-y-2">
          {result.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2.5 rounded-2xl border border-line bg-ink-2/60 p-3.5 text-xs leading-relaxed text-fog">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
              {w}
            </p>
          ))}
        </div>
      </section>

      {/* new scan */}
      <div className="reveal flex gap-2.5 pb-4">
        <Link href="/scan" className="btn-acid flex-1 py-4">
          <Camera className="size-5" /> {t.home.ctaScan}
        </Link>
        {cameFromLot && (
          <Link href="/scan" className="btn-ghost py-4">
            <Plus className="size-5" /> {t.scan.newObject}
          </Link>
        )}
      </div>

      <div className="reveal flex justify-center pb-4">
        <button
          className="flex items-center gap-1.5 text-xs font-semibold text-fog/70 transition-colors hover:text-danger"
          onClick={async () => {
            await fetch(`/api/estimate/${id}`, { method: "DELETE" }).catch(() => {});
            try {
              localStorage.removeItem(`ps:cache:est:${id}`);
            } catch {
              /* noop */
            }
            router.push("/history");
          }}
        >
          <Trash2 className="size-3.5" /> {t.alerts.delete}
        </button>
      </div>

      {showSold && (
        <SoldDialog
          result={result}
          onClose={() => setShowSold(false)}
          onSaved={(r) => {
            setResult(r);
            setShowSold(false);
          }}
        />
      )}

      {offline && (
        <p className="text-xs text-warn">{t.history.offlineBadge}</p>
      )}

      {/* lot chip floating */}
      {inLot && !cameFromLot && (
        <Link href="/history#lot" className="card fixed bottom-24 right-4 z-30 flex items-center gap-2 border-acid/40 px-3.5 py-2.5 text-xs font-bold shadow-2xl">
          <Layers className="size-4 text-acid" /> {t.scan.viewLot} ({lotIds.length})
        </Link>
      )}
    </div>
  );
}

export function EstimationView({ id }: { id: string }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60dvh] place-items-center">
          <Spinner className="text-acid" />
        </div>
      }
    >
      <EstimationViewInner id={id} />
    </Suspense>
  );
}
