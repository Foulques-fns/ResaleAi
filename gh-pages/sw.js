/* ResaleAI — Service Worker — version GitHub Pages (statique) */
const VERSION = "resaleai-gh-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

/* Fichiers précachés à l'installation */
const PRECACHE = [
  "/",
  "/index.html",
  "/scan.html",
  "/estimation.html",
  "/history.html",
  "/alerts.html",
  "/settings.html",
  "/offline.html",
  "/privacy.html",
  "/styles.css",
  "/app.js",
  "/index.js",
  "/scan.js",
  "/estimation.js",
  "/history.js",
  "/alerts.js",
  "/settings.js",
  "/brand/resaleai-logo.svg",
  "/brand/resaleai-mark.svg",
  "/icons/icon.png",
  "/manifest.webmanifest",
];

/* ─── Installation ─────────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

/* ─── Activation / nettoyage des anciens caches ───────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/* ─── Interception des requêtes ───────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Requêtes API (backend séparé) : réseau d'abord, cache en secours */
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(
          () =>
            caches.match(req).then((r) => r || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })),
        ),
    );
    return;
  }

  /* Navigation (pages HTML) : réseau d'abord, cache, sinon offline.html */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match("/offline.html");
          return offline || new Response("Offline", { status: 503 });
        }),
    );
    return;
  }

  /* Assets statiques (JS, CSS, images, fonts) : cache d'abord */
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }),
    ),
  );
});
