"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/client-utils";
import { useLang } from "@/lib/i18n";
import { isNewListing } from "@/lib/relevance";
import type { Listing } from "@/lib/types";

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{children}</h2>
      {right}
    </div>
  );
}

export function Price({ value, currency, className = "" }: { value: number; currency?: string; className?: string }) {
  const { lang } = useLang();
  return <span className={`num ${className}`}>{formatPrice(value, currency ?? "EUR", lang)}</span>;
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useLang();
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-ghost !px-3 !py-2 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
    >
      {ok ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
      {ok ? t.result.copied : t.result.copy}
    </button>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  vinted: "bg-[#09B1BA]",
  ebay: "bg-[#E53238]",
  leboncoin: "bg-[#FF6E14]",
  dealabs: "bg-[#2A3FBF]",
  web: "bg-fog",
};

export function SourceDot({ source }: { source: string }) {
  return (
    <span
      className={`grid size-4 shrink-0 place-items-center rounded-full text-[0.5rem] font-extrabold text-white ${SOURCE_COLORS[source] ?? "bg-fog/70"}`}
    >
      {source === "web" ? "W" : ""}
    </span>
  );
}

export function ListingRow({ listing }: { listing: Listing }) {
  const { t } = useLang();
  const isNew = isNewListing(listing);
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="card card-hover flex items-center gap-3 p-3"
    >
      <SourceDot source={listing.source} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-bone">{listing.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fog">
          <span>{listing.sourceLabel}</span>
          {listing.conditionText ? <span>· {listing.conditionText}</span> : null}
          {listing.date ? <span>· {listing.date}</span> : null}
          {isNew ? <span className="chip !px-1.5 !py-0 !text-[0.5625rem] border-warn/40 text-warn">{t.result.newChip}</span> : null}
        </p>
      </div>
      <div className="text-right">
        <Price value={listing.price} currency={listing.currency} className="block text-sm font-bold text-acid" />
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-fog">
          {t.result.viewListing} <ExternalLink className="size-2.5" />
        </span>
      </div>
    </a>
  );
}

export function RangeBar({
  low,
  mid,
  high,
  min,
  max,
  currency,
}: {
  low: number;
  mid: number;
  high: number;
  min: number;
  max: number;
  currency: string;
}) {
  const span = Math.max(max - min, 1);
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / span) * 100));
  return (
    <div>
      <div className="range-track">
        <div className="range-fill" style={{ left: `${pct(low)}%`, width: `${Math.max(pct(high) - pct(low), 2)}%` }} />
        <span className="range-marker" style={{ left: `${pct(mid)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-fog">
        <Price value={min} currency={currency} />
        <Price value={max} currency={currency} />
      </div>
    </div>
  );
}

export function ChangeTag({ pct }: { pct: number }) {
  const up = pct > 0;
  if (Math.abs(pct) < 0.1)
    return <span className="chip text-fog">0%</span>;
  return (
    <span className={`chip ${up ? "border-mint/40 text-mint" : "border-danger/40 text-danger"}`}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-ink-3 text-acid">{icon}</span>
      <p className="text-display font-bold">{title}</p>
      {body ? <p className="text-sm text-fog">{body}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`spin size-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
