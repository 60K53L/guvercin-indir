# Güvercin — Geliştirme Kuralları (AGENTS.md)

Güvercin: güvercin soy takip ve üreme yönetimi uygulaması. Tek React kod tabanı,
üç hedefe derlenir: **Electron** (Windows), **Capacitor** (Android), **Web**
(Firebase Hosting). Veriler Firebase Firestore'da, kullanıcı başına ayrı.

## Çalışma tarzı

- Yanıtlar her zaman **Türkçe**.
- Kullanıcı "yap / bul / ara" dediğinde yapılacak işi tarif etme; doğrudan
  uygula ve sonucu bildir.
- Zorunlu değilse kullanıcıdan bilgi/onay isteme; önce depodaki komut, test ve
  koddan çözmeye çalış. OTA/Capgo ve geri dönüşü zor işlemler bu kuralın
  istisnasıdır.
- APK derleme, kurulum ve emülatör testleri **ön planda ve kullanıcının
  görebileceği şekilde** yapılır. Emülatör/uygulama arka planda (background)
  çalıştırılmaz; her adımda ekran görüntüsü paylaşılır.

## Dil ve üslup

- Kod **yorumları Türkçe**; değişken/fonksiyon adları İngilizce.
- Kullanıcıya görünen her metin Türkçe. Firebase hata mesajları
  `src/firebase/api.js` içindeki `turkceHata()` üzerinden çevrilir; yeni hata
  türleri buraya eklenmelidir.
- Yorumlar "neden" açıklar, "ne" değil (mevcut tarz budur).

## Türkçe dil kuralları (kesin)

- Büyük harfe çevirme **her zaman** `trUpper()` üzerinden (`src/lib.js`).
  `String.toUpperCase()` kullanılmaz — "dişi" → "DIŞI" hatası üretir.
- Türkçe alfabetik sıralama `sortTr()` ile (`src/schema.js`).
- Arama/eşleştirme `foldTr()` / `trSearch()` ile; anahtar sözcükler ASCII
  yazılır ('SIYAH', 'MAVI'), noktalı İ ile eşleşmez.
- Sabit seçenek metinleri doğrudan büyük harfle tanımlanır (`STATUS`, `SEX`).

## Filtre, Modal ve Arayüz Kuralları (kesin)

- **Popup ve Modal Başlıkları**: Modal ve açılır pencere başlıkları ortalanırken sağdaki `×` (kapat) butonuna asla binmemelidir. Bunun için `display: grid; gridTemplateColumns: 40px 1fr 40px` (veya `padding: 0 46px`) kullanılır; başlık metni merkez hücresinde ortalanır (`textAlign: 'center'`), taşma olursa `overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap` ile kırpılır.
- **Vazgeç / İptal (ESC) Butonu**: Popup ve seçici pencerelerin altındaki "Vazgeç / İptal (ESC)" butonu tüm satır genişliğini kaplar (`width: 100%` veya `flex: 1`), metni dikey ve yatay olarak tam ortalanır (`display: flex; justifyContent: 'center'; alignItems: 'center'; textAlign: 'center'`).
- **Filtre ve Seçici Seçenekleri**: Filtre butonlarının içindeki metinler ve açılır pencerelerdeki liste seçenekleri (seçim butonları/kartları) satırı ortalayacak şekilde hizalanır (`justifyContent: 'center'; textAlign: 'center'`); onay işareti (`✓`) varsa sağ kenara mutlak konumlandırılır (`position: absolute; right: 14`).
- **Kümes Filtresi Düğmeleri (BirdPicker)**: Kümes filtresi düğmeleri tek satırda sığmazsa alt satıra kayar (`flex-wrap: wrap`); uzun kümes adları dinamik yazı boyutu ve iç boşlukla (10+ karakterde 9.5px, 14+ karakterde 9px) küçülür, böylece yatay taşma engellenir.
- **Irk/Cins Görselleri**: 
  - Görseller kullanıcının referans çiziminden üretilmiş saf vektörel (SVG) paçalı kostüm güvercini siluetidir (dik/gururlu duruş, paçalı ayaklar, kanat ayrımı ve göz detayı). Her ırk için uygun renk dolgusuyla (Çakal: sıcak kestane kahvesi, Limoni: canlı sarı, Kırmızı Komple: Çakal ile aynı sıcak kestane kahvesi gövde + beyaz önlük, Beyaz: beyaz gövde + kontür) saf SVG olarak çizilir.
  - Kuşlar sekmesindeki cinsi etiketinde ırk görseli gösterilmez (satır kaymalarını önlemek için sade metin olarak kalır). Irk görselleri yalnızca filtre seçicilerinde veya profil detayında gösterilir.
- **Kart ve Rozet Kenar Yuvarlaklığı (Standart Radius)**:
  - Kuş listesi ve detay kartlarındaki tüm rozet/etiketler (`.bird-num`, `.tag`, `.bird-cinsi`, durum etiketleri, grup sayaçları vb.) **aynı standart köşe yuvarlaklığına (`border-radius: 6px`)** ve **aynı yüksekliğe (`height: 22px`)** sahip olmalıdır. Biri tam hap/oval (`999px`) iken diğeri keskin kutu yapılmaz; tüm rozetler tek tip tasarım dilini izler. Rozetler arası boşluk (`gap`) kompakt tutulur (`4px` - `6px`), dikeyde ortalanır (`align-items: center`).
- **Klips Grubu Kart Başlıkları (Akordiyon)**:
  - Klips grubu başlığında (`.bird-group-head`) rozet, sayı, cinsiyet etiketleri ve açma/kapama oku daima **tek bir satırda** kalmalıdır (`flex-wrap: nowrap !important;`).
  - `.bird-group-left` ve `.bird-group-tags` kapsayıcıları asla `flex-wrap: wrap` alamaz; taşmayı önlemek için `overflow: hidden` ve `flex-shrink: 0` uygulanır.
  - Klips rozeti genişliği mobilde dinamik ölçeklenir (`clamp(96px, 28vw, 126px)` ve `groupChipStyle()`). Tüm grup öğeleri 360px gibi dar ekranlarda dahi 2. satıra asla kayamaz.
- **Kuş Satırı ve Rozet Hizalaması (`.bird-row .bird-ring`)**:
  - Kuş listesi satırlarında (`.bird-row .bird-ring`), ayak numarası (`.bird-num`), cinsiyet (`.tag.sex`), ırk/cinsi (`.bird-cinsi`) ve durum (`.tag.durum-*`) etiketleri **tek bir satırda hizalanır**, **asla üst üste binmez** ve **kelimenin baş harfi asla kırpılamaz**.
  - `.bird-cinsi` bileşeni `justify-content: center` yerine `justify-content: safe center` ve iç span ile sınırlandırılır (`max-width: 100%; text-align: center; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;`). Böylece taşma olduğunda metin kesinlikle soldan kesilemez (ör. `BEYAZ KIRMIZILARDAN` metninin başındaki "B" harfi asla gizlenemez; sığmadığında sadece sağ uçtan `...` ile kısaltılır).
  - Mobilde `.bird-row` boşlukları kompakt tutulur (`gap: 6px; padding: 8px 10px; .bird-thumb { width: 28px; height: 28px; }`).
- **Uzun Metinlerin Kartlara Otomatik Sığdırılması**:
  - Kartlardaki uzun cins/ırk adları (örneğin `BEYAZ SARILARDAN`, `BEYAZ KIRMIZILARDAN`) ve grup adları kırpılmadan satıra tam sığabilmesi için karakter uzunluğuna göre dinamik ölçeklenir (`cinsiBadgeStyle`: 10+ karakterde `9.5px`, 14+ karakterde `8.5px`, 18+ karakterde `8px` ve negatif `letterSpacing` ile sıkıştırma; `groupChipStyle` ile klips adları). CSS'te `font-size: clamp()` kuralı uygulanır. Satırda taşma veya harf kesilmesi engellenir.
- **Güncelleme Modalı (OTA) Maddeleri**:
  - "Bu Güncellemede Neler Var?" listesinde varsayılan olarak yalnızca **ilk 2 madde** gösterilir; 2'den fazla madde varsa aşağı bakan ok (▼) ile kalan maddeler açılır, açıldıktan sonra "Kısalt ▲" ile tekrar kapanır. Bu eşik değiştirilmez.
- **Yavrular Tablosu (Webapp) Hizalama ve Boşluk**:
  - Künye, Ad, Babası, Cinsiyet sütunları sola yaslı ve kaymasız hizalanır; güvercin fotoğrafından sonraki gereksiz boşluklar azaltılır (hücre padding `8px 6px`).
  - Tüm künye kartları aynı genişlikte (sütun genişliğinin tamamı) ve metin ortada; uzun künye adları otomatik küçülerek sığdırılır.
- **Kuş Satır Tablolarında Sütun Genişliği ÖLÇÜLÜR (kesin)**:
  - Sütun genişlikleri **yüzde veya elle seçilmiş px DEĞİL**, ekrandan ölçülür (`src/birdRowsWidths.js` → `measureTableColumns`). Chrome `table-layout: fixed` + `width: 100%` ile verilen px genişlikleri tablo genişliğine göre **orantılı şişirir**; bu yüzden tahmini px/yüzde ile denge tutturulamaz.
  - Ölçüm tabloyu geçici olarak "doğal yerleşime" alınarak yapılır (`.bird-rows-natural` sınıfı); atanmış genişlikler ölçümü etkilemez.
  - Her sütunun ölçülen genişliğine **tek tip boşluk** (`BIRD_ROW_GAP`) eklenir → sütunlar arası görsel aralık birebir eşit olur. Artan boşluk en sondaki `bird-rows-spacer` sütununda toplanır.
  - Aynı `widthGroup` ("yavru") içindeki tablolar (Yavrular / Torunlar) ölçümleri **ortak depoda birleştirilir**; böylece iki tablo birebir aynı sütun genişliklerini paylaşır, başlıklar satırlardan kaymaz.
  - Ölçüm sadece geniş ekranda (`min-width: 901px`) yapılır; mobilde tablo kart düzenine döner.
- **Yavrular Tablosunda Eşit Boyutlu Çerçeveler**:
  - Cinsiyet (`DİŞİ`/`ERKEK`) ve Kümes rozetleri her satırda **aynı boyuttadır** (`width: 58px` / `104px`); yazı çerçevenin içinde ortalanır.
  - Cinsiyet ve Kümes sütunlarında hücre içeriği ile sütun başlığı ortalanır (`text-align: center`); Kümes rozetinin renk noktası çerçevenin sol kenarına sabitlenir, metin ortada kalır.

## Mimari

- React bileşenleri **yalnızca `window.api`** yüzeyini görür; verinin nerede
  durduğunu (Firestore/JSON) ve platformu bilmez. Yeni özellik eklerken bu
  sınırı bozma.
- Platform seçimi **derleme bayrağıyla** (`VITE_WEB`) yapılır, çalışma anında
  `window.Capacitor` tahminiyle değil.
- Veri şekli tek yerde: `src/schema.js`. Şema değişirse `migrate()` güncellenir
  ve eski kayıtlar bozulmadan dönüştürülür.
- Firestore yapısı: `users/<uid>/birds|pairings|clutches|medications|vaccinations|treatments|photos|settings`.
  Her kayıt kendi belgesidir (eşzamanlı düzenleme için). Kurallar: `firestore.rules`.
- Fotoğraflar sıkıştırılıp Firestore'a yazılır (Storage ücretsiz pakette yok).

## Komutlar

- `npm test` — veri katmanı testleri; her değişiklikten sonra çalıştırılmalı.
- `npm run build:renderer` → `app/`, `npm run dist` → `dist/` (çıktı klasörleri
  elle düzenlenmez).
- `npm run mobile:apk` — APK üretir (JDK 21 + Android SDK gerekir) ve APK'yı
  Drive'a (`G:\Drive'ım\Code\GUVERCIN-APK`) kopyalar. `backup:github`'ten
  önce çalıştırılmalıdır; yoksa release adımı güncel sürümün APK'sını bulamaz.
- `npm run web:deploy` — web build + Firebase hosting.
- `npm run backup:github` — tam yedek: `web:backup` → `backup:source` →
  `backup:release`. Web ZIP + kaynak kod ZIP (Drive) + commit/push/tag +
  APK release'i.
- `npm run backup:release` — yalnızca GitHub commit/push/tag + APK release'i.
- `npm run ota` / `npm run web:publish` — OTA paketi; sürümü ve bildirilecek
  maddeleri `scripts/publish-ota.js` belirler (`src/version.js` CHANGELOG'ı
  ile `scripts/publish-history.json` farkı). Yayın öncesi kullanıcı onayı
  gerekir.

## Ortam (bu makinede doğrulandı)

- Android SDK: `C:\Users\GXL-EV\AppData\Local\Android\Sdk`. `adb` PATH'te değil,
  tam yol (`.../platform-tools/adb.exe`) kullanılır. Gerekli paketler:
  `platforms;android-36`, `build-tools;36.0.0` (compileSdk 36).
- JDK 21 sistemde kurulu değil; `JAVA_HOME` verilmeden `npm run mobile:apk`
  "JAVA_HOME is not set" ile durur. Taşınabilir Temurin 21 zip'i açıp
  `JAVA_HOME` gösterilebilir.
- `android/local.properties` gitignore'da ve makineye özeldir; bu makinede
  `SDK.dir=C:\Users\GXL-EV\AppData\Local\Android\Sdk` olmalıdır. Başka
  makineden kalan yol build'i kırar.

## Doğrulama ve yayın (kalıcı kural)

- Yapılan her güncelleme **APK'ya uygulanıp emülatörde (AVD `Pixel_Android14`,
  `emulator-5554`) canlı gösterilir**: APK kurulur, Capgo deposu temizlenir
  (`files/versions`, `cache/capgo_downloads`), uygulama çalıştırılır ve ekran
  görüntüsü alınır. Ekran görüntüsü `adb shell screencap` + `adb pull` ile
  alınır (PowerShell ikili yönlendirmesi PNG'yi bozar). Kullanıcı aksini
  söylemedikçe doğrulama bu şekilde yapılır.
- Emülatörle çalışma notları:
  - Adb yol: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
  - Ekran görüntüsü modelde küçültülmüş görünür; `adb shell input tap`
    koordinatları `adb shell wm size` (1080x2400) çözünürlüğüyle verilir.
  - Metin girerken klavye açılınca yerleşim kayar: önce `adb shell input
    keyevent 4` ile klavyeyi kapat, sonra sabit koordinata dokun.
  - Capgo deposu: `/data/data/com.guvercin.soy/files/versions` ve
    `/data/data/com.guvercin.soy/cache/capgo_downloads` (`adb root`
    gerekir).
- **OTA ve Capgo yayınları kullanıcı onayı olmadan yapılmaz.** Olası hata riski
  nedeniyle `scripts/publish-ota.js` çalıştırılmadan önce onay istenir.
- Emülatörde oturum, Capgo deposu temizlenince düşer; giriş gerekiyorsa
  kullanıcıdan doğrulanır.

## GitHub yedeği (kalıcı kural)

- Her kod güncellemesinden sonra tam yedek alınır: `npm run backup:github`.
  Komut sırasıyla şunları yapar:
  1. `npm run web:backup` — webapp derlenir, `Güvercin-Web-<sürüm>-<damga>.zip`
     üretilir ve Drive'a kopyalanır.
  2. `npm run backup:source` — kaynak kod ZIP'i üretilir ve Drive'a kopyalanır.
  3. `npm run backup:release` — commit + push, `vX.Y.Z` etiketi ve
     `guvercin-indir` APK release'i.
- Web ve kaynak ZIP'leri de **güncel + bir önceki sürüm** olarak Drive'da
  tutulur; eski sürümler otomatik silinir.
- GitHub'da **güncel sürüm + bir önceki sürüm** release olarak tutulur. Yeni
  sürümde sorun çıkarsa önceki APK'ya dönülebilir; daha eski release'ler
  arşiv olarak kalır.
- Release asset adı daima `guvercin.apk` olur. Herkese açık
  `releases/latest/download/guvercin.apk` bağlantısı güncel APK'yı verir.
- `scripts/github-backup.js` var olan etiketi taşımaz. Etiket son commit'i
  göstermiyorsa `git tag -f -a vX.Y.Z -m "Güvercin vX.Y.Z" HEAD` ve
  `git push --force origin vX.Y.Z` ile düzeltilir.
- GitHub yedeği için `gh` kurulu ve `gh auth login` yapılmış olmalıdır; git
  kimlik doğrulaması `gh auth setup-git` ile bağlanır.
- OTA/Capgo yayını ayrıca kullanıcı onayı gerektirir; GitHub yedeği bu onaydan
  bağımsız olarak her güncellemeden sonra alınır.

## Yapma

- `src/firebase/config.js` içine yeni API key/sır yazma; mevcut yapılandırma
  sabittir.
- `node_modules`, `dist`, `app`, `android` çıktılarına dokunma.
- `importJson` bilinçli olarak birleştirmeyen (sil-then-write) bir işlemdir;
  davranışını sessizce değiştirme.
- 60KB+ bileşenleri (Backup, BirdDetail, Medications) bölünmeye adaydır; yeni
  büyük özellik tek dosyaya yığılmamalı.

## Testler

- `npm test` — `package.json` içindeki node test/denetimlerini (veri, kümes,
  sıralama, arama, Türkçe kuralları, opsiyon büyük harf, ring kontrast,
  görünüm, sürüm bump) toplu çalıştırır. Her değişiklikten sonra çalıştır.
- Electron isteyen testler (`test-turkce.js`, `test-yavru.js`, `smoke.js`)
  düz `node` ile çalışmaz: `require('electron')` node'da yol stringi döner.
  Bunlar `npm run test:electron` ile çalıştırılır.
- Yeni mantık kuralları test edilecekse `scripts/` altına test eklenir.
