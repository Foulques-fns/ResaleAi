"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Camera, Coins, History as HistoryIcon, Layers, PiggyBank, Search, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cacheHistory, clearLot, getLot, readCachedHistory, timeAgo } from "@/lib/client-utils";
import type { HistoryItem } from "@/lib/types";
import { EmptyState, Price, SectionTitle, Spinner } from "@/components/ui";

export function HistoryView() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [filter, setFilter] = useState("");
  const [lotIds, setLotIds] = useState<string[]>([]);

  useEffect(() => {
    setLotIds(getLot());
    let alive = true;
    fetch("/api/history")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const list = (j.items ?? []) as HistoryItem[];
        setItems(list);
        cacheHistory(list);
      })
      .catch(() => {
        if (!alive) return;
        setItems(readCachedHistory());
        setOffline(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const list = items ?? [];
    if (!filter.trim()) return list;
    const q = filter.trim().toLowerCase();
    return list.filter((i) => `${i.itemName} ${i.brand ?? ""}`.toLowerCase().includes(q));
  }, [items, filter]);

  const lotItems = useMemo(() => (items ?? []).filter((i) => lotIds.includes(i.id)), [items, lotIds]);
  const lotLow = lotItems.reduce((s, i) => s + i.priceLow, 0);
  const lotHigh = lotItems.reduce((s, i) => s + i.priceHigh, 0);

  const unsold = (items ?? []).filter((i) => i.soldPrice == null);
  const potential = unsold.reduce((s, i) => s + i.priceMid, 0);
  const realized = (items ?? []).reduce((s, i) => s + (i.soldPrice ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-display text-2xl font-bold">{t.history.title}</h1>
        <p className="mt-1 text-sm text-fog">{t.history.subtitle}</p>
      </div>

      {items && items.length > 0 && (
        <div className="reveal reveal-1 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-xs text-fog">
              <Coins className="size-3.5 text-acid" /> {t.history.potential}
            </p>
            <p className="mt-1 text-display text-xl font-bold">
              <Price value={potential} />
            </p>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-xs text-fog">
              <PiggyBank className="size-3.5 text-mint" /> {t.history.realized}
            </p>
            <p className="mt-1 text-display text-xl font-bold text-mint">
              <Price value={realized} />
            </p>
          </div>
        </div>
      )}

      {/* LOT */}
      {lotItems.length > 0 && (
        <section id="lot" className="reveal reveal-1 card border-acid/40 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Layers className="size-4 text-acid" /> {t.scan.lotMode} · {lotItems.length}
            </p>
            <button
              onClick={() => {
                clearLot();
                setLotIds([]);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-danger"
            >
              <X className="size-3.5" /> {t.scan.lotCleared}
            </button>
          </div>
          <p className="mt-2 text-display text-2xl font-bold">
            <Price value={lotLow} /> <span className="text-fog">–</span> <Price value={lotHigh} />
          </p>
          <p className="mb-2 text-xs text-fog">{t.scan.lotTotal}</p>
          <div className="divide-y divide-line/60">
            {lotItems.map((i) => (
              <Link key={i.id} href={`/estimation/${i.id}`} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate pr-2">{i.itemName}</span>
                <Price value={i.priceMid} currency={i.currency} className="font-bold text-acid" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* search */}
      <div className="reveal reveal-2 relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.history.searchPh}
          className="w-full rounded-xl border border-line bg-ink py-3 pl-10 pr-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
        />
      </div>

      {offline && <p className="text-xs text-warn">{t.history.offlineBadge}</p>}

      <section>
        {items === null ? (
          <div className="grid place-items-center py-14">
            <Spinner className="text-acid" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="size-6" />}
            title={t.history.empty}
            action={
              <Link href="/scan" className="btn-acid !py-2.5 text-sm">
                <Camera className="size-4" /> {t.home.ctaScan}
              </Link>
            }
          />
        ) : (
          <div className="space-y-2.5">
            <SectionTitle>
              {filtered.length} {t.history.title.toLowerCase()}
            </SectionTitle>
            {filtered.map((item) => (
              <Link key={item.id} href={`/estimation/${item.id}`} className="card card-hover flex items-center gap-3 p-2.5">
                {item.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumb} alt="" className="size-16 rounded-xl border border-line object-cover" />
                ) : (
                  <span className="grid size-16 place-items-center rounded-xl bg-ink-3 text-fog">
                    <Camera className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.itemName}</p>
                  <p className="mt-0.5 text-xs text-fog">
                    {timeAgo(item.createdAt, lang)} · {item.sampleSize} {t.result.listings}
                  </p>
                  <p className="mt-1 text-xs text-fog">
                    <Price value={item.priceLow} currency={item.currency} /> – <Price value={item.priceHigh} currency={item.currency} />
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {item.soldPrice != null ? (
                    <span className="chip border-mint/40 text-mint">
                      {t.history.soldBadge} <Price value={item.soldPrice} currency={item.currency} />
                    </span>
                  ) : (
                    <Price value={item.priceMid} currency={item.currency} className="text-sm font-bold text-acid" />
                  )}
                  <ArrowUpRight className="size-3.5 text-fog" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
