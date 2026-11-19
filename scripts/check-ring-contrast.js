/**
 * Künye (ring) kontrast denetimi.
 *
 * Künye rengi kuşun renginden türer ve KESİNLİKLE değiştirilmez — kullanıcı
 * "yeşil yeşil görünmüyor, siyah siyah görünmüyor" dediğinde kastettiği
 * budur. Okunabilirliği artırmak için renk değiştirilmez.
 *
 * ÇÖZÜM: renk metin rengi değil, ROZET ZEMİNİ olur (bkz. styles.css
 * .ring-chip). Yazı rengi dolgunun parlaklığına göre seçilir. Böylece
 * okunabilirlik TEMA'DAN BAĞIMSIZ olur: hiçbir renk hiçbir temada
 * okunmaz olmaz ve hiçbir renge kontür gerekmez.
 *
 * Eski denetim (tema başına hangi renge kontür verilecek) artık geçersiz —
 * kontür kuralları gereksizleşti. Yerine TEMA BAĞIMSIZ değişmez kural
 * denetlenir: dolgunun üstündeki yazı her zaman okunabilir olmalı.
 *
 *   - her palet rengi için yazı/dolgu kontrastı >= 4.5 (WCAG AA)
 *   - bir rengin hem koyu hem açık yazıyla da okunması kastediliyorsa
 *     bu BİR TEMA BİLGİSİDİR ve burada doğrulanmaz; tek kural yeterlidir
 *   - tema dosyalarında ölü kontür kalıntısı kalmadığı doğrulanır
 *
 * Palet değişirse ya da inkFor eşiği değişirse burası kırmızıya döner.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const kok = join(dirname(fileURLToPath(import.meta.url)), '..')
const esik = 4.5

const lum = (hex) => {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}
const kontrast = (a, b) => {
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function paletiOku() {
  const kaynak = readFileSync(join(kok, 'src', 'lib.js'), 'utf8')
  const blok = kaynak.match(/const COLOR_WORDS = \[([\s\S]*?)\n\]/)[1]
  const palet = []
  for (const satir of blok.split('\n')) {
    const m = satir.match(/\['([^']+)',\s*'(#[0-9a-fA-F]{6})'\]/)
    if (m) palet.push({ ad: m[1], renk: m[2] })
  }
  return palet
}

// lib.js'teki inkFor KURALI ile AYNI olmalı. Kural artık sabit eşik değil:
// koyu ve açık yazı seçeneklerinin KENDİ kontrastı hesaplanır, yüksek olan
// seçilir. Denetim de aynısını uygular — tek kaynak burası değil, lib.js.
const INK_KOYU = '#12151b'
const INK_ACIK = '#ffffff'

function inkSec(hex) {
  const l = lum(hex)
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? INK_KOYU : INK_ACIK
}

function kuralDogrula() {
  const kaynak = readFileSync(join(kok, 'src', 'lib.js'), 'utf8')
  if (!kaynak.includes('const koyuKontrast = (l + 0.05) / 0.05')) {
    throw new Error(
      'lib.js: inkFor kuralı değişmiş. Bu denetim değişmediyse kuralı da güncelle.'
    )
  }
}

const palet = paletiOku()
kuralDogrula()

console.log('KÜNYE ROZETİ KONTRAST DENETİMİ')
console.log('  yazı seçimi: koyu/açık arasından kontrastı yüksek olan')
console.log('-'.repeat(62))

let hata = 0
for (const { ad, renk } of palet) {
  const yazi = inkSec(renk)
  const r = kontrast(renk, yazi)
  const ok = r >= esik
  if (!ok) hata++
  console.log(
    `  ${ok ? '✓' : '✗'} ${ad.padEnd(11)} dolgu ${renk}  yazı ${yazi}  kontrast ${r.toFixed(2)}`
  )
}

// Tema dosyalarında ölü kontür kalıntısı olmamalı: rozet kendi kontrastını
// taşıyor, tema zemini artık rol oynamıyor.
console.log('-'.repeat(62))
const temalar = readdirSync(join(kok, 'src', 'themes')).filter(f => f.endsWith('.css'))
const kalinti = []
for (const t of temalar) {
  const css = readFileSync(join(kok, 'src', 'themes', t), 'utf8')
  for (const m of css.matchAll(/--ring-(outline|stroke)[^;]*/g)) {
    kalinti.push(`${t}: ${m[0].trim()}`)
  }
  for (const m of css.matchAll(/--ring-tint[^;]*/g)) {
    kalinti.push(`${t}: ${m[0].trim()}`)
  }
}
if (kalinti.length) {
  hata++
  console.log('  ✗ TEMADA ÖLÜ KONTÜR/KARIŞTIRMA KALINTISI (rozet bunları kullanmıyor):')
  for (const k of kalinti) console.log('      ' + k)
} else {
  console.log('  ✓ temalarda ölü kontür/karıştırma kalmamış')
}

// --- Rozet yazı rengi gerçekten uygulanıyor mu? ---------------------------
// Bu bir CSS öncelik tuzağı: .ring kuralı .ring-chip ile aynı özgüllükte
// olup SONRA gelirse yazı rengini ezer ve her rozete vurgu rengini (altın)
// yazar — yeşil rozet içinde sarı yazı gibi. Sessiz görünür, o yüzden
// styles.css içinde rozet kuralının daha yüksek özgüllüklü olduğu ve
// rozet dışlayan .ring kuralı olduğu doğrulanır.
const cssAna = readFileSync(join(kok, 'src', 'styles.css'), 'utf8')
const kuralDogrulamalari = [
  ['rozet kuralı iki sınıf kullanıyor (.ring.ring-chip)', /\.ring\.ring-chip\s*\{/.test(cssAna)],
  ['rozet kuralı --chip-fg uyguluyor', /\.ring\.ring-chip\s*\{[^}]*color:\s*var\(--chip-fg\)/s.test(cssAna)],
  ['.ring kuralı rozetleri dışlıyor', /\.ring:not\(\.ring-chip\)\s*\{/.test(cssAna)],
  ['tek sınıflı .ring kuralı color: var(--accent) yazmıyor', !/\.ring\s*\{[^}]*color:\s*var\(--accent\)/s.test(cssAna)]
]
for (const [ad, ok] of kuralDogrulamalari) {
  if (!ok) hata++
  console.log(`  ${ok ? '✓' : '✗'} ${ad}`)
}

console.log('-'.repeat(62))
if (hata) {
  console.log(`  ${hata} sorun var`)
  process.exit(1)
}
console.log(`  ${palet.length} renk okunabilir; rozet kuralı ezilmiyor`)