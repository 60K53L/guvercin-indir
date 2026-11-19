const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DRIVE_DIR = path.join("G:", "Drive'ım", "Code", "GUVERCIN-APK")

/** Yerel saate göre YYYYAAGGSS-SSDD. Sıralanabilir ve belirsiz değil. */
function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function matchFilter(filename, filter) {
  const lower = filename.toLowerCase()
  if (typeof filter === 'function') return filter(filename)
  const fLower = String(filter).toLowerCase()
  if (fLower === 'web' || fLower === 'web-zip' || fLower === 'web.zip') {
    return lower.includes('-web-') && lower.endsWith('.zip')
  }
  if (fLower === 'kaynakkod' || fLower === 'source' || fLower === 'source-zip') {
    return lower.includes('-kaynakkod-') && lower.endsWith('.zip')
  }
  if (fLower === 'ota' || fLower === 'ota-zip') {
    return lower.includes('-ota-') && lower.endsWith('.zip')
  }
  if (fLower === '.apk' || fLower === 'apk') {
    return lower.endsWith('.apk')
  }
  if (fLower.startsWith('.')) {
    return lower.endsWith(fLower)
  }
  return lower.includes(fLower)
}

/**
 * Belirtilen klasördeki dosyaları kategori/uzantıya göre filtreler,
 * en yeni ilk sırada olacak şekilde sıralar ve son `maxKeep` adedini tutar,
 * daha eski olanları siler.
 * 
 * @param {string} dir Klasör yolu
 * @param {string|Function} filter Kategori ('web-zip', 'kaynakkod', '.apk') veya filtre fonksiyonu
 * @param {number} maxKeep Saklanacak maksimum son sürüm sayısı (varsayılan: 2)
 * @returns {string[]} Saklanan dosya adları listesi
 */
function pruneOldVersions(dir, filter, maxKeep = 2) {
  if (!fs.existsSync(dir)) return []
  try {
    const all = fs.readdirSync(dir)
    const matches = all.filter(f => matchFilter(f, filter))

    // En yeni ilk sırada olacak şekilde sırala (zaman damgası ve dosya tarihi)
    matches.sort((a, b) => {
      const cmp = b.localeCompare(a, 'tr', { numeric: true, sensitivity: 'base' })
      if (cmp !== 0) return cmp
      const timeA = fs.statSync(path.join(dir, a)).mtimeMs
      const timeB = fs.statSync(path.join(dir, b)).mtimeMs
      return timeB - timeA
    })

    const kept = matches.slice(0, maxKeep)
    const pruned = matches.slice(maxKeep)

    for (const f of pruned) {
      try {
        fs.unlinkSync(path.join(dir, f))
      } catch (e) {
        console.warn(`Eski sürüm silinemedi (${f}):`, e.message)
      }
    }
    return kept
  } catch (err) {
    console.warn(`Sürüm temizleme hatası (${dir}):`, err.message)
    return []
  }
}

module.exports = {
  ROOT,
  DRIVE_DIR,
  stamp,
  pruneOldVersions
}
