/* ResaleAI — page d'accueil */
(() => {
  "use strict";
  const T = () => PS.t();
  PS.chrome("home");
  PS.registerPWA();

  const main = document.getElementById("main");
  const FEATURE_ICONS = [PS.ICONS.search, PS.ICONS.globe, PS.ICONS.wallet, PS.ICONS.zap];

  main.innerHTML = `
    <section class="reveal hero-card" style="margin-top:0.75rem">
      <div class="hero-brand">
        <img src="/brand/resaleai-logo.svg" alt="ResaleAI"/>
        <div>
          <p class="hero-kicker">${T().tagline}</p>
          <h1 class="h-page" style="margin-top:0.2rem">ResaleAI</h1>
        </div>
      </div>
      <h1 class="h-hero">${T().home.heroA}<br>
        <span class="hero-underline">${T().home.heroB}
          <svg viewBox="0 0 200 9" fill="none" preserveAspectRatio="none"><path d="M1 6C50 1.5 150 1.5 199 6" stroke="currentColor" stroke-opacity="0.18" stroke-width="2.5" stroke-linecap="round"/></svg>
        </span>
      </h1>
      <p class="lead">${T().home.sub}</p>
      <div style="display:flex;gap:0.75rem;margin-top:1.5rem">
        <a href="/scan.html" class="btn btn--acid btn--lg" style="flex:1">${PS.ICONS.camera} ${T().home.scan}</a>
        <a href="/history.html" class="btn btn--ghost btn--lg" aria-label="${T().nav.history}">${PS.ICONS.history}</a>
      </div>
      <div style="margin-top:0.75rem">
        <button data-install class="btn btn--ghost btn--sm hidden">${PS.ICONS.download} ${T().home.install}</button>
      </div>
    </section>
    <section id="stats" class="mt-4"></section>
    <section class="mt-4">
      <h2 class="section-title"><span>${T().home.recent}</span><button id="seeAll" class="hidden">${T().common.seeAll}</button></h2>
      <div id="recent" class="stack-sm">
        <div class="card loading-center" style="min-height:6rem">${PS.spinnerHTML()}</div>
      </div>
    </section>
    <section class="stack-sm mt-4" id="features"></section>
    <footer class="app-foot mt-4">
      <p style="display:flex;align-items:center;gap:0.4rem">${PS.ICONS.shield} ${T().home.offlineNote}</p>
      <a href="/privacy.html" style="text-decoration:underline">${T().home.privacy}</a>
    </footer>
  `;

  document.querySelector("[data-install]")?.addEventListener("click", PS.install);
  document.getElementById("seeAll").onclick = () => (location.href = "/history.html");

  // features
  const feat = document.getElementById("features");
  T().home.features.forEach(([ft, fd], i) => {
    const c = document.createElement("div");
    c.className = "card reveal";
    c.style.cssText = "display:flex;gap:0.875rem;padding:1rem;animation-delay:" + i * 0.06 + "s";
    c.innerHTML = `<span style="display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:0.75rem;background:rgba(198,241,53,0.1);color:var(--acid);flex-shrink:0">${FEATURE_ICONS[i]}</span>
      <div><p style="font-size:0.875rem;font-weight:700">${ft}</p><p class="muted xsmall" style="margin-top:0.15rem;line-height:1.5">${fd}</p></div>`;
    feat.appendChild(c);
  });

  // recent + stats
  apiFetch("/api/history")
    .then((r) => r.json())
    .then((j) => renderItems(j.items || [], false))
    .catch(() => renderItems(PS.readHistory(), true));

  function renderItems(items, offline) {
    PS.cacheHistory(items);
    const recent = document.getElementById("recent");
    recent.innerHTML = "";
    const stats = document.getElementById("stats");
    if (items.length) {
      const potential = items.filter((i) => i.soldPrice == null).reduce((s, i) => s + i.priceMid, 0);
      const realized = items.reduce((s, i) => s + (i.soldPrice || 0), 0);
      stats.innerHTML = `<div class="grid-2 reveal">
        <div class="card card--pad"><p class="xsmall muted" style="display:flex;gap:0.3rem;align-items:center"><span class="acid-text">${PS.ICONS.wallet.replace('width="20"','width="14"').replace('height="20"','height="14"')}</span>${T().home.potential}</p><p class="num bold" style="font-family:var(--font-display);font-size:1.4rem;margin-top:0.25rem">${PS.fmtPrice(potential)}</p></div>
        <div class="card card--pad"><p class="xsmall muted" style="display:flex;gap:0.3rem;align-items:center"><span class="mint-text">${PS.ICONS.piggy.replace('width="20"','width="14"').replace('height="20"','height="14"')}</span>${T().home.sold}</p><p class="num bold mint-text" style="font-family:var(--font-display);font-size:1.4rem;margin-top:0.25rem">${PS.fmtPrice(realized)}</p></div>
      </div>`;
      document.getElementById("seeAll").classList.remove("hidden");
    }
    if (!items.length) {
      const e = document.createElement("div");
      e.className = "card empty";
      e.innerHTML = `<span class="empty-icon">${PS.ICONS.camera}</span><p class="small muted">${T().home.empty}</p>
        <a href="/scan.html" class="btn btn--acid btn--sm">${T().home.scan}</a>`;
      recent.appendChild(e);
      return;
    }
    if (offline) {
      const w = document.createElement("p");
      w.className = "xsmall warn-text";
      w.textContent = T().hist.offlineBadge;
      recent.appendChild(w);
    }
    items.slice(0, 4).forEach((item) => recent.appendChild(historyRow(item)));
  }

  function historyRow(item) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = `/estimation.html?id=${item.id}`;
    const thumb = item.thumb
      ? `<img class="thumb" src="${item.thumb}" alt="" />`
      : `<span class="thumb thumb-ph">${PS.ICONS.camera}</span>`;
    a.innerHTML = `${thumb}
      <div style="min-width:0;flex:1">
        <p class="listing-title"></p>
        <p class="xsmall muted mt-1">${PS.timeAgo(item.createdAt)} · ${item.sampleSize} ${T().res.listings}</p>
      </div>
      <div style="text-align:right">
        ${item.soldPrice != null
          ? `<span class="chip chip--mint">${T().hist.sold}</span>`
          : `<span class="num bold acid-text" style="font-size:0.875rem">${PS.fmtPrice(item.priceMid, item.currency)}</span>`}
      </div>`;
    a.querySelector(".listing-title").textContent = item.itemName;
    return a;
  }
})();
