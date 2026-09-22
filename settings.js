/* ResaleAI — Paramètres, compte Google & PWA (vanilla) */
(() => {
  "use strict";
  const T = () => PS.t();
  PS.chrome("settings");
  PS.registerPWA();

  const main = document.getElementById("main");
  const store = {
    get(k, fb) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let authState = null;

  const linkedDefault = { Vinted: false, eBay: false, Leboncoin: false };

  function getLinked() {
    return store.get("ps:linked", linkedDefault);
  }
  function setLinked(v) {
    store.set("ps:linked", v);
  }

  async function fetchJson(url, init) {
    const res = await fetch(url, init);
    return await res.json();
  }

  async function getCsrfToken() {
    const data = await fetchJson(API_BASE + "/api/auth/csrf");
    return data.csrfToken;
  }

  async function signInGoogle() {
    if (!authState?.providers?.google) {
      PS.toast(PS.lang === "fr" ? "Google n'est pas configuré sur ce déploiement" : "Google is not configured on this deployment");
      return;
    }
    const csrfToken = await getCsrfToken();
    const body = new URLSearchParams({
      csrfToken,
      callbackUrl: `${location.origin}/settings.html`,
      json: "true",
    });
    const res = await apiFetch("/api/auth/signin/google", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (data?.url) location.href = data.url;
  }

  async function signOutReal() {
    const csrfToken = await getCsrfToken();
    const body = new URLSearchParams({
      csrfToken,
      callbackUrl: `${location.origin}/settings.html`,
      json: "true",
    });
    const res = await apiFetch("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    location.href = data?.url || "./settings.html";
  }

  function toggleLink(platform) {
    const cur = getLinked();
    cur[platform] = !cur[platform];
    setLinked(cur);
    render();
    PS.toast(cur[platform]
      ? `${platform} ${PS.lang === "fr" ? "lié" : "linked"} ✓`
      : `${platform} ${PS.lang === "fr" ? "déconnecté" : "unlinked"}`);
  }

  function clearData() {
    PS.cacheHistory([]);
    PS.clearLot();
    setLinked(linkedDefault);
    PS.toast(T().settings.cleared);
    setTimeout(() => location.reload(), 900);
  }

  const SRC_COLORS = { vinted: "#09B1BA", ebay: "#E53238", leboncoin: "#FF6E14" };
  const dotHTML = (src) => `<span style="display:inline-block;width:0.9rem;height:0.9rem;border-radius:50%;background:${SRC_COLORS[src] || "#9aa3af"};flex-shrink:0"></span>`;

  async function loadAuthState() {
    try {
      authState = await fetchJson(API_BASE + "/api/auth/status");
    } catch {
      authState = { authenticated: false, user: null, provider: null, emailVerified: null, providers: { google: false } };
    }
  }

  function render() {
    const s = T().settings;
    const isEn = PS.lang === "en";
    const user = authState?.user || null;
    const linked = getLinked();

    let authHTML;
    if (authState?.authenticated && user) {
      const initials = (user.name || "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      authHTML = `
        <div class="card card--pad" style="display:flex;align-items:center;gap:1rem">
          ${user.image
            ? `<img src="${user.image}" alt="" style="width:3.2rem;height:3.2rem;border-radius:50%;object-fit:cover;box-shadow:var(--shadow-sm);flex-shrink:0"/>`
            : `<div style="width:3.2rem;height:3.2rem;border-radius:50%;background:linear-gradient(135deg,#2e78ff,#2ed8a3);color:#fff;display:grid;place-items:center;font-size:1.1rem;font-weight:800;flex-shrink:0">${initials}</div>`}
          <div style="flex:1;min-width:0">
            <p class="bold">${user.name || "Google User"}</p>
            <p class="xsmall muted">${user.email || ""}</p>
            <p class="xsmall muted mt-1">${s.loggedInAs} <strong>${authState.provider || "google"}</strong>${authState.emailVerified ? " · ✓" : ""}</p>
          </div>
          <button class="btn btn--ghost btn--sm" id="logoutBtn">${s.logout}</button>
        </div>`;
    } else {
      authHTML = `
        <div class="card card--pad stack-sm">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.25rem">
            <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:linear-gradient(135deg,#2e78ff,#2ed8a3);color:#fff;display:grid;place-items:center;flex-shrink:0">${PS.ICONS.user.replace('width="20" height="20"','width="18" height="18"')}</div>
            <div><p class="bold">${s.loginTitle}</p><p class="xsmall muted mt-1" style="line-height:1.45">${s.loginSub}</p></div>
          </div>
          <button class="btn btn--social" id="googleBtn" ${authState?.providers?.google ? "" : "disabled"}>${PS.ICONS.google} ${s.google}</button>
          <button class="btn btn--social" disabled>${PS.ICONS.apple} ${s.apple} <span class="chip" style="margin-left:auto;text-transform:none;letter-spacing:0;color:var(--fog)">${isEn ? "Soon" : "Bientôt"}</span></button>
          <button class="btn btn--social" disabled>${PS.ICONS.ms} ${s.ms} <span class="chip" style="margin-left:auto;text-transform:none;letter-spacing:0;color:var(--fog)">${isEn ? "Soon" : "Bientôt"}</span></button>
          <button class="btn btn--social" disabled>${PS.ICONS.mail} ${s.email} <span class="chip" style="margin-left:auto;text-transform:none;letter-spacing:0;color:var(--fog)">${isEn ? "Soon" : "Bientôt"}</span></button>
          <button class="btn btn--social" disabled>${PS.ICONS.phone} ${s.phone} <span class="chip" style="margin-left:auto;text-transform:none;letter-spacing:0;color:var(--fog)">${isEn ? "Soon" : "Bientôt"}</span></button>
          ${!authState?.providers?.google ? `<p class="xsmall warn-text">${isEn ? "To enable real Google login, set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in the deployment environment." : "Pour activer la vraie connexion Google, renseignez AUTH_GOOGLE_ID et AUTH_GOOGLE_SECRET dans l'environnement du déploiement."}</p>` : ""}
        </div>`;
    }

    const linkedHTML = `
      <section class="reveal reveal-1">
        <h2 class="section-title">${s.linked}</h2>
        <div class="card" style="overflow:hidden">
          <div class="setting-row" style="border-bottom:1px solid rgba(219,227,238,0.6)">
            <div style="display:flex;align-items:center;gap:0.75rem">${dotHTML("vinted")}<div><p class="small bold">${s.vinted}</p><p class="xsmall muted">${s.vintedSub}</p></div></div>
            <input type="checkbox" class="toggle" data-link="Vinted" ${linked.Vinted ? "checked" : ""}/>
          </div>
          <div class="setting-row" style="border-bottom:1px solid rgba(219,227,238,0.6)">
            <div style="display:flex;align-items:center;gap:0.75rem">${dotHTML("ebay")}<div><p class="small bold">${s.ebay}</p><p class="xsmall muted">${s.ebaySub}</p></div></div>
            <input type="checkbox" class="toggle" data-link="eBay" ${linked.eBay ? "checked" : ""}/>
          </div>
          <div class="setting-row">
            <div style="display:flex;align-items:center;gap:0.75rem">${dotHTML("leboncoin")}<div><p class="small bold">${isEn ? "Link Leboncoin" : "Lier Leboncoin"}</p><p class="xsmall muted">${isEn ? "Import your listings (Simulated)" : "Importer vos annonces (Simulé)"}</p></div></div>
            <input type="checkbox" class="toggle" data-link="Leboncoin" ${linked.Leboncoin ? "checked" : ""}/>
          </div>
        </div>
      </section>`;

    const pwaHTML = `
      <section class="reveal reveal-2">
        <h2 class="section-title">${s.pwa}</h2>
        <div class="card card--pad" style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <img src="/brand/resaleai-mark.svg" alt="" style="width:2.5rem;height:2.5rem;border-radius:0.6rem;box-shadow:var(--shadow-sm)"/>
            <div><p class="small bold">ResaleAI</p><p class="xsmall muted">${s.pwaSub}</p></div>
          </div>
          <button class="btn btn--acid btn--sm" id="installBtn">${PS.ICONS.download.replace('width="20" height="20"','width="16" height="16"')} ${s.install}</button>
        </div>
      </section>`;

    const prefsHTML = `
      <section class="reveal reveal-3">
        <h2 class="section-title">${s.prefs}</h2>
        <div class="card" style="overflow:hidden">
          <div class="setting-row" style="border-bottom:1px solid rgba(219,227,238,0.6)">
            <div><p class="small bold">${s.lang}</p><p class="xsmall muted">${PS.lang === "fr" ? "Français" : "English"}</p></div>
            <button class="btn btn--ghost btn--sm" id="langBtn">${PS.lang === "fr" ? "English" : "Français"}</button>
          </div>
          <div class="setting-row">
            <div><p class="small bold">${isEn ? "Notifications" : "Notifications"}</p><p class="xsmall muted">${isEn ? "Price alerts (browser)" : "Alertes de prix (navigateur)"}</p></div>
            <input type="checkbox" class="toggle" id="notifToggle" ${typeof Notification !== "undefined" && Notification.permission === "granted" ? "checked" : ""}/>
          </div>
        </div>
      </section>`;

    const dataHTML = `
      <section class="reveal reveal-4">
        <h2 class="section-title">${s.data}</h2>
        <div class="card" style="overflow:hidden">
          <div class="setting-row" style="border-bottom:1px solid rgba(219,227,238,0.6)">
            <div><p class="small bold">${isEn ? "Privacy policy" : "Politique de confidentialité"}</p></div>
            <a href="/privacy.html" class="btn btn--ghost btn--sm">${PS.ICONS.shield.replace('width="20" height="20"','width="14" height="14"')}</a>
          </div>
          <div class="setting-row">
            <div><p class="small bold danger-text">${s.clearHistory}</p><p class="xsmall muted">${isEn ? "Erase all local data" : "Supprimer toutes les données locales"}</p></div>
            <button class="icon-btn" id="clearBtn" style="color:var(--danger);border-color:rgba(194,65,65,0.3)">${PS.ICONS.trash.replace('width="20" height="20"','width="14" height="14"')}</button>
          </div>
        </div>
      </section>`;

    main.innerHTML = `
      <div class="stack">
        <div class="reveal"><h1 class="h-page">${s.title}</h1></div>
        ${authHTML}
        ${linkedHTML}
        ${pwaHTML}
        ${prefsHTML}
        ${dataHTML}
      </div>`;

    document.getElementById("googleBtn")?.addEventListener("click", signInGoogle);
    document.getElementById("logoutBtn")?.addEventListener("click", signOutReal);
    document.getElementById("installBtn")?.addEventListener("click", () => PS.install());
    document.getElementById("langBtn")?.addEventListener("click", () => PS.setLang(PS.lang === "fr" ? "en" : "fr"));
    document.getElementById("clearBtn")?.addEventListener("click", clearData);
    main.querySelectorAll("[data-link]").forEach((el) => el.addEventListener("change", () => toggleLink(el.dataset.link)));
    const notif = document.getElementById("notifToggle");
    if (notif) {
      notif.addEventListener("change", async () => {
        if (typeof Notification === "undefined") return;
        if (notif.checked) {
          const p = await Notification.requestPermission();
          notif.checked = p === "granted";
          if (p === "denied") PS.toast(PS.lang === "fr" ? "Notifications refusées par le navigateur" : "Notifications denied by the browser");
        }
      });
    }
  }

  loadAuthState().then(render);
})();
