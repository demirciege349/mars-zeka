// Saha Defteri: internet zayıfken de açılsın diye uygulama dosyalarını saklar.
var C = "saha-v1", FILES = ["./", "index.html", "local-store.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-180.png"];
self.addEventListener("install", function(e){ e.waitUntil(caches.open(C).then(function(c){ return c.addAll(FILES); })); self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(caches.keys().then(function(k){ return Promise.all(k.filter(function(x){ return x !== C; }).map(function(x){ return caches.delete(x); })); })); self.clients.claim(); });
self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function(r){ if (r.ok && new URL(e.request.url).origin === location.origin) { var cp = r.clone(); caches.open(C).then(function(c){ c.put(e.request, cp); }); } return r; })
    .catch(function(){ return caches.match(e.request); }));
});
