"use client";

import type { HistoryItem } from "./types";

/** Compress + downscale a photo for upload & storage. */
export async function compressImage(file: File | Blob, maxSide = 1024, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Square-crop + zoom a data URL image; returns compressed data URL. */
export async function cropImage(
  src: string,
  opts: { zoom: number; offsetX: number; offsetY: number; outSize?: number },
): Promise<string> {
  const { zoom, offsetX, offsetY, outSize = 900 } = opts;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  const base = Math.max(outSize / img.width, outSize / img.height) * zoom;
  const dw = img.width * base;
  const dh = img.height * base;
  const dx = (outSize - dw) / 2 + offsetX;
  const dy = (outSize - dh) / 2 + offsetY;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.drawImage(img, dx, dy, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function formatPrice(v: number, currency = "EUR", lang = "fr"): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-GB" : "fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: v < 100 ? 2 : 0,
    }).format(v);
  } catch {
    return `${v} €`;
  }
}

export function timeAgo(iso: string, lang = "fr"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "en" ? "en" : "fr", { numeric: "auto" });
  if (min < 1) return rtf.format(0, "minute");
  if (min < 60) return rtf.format(-min, "minute");
  const h = Math.floor(min / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.floor(h / 24);
  if (d < 30) return rtf.format(-d, "day");
  const mo = Math.floor(d / 30);
  return rtf.format(-mo, "month");
}

/* ------------------------- offline cache (localStorage) ------------------------- */
const K_HISTORY = "ps:cache:history";
const K_EST_PREFIX = "ps:cache:est:";
const K_LOT = "ps:lot";

export function cacheHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(K_HISTORY, JSON.stringify(items.slice(0, 60)));
  } catch {
    /* storage full */
  }
}

export function readCachedHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(K_HISTORY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function cacheEstimate(id: string, data: unknown) {
  try {
    localStorage.setItem(K_EST_PREFIX + id, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

export function readCachedEstimate<T = unknown>(id: string): T | null {
  try {
    const raw = localStorage.getItem(K_EST_PREFIX + id);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/* --------------------------------- lot mode --------------------------------- */
export function getLot(): string[] {
  try {
    const raw = localStorage.getItem(K_LOT);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addToLot(id: string): string[] {
  const lot = getLot();
  if (!lot.includes(id)) lot.push(id);
  try {
    localStorage.setItem(K_LOT, JSON.stringify(lot));
  } catch {
    /* noop */
  }
  return lot;
}

export function removeFromLot(id: string): string[] {
  const lot = getLot().filter((x) => x !== id);
  try {
    localStorage.setItem(K_LOT, JSON.stringify(lot));
  } catch {
    /* noop */
  }
  return lot;
}

export function clearLot() {
  try {
    localStorage.removeItem(K_LOT);
  } catch {
    /* noop */
  }
}
