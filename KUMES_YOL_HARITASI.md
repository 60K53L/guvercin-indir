# Kümes (Çoklu Bölme) Yol Haritası

Tarih: 19.10.2026  
Durum: Faz 1–4 uygulandı; cins listesi ve klips tekilliği kümes bazına alındı; emülatör doğrulaması sürüyor

## 0.1 Uygulananlar (19.10.2026)

- [x] `settings.coops` ve `bird.coopId` şeması; `SCHEMA_VERSION = 2`
- [x] Okuma anında göç: eksik/geçersiz `coopId` varsayılan kümese düşer
- [x] `src/coops.js`: liste, kimlik çözümleme, `scopeDb`, sayaçlar
- [x] `scripts/test-coops.mjs`: 73 test; `npm test` içinde
- [x] Üst çubukta kümes seçici (`CoopPicker`) + son seçimi hatırlama
- [x] Kuş listesi ve tüm ilişkili ekranlar `viewDb` ile filtreleniyor
- [x] Katı izolasyon: liste ve yeni seçimlerde A kümesinde B kümesinin kuşları yok; mevcut aile bağları (eş/yavru/ebeveyn) detayda kümes rozetiyle görünür
- [x] Kuş formunda kümes alanı; eş/ebeveyn adayları aynı kümesden
- [x] Kuş detayında kümes rozeti ve hızlı kümes değiştirme
- [x] Ayarlar → Kümesler kartı: ekle, adlandır, renk, sıra, sil + taşı
- [x] Pedegri başlığında aktif kümes adı
- [x] Aşı/ilaç ortak baz; kuşa bağlı uygulamalar kümesle filtreleniyor
- [x] Cins (ırk) listesi kümes bazında: `settings.coopCinsi`
- [x] Aynı klips farklı kümeslerde kullanılabilir; tekillik kümes bazında
- [x] Durum etiketi "UÇAN KÜMESİ" → "UÇAN KUŞ" (kayıtlı değer `ucurmalik` aynı kaldı)
- [x] Eşli Kuşlar ekranı eşi başka kümede olan kuşu silinmiş gibi göstermiyor; kümes rozetiyle gösteriyor
- [x] Eşli Kuşlar ekranında sayım dökümü: eşli kuş, aynı kümesde çift, eşi başka kümede, kopuk kayıt, eşsiz kuş
- [x] Gerçekten kopuk çiftleşme kayıtları eksik taraf kimliğiyle ayrı bölümde listeleniyor
- [x] Yavrular ekranı ortak: başka kümesdeki yavru anne/babanın listesinde kalıyor, kümes rozetiyle gösteriliyor
- [ ] Emülatörde (AVD guvercin) canlı doğrulama
- [ ] İsteğe bağlı: filtreli toplu kümes atama

## 0. Alınan kararlar (19.10.2026)

1. **Varsayılan görünüm:** Son seçilen kümes açılır. "Tümü" yalnızca bilinçli
   seçimle gösterilir.
2. **Aşı/ilaç envanteri:** Ortak baz. İlaç ve aşı tanımları tüm kümeslerde
   ortaktır; uygulama kayıtları kuşa bağlıdır.
3. **Kümesler arası eşleştirme:** Uyarılı izin verilir. A kümesi
   incelenirken B kümesinin kuşları listelerde ve yeni eş/ebeveyn
   seçicilerinde görünmez. Ancak mevcut aile bağları kümes değişse de
   korunur; eş, yavru ve ebeveynler detay ekranında kümes rozetiyle görünür.
4. **Kuş taşıma:** Çifti birlikte taşıma seçeneği şimdilik gerekli değil.
5. **Toplu taşıma:** Şimdilik gerekli değil. Mevcut kuşların çoğu tek kümese
   ait; yalnızca "klipssiz / künyesiz" gruptakiler farklı kümese taşınacak.
   Bu kuşlar kuş formundan tek tek atanabilir. İleride isteğe bağlı toplu
   atama eklenebilir.

## 1. Hedef

Tek hesap ve tek veri tabanı içinde, çatıdaki 3 farklı kümesi ayrı isimlerle
tanımlamak; seçilen kümesin kuşlarını, çiftleşmelerini, kuluçkalarını ve
tedavilerini öne çıkarmak. Diğer kümeslerin kayıtları silinmeyecek, yalnızca
aktif görünümün dışında kalacak.

Temel yaklaşım:

- **Tek hesap + tek veri tabanı**: Soy ağacı, akrabalık ve yedekleme bütünlüğü
  korunur.
- **Her kuş tam olarak bir kümese ait**: `bird.coopId`.
- **Kümes bir görünüm filtresidir**, ayrı bir veri tabanı değildir.
- **Varsayılan görünüm son seçilen kümes** olur; "Tümü" seçeneği de bulunur.
- Bir kümes silinirse kuşları silinmez; başka bir kümese taşınır.

Neden ayrı hesap/ayrı Firestore kullanmıyoruz: 200 kuşun soy ağacı, eşleşme ve
yavru kayıtları kümesler arasında referans veriyor. Ayrı hesaplarda bu bağ
kopar, yedek birleştirme ve geçmiş takibi zorlaşır.

## 2. İsimlendirme kararı (önemli)

Mevcut kodda:

- `settings.loftMode` → "Kümes Türü & Çalışma Modu" (saya / posta / hibrit)
- `settings.loftName` → Pedegri başlığındaki resmi kümes/damızlık adı

Yeni özellikte:

- Kod: `coop`, `coops`, `coopId`, `activeCoopId`
- Arayüz: **Kümesler**, **Aktif Kümes**, **Kümes Ataması**

`loftMode` ve `loftName` **yeniden adlandırılmayacak**; eski veri ve pedegri
kodu bozulmasın. Pedegri başlığında öncelik sırası:

1. Aktif kümesin adı
2. `settings.loftName`
3. Varsayılan metin

## 3. Veri modeli

### 3.1 Ayar tarafı

```js
settings: {
  // ... mevcut alanlar
  coops: [
    {
      id: 'coop_ana',          // sabit, rastgele üretilir; varsayılan: coop_ana
      name: 'ANA KÜMES',
      color: '#38bdf8',        // rozet/seçici rengi (opsiyonel ama önerilir)
      order: 0,
      createdAt: '2026-10-19T...'
    }
  ],
  // Kümes bazlı cins (ırk) listeleri; klips renkleri ortak kalır.
  coopCinsi: {
    coop_ana: ['BEYAZ', 'ÇAKAL']
  }
}
```

- En az 1 kümes zorunlu.
- İsimler Türkçe kurallara göre büyük harfe çevrilir (`trUpper`).
- Aynı isim iki kez kullanılamaz.
- `coops` ayarlar belgesinde tutulur; mevcut `settingsPut` ve yedekleme akışıyla
  uyumludur. İleride eşzamanlı düzenleme sorun olursa ayrı `coops`
  koleksiyonuna taşınabilir (v1 için gerekli değil).

### 3.2 Kuş tarafı

```js
bird: {
  // ... mevcut alanlar
  coopId: 'coop_ana'
}
```

- `coopId` yoksa **varsayılan kümes** (`coop_ana`) kabul edilir.
- Bu sayede 200 mevcut kuş için toplu yazma gerekmez; "tembel geçiş" yapılır.
- Kuş düzenlenip kaydedildiğinde `coopId` kalıcı olarak yazılır.
- Klips/künye benzersizliği **kümes bazındadır**: aynı ayak rengi + numara +
  cinsiyet aynı kümesde tekrar edemez; farklı kümeslerde aynı klips (ör.
  SİYAH-SARI 03) farklı kuşlara takılabilir.
- Cins (ırk) listesi de kümes bazındadır: `settings.coopCinsi[coopId]`.
  Bir kümesin cinsleri diğer kümeslerin form ve filtrelerinde görünmez;
  klips renkleri ortaktır.

### 3.3 Türetilen ilişkiler

Ayrı koleksiyonlara `coopId` eklenmez; kümes bilgisi kuştan türetilir:

| Kayıt | Kümesi nasıl bulunur? |
|---|---|
| `pairings` | `maleId` veya `femaleId` kuşunun kümesi |
| `clutches` | `maleId` / `femaleId` kuşunun kümesi |
| `treatments` | `birdId` kuşunun kümesi |
| `vaccinations` | `birdId` kuşunun kümesi |
| `medications` | Ortak envanter (kümes filtresi yok) |

Bu model, kuş taşındığında çiftleşme/kuluçka/tedavi kayıtlarının otomatik
olarak yeni kümeste görünmesini sağlar; ekstra yazma gerekmez.

## 4. Filtreleme mimarisi

### 4.1 Yeni yardımcı dosya: `src/coops.js`

Saf (yan etkisiz) fonksiyonlar:

```js
export const ALL_COOPS = ''            // "Tümü"
export const DEFAULT_COOP_ID = 'coop_ana'

export function coopList(db)            // settings.coops, güvenli varsayılan
export function coopById(db, id)        // bulunamazsa varsayılan
export function birdCoopId(bird)        // coopId || DEFAULT_COOP_ID
export function birdInCoop(bird, coopId) // Tümü ise true
export function scopeDb(db, coopId)     // filtrelenmiş görünüm
export function coopStats(db, coopId)   // dişi/erkek/toplam/eşli
export function coopCinsiList(db, coopId) // kümesin cins (ırk) listesi
export function withCoopCinsi(settings, coopId, list) // cins listesini yaz
export function findCoopRingDuplicate(db, bird, coops) // kümes içi klips çakışması
export function nextCoopName(coops)     // "KÜMES 4" gibi öneri
```

`scopeDb` yalnızca görünümü filtreler, orijinal `db`'yi değiştirmez:

- `birds`: `birdInCoop`
- `pairings`: iki kuştan en az biri kapsamda
- `clutches`: anne/babadan biri kapsamda
- `treatments` / `vaccinations`: `birdId` kapsamda
- `medications`: tümü (ortak envanter)
- `settings`: olduğu gibi

### 4.2 Aktif kümes durumu

- `activeCoopId` App seviyesinde tutulur.
- Cihaz bazlı tercih olarak `localStorage`'a yazılır:
  `guvercin:active_coop`
- İlk açılışta veya kayıtlı kimlik geçersizse ilk kümes seçilir.
- "Tümü" seçilirse tüm veri görünür; varsayılan **değildir**.
- Kümes değiştirilince açık kuş detayı kapanır ve listeye dönülür.

### 4.3 Görünüm verisi

App'te iki ayrı veri tutulur:

```js
const db          // tam veri (kaynak, yazma işlemleri)
const viewDb      // scopeDb(db, activeCoopId) — ekranlara giden
```

- `BirdList`, `Incubation`, `TreatmentBoard`, `Medications` → `viewDb`
- `BirdDetail` → `viewDb` (A kümesi incelenirken B kümesinin eşleri, ebeveynleri
  ve yavruları görünmez) + künye çakışması için tam `db` yalnızca kontrol
  amaçlı kullanılır.
- `BirdForm` → tam `db` (künye çakışması **kümes bazında** kontrol edilir) +
  kümeye göre daraltılmış eş/ebeveyn adayları ve cins listesi.
- "Tümü" seçilirse bütün ilişkiler görünür; kümes seçiliyken katı izolasyon
  uygulanır.

## 5. Ekran ekran değişiklikler

| Dosya / alan | Değişiklik |
|---|---|
| `src/schema.js` | `settings.coops`, `bird.coopId`, `migrate()` varsayılan ataması |
| `src/coops.js` | Yeni saf yardımcılar |
| `src/components/CoopPicker.jsx` | Yeni kümes seçici (Tümü + kümesler), AGENTS modal kurallarına uygun |
| `src/App.jsx` | `activeCoopId`, `viewDb`, `viewStats`, kümes CRUD ve taşıma handler'ları |
| `src/components/BirdList.jsx` | `viewDb` ile çalışır; başlıkta aktif kümes rozeti; sayılar kümes bazlı |
| `src/components/BirdForm.jsx` | "Kümes" alanı; yeni kuşta aktif kümes varsayılan; eş adayları aynı kümes |
| `src/components/BirdDetail.jsx` | Kimlik sekmesinde kümes satırı + "Kümesi değiştir"; başka kümes rozetleri |
| `src/components/Incubation.jsx` | `viewDb`; yeni yavru anne/babanın kümesini miras alır |
| `src/components/TreatmentBoard.jsx` | `viewDb`; tedavi eklerken kuş listesi kümes bazlı |
| `src/components/Medications.jsx` | İlaç envanteri ortak; kuş seçim listeleri kümes bazlı |
| `src/components/Backup.jsx` | "Kümesler" ayar kartı: ekle, yeniden adlandır, renk, sıra, sil, toplu taşı |
| `src/components/PostaPedigreeModal.jsx` | Başlıkta aktif kümes adı |
| `src/notifications.js` | Bildirim metnine kümes adı eklenir |
| `src/activityLog.js` | Kayda `coopId` eklenir; geçmiş isteğe bağlı kümes filtresi |
| `scripts/test-coops.mjs` | Yeni test dosyası, `npm test` içine eklenir |

## 6. Aşamalı yol haritası

### Faz 0 — Kararlar ve tasarım (0,5 gün)

- [ ] Varsayılan görünüm: son seçilen kümes mi, "Tümü" mü?
- [ ] İlaç/aşı envanteri ortak mı, kümes bazlı mı?
- [ ] Kümesler arası eşleştirme: serbest / uyarılı / kapalı?
- [ ] Kuş taşırken çifti birlikte taşıma seçeneği olsun mu?
- [ ] Mevcut 200 kuşu bölmek için toplu taşıma aracı gerekli mi?
- [ ] Ekran taslakları ve buton yerleşimi onayı

**Çıktı:** net kararlar, onaylanmış bu doküman.

### Faz 1 — Veri katmanı ve geçiş (1,5 gün)

- [ ] `settings.coops` şeması ve varsayılan `coop_ana`
- [ ] `bird.coopId` alanı; eksikse varsayılana düşme
- [ ] `migrate()` içinde eski kayıt/yedek uyumluluğu
- [ ] `src/coops.js` saf yardımcıları
- [ ] `scopeDb` ve `coopStats`
- [ ] `scripts/test-coops.mjs`:
  - eski veride varsayılan kümes oluşumu
  - eksik `coopId` → varsayılan
  - geçersiz `coopId` → varsayılan
  - filtrelerin doğruluğu
  - orijinal `db`'nin değişmemesi
  - yedek al/geri yükle turu
- [ ] `npm test` yeşil

**Çıktı:** görünür arayüz olmadan veri katmanı hazır ve testli.

### Faz 2 — Çekirdek arayüz (2,5 gün)

- [ ] `CoopPicker` bileşeni (masaüstü üst bar + mobil kompakt seçici)
- [ ] App'te `activeCoopId` ve `localStorage` kalıcılığı
- [ ] `viewDb` / `viewStats` ile listeyi kümes bazlı gösterme
- [ ] `BirdList`: aktif kümes rozeti, kümes bazlı sayaçlar ve boş durum
- [ ] `BirdForm`: kümes alanı, yeni kuşta aktif kümes, eş adaylarını daraltma
- [ ] `BirdDetail`: kümes bilgisi ve hızlı taşıma
- [ ] "Tümü" görünümünün doğru çalışması
- [ ] Kümes değişince liste/scroll durumunun sıfırlanması

**Çıktı:** Kuşlar sekmesi 3 kümesle günlük kullanılabilir.

### Faz 3 — İlgili ekranlar (2 gün)

- [ ] `Incubation`: kuluçkalar kümes bazlı; yeni yavru kümesi miras alır
- [ ] `TreatmentBoard`: hasta kuşlar ve tedaviler kümes bazlı
- [ ] `Medications`: kuş seçimleri kümes bazlı, envanter ortak
- [ ] `PostaPedigreeModal`: aktif kümes adı
- [ ] Bildirimlerde kümes adı
- [ ] İşlem geçmişinde kümes bilgisi/filtresi
- [ ] Kümesler arası eşleşme uyarısı ve rozeti

**Çıktı:** Tüm operasyon ekranları aktif kümesle tutarlı.

### Faz 4 — Kümes yönetimi (1 gün)

- [ ] `Backup` içinde "Kümesler" kartı:
  - kümes ekle / yeniden adlandır / renk / sıra
  - kuş sayısı ve doluluk özeti
  - silme: kuşları hedef kümese taşıma zorunluluğu
  - son kümes silinemez
- [ ] Kuş detayında "Kümesi değiştir" (tek kuş)
- [ ] Çiftleşmiş kuş taşınırken uyarı; çifti birlikte taşıma şimdilik yok
- [ ] İsteğe bağlı (ileride): filtreli toplu kümes atama

**Çıktı:** 3 kümes yönetilebilir; klipssiz kuşlar tek tek atanabilir.

### Faz 5 — Test, doğrulama ve yayın (1,5 gün)

- [ ] `npm test` ve `npm run test:electron`
- [ ] Emülatörde (`guvercin`, `emulator-5554`) APK doğrulaması:
  - 3 kümes oluşturma
  - kuş ekleme ve kümes atama
  - filtre geçişleri
  - toplu taşıma
  - yedek al/geri yükle
- [ ] Sürüm numarası ve sürüm geçmişi güncellemesi
- [ ] Ekran görüntüleri
- [ ] OTA/Capgo yayını **kullanıcı onayıyla**

**Çıktı:** yayına hazır sürüm.

## 7. Geçiş (migration) ve yedekleme

### İlk açılış

1. `settings.coops` yoksa `coop_ana` / "ANA KÜMES" oluşturulur.
2. `coopId` olmayan tüm kuşlar okuma sırasında bu kümese ait kabul edilir.
3. Kullanıcıya tek seferlik bilgi çubuğu:
   "Kümesler eklendi. Ayarlar → Kümesler'den isimleri düzenleyebilirsiniz."
4. İsim, `settings.loftName` doluysa oradan alınır; değilse "ANA KÜMES".

### Yedek

- `exportJson()` zaten `migrate()` kullandığı için `coops` ve `coopId` yedeğe
  girer.
- Eski yedeklerde `coops` yoksa içe aktarmada varsayılan kümes üretilir.
- Yedekteki `coopId` mevcut kümes listesinde yoksa ilk kümese bağlanır.
- `importJson()` sil-then-write davranışı korunur; sessizce değiştirilmez.
- Yedekte kümes adları boş/çok uzunsa kırpılır ve tekilleştirilir.

## 8. Kurallar ve uç durumlar

- [x] Bir kuş yalnızca bir kümese ait olabilir.
- [x] Aynı klips + numara + cinsiyet AYNI KÜMESTE benzersizdir; farklı kümeslerde serbesttir.
- [x] Cins (ırk) listesi kümes bazındadır; bir kümesin cinsleri diğerinde görünmez.
- [ ] Kümes silinirse kuşlar hedef kümese taşınır; kuş silinmez.
- [ ] Son kümes silinemez.
- [ ] "Tümü" görünümünde tüm sayaçlar globaldir.
- [ ] Aktif kümesdeyken başka kümesin kuşu açılırsa (geçmiş, bildirim,
  akrabalık bağlantısı) aktif kümes otomatik o kümesе geçer veya kuş geçici
  olarak gösterilir; tercih Faz 0'da netleşecek.
- [ ] Aynı kümes içindeki eşleşmeler varsayılan; kümesler arası eşleşme
  uyarılı ve rozetli.
- [ ] Yeni kuş, aktif kümes "Tümü" ise ilk kümese atanır; kullanıcı değiştirebilir.
- [ ] Yavru, anne/babanın kümesini miras alır; ebeveynler farklı kümeslerdeyse
  seçim istenir.
- [ ] Pedegri başlığı aktif kümes adını kullanır.
- [ ] Silinen kümesin eski `coopId`'si hiçbir kuşta kalmaz.

## 9. Test ve kabul kriterleri

- [ ] `npm test` içinde `test-coops.mjs` çalışır ve geçer.
- [ ] 3 kümes oluşturulup 200 kuş dağıtıldığında liste her kümesde doğru
  sayıyı gösterir.
- [ ] Kümes değişimi 100 ms altında hissedilir (200 kuş için istemci filtresi).
- [ ] Kümes filtresi; kuş listesi, sayaçlar, kuluçka, tedavi ve ilaç kuş
  seçicilerinde tutarlıdır.
- [ ] Eski yedek sorunsuz yüklenir; hiçbir kuş kaybolmaz.
- [ ] Kümes silme/taşıma sonrası veri kaybı olmaz.
- [ ] Çevrimdışı çalışma ve Firestore eşitlemesi bozulmaz.
- [ ] Emülatörde ekran görüntüleriyle doğrulanır.

## 10. Riskler ve önlemler

| Risk | Önlem |
|---|---|
| `loftMode` / `loftName` ile isim karışıklığı | Kodda `coop`, arayüzde "Kümesler"; eski alanlara dokunmama |
| Bir ekranın `viewDb` yerine `db` kullanması | Ekran geçişlerinde tek tek kontrol; kabul testi |
| Kümesler arası eşleşmede soy karmaşası | Uyarı + rozet; varsayılan aynı kümes |
| Ayar dokümanında eşzamanlı düzenleme | v1'de kabul; ileride ayrı `coops` koleksiyonu |
| 200 kuşu elle bölme zorluğu | Faz 4 toplu taşıma aracı |
| Kümes silmede veri kaybı | Zorunlu hedef kümes + onay + test |
| Eski yedeklerin bozulması | `migrate()` + yedek turu testi |

## 11. Tahmini efor

| Faz | Süre |
|---|---|
| Faz 0 — Kararlar | 0,5 gün |
| Faz 1 — Veri katmanı | 1,5 gün |
| Faz 2 — Çekirdek arayüz | 2,5 gün |
| Faz 3 — İlgili ekranlar | 2 gün |
| Faz 4 — Yönetim | 1 gün |
| Faz 5 — Test + yayın | 1,5 gün |
| **Toplam** | **~8 iş günü** |

## 12. Önerilen ilk sürüm (MVP) sınırı

MVP'de mutlaka olmalı:

- Kümes listesi ve seçici
- `bird.coopId` + migration
- Kuş listesi, sayaçlar ve kuş formunda kümes
- Kuluçka ve tedavi ekranlarında kümes filtresi
- Kümes ekleme/yeniden adlandırma
- Yedek uyumluluğu

MVP'ye bırakılabilecekler:

- Toplu taşıma sihirbazı (Faz 4)
- İşlem geçmişinde kümes filtresi
- Kümes bazlı ilaç envanteri
- Kümesler arası eşleştirme için gelişmiş kurallar
- Ayrı `coops` koleksiyonuna geçiş
