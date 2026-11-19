/**
 * Temaya göre APK üretir.
 *
 * src/theme.css etkin temadır; styles.css'ten SONRA yüklenir ve
 * :root değişkenlerini ezer. Bu betik src/themes/ altındaki her dosyayı
 * sırayla src/theme.css yapıp derleme alıp ayrı bir APK olarak kaydeder.
 *
 * Kullanım:
 *   node scripts/build-themes.js            → tüm temalar
 *   node scripts/build-themes.js zumrut     → sadece o tema
 *
 * Çıktı: dist/Guvercin-<tema>-<gg-aa-yy-ss-dd>.apk
 * En sonda etkin tema daima guncel'e (varsayılan) döndürülür.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const THEMES_DIR = path.join(ROOT, 'src', 'themes')
const ACTIVE = path.join(ROOT, 'src', 'theme.css')
const DIST = path.join(ROOT, 'dist')
const APK = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

/** Varsayılan; betik sonunda buna dönülür. */
const DEFAULT_THEME = 'guncel'

/** Tema adı → APK adında kullanılacak etiket. */
const LABELS = {
  guncel: 'guncel',
  zumrut: 'zumrut',
  aydinlik: 'aydinlik',
  kizil: 'kizil',
  gokyuzu: 'gokyuzu'
}

function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)}-${p(d.getHours())}-${p(d.getMinutes())}`
}

/**
 * Alt süreç çalıştırır.
 *
 * DİKKAT: execSync'a argüman DİZİSİ vermek + shell:true Windows'ta
 * komutu sessizce çalıştırmıyor (çıktı gelmez, dosya güncellenmez).
 * Bu yüzden tek bir komut metni verilir ve tırnak içinde yol kullanılır.
 */
function run(command, cwd = ROOT) {
  console.log(`\n> ${command}`)
  execSync(command, { cwd, stdio: 'inherit', shell: true })
}

function buildApk(themeName) {
  const src = path.join(THEMES_DIR, `${themeName}.css`)
  if (!fs.existsSync(src)) throw new Error(`Tema bulunamadı: ${src}`)

  console.log(`\n${'='.repeat(50)}\n  TEMA: ${themeName.toUpperCase()}\n${'='.repeat(50)}`)

  fs.copyFileSync(src, ACTIVE)
  run('npx vite build')
  // DİKKAT: canlı modda android/assets içine server.url yazılmış olur ve
  // `cap sync` bu bayat kopyayı her zaman EZMEZ. scripts/sync-android.js
  // dosyayı silip yeniden yazar, sonra da server.url kalmadığını doğrular.
  run(`node "${path.join(ROOT, 'scripts', 'sync-android.js')}"`)
  // DİKKAT: gradlew.bat için TAM YOL şart. Yalnızca adı verilirse
  // "is not recognized as an internal or external command" hatası verir
  // (cmd mevcut dizini PATH'te aramaz).
  run(`"${path.join(ROOT, 'android', 'gradlew.bat')}" assembleDebug`, path.join(ROOT, 'android'))

  const out = path.join(DIST, `Guvercin-${LABELS[themeName] || themeName}-${stamp()}.apk`)
  fs.mkdirSync(DIST, { recursive: true })
  fs.copyFileSync(APK, out)
  const mb = (fs.statSync(out).size / 1048576).toFixed(1)
  console.log(`\n✓ ${path.basename(out)}  (${mb} MB)`)
  return out
}

const available = fs
  .readdirSync(THEMES_DIR)
  .filter(f => f.endsWith('.css'))
  .map(f => path.basename(f, '.css'))

const asked = process.argv.slice(2).filter(a => !a.startsWith('-'))
const themes = asked.length ? asked : available

for (const t of themes) {
  if (!available.includes(t)) {
    console.error(`Bilinmeyen tema: ${t}. Seçenekler: ${available.join(', ')}`)
    process.exit(1)
  }
}

try {
  // Canlı mod ayarı yazılmışsa APK boş ekranla açılır; temizleniyor.
  run(`node "${path.join(ROOT, 'scripts', 'live-android.js')}" --cleanup`)

  const made = themes.map(buildApk)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${made.length} APK üretildi:`)
  made.forEach(f => console.log(`    · ${path.basename(f)}`))
  console.log(`${'='.repeat(50)}`)
} finally {
  // Hata olsa bile varsayılan temaya dön.
  const def = path.join(THEMES_DIR, `${DEFAULT_THEME}.css`)
  if (fs.existsSync(def)) fs.copyFileSync(def, ACTIVE)
  console.log(`\n> Etkin tema "${DEFAULT_THEME}" olarak geri alındı.`)
}