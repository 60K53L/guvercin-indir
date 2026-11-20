/**
 * Yavrular / Torunlar tablolarının ortak sütun genişlikleri.
 *
 * SORUN: `table-layout: fixed` + `width: 100%` kullanıldığında Chrome verilen
 * px genişlikleri tablo genişliğine göre ORANTILI şişiriyor (180px istenen
 * Künye kolonu 260px'e çıkıyor). Sonuçta "AD" sütununda devasa bir boşluk,
 * "CİNSİYET → KÜMES" arasında ise 4-7px'lik boğukluk oluşuyordu. Yüzde ya da
 * elle px ile tur atmak bu yüzden dengeyi tutturamıyor.
 *
 * ÇÖZÜM: Sütunlar doğal (içeriğe göre) yerleşimde ölçülür; ölçüm aynı gruptaki
 * tablolar arasında birleştirilir (her sütunda en geniş olan esas alınır).
 * Böylece iki tablo birebir aynı sütun genişliklerini paylaşır, tüm sütunlar
 * birbirine eşit aralıkla dizilir ve kalan boşluk tablonun sağ ucunda toplanır.
 *
 * KULLANICI İSTEĞİ: sütunlar "sıkışık" olmamalı; özellikle "Ad" sütunu
 * (çoğu kuşta isim yok) içeriğe göre çok dar kalmasın diye her sütun için
 * bir alt sınır (min genişlik) tanımlanır. Ölçülen doğal genişlik alt sınırdan
 * küçükse alt sınır kullanılır; böylece tablo rahat bir görünüm alır.
 */
export const BIRD_ROW_COLUMN_COUNT = 9

/** Sütunlar arası ortak boşluk (px). */
export const BIRD_ROW_GAP = 24

/** Her sütun için alt sınır (px): ölçülen doğal genişlik bundan küçükse
 *  bu değer kullanılır. Böylece "Ad" gibi çoğu satırda boş kalan sütunlar
 *  bile rahat bir genişlikte durur. */
export const BIRD_ROW_MIN_WIDTHS = [46, 212, 152, 230, 76, 122, 180, 180, 100]

/** Sütun sırası (CSS değişken adlarıyla eşleşir). */
export const BIRD_ROW_COLUMNS = [
  'photo',
  'ring',
  'name',
  'father',
  'sex',
  'coop',
  'cinsi',
  'color',
  'status'
]

/* ------------------------------------------------------------------ *
 * Grup deposu: aynı gruptaki tablolar genişlikleri paylaşır.
 * ------------------------------------------------------------------ */

const groups = new Map()

function group(id) {
  if (!groups.has(id)) groups.set(id, { sources: new Map(), listeners: new Set() })
  return groups.get(id)
}

/** Ölçülen genişlikleri birleştirir: her sütunda en geniş olan esas alınır. */
export function mergeWidths(...lists) {
  const result = []
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    list.forEach((w, i) => {
      if (w > (result[i] || 0)) result[i] = w
    })
  }
  return result
}

/**
 * Gruba ait ölçümü yayınlar ve birleşmiş sonucu döndürür.
 * Aynı kaynaktan aynı ölçüm gelirse gereksiz güncelleme yapılmaz.
 */
export function publishWidths(groupId, sourceId, measured) {
  if (!groupId || !Array.isArray(measured)) return null
  const g = group(groupId)
  const prev = g.sources.get(sourceId)
  if (prev && prev.length === measured.length && prev.every((w, i) => w === measured[i])) {
    return mergeWidths(...g.sources.values())
  }
  g.sources.set(sourceId, measured)
  const merged = mergeWidths(...g.sources.values())
  g.listeners.forEach(fn => fn(merged))
  return merged
}

/** Gruptaki genişlik değişikliklerini dinler. */
export function subscribeWidths(groupId, fn) {
  if (!groupId) return () => {}
  const g = group(groupId)
  g.listeners.add(fn)
  // Abone olunduğunda gruptaki diğer tablolardan toplanmış
  // en güncel genişlikleri hemen yeni aboneye aktar.
  const current = mergeWidths(...g.sources.values())
  if (current.length && current.some(w => w > 0)) {
    fn(current)
  }
  return () => g.listeners.delete(fn)
}

/**
 * Tablonun sütun genişliklerini DOĞAL yerleşimde ölçer.
 *
 * Tablo geçici olarak "bird-rows-natural" sınıfıyla auto yerleşime alınır ve
 * sütunlara atanmış genişlikler geçici olarak kaldırılır; böylece ölçüm
 * gerçek içerik genişliğini verir (daha önce uygulanan sabit genişliklerden
 * etkilenmez).
 *
 * Dönen dizi sütun sırasına göre px genişlikleridir.
 */
export function measureTableColumns(tableEl, count = BIRD_ROW_COLUMN_COUNT) {
  if (!tableEl) return null
  const cols = Array.from(tableEl.querySelectorAll('colgroup col'))
  const savedWidths = cols.map(col => col.style.width)
  cols.forEach(col => { col.style.width = 'auto' })
  tableEl.classList.add('bird-rows-natural')
  // Ölçüm için düzeni yeniden hesaplat.
  void tableEl.offsetWidth

  const widths = []
  const read = (cells) => {
    cells.forEach(cell => {
      const i = cell.cellIndex
      if (i >= count) return
      const w = cell.getBoundingClientRect().width
      if (w > (widths[i] || 0)) widths[i] = w
    })
  }
  read(Array.from(tableEl.querySelectorAll('thead th')))
  read(Array.from(tableEl.querySelectorAll('tbody tr td')))

  tableEl.classList.remove('bird-rows-natural')
  cols.forEach((col, i) => { col.style.width = savedWidths[i] })
  void tableEl.offsetWidth
  return widths.some(w => w > 0) ? widths : null
}

/**
 * Ölçülen genişliklerden nihai sütun genişliklerini üretir: her sütun
 * kendi içeriğine göre ölçülmüş genişliğini (ya da alt sınırını) alır ve
 * sağına SABİT boşluk eklenir. Böylece tüm sütunlar arasındaki görsel
 * aralık birebir eşittir; hiçbir sütun içeriğinden daha dar olmaz.
 */
export function applyGap(measured, gap = BIRD_ROW_GAP, mins = BIRD_ROW_MIN_WIDTHS) {
  if (!Array.isArray(measured)) return null
  return measured.map((w, i) => {
    const base = Math.max(w || 0, (mins && mins[i]) || 0)
    return base ? Math.ceil(base + gap) : base
  })
}
