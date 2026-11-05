import os, sys, json, gzip, hashlib, subprocess, urllib.request, urllib.error
PROJECT = "mars-zeka"; SITE = "mars-zeka"; ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
API = "https://firebasehosting.googleapis.com/v1beta1"
tok = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()
def call(method, url, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": "Bearer " + tok, "Content-Type": ctype, "x-goog-user-project": PROJECT})
    try:
        with urllib.request.urlopen(req) as r:
            t = r.read().decode(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        print("HATA", e.code, url, e.read().decode()[:600]); raise
# site var mı?
try: call("GET", f"{API}/projects/{PROJECT}/sites/{SITE}")
except urllib.error.HTTPError:
    print("Site yok, oluşturuluyor..."); call("POST", f"{API}/projects/{PROJECT}/sites?siteId={SITE}", {})
files, blobs = {}, {}
for d, _, fs in os.walk(ROOT):
    for f in fs:
        p = os.path.join(d, f); rel = "/" + os.path.relpath(p, ROOT).replace(os.sep, "/")
        gz = gzip.compress(open(p, "rb").read(), mtime=0); h = hashlib.sha256(gz).hexdigest()
        files[rel] = h; blobs[h] = gz
print(len(files), "dosya")
v = call("POST", f"{API}/sites/{SITE}/versions", {"config": {"headers": [{"glob": "**/*.html", "headers": {"Cache-Control": "no-cache"}}]}})
vname = v["name"]
pop = call("POST", f"{API}/{vname}:populateFiles", {"files": files})
up = pop.get("uploadUrl")
for h in pop.get("uploadRequiredHashes", []):
    call("POST", f"{up}/{h}", raw=blobs[h], ctype="application/octet-stream")
call("PATCH", f"{API}/{vname}?update_mask=status", {"status": "FINALIZED"})
call("POST", f"{API}/sites/{SITE}/releases?versionName={vname}", {})
print("\nTAMAM ✅  Site yayında:  https://" + SITE + ".web.app")
