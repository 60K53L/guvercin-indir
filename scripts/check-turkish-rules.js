/**
 * Türkçe dil kurallarını denetler (AGENTS.md).
 *
 * Neden ayrı denetim? Kural "büyük harfe çevirme her zaman trUpper() ile"
 * diyor; düz toUpperCase() Türkçeyi bilmez ve i/İ ayrımını bozar ("dişi" →
 * "DIŞI", "Aktif" → "AKTIF"). Bu ihlal gözle görünmüyor, çünkü yalnızca
 * noktalı harf içeren kelimelerde ortaya çıkıyor. Denetim, geri dönüşleri
 * otomatik yakalar.
 *
 * Kullanım: node scripts/check-turkish-rules.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src')

// Meşru kullanım yerleri:
//  - lib.js'teki trUpper ve foldTr tanımlarının kendisi
//  - künye/kayıt kimliği parçaları (hex, Türkçe harf içermez)
//  - e-posta normalizasyonu (İ zaten elle katlanıyor)
const ALLOW = [
  /export const trUpper = /,
  /export const foldTr = /,
  /^\s*\.toUpperCase\(\)\s*$/,            // foldTr zincirinin son halkası
  /\.slice\(\d+(?:, \d+)?\)\.toUpperCase\(\)/,
  /cleanMail/
]

// E-posta normalizasyonu İ'yi zaten elle katlıyor; orada düz
// toLowerCase() kullanılması doğru.

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p)
  }
})(ROOT)

let bad = 0
let checked = 0

for (const f of files) {
  const rel = path.relative(ROOT, f)
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim()
    if (!t) return
    // Yorum satırları kural ihlali sayılmaz.
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    if (!/\.to(Upper|Lower)Case\(/.test(line)) return
    checked++
    // toLowerCase() Türkçede harf katlaması yapmıyor ama e-posta ve
    // benzeri ASCII karşılaştırmalarda kullanılıyor; orada sorun yok.
    if (/toLowerCase\(/.test(line)) return
    if (ALLOW.some(re => re.test(line))) return
    console.log(`  ${rel}:${i + 1}  →  ${t.slice(0, 90)}`)
    bad++
  })
}

console.log(`\n${checked} çevirme denetlendi, ${bad} tanesi kural dışı`)
process.exit(bad ? 1 : 0)
