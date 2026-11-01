/* Saha Defteri — site sürümü için yerel kayıt katmanı.
   Sayfanın beklediği claude.use("db") / claude.use("assets") arayüzünü bu cihazın IndexedDB'siyle sağlar.
   Kayıtlar bu cihazda kalır; Yedek al / Yedeği yükle ile cihazlar arasında taşınır. */
(function(){
  "use strict";
  var DBN = "mars-zeka-saha", idb = null, visits = {}, blobs = {}, urls = {}, subs = [];
  function open(){
    return new Promise(function(res, rej){
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function(){ var d = r.result; d.createObjectStore("visits"); d.createObjectStore("photos"); };
      r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); };
    });
  }
  function tx(store, mode, fn){
    return new Promise(function(res, rej){
      var t = idb.transaction(store, mode), s = t.objectStore(store), out = fn(s);
      t.oncomplete = function(){ res(out && out.result !== undefined ? out.result : undefined); }; t.onerror = function(){ rej(t.error); };
    });
  }
  function all(store){
    return new Promise(function(res, rej){
      var m = {}, t = idb.transaction(store, "readonly"), c = t.objectStore(store).openCursor();
      c.onsuccess = function(){ var cur = c.result; if (cur) { m[cur.key] = cur.value; cur.continue(); } };
      t.oncomplete = function(){ res(m); }; t.onerror = function(){ rej(t.error); };
    });
  }
  function snap(){
    return { docs: Object.keys(visits).map(function(k){ var v = visits[k]; return { id: k, exists: true, data: function(){ return v; }, metadata: { fromCache: false, hasPendingWrites: false } }; }),
      metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function notify(){ var s = snap(); subs.forEach(function(f){ setTimeout(function(){ f(s); }, 0); }); }
  function err(code){ return { code: code, message: code }; }
  var ready = open().then(function(d){ idb = d; return Promise.all([all("visits"), all("photos")]); }).then(function(r){
    visits = r[0]; blobs = r[1]; Object.keys(blobs).forEach(function(id){ urls[id] = URL.createObjectURL(blobs[id]); });
  });
  var db = { collection: function(name){
    if (name !== "visits") throw new TypeError("yalnızca visits");
    return {
      doc: function(id){ return {
        id: id,
        set: function(body){ var b = JSON.parse(JSON.stringify(body)); return tx("visits", "readwrite", function(s){ s.put(b, id); }).then(function(){ visits[id] = b; notify(); }).catch(function(){ throw err("quota_exceeded"); }); },
        update: function(part){ var b = Object.assign({}, visits[id] || {}, JSON.parse(JSON.stringify(part))); return this.set(b); },
        delete: function(){ return tx("visits", "readwrite", function(s){ s.delete(id); }).then(function(){ delete visits[id]; notify(); }); }
      }; },
      onSnapshot: function(next){ subs.push(next); ready.then(function(){ next(snap()); }); return function(){ subs = subs.filter(function(f){ return f !== next; }); }; }
    };
  } };
  var assets = {
    upload: function(blob){
      var id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      return tx("photos", "readwrite", function(s){ s.put(blob, id); }).then(function(){ blobs[id] = blob; urls[id] = URL.createObjectURL(blob); return { id: id, url: urls[id], sizeBytes: blob.size, contentType: blob.type }; })
        .catch(function(){ throw err("quota_or_state"); });
    },
    delete: function(id){ return tx("photos", "readwrite", function(s){ s.delete(id); }).then(function(){ if (urls[id]) URL.revokeObjectURL(urls[id]); delete urls[id]; delete blobs[id]; return { deleted: true }; }); },
    list: function(){ return Promise.resolve({ assets: [], usage: {} }); }
  };
  function toData(blob){ return new Promise(function(res){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.readAsDataURL(blob); }); }
  function fromData(url){ return fetch(url).then(function(r){ return r.blob(); }); }
  window.SAHA_BLOB = function(id){ return urls[id] || ""; };
  window.SAHA_LOCAL = {
    backup: function(){
      return ready.then(function(){
        var ids = Object.keys(blobs);
        return Promise.all(ids.map(function(id){ return toData(blobs[id]); })).then(function(datas){
          var photos = {}; ids.forEach(function(id, i){ photos[id] = datas[i]; });
          var file = new Blob([JSON.stringify({ app: "mars-zeka-saha", v: 1, at: Date.now(), visits: visits, photos: photos })], { type: "application/json" });
          var a = document.createElement("a"), d = new Date();
          a.href = URL.createObjectURL(file); a.download = "saha-defteri-yedek-" + d.toISOString().slice(0, 10) + ".json";
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000);
        });
      });
    },
    restore: function(file){
      return file.text().then(function(t){
        var j = JSON.parse(t); if (!j || j.app !== "mars-zeka-saha" || !j.visits) throw new Error("bad");
        var pids = Object.keys(j.photos || {});
        return Promise.all(pids.map(function(id){ return fromData(j.photos[id]).then(function(b){ return tx("photos", "readwrite", function(s){ s.put(b, id); }).then(function(){ blobs[id] = b; if (!urls[id]) urls[id] = URL.createObjectURL(b); }); }); }))
          .then(function(){
            var keys = Object.keys(j.visits).filter(function(k){ var cur = visits[k], inc = j.visits[k]; return !cur || (inc.updatedAt || 0) > (cur.updatedAt || 0); });
            return Promise.all(keys.map(function(k){ return tx("visits", "readwrite", function(s){ s.put(j.visits[k], k); }).then(function(){ visits[k] = j.visits[k]; }); })).then(function(){ notify(); return keys.length; });
          });
      });
    }
  };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){});
  window.claude = { use: function(n){ return ready.then(function(){ return n === "db" ? db : n === "assets" ? assets : null; }, function(){ return null; }); } };
})();
