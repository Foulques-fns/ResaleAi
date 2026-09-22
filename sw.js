/* ResaleAI service worker — mode hors-ligne partiel (app HTML/CSS/JS) */
const VERSION = "ps-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const PRECACHE = [
  "./index.html",
  "./scan.html",
  "./estimation.html",
  "./history.html",
  "./alerts.html",
  "./offline.html",
  "./privacy.html",
  "./styles.css",
  "./app.js",
  "./index.js",
  "./scan.js",
  "./estimation.js",
  "./history.js",
  "./alerts.js",
  "./settings.html",
  "./settings.js",
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

  // Navigation : réseau d'abord, page cachée, puis ./offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (/\.(html|js|css|svg|webmanifest)$/.test(url.pathname))) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if ((/\.(html|js|css|svg|webmanifest)$/.test(url.pathname)) || url.pathname === "/") {
            const offline = await caches.match("./offline.html");
            if (offline) return offline;
          }
          return new Response("offline", { status: 503 });
        }),
    );
    return;
  }

  // Statique local (js/css/icons/fonts proxys) : cache d'abord
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/") || (/\.(html|js|css|svg|webmanifest)$/.test(url.pathname))) {
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
