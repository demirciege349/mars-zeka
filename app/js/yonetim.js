/* Mars Zeka — yönetim ekranı (sistemi kuran kişi için): tüm işletmeler tek listede, yeni işletme + patron hesabı açma.
   Her işletmenin verisi kendi kodu altında ayrı durur (cafes/{kod}); bir işletmenin çalışanı diğerini göremez. */
(function(){
  "use strict";
  window.SiralaApp = window.SiralaApp || {};

  window.SiralaApp.yonetim = function(ctx){
    var B = ctx.B;
    var st = { user: null, authKnown: false, admin: null, loginErr: null, cafes: null, stats: {}, form: { name: "", code: "", tables: "12", owner: "", user: "", pass: "" }, err: null, busy: false, made: null };
    var alive = true;

    B.onAuth(function(u){
      if (!alive) return;
      st.user = u && u.staff ? u : null; st.authKnown = true; st.admin = null; st.cafes = null;
      if (!st.user) { render(); return; }
      B.isAdmin(st.user.email).then(function(ok){ st.admin = ok; render(); if (ok) refresh(); });
    });

    function refresh(){
      B.listAllCafes().then(function(l){
        st.cafes = l.sort(function(a, b){ return String(a.name).localeCompare(String(b.name), "tr"); }); render();
        var d0 = new Date(); d0.setHours(0, 0, 0, 0);
        l.forEach(function(c){
          B.listOrders(c.id, d0.getTime()).then(function(os){
            var ok = os.filter(function(o){ return o.status !== "cancelled"; });
            st.stats[c.id] = { n: ok.length, sum: ok.reduce(function(s, o){ return s + (Number(o.total) || S.sum(o.items)); }, 0), online: ok.filter(function(o){ return o.source === "online"; }).length };
            render();
          }).catch(function(){});
        });
      }).catch(function(e){ S.toast(S.errText(e)); });
    }

    function create(){
      var f = st.form, code = S.slugify(f.code || f.name), user = f.user.trim().toLocaleLowerCase("tr-TR");
      st.err = !f.name.trim() ? "İşletme adını yazın." : code.length < 3 ? "İşletme kodu en az 3 karakter olmalı." : !(Number(f.tables) >= 1 && Number(f.tables) <= 80) ? "Masa sayısı 1–80 arası olmalı." :
        !f.owner.trim() ? "Patronun adını yazın." : !S.USER_RE.test(user) ? "Kullanıcı adı 3–20 karakter; harf, rakam, nokta, tire." : f.pass.length < 6 ? "Şifre en az 6 karakter olmalı." : null;
      if (st.err) { render(); return; }
      st.busy = true; render();
      B.createBusiness(code, { name: f.name.trim(), tables: Number(f.tables), menu: [], onlineOpen: true, delivery: true, zones: {}, createdAt: Date.now() },
        { email: S.userEmail(code, user), password: f.pass, name: f.owner.trim() })
        .then(function(){ st.made = { name: f.name.trim(), code: code, user: user, pass: f.pass }; st.form = { name: "", code: "", tables: "12", owner: "", user: "", pass: "" }; refresh(); })
        .catch(function(e){ st.err = S.errText(e); })
        .then(function(){ st.busy = false; render(); });
    }

    function link(label, href){ return href ? '<a class="btn btn-sm" href="' + S.esc(href) + '" target="_blank" rel="noopener">' + label + '</a>' : ''; }
    function render(){
      if (!alive || S.isEditing()) return;
      var app = S.$("app"), L = ctx.links || function(){ return {}; };
      if (!st.authKnown) { app.innerHTML = '<p class="muted center" style="padding:40px">Yükleniyor…</p>'; return; }
      if (!st.user) { app.innerHTML = S.loginView("Yönetim girişi", st.loginErr, "", ctx.loginHint || "", true); S.bindLogin(B, function(m){ st.loginErr = m; render(); }); return; }
      if (st.admin === null) { app.innerHTML = '<p class="muted center" style="padding:40px">Kontrol ediliyor…</p>'; return; }
      if (!st.admin) { app.innerHTML = '<main class="login"><div class="login-card"><h1>Yönetici değil</h1><p class="muted">' + S.esc(S.userName(st.user.email)) + ' hesabı yönetim ekranını açamaz.</p><button class="btn wide" data-act="logout">Başka hesapla giriş yap</button></div></main>'; return; }
      var cafes = st.cafes || [], tot = { n: 0, sum: 0 };
      cafes.forEach(function(c){ var x = st.stats[c.id]; if (x) { tot.n += x.n; tot.sum += x.sum; } });
      var f = st.form;
      app.innerHTML = '<div class="y-app"><header class="g-head"><div><span class="g-kick">Mars Zeka</span><b>Yönetim</b></div><button class="g-who" data-act="logout">Çıkış</button></header><main class="g-main">' +
        '<div class="g-tiles"><div class="g-tile big"><span>Bugün · tüm işletmeler</span><b>' + S.fmt(tot.sum) + '</b><small>' + tot.n + ' sipariş · ' + cafes.length + ' işletme</small></div></div>' +
        (st.made ? '<section class="y-made"><b>' + S.esc(st.made.name) + ' açıldı</b><p>Patrona bu bilgileri verin:</p><dl><dt>İşletme kodu</dt><dd>' + S.esc(st.made.code) + '</dd><dt>Kullanıcı adı</dt><dd>' + S.esc(st.made.user) + '</dd><dt>Şifre</dt><dd>' + S.esc(st.made.pass) + '</dd></dl>' +
          '<div class="row-btns">' + link("Menüyü kur", L(st.made.code).kurulum) + link("Çalışan uygulaması", L(st.made.code).garson) + '</div><button class="btn btn-sm btn-ghost" data-act="madeOk">Tamam</button></section>' : '') +
        '<h3 class="g-cat">İşletmeler</h3>' + (st.cafes === null ? '<p class="muted">Yükleniyor…</p>' : cafes.length ? cafes.map(function(c){
          var x = st.stats[c.id], lk = L(c.id), staffN = Object.keys(c.staff || {}).length;
          return '<article class="y-cafe"><div class="g-r-top"><b>' + S.esc(c.name) + '</b><small>kod: ' + S.esc(c.id) + '</small></div>' +
            '<div class="y-nums"><span><b>' + (x ? S.fmt(x.sum) : "…") + '</b> bugün</span><span><b>' + (x ? x.n : "…") + '</b> sipariş' + (x && x.online ? ' · ' + x.online + ' online' : '') + '</span><span><b>' + (c.tables || 0) + '</b> masa · ' + staffN + ' çalışan</span>' +
            '<span class="g-chip ' + (c.onlineOpen === false ? "late" : "ok") + '">Online ' + (c.onlineOpen === false ? "kapalı" : "açık") + '</span>' + ((c.menu || []).length ? '' : '<span class="g-chip late">Menü boş</span>') + '</div>' +
            '<div class="row-btns">' + link("Çalışan uygulaması", lk.garson) + link("Menü / QR", lk.kurulum) + link("Misafir menüsü", lk.menu) + link("Online sipariş", lk.online) + '</div></article>';
        }).join("") : '<p class="muted">Henüz işletme yok.</p>') +
        '<h3 class="g-cat">Yeni işletme aç</h3><form class="g-new" id="newCafe" novalidate>' +
        '<label for="y-name">İşletme adı<input id="y-name" maxlength="40" value="' + S.esc(f.name) + '" placeholder="ör. Köşe Kahve"></label>' +
        '<label for="y-code">İşletme kodu<input id="y-code" maxlength="30" autocapitalize="none" value="' + S.esc(f.code) + '" placeholder="' + S.esc(S.slugify(f.name) || "kose-kahve") + '"></label>' +
        '<label for="y-tables">Masa sayısı<input id="y-tables" type="number" inputmode="numeric" min="1" max="80" value="' + S.esc(f.tables) + '"></label>' +
        '<label for="y-owner">Patronun adı<input id="y-owner" maxlength="30" value="' + S.esc(f.owner) + '"></label>' +
        '<label for="y-user">Patronun kullanıcı adı<input id="y-user" autocapitalize="none" maxlength="20" value="' + S.esc(f.user) + '" placeholder="ör. mehmet"></label>' +
        '<label for="y-pass">Patronun şifresi (en az 6)<input id="y-pass" autocomplete="new-password" maxlength="40" value="' + S.esc(f.pass) + '"></label>' +
        (st.err ? '<p class="form-err" role="alert">' + S.esc(st.err) + '</p>' : '') +
        '<button class="btn btn-primary wide" type="submit"' + (st.busy ? " disabled" : "") + '>' + (st.busy ? "Açılıyor…" : "İşletmeyi aç") + '</button>' +
        '<p class="g-info">Kod sonradan değişmez; QR kodları ve girişler bu koda bağlıdır. Patron girince kendi çalışanlarını kendisi ekler.</p></form></main></div>';
    }

    var app = S.$("app");
    app.oninput = function(e){ var m = { "y-name": "name", "y-code": "code", "y-tables": "tables", "y-owner": "owner", "y-user": "user", "y-pass": "pass" }[e.target.id]; if (m) st.form[m] = e.target.value; };
    app.onfocusout = function(){ if (!st.user) return; setTimeout(function(){ if (!S.isEditing()) render(); }, 0); };
    app.onsubmit = function(e){ if (e.target.id === "newCafe") { e.preventDefault(); create(); } };
    app.onclick = function(e){
      var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
      if (b.dataset.act === "logout") { B.logout(); return; }
      if (b.dataset.act === "madeOk") { st.made = null; render(); }
    };
    return function(){ alive = false; };
  };
})();
