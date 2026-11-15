/* Mars Zeka — bildirim servis çalışanı: bildirimlere dokununca uygulamayı öne getirir. */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(cs){
    for (var i = 0; i < cs.length; i++) if ("focus" in cs[i]) return cs[i].focus();
    return self.clients.openWindow("./");
  }));
});
