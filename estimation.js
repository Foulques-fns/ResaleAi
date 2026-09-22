/* ResaleAI — fiche d'estimation (vanilla) */
(() => {
  "use strict";
  const T = () => PS.t();
  const LANG = PS.lang;
  PS.chrome("scan", { back: true });
  PS.registerPWA();

  const main = document.getElementById("main");
  const id = new URLSearchParams(location.search).get("id");
  const cameFromLot = new URLSearchParams(location.search).get("lot") === "1";

  if (!id) { location.href = "./index.html"; return; }

  let result = null;
  let offline = false;

  fetch(`/api/estimate/${id}`)
    .then((r) => { if (!r.ok) throw new Error("404"); return r.json(); })
    .then((j) => { result = j; PS.cacheEst(j.id, j); render(); })
    .catch(() => {
      result = PS.readEst(id);
      offline = true;
      if (result) render();
      else location.href = "./history.html";
    });

  function pct(v, min, max) {
    const span = Math.max(max - min, 1);
    return Math.min(100, Math.max(0, ((v - min) / span) * 100));
  }

  function render() {
    const T2 = T();
    const r = result;
    const cur = r.currency;
    const conf = Math.round((r.confidence || 0) * 100);
    const scaleMin = r.stats.min > 0 ? r.stats.min * 0.9 : 0;
    const scaleMax = r.stats.max > 0 ? r.stats.max * 1.05 : r.priceHigh * 1.2 || 1;
    const inLot = PS.getLot().includes(r.id);

    main.innerHTML = `
      <div class="stack">
        ${cameFromLot && inLot ? `
          <div class="acid-box reveal">
            <strong class="acid-text">${T2.scan.lot}</strong>
            <span class="muted"> · ${PS.getLot().length} objets — </span>
            <a href="/history.html#lot" style="color:var(--bone);font-weight:600;text-decoration:underline">${T2.scan.lotView}</a>
          </div>` : ""}

        <section class="reveal">
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
            <span class="chip ${r.aiSource === "ai" && conf >= 75 ? "chip--mint" : conf >= 50 ? "chip--warn" : ""}">
              ${r.aiSource === "ai" ? `${conf}% ${T2.res.confidence}` : T2.res.guided}
            </span>
            ${r.category ? `<span class="chip">${r.category}</span>` : ""}
            <span class="chip">${T2.res.cond[r.condition] || r.condition}</span>
          </div>
          <h1 class="h-item mt-3" id="itemName"></h1>
          <p class="small muted mt-1" id="itemBrand"></p>
        </section>

        ${r.photos?.length ? `<section class="reveal reveal-1 photo-strip no-scrollbar">${r.photos.map((p) => `<img src="${p}" alt=""/>`).join("")}</section>` : ""}

        <section class="card reveal reveal-2" style="padding:1.25rem;position:relative;overflow:hidden">
          <div style="position:absolute;right:-2rem;top:-2rem;width:9rem;height:9rem;border-radius:50%;background:rgba(198,241,53,0.1);filter:blur(20px);pointer-events:none"></div>
          <p class="section-title" style="margin-bottom:0.5rem">${T2.res.range}</p>
          <p class="num" style="font-family:var(--font-display);font-size:1.9rem;font-weight:700">
            ${PS.fmtPrice(r.priceLow, cur)} <span class="muted">–</span> ${PS.fmtPrice(r.priceHigh, cur)}
          </p>
          <p class="small muted mt-1">
            ${T2.res.median} : <strong class="num" style="color:var(--bone)">${PS.fmtPrice(r.priceMid, cur)}</strong>
            · ${T2.res.basedOn} <strong style="color:var(--bone)">${r.stats.sampleSize}</strong> ${T2.res.listings}
          </p>
          ${(r.stats.droppedIrrelevant || 0) > 0 ? `<p class="xsmall muted mt-1">${r.stats.droppedIrrelevant} ${T2.res.dropped}${r.stats.usedSample ? ` · ${r.stats.usedSample} ${T2.res.usedCount}` : ""}</p>` : ""}
          ${r.stats.sampleSize > 0 ? `
            <div class="range-track">
              <div class="range-fill" style="left:${pct(r.priceLow, scaleMin, scaleMax)}%;width:${Math.max(pct(r.priceHigh, scaleMin, scaleMax) - pct(r.priceLow, scaleMin, scaleMax), 2)}%"></div>
              <span class="range-marker" style="left:${pct(r.priceMid, scaleMin, scaleMax)}%"></span>
            </div>
            <div class="range-legend"><span class="num">${PS.fmtPrice(r.stats.min, cur)}</span><span class="num">${PS.fmtPrice(r.stats.max, cur)}</span></div>
            <div class="range-cells">
              <div class="range-cell"><p class="k">${T2.res.low}</p><p class="num bold">${PS.fmtPrice(r.priceLow, cur)}</p></div>
              <div class="range-cell"><p class="k">${T2.res.mid}</p><p class="num bold acid-text">${PS.fmtPrice(r.priceMid, cur)}</p></div>
              <div class="range-cell"><p class="k">${T2.res.high}</p><p class="num bold">${PS.fmtPrice(r.priceHigh, cur)}</p></div>
            </div>` : `<p class="small warn-text mt-3">${T2.res.noListings}</p>`}
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:1rem">
            ${(r.stats.sources || []).map((s) => `<span class="chip">${s.label} · ${s.count}</span>`).join("")}
          </div>
          ${r.stats.newPriceHint ? `<p class="xsmall muted mt-2">${T2.res.newPrice} : <strong class="num" style="color:var(--bone)">${PS.fmtPrice(r.stats.newPriceHint, cur)}</strong></p>` : ""}
          ${r.stats.sampleSize > 0 ? `<p class="xsmall mt-2" style="color:rgba(154,163,175,0.7)">${T2.res.usedNote}</p>` : ""}
        </section>

        <section class="reveal reveal-3" id="soldSection"></section>
        <section class="reveal reveal-3">
          <h2 class="section-title">${T2.res.insights}</h2>
          <div class="grid-3">
            <div class="card center" style="padding:0.875rem 0.5rem">
              <div class="acid-text">${PS.ICONS.gem}</div>
              <p class="k" style="font-size:0.625rem;font-weight:700;text-transform:uppercase;color:var(--fog);margin-top:0.35rem">${T2.res.rarity}</p>
              <p class="small bold">${T2.res.rarities[r.insights.rarity] || r.insights.rarity}</p>
            </div>
            <div class="card center" style="padding:0.875rem 0.5rem">
              <div class="acid-text">${PS.ICONS.search}</div>
              <p class="k" style="font-size:0.625rem;font-weight:700;text-transform:uppercase;color:var(--fog);margin-top:0.35rem">${T2.res.demand}</p>
              <p class="small bold">${T2.res.demands[r.insights.demand] || r.insights.demand}</p>
            </div>
            <div class="card center" style="padding:0.875rem 0.5rem">
              <div class="acid-text">${PS.ICONS.clock}</div>
              <p class="k" style="font-size:0.625rem;font-weight:700;text-transform:uppercase;color:var(--fog);margin-top:0.35rem">${T2.res.sellTime}</p>
              <p class="small bold num">${r.insights.sellDaysLow}–${r.insights.sellDaysHigh} ${T2.res.days}</p>
            </div>
          </div>
        </section>

        <section id="anomalies"></section>

        <section class="reveal reveal-4">
          <h2 class="section-title">
            <span>${T2.res.comparables} (<span id="listCount"></span>)</span>
            ${PS.isOnline() ? `<button id="refreshBtn">${PS.ICONS.refresh.replace('width="20" height="20"','width="12" height="12"')} ${T2.res.refresh}</button>` : ""}
          </h2>
          <div id="listings" class="stack-sm"></div>
        </section>

        <section class="reveal reveal-5">
          <h2 class="section-title">${T2.res.trace}</h2>
          <div class="card" style="overflow:hidden">
            ${(r.searchLog || []).map((log) => `
              <div class="divider-cell">
                <span class="bold">${log.provider}</span>
                <span style="display:flex;gap:0.5rem;align-items:center;color:var(--fog)" class="xsmall">
                  ${log.status === "ok" ? `<span class="chip chip--mint">${log.count}</span>` : log.status === "empty" ? `<span class="chip">0</span>` : `<span class="chip chip--danger">${log.message || "error"}</span>`}
                  <span class="num" style="width:3.5rem;text-align:right">${log.ms} ms</span>
                </span>
              </div>`).join("")}
          </div>
          <p class="xsmall mt-1" style="color:rgba(154,163,175,0.7)">« ${r.queryText} » · ${PS.timeAgo(r.createdAt)}</p>
        </section>

        <section class="reveal reveal-5 stack-sm">
          <h2 class="section-title">${T2.res.advice}</h2>
          <div class="card card--pad">
            <p class="small bold" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem"><span class="acid-text">${PS.ICONS.list.replace('width="20" height="20"','width="16" height="16"')}</span>${T2.res.platforms}</p>
            <ul style="list-style:none;display:flex;flex-direction:column;gap:0.35rem" id="platformList"></ul>
          </div>
          <div class="card card--pad">
            <p class="small bold" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem"><span class="acid-text">${PS.ICONS.search.replace('width="20" height="20"','width="16" height="16"')}</span>${T2.res.keywords}</p>
            <div style="display:flex;flex-wrap:wrap;gap:0.35rem" id="keywordList"></div>
          </div>
          <div class="card card--pad">
            <p class="small bold" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem"><span class="acid-text">${PS.ICONS.camera.replace('width="20" height="20"','width="16" height="16"')}</span>${T2.res.photosTip}</p>
            <ul style="list-style:none;display:flex;flex-direction:column;gap:0.35rem" id="photoTips"></ul>
          </div>
          <div class="card card--pad">
            <p class="small bold" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.35rem"><span class="acid-text">${PS.ICONS.clock.replace('width="20" height="20"','width="16" height="16"')}</span>${T2.res.period}</p>
            <p class="small muted" id="periodNote"></p>
            <p class="xsmall muted mt-1" id="negoTip"></p>
          </div>
        </section>

        <section class="reveal reveal-5">
          <h2 class="section-title"><span>${T2.res.copyListing}</span><button id="copyBtn">${PS.ICONS.copy.replace('width="20" height="20"','width="12" height="12"')} ${T2.res.copy}</button></h2>
          <div class="card" style="padding:1rem"><pre class="copy-pre" id="copyPre"></pre></div>
        </section>

        <section class="reveal reveal-5">
          <h2 class="section-title">${T2.res.warnings}</h2>
          <div class="stack-sm" id="warnList"></div>
        </section>

        <div class="reveal" style="display:flex;gap:0.625rem;padding-bottom:0.5rem">
          <a href="./scan.html" class="btn btn--acid btn--lg" style="flex:1">${PS.ICONS.camera} ${T2.home.scan}</a>
          ${cameFromLot ? `<a href="./scan.html" class="btn btn--ghost btn--lg">${PS.ICONS.plus} ${T2.newObject}</a>` : ""}
        </div>
        <div class="center reveal" style="padding-bottom:1rem">
          <button id="deleteBtn" class="btn" style="background:none;color:rgba(154,163,175,0.7);font-size:0.75rem;padding:0.5rem">${PS.ICONS.trash.replace('width="20" height="20"','width="14" height="14"')} ${T2.res.delete}</button>
        </div>
        ${offline ? `<p class="xsmall warn-text">${T2.hist.offlineBadge}</p>` : ""}
        ${inLot && !cameFromLot ? `<a href="/history.html#lot" class="card floating-lot">${PS.ICONS.layers} ${T2.scan.lotView} (${PS.getLot().length})</a>` : ""}
      </div>`;

    // zones avec données externes → textContent anti-XSS
    document.getElementById("itemName").textContent = r.itemName;
    document.getElementById("itemBrand").textContent = [r.brand, r.model].filter(Boolean).join(" · ");
    document.getElementById("listCount").textContent = r.listings.length;
    document.getElementById("periodNote").textContent = r.advice.periodNote || "";
    if (r.advice.negociationTip) {
      const hint = document.getElementById("negoTip");
      hint.innerHTML = `<span style="display:inline-flex;vertical-align:-2px;color:var(--acid)">${PS.ICONS.zap.replace('width="20" height="20"','width="12" height="12"')}</span> `;
      hint.appendChild(document.createTextNode(r.advice.negociationTip));
    }
    document.getElementById("copyPre").textContent = r.listingCopy;

    const ul = document.getElementById("platformList");
    (r.advice.platforms || []).forEach((p) => {
      const li = document.createElement("li");
      li.className = "small";
      li.innerHTML = `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--acid);margin-right:0.5rem;vertical-align:middle"></span>`;
      const strong = document.createElement("strong");
      strong.textContent = p.name;
      li.appendChild(strong);
      const rs = document.createElement("span");
      rs.className = "muted";
      rs.textContent = " — " + p.reason;
      li.appendChild(rs);
      ul.appendChild(li);
    });
    const kw = document.getElementById("keywordList");
    (r.advice.keywords || []).forEach((k) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.style.textTransform = "none";
      c.textContent = k;
      kw.appendChild(c);
    });
    const tips = document.getElementById("photoTips");
    (r.advice.photoTips || []).forEach((tip) => {
      const li = document.createElement("li");
      li.className = "small muted";
      li.innerHTML = `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--fog);margin-right:0.5rem;vertical-align:middle"></span>`;
      li.appendChild(document.createTextNode(tip));
      tips.appendChild(li);
    });
    const warns = document.getElementById("warnList");
    (r.warnings || []).forEach((w) => {
      const p = document.createElement("p");
      p.className = "info-box";
      p.style.display = "flex";
      p.style.gap = "0.6rem";
      p.innerHTML = `<span style="color:var(--warn);flex-shrink:0">${PS.ICONS.alert.replace('width="20" height="20"','width="14" height="14"')}</span>`;
      p.appendChild(document.createTextNode(w));
      warns.appendChild(p);
    });

    // anomalies
    const anDiv = document.getElementById("anomalies");
    if (r.insights.anomalies?.length) {
      const h = document.createElement("h2");
      h.className = "section-title";
      h.textContent = T2.res.anomalies;
      const stack = document.createElement("div");
      stack.className = "stack-sm";
      r.insights.anomalies.forEach((a) => {
        const box = document.createElement("div");
        box.className = "warn-box";
        const head = document.createElement("p");
        head.className = "small bold";
        head.textContent = `${a.listing.title.slice(0, 70)} — ${PS.fmtPrice(a.listing.price, a.listing.currency)}`;
        const why = document.createElement("p");
        why.className = "xsmall muted mt-1";
        why.textContent = a.reason;
        box.append(head, why);
        stack.appendChild(box);
      });
      anDiv.append(h, stack);
    }

    // listings: occasion d'abord
    const listDiv = document.getElementById("listings");
    const sorted = [...r.listings].sort((a, b) => Number(PS.isNewListing(a)) - Number(PS.isNewListing(b)));
    sorted.slice(0, 12).forEach((l) => listDiv.appendChild(PS.listingRow(l)));
    if (!r.listings.length) {
      const p = document.createElement("p");
      p.className = "small muted";
      p.textContent = T2.res.noListings;
      listDiv.appendChild(p);
    }

    // actions
    renderSoldSection();

    document.getElementById("refreshBtn")?.addEventListener("click", refreshSearch);
    document.getElementById("copyBtn").onclick = async function () {
      await PS.copyText(r.listingCopy);
      this.innerHTML = `${PS.ICONS.check.replace('width="20" height="20"','width="12" height="12"')} ${T2.res.copied}`;
      setTimeout(() => render(), 2000);
    };
    document.getElementById("deleteBtn").onclick = async () => {
      await fetch(`/api/estimate/${r.id}`, { method: "DELETE" }).catch(() => {});
      PS.cacheEst(r.id, null);
      try { localStorage.removeItem("ps:cache:est:" + r.id); } catch {}
      location.href = "./history.html";
    };
  }

  function renderSoldSection() {
    const T2 = T();
    const r = result;
    const div = document.getElementById("soldSection");
    if (r.soldPrice != null) {
      const pctGain = r.priceMid > 0 ? (((r.soldPrice - r.priceMid) / r.priceMid) * 100).toFixed(1) : "0";
      const up = parseFloat(pctGain) >= 0;
      div.innerHTML = `<div class="card card--pad" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <p class="xsmall bold mint-text" style="text-transform:uppercase;letter-spacing:0.06em">${T2.res.soldAt}</p>
          <p class="num mint-text" style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;margin-top:0.25rem">${PS.fmtPrice(r.soldPrice, r.currency)}</p>
          ${r.soldPlatform ? `<p class="xsmall muted"></p>` : ""}
        </div>
        <span class="chip ${up ? "chip--mint" : "chip--danger"}">${up ? "+" : ""}${pctGain}%</span>
      </div>`;
      if (r.soldPlatform) div.querySelector("p.xsmall.muted").textContent = r.soldPlatform;
    } else {
      div.innerHTML = `<div style="display:flex;gap:0.625rem">
        <button class="btn btn--ghost" style="flex:1" id="soldBtn">${PS.ICONS.tag} ${T2.res.markSold}</button>
        <button class="btn btn--ghost" style="flex:1" id="lotBtn" ${PS.getLot().includes(r.id) ? "disabled" : ""}>
          ${PS.getLot().includes(r.id) ? PS.ICONS.check : PS.ICONS.plus} ${T2.scan.addLot}
        </button>
      </div>`;
      div.querySelector("#soldBtn").onclick = openSoldDialog;
      div.querySelector("#lotBtn").onclick = function () {
        PS.addLot(r.id);
        this.disabled = true;
        this.innerHTML = `${PS.ICONS.check} ${T2.scan.addLot}`;
      };
    }
  }

  function openSoldDialog() {
    const T2 = T();
    const r = result;
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `<div class="card modal">
      <div class="modal-head">
        <p class="bold" style="font-family:var(--font-display)">${T2.res.markSold}</p>
        <button class="icon-btn" data-x>${PS.ICONS.x}</button>
      </div>
      <input id="soldPrice" class="input" inputmode="decimal" placeholder="${T2.res.soldPricePh}" value="${r.priceMid || ""}"/>
      <input id="soldPlat" class="input" placeholder="${T2.res.soldPlatform}"/>
      <button class="btn btn--acid btn--block" id="soldSave">${T2.res.save}</button>
    </div>`;
    document.body.appendChild(back);
    back.querySelector("[data-x]").onclick = () => back.remove();
    back.querySelector("#soldSave").onclick = async () => {
      const price = parseFloat(back.querySelector("#soldPrice").value.replace(",", "."));
      if (!(price >= 0)) return;
      try {
        const j = await (
          await fetch(`/api/estimate/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ soldPrice: price, soldPlatform: back.querySelector("#soldPlat").value || null }),
          })
        ).json();
        result = j;
        PS.cacheEst(j.id, j);
      } catch {}
      back.remove();
      render();
    };
  }

  async function refreshSearch() {
    const r = result;
    const btn = document.getElementById("refreshBtn");
    btn.innerHTML = `${PS.spinnerHTML()} ${T().res.refresh}`;
    try {
      const res = await apiFetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "estimate",
          images: [],
          condition: r.condition,
          notes: "",
          lang: LANG,
          confirmedLabel: r.itemName,
          confirmedBrand: r.brand || "",
          confirmedModel: r.model || "",
        }),
      });
      const j = await res.json();
      if (j.id) {
        PS.cacheEst(j.id, j);
        location.href = `/estimation.html?id=${j.id}`;
      }
    } catch { PS.toast(T().scan.netErr); render(); }
  }
})();
