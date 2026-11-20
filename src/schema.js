/**
 * Ortak veri şekli. Hem Electron'un JSON dosyasından hem Firestore'dan
 * gelen veri aynı formata döner, böylece React bileşenleri farkı bilmez.
 */
import { normalizeThemeId } from './theme-ids.js'
import { DEFAULT_MED_CATEGORIES, sortTr, normalizeExternalParent, isDualCode, extractAllRingCodes } from './lib.js'
import { defaultCoop, fallbackCoopId, normalizeCoops, sortCinsi } from './coops.js'

export const SCHEMA_VERSION = 2

/* Türkçe alfabetik sıralama TEK yerde tanımlıdır: src/lib.js.
   Eskiden burada ikinci bir kopya vardı; iki kaynak birbirinden
   bağımsız değişebilirdi. Buradan yeniden dışa verilir, böylece
   "şema katmanı sortTr kullanır" kuralı bozulmaz. */
export { sortTr }

export const EMPTY_DB = {
  version: SCHEMA_VERSION,
  birds: [],
  pairings: [],
  clutches: [],
  medications: [],
  vaccinations: [],
  treatments: [],
  supplements: [],
  settings: {
    codes: [],
    rightCodes: [],
    leftCodes: [],
    singleCodes: [],
    dualCodes: [],
    cinsi: [],
    coopCinsi: {},
    medicationCategories: [...DEFAULT_MED_CATEGORIES],
    owner: '',
    theme: 'dumanli',
    loftMode: 'saya',
    loftName: '',
    coops: [defaultCoop()]
  }
}

export const emptyDb = () => ({
  version: SCHEMA_VERSION,
  birds: [],
  pairings: [],
  clutches: [],
  medications: [],
  vaccinations: [],
  treatments: [],
  supplements: [],
  settings: {
    codes: [],
    rightCodes: [],
    leftCodes: [],
    singleCodes: [],
    dualCodes: [],
    cinsi: [],
    coopCinsi: {},
    medicationCategories: [...DEFAULT_MED_CATEGORIES],
    owner: '',
    theme: 'dumanli',
    loftMode: 'saya',
    loftName: '',
    coops: [defaultCoop()]
  }
})

/**
 * Kuş künye kodlarını, ayak ayrımını ve numaraları normalize eder.
 *
 * HER AYAK KENDİ KODUNU VE KENDİ NUMARASINI TAŞIR:
 *   leftCode  + leftNumber   → sol ayak (kuşun geldiği soy / ataları)
 *   rightCode + rightNumber  → sağ ayak (kuşun kendi soyu / verdiği yavrular)
 *
 * `listFoot` kullanıcının "listede hangi ayağın rengiyle görünsün" seçimidir.
 * Boşsa otomatik kural işler: sol ayak doluysa sol, yoksa sağ.
 *
 * `code` ve `number` TÜRETİLMİŞ alanlardır: eşleşme sıralaması, liste
 * gruplaması ve tek satırlık künye metni bunları kullanır. Seçilen ayağın
 * kod/numarası buraya yazılır; böylece ayak ekleme özelliğiyle gelen
 * değişiklik eski sıralama/arama kodunu bozmaz.
 *
 * Eski kayıtlarda tek `number` vardı: hangi ayakta kod varsa numara oraya
 * taşınır (bir kez). Numarası "GC" olanlar sağ ayağa düşer — GC, o rengin
 * anne/babası demektir; sayılı olanlar yavru olduğu için sol ayağa.
 * "BEYAZ KLİPS-03" gibi birleşik yazımlar da ayrıştırılır.
 */
export function normalizeBird(b) {
  if (!b) return b
  let r = (b.rightCode || '').trim()
  let l = (b.leftCode || '').trim()
  let rn = String(b.rightNumber ?? '').trim()
  let ln = String(b.leftNumber ?? '').trim()
  let num = String(b.number ?? '').trim()
  const listFoot = b.listFoot === 'left' || b.listFoot === 'right' ? b.listFoot : ''
  const rawCode = (b.code || '').trim()

  // Eğer sağ veya sol ayak henüz atanmamışsa:
  if (!r && !l) {
    // 1) Tire ile birleşik kod/numara kontrolü (örn. "BEYAZ KLİPS-03" veya "MOR KLİPS-GC")
    if (rawCode.includes('-') || num.includes('-')) {
      const full = rawCode.includes('-') ? rawCode : num
      const idx = full.lastIndexOf('-')
      if (idx > 0) {
        const cPart = full.slice(0, idx).trim()
        const nPart = full.slice(idx + 1).trim()
        const nUpper = nPart.toLocaleUpperCase('tr-TR')
        if (nUpper === 'GC' || nUpper.includes('GC')) {
          r = cPart
          l = ''
          num = nUpper
        } else {
          l = cPart
          r = ''
          num = nPart
        }
      }
    } else if (rawCode) {
      // 2) Normal code + number ayrımı
      const numUpper = num.toLocaleUpperCase('tr-TR')
      if (numUpper === 'GC' || numUpper.includes('GC')) {
        r = rawCode
        l = ''
        num = numUpper || 'GC'
      } else {
        l = rawCode
        r = ''
      }
    }
  }

  // Eski tek `number` alanı, kodu olan ayağa taşınır (geriye dönük uyum).
  if (!ln && !rn && num) {
    if (l) ln = num
    else if (r) rn = num
  }

  // Listede gösterilecek ayak: kullanıcı seçtiyse o, yoksa sol doluysa sol.
  const foot = listFoot || (l ? 'left' : r ? 'right' : '')
  const mainCode = foot === 'right' ? r : l
  const otherCode = foot === 'right' ? l : r
  const mainNum = foot === 'right' ? rn : ln
  const otherNum = foot === 'right' ? ln : rn

  const code = (mainCode || otherCode || rawCode).trim()
  // Numara seçilen ayağın olmalı; o ayakta numara yoksa diğer ayağa düşer.
  const number = (mainCode || otherCode) ? (mainNum || otherNum) : num

  return {
    ...b,
    rightCode: r,
    leftCode: l,
    rightNumber: rn,
    leftNumber: ln,
    listFoot,
    code,
    number,
    // Kayıt dışı anne/baba yalnızca bilgi alanıdır; gerçek kimlik varsa temizlenir.
    damOutside: normalizeExternalParent(b.damOutside, b.damId),
    sireOutside: normalizeExternalParent(b.sireOutside, b.sireId)
  }
}

/** Eski sürümlerden gelen alanları bugünkü hâle getirir. */
export function migrate(data) {
  const out = { ...emptyDb(), ...(data || {}) }
  out.birds = Array.isArray(out.birds) ? out.birds.filter(b => b && b.id) : []
  out.pairings = Array.isArray(out.pairings) ? out.pairings.filter(p => p && p.id) : []
  out.clutches = Array.isArray(out.clutches) ? out.clutches.filter(c => c && c.id) : []
  out.medications = Array.isArray(out.medications) ? out.medications.filter(m => m && m.id) : []
  out.vaccinations = Array.isArray(out.vaccinations) ? out.vaccinations.filter(v => v && v.id) : []
  out.treatments = Array.isArray(out.treatments) ? out.treatments.filter(t => t && t.id) : []
  out.supplements = Array.isArray(out.supplements) ? out.supplements.filter(s => s && s.id) : []
  out.settings = { ...EMPTY_DB.settings, ...(data?.settings || {}) }
  if (!Array.isArray(out.settings.codes)) out.settings.codes = []
  if (!Array.isArray(out.settings.rightCodes)) {
    out.settings.rightCodes = Array.isArray(out.settings.codes) ? [...out.settings.codes] : []
  }
  if (!Array.isArray(out.settings.leftCodes)) {
    out.settings.leftCodes = Array.isArray(out.settings.codes) ? [...out.settings.codes] : []
  }
  if (!Array.isArray(out.settings.cinsi)) out.settings.cinsi = []
  if (!Array.isArray(out.settings.medicationCategories) || out.settings.medicationCategories.length === 0) {
    out.settings.medicationCategories = [...DEFAULT_MED_CATEGORIES]
  } else {
    out.settings.medicationCategories = sortTr(out.settings.medicationCategories)
  }
  out.settings.theme = normalizeThemeId(out.settings.theme)
  out.settings.loftMode = out.settings.loftMode || 'saya'
  out.settings.loftName = out.settings.loftName || ''
  /* Çoklu kümes: eski kayıtta `coops` yoksa `loftName` (varsa) adıyla tek
     varsayılan kümes üretilir. Kuşların eksik/geçersiz `coopId` değerleri
     bu kümese bağlanır; böylece 200 mevcut kuş için toplu yazma gerekmez. */
  const rawCoops = data?.settings && Object.prototype.hasOwnProperty.call(data.settings, 'coops')
    ? data.settings.coops
    : []
  out.settings.coops = normalizeCoops(rawCoops, out.settings.loftName)
  const coopIds = new Set(out.settings.coops.map(c => c.id))
  const defaultCoopId = fallbackCoopId(out.settings.coops)
  out.settings.rightCodes = sortTr(out.settings.rightCodes)
  out.settings.leftCodes = sortTr(out.settings.leftCodes)
  if (!out.settings.codes.length) {
    out.settings.codes = sortTr([...new Set([...out.settings.rightCodes, ...out.settings.leftCodes])])
  } else {
    out.settings.codes = sortTr(out.settings.codes)
  }
  out.settings.cinsi = sortCinsi(out.settings.cinsi)

  for (let i = 0; i < out.birds.length; i++) {
    const b = out.birds[i]
    if (b.status === 'tirgin' || b.status === 'gubrec') b.status = 'bosta'
    if (!Array.isArray(b.photos)) b.photos = []
    if (!b.coopId || !coopIds.has(b.coopId)) b.coopId = defaultCoopId
    out.birds[i] = normalizeBird(b)
  }

  /* KLİPS LİSTESİ: Kuşların üzerindeki tüm kodlar ve ayarlardaki kodlar
     (BEJ, GRİ-BEYAZ vb.) eksiksiz birleştirilir; tek ve çift renkler
     hem ayarlarda hem kuş seçicilerinde %100 eşit ve eksiksiz listelenir. */
  const ringData = extractAllRingCodes(out)
  out.settings.singleCodes = ringData.singleCodes
  out.settings.dualCodes = ringData.dualCodes
  out.settings.codes = ringData.allCodes
  out.settings.rightCodes = ringData.allCodes
  out.settings.leftCodes = ringData.allCodes

  /* CİNS LİSTESİ KÜMES BAZINDA TUTULUR.
     Eski tek ortak liste (`settings.cinsi`) artık kümelere dağıtılmaz;
     her kümesin listesi kendi kuşlarının `cinsi` alanından türetilir,
     kullanıcının elle eklediği cinsler `coopCinsi` altında saklanır.
     Böylece bir kümesin cinsleri başka kümesde görünmez (kuş listesi
     izolasyonuyla aynı kural). Eski `cinsi` alanı uyumluluk için kalır. */
  const rawCinsiMap = (out.settings.coopCinsi && typeof out.settings.coopCinsi === 'object')
    ? out.settings.coopCinsi
    : {}
  const coopCinsi = {}
  for (const coop of out.settings.coops) {
    const stored = Array.isArray(rawCinsiMap[coop.id]) ? rawCinsiMap[coop.id] : []
    const own = out.birds.filter(b => b.coopId === coop.id).map(b => b.cinsi).filter(Boolean)
    coopCinsi[coop.id] = sortCinsi([...new Set([...stored, ...own])])
  }
  out.settings.coopCinsi = coopCinsi
  const pairMap = new Map()
  const cleanPairings = []

  for (const raw of out.pairings) {
    if (!raw || !raw.id) continue
    const p = { ...raw }
    if (!Array.isArray(p.chickIds)) p.chickIds = []
    if (p.durum !== 'eski') p.durum = 'simdi'

    const key = (p.maleId || p.femaleId) ? `${p.maleId || ''}_${p.femaleId || ''}` : p.id

    if (!pairMap.has(key)) {
      pairMap.set(key, p)
      cleanPairings.push(p)
    } else {
      const existing = pairMap.get(key)
      // Yavruları birleştir
      existing.chickIds = [...new Set([...(existing.chickIds || []), ...(p.chickIds || [])])]
      // Eğer kopyalardan biri 'simdi' ise ana kaydı 'simdi' yap
      if (p.durum === 'simdi') existing.durum = 'simdi'
      // Notları birleştir
      if (p.notes && !existing.notes?.includes(p.notes)) {
        existing.notes = existing.notes ? `${existing.notes} · ${p.notes}` : p.notes
      }
    }
  }
  out.pairings = cleanPairings
  out.version = SCHEMA_VERSION
  return out
}