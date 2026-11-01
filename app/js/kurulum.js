/* Mars Zeka — kurulum ekranı: işletme, menü (fotoğraf + süre), masa QR kartları, hesaplar. */
(function(){
  "use strict";
  window.SiralaApp = window.SiralaApp || {};
  var SAMPLE = [
    ["Başlangıçlar","Mercimek çorbası",95,8,"Limon ve kırmızı biberli tereyağı ile",0,230,"300 ml"],
    ["Başlangıçlar","Çibörek",120,12,"İnce hamur, kıymalı iç, kızgın yağda",0,380,"1 adet, 70 gr kıyma"],
    ["Ana yemekler","Adana kebap",360,20,"Zırh kıyması, közlenmiş biber ve domates",520,650,"180 gr et"],
    ["Ana yemekler","Balaban kebap",340,18,"Közde köfte, tereyağlı ekmek, yoğurt",490,700,"200 gr köfte"],
    ["Ana yemekler","Tavuk şiş",290,16,"Marine edilmiş but, lavaş, sumaklı soğan",420,480,"200 gr tavuk"],
    ["Ana yemekler","Kuzu şiş",420,22,"Kuzu kuşbaşı, közlenmiş sebze",0,620,"180 gr kuzu eti"],
    ["Tatlılar","Künefe",180,14,"Antep fıstıklı, sıcak servis",0,520,"180 gr"],
    ["Tatlılar","Met helvası",110,5,"Eskişehir'e özgü, tahinli",0,290,"100 gr"],
    ["İçecekler","Ayran",45,2,"",0,110,"300 ml"],["İçecekler","Şalgam",50,2,"",0,25,"330 ml"],["İçecekler","Türk kahvesi",80,7,"",0,10,"1 fincan"]
  ];

  var SAMPLE_ALG = {"Mercimek çorbası":["sut","kereviz"],"Çibörek":["gluten"],"Adana kebap":["gluten"],"Balaban kebap":["gluten","sut"],"Tavuk şiş":["gluten","sut"],"Kuzu şiş":[],"Künefe":["gluten","sut","kuruyemis"],"Met helvası":["gluten","susam"],"Ayran":["sut"],"Şalgam":[],"Türk kahvesi":[]};

  window.SiralaApp.kurulum = function(ctx){
    var B = ctx.B, cafeId = ctx.cafeId;
    var st = { user: null, authKnown: false, loginErr: null, myCafes: null, cafe: null, cafeLoaded: false, denied: false,
      photos: {}, open: 0, draft: null, dirty: false, creating: false, confirmPurge: false };
    var alive = true, unsubs = [];
    var menu = function(){ return (st.cafe && Array.isArray(st.cafe.menu)) ? st.cafe.menu : []; };
    var nTables = function(){ return Math.max(1, Math.min(80, Number(st.cafe && st.cafe.tables) || 10)); };

    B.onAuth(function(u){
      if (!alive) return;
      st.user = u && u.staff ? u : null; st.authKnown = true;
      unsubs.forEach(function(x){ try { x(); } catch(e){} }); unsubs = [];
      if (!st.user) { render(true); return; }
      if (!cafeId) { B.listMyCafes(st.user.email).then(function(l){ st.myCafes = l; render(true); }); return; }
      unsubs.push(B.watchCafe(cafeId, function(d){
        st.cafe = d; st.cafeLoaded = true;
        st.denied = !!(d && B.kind === "firebase" && (d.staffEmails || []).indexOf(st.user.email) < 0);
        render();
      }));
      unsubs.push(B.watchPhotos(cafeId, function(m){ st.photos = m; render(); }));
      unsubs.push(B.watchOrders(cafeId, null, function(l){ st.open = l.length; render(); }));
    });

    /* ---------- işlemler ---------- */
    function createCafe(){
      var name = ((S.$("nc-name") || {}).value || "").trim().slice(0, 40);
      var id = S.slugify((S.$("nc-id") || {}).value || name);
      var pin = ((S.$("nc-pin") || {}).value || "").replace(/\D/g, "");
      if (!name) { S.toast("İşletme adını yazın"); return; }
      if (id.length < 3) { S.toast("İşletme kodu en az 3 harf olmalı"); return; }
      if (pin.length < 4 || pin.length > 6) { S.toast("PIN 4-6 haneli rakam olmalı"); return; }
      st.creating = true; render(true);
      B.cafeExists(id).then(function(ex){
        if (ex) throw { code: "exists" };
        return B.createCafe(id, { name: name, tables: 10, menu: [], staffEmails: [st.user.email], createdAt: Date.now() });
      }).then(function(){ return S.sha256(id + ":" + pin); }).then(function(h){ return B.setPrivate(id, { pinHash: h, log: [] }); })
        .then(function(){ location.href = ctx.setupHref(id); })
        .catch(function(e){ S.toast(e && e.code === "exists" ? "Bu kod kullanılıyor, başka bir kod yazın" : S.errText(e)); st.creating = false; render(true); });
    }
    function ensureDraft(){ if (!st.draft) st.draft = menu().map(function(x){ return Object.assign({}, x); }); }
    function markDirty(){
      if (st.dirty) return; st.dirty = true;
      var b = document.querySelector('[data-act="saveMenu"]'); if (b) b.disabled = false;
      var p = S.$("dirty"); if (p) p.hidden = false;
    }
    /* Menü dosyası (Mars Zeka menü dosyası, .json): aynı adlı ürünler güncellenir, yeniler eklenir; fotoğraflar korunur. */
    function algKey(a){ var s = String(a || "").trim().toLocaleLowerCase("tr-TR"); var f = S.ALLERGENS.find(function(z){ return z[0] === s || z[1].toLocaleLowerCase("tr-TR") === s; }); return f ? f[0] : null; }
    function normI18n(c){ var o = {}; Object.keys(c || {}).forEach(function(l){ var v = c[l] || {}; if (["en","es","de","ru","zh"].indexOf(l) < 0) return; o[l] = { name: String(v.ad || v.name || "").slice(0, 60), desc: String(v.aciklama || v.desc || "").slice(0, 120) }; }); return o; }
    function importMenu(file){
      file.text().then(function(txt){
        var j = JSON.parse(txt), list = j && (j.urunler || j.items);
        if (!Array.isArray(list) || !list.length) throw new Error("bos");
        ensureDraft(); var added = 0, updated = 0;
        list.forEach(function(r){
          var name = String(r.ad || r.name || "").trim(); if (!name) return;
          var item = {
            name: name, cat: String(r.kategori || r.cat || "Diğer").trim(), price: Number(r.fiyat != null ? r.fiyat : r.price) || 0, p15: Number(r.fiyat15 != null ? r.fiyat15 : r.p15) || 0,
            mins: Number(r.sure != null ? r.sure : r.mins) || S.DEFAULT_MINS, desc: String(r.aciklama || r.desc || ""), amount: String(r.porsiyon || r.amount || ""), kcal: Number(r.kalori != null ? r.kalori : r.kcal) || 0,
            allergens: (r.alerjenler || r.allergens || []).map(algKey).filter(Boolean), i18n: normI18n(r.ceviri || r.i18n)
          };
          var ex = st.draft.find(function(x){ return String(x.name).trim().toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"); });
          if (ex) { Object.assign(ex, item); updated++; } else { item.id = S.newId(); item.out = false; st.draft.push(item); added++; }
        });
        if (j.kategoriCeviri || j.catI18n) st.catI18n = Object.assign({}, (st.cafe && st.cafe.catI18n) || {}, j.kategoriCeviri || j.catI18n);
        st.dirty = true; render(true);
        S.toast((added ? added + " ürün eklendi" : "") + (added && updated ? ", " : "") + (updated ? updated + " ürün güncellendi" : "") + ". Kontrol edip Menüyü kaydet'e bas.");
      }).catch(function(){ S.toast("Bu dosya bir Mars Zeka menü dosyası değil."); });
    }
    function saveMenu(){
      if (!st.draft) return;
      var clean = st.draft.map(function(x){ return {
        id: x.id || S.newId(), name: String(x.name || "").trim().slice(0, 48), cat: String(x.cat || "").trim().slice(0, 30) || "Diğer",
        price: Math.max(0, Math.round(Number(x.price) || 0)), p15: Math.max(0, Math.round(Number(x.p15) || 0)), kcal: Math.max(0, Math.round(Number(x.kcal) || 0)), mins: Math.max(1, Math.min(180, Math.round(Number(x.mins) || S.DEFAULT_MINS))),
        desc: String(x.desc || "").trim().slice(0, 90), model: String(x.model || "").trim().slice(0, 300), amount: String(x.amount || "").trim().slice(0, 40),
        allergens: (x.allergens || []).filter(function(a){ return S.ALLERGENS.some(function(z){ return z[0] === a; }); }), out: !!x.out,
        i18n: x.i18n && typeof x.i18n === "object" ? x.i18n : {}
      }; }).filter(function(x){ return x.name; });
      var patch = { menu: clean }; if (st.catI18n) patch.catI18n = st.catI18n;
      B.updateCafe(cafeId, patch).then(function(){ st.draft = null; st.dirty = false; st.catI18n = null; S.toast("Menü kaydedildi, telefonlara yansıdı"); render(true); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function uploadPhoto(itemId, file){
      S.toast("Fotoğraf yükleniyor…");
      S.shrinkPhoto(file).then(function(data){ return B.setPhoto(cafeId, itemId, data); })
        .then(function(){ S.toast("Fotoğraf eklendi"); })
        .catch(function(e){ S.toast(e && /image/.test(e.message) ? "Bu dosya bir fotoğraf değil" : S.errText(e)); });
    }
    function saveInfo(){
      var name = ((S.$("cf-name") || {}).value || "").trim().slice(0, 40) || "İşletme";
      var tables = Math.max(1, Math.min(80, parseInt((S.$("cf-tables") || {}).value, 10) || 10));
      B.updateCafe(cafeId, { name: name, tables: tables }).then(function(){ S.toast("Kaydedildi"); render(true); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function savePin(){
      var pin = ((S.$("cf-pin") || {}).value || "").replace(/\D/g, "");
      if (pin.length < 4 || pin.length > 6) { S.toast("PIN 4-6 haneli rakam olmalı"); return; }
      S.sha256(cafeId + ":" + pin).then(function(h){ return B.setPrivate(cafeId, { pinHash: h }); }).then(function(){ S.$("cf-pin").value = ""; S.toast("PIN değiştirildi"); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function saveStaff(){
      var raw = ((S.$("cf-staff") || {}).value || "").split(/[\s,;]+/).map(function(s){ return s.trim().toLowerCase(); }).filter(function(s){ return /.+@.+\..+/.test(s); });
      var list = []; raw.forEach(function(e){ if (list.indexOf(e) < 0) list.push(e); });
      if (list.indexOf(st.user.email) < 0) list.unshift(st.user.email);
      B.updateCafe(cafeId, { staffEmails: list }).then(function(){ S.toast("Hesaplar kaydedildi"); }).catch(function(e){ S.toast(S.errText(e)); });
    }
    function purge(){ B.purgeClosed(cafeId).then(function(n){ S.toast(n + " kapanmış sipariş silindi"); }).catch(function(e){ S.toast(S.errText(e)); }); }
    function downloadQR(){
      if (!window.QRCode) { S.toast("QR kütüphanesi yüklenemedi"); return; }
      var name = st.cafe.name || "", keys = []; for (var t = 1; t <= nTables(); t++) keys.push(t);
      var cols = 3, cw = 700, ch = 940, pad = 50, rows = Math.ceil(keys.length / cols);
      var c = document.createElement("canvas"); c.width = cols * cw + pad * 2; c.height = rows * ch + pad * 2;
      var x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
      var tmp = document.createElement("div"); tmp.style.cssText = "position:absolute;left:-9999px;top:0"; document.body.appendChild(tmp);
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(function(){
        keys.forEach(function(t, idx){
          var cx = pad + (idx % cols) * cw, cy = pad + Math.floor(idx / cols) * ch, mid = cx + cw / 2, mw = cw - 110;
          x.fillStyle = "#FFF8EC"; x.fillRect(cx + 14, cy + 14, cw - 28, ch - 28);
          x.strokeStyle = "#9D0208"; x.lineWidth = 3; x.strokeRect(cx + 30, cy + 30, cw - 60, ch - 60); x.lineWidth = 1.5; x.strokeRect(cx + 42, cy + 42, cw - 84, ch - 84);
          x.textAlign = "center"; x.fillStyle = "#3A0A0A"; x.font = "700 50px 'Cormorant Garamond', Georgia, serif"; x.fillText(name, mid, cy + 130, mw);
          x.fillStyle = "#9D0208"; x.font = "italic 600 88px 'Cormorant Garamond', Georgia, serif"; x.fillText("Masa " + t, mid, cy + 235, mw);
          tmp.innerHTML = "";
          new window.QRCode(tmp, { text: ctx.qrUrl(t), width: 440, height: 440, colorDark: "#3A0A0A", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M });
          var qc = tmp.querySelector("canvas"); x.fillStyle = "#FFFFFF"; x.fillRect(cx + 120, cy + 280, 460, 460); if (qc) x.drawImage(qc, cx + 130, cy + 290, 440, 440);
          x.fillStyle = "#6E4A42"; x.font = "500 26px Jost, system-ui, sans-serif"; x.fillText("OKUTUN  ·  SEÇİN  ·  AFİYET OLSUN", mid, cy + 800, mw);
          x.font = "italic 500 30px 'Cormorant Garamond', Georgia, serif"; x.fillText("Garsonumuz da her zaman yanınızda", mid, cy + 850, mw);
        });
        tmp.remove();
        c.toBlob(function(blob){ if (!blob) { S.toast("Görsel oluşturulamadı"); return; } ctx.download(blob, (cafeId || "masa") + "-qr-kartlari.png"); }, "image/png");
      });
    }

    /* ---------- görünüm ---------- */
    function top(){
      return '<header class="s-head"><div class="s-wrap s-head-in"><a class="brand-sm" href="' + S.esc(ctx.setupHref("")) + '">Mars Zeka · Kurulum</a>' +
        '<div class="s-head-r">' + (B.kind === "firebase" ? '<span class="small">' + S.esc(st.user.email) + '</span><button class="btn btn-sm" data-act="logout">Çıkış</button>' : '<span class="small">Demo</span>') + '</div></div></header>';
    }
    function listView(){
      var l = st.myCafes || [];
      return top() + '<main class="s-wrap s-main"><section class="s-sec"><h1 style="font-size:2.4rem">İşletmeleriniz</h1>' +
        (l.length ? '<div class="pick-grid">' + l.map(function(c){ return '<a class="pick-card" href="' + S.esc(ctx.setupHref(c.id)) + '"><b>' + S.esc(c.name || c.id) + '</b><span class="small muted">' + S.esc(c.id) + '</span></a>'; }).join("") + '</div>' : '<p class="muted">Henüz işletme yok. İlkini aşağıdan oluşturun.</p>') + '</section>' +
        '<section class="s-sec"><h2>Yeni işletme</h2><div class="form-row">' +
        '<label class="fld" for="nc-name"><span>İşletme adı</span><input id="nc-name" maxlength="40" placeholder="Kuzey Sofrası"></label>' +
        '<label class="fld" for="nc-id"><span>İşletme kodu (QR bağlantısında görünür)</span><input id="nc-id" maxlength="40" placeholder="kuzey-sofrasi"></label>' +
        '<label class="fld fld-s" for="nc-pin"><span>Patron PIN\'i</span><input id="nc-pin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="4-6 rakam"></label>' +
        '<button class="btn btn-primary" data-act="create"' + (st.creating ? " disabled" : "") + '>' + (st.creating ? "Oluşturuluyor…" : "Oluştur") + '</button></div>' +
        '<p class="note">PIN, kasada fiyat ve süre değiştirmek için istenir.</p></section></main>';
    }
    function photoHtml(it){ var p = st.photos[it.id]; return p ? '<img src="' + S.esc(p) + '" alt="">' : S.placeholder(it.name || "?"); }
    function cafeView(){
      var d = st.draft || menu(), cats = []; d.forEach(function(x){ if (x.cat && cats.indexOf(x.cat) < 0) cats.push(x.cat); });
      var qr = []; for (var t = 1; t <= nTables(); t++) qr.push('<div class="qr-card"><div class="qr-in"><span class="qr-cafe">' + S.esc(st.cafe.name) + '</span><span class="qr-label">Masa ' + t + '</span><div class="qr-img" data-qr="' + S.esc(ctx.qrUrl(t)) + '" role="img" aria-label="Masa ' + t + ' QR kodu"></div><span class="qr-hint">Okutun · seçin · afiyet olsun</span>' + (ctx.tryHref ? '<a class="btn btn-sm no-print" style="margin-top:6px" href="' + S.esc(ctx.tryHref(t)) + '">Bu masayı dene</a>' : '') + '</div></div>');
      return top() + '<main class="s-wrap s-main">' +
        '<section class="s-hero"><div><span class="label">İşletme kodu · ' + S.esc(cafeId) + '</span><h1>' + S.esc(st.cafe.name) + '</h1><p class="muted">' + menu().length + ' ürün · ' + nTables() + ' masa · ' + st.open + ' açık sipariş</p></div>' +
        '<div class="row-btns"><a class="btn btn-primary btn-lg" href="' + S.esc(ctx.kasaHref) + '">Kasa ekranını aç</a>' + (ctx.garsonHref ? '<a class="btn btn-lg" href="' + S.esc(ctx.garsonHref) + '">Garson uygulaması</a>' : '') + (ctx.tryHref ? '<a class="btn btn-lg" href="' + S.esc(ctx.tryHref(1)) + '">Müşteri ekranını dene</a>' : '') + '</div></section>' +

        '<section class="s-sec no-print"><div class="s-sec-head"><h2>Menü</h2><span class="chip" id="dirty"' + (st.dirty ? "" : " hidden") + '>Kaydedilmedi</span>' +
        '<button class="btn" data-act="printList"' + (st.dirty ? ' disabled title="Önce menüyü kaydedin"' : '') + '>Fiyat listesini yazdır</button></div>' +
        '<p class="note">Fotoğrafa dokunup yükleyin (telefondan çekilen fotoğraf olur, küçültülür). Süre: ortalama çıkma süresi (dk). Porsiyon miktarı: "180 gr et", "300 ml" gibi; 1,5 porsiyonda gram ve kalori kendiliğinden 1,5 katı gösterilir. Boş bırakılan alan menüde görünmez. Ürünlerin menüdeki sırasını ↑ ↓ ile değiştirebilirsiniz; kategoriler ilk ürünlerinin sırasıyla görünür.</p><div class="ed-list">' +
        (d.length ? d.map(function(it, i){
          var algs = it.allergens || [];
          return '<div class="ed"><div class="ed-left"><label class="ed-photo" for="ph-' + i + '">' + photoHtml(it) + '<span>' + (st.photos[it.id] ? "Değiştir" : "Fotoğraf ekle") + '</span><input id="ph-' + i + '" type="file" accept="image/*" data-photo="' + S.esc(it.id) + '" data-i="' + i + '"></label>' +
            (st.photos[it.id] ? '<button class="ed-mini" data-act="delPhoto" data-v="' + S.esc(it.id) + '">Fotoğrafı kaldır</button>' : '') +
            '<div class="ed-move"><button class="ed-mini" data-act="up" data-v="' + i + '" aria-label="Yukarı taşı"' + (i === 0 ? " disabled" : "") + '>↑</button><button class="ed-mini" data-act="down" data-v="' + i + '" aria-label="Aşağı taşı"' + (i === d.length - 1 ? " disabled" : "") + '>↓</button></div></div>' +
            '<div class="ed-fields">' +
            '<label class="fld fld-name"><span>Ürün</span><input data-mf="' + i + '.name" maxlength="48" value="' + S.esc(it.name) + '"></label>' +
            '<label class="fld"><span>Kategori</span><input list="cats" data-mf="' + i + '.cat" maxlength="30" value="' + S.esc(it.cat || "") + '"></label>' +
            '<label class="fld"><span>Fiyat ₺</span><input type="number" min="0" inputmode="numeric" data-mf="' + i + '.price" value="' + (Number(it.price) || 0) + '"></label>' +
            '<label class="fld"><span>1,5 pors. ₺</span><input type="number" min="0" inputmode="numeric" placeholder="yok" data-mf="' + i + '.p15" value="' + (Number(it.p15) > 0 ? Number(it.p15) : "") + '"></label>' +
            '<label class="fld fld-amt"><span>Porsiyon miktarı</span><input data-mf="' + i + '.amount" maxlength="40" placeholder="ör. 180 gr et" value="' + S.esc(it.amount || "") + '"></label>' +
            '<label class="fld"><span>Kalori kcal</span><input type="number" min="0" inputmode="numeric" placeholder="—" data-mf="' + i + '.kcal" value="' + (Number(it.kcal) > 0 ? Number(it.kcal) : "") + '"></label>' +
            '<label class="fld"><span>Süre dk</span><input type="number" min="1" max="180" inputmode="numeric" data-mf="' + i + '.mins" value="' + (Number(it.mins) || S.DEFAULT_MINS) + '"></label>' +
            '<label class="fld fld-desc"><span>3D model linki (.glb, isteğe bağlı)</span><input data-mf="' + i + '.model" maxlength="300" placeholder="ör. models/adana.glb" value="' + S.esc(it.model || "") + '"></label>' +
            '<label class="fld fld-desc"><span>Kısa açıklama</span><input data-mf="' + i + '.desc" maxlength="90" value="' + S.esc(it.desc || "") + '"></label>' +
            '<fieldset class="fld-desc alg-edit"><legend>Alerjenler</legend>' + S.ALLERGENS.map(function(a){ return '<label><input type="checkbox" data-alg="' + i + '.' + a[0] + '"' + (algs.indexOf(a[0]) >= 0 ? " checked" : "") + '>' + S.esc(a[1]) + '</label>'; }).join("") + '</fieldset>' +
            '<button class="btn btn-sm btn-bad del" data-act="delRow" data-v="' + i + '">Sil</button></div></div>';
        }).join("") : '<p class="muted">Menü boş. "Ürün ekle" ile başlayın ya da örnek menüyü yükleyin.</p>') +
        '</div><datalist id="cats">' + cats.map(function(c){ return '<option value="' + S.esc(c) + '"></option>'; }).join("") + '</datalist>' +
        '<div class="row-btns"><button class="btn" data-act="addRow">Ürün ekle</button>' + (d.length ? '' : '<button class="btn" data-act="sample">Örnek menüyü yükle</button>') +
          '<label class="btn" for="menuFile" style="position:relative">Menüyü dosyadan yükle<input id="menuFile" type="file" accept="application/json,.json" style="position:absolute;width:1px;height:1px;opacity:0"></label>' +
        '<button class="btn btn-primary" data-act="saveMenu"' + (st.dirty ? "" : " disabled") + '>Menüyü kaydet</button></div></section>' +

        '<section class="s-sec"><div class="s-sec-head"><h2>Masa QR kartları</h2><div class="row-btns no-print"><button class="btn" data-act="dlqr">PNG olarak indir</button>' + (ctx.canPrint ? '<button class="btn" data-act="print">Yazdır</button>' : '') + '</div></div>' +
        '<div class="qr-grid">' + qr.join("") + '</div></section>' +

        '<section class="s-sec no-print"><h2>İşletme bilgileri</h2><div class="form-row">' +
        '<label class="fld" for="cf-name"><span>İşletme adı</span><input id="cf-name" maxlength="40" value="' + S.esc(st.cafe.name || "") + '"></label>' +
        '<label class="fld fld-s" for="cf-tables"><span>Masa sayısı</span><input id="cf-tables" type="number" min="1" max="80" inputmode="numeric" value="' + nTables() + '"></label>' +
        '<button class="btn btn-primary" data-act="saveInfo">Kaydet</button></div>' +
        '<div class="form-row"><label class="fld fld-s" for="cf-pin"><span>Yeni patron PIN\'i</span><input id="cf-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="4-6 rakam"></label><button class="btn" data-act="savePin">PIN\'i değiştir</button></div></section>' +

        (B.kind === "firebase" ? '<section class="s-sec no-print"><h2>Kasa hesapları</h2><p class="note">Kasa ve kurulum ekranına girebilecek e-postalar, her satıra bir tane. Hesapları Firebase konsolundan oluşturursunuz (README, Adım 3).</p>' +
          '<div class="form-row"><label class="fld" for="cf-staff"><span>E-postalar</span><textarea id="cf-staff" rows="3">' + S.esc((st.cafe.staffEmails || []).join("\n")) + '</textarea></label><button class="btn btn-primary" data-act="saveStaff">Kaydet</button></div></section>' : '') +

        '<section class="s-sec s-danger no-print"><h2>Eski siparişleri temizle</h2><p class="note">Hesabı kapatılmış masaların siparişlerini siler. Açık masalara dokunmaz. Haftada bir yapmanız yeterli.</p>' +
        (st.confirmPurge ? '<div class="row-btns"><button class="btn btn-bad" data-act="purgeYes">Evet, sil</button><button class="btn" data-act="purgeNo">Vazgeç</button></div>' : '<div class="row-btns"><button class="btn btn-bad" data-act="purge">Kapanmış siparişleri sil</button></div>') +
        '</section></main>';
    }
    function render(force){
      if (!alive || (!force && S.isEditing())) return;
      var app = S.$("app");
      if (!st.authKnown) { app.innerHTML = '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      if (!st.user) { app.innerHTML = S.loginView("Kurulum", st.loginErr); S.bindLogin(B, function(m){ st.loginErr = m; render(true); }); return; }
      if (!cafeId) { app.innerHTML = listView(); return; }
      if (!st.cafeLoaded) { app.innerHTML = top() + '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      if (!st.cafe) { app.innerHTML = top() + '<main class="s-wrap s-main"><div class="empty-card"><h2>İşletme bulunamadı</h2><p>"' + S.esc(cafeId) + '" kodlu işletme yok.</p></div></main>'; return; }
      if (st.denied) { app.innerHTML = top() + '<main class="s-wrap s-main"><div class="empty-card"><h2>Erişim yok</h2><p>' + S.esc(st.user.email) + ' bu işletmenin hesapları arasında değil.</p></div></main>'; return; }
      app.innerHTML = cafeView();
      app.querySelectorAll("[data-qr]").forEach(function(el){
        if (!window.QRCode) { el.innerHTML = '<span class="small muted">QR yüklenemedi</span>'; return; }
        try { new window.QRCode(el, { text: el.dataset.qr, width: 140, height: 140, colorDark: "#3A0A0A", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M }); } catch(e){}
      });
    }

    var app = S.$("app");
    app.onfocusout = function(){ setTimeout(function(){ if (!S.isEditing()) render(); }, 0); };
    app.oninput = function(e){
      var t = e.target;
      if (t.id === "nc-name") { var idf = S.$("nc-id"); if (idf && !idf.dataset.touched) idf.value = S.slugify(t.value); return; }
      if (t.id === "nc-id") { t.dataset.touched = "1"; return; }
      if (!t.dataset || !t.dataset.mf) return;
      ensureDraft();
      var p = t.dataset.mf.split("."), it = st.draft[Number(p[0])]; if (!it) return;
      it[p[1]] = (p[1] === "price" || p[1] === "mins" || p[1] === "p15" || p[1] === "kcal") ? Math.max(0, Number(t.value) || 0) : t.value;
      markDirty();
    };
    app.onchange = function(e){
      var t = e.target;
      if (t.dataset && t.dataset.alg) {
        ensureDraft(); var p = t.dataset.alg.split("."), it = st.draft[Number(p[0])]; if (!it) return;
        var l = (it.allergens || []).filter(function(a){ return a !== p[1]; }); if (t.checked) l.push(p[1]); it.allergens = l; markDirty(); return;
      }
      if (t.id === "menuFile" && t.files && t.files[0]) { var mf = t.files[0]; t.value = ""; importMenu(mf); return; }
      if (!t.dataset || !t.dataset.photo || !t.files || !t.files[0]) return;
      if (st.draft && st.draft[Number(t.dataset.i)] && !menu().some(function(m){ return m.id === t.dataset.photo; })) markDirty();
      uploadPhoto(t.dataset.photo, t.files[0]); t.value = "";
    };
    app.onclick = function(e){
      var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
      var v = b.dataset.v;
      switch (b.dataset.act) {
        case "logout": B.logout(); return;
        case "create": createCafe(); return;
        case "addRow": ensureDraft(); var last = st.draft[st.draft.length - 1];
          st.draft.push({ id: S.newId(), name: "", cat: last ? last.cat : "", price: 0, mins: S.DEFAULT_MINS, desc: "", out: false });
          st.dirty = true; render(true);
          setTimeout(function(){ var ins = document.querySelectorAll('[data-mf$=".name"]'), l = ins[ins.length - 1]; if (l) l.focus(); }, 0); return;
        case "sample": st.draft = SAMPLE.map(function(r){ return { id: S.newId(), cat: r[0], name: r[1], price: r[2], mins: r[3], desc: r[4], p15: r[5] || 0, kcal: r[6] || 0, amount: r[7] || "", allergens: SAMPLE_ALG[r[1]] || [], out: false }; }); st.dirty = true; break;
        case "delRow": ensureDraft(); st.draft.splice(Number(v), 1); st.dirty = true; break;
        case "up": case "down": { ensureDraft(); var i = Number(v), j = b.dataset.act === "up" ? i - 1 : i + 1; if (j < 0 || j >= st.draft.length) return;
          var tmp = st.draft[i]; st.draft[i] = st.draft[j]; st.draft[j] = tmp; st.dirty = true; break; }
        case "delPhoto": B.setPhoto(cafeId, v, null).then(function(){ S.toast("Fotoğraf kaldırıldı"); }).catch(function(e){ S.toast(S.errText(e)); }); return;
        case "saveMenu": saveMenu(); return;
        case "saveInfo": saveInfo(); return;
        case "savePin": savePin(); return;
        case "saveStaff": saveStaff(); return;
        case "dlqr": downloadQR(); return;
        case "printList":
          if (ctx.canPrint) S.printPriceList(st.cafe, menu());
          else ctx.download(new Blob([S.priceListHtml(st.cafe, menu())], { type: "text/html" }), (cafeId || "isletme") + "-fiyat-listesi.html");
          return;
        case "print": window.print(); return;
        case "purge": st.confirmPurge = true; break;
        case "purgeNo": st.confirmPurge = false; break;
        case "purgeYes": st.confirmPurge = false; purge(); break;
      }
      render(true);
    };
    return function(){ alive = false; unsubs.forEach(function(u){ try { u(); } catch(e){} }); };
  };
})();
