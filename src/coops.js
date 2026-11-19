/**
 * Çoklu kümes (coop) yardımcıları.
 *
 * ÖNEMLİ İSİM AYRIMI:
 *   - `settings.loftMode` / `settings.loftName` → mevcut "kümes türü" ve
 *     pedegri başlığı. Bunlara dokunulmuyor.
 *   - `coop` / `coops` → çatıdaki fiziksel bölmeler (ÇATI-1, ÇATI-2...).
 *
 * Bu dosya SAF çalışır: `db` nesnesini değiştirmez, yalnızca filtrelenmiş
 * görünüm üretir. Böylece Firestore'a yazmadan ekranları ayırabiliriz.
 */
import { footCode, footNumber, isFormer, isGone, sortTr, trSearch, trUpper } from './lib.js'

/** "Tümü" seçimi. Boş string bilinçli olarak kullanılıyor. */
export const ALL_COOPS = ''

/** Eski kayıtların düştüğü sabit kümes kimliği. */
export const DEFAULT_COOP_ID = 'coop_ana'
export const DEFAULT_COOP_NAME = 'ANA KÜMES'

/** Kümes rozetlerinde sırayla kullanılan renkler. */
export const COOP_COLORS = [
  '#38bdf8', '#f59e0b', '#a855f7', '#10b981',
  '#ef4444', '#ec4899', '#eab308', '#14b8a6'
]

/** Yeni kümes için varsayılan kayıt. */
export function defaultCoop(name = DEFAULT_COOP_NAME) {
  const clean = trUpper(String(name || '').trim()).trim() || DEFAULT_COOP_NAME
  return {
    id: DEFAULT_COOP_ID,
    name: clean,
    color: COOP_COLORS[0],
    order: 0,
    createdAt: ''
  }
}

/**
 * Gelen kümes dizisini güvenli hâle getirir.
 *
 * - Boş/eksik kimlikleri deterministik üretir (`coop_1`, `coop_2`).
 * - Aynı isimleri ` 2`, ` 3` ekleyerek tekilleştirir.
 * - İsimleri Türkçe kurallarla büyük harfe çevirir.
 * - Sıralamayı `order` alanına göre korur.
 * - Dizi boşsa `fallbackName` (genellikle `loftName`) ile varsayılan kümes
 *   oluşturur.
 */
export function normalizeCoops(raw, fallbackName = '') {
  const source = Array.isArray(raw) ? raw : []
  const usedIds = new Set()
  const usedNames = new Set()
  const out = []

  source.forEach((rawCoop, index) => {
    if (!rawCoop || typeof rawCoop !== 'object') return

    let id = String(rawCoop.id || '').trim()
    if (!id || usedIds.has(id)) {
      let n = index + 1
      while (usedIds.has(`coop_${n}`)) n++
      id = `coop_${n}`
    }
    usedIds.add(id)

    let name = trUpper(String(rawCoop.name || '').trim()).trim()
    if (!name) name = `KÜMES ${index + 1}`
    const baseName = name
    let suffix = 2
    while (usedNames.has(name)) {
      name = `${baseName} ${suffix++}`
    }
    usedNames.add(name)

    const order = Number.isFinite(Number(rawCoop.order)) ? Number(rawCoop.order) : index
    const color = String(rawCoop.color || '').trim() || COOP_COLORS[index % COOP_COLORS.length]

    out.push({ ...rawCoop, id, name, order, color })
  })

  if (!out.length) {
    const name = trUpper(String(fallbackName || '').trim()).trim() || DEFAULT_COOP_NAME
    return [defaultCoop(name)]
  }

  return out.sort((a, b) =>
    a.order - b.order ||
    a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' })
  )
}

/** Veritabanındaki kümes listesi. Eski kayıtlarda varsayılan üretilir. */
export function coopList(db) {
  return normalizeCoops(db?.settings?.coops, db?.settings?.loftName)
}

/** Kimliğe göre kümes; bulunamazsa ilk kümes döner (arayüz için güvenli). */
export function coopById(db, id) {
  const list = coopList(db)
  return list.find(c => c.id === id) || list[0]
}

/** Eksik `coopId` değerlerinin bağlanacağı kümes kimliği. */
export function fallbackCoopId(coops) {
  if (!Array.isArray(coops) || !coops.length) return DEFAULT_COOP_ID
  return coops.some(c => c.id === DEFAULT_COOP_ID) ? DEFAULT_COOP_ID : coops[0].id
}

/**
 * Bir kuşun kümesini çözer.
 * Geçersiz/silinmiş kümes kimliği varsa yedek kümese düşer.
 */
export function resolveBirdCoopId(bird, coops) {
  const raw = String(bird?.coopId || '').trim()
  const fallback = fallbackCoopId(coops)
  if (!raw) return fallback
  if (!Array.isArray(coops) || !coops.length) return raw
  return coops.some(c => c.id === raw) ? raw : fallback
}

/** Kısa kullanım: kuşun kümesi (veritabanından çözülür). */
export function birdCoopId(bird, db) {
  return resolveBirdCoopId(bird, coopList(db))
}

/** Kuş bu kümes görünümüne giriyor mu? `coopId` boşsa "Tümü". */
export function birdInCoop(bird, coopId, db) {
  if (!coopId) return true
  return birdCoopId(bird, db) === coopId
}

/**
 * Aynı künyenin (ayak rengi + numara) aynı kümesde tekrarını bulur.
 *
 * KURAL: Klipsler KÜMES BAZINDA benzersizdir. Aynı klips (ör. SİYAH-SARI)
 * farklı kümeslerde farklı kuşlara takılabilir; ama aynı kümesde aynı
 * ayak/renk/numara/cinsiyet iki kez kullanılamaz.
 *
 * Dönen değer: `null` (çakışma yok) veya `{ dup, foot: 'left'|'right' }`.
 */
export function findCoopRingDuplicate(db, bird, coops) {
  const list = (Array.isArray(coops) && coops.length) ? coops : coopList(db)
  const candidate = bird || {}
  const targetCoopId = resolveBirdCoopId(candidate, list)

  for (const foot of ['left', 'right']) {
    const code = footCode(candidate, foot)
    const number = footNumber(candidate, foot)
    if (!code || !number) continue

    const dup = (db?.birds || []).find(b =>
      b.id !== candidate.id &&
      resolveBirdCoopId(b, list) === targetCoopId &&
      (b.sex || '') === (candidate.sex || '') &&
      trSearch(footCode(b, foot)) === trSearch(code) &&
      footNumber(b, foot) === number
    )
    if (dup) return { dup, foot }
  }
  return null
}

/**
 * Bir kümesin görülebilir cins (ırk/seri) listesi.
 *
 * CİNS LİSTESİ KÜMES BAZINDADIR: bir kümesin cinsleri başka kümesde
 * görünmez. Liste iki kaynaktan birleşir:
 *   1) `settings.coopCinsi[coopId]` → kullanıcının o kümeste elle eklediği
 *      cinsler (kuş olmasa bile listede kalır),
 *   2) o kümesdeki kuşların `cinsi` alanları → eski kayıtlarda cinsler
 *      kuşta durduğu için veri kaybını önleyen güvence.
 *
 * `coopId` boşsa ("Tümü") tüm kümeslerin listeleri tek listede birleşir.
 */
/**
 * Cins listesi sıralaması: normal cinsler alfabetik, nadir bulunan cinsler
 * (Çikolata, Joker, Küllü Limoni, Küllü Sarı Komple) listenin sonunda kendi
 * aralarında alfabetik.
 */
const RARE_CINSI = ['ÇİKOLATA', 'JOKER', 'KÜLLÜLİMONİ', 'KÜLLÜSARIKOMPLE']

function normalizeCinsiKey(name) {
  return trUpper(String(name || '')).replace(/[\s-]+/g, '')
}

function isRareCinsi(name) {
  const u = normalizeCinsiKey(name)
  return RARE_CINSI.some(r => u.includes(r))
}

export function sortCinsi(list) {
  const normal = []
  const rare = []
  for (const x of list) {
    (isRareCinsi(x) ? rare : normal).push(x)
  }
  return [...sortTr(normal), ...sortTr(rare)]
}

export function coopCinsiList(db, coopId) {
  const coops = coopList(db)
  const map = (db?.settings && db.settings.coopCinsi) || {}
  const birds = db?.birds || []
  const storedFor = id => (Array.isArray(map[id]) ? map[id] : [])

  if (!coopId) {
    const all = birds.map(b => b.cinsi).filter(Boolean)
    for (const c of coops) all.push(...storedFor(c.id))
    return sortCinsi([...new Set(all)])
  }

  const target = String(coopId)
  const coopIds = new Set(coops.map(c => c.id))
  const fallback = fallbackCoopId(coops)
  const own = birds
    .filter(b => {
      const raw = String(b?.coopId || '').trim()
      if (!raw) return fallback === target
      return (coopIds.has(raw) ? raw : fallback) === target
    })
    .map(b => b.cinsi)
    .filter(Boolean)

  return sortCinsi([...new Set([...storedFor(target), ...own])])
}

/**
 * Ayarlara bir kümesin cins listesini yazar (saf; yeni ayar nesnesi döner).
 * Böylece `settings.coopCinsi` içinde o kümesin listesi güncellenir, diğer
 * kümeslerin listeleri bozulmaz.
 */
export function withCoopCinsi(settings, coopId, list) {
  const base = settings || {}
  const map = { ...(base.coopCinsi || {}) }
  if (coopId) {
    map[String(coopId)] = sortCinsi([...new Set((list || []).filter(Boolean))])
  }
  return { ...base, coopCinsi: map }
}

/**
 * Ekranlar için filtrelenmiş veritabanı görünümü.
 *
 * Kümes bilgisi yalnızca kuşta tutulur; diğer kayıtlar kuş bağlantısından
 * türetilir. Böylece kuş taşındığında ek yazma gerekmez.
 *
 * Katı izolasyon kuralı: kümes seçiliyken iki tarafı da o kümeste olmayan
 * çiftleşme/kuluçka kayıtları gösterilmez. Bu kayıtlar "Tümü" görünümünde
 * görünür.
 */
export function scopeDb(db, coopId) {
  if (!db) return db
  if (!coopId) return db

  const coops = coopList(db)
  const coopIds = new Set(coops.map(c => c.id))
  const fallback = fallbackCoopId(coops)
  const coopOf = bird => {
    const id = String(bird?.coopId || '').trim()
    if (!id) return fallback
    return coopIds.has(id) ? id : fallback
  }

  const birds = (db.birds || []).filter(b => coopOf(b) === coopId)
  const birdIds = new Set(birds.map(b => b.id))
  const knownBirdIds = new Set((db.birds || []).map(b => b.id))

  const inScope = id => Boolean(id) && birdIds.has(id)
  const exists = id => Boolean(id) && knownBirdIds.has(id)

  /**
   * Anne/baba bağlantılı kayıtlar (çiftleşme, kuluçka).
   * İki tarafın kuşu da duruyorsa İKİSİ de kapsamda olmalı; bir taraf
   * gerçekten silinmişse kalan taraf yeterlidir. "Başka kümede" olan kuş
   * silinmiş sayılmaz: iki taraf da veritabanında varsa kayıt yine yalnızca
   * iki tarafın birlikte bulunduğu kümede görünür.
   */
  const bothParentsInScope = record => {
    const maleId = record?.maleId
    const femaleId = record?.femaleId
    // Ebeveyni olmayan kayıt (ör. bilinmeyen kuluçka) hiçbir kümese
    // bağlanamaz; görünmez olmasın diye tüm görünümlerde gösterilir.
    if (!maleId && !femaleId) return true

    const maleExists = exists(maleId)
    const femaleExists = exists(femaleId)
    if (maleExists && femaleExists) return inScope(maleId) && inScope(femaleId)
    if (maleExists) return inScope(maleId)
    if (femaleExists) return inScope(femaleId)
    // İki tarafın kuş kaydı da yok: bağlanacak küme kalmadı, görünür kalsın.
    return true
  }

  const pairings = (db.pairings || []).filter(p =>
    bothParentsInScope(p) || (p.chickIds || []).some(inScope)
  )

  const clutches = (db.clutches || []).filter(c =>
    bothParentsInScope(c) || (c.chickIds || []).some(inScope)
  )

  const treatments = (db.treatments || []).filter(t => !t.birdId || inScope(t.birdId))

  /**
   * Aşılar ortak bazdır: `birdIds` boşsa tüm kümeslerde geçerli kayıttır.
   * Belirli kuşlara uygulanmışsa yalnızca o kuşların kümesinde görünür.
   */
  const vaccinations = (db.vaccinations || []).filter(v => {
    const ids = Array.isArray(v.birdIds) ? v.birdIds : []
    if (!ids.length) return true
    return ids.some(inScope)
  })

  return {
    ...db,
    birds,
    pairings,
    clutches,
    treatments,
    vaccinations
  }
}

/**
 * "Eşli kuş" sayacının ve Eşli Kuşlar ekranının ortak hesabı.
 *
 * NEDEN AYRI BİR YARDIMCI?
 *   `scopeDb` bir kümeye yalnızca iki tarafı da o kümede olan çiftleşmeleri
 *   sokar. Eşi başka kümede olan kuş ise `coopStats` içinde "eşli" sayılır.
 *   Bu yüzden "44 eşli kuş" ile ekranda görünen "22 çift" her zaman aynı
 *   şeyi anlatmaz. Burada çiftleri üçe ayırıyoruz:
 *
 *   - `samePairs`   : iki taraf da bu kümede
 *   - `crossPairs`  : bir taraf bu kümede, eşi başka kümede
 *   - `orphanPairs` : bir tarafın kuş kaydı hiç yok (gerçekten silinmiş)
 *
 *   Yalnızca bu kümede yaşayan kuşu olan kayıtlar dikkate alınır; böylece
 *   sayaç (`mated`) ile ekran aynı kaynak kümesini kullanır.
 */
export function coopMatingBreakdown(db, coopId) {
  const scoped = scopeDb(db, coopId)
  const alive = (scoped.birds || []).filter(b => !isGone(b))
  const aliveIds = new Set(alive.map(b => b.id))
  const byBirdId = new Map((db?.birds || []).map(b => [b.id, b]))

  const samePairs = []
  const crossPairs = []
  const orphanPairs = []
  const matedIds = new Set()

  for (const p of db?.pairings || []) {
    if (isFormer(p)) continue
    if (!p.maleId && !p.femaleId) continue

    const male = p.maleId ? (byBirdId.get(p.maleId) || null) : null
    const female = p.femaleId ? (byBirdId.get(p.femaleId) || null) : null
    const maleIn = Boolean(male) && aliveIds.has(male.id)
    const femaleIn = Boolean(female) && aliveIds.has(female.id)

    // Bu kümede yaşayan hiçbir taraf yoksa kayıt bu kümenin sayacına girmez.
    if (!maleIn && !femaleIn) continue

    if (maleIn) matedIds.add(male.id)
    if (femaleIn) matedIds.add(female.id)

    const item = {
      pairing: p,
      male,
      female,
      maleIn,
      femaleIn,
      // Kimlik var ama kuş yok → gerçekten silinmiş. Başka kümedeki kuş
      // "eksik" değildir; yalnızca bu görünümün dışındadır.
      maleMissing: Boolean(p.maleId) && !male,
      femaleMissing: Boolean(p.femaleId) && !female
    }

    if (item.maleMissing || item.femaleMissing) orphanPairs.push(item)
    else if (maleIn && femaleIn) samePairs.push(item)
    else crossPairs.push(item)
  }

  return {
    total: alive.length,
    mated: alive.filter(b => matedIds.has(b.id)).length,
    unpaired: alive.filter(b => !matedIds.has(b.id)),
    pairs: samePairs.length + crossPairs.length,
    samePairs,
    crossPairs,
    orphanPairs
  }
}

/** Kuş listesindeki sayaçların kümes bazlı hâli. */
export function coopStats(db, coopId) {
  const scoped = scopeDb(db, coopId)
  const alive = (scoped.birds || []).filter(b => !isGone(b))
  const breakdown = coopMatingBreakdown(db, coopId)
  return {
    total: alive.length,
    male: alive.filter(b => b.sex === 'M').length,
    female: alive.filter(b => b.sex === 'F').length,
    mated: breakdown.mated,
    // Rozetin alt satırında gösterilen çift sayısı; Eşli Kuşlar penceresinin
    // başlığıyla aynı kümeden gelir (kopuk kayıtlar çift sayılmaz).
    pairs: breakdown.pairs
  }
}

/** Yeni kümes için çakışmayan isim önerisi: KÜMES 2, KÜMES 3... */
export function nextCoopName(coops) {
  const existing = new Set((coops || []).map(c => c.name))
  let n = (coops || []).length + 1
  while (existing.has(`KÜMES ${n}`)) n++
  return `KÜMES ${n}`
}

/** Sıradaki kümes rengi. */
export function nextCoopColor(coops) {
  return COOP_COLORS[(coops || []).length % COOP_COLORS.length]
}
