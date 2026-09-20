"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Coins,
  Globe,
  History as HistoryIcon,
  PiggyBank,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cacheHistory, formatPrice, readCachedHistory, timeAgo } from "@/lib/client-utils";
import type { HistoryItem } from "@/lib/types";
import { Price, Spinner } from "@/components/ui";
import { InstallButton } from "@/components/pwa";

const FEATURE_ICONS = [ScanSearch, Globe, Coins, Sparkles] as const;

export default function HomePage() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
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

  const potential = (items ?? []).filter((i) => i.soldPrice == null).reduce((s, i) => s + i.priceMid, 0);
  const realized = (items ?? []).reduce((s, i) => s + (i.soldPrice ?? 0), 0);
  const recent = (items ?? []).slice(0, 4);

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="reveal pt-6">
        <p className="chip mb-4 border-acid/40 text-acid">
          <span className="pulse-dot size-1.5 rounded-full bg-acid" />
          {t.tagline}
        </p>
        <h1 className="text-display text-[2.6rem] font-bold leading-[1.02] tracking-tight">
          {t.home.heroTitle1}
          <br />
          <span className="relative inline-block text-acid">
            {t.home.heroTitle2}
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 9" fill="none" preserveAspectRatio="none">
              <path d="M1 6C50 1.5 150 1.5 199 6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-fog">{t.home.heroSub}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/scan" className="btn-acid flex-1 py-4 text-base">
            <Camera className="size-5" />
            {t.home.ctaScan}
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/history" className="btn-ghost px-4 py-4">
            <HistoryIcon className="size-5" />
          </Link>
        </div>
        <div className="mt-3">
          <InstallButton />
        </div>
      </section>

      {/* STATS */}
      {items && items.length > 0 && (
        <section className="reveal reveal-1 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-xs text-fog">
              <Coins className="size-3.5 text-acid" />
              {t.home.statsPotential}
            </p>
            <p className="mt-1.5 text-display text-2xl font-bold text-bone">
              <Price value={potential} />
            </p>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-xs text-fog">
              <PiggyBank className="size-3.5 text-mint" />
              {t.home.statsSold}
            </p>
            <p className="mt-1.5 text-display text-2xl font-bold text-mint">
              <Price value={realized} />
            </p>
          </div>
        </section>
      )}

      {/* RECENT */}
      <section className="reveal reveal-2">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{t.home.recent}</h2>
          {items && items.length > 0 && (
            <Link href="/history" className="text-xs font-semibold text-acid hover:underline">
              {t.home.seeAll}
            </Link>
          )}
        </div>

        {items === null ? (
          <div className="card grid place-items-center py-10">
            <Spinner className="text-acid" />
          </div>
        ) : recent.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-ink-3 text-acid">
              <Camera className="size-6" />
            </span>
            <p className="text-sm text-fog">{t.home.empty}</p>
            <Link href="/scan" className="btn-acid !py-2.5 text-sm">
              {t.home.ctaScan}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {offline && <p className="text-xs text-warn">{t.history.offlineBadge}</p>}
            {recent.map((item) => (
              <Link key={item.id} href={`/estimation/${item.id}`} className="card card-hover flex items-center gap-3 p-2.5">
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
                  <p className="mt-0.5 text-xs text-fog">
                    {t.common.ago} {timeAgo(item.createdAt, lang)} · {item.sampleSize} {t.result.listings}
                  </p>
                </div>
                <div className="text-right">
                  {item.soldPrice != null ? (
                    <span className="chip border-mint/40 text-mint">{t.history.soldBadge}</span>
                  ) : (
                    <Price value={item.priceMid} currency={item.currency} className="text-sm font-bold text-acid" />
                  )}
                  <ArrowUpRight className="ml-auto mt-1 size-3.5 text-fog" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* FEATURES */}
      <section className="reveal reveal-3 grid grid-cols-1 gap-2.5">
        {[
          { icon: FEATURE_ICONS[0], title: t.home.features.f1t, desc: t.home.features.f1d },
          { icon: FEATURE_ICONS[1], title: t.home.features.f2t, desc: t.home.features.f2d },
          { icon: FEATURE_ICONS[2], title: t.home.features.f3t, desc: t.home.features.f3d },
          { icon: FEATURE_ICONS[3], title: t.home.features.f4t, desc: t.home.features.f4d },
        ].map((f) => (
          <div key={f.title} className="card flex gap-3.5 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-acid/10 text-acid">
              <f.icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{f.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-fog">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="reveal reveal-4 flex flex-col items-center gap-2 pb-6 text-center text-xs text-fog/70">
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-mint" />
          {t.home.offlineNote}
        </p>
        <Link href="/privacy" className="underline underline-offset-2 hover:text-bone">
          {t.privacy.title}
        </Link>
      </footer>
    </div>
  );
}
