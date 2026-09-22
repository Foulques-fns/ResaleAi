/* ResaleAI — alertes prix (vanilla) */
(() => {
  "use strict";
  const T = () => PS.t();
  const LANG = PS.lang;
  PS.chrome("alerts");
  PS.registerPWA();

  const main = document.getElementById("main");
  let items = null;
  let direction = "any";
  let creating = false;
  const results = {};

  main.innerHTML = `
    <div class="stack">
      <div class="reveal">
        <h1 class="h-page">${T().alerts.title}</h1>
        <p class="small muted mt-1">${T().alerts.subtitle}</p>
      </div>
      <section class="card card--pad stack-sm reveal reveal-1">
        <p class="small bold" style="display:flex;gap:0.4rem;align-items:center"><span class="acid-text">${PS.ICONS.bellPlus}</span>${T().alerts.create}</p>
        <input id="aq" class="input" placeholder="${T().alerts.queryPh}"/>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          <span class="xsmall muted">${T().alerts.dir}</span>
          <div style="display:flex;gap:0.35rem" id="dirBtns"></div>
        </div>
        <div style="display:flex;gap:0.5rem">
          <button id="createBtn" class="btn btn--acid" style="flex:1">${T().alerts.create}</button>
          <button id="notifBtn" class="btn btn--ghost btn--sm hidden">${PS.ICONS.bellRing} ${T().alerts.notif}</button>
        </div>
        <p id="notifDenied" class="xsmall warn-text hidden">${T().alerts.denied}</p>
      </section>
      <section id="list" class="stack-sm reveal reveal-2">
        <div class="loading-center" style="min-height:8rem;color:var(--acid)">${PS.spinnerHTML()}</div>
      </section>
    </div>`;

  const dirWrap = document.getElementById("dirBtns");
  ["any", "rise", "drop"].forEach((d) => {
    const b = document.createElement("button");
    b.className = "cond-btn" + (d === direction ? " active" : "");
    b.textContent = T().alerts.dirs[d];
    b.onclick = () => {
      direction = d;
      dirWrap.querySelectorAll(".cond-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
    dirWrap.appendChild(b);
  });

  // notifications
  if ("Notification" in window) {
    const btn = document.getElementById("notifBtn");
    if (Notification.permission === "default") btn.classList.remove("hidden");
    if (Notification.permission === "denied") document.getElementById("notifDenied").classList.remove("hidden");
    btn.onclick = async () => {
      const p = await Notification.requestPermission();
      btn.classList.toggle("hidden", p !== "default");
      document.getElementById("notifDenied").classList.toggle("hidden", p !== "denied");
    };
  }

  document.getElementById("createBtn").onclick = async function () {
    const q = document.getElementById("aq").value.trim();
    if (q.length < 3 || creating) return;
    creating = true;
    this.innerHTML = PS.spinnerHTML();
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, direction, lang: LANG }),
      });
      document.getElementById("aq").value = "";
      load();
    } finally {
      creating = false;
      this.textContent = T().alerts.create;
    }
  };

  function load() {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((j) => { items = j.items || []; render(); })
      .catch(() => { items = []; render(); });
  }

  function render() {
    const div = document.getElementById("list");
    div.innerHTML = "";
    if (!items.length) {
      const e = document.createElement("div");
      e.className = "card empty";
      e.innerHTML = `<span class="empty-icon">${PS.ICONS.bell}</span><p class="small muted">${T().alerts.empty}</p>`;
      div.appendChild(e);
      return;
    }
    items.forEach((a) => {
      const res = results[a.id];
      const card = document.createElement("div");
      card.className = "card card--pad stack-sm";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:flex-start">
          <div style="min-width:0">
            <p class="small bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></p>
            <p class="xsmall muted mt-1">
              ${T().alerts.baseline} : <strong class="num" style="color:var(--bone)">${PS.fmtPrice(a.baselineMid, a.currency)}</strong>
              · ${T().alerts.last} ${a.lastCheckedAt ? PS.timeAgo(a.lastCheckedAt) : T().alerts.never}
            </p>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            ${a.lastChangePct != null ? `<span class="chip ${a.lastChangePct > 0 ? "chip--mint" : a.lastChangePct < 0 ? "chip--danger" : ""} num">${a.lastChangePct > 0 ? "+" : ""}${a.lastChangePct}%</span>` : ""}
            <button class="icon-btn" data-del aria-label="${T().alerts.delete}">${PS.ICONS.trash.replace('width="20" height="20"','width="14" height="14"')}</button>
          </div>
        </div>
        <button class="btn btn--ghost btn--sm btn--block" data-check>${PS.ICONS.bellRing} ${T().alerts.check}</button>
        ${res ? `<p class="xsmall ${res.triggered ? "warn-text bold" : "mint-text"}">
          ${res.triggered ? T().alerts.changed : T().alerts.unchanged} ·
          <span class="num bold">${PS.fmtPrice(res.currentMid, res.currency)}</span>
          (${res.changePct > 0 ? "+" : ""}${res.changePct}%) · ${res.sampleSize} ${T().res.listings}
        </p>` : ""}`;
      card.querySelector("p.small.bold").textContent = a.itemLabel;
      card.querySelector("[data-del]").onclick = async () => {
        await fetch(`/api/alerts?id=${a.id}`, { method: "DELETE" }).catch(() => {});
        items = items.filter((x) => x.id !== a.id);
        render();
      };
      card.querySelector("[data-check]").onclick = async function () {
        this.innerHTML = `${PS.spinnerHTML()} ${T().alerts.checking}`;
        this.disabled = true;
        try {
          const j = await (
            await fetch("/api/alerts/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: a.id, lang: LANG }),
            })
          ).json();
          results[a.id] = j;
          if (j.triggered && "Notification" in window && Notification.permission === "granted") {
            new Notification(T().alerts.changed, {
              body: `${a.itemLabel}: ${j.changePct > 0 ? "+" : ""}${j.changePct}% (${j.currentMid} ${a.currency})`,
              icon: "/icons/icon.png",
            });
          }
          load();
        } catch {
          this.innerHTML = `${PS.ICONS.bellRing} ${T().alerts.check}`;
          this.disabled = false;
        }
      };
      div.appendChild(card);
    });
  }

  load();
})();
