const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const { ROOT, DRIVE_DIR, stamp, pruneOldVersions } = require('./drive-backup-util')
const pkg = require(path.join(ROOT, 'package.json'))

const DIST_DIR = path.join(ROOT, 'dist')

async function backupSource() {
  fs.mkdirSync(DIST_DIR, { recursive: true })

  const zipName = `Güvercin-KaynakKod-${pkg.version}-${stamp()}.zip`
  const localDest = path.join(DIST_DIR, zipName)

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(localDest)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    archive.on('warning', err => (err.code === 'ENOENT' ? console.warn(err) : reject(err)))
    archive.on('error', reject)

    archive.pipe(output)

    // Tam yedek: kök klasördeki her şey dahil (AGENTS.md, opencode.jsonc, .frames,
    // derleme çıktıları ve önbellekler). Hariç tutulanlar:
    // - .git: depo meta verisi, GitHub zaten tam yansıtır (mirror)
    // - node_modules: package-lock.json ile yeniden üretilebilir, yedeği şişirir
    // - yazılmakta olan zip dosyasının kendisi ve ayrı yedeklenen .apk'lar
    archive.glob('**/*', {
      cwd: ROOT,
      dot: true,
      ignore: [
        '.git/**',
        'node_modules/**',
        'dist/' + zipName,
        // Önceki kaynak ZIP'lerini tekrar paketleme; her yedek gereksiz büyür.
        'dist/*.zip',
        '**/*.apk'
      ]
    }, { prefix: '' })

    archive.finalize()
  })

  const kb = Math.round(fs.statSync(localDest).size / 1024)
  console.log(`\nKaynak kod yedeği hazır: ${zipName} (${kb} KB)`)

  // Google Drive kopyalama ve son 2 sürümü saklama
  if (fs.existsSync(DRIVE_DIR)) {
    try {
      const driveDest = path.join(DRIVE_DIR, zipName)
      fs.copyFileSync(localDest, driveDest)
      console.log(`Google Drive'a kopyalandı: ${driveDest}`)

      // Drive'da son 2 kaynak kod sürümünü koru, eskileri sil
      const keptDrive = pruneOldVersions(DRIVE_DIR, 'kaynakkod', 2)
      console.log(`Google Drive saklanan kaynak kod yedekleri (${keptDrive.length}/2):`, keptDrive.join(', '))
    } catch (err) {
      console.warn(`Google Drive kaynak kod yedekleme uyarısı: ${err.message}`)
    }
  } else {
    console.warn(`Google Drive dizini bulunamadı: ${DRIVE_DIR}`)
  }

  // dist klasöründe de son 2 kaynak kod sürümünü koru
  pruneOldVersions(DIST_DIR, 'kaynakkod', 2)

  return { name: zipName, path: localDest, kb }
}

if (require.main === module) {
  backupSource().catch(err => {
    console.error('Kaynak kod yedekleme hatası:', err)
    process.exit(1)
  })
}

module.exports = { backupSource }
