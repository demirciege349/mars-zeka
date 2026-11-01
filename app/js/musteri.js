/* Mars Zeka — müşteri ekranı: fotoğraflı menü, yaklaşık süre, sipariş, masa hesabı. */
(function(){
  "use strict";
  window.SiralaApp = window.SiralaApp || {};
  var FIRE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2.5 2 4 1-2 1-5 1-8z"/></svg>';
  var BELL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
  var WARN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>';
  var SCALE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 20h14l-2-11H7z"/><path d="M9 9a3 3 0 0 1 6 0"/></svg>';
  var CLOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  window.SiralaApp.musteri = function(ctx){
    var B = ctx.B, cafeId = ctx.cafeId, online = !!ctx.online, table = online ? "Online" : ctx.table;
    var myIds = function(){ try { return JSON.parse(S.lsGet("sirala-online-ids") || "[]") || []; } catch(e){ return []; } };
    var mine = function(o){ var u = B.currentUser(); return o.source === "online" && (myIds().indexOf(o.id) >= 0 || (B.kind === "firebase" && u && o.uid === u.uid)); };
    var st = { avoid: (function(){ try { return JSON.parse(S.lsGet("sirala-avoid") || "{}") || {}; } catch(e){ return {}; } })(), algOpen: false, cafe: null, cafeLoaded: false, photos: {}, orders: [], all: [], ordLoaded: false, cart: {}, note: "", view: "menu", last: null, co: { mode: "gelal", name: S.lsGet("sirala-co-name") || "", phone: S.lsGet("sirala-co-phone") || "", address: S.lsGet("sirala-co-address") || "" }, busy: false, tbl: {}, err: null, offline: !navigator.onLine };
    var menu = function(){ return (st.cafe && Array.isArray(st.cafe.menu)) ? st.cafe.menu : []; };
    var cartItems = function(){ return S.cartLines(st.cart, menu()); };
    var tableLabel = online ? "Online sipariş" : "Masa " + table;
    var load = function(){ return S.loadInfo(st.all, st.cafe); };
    var alive = true, unsubs = [];

    if (!table) { S.$("app").innerHTML = '<main class="c-wrap c-main"><div class="empty-card"><h2>Masadaki QR kodu okutun</h2><p>Sipariş vermek için oturduğunuz masadaki QR kodu telefonunuzun kamerasıyla okutun.</p></div></main>'; return; }
    render();
    B.ready.then(function(){ return B.ensureCustomer(); }).then(function(){
      if (!alive) return;
      unsubs.push(B.watchCafe(cafeId, function(d){ st.cafe = d; st.cafeLoaded = true; dropSoldOut(); document.title = ((d && d.name) || "Menü") + " · " + tableLabel; render(); }, fail));
      unsubs.push(B.watchPhotos(cafeId, function(m){ st.photos = m; render(); }));
      unsubs.push(B.watchOrders(cafeId, null, function(list){ st.all = list; st.orders = list.filter(function(o){ return online ? mine(o) : String(o.table) === String(table) && o.source !== "online"; }); st.ordLoaded = true; render(); }, fail));
      if (!online) unsubs.push(B.watchTables(cafeId, function(m){ st.tbl = m[String(table)] || {}; markSeated(); render(); }));
    }).catch(fail);
    function dropSoldOut(){
      var gone = [];
      Object.keys(st.cart).forEach(function(k){
        var it = menu().find(function(x){ return x.id === k.split("@")[0]; });
        if (!it || it.out) { delete st.cart[k]; if (it && gone.indexOf(it.name) < 0) gone.push(it.name); }
      });
      if (gone.length) S.toast(gone.join(", ") + " az önce tükendi, sepetinizden çıkarıldı");
    }
    // QR okutulunca masa "oturuldu" olur; garson ekranında sayaç başlar. Eski (unutulmuş) kayıt varsa yenilenir.
    var seatDone = false;
    function markSeated(){
      if (seatDone || online) return; seatDone = true;
      var at = Number(st.tbl.seatedAt) || 0, now = Date.now();
      if (!at || now - at > S.SEAT_MAX) B.setTable(cafeId, String(table), { seatedAt: now, updatedAt: now }).catch(function(){});
    }
    function fail(e){ st.err = S.errText(e); render(); }
    window.addEventListener("online", function(){ st.offline = false; render(); });
    window.addEventListener("offline", function(){ st.offline = true; render(); });

    function head(){
      var cats = [];
      if (st.view === "menu") menu().forEach(function(i){ var c = i.cat || "Diğer"; if (cats.indexOf(c) < 0) cats.push(c); });
      return '<header class="c-head"><div class="c-wrap"><div class="c-head-in">' +
        (ctx.back ? '<button class="btn btn-sm btn-ghost" data-act="back">‹</button>' : '') +
        '<div class="c-name">' + S.esc((st.cafe && st.cafe.name) || "Menü") + '</div>' +
        (st.cafeLoaded && st.cafe && !online ? (st.tbl.waiter || st.tbl.billRequested
          ? '<span class="waiter-btn on" role="status">' + BELL + 'Garson geliyor</span>'
          : '<button class="waiter-btn" data-act="waiter">' + BELL + 'Garson çağır</button>') : '') +
        '<div class="c-table">' + S.esc(tableLabel) + '</div></div>' +
        (cats.length > 1 ? '<nav class="c-chips" aria-label="Kategoriler">' + cats.map(function(c){ return '<button type="button" data-act="cat" data-v="kat-' + S.slugify(c) + '">' + S.esc(c) + '</button>'; }).join("") + '</nav>' : '') +
        '</div></header>' + (st.offline ? '<div class="offline">İnternet bağlantısı yok. Bağlantı gelince siparişinizi gönderebilirsiniz.</div>' : '');
    }
    function photo(i){ var p = st.photos[i.id]; return S.foodArt(i.name) + (p ? '<img src="' + S.esc(p) + '" alt="' + S.esc(i.name) + '" loading="lazy" onerror="this.remove()">' : ''); }
    function stepper(key, name){
      var q = st.cart[key] || 0;
      return '<div class="stepper">' + (q ? '<button class="round" data-act="dec" data-v="' + S.esc(key) + '" aria-label="' + S.esc(name) + ' azalt">−</button><span class="q">' + q + '</span>' : '') +
        '<button class="round' + (q ? "" : " round-add") + '" data-act="inc" data-v="' + S.esc(key) + '" aria-label="' + S.esc(name) + ' ekle">+</button></div>';
    }
    function avoidedIn(i){ return (i.allergens || []).filter(function(a){ return st.avoid[a]; }); }
    function dish(i){
      var base = Number(i.mins) || S.DEFAULT_MINS, mins = base + load().extra, opts = S.options(i), hit = avoidedIn(i);
      var buy = i.out ? '<div class="dish-meta"><span class="dish-price">' + S.fmt(i.price) + '</span><span class="dish-out">Bugün tükendi</span></div>'
        : opts.length === 1 ? '<div class="dish-meta"><span class="dish-price">' + S.fmt(i.price) + '</span>' + stepper(i.id, i.name) + '</div>'
        : opts.map(function(o){ return '<div class="dish-meta portion"><span class="por-l">' + o.label + ((o.amount || o.kcal) ? '<small>' + [o.amount, o.kcal ? o.kcal + ' kcal' : ''].filter(Boolean).map(S.esc).join(' · ') + '</small>' : '') + '</span><span class="dish-price">' + S.fmt(o.price) + '</span>' + stepper(o.key, i.name + " " + o.label) + '</div>'; }).join("");
      var facts = [];
      if (opts.length === 1 && i.amount) facts.push(SCALE + S.esc(i.amount));
      if (opts.length === 1 && Number(i.kcal) > 0) facts.push(FIRE + Number(i.kcal) + ' kcal');
      return '<article class="dish' + (i.out ? " out" : "") + (hit.length ? " avoid" : "") + '"><div class="dish-img">' + photo(i) +
        (i.out ? '' : '<span class="dish-tag' + (mins > base ? ' busy' : '') + '">' + CLOCK + '~' + mins + ' dk</span>') +
        (hit.length ? '<span class="alg-warn">' + WARN + S.esc(hit.map(S.allergenName).join(", ")) + ' içerir</span>' : '') +
        (i.model && !i.out ? '<button class="ar-open" data-act="ar" data-v="' + S.esc(i.id) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg>Masada gör · 3D</button>' : '') +
        '</div><div class="dish-body">' +
        '<h3 class="dish-name">' + S.esc(i.name) + '</h3>' + (i.desc ? '<p class="dish-desc">' + S.esc(i.desc) + '</p>' : '') +
        (facts.length || (i.allergens || []).length ? '<div class="dish-facts">' + facts.map(function(f){ return '<span>' + f + '</span>'; }).join("") +
          ((i.allergens || []).length ? '<span class="alg">İçerir: ' + S.esc(i.allergens.map(S.allergenName).join(", ")) + '</span>' : '') + '</div>' : '') +
        buy + '</div></article>';
    }
    function etaBanner(){
      var act = st.orders.filter(function(o){ return o.status === "new"; }).sort(function(a, b){ return (a.createdAt || 0) - (b.createdAt || 0); });
      var can = st.orders.filter(function(o){ return o.status === "cancelled" && Date.now() - (o.cancelledAt || 0) < 20 * 60000; });
      if (!act.length && !can.length) return "";
      return '<section class="eta-list" aria-live="polite">' + can.map(function(o){
        return '<div class="eta-banner cancelled"><div class="eta-txt"><b>Bir siparişiniz iptal edildi</b><span>' + S.esc(S.summary(o.items)) + ' · hesabınıza yazılmadı. Sorunuz varsa garsonumuza danışın.</span></div></div>';
      }).join("") + act.map(function(o){
        var left = Math.ceil(((o.createdAt || 0) + (o.eta || S.DEFAULT_MINS) * 60000 - Date.now()) / 60000);
        return '<div class="eta-banner">' + CLOCK.replace('width="13" height="13"', 'width="20" height="20"') +
          '<div class="eta-txt"><b>' + (o.etaSetAt && Date.now() - o.etaSetAt < 15 * 60000 ? 'Mutfak süreyi güncelledi' : 'Siparişiniz hazırlanıyor') + '</b><span>' + S.esc(S.summary(o.items)) + '</span></div>' +
          '<div class="eta-num">' + (left > 0 ? '<strong>~' + left + '</strong><small>dk kaldı</small>' : '<strong class="soon">Az kaldı</strong>') + '</div></div>';
      }).join("") + '</section>';
    }
    function menuView(){
      var items = menu();
      if (!items.length) return '<main class="c-wrap c-main"><div class="empty-card"><h2>Menü hazırlanıyor</h2><p>Siparişinizi garsonumuza verebilirsiniz.</p></div></main>';
      var cats = []; items.forEach(function(i){ var c = i.cat || "Diğer"; if (cats.indexOf(c) < 0) cats.push(c); });
      var sel = cartItems(), total = S.sum(sel), count = sel.reduce(function(s, i){ return s + i.qty; }, 0);
      var tableTotal = S.sum([].concat.apply([], st.orders.filter(function(o){ return o.status !== "cancelled"; }).map(function(o){ return o.items || []; })));
      var used = {}; items.forEach(function(i){ (i.allergens || []).forEach(function(a){ used[a] = 1; }); });
      var nAvoid = Object.keys(st.avoid).length;
      var filt = Object.keys(used).length ? '<section class="alg-filter"><button class="alg-toggle" data-act="algPanel" aria-expanded="' + !!st.algOpen + '">' + WARN + (nAvoid ? 'Alerjen filtresi · ' + nAvoid + ' seçili' : 'Alerjiniz mi var?') + '</button>' +
        (st.algOpen ? '<div class="alg-panel"><p>İçermesini istemediklerinizi seçin; bunları içeren yemekler işaretlenir.</p><div class="alg-chips">' +
          S.ALLERGENS.filter(function(a){ return used[a[0]]; }).map(function(a){ return '<button class="alg-chip" aria-pressed="' + !!st.avoid[a[0]] + '" data-act="avoid" data-v="' + a[0] + '">' + S.esc(a[1]) + '</button>'; }).join("") +
          '</div><p class="alg-small">Bilgiler işletme tarafından girilir. Ciddi alerjiniz varsa siparişten önce garsonumuza da söyleyin.</p></div>' : '') + '</section>' : '';
      var L = load();
      var busy = L.extra > 0 ? '<p class="busy-note">' + CLOCK + '<span>Mutfağımız şu an yoğun · süreler yaklaşık <b>+' + L.extra + ' dk</b> uzun</span></p>' : '';
      return '<main class="c-wrap c-main has-bar">' + (online ? onlineBanner() : etaBanner() || '<p class="c-intro">Seçin, gönderin; siparişiniz doğrudan mutfağa gitsin.</p>') + busy + filt +
        cats.map(function(c){ return '<section id="kat-' + S.slugify(c) + '"><h2 class="cat-h">' + S.esc(c) + '</h2>' + '<div class="dish-grid">' + items.filter(function(i){ return (i.cat || "Diğer") === c; }).map(dish).join("") + '</div></section>'; }).join("") +
        '<p class="c-foot">Fiyatlara KDV dahildir. Kalori değerleri yaklaşıktır. Alerjiniz varsa sipariş notuna yazın.</p></main>' +
        '<div class="c-bar"><div class="c-wrap c-bar-in">' +
        (count
          ? '<div class="c-bar-top"><span>' + count + ' ürün · yaklaşık ' + (S.eta(sel, items) + L.extra) + ' dk</span><b>' + S.fmt(total) + '</b></div>' +
            '<label class="sr" for="note">Sipariş notu</label><input id="note" class="note-in" maxlength="120" placeholder="Not ekleyin (ör. acısız, az pişmiş)" value="' + S.esc(st.note) + '">' +
            (online ? '<button class="btn btn-primary btn-lg wide" data-act="checkout">Devam et · ' + S.fmt(total) + '</button>'
              : '<button class="btn btn-primary btn-lg wide" data-act="send"' + (st.busy ? " disabled" : "") + '>' + (st.busy ? "Gönderiliyor…" : "Siparişi gönder") + '</button>')
          : online ? (st.orders.length ? '<button class="btn btn-lg wide" data-act="track">Siparişlerim · ' + st.orders.length + '</button>' : '<p class="c-foot" style="padding-block:10px">Ürünlerin yanındaki + ile seçin. Gel-al ya da paket servis.</p>')
          : (st.orders.length
              ? '<button class="btn btn-lg wide" data-act="bill">Masanın hesabı · ' + S.fmt(tableTotal) + '</button>'
              : '<p class="c-foot" style="padding-block:10px">Ürünlerin yanındaki + ile seçin.</p>')) +
        '</div></div>';
    }
    function onlineState(o){
      if (o.status === "cancelled") return ["İptal edildi", "Sorunuz varsa bizi arayın.", "cancel"];
      if (o.status === "new") { var left = Math.ceil(((o.createdAt || 0) + (o.eta || S.DEFAULT_MINS) * 60000 - Date.now()) / 60000); return ["Hazırlanıyor", left > 0 ? "~" + left + " dk kaldı" : "Az kaldı", "prep"]; }
      if (o.served) return ["Teslim edildi", "Afiyet olsun!", "ok"];
      return o.mode === "paket" ? ["Hazır, yola çıkıyor", "Kuryemiz birazdan kapınızda.", "ready"] : ["Hazır!", "Gelip alabilirsiniz.", "ready"];
    }
    function onlineBanner(){
      var head = '<section class="ol-hero"><span class="ol-kick">Online sipariş</span><h1>' + S.esc((st.cafe && st.cafe.name) || "") + '</h1><p>Gel-al' + (st.cafe && st.cafe.delivery === false ? '' : ' ya da paket servis') + '. Ödeme ' + (st.cafe && st.cafe.delivery === false ? 'teslim alırken' : 'teslimatta ya da gel-al\'da') + ', nakit ya da kart.</p></section>';
      var act = st.orders.filter(function(o){ return o.status !== "cancelled" || Date.now() - (o.cancelledAt || 0) < 3600000; });
      return head + (act.length ? '<button class="ol-track" data-act="track">' + CLOCK + '<span><b>' + act.length + ' siparişiniz var</b><small>' + S.esc(onlineState(act[act.length - 1]).join(" · ").replace(/ · (prep|ready|ok|cancel)$/, "")) + '</small></span><em>Takip et ›</em></button>' : '');
    }
    function checkoutView(){
      var sel = cartItems(), total = S.sum(sel), co = st.co, delivery = !(st.cafe && st.cafe.delivery === false), L = load();
      if (!delivery) co.mode = "gelal";
      return '<main class="c-wrap c-main"><section class="co"><h2 class="co-h">Siparişi tamamla</h2>' +
        '<ul class="co-items">' + sel.map(function(i){ return '<li><span>' + i.qty + '× ' + S.esc(i.name) + '</span><b class="num">' + S.fmt(i.price * i.qty) + '</b></li>'; }).join("") + '</ul>' +
        '<div class="bill-total"><span>Toplam</span><b>' + S.fmt(total) + '</b></div>' +
        '<div class="co-mode" role="radiogroup" aria-label="Teslim şekli">' +
          '<button role="radio" aria-checked="' + (co.mode === "gelal") + '" data-act="mode" data-v="gelal"><b>Gel-al</b><small>~' + (S.eta(sel, menu()) + L.extra) + ' dk sonra hazır</small></button>' +
          (delivery ? '<button role="radio" aria-checked="' + (co.mode === "paket") + '" data-act="mode" data-v="paket"><b>Paket servis</b><small>Adresinize getirelim</small></button>' : '') + '</div>' +
        '<label class="fld" for="co-name"><span>Adınız</span><input id="co-name" maxlength="40" autocomplete="name" value="' + S.esc(co.name) + '"></label>' +
        '<label class="fld" for="co-phone"><span>Telefon</span><input id="co-phone" type="tel" inputmode="tel" maxlength="16" autocomplete="tel" placeholder="05xx xxx xx xx" value="' + S.esc(co.phone) + '"></label>' +
        (co.mode === "paket" ? '<label class="fld" for="co-address"><span>Adres</span><textarea id="co-address" maxlength="200" rows="3" autocomplete="street-address" placeholder="Mahalle, sokak, bina ve daire no, tarif">' + S.esc(co.address) + '</textarea></label>' : '') +
        '<label class="fld" for="note"><span>Not (isteğe bağlı)</span><input id="note" maxlength="120" placeholder="ör. acısız, zil çalışmıyor" value="' + S.esc(st.note) + '"></label>' +
        '<p class="co-pay">Ödeme ' + (co.mode === "paket" ? 'kapıda' : 'gelip aldığınızda') + ', nakit ya da kartla yapılır. Bilgileriniz yalnızca bu sipariş için kullanılır ve sipariş kapanınca silinir.</p>' +
        (st.coErr ? '<p class="form-err" role="alert">' + S.esc(st.coErr) + '</p>' : '') +
        '<button class="btn btn-primary btn-lg wide" data-act="send"' + (st.busy ? " disabled" : "") + '>' + (st.busy ? "Gönderiliyor…" : "Siparişi ver · " + S.fmt(total)) + '</button>' +
        '<button class="btn btn-ghost wide" data-act="menu">‹ Menüye dön</button></section></main>';
    }
    function trackView(){
      var list = st.orders.slice().sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
      return '<main class="c-wrap c-main"><h2 class="co-h">Siparişlerim</h2>' + (list.length ? list.map(function(o){
        var s = onlineState(o), steps = ["prep", "ready", "ok"], idx = steps.indexOf(s[2]);
        return '<article class="trk ' + s[2] + '"><div class="trk-top"><span class="label">' + (o.mode === "paket" ? "Paket servis" : "Gel-al") + ' · ' + S.clock(o.createdAt) + '</span><b>#' + S.esc(String(o.id).slice(-4).toUpperCase()) + '</b></div>' +
          '<h3>' + s[0] + '</h3><p class="trk-sub">' + s[1] + '</p>' +
          (s[2] !== "cancel" ? '<div class="trk-steps">' + ["Alındı", "Hazır", o.mode === "paket" ? "Teslim" : "Alındı"].map(function(t, i){ return '<span class="' + (i <= idx ? "on" : "") + '">' + (i === 2 && o.mode !== "paket" ? "Teslim" : t) + '</span>'; }).join("") + '</div>' : '') +
          '<p class="trk-items">' + S.esc(S.summary(o.items)) + ' · <b>' + S.fmt(Number(o.total) || S.sum(o.items)) + '</b></p></article>';
      }).join("") : '<div class="empty-card"><p>Açık siparişiniz yok.</p></div>') + '<button class="btn btn-ghost wide" data-act="menu">‹ Menüye dön</button></main>';
    }
    function doneView(){
      var o = st.last;
      return '<main class="c-wrap c-main"><section class="done"><div class="done-in">' +
        '<span class="done-ico" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>' +
        '<h2>Siparişiniz alındı</h2><span class="label">Tahmini süre</span><div class="done-eta">~' + o.eta + ' <small>dk</small></div>' +
        '<p>' + S.esc(S.summary(o.items)) + '</p></div></section>' +
        '<div class="row-btns"><button class="btn btn-primary btn-lg" style="flex:1" data-act="menu">Menüye dön</button><button class="btn btn-lg" style="flex:1" data-act="bill">Masanın hesabı</button></div></main>';
    }
    // Hesap bölme (müşteri): sadece hesap makinesi; ödemeyi garson kaydeder, kalan burada canlı görünür.
    function custSplit(){
      var P = S.payState(st.tbl, S.billLines(st.orders), st.split);
      if (!st.split && !P.pays.length) return '<button class="btn wide sp-open" data-act="spOpen">Hesabı böl</button>';
      if (!st.split) st.split = { mode: "esit", n: 0, sel: {} };
      return S.splitHtml(P, st.split, false);
    }
    function billView(){
      var lines = {}, order = [];
      st.orders.filter(function(o){ return o.status !== "cancelled"; }).sort(function(a, b){ return (a.createdAt || 0) - (b.createdAt || 0); }).forEach(function(o){
        (o.items || []).forEach(function(i){ var k = i.name + "|" + i.price; if (!lines[k]) { lines[k] = { name: i.name, price: i.price, qty: 0 }; order.push(k); } lines[k].qty += i.qty; });
      });
      var all = order.map(function(k){ return lines[k]; }), total = S.sum(all);
      var req = st.tbl.billRequested, waiter = st.tbl.waiter;
      return '<main class="c-wrap c-main"><section class="bill"><h3>Masanın hesabı <span class="label">' + S.esc(tableLabel) + '</span></h3>' +
        (all.length ? '<ul>' + all.map(function(i){ return '<li><span>' + i.qty + '× ' + S.esc(i.name) + '</span><span class="num">' + S.fmt(i.price * i.qty) + '</span></li>'; }).join("") + '</ul>' +
          '<div class="bill-total"><span>Toplam</span><b>' + S.fmt(total) + '</b></div>' + custSplit() : '<p class="muted">Bu masadan henüz sipariş verilmedi.</p>') +
        (req ? '<p class="bill-state">Hesap istendi. Garsonumuz masanıza geliyor.</p>' : '') +
        (waiter && !req ? '<p class="bill-state">Garsonumuz masanıza geliyor.</p>' : '') +
        '</section><div class="row-btns">' +
        (all.length && !req ? '<button class="btn btn-primary btn-lg" style="flex:1" data-act="askBill">Hesap iste</button>' : '') +

        '</div><button class="btn btn-ghost" data-act="menu">‹ Menüye dön</button>' +
        '<p class="c-foot">Ödemenizi garsonumuza ya da kasaya yapabilirsiniz.</p></main>';
    }
    function render(){
      if (!alive || S.isEditing()) return;
      var app = S.$("app");
      if (st.err) { app.innerHTML = head() + '<main class="c-wrap c-main"><div class="empty-card"><h2>Bağlantı kurulamadı</h2><p>' + S.esc(st.err) + ' Siparişinizi garsonumuza verebilirsiniz.</p></div></main>'; return; }
      if (!st.cafeLoaded || !st.ordLoaded) { app.innerHTML = head() + '<main class="c-wrap c-main"><p class="muted center">Menü yükleniyor…</p></main>'; return; }
      if (!st.cafe) { app.innerHTML = head() + '<main class="c-wrap c-main"><div class="empty-card"><h2>Restoran bulunamadı</h2><p>Bu QR kod geçerli bir işletmeye bağlı değil.</p></div></main>'; return; }
      if (online && st.cafe.onlineOpen === false && st.view !== "track") { app.innerHTML = head() + '<main class="c-wrap c-main"><div class="empty-card"><h2>Şu an online sipariş almıyoruz</h2><p>Biraz sonra tekrar deneyin ya da bizi arayın.</p></div>' + (st.orders.length ? '<button class="btn wide" data-act="track">Siparişlerim</button>' : '') + '</main>'; return; }
      app.innerHTML = head() + (st.view === "checkout" ? checkoutView() : st.view === "track" ? trackView() : st.view === "done" && st.last && !online ? doneView() : st.view === "bill" && !online ? billView() : menuView());
    }

    function sendOnline(){
      var items = cartItems(), co = st.co; if (!items.length || st.busy) return;
      co.name = co.name.trim(); co.phone = co.phone.replace(/[^0-9+]/g, ""); co.address = co.address.trim();
      st.coErr = !co.name ? "Adınızı yazın." : co.phone.replace(/\D/g, "").length < 10 ? "Telefon numaranızı kontrol edin." : co.mode === "paket" && co.address.length < 10 ? "Adresi biraz daha ayrıntılı yazın." : null;
      if (st.coErr) { render(); return; }
      S.lsSet("sirala-co-name", co.name); S.lsSet("sirala-co-phone", co.phone); if (co.mode === "paket") S.lsSet("sirala-co-address", co.address);
      var u = B.currentUser(), now = Date.now(), eta = S.eta(items, menu()) + load().extra + (co.mode === "paket" ? 10 : 0);
      st.busy = true; render();
      B.addOrder(cafeId, { table: "Online", items: items, total: S.sum(items), eta: eta, note: st.note.trim().slice(0, 120), uid: u ? u.uid : "", source: "online", mode: co.mode, status: "new", closed: false, createdAt: now })
        .then(function(oid){
          var ids = myIds(); ids.push(oid); S.lsSet("sirala-online-ids", JSON.stringify(ids.slice(-20)));
          return B.addContact(cafeId, oid, { name: co.name.slice(0, 40), phone: co.phone.slice(0, 16), address: co.mode === "paket" ? co.address.slice(0, 200) : "", mode: co.mode, createdAt: now });
        })
        .then(function(){ st.cart = {}; st.note = ""; st.view = "track"; window.scrollTo(0, 0); S.toast("Siparişiniz alındı"); })
        .catch(function(e){ S.toast(S.errText(e)); })
        .then(function(){ st.busy = false; render(); });
    }
    function send(){
      if (online) { sendOnline(); return; }
      var items = cartItems(); if (!items.length || st.busy) return;
      var u = B.currentUser(); st.busy = true; render();
      var now = Date.now(), eta = S.eta(items, menu()) + load().extra;
      B.addOrder(cafeId, { table: String(table), items: items, total: S.sum(items), eta: eta, note: st.note.trim().slice(0, 120), uid: u ? u.uid : "", source: "qr", status: "new", closed: false, createdAt: now })
        .then(function(){ st.last = { items: items, eta: eta }; st.cart = {}; st.note = ""; st.view = "done"; window.scrollTo(0, 0); })
        .catch(function(e){ S.toast(S.errText(e)); })
        .then(function(){ st.busy = false; render(); });
    }
    function flag(patch, msg){
      B.setTable(cafeId, String(table), Object.assign({ updatedAt: Date.now() }, patch)).then(function(){ S.toast(msg); }).catch(function(e){ S.toast(S.errText(e)); });
    }

    S.$("app").oninput = function(e){ var id = e.target.id; if (id === "note") st.note = e.target.value; else if (id.indexOf("co-") === 0) st.co[id.slice(3)] = e.target.value; };
    S.$("app").onfocusout = function(){ setTimeout(function(){ if (!S.isEditing()) render(); }, 0); };
    S.$("app").onclick = function(e){
      var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
      var v = b.dataset.v;
      switch (b.dataset.act) {
        case "inc": st.cart[v] = (st.cart[v] || 0) + 1; break;
        case "dec": if (st.cart[v]) { st.cart[v]--; if (!st.cart[v]) delete st.cart[v]; } break;
        case "send": send(); return;
        case "algPanel": st.algOpen = !st.algOpen; break;
        case "avoid": if (st.avoid[v]) delete st.avoid[v]; else st.avoid[v] = 1; S.lsSet("sirala-avoid", JSON.stringify(st.avoid)); break;
        case "ar": { var it = menu().find(function(x){ return x.id === v; }); if (it) S.openAR(it, "1 porsiyon" + (it.amount ? " · " + it.amount : "") + (Number(it.kcal) > 0 ? " · yaklaşık " + it.kcal + " kcal" : "") + "."); return; }
        case "cat": { var sec = document.getElementById(v), hd = document.querySelector(".c-head");
          if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.pageYOffset - (hd ? hd.offsetHeight : 0) - 8, behavior: "smooth" }); return; }
        case "menu": st.view = "menu"; st.coErr = null; window.scrollTo(0, 0); break;
        case "checkout": st.view = "checkout"; window.scrollTo(0, 0); break;
        case "track": st.view = "track"; window.scrollTo(0, 0); break;
        case "mode": st.co.mode = v; break;
        case "bill": st.view = "bill"; window.scrollTo(0, 0); break;
        case "spOpen": st.split = { mode: "esit", n: 0, sel: {} }; break;
        case "spMode": st.split.mode = v; break;
        case "spN": { var P = S.payState(st.tbl, S.billLines(st.orders), st.split); st.split.n = Math.max(Math.max(2, P.eqPaid + 1), Math.min(20, P.n + Number(v))); break; }
        case "spUnit": if (st.split.sel[v]) delete st.split.sel[v]; else st.split.sel[v] = 1; break;
        case "askBill": flag({ billRequested: true, requestedAt: Date.now() }, "Hesap istendi"); return;
        case "waiter": flag({ waiter: true, waiterAt: Date.now() }, "Garson çağrıldı"); return;
        case "back": ctx.back(); return;
      }
      render();
    };
    var tick = setInterval(function(){ if (st.view === "menu") render(); }, 30000);
    return function(){ alive = false; clearInterval(tick); unsubs.forEach(function(u){ try { u(); } catch(e){} }); };
  };
})();
