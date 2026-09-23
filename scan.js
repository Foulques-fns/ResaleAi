/* ResaleAI — scanner : caméra HD, scan live code-barres, recadrage, estimation */
(() => {
  "use strict";
  const T = () => PS.t();
  const LANG = PS.lang;
  PS.chrome("scan", { back: true });
  PS.registerPWA();

  const main = document.getElementById("main");

  const state = {
    photos: [],        // {id, original, edited}
    condition: "good",
    notes: "",
    barcode: "",
    eanMsg: "",
    eanOk: false,
    ai: null,
    selectedHyp: 0,
    name: "",
    brand: "",
    model: "",
    lotMode: false,
    step: "capture",   // capture | confirm | progress
    error: null,
  };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const MAX_PHOTOS = 5;

  let photoStream = null;    // stream pour la caméra photo
  let barcodeStream = null;  // stream séparé pour le scanner barcode
  let facing = "environment";
  let torchOn = false;
  let photoVideoTrack = null;

  /* ─── normalisation du code ────────────────────────────────── */
  const normalizeCode = (raw) => (raw || "").toUpperCase().replace(/[^0-9X]/g, "");

  /* ─── vérification connectivité réelle ─────────────────────── */
  async function ensureReachable() {
    // Ne teste plus /api/health : sur GitHub Pages cette route n'existe pas
    // et provoquait à tort le message « connexion internet ».
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
      });
      return true;
    } catch {
      return false;
    }
  }

  /* ════════════════════════════════════════════════════════════
     CAMÉRA PHOTO — haute qualité
     ════════════════════════════════════════════════════════════ */
  function stopPhotoCamera() {
    if (photoStream) {
      photoStream.getTracks().forEach((t) => t.stop());
      photoStream = null;
      photoVideoTrack = null;
    }
  }

  async function startPhotoCamera(video) {
    stopPhotoCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing === "user" ? "user" : { ideal: "environment" },
        // Demande la résolution maximale disponible — pas de limitation
        width:  { ideal: 4096 },
        height: { ideal: 3072 },
      },
    });
    photoStream = stream;
    photoVideoTrack = stream.getVideoTracks()[0] || null;
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
          <button class="camera-btn-round" data-cam="close">${PS.ICONS.x}</button>
          <span class="chip" style="background:rgba(0,0,0,0.55);border-color:rgba(255,255,255,0.25);color:#fff">${T2.cam}</span>
          <button class="camera-btn-round hidden" id="torchBtn">${PS.ICONS.lampOn}</button>
        </div>
        <div class="camera-bottom">
          <button class="camera-btn-round" data-cam="flip">${PS.ICONS.flip}</button>
          <button class="shutter" data-cam="shoot" aria-label="${T2.scan.shoot}"></button>
          <span style="width:3rem"></span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const video = modal.querySelector("video");

    const onVis = () => { if (document.hidden) cleanup(); };
    document.addEventListener("visibilitychange", onVis);
    function cleanup() {
      stopPhotoCamera();
      modal.remove();
      document.removeEventListener("visibilitychange", onVis);
    }

    startPhotoCamera(video)
      .then(() => {
        // Torche
        const caps = photoVideoTrack?.getCapabilities?.();
        if (caps?.torch) {
          const btn = modal.querySelector("#torchBtn");
          btn.classList.remove("hidden");
          btn.onclick = async () => {
            torchOn = !torchOn;
            btn.classList.toggle("active", torchOn);
            try { await photoVideoTrack.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch {}
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
      if (act === "native") { cleanup(); nativeInput.click(); }
      if (act === "flip") {
        facing = facing === "environment" ? "user" : "environment";
        try { await startPhotoCamera(video); } catch {}
      }
      if (act === "shoot") {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return;
        // Capture à la résolution NATIVE — pas de downscaling ici
        const canvas = document.createElement("canvas");
        canvas.width = vw;
        canvas.height = vh;
        canvas.getContext("2d").drawImage(video, 0, 0, vw, vh);
        // Qualité 0.92 : bon ratio qualité/taille
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        addPhoto(dataUrl);
        cleanup();
      }
    });
  }

  /* ════════════════════════════════════════════════════════════
     SCANNER CODE-BARRES LIVE — modale indépendante
     ════════════════════════════════════════════════════════════ */
  function stopBarcodeCamera() {
    if (barcodeStream) {
      barcodeStream.getTracks().forEach((t) => t.stop());
      barcodeStream = null;
    }
  }

  function openBarcodeScanner() {
    const T2 = T();

    // Si BarcodeDetector n'est pas dispo → message + repli saisie
    if (typeof BarcodeDetector === "undefined") {
      PS.toast(T2.scan.barcodeUnavailable);
      return;
    }

    const modal = document.createElement("div");
    modal.className = "camera-modal";
    // On affiche un cadre de visée au centre pour guider l'utilisateur
    modal.innerHTML = `
      <video playsinline muted autoplay style="object-fit:cover;width:100%;height:100%"></video>
      <div class="camera-ui">
        <div class="camera-top">
          <button class="camera-btn-round" data-code="close">${PS.ICONS.x}</button>
          <span class="chip" style="background:rgba(0,0,0,0.55);border-color:rgba(255,255,255,0.25);color:#fff">${T2.scan.scanCodeLive}</span>
          <button class="camera-btn-round hidden" id="torchBtnBar">${PS.ICONS.lampOn}</button>
        </div>
        <!-- cadre de visée -->
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:72%;max-width:20rem;aspect-ratio:2.5/1;border:3px solid rgba(255,255,255,0.9);border-radius:0.75rem;box-shadow:0 0 0 2000px rgba(0,0,0,0.45);pointer-events:none">
          <span style="position:absolute;top:-1.5rem;left:0;right:0;text-align:center;font-size:0.75rem;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.7)">${T2.scan.scanCodeHint}</span>
          <!-- laser animé -->
          <span style="position:absolute;left:2%;right:2%;height:2px;background:linear-gradient(90deg,transparent,#2e78ff,transparent);animation:laser 1.8s ease-in-out infinite;top:48%;box-shadow:0 0 8px 2px rgba(46,120,255,0.5)"></span>
        </div>
        <div class="camera-bottom">
          <button class="camera-btn-round" data-code="flip">${PS.ICONS.flip}</button>
          <button class="camera-btn-round" data-code="manual" title="Saisir manuellement">${PS.ICONS.barcode}</button>
          <span style="width:3rem"></span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const video = modal.querySelector("video");
    let scanInterval = null;
    let detector = null;
    let barcodeVideoTrack = null;

    const onVis = () => { if (document.hidden) cleanup(null); };
    document.addEventListener("visibilitychange", onVis);

    function cleanup(detectedCode) {
      if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
      stopBarcodeCamera();
      modal.remove();
      document.removeEventListener("visibilitychange", onVis);
      // Si un code a été détecté, on l'injecte SANS re-render brutal
      if (detectedCode) {
        applyBarcode(detectedCode);
      }
    }

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
    }).then((s) => {
      barcodeStream = s;
      barcodeVideoTrack = s.getVideoTracks()[0] || null;
      video.srcObject = s;
      video.play();

      // Torche si dispo
      const caps = barcodeVideoTrack?.getCapabilities?.();
      if (caps?.torch) {
        const btn = modal.querySelector("#torchBtnBar");
        btn.classList.remove("hidden");
        btn.onclick = async () => {
          torchOn = !torchOn;
          btn.classList.toggle("active", torchOn);
          try { await barcodeVideoTrack.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch {}
        };
      }

      detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"],
      });

      scanInterval = setInterval(async () => {
        if (!detector || video.readyState < 2 || video.paused) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0) {
            const raw = codes[0].rawValue || "";
            if (raw) cleanup(raw);  // code trouvé → on ferme et on applique
          }
        } catch { /* continuer le scan */ }
      }, 250);  // détection toutes les 250 ms
    }).catch(() => {
      cleanup(null);
      PS.toast(T2.scan.camErr);
    });

    modal.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-code]");
      if (!btn) return;
      const act = btn.dataset.code;
      if (act === "close") cleanup(null);
      if (act === "manual") {
        cleanup(null);
        // Focus sur le champ de saisie manuelle après fermeture
        setTimeout(() => document.getElementById("ean")?.focus(), 80);
      }
      if (act === "flip") {
        // Retourner la caméra pendant le scan barcode
        const currentFacing = barcodeVideoTrack?.getSettings?.()?.facingMode || "environment";
        const newFacing = currentFacing === "user" ? "environment" : "user";
        stopBarcodeCamera();
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: newFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
          barcodeStream = s;
          barcodeVideoTrack = s.getVideoTracks()[0] || null;
          video.srcObject = s;
          video.play();
        } catch {}
      }
    });
  }

  /* ─── applique un code détecté SANS re-render de la page ─── */
  function applyBarcode(raw) {
    const code = normalizeCode(raw);
    if (!code) return;
    state.barcode = code;
    // Met à jour uniquement le champ visible (si la page est en mode capture)
    const eanInput = document.getElementById("ean");
    const eanMsg   = document.getElementById("eanMsg");
    if (eanInput) {
      eanInput.value = code;
      state.eanMsg = `${T().scan.barcodeDetected}: ${code}`;
      state.eanOk = true;
      if (eanMsg) {
        eanMsg.textContent = state.eanMsg;
        eanMsg.className = "xsmall mt-1 mint-text";
      }
      PS.toast(`📷 ${code}`);
    }
    // Lancer la résolution en arrière-plan
    doLookup(code);
  }

  /* ─── résolution EAN / ISBN en arrière-plan ─────────────────── */
  async function doLookup(code) {
    try {
      const res = await apiFetch(`/api/barcode?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && j.found) {
        state.eanOk = true;
        state.eanMsg = `${T().scan.barcodeFound}: ${j.name}${j.brand ? " — " + j.brand : ""}`;
        if (!state.name) state.name = j.name;
        if (j.brand && !state.brand) state.brand = j.brand;
      } else {
        state.eanOk = false;
        state.eanMsg = T().scan.barcodeNotFound;
      }
    } catch {
      state.eanOk = false;
      state.eanMsg = T().scan.netErr;
    }
    // Mise à jour de l'UI en place — uniquement le message, pas de re-render
    const eanMsg = document.getElementById("eanMsg");
    if (eanMsg) {
      eanMsg.textContent = state.eanMsg;
      eanMsg.className = `xsmall mt-1 ${state.eanOk ? "mint-text" : "muted"}`;
    }
    // Si produit trouvé et nom/marque récupérés, on peut mettre à jour les
    // champs de la phase confirm si elle est déjà affichée
    const fName = document.getElementById("fName");
    if (fName) fName.value = state.name;
  }

  /* ─── bouton "Rechercher" manuel ────────────────────────────── */
  async function lookupBarcode() {
    if (!state.barcode) return;
    const eanMsg = document.getElementById("eanMsg");
    if (eanMsg) eanMsg.textContent = T().common.loading;
    await doLookup(state.barcode);
  }

  /* ════════════════════════════════════════════════════════════
     PHOTOS
     ════════════════════════════════════════════════════════════ */
  function addPhoto(dataUrl) {
    if (state.photos.length >= MAX_PHOTOS) return;
    state.photos.push({ id: uid(), original: dataUrl, edited: dataUrl });
    // Essayer de détecter un barcode sur la photo ajoutée (sans re-render)
    tryDetectBarcodeFromBlob(dataUrl);
    render();
  }

  async function onFiles(files) {
    for (const file of [...files].slice(0, MAX_PHOTOS)) {
      try {
        // Galerie / fichier : compresser intelligemment sans trop dégrader
        const dataUrl = await compressForUpload(file);
        addPhoto(dataUrl);
      } catch {}
    }
  }

  // Compression adaptative : conserve au moins 2048px de côté, qualité 0.90
  async function compressForUpload(file) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2048;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.90);
  }

  async function tryDetectBarcodeFromBlob(dataUrl) {
    if (state.barcode || typeof BarcodeDetector === "undefined") return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
      const codes = await det.detect(blob);
      if (codes.length > 0) applyBarcode(codes[0].rawValue);
    } catch {}
  }

  // Inputs cachés
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

  /* ════════════════════════════════════════════════════════════
     RECADRAGE
     ════════════════════════════════════════════════════════════ */
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
        ${PS.ICONS.zoom}
        <input type="range" class="crop-zoom" min="1" max="3" step="0.01" value="1"/>
      </div>
      <button class="btn btn--acid btn--block mt-3" style="max-width:24rem;margin:1.25rem auto 0" data-crop="ok">
        ${PS.ICONS.check} ${T().scan.confirm}
      </button>`;
    document.body.appendChild(modal);
    const img = modal.querySelector("img");
    const stage = modal.querySelector(".crop-stage");
    const range = modal.querySelector("input[type=range]");
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

  /* ════════════════════════════════════════════════════════════
     RENDU PRINCIPAL
     ════════════════════════════════════════════════════════════ */
  function render() {
    if (state.step === "progress") return renderProgress();
    if (state.step === "confirm")  return renderConfirm();
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
          <label class="field-label">${T2.scan.barcode}</label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <div class="input-icon" style="flex:1;min-width:9rem">
              ${PS.ICONS.barcode}
              <input id="ean" class="input" inputmode="text" maxlength="14" autocapitalize="characters"
                placeholder="${T2.scan.barcodePh}" value="${state.barcode}"/>
            </div>
            <button id="eanBtn" class="btn btn--ghost btn--sm">${T2.scan.lookup}</button>
            <button id="scanCodeBtn" class="btn btn--ghost btn--sm" style="display:flex;align-items:center;gap:0.35rem">
              ${PS.ICONS.barcode} ${T2.scan.scanCode}
            </button>
          </div>
          <p id="eanMsg" class="xsmall mt-1 ${state.eanOk ? "mint-text" : "muted"}">${state.eanMsg || ""}</p>
        </section>

        <div class="reveal reveal-5">
          ${state.error ? `<p class="small danger-text" style="margin-bottom:0.5rem">${state.error}</p>` : ""}
          <button id="go" class="btn btn--acid btn--block btn--lg">
            ${PS.ICONS.search} ${state.photos.length ? T2.scan.analyze : T2.scan.describe}
          </button>
        </div>
      </div>`;

    /* ─── grille de photos ─── */
    const grid = document.getElementById("photoGrid");
    state.photos.forEach((p, i) => {
      const cell = document.createElement("div");
      cell.className = "photo-cell";
      cell.innerHTML = `
        <img src="${p.edited}" alt="photo ${i + 1}"/>
        ${i === 0 ? '<span class="photo-first">1</span>' : ""}
        <div class="photo-actions">
          <button data-act="crop">${T2.scan.crop}</button>
          <button class="danger" data-act="del">${PS.ICONS.trash.replace('width="20" height="20"','width="14" height="14"')}</button>
        </div>`;
      cell.querySelector('[data-act="crop"]').onclick = () => openCrop(p);
      cell.querySelector('[data-act="del"]').onclick = () => {
        state.photos = state.photos.filter((x) => x.id !== p.id);
        render();
      };
      grid.appendChild(cell);
    });
    if (state.photos.length < MAX_PHOTOS) {
      const camBtn = document.createElement("button");
      camBtn.className = "photo-add photo-add--cam";
      camBtn.innerHTML = `<span>${PS.ICONS.camera}<br/>${T2.scan.cam}</span>`;
      camBtn.onclick = () => navigator.mediaDevices?.getUserMedia ? openCameraModal() : nativeInput.click();
      grid.appendChild(camBtn);
      if (state.photos.length === 0) {
        const galBtn = document.createElement("button");
        galBtn.className = "photo-add photo-add--gal";
        galBtn.innerHTML = `<span>${PS.ICONS.image}<br/>${T2.scan.gal}</span>`;
        galBtn.onclick = () => galInput.click();
        grid.appendChild(galBtn);
      }
    }

    /* ─── conditions ─── */
    const condRow = document.getElementById("condRow");
    PS.CONDITIONS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "cond-btn" + (state.condition === c ? " active" : "");
      b.textContent = T2.res.cond[c];
      b.onclick = () => { state.condition = c; render(); };
      condRow.appendChild(b);
    });

    /* ─── notes ─── */
    const notesEl = document.getElementById("notes");
    notesEl.value = state.notes;
    notesEl.oninput = () => (state.notes = notesEl.value);

    /* ─── code-barres ─── */
    const ean = document.getElementById("ean");
    ean.value = state.barcode;
    ean.oninput = () => { state.barcode = normalizeCode(ean.value); ean.value = state.barcode; };
    document.getElementById("eanBtn").onclick = lookupBarcode;
    document.getElementById("scanCodeBtn").onclick = openBarcodeScanner;

    /* ─── bouton principal ─── */
    document.getElementById("go").onclick = startIdentify;
  }

  /* ════════════════════════════════════════════════════════════
     IDENTIFICATION IA
     ════════════════════════════════════════════════════════════ */
  async function startIdentify() {
    state.error = null;
    if (state.photos.length === 0) {
      state.ai = { aiAvailable: false, hypotheses: [], suspicious: null, category: null };
      state.step = "confirm";
      render();
      return;
    }
    showProgress(0);
    try {
      const res = await apiFetch("/api/estimate", {
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
      if (!res.ok) throw new Error("identify failed");
      state.ai = await res.json();
      const h = state.ai.hypotheses?.[0];
      if (h) { state.selectedHyp = 0; state.name = h.label || ""; state.brand = h.brand || ""; state.model = h.model || ""; }
      hideProgress();
      state.step = "confirm";
      render();
    } catch {
      hideProgress();
      const online = await ensureReachable();
      state.error = online
        ? (LANG === "fr"
          ? "Internet fonctionne, mais le serveur d’estimation n’est pas connecté. Configurez l’URL du backend dans les paramètres."
          : "Internet is working, but the estimation server is not connected. Configure the backend URL in settings.")
        : T().scan.netErr;
      // Passer quand même à confirm pour que l'utilisateur puisse saisir manuellement
      state.ai = state.ai || { aiAvailable: false, hypotheses: [], suspicious: null, category: null };
      state.step = "confirm";
      render();
    }
  }

  /* ════════════════════════════════════════════════════════════
     CONFIRMATION / SAISIE MANUELLE
     ════════════════════════════════════════════════════════════ */
  function renderConfirm() {
    const T2 = T();
    const ai = state.ai || { hypotheses: [], suspicious: null, aiAvailable: false };
    main.innerHTML = `
      <div class="stack">
        <div class="reveal">
          <h1 class="h-page">
            ${ai.hypotheses.length > 1 ? T2.scan.hypTitle : ai.hypotheses.length === 1 ? T2.scan.identified : T2.scan.title}
          </h1>
          <p class="small muted mt-1">
            ${ai.hypotheses.length > 1 ? T2.scan.hypHint : ai.aiAvailable ? T2.res.guided : T2.scan.aiMissing}
          </p>
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

    /* hypothèses IA */
    const hypsEl = document.getElementById("hyps");
    (ai.hypotheses || []).forEach((h, i) => {
      const b = document.createElement("button");
      b.className = "card hyp-card" + (i === state.selectedHyp ? " selected" : "");
      b.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
          <p style="font-size:0.875rem;font-weight:700"></p>
          <span class="chip ${h.confidence >= 0.75 ? "chip--mint" : h.confidence >= 0.5 ? "chip--warn" : "chip--danger"}">
            ${Math.round((h.confidence || 0) * 100)}%
          </span>
        </div>
        <p class="xsmall muted mt-1">${[h.brand, h.model, h.category].filter(Boolean).join(" · ")}</p>
        ${h.rationale ? `<p class="xsmall muted mt-1" style="font-style:italic">${h.rationale}</p>` : ""}`;
      b.querySelector("p").textContent = h.label || "";
      b.onclick = () => { state.selectedHyp = i; state.name = h.label||""; state.brand = h.brand||""; state.model = h.model||""; renderConfirm(); };
      hypsEl.appendChild(b);
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

  /* ════════════════════════════════════════════════════════════
     PROGRESSION
     ════════════════════════════════════════════════════════════ */
  let progressTimer = null;
  function showProgress(step) {
    const steps = T().scan.steps;
    main.innerHTML = `
      <div class="loading-center" style="flex-direction:column;gap:1.5rem;min-height:70dvh">
        <div class="scan-frame progress-frame">
          ${state.photos[0]
            ? `<img src="${state.photos[0].edited}" alt=""/>`
            : `<span style="display:grid;place-items:center;height:100%;color:var(--acid)">${PS.ICONS.search.replace('width="20" height="20"','width="40" height="40"')}</span>`}
          <span class="scan-laser"></span>
        </div>
        <div class="progress-steps">
          ${steps.map((s, i) => `
            <div class="progress-step ${i < step ? "done" : i === step ? "active" : ""}">
              <span class="ico">${i < step
                ? PS.ICONS.check.replace('width="20" height="20"','width="16" height="16"')
                : i === step
                  ? PS.spinnerHTML()
                  : '<span style="display:inline-block;width:1.25rem;height:1.25rem;border:1px solid var(--line);border-radius:50%"></span>'
              }</span>${s}
            </div>`).join("")}
        </div>
      </div>`;
  }
  function advanceProgress(i) {
    document.querySelectorAll(".progress-step").forEach((el, idx) => {
      el.classList.remove("active", "done");
      const ico = el.querySelector(".ico");
      if (idx < i)       { el.classList.add("done");   ico.innerHTML = PS.ICONS.check.replace('width="20" height="20"','width="16" height="16"'); }
      else if (idx === i) { el.classList.add("active"); ico.innerHTML = PS.spinnerHTML(); }
    });
  }
  function hideProgress() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }

  /* ════════════════════════════════════════════════════════════
     ESTIMATION
     ════════════════════════════════════════════════════════════ */
  async function runEstimate() {
    if (state.name.trim().length < 3) {
      state.error = T().scan.manual;
      renderConfirm();
      return;
    }
    showProgress(0);
    let p = 1;
    progressTimer = setInterval(() => advanceProgress(Math.min(p++, 3)), 2300);
    try {
      const thumb = state.photos[0]
        ? await PS.cropImage(state.photos[0].edited, { zoom: 1, offsetX: 0, offsetY: 0, outSize: 160 })
        : undefined;
      const res = await apiFetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "estimate",
          images: state.photos.map((ph) => ph.edited),
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
      if (!res.ok) throw new Error("estimate failed");
      const result = await res.json();
      PS.cacheEst(result.id, result);
      if (state.lotMode) PS.addLot(result.id);
      location.href = `./estimation.html?id=${result.id}${state.lotMode ? "&lot=1" : ""}`;
    } catch {
      hideProgress();
      const online = await ensureReachable();
      state.error = online
        ? (LANG === "fr" ? "L'estimation a échoué. Réessayez." : "The estimate failed. Please try again.")
        : T().scan.netErr;
      state.step = "confirm";
      render();
    }
  }

  render();
})();
