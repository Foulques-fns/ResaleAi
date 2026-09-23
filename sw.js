/* ResaleAI — Service Worker — GitHub Pages compatible */
const VERSION = "resaleai-gh-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const BASE = new URL("./", self.location.href);
const PRECACHE = [
  "./", "./index.html", "./scan.html", "./estimation.html", "./history.html",
  "./alerts.html", "./settings.html", "./offline.html", "./privacy.html",
  "./styles.css", "./app.js", "./index.js", "./scan.js", "./estimation.js",
  "./history.js", "./alerts.js", "./settings.js", "./brand/resaleai-logo.svg",
  "./brand/resaleai-mark.svg", "./manifest.webmanifest"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API calls: never pretend that a missing API is an internet outage.
  if (url.pathname.includes("/api/")) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({error:"BACKEND_UNAVAILABLE"}), {status:503, headers:{"Content-Type":"application/json"}})));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then(res => { if(res.ok) caches.open(SHELL_CACHE).then(c=>c.put(req,res.clone())); return res; }).catch(async()=> (await caches.match(req)) || (await caches.match(new URL("./offline.html", self.location.href))) || new Response("Offline",{status:503})));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => { if(res.ok) caches.open(STATIC_CACHE).then(c=>c.put(req,res.clone())); return res; })));
});
