/**
 * PWA (web uygulaması) ikonlarını üretir.
 *
 * PNG okuma/yeniden boyutlama mantığı scripts/make-app-icons.js ile
 * paylaşılır; ek paket gerekmez.
 *
 * Üretilenler (public/):
 *   icon-192.png          Android/PWA manifest ikonu
 *   icon-512.png          PWA büyük ikon + splash ekranı
 *   icon.png             favicon (index.html bunu kullanıyor)
 *   apple-touch-icon.png  iOS ana ekran ikonu
 *   favicon-32.png / favicon-16.png
 */
const fs = require('fs')
const path = require('path')
const { readPng, resize, writePng, SRC_PNG } = require('./make-app-icons.js')

const OUT = path.join(SRC_PNG, '..', '..', 'public')
const publicDir = path.resolve(OUT)

fs.mkdirSync(publicDir, { recursive: true })

const src = readPng(SRC_PNG)
const files = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon.png', 64],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
  ['favicon-16.png', 16]
]

for (const [name, size] of files) {
  writePng(resize(src, size, size), path.join(publicDir, name))
  console.log(`  ${name.padEnd(24)} ${size}x${size}`)
}

console.log(`\n${files.length} PWA ikonu yazıldı -> ${publicDir}`)