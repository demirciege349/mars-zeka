/* Mars Zeka — ortak yardımcılar (klasik script; window.S altına yazar). */
(function(){
  "use strict";
  var S = window.S = window.S || {};

  S.$ = function(id){ return document.getElementById(id); };
  S.esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  S.fmt = function(n){ return Math.round(Number(n) || 0).toLocaleString("tr-TR") + " ₺"; };
  S.sum = function(items){ return (items || []).reduce(function(s, i){ return s + (Number(i.price) || 0) * (Number(i.qty) || 0); }, 0); };
  S.summary = function(items){ return (items || []).map(function(i){ return i.qty + "× " + i.name; }).join(", "); };
  S.newId = function(){ return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  S.clock = function(ms){ return new Date(ms || Date.now()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); };
  S.ago = function(ms){ var m = Math.max(0, Math.round((Date.now() - (ms || 0)) / 60000)); return m < 1 ? "şimdi" : m + " dk önce"; };
  S.DEFAULT_MINS = 15;
  /* Tahmini süre: yemekler mutfakta paralel hazırlanır, en uzun süren belirler. */
  S.eta = function(items, menu){
    var max = 0;
    (items || []).forEach(function(i){
      var m = (menu || []).find(function(x){ return x.id === i.id; });
      var mins = Number(m && m.mins) || S.DEFAULT_MINS;
      if (mins > max) max = mins;
    });
    return max || S.DEFAULT_MINS;
  };
  /* Mutfak yoğunluğu: hazırlanmayı bekleyen sipariş sayısına göre otomatik ek süre + kasanın elle eklediği süre.
     2 siparişe kadar ek yok; sonra her 2 sipariş için +5 dk (en fazla +30). */
  S.loadInfo = function(orders, cafe){
    var queue = (orders || []).filter(function(o){ return o.status === "new"; }).length;
    var auto = Math.min(30, Math.max(0, Math.ceil((queue - 2) / 2)) * 5);
    var manual = Math.max(0, Math.min(60, Number(cafe && cafe.busyExtra) || 0));
    return { queue: queue, auto: auto, manual: manual, extra: auto + manual };
  };

  /* Masa hesap fişi (bilgi fişi; mali belge değildir). */
  S.billHtml = function(cafe, table, lines, total){
    var d = new Date();
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Masa ' + S.esc(table) + ' hesap</title><style>@page{size:80mm auto;margin:4mm}body{margin:0;font-family:Arial,sans-serif;font-size:11pt;color:#000;width:72mm}' +
      'h1{font-size:14pt;text-align:center;margin:0 0 2pt}.c{text-align:center;font-size:9pt;margin-bottom:6pt}table{width:100%;border-collapse:collapse}td{padding:2pt 0;vertical-align:top}td.r{text-align:right;white-space:nowrap}' +
      '.t td{border-top:1pt dashed #000;font-weight:700;font-size:13pt;padding-top:5pt}.f{margin-top:8pt;font-size:8.5pt;text-align:center}</style></head><body>' +
      '<h1>' + S.esc((cafe && cafe.name) || "") + '</h1><div class="c">Masa ' + S.esc(table) + ' · ' + d.toLocaleDateString("tr-TR") + ' ' + S.clock(d) + '</div><table>' +
      lines.map(function(i){ return '<tr><td>' + i.qty + '× ' + S.esc(i.name) + '</td><td class="r">' + S.fmt(i.price * i.qty) + '</td></tr>'; }).join("") +
      '<tr class="t"><td>TOPLAM</td><td class="r">' + S.fmt(total) + '</td></tr></table><div class="f">Bilgi fişidir, mali değeri yoktur.<br>KDV dahildir.</div></body></html>';
  };
  /* Dosya indir (CSV vb.). */
  S.downloadText = function(text, name, type){
    try { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
    catch(e){ S.toast("Dosya indirilemedi"); }
  };
  /* Porsiyon: ürünün "p15" (1,5 porsiyon fiyatı) alanı doluysa iki seçenek olur. Sepet anahtarı: "id" ya da "id@15". */
  S.options = function(i){
    var k = Number(i.kcal) || 0;
    var o = [{ key: i.id, label: "1 porsiyon", price: Number(i.price) || 0, kcal: k, amount: S.amountText(i, 1) }];
    if (Number(i.p15) > 0) o.push({ key: i.id + "@15", label: "1,5 porsiyon", price: Number(i.p15), kcal: Math.round(k * 1.5), amount: S.amountText(i, 1.5) });
    return o;
  };
  /* Porsiyon miktarı serbest metin ("180 gr et", "300 ml"). Baştaki gr/ml sayısı 1,5 porsiyonda ölçeklenir. */
  S.amountText = function(i, factor){
    var t = String(i.amount || "").trim(); if (!t) return "";
    if (!factor || factor === 1) return t;
    var m = t.match(/^(\d+(?:[.,]\d+)?)\s*(gr|g|ml|cl|kg)\b(.*)$/i);
    if (!m) return t + " × 1,5";
    var n = Math.round(parseFloat(m[1].replace(",", ".")) * factor);
    return n + " " + m[2] + m[3];
  };
  S.cartLines = function(cart, menu){
    var out = [];
    (menu || []).forEach(function(i){
      if (i.out) return;
      S.options(i).forEach(function(o, n){
        var q = cart[o.key] || 0;
        if (q > 0) out.push({ id: i.id, name: i.name + (n ? " (1,5 porsiyon)" : ""), price: o.price, qty: q });
      });
    });
    return out;
  };
  /* Alerjenler (Türk Gıda Kodeksi'ndeki başlıca gruplardan sade bir seçim). */
  S.ALLERGENS = [["gluten","Gluten"],["sut","Süt"],["yumurta","Yumurta"],["kuruyemis","Kabuklu yemiş"],["yerfistigi","Yer fıstığı"],["susam","Susam"],["soya","Soya"],["balik","Balık"],["kabuklu","Kabuklu deniz ürünü"],["hardal","Hardal"],["kereviz","Kereviz"]];
  S.allergenName = function(k){ var a = S.ALLERGENS.find(function(x){ return x[0] === k; }); return a ? a[1] : k; };
  S.slugify = function(s){
    var map = { "ç":"c","ğ":"g","ı":"i","İ":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","Ö":"o","Ş":"s","Ü":"u" };
    return String(s || "").replace(/[çğıİöşüÇĞÖŞÜ]/g, function(c){ return map[c]; }).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  };
  S.sha256 = function(text){
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2, "0"); }).join("");
    });
  };
  S.lsGet = function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } };
  S.lsSet = function(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch(e){} };

  var toastT;
  S.toast = function(msg){
    var t = S.$("toast"); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function(){ t.hidden = true; }, 2800);
  };
  S.errText = function(e){
    var c = (e && (e.code || e.message)) || "";
    if (/permission|invalid_argument/.test(c)) return "Bu işlem için yetkin yok.";
    if (/unavailable|offline/.test(c)) return "İnternet bağlantısı yok. Bağlantı gelince tekrar dene.";
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return "İşletme kodu, kullanıcı adı ya da şifre hatalı.";
    if (/kod-dolu/.test(c)) return "Bu işletme kodu kullanılıyor, başka bir kod seçin.";
    if (/email-already-in-use/.test(c)) return "Bu kullanıcı adı bu işletmede zaten var.";
    if (/weak-password/.test(c)) return "Şifre en az 6 karakter olmalı.";
    if (/too-many-requests/.test(c)) return "Çok fazla deneme yapıldı, biraz bekle.";
    if (/operation-not-allowed|admin-restricted/.test(c)) return "Giriş yöntemi Firebase'de açılmamış (README, Adım 3).";
    if (/quota/.test(c)) return "Depolama doldu. Kurulumdan eski siparişleri temizle.";
    return "İşlem yapılamadı, tekrar dene.";
  };

  /* ses (ilk dokunuşta açılır) */
  var AC = null, unlockCbs = [];
  S.audioReady = false;
  document.addEventListener("pointerdown", function(){
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch(e){}
    /* ekranı dokunuş bittikten sonra yenile; yoksa ilk dokunuştaki düğme kaybolur ve basış boşa gider */
    if (!S.audioReady) { S.audioReady = true; setTimeout(function(){ unlockCbs.splice(0).forEach(function(f){ try { f(); } catch(e){} }); }, 350); }
  }, { passive: true });
  S.onAudioReady = function(f){ if (S.audioReady) f(); else unlockCbs.push(f); };
  /* Kasa tableti uykuya geçmesin (destekleyen tarayıcılarda). */
  var wake = null;
  S.keepAwake = function(){
    try { if (navigator.wakeLock && !wake && document.visibilityState === "visible") navigator.wakeLock.request("screen").then(function(w){ wake = w; w.addEventListener("release", function(){ wake = null; }); }).catch(function(){}); } catch(e){}
  };
  S.beep = function(times, freq){
    try {
      if (!AC) return;
      var t0 = AC.currentTime;
      for (var i = 0; i < times; i++) {
        var o = AC.createOscillator(), g = AC.createGain(), t = t0 + i * 0.28;
        o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(AC.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.start(t); o.stop(t + 0.24);
      }
    } catch(e){}
  };

  /* Fotoğrafı küçült: en uzun kenar 640px, JPEG. Veritabanında saklanır (Storage gerekmez). */
  S.shrinkPhoto = function(file){
    return new Promise(function(resolve, reject){
      if (!file || !/^image\//.test(file.type)) { reject(new Error("not-image")); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var max = 640, w = img.naturalWidth, h = img.naturalHeight, r = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * r); c.height = Math.round(h * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var q = 0.78, out = c.toDataURL("image/jpeg", q);
        while (out.length > 180000 && q > 0.4) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("bad-image")); };
      img.src = url;
    });
  };

  /* Fotoğrafı olmayan ürün için zarif yer tutucu (tabak + baş harfler). */
  S.placeholder = function(name){
    var words = String(name || "?").trim().split(/\s+/), ini = (words[0][0] + (words[1] ? words[1][0] : "")).toLocaleUpperCase("tr-TR");
    return '<svg viewBox="0 0 120 120" aria-hidden="true" class="ph-svg"><rect width="120" height="120" fill="#F2E3C6"/>' +
      '<circle cx="60" cy="60" r="40" fill="#FFF8EC" stroke="#E4D2B0" stroke-width="2"/><circle cx="60" cy="60" r="30" fill="none" stroke="#E4D2B0" stroke-width="1"/>' +
      '<text x="60" y="68" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="24" font-weight="600" fill="#9D0208">' + S.esc(ini) + '</text></svg>';
  };

  /* Çalışan bilgisi: cafe.staff = { email: { name, role: "patron" | "garson" } }, cafe.zones = { email: ["1","2"] }.
     staff listesi hiç yoksa (eski kurulum) herkes patron sayılır. */
  S.staffInfo = function(cafe, email){
    var m = (cafe && cafe.staff) || null, e = String(email || "").toLowerCase();
    if (!m) return { name: e.split("@")[0] || "Çalışan", role: "patron" };
    var x = m[e] || {}; return { name: x.name || e.split("@")[0] || "Çalışan", role: x.role || "garson" };
  };
  S.zoneOf = function(cafe, table){
    var z = (cafe && cafe.zones) || {}, t = String(table);
    for (var e in z) if ((z[e] || []).map(String).indexOf(t) >= 0) return e;
    return null;
  };
  S.orderLabel = function(o){ return o.source === "online" ? "Online · " + (o.mode === "paket" ? "Paket" : "Gel-al") : "Masa " + o.table; };
  /* Online siparişi teslim et: kapat ve müşterinin iletişim bilgisini sil (yalnızca sipariş için tutulur). */
  S.deliverOnline = function(B, cafeId, o){
    var now = Date.now();
    return B.updateOrder(cafeId, o.id, { served: true, servedAt: now, closed: true, closedAt: now }).then(function(){ return B.deleteContact(cafeId, o.id); });
  };

  /* Fotoğrafı olmayan yemekler için çizim "tabak fotoğrafı" (üstten görünüm). Ada göre seçilir. */
  var artN = 0;
  S.foodArt = function(name){
    var n = String(name || "").toLocaleLowerCase("tr-TR"), id = "fa" + (++artN), g = function(k){ return id + k; };
    var defs = '<defs>' +
      '<linearGradient id="' + g("w") + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9A6534"/><stop offset="1" stop-color="#6B4220"/></linearGradient>' +
      '<radialGradient id="' + g("p") + '" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#EDE4D3"/></radialGradient>' +
      '<linearGradient id="' + g("m") + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A3418"/><stop offset=".5" stop-color="#6A2410"/><stop offset="1" stop-color="#3E1206"/></linearGradient>' +
      '<radialGradient id="' + g("s") + '" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#F0A64A"/><stop offset=".7" stop-color="#C8561E"/><stop offset="1" stop-color="#A2400F"/></radialGradient>' +
      '<radialGradient id="' + g("k") + '" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#F3B54A"/><stop offset=".8" stop-color="#D68A22"/><stop offset="1" stop-color="#9E5A10"/></radialGradient>' +
      '</defs>';
    var wood = '<rect width="120" height="120" fill="url(#' + g("w") + ')"/>' +
      '<path d="M0 18 Q60 12 120 20 M0 47 Q60 41 120 50 M0 79 Q60 74 120 82 M0 106 Q60 101 120 109" stroke="#5A3618" stroke-opacity=".35" stroke-width="1.2" fill="none"/>';
    var plate = '<ellipse cx="62" cy="64" rx="50" ry="49" fill="#000" opacity=".25"/><circle cx="60" cy="60" r="50" fill="url(#' + g("p") + ')"/><circle cx="60" cy="60" r="41" fill="none" stroke="#E2D6C2" stroke-width="1.2"/>';
    var pepper = function(x, y, r){ return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')"><path d="M0 0 C10 -4 30 -4 38 0 C30 5 10 5 0 0Z" fill="#6E9A3C"/><path d="M3 -1 C12 -3 26 -3 33 -1" stroke="#B7D27A" stroke-width="1.4" fill="none"/><path d="M-4 0 L1 0" stroke="#4A6A24" stroke-width="2.2"/><circle cx="18" cy="0" r="2" fill="#2E3B14" opacity=".5"/></g>'; };
    var tomato = function(x, y){ return '<circle cx="' + x + '" cy="' + y + '" r="8" fill="#D64E38"/><path d="M' + (x - 4) + ' ' + (y - 3) + ' q4 -3 8 0" stroke="#3A120A" stroke-width="2.5" opacity=".7" fill="none"/><circle cx="' + (x - 3) + '" cy="' + (y - 3) + '" r="2" fill="#fff" opacity=".35"/>'; };
    var food;
    if (/adana|urfa|kebap|kebab/.test(n) && !/balaban/.test(n)) {
      food = '<rect x="20" y="40" width="80" height="40" rx="10" fill="#E8C690"/><circle cx="34" cy="48" r="2.5" fill="#B9853E" opacity=".6"/><circle cx="82" cy="72" r="3" fill="#B9853E" opacity=".6"/>' +
        '<rect x="22" y="53" width="76" height="15" rx="7.5" fill="url(#' + g("m") + ')"/>' +
        [30, 40, 50, 60, 70, 80, 90].map(function(x){ return '<path d="M' + x + ' 54 l-3 13" stroke="#2A0A03" stroke-width="1.6" opacity=".55"/>'; }).join("") +
        '<path d="M26 57 H94" stroke="#E07A4A" stroke-width="1" opacity=".5"/>' + pepper(30, 40, -8) + pepper(56, 84, -6) + tomato(92, 40) + tomato(28, 82);
    } else if (/balaban|köfte|kofte/.test(n)) {
      food = '<rect x="24" y="36" width="72" height="48" rx="8" fill="#E8C690"/><path d="M70 76 q12 -10 22 0 q-10 8 -22 0" fill="#FBFAF4"/>' +
        [[42, 52], [60, 50], [50, 66], [68, 64]].map(function(c){ return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="9" fill="url(#' + g("m") + ')"/><circle cx="' + (c[0] - 3) + '" cy="' + (c[1] - 3) + '" r="2.4" fill="#fff" opacity=".25"/>'; }).join("") + pepper(30, 84, -12);
    } else if (/şiş|sis/.test(n)) {
      var dark = /kuzu/.test(n), c1 = dark ? "#6E1F0E" : "#D08A3A", c2 = dark ? "#4A1306" : "#A9621F";
      food = '<path d="M18 62 L104 58" stroke="#9A948C" stroke-width="2.4"/>' +
        [26, 40, 54, 68, 82].map(function(x, i){ return '<rect x="' + x + '" y="' + (51 - i * 0.4) + '" width="12" height="13" rx="3" fill="' + (i % 2 ? c2 : c1) + '"/><path d="M' + (x + 2) + ' ' + (55 - i * .4) + ' h8" stroke="#2A0A03" stroke-width="1.3" opacity=".5"/>'; }).join("") +
        (dark ? pepper(34, 82, -4) + tomato(84, 82) : '<path d="M30 80 q30 10 60 0" stroke="#8B2E4A" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M34 40 q26 -8 52 0" stroke="#F3E3C6" stroke-width="6" fill="none" stroke-linecap="round"/>');
    } else if (/çorba|corba/.test(n)) {
      food = '<circle cx="60" cy="60" r="34" fill="#F6EFE3" stroke="#E2D6C2"/><circle cx="60" cy="60" r="28" fill="url(#' + g("s") + ')"/>' +
        '<path d="M44 58 q8 -8 16 0 t16 0" stroke="#B3200F" stroke-width="2.6" fill="none" opacity=".75"/><circle cx="66" cy="66" r="3" fill="#B3200F" opacity=".7"/>' +
        '<path d="M86 30 a12 12 0 0 1 10 20 z" fill="#F2D24A" stroke="#E0B92A"/>';
    } else if (/çibörek|cibörek|börek|borek/.test(n)) {
      food = '<path d="M24 70 A36 36 0 0 1 96 70 Z" fill="url(#' + g("k") + ')"/><path d="M24 70 H96" stroke="#B26A12" stroke-width="3" stroke-dasharray="3 3"/>' +
        '<circle cx="48" cy="56" r="3" fill="#F7CF7A" opacity=".8"/><circle cx="66" cy="48" r="2.5" fill="#F7CF7A" opacity=".8"/><circle cx="78" cy="60" r="2" fill="#F7CF7A"/>' + '<path d="M34 84 q8 -6 16 0" stroke="#6E9A3C" stroke-width="4" fill="none" stroke-linecap="round"/>';
    } else if (/künefe|kunefe/.test(n)) {
      food = '<circle cx="60" cy="60" r="32" fill="url(#' + g("k") + ')"/>' +
        [26, 20, 14].map(function(r){ return '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#B9740F" stroke-width="1.4" stroke-dasharray="2 2"/>'; }).join("") +
        '<circle cx="60" cy="60" r="8" fill="#7FA34A"/><circle cx="57" cy="57" r="2" fill="#B9D67A"/>';
    } else if (/helva|tatlı|baklava/.test(n)) {
      food = [[30, 40], [52, 46], [44, 64]].map(function(c){ return '<rect x="' + c[0] + '" y="' + c[1] + '" width="34" height="20" rx="3" fill="#EFE2C6" stroke="#D2BC92"/><path d="M' + (c[0] + 4) + ' ' + (c[1] + 7) + ' h26 M' + (c[0] + 4) + ' ' + (c[1] + 13) + ' h22" stroke="#C9A86E" stroke-width="1.2"/>'; }).join("");
    } else if (/ayran|süt|yoğurt/.test(n)) {
      food = '<circle cx="60" cy="60" r="26" fill="#E8EEF0" stroke="#C9D4D8" stroke-width="2"/><circle cx="60" cy="60" r="21" fill="#FFFFFF"/><circle cx="54" cy="56" r="4" fill="#F3F6F7"/><circle cx="64" cy="64" r="3" fill="#F3F6F7"/><circle cx="66" cy="54" r="2.5" fill="#F3F6F7"/>';
    } else if (/şalgam|salgam/.test(n)) {
      food = '<circle cx="60" cy="60" r="26" fill="#E8EEF0" stroke="#C9D4D8" stroke-width="2"/><circle cx="60" cy="60" r="21" fill="#7A1035"/><circle cx="53" cy="54" r="5" fill="#A8284F" opacity=".7"/><path d="M70 40 L86 24" stroke="#E07A2A" stroke-width="6" stroke-linecap="round"/>';
    } else if (/kahve|çay|cay|latte/.test(n)) {
      var tea = /çay|cay/.test(n);
      food = '<circle cx="60" cy="60" r="30" fill="#F6EFE3" stroke="#E2D6C2"/><circle cx="60" cy="60" r="18" fill="#FFFDF8" stroke="#D9CBB2"/><circle cx="60" cy="60" r="14" fill="' + (tea ? "#A2330F" : "#3B2214") + '"/>' +
        (tea ? '' : '<circle cx="60" cy="60" r="11" fill="#7A4A26" opacity=".55"/>') + '<path d="M78 56 q8 4 0 8" stroke="#D9CBB2" stroke-width="4" fill="none"/>' +
        '<rect x="28" y="80" width="10" height="10" rx="2" fill="#F6C6D2" stroke="#E8A9B9"/>';
    } else {
      var w = (S.esc(name || "?").trim().split(/\s+/)), ini = ((w[0] || "?")[0] + (w[1] ? w[1][0] : "")).toLocaleUpperCase("tr-TR");
      food = '<circle cx="60" cy="60" r="28" fill="url(#' + g("s") + ')"/><text x="60" y="68" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#FFF8EC">' + ini + '</text>';
    }
    return '<svg viewBox="0 0 120 120" aria-hidden="true" class="ph-svg">' + defs + wood + plate + food + '</svg>';
  };

  /* 3D / artırılmış gerçeklik: Google model-viewer ile, uygulama gerekmez.
     Android: Scene Viewer, iPhone: AR Quick Look (USDZ'yi kendisi üretir). ar-scale="fixed": gerçek boyut, büyütülemez. */
  var MV = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js", mvLoad = null;
  function loadMV(){
    if (window.customElements && customElements.get("model-viewer")) return Promise.resolve();
    if (!mvLoad) mvLoad = new Promise(function(res, rej){ var s = document.createElement("script"); s.type = "module"; s.src = MV; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return mvLoad;
  }
  S.openAR = function(item, info){
    var lay = document.getElementById("arLayer");
    if (!lay) { lay = document.createElement("div"); lay.id = "arLayer"; document.body.appendChild(lay); }
    lay.hidden = false; document.body.style.overflow = "hidden";
    lay.innerHTML = '<div class="ar-box" role="dialog" aria-modal="true" aria-label="' + S.esc(item.name) + ' 3D görünüm">' +
      '<div class="ar-head"><div><span class="label">Gerçek porsiyon' + (item.amount ? ' · ' + S.esc(item.amount) : '') + '</span><h2>' + S.esc(item.name) + '</h2></div><button class="btn btn-sm" data-ar="close">Kapat</button></div>' +
      '<div class="ar-stage"><p class="ar-wait">3D model yükleniyor…</p></div>' +
      '<p class="ar-note">' + S.esc(info || "") + ' Parmağınızla çevirin. Telefonda <b>Masaya yerleştir</b>e basın, kamerayı masaya tutun; tabak gerçek boyutunda masanızda görünür.</p></div>';
    lay.onclick = function(e){ if (e.target === lay || (e.target.closest && e.target.closest('[data-ar="close"]'))) S.closeAR(); };
    loadMV().then(function(){
      var st = lay.querySelector(".ar-stage"); if (!st) return;
      st.innerHTML = '<model-viewer src="' + S.esc(item.model) + '" alt="' + S.esc(item.name) + ' porsiyonu" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="floor" camera-controls touch-action="pan-y" auto-rotate shadow-intensity="1" exposure="1.05" camera-orbit="30deg 60deg 0.55m" min-camera-orbit="auto auto 0.3m" style="width:100%;height:100%;background:#F2E3C6">' +
        '<button slot="ar-button" class="ar-btn">' + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg>Masaya yerleştir</button></model-viewer>';
    }).catch(function(){ var st = lay.querySelector(".ar-stage"); if (st) st.innerHTML = '<p class="ar-wait">3D görüntüleyici yüklenemedi. İnternet bağlantınızı kontrol edin.</p>'; });
  };
  S.closeAR = function(){ var lay = document.getElementById("arLayer"); if (lay) { lay.hidden = true; lay.innerHTML = ""; } document.body.style.overflow = ""; };

  /* Basılı fiyat listesi (Fiyat Etiketi Yönetmeliği: girişte ve masalarda). Güncel menüden A4 sayfa üretir. */
  S.priceListHtml = function(cafe, menu){
    var items = (menu || []).filter(function(i){ return i.name; }), cats = [];
    items.forEach(function(i){ var c = i.cat || "Diğer"; if (cats.indexOf(c) < 0) cats.push(c); });
    var now = new Date(), date = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
    var row = function(name, sub, price){
      return '<div class="r"><span class="n">' + S.esc(name) + (sub ? '<small>' + S.esc(sub) + '</small>' : '') + '</span><span class="d"></span><span class="p">' + S.fmt(price) + '</span></div>';
    };
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + S.esc((cafe && cafe.name) || "Fiyat listesi") + ' · Fiyat listesi</title>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Jost:wght@400;500&display=swap">' +
      '<style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Jost,Arial,sans-serif;color:#3A0A0A;background:#fff;font-size:11pt}' +
      '.sheet{border:1.5pt solid #9D0208;outline:.6pt solid #9D0208;outline-offset:-5pt;padding:14mm 14mm 10mm;min-height:268mm;display:flex;flex-direction:column}' +
      'h1{font-family:"Cormorant Garamond",Georgia,serif;font-size:30pt;font-weight:700;text-align:center;margin:0}' +
      '.sub{text-align:center;font-size:8.5pt;letter-spacing:.3em;text-transform:uppercase;color:#9D0208;margin:4pt 0 2pt}' +
      '.date{text-align:center;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:11pt;color:#6E4A42;margin-bottom:12pt}' +
      '.cols{columns:2;column-gap:12mm;flex:1}.cat{break-inside:avoid;margin-bottom:10pt}' +
      'h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:15pt;font-weight:700;margin:0 0 4pt;border-bottom:.8pt solid #9D0208;padding-bottom:2pt}' +
      '.r{display:flex;align-items:baseline;gap:4pt;padding:2.5pt 0;break-inside:avoid}.n{font-weight:500}.n small{display:block;font-weight:400;font-size:8.5pt;color:#6E4A42}' +
      '.d{flex:1;border-bottom:.8pt dotted #B9A58A;transform:translateY(-3pt);min-width:8pt}.p{font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:12.5pt;white-space:nowrap}' +
      '.foot{border-top:.6pt solid #DCC59C;margin-top:10pt;padding-top:6pt;font-size:8.5pt;color:#6E4A42;text-align:center;line-height:1.5}</style></head><body><div class="sheet">' +
      '<h1>' + S.esc((cafe && cafe.name) || "") + '</h1><div class="sub">Fiyat listesi</div><div class="date">Güncelleme: ' + S.esc(date) + '</div><div class="cols">' +
      cats.map(function(c){
        return '<section class="cat"><h2>' + S.esc(c) + '</h2>' + items.filter(function(i){ return (i.cat || "Diğer") === c; }).map(function(i){
          var out = row(i.name, i.amount || "", i.price);
          if (Number(i.p15) > 0) out += row(i.name + " · 1,5 porsiyon", S.amountText(i, 1.5), i.p15);
          return out;
        }).join("") + '</section>';
      }).join("") + '</div><div class="foot">Fiyatlarımıza KDV dahildir.<br>Menümüzü masanızdaki QR kodu okutarak da görebilir, siparişinizi oradan verebilirsiniz.</div></div></body></html>';
  };
  S.printPriceList = function(cafe, menu){ S.printHtml(S.priceListHtml(cafe, menu)); };
  S.printHtml = function(html){
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    document.body.appendChild(f);
    var done = false, go = function(){
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ S.toast("Bu ekranda yazdırma açılamadı"); }
      setTimeout(function(){ f.remove(); }, 60000);
    };
    f.onload = function(){ var d = f.contentDocument; (d && d.fonts ? d.fonts.ready : Promise.resolve()).then(function(){ setTimeout(go, 150); }); setTimeout(go, 2500); };
    f.srcdoc = html;
  };

  /* Giriş: işletme kodu + kullanıcı adı + şifre. Kullanıcı adı, işletmeye özel bir hesap adresine çevrilir
     (ali → ali@isletme-kodu.marszeka.app). "@" içeren giriş doğrudan e-posta sayılır (patronun kendi hesabı). */
  S.USER_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;
  S.userEmail = function(code, username){
    var u = String(username || "").trim().toLocaleLowerCase("tr-TR");
    if (u.indexOf("@") > 0) return u;
    return u + "@" + String(code || "").trim().toLowerCase() + ".marszeka.app";
  };
  S.userName = function(email){ var e = String(email || ""); return /\.marszeka\.app$/.test(e) ? e.split("@")[0] : e; };
  /* Giriş iki adımlı: ilk açılışta yalnızca iş yeri kodu sorulur ve telefona kaydedilir;
     sonraki açılışlarda doğrudan kullanıcı adı + şifre gelir (kod "Değiştir" ile değişir). */
  /* ---- Hesap bölme ----
   Ödemeler masa kaydında tutulur: tables/{masa}.payments = [{ id, amount, mode: "esit"|"urun", n, units: ["ad|fiyat|sıra"], at, by }].
   Masa kapanınca kayıt sıfırlanır. Eşit bölmede kalan tutar, henüz ödemeyen kişi sayısına bölünür (tam liraya yukarı yuvarlanır, son kişi farkı öder). */
S.billLines = function(orders){
  var lines = {}, order = [];
  (orders || []).filter(function(o){ return o.status !== "cancelled"; }).slice().sort(function(a, b){ return (a.createdAt || 0) - (b.createdAt || 0); }).forEach(function(o){
    (o.items || []).forEach(function(i){ var k = i.name + "|" + i.price; if (!lines[k]) { lines[k] = { key: k, name: i.name, price: Number(i.price) || 0, qty: 0 }; order.push(k); } lines[k].qty += Number(i.qty) || 0; });
  });
  return order.map(function(k){ return lines[k]; });
};
S.payState = function(f, lines, ui){
  var pays = (f && Array.isArray(f.payments)) ? f.payments : [], keys = {}, paid = 0, eq = pays.filter(function(p){ return p.mode === "esit"; });
  pays.forEach(function(p){ paid += Number(p.amount) || 0; (p.units || []).forEach(function(k){ keys[k] = 1; }); });
  var total = S.sum(lines), left = Math.max(0, total - paid);
  var units = [];
  lines.forEach(function(l){ for (var i = 0; i < l.qty; i++) { var k = l.key + "|" + i; units.push({ key: k, name: l.name, price: l.price, paid: !!keys[k] }); } });
  var n = (ui && ui.n) || (eq.length ? eq[eq.length - 1].n : 0) || 2;
  var peopleLeft = Math.max(1, n - eq.length), per = Math.ceil(left / peopleLeft), last = left - per * (peopleLeft - 1);
  var sel = (ui && ui.sel) || {}, selSum = units.reduce(function(s, u){ return s + (sel[u.key] && !u.paid ? u.price : 0); }, 0);
  return { pays: pays, total: total, paid: paid, left: left, units: units, n: n, eqPaid: eq.length, peopleLeft: peopleLeft, per: per, last: last, sel: sel, selSum: Math.min(selSum, left) };
};
/* staff: ödeme kaydı düğmeleri görünür; değilse (müşteri) sadece hesap makinesi */
S.splitHtml = function(P, ui, staff){
  var mode = (ui && ui.mode) || "esit";
  var head = '<div class="sp-sum"><span>Ödenen <b>' + S.fmt(P.paid) + '</b></span><span>Kalan <b>' + S.fmt(P.left) + '</b></span></div>';
  if (P.total && P.left <= 0) return '<section class="sp">' + head + '<p class="sp-done">Hesabın tamamı ödendi</p>' + (staff ? payList(P) : '') + '</section>';
  var modes = [["esit", "Eşit böl"], ["urun", "Ürüne göre"]].concat(staff ? [["tutar", "Tutar gir"]] : []);
  if (!staff && mode === "tutar") mode = "esit";
  var tabs = '<div class="sp-tabs' + (staff ? " three" : "") + '" role="tablist">' + modes.map(function(t){ return '<button role="tab" aria-selected="' + (mode === t[0]) + '" data-act="spMode" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join("") + '</div>';
  var body;
  if (mode === "esit") {
    var dots = ""; for (var i = 0; i < P.n && i < 20; i++) dots += '<span class="' + (i < P.eqPaid ? "on" : "") + '"></span>';
    body = '<div class="sp-n"><span>Kişi sayısı</span><div class="stepper"><button class="round" data-act="spN" data-v="-1" aria-label="azalt"' + (P.n <= Math.max(2, P.eqPaid + 1) ? " disabled" : "") + '>−</button><span class="q">' + P.n + '</span><button class="round" data-act="spN" data-v="1" aria-label="artır"' + (P.n >= 20 ? " disabled" : "") + '>+</button></div></div>' +
      '<div class="sp-dots" aria-hidden="true">' + dots + '</div>' +
      '<div class="sp-per"><span>Kişi başı</span><b>' + S.fmt(P.per) + '</b></div>' +
      (P.peopleLeft > 1 && P.last !== P.per ? '<p class="sp-note">Son kişi ' + S.fmt(P.last) + ' öder.</p>' : '') +
      (P.eqPaid ? '<p class="sp-note">' + P.eqPaid + ' / ' + P.n + ' kişi ödedi</p>' : '') +
      (staff ? '<button class="btn btn-primary btn-lg wide" data-act="spPay" data-v="esit">1 kişi ödedi · ' + S.fmt(P.peopleLeft === 1 ? P.left : P.per) + '</button>' : '');
  } else if (mode === "tutar") {
    var A = S.amountInfo(P, ui);
    body = '<label class="sp-amt" for="sp-amt"><span>Alınan tutar</span><span class="sp-amt-in"><input id="sp-amt" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="' + (ui && ui.amt ? S.esc(ui.amt) : "") + '"><b>₺</b></span></label>' +
      '<div class="sp-quick"><button type="button" data-act="spAmt" data-v="' + P.left + '">Kalanın tamamı</button>' + (P.left >= 2 ? '<button type="button" data-act="spAmt" data-v="' + Math.ceil(P.left / 2) + '">Yarısı</button>' : '') + '</div>' +
      '<p class="sp-note" id="sp-amt-note">' + A.note + '</p>' +
      '<button class="btn btn-primary btn-lg wide" id="sp-amt-btn" data-act="spPay" data-v="tutar"' + (A.take ? "" : " disabled") + '>' + A.label + '</button>';
  } else {
    body = '<p class="sp-note">' + (staff ? "Ödeyen kişinin ürünlerine dokunun." : "Kendi ürünlerinize dokunun, payınızı görün.") + '</p><div class="sp-units">' + P.units.map(function(u){
      return '<button class="sp-u' + (u.paid ? " paid" : "") + '" data-act="spUnit" data-v="' + S.esc(u.key) + '" aria-pressed="' + (!!P.sel[u.key] && !u.paid) + '"' + (u.paid ? " disabled" : "") + '><span>' + S.esc(u.name) + '</span><b>' + (u.paid ? "Ödendi" : S.fmt(u.price)) + '</b></button>';
    }).join("") + '</div>' +
      '<div class="sp-per"><span>' + (staff ? "Seçilen" : "Sizin payınız") + '</span><b>' + S.fmt(P.selSum) + '</b></div>' +
      (staff ? '<button class="btn btn-primary btn-lg wide" data-act="spPay" data-v="urun"' + (P.selSum ? "" : " disabled") + '>Bu kişi ödedi · ' + S.fmt(P.selSum) + '</button>' : '');
  }
  return '<section class="sp">' + head + tabs + body + (staff ? payList(P) : '') + '</section>';
  function payList(P){
    if (!P.pays.length) return "";
    return '<ul class="sp-pays">' + P.pays.map(function(p, i){ return '<li><span>' + (i + 1) + '. ödeme · ' + (p.mode === "urun" ? "ürüne göre" : p.mode === "tutar" ? "elle girildi" : "eşit") + '</span><b class="num">' + S.fmt(p.amount) + '</b></li>'; }).join("") + '</ul>' +
      '<button class="btn btn-ghost btn-sm" data-act="spUndo">Son ödemeyi geri al</button>';
  }
};
/* "Tutar gir": yazılan tutar kalandan fazlaysa fark para üstüdür; hesaba kalan kadarı yazılır */
S.amountInfo = function(P, ui){
  var v = Math.round(Number(String((ui && ui.amt) || "").replace(",", ".")) || 0), take = Math.max(0, Math.min(v, P.left)), change = Math.max(0, v - P.left);
  return { take: take, label: take ? "Ödeme al · " + S.fmt(take) : "Tutar yazın",
    note: !v ? "Müşterinin verdiği tutarı yazın." : change ? "Para üstü: " + S.fmt(change) : "Ödemeden sonra kalan: " + S.fmt(P.left - take) };
};
/* Bir ödemeyi ekler; yeni payments dizisini döndürür */
S.addPayment = function(P, ui, mode, by){
  var amt = mode === "esit" ? (P.peopleLeft === 1 ? P.left : Math.min(P.per, P.left)) : mode === "tutar" ? S.amountInfo(P, ui).take : P.selSum;
  if (!(amt > 0)) return null;
  var p = { id: S.newId(), amount: amt, mode: mode, at: Date.now(), by: by || "" };
  if (mode === "esit") p.n = P.n;
  else p.units = P.units.filter(function(u){ return P.sel[u.key] && !u.paid; }).map(function(u){ return u.key; });
  return P.pays.concat([p]);
};

/* Masa oturma süresi: QR okutulduğu an (seatedAt) ya da ilk açık sipariş. 5 saatten eski kayıt unutulmuş sayılır. */
S.SEAT_MAX = 5 * 3600000;
S.seatInfo = function(f, orders){
  var now = Date.now(), at = Number(f && f.seatedAt) || 0;
  if (at && now - at > S.SEAT_MAX) at = 0;
  var list = (orders || []).filter(function(o){ return o.status !== "cancelled"; });
  var first = list.reduce(function(m, o){ return Math.min(m, o.createdAt || now); }, Infinity);
  var last = list.reduce(function(m, o){ return Math.max(m, o.createdAt || 0); }, 0);
  if (!at && list.length) at = first;
  if (!at) return null;
  return { since: at, seatMin: Math.max(0, Math.floor((now - at) / 60000)), noOrder: !list.length, lastMin: last ? Math.max(0, Math.floor((now - last) / 60000)) : null };
};
S.loginView = function(title, error, prefill, hint, noCode){
    var code = S.lsGet("sirala-cafe-code") || prefill || "";
    var top = '<main class="login"><div class="login-card"><div class="brand-sm">Mars Zeka</div><h1>' + S.esc(title) + '</h1>';
    var err = error ? '<p class="form-err" role="alert">' + S.esc(error) + '</p>' : '';
    var tip = hint ? '<p class="login-hint">' + hint + '</p>' : '';
    if (!code && !noCode) {
      return top + '<p class="muted">İş yerinizin kodunu yazın. Bu telefon kodu hatırlar, bir daha sorulmaz.</p>' +
        '<form id="loginCode" class="login-form" novalidate>' +
        '<label class="fld" for="lg-code"><span>İş yeri kodu</span><input id="lg-code" autocapitalize="none" autocomplete="organization" placeholder="ör. kuzey-sofrasi" required></label>' +
        err + '<button class="btn btn-primary btn-lg wide" type="submit">Devam</button>' + tip + '</form></div></main>';
    }
    return top + (noCode ? '<p class="muted">Yönetici e-postanız ve şifrenizle girin.</p>' :
        '<div class="login-place"><span>İş yeri</span><b>' + S.esc(code) + '</b><button type="button" class="btn btn-sm btn-ghost" data-login="change">Değiştir</button></div>') +
      '<form id="loginForm" class="login-form" novalidate>' +
      '<label class="fld" for="lg-user"><span>' + (noCode ? "E-posta" : "Kullanıcı adı") + '</span><input id="lg-user" autocapitalize="none" autocomplete="username" required></label>' +
      '<label class="fld" for="lg-pass"><span>Şifre</span><input id="lg-pass" type="password" autocomplete="current-password" required></label>' +
      err + '<button class="btn btn-primary btn-lg wide" type="submit">Giriş yap</button>' + tip + '</form></div></main>';
  };
  /* onError(mesaj): mesaj null ise sadece ekranı yeniler (adım değişti). */
  S.bindLogin = function(B, onError){
    var c = S.$("loginCode");
    if (c) c.addEventListener("submit", function(e){
      e.preventDefault();
      var code = S.slugify(S.$("lg-code").value || "");
      if (code.length < 2) { onError("İş yeri kodunu yazın."); return; }
      (B.cafeExists ? B.cafeExists(code) : Promise.resolve(true)).then(function(ok){
        if (!ok) { onError("Bu kodla bir iş yeri bulunamadı. Patronunuza sorun."); return; }
        S.lsSet("sirala-cafe-code", code); onError(null);
      }).catch(function(err){ onError(S.errText(err)); });
    });
    var ch = document.querySelector("[data-login=change]");
    if (ch) ch.addEventListener("click", function(){ S.lsSet("sirala-cafe-code", ""); onError(null); });
    var f = S.$("loginForm"); if (!f) return;
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var code = S.lsGet("sirala-cafe-code") || "", user = S.$("lg-user").value.trim(), pass = S.$("lg-pass").value;
      if (!user || !pass) { onError("Kullanıcı adı ve şifre gerekli."); return; }
      B.login(S.userEmail(code, user), pass).catch(function(err){ onError(S.errText(err)); });
    });
  };
  S.isEditing = function(){
    var a = document.activeElement;
    return !!(a && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "file");
  };
})();
