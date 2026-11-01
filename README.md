# Mars Zeka — QR Sipariş

Mars Zeka, restoran ve kafeler için masadan sipariş sistemidir. Misafir masadaki QR kodu okutur, fotoğraflı menüden seçer, siparişini gönderir ve "yaklaşık 20 dk" yazısını görür. Sipariş mutfak/kasa ekranına yazılı düşer. Hesap sonunda garsona ya da kasaya ödenir.

Misafir uygulama indirmez, hesap açmaz; her telefonun tarayıcısında çalışır.

**Canlı demo:** https://demirciege349.github.io/mars-zeka/
Telefonla açın, sipariş verin, üstteki **Mutfak / kasa** düğmesiyle siparişin düştüğünü görün. (Demo tek cihazda çalışır; veriler o telefonda kalır.)

---

## Misafir ne görür?

- **Fotoğraflı menü**, kategori şeridi
- Her yemekte **ortalama hazırlanma süresi**, **porsiyon miktarı** (ör. 180 gr et, 300 ml), **yaklaşık kalori** ve **alerjenler**
- **Alerjen filtresi:** "Süt içermesin" seçilince ilgili yemekler işaretlenir
- **1 / 1,5 porsiyon** seçimi; gram ve kalori kendiliğinden 1,5 katına çıkar
- **Porsiyonu masada gör (3D):** yemek, telefon kamerasıyla masanın üstünde gerçek boyutunda görünür
- Sipariş notu ("acısız"), gönderince **tahmini süre**; menüye dönünce üstte **kalan dakika** şeridi
- **Yoğunluğa göre süre:** mutfakta bekleyen sipariş arttıkça süreler kendiliğinden uzar, misafir "Mutfağımız şu an yoğun" uyarısını görür
- Sipariş misafir tarafından iptal edilemez; kasa iptal ederse misafir bunu görür
- Her ekranda **Garson çağır**, hesap ekranında **Hesap iste**

## İşletme ne görür?

**Kasa / mutfak ekranı** (tablet ya da bilgisayar, şifreli):
- Gelen siparişler: masa, saat, not, kalan süre (geciken kırmızı), **Hazırlandı**
- **Siparişi iptal et** (yalnızca hazırlanmamış siparişler, onaylı; şaka siparişlere karşı)
- **Mutfak yoğunluğu:** bekleyen siparişe göre otomatik ek süre + elle **+10 / +20 dk**
- **Masalar:** açık hesaplar, hesap isteyen masa kırmızı, **Hesap fişi yazdır**, **Ödeme alındı · masayı kapat**, **Masayı taşı**
- **Garson siparişi:** QR kullanmayan misafir için
- **Menü:** **Tükendi** (tek dokunuş), fiyat ve süre değişikliği (patron PIN'i, kayıtlı), **Basılı fiyat listesini yazdır**
- **Rapor:** sipariş sayısı, QR/garson oranı, ciro, masa başı hesap, hazırlanma süresi, en çok satanlar, yoğun saatler, **satış dökümü (.csv, Excel)**
- Yeni sipariş, garson çağrısı ve hesap isteğinde ses

**Garson uygulaması** (telefon, `garson.html`, ana ekrana eklenir):
- Masalar renkli: dolu, mutfaktan hazır yemek var, garson çağırıyor, hesap istiyor
- Çağrı ve hesap isteğinde ses ve titreşim; "Gidiyorum" ile uyarı kapanır
- **Hazır:** mutfak "Hazırlandı"ya basınca yemek garsonun listesine düşer, "Servis edildi" ile kalkar
- **Sipariş al:** masa seç, porsiyonla ekle, mutfağa gönder
- Masa hesabı ve "Ödeme alındı · masayı kapat"

## Online sipariş, çalışan uygulaması ve birden çok işletme

- **Online sipariş:** Masasız, gel-al ya da paket servis. Misafir ad, telefon ve (pakette) adres yazar; bu bilgileri yalnızca çalışanlar görür, sipariş teslim edilince silinir. Misafir siparişini "Siparişlerim" ekranından takip eder.
- **Tek uygulama, roller:** Herkes aynı çalışan uygulamasını kullanır (`garson.html`). Siparişler (QR + online) sesle ve titreşimle gelir. Patron rolündeki kullanıcı ek olarak **Patron** sekmesini görür: toplam gelir, garson başına sipariş ve ciro, garsonların masaları, online sipariş ve paket servis açma-kapama.
- **Kullanıcı adı ve şifre:** Patron, çalışan hesabını kendisi açar. Girişte işletme kodu + kullanıcı adı + şifre yazılır; herkes kendi işletmesine düşer.
- **Birden çok işletme:** Her işletme kendi kodu altında ayrı durur. Yönetim ekranından (`yonetim.html`) tüm işletmeler tek listede görülür, yeni işletme ve patron hesabı açılır.

**Kurulum ekranı:** menü editörü (fotoğraf, fiyat, porsiyon, kalori, süre, alerjenler, 3D model, sıralama), masa QR kartları (PNG / yazdır), PIN, kasa hesapları.

## Teknik yapı

- Saf HTML, CSS ve JavaScript; derleme adımı yok
- Gerçek sürüm: **Firebase** (Firestore + Authentication + Hosting). Misafir anonim oturumla, işletme e-posta/şifreyle girer; yetkiler sunucu tarafındaki güvenlik kurallarıyla korunur
- 3D görüntüleme: Google **model-viewer** (Android'de Scene Viewer, iPhone'da AR Quick Look)
- Bu repodaki `yayin` dalı yalnızca tek cihazlık demoyu içerir; çok cihazlı gerçek sürüm ayrı paket olarak kurulur

## Dosyalar (`yayin` dalı)

| Dosya | Ne |
|---|---|
| `index.html` | Telefon demosu (misafir + mutfak + garson) |
| `garson.html` | Garson uygulaması demosu (ana ekrana eklenebilir) |
| `tanitim.html` | İşletme sahiplerine tanıtım sitesi |
| `site.html` | Örnek restoran web sitesi şablonu |
| `models/adana.glb` | Gerçek boyutlu örnek 3D tabak (30 cm) |
| `manifest.webmanifest`, `icon.svg` | "Ana ekrana ekle" için uygulama bilgileri |

## Bilinen sınırlar

- Masadan online ödeme ve adisyon programı bağlantısı henüz yok. Adisyon kullanan işletme için ara çözüm: hesap fişi ve gün sonu satış dökümü
- Kalori, gramaj ve alerjen bilgilerini işletme girer; menüde yaklaşık olduğu belirtilir
- Basılı fiyat listesi yönetmelik gereği masada ve girişte bulunmalıdır; sistem bu listeyi tek tuşla üretir

---

Eskişehir · 2026
