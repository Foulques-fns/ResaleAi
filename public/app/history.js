/* PriceSnap — historique + lot (vanilla) */
(() => {
  "use strict";
  const T = () => PS.t();
  PS.chrome("history");
  PS.registerPWA();

  const main = document.getElementById("main");
  let items = null;
  let offline = false;
  let filter = "";

  main.innerHTML = `
    <div class="stack">
      <div class="reveal">
        <h1 class="h-page">${T().hist.title}</h1>
        <p class="small muted mt-1">${T().hist.subtitle}</p>
      </div>
      <div id="stats"></div>
      <div id="lot"></div>
      <div class="input-icon reveal reveal-1">
        ${PS.ICONS.search}
        <input id="filter" class="input" placeholder="${T().hist.filter}"/>
      </div>
      <p id="offlineNote" class="xsmall warn-text hidden">${T().hist.offlineBadge}</p>
      <section id="list" class="stack-sm">
        <div class="loading-center" style="min-height:8rem;color:var(--acid)">${PS.spinnerHTML()}</div>
      </section>
    </div>`;

  document.getElementById("filter").oninput = (e) => { filter = e.target.value.toLowerCase(); renderList(); };

  fetch("/api/history")
    .then((r) => r.json())
    .then((j) => { items = j.items || []; PS.cacheHistory(items); renderAll(); })
    .catch(() => { items = PS.readHistory(); offline = true; renderAll(); });

  function renderAll() {
    document.getElementById("offlineNote").classList.toggle("hidden", !offline);
    renderStats();
    renderLot();
    renderList();
  }

  function renderStats() {
    const div = document.getElementById("stats");
    if (!items.length) { div.innerHTML = ""; return; }
    const potential = items.filter((i) => i.soldPrice == null).reduce((s, i) => s + i.priceMid, 0);
    const realized = items.reduce((s, i) => s + (i.soldPrice || 0), 0);
    div.innerHTML = `<div class="grid-2 reveal">
      <div class="card card--pad"><p class="xsmall muted">${T().hist.potential}</p><p class="num bold mt-1" style="font-family:var(--font-display);font-size:1.25rem">${PS.fmtPrice(potential)}</p></div>
      <div class="card card--pad"><p class="xsmall muted">${T().hist.realized}</p><p class="num bold mint-text mt-1" style="font-family:var(--font-display);font-size:1.25rem">${PS.fmtPrice(realized)}</p></div>
    </div>`;
  }

  function renderLot() {
    const div = document.getElementById("lot");
    const lotIds = PS.getLot();
    const lotItems = items.filter((i) => lotIds.includes(i.id));
    if (!lotItems.length) { div.innerHTML = ""; return; }
    const low = lotItems.reduce((s, i) => s + i.priceLow, 0);
    const high = lotItems.reduce((s, i) => s + i.priceHigh, 0);
    div.innerHTML = `<section id="lot" class="card card--pad reveal" style="border-color:rgba(198,241,53,0.4)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <p class="small bold" style="display:flex;gap:0.4rem;align-items:center"><span class="acid-text">${PS.ICONS.layers}</span>${T().scan.lot} · ${lotItems.length}</p>
        <button id="clearLot" class="xsmall bold" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.75rem">${T().scan.lotClear}</button>
      </div>
      <p class="num" style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;margin-top:0.5rem">${PS.fmtPrice(low)} <span class="muted">–</span> ${PS.fmtPrice(high)}</p>
      <p class="xsmall muted" style="margin-bottom:0.5rem">${T().scan.lotTotal}</p>
      <div id="lotList"></div>
    </section>`;
    const ll = div.querySelector("#lotList");
    lotItems.forEach((i) => {
      const a = document.createElement("a");
      a.href = `/app/estimation.html?id=${i.id}`;
      a.style.cssText = "display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.875rem;border-top:1px solid rgba(35,38,45,0.6);text-decoration:none;color:var(--bone)";
      const name = document.createElement("span");
      name.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:0.5rem";
      name.textContent = i.itemName;
      const price = document.createElement("span");
      price.className = "num bold acid-text";
      price.textContent = PS.fmtPrice(i.priceMid, i.currency);
      a.append(name, price);
      ll.appendChild(a);
    });
    div.querySelector("#clearLot").onclick = () => { PS.clearLot(); PS.toast(T().scan.lotCleared); renderLot(); };
  }

  function renderList() {
    const div = document.getElementById("list");
    div.innerHTML = "";
    const filtered = filter
      ? items.filter((i) => `${i.itemName} ${i.brand || ""}`.toLowerCase().includes(filter))
      : items;
    if (!filtered.length) {
      const e = document.createElement("div");
      e.className = "card empty";
      e.innerHTML = `<span class="empty-icon">${PS.ICONS.history}</span><p class="small muted">${T().hist.empty}</p>
        <a href="/app/scan.html" class="btn btn--acid btn--sm">${PS.ICONS.camera} ${T().home.scan}</a>`;
      div.appendChild(e);
      return;
    }
    filtered.forEach((item) => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = `/app/estimation.html?id=${item.id}`;
      const thumb = item.thumb
        ? `<img class="thumb thumb--big" src="${item.thumb}" alt=""/>`
        : `<span class="thumb thumb--big thumb-ph">${PS.ICONS.camera}</span>`;
      a.innerHTML = `${thumb}
        <div style="min-width:0;flex:1">
          <p class="listing-title"></p>
          <p class="xsmall muted" style="margin-top:0.2rem">${PS.timeAgo(item.createdAt)} · ${item.sampleSize} ${T().res.listings}</p>
          <p class="xsmall muted num" style="margin-top:0.25rem">${PS.fmtPrice(item.priceLow, item.currency)} – ${PS.fmtPrice(item.priceHigh, item.currency)}</p>
        </div>
        <div style="text-align:right">
          ${item.soldPrice != null
            ? `<span class="chip chip--mint">${T().hist.sold} <span class="num">${PS.fmtPrice(item.soldPrice, item.currency)}</span></span>`
            : `<span class="num bold acid-text" style="font-size:0.875rem">${PS.fmtPrice(item.priceMid, item.currency)}</span>`}
        </div>`;
      a.querySelector(".listing-title").textContent = item.itemName;
      div.appendChild(a);
    });
  }
})();
