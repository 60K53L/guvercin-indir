/**
 * electron-builder `afterPack` kancası.
 *
 * Neden gerekli? electron-builder sırası şöyledir:
 *   1. uygulamayı win-unpacked/ içine paketler
 *   2. NSIS kurulum/portable dosyalarını win-unpacked/ içinden ÜRETİR
 *   3. "Güvercin 1.0.0.exe" biter
 *
 * İkonu 3. adımdan SONRA yazarsan, kurulum/portable dosyalarının İÇİNDE
 * ikonu olmayan exe kalır. Kullanıcı portabl'ı çalıştırdığında geçici
 * klasöre açılan exe Electron logosuyla görünür.
 *
 * afterPack tam olarak 1 ve 2 arasında çalışır: ikon yazılır, KESİNLİKLE
 * paketlenir.
 *
 * İkonu electron-builder'ın kendisi yazabilirdi (signAndEditExecutable),
 * ama o araç macOS sembolik bağlantıları içeriyor ve Developer Mode
 * kapalıyken açılamıyor. Bu yüzden npm `rcedit` paketi kullanılıyor.
 *
 * NOT: Sadece win-unpacked içindeki uygulama exe'si işlenir. NSIS
 * dosyalarının kendi ikonu makensis tarafından ayrıca konur.
 */
import { rcedit } from 'rcedit'
import fs from 'node:fs'
import path from 'node:path'

/**
 * electron-builder bu betiği PROJE KÖKÜNDEN çalıştırır, yani process.cwd()
 * zaten E:\Code\GUVERCIN'dir. Bir üst klasör (..) eklemek yanlış olurdu
 * ("build/icon.ico yok" hatası veriyordu).
 */
const ROOT = process.env.PROJECT_DIR || process.cwd()
const ICON = path.join(ROOT, 'build', 'icon.ico')

/** electron-builder kancasını bağlar; doğrudan çalıştırılırsa çıkar. */
export default async function afterPack(context) {
  const appOutDir = context?.appOutDir
  if (!appOutDir || process.platform !== 'win32') return

  const product = context.packager?.appInfo?.productFilename || 'Güvercin'
  const target = path.join(appOutDir, `${product}.exe`)
  const version = context.packager?.appInfo?.version || '1.0.0'

  if (!fs.existsSync(target)) {
    console.warn(`  • afterPack: ${path.basename(target)} bulunamadı, ikon atlandı`)
    return
  }
  if (!fs.existsSync(ICON)) {
    console.warn('  • afterPack: build/icon.ico yok, ikon atlandı')
    return
  }

  const before = fs.statSync(target).size
  await rcedit(target, {
    icon: ICON,
    'file-version': `${version}.0`,
    'product-version': `${version}.0`,
    'version-string': {
      FileDescription: 'Güvercin soy takip uygulaması',
      ProductName: product,
      CompanyName: 'Güvercin',
      LegalCopyright: `© ${new Date().getFullYear()} Güvercin`,
      InternalFilename: `${product}.exe`,
      OriginalFilename: `${product}.exe`
    }
  })

  // Boyut düşüşü bozulma işaretidir (rcedit.exe sürümü dosyayı kırpıyordu).
  const after = fs.statSync(target).size
  if (after < before * 0.9) throw new Error(`dosya küçüldü: ${before} -> ${after}`)
  console.log(`  • afterPack: ${product}.exe ikonu yazıldı (${(after / 1048576).toFixed(1)} MB)`)
}