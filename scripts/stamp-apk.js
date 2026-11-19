const fs = require('fs')
const path = require('path')
const { ROOT, DRIVE_DIR, stamp, pruneOldVersions } = require('./drive-backup-util')
const pkg = require(path.join(ROOT, 'package.json'))

const built = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
if (!fs.existsSync(built)) {
  console.error(`APK bulunamadı: ${built}`)
  process.exit(1)
}

const outDir = path.join(ROOT, 'dist')
fs.mkdirSync(outDir, { recursive: true })

const name = `Güvercin-${pkg.version}-${stamp()}.apk`
const dest = path.join(outDir, name)
fs.copyFileSync(built, dest)

const kb = Math.round(fs.statSync(dest).size / 1024)
console.log(`\nHazır: ${name}  (${kb} KB)`)

// Google Drive hedefi: G:\Drive'ım\GUVERCIN-APK
// Kullanıcı isteği: Son 2 sürüm saklı kalsın
if (fs.existsSync(DRIVE_DIR)) {
  try {
    const driveDest = path.join(DRIVE_DIR, name)
    fs.copyFileSync(built, driveDest)
    console.log(`Google Drive'a kopyalandı: ${driveDest}`)

    // Drive'da son 2 APK sürümünü koru, eskileri sil
    const keptDrive = pruneOldVersions(DRIVE_DIR, '.apk', 2)
    console.log(`Google Drive saklanan APK sürümleri (${keptDrive.length}/2):`, keptDrive.join(', '))
  } catch (err) {
    console.warn(`Google Drive kopyalama uyarısı: ${err.message}`)
  }
} else {
  console.warn(`Google Drive dizini bulunamadı: ${DRIVE_DIR}`)
}

// dist klasöründe de son 2 APK sürümünü koru
pruneOldVersions(outDir, '.apk', 2)