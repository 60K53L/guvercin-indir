# GÜVERCİN SOY, ÜRETİM VE SAĞLIK TAKİP SİSTEMİ
## Geliştirme, Özellik ve Kullanım Rehberi

> **Amaç:** İki kardeşin (Göksel ve abisinin) aynı kümeste güvercin beslerken; damızlık eşleştirmelerini, akrabalık (kan) bağlarını, kuluçka ve yavru çıkımlarını ve sağlık/aşılama süreçlerini eksiksiz kayıt altına almasını sağlamak.

---

### 🌐 Canlı Uygulama Adresi
* **Web Sitesi:** [https://guvercin-beta-dev.web.app](https://guvercin-beta-dev.web.app)
* **Kullanıcı Hesabı:** `tekvandobiliyorum@gmail.com`
* **Mevcut Kayıtlar:** 57 Kuş, 11 Çiftleşme, 5 İlaç/Tedavi ve Kümes Ayarları (GÖKSEL) aktarılmıştır.

---

## 🚀 Eklenen Yeni Modüller ve Özellikler

### 1. 🪹 Kuluçka & Üretim Takip Modülü (Yeni Ana Sekme)
Güvercin yetiştiriciliğinde üretimin başlangıç noktası yumurtadır. Bu modül sayesinde folluklar ve yumurta takibi adım adım izlenir:

* **Folluk / Yuvalık No Kaydı:**
  * Her kuluçka için yuva numarası (Örn: *Folluk 1, Yuva 3, Dolap 2*) girilir.
* **Hızlı Eş Seçimi:**
  * Kümesteki hazır eşleşmiş çiftlerden tek tıkla seçim yapılabilir ya da bağımsız erkek/dişi atanabilir.
* **Otomatik Tarih Hesaplamaları & Geri Sayım:**
  * **1. Yumurta ve 2. Yumurta Tarihleri:** Kuluçka başlangıcı 2. yumurtadan itibaren hesaplanır.
  * **Döl Kontrol Tarihi (6. Gün):** Yumurtanın ışıkla kontrol edilip dolu/boş ayrımının yapılacağı gün otomatik belirlenir.
  * **Tahmini Çıkım Tarihi (18. Gün):** Kuluçka sürecinin geri sayım sayacı çalışır:
    * *Çıkıma X Gün Kaldı (18 Günlük Süreçte Y. Gün)*
    * *🔔 BUGÜN ÇIKIM GÜNÜ! (Yeşil Alarm)*
  * **Künye / Bilezik Takma Alarmı (Çıkımdan 7 Gün Sonra):**
    * Güvercin yavrusunun ayağı kalınlaşmadan künyesinin takılması hayati önem taşır. Çıkımdan sonraki 6-8. günlerde sistem:
    * *💍 BUGÜN KÜNYE / BİLEZİK TAKMA ZAMANI! (Kırmızı Vurgulu Rozet)* uyarısı verir.
  * **Yeme Düşme / Ayırma Tarihi (30. Gün):** Yavrunun bağımsızlaşacağı tarih otomatik listelenir.
* **Sihirli "Bu Yuvadan Yavru Kuş Kaydet" Butonu:**
  * Yavru çıktığında bu butona tıklandığında; **Baba**, **Anne**, **Doğum Tarihi** ve **Durumu** otomatik doldurulmuş olarak yeni kuş kayıt formu açılır. Tekrar tekrar anne-baba seçmeye gerek kalmaz!

---

### 2. 🕊️ Sanal Eşleştirme & Akrabalık Simülatörü (Yeni Ana Sekme)
Kuşları fiziksel olarak aynı göze kapatmadan önce bilgisayar ortamında kan uyumunu test etmenizi sağlar:

* **Yan Yana Karşılaştırma:**
  * Kümesteki damızlık erkek ve dişi kuşlar seçilir.
  * Kuşların ırkı, rengi, soy hattı ve şu an başka bir kuşla eşli olup olmadıkları gösterilir.
* **Wright Akrabalık Katsayısı ($F_x$) ve Yüzde Analizi:**
  * İki kuşun tüm soy kütüğü taranarak akrabalık derecesi hesaplanır:
    * **%0 (Yeşil - Güvenli):** *Temiz Kan / Yabancı Eşleşme.* Maksimum hibrit canlılığı (heterozis) ve bağışıklık gücü.
    * **%1 - %6 (Açık Mavi):** *Uzak Akraba.* Güvenli eşleşme.
    * **%6.25 - %12.5 (Sarı - Çizgi Yetiştiriciliği / Linebreeding):** *Kan Sabitleme.* Belirli bir soyun üstün özelliklerini korumak için kuşçulukta bilinçli yapılan ideal seviye.
    * **%12.5 - %25 (Turuncu - Yakın Akraba):** *Yarı Kardeş / Dede-Torun.* Dikkatli olunması gereken seviye.
    * **>%25 (Kırmızı - Aşırı Yakın Akraba / Yüksek Risk):** *Öz Kardeş, Ana-Oğul veya Baba-Kız.* Genetik sakatlık, bağışıklık çöküşü ve kısırlık riski uyarısı.
* **Doğrudan Akrabalık Etiketi:**
  * İki kuş birbirinin doğrudan neyi (Örn: *BABASI, ANNESİ, KARDEŞİ, BABASININ EŞİ*) anında gösterilir.
* **Ortak Atalar Tablosu:**
  * Her iki kuşun da soy ağacında yer alan ortak atalar tek tek listelenir (Hangi atadan kaçıncı kuşakta kan aldıkları yol haritasıyla belirtilir).
* **❤️ Bu Çifti Kümeste Eşleştir Butonu:**
  * Simülasyon sonucu beğenildiğinde tek tıkla kümeste resmi eş olarak kaydedilir.

---

### 3. 💉 İlaç & Tarihli Aşılama Takibi (Geliştirilen İlaçlar Sekmesi)
İlaçlar sekmesi iki güçlü bölüme ayrıldı:

1. **📖 İlaç Rehberi & Dozaj:**
   * İlaç adı, etken maddesi, kullanım amacı, muadili, insan/hayvan ilacı ayrımı ve litre/kuş başı dozaj bilgileri.
2. **💉 Aşı & Uygulama Kayıtları:**
   * **Uygulama Tarihi:** Aşının yapıldığı gün.
   * **Aşı / İlaç Adı:** PMV-1 Veba, Çiçek, Salmonella (Paratifo), İç Parazit vb.
   * **Kime Uygulandı?:**
     * *🏠 Tüm Kümese (Toplu Uygulama)* VEYA
     * *🕊️ Seçili Kuşlara:* Kuş listesinden tek tek seçilen damızlıklar (künye rozetleriyle listelenir).
   * **Dozaj & Yöntem:** (Örn: *Deri altı 0.25 ml*, *1 lt suya 2 gr*).
   * **Uygulayan Kişi:** Kimin aşıladığı (*Göksel*, *Abim* vb.) — iki kardeşin ortak takibinde karışıklığı önler.
   * **Bir Sonraki Tekrar Tarihi & Alarm:**
     * Tekrar zamanına 15 gün kala sarı bildirim, günü geçtiğinde kırmızı alarm rozeti görünür.

---

### 4. 👥 İki Kardeş İçin Ortak Kümes Kullanım Kolaylıkları
* **Anlık Çift Yönlü Senkronizasyon:**
  * Abiniz veya siz telefonunuzdan/bilgisayarınızdan bir yumurta, aşı veya kuş girdiğinizde Firestore gerçek zamanlı dinleyicisi sayesinde diğer cihazda sayfa yenilemeye gerek kalmadan bilgi anında güncellenir.
* **Mobil Uyumluluk & Yatay Kayar Menü:**
  * Kümesteyken telefon ekranında sekmeler ezilmez; parmakla rahat kaydırılabilir ve butonlar tek elle dokunmaya uygun büyüklüktedir.

### 5. 🎨 Yeni Eklenen Renk Temaları ve Görsel Dokunuşlar
* **Yeni Temalar (Yedekleme / Ayarlar sekmesinde):**
  * **Dumanlı (Pigeon Slate & Sapphire):** Güvercin tüyü rengi mat antrasit zemin, platin paneller ve canlı safir mavisi vurgular.
  * **Saray (Loft Walnut & Amber):** Sıcak ahşap/ceviz zemin, bal rengi ve kehribar altın detaylar. Geleneksel doğal kümes hissi.
  * *(Mevcut Temalar: Lacivert, Zümrüt, Aydınlık, Kızıl, Gökyüzü).*
* **Görsel Dokunuşlar (UI Polish):**
  * Üst başlığa şık güvercin ikonu ve `BETA` rozeti (`🕊️ GÜVERCİN SOY TAKİP · BETA`).
  * Kart ve panel köşeleri yumuşatılmış `12px` modern derinlik ve hafif gölgelerle zenginleştirildi.
  * Sayaç kartları (Kuş, Erkek, Dişi, Eşli) lüks gösterge paneli formatına kavuşturuldu.
  * Butonlara yumuşak basılma ve hover efektleri eklendi.

---

## 📋 Ekranlar ve Menü Özeti

| Menü Başlığı | İçerik ve İşlev |
| :--- | :--- |
| **Kuşlar** | 57 kuşun künye, cinsiyet, soy, renk ve durum listesi; detay sayfası ve soy ağacı |
| **Kuluçka & Üretim** | Folluklar, 1./2. yumurta tarihleri, kuluçka geri sayımı, döl kontrolü ve künye takma alarmı |
| **Eşleştirme Simülatörü** | Sanal eş denemesi, Wright akrabalık katsayısı ($F_x$), ortak ata listesi ve risk dereceleri |
| **İlaçlar & Aşılar** | Hastalık tedavi dozaj rehberi + Tarihli kümes aşılama/ilaçlama kayıtları ve tekrar alarmları |
| **Yedekleme / Ayarlar** | Veritabanını tek tıkla JSON indirme, künye kodları, ırk listesi ve 7 farklı renk teması |

---

*Belge Tarihi: 13.10.2026*  
*Geliştirme Dizini: `E:\Code\GUVERCIN_BETA`*  
*Yayın Projesi: Firebase `guvercin-beta-dev`*
