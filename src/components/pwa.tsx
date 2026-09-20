"use client";

import { useEffect, useState } from "react";
import { Download, Wifi, WifiOff } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function SWRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent("ps:installable"));
    });
  }, []);
  return null;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function OnlinePill() {
  const online = useIsOnline();
  const { t } = useLang();
  if (online) return null;
  return (
    <span className="chip border-warn/40 text-warn">
      <WifiOff className="size-3" /> {t.common.offline}
    </span>
  );
}

export function InstallButton({ className = "" }: { className?: string }) {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const { t } = useLang();

  useEffect(() => {
    if (deferredPrompt) setCanInstall(true);
    const avail = () => setCanInstall(true);
    const done = () => {
      setInstalled(true);
      setCanInstall(false);
    };
    window.addEventListener("ps:installable", avail);
    window.addEventListener("appinstalled", done);
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("ps:installable", avail);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (installed || !canInstall) return null;

  return (
    <button
      className={`btn-ghost !py-2 text-sm ${className}`}
      onClick={async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") setCanInstall(false);
        deferredPrompt = null;
      }}
    >
      <Download className="size-4" />
      {t.home.install}
    </button>
  );
}

export function WifiIcon() {
  return <Wifi className="size-3" />;
}
