/**
 * Güvenli `cap sync android`.
 *
 * Neden kendi betiği? Canlı modda (npm run dev:android) Capacitor
 * android/assets/capacitor.config.json içine server.url yazıyor. Canlı mod
 * kapansa bile o dosya orada kalıyor ve düz `cap sync` onu EZMİYOR.
 * Sonuç: üretim APK'sı http://<ip>:5173 adresini açmaya çalışıp
 * "Webpage not available" ekranı verir.
 *
 * Burada dosya önce silinir, sonra sync yeniden yazar.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ROOT_CFG = path.join(ROOT, 'capacitor.config.json')
const ASSETS = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets')
const ASSET_CFG = path.join(ASSETS, 'capacitor.config.json')
const PUBLIC = path.join(ASSETS, 'public')

/**
 * `cap sync` web varlıklarını (app/ → assets/public) bazen KOPYALAMIYOR:
 * içerik değişmiş olsa bile eski dosya kalıyor. Tema değişikliği gibi
 * yalnızca içerikle ilgili bir değişiklik APK'a hiç yansımıyordu.
 * Bu yüzden public klasörü her seferinde silinir.
 */
if (fs.existsSync(PUBLIC)) {
  fs.rmSync(PUBLIC, { recursive: true, force: true })
  console.log('> bayat assets/public silindi (web varlıkları yeniden kopyalanacak)')
}

if (fs.existsSync(ASSET_CFG)) {
  fs.unlinkSync(ASSET_CFG)
  console.log('> bayat android/assets/capacitor.config.json silindi')
}

execSync('npx cap sync android', { cwd: ROOT, stdio: 'inherit', shell: true })

/**
 * `cap sync` bazen bayat dosyayı geri yazabiliyor. Bu yüzden üretim ayarı
 * doğrudan kök dosyadan kopyalanır — deterministik sonuç.
 * Canlı mod ayarı kökte varsa burada da temizlenir.
 */
const clean = JSON.parse(fs.readFileSync(ROOT_CFG, 'utf8'))
if (clean.server) {
  delete clean.server.url
  delete clean.server.cleartext
  clean.server.androidScheme = 'https'
  fs.writeFileSync(ROOT_CFG, JSON.stringify(clean, null, 2) + '\n', 'utf8')
}
fs.writeFileSync(ASSET_CFG, JSON.stringify(clean, null, '\t') + '\n', 'utf8')

/**
 * Doğrulama: web varlıkları gerçekten güncel mi?
 * Tema değişikliği sadece CSS olduğu için eski dosya adıyla kalırsa
 * APK eski temayla derlenmiş olur ve fark edilmesi zordur.
 */
const srcCss = fs.readdirSync(path.join(ROOT, 'app', 'assets')).filter(f => f.endsWith('.css'))
const dstCss = fs.existsSync(path.join(PUBLIC, 'assets'))
  ? fs.readdirSync(path.join(PUBLIC, 'assets')).filter(f => f.endsWith('.css'))
  : []
if (srcCss.join() !== dstCss.join()) {
  console.error(`\nHATA: web varlıkları kopyalanmadı.`)
  console.error(`  app/:  ${srcCss.join(', ')}`)
  console.error(`  apk/:  ${dstCss.join(', ')}`)
  process.exit(1)
}
console.log(`> web varlıkları güncel (${srcCss.join(', ')})`)

/**
 * Gradle birleştirilmiş varlıkları ÖNBELLEK'ten kullanır. Diskteki dosyalar
 * düzeltilse bile APK'ya bayat olan giriyor. Birleştirme klasörleri temizlenir.
 */
const INTERMEDIATES = path.join(ROOT, 'android', 'app', 'build', 'intermediates')
for (const dir of ['assets', 'compressed_assets']) {
  const p = path.join(INTERMEDIATES, dir)
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true })
    console.log(`> gradle önbelleği silindi: app/build/intermediates/${dir}`)
  }
}

// Doğrulama: üretim ayarında server.url OLMAMALI.
const written = JSON.parse(fs.readFileSync(ASSET_CFG, 'utf8'))
if (written.server && written.server.url) {
  console.error(`\nHATA: android/assets içinde hâlâ server.url var: ${written.server.url}`)
  process.exit(1)
}
console.log('> android/assets/capacitor.config.json temiz (server.url yok)')