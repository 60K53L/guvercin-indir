/**
 * Android canlı geliştirme.
 *
 * Nasıl çalışır:
 *   1. Vite geliştirme sunucusunu başlatır
 *   2. capacitor.config.json'a server.url yazar (Vite adresi)
 *   3. Android'e sync eder, derler, kurar, açar
 *   4. Vite HMR sayesinde kod kaydedilince uygulama kendini günceller
 *   5. Çıkışta server.url silinir ve üretim ayarları geri yüklenir
 *
 * Kullanım:  npm run dev:android
 * Durdurmak: Ctrl+C
 *
 * NOT: server.url yazılıyken derlenen APK "canlı mod" olur ve Vite
 * çalışmazsa uygulama boş ekran açar. Bu yüzden `npm run mobile:apk` ve
 * `npm run dist` bu betiği çalıştırmadan ÖNCE server.url'u temizler.
 */
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const net = require('net')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const PORT = 5173
const CONFIG = path.join(ROOT, 'capacitor.config.json')
const BACKUP = path.join(ROOT, 'capacitor.config.live-backup.json')

const children = []
function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { cwd: ROOT, shell: true, stdio: 'inherit', ...opts })
  children.push(p)
  return p
}

/** Canlı ayarı temizler; üretim derlemesi bunu çağırır. */
function restoreConfig() {
  if (fs.existsSync(BACKUP)) {
    fs.copyFileSync(BACKUP, CONFIG)
    fs.unlinkSync(BACKUP)
    return 'geri yüklendi'
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  if (cfg.server && cfg.server.url) {
    delete cfg.server.url
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
    return 'server.url silindi'
  }
  return 'temiz'
}

function stopAll(code = 0) {
  console.log('\n> Canlı mod kapatılıyor, ayarlar geri yükleniyor...')
  for (const c of children) {
    try { c.kill() } catch {}
  }
  try { restoreConfig() } catch {}
  process.exit(code)
}

if (process.argv.includes('--cleanup')) {
  console.log('capacitor.config.json:', restoreConfig())
  process.exit(0)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

function localIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address
    }
  }
  return null
}

const ADB = path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe')

/**
 * Emülatör bağlıysa 10.0.2.2 kullanılır: Android emülatörünün bilgisayarın
 * loopback adresi, ağ yapılandırmasından bağımsız her zaman çalışır.
 * Gerçek telefon bağlıysa bilgisayarın yerel IP'si gerekir.
 */
function pickHost() {
  if (process.env.LIVE_HOST) return process.env.LIVE_HOST
  try {
    const out = execSync(`"${ADB}" devices`, { encoding: 'utf8' })
    if (/^emulator-\d+\s+device/m.test(out)) return '10.0.2.2'
  } catch { /* adb yoksa aşağıdaki varsayılana düş */ }
  return localIp() || '10.0.2.2'
}

function waitForPort(port, timeoutMs = 60000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const s = net.connect(port, '127.0.0.1')
      s.on('connect', () => { s.destroy(); resolve() })
      s.on('error', () => {
        s.destroy()
        if (Date.now() - started > timeoutMs) reject(new Error('vite sunucusu açılmadı'))
        else setTimeout(attempt, 400)
      })
    }
    attempt()
  })
}

;(async () => {
  const host = pickHost()
  const url = `http://${host}:${PORT}`

  console.log('\n==================================================')
  console.log('   CANLI MOD — kodu kaydet, uygulama güncellenir')
  console.log('==================================================')
  console.log('  Vite adresi :', url)
  console.log('  Durdurmak   : Ctrl+C')
  console.log('==================================================\n')

  // 1) Vite
  console.log('> vite --host başlatılıyor...')
  run('npx', ['vite', '--host', '--port', String(PORT)])
  await waitForPort(PORT)
  console.log('> Vite hazır.\n')

  // 2) capacitor.config.json'a canlı adresi yaz
  const original = fs.readFileSync(CONFIG, 'utf8')
  if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, original, 'utf8')

  const cfg = JSON.parse(original)
  // androidScheme MUTLAKA http olmalı: sunucu adresi de http.
  // 'https' kalırsa WebView https://<ip>:5173 arar ve boş ekran açar.
  cfg.server = { ...(cfg.server || {}), url, cleartext: true, androidScheme: 'http' }
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  console.log(`> capacitor.config.json -> server.url = ${url}  (androidScheme: http)\n`)

  // 3) sync + derle + kur + aç
  execSync('npx cap sync android', { cwd: ROOT, stdio: 'inherit', shell: true })
  process.env.JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.12.101-hotspot'
  // DİKKAT: gradlew kök dizini `android/`'dir. ROOT'tan çalıştırılırsa
  // "does not contain a Gradle build" hatası verir.
  execSync('gradlew.bat assembleDebug', {
    cwd: path.join(ROOT, 'android'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  })

  execSync(`"${ADB}" install -r app\\build\\outputs\\apk\\debug\\app-debug.apk`, {
    cwd: path.join(ROOT, 'android'), stdio: 'inherit', shell: true
  })
  execSync(`"${ADB}" shell monkey -p com.guvercin.soy -c android.intent.category.LAUNCHER 1`, {
    cwd: ROOT, stdio: 'ignore', shell: true
  })

  console.log('\n==================================================')
  console.log('  Uygulama açıldı. Artık kod kaydedince')
  console.log('  emülatör kendini günceller.')
  console.log('  Bitirdiğinde Ctrl+C ile kapat.')
  console.log('==================================================\n')
})().catch(err => {
  console.error('\nHata:', err.message)
  stopAll(1)
})