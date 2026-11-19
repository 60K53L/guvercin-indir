/**
 * EXE ikon ve sürüm bilgisini gömer.
 *
 * Neden ayrı bir adım? electron-builder ikonu `winCodeSign` paketindeki
 * araçla kendisi yazar. O pakette macOS için sembolik bağlantılar bulunuyor;
 * 7-Zip bunları Windows Developer Mode açık değilse oluşturamıyor
 * ("Gereken ayrıcalık istemci tarafından sağlanmıyor") ve derleme tümden
 * düşüyor. Bu yüzden `signAndEditExecutable: false` bırakılıp ikon ve sürüm
 * bilgisi burada, derleme bittikten sonra yazılıyor.
 *
 * NOT 1: Paket içindeki `rcedit` npm modülü (Node tabanlı) kullanılıyor;
 * winCodeSign içindeki eski rcedit.exe sürümü büyük dosyaları bozuyordu.
 *
 * NOT 2: Yalnızca asıl uygulama dosyası (win-unpacked içindeki exe) işlenir.
 * NSIS kurulum/taşınabilir dosyalar makensis tarafından zaten ikonla
 * üretiliyor ve sıkıştırılmış yük taşıdıkları için rcedit onları bozuyor
 * (100 MB -> 100 KB).
 *
 * Kullanım:  node scripts/stamp-exe.js
 */
import { rcedit } from 'rcedit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const UNPACKED = path.join(DIST, 'win-unpacked')
const ICON = path.join(ROOT, 'build', 'icon.ico')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const VERSION = pkg.version
const PRODUCT = pkg.build?.productName || 'Güvercin'

if (!fs.existsSync(ICON)) {
  console.error(`İkon bulunamadı: ${ICON}`)
  process.exit(1)
}
if (!fs.existsSync(UNPACKED)) {
  console.error('dist/win-unpacked yok. Önce `npm run dist` çalıştır.')
  process.exit(1)
}

/** Kurulduktan sonra kullanıcının gördüğü asıl uygulama dosyası. */
const targets = fs
  .readdirSync(UNPACKED, { withFileTypes: true })
  .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.exe'))
  .map(d => path.join(UNPACKED, d.name))
  .filter(f => path.basename(f).toLowerCase() !== 'elevate.exe')

if (!targets.length) {
  console.error('dist/win-unpacked içinde uygulama .exe bulunamadı.')
  process.exit(1)
}

let failed = 0
for (const exe of targets) {
  const before = fs.statSync(exe).size
  try {
    await rcedit(exe, {
      icon: ICON,
      'file-version': `${VERSION}.0`,
      'product-version': `${VERSION}.0`,
      'version-string': {
        FileDescription: `${PRODUCT} soy takip uygulaması`,
        ProductName: PRODUCT,
        CompanyName: PRODUCT,
        LegalCopyright: `© ${new Date().getFullYear()} ${PRODUCT}`,
        InternalFilename: path.basename(exe),
        OriginalFilename: path.basename(exe)
      }
    })
    const after = fs.statSync(exe).size
    // Boyut düşüşü alarm işareti: dosya bozulmuş demektir.
    if (after < before * 0.9) {
      throw new Error(`dosya küçüldü: ${before} -> ${after} bayt`)
    }
    console.log(`✓ win-unpacked\\${path.basename(exe)}  (${(after / 1048576).toFixed(1)} MB)`)
  } catch (err) {
    failed++
    console.error(`✗ ${path.basename(exe)}\n  ${err.message}`)
  }
}

if (failed) {
  console.error(`\n${failed} dosyaya ikon yazılamadı.`)
  process.exit(1)
}

// NSIS dosyaları makensis tarafından ikonlu üretiliyor; dokunulmuyor.
const installers = fs
  .readdirSync(DIST, { withFileTypes: true })
  .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.exe'))
  .map(d => path.join(DIST, d.name))

if (installers.length) {
  console.log('\nKurulum dosyaları (ikon makensis ile gömülü, dokunulmadı):')
  for (const f of installers) console.log(`  · ${path.basename(f)}`)
}

console.log(`\nİkon ve sürüm bilgisi yazıldı (${VERSION}).`)