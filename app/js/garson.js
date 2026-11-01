/* Mars Zeka — çalışan uygulaması (telefon): gelen siparişler (QR + garson), masalar ve çağrılar, mutfaktan hazır,
   sipariş alma, masa hesabı. Patron rolündeki kullanıcı aynı uygulamada ek olarak "Patron" sekmesini görür. */
(function(){
  "use strict";
  window.SiralaApp = window.SiralaApp || {};
  var IC = {
    tables: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    ready: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 8V6M10 6h4"/></svg>',
    order: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M12 17h3"/></svg>',
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    inbox: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
    boss: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
    split: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4"/></svg>',
    bill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>'
  };

  window.SiralaApp.garson = function(ctx){
    var B = ctx.B, cafeId = ctx.cafeId || "";
    var st = { user: null, authKnown: false, loginErr: null, cafe: null, cafeLoaded: false, denied: false,
      orders: [], tables: {}, photos: {}, tab: "gelen", sheet: null, confirmClose: false, wTable: null, wCart: {}, wNote: "", busy: false,
      seenFlags: null, seenReady: null, seenNew: null, fromCache: false, contacts: {}, mineOnly: false,
      rep: null, repDays: 1, zoneFor: null, nsErr: null, nsBusy: false };
    var alive = true, unsubs = [];
    var menu = function(){ return (st.cafe && Array.isArray(st.cafe.menu)) ? st.cafe.menu : []; };
    var nTables = function(){ return Math.max(1, Math.min(80, Number(st.cafe && st.cafe.tables) || 10)); };
    var me = function(){ return S.staffInfo(st.cafe, st.user && st.user.email); };
    var isBoss = function(){ return me().role === "patron"; };
    var myTables = function(){ return (((st.cafe && st.cafe.zones) || {})[(st.user && st.user.email) || ""] || []).map(String); };
    var tick = setInterval(function(){ if (!S.isEditing()) render(); }, 30000);

    B.onAuth(function(u){
      if (!alive) return;
      st.user = u && u.staff ? u : null; st.authKnown = true;
      unsubs.forEach(function(x){ try { x(); } catch(e){} }); unsubs = [];
      if (!st.user) { render(true); return; }
      if (!cafeId || (ctx.followLogin && st.user.email && /\.marszeka\.app$/.test(st.user.email) && st.user.email.split("@")[1].replace(/\.marszeka\.app$/, "") !== cafeId)) {
        var guess = /\.marszeka\.app$/.test(st.user.email) ? st.user.email.split("@")[1].replace(/\.marszeka\.app$/, "") : "";
        if (guess && ctx.followLogin) { cafeId = guess; }
        else if (!cafeId) { B.listMyCafes(st.user.email).then(function(l){ if (l.length) { cafeId = l[0].id; subscribe(); } else { st.denied = "Bu hesap hiçbir işletmeye bağlı değil."; render(true); } }); return; }
      }
      subscribe();
    });
    function subscribe(){
      unsubs.push(B.watchCafe(cafeId, function(d){ if (d && window.SiralaLang && SiralaLang.addMenu) SiralaLang.addMenu(d.menu, d.catI18n);
        st.cafe = d; st.cafeLoaded = true;
        st.denied = !!(d && B.kind === "firebase" && (d.staffEmails || []).indexOf(st.user.email) < 0) && "Bu hesap bu işletmenin çalışanları arasında değil.";
        document.title = "Mars Zeka · " + ((d && d.name) || cafeId); render();
      }, function(){ st.denied = "Bu işletmeye erişim yok."; render(true); }));
      unsubs.push(B.watchPhotos(cafeId, function(m){ st.photos = m || {}; render(); }));
      unsubs.push(B.watchContacts(cafeId, function(m){ st.contacts = m || {}; render(); }));
      unsubs.push(B.watchOrders(cafeId, null, function(list, cache){
        st.orders = list; st.fromCache = cache;
        var fresh = {}; list.forEach(function(o){ if (o.status === "new" && o.source !== "garson") fresh[o.id] = o; });
        if (st.seenNew) { for (var n in fresh) if (!st.seenNew[n]) { var fo = fresh[n], mine = fo.source === "online" || !myTables().length || myTables().indexOf(String(fo.table)) >= 0;
          if (mine) alertMe("Yeni sipariş · " + S.orderLabel(fo), 2, 620); break; } }
        st.seenNew = fresh;
        var ready = {}; readyList().forEach(function(o){ ready[o.id] = 1; });
        if (st.seenReady) { for (var k in ready) if (!st.seenReady[k]) { alertMe("Mutfaktan hazır · " + S.orderLabel(st.orders.find(function(o){ return o.id === k; }) || {}), 2, 740); break; } }
        st.seenReady = ready; render();
      }));
      unsubs.push(B.watchTables(cafeId, function(m){
        var flags = {}, msg = null;
        Object.keys(m).forEach(function(t){ if (m[t].billRequested) flags["b" + t] = 1; if (m[t].waiter) flags["w" + t] = 1; });
        if (st.seenFlags) for (var f in flags) if (!st.seenFlags[f]) { msg = "Masa " + f.slice(1) + (f[0] === "b" ? " hesap istiyor" : " garson çağırıyor"); break; }
        st.seenFlags = flags; st.tables = m;
        if (msg) alertMe(msg, 3, 880);
        render();
      }));
    }
    B.ready.catch(function(){ st.authKnown = true; st.denied = "Sisteme bağlanılamadı."; render(true); });

    function alertMe(msg, n, freq){
      S.beep(n, freq);
      try { if (navigator.vibrate) navigator.vibrate([220, 120, 220]); } catch(e){}
      S.toast(msg);
    }

    /* ---------- veri ---------- */
    function readyList(){
      var since = Date.now() - 3 * 3600000;
      return st.orders.filter(function(o){ return o.status === "done" && !o.served && (o.doneAt || 0) > since; })
        .sort(function(a, b){ return (a.doneAt || 0) - (b.doneAt || 0); });
    }
    function tableAgg(t){
      var list = st.orders.filter(function(o){ return String(o.table) === String(t) && o.status !== "cancelled"; });
      var lines = {}, keys = [];
      list.forEach(function(o){ (o.items || []).forEach(function(i){ var k = i.name + "|" + i.price; if (!lines[k]) { lines[k] = { name: i.name, price: i.price, qty: 0 }; keys.push(k); } lines[k].qty += i.qty; }); });
      return { list: list, lines: keys.map(function(k){ return lines[k]; }), total: list.reduce(function(s, o){ return s + (Number(o.total) || S.sum(o.items)); }, 0),
        waiting: list.filter(function(o){ return o.status === "new"; }).length, ready: list.filter(function(o){ return o.status === "done" && !o.served; }).length };
    }
    function calls(){
      return Object.keys(st.tables).filter(function(t){ return st.tables[t].billRequested || st.tables[t].waiter; })
        .sort(function(a, b){ var x = st.tables[a], y = st.tables[b]; return (x.requestedAt || x.waiterAt || 0) - (y.requestedAt || y.waiterAt || 0); });
    }

    /* ---------- işlemler ---------- */
    // Oturma sayacı: QR okutulunca başlar; sipariş yoksa "sipariş vermedi" listesinde görünür.
    function seat(t){ return S.seatInfo(st.tables[String(t)] || {}, tableAgg(t).list); }
    function waitingSeats(){
      var out = [];
      for (var t = 1; t <= nTables(); t++) { var x = seat(t); if (x && x.noOrder) out.push({ t: String(t), x: x }); }
      if (st.mineOnly && myTables().length) out = out.filter(function(w){ return myTables().indexOf(w.t) >= 0; });
      return out.sort(function(a, b){ return b.x.seatMin - a.x.seatMin; });
    }
    function seatLvl(m){ return m >= 10 ? "late" : m >= 5 ? "warn" : ""; }
    function seatSection(){
      var w = waitingSeats(); if (!w.length) return "";
      return '<h3 class="g-cat">Oturdu, sipariş vermedi · ' + w.length + '</h3><section class="g-calls">' + w.map(function(e){
        return '<article class="g-call g-seat ' + seatLvl(e.x.seatMin) + '"><span class="g-ci">' + IC.clock + '</span><div><b>Masa ' + S.esc(e.t) + '</b><small>' +
          (e.x.seatMin < 1 ? "Az önce oturdu" : e.x.seatMin + " dk'dır oturuyor") + ' · henüz sipariş yok</small></div>' +
          '<button class="g-btn" data-act="addFor" data-v="' + S.esc(e.t) + '">Sipariş al</button></article>';
      }).join("") + '</section>';
    }
    function vacate(t){ B.setTable(cafeId, String(t), { seatedAt: 0, billRequested: false, waiter: false, updatedAt: Date.now() }).then(function(){ S.toast("Masa " + t + " boş"); }).catch(function(e){ S.toast(S.errText(e)); }); }
    function clearFlags(t){ return B.setTable(cafeId, String(t), { billRequested: false, waiter: false, updatedAt: Date.now() }).catch(function(e){ S.toast(S.errText(e)); }); }
    function served(o){
      if (o.source === "online") { S.deliverOnline(B, cafeId, o).then(function(){ S.toast("Online sipariş teslim edildi"); }).catch(function(e){ S.toast(S.errText(e)); }); return; }
      B.updateOrder(cafeId, o.id, { served: true, servedAt: Date.now() }).then(function(){ S.toast("Masa " + o.table + " servis edildi"); }).catch(function(e){ S.toast(S.errText(e)); }); }
    function closeTable(t){
      B.closeTable(cafeId, String(t)).then(function(){ S.toast("Masa " + t + " kapatıldı"); st.sheet = null; st.confirmClose = false; render(true); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function send(){
      var items = S.cartLines(st.wCart, menu());
      if (!st.wTable || !items.length || st.busy) return;
      st.busy = true; render(true);
      B.addOrder(cafeId, { table: String(st.wTable), items: items, total: S.sum(items), eta: S.eta(items, menu()) + S.loadInfo(st.orders, st.cafe).extra,
        note: st.wNote.trim().slice(0, 120), uid: st.user.uid, by: st.user.email, byName: me().name, source: "garson", status: "new", closed: false, createdAt: Date.now() })
        .then(function(){ S.toast("Masa " + st.wTable + " siparişi mutfakta"); st.wCart = {}; st.wNote = ""; })
        .catch(function(e){ S.toast(S.errText(e)); })
        .then(function(){ st.busy = false; render(true); });
    }

    /* ---------- görünüm ---------- */
    function thumb(id, name, cls){
      var p = st.photos[id];
      return '<span class="g-th' + (cls ? " " + cls : "") + '">' + S.foodArt(name) + (p ? '<img src="' + S.esc(p) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span>';
    }
    var byName = function(nm){ return menu().find(function(m){ return m.name === nm; }) || {}; };
    function head(){
      var nCalls = calls().length;
      var m = me();
      return '<header class="g-head"><div><span class="g-kick">' + S.esc((st.cafe && st.cafe.name) || "") + '</span><b>' + S.esc(m.name) + (m.role === "patron" ? ' <em class="g-role">Patron</em>' : '') + '</b></div>' +
        '<button class="g-who" data-act="logout">Çıkış</button>' +
        (nCalls ? '<span class="g-pulse">' + nCalls + ' çağrı</span>' : '<span class="g-ok">Sakin</span>') + '</header>' +
        (S.audioReady ? '' : '<button class="g-sound" data-act="sound">' + IC.bell + 'Bildirim sesini ve titreşimi açmak için dokunun</button>') +
        (!navigator.onLine || st.fromCache ? '<div class="offline">İnternet yok. Liste son hâliyle duruyor.</div>' : '');
    }
    function contactHtml(o){
      if (o.source !== "online") return "";
      var c = st.contacts[o.id];
      if (!c) return '<p class="g-contact muted">İletişim bilgisi yükleniyor…</p>';
      return '<div class="g-contact"><b>' + S.esc(c.name) + '</b> · <a href="tel:' + S.esc(c.phone) + '">' + S.esc(c.phone) + '</a>' +
        (c.address ? '<br><a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address) + '" target="_blank" rel="noopener">' + S.esc(c.address) + '</a>' : '') + '</div>';
    }
    function orderCard(o){
      var done = o.status === "done", left = Math.ceil(((o.createdAt || 0) + (o.eta || S.DEFAULT_MINS) * 60000 - Date.now()) / 60000);
      var who = o.source === "garson" ? (o.byName || "garson") : o.source === "online" ? "online" : "QR";
      var zone = o.source === "online" ? null : S.zoneOf(st.cafe, o.table);
      return '<article class="g-ord ' + (o.source === "online" ? "online " : "") + (done ? "done" : "") + '"><div class="g-r-top"><b>' + S.esc(S.orderLabel(o)) + '</b><small>' + S.clock(o.createdAt) + ' · ' + S.esc(who) + '</small></div>' +
        (zone ? '<span class="g-zone">Sorumlu: ' + S.esc(S.staffInfo(st.cafe, zone).name) + '</span>' : '') +
        '<ul class="g-r-items">' + (o.items || []).map(function(i){ var base = String(i.name).replace(/ \(1,5 porsiyon\)$/, ""); return '<li>' + thumb(byName(base).id || i.id, base, "sm") + '<span><b>' + i.qty + '×</b> ' + S.esc(i.name) + '</span></li>'; }).join("") + '</ul>' +
        (o.note ? '<p class="g-note">Not: ' + S.esc(o.note) + '</p>' : '') + contactHtml(o) +
        '<div class="g-ord-foot"><span class="g-chip ' + (done ? "ok" : left < 0 ? "late" : "") + '">' + (done ? "Hazır" : left >= 0 ? "Mutfakta · ~" + left + " dk" : (-left) + " dk gecikti") + '</span><b class="num">' + S.fmt(Number(o.total) || S.sum(o.items)) + '</b></div>' +
        (done ? '<button class="g-btn wide" data-act="served" data-v="' + S.esc(o.id) + '">' + (o.source === "online" ? "Teslim edildi · kapat" : "Servis edildi") + '</button>' : '') + '</article>';
    }
    function inboxTab(){
      var list = st.orders.filter(function(o){ return o.status === "new" || (o.status === "done" && !o.served); });
      if (st.mineOnly && myTables().length) list = list.filter(function(o){ return o.source === "online" || myTables().indexOf(String(o.table)) >= 0; });
      list.sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
      var onl = list.filter(function(o){ return o.source === "online"; }), tbl = list.filter(function(o){ return o.source !== "online"; });
      return '<div class="g-h-row"><h2 class="g-h">Siparişler</h2>' + (myTables().length ? '<button class="g-filter" aria-pressed="' + st.mineOnly + '" data-act="mine">Sadece benim masalarım</button>' : '') + '</div>' +
        seatSection() + (list.length ? (onl.length ? '<h3 class="g-cat">Online · ' + onl.length + '</h3>' + onl.map(orderCard).join("") : '') +
          (tbl.length ? '<h3 class="g-cat">Masalar · ' + tbl.length + '</h3>' + tbl.map(orderCard).join("") : '')
          : waitingSeats().length ? '' : '<div class="g-empty">' + IC.inbox + '<p>Açık sipariş yok. QR\'dan sipariş gelince burada belirir, telefon titrer.</p></div>');
    }
    function tablesTab(){
      var cs = calls();
      var out = cs.length ? '<section class="g-calls">' + cs.map(function(t){
        var x = st.tables[t], bill = x.billRequested;
        return '<article class="g-call ' + (bill ? "bill" : "wait") + '"><span class="g-ci">' + (bill ? IC.bill : IC.bell) + '</span><div><b>Masa ' + S.esc(t) + '</b><small>' + (bill ? "Hesap istiyor" : "Garson çağırıyor") + ' · ' + S.ago(bill ? x.requestedAt : x.waiterAt) + '</small></div>' +
          (bill ? '<button class="g-btn" data-act="sheet" data-v="' + S.esc(t) + '">Hesabı aç</button>' : '<button class="g-btn" data-act="going" data-v="' + S.esc(t) + '">Gidiyorum</button>') + '</article>';
      }).join("") + '</section>' : '';
      out += seatSection();
      var cells = [];
      for (var t = 1; t <= nTables(); t++) {
        var a = tableAgg(t), f = st.tables[String(t)] || {}, se = seat(t);
        var cls = f.billRequested ? "bill" : f.waiter ? "wait" : a.ready ? "ready" : a.list.length ? "busy" : se ? "seat " + seatLvl(se.seatMin) : "";
        var sub = f.billRequested ? "Hesap" : f.waiter ? "Çağırıyor" : a.ready ? a.ready + " hazır" : a.waiting ? a.waiting + " mutfakta" : a.list.length ? "Yemekte" : se ? "Sipariş yok" : "Boş";
        var zn = S.zoneOf(st.cafe, t), mineT = zn && st.user && zn === st.user.email;
        cells.push('<button class="g-tbl ' + cls + (mineT ? " mine" : "") + '" data-act="sheet" data-v="' + t + '"><span class="n">' + t + '</span><span class="s">' + sub + '</span>' + (a.list.length ? '<span class="t">' + S.fmt(a.total) + '</span>' : '') + (se ? '<span class="tm">' + IC.clock + se.seatMin + ' dk</span>' : '') +
          (zn ? '<span class="g-ini" title="' + S.esc(S.staffInfo(st.cafe, zn).name) + '">' + S.esc(S.staffInfo(st.cafe, zn).name.slice(0, 1).toLocaleUpperCase("tr-TR")) + '</span>' : '') + '</button>');
      }
      return out + '<h2 class="g-h">Masalar</h2><div class="g-grid">' + cells.join("") + '</div>' +
        (myTables().length ? '<p class="g-info">Sizin masalarınız: <b>' + myTables().join(", ") + '</b> (kalın çerçeveli)</p>' : '') + '<div class="g-legend"><span class="seat">Oturdu, sipariş yok</span><span class="busy">Dolu</span><span class="ready">Hazır yemek</span><span class="wait">Çağırıyor</span><span class="bill">Hesap</span></div>';
    }
    function readyTab(){
      var r = readyList();
      if (!r.length) return '<h2 class="g-h">Mutfaktan hazır</h2><div class="g-empty">' + IC.ready + '<p>Şu an bekleyen yemek yok. Mutfak "Hazırlandı"ya bastığında burada belirir, telefon titrer.</p></div>';
      return '<h2 class="g-h">Mutfaktan hazır <span>' + r.length + '</span></h2>' + r.map(function(o){
        var wait = Math.max(0, Math.round((Date.now() - (o.doneAt || 0)) / 60000));
        return '<article class="g-ready' + (wait >= 5 ? " late" : "") + '"><div class="g-r-top"><b>' + S.esc(S.orderLabel(o)) + '</b><small>' + (wait < 1 ? "şimdi hazırlandı" : wait + " dk önce hazırlandı") + '</small></div>' +
          '<ul class="g-r-items">' + (o.items || []).map(function(i){ var base = String(i.name).replace(/ \(1,5 porsiyon\)$/, ""); return '<li>' + thumb(byName(base).id || i.id, base, "sm") + '<span><b>' + i.qty + '×</b> ' + S.esc(i.name) + '</span></li>'; }).join("") + '</ul>' +
          (o.note ? '<p class="g-note">Not: ' + S.esc(o.note) + '</p>' : '') +
          contactHtml(o) + '<button class="g-btn wide" data-act="served" data-v="' + S.esc(o.id) + '">' + (o.source === "online" ? "Teslim edildi · kapat" : "Servis edildi") + '</button></article>';
      }).join("");
    }
    function orderTab(){
      var items = menu().filter(function(i){ return !i.out; }), cats = [];
      items.forEach(function(i){ var c = i.cat || "Diğer"; if (cats.indexOf(c) < 0) cats.push(c); });
      var sel = S.cartLines(st.wCart, menu()), count = sel.reduce(function(s, i){ return s + i.qty; }, 0), L = S.loadInfo(st.orders, st.cafe);
      var tbs = []; for (var t = 1; t <= nTables(); t++) tbs.push('<button aria-pressed="' + (String(st.wTable) === String(t)) + '" data-act="wTable" data-v="' + t + '">' + t + '</button>');
      return '<h2 class="g-h">Sipariş al</h2><span class="g-lbl">Masa</span><div class="g-pick">' + tbs.join("") + '</div>' +
        cats.map(function(c){ return '<h3 class="g-cat">' + S.esc(c) + '</h3>' + items.filter(function(i){ return (i.cat || "Diğer") === c; }).map(function(i){
          return S.options(i).map(function(o){ var q = st.wCart[o.key] || 0;
            return '<div class="g-item">' + thumb(i.id, i.name) + '<div class="g-it-txt"><b>' + S.esc(i.name) + (o.label !== "1 porsiyon" && S.options(i).length > 1 ? ' <em>' + o.label + '</em>' : '') + '</b><small>' + S.fmt(o.price) + (o.amount ? ' · ' + S.esc(o.amount) : '') + '</small></div>' +
              '<div class="stepper">' + (q ? '<button class="round" data-act="dec" data-v="' + S.esc(o.key) + '" aria-label="azalt">−</button><span class="q">' + q + '</span>' : '') +
              '<button class="round' + (q ? "" : " round-add") + '" data-act="inc" data-v="' + S.esc(o.key) + '" aria-label="' + S.esc(i.name) + ' ekle">+</button></div></div>';
          }).join(""); }).join(""); }).join("") +
        '<div class="g-sendbar">' + (count ? '<div class="g-sum"><span>' + (st.wTable ? "Masa " + st.wTable : "Masa seçin") + ' · ' + count + ' ürün · ~' + (S.eta(sel, menu()) + L.extra) + ' dk</span><b>' + S.fmt(S.sum(sel)) + '</b></div>' +
          '<label class="sr" for="gnote">Not</label><input id="gnote" class="note-in" maxlength="120" placeholder="Not (ör. acısız)" value="' + S.esc(st.wNote) + '">' : '') +
          '<button class="btn btn-primary btn-lg wide" data-act="send"' + (st.wTable && count && !st.busy ? "" : " disabled") + '>' + (st.busy ? "Gönderiliyor…" : !st.wTable ? "Önce masa seçin" : !count ? "Ürün ekleyin" : "Mutfağa gönder") + '</button></div>';
    }
    function sheet(){
      var t = st.sheet; if (!t) return "";
      var a = tableAgg(t), f = st.tables[String(t)] || {}, se = seat(t);
      return '<div class="g-scrim" data-act="sheetClose"></div><section class="g-sheet" role="dialog" aria-label="Masa ' + S.esc(t) + '"><span class="g-grab" aria-hidden="true"></span>' +
        '<div class="g-s-top"><h3>Masa ' + S.esc(t) + '</h3>' + (f.billRequested ? '<span class="g-tag bill">Hesap istedi</span>' : f.waiter ? '<span class="g-tag wait">Çağırıyor</span>' : '') + '</div>' +
        (se ? '<div class="g-seatline ' + (se.noOrder ? seatLvl(se.seatMin) : "") + '">' + IC.clock + '<span>Oturuyor: <b>' + se.seatMin + ' dk</b></span><span>' + (se.noOrder ? "Henüz sipariş yok" : "Son sipariş: <b>" + (se.lastMin < 1 ? "şimdi" : se.lastMin + " dk önce") + "</b>") + '</span></div>' : '') +
        (a.lines.length ? '<ul class="g-bill">' + a.lines.map(function(i){ return '<li><span>' + i.qty + '× ' + S.esc(i.name) + '</span><span class="num">' + S.fmt(i.price * i.qty) + '</span></li>'; }).join("") + '</ul>' +
          '<div class="bill-total"><span>Toplam</span><b>' + S.fmt(a.total) + '</b></div>' +
          (a.waiting ? '<p class="g-info">' + a.waiting + ' sipariş hâlâ mutfakta.</p>' : '') + splitBlock(t, f, a) : '<p class="muted">Bu masada açık sipariş yok.</p>') +
        '<div class="g-s-acts">' +
        (a.lines.length ? (st.confirmClose
          ? '<button class="btn btn-primary btn-lg wide" data-act="closeYes" data-v="' + S.esc(t) + '">Evet, ödendi · masayı kapat</button><button class="btn wide" data-act="closeNo">Vazgeç</button>'
          : '<button class="btn btn-primary btn-lg wide" data-act="closeAsk">Ödeme alındı · masayı kapat</button>') : '') +
        '<button class="btn wide" data-act="addFor" data-v="' + S.esc(t) + '">Bu masaya sipariş ekle</button>' +
        (se && se.noOrder ? '<button class="btn btn-ghost wide" data-act="vacate" data-v="' + S.esc(t) + '">Müşteri kalktı · masayı boşalt</button>' : '') +
        (f.billRequested || f.waiter ? '<button class="btn btn-ghost wide" data-act="going" data-v="' + S.esc(t) + '">Uyarıyı kapat</button>' : '') +
        '</div></section>';
    }
    // Hesap bölme: eşit ya da ürüne göre; her ödeme masa kaydına yazılır, herkes (müşteri dahil) kalanı görür.
    function splitBlock(t, f, a){
      var P = S.payState(f, S.billLines(a.list), st.split && st.split.t === String(t) ? st.split : null);
      var open = (st.split && st.split.t === String(t)) || P.pays.length;
      if (!open) return '<button class="btn wide sp-open" data-act="spOpen" data-v="' + S.esc(t) + '">' + IC.split + 'Hesabı böl</button>';
      if (!st.split || st.split.t !== String(t)) st.split = { t: String(t), mode: "esit", n: 0, sel: {} };
      return S.splitHtml(P, st.split, true);
    }
    function splitSave(pays){
      var t = st.split.t;
      B.setTable(cafeId, t, { payments: pays, updatedAt: Date.now() }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function splitAct(act, v){
      var t = st.split && st.split.t; if (!t) return;
      var P = S.payState(st.tables[t] || {}, S.billLines(tableAgg(t).list), st.split);
      if (act === "spMode") st.split.mode = v;
      else if (act === "spN") st.split.n = Math.max(Math.max(2, P.eqPaid + 1), Math.min(20, P.n + Number(v)));
      else if (act === "spAmt") st.split.amt = v;
      else if (act === "spUnit") { if (st.split.sel[v]) delete st.split.sel[v]; else st.split.sel[v] = 1; }
      else if (act === "spPay") {
        var pays = S.addPayment(P, st.split, v, st.user && st.user.email); if (!pays) return;
        var amt = pays[pays.length - 1].amount; st.split.sel = {};
        if (v === "esit") st.split.n = P.n;
        if (v === "tutar") { var ch = Math.max(0, Math.round(Number(String(st.split.amt).replace(",", ".")) || 0) - amt); st.split.amt = ""; if (ch) { S.toast("Ödeme alındı · " + S.fmt(amt) + " · para üstü " + S.fmt(ch)); splitSave(pays); render(true); return; } }
        splitSave(pays); S.toast("Ödeme alındı · " + S.fmt(amt));
      } else if (act === "spUndo") { if (P.pays.length) { splitSave(P.pays.slice(0, -1)); S.toast("Son ödeme geri alındı"); } }
      render(true);
    }
    function loadRep(){
      var d0 = new Date(); d0.setHours(0, 0, 0, 0); var since = d0.getTime() - (st.repDays - 1) * 86400000;
      B.listOrders(cafeId, since).then(function(list){ st.rep = list.filter(function(o){ return o.status !== "cancelled"; }); render(); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function bossTab(){
      var R = st.rep, cafe = st.cafe || {}, staff = cafe.staff || {}, zones = cafe.zones || {};
      var emails = Object.keys(staff).filter(function(e){ return staff[e].role === "garson"; });
      var head = '<div class="g-h-row"><h2 class="g-h">Patron</h2><div class="g-pick sm">' + [[1, "Bugün"], [7, "7 gün"], [30, "30 gün"]].map(function(x){ return '<button aria-pressed="' + (st.repDays === x[0]) + '" data-act="repDays" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div></div>';
      if (!R) return head + '<p class="muted">Yükleniyor…</p>';
      var sum = function(l){ return l.reduce(function(s, o){ return s + (Number(o.total) || S.sum(o.items)); }, 0); };
      var total = sum(R), onl = R.filter(function(o){ return o.source === "online"; }), qr = R.filter(function(o){ return o.source === "qr"; });
      var openT = {}; st.orders.forEach(function(o){ if (o.source !== "online" && o.status !== "cancelled") openT[o.table] = 1; });
      var tiles = '<div class="g-tiles">' +
        '<div class="g-tile big"><span>Toplam gelir</span><b>' + S.fmt(total) + '</b><small>' + R.length + ' sipariş · iptaller hariç</small></div>' +
        '<div class="g-tile"><span>Garson</span><b>' + S.fmt(sum(R.filter(function(o){ return o.source === "garson"; }))) + '</b><small>' + R.filter(function(o){ return o.source === "garson"; }).length + ' sipariş</small></div>' +
        '<div class="g-tile"><span>QR</span><b>' + S.fmt(sum(qr)) + '</b><small>' + qr.length + ' sipariş</small></div>' +
        '<div class="g-tile"><span>Şu an açık masa</span><b>' + Object.keys(openT).length + '</b><small>mutfakta ' + st.orders.filter(function(o){ return o.status === "new"; }).length + ' sipariş</small></div></div>';
      var rows = emails.map(function(e){
        var name = staff[e].name || e, z = (zones[e] || []).map(String);
        var took = R.filter(function(o){ return o.by === e; }), area = R.filter(function(o){ return o.source !== "online" && z.indexOf(String(o.table)) >= 0; });
        return { e: e, name: name, z: z, took: took.length, tookSum: sum(took), area: sum(area), open: z.filter(function(t){ return openT[t]; }).length };
      }).sort(function(a, b){ return b.took - a.took; });
      var max = Math.max(1, Math.max.apply(null, rows.map(function(r){ return r.took; }).concat([0])));
      var team = '<h3 class="g-cat">Garsonlar</h3>' + (rows.length ? rows.map(function(r, i){
        return '<article class="g-staff"><div class="g-st-top"><span class="g-av">' + S.esc(r.name.slice(0, 1).toLocaleUpperCase("tr-TR")) + '</span><div><b>' + S.esc(r.name) + (i === 0 && r.took ? ' <em class="g-role">En çok sipariş</em>' : '') + '</b><small>Masaları: ' + (r.z.length ? r.z.join(", ") : "atanmadı") + ' · şu an ' + r.open + ' açık</small></div></div>' +
          '<div class="g-bar"><i style="width:' + Math.round(r.took / max * 100) + '%"></i></div>' +
          '<div class="g-st-nums"><span><b>' + r.took + '</b> sipariş aldı · ' + S.fmt(r.tookSum) + '</span><span>Masalarının cirosu <b>' + S.fmt(r.area) + '</b></span></div>' +
          '<button class="btn btn-sm" data-act="zoneFor" data-v="' + S.esc(r.e) + '">' + (st.zoneFor === r.e ? "Bitti" : "Masalarını düzenle") + '</button>' +
          (st.zoneFor === r.e ? '<div class="g-pick wrap">' + (function(){ var b = []; for (var t = 1; t <= nTables(); t++) { var owner = S.zoneOf(st.cafe, t); b.push('<button aria-pressed="' + (r.z.indexOf(String(t)) >= 0) + '" data-act="zoneT" data-v="' + t + '"' + (owner && owner !== r.e ? ' class="taken" title="' + S.esc(S.staffInfo(st.cafe, owner).name) + '"' : '') + '>' + t + '</button>'); } return b.join(""); })() + '</div><p class="g-info">Başka garsonun masasını seçerseniz o masa bu garsona geçer.</p>' : '') +
          '</article>';
      }).join("") : '<p class="muted">Henüz garson eklenmedi. Aşağıdan çalışan ekleyin.</p>');
      var people = '<h3 class="g-cat">Çalışan hesapları</h3><div class="g-set">' + Object.keys(staff).map(function(e){
          var x = staff[e];
          return '<div class="g-sw"><span><b>' + S.esc(x.name || e) + ' <em class="g-role ' + (x.role === "patron" ? "" : "soft") + '">' + (x.role === "patron" ? "Patron" : x.role === "mutfak" ? "Mutfak" : "Garson") + '</em></b><small>Kullanıcı adı: ' + S.esc(S.userName(e)) + '</small></span>' +
            (e === st.user.email ? '<small class="muted">siz</small>' : st.confirmRm === e ? '<span class="row-btns"><button class="btn btn-sm btn-bad" data-act="rmYes" data-v="' + S.esc(e) + '">Evet, kaldır</button><button class="btn btn-sm" data-act="rmNo">Vazgeç</button></span>' : '<button class="btn btn-sm btn-ghost" data-act="rmAsk" data-v="' + S.esc(e) + '">Kaldır</button>') + '</div>';
        }).join("") +
        '<form class="g-new" id="newStaff" novalidate><b>Yeni çalışan</b>' +
        '<label for="ns-name">Adı<input id="ns-name" maxlength="30" placeholder="ör. Ali"></label>' +
        '<label for="ns-user">Kullanıcı adı<input id="ns-user" autocapitalize="none" maxlength="20" placeholder="ör. ali"></label>' +
        '<label for="ns-pass">Şifre (en az 6)<input id="ns-pass" type="text" autocomplete="new-password" maxlength="40"></label>' +
        '<label for="ns-role">Rol<select id="ns-role"><option value="garson">Garson</option><option value="mutfak">Mutfak</option><option value="patron">Patron (her şeyi görür)</option></select></label>' +
        (st.nsErr ? '<p class="form-err" role="alert">' + S.esc(st.nsErr) + '</p>' : '') +
        '<button class="btn btn-primary wide" type="submit"' + (st.nsBusy ? " disabled" : "") + '>' + (st.nsBusy ? "Açılıyor…" : "Hesabı aç") + '</button>' +
        '<p class="g-info">Çalışan girişte işletme kodu <b>' + S.esc(cafeId) + '</b>, kendi kullanıcı adı ve şifresini yazar. Kaldırılan çalışanın erişimi hemen kapanır.</p></form></div>';
      var L = S.loadInfo(st.orders, cafe);
      var settings = '<h3 class="g-cat">Ayarlar</h3><div class="g-set">' +
        '<div class="g-sw"><span><b>Mutfak ek süresi</b><small>' + L.queue + ' bekleyen · otomatik +' + L.auto + ' dk</small></span><div class="g-pick sm">' + [0, 10, 20].map(function(x){ return '<button aria-pressed="' + (L.manual === x) + '" data-act="busy" data-v="' + x + '">' + (x ? "+" + x : "Yok") + '</button>'; }).join("") + '</div></div></div>';
      return head + tiles + team + people + settings;
    }
    function newStaff(){
      var name = (S.$("ns-name").value || "").trim(), user = (S.$("ns-user").value || "").trim().toLocaleLowerCase("tr-TR"), pass = S.$("ns-pass").value || "", role = S.$("ns-role").value;
      st.nsErr = !name ? "Adını yazın." : !S.USER_RE.test(user) ? "Kullanıcı adı 3–20 karakter olmalı; harf, rakam, nokta, tire (Türkçe karakter yok)." : pass.length < 6 ? "Şifre en az 6 karakter olmalı." : null;
      if (st.nsErr) { render(true); return; }
      st.nsBusy = true; render(true);
      B.createStaff(cafeId, { email: S.userEmail(cafeId, user), password: pass, name: name, role: role })
        .then(function(){ S.toast(name + " eklendi · kullanıcı adı: " + user); st.nsErr = null; })
        .catch(function(e){ st.nsErr = S.errText(e); })
        .then(function(){ st.nsBusy = false; render(true); });
    }
    function nav(){
      var nCalls = calls().length, nReady = readyList().length;
      var nNew = st.orders.filter(function(o){ return o.status === "new" && o.source !== "garson"; }).length;
      var tabs = [["gelen", "Siparişler", IC.inbox, nNew], ["masalar", "Masalar", IC.tables, nCalls], ["hazir", "Hazır", IC.ready, nReady], ["siparis", "Sipariş al", IC.order, 0]];
      if (isBoss()) tabs.push(["patron", "Patron", IC.boss, 0]);
      return '<nav class="g-nav" style="grid-template-columns:repeat(' + tabs.length + ',1fr)" aria-label="Bölümler">' + tabs.map(function(x){
        return '<button data-act="tab" data-v="' + x[0] + '" aria-current="' + (st.tab === x[0] ? "page" : "false") + '">' + x[2] + '<span>' + x[1] + '</span>' + (x[3] ? '<i class="g-badge">' + x[3] + '</i>' : '') + '</button>';
      }).join("") + '</nav>';
    }
    function render(force){
      if (!alive || (!force && S.isEditing())) return;
      var app = S.$("app"), y = window.pageYOffset;
      document.body.classList.add("g-body");
      if (!st.authKnown) { app.innerHTML = '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      if (!st.user) { app.innerHTML = S.loginView("Çalışan girişi", st.loginErr, "", ctx.loginHint || ""); S.bindLogin(B, function(m){ st.loginErr = m; render(true); }); return; }
      if (!cafeId) { app.innerHTML = '<p class="muted center" style="padding:40px">İşletmeniz bulunuyor…</p>'; return; }
      if (st.cafe && me().role === "mutfak" && ctx.kitchenHref) { location.replace(ctx.kitchenHref(cafeId)); return; }
      if (st.denied) { app.innerHTML = '<main class="login"><div class="login-card"><h1>Erişim yok</h1><p class="muted">' + S.esc(st.denied) + '</p><button class="btn wide" data-act="logout">Başka hesapla giriş yap</button></div></main>'; return; }
      if (!st.cafeLoaded) { app.innerHTML = '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      app.innerHTML = '<div class="g-app">' + head() + '<main class="g-main">' + (st.tab === "hazir" ? readyTab() : st.tab === "siparis" ? orderTab() : st.tab === "gelen" ? inboxTab() : st.tab === "patron" && isBoss() ? bossTab() : tablesTab()) + '</main>' + nav() + sheet() + '</div>';
      window.scrollTo(0, y);
    }

    var app = S.$("app");
    app.oninput = function(e){
      if (e.target.id === "gnote") st.wNote = e.target.value;
      if (e.target.id === "sp-amt" && st.split) {                 // yazarken ekranı yeniden çizme; sadece düğme ve not güncellenir
        st.split.amt = e.target.value;
        var t = st.split.t, A = S.amountInfo(S.payState(st.tables[t] || {}, S.billLines(tableAgg(t).list), st.split), st.split);
        var btn = S.$("sp-amt-btn"), note = S.$("sp-amt-note");
        if (btn) { btn.textContent = A.label; btn.disabled = !A.take; }
        if (note) note.textContent = A.note;
      }
    };
    app.onkeydown = function(e){ if (e.target.id === "sp-amt" && e.key === "Enter") { e.preventDefault(); var b = S.$("sp-amt-btn"); if (b && !b.disabled) b.click(); } };
    app.onsubmit = function(e){ if (e.target.id === "newStaff") { e.preventDefault(); newStaff(); } };
    app.onchange = function(e){
      var a = e.target.dataset && e.target.dataset.act;
      if (a === "setOnline") B.updateCafe(cafeId, { onlineOpen: e.target.checked }).then(function(){ S.toast(e.target.checked ? "Online sipariş açık" : "Online sipariş kapalı"); });
      if (a === "setDelivery") B.updateCafe(cafeId, { delivery: e.target.checked }).then(function(){ S.toast(e.target.checked ? "Paket servis açık" : "Sadece gel-al"); });
    };
    app.onfocusout = function(){ if (!st.user) return; setTimeout(function(){ if (!S.isEditing()) render(); }, 0); };
    app.onclick = function(e){
      var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
      var v = b.dataset.v;
      switch (b.dataset.act) {
        case "tab": st.tab = v; st.sheet = null; window.scrollTo(0, 0); if (v === "patron") { st.rep = null; loadRep(); } break;
        case "mine": st.mineOnly = !st.mineOnly; break;
        case "repDays": st.repDays = Number(v); st.rep = null; loadRep(); break;
        case "zoneFor": st.zoneFor = st.zoneFor === v ? null : v; break;
        case "rmAsk": st.confirmRm = v; break;
        case "rmNo": st.confirmRm = null; break;
        case "rmYes": st.confirmRm = null; B.removeStaff(cafeId, v).then(function(){ S.toast("Çalışan kaldırıldı, erişimi kapandı"); }).catch(function(x){ S.toast(S.errText(x)); }); return;
        case "zoneT": { var z = JSON.parse(JSON.stringify((st.cafe && st.cafe.zones) || {})), e = st.zoneFor; if (!e) break;
          Object.keys(z).forEach(function(k){ if (k !== e) z[k] = (z[k] || []).map(String).filter(function(x){ return x !== v; }); });
          var arr = (z[e] || []).map(String), ix = arr.indexOf(v); if (ix >= 0) arr.splice(ix, 1); else arr.push(v);
          z[e] = arr.sort(function(a, b){ return a - b; }); B.updateCafe(cafeId, { zones: z }).catch(function(x){ S.toast(S.errText(x)); }); return; }
        case "busy": { var cur = S.loadInfo(st.orders, st.cafe).manual, dl = Number(v) - cur;
          st.orders.filter(function(o){ return o.status === "new"; }).forEach(function(o){ B.updateOrder(cafeId, o.id, { eta: Math.max(1, (Number(o.eta) || S.DEFAULT_MINS) + dl) }); });
          B.updateCafe(cafeId, { busyExtra: Number(v) }).catch(function(x){ S.toast(S.errText(x)); }); return; }
        case "sheet": st.sheet = v; st.confirmClose = false; st.split = null; break;
        case "spOpen": st.split = { t: String(v), mode: "esit", n: 0, sel: {} }; break;
        case "spMode": case "spN": case "spUnit": case "spPay": case "spUndo": case "spAmt": splitAct(b.dataset.act, v); return;
        case "sheetClose": st.sheet = null; st.confirmClose = false; break;
        case "going": clearFlags(v).then(function(){ S.toast("Masa " + v + ": gidiyorsunuz"); }); if (st.sheet) st.sheet = null; break;
        case "served": { var o = st.orders.find(function(x){ return x.id === v; }); if (o) served(o); return; }
        case "closeAsk": st.confirmClose = true; break;
        case "closeNo": st.confirmClose = false; break;
        case "closeYes": closeTable(v); return;
        case "vacate": vacate(v); st.sheet = null; break;
        case "addFor": st.tab = "siparis"; st.wTable = v; st.sheet = null; window.scrollTo(0, 0); break;
        case "wTable": st.wTable = v; break;
        case "inc": st.wCart[v] = (st.wCart[v] || 0) + 1; break;
        case "dec": if (st.wCart[v]) { st.wCart[v]--; if (!st.wCart[v]) delete st.wCart[v]; } break;
        case "send": send(); return;
        case "sound": S.beep(1, 660); try { if (navigator.vibrate) navigator.vibrate(80); } catch(x){} break;
        case "logout": unsubs.forEach(function(u){ try { u(); } catch(x){} }); unsubs = []; st.cafe = null; st.cafeLoaded = false; st.tab = "gelen"; B.logout(); return;
      }
      render(true);
    };
    S.onAudioReady(function(){ S.keepAwake(); if (st.user && !S.isEditing()) render(true); });
    var onVis = function(){ if (document.visibilityState === "visible") S.keepAwake(); };
    document.addEventListener("visibilitychange", onVis);
    return function(){ alive = false; clearInterval(tick); document.removeEventListener("visibilitychange", onVis); document.body.classList.remove("g-body"); unsubs.forEach(function(u){ try { u(); } catch(e){} }); };
  };
})();
