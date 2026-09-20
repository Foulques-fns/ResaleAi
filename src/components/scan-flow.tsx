"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  PenLine,
  ScanBarcode,
  ScanSearch,
  Trash2,
  WifiOff,
  X,
  ZoomIn,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { addToLot, cacheEstimate, compressImage, cropImage } from "@/lib/client-utils";
import { CONDITIONS, type Condition, type IdentificationHypothesis } from "@/lib/types";
import { EmptyState, Spinner } from "@/components/ui";
import { useIsOnline } from "@/components/pwa";

const MAX_PHOTOS = 5;

interface Photo {
  id: string;
  original: string; // compressed data URL
  edited: string; // after crop (or same)
}

interface IdentifyResponse {
  aiAvailable: boolean;
  hypotheses: IdentificationHypothesis[];
  suspicious: string | null;
  category: string | null;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ---------------------------------- crop dialog ---------------------------------- */
function CropDialog({
  photo,
  onClose,
  onApply,
}: {
  photo: Photo;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const { t } = useLang();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-display font-bold">{t.scan.crop}</p>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-ink-3">
          <X className="size-4" />
        </button>
      </div>
      <div
        className="scan-frame relative mx-auto aspect-square w-full max-w-sm touch-none overflow-hidden rounded-2xl border border-line"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.original}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
            width: "100%",
          }}
        />
      </div>
      <p className="mt-2 text-center text-xs text-fog">{t.scan.cropHelp}</p>
      <div className="mx-auto mt-3 flex w-full max-w-sm items-center gap-3">
        <ZoomIn className="size-4 text-fog" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="crop-zoom"
        />
      </div>
      <button
        className="btn-acid mx-auto mt-5 w-full max-w-sm"
        onClick={async () => {
          const out = await cropImage(photo.original, { zoom, offsetX: offset.x, offsetY: offset.y });
          onApply(out);
        }}
      >
        <Check className="size-4" /> {t.scan.confirm}
      </button>
    </div>
  );
}

/* ---------------------------------- main flow ---------------------------------- */
type Stage = "capture" | "identify-loading" | "confirm" | "estimate-loading";

export function ScanFlow() {
  const { t, lang } = useLang();
  const router = useRouter();
  const online = useIsOnline();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cropTarget, setCropTarget] = useState<Photo | null>(null);
  const [condition, setCondition] = useState<Condition>("good");
  const [notes, setNotes] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeMsg, setBarcodeMsg] = useState<string | null>(null);
  const [barcodeBusy, setBarcodeBusy] = useState(false);

  const [stage, setStage] = useState<Stage>("capture");
  const [progressStep, setProgressStep] = useState(0);
  const [ai, setAi] = useState<IdentifyResponse | null>(null);
  const [selectedHyp, setSelectedHyp] = useState(0);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [lotMode, setLotMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const canManual = name.trim().length >= 3;

  async function openCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInput.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError("Accès à la caméra refusé ou indisponible.");
      cameraInput.current?.click();
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function captureCameraPhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPhotos((prev) => prev.length >= MAX_PHOTOS ? prev : [...prev, { id: uid(), original: dataUrl, edited: dataUrl }]);
    closeCamera();
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  /* -------- barcode auto-detect from photos (native BarcodeDetector when available) -------- */
  useEffect(() => {
    const last = photos[photos.length - 1];
    if (!last || barcode) return;
    const w = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (b: Blob) => Promise<{ rawValue: string }[]> } };
    if (!w.BarcodeDetector) return;
    fetch(last.edited)
      .then((r) => r.blob())
      .then((blob) => new w.BarcodeDetector!({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "code_128"] }).detect(blob))
      .then((codes) => {
        if (codes.length > 0) setBarcode(codes[0].rawValue);
      })
      .catch(() => {});
  }, [photos, barcode]);

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const list = Array.from(files).slice(0, MAX_PHOTOS);
    for (const file of list) {
      try {
        const dataUrl = await compressImage(file, 1024, 0.72);
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) return prev;
          return [...prev, { id: uid(), original: dataUrl, edited: dataUrl }];
        });
      } catch {
        /* ignore bad file */
      }
    }
  }, []);

  /* ------------------------------- identification ------------------------------- */
  async function runIdentify() {
    if (!online) {
      setError(t.scan.errors.network);
      return;
    }
    if (photos.length === 0) {
      // pas de photo -> saisie manuelle directe
      setAi({ aiAvailable: false, hypotheses: [], suspicious: null, category: null });
      setStage("confirm");
      return;
    }
    setStage("identify-loading");
    setError(null);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "identify",
          images: photos.map((p) => p.edited),
          condition,
          notes,
          lang,
        }),
      });
      const j = (await res.json()) as IdentifyResponse;
      setAi(j);
      if (j.hypotheses.length > 0) {
        const h = j.hypotheses[0];
        setSelectedHyp(0);
        setName(h.label ?? "");
        setBrand(h.brand ?? "");
        setModel(h.model ?? "");
      } else {
        setName("");
      }
      setStage("confirm");
    } catch {
      setError(t.scan.errors.network);
      setStage("capture");
    }
  }

  /* --------------------------------- estimation --------------------------------- */
  async function runEstimate() {
    if (!online) {
      setError(t.scan.errors.network);
      return;
    }
    if (!canManual && (!ai || ai.hypotheses.length === 0)) {
      setError(t.scan.errors.noPhotos);
      return;
    }
    setStage("estimate-loading");
    setProgressStep(0);
    const timer = setInterval(() => setProgressStep((s) => Math.min(s + 1, 3)), 2400);
    try {
      const thumb = photos[0] ? await cropImage(photos[0].edited, { zoom: 1, offsetX: 0, offsetY: 0, outSize: 160 }) : undefined;
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "estimate",
          images: photos.map((p) => p.edited),
          thumb,
          condition,
          notes,
          lang,
          barcode: barcode || undefined,
          confirmedLabel: name.trim() || undefined,
          confirmedBrand: brand.trim() || undefined,
          confirmedModel: model.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("estimate failed");
      const result = await res.json();
      cacheEstimate(result.id, result);
      if (lotMode) addToLot(result.id);
      router.push(`/estimation/${result.id}${lotMode ? "?lot=1" : ""}`);
    } catch {
      clearInterval(timer);
      setError(t.scan.errors.network);
      setStage("confirm");
      return;
    }
    clearInterval(timer);
  }

  function lookupBarcode() {
    if (!barcode.trim()) return;
    setBarcodeBusy(true);
    setBarcodeMsg(null);
    fetch(`/api/barcode?code=${encodeURIComponent(barcode.trim())}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.found) {
          setBarcodeMsg(`${t.scan.barcodeFound}: ${j.name}${j.brand ? " — " + j.brand : ""}`);
          if (!name.trim()) setName(j.name);
          if (j.brand && !brand.trim()) setBrand(j.brand);
        } else {
          setBarcodeMsg(t.scan.barcodeNotFound);
        }
      })
      .catch(() => setBarcodeMsg(t.scan.barcodeNotFound))
      .finally(() => setBarcodeBusy(false));
  }

  const steps = [t.scan.analyzing.s1, t.scan.analyzing.s2, t.scan.analyzing.s3, t.scan.analyzing.s4];

  /* ------------------------------ loading overlays ------------------------------ */
  if (stage === "identify-loading" || stage === "estimate-loading") {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6">
        <div className="scan-frame relative aspect-square w-40 overflow-hidden rounded-3xl border border-line bg-ink-2">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[0].edited} alt="" className="size-full object-cover opacity-70" />
          ) : (
            <span className="grid size-full place-items-center text-acid">
              <ScanSearch className="size-10" />
            </span>
          )}
          <span className="scan-laser" />
        </div>
        <div className="w-full max-w-xs space-y-2.5">
          {steps.map((s, i) => {
            const active = stage === "identify-loading" ? i === 0 : i === progressStep;
            const done = stage === "identify-loading" ? false : i < progressStep;
            return (
              <div key={s} className={`flex items-center gap-2.5 text-sm ${active ? "text-bone" : done ? "text-mint" : "text-fog/50"}`}>
                {done ? <Check className="size-4" /> : active ? <Loader2 className="spin size-4 text-acid" /> : <span className="size-4 rounded-full border border-line" />}
                {s}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ------------------------------ offline guard ------------------------------ */
  if (!online) {
    return (
      <EmptyState
        icon={<WifiOff className="size-6" />}
        title={t.offline.title}
        body={t.offline.body}
      />
    );
  }

  /* ------------------------------ confirm / identify ------------------------------ */
  if (stage === "confirm" && ai) {
    return (
      <div className="space-y-5">
        <div className="reveal">
          <h1 className="text-display text-2xl font-bold">
            {ai.hypotheses.length > 1 ? t.scan.hypothesesTitle : t.scan.aiMissingTitle}
          </h1>
          <p className="mt-1 text-sm text-fog">
            {ai.hypotheses.length > 1 ? t.scan.hypothesesHint : ai.aiAvailable ? t.result.identifiedAs : t.scan.aiMissing}
          </p>
        </div>

        {ai.suspicious && (
          <div className="reveal rounded-2xl border border-danger/50 bg-danger/10 p-3.5 text-sm text-danger">
            {ai.suspicious}
          </div>
        )}

        {ai.hypotheses.length > 0 && (
          <div className="reveal reveal-1 space-y-2">
            {ai.hypotheses.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedHyp(i);
                  setName(h.label ?? "");
                  setBrand(h.brand ?? "");
                  setModel(h.model ?? "");
                }}
                className={`card w-full p-3.5 text-left transition-all ${selectedHyp === i ? "border-acid/60 ring-1 ring-acid/30" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{h.label}</p>
                  <span className={`chip ${h.confidence >= 0.75 ? "border-mint/40 text-mint" : h.confidence >= 0.5 ? "border-warn/40 text-warn" : "border-danger/40 text-danger"}`}>
                    {Math.round(h.confidence * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-fog">
                  {[h.brand, h.model, h.category].filter(Boolean).join(" · ")}
                </p>
                {h.rationale && <p className="mt-1 text-xs italic text-fog/80">{h.rationale}</p>}
              </button>
            ))}
          </div>
        )}

        <div className="reveal reveal-2 card space-y-3 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fog">
            <PenLine className="size-3.5" /> {t.scan.manualName}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.scan.manualNamePh}
            className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder={t.scan.brand}
              className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
            />
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t.scan.model}
              className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
            />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button onClick={runEstimate} disabled={!canManual} className="btn-acid reveal reveal-3 w-full py-4">
          {t.scan.analyze} <ChevronRight className="size-4" />
        </button>

        <div className="flex items-center gap-2 text-xs text-fog">
          <input id="lot" type="checkbox" checked={lotMode} onChange={(e) => setLotMode(e.target.checked)} className="size-4 accent-[#c6f135]" />
          <label htmlFor="lot">
            <span className="font-semibold text-bone">{t.scan.lotMode}</span> — {t.scan.lotHint}
          </label>
        </div>
      </div>
    );
  }

  /* --------------------------------- capture stage --------------------------------- */
  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-display text-2xl font-bold">{t.scan.title}</h1>
        <p className="mt-1 text-sm text-fog">{t.scan.photoHint}</p>
      </div>

      {/* Photos */}
      <section className="reveal reveal-1">
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.edited} alt={`photo ${i + 1}`} className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-acid px-1.5 py-0.5 text-[0.5625rem] font-extrabold uppercase text-ink">1</span>}
              <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1.5">
                <button
                  onClick={() => setCropTarget(p)}
                  className="grid h-7 flex-1 place-items-center rounded-lg bg-ink/80 text-[0.625rem] font-bold backdrop-blur"
                >
                  {t.scan.crop}
                </button>
                <button
                  onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                  className="grid h-7 w-8 place-items-center rounded-lg bg-danger/80 backdrop-blur"
                  aria-label={t.scan.remove}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <>
              <button
                onClick={openCamera}
                className="scan-frame grid aspect-square place-items-center rounded-2xl bg-ink-2 text-acid transition-colors hover:bg-ink-3"
              >
                <span className="flex flex-col items-center gap-1.5">
                  <Camera className="size-6" />
                  <span className="px-1 text-center text-[0.625rem] font-bold uppercase tracking-wide">{t.scan.addPhoto}</span>
                </span>
              </button>
              {photos.length === 0 && (
                <button
                  onClick={() => galleryInput.current?.click()}
                  className="grid aspect-square place-items-center rounded-2xl border border-dashed border-line text-fog transition-colors hover:border-fog"
                >
                  <span className="flex flex-col items-center gap-1.5">
                    <ImagePlus className="size-6" />
                    <span className="px-1 text-center text-[0.625rem] font-bold uppercase tracking-wide">{t.scan.addGallery}</span>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </section>

      {/* Condition */}
      <section className="reveal reveal-2">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{t.scan.condition}</p>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all ${
                condition === c ? "border-acid bg-acid text-ink" : "border-line text-fog hover:border-fog/50"
              }`}
            >
              {t.cond[c]}
            </button>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="reveal reveal-3">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{t.scan.notes}</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.scan.notesPh}
          rows={2}
          className="w-full resize-none rounded-xl border border-line bg-ink px-3.5 py-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
        />
      </section>

      {/* Barcode */}
      <section className="reveal reveal-4">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-fog">{t.scan.barcode}</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog" />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.replace(/[^\d]/g, "").slice(0, 14))}
              inputMode="numeric"
              placeholder={t.scan.barcodePh}
              className="w-full rounded-xl border border-line bg-ink py-3 pl-9 pr-3 text-sm outline-none placeholder:text-fog/50 focus:border-acid/50"
            />
          </div>
          <button onClick={lookupBarcode} disabled={!barcode.trim() || barcodeBusy} className="btn-ghost !px-4 text-xs">
            {barcodeBusy ? <Spinner className="size-4" /> : t.scan.barcodeLookup}
          </button>
        </div>
        {barcodeMsg && <p className="mt-1.5 text-xs text-mint">{barcodeMsg}</p>}
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button onClick={runIdentify} className="btn-acid reveal reveal-5 w-full py-4 text-base">
        <ScanSearch className="size-5" />
        {photos.length === 0 ? t.scan.manualName : t.scan.analyze}
      </button>
      {photos.length === 0 && (
        <p className="-mt-3 text-center text-xs text-fog">{t.scan.aiMissing}</p>
      )}

      {cameraError && <p className="text-sm text-danger">{cameraError}</p>}

      {cameraOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-bold text-white">{t.scan.addPhoto}</p>
            <button onClick={closeCamera} className="grid size-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Fermer">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3">
            <video ref={videoRef} autoPlay muted playsInline className="max-h-full w-full rounded-3xl object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 aspect-square max-h-[70vh] -translate-y-1/2 rounded-3xl border-2 border-acid/70" />
          </div>
          <div className="flex items-center justify-center px-4 pb-8 pt-5">
            <button onClick={captureCameraPhoto} className="grid size-20 place-items-center rounded-full border-4 border-white bg-white/20 shadow-2xl">
              <span className="size-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}

      {cropTarget && (
        <CropDialog
          photo={cropTarget}
          onClose={() => setCropTarget(null)}
          onApply={(url) => {
            setPhotos((prev) => prev.map((x) => (x.id === cropTarget.id ? { ...x, edited: url } : x)));
            setCropTarget(null);
          }}
        />
      )}
    </div>
  );
}
