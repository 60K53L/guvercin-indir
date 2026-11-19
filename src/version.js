export const APP_VERSION = '1.0.49'
export const BUILD_TIME = '20261119-1325'

/**
 * Herkese açık indirme bağlantıları.
 *
 * Firebase Hosting (Spark / ücretsiz plan) çalıştırılabilir dosya (APK)
 * barındırmadığı için APK, herkese açık bir GitHub deposunun sürüm ekinde
 * tutulur. "releases/latest/download/guvercin.apk" bağlantısı sabittir ve
 * her yeni sürümde en güncel APK'yı verir.
 */
export const APK_DOWNLOAD_URL =
  'https://github.com/60K53L/guvercin-indir/releases/latest/download/guvercin.apk'

/**
 * Sürüme göre değişiklik listesi (sürüm anahtarlı sözlük).
 *
 * ÖNEMLİ: Bu NESNE kümülatif bir liste DEĞİLDİR. "Bu güncellemede neler var"
 * penceresi yalnızca ilgili sürümün maddelerini gösterir. Eskiden tek bir
 * dizi tutuluyor ve yayın betiği TÜM diziyi version.json'a yazıyordu; bu
 * yüzden pencere her sürümde geçmişi de gösterip 10+ maddelik uzun liste
 * oluyordu.
 *
 * Yeni sürüm çıkarırken: APP_VERSION'ı artır ve buraya 'X.Y.Z' anahtarıyla
 * SADECE o sürümün yeniliklerini ekle.
 */
export const CHANGELOG = {
  '1.0.49': [
    "İLAÇLAR & AŞILAR SEKMESİNE İLAÇ/AŞI/TAKVİYE TÜR SEÇİMİ VE FİLTRELEME EKLENDİ; ARAMA VE HASTALIK SEÇİMİ DAHA FERAH VE KULLANIŞLI HALE GETİRİLDİ",
    "AŞI UYGULAMA KARTINA DİĞER/ÖZEL HEDEF SEÇENEĞİ VE ELLE GİRİŞ ALANI EKLENDİ; İLAÇ KARTLARI RENK ŞERİTLERİ VE BELİRGİN BAŞLIKLARLA YENİLENDİ"
  ],
  '1.0.44': [
    "ANNE/BABA SEÇİCİSİNE KÜMES FİLTRESİ EKLENDİ: UÇAN SAYA GİBİ BİR KÜMESTE KAYIT YAPARKEN BAŞKA KÜMESLERDEKİ ERKEK VE DİŞİ KUŞLAR DA SEÇİLEBİLİYOR",
    "KUŞ LİSTESİNDEKİ ALT SATIR BİLGİLERİ (AD, AYIRICI İŞARET, HAT/SOY, NOTLAR) FARKLI RENKLERLE GÖSTERİLİYOR; TEMALARA UYUMLU, YAZILAR KAYBOLMUYOR"
  ],
  '1.0.43': [
    "EŞ ATAMA PENCERESİNDE TÜM KÜMESLERDE HALİHAZIRDA EŞİ OLAN KUŞLARIN LİSTELENMESİ ENGELLENDİ; EŞLİ DİŞİ VE ERKEK KUŞLAR ADAY LİSTESİNDEN KALDIRILDI"
  ],
  '1.0.42': [
    "EŞLİ KUŞLAR BUTONUNA ÇİFT ADEDİ EKLENDİ; ÜST SATIRDA TOPLAM EŞLİ KUŞ SAYISI, ALT SATIRDA (X ÇİFT) OLARAK AYRI YAZILIYOR"
  ],
  '1.0.41': [
    "SOY AĞACI (PEDİGRE) GÖRÜNÜMÜ ORANTILANDI; KUŞ, 1. NESİL VE 2. NESİL GENİŞLİKLERİ DENGELENDİ, ANNE VE BABA BİLGİLERİ DAHA OKUNAKLI VE BELİRGİN HALE GETİRİLDİ",
    "KUŞLAR ARASI GEZİNME GEÇMİŞİ VE SABİT GERİ BUTONU EKLENDİ; YAVRU YA DA SOY AĞACINDA GEZİNİRKEN LİSTEYE DÖNMEDEN BİR ÖNCEKİ KUŞA ADIYLA TEK TIKLA DÖNÜLEBİLİYOR"
  ],
  '1.0.40-prev': [
    "DÜZ BEYAZ MISRİ VE MAVİ KANAT MISRİ IRK GÖRSELLERİ EKLENDİ; MISRİ AİLESİ VARYASYONLARI TAMAMLANDI"
  ],
  '1.0.39': [
    "ÜYE KAYIT DEFTERİ CİHAZ BAZLI HALE GETİRİLDİ; AYNI HESAP FARKLI CİHAZ/PLATFORMLARDA AYRI KAYIT OLARAK GÖRÜNÜYOR"
  ],
  '1.0.37': [
    "ÜYE KAYIT VE SÜRÜM TAKİBİ EKLENDİ; YÖNETİM PANELİNDEN YENİ ÜYELER, E-POSTA, UYGULAMA SÜRÜMÜ VE PLATFORM BİLGİSİ GÖRÜNTÜLENEBİLİYOR"
  ],
  '1.0.36': [
    "İLAÇ & AŞI SEKMESİNE TAKVİYELER & YEMLER ALT SEKMESİ EKLENDİ; TAKVİYE VE YEM KAYITLARI AYRI TUTULUYOR, ARANABİLİYOR VE KARTLARDAN DÜZENLENEBİLİYOR",
    "ANNE/BABA SEÇİM PENCERESİNİN ALTINA KAÇTI / SATILDI / ÖLDÜ SEÇENEKLERİ EKLENDİ; SEÇİLİNCE EBEVEYN BİLGİSİ ELLE YAZILABİLİYOR VE KAYITTA \"KAÇTI - AÇIK SARI BOZALI\" GİBİ GÖSTERİLİYOR"
  ],
  '1.0.35': [
    "KUŞ FORMUNDA CİNSİYET SEÇİM LİSTESİ KOYU ARKA PLAN İLE GÖSTERİLİYOR; YENİ CİNS EKLEME PENCERESİNDE YAZI ALANINA TIKLAYINCA PENCERE KAPANMIYOR",
    "SOL VE SAĞ AYAK KLİPS KARTLARI HER İKİ AYAKTA AYNI GENİŞLİKTE VE HİZALI GÖSTERİLİYOR; UZUN KLİPS ADLARI KARTA SIĞACAK ŞEKİLDE OTOMATİK KÜÇÜLÜYOR"
  ],
  '1.0.34': [
    "KUŞ FORMUNDA CİNSİYET SEÇİM LİSTESİ KOYU TEMA İLE GÖSTERİLİYOR; CİNSİ SEÇİM PENCERESİNDE YENİ CİNS YAZARKEN PENCERE KAPANMIYOR"
  ],
  '1.0.33': [
    "YAVRULAR TABLOSU SÜTUNLARI EKRANDAN ÖLÇÜLÜR; ARALARINDAKİ BOŞLUKLAR BİREBİR EŞİT OLUR VE ARTA KALAN ALAN SONDA TOPLANIR",
    "YAVRULAR VE TORUNLAR TABLOLARI AYNI SÜTUN GENİŞLİKLERİNİ PAYLAŞIR; SÜTUN BAŞLIKLARI SATIRLARLA KAYMAZ",
    "YAVRULAR TABLOSUNDA CİNSİYET VE KÜMES ÇERÇEVELERİ EŞİT BOYUTLU; YAZILAR ÇERÇEVE İÇİNDE VE SÜTUN BAŞLIĞININ ALTINDA ORTALANIYOR",
    "YAVRULAR TABLOSU SÜTUNLARI İÇERİĞE GÖRE SABİT PİX GENİŞLİĞE AYARLANDI; ARTA KALAN BOŞLUK SON SÜTUNDA TOPLANIYOR, YAVRULAR VE TORUNLAR TABLOLARI AYNI HIZAYI KORUYOR",
    "YAVRULAR TABLOSUNDA KÜNYE KARTLARI 200 PİX GENİŞLİĞE ÇIKARILDI; UZUN KÜNYE ADLARI GERÇEK METİN ÖLÇÜMÜYLE KARTA SIĞACAK ŞEKİLDE OTOMATİK KÜÇÜLTÜLÜYOR"
  ],
  '1.0.32': [
    "YAVRULAR TABLOSUNDA KÜNYE–AD–BABASI–CİNSİYET SÜTUNLARI SOLA YAKLAŞTIRILDI; GEREKSİZ BOŞLUKLAR AZALTILDI, KÜNYE KARTLARI EŞİT GENİŞLİKTE VE METİN OTOMATİK BOYUTLANDIRILIYOR"
  ],
  '1.0.31': [
    "KUŞ LİSTESİ SONUÇ SAYISINDA ÖLEN/KAÇTI/SATILDI KUŞLAR SAYILMIYOR; TOPLAM SADECE MEVCUT KUŞLARI KAPSIYOR",
    "ÖLEN / KAÇTI / SATILDI GRUBUNUN ALTINA \"BURADAKİ KUŞLAR TOPLAM HESABA DAHİL DEĞİLDİR\" BİLGİ NOTU EKLENDİ",
    "YAVRULAR TABLOSUNDAKİ KÜNYE KARTLARI AYNI BOYUTTA VE METİN ORTALI GÖSTERİLİYOR"
  ],
  '1.0.30': [
    "OTA GÜNCELLEME PENCERESİNDE YENİLİK LİSTESİ VARSAYILAN OLARAK İLK 2 MADDEYLE SINIRLANDI; KALAN MADDELER AŞAĞI OK (▼) İLE AÇILIP KAPANABİLİYOR"
  ],
  '1.0.29': [
    "DOĞRUDAN YAVRULAR VE TORUNLAR AYRI KARTLARDA GÖSTERİLİYOR; TORUNLAR BÖLÜMÜ ALT KART OLARAK AYRILDI",
    "YAVRULAR TABLOSUNA AYRI KÜMES SÜTUNU EKLENDİ; KUŞUN BULUNDUĞU KÜMES ROZET OLARAK ORADA GÖSTERİLİYOR, AD HÜCRESİNDEN KÜMES ROZETİ KALDIRILDI",
    "YAVRULAR TABLOSUNA BABASI SÜTUNU EKLENDİ; BABANIN MEVCUT KÜNYESİ VE VARSA ADI TEK PARÇA GÖSTERİLİYOR (ÖR. BEYAZ KLİPS-GC BABAÇ)",
    "YAVRULAR LİSTESİ BABALARIN YAVRU SAYISINA GÖRE SIRALANIYOR; EN ÇOK YAVRUSU OLAN BABA ÖNCE GELİYOR",
    "GENİŞ WEBAPP TABLOSUNDA KÜNYE–AD ARASI DARALTILDI; AD VE CİNSİYET SÜTUNLARI HİZALI KALDI",
    "YAVRULAR EKRANINDA KÜMES VE BABASI BİLGİLERİ MOBİL KARTLARDA AYRI SATIR OLARAK EKLENDİ"
  ],
  '1.0.28': [
    "CİNS (IRK) LİSTESİ ARTIK KÜMES BAZINDA TUTULUYOR; BİR KÜMESTE EKLENEN CİNSLER DİĞER KÜMESLERİN FORM VE FİLTRELERİNDE GÖRÜNMÜYOR",
    "KÜMES AYARLARINDA HER KÜMES İÇİN AYRI CİNS LİSTESİ DÜZENLENEBİLİYOR; KLİPS RENKLERİ ORTAK KALMAYA DEVAM EDİYOR",
    "AYNI KLİPS (ÖR. SİYAH-SARI) ARTIK FARKLI KÜMESLERDE FARKLI KUŞLARA TAKILABİLİYOR; TEKİLLİK KONTROLÜ KÜMES BAZINDA YAPILIYOR",
    "DURUM ADI \"UÇAN KÜMESİ\" YERİNE \"UÇAN KUŞ\" OLARAK GÖSTERİLİYOR; KAYITLI DEĞER VE ESKİ KAYITLAR DEĞİŞMEDİ",
    "EŞLİ KUŞLAR EKRANI EŞİ BAŞKA KÜMEDE OLAN KUŞU \"SİLİNMİŞ\" GİBİ GÖSTERMİYOR; KÜMES ROZETİYLE BİRLİKTE GERÇEK KUŞ OLARAK LİSTELENİYOR",
    "EŞLİ KUŞLAR EKRANINA SAYIM DÖKÜMÜ EKLENDİ: EŞLİ KUŞ, AYNI KÜMESDE ÇİFT, EŞİ BAŞKA KÜMEDE, KOPUK KAYIT VE EŞSİZ KUŞ SAYILARI AYRI AYRI GÖSTERİLİYOR",
    "KUŞU GERÇEKTEN SİLİNMİŞ ÇİFTLEŞME KAYITLARI AYRI BÖLÜMDE, EKSİK TARAFIN KİMLİĞİYLE LİSTELENİYOR; EŞİ OLMAYAN KUŞLARIN TAM LISTESI DE GÖSTERİLİYOR",
    "YAVRULAR EKRANI ORTAK: BAŞKA KÜMESE TAŞINAN YAVRU ANNE/BABANIN YAVRULAR VE EŞLİ KUŞLAR LİSTESİNDE KALIYOR; YANINDA KÜMES ROZETİ GÖSTERİLİYOR",
    "EŞLİ KUŞLAR PENCERESİNDEKİ AÇIKLAMA, SAYIM VE BÖLÜM BAŞLIKLARI ORTALANDI; KAPAT DÜĞMESİ TAM GENİŞLİK VE ORTALI HALE GETİRİLDİ"
  ],
  '1.0.27': [
    "KÜMES DEĞİŞTİRİLDİĞİNDE EŞ, YAVRU VE EBEVEYNLERLE SOY BAĞI KORUNUYOR; DİĞER KÜMESTEKİ AKRABALAR KUŞ DETAYINDA KÜMES ROZETİYLE GÖRÜNÜYOR",
    "ESKİ KÜMESTE KALAN YAVRULARIN BABA/ANNE BİLGİSİ ARTIK \"BİLİNMİYOR\" GÖRÜNMÜYOR; SOY AĞACI, KARDEŞLER VE AKRABALAR TAM VERİDEN HESAPLANIYOR",
    "KUŞ FORMUNDA BAŞKA KÜMESTEKİ MEVCUT ANNE/BABA SEÇİLİ KALIYOR; \"BAŞKA KÜMES\" ETİKETİ VE UYARI GÖSTERİLİYOR, KAYDETMEDE BAĞ KOPMUYOR",
    "EŞLİ KUŞ SAYACI, EŞİ BAŞKA KÜMESTE OLAN KUŞU DA EŞLİ SAYIYOR"
  ],
  '1.0.26': [
    "ÇOKLU KÜMES DESTEĞİ: AYNI HESAPTA 3 AYRI KÜMES TANIMLANABİLİYOR; ÜST ÇUBUKTAN KÜMES SEÇİLEREK YALNIZCA O KÜMESİN KUŞLARI VE KAYITLARI GÖSTERİLİYOR",
    "KÜMES AYARLARI KARTI: KÜMES EKLEME, ADLANDIRMA, RENK SEÇME, SIRALAMA VE SİLME; SİLİNEN KÜMESİN KUŞLARI SEÇİLEN HEDEF KÜMESE TAŞINIYOR",
    "SON SEÇİLEN KÜMES HATIRLANIYOR; \"TÜM KÜMESLER\" GÖRÜNÜMÜ İSTEĞE BAĞLI VE VARSAYILAN DEĞİL",
    "KUŞ KİMLİK KARTINDA KÜMES DEĞİŞTİRİLİRKEN ONAY PENCERESİ GÖSTERİLİYOR; EŞLEŞME, KULUÇKA, TEDAVİ VE AŞI KAYITLARININ NASIL ETKİLENECEĞİ AÇIKLANIYOR",
    "KUŞ FORMUNDA KÜMES ALANI, KÜMESE GÖRE EŞ/EBEVEYN SEÇİCİLERİ VE FARKLI KÜMESTEN EŞ SEÇİMİNDE UYARI EKLENDİ",
    "KUŞ LİSTESİNDE AKTİF KÜMES BANDI VE SONUÇ SAYISI GÖSTERİLİYOR; DİĞER KÜMESLERİN KUŞLARI LİSTELERDE VE SEÇİCİLERDE GÖRÜNMÜYOR"
  ],
  '1.0.25': [
    "ESKİ EŞLER LİSTESİNDE OLUŞAN MÜKERRER KAYITLAR VE SAHTE EŞLEŞMELER TEMİZLENDİ; TÜM YAVRULAR KORUNARAK TEKİLLEŞTİRİLDİ",
    "KUŞ DÜZENLENDİĞİNDE MEVCUT EŞİN TEKRAR ESKİ EŞLERE DÜŞMESİ VE ÇİFTLEŞME KOPYALARI OLUŞMASI ENGELLENDİ",
    "YENİ YAVRU KAYDEDİLİRKEN ANNE VE BABANIN HALİHAZIRDAKİ MEVCUT EVLİLİĞİNİN BOZULMASI ÖNLENDİ",
    "ESKİ EŞ EKLEME SEÇİCİSİNDE KUŞUN HALİHAZIRDAKİ MEVCUT EŞİNİN LİSTELENMESİ ENGELLENDİ",
    "ESKİ EŞ VE EŞLEŞME PENCERELERİ MODAL VE BUTON DÜZENİ STANDARTLARA UYGUN OLARAK YENİLENDİ"
  ],
  '1.0.24': [
    "DURUM FİLTRESİNDE KAÇTI, ÖLÜ VE SATILDI SEÇENEKLERİ EN ALTA TAŞINDI; AKTİF DURUMLAR LİSTEDE ÖNCELİKLİ SIRALANIYOR",
    "KULUÇKA KARTLARINDA POPUP KALDIRILDI; DETAYLAR KUŞLAR SEKMESİNDEKİ GİBİ DOĞRUDAN AŞAĞI AÇILAN AKORDİYON KART ŞEKLİNDE AÇILIYOR",
    "KULUÇKA KARTINDA ANNE VE BABA BİLGİLERİ YAN YANA TEK SATIRI PAYLAŞACAK VE YAZILARI DİKEY/YATAY TAM ORTALANACAK ŞEKİLDE DÜZENLENDİ",
    "KULUÇKA HIZLI SONUÇ BUTONLARI (1 YAVRU ÇIKTI, 2 YAVRU ÇIKTI, BOŞ ÇIKTI, KIRILDI) TEK SATIRDA EŞİT 4 SÜTUN OLARAK HİZALANDI",
    "GENİŞ KÜNYE VE KLİPSLERİN KARTLARDAN TAŞMASINI ENGELLEYEN OTOMATİK BOYUTLANDIRMA VE STANDART 6PX ROZET YAPISI UYGULANDI"
  ],
  '1.0.23': [
    "KART ROZETLERİ (CİNSİYET, CİNSİ, KÜNYE NUMARASI, DURUM) STANDART 6PX RADİUS VE 22PX YÜKSEKLİĞE EŞİTLENDİ (ROZET KÖŞE STANDARDI)",
    "BEYAZ SARILARDAN GİBİ UZUN IRK İSİMLERİ İÇİN DİNAMİK YAZI BOYUTLANDIRMA VE SIKIŞTIRMA KURALI UYGULANARAK METİN KESİLMESİ ENGELLENDİ",
    "KULLANICININ PAÇALI VE DİK DURUŞLU KOSTÜM GÜVERCİNİ REFERANS ÇİZİMİNDEN SAF VEKTÖREL (SVG) IRK SİLUETLERİ ÜRETİLDİ VE ENTEGRE EDİLDİ",
    "KIRMIZI KOMPLE IRKININ RENGİ ÇAKAL İLE AYNI SICAK KESTANE KAHVESİ VE BEYAZ ÖNLÜKLÜ OLARAK AYARLANDI",
    "FİLTRE VE SEÇİCİ PENCERELERİNDE TÜM SEÇENEK BUTONLARI VE VAZGEÇ/İPTAL BUTONU SATIRI ORTALAYACAK ŞEKİLDE DÜZENLENDİ; BAŞLIK METİNLERİ × BUTONUNA BİNMEYECEK ŞEKİLDE KORUNDU"
  ],
  '1.0.22': [
    "KLİPS RENK GRUBU AÇILDIĞINDA ALT LİSTEDE TEKRARLANAN KART BİLGİLERİ KALDIRILDI: ÜST SATIRDA KÜNYE NUMARASI, CİNSİYET, CİNSİ VE DURUM; ALT SATIRDA İSİM, TEDAVİ, FEDERASYON, RENK VE HAT BİLGİLERİ (SATIR TAŞMASI YOK)",
    "CİNSİ (IRK) UZUN OLDUĞUNDA FONT KÜÇÜLTÜLEREK TEK SATIRDA KALIYOR; KIRMIZI KOMPLE GİBİ UZUN İSIMLER KISALTILMIYOR",
    "KÜNYE NUMARASININ KÜÇÜK ÇERÇEVESİ KLİPS KARTININ RENGİNDE BOYANIYOR; KOYU RENKLİ KARTLARIN DIŞINA ÇOK HAFİF PARLAK BEYAZ ÇİZGİ EKLENDİ (ANA KART KURALI GİBİ)",
    "KUŞ KİMLİK FORMUNDA CİNSİYET VE CİNSİ ETİKETLERİ KENDİ KUTULARININ ORTASINDA; CİNSİYET REHBERİ SAYFA ORTASINDA; DİĞER FİLTRE ETİKETLERİ DE KUTULARININ ORTASINA HİZLANDI"
  ],
  '1.0.21': [
    "TÜM EKRANLARDA NOKTALI İ YERİNE KÜÇÜK i: GİRİŞ, KUŞ LİSTESİ, KUŞ DETAYI, KUŞ FORMU, KULUÇKA, HASTALIK PANOSU, İLAÇLAR, AYARLAR VE TÜM PENCERELER (TAKİP → TAKiP, DİŞİ → DiŞi, KLİPS → KLiPS)",
    "ÜST ŞERİT, ALT MENÜ VE BİLDİRİM METİNLERİ DE AYNI ŞEKİLDE KÜÇÜK i İLE GÖRÜNÜYOR",
    "KUŞ LİSTESİ KLİPS RENK GRUBU KARTLARINDA SAYI VE CİNSİYET ROZETLERİ (8 KUŞ, 3D, 3E, 2?) RENKLİ KLİPS KARTININ HEMEN SAĞINA YASLANDI; KARTI AÇAN OK SAĞDA TEK BAŞINA",
    "VERİ KATMANI, KAYITLI DEĞERLER VE 7 LOGİN REGEX'İ DEĞİŞMEDİ; YEDEKLER BOZULMAZ"
  ],
  '1.0.20': [
    "SÜRÜM BİLGİSİ PENCERESİNDEKİ NUMARA ARTIK HER YAYINDA BİR ARTIYOR (YENİ MADDE OLDUĞUNDA); YAYIN BETİĞİ SÜRÜMÜ VE DEĞİŞİKLİK LİSTESİNİ BİRLİKTE GÜNCELLİYOR"
  ],
  '1.0.19': [
    "ROZET GENİŞLİĞİ 142PX OLARAK BELİRLENDİ: 360PX GENİŞLİĞİNDEKİ TELEFONLARDA SAĞ TARAF TAŞIYORDU; SAĞDAKİ ÖĞELER KÜÇÜLTÜLÜP OKA YASLANDI",
    "MARKA KARTı (GUVERCiN SOY TAKiP BETA) TELEFONDA TEK SATIRIN TAMAMINI KAPLIYOR; YAZı BÜYÜTÜLDÜ",
    "KART RENKLERi VE YAZILARI EŞiT GENiŞLİKTE (150px): DAHA SİMETRİK GÖRÜNÜM",
    "KUŞ LiSTESiNDE KART RENGi VE YAZISI ÖNCELiKLi: ROZET iÇERiĞiNE GÖRE BÜYÜR, SAYI VE CiNSiYET ROZETLERi SAĞDA OKA YASLANIR",
    "Klips renk grubu başlıkları ve özet satırı telefonda tek satıra sığdırıldı; yazılar küçültüldü ve kesilme (ellipsis) kaldırıldı — üç yazı da tam görünür",
    "\"Klips Rengiyle Bul\" ve \"Kontrolü Eksik\" butonlarından emojiler kaldırıldı",
    "KLİPS RENK GRUPLARI başlığı emojisi kaldırıldı, ortalandı ve altındaki grupları içine alan çizgili bir kart oldu; grup sayısı ve \"Tümünü Genişlet\" alt satırı paylaşıyor",
    "KLİPS RENK GRUPLARI başlığı büyütüldü; grup sayısı ve \"Tümünü Genişlet\" alt satırı eşit (50/50) paylaşıyor",
    "Güncelleme bildirimi artık yalnızca o yayının YENİ maddelerini gösteriyor; eski notlar tekrar listelenmiyor",
    "Eşleştirme & İslah Simülatörü kartı webapp ve APK ekranlarında tam ortalandı (başlık, açıklama ve aç/kapat butonu dengeli merkez yerleşime kavuşturuldu)",
    "Sağlık & Tedavi filtre butonları (🚨 Aktif Tedavide, 🟡 Karantina, ✅ İyileşenler, Tümü) APK ve mobilde tam 2+2 eşit genişlikte, ortalı ve hizalı hale getirildi",
    "Follukta Yavru Cinsiyeti Ayırt Etme Rehberi (Kafa/Gaga morfolojisi, tehdit refleksi ve paça kalınlığı göstergeleri)",
    "Kostüm, Renk ve Kapak Altı Islah Analizi (Çakal, Limoni, Kırmızı/Sarı Komple ve Beyaz ırklarında eşleştirme ve kapak altı risk hesaplama)",
    "Her ayak artık KENDİ künye numarasını taşıyor: sol ayağa ayrı, sağ ayağa ayrı numara (2 hane). Eski tek numara kaybolmaz, kodu olan ayağa taşınır",
    "Kuş listesinde ve profilinde künye iki satır: üstte sol ayak rengi ve numarası, altta sağ ayak rengi ve numarası",
    "Kuş kaydında numara kutusu renk seçicisinin yanına taşındı (Sol Ayak / Sağ Ayak satırları); Ad ve Cinsiyet tek satırda yan yana; \"Sonraki: 05\" önerisi ve \"bu renkte kayıtlı\" uyarısı artık ayağa göre çalışıyor",
    "Profilden \"listede göster\" tikiyle kuşun hangi ayak rengiyle gruplanacağı seçilebiliyor; tik konmazsa sol ayak öncelikli (eski davranış)",
    "Aynı ayak + aynı renk + aynı numara aynı cinsiyette kullanılırsa uyarı verip kaydı engelliyor",
    "Fotoğraf ekleme penceresi artık ekranın ortasında (üstte yapışmıyor), \"Kamerayla Çek\" gerçekten kamerayı açıyor: buton galeri seçicisini açıyordu"
  ],
  '1.0.18': [
    "Arama Türkçe harfleri katlıyor: \"mavi\" yazınca \"MAVI BONCUK\" gibi noktasız yazılmış kayıtlar bulunamıyordu (Kuşlar, Künye Kodları, İlaç kategorileri, Hastalık Panosu)",
    "Büyük harf çevirmesi trUpper üzerinden: \"AKTIF TEDAVİ\" → AKTİF TEDAVİ, \"İYİLEŞTI\" → İYİLEŞTİ, \"LACIVERT\" → LACİVERT. Hastalık yazarken hızlı seçim rozetleri artık vurgulanıyor",
    "Yedekten geri yükleme artık tedavileri de işliyor: eskiden yedekteki tedaviler yüklenmiyor, buluttaki (silinen kuşa ait) tedaviler hayalet kayıt olarak kalıyordu",
    "Kuş silinince fotoğrafları da siliniyor; Firestore'da sahibi kalmayan belgeler yığılmıyordu",
    "İşlem Geçmişi temizliği artık kalıcı: temizlemeden sonra liste veriden yeniden doldurulmuyordu",
    "Lacivert teması seçimi sayfa yenilenince kaybolmuyordu (Dumanlıya düşüyordu)",
    "Android geri tuşu çıkış onay penceresi açıkken hata veriyordu",
    "Kuluçka bildirim kimlikleri çakışmıyor; iki kuluçka aynı kimliği üretip bir hatırlatıcı sessizce kaybolabiliyordu",
    "Sürüm geçmişinde güncel sürümün tarihi artık görünüyor"
  ],
  '1.0.17': [
    "Kuluçka & Üretim Takibi filtre sekmeleri artık yer değiştirmiyor: mobil 2x2 ızgarada aktif sekme son hücreye fırlıyordu (toolbar'ın order kuralı alt gruba sızıyordu). Tedavi Panosu filtre şeridi de aynı şekilde kendi sırasında kalıyor"
  ],
  '1.0.16': [
    "Hastalık/Belirti seçim kartı: rozet rozetleri varsayılan kapalı, başlık ve açıklama ortalı, Rozetleri Göster/Yönet eşit ölçekte; Tedavi filtreleri 4 iden aynı \"Tümü\" görünümünde; Eşleştirme Simülatörü açılır/kapanır, farklı renkte"
  ],
  '1.0.15': [
    "Medications \"Hastalık / Belirti Seçimi\" rozetleri varsayılan olarak kapalı; \"Rozetleri Göster\" ile açılıyor"
  ],
  '1.0.14': [
    "Ayarlar kartlarındaki yazı hizası ve yatay/alt spacing düzeltmeleri (mobile spacing)",
    "Hastalık/Belirti açılır seçimi \"Hastalık Seç\" olarak yeniden adlandırıldı (tek seçim, temiz liste)"
  ],
  '1.0.13': [
    "Ayarlar kartının üstündeki hesap maili artık büyük harf zorlamıyor (text-transform none)",
    "\"İşlem Geçmişi\" ve \"Çıkış Yap\" düğmeleri eşit ölçekte, ortalanmış kart düzeninde"
  ],
  '1.0.12': [
    "\"Çıkış Yap\" ve \"İşlem Geçmişi\" düğmeleri Ayarlar ekranının en üstünde, kendi satırında (Hesap ve Güvenlik kartının içinde değil)",
    "Geri tuşuyla exit uyarısı artık güvenilir: \"Çıkış Yap\" onaylamadıkça uygulama kapanmaz"
  ],
  '1.0.11': [
    "Üst çubuktan \"Çıkış Yap\" ve \"Geçmiş\" butonları mobilde kaldırıldı (telefon ekranını sadeleştirildi: tepede yalnızca ortalanmış MARKA kartı)",
    "Çıkış Yap ve İşlem Geçmişi düğmeleri Ayarlar (Hesap ve Güvenlik) menüsüne taşındı"
  ],
  '1.0.10': [
    "Üst çubuğa her zaman görünür bir \"Çıkış (Çıkış Yap)\" düğmesi eklendi",
    "Yanlışlıkla çıkış yapılmasını önlemek için çıkış onay penceresi eklendi"
  ],
  '1.0.9': [
    "Giriş ekranındaki indirme penceresi sadeleştirildi: tek bir \"APK İndir\" düğmesi dosyayı doğrudan indirir",
    "Pencere içindeki gömülü indirme sayfası (iframe) kaldırıldı"
  ],
  '1.0.8': [
    "Giriş ekranındaki bağlantı sadeleştirildi: \"Android uygulamasını indir\"",
    "Bağlantıya tıklayınca açılan pencerede indirme sayfası (indir.html) doğrudan açılıyor; uzun GitHub adresi gösterilmiyor",
    "Giriş sonrası ana ekrandaki indirme bağlantısı kaldırıldı",
    "Klips Rengiyle Bul listelerinde artık yalnızca kendi eklediğiniz renkler görünüyor"
  ],
  '1.0.7': [
    "Üst çubuktaki \"GÜVERCİN SOY TAKİP\" kartı artık sayfanın ortasında duruyor",
    "Android indirme bağlantısı ana ekranın altında sabit duruyor (uzun listede kaybolmuyor)",
    "Aynı indirme bağlantısı giriş (oturum açma) ekranına da eklendi"
  ],
  '1.0.6': [
    "Ayarlar → Klips Kodları: elle seçilen renk artık anında kaydediliyor",
    "Elle atanan renk, çift renk kodlarında da kartlarda görünüyor (renk ezilmiyordu)",
    "Aramalar Türkçe harflere duyarlı değil: ı/İ/i, ş/ç/ğ/ö/ü (Kuluçka, İlaçlar, Hastalık Panosu, Geçmiş)",
    "Ana ekranın altına \"Android uygulamasını indir / paylaş\" bağlantısı eklendi",
    "Üst çubuktaki e-posta artık büyük harfe zorlanmıyor"
  ],
  '1.0.5': [
    "Klips Rengiyle Bul ekranı sadeleştirildi: sağ ve sol ayak için ayrı açılır seçici",
    "\"Çift Renkleri Göster\" tik kutusu eklendi (kuş ekleme ekranındaki gibi)"
  ],
  '1.0.4': [
    "\"Bu güncellemede neler var\" listesi düzeltildi: artık yalnızca o sürümün yenilikleri gösterilir",
    "Sürüm geçmişi ekranı tek kaynaktan (bu liste) besleniyor"
  ],
  '1.0.3': [
    "Ana ekran araması düzeltildi: artık Türkçe (ı/İ/i) ve tüm alanlarda çalışıyor",
    "Arama alanına \"Klips Rengiyle Bul\": sağ/sol ayak klips rengiyle kuş bulma"
  ],
  '1.0.2': [
    "Arayüz hizasızlıkları düzeltildi (kuluçka kartları, modal başlıkları, zaman çizelgesi)"
  ],
  '1.0.1': [
    "Güncelleme düzeltmesi: cihaz artık aynı paketi tekrar tekrar indirmiyor",
    "Akrabalık (Wright) ve ortak ata hesabı düzeltmeleri",
    "Fotoğraf silme artık Kaydet anında uygulanıyor (yanlışlıkla silme önlendi)",
    "Kayıt kimlikleri çakışmayan benzersiz kimliğe çevrildi",
    "Seçici listeler ekranı kaplamıyor; uzun metinler taşmıyor"
  ],
  '1.0.0': [
    "Follukta Yavru Cinsiyetini Ayırt Etme Rehberi modalı ve butonları",
    "Kostüm, Renk ve Kapak Altı Islah Motoru (Kuluçka & Eşleştirme)",
    "İlaç & Aşı sekmesinde kullanıcı tanımlı semptom ve kategori filtreleri",
    "Eczane Muadili arama penceresi ve satır düzeltmeleri",
    "Otomatik Canlı Kod Güncelleme (OTA) entegrasyonu"
  ]
}

/** Sürüm geçmişi ekranında gösterilen tarihler. */
export const CHANGELOG_DATES = {
  '1.0.18': '16 Ekim 2026',
  '1.0.17': '16 Ekim 2026',
  '1.0.16': '15 Ekim 2026',
  '1.0.15': '15 Ekim 2026',
  '1.0.14': '15 Ekim 2026',
  '1.0.13': '15 Ekim 2026',
  '1.0.12': '15 Ekim 2026',
  '1.0.11': '15 Ekim 2026',
  '1.0.10': '15 Ekim 2026',
  '1.0.9': '15 Ekim 2026',
  '1.0.8': '15 Ekim 2026',
  '1.0.7': '15 Ekim 2026',
  '1.0.5': '15 Ekim 2026',
  '1.0.4': '15 Ekim 2026',
  '1.0.3': '15 Ekim 2026',
  '1.0.2': '15 Ekim 2026',
  '1.0.1': '15 Ekim 2026',
  '1.0.0': '15 Ekim 2026'
}
