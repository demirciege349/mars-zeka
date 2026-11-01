/* Mars Zeka — Firebase arka ucu. Sayfalar yalnızca window.SiralaBackend üzerinden konuşur. */
(function(){
  "use strict";
  var V = "10.12.2", BASE = "https://www.gstatic.com/firebasejs/" + V + "/";
  var A, F, auth, db, user = null, authCbs = [], CFG = null, APP = null, auth2 = null;

  function staffOf(u){ return !!(u && !u.isAnonymous && u.email); }
  function wrapUser(u){ return u ? { uid: u.uid, email: (u.email || "").toLowerCase(), staff: staffOf(u), anon: u.isAnonymous } : null; }

  var ready = Promise.all([
    import(BASE + "firebase-app.js"), import(BASE + "firebase-auth.js"), import(BASE + "firebase-firestore.js"), import("./firebase-config.js")
  ]).then(function(m){
    var cfg = m[3].firebaseConfig;
    if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf("BURAYA") === 0) throw new Error("not-configured");
    var app = m[0].initializeApp(cfg); CFG = cfg; APP = m[0];
    A = m[1]; F = m[2];
    auth = A.getAuth(app);
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    A.onAuthStateChanged(auth, function(u){ user = wrapUser(u); resolved = true; authCbs.forEach(function(cb){ cb(user); }); });
  });
  var resolved = false;

  var cafe = function(id){ return F.doc(db, "cafes", id); };
  var sub = function(id, name){ return F.collection(db, "cafes", id, name); };
  var list = function(q){ return q.docs.map(function(d){ var x = d.data(); x.id = d.id; return x; }); };

  window.SiralaBackend = {
    kind: "firebase",
    ready: ready,
    onAuth: function(cb){ authCbs.push(cb); if (resolved) cb(user); },
    currentUser: function(){ return user; },
    ensureCustomer: function(){ return ready.then(function(){ if (auth.currentUser) return; return A.signInAnonymously(auth); }); },
    login: function(e, p){ return ready.then(function(){ return A.signInWithEmailAndPassword(auth, e, p); }); },
    logout: function(){ return ready.then(function(){ return A.signOut(auth); }); },

    watchCafe: function(id, cb, err){ return F.onSnapshot(cafe(id), function(s){ cb(s.exists() ? s.data() : null); }, err || function(){}); },
    cafeExists: function(id){ return F.getDoc(cafe(id)).then(function(s){ return s.exists(); }); },
    createCafe: function(id, data){ return F.setDoc(cafe(id), data); },
    updateCafe: function(id, patch){ return F.updateDoc(cafe(id), patch); },
    listMyCafes: function(email){
      return F.getDocs(F.query(F.collection(db, "cafes"), F.where("staffEmails", "array-contains", email))).then(function(q){ return list(q).map(function(c){ return { id: c.id, name: c.name }; }); });
    },

    watchOrders: function(id, opts, cb, err){
      var q = opts && opts.table
        ? F.query(sub(id, "orders"), F.where("table", "==", opts.table), F.where("closed", "==", false))
        : F.query(sub(id, "orders"), F.where("closed", "==", false));
      return F.onSnapshot(q, { includeMetadataChanges: true }, function(s){ cb(list(s), s.metadata.fromCache); }, err || function(){});
    },
    addOrder: function(id, data){ return F.addDoc(sub(id, "orders"), data).then(function(r){ return r.id; }); },
    updateOrder: function(id, oid, patch){ return F.updateDoc(F.doc(db, "cafes", id, "orders", oid), patch); },
    closeTable: function(id, table){
      return F.getDocs(F.query(sub(id, "orders"), F.where("table", "==", table), F.where("closed", "==", false))).then(function(q){
        var b = F.writeBatch(db), now = Date.now();
        q.docs.forEach(function(d){ b.update(d.ref, { closed: true, closedAt: now }); });
        b.set(F.doc(db, "cafes", id, "tables", table), { billRequested: false, waiter: false, updatedAt: now });
        return b.commit();
      });
    },
    moveTable: function(id, from, to){
      return F.getDocs(F.query(sub(id, "orders"), F.where("table", "==", from), F.where("closed", "==", false))).then(function(q){
        var b = F.writeBatch(db), now = Date.now();
        q.docs.forEach(function(d){ b.update(d.ref, { table: to, movedFrom: from, movedAt: now }); });
        b.set(F.doc(db, "cafes", id, "tables", from), { billRequested: false, waiter: false, updatedAt: now });
        return b.commit().then(function(){ return q.docs.length; });
      });
    },
    listOrders: function(id, since){
      return F.getDocs(F.query(sub(id, "orders"), F.where("createdAt", ">=", since))).then(list);
    },
    purgeClosed: function(id){
      return F.getDocs(F.query(sub(id, "orders"), F.where("closed", "==", true))).then(function(q){
        var docs = q.docs, chain = Promise.resolve();
        for (var i = 0; i < docs.length; i += 400) (function(part){
          chain = chain.then(function(){ var b = F.writeBatch(db); part.forEach(function(d){ b.delete(d.ref); }); return b.commit(); });
        })(docs.slice(i, i + 400));
        return chain.then(function(){ return docs.length; });
      });
    },

    // Müşteri: yalnızca kendi masasının kaydını dinler (her masa değişikliği herkese okutulmaz).
    watchTable: function(id, table, cb){ return F.onSnapshot(F.doc(db, "cafes", id, "tables", String(table)), function(s){ cb(s.exists() ? s.data() : {}); }, function(){}); },
    // Mutfakta bekleyen sipariş sayısı: sayım sorgusu (siparişleri tek tek indirmez).
    queueCount: function(id){
      var q = F.query(sub(id, "orders"), F.where("status", "==", "new"), F.where("closed", "==", false));
      return (F.getCountFromServer ? F.getCountFromServer(q).then(function(r){ return r.data().count; }) : F.getDocs(q).then(function(r){ return r.size; }));
    },
    watchTables: function(id, cb){ return F.onSnapshot(sub(id, "tables"), function(s){ var m = {}; s.docs.forEach(function(d){ m[d.id] = d.data(); }); cb(m); }, function(){}); },
    setTable: function(id, table, patch){ return F.setDoc(F.doc(db, "cafes", id, "tables", table), patch, { merge: true }); },

    watchPhotos: function(id, cb){ return F.onSnapshot(sub(id, "photos"), function(s){ var m = {}; s.docs.forEach(function(d){ m[d.id] = d.data().data; }); cb(m); }, function(){}); },
    setPhoto: function(id, itemId, data){
      var r = F.doc(db, "cafes", id, "photos", itemId);
      return data ? F.setDoc(r, { data: data }) : F.deleteDoc(r);
    },

    /* Online siparişin iletişim bilgisi: ayrı belge, yalnızca çalışanlar okur (kurallar). */
    addContact: function(id, oid, data){ return F.setDoc(F.doc(db, "cafes", id, "contacts", oid), data); },
    watchContacts: function(id, cb){ return F.onSnapshot(sub(id, "contacts"), function(s){ var m = {}; s.docs.forEach(function(d){ m[d.id] = d.data(); }); cb(m); }, function(){ cb({}); }); },
    deleteContact: function(id, oid){ return F.deleteDoc(F.doc(db, "cafes", id, "contacts", oid)).catch(function(){}); },

    /* Patron çalışan hesabı açar. İkinci bir Firebase örneğiyle açılır ki patronun kendi oturumu kapanmasın. */
    makeAccount: function(email, password){
      return ready.then(function(){
        if (!auth2) auth2 = A.getAuth(APP.initializeApp(CFG, "hesap-acici"));
        return A.createUserWithEmailAndPassword(auth2, email, password).then(function(){ return A.signOut(auth2); });
      });
    },
    createStaff: function(id, p){
      var e = String(p.email).toLowerCase(), self = this;
      return self.makeAccount(e, p.password).then(function(){
        return F.updateDoc(cafe(id), new F.FieldPath("staff", e), { name: p.name, role: p.role }, "staffEmails", F.arrayUnion(e));
      });
    },
    removeStaff: function(id, email){
      var e = String(email).toLowerCase();
      return F.updateDoc(cafe(id), new F.FieldPath("staff", e), F.deleteField(), new F.FieldPath("zones", e), F.deleteField(), "staffEmails", F.arrayRemove(e));
    },
    /* Yönetim (Ege): tüm işletmeler. admins/{e-posta} belgesi olan hesap yöneticidir (Firebase konsolundan eklenir). */
    isAdmin: function(email){ return F.getDoc(F.doc(db, "admins", String(email).toLowerCase())).then(function(s){ return s.exists(); }); },
    listAllCafes: function(){ return F.getDocs(F.collection(db, "cafes")).then(function(q){ return list(q); }); },
    createBusiness: function(id, data, owner){
      var self = this, e = String(owner.email).toLowerCase();
      return F.getDoc(cafe(id)).then(function(s){
        if (s.exists()) throw { code: "kod-dolu" };
        return self.makeAccount(e, owner.password);
      }).then(function(){
        var staff = {}; staff[e] = { name: owner.name, role: "patron" };
        return F.setDoc(cafe(id), Object.assign({}, data, { staff: staff, staffEmails: [user.email, e] }));
      });
    },

    getPrivate: function(id){ return F.getDoc(F.doc(db, "cafes", id, "private", "settings")).then(function(s){ return s.exists() ? s.data() : {}; }); },
    setPrivate: function(id, patch){ return F.setDoc(F.doc(db, "cafes", id, "private", "settings"), patch, { merge: true }); }
  };
})();
