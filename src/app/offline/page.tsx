"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera, RefreshCw, WifiOff } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { readCachedHistory, timeAgo } from "@/lib/client-utils";
import type { HistoryItem } from "@/lib/types";
import { Price } from "@/components/ui";
import { useIsOnline } from "@/components/pwa";

export default function OfflinePage() {
  const { t, lang } = useLang();
  const online = useIsOnline();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(readCachedHistory());
  }, []);

  useEffect(() => {
    if (online) window.location.href = "/";
  }, [online]);

  return (
    <div className="space-y-6">
      <div className="reveal flex flex-col items-center gap-3 pt-8 text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-ink-3 text-warn">
          <WifiOff className="size-7" />
        </span>
        <h1 className="text-display text-2xl font-bold">{t.offline.title}</h1>
        <p className="max-w-xs text-sm text-fog">{t.offline.body}</p>
        <button onClick={() => window.location.reload()} className="btn-ghost text-sm">
          <RefreshCw className="size-4" /> {t.offline.retry}
        </button>
      </div>

      {items.length > 0 && (
        <section className="reveal reveal-1 space-y-2.5">
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{t.offline.cached}</h2>
          {items.map((item) => (
            <Link key={item.id} href={`/estimation/${item.id}`} className="card flex items-center gap-3 p-2.5">
              {item.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumb} alt="" className="size-14 rounded-xl border border-line object-cover" />
              ) : (
                <span className="grid size-14 place-items-center rounded-xl bg-ink-3 text-fog">
                  <Camera className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.itemName}</p>
                <p className="mt-0.5 text-xs text-fog">{timeAgo(item.createdAt, lang)}</p>
              </div>
              <Price value={item.priceMid} currency={item.currency} className="text-sm font-bold text-acid" />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
