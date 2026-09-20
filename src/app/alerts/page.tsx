"use client";

import { useEffect, useState } from "react";
import { Bell, BellPlus, BellRing, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { timeAgo } from "@/lib/client-utils";
import { ChangeTag, EmptyState, Price, SectionTitle, Spinner } from "@/components/ui";
import { useIsOnline } from "@/components/pwa";

interface AlertItem {
  id: string;
  createdAt: string;
  query: string;
  itemLabel: string;
  currency: string;
  baselineMid: number;
  direction: string;
  active: boolean;
  lastCheckedAt: string | null;
  lastMid: number | null;
  lastChangePct: number | null;
}

interface CheckResult {
  triggered: boolean;
  changePct: number;
  currentMid: number;
  baselineMid: number;
  sampleSize: number;
  currency: string;
}

export default function AlertsPage() {
  const { t, lang } = useLang();
  const online = useIsOnline();
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("any");
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, CheckResult>>({});
  const [notifState, setNotifState] = useState<string>("default");

  const load = () => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    if (typeof Notification !== "undefined") setNotifState(Notification.permission);
  }, []);

  async function createAlert() {
    if (!query.trim() || creating) return;
    setCreating(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), direction, lang }),
      });
      setQuery("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function checkAlert(a: AlertItem) {
    setChecking(a.id);
    try {
      const res = await fetch("/api/alerts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, lang }),
      });
      const j = (await res.json()) as CheckResult;
      setCheckResult((prev) => ({ ...prev, [a.id]: j }));
      if (j.triggered && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(t.alerts.changed, {
          body: `${a.itemLabel}: ${j.changePct > 0 ? "+" : ""}${j.changePct}% (${j.currentMid} ${a.currency})`,
          icon: "/icons/icon.png",
        });
      }
      load();
    } catch {
      /* offline */
    } finally {
      setChecking(null);
    }
  }

  async function removeAlert(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" }).catch(() => {});
    setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-display text-2xl font-bold">{t.alerts.title}</h1>
        <p className="mt-1 text-sm text-fog">{t.alerts.subtitle}</p>
      </div>

      {/* create */}
      <section className="reveal reveal-1 card space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <BellPlus className="size-4 text-acid" /> {t.alerts.create}
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.alerts.queryPh}
          className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-fog">{t.alerts.direction}</span>
          <div className="flex gap-1.5">
            {(["any", "rise", "drop"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${direction === d ? "border-acid bg-acid text-ink" : "border-line text-fog"}`}
              >
                {t.alerts.dir[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={createAlert} disabled={creating || !online} className="btn-acid flex-1 !py-3 text-sm">
            {creating ? <Spinner className="size-4" /> : t.alerts.create}
          </button>
          {notifState !== "granted" && (
            <button
              className="btn-ghost !py-3 text-xs"
              onClick={async () => {
                if (typeof Notification === "undefined") return;
                const p = await Notification.requestPermission();
                setNotifState(p);
              }}
            >
              <BellRing className="size-4" /> {t.alerts.enableNotif}
            </button>
          )}
        </div>
        {notifState === "denied" && <p className="text-xs text-warn">{t.alerts.notifDenied}</p>}
      </section>

      {/* list */}
      <section className="reveal reveal-2 space-y-2.5">
        {items === null ? (
          <div className="grid place-items-center py-14">
            <Spinner className="text-acid" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="size-6" />} title={t.alerts.empty} />
        ) : (
          <>
            <SectionTitle>{items.length} {t.alerts.title.toLowerCase()}</SectionTitle>
            {items.map((a) => {
              const res = checkResult[a.id];
              return (
                <div key={a.id} className="card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{a.itemLabel}</p>
                      <p className="mt-0.5 text-xs text-fog">
                        {t.alerts.baseline}: <Price value={a.baselineMid} currency={a.currency} className="font-bold text-bone" />
                        {" · "}
                        {t.alerts.lastCheck} {a.lastCheckedAt ? timeAgo(a.lastCheckedAt, lang) : t.alerts.never}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.lastChangePct != null && <ChangeTag pct={a.lastChangePct} />}
                      <button onClick={() => removeAlert(a.id)} className="grid size-8 place-items-center rounded-lg bg-ink-3 text-fog hover:text-danger" aria-label={t.alerts.delete}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => checkAlert(a)}
                    disabled={checking === a.id || !online}
                    className="btn-ghost w-full !py-2.5 text-xs"
                  >
                    {checking === a.id ? (
                      <>
                        <Spinner className="size-3.5" /> {t.alerts.checking}
                      </>
                    ) : (
                      <>
                        <BellRing className="size-3.5" /> {t.alerts.check}
                      </>
                    )}
                  </button>
                  {res && (
                    <p className={`text-xs ${res.triggered ? "font-bold text-warn" : "text-mint"}`}>
                      {res.triggered ? t.alerts.changed : t.alerts.unchanged} ·{" "}
                      <Price value={res.currentMid} currency={res.currency} className="font-bold" /> ({res.changePct > 0 ? "+" : ""}
                      {res.changePct}%) · {res.sampleSize} {t.result.listings}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </section>
    </div>
  );
}
