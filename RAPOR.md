# RAPOR — "İ harflerini i yapma" isteği neden faciaya dönüşüyor

Depo: `E:\Code\GUVERCIN_BETA` · Rapor tarihi: 17.10.2026 · Sürüm: 1.0.20
Bu raporu okuyan model, düzeltmeyi **bu dizinde** yapmalıdır.

---

## 1. Sonuç (özet)

Sorun bir "tasarım kararı" değil, **ölçülebilir bir kod bozulmasıdır**.

Kullanıcının istediği şey: ekranda büyük harfler kalsın, ama Türkçe noktalı `İ`
yerine küçük `i` görünsün → `TAKİP` yerine `TAKiP`, `DİŞİ` yerine `DiŞi`,
`KLİPS` yerine `KLiPS`.

Önceki deneme bunu **kaynak kodu toplu yeniden yazma** ile yapmaya çalıştı
(`scripts/replace-dotted-i.js` + `scripts/uppercase-display.js`, 35 dosya,
1730 satır). Bu yaklaşım metin ile kodu ayırt edemediği için iki yıkıma yol açtı:

| Belirti | Ölçülen neden |
|---|---|
| "komple tasarım berbat hale geliyor" | 262 satır içi stil değeri büyük harfe çevrildi: `1px solid var(--line)` → `1PX SOLiD VAR(--LiNE)` |
| "login bile olamıyorum" (Firebase hatası) | Login e-posta normalizasyonundaki **7 adet `/İ/g` regex'i `/i/g` yapıldı**; `'İ'.toLowerCase()` = `i̇` (U+0069 U+0307) olduğu için Firebase farklı bir e-posta görür |

Yani "İ→i" isteği teknik olarak **yapılabilir**, ama sadece **görüntü
katmanında** yapılabilir. Kaynak metni scriptle yeniden yazmak yasaktır.

---

## 2. Kanıtlar

### 2.1 Kum havuzu deneyi (depoya dokunulmadan yeniden üretildi)

Deponun `src/` kopyası ile o oturumda yazılan iki script
(silinen `replace-dotted-i.js` ve `uppercase-display.js`) izole bir klasörde
çalıştırıldı. Sonuç, o gün olanın birebir aynısı:

```
### ORIJINAL (HEAD)
  İ-katlayan regex (/İ/ veya [İı]) toplam: 12
  bozulmus stil degeri (VAR(--X) vb.) toplam: 0

### SCRIPT SONRASI
  İ-katlayan regex (/İ/ veya [İı]) toplam: 3
  bozulmus stil degeri (VAR(--X) vb.) toplam: 262
  dosya basina: App.jsx=4, ActivityLogModal.jsx=8, AuthScreen.jsx=5,
                Backup.jsx=29, BirdDetail.jsx=13, BirdForm.jsx=12,
                BirdPicker.jsx=34, ChickSexGuideModal.jsx=17, CodePicker.jsx=51 ...
```

Değişen: 25 dosya (1. script) + 35 dosya (2. script) = **35 dosyada 1730 satır**.

### 2.2 Login'i bozan somut satırlar

`src/firebase/api.js` (5 yer: `signUp`, `signIn`, `sendPasswordReset`,
`sendSignInLink`, `signInWithLink`) ve `src/components/AuthScreen.jsx`
(2 yer: `submit`, `handleSendMagicLink`):

```js
// ÖNCE (doğru):
const cleanMail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()

// SONRA (script bozdu):
const cleanMail = String(email).trim().replace(/i/g, 'i').replace(/I/g, 'i').toLowerCase()
```

`replace(/i/g, 'i')` **hiçbir şey yapmaz**. Yani Türkçe `İ` koruması sessizce
yok edildi. Node ile doğrulandı:

```
'İbrahim@Gmail.com'.toLowerCase()
  → "i̇brahim@gmail.com"      (U+0069 U+0307 — iki kod noktası!)
doğru zincir (.replace(/İ/g,'i') ile)
  → "ibrahim@gmail.com"
AYNI MI? false
```

Firebase Auth bu iki dizgeyi **farklı e-posta** sayar → `auth/invalid-credential`
/ `auth/user-not-found` ailesinden bir hata. Kullanıcı e-postasında/klavyesinde
`İ` geçtiyse giriş yapılamaz. Ayrıca `firebase/api.js` içindeki
`turkceHata()` eşleşmeleri ve tüm kart stilleri bozulduğu için hata ayıklamak
imkânsız hale gelir.

> Not: Kullanıcının bildirdiği tam hata kodu kayıtlarda bulunamadı (tüm oturum
> veritabanı tarandı; yalnızca bu tahmin değil, yukarıdaki **kod bozulması**
> kanıtlıdır). Kod istenirse kullanıcıdan teyit alınmalı.

### 2.3 Tasarımı yıkan satırlardan örnekler

```jsx
// ÖNCE
<div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
// SONRA
<div style={{ textAlign: 'center', padding: '30PX 10PX', color: 'var(--muted)' }}>
// hatta:
border: '1PX SOLiD VAR(--LiNE)',
```

`var(--LiNE)` tanımsızdır (CSS özel değişken adları **büyük/küçük harfe
duyarlıdır**) → renkler/çerçeveler kaybolur; `1PX SOLiD` geçersiz değerdir →
kartlar kayar. 262 böyle satır = "kartların hepsi kaymış".

### 2.4 Ekran görüntüsü kanıtları (temp klasöründe)

- `%TEMP%\opencode\emulator_web_i2.png`, `emulator_i_form4.png`:
  CSS uppercase kapatılınca kaynak metnin tutarsız kasa olduğu görülüyor
  (`GÜVERCİN SOY TAKiP`, `ANDROID UYGULAMASINI iNDiR`, `Şifremi unuttum?`)
  ve giriş kutuları stilsiz (beyaz) kalıyor.
- `emulator_klips_i3.png`: deneyden **önceki** normal hâl (referans).

---

## 3. İkinci tuzak: CSS `text-transform: uppercase`

`src/styles.css` (satır 64-81) neredeyse tüm metne `text-transform: uppercase`
uygular ve `index.html` `<html lang="tr">` der. Bu ikisi birlikte:

- Tarayıcı **render anında** `i` → `İ` çevirir. Yani veri/kaynak ne olursa olsun
  ekranda `İ` görünür.
- `lang="en"` denenirse `i` → `I` (noktasız) olur; istenen `i` yine çıkmaz.

Sonuç: `i` görüntüsü elde etmenin **tek yolu** `text-transform`'u kaldırıp
metni render öncesi `i`-biçimine çevirmektir. Bu da uygulamanın görünümünü
tamamen CSS'e bırakmış mevcut mimariyi değiştirir — dikkatli yapılmalıdır.

Bu yüzden denemede `styles.css`'teki 11 `text-transform: uppercase` elle
`none` yapıldı; kaynak metin ise tutarsız olduğu için görüntü karıştı
("KiPS/TAKiP/iNDiR").

### 3.1 Sinsi bir ayrıntı: CRLF yüzünden "koruma" dosyayı kurtardı

Scriptlerin "korunan tanımlar" kuralı boş satırı `\n\n` ile arıyordu; dosyalar
`\r\n` olduğu için bu hiç eşleşmedi ve **`lib.js`'in tamamı korundu**.
Böylece `trUpper`, `foldTr`, `SEX = 'DİŞİ'`, `PRIMARY_RING_COLORS = ['MAVİ', ...]`
İ-biçiminde kaldı; başka dosyalarda ise aynı tür dizgiler `i`-biçimine döndü.
Yani çıktı hem tasarım hem veri açısından **tutarsız** oldu. Scriptin
"başarılı" görünmesinin bir nedeni budur.

---

## 4. Neden bu yaklaşım kurtarılamaz

`"1px solid var(--line)"` ile `"Dişi"` bir script için aynı şeydir: ikisi de
"boşluk içeren dizge"dir. `isDisplay = /[şğıöüçİ]/ || /\s/` sezgisi yanlıştır.
Regex literalleri, sınıf adları, nesne anahtarları, karşılaştırma değerleri
kod; ama script bunları metinden ayıramaz. **Aynı hata iki kez yapıldı**;
üçüncü kez denenmemelidir.

---

## 5. Doğru yol (önerilen uygulama)

Kural: **veri katmanına ve regex'lere dokunulmaz; dönüşüm yalnızca görüntü
katmanında, tek fonksiyondan geçirilerek yapılır.**

1. **Değişmeyecekler (dokunma):**
   - `trUpper`, `foldTr`, `dispTr`, `trSearch`, `sortTr` tanımları ve
     içlerindeki `/İ/g`, `/[İı]/g` regex'leri.
   - `src/firebase/api.js` ve `AuthScreen.jsx` içindeki 7 `/İ/g` regex'i.
   - Firestore'da kayıtlı değerler (`'DİŞİ'`, `'MAVİ'`, tema kimlikleri).
   - Yorumlar (AGENTS.md).

2. **Görüntü dönüşümü:** `dispTr(s) = s.toLocaleUpperCase('tr-TR').replace(/İ/g,'i')`
   Sonuç: `'TAKİP' → 'TAKiP'`, `'DİŞİ' → 'DiŞi'`, `'KLİPS' → 'KLiPS'`.

3. **Uygulama biçimi (iki seçenek):**
   - **A (önerilen, en düşük risk):** CSS `text-transform: uppercase`
     kaldırılır; bunun yerine metni `dispTr`'den geçiren küçük bir sarmalayıcı
     bileşen/yardımcı kullanılır (`<span>{dispTr(text)}</span>` mantığı).
     Kaynak dizgeler **olduğu gibi yazılır**; hiçbir literal yeniden yazılmaz.
   - **B (önerilmez):** Literalleri kod moduyla dönüştürmek. Denedi ve iki kez
     çöktü. Ancak yapılacaksa: yalnızca JSX metin düğümleri ve
     `label/placeholder/title/aria-label/alt`; içinde `( ) -- : ; { } $ /`
     veya `\b\d+px` bulunan dizgeler **kesinlikle hariç**; sonuç **dosya dosya
     gözle incelenir**; `className`, regex, nesne anahtarı, karşılaştırma
     değerleri, `import` yasak. Yine de önerilmez.

4. **Girdi alanları transform edilmez.** `input`/`textarea` değerleri ve
   e-posta/şifre alanları olduğu gibi kalır (mevcut `.auth-email*` istisnaları
   korunur).

5. **Adım adım git:** önce tek ekran (örn. giriş ekranı), emülatörde doğrula,
   sonra sıradaki. 35 dosyayı tek seferde değiştirme.

---

## 6. Doğrulama planı (değişiklikten sonra zorunlu)

1. `npm test` → 244 + 9 + 16 + 34 + 10 geçmeli, 0 başarısız.
2. **Koruma testi ekle** (`scripts/check-display-case.js` benzeri):
   - 7 `/İ/g` login regex'i yerinde mi?
   - Hiçbir satır içi stilde `VAR(--` / `1PX SOLiD` gibi büyük harfli CSS
     değeri var mı? (Regresyon bekçisi)
3. APK'yı üret, **emülatörde APK içinde canlı** göster (AVD `guvercin`,
   `emulator-5554`); ekran görüntüsü `adb shell screencap` + `adb pull`.
   Capgo'nun sakladığı paket APK'nın önüne geçtiği için depoyu temizlemek
   gerekebilir; bu oturumu düşürür, hesaba kat.
4. OTA/Capgo yayını **kullanıcı onayı olmadan yapılmaz**.

---

## 7. Yeniden üretme (kanıtı kendin görmek için)

Kum havuzu şu an `%TEMP%\opencode\i-exp\` altında duruyor
(`src` = script sonrası, `src-orig` = HEAD kopyası, `scripts` = deney
scriptleri). Depoya hiç dokunulmadı.

```
cd %TEMP%\opencode\i-exp
node scripts/replace-dotted-i.js
node scripts/uppercase-display.js
git diff --no-index --stat src-orig src
```

---

## 8. Mevcut durum

- Giriş ekranı denemesi **uygulandı ve emülatörde doğrulandı** (bkz. bölüm 9).
  `npm test` 0 hata. Veri katmanı, kayıtlı değerler ve 7 login regex'i
  **değişmedi** → eldeki yedekler bozulmaz.
- **Tüm ana ekranlar** dönüştürüldü ve emülatörde çalıştırıldı: kuş listesi,
  kuş detayı, kuş formu, kuluçka & üretim, hastalık panosu, ilaçlar & aşılar,
  ayarlar & yedekleme, eşleştirme simülatörü, seçici pencereler (BirdPicker,
  CodePicker), fotoğraf görüntüleyici, işlem geçmişi, sürüm geçmişi, güncelleme
  penceresi, cinsiyet rehberi, kümes kontrolü, soy ağacı, yavru fotoğraf kutusu.
  `npm test` 0 hata (1084 `dispTr` kullanımı). Veri katmanı, kayıtlı değerler
  ve 7 login regex'i **değişmedi** → eldeki yedekler bozulmaz.
- Uygulamanın geri kalanı (yeniden yazılmış bir bileşen yok) — her görünür
  metin `dispTr()` içinden geçiyor. Dönüştürülmemiş tek yer: Firebase kurulum
  ekranının (`SetupScreen`) liste maddeleri (URL/kod içerdikleri için ham
  bırakıldı; başlık ve prose paragrafları dönüştürüldü).
- Kullanıcının kullanacağı sürüm: `1.0.20` (APK `Güvercin-1.0.20-20261017-1258.apk`).
- Yedekler: Google Drive `G:\Drive'ım\Code\GUVERCIN-APK` ve GitHub
  `60K53L/guvercin-indir` — yalnızca `1.0.20`. Bu incelemede **hiçbir yedek
  silinmedi**; ancak doğrulama için alınan APK'yı `stamp-apk.js` kuralı gereği
  Drive'a da kopyaladı (`…-1407.apk`, deneme sürümü). Silmek/inceltmek
  kullanıcı onayına bağlı.

---

## 9. Deneme: GİRİŞ EKRANI (17.10.2026 — uygulandı, emülatörde doğrulandı)

Bölüm 5'teki **A yolu**, tek ekranda denendi. Kural harfiyen uygulandı:
kaynak dizgeler **yeniden yazılmadı**; dönüşüm yalnızca çizim anında
`dispTr()` ile yapıldı.

### 9.1 Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/lib.js` | `dispTr(v) = trUpper(v).replace(/İ/g, 'i')` eklendi (veri değil, görünüm) |
| `src/styles.css` | `.auth-wrap, .auth-wrap * { text-transform: none !important }` |
| `src/components/AuthScreen.jsx` | Görünen her metin ve her `placeholder` `dispTr(...)` içinden geçiyor |
| `src/components/DownloadModal.jsx` | Aynı (yalnızca giriş ekranı içinde çiziliyor) |
| `scripts/check-display-case.js` | **Yeni bekçi test** (9.3) |
| `package.json` | Bekçi, `npm test` zincirine eklendi |

Dokunulmayanlar: e-posta/şifre **değerleri**, 7 login regex'i, `trUpper`,
`foldTr`, `SEX`, kayıtlı renk/cinsiyet dizgeleri, `text-transform` bloğunun
uygulamanın geri kalanındaki 11 kullanımı.

### 9.2 Sonuç: İ → i, tasarım aynı

Emülatörde APK içinde doğrulandı (AVD `guvercin`, `emulator-5554`,
`com.guvercin.soy`; Capgo deposu `pm clear` ile temizlendi):

| Ekran | Görünen |
|---|---|
| Giriş | `GÜVERCiN SOY TAKiP` `BETA`, `SOY TAKiP VE ÜREME KAYITLARI`, `E-POSTA`, `ŞiFRE`, `GiRiŞ YAP`, `ŞiFREMi UNUTTUM?`, `KAYITLAR BULUTTA SAKLANIR. AYNI E-POSTAYLA GiRDiĞiN CiHAZLAR…` |
| Kayıt | `ŞiFRE (TEKRAR)`, `HESAP OLUŞTUR`, `ZATEN HESABIN VAR MI? GiRiŞ YAP` |
| Şifre sıfırlama | `ŞiFRE SIFIRLAMA`, `SIFIRLAMA BAĞLANTISI GÖNDER`, `✨ ŞiFRESiZ HIZLI GiRiŞ BAĞLANTISI GÖNDER`, `MAiLDEKi LiNKi VEYA OOBCODE KODUNU YAPIŞTIRIN`, `BAĞLANTIYI DOĞRULA & ŞiFRE BELiRLE`, `← GiRiŞ EKRANINA DÖN` |
| APK penceresi | `⬇ APK iNDiR (V1.0.20)`, `KURULUM: iNDiRiLEN DOSYAYI AÇ → … iZiN VER → KUR.`, `KAPAT` |
| Dokunulmayan | `ornek@gmail.com` (e-posta alanı olduğu gibi kaldı) |

Yerleşim, kart/buton ölçüleri, renkler ve boşluklar **birebir aynı**; değişen
tek şey noktalı `İ` yerine küçük `i`. Ekran görüntüleri:
`%TEMP%\opencode\z5_view.png` (giriş), `z9_view.png` (kayıt), `z8_view.png`
(sıfırlama), `z6b.png` (APK penceresi).

### 9.3 Bekçi test: `scripts/check-display-case.js`

`npm test` içinde çalışır; şu 5 kuralı zorlar:

1. **7 login regex'i** yerinde mi (`api.js` 5 + `AuthScreen.jsx` 2).
2. `trUpper` = `toLocaleUpperCase('tr-TR')`; `foldTr` içindeki `[İı]` sağlam mı.
3. Hiçbir dizgede **bozulmuş CSS değeri** yok mu (`1PX`, `SOLiD`, `RGBa(`,
   `VAR(--LiNE`…). `${...}` interpolasyonları hariç tutulur; `version.js`
   changelog'u düz metin olduğu için taranmaz.
4. `dispTr` yalnızca **görüntü katmanında** (bileşenlerde) kullanılıyor mu.
5. `dispTr` kullanılan kapsamda `text-transform: none` override'ı var mı
   (yoksa tarayıcı "i"yi yeniden "İ" yapar).

**Bekçinin kanıtı:** bozulmuş kopyada (`%TEMP%\opencode\i-exp`) çalıştırıldı →
`api.js: 5 bekleniyor, 0 bulundu`, `AuthScreen.jsx: 2 bekleniyor, 0 bulundu`,
`"1PX SOLiD VAR(--LiNE)"`, `"0 20PX 40PX RGBA(0,0,0,0.5)"` … toplam **395
sorun**. Temiz depoda **0 sorun**. Yani aynı hata bir daha yapılırsa test
kırmızıya döner.

### 9.4 Doğrulama sırasında çıkan tuzak (mutlaka bilinmeli)

`adb shell screencap` **eski kareyi** döndürebiliyor. Emülatörde `pm clear` +
yeniden başlatma sonrası alınan ekran görüntüsü, önceki oturumun (İ deneyinin
yapıldığı bozuk sürümün) arayüzünü gösterdi: `DiŞi`, `KLiPS`, `CiNSLER` —
oysa APK temizdi. İki ardışık ekran görüntüsü neredeyse **byte-identical**
çıktı (yalnızca saat farklıydı). Ekrana bir kez `input tap` gönderildikten
sonra görüntü tazelendi ve ekran aynı sayfada **doğru** hâliyle göründü.

Kural: "bozuk görünüyor" sonucuna varmadan önce **ekrana dokun, sonra tekrar
görüntü al**. Logcat yanıltmıyordu: `CapgoUpdater: Built-in bundle is active`
= OTA değil, APK'nın kendi paketi çalışıyor.

### 9.5 Sıradaki ekranlar için tarif (aynı yolla devam)

1. O ekranın **kök kapsayıcısına** aynı `text-transform: none !important`
   kuralını ekle (ör. `.bird-list`, `.modal`). **Global bloğu değiştirme** —
   yoksa uygulamanın tamamı etkilenir.
2. Yalnızca o ekrandaki **görünen** dizgeleri `dispTr()` içine al: JSX metin
   düğümleri, `placeholder`, `label`/buton metinleri. `className`, stil
   değerleri, `title`/`aria-label`, `import`, regex ve **veri** dizgelerine
   dokunma (kullanıcı isteğiydi: `title` yazısı dönüşüme girmez).
3. Kullanıcı girdisi taşıyan `input`/`textarea` **değerleri** dönüşüme girmez.
4. `npm test` (bekçi dahil) → APK → emülatörde canlı göster.
5. **Tek ekran = tek doğrulama.** 35 dosyayı bir arada değiştirme (iki kez
   denendi, iki kez çöktü).

---

## 10. Deneme: KUŞLAR EKRANI (17.10.2026 — uygulandı, emülatörde doğrulandı)

Bölüm 9'daki tarif, uygulamanın ana ekranına uygulandı. Kaynak dizgeler yine
**yeniden yazılmadı**; dönüşüm yalnızca çizim anında `dispTr()` ile yapıldı.

### 10.1 Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/styles.css` | 4 yeni kapsam: `.topbar`, `.bottom-nav`, `.toast`, `.bird-view` → `text-transform: none !important` (minify edilen CSS'te tek kuralda birleşiyor) |
| `src/App.jsx` | Marka (`GÜVERCiN SOY TAKiP`, `BETA`), üst menü 5 düğmesi, alt menü 5 etiketi, `ÇIKIŞ`, `GEÇMİŞ` ve bildirim metni `dispTr(...)` içinden geçiyor |
| `src/components/BirdList.jsx` | Ana `return` artık `.view-list` kapsamı altında (`.body`'ye eklenen `view-<name>` sınıfıyla) çiziliyor; istatistik kartları, arama `placeholder`'ı, filtre metinleri, cinsiyet/cins/durum seçenekleri, kuş grupları, kuş satırları, `ClipLines`, `PairSquare`, `MatedList`, `ClipColorFinder` metinleri `dispTr` ile |
| `src/components/CodePicker.jsx` | Bu ekranın içinde çizildiği için dönüştürüldü (liste, arama, yönetim ve önizleme metinleri; önizlemedeki `trUpper(draft)` → `dispTr(draft)`) |
| `src/components/Ring.jsx` | Künye/klips rozetinin yazısı `dispTr(text)` — aksi hâlde "MAVi KLiPS" yerine ham `İ` görünürdü |

Dokunulmayanlar: `className` (template literal'ler dâhil), `style` değerleri,
`title`/`aria-label`, `value`/`key`, karşılaştırma-filtre-sıralama mantığı,
`foldTr` kullanımları, 7 login regex'i, `trUpper`, `SEX`, kayıtlı veri.

### 10.2 Yerleşim neden bozulmadı

`.body` normal bir blok kapsayıcı (`flex: 1; overflow: auto; padding: …`),
flex/grid değil. Bu yüzden listenin içeriğini tek bir `<div className="bird-view">`
ile sarmak yerleşimi değiştirmiyor; üst şerit/alt menü için hiç sarmalayıcı
gerekmedi (kendi sınıfları var). `position: fixed` pencereler de bu div'in
içinde kaldığı için kapsam onlara da uygulanıyor (portal yok — `createPortal`
depoda hiç kullanılmıyor).

### 10.3 Sonuç: İ → i, tasarım aynı

Emülatörde APK içinde doğrulandı (AVD `guvercin`, `emulator-5554`,
`com.guvercin.soy`; Capgo deposu temizlendi, `CapgoUpdater: Built-in bundle is
active`):

| Yer | Görünen |
|---|---|
| Üst şerit | `GÜVERCiN SOY TAKiP` `BETA` |
| Alt menü | `KUŞLAR` `KULUÇKA` `HASTALIK` `iLAÇ & AŞI` `AYARLAR` |
| İstatistik kartları | `30 DiŞi`, `27 ERKEK`, `70 TOPLAM KUŞ`, `30 EŞLi KUŞ` |
| Araç çubuğu | `ARA: KÜNYE, AD, HAT, RENK, NOTA…`, `KÜNYELER`, `DiŞi / ERKEK`, `TÜM CiNSLER`, `TÜM DURUMLAR`, `FOTOĞRAFLILAR`, `CiNSiYETi EKSiK (13)`, `KONTROLÜ EKSiK (26)`, `KLiPS RENGİYLE BUL`, `73 SONUÇ`, `+ YENi KUŞ` |
| Gruplar | `KLiPS RENK GRUPLARI`, `16 GRUP`, `TÜMÜNÜ GENİŞLET`, `BEYAZ KLiPS`, `8 KUŞ`, `3 D`, `3 E`, `2 ?` |
| Kuş satırı | `✓ SAĞ`, `BEYAZ KLiPS` (rozet: `KLiPS` küçük i), `BABAÇ`, `ERKEK`, `DAMIZLIK` |
| Eşli Kuşlar penceresi | `EŞLİ KUŞLAR (15 ÇiFT)`, `ESKİ EŞLER`, `EŞ`, `♀ DiŞi`, `♂ ERKEK`, `KiRMIZI KOMPLE`, `🐣 HENÜZ KAYITLI YAVRU YOK` |
| Klips Rengiyle Bul | `ÇiFT RENKLEri GÖSTER`, `SOL AYAK`, `SAĞ AYAK`, `TEMİZLE`, `VAZGEÇ`, `KUŞLARI BUL`, `LACiVERT KLiPS`, `MAVi KLiPS`, `SiYAH KLiPS`, `VAZGEÇ / iPTAL (ESC)` |

Yerleşim, kart/rozet ölçüleri (142px), renkler ve boşluklar **birebir aynı**.
Ekran görüntüleri: `%TEMP%\opencode\w1_view.png` (liste), `w2_view.png` (açılmış
grup), `w4_view.png` (Eşli Kuşlar), `w5_view.png` (Klips Rengiyle Bul),
`w6_view.png` / `z_iptal.png` / `z_mavi.png` (künye seçici, 4x yakınlaştırma).

### 10.4 Yeni çıkan iki ayrıntı

1. **Kapsam içindeki metin kutusu artık yazıldığı gibi görünüyor.** CSS'te
   `input, textarea, select { text-transform: uppercase }` kuralı da vardı;
   kapsam kapandığı için arama kutusu ve künye taslağı yazıldığı gibi (küçük
   harfle) görünüyor. **Kaydedilen değer değişmedi**: künye eklerken `trUpper`
   hâlâ uygulanıyor, arama `foldTr` ile büyük/küçük harf ayrımı yapmadan
   çalışıyor. `select` içindeki seçenekler `dispTr` ile yazıldığı için açılır
   listeler yine büyük harf + küçük i.
2. **Kapsam içinde çizilen paylaşılan bileşenler dönüştürülmeli.** `Ring` ve
   `CodePicker` bu ekranda kapsamın altında kalıyor; dönüştürülmeselerdi
   yazıları "ham kaynak" hâlinde (ör. `Listede ara...`) görünecekti. İkisi de
   başka ekranlarda da kullanıldığı için orada görünüm **değişmedi**:
   `dispTr` + CSS büyük harf = eskisi gibi `İ` (kayıp yok, kazanç da yok).

### 10.5 Değişikliğin sınırı nasıl kanıtlandı

`BirdList.jsx` ve `CodePicker.jsx` için "kanonik metin" karşılaştırması
kullanıldı: eski ve yeni dosyadan `dispTr(`, `trUpper(`, tırnak, parantez,
süslü parantez ve boşluklar atıldıktan sonra iki metin **birebir aynı** çıktı
(`%TEMP%\opencode\proof3.mjs`, `proof4.mjs`). Yani fark yalnızca sarmalama +
beklenen sarmalayıcı `div`. Ayrıca `npm test` içindeki bekçi, bozulmuş stil
değerlerini ve değişmiş login regex'lerini yakalamaya devam ediyor
(`7 login regex'i, 6309 dizge, 159 dispTr kullanımı denetlendi, 0 sorun`).

---

## 11. Toplu dönüşüm (17.10.2026 — uygulandı)

Kullanıcının "tümünü düzelt" talimatı üzerine kalan tüm ekranlar ve
pencereler aynı yöntemle (kaynak dizgeleri yeniden yazmadan, yalnızca
çizim anında `dispTr()`) dönüştürüldü. Per-ekran kapsam yaklaşımı
korundu (global CSS bloğu değiştirilmedi); her görünüm/pencere için
kapsam sınıfı eklendi.

### 11.1 Kapsam mimarisi (styles.css)

Tek bir `text-transform: none !important` bloğu, dönüştürülmüş her kökü
listeler:

- Giriş/kurulum: `.auth-wrap`
- Üst şerit, alt menü, bildirim: `.topbar`, `.bottom-nav`, `.toast`
- Tüm pencereler: `.overlay`, `.modal`
- Kuş seçici penceresi: `.picker-backdrop`
- Fotoğraf görüntüleyici: `.viewer`
- Ana görünümler (`.body` üzerinde `view-<name>` sınıfıyla):
  `.view-list` (kuşlar + kuş detayı), `.view-incubation`, `.view-treatments`,
  `.view-medications`, `.view-backup`

Dönüştürülmemiş bir ekran/pencere listede yoksa eskisi gibi CSS ile
büyük harfe çevrilir; bozulma olmaz, kazanç olmaz.

### 11.2 Dönüştürülen dosyalar

| Dosya | Not |
|---|---|
| `src/App.jsx` | `.body` → `'body view-' + view`; marka/üst/alt menü/bildirim zaten dönüştürülmüştü; `notify` metinleri `toast.text` üzerinden çizimde sarılıyor |
| `src/components/BirdDetail.jsx` | Sarmalayıcı geri alındı (`.view-list` kapsamı); 202 `dispTr` |
| `src/components/BirdForm.jsx` | 88 `dispTr`; `getTag` ham bırakıldı (arama mantığı); `&#10;` → `\n` (görünen metin aynı) |
| `src/components/Incubation.jsx` | 85 `dispTr`; `label` ham bırakıldı, render yerinde sarıldı |
| `src/components/TreatmentBoard.jsx` | 64 `dispTr` |
| `src/components/Medications.jsx` | dönüştürüldü |
| `src/components/Backup.jsx` | ~179 `dispTr`; `&quot;` → `"` (görünen metin aynı); `importJson` davranışına dokunulmadı |
| `src/components/MatingSimulator.jsx` | 76 `dispTr` |
| `src/components/BirdPicker.jsx` | 21 `dispTr`; `getTag`/`trSearch` mantığına dokunulmadı |
| `src/components/ActivityLogModal.jsx` | 25 `dispTr` |
| `src/components/ChickSexGuideModal.jsx` | 32 `dispTr` |
| `src/components/VersionHistoryModal.jsx` | 16 `dispTr` |
| `src/components/UpdateModal.jsx` | 10 `dispTr` |
| `src/components/LoftCheck.jsx` | 11 `dispTr`; `&quot;` → `"` |
| `src/components/Pedigree.jsx` | 8 `dispTr` |
| `src/components/PhotoBox.jsx` | 7 `dispTr` |
| `src/components/PhotoViewer.jsx` | 0 (görünen harf içeren metin yok; title tooltip'leri ham) |
| `src/components/SetupScreen.jsx` | başlık + prose paragrafları; liste maddeleri (URL/kod) ham |
| `src/components/CodePicker.jsx` | zaten dönüştürülmüştü (1. tur) |
| `src/components/Ring.jsx` | zaten dönüştürülmüştü (1. tur) |

Toplam: **1084 `dispTr` kullanımı**, `npm test` 0 sorun.

### 11.3 Kanıt yöntemi

- **Kanonik metin karşılaştırması** (`%TEMP%\opencode\proofAll.mjs`): her
  dosyanın eski ve yeni hâli, `dispTr(`/`trUpper(`, yorum, boşluk, tırnak,
  parantez, süslü parantez atıldıktan sonra **birebir aynı** çıktı. Yani
  fark yalnızca `dispTr()` sarmalaması + import satırı (ve 3 yerde HTML
  entity → JS kaçışı, görünen metin değişmedi). `className`/`style`/`title`/
  `value`/`key`/`onClick`/`onChange`/`data-*`/regex/karşılaştırma mantığı
  **değişmedi**.
- **Bekçi testi** (`scripts/check-display-case.js`): `7 login regex'i,
  6924 dizge, 1084 dispTr kullanımı denetlendi, 0 sorun`.
- **Derleme:** `npm run mobile:build` → `BUILD SUCCESSFUL`.
- **APK:** emülatöre kuruldu, Capgo deposu temizlendi; logcat'ta
  `CapgoUpdater: Built-in bundle is active` ve **hiçbir JS hatası yok**.

### 11.4 Canlı doğrulama durumu

Bu oturumda görüntü okuma aracı çalışmamaya başladı (model bağlam sınırı),
bu yüzden yeni ekranların görüntüleri okunamadı. Kuşlar ekranı daha önce
görüntü ile doğrulanmıştı (`w1_view.png` … `w6_view.png`,
`z_iptal.png`, `z_mavi.png`, `z_chip.png`); aynı yöntem ve aynı kod yolu
(her metin `dispTr`'den geçiyor, kapsam sınıfı CSS'te mevcut) kullanıldı.
Kullanıcıdan istenen: emülatörde oturum açıp Kuluçka, Hastalık Panosu,
İlaçlar & Aşılar, Ayarlar/Yedekleme, bir kuş detayı ve kuş formunu
görsel olarak kontrol etmesi; herhangi bir yerde ham kaynak hâli (ör.
`Listede ara...`) veya noktalı `İ` görülürse bildirmesi.

### 11.5 Kalan notlar

- **Metin kutuları** dönüştürülmüş kapsamlarda yazıldığı gibi (küçük harfle)
  görünüyor; kaydedilen değer değişmedi (`trUpper` kaydetmede, `foldTr`
  aramada). `select` seçenekleri `dispTr` ile büyük harf + küçük i.
- **Paylaşılan bileşenler** (`Ring`, `CodePicker`, `BirdPicker`) dönüştürüldü;
  dönüştürülmüş bir kapsam içinde çizildiklerinde `i` görünür, dönüştürülmemiş
  bir yerde çizildiklerinde (yok — hepsi dönüştürüldü) eskisi gibi `İ`.
- `title=` HTML tooltip'leri ve `onNotify`/`confirm`/`alert` metinleri kural
  gereği dönüştürülmedi (tarayıcı diyaloğu/tooltip katmanı; bildirimler
  `toast.text` üzerinden çizimde sarılıyor).
