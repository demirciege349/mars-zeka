/* Mars Zeka — yayındaki sayfaların başlatıcısı. Sayfa, <body data-page="musteri|kasa|kurulum"> ile seçilir. */
(function(){
  "use strict";
  var q = new URLSearchParams(location.search), B = window.SiralaBackend;
  var k = (q.get("k") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  var base = new URL("./", location.href).href;
  var page = document.body.getAttribute("data-page");
  if (k) S.lsSet("sirala-cafe-code", k);
  B.ready.catch(function(e){
    S.$("app").innerHTML = '<main class="login"><div class="login-card"><div class="brand-sm">Mars Zeka</div><h1>' + (e && e.message === "not-configured" ? "Kurulum tamamlanmadı" : "Bağlantı kurulamadı") + '</h1><p class="muted">' +
      (e && e.message === "not-configured" ? "js/firebase-config.js dosyasına Firebase bilgileri girilmemiş (README, Adım 2)." : "Sayfayı yenileyin. Sorun sürerse siparişinizi garsonumuza verebilirsiniz.") + '</p></div></main>';
  });
  function download(blob, name){
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }
  var m = parseInt(q.get("m"), 10);
  // QR'sız açılış (ana ekran / uygulama simgesi) = çalışan girişi; misafir sadece masa QR'ı ile menüye gelir.
  if (page === "musteri" && !(m > 0)) page = "garson";
  if (page === "musteri") {
    SiralaApp.musteri({ B: B, cafeId: k, table: m > 0 ? String(m) : "" });
  } else if (page === "garson") {
    SiralaApp.garson({ B: B, cafeId: k, followLogin: true, kitchenHref: function(c){ return "kasa.html?k=" + encodeURIComponent(c); } });
  } else if (page === "yonetim") {
    SiralaApp.yonetim({ B: B, links: function(code){ var c = encodeURIComponent(code); return { garson: "garson.html?k=" + c, kurulum: "kurulum.html?k=" + c, menu: "./?k=" + c + "&m=1" }; } });
  } else if (page === "kasa") {
    SiralaApp.kasa({ B: B, cafeId: k, setupHref: "kurulum.html" + (k ? "?k=" + encodeURIComponent(k) : "") });
  } else {
    SiralaApp.kurulum({ B: B, cafeId: k,
      setupHref: function(id){ return "kurulum.html" + (id ? "?k=" + encodeURIComponent(id) : ""); },
      kasaHref: "kasa.html?k=" + encodeURIComponent(k), garsonHref: "garson.html?k=" + encodeURIComponent(k),
      tryHref: function(t){ return "./?k=" + encodeURIComponent(k) + "&m=" + t; },
      qrUrl: function(t){ return base + "?k=" + encodeURIComponent(k) + "&m=" + t; },
      download: download, canPrint: true });
  }
})();
