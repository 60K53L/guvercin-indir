const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const { ROOT, DRIVE_DIR, stamp, pruneOldVersions } = require('./drive-backup-util')
const pkg = require(path.join(ROOT, 'package.json'))

const WEB_DIR = path.join(ROOT, 'web')
const DIST_DIR = path.join(ROOT, 'dist')

async function backupWeb() {
  if (!fs.existsSync(WEB_DIR) || !fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
    console.error('Hata: web/ klasörü veya index.html bulunamadı! Önce "npm run web:build" çalıştırılmalı.')
    process.exit(1)
  }

  fs.mkdirSync(DIST_DIR, { recursive: true })

  const zipName = `Güvercin-Web-${pkg.version}-${stamp()}.zip`
  const localDest = path.join(DIST_DIR, zipName)

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(localDest)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    archive.on('warning', err => (err.code === 'ENOENT' ? console.warn(err) : reject(err)))
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(WEB_DIR, false)
    archive.finalize()
  })

  const kb = Math.round(fs.statSync(localDest).size / 1024)
  console.log(`\nWebapp yedeği hazır: ${zipName} (${kb} KB)`)

  // Google Drive kopyalama ve son 2 sürümü saklama
  if (fs.existsSync(DRIVE_DIR)) {
    try {
      const driveDest = path.join(DRIVE_DIR, zipName)
      fs.copyFileSync(localDest, driveDest)
      console.log(`Google Drive'a kopyalandı: ${driveDest}`)

      // Drive'da son 2 webapp zip sürümünü koru, eskileri sil
      const keptDrive = pruneOldVersions(DRIVE_DIR, 'web-zip', 2)
      console.log(`Google Drive saklanan webapp yedekleri (${keptDrive.length}/2):`, keptDrive.join(', '))
    } catch (err) {
      console.warn(`Google Drive webapp yedekleme uyarısı: ${err.message}`)
    }
  } else {
    console.warn(`Google Drive dizini bulunamadı: ${DRIVE_DIR}`)
  }

  // dist klasöründe de son 2 webapp zip sürümünü koru
  pruneOldVersions(DIST_DIR, 'web-zip', 2)

  return { name: zipName, path: localDest, kb }
}

if (require.main === module) {
  backupWeb().catch(err => {
    console.error('Webapp yedekleme hatası:', err)
    process.exit(1)
  })
}

module.exports = { backupWeb }
