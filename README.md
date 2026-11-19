# Güvercin — Soy Takip ve Üreme Yönetimi

Pigeon breeder için kuş soy takibi, üreme kaydı ve fotoğraf arşivi.
Windows ve Android'de çalışır; veriler bulutta (Firebase) tutulur, böylece
birden fazla cihaz aynı kayıtları görür.

## Kurulum

1. `dist\Güvercin Setup <sürüm>.exe` dosyasını çalıştırın (kurulum sihirbazı).
   - Tek dosya istiyorsanız: `dist\Güvercin <sürüm>.exe` (kurulum gerektirmez, taşınabilir)
2. Windows "bilinmeyen uygulama" uyarısı çıkabilir → **Yine de çalıştır** (uygulama imzasızdır).
3. Kurulumdan sonra masaüstünde **Güvercin** kısayolu oluşur.

## İlk kurulum (Firebase)

Veriler bulutta saklanır, bu yüzden bir kez Firebase projesi kurulması gerekir.
Uygulama da bu adımları ekranda anlatır:

1. https://console.firebase.google.com → Gmail hesabınızla girin
2. **Proje ekle** → ad ver (`Güvercin`) → Devam
3. **Build → Authentication → Get started** → **Email/Password** etkinleştir
4. **Build → Firestore Database → Create database** → test modunda başlat
5. **Build → Storage → Get started** → etkinleştir
6. Proje ana ekranında **Web** simgesi → uygulama kaydet
7. Çıkan `firebaseConfig` bilgisini `src/firebase/config.js` dosyasına yapıştır
8. Uygulamayı yeniden derle (`npm run dist`)

> Adım 4'te "test modu" seçildiği için kurallar herkese açıktır. Bu kurulumu
> kolaylaştırır ama verilerinize herkes erişebilir. Kullanıma başladıktan sonra
> **Firestore → Rules** sekmesinden aşağıdaki kuralları yapıştırıp **Publish**
> deyin (bkz. [Güvenli kurallar](#güvenli-kurallar)).

## Oturum açma ve paylaşım

Her cihazda **e-posta + şifre** ile giriş yapılır. Aynı hesapla giren tüm
cihazlar aynı kayıtları görür; birinde yapılan değişiklik diğerinde **anında**
belirir.

- Sen bir hesap oluştur, bilgisayarında ve telefonunda o hesapla gir.
- Abine de bir hesap açmasını söyle — **kendi e-postası ve şifresiyle**.
- Hesaplar birbirinden bağımsızdır; şifrenizi kimseyle paylaşmanız gerekmez.

> Veriler kullanıcı başına ayrıdır (`users/<uid>/`). Bu yüzden farklı
> e-postalar farklı kayıtları görür — aynı listeyi paylaşmak için **aynı
> e-postayı** kullanın.

## Güvenli kurallar

Kurulum sırasında test modu seçildiyse, Firebase konsolunda
**Firestore Database → Rules** sekmesine şunu yapıştırıp **Publish** edin:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Storage için **Storage → Rules**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Bu kurallar herkesin yalnızca kendi verisine erişmesini sağlar.

## Özellikler

- **Kuş listesi** — arama, cins/durum/künye filtresi, fotoğraf süzgeci
- **Kuş kartı** — kod + numara (örn. `KIRMIZI KLİPS-118`), ad, cins, renk/ayırıcı işaret, hat, not
- **Kodlar** — `+` düğmesiyle kod ekleme ve silme, en fazla 24 karakter
  (örn. `KIRMIZI KLİPS`, `BEYAZ KLİPS`, `MAVİ KLİPS`)
- **Eşler** — kuş sayfasında eş kartı; **eşe tıklayınca doğrudan onun sayfasına geçilir**,
  `+ Eş Ata` ile eşleştirme yapılır (akrabalık uyarısıyla)
- **Fotoğraflar** — kuş başına çoklu fotoğraf
- **Soy ağacı** — 3 kuşak (kendi + anne/baba + dedeler) görsel şema, kutular tıklanabilir
- **Çiftleşme kaydı** — erkek × dişi, tarih, yufa no
- **Yavru ekleme** — çiftleşmeden yavru oluşturur, soy bağlantısını otomatik kurar
- **Akrabalık uyarısı** — Wright katsayısı ile ortak atadan gelen yakınlık oranı
- **Gerçek zamanlı eşitleme** — iki cihazda aynı anda çalışılabilir
- **Yedekleme** — JSON dışa/içe aktarma

## Alanlar

Form sırası: **Kod** → **Numara** → **Ad** → **Cins** → **Renk / ayırıcı işaret** →
**Durum** → **Hat / soy** → **Baba** → **Ana** → **Eş** → (dişilerde) **Yumurtlama tarihi** → **Notlar**

Kod ve numara **isteğe bağlıdır**; en az biri (veya ad) dolu olmalıdır.
Künye gösterimi eksik parçaya göre uyarlanır: `GC-01` / `GC` / `01` / `AD` / `#A3F1`.
Yalnızca kod + numara ikisi de doluyken tekrar kontrolü yapılır.

Kuş eklerken **Eş** alanından mevcut bir kuş seçilirse eşleşme kaydı **otomatik** oluşturulur.

## Veriler nerede saklanıyor?

Bulgut üzerinde, kullanıcı başına ayrı:

```
users/<uid>/birds/<birdId>      her kuş bir belge
users/<uid>/pairings/<id>       her çiftleşme bir belge
users/<uid>/settings            künye kodları, cinsler, yetkili
users/<uid>/photos/<ad>         fotoğraflar (Firebase Storage)
```

Her kuş **kendi belgesi** olduğu için iki kişi aynı anda farklı kuşları
düzenleyebilir; birinin kaydı diğerinininkini silmez.

Cihazda ayrıca bir önbellek tutulur: internet kesilse bile kayıtlar görünür,
bağlantı gelince kendiliğinden eşitlenir.

## Geliştirme

```bash
npm install          # bağımlılıklar
npm test             # veri katmanı testleri (20 kontrol)
npx vite build       # arayüzü derler (app/)
npm start            # Electron'u başlatır
node scripts/make-icon.js   # ikonu üretir
npm run dist         # .exe üretir (dist/)
```

> Not: `vite build` çıktısı `app/`, `.exe` çıktısı `dist/` klasörüne gider. Böylece
> uygulama açıkken yeniden derleme yapılabilir. Kapatmadan önce uygulamayı kapatmayı unutma.

### Kodun yapısı

```
src/
  api.js              window.api'yi kurar: bulut + platform birleşimi
  firebase/api.js     Firestore & Storage (oturum, belge yazma, fotoğraf)
  firebase/config.js  ← Firebase bilgileri BURAYA yazılır
  platform.js         işletim sistemi katmanını seçer
  platform/capacitor.js   Android: kamera, dosya, paylaşım
  schema.js           veri şekli ve sürüm taşıma
  electron/           preload: yalnızca dosya işlemleri
components/           arayüz (depolama yönteminden habersiz)
```

React bileşenleri yalnızca `window.api` yüzeyini görür; verinin nerede
durduğunu bilmez. Bu yüzden Electron ↔ Android ve yerel ↔ bulut geçişleri
arayüzü değiştirmez.

## Android (APK)

Aynı arayüzün Android sürümü Capacitor ile paketlenir.

```bash
npm run mobile:apk    # derler -> dist/Güvercin-<sürüm>-<tarih>.apk
npm run mobile:open   # Android Studio'da açar
```

Derleme için **JDK 21** ve Android SDK gerekir (`JAVA_HOME`, `ANDROID_HOME`).

APK dosya adı derleme anının tarihini taşır, böylece sürümleri karıştırmaz:
`Güvercin-1.0.0-20261011-2009.apk`

## Bilinen sınırlar (v1)

- Aynı kuşu **aynı anda** iki kişi düzenlerse son kaydeden kazanır
  (belge bazlı çakışma koruması yoktur). Farklı kuşları aynı anda
  düzenlemek sorunsuzdur.
- Veriler kullanıcı başına ayrıdır; e-posta değiştirilirse veri eski
  hesapta kalır.
- Uygulama imzasızdır (Windows SmartScreen uyarısı verebilir).
- Firebase ücretsiz katmanı küçük ölçek için fazlasıyla yeterlidir
  (aylık 50 bin okuma / 20 bin yazma).