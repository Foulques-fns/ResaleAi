/* ResaleAI service worker — mode hors-ligne partiel (app HTML/CSS/JS) */
const VERSION = "ps-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const PRECACHE = [
  "/app/index.html",
  "/app/scan.html",
  "/app/estimation.html",
  "/app/history.html",
  "/app/alerts.html",
  "/app/offline.html",
  "/app/privacy.html",
  "/app/styles.css",
  "/app/app.js",
  "/app/index.js",
  "/app/scan.js",
  "/app/estimation.js",
  "/app/history.js",
  "/app/alerts.js",
  "/app/settings.html",
  "/app/settings.js",
  "/manifest.webmanifest",
  "/brand/resaleai-logo.svg",
  "/brand/resaleai-mark.svg",
  "/icons/icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API GET : réseau d'abord, cache en secours
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
        .catch(() => caches.match(req).then((r) => r || new Response("offline", { status: 503 }))),
    );
    return;
  }

  // Navigation : réseau d'abord, page cachée, puis /app/offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname.startsWith("/app/")) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (url.pathname.startsWith("/app/") || url.pathname === "/") {
            const offline = await caches.match("/app/offline.html");
            if (offline) return offline;
          }
          return new Response("offline", { status: 503 });
        }),
    );
    return;
  }

  // Statique local (js/css/icons/fonts proxys) : cache d'abord
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/app/")) {
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
    return;
  }
});
