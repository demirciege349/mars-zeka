# Cloud Shell'de çalışır: Közbaşı fotoğraflarını indirir, site/img/ altına koyar,
# yayından sonra Firestore'daki foto adreslerini kendi sitemize çevirir.
import os, sys, json, subprocess, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.abspath(__file__))
CAFE = "kozbasi123"; PROJECT = "mars-zeka"
PH = json.load(open(os.path.join(ROOT, "fotolar.json")))
OUT = os.path.join(ROOT, "site", "img", CAFE); os.makedirs(OUT, exist_ok=True)

def indir():
    ok = 0
    for k, u in PH.items():
        dst = os.path.join(OUT, k + ".jpg")
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "MarsZeka/1.0 (demirciege349 menu photos)"})
            data = urllib.request.urlopen(req, timeout=30).read()
            open(dst, "wb").write(data)
            if subprocess.call(["which", "convert"], stdout=subprocess.DEVNULL) == 0:
                subprocess.call(["convert", dst, "-resize", "640x640>", "-strip", "-quality", "78", dst])
            ok += 1
        except Exception as e:
            print("indirilemedi:", k, e)
    print(ok, "/", len(PH), "foto indirildi")

def firestore():
    tok = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()
    n = 0
    for k in PH:
        if not os.path.exists(os.path.join(OUT, k + ".jpg")): continue
        url = ("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/cafes/%s/photos/%s?updateMask.fieldPaths=data"
               % (PROJECT, CAFE, k))
        body = json.dumps({"fields": {"data": {"stringValue": "/img/%s/%s.jpg" % (CAFE, k)}}}).encode()
        req = urllib.request.Request(url, data=body, method="PATCH", headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "x-goog-user-project": PROJECT})
        try: urllib.request.urlopen(req, timeout=30).read(); n += 1
        except Exception as e: print("firestore hatası:", k, e)
    print(n, "foto adresi güncellendi")

if __name__ == "__main__":
    (indir if sys.argv[1:] == ["indir"] else firestore)()
