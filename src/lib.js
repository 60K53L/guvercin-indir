/**
 * Sabit seçenek metinleri DOĞRUDAN büyük harfle yazılıyor.
 * CSS text-transform tek başına yeterli değil: native <select> listeleri,
 * bazı Android klavye/kip görünümleri ve pano ile yapıştırılan değerler
 * dönüşümden kaçabiliyordu (ör. "Erkek" görünüyordu). Değerlerin kendisi
 * büyük harf olunca her yerde tutarlı.
 */
/**
 * Türkçe büyük harfe çevirme.
 *
 * DİKKAT: String.prototype.toUpperCase() DİL BİLMEZ ve "i" harfini
 * noktasız "I" yapar:  "dişi" → "DIŞI"  (yanlış!)
 * Türkçede doğrusu:      "dişi" → "DİŞİ"
 * Bu yüzden toLocaleUpperCase('tr-TR') kullanılmalı. Uygulamada büyük
 * harfe çevrilen her metin buradan geçmelidir; "ayırıcı işaret" alanında
 * bu yüzden kullanıcının yazdığı İ/ı/ş bozuluyordu.
 */
export const trUpper = v => String(v ?? '').toLocaleUpperCase('tr-TR')

/**
 * EKRAN görünümü için büyük harf: Türkçe noktalı "İ" yerine küçük "i"
 * gösterir (TAKİP → TAKiP, DİŞİ → DiŞi).
 *
 * Yalnızca görüntü katmanında kullanılır: veriye, kayıtlı değerlere ve
 * regex'lere DOKUNMAZ. Çağrıldığı kapsamda CSS text-transform kapatılmalıdır
 * (bkz. styles.css → "GİRİŞ EKRANI"), yoksa tarayıcı "i"yi yeniden "İ" yapar.
 */
export const dispTr = v => trUpper(v).replace(/İ/g, 'i')

export const SEX = { M: 'ERKEK', F: 'DİŞİ' }

export const STATUS = [
  { value: 'damizlik', label: 'DAMIZLIK' },
  { value: 'yavru', label: 'YAVRU' },
  { value: 'bosta', label: 'BOŞTA' },
  { value: 'ucurmalik', label: 'UÇAN KUŞ' },
  { value: 'satildi', label: 'SATILDI' },
  { value: 'kacti', label: 'KAÇTI' },
  { value: 'oldu', label: 'ÖLÜ' }
]

/** Kuşun kayıttan tamamen çıktığı durumlar. Ana listede en altta durur —
 *  hâlâ damızlıkta/yavru/boşta olanlar üstte kalmalı. */
export const GIDE_DURUMLAR = ['satildi', 'kacti', 'oldu']

export const statusLabel = v => {
  if (v === 'ucurmalik' || v === 'ucan_kumesi') return 'UÇAN KUŞ'
  return (STATUS.find(s => s.value === v) || {}).label || v
}

/** Durumlar Türkçe ALFABETİK sırada. Ekranda her yerde bu liste kullanılır
 *  (kuş formu ve liste filtresi); mantıksal sıralama yalnızca STATUS'un
 *  kendisinde kalır. `sortTr` tanımından sonra çağrılabilmesi için aşağıda
 *  üretiliyor. */
export const statusOptionsAlpha = () => sortTr(STATUS.map(s => s.label))
  .map(label => STATUS.find(s => s.label === label))

/** Durum filtresi seçenekleri: Aktif durumlar (BOŞTA, DAMIZLIK, UÇAN KUŞ, YAVRU)
 *  alfabetik sırada üstte; kayıttan çıkmış durumlar (KAÇTI, ÖLÜ, SATILDI) en altta listelenir. */
export const statusFilterOptions = () => {
  const alpha = statusOptionsAlpha()
  const active = alpha.filter(s => !GIDE_DURUMLAR.includes(s.value))
  const gone = alpha.filter(s => GIDE_DURUMLAR.includes(s.value))
  return [...active, ...gone]
}

/** Kuş listede "kalmış" mı: satıldı/kaçtı/öldü → listenin sonuna. */
export const isGone = b => GIDE_DURUMLAR.includes(b?.status)

/**
 * Kayıtlarımızda OLMAYAN anne/baba için seçilebilen durumlar.
 * Yalnızca bilgi amaçlıdır: bu seçim `sireId`/`damId` bağı kurmaz,
 * dolayısıyla çiftleşme, soy ağacı veya akrabalık hesabı etkilenmez.
 */
export const EXTERNAL_PARENT_STATUS = [
  { value: 'kacti', label: 'KAÇTI' },
  { value: 'satildi', label: 'SATILDI' },
  { value: 'oldu', label: 'ÖLDÜ' }
]

/** Kayıt dışı ebeveyn bilgisini tek satırda gösterir: "KAÇTI - AÇIK SARI BOZALI". */
export const externalParentText = (bird, which) => {
  const raw = which === 'sire' ? bird?.sireOutside : bird?.damOutside
  if (!raw || typeof raw !== 'object') return ''
  const status = (EXTERNAL_PARENT_STATUS.find(s => s.value === raw.status) || {}).label || ''
  const note = String(raw.note || '').trim()
  return [status, note].filter(Boolean).join(' - ')
}

/**
 * Kayıt dışı ebeveyn alanını temizler. Gerçek bir anne/baba seçiliyse
 * (parentId dolu) bilgi alanı tamamen kaldırılır; böylece iki kaynak
 * çakışmaz. Boş durum + boş not da null döner.
 */
export const normalizeExternalParent = (outside, parentId) => {
  if (parentId) return null
  const status = EXTERNAL_PARENT_STATUS.some(s => s.value === outside?.status)
    ? outside.status
    : ''
  const note = trUpper(outside?.note || '').trim()
  if (!status && !note) return null
  return { status, note }
}

export const uid = () =>
  (globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2))

export const ringOf = b => {
  if (!b) return '—'
  const c = (b.code || b.leftCode || b.rightCode || '').trim()
  const n = String(b.number ?? '').trim()
  if (c && n) return `${c}-${n}`
  if (c) return c
  if (n) return n
  if (b.name) return b.name
  return `#${(b.id || '').slice(0, 4).toUpperCase()}`
}

/**
 * Tek ayak künyesi yardımcıları.
 *
 * Her ayak KENDİ rengini ve KENDİ numarasını taşır:
 *   sol  → leftCode  + leftNumber  (kuşun geldiği soy / ataları)
 *   sağ  → rightCode + rightNumber (kuşun kendi soyu / verdiği yavrular)
 * Liste kartı ile profil ekranı bu yardımcılarla iki ayrı satır çizer.
 */
export const footCode = (b, foot) =>
  String((foot === 'right' ? b?.rightCode : b?.leftCode) || '').trim()

export const footNumber = (b, foot) =>
  String((foot === 'right' ? b?.rightNumber : b?.leftNumber) ?? '').trim()

/** "BEYAZ KLİPS 05" — kod/numara yoksa yalnızca var olanı döndürür. */
export const footRing = (b, foot) => [footCode(b, foot), footNumber(b, foot)].filter(Boolean).join(' ')

/**
 * Kuş listede hangi ayağın rengiyle görünecek?
 * Kullanıcı profilde seçtiyse o ayak; seçmediyse eskisi gibi sol öncelikli.
 */
export const listFootOf = b =>
  b?.listFoot === 'left' || b?.listFoot === 'right'
    ? b.listFoot
    : (footCode(b, 'left') ? 'left' : (footCode(b, 'right') ? 'right' : ''))

/**
 * Künye metninin rengi: kuşun renginden türetilir.
 *
 * ÖNEMLİ: Bu renkler eskiden KOYU temalar için seçilmiş, çok soluk
 * tonlardı (SİYAH bile açık griydi) — künye "yeşil" görünmüyordu.
 * Şimdi GERÇEK renkler kullanılıyor. Koyu temada SİYAH/BEYAZ gibi koyu
 * ve açık tonlar kaybolmasın diye metin etrafında kontür çizilir
 * (styles.css `.ring`, --ring-outline).
 */
/*
 * ANAHTAR SÖZCÜKLER ASCII İLE YAZILIR: 'SIYAH', 'MAVI' — 'İ' DEĞİL.
 * Neden: kuş verisi trUpper() ile 'SİYAH' (noktalı İ) olur ve
 * toLocaleUpperCase('tr-TR') arama metnini de 'SİYAH' yapar. ASCII
 * anahtar ('SIYAH') noktalı İ ile ASLA eşleşmezdi; SİYAH ve MAVİ
 * künyeleri hiç renklenmez, hep vurgu renginde kalırdı.
 * Bu yüzden eşleştirme `foldTr()` ile iki taraf da normalize edilir.
 */
let globalCodeColors = {}

export const kb = bytes => `${Math.round(bytes / 1024)} KB`

/**
 * Kullanıcının Ayarlar'da tanımladığı özel künye kodu renkleri.
 */
export function setGlobalCodeColors(colors) {
  globalCodeColors = colors || {}
}

const COLOR_WORDS = [
  // Bileşik ve özel tonlar (önce kontrol edilmeli)
  ['ACIK MAVI', '#7dd3fc'],
  ['KOYU MAVI', '#1d4ed8'],
  ['SUTLU KAHVERENGI', '#b58a63'],
  ['SUTLU KAHVE', '#b58a63'],
  ['FISTIK YESILI', '#86efac'],
  ['ACIK YESIL', '#86efac'],
  ['KOYU YESIL', '#15803d'],
  ['LIMON', '#facc15'],
  ['BORDO', '#881337'],
  ['LILA', '#c084fc'],
  ['ALTIN', '#eab308'],
  ['BRONZ', '#b45309'],
  ['BAKIR', '#c2410c'],
  ['KAVUNICI', '#fb923c'],
  ['KREM', '#fef3c7'],
  ['HAKI', '#65a30d'],
  ['PETROL', '#0e7490'],

  // Standart tek kelime renkler
  ['BEYAZ', '#f4f7fb'],
  ['SARI', '#f2c744'],
  ['KIRMIZI', '#e8434f'],
  ['PEMBE', '#ec6fae'],
  ['TURUNCU', '#f08a3c'],
  ['TURKUAZ', '#2ec4c9'],
  ['YESIL', '#3fbf5f'],
  ['MAVI', '#4aa3f0'],
  ['GOKYUZU', '#4aa3f0'],
  ['LACIVERT', '#5b63d8'],
  ['MOR', '#a855f7'],
  ['KAHVERENGI', '#8a5a34'],
  ['KAHVE', '#8a5a34'],
  ['BEJ', '#c9a97a'],
  ['GRI', '#6b7280'],
  ['GUMUS', '#aab4c4'],
  ['SIYAH', '#20242c']
]

/**
 * Türkçe harfleri ASCII karşılıklarına indirger ve büyük harfe çevirir.
 * Renk eşleştirmesinin iki tarafı da aynı forma gelmeli, yoksa
 * 'SİYAH' ↔ 'SIYAH' ve 'YEŞİL' ↔ 'YESIL' eşleşmez.
 *
 *   'SİYAH' → 'SIYAH'   'MAVİ' → 'MAVI'   'YEŞİL' → 'YESIL'
 *   'ŞAHİN' → 'SAHIN'   'ÇAKAL' → 'CAKAL'  'ÖZ' → 'OZ'
 */
export const foldTr = s => String(s ?? '')
  .replace(/[İı]/g, i => (i === 'İ' ? 'I' : 'i'))
  .replace(/[ŞşÇçĞğÖöÜü]/g, c => ({
    'Ş': 'S', 'ş': 's', 'Ç': 'C', 'ç': 'c', 'Ğ': 'G',
    'ğ': 'g', 'Ö': 'O', 'ö': 'o', 'Ü': 'U', 'ü': 'u'
  })[c])
  // Türkçe harfler katlandığı için düz toUpperCase yeterli.
  // toLocaleUpperCase('tr-TR') KULLANILMAZ: 'i' harfini yeniden 'İ'
  // yapardı ve 'YESIL' tekrar 'YESİL' olurdu, eşleşme bozulurdu.
  .toUpperCase()

/**
 * Arama ve karşılaştırma için Türkçe-güvenli normalize.
 *
 * foldTr ile aynı harf katlamasını yapar (İ/ı, Ş/ş, Ç/ç, Ğ/ğ, Ö/ö, Ü/ü) ve
 * boşlukları sadeleştirir. Böylece "kırmızı" ile "KIRMIZI", "I" ile "ı"
 * sorunsuz eşleşir. Arama/filtreleme yapan HER yerde bu kullanılmalıdır:
 * tarayıcı dili ne olursa olsun locale-bağımlı toLowerCase()/toUpperCase()
 * Türkçede yanlış eşleşme üretiyordu.
 */
export const trSearch = s => foldTr(s).replace(/\s+/g, ' ').trim()

export const PRIMARY_RING_COLORS = [
  'BEYAZ', 'SARI', 'KIRMIZI', 'MAVİ', 'SİYAH', 'YEŞİL',
  'TURUNCU', 'PEMBE', 'MOR', 'LACİVERT', 'GÜMÜŞ', 'ALTIN'
]

export function ringColor(text) {
  const c = ringMatch(text)
  return c ? c.color : null
}

/**
 * Metindeki tüm renk eşleşmelerini metindeki konumlarına göre sırayla bulur.
 * Uzun ve bileşik renkler (örn. 'ACIK MAVI', 'KOYU YESIL') önce kontrol edilir,
 * böylece içlerindeki tek kelimeler ('MAVI', 'YESIL') hatalı çift eşleşme yapmaz.
 */
export function findColorsInText(text) {
  if (!text) return []
  const t = foldTr(text)

  // Yerleşik genişletilmiş renk sözlüğü (uzun olanlar önce denenir)
  const sortedWords = [...COLOR_WORDS].sort((a, b) => b[0].length - a[0].length)
  const matches = []

  for (const [word, color] of sortedWords) {
    const folded = foldTr(word)
    let pos = 0
    while (true) {
      const idx = t.indexOf(folded, pos)
      if (idx === -1) break
      const start = idx
      const end = idx + folded.length

      // Daha önce bulunan bir eşleşmeyle çakışıyor mu?
      const overlaps = matches.some(m => !(end <= m.start || start >= m.end))
      if (!overlaps) {
        matches.push({ word, color, start, end })
      }
      pos = idx + 1
    }
  }

  // Metindeki geçiş sırasına göre sırala
  matches.sort((a, b) => a.start - b.start)
  return matches
}

/**
 * Eşleşen rengi veya çift renkleri { kelime, color, isDual, ... } olarak döndürür.
 * `kelime` (örn. 'BEYAZ' veya 'SARI-KIRMIZI') tema CSS'ine öznitelik olarak verilir.
 */
export function ringMatch(text) {
  if (!text) return null
  const t = foldTr(text)

  // 0. EN YÜKSEK ÖNCELİK: Kullanıcının ELLE belirlediği renk (settings.codeColors).
  //    Elle atanmış bir renk, yerleşik renk sözlüğünden ve çift renk
  //    tespitinden DAİMA önce gelir. Eskiden bu kontrol çift renkten SONRA
  //    yapılıyordu; bu yüzden "KAHVERENGİ-BEYAZ KLİPS" gibi çift renk
  //    kodlarına elle atanan renk ekrana hiç yansımıyordu.
  {
    const tt = t.replace(/\s+/g, ' ').trim()
    for (const [code, color] of Object.entries(globalCodeColors || {})) {
      if (!color) continue
      const fc = foldTr(code).replace(/\s+/g, ' ').trim()
      if (!fc) continue
      if (tt === fc || tt.startsWith(fc + '-') || tt.startsWith(fc + ' ')) {
        return { kelime: code, color, isDual: false }
      }
    }
  }

  // "BEYAZ KIRMIZILARDAN" ve "BEYAZ SARILARDAN" kostüm türü olarak DÜZ BEYAZDIR.
  if (t.includes('BEYAZ KIRMIZILARDAN') || t.includes('BEYAZ SARILARDAN') || t.includes('BEYAZ KIRMIZILAR') || t.includes('BEYAZ SARILAR')) {
    return { kelime: 'BEYAZ', color: '#f4f7fb', isDual: false }
  }

  // 1. Metindeki renk eşleşmelerini bul
  const matches = findColorsInText(text)

  // Farklı renkleri ayıkla
  const uniqueColors = []
  for (const m of matches) {
    if (!uniqueColors.some(u => u.color === m.color)) {
      uniqueColors.push(m)
    }
  }

  // 2. Çift renk eşleşmesi (en az iki farklı renk bulundu) -> DAİMA ÇİFT RENK!
  // globalCodeColors içinde tekil renk bulunsa dahi çift rengin ezilmesi engellenir.
  if (uniqueColors.length >= 2) {
    const m1 = uniqueColors[0]
    const m2 = uniqueColors[1]
    return {
      kelime: `${m1.word}-${m2.word}`,
      color: m1.color,
      isDual: true,
      color1: m1.color,
      color2: m2.color,
      kelime1: m1.word,
      kelime2: m2.word
    }
  }

  // 3. Tek renk eşleşmesi (veya aynı rengin tekrarı)
  if (uniqueColors.length === 1) {
    return {
      kelime: matches[0].word,
      color: matches[0].color,
      isDual: false
    }
  }

  return null
}

/**
 * Bir dolgunun üstünde okunacak yazı rengi.
 *
 * SABİT BİR EŞİK KONULMADI: koyu/açık seçimi, iki seçeneğin de KENDİ
 * kontrastı hesaplanıp hangisi yüksekse o seçilir. Sabit eşik (ör. 0.42)
 * orta tonlu renkleri yanlış sınıfa koyuyordu: KIRMIZI, PEMBE, TURUNCU,
 * YEŞİL, MAVİ ve MOR beyaz yazıyla 2.4–4.0 kontrast veriyordu, oysa
 * koyu yazıyla 5–8 veriyorlar.
 */
function inkFor(hex) {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
  const l = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  const koyu = '#12151b'
  const acik = '#ffffff'
  const koyuKontrast = (l + 0.05) / 0.05
  const acikKontrast = 1.05 / (l + 0.05)
  return koyuKontrast >= acikKontrast ? koyu : acik
}

/**
 * Künye rozeti için renk çifti: { dolgu, yazi }.
 *
 * Neden dolgu? Künye rengi kuşun GERÇEK rengidir. Dolgu yaklaşımında renk ZEMİN olur:
 * hiçbir renk hiçbir temada okunmaz olmaz, gerçek rengi tam gösterir.
 *
 * Çift renk (Senaryo A): İki renk tespit edildiğinde zemin linear-gradient(135deg)
 * ile yarı yarıya bölünür. Yazı rengi kontrast garantisi ile ayarlanır.
 */
export function ringChip(text) {
  const m = ringMatch(text)
  if (!m) return null

  if (!m.isDual) {
    return {
      kelime: m.kelime,
      dolgu: m.color,
      yazi: inkFor(m.color),
      isDual: false,
      isDark: inkFor(m.color) === '#ffffff'
    }
  }

  const c1 = m.color1
  const c2 = m.color2
  const ink1 = inkFor(c1)
  const ink2 = inkFor(c2)

  let yazi = ink1
  let textShadow = undefined

  if (ink1 === ink2) {
    // İki renk de açık (örn. SARI + BEYAZ) ya da iki renk de koyu (örn. SİYAH + BORDO)
    yazi = ink1
  } else {
    // Biri açık biri koyu zemin (örn. SİYAH + BEYAZ, SARI + SİYAH, MAVİ + BEYAZ)
    // Beyaz yazı + keskin koyu kenar gölgesi iki yarıda da net okunur
    yazi = '#ffffff'
    textShadow = '0 0 2px #000000, 0 1px 2px #000000, 1px 0 2px #000000'
  }

  return {
    kelime: m.kelime,
    isDual: true,
    color1: c1,
    color2: c2,
    kelime1: m.kelime1,
    kelime2: m.kelime2,
    dolgu: `linear-gradient(135deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)`,
    yazi,
    textShadow,
    isDark: ink1 === '#ffffff' || ink2 === '#ffffff'
  }
}

/**
 * Bir metnin (klips/kod) çift renk olup olmadığını tespit eder.
 */
export function isDualCode(text) {
  if (!text) return false
  const m = ringMatch(text)
  if (m?.isDual) return true
  const matches = findColorsInText(text)
  const uniqueColors = new Set(matches.map(c => c.color))
  return uniqueColors.size >= 2
}

/**
 * Çift renkler için sıradan bağımsız kanonik anahtar üretir.
 * Örn: BEYAZ-PEMBE ile PEMBE-BEYAZ aynı anahtarı (BEYAZ_PEMBE) üretir.
 */
export function canonicalDualKey(text) {
  if (!text) return ''
  const m = ringMatch(text)
  if (m?.isDual && m.kelime1 && m.kelime2) {
    return sortTr([m.kelime1, m.kelime2]).join('_')
  }
  const clean = trUpper(text).replace(/\b(KLİPS|KLIPS|BONCUK|HALKA|YÜZÜK|YUZUK)\b/gi, '').trim()
  const parts = clean.split(/[-/ ]+/).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return sortTr([parts[0], parts[1]]).join('_')
  }
  return clean
}

/**
 * Bir çift renk kodunun mevcut listede (birebir veya ters sıra) olup olmadığını denetler.
 * @returns {{ existing: string, isExact: boolean } | null}
 */
export function findDualColorDuplicate(candidate, existingList) {
  if (!candidate || !existingList || !existingList.length) return null
  const candKey = canonicalDualKey(candidate)
  if (!candKey) return null

  for (const existing of existingList) {
    if (!existing) continue
    const existKey = canonicalDualKey(existing)
    if (candKey === existKey) {
      const isExact = trUpper(candidate.trim()) === trUpper(existing.trim())
      return { existing, isExact }
    }
  }
  return null
}

/**
 * Bir listedeki tüm mükerrer (düz veya ters sıra) çift renkleri tespit eder.
 */
export function findDuplicateDualCodesInList(list) {
  if (!Array.isArray(list)) return []
  const seen = new Map()
  const duplicates = []
  for (const item of list) {
    const raw = String(item || '').trim()
    if (!raw) continue
    const key = canonicalDualKey(raw)
    if (!key) continue
    if (seen.has(key)) {
      duplicates.push({ current: raw, existing: seen.get(key) })
    } else {
      seen.set(key, raw)
    }
  }
  return duplicates
}

export const DEFAULT_MED_CATEGORIES = [
  'GÖZ SULANMASI',
  'HIRILTI',
  'KANAT TUTULMASI',
  'KURSAK MANTARI',
  'SALMONELLA / SALLABAŞ',
  'ÇİÇEK HASTALIĞI',
  'TRİKOMANAS (PAMUK)',
  'KOKSİDİYOZ',
  'İSHAL / E.COLİ',
  'İÇ & DIŞ PARAZİT',
  'VİTAMİN & ENERJİ'
]

/**
 * İlaç kaydının verilen kategoriyle eşleşip eşleşmediğini denetler.
 * Hem ilaca doğrudan atanmış kategorileri (m.categories) hem de
 * ne işe yaradığı (m.purpose), adı (m.name) ve etken maddesini (m.activeIngredient)
 * akıllı Türkçe aramayla kontrol eder.
 */
export function matchMedicationCategory(med, category) {
  if (!med || !category) return false
  // Katlanmış karşılaştırma (trSearch): "GÖZ" ile "GOZ", "İ" ile "I"
  // aynı harftir; trUpper kullanılsa noktasız yazılmış eski kayıtlar
  // bulunamazdı.
  const targetCat = trSearch(category)
  if (!targetCat) return false

  // 1. Doğrudan atanmış kategori listesi kontrolü
  if (Array.isArray(med.categories)) {
    if (med.categories.some(c => trSearch(c) === targetCat)) {
      return true
    }
  }

  // 2. Metin içinde akıllı eşleşme (göz sulanması, hırıltı, kanat tutulması vb.)
  const combined = [med.name, med.purpose, med.activeIngredient, med.dosage, med.alternative, med.pharmacyAlternative]
    .filter(Boolean)
    .join(' ')
  const combFolded = trSearch(combined)

  if (combFolded.includes(targetCat)) return true

  // Kelime bazlı alt arama (örn: "GÖZ SULANMASI" için hem "GÖZ" hem "SULANMA" geçiyor mu)
  const words = targetCat.split(/[\s/&+-]+/).map(w => w.trim()).filter(w => w.length >= 3)
  if (words.length > 1) {
    const allWordsMatch = words.every(w => combFolded.includes(w))
    if (allWordsMatch) return true
  }

  return false
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const byId = (birds, id) => birds.find(b => b.id === id) || null

/**
 * Türkçe alfabetik sıralama.
 * Künye kodları ve cinsler karışık girildiğinde listeyi okunur
 * hale getirmek için kullanılır (a, b, c, ç, d…).
 */
export const sortTr = list =>
  [...list].sort((a, b) => String(a).localeCompare(String(b), 'tr', { sensitivity: 'base' }))

export const parentsOf = (birds, b) => ({
  sire: byId(birds, b?.sireId),
  dam: byId(birds, b?.damId)
})

export function childrenOf(birds, b) {
  if (!b) return []
  return birds.filter(x => x.sireId === b.id || x.damId === b.id)
}

export function siblingsOf(birds, b) {
  if (!b) return []
  // Anne/baba bilinmiyorsa kardeşlik kurulamaz. Aynı anda boş bir alan
  // karşılaştırılırsa (undefined === undefined) ailesi olmayan her kuş
  // kardeş gibi görünür.
  const sire = b.sireId || null
  const dam = b.damId || null
  if (!sire && !dam) return []
  return birds.filter(x => {
    if (x.id === b.id) return false
    const xs = x.sireId || null
    const xd = x.damId || null
    return Boolean((sire && xs === sire) || (dam && xd === dam))
  })
}

/* ------------------------------------------------------------- eş / çiftleşme
 *
 * Kural: bir kuşun EN FAZLA BİR mevcut eşi olur. Daha önce eş olmuş
 * kuşlar "eski eş" olarak ayrı listede tutulur ve aynı kuş ikinci kez
 * eklenemez.
 *
 * `durum` alanı: 'simdi' (varsayılan) | 'eski'
 * Eski kayıtlarda alan yok; okunurken 'simdi' sayılır (aşağıda).
 */

export const DURUM_SIMDI = 'simdi'
export const DURUM_ESKI = 'eski'

/** Alan yoksa eski kayıtlar "simdi" sayılır. */
export const pairingDurum = p => (p && p.durum === DURUM_ESKI ? DURUM_ESKI : DURUM_SIMDI)

export const isFormer = p => pairingDurum(p) === DURUM_ESKI

/** Eşleşme kaydının bu kuşla ilgili tarafındaki eş. */
export function mateIdOf(pairing, bird) {
  if (!pairing || !bird) return null
  return pairing.maleId === bird.id ? pairing.femaleId : pairing.femaleId === bird.id ? pairing.maleId : null
}

/** Kuşun çiftleşme kayıtları: { simdi: [...], eski: [...] } */
export function matesOf(pairings, bird) {
  const simdi = []
  const rawEski = []
  for (const p of pairings || []) {
    if (!bird || (p.maleId !== bird.id && p.femaleId !== bird.id)) continue
    if (isFormer(p)) {
      rawEski.push(p)
    } else {
      simdi.push(p)
    }
  }

  // Kuşun mevcut eşleri
  const currentMateIds = new Set(simdi.map(p => mateIdOf(p, bird)).filter(Boolean))

  // Eski eşler tekilleştirilir: aynı eş ikinci kez listelenmez;
  // mevcut eş asla eski eşler listesinde görünmez; mükerrer kopyaların yavruları ve notları birleştirilir.
  const eski = []
  const eskiMap = new Map()

  for (const p of rawEski) {
    const mateId = mateIdOf(p, bird)
    if (!mateId || currentMateIds.has(mateId)) continue

    if (eskiMap.has(mateId)) {
      const existing = eskiMap.get(mateId)
      existing.chickIds = [...new Set([...(existing.chickIds || []), ...(p.chickIds || [])])]
      if (p.notes && !existing.notes?.includes(p.notes)) {
        existing.notes = existing.notes ? `${existing.notes} · ${p.notes}` : p.notes
      }
    } else {
      const copy = { ...p, chickIds: [...(p.chickIds || [])] }
      eskiMap.set(mateId, copy)
      eski.push(copy)
    }
  }

  return { simdi, eski }
}

/** Bu kuşla hiç eşleşmemiş olması gereken karşı cins kuşlar.
 *  Hem mevcut eş hem eski eşler listeden düşer; aynı kuş iki kez
 *  eklenemez.
 *
 *  NOT: Arayüz şu anda aday listesini bileşen içinde kuruyor; bu işlev
 *  kuralların TEK kaynağı olarak testlerde sınanıyor. Bileşenler
 *  kombine edilirse buraya yönlendirilmeli. */
export function mateCandidatesFor(birds, pairings, bird) {
  if (!bird || !bird.sex) return birds.filter(b => b.id !== bird.id && !isGone(b))
  const wantSex = bird.sex === 'M' ? 'F' : 'M'
  const taken = new Set()
  for (const p of pairings || []) {
    if (p.maleId === bird.id || p.femaleId === bird.id) {
      const other = mateIdOf(p, bird)
      if (other) taken.add(other)
    }
  }
  return birds.filter(
    b => b.id !== bird.id && b.sex === wantSex && !isGone(b) && !taken.has(b.id)
  )
}

/** Wright katsayısı ile iki kuşun ortak atadan gelen yakınlık oranı. */
export function relationshipCoefficient(birds, a, b, depth = 4) {
  if (!a || !b || a.id === b.id) return 0
  if (a.sex === b.sex && a.sex) return 0
  // Her atanın EN KISA neslini tut. Eski kod ilk bulunan yolu (en kısa
  // olmayabilir) sabitliyordu; bir ata hem dede hem büyük-dede ise yanlış
  // nesille hesap ediliyordu. Gevşetmeli (relaxation) dolaşma en küçük nesli
  // bulur ve döngülü soyağacında da sonsuz döngüye girmez.
  const ancestors = (bird) => {
    const gen = new Map()
    const queue = [[bird, 0]]
    while (queue.length) {
      const [node, g] = queue.shift()
      if (!node || g > depth) continue
      const prev = gen.get(node.id)
      if (prev !== undefined && prev <= g) continue
      gen.set(node.id, g)
      queue.push([byId(birds, node.sireId), g + 1])
      queue.push([byId(birds, node.damId), g + 1])
    }
    return gen
  }
  const A = ancestors(a)
  const B = ancestors(b)
  let sum = 0
  for (const [id, gen] of A) {
    if (!B.has(id)) continue
    sum += Math.pow(0.5, gen + B.get(id) + 1)
  }
  return Math.min(1, sum)
}

export const kinshipPct = v => `${(v * 100).toFixed(1).replace('.', ',')}%`

/**
 * `to` kuşunun `from` kuşuna göre AKRABA bağını Türkçe ve BÜYÜK HARF
 * etiket olarak döndürür. Akrabalık yoksa boş dize verir.
 *
 * Eş seçimi listelerinde kullanılır: BEYAZ KLİPS-GC'nin BEYAZ KLİPS-01'e
 * annesi olduğu biliniyorsa, seçim kutusunda "ANNESİ" yazmalı — kuşçu
 * soy bağını seçim anında görsün, eşleştirdikten sonra değil.
 *
 * Tanınan bağlar (yakınlığa göre): anne/baba, yavru, kardeş, dede/nine,
 * amca/teyze, torun, torunun çocuğu.
 */
/**
 * Kuş listesindeki sıralama.
 *
 * 1) SATILDI / KAÇTI / ÖLÜ kuşlar EN SONA. Bu kuşlar kayıttan çıkmış
 *    arşiv kayıtlarıdır; GC olsalar bile listenin dibine giderler.
 * 2) Künye KODUNA göre gruplanır; kodlar Türkçe alfabetik.
 * 3) Aynı kodun İÇİNDE "GC" numaralı kuşlar başa gelir — onlar o kodun
 *    anne/babasıdır. Yani BEYAZ KLİPS-GC, BEYAZ KLİPS-01'in üstünde,
 *    PEMBE KLİPS-GC ise kendi grubunun başında durur (tüm GC'ler
 *    birbirine karışmaz).
 * 4) Numara doğal sırayla: 01, 02, 10 (10, 2'den sonra gelir).
 * 5) Son eşitlikte cinsiyet.
 */
export function compareBirds(a, b) {
  // 1) giden kuşlar her zaman en sonda
  const ai = isGone(a) ? 1 : 0
  const bi = isGone(b) ? 1 : 0
  if (ai !== bi) return ai - bi

  // 2) kod grubu: tüm GC'ler değil, her kod kendi içinde sıralanır
  const ac = String(a.code || '').trim().toLocaleUpperCase('tr-TR')
  const bc = String(b.code || '').trim().toLocaleUpperCase('tr-TR')
  if (ac !== bc) return ac.localeCompare(bc, 'tr', { sensitivity: 'base' })

  // 3) aynı kod içinde GC başa
  const ag = String(a.number ?? '').trim().toLocaleUpperCase('tr-TR') === 'GC' ? 0 : 1
  const bg = String(b.number ?? '').trim().toLocaleUpperCase('tr-TR') === 'GC' ? 0 : 1
  if (ag !== bg) return ag - bg

  // 4) numara doğal sıra, sonra cinsiyet (önce DİŞİ, sonra ERKEK).
  const sexRank = (x) => (x === 'F' ? 0 : x === 'M' ? 1 : 2)
  return (
    String(a.number ?? '').localeCompare(String(b.number ?? ''), 'tr', { numeric: true, sensitivity: 'base' }) ||
    (sexRank(a.sex ?? '') - sexRank(b.sex ?? ''))
  )
}

/**
 * Baba/anne seçim listesi sıralaması.
 *
 * Varsayılan kural `compareBirds` ile aynı: kod grubu → grup içinde GC →
 * numara → cinsiyet. Ama kuşun KÜNYE KODU seçildiğinde, o kodun GC
 * kuşları listenin EN ÜSTÜNE taşınır.
 *
 * Gerekçe: MOR KLİPS-01..05'in anne/babası MOR KLİPS GC'dir. Yeni bir
 * MOR KLİPS kaydederken anne/baba listesinde aşağı kaydırmak gerekmesin.
 * `tercihEdilenKod` verilirse o kodun GC'leri öne çıkar; verilmezse
 * sıralama compareBirds ile birebir aynıdır.
 */
/**
 * Baba/anne seçim listesi karşılaştırıcısı (Array#sort için).
 *
 * Varsayılan kural `compareBirds` ile aynı: kod grubu → grup içinde GC →
 * numara → cinsiyet. Ama kuşun KÜNYE KODU seçildiğinde, o kodun GC
 * kuşları listenin EN ÜSTÜNE taşınır.
 *
 * Gerekçe: MOR KLİPS-01..05'in anne/babası MOR KLİPS GC'dir. Yeni bir
 * MOR KLİPS kaydederken anne/baba listesinde aşağı kaydırmak gerekmesin.
 * `tercihEdilenKod` boşsa sıralama compareBirds ile birebir aynıdır.
 */
export function parentCompare(tercihEdilenKod) {
  const hedef = (tercihEdilenKod || '').trim().toLocaleUpperCase('tr-TR')
  // SADECE hedef kodun GC'si öne çıkar. Diğer kodların GC kuşları
  // normal yerinde kalır (compareBirds zaten kendi kod grubunun başında
  // tutuyor); herkesi öne almak listeyi bozuyordu.
  const oncelik = (x) => {
    if (!hedef) return 1
    const kod = (x.code || '').trim().toLocaleUpperCase('tr-TR')
    const gcMi = String(x.number ?? '').trim().toLocaleUpperCase('tr-TR') === 'GC'
    return kod === hedef && gcMi ? 0 : 1
  }
  return (a, b) => {
    const f = oncelik(a) - oncelik(b)
    return f !== 0 ? f : compareBirds(a, b)
  }
}

export function relationLabel(birds, from, to, depth = 4) {
  if (!from || !to || from.id === to.id) return ''
  const down = (bird, gen, out = new Set()) => {
    if (!bird || gen > depth) return out
    for (const c of childrenOf(birds, bird)) {
      if (out.has(c.id)) continue
      out.add(c.id)
      down(c, gen + 1, out)
    }
    return out
  }

  const sire = byId(birds, from.sireId)
  const dam = byId(birds, from.damId)
  if (to.id === sire?.id) return 'BABASI'
  if (to.id === dam?.id) return 'ANNESİ'
  if (childrenOf(birds, from).some(c => c.id === to.id)) return 'YAVRUSU'

  // Kardeş: aynı baba veya aynı anne (her iki taraf bilinmeli).
  const fs = from.sireId || null
  const fd = from.damId || null
  const ts = to.sireId || null
  const td = to.damId || null
  if ((fs && fs === ts) || (fd && fd === td)) return 'KARDEŞİ'

  // DEDE VE NİNELER (2. Nesil kan bağı)
  if (sire && byId(birds, sire.sireId)?.id === to.id) return 'BABASININ BABASI'
  if (sire && byId(birds, sire.damId)?.id === to.id) return 'BABASININ ANNESİ'
  if (dam && byId(birds, dam.sireId)?.id === to.id) return 'ANNESİNİN BABASI'
  if (dam && byId(birds, dam.damId)?.id === to.id) return 'ANNESİNİN ANNESİ'

  // TORUNLAR
  const kids = down(from)
  if (kids.has(to.id)) return 'TORUNU'
  for (const k of birds.filter(b => kids.has(b.id))) {
    if (down(k).has(to.id)) return 'TORUNUNUN ÇOCUĞU'
  }
  return ''
}

/** İki kuşun daha önce ortak yavrusu olup olmadığını döner (akrabalık değil, eski/mevcut eşlik göstergesidir). */
export function sharedOffspring(birds, a, b) {
  if (!a || !b) return []
  return (birds || []).filter(c =>
    (c.sireId === a.id && c.damId === b.id) ||
    (c.sireId === b.id && c.damId === a.id)
  )
}

export function collectOffspring(birds, bird, out = [], seen = new Set()) {
  if (!bird || seen.has(bird.id)) return out
  seen.add(bird.id)
  for (const c of childrenOf(birds, bird)) {
    if (seen.has(c.id)) continue
    out.push(c)
    collectOffspring(birds, c, out, seen)
  }
  return out
}

/** Tarihe gün ekler (YYYY-MM-DD döner). */
export function addDays(dateStr, n) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** İki tarih arasındaki gün farkı (A - B). */
export function diffDays(dateA, dateB) {
  if (!dateA || !dateB) return 0
  const a = new Date(dateA)
  const b = new Date(dateB)
  const diffTime = a.getTime() - b.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

/** Bugünün tarihi (YYYY-MM-DD), YEREL saat dilimine göre. */
export function todayIso() {
  // toISOString() UTC döner. Türkiye UTC+3 olduğu için gece 00:00–03:00
  // arasında "bugün" hâlâ DÜN görünüyordu; geri sayımlar, varsayılan
  // tarihler ve bildirimler bir gün kayıyordu. Saat dilimi farkını
  // çıkararak yerel takvim gününü elde ediyoruz.
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** Kuluçka zaman çizelgesi hesaplamaları. */
export function clutchTimeline(clutch) {
  if (!clutch) return null
  const startEgg = clutch.egg2Date || clutch.egg1Date
  if (!startEgg) return null
  const checkDate = addDays(startEgg, 6)
  const expectedHatch = addDays(startEgg, 18)
  const effectiveHatch = clutch.hatchDate || expectedHatch
  const ringDate = addDays(effectiveHatch, 7)
  const weanDate = addDays(effectiveHatch, 30)

  const today = todayIso()
  const daysPassed = diffDays(today, startEgg)
  const daysToHatch = diffDays(expectedHatch, today)
  const daysToRing = diffDays(ringDate, today)

  // 18 günlük süreçte kuluçka yüzdesi
  let progressPct = Math.max(0, Math.min(100, Math.round((daysPassed / 18) * 100)))
  if (clutch.status === 'hatched' || clutch.status === 'done') progressPct = 100

  return {
    startEgg,
    checkDate,
    expectedHatch,
    effectiveHatch,
    ringDate,
    weanDate,
    daysPassed,
    daysToHatch,
    daysToRing,
    progressPct
  }
}

/** İki kuş arasındaki ortak ataları bulur. */
export function findCommonAncestors(birds, a, b, depth = 4) {
  if (!a || !b) return []
  const ancestors = bird => {
    const map = new Map()
    const seen = new Set()
    const walk = (node, gen, path) => {
      if (!node || gen > depth) return
      // Aynı kuşu aynı nesilde tekrar dolaşma: çift hatlı soyağacında
      // üstel tekrarı ve aynı atayı defalarca saymayı önler.
      const key = node.id + ':' + gen
      if (seen.has(key)) return
      seen.add(key)
      if (!map.has(node.id)) map.set(node.id, { bird: node, gen, paths: [path] })
      else map.get(node.id).paths.push(path)
      const sire = byId(birds, node.sireId)
      const dam = byId(birds, node.damId)
      if (sire) walk(sire, gen + 1, path ? `${path} → Baba` : 'Baba')
      if (dam) walk(dam, gen + 1, path ? `${path} → Anne` : 'Anne')
    }
    walk(bird, 0, '')
    return map
  }
  const A = ancestors(a)
  const B = ancestors(b)
  const common = []
  for (const [id, dataA] of A) {
    if (id === a.id || id === b.id) continue
    if (B.has(id)) {
      const dataB = B.get(id)
      common.push({
        bird: dataA.bird,
        genA: dataA.gen,
        genB: dataB.gen,
        pathA: dataA.paths[0],
        pathB: dataB.paths[0]
      })
    }
  }
  return common.sort((x, y) => (x.genA + x.genB) - (y.genA + y.genB))
}

// -------------------------------------------------- HASTALIK & TEDAVİ YÖNETİMİ
export const TREATMENT_STATUS = [
  { value: 'aktif', label: 'Aktif Tedavi', color: '#ef4444' },
  { value: 'karantina', label: 'Karantinada', color: '#f59e0b' },
  { value: 'iyilesti', label: 'İyileşti', color: '#10b981' },
  { value: 'kronik', label: 'Kronik', color: '#8b5cf6' }
]

export const COMMON_ILLNESSES = [
  'CIRTLAK / İSHAL',
  'ÇİÇEK',
  'İÇ PARAZİT',
  'KOKSİDİYOZ (KANLI İSHAL)',
  'KURUMA / ADENO-COLI',
  'ORNİTOZİS / TEK GÖZ',
  'SALLABAŞ (PMV-1)',
  'SALMONELLA (UR / FELÇ)',
  'TRİKOMONİYAZ (PAMUK)',
  'YARALANMA / EZİLME'
]

export function treatmentStatusLabel(status) {
  if (status === 'aktif') return 'Aktif Tedavi'
  if (status === 'karantina') return 'Karantinada'
  if (status === 'iyilesti') return 'İyileşti'
  if (status === 'kronik') return 'Kronik'
  return status || 'Belirtilmedi'
}

export function activeTreatmentsOf(treatments = [], birdId) {
  if (!Array.isArray(treatments)) return []
  return treatments.filter(t => t.birdId === birdId && (t.status === 'aktif' || t.status === 'karantina'))
}

export function treatmentDurationDays(startDate, endDate) {
  if (!startDate) return 0
  const start = new Date(startDate.slice(0, 10))
  const end = endDate ? new Date(endDate.slice(0, 10)) : new Date()
  const diffDays = Math.round(Math.abs(end - start) / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1)
}

// -------------------------------------------------- KOSTÜM & RENK GENETİĞİ VE KAPAK ALTI ANALİZİ
export const COSTUME_TYPES = [
  { id: 'CAKAL', label: 'ÇAKAL (DÜZ KAHVERENGİ / KIRMIZI)', series: 'kirmizi', pattern: 'duz', color: '#8a5a34', bg: '#8a5a3422' },
  { id: 'KIRMIZI_KOMPLE', label: 'KIRMIZI KOMPLE (BOYUN & GÖĞÜS BEYAZ)', series: 'kirmizi', pattern: 'komple', color: '#e8434f', bg: '#e8434f22' },
  { id: 'LIMONI', label: 'LİMONİ (DÜZ SARI)', series: 'sari', pattern: 'duz', color: '#eab308', bg: '#eab30822' },
  { id: 'SARI_KOMPLE', label: 'SARI KOMPLE (BOYUN & GÖĞÜS BEYAZ)', series: 'sari', pattern: 'komple', color: '#facc15', bg: '#facc1522' },
  { id: 'BEYAZ', label: 'DÜZ BEYAZ', series: 'beyaz', pattern: 'beyaz', color: '#f8fafc', bg: '#ffffff18' },
  { id: 'DIGER', label: 'DİĞER / FARKLI RENK', series: 'diger', pattern: 'diger', color: '#94a3b8', bg: '#94a3b822' }
]

export function detectCostumeType(bird) {
  if (!bird) return 'CAKAL'
  const text = trUpper(`${bird.color || ''} ${bird.cinsi || ''} ${bird.name || ''} ${bird.code || ''}`)

  // "BEYAZ KIRMIZILARDAN" ve "BEYAZ SARILARDAN" türü DÜZ BEYAZDIR
  if (text.includes('BEYAZ KIRMIZILARDAN') || text.includes('BEYAZ SARILARDAN') || text.includes('BEYAZ KIRMIZILAR') || text.includes('BEYAZ SARILAR')) {
    return 'BEYAZ'
  }

  const isKomple = text.includes('KOMPLE')
  const isSari = text.includes('SARI') || text.includes('LİMON') || text.includes('LIMON')
  const isBeyaz = text.includes('BEYAZ') && !isKomple
  const isCakal = text.includes('ÇAKAL') || text.includes('CAKAL') || text.includes('KAHVE') || text.includes('KIRMIZI')

  if (isKomple) {
    if (isSari) return 'SARI_KOMPLE'
    return 'KIRMIZI_KOMPLE'
  }
  if (isSari) return 'LIMONI'
  if (isBeyaz) return 'BEYAZ'
  if (isCakal) return 'CAKAL'
  return 'CAKAL'
}

export function analyzeCostumeMating(damTypeId, sireTypeId, damBird = null, sireBird = null) {
  const dam = COSTUME_TYPES.find(c => c.id === damTypeId) || COSTUME_TYPES[0]
  const sire = COSTUME_TYPES.find(c => c.id === sireTypeId) || COSTUME_TYPES[0]

  // 1. KÜMES ISLAH KURALI (Renk serisi disiplini: Kırmızı x Kırmızı, Sarı x Sarı)
  let lineStatus = 'valid' // valid | warning | neutral
  let lineTitle = '✅ KÜMES ISLAH KURALINA UYGUN'
  let lineDesc = 'Renk serisi saf tutuluyor. Ton derinliği ve saflık korunur.'
  let lineBadgeColor = '#10b981'

  const hasKirmizi = dam.series === 'kirmizi' || sire.series === 'kirmizi'
  const hasSari = dam.series === 'sari' || sire.series === 'sari'
  const isPureKirmizi = dam.series === 'kirmizi' && sire.series === 'kirmizi'
  const isPureSari = dam.series === 'sari' && sire.series === 'sari'
  const isWhiteInvolved = dam.series === 'beyaz' || sire.series === 'beyaz'

  if (hasKirmizi && hasSari) {
    lineStatus = 'warning'
    lineTitle = '⚠️ KÜMES ISLAH UYARISI: KIRMIZI & SARI ÇAPRAZLANMAZ'
    lineDesc = 'Kümesinizin ıslah kuralı gereği Kırmızı varyasyonları ile Sarı varyasyonları kırılmaz. Renk tonunun solmaması için Kırmızı ile Kırmızı, Sarı ile Sarı eşleştirilmelidir.'
    lineBadgeColor = '#ef4444'
  } else if (isPureKirmizi) {
    lineStatus = 'valid'
    lineTitle = '✅ SAF KIRMIZI HATTI EŞLEŞMESİ'
    lineDesc = 'Kırmızı varyasyonları kendi içinde eşleşiyor. Çakal ve Kırmızı Komple pigmenti tam güç korunur.'
    lineBadgeColor = '#10b981'
  } else if (isPureSari) {
    lineStatus = 'valid'
    lineTitle = '✅ SAF SARI HATTI EŞLEŞMESİ'
    lineDesc = 'Sarı varyasyonları kendi içinde eşleşiyor. Limoni ve Sarı Komple renk parlaklığı korunur.'
    lineBadgeColor = '#10b981'
  } else if (isWhiteInvolved) {
    lineStatus = 'neutral'
    lineTitle = 'ℹ️ BEYAZ İLE HAT AÇMA / TAZELEME EŞLEŞMESİ'
    lineDesc = 'Beyaz kanı deseni tazelemek ve parlatmak için kullanılır. Yavruların taşıyıcılık geçmişi kontrol edilmelidir.'
    lineBadgeColor = '#38bdf8'
  }

  // 2. KAPAK ALTI RİSK & GÜVENLİK ANALİZİ (Kuyruk altı beyazlığı kontrolü)
  let tailRisk = 'safe' // safe | caution | danger | neutral
  let tailScore = 95 // 0-100 (100 = kapak altı kesinlikle temiz/renkli)
  let tailTitle = '🟢 KAPAK ALTI GÜVENLİ & TERTEMİZ'
  let tailDesc = 'Kuyruk altına beyazlık kaçma riski yoktur. Kapak altı renkli ve kusursuz kalır.'
  let tailColor = '#10b981'
  let tailBg = '#10b98118'

  const isCakalxKomple = (dam.pattern === 'duz' && sire.pattern === 'komple') || (dam.pattern === 'komple' && sire.pattern === 'duz')
  const isKomplexKomple = dam.pattern === 'komple' && sire.pattern === 'komple'
  const isDuzxDuz = dam.pattern === 'duz' && sire.pattern === 'duz'
  const isDuzxBeyaz = (dam.pattern === 'duz' && sire.pattern === 'beyaz') || (dam.pattern === 'beyaz' && sire.pattern === 'duz')
  const isKomplexBeyaz = (dam.pattern === 'komple' && sire.pattern === 'beyaz') || (dam.pattern === 'beyaz' && sire.pattern === 'komple')
  const isBeyazxBeyaz = dam.pattern === 'beyaz' && sire.pattern === 'beyaz'

  if (isDuzxDuz) {
    tailRisk = 'safe'
    tailScore = 100
    tailTitle = '🟢 KUSURSUZ GÜVENLİ (HİÇ BEYAZLIK YOK)'
    tailDesc = 'Her iki ebeveyn de lekesiz düz renk (Çakal/Limoni) olduğu için kapak altı veya göğüs bozulması biyolojik olarak imkansızdır. %100 düz renk yavrular doğar.'
    tailColor = '#10b981'
    tailBg = '#10b98118'
  } else if (isCakalxKomple) {
    tailRisk = 'safe'
    tailScore = 95
    tailTitle = '🟢 KAPAK ALTI GÜVENLİ & MÜKEMMEL FRENLEME'
    tailDesc = 'Düz Çakal/Limoni ebeveyn genetik bir fren görevi görür. Beyazlığın kuyruk altına (kapak altına) taşmasını engeller. Komple yavruların kapak altı temiz renkli kalır, göğüs kesişimi jilet gibi sınırda biter.'
    tailColor = '#10b981'
    tailBg = '#10b98118'
  } else if (isKomplexKomple) {
    tailRisk = 'caution'
    tailScore = 65
    tailTitle = '🟡 DİKKAT: KAPAK ALTI KAÇMA RİSKİ (%25 - %35)'
    tailDesc = 'İki komple kuşun birleşmesi beyazlık dozunu kümülatif olarak artırır. Beyazlığın göğüsten kuyruk altına (kapak altına) sızma ve ensede çil atma riski bulunur. Ebeveynlerin kapak altının önceden kontrol edilmesi ve temiz olması şarttır.'
    tailColor = '#f59e0b'
    tailBg = '#f59e0b18'
  } else if (isDuzxBeyaz) {
    tailRisk = 'safe'
    tailScore = 85
    tailTitle = '🟢 GÜVENLİ DENGE'
    tailDesc = 'Düz renk ebeveyn (Çakal/Limoni), beyazın getireceği aşırı beyazlık yükünü dizginler. Beyazın soyunda kapak altı bozukluğu yoksa desen temiz oturur.'
    tailColor = '#10b981'
    tailBg = '#10b98118'
  } else if (isKomplexBeyaz) {
    tailRisk = 'danger'
    tailScore = 35
    tailTitle = '🔴 YÜKSEK RİSK: KAPAK ALTI KAÇIRABİLİR (%50 - %60)'
    tailDesc = 'Kompledeki beyazlık ile düz beyazın birleşimi beyazlık eşiğini aşırı yükseltir. Kuyruk altındaki renkli örtü tüylerinin beyazlaması (kapak altı kusuru) ve göğüs beyazlığının sırta taşma riski çok yüksektir. Bu eşleşme yerine Çakal × Beyaz tercih edilmelidir.'
    tailColor = '#ef4444'
    tailBg = '#ef444418'
  } else if (isBeyazxBeyaz) {
    tailRisk = 'neutral'
    tailScore = 100
    tailTitle = '⚪ BEYAZ HATTI EŞLEŞMESİ'
    tailDesc = 'İki düz beyazın birleşimi; yavruların %100 beyaz çıkması beklenir.'
    tailColor = '#38bdf8'
    tailBg = '#38bdf818'
  }

  // 3. YAVRU KIYAFET & RENK DAĞILIMI (Tahmini oranlar)
  let offspring = []
  if (isDuzxDuz) {
    const isS = dam.series === 'sari' || sire.series === 'sari'
    offspring = [
      { label: isS ? 'DÜZ LİMONİ' : 'DÜZ ÇAKAL', pct: 100, desc: 'Lekesiz düz tüy, tam renk derinliği', badge: '%100' }
    ]
  } else if (isCakalxKomple) {
    const isS = dam.series === 'sari' || sire.series === 'sari'
    const kompleName = isS ? 'SARI KOMPLE' : 'KIRMIZI KOMPLE'
    const duzName = isS ? 'DÜZ LİMONİ' : 'DÜZ ÇAKAL'
    offspring = [
      { label: kompleName, pct: 50, desc: 'Boyun çepeçevre beyaz, göğüs altı kuyruk kesişimine kadar beyaz, kapak altı temiz renkli', badge: '%50' },
      { label: duzName, pct: 50, desc: 'Lekesiz düz renk, gizli komple taşıyıcı damızlık', badge: '%50' }
    ]
  } else if (isKomplexKomple) {
    const isS = dam.series === 'sari' || sire.series === 'sari'
    const kompleName = isS ? 'SARI KOMPLE' : 'KIRMIZI KOMPLE'
    const duzName = isS ? 'DÜZ LİMONİ' : 'DÜZ ÇAKAL'
    offspring = [
      { label: kompleName, pct: 75, desc: 'Boyun ve göğüs altı beyaz komple (%30 kapak altı gevşeme payı ile)', badge: '%75' },
      { label: duzName, pct: 25, desc: 'Göğsü kapanmış düz lekesiz renk', badge: '%25' }
    ]
  } else if (isDuzxBeyaz) {
    const isS = dam.series === 'sari' || sire.series === 'sari'
    const duzName = isS ? 'DÜZ LİMONİ' : 'DÜZ ÇAKAL'
    offspring = [
      { label: duzName, pct: 50, desc: 'Düz renk veya kapalı önlüklü yavru', badge: '%50' },
      { label: 'DÜZ BEYAZ', pct: 50, desc: 'Beyaz renkli tüy', badge: '%50' }
    ]
  } else if (isKomplexBeyaz) {
    const isS = dam.series === 'sari' || sire.series === 'sari'
    const kompleName = isS ? 'SARI KOMPLE' : 'KIRMIZI KOMPLE'
    offspring = [
      { label: `${kompleName} (Geniş Beyazlı)`, pct: 50, desc: 'Kapak altı beyazlama ve sırta taşma riski yüksek', badge: '%50' },
      { label: 'DÜZ BEYAZ', pct: 50, desc: 'Beyaz renkli tüy', badge: '%50' }
    ]
  } else if (isBeyazxBeyaz) {
    offspring = [
      { label: 'DÜZ BEYAZ', pct: 100, desc: 'Lekesiz beyaz tüy', badge: '%100' }
    ]
  } else {
    offspring = [
      { label: 'KIRMIZI VEYA SARI KOMPLE', pct: 50, desc: 'Ebeveyn genlerine göre komple varyasyonu', badge: '%50' },
      { label: 'DÜZ ÇAKAL / LİMONİ', pct: 50, desc: 'Düz renk varyasyonu', badge: '%50' }
    ]
  }

  // 4. DAMIZLIK ISLAH & KAPAK ALTI KURTARMA TAVSİYESİ
  let remedyTip = null
  if (tailRisk === 'danger' || tailRisk === 'caution') {
    const isS = dam.series === 'sari' || sire.series === 'sari'
    const fixerBreed = isS ? 'Düz Limoni' : 'Düz Çakal'
    remedyTip = {
      title: '💡 Kapak Altını Toplama & Düzeltme Tavsiyesi',
      text: `Bu eşleşmedeki kapak altı riskini sıfırlamak ve kuyruk altını tertemiz renge boyamak için komple kuşu kümesinizdeki safkan bir "${fixerBreed}" damızlık ile eşleştirmeniz önerilir. Düz renk tüy geni, fazla beyazlığı dizginleyerek boyun-göğüs kesişimini jilet gibi oturtur.`,
      recommendedType: isS ? 'LIMONI' : 'CAKAL'
    }
  }

  return {
    dam,
    sire,
    lineStatus,
    lineTitle,
    lineDesc,
    lineBadgeColor,
    tailRisk,
    tailScore,
    tailTitle,
    tailDesc,
    tailColor,
    tailBg,
    offspring,
    remedyTip
  }
}