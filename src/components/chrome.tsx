"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { Bell, Camera, ChevronLeft, History, Languages, ScanBarcode } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { InstallButton, OnlinePill } from "./pwa";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-xl bg-acid text-ink">
        <ScanBarcode className="size-5" strokeWidth={2.4} />
      </span>
      <span className="text-display text-lg font-bold tracking-tight">
        Price<span className="text-acid">Snap</span>
      </span>
    </Link>
  );
}

function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <button
      className="chip hover:border-bone/40 transition-colors"
      onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      aria-label="Change language"
      title={t.common.lang}
    >
      <Languages className="size-3" />
      {lang.toUpperCase()}
    </button>
  );
}

const TABS = [
  { href: "/", key: "home", icon: (p: string) => <CameraIcon active={p === "/"} /> },
  { href: "/scan", key: "scan", icon: (p: string) => <Camera className={`size-5 ${p === "/scan" ? "text-acid" : ""}`} /> },
  { href: "/history", key: "history", icon: (p: string) => <History className={`size-5 ${p === "/history" ? "text-acid" : ""}`} /> },
  { href: "/alerts", key: "alerts", icon: (p: string) => <Bell className={`size-5 ${p === "/alerts" ? "text-acid" : ""}`} /> },
] as const;

function CameraIcon({ active }: { active: boolean }) {
  return <ScanBarcode className={`size-5 ${active ? "text-acid" : ""}`} />;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const isHome = pathname === "/";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          {isHome ? (
            <Logo />
          ) : (
            <button
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
              className="flex items-center gap-1 text-fog transition-colors hover:text-bone"
              aria-label={t.common.back}
            >
              <ChevronLeft className="size-5" />
              <span className="text-sm font-semibold">{t.common.back}</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <OnlinePill />
            <InstallButton />
            <LangSwitch />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>

      {/* Bottom tab bar */}
      <nav className="tabbar fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {TABS.map((tab) => {
            const label = t.nav[tab.key as keyof typeof t.nav];
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-1 py-2.5 text-[0.625rem] font-semibold uppercase tracking-wider"
              >
                <span className={active ? "text-acid" : "text-fog"}>{tab.icon(pathname)}</span>
                <span className={active ? "text-bone" : "text-fog/70"}>{label}</span>
                <span
                  className={`h-0.5 w-6 rounded-full transition-all ${active ? "bg-acid" : "bg-transparent"}`}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
