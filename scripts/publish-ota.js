const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { pathToFileURL } = require('url')
const archiver = require('archiver')
const { ROOT, DRIVE_DIR, stamp, pruneOldVersions } = require('./drive-backup-util')
const pkg = require(path.join(ROOT, 'package.json'))

const APP_DIR = path.join(ROOT, 'app')
const WEB_DIR = path.join(ROOT, 'web')
const DIST_DIR = path.join(ROOT, 'dist')

/** src/version.js içindeki BUILD_TIME değerini verilen damgayla eşitler. */
function stampVersionFile(s) {
  const file = path.join(ROOT, 'src', 'version.js')
  const src = fs.readFileSync(file, 'utf8')
  const out = src.replace(/export const BUILD_TIME = '[^']*'/, `export const BUILD_TIME = '${s}'`)
  if (out === src) {
    console.warn('⚠️ Uyarı: version.js BUILD_TIME güncellenemedi (desen bulunamadı).')
    return
  }
  fs.writeFileSync(file, out, 'utf8')
}

/**
 * Yama numarasını bir artırır: 1.0.19 -> 1.0.20.
 *
 * Sürüm numarası her YAYINDA artar; kullanıcı sürüm bilgisi penceresinde her
 * güncellemenin numarasını görmek istiyor. Eskiden sürüm sabit kalıp yalnızca
 * BUILD_TIME damgası değişiyordu, pencerede hep "v1.0.19" görünüyordu.
 */
function bumpPatch(version) {
  const parts = String(version).split('.').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return version
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}

/**
 * CHANGELOG bloğunu metin olarak yeniden üretir.
 *
 * Yeni maddeler YENİ sürüm anahtarına yazılır; eski anahtarda yalnızca
 * daha önce yayınlanmış maddeler kalır. Böylece "Sürüm Geçmişi" penceresinde
 * her yayının maddeleri kendi sürümü altında görünür.
 */
function buildChangelogBlock(changelog, newVersion, newItems) {
  const out = { [newVersion]: newItems }
  for (const [key, items] of Object.entries(changelog)) {
    if (key === newVersion) continue
    const rest = Array.isArray(items) ? items.filter(i => !newItems.includes(i)) : []
    if (rest.length) out[key] = rest
  }
  const lines = Object.entries(out).map(([key, items]) =>
    `  '${key}': [\n` + items.map(i => `    ${JSON.stringify(i)}`).join(',\n') + '\n  ]'
  )
  return 'export const CHANGELOG = {\n' + lines.join(',\n') + '\n}'
}

async function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    archive.on('warning', err => (err.code === 'ENOENT' ? console.warn(err) : reject(err)))
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

/** src/version.js içindeki mevcut BUILD_TIME'ı okur. */
function readBuildTime() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'version.js'), 'utf8')
  const m = src.match(/export const BUILD_TIME = '([^']*)'/)
  return m ? m[1] : null
}

async function publishOta({ keepBuildTime = false } = {}) {
  console.log('🚀 Güvercin Canlı Kod Güncelleme (OTA) Paketi Hazırlanıyor...\n')

  // Sürüm kimliği TEK bir damgadan üretilir ve bir kez hesaplanır.
  //
  // `--keep-build-time`: yalnızca web arayüzünü yeniden yayınlamak içindir.
  // Mevcut BUILD_TIME korunur; cihazlar aynı paketi tekrar indirmez.
  // Normal yayında BUILD_TIME yeni damgayla eşitlenir; aksi halde cihaz
  // "güncelleme var" sanıp aynı paketi tekrar tekrar indirir (versiyon
  // sabit kaldığı için tek ayırt edici alan buildTime'dır).
  let currentStamp
  if (keepBuildTime) {
    currentStamp = readBuildTime() || stamp()
    console.log(`> Web-modu: mevcut BUILD_TIME korunuyor (${currentStamp}), yeniden damgalanmadı.`)
  } else {
    currentStamp = stamp()
    stampVersionFile(currentStamp)
  }

  // 0. Sürüm ve bildirilecek maddeler belirlenir.
  //
  // Sürüm her YAYINDA bir artar (kullanıcı sürüm bilgisi penceresinde her
  // güncellemenin kendi numarasını görmek istiyor). Bildirime yalnızca bu
  // yayının yeni maddeleri düşer; yayınlanmış maddeler publish-history.json'da
  // tutulur. Web-modünde (--keep-build-time) aynı paket yeniden yayınlandığı
  // için sürüm artırılmaz.
  const HISTORY = path.join(ROOT, 'scripts', 'publish-history.json')
  let published = []
  if (fs.existsSync(HISTORY)) {
    try { published = JSON.parse(fs.readFileSync(HISTORY, 'utf8')).items || [] } catch {}
  }

  let version = pkg.version
  let newItems = []
  try {
    const mod = await import(pathToFileURL(path.join(ROOT, 'src', 'version.js')).href)
    const raw = mod.CHANGELOG
    const allItems = Array.isArray(raw) ? raw : (raw[pkg.version] || [])
    newItems = allItems.filter(i => !published.includes(i))
  } catch (e) {
    console.warn('UYARI: version.js okunamadı, değişiklik listesi boş bırakıldı:', e.message)
  }

  if (!keepBuildTime && newItems.length) {
    version = bumpPatch(pkg.version)
    pkg.version = version
    fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8')

    // version.js: sürüm satırı + CHANGELOG bloğu (maddeler yeni anahtara taşınır)
    const file = path.join(ROOT, 'src', 'version.js')
    const raw = fs.readFileSync(file, 'utf8')
    const mod = await import(pathToFileURL(file).href)
    const block = buildChangelogBlock(mod.CHANGELOG, version, newItems)
    const out = raw
      .replace(/export const APP_VERSION = '[^']*'/, `export const APP_VERSION = '${version}'`)
      .replace(/export const CHANGELOG = \{[\s\S]*?\n\}/, block)
    fs.writeFileSync(file, out, 'utf8')
    console.log(`> 0. Sürüm artırıldı: v${version} — yeni maddeler bu sürüm anahtarına yazıldı`)
  }

  // 1. Web varlıklarını derle (app/ klasörüne)
  console.log('> 1. Vite ile arayüz kodları derleniyor (app/)...')
  execSync('npm run build:renderer', { cwd: ROOT, stdio: 'inherit', shell: true })

  if (!fs.existsSync(APP_DIR) || !fs.existsSync(path.join(APP_DIR, 'index.html'))) {
    console.error('Hata: app/ klasörü veya index.html bulunamadı!')
    process.exit(1)
  }

  // 2. Web hosting için web sürümünü derle (web/ klasörüne)
  console.log('\n> 2. Web hosting dosyaları derleniyor (web/)...')
  execSync('npm run web:build', { cwd: ROOT, stdio: 'inherit', shell: true })

  fs.mkdirSync(WEB_DIR, { recursive: true })
  fs.mkdirSync(DIST_DIR, { recursive: true })

  // 3. OTA bundle.zip paketini oluştur
  const bundleWebPath = path.join(WEB_DIR, 'bundle.zip')
  const bundleDistName = `Güvercin-OTA-${pkg.version}-${currentStamp}.zip`
  const bundleDistPath = path.join(DIST_DIR, bundleDistName)

  console.log('\n> 3. Mobil OTA zip paketi oluşturuluyor...')
  await zipDirectory(APP_DIR, bundleWebPath)
  fs.copyFileSync(bundleWebPath, bundleDistPath)

  const bundleSizeKb = Math.round(fs.statSync(bundleWebPath).size / 1024)
  const crypto = require('crypto')
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(bundleWebPath)).digest('hex')
  console.log(`   OTA Paketi hazır: bundle.zip (${bundleSizeKb} KB)`)
  console.log(`   SHA-256 Checksum: ${checksum}`)

  // 4. version.json dosyasını hazırla.
  // ÖNEMLİ: yalnızca BU YAYININ YENİ maddeleri yazılır (0. adımda hesaplandı).
  const changelog = newItems.length ? newItems : ['Küçük iyileştirmeler ve hata düzeltmeleri']

  const versionData = {
    version,
    buildTime: currentStamp,
    bundleUrl: 'https://guvercin-beta-dev.web.app/bundle.zip',
    checksum,
    bundleSizeKb,
    releaseDate: new Date().toISOString(),
    changelog
  }

  const versionJsonPath = path.join(WEB_DIR, 'version.json')
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8')
  console.log(`> 4. Sürüm bildirimi hazırlandı: version.json (v${version} - ${currentStamp})`)

  // Yayınlanan maddelerin tarihçesi: bir sonraki yayına yalnızca yeni maddeler
  // düşmesi için güncellenir (generic satır tarihçeye yazılmaz).
  if (newItems.length) {
    published = published.concat(newItems)
    fs.writeFileSync(HISTORY, JSON.stringify({ items: published }, null, 2) + '\n', 'utf8')
    console.log(`   Yalnızca yeni maddeler yazıldı (${newItems.length}); publish-history.json güncellendi`)
  }

  // 5. Google Drive yedekleme
  if (fs.existsSync(DRIVE_DIR)) {
    try {
      const driveDest = path.join(DRIVE_DIR, bundleDistName)
      fs.copyFileSync(bundleWebPath, driveDest)
      fs.writeFileSync(path.join(DRIVE_DIR, 'version.json'), JSON.stringify(versionData, null, 2), 'utf8')
      console.log(`\n> 5. Google Drive'a kopyalandı: ${driveDest}`)
      const kept = pruneOldVersions(DRIVE_DIR, 'ota', 2)
      if (kept.length) console.log(`   Google Drive saklanan OTA sürümleri:`, kept.join(', '))
    } catch (e) {
      console.warn('Google Drive OTA kopyalama uyarısı:', e.message)
    }
  }

  // 6. Herkese açık APK indirme sayfası (web/indir.html + /downloads/guvercin.apk)
  try {
    const { prepareDownloads } = require('./download-page')
    const info = prepareDownloads(WEB_DIR, { appVersion: pkg.version })
    console.log(`\n> 6. APK indirme sayfası hazırlandı: /indir.html  →  ${info.url}`)
  } catch (e) {
    console.warn('\n> 6. İndirme sayfası hazırlama uyarısı:', e.message)
  }

  // 7. Firebase Hosting'e canlı yayınla
  console.log('\n> 7. Firebase Hosting üzerinden canlı yayına alınıyor...')
  try {
    const firebaseBin = process.platform === 'win32'
      ? path.join(ROOT, 'node_modules', '.bin', 'firebase.cmd')
      : path.join(ROOT, 'node_modules', '.bin', 'firebase')
    const cmd = fs.existsSync(firebaseBin) ? `"${firebaseBin}" deploy --only hosting` : 'npx firebase-tools deploy --only hosting'
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true })
    console.log('\n✅ BAŞARILI! Canlı Kod Güncellemesi (OTA) yayında!')
    console.log('   Uygulamayı açan tüm telefonlar bu güncellemeyi otomatik olarak alacaktır.')
    console.log('   GitHub yedeği için: npm run backup:github')
  } catch (err) {
    console.error('\n⚠️ Firebase deploy uyarısı/hatası:', err.message)
    console.log('Not: bundle.zip ve version.json web/ klasörüne üretildi.')
  }
}

if (require.main === module) {
  const keepBuildTime = process.argv.includes('--keep-build-time')
  publishOta({ keepBuildTime }).catch(err => {
    console.error('OTA yayınlama hatası:', err)
    process.exit(1)
  })
}

// Testler bu iki saf fonksiyonu kullanır (scripts/test-version-bump.js).
module.exports = { publishOta, bumpPatch, buildChangelogBlock }
