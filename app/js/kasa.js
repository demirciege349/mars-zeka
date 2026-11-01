/* Mars Zeka — kasa / mutfak ekranı: gelen siparişler, masalar ve hesap, garson siparişi, menü. */
(function(){
  "use strict";
  window.SiralaApp = window.SiralaApp || {};

  window.SiralaApp.kasa = function(ctx){
    var B = ctx.B, cafeId = ctx.cafeId;
    var st = { user: null, authKnown: false, loginErr: null, myCafes: null, cafe: null, cafeLoaded: false, denied: false,
      orders: [], ordLoaded: false, fromCache: false, tables: {}, tab: "siparis", openTable: null, confirmClose: false,
      wTable: null, moveFrom: null, repDays: "1", report: null, wCart: {}, wNote: "", busy: false, pinOk: false, log: [], seen: null, seenFlags: null, confirmCancel: null, contacts: {} };
    var alive = true, unsubs = [];
    var menu = function(){ return (st.cafe && Array.isArray(st.cafe.menu)) ? st.cafe.menu : []; };
    var nTables = function(){ return Math.max(1, Math.min(80, Number(st.cafe && st.cafe.tables) || 10)); };

    B.onAuth(function(u){
      if (!alive) return;
      st.user = u && u.staff ? u : null; st.authKnown = true;
      unsubs.forEach(function(x){ try { x(); } catch(e){} }); unsubs = [];
      if (!st.user) { render(true); return; }
      if (!cafeId) { B.listMyCafes(st.user.email).then(function(l){ st.myCafes = l; render(true); }); return; }
      subscribe();
    });
    B.ready.catch(function(){ st.authKnown = true; st.denied = "Sisteme bağlanılamadı."; render(true); });

    function subscribe(){
      unsubs.push(B.watchCafe(cafeId, function(d){
        st.cafe = d; st.cafeLoaded = true;
        st.denied = !!(d && B.kind === "firebase" && (d.staffEmails || []).indexOf(st.user.email) < 0) && "Bu hesap bu işletmenin kasa hesapları arasında değil.";
        var role = d && d.staff && d.staff[st.user.email] ? d.staff[st.user.email].role : null;
        if (!st.denied && role === "garson") st.denied = "Bu ekran mutfak içindir. Garson hesabıyla çalışan uygulamasını kullanın.";
        document.title = "Kasa · " + ((d && d.name) || cafeId); render();
      }, function(){ st.denied = "Bu işletmeye erişim yok."; render(true); }));
      unsubs.push(B.watchOrders(cafeId, null, function(list, cache){
        st.orders = list; st.ordLoaded = true; st.fromCache = cache;
        var keys = {}; list.forEach(function(o){ keys[o.id] = 1; });
        if (st.seen) { for (var k in keys) if (!st.seen[k]) { S.beep(2, 660); break; } }
        st.seen = keys; render();
      }));
      unsubs.push(B.watchContacts(cafeId, function(m){ st.contacts = m || {}; render(); }));
      unsubs.push(B.watchTables(cafeId, function(m){
        var flags = {}; Object.keys(m).forEach(function(t){ if (m[t].billRequested) flags["b" + t] = 1; if (m[t].waiter) flags["w" + t] = 1; });
        if (st.seenFlags) { for (var f in flags) if (!st.seenFlags[f]) { S.beep(3, 880); break; } }
        st.seenFlags = flags; st.tables = m; render();
      }));
    }

    /* ---------- işlemler ---------- */
    function upd(o, patch){ return B.updateOrder(cafeId, o.id, patch).catch(function(e){ S.toast(S.errText(e)); }); }
    function clearFlags(t){ return B.setTable(cafeId, String(t), { billRequested: false, waiter: false, updatedAt: Date.now() }).catch(function(e){ S.toast(S.errText(e)); }); }
    function closeTable(t){
      B.closeTable(cafeId, String(t)).then(function(){ S.toast("Masa " + t + " kapatıldı"); st.openTable = null; st.confirmClose = false; render(true); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function sendWaiter(){
      var items = S.cartLines(st.wCart, menu());
      if (!st.wTable || !items.length || st.busy) return;
      st.busy = true; render(true);
      B.addOrder(cafeId, { table: String(st.wTable), items: items, total: S.sum(items), eta: S.eta(items, menu()) + S.loadInfo(st.orders, st.cafe).extra, note: st.wNote.trim().slice(0, 120), uid: st.user.uid, source: "garson", status: "new", closed: false, createdAt: Date.now() })
        .then(function(){ S.toast("Masa " + st.wTable + " siparişi mutfağa gönderildi"); st.wCart = {}; st.wNote = ""; })
        .catch(function(e){ S.toast(S.errText(e)); })
        .then(function(){ st.busy = false; render(true); });
    }
    function saveMenu(items, msg){ return B.updateCafe(cafeId, { menu: items }).then(function(){ if (msg) S.toast(msg); }).catch(function(e){ S.toast(S.errText(e)); }); }
    function unlock(){
      var pin = (S.$("pin") || {}).value || "";
      Promise.all([B.getPrivate(cafeId), S.sha256(cafeId + ":" + pin)]).then(function(r){
        if (r[0].pinHash && r[0].pinHash === r[1]) { st.pinOk = true; st.log = r[0].log || []; render(true); } else S.toast("PIN yanlış");
      }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function saveItem(id){
      var items = menu().map(function(x){ return Object.assign({}, x); }), it = items.find(function(x){ return x.id === id; }); if (!it) return;
      var p = Math.max(0, Math.round(Number((S.$("pr-" + id) || {}).value) || 0)), m = Math.max(1, Math.min(180, Math.round(Number((S.$("mn-" + id) || {}).value) || S.DEFAULT_MINS)));
      var changes = [];
      if (p > 0 && p !== Number(it.price)) changes.push(it.name + ": " + it.price + " → " + p + " ₺");
      if (m !== (Number(it.mins) || S.DEFAULT_MINS)) changes.push(it.name + " süresi: " + (Number(it.mins) || S.DEFAULT_MINS) + " → " + m + " dk");
      if (!changes.length) { S.toast("Değişiklik yok"); return; }
      if (p > 0) it.price = p; it.mins = m;
      var d = new Date(), stamp = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " + S.clock(d);
      st.log = changes.map(function(c){ return stamp + "  " + c; }).concat(st.log).slice(0, 60);
      saveMenu(items, p > 0 && changes.some(function(c){ return c.indexOf("₺") > 0; }) ? "Kaydedildi · basılı fiyat listesini yeniden yazdırmayı unutmayın" : "Kaydedildi").then(function(){ return B.setPrivate(cafeId, { log: st.log }); }).then(function(){ render(true); });
    }

    /* ---------- görünüm ---------- */
    function alertsHtml(){
      var out = [];
      Object.keys(st.tables).sort(function(a, b){ return a - b; }).forEach(function(t){
        var x = st.tables[t];
        if (x.billRequested) out.push('<div class="alert"><span>Masa ' + S.esc(t) + ' hesap istiyor · ' + S.ago(x.requestedAt) + '</span><span class="row-btns"><button class="btn btn-sm" data-act="openTable" data-v="' + S.esc(t) + '">Hesabı aç</button></span></div>');
        else if (x.waiter) out.push('<div class="alert"><span>Masa ' + S.esc(t) + ' garson çağırıyor · ' + S.ago(x.waiterAt) + '</span><button class="btn btn-sm" data-act="gone" data-v="' + S.esc(t) + '">Gidildi</button></div>');
      });
      return out.length ? '<div class="alerts">' + out.join("") + '</div>' : '';
    }
    function head(){
      var nNew = st.orders.filter(function(o){ return o.status === "new"; }).length;
      var nBill = Object.keys(st.tables).filter(function(t){ return st.tables[t].billRequested; }).length;
      var tabs = [["siparis", "Siparişler", nNew], ["masalar", "Masalar", nBill], ["garson", "Garson siparişi", 0], ["menu", "Menü", 0], ["rapor", "Rapor", 0]];
      return '<header class="k-head"><div class="k-wrap k-head-in"><div><span class="label">Kasa · Mutfak</span><div class="k-name">' + S.esc((st.cafe && st.cafe.name) || "") + '</div></div>' +
        '<nav class="tabs" role="tablist" aria-label="Bölümler">' + tabs.map(function(t){ return '<button role="tab" aria-selected="' + (st.tab === t[0]) + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + (t[2] ? '<span class="badge">' + t[2] + '</span>' : '') + '</button>'; }).join("") + '</nav>' +
        (ctx.setupHref ? '<a class="btn btn-sm" href="' + S.esc(ctx.setupHref) + '">Kurulum</a>' : '') + '</div></header>' +
        (!navigator.onLine || st.fromCache ? '<div class="offline">İnternet bağlantısı yok. Liste son hâliyle duruyor; telefondan internet paylaşımı açarak devam edebilirsiniz.</div>' : '');
    }
    function etaHtml(o){
      var left = Math.round(((o.createdAt || 0) + (o.eta || S.DEFAULT_MINS) * 60000 - Date.now()) / 60000);
      return left >= 0 ? '<span class="t-eta">Tahmini · ' + left + ' dk kaldı</span>' : '<span class="t-eta late">' + (-left) + ' dk gecikti</span>';
    }
    function ordersTab(){
      var nw = st.orders.filter(function(o){ return o.status === "new"; }).sort(function(a, b){ return (a.createdAt || 0) - (b.createdAt || 0); });
      var dn = st.orders.filter(function(o){ return o.status === "done"; }).sort(function(a, b){ return (b.doneAt || 0) - (a.doneAt || 0); }).slice(0, 10);
      var L = S.loadInfo(st.orders, st.cafe), opts = [0, 10, 20];
      var busyBar = '<div class="busy-bar"><div><b>Mutfak yoğunluğu</b><span class="small muted">' + L.queue + ' sipariş bekliyor · otomatik ' + (L.auto ? '+' + L.auto + ' dk' : 'ek yok') +
        ' · müşteriye ' + (L.extra ? '+' + L.extra + ' dk' : 'normal süre') + ' gösteriliyor</span></div><div class="pick-table"><span class="small">Elle ekle:</span>' +
        opts.map(function(x){ return '<button aria-pressed="' + (L.manual === x) + '" data-act="busy" data-v="' + x + '">' + (x ? '+' + x + ' dk' : 'Yok') + '</button>'; }).join("") + '</div></div>';
      return busyBar + '<div class="k-cols"><section><h2 class="k-h">Hazırlanacak <span class="label">' + nw.length + ' sipariş</span></h2>' +
        (nw.length ? '<div class="tickets">' + nw.map(function(o){
          var late = Date.now() > (o.createdAt || 0) + (o.eta || S.DEFAULT_MINS) * 60000;
          return '<article class="ticket' + (late ? " late" : "") + (o.source === "online" ? " online" : "") + '"><div class="t-top"><span class="t-table">' + S.esc(S.orderLabel(o)) + '</span><span class="t-time">' + S.clock(o.createdAt) + '<br>' + (o.source === "garson" ? S.esc(o.byName || "garson") : o.source === "online" ? "online" : "QR") + '</span></div>' +
            '<ul class="t-items">' + (o.items || []).map(function(i){ return '<li><b>' + i.qty + '×</b>' + S.esc(i.name) + '</li>'; }).join("") + '</ul>' +
            (o.note ? '<div class="t-note">Not: ' + S.esc(o.note) + '</div>' : '') + (o.source === "online" && st.contacts[o.id] ? '<div class="t-note">' + S.esc(st.contacts[o.id].name) + ' · ' + S.esc(st.contacts[o.id].phone) + (st.contacts[o.id].address ? '<br>' + S.esc(st.contacts[o.id].address) : '') + '</div>' : '') + etaHtml(o) +
            '<div class="t-left"><span class="small muted">Kaç dk sonra çıkar?</span>' + [5, 10, 15, 20].map(function(x){ return '<button data-act="leftSet" data-v="' + S.esc(o.id) + '" data-m="' + x + '">' + x + '</button>'; }).join("") + '</div>' +
            '<button class="btn btn-primary" data-act="done" data-v="' + S.esc(o.id) + '">Hazırlandı</button>' +
            (st.confirmCancel === o.id
              ? '<div class="t-cancel"><span>İptal edilsin mi? Hesaptan düşer.</span><button class="btn btn-sm btn-bad" data-act="cancelYes" data-v="' + S.esc(o.id) + '">Evet, iptal</button><button class="btn btn-sm" data-act="cancelNo">Vazgeç</button></div>'
              : '<button class="t-cancel-link" data-act="cancelAsk" data-v="' + S.esc(o.id) + '">Siparişi iptal et</button>') + '</article>';
        }).join("") + '</div>' : '<div class="empty-card"><p>Bekleyen sipariş yok. Masalardan gelen siparişler burada belirir ve ses çıkarır.</p></div>') +
        '</section><section><h2 class="k-h">Hazırlananlar</h2>' +
        (dn.length ? '<div class="done-list">' + dn.map(function(o){ return '<div class="done-row"><b>' + (o.source === "online" ? (o.mode === "paket" ? "Paket" : "Gel-al") : "M" + S.esc(o.table)) + '</b><span class="d">' + S.esc(S.summary(o.items)) + '</span><span class="small muted">' + S.clock(o.doneAt) + '</span>' + (o.source === "online" ? '<button class="btn btn-sm" data-act="deliver" data-v="' + S.esc(o.id) + '">Teslim edildi</button>' : '') + '<button class="btn btn-sm btn-ghost" data-act="undo" data-v="' + S.esc(o.id) + '" aria-label="Geri al">Geri al</button></div>'; }).join("") + '</div>' : '<p class="muted small">Henüz yok.</p>') +
        '</section></div>';
    }
    function tableAgg(t){
      var list = st.orders.filter(function(o){ return String(o.table) === String(t) && o.status !== "cancelled" && o.source !== "online"; });
      return { list: list, total: list.reduce(function(s, o){ return s + (Number(o.total) || S.sum(o.items)); }, 0) };
    }
    function tablesTab(){
      var cells = [];
      for (var t = 1; t <= nTables(); t++) {
        var a = tableAgg(t), f = st.tables[String(t)] || {};
        cells.push('<button class="tbl' + (f.billRequested ? " bill" : a.list.length ? " busy" : "") + '" data-act="openTable" data-v="' + t + '"><span class="tbl-n">' + t + '</span>' +
          '<span class="tbl-s">' + (f.billRequested ? "Hesap istendi" : f.waiter ? "Garson çağırıyor" : a.list.length ? a.list.length + " sipariş" : "Boş") + '</span>' +
          (a.list.length ? '<span class="tbl-t">' + S.fmt(a.total) + '</span>' : '') + '</button>');
      }
      return '<h2 class="k-h">Masalar <span class="label">Hesabı görmek için masaya dokunun</span></h2><div class="tables">' + cells.join("") + '</div>' + (st.openTable ? detail(st.openTable) : '');
    }
    function billLines(t){
      var a = tableAgg(t), m = {}, out = [];
      a.list.forEach(function(o){ (o.items || []).forEach(function(i){ var k = i.name + "|" + i.price; if (!m[k]) { m[k] = { name: i.name, price: i.price, qty: 0 }; out.push(m[k]); } m[k].qty += i.qty; }); });
      return { lines: out, total: a.total };
    }
    function exportCsv(){
      var R = st.report; if (!R || !R.n) return;
      var q = function(x){ return '"' + String(x).replace(/"/g, '""') + '"'; };
      var rows = [["Ürün", "Adet", "Birim fiyat", "Tutar"]].concat(R.lines.map(function(l){ return [l.name, l.qty, l.price, l.price * l.qty]; }));
      rows.push(["TOPLAM", R.items, "", R.revenue]);
      var d = new Date();
      S.downloadText("\ufeff" + rows.map(function(r){ return r.map(q).join(";"); }).join("\r\n"), (cafeId || "marszeka") + "-satis-" + d.toISOString().slice(0, 10) + ".csv", "text/csv");
    }
    function detail(t){
      var a = tableAgg(t), lines = {}, keys = [];
      a.list.forEach(function(o){ (o.items || []).forEach(function(i){ var k = i.name + "|" + i.price; if (!lines[k]) { lines[k] = { name: i.name, price: i.price, qty: 0 }; keys.push(k); } lines[k].qty += i.qty; }); });
      return '<section class="detail" id="detail"><h3>Masa ' + S.esc(t) + '</h3>' +
        (keys.length ? '<ul>' + keys.map(function(k){ var i = lines[k]; return '<li><span>' + i.qty + '× ' + S.esc(i.name) + '</span><span class="num">' + S.fmt(i.price * i.qty) + '</span></li>'; }).join("") + '</ul>' +
          '<div class="bill-total"><span>Toplam</span><b>' + S.fmt(a.total) + '</b></div>' : '<p class="muted">Açık sipariş yok.</p>') +
        '<div class="row-btns">' + (keys.length ? (st.confirmClose
          ? '<button class="btn btn-primary" data-act="closeYes" data-v="' + S.esc(t) + '">Evet, ödendi · masayı kapat</button><button class="btn" data-act="closeNo">Vazgeç</button>'
          : '<button class="btn btn-primary" data-act="closeAsk">Ödeme alındı · masayı kapat</button>') : '') +
        (keys.length ? '<button class="btn" data-act="printBill" data-v="' + S.esc(t) + '">Hesap fişi yazdır</button>' : '') +
        '<button class="btn" data-act="wFor" data-v="' + S.esc(t) + '">Bu masaya sipariş ekle</button>' +
        (keys.length ? '<button class="btn" data-act="moveAsk" data-v="' + S.esc(t) + '">Masayı taşı</button>' : '') +
        ((st.tables[String(t)] || {}).billRequested || (st.tables[String(t)] || {}).waiter ? '<button class="btn btn-ghost" data-act="gone" data-v="' + S.esc(t) + '">Uyarıyı kapat</button>' : '') +
        '<button class="btn btn-ghost" data-act="closeDetail">Kapat</button></div>' +
        (st.moveFrom === String(t) ? moveHtml(t) : '') + '</section>';
    }
    function moveHtml(t){
      var b = []; for (var x = 1; x <= nTables(); x++) if (String(x) !== String(t)) {
        var busy = tableAgg(x).list.length;
        b.push('<button data-act="moveTo" data-v="' + x + '"' + (busy ? ' class="busy" title="Bu masada açık sipariş var"' : '') + '>' + x + '</button>');
      }
      return '<div class="move-box"><span class="label">Masa ' + S.esc(t) + ' siparişleri hangi masaya taşınsın?</span><div class="pick-table">' + b.join("") + '</div>' +
        '<p class="small muted">Dolu masaya taşırsanız siparişler o masanın hesabına eklenir.</p><button class="btn btn-sm btn-ghost" data-act="moveNo">Vazgeç</button></div>';
    }
    function reportTab(){
      var R = st.report, ranges = [["1", "Bugün"], ["7", "Son 7 gün"], ["14", "Son 14 gün"]];
      var head = '<div class="rep-head"><h2 class="k-h" style="margin:0">Rapor</h2><div class="pick-table">' + ranges.map(function(r){ return '<button aria-pressed="' + (st.repDays === r[0]) + '" data-act="repRange" data-v="' + r[0] + '">' + r[1] + '</button>'; }).join("") + '</div></div>';
      if (!R) return head + '<p class="muted">Yükleniyor…</p>';
      if (!R.n) return head + '<div class="empty-card"><p>Bu aralıkta sipariş yok.</p></div>';
      var maxH = Math.max.apply(null, R.hours.map(function(h){ return h[1]; }));
      return head + '<div class="rep-tiles">' +
        tile("Sipariş", R.n, R.items + " ürün") + tile("QR'dan", "%" + R.qrPct, R.qr + " QR · " + R.garson + " garson") +
        tile("Ciro", S.fmt(R.revenue), R.cancelled ? R.cancelled + " iptal hariç" : "iptal yok") + tile("Masa başı hesap", R.checks ? S.fmt(R.avgCheck) : "—", R.checks + " kapanan masa") +
        tile("Hazırlanma", R.prepN ? "~" + R.avgPrep + " dk" : "—", R.prepN ? "%" + R.onTime + " zamanında" : "henüz yok") + '</div>' +
        '<div class="k-cols" style="margin-top:20px"><section class="k-panel"><span class="label">En çok satanlar</span><ol class="rep-top">' +
        R.top.map(function(t){ return '<li><span>' + S.esc(t[0]) + '</span><b class="num">' + t[1] + '</b></li>'; }).join("") + '</ol></section>' +
        '<section class="k-panel"><span class="label">Saatlere göre sipariş</span><div class="rep-hours">' +
        R.hours.map(function(h){ return '<div class="rep-bar"><span class="num">' + h[0] + ':00</span><i style="width:' + Math.max(4, Math.round(h[1] / maxH * 100)) + '%"></i><b>' + h[1] + '</b></div>'; }).join("") + '</div></section></div>' +
        '<div class="pl-box" style="margin-top:20px"><div><b>Satış dökümü (Excel)</b><span class="small muted">Seçili aralıkta hangi üründen kaç adet satıldı. Adisyon programınıza ya da muhasebeye toplu girmek için.</span></div><button class="btn" data-act="csv">İndir (.csv)</button></div>' +
        '<p class="small muted" style="margin-top:14px">"Eski siparişleri temizle" yapılırsa o günlerin raporu da silinir. Pilot bitmeden temizlemeyin, ekran görüntüsünü alın.</p>';
    }
    function tile(k, v, s){ return '<div class="rep-tile"><span class="label">' + k + '</span><b>' + v + '</b><small>' + S.esc(s) + '</small></div>'; }
    function loadReport(){
      st.report = null; render(true);
      var d0 = new Date(); d0.setHours(0, 0, 0, 0); var since = d0.getTime() - (Number(st.repDays) - 1) * 86400000;
      B.listOrders(cafeId, since).then(function(list){
        var ok = list.filter(function(o){ return o.status !== "cancelled"; });
        var R = { n: ok.length, items: 0, qr: 0, garson: 0, revenue: 0, checks: 0, avgCheck: 0, prepN: 0, avgPrep: 0, onTime: 0, top: [], hours: [] };
        var counts = {}, hrs = {}, checks = {}, lines = {}, prepSum = 0, onTime = 0;
        ok.forEach(function(o){
          (o.items || []).forEach(function(i){ R.items += i.qty; counts[i.name] = (counts[i.name] || 0) + i.qty; var lk = i.name + "|" + i.price; if (!lines[lk]) lines[lk] = { name: i.name, price: Number(i.price) || 0, qty: 0 }; lines[lk].qty += i.qty; });
          if (o.source === "garson") R.garson++; else R.qr++;
          var tot = Number(o.total) || S.sum(o.items); R.revenue += tot;
          var h = new Date(o.createdAt || 0).getHours(); hrs[h] = (hrs[h] || 0) + 1;
          if (o.closed && o.closedAt) { var k = o.table + "@" + o.closedAt; checks[k] = (checks[k] || 0) + tot; }
          if (o.doneAt && o.createdAt) { R.prepN++; prepSum += (o.doneAt - o.createdAt) / 60000; if (o.doneAt <= o.createdAt + (o.eta || S.DEFAULT_MINS) * 60000) onTime++; }
        });
        R.qrPct = R.n ? Math.round(R.qr / R.n * 100) : 0;
        var cv = Object.keys(checks).map(function(k){ return checks[k]; });
        R.checks = cv.length; R.avgCheck = cv.length ? cv.reduce(function(a, b){ return a + b; }, 0) / cv.length : 0;
        R.avgPrep = R.prepN ? Math.round(prepSum / R.prepN) : 0; R.onTime = R.prepN ? Math.round(onTime / R.prepN * 100) : 0;
        R.top = Object.keys(counts).map(function(k){ return [k, counts[k]]; }).sort(function(a, b){ return b[1] - a[1]; }).slice(0, 6);
        R.hours = Object.keys(hrs).map(Number).sort(function(a, b){ return a - b; }).map(function(h){ return [(h < 10 ? "0" : "") + h, hrs[h]]; });
        R.lines = Object.keys(lines).map(function(k){ return lines[k]; }).sort(function(a, b){ return b.qty - a.qty; });
        R.cancelled = list.length - ok.length;
        st.report = R; render(true);
      }).catch(function(e){ S.toast(S.errText(e)); st.report = { n: 0 }; render(true); });
    }
    function waiterTab(){
      var items = menu().filter(function(i){ return !i.out; });
      var sel = S.cartLines(st.wCart, menu());
      var tbs = []; for (var t = 1; t <= nTables(); t++) tbs.push('<button aria-pressed="' + (String(st.wTable) === String(t)) + '" data-act="wTable" data-v="' + t + '">' + t + '</button>');
      return '<div class="k-narrow"><p class="muted">Misafir QR kullanmak istemezse siparişini buradan girin. Mutfağa aynı şekilde düşer, masanın hesabına eklenir.</p>' +
        '<section class="k-panel"><span class="label" style="margin-bottom:8px">Masa</span><div class="pick-table">' + tbs.join("") + '</div></section>' +
        '<section class="k-panel">' + (items.length ? items.map(function(i){
          return S.options(i).map(function(o, n){ var q = st.wCart[o.key] || 0;
            return '<div class="w-item"><span class="nm"><b>' + S.esc(i.name) + (n ? ' · 1,5 porsiyon' : '') + '</b><span class="small muted">' + S.fmt(o.price) + ' · ort. ' + (Number(i.mins) || S.DEFAULT_MINS) + ' dk</span></span><div class="stepper">' +
              (q ? '<button class="round" data-act="wdec" data-v="' + S.esc(o.key) + '" aria-label="azalt">−</button><span class="q">' + q + '</span>' : '') +
              '<button class="round' + (q ? "" : " round-add") + '" data-act="winc" data-v="' + S.esc(o.key) + '" aria-label="' + S.esc(i.name) + ' ekle">+</button></div></div>'; }).join(""); }).join("") : '<p class="muted">Menü boş.</p>') + '</section>' +
        '<label class="fld" for="wnote"><span>Not</span><input id="wnote" maxlength="120" value="' + S.esc(st.wNote) + '" placeholder="ör. acısız"></label>' +
        '<button class="btn btn-primary btn-lg" data-act="wSend"' + (st.wTable && sel.length && !st.busy ? "" : " disabled") + '>' +
        (st.busy ? "Gönderiliyor…" : !st.wTable ? "Önce masa seçin" : "Masa " + st.wTable + " · mutfağa gönder · " + S.fmt(S.sum(sel))) + '</button></div>';
    }
    function menuTab(){
      var items = menu();
      return '<div class="k-narrow"><div class="pl-box"><div><b>Basılı fiyat listesi</b><span class="small muted">Girişte ve masalarda bulunması zorunlu. Fiyat değiştirdiğinizde yeniden yazdırın.</span></div><button class="btn" data-act="printList">Fiyat listesini yazdır</button></div><div class="pinbox">' +
        (st.pinOk ? '<span>Fiyat ve süre düzenleme açık</span><button class="btn btn-sm" data-act="lock">Kilitle</button>'
                  : '<label for="pin">Fiyat ve süre değiştirmek için patron PIN\'i</label><input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6"><button class="btn btn-sm" data-act="unlock">Aç</button>') + '</div>' +
        '<section class="k-panel">' + (items.length ? items.map(function(i){
          return '<div class="m-row' + (i.out ? " is-out" : "") + '"><div><div class="m-nm">' + S.esc(i.name) + '</div><span class="small muted">' + S.esc(i.cat || "") + '</span></div><div class="m-ctl">' +
            (st.pinOk
              ? '<label class="sr" for="pr-' + S.esc(i.id) + '">Fiyat</label><input class="price-in" id="pr-' + S.esc(i.id) + '" type="number" min="0" inputmode="numeric" value="' + (Number(i.price) || 0) + '"><span class="small muted">₺</span>' +
                '<label class="sr" for="mn-' + S.esc(i.id) + '">Süre</label><input class="price-in" style="width:70px" id="mn-' + S.esc(i.id) + '" type="number" min="1" max="180" inputmode="numeric" value="' + (Number(i.mins) || S.DEFAULT_MINS) + '"><span class="small muted">dk</span>' +
                '<button class="btn btn-sm" data-act="saveItem" data-v="' + S.esc(i.id) + '">Kaydet</button>'
              : '<span class="num" style="font-size:1.15rem">' + S.fmt(i.price) + '</span><span class="small muted">ort. ' + (Number(i.mins) || S.DEFAULT_MINS) + ' dk</span>') +
            '<button class="btn btn-sm ' + (i.out ? "btn-ok" : "btn-bad") + '" data-act="out" data-v="' + S.esc(i.id) + '">' + (i.out ? "Geri aç" : "Tükendi") + '</button></div></div>';
        }).join("") : '<p class="muted">Menü boş. Kurulumdan ürün ekleyin.</p>') + '</section>' +
        (st.pinOk ? '<section class="k-panel"><span class="label">Değişiklik kaydı</span>' + (st.log.length ? '<ul class="log" style="margin-top:8px">' + st.log.map(function(l){ return '<li>' + S.esc(l) + '</li>'; }).join("") + '</ul>' : '<p class="muted small">Henüz değişiklik yok.</p>') + '</section>' : '') + '</div>';
    }
    function pickCafe(){
      var l = st.myCafes || [];
      return '<main class="login"><div class="login-card"><div class="brand-sm">Mars Zeka</div><h1>Kasa ekranı</h1>' +
        (l.length ? '<p class="muted">Hangi işletme?</p>' + l.map(function(c){ return '<a class="btn btn-lg wide" href="kasa.html?k=' + encodeURIComponent(c.id) + '">' + S.esc(c.name || c.id) + '</a>'; }).join("")
                  : '<p class="muted">Bu hesaba bağlı işletme yok. Önce kurulum ekranından işletme oluşturun.</p><a class="btn btn-primary wide" href="kurulum.html">Kuruluma git</a>') +
        '<button class="btn btn-sm btn-ghost" data-act="logout">Çıkış yap</button></div></main>';
    }
    function render(force){
      if (!alive || (!force && S.isEditing())) return;
      var app = S.$("app");
      if (!st.authKnown) { app.innerHTML = '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      if (!st.user) { app.innerHTML = S.loginView("Kasa ekranı", st.loginErr || st.denied); S.bindLogin(B, function(m){ st.loginErr = m; render(true); }); return; }
      if (!cafeId) { app.innerHTML = pickCafe(); return; }
      if (st.denied) { app.innerHTML = '<main class="login"><div class="login-card"><h1>Erişim yok</h1><p class="muted">' + S.esc(st.denied) + '</p><button class="btn wide" data-act="logout">Başka hesapla giriş yap</button></div></main>'; return; }
      if (!st.cafeLoaded || !st.ordLoaded) { app.innerHTML = '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      if (!st.cafe) { app.innerHTML = '<main class="login"><div class="login-card"><h1>İşletme bulunamadı</h1><p class="muted">"' + S.esc(cafeId) + '" kodlu işletme kayıtlı değil.</p></div></main>'; return; }
      app.innerHTML = head() + (S.audioReady ? '' : '<button class="sound-bar" data-act="sound">Sipariş sesini ve ekranın açık kalmasını etkinleştirmek için buraya dokunun</button>') + '<main class="k-wrap">' + alertsHtml() + (st.tab === "siparis" ? ordersTab() : st.tab === "masalar" ? tablesTab() : st.tab === "garson" ? waiterTab() : st.tab === "rapor" ? reportTab() : menuTab()) + '</main>';
    }
    var tick = setInterval(function(){ if (st.tab === "siparis") render(); }, 30000);

    var app = S.$("app");
    app.onfocusout = function(){ if (!st.user) return; setTimeout(function(){ if (!S.isEditing()) render(); }, 0); };
    app.oninput = function(e){ if (e.target.id === "wnote") st.wNote = e.target.value; };
    app.onkeydown = function(e){ if (e.key === "Enter" && e.target.id === "pin") { e.preventDefault(); unlock(); } };
    app.onclick = function(e){
      var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
      var v = b.dataset.v, o = st.orders.find(function(x){ return x.id === v; });
      switch (b.dataset.act) {
        case "tab": st.tab = v; st.pinOk = v === "menu" && st.pinOk; st.openTable = null; st.confirmClose = false; st.moveFrom = null; if (v === "rapor") { loadReport(); return; } break;
        case "repRange": st.repDays = v; loadReport(); return;
        case "printList": S.printPriceList(st.cafe, menu()); return;
        case "moveAsk": st.moveFrom = v; break;
        case "moveNo": st.moveFrom = null; break;
        case "moveTo": { var from = st.moveFrom; st.moveFrom = null;
          B.moveTable(cafeId, String(from), String(v)).then(function(n){ S.toast("Masa " + from + " → Masa " + v + " taşındı (" + n + " sipariş)"); st.openTable = String(v); render(true); }).catch(function(e){ S.toast(S.errText(e)); }); return; }
        case "done": if (o) upd(o, { status: "done", doneAt: Date.now() }); return;
        case "cancelAsk": st.confirmCancel = v; break;
        case "cancelNo": st.confirmCancel = null; break;
        case "cancelYes": st.confirmCancel = null; if (o && o.status === "new") upd(o, { status: "cancelled", cancelledAt: Date.now(), cancelledBy: (st.user && st.user.email) || "" }).then(function(){ S.toast("Masa " + o.table + " siparişi iptal edildi"); }); return;
        case "leftSet": if (o) { var m = Number(b.dataset.m), now = Date.now();
          upd(o, { eta: Math.max(1, Math.round((now - (o.createdAt || now)) / 60000) + m), etaSetAt: now }).then(function(){ S.toast("Masa " + o.table + ": " + m + " dk sonra çıkacak · müşteriye gösterildi"); }); } return;
        case "busy": { var delta = (Number(v) || 0) - S.loadInfo(st.orders, st.cafe).manual;
          st.orders.filter(function(x){ return x.status === "new"; }).forEach(function(x){ upd(x, { eta: Math.max(1, (Number(x.eta) || S.DEFAULT_MINS) + delta) }); }); }
          B.updateCafe(cafeId, { busyExtra: Number(v) || 0 }).then(function(){ S.toast(Number(v) ? "Tüm sürelere +" + v + " dk eklendi" : "Elle ek süre kaldırıldı"); }).catch(function(e){ S.toast(S.errText(e)); }); return;
        case "printBill": { var bl = billLines(v); S.printHtml(S.billHtml(st.cafe, v, bl.lines, bl.total)); return; }
        case "csv": exportCsv(); return;
        case "undo": if (o) upd(o, { status: "new" }); return;
        case "deliver": if (o) S.deliverOnline(B, cafeId, o).then(function(){ S.toast("Online sipariş teslim edildi"); }).catch(function(e){ S.toast(S.errText(e)); }); return;
        case "openTable": st.tab = "masalar"; st.openTable = v; st.confirmClose = false; render(true); var d = S.$("detail"); if (d) d.scrollIntoView({ block: "nearest" }); return;
        case "closeDetail": st.openTable = null; st.confirmClose = false; break;
        case "closeAsk": st.confirmClose = true; break;
        case "closeNo": st.confirmClose = false; break;
        case "closeYes": closeTable(v); return;
        case "gone": clearFlags(v); return;
        case "wFor": st.tab = "garson"; st.wTable = v; st.openTable = null; break;
        case "wTable": st.wTable = v; break;
        case "winc": st.wCart[v] = (st.wCart[v] || 0) + 1; break;
        case "wdec": if (st.wCart[v]) { st.wCart[v]--; if (!st.wCart[v]) delete st.wCart[v]; } break;
        case "wSend": sendWaiter(); return;
        case "out": { var items = menu().map(function(x){ return Object.assign({}, x, x.id === v ? { out: !x.out } : {}); }), it = items.find(function(x){ return x.id === v; });
          saveMenu(items, it.out ? it.name + " tükendi, menüden kalktı" : it.name + " tekrar menüde"); return; }
        case "unlock": unlock(); return;
        case "lock": st.pinOk = false; break;
        case "saveItem": saveItem(v); return;
        case "logout": B.logout(); return;
        case "sound": S.beep(1, 660); break;
      }
      render(true);
    };
    S.onAudioReady(function(){ S.keepAwake(); if (st.user && !S.isEditing()) render(true); });
    var onVis = function(){ if (document.visibilityState === "visible") S.keepAwake(); };
    document.addEventListener("visibilitychange", onVis);
    return function(){ alive = false; clearInterval(tick); document.removeEventListener("visibilitychange", onVis); unsubs.forEach(function(u){ try { u(); } catch(e){} }); };
  };
})();
