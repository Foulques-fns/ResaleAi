/* ResaleAI — scanner : caméra en direct (getUserMedia), recadrage,
   état, notes, code-barres, identification IA puis estimation. */
(() => {
  "use strict";
  const T = () => PS.t();
  const LANG = PS.lang;
  PS.chrome("scan", { back: true });
  PS.registerPWA();

  const main = document.getElementById("main");

  /* ------------------------------ état ------------------------------ */
  const state = {
    photos: [], // {id, original, edited}
    condition: "good",
    notes: "",
    barcode: "",
    ai: null, // {aiAvailable, hypotheses, suspicious, category}
    selectedHyp: 0,
    name: "",
    brand: "",
    model: "",
    lotMode: false,
    step: "capture", // capture | confirm | progress
    progress: 0,
    error: null,
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const MAX_PHOTOS = 5;

  /* =========================== CAMÉRA EN DIRECT =========================== */
  let stream = null;
  let facing = "environment";
  let torchOn = false;
  let videoTrack = null;

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((tr) => tr.stop());
      stream = null;
      videoTrack = null;
    }
  }

  async function startCamera(video) {
    const constraints = {
      audio: false,
      video: {
        facingMode: facing === "user" ? "user" : { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1440 },
      },
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoTrack = stream.getVideoTracks()[0] || null;
    video.srcObject = stream;
    await video.play();
  }

  function openCameraModal() {
    const T2 = T();
    const modal = document.createElement("div");
    modal.className = "camera-modal";
    modal.innerHTML = `
      <video playsinline muted autoplay></video>
      <div class="camera-ui">
        <div class="camera-top">
          <button class="camera-btn-round" data-cam="close" aria-label="close">${PS.ICONS.x}</button>
          <span class="chip" style="background:rgba(0,0,0,0.5);border-color:rgba(255,255,255,0.2);color:#fff">${T2.cam}</span>
          <button class="camera-btn-round hidden" data-cam="torch" aria-label="${T2.scan.torch}">${PS.ICONS.lampOn}</button>
        </div>
        <div class="camera-bottom">
          <button class="camera-btn-round" data-cam="flip" aria-label="${T2.scan.flip}">${PS.ICONS.flip}</button>
          <button class="shutter" data-cam="shoot" aria-label="${T2.scan.shoot}"></button>
          <span style="width:3rem"></span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const video = modal.querySelector("video");

    const cleanup = () => {
      stopCamera();
      modal.remove();
      document.removeEventListener("visibilitychange", onVis);
    };
    const onVis = () => { if (document.hidden) cleanup(); };
    document.addEventListener("visibilitychange", onVis);

    startCamera(video)
      .then(() => {
        // torche si supportée
        const caps = videoTrack?.getCapabilities?.();
        if (caps && "torch" in caps) {
          const torchBtn = modal.querySelector('[data-cam="torch"]');
          torchBtn.classList.remove("hidden");
          torchBtn.onclick = async () => {
            torchOn = !torchOn;
            torchBtn.classList.toggle("active", torchOn);
            try { await videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch {}
          };
        }
      })
      .catch(() => {
        const err = document.createElement("div");
        err.className = "camera-error";
        err.innerHTML = `<div>
          <p class="bold" style="font-size:1.05rem">${T2.scan.camErr}</p>
          <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.25rem">
            <button class="btn btn--acid btn--sm" data-cam="native">${PS.ICONS.camera} ${T2.scan.camNative}</button>
            <button class="btn btn--ghost btn--sm" data-cam="close">${PS.ICONS.x}</button>
          </div>
        </div>`;
        modal.appendChild(err);
      });

    modal.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-cam]");
      if (!btn) return;
      const act = btn.dataset.cam;
      if (act === "close") cleanup();
      if (act === "native") {
        cleanup();
        nativeInput.click();
      }
      if (act === "flip") {
        facing = facing === "environment" ? "user" : "environment";
        try { await startCamera(video); } catch {}
      }
      if (act === "shoot") {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return;
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1280 / Math.max(vw, vh));
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        addPhoto(dataUrl);
        cleanup();
      }
    });
  }

  /* --------------------------- ajout de photos --------------------------- */
  function addPhoto(dataUrl) {
    if (state.photos.length >= MAX_PHOTOS) return;
    state.photos.push({ id: uid(), original: dataUrl, edited: dataUrl });
    tryDetectBarcode(dataUrl);
    render();
  }

  async function onFiles(files) {
    for (const file of [...files].slice(0, MAX_PHOTOS)) {
      try { addPhoto(await PS.compressImage(file, 1024, 0.72)); } catch {}
    }
  }

  // inputs cachés
  const nativeInput = document.createElement("input");
  nativeInput.type = "file";
  nativeInput.accept = "image/*";
  nativeInput.capture = "environment";
  nativeInput.multiple = true;
  nativeInput.className = "hidden";
  nativeInput.onchange = (e) => { onFiles(e.target.files); nativeInput.value = ""; };
  const galInput = document.createElement("input");
  galInput.type = "file";
  galInput.accept = "image/*";
  galInput.multiple = true;
  galInput.className = "hidden";
  galInput.onchange = (e) => { onFiles(e.target.files); galInput.value = ""; };
  document.body.append(nativeInput, galInput);

  /* ------------------------- détection code-barres ------------------------- */
  async function tryDetectBarcode(dataUrl) {
    if (state.barcode || typeof BarcodeDetector === "undefined") return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
      const codes = await det.detect(blob);
      if (codes.length) {
        state.barcode = codes[0].rawValue;
        PS.toast(`EAN ${codes[0].rawValue}`);
      }
    } catch {}
  }

  /* ------------------------------ recadrage ------------------------------ */
  function openCrop(photo) {
    const modal = document.createElement("div");
    modal.className = "crop-modal";
    modal.innerHTML = `
      <div class="modal-head" style="max-width:24rem;margin:0 auto;width:100%">
        <p class="bold" style="font-family:var(--font-display)">${T().scan.cropTitle}</p>
        <button class="icon-btn" data-crop="close">${PS.ICONS.x}</button>
      </div>
      <div class="crop-stage mt-3"><img src="${photo.original}" alt="" draggable="false"/></div>
      <p class="center xsmall muted mt-2">${T().scan.cropHelp}</p>
      <div style="display:flex;align-items:center;gap:0.75rem;max-width:24rem;width:100%;margin:0.75rem auto 0">
        <span class="muted">${PS.ICONS.zoom}</span>
        <input type="range" class="crop-zoom" min="1" max="3" step="0.01" value="1" />
      </div>
      <button class="btn btn--acid btn--block mt-3" style="max-width:24rem;margin:1.25rem auto 0" data-crop="ok">${PS.ICONS.check} ${T().scan.confirm}</button>`;
    document.body.appendChild(modal);
    const img = modal.querySelector("img");
    const stage = modal.querySelector(".crop-stage");
    const range = modal.querySelector("input");
    let zoom = 1, ox = 0, oy = 0, drag = null;
    const apply = () => { img.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${zoom})`; };
    apply();
    stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX - ox, y: e.clientY - oy }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener("pointermove", (e) => { if (drag) { ox = e.clientX - drag.x; oy = e.clientY - drag.y; apply(); } });
    stage.addEventListener("pointerup", () => (drag = null));
    range.oninput = () => { zoom = parseFloat(range.value); apply(); };
    modal.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-crop]");
      if (!b) return;
      if (b.dataset.crop === "close") modal.remove();
      if (b.dataset.crop === "ok") {
        photo.edited = await PS.cropImage(photo.original, { zoom, offsetX: ox, offsetY: oy });
        modal.remove();
        render();
      }
    });
  }

  /* ================================ RENDU ================================ */
  function render() {
    if (state.step === "progress") return renderProgress();
    if (state.step === "confirm") return renderConfirm();
    renderCapture();
  }

  function renderCapture() {
    const T2 = T();
    main.innerHTML = `
      <div class="stack">
        <div class="reveal">
          <h1 class="h-page">${T2.scan.title}</h1>
          <p class="small muted mt-1">${T2.scan.photoHint}</p>
        </div>
        <section class="reveal reveal-1">
          <div class="grid-photos" id="photoGrid"></div>
        </section>
        <section class="reveal reveal-2">
          <p class="field-label">${T2.scan.condition}</p>
          <div class="cond-row" id="condRow"></div>
        </section>
        <section class="reveal reveal-3">
          <label class="field-label" for="notes">${T2.scan.notes}</label>
          <textarea id="notes" class="input" rows="2" placeholder="${T2.scan.notesPh}"></textarea>
        </section>
        <section class="reveal reveal-4">
          <label class="field-label" for="ean">${T2.scan.barcode}</label>
          <div style="display:flex;gap:0.5rem">
            <div class="input-icon" style="flex:1">${PS.ICONS.barcode}<input id="ean" class="input" inputmode="numeric" maxlength="14" placeholder="${T2.scan.barcodePh}" value="${state.barcode}"/></div>
            <button id="eanBtn" class="btn btn--ghost btn--sm" style="align-self:center">${T2.scan.lookup}</button>
          </div>
          <p id="eanMsg" class="xsmall mt-1 ${state.eanOk ? "mint-text" : "muted"}">${state.eanMsg || ""}</p>
        </section>
        <div class="reveal reveal-5">
          ${state.error ? `<p class="small danger-text" style="margin-bottom:0.5rem">${state.error}</p>` : ""}
          <button id="go" class="btn btn--acid btn--block btn--lg">${PS.ICONS.search} ${state.photos.length ? T2.scan.analyze : T2.scan.describe}</button>
          ${!PS.isOnline() ? `<p class="xsmall warn-text center mt-2">${T2.scan.offlineTitle} — ${T2.scan.offlineBody}</p>` : ""}
        </div>
      </div>`;

    // photos
    const grid = document.getElementById("photoGrid");
    state.photos.forEach((p, i) => {
      const cell = document.createElement("div");
      cell.className = "photo-cell";
      cell.innerHTML = `<img src="${p.edited}" alt="photo ${i + 1}"/>${i === 0 ? '<span class="photo-first">1</span>' : ""}
        <div class="photo-actions">
          <button data-act="crop">${T2.scan.crop}</button>
          <button class="danger" data-act="del" aria-label="delete">${PS.ICONS.trash.replace('width="20" height="20"','width="14" height="14"')}</button>
        </div>`;
      cell.querySelector('[data-act="crop"]').onclick = () => openCrop(p);
      cell.querySelector('[data-act="del"]').onclick = () => { state.photos = state.photos.filter((x) => x.id !== p.id); render(); };
      grid.appendChild(cell);
    });
    if (state.photos.length < MAX_PHOTOS) {
      const camBtn = document.createElement("button");
      camBtn.className = "photo-add photo-add--cam";
      camBtn.innerHTML = `<span>${PS.ICONS.camera}<br/>${T2.scan.cam}</span>`;
      camBtn.onclick = () => {
        if (navigator.mediaDevices?.getUserMedia) openCameraModal();
        else nativeInput.click();
      };
      grid.appendChild(camBtn);
      if (state.photos.length === 0) {
        const galBtn = document.createElement("button");
        galBtn.className = "photo-add photo-add--gal";
        galBtn.innerHTML = `<span>${PS.ICONS.image}<br/>${T2.scan.gal}</span>`;
        galBtn.onclick = () => galInput.click();
        grid.appendChild(galBtn);
      }
    }

    // conditions
    const condRow = document.getElementById("condRow");
    PS.CONDITIONS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "cond-btn" + (state.condition === c ? " active" : "");
      b.textContent = T2.res.cond[c];
      b.onclick = () => { state.condition = c; render(); };
      condRow.appendChild(b);
    });

    // notes / ean
    const notes = document.getElementById("notes");
    notes.value = state.notes;
    notes.oninput = () => (state.notes = notes.value);
    const ean = document.getElementById("ean");
    ean.oninput = () => { state.barcode = ean.value.replace(/[^\d]/g, ""); };
    document.getElementById("eanBtn").onclick = lookupBarcode;

    document.getElementById("go").onclick = startIdentify;
  }

  async function lookupBarcode() {
    if (!state.barcode) return;
    const msg = document.getElementById("eanMsg");
    msg.textContent = T().common.loading;
    try {
      const j = await (await fetch(`/api/barcode?code=${encodeURIComponent(state.barcode)}`)).json();
      if (j.found) {
        state.eanOk = true;
        state.eanMsg = `${T().scan.barcodeFound}: ${j.name}${j.brand ? " — " + j.brand : ""}`;
        if (!state.name) state.name = j.name;
        if (j.brand && !state.brand) state.brand = j.brand;
      } else {
        state.eanOk = false;
        state.eanMsg = T().scan.barcodeNotFound;
      }
    } catch { state.eanMsg = T().scan.barcodeNotFound; }
    msg.textContent = state.eanMsg;
    msg.className = `xsmall mt-1 ${state.eanOk ? "mint-text" : "muted"}`;
  }

  /* ---------------------------- identification ---------------------------- */
  async function startIdentify() {
    state.error = null;
    if (!PS.isOnline()) { state.error = T().scan.netErr; render(); return; }
    if (state.photos.length === 0) {
      state.ai = { aiAvailable: false, hypotheses: [], suspicious: null, category: null };
      state.step = "confirm";
      render();
      return;
    }
    showProgress(0);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "identify",
          images: state.photos.map((p) => p.edited),
          condition: state.condition,
          notes: state.notes,
          lang: LANG,
        }),
      });
      state.ai = await res.json();
      const h = state.ai.hypotheses?.[0];
      if (h) { state.selectedHyp = 0; state.name = h.label || ""; state.brand = h.brand || ""; state.model = h.model || ""; }
      hideProgress();
      state.step = "confirm";
      render();
    } catch {
      hideProgress();
      state.error = T().scan.netErr;
      render();
    }
  }

  function renderConfirm() {
    const T2 = T();
    const ai = state.ai;
    main.innerHTML = `
      <div class="stack">
        <div class="reveal">
          <h1 class="h-page">${ai.hypotheses.length > 1 ? T2.scan.hypTitle : ai.hypotheses.length === 1 ? T2.scan.identified : T2.scan.title}</h1>
          <p class="small muted mt-1">${ai.hypotheses.length > 1 ? T2.scan.hypHint : ai.aiAvailable ? T2.res.guided : T2.scan.aiMissing}</p>
        </div>
        ${ai.suspicious ? `<div class="danger-box reveal">${ai.suspicious}</div>` : ""}
        <div id="hyps" class="stack-sm reveal reveal-1"></div>
        <div class="card card--pad stack-sm reveal reveal-2">
          <p class="field-label" style="margin:0">${T2.scan.manual}</p>
          <input id="fName" class="input" placeholder="${T2.scan.namePh}"/>
          <div class="grid-2">
            <input id="fBrand" class="input" placeholder="${T2.scan.brand}"/>
            <input id="fModel" class="input" placeholder="${T2.scan.model}"/>
          </div>
        </div>
        <label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.75rem" class="muted reveal reveal-3">
          <input id="lotChk" type="checkbox" ${state.lotMode ? "checked" : ""} style="width:1rem;height:1rem;accent-color:var(--acid);margin-top:0.1rem"/>
          <span><strong style="color:var(--bone)">${T2.scan.lot}</strong> — ${T2.scan.lotHint}</span>
        </label>
        ${state.error ? `<p class="small danger-text">${state.error}</p>` : ""}
        <button id="estimate" class="btn btn--acid btn--block btn--lg reveal reveal-3">${T2.scan.analyze}</button>
      </div>`;

    const hyps = document.getElementById("hyps");
    (ai.hypotheses || []).forEach((h, i) => {
      const b = document.createElement("button");
      b.className = "card hyp-card" + (i === state.selectedHyp ? " selected" : "");
      b.innerHTML = `<div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
          <p style="font-size:0.875rem;font-weight:700"></p>
          <span class="chip ${h.confidence >= 0.75 ? "chip--mint" : h.confidence >= 0.5 ? "chip--warn" : "chip--danger"}">${Math.round((h.confidence || 0) * 100)}%</span>
        </div>
        <p class="xsmall muted mt-1">${[h.brand, h.model, h.category].filter(Boolean).join(" · ")}</p>
        ${h.rationale ? `<p class="xsmall muted mt-1" style="font-style:italic">${h.rationale}</p>` : ""}`;
      b.querySelector("p").textContent = h.label || "";
      b.onclick = () => {
        state.selectedHyp = i;
        state.name = h.label || "";
        state.brand = h.brand || "";
        state.model = h.model || "";
        renderConfirm();
      };
      hyps.appendChild(b);
    });

    const fName = document.getElementById("fName");
    const fBrand = document.getElementById("fBrand");
    const fModel = document.getElementById("fModel");
    fName.value = state.name; fBrand.value = state.brand; fModel.value = state.model;
    fName.oninput = () => (state.name = fName.value);
    fBrand.oninput = () => (state.brand = fBrand.value);
    fModel.oninput = () => (state.model = fModel.value);
    document.getElementById("lotChk").onchange = (e) => (state.lotMode = e.target.checked);

    document.getElementById("estimate").onclick = runEstimate;
  }

  /* ----------------------------- progression ----------------------------- */
  let progressTimer = null;
  function showProgress(step) {
    const T2 = T();
    const steps = T2.scan.steps;
    main.innerHTML = `<div class="loading-center" style="flex-direction:column;gap:1.5rem;min-height:70dvh">
      <div class="scan-frame progress-frame">
        ${state.photos[0] ? `<img src="${state.photos[0].edited}" alt=""/>` : `<span style="display:grid;place-items:center;height:100%;color:var(--acid)">${PS.ICONS.search.replace('width="20" height="20"','width="40" height="40"')}</span>`}
        <span class="scan-laser"></span>
      </div>
      <div class="progress-steps">
        ${steps.map((s, i) => `<div class="progress-step ${i < step ? "done" : i === step ? "active" : ""}" data-step="${i}">
          <span class="ico">${i < step ? PS.ICONS.check.replace('width="20" height="20"','width="16" height="16"') : i === step ? PS.spinnerHTML() : '<span style="display:inline-block;width:1.25rem;height:1.25rem;border:1px solid var(--line);border-radius:50%"></span>'}</span>${s}
        </div>`).join("")}
      </div>
    </div>`;
  }
  function advanceProgress(i) {
    document.querySelectorAll(".progress-step").forEach((el, idx) => {
      el.classList.remove("active", "done");
      const ico = el.querySelector(".ico");
      if (idx < i) { el.classList.add("done"); ico.innerHTML = PS.ICONS.check.replace('width="20" height="20"','width="16" height="16"'); }
      else if (idx === i) { el.classList.add("active"); ico.innerHTML = PS.spinnerHTML(); }
    });
  }
  function hideProgress() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }

  async function runEstimate() {
    if (state.name.trim().length < 3) { state.error = T().scan.manual; renderConfirm(); return; }
    showProgress(0);
    let p = 1;
    progressTimer = setInterval(() => advanceProgress(Math.min(p++, 3)), 2300);
    try {
      const thumb = state.photos[0] ? await PS.cropImage(state.photos[0].edited, { zoom: 1, offsetX: 0, offsetY: 0, outSize: 160 }) : undefined;
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "estimate",
          images: state.photos.map((p) => p.edited),
          thumb,
          condition: state.condition,
          notes: state.notes,
          lang: LANG,
          barcode: state.barcode || undefined,
          confirmedLabel: state.name.trim(),
          confirmedBrand: state.brand.trim(),
          confirmedModel: state.model.trim(),
        }),
      });
      if (!res.ok) throw new Error("estimation failed");
      const result = await res.json();
      PS.cacheEst(result.id, result);
      if (state.lotMode) PS.addLot(result.id);
      location.href = `/app/estimation.html?id=${result.id}${state.lotMode ? "&lot=1" : ""}`;
    } catch {
      hideProgress();
      state.error = T().scan.netErr;
      state.step = "confirm";
      render();
    }
  }

  render();
})();
