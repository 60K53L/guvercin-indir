/**
 * Herkese açık APK indirme sayfası.
 *
 * NEDEN GITHUB? Firebase Hosting (Spark / ücretsiz plan) çalıştırılabilir
 * dosyaları (.apk dahil) barındırmaya izin vermez:
 *   "Executable files are forbidden on the Spark billing plan."
 * Bu yüzden APK, herkese açık bir GitHub deposunun sürüm (release) ekinde
 * tutulur ve bu sayfa oraya link verir. Böylece paylaşılabilir genel bir
 * indirme bağlantısı oluşur:
 *
 *   https://guvercin-beta-dev.web.app/indir.html
 *     → https://github.com/60K53L/guvercin-indir/releases/latest/download/guvercin.apk
 *
 * `releases/latest/download/<ad>` bağlantısı sabittir; yeni sürüm yayınlandıkça
 * aynı adres en güncel APK'yı verir.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')

/** Herkese açık APK deposu + sabit varlık adı. */
const APK_REPO = '60K53L/guvercin-indir'
const APK_ASSET = 'guvercin.apk'
const APK_URL = `https://github.com/${APK_REPO}/releases/latest/download/${APK_ASSET}`

/** dist/ içindeki en yeni APK'yı döndürür (yoksa null). */
function latestApk() {
  if (!fs.existsSync(DIST_DIR)) return null
  const files = fs.readdirSync(DIST_DIR).filter(f => f.toLowerCase().endsWith('.apk'))
  if (!files.length) return null
  files.sort((a, b) => b.localeCompare(a, 'tr', { numeric: true, sensitivity: 'base' }))
  const name = files[0]
  return { name, path: path.join(DIST_DIR, name) }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function renderPage({ appVersion, apkSizeMb, apkDate }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Güvercin — APK İndir</title>
<link rel="icon" href="/favicon-32.png" />
<style>
  :root { --bg:#0f131a; --panel:#1b2130; --panel2:#232b3d; --line:#334155; --text:#e6ecf5; --muted:#93a1b5; --accent:#38bdf8; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; background:radial-gradient(1200px 600px at 50% -10%, #1c2740 0%, var(--bg) 55%);
         color:var(--text); font:16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { width:100%; max-width:440px; background:var(--panel); border:1px solid var(--line);
          border-radius:18px; padding:28px 22px; box-shadow:0 24px 60px rgba(0,0,0,.5); text-align:center; }
  .logo { width:88px; height:88px; border-radius:20px; background:var(--panel2); padding:8px; margin:0 auto 14px; display:block; }
  h1 { margin:0 0 4px; font-size:24px; letter-spacing:.5px; }
  .sub { color:var(--muted); font-size:13.5px; margin-bottom:22px; }
  .btn { display:flex; align-items:center; justify-content:center; gap:10px; text-decoration:none;
         background:linear-gradient(135deg,#0ea5e9,#38bdf8); color:#04222f; font-weight:800; font-size:17px;
         padding:15px 18px; border-radius:12px; box-shadow:0 10px 26px rgba(56,189,248,.35); transition:transform .08s; }
  .btn:active { transform:scale(.98); }
  .btn-ico { font-size:20px; }
  .meta { color:var(--muted); font-size:12.5px; margin-top:12px; line-height:1.7; }
  .steps { text-align:left; margin:22px 0 0; padding:16px; background:var(--panel2); border:1px solid var(--line);
           border-radius:12px; }
  .steps h2 { font-size:13px; margin:0 0 10px; color:var(--accent); letter-spacing:.5px; text-transform:uppercase; }
  .steps ol { margin:0; padding-left:20px; color:var(--text); font-size:13.5px; }
  .steps li { margin-bottom:6px; }
  .link { display:inline-block; margin-top:18px; color:var(--accent); text-decoration:none; font-size:13.5px; }
  .link:hover { text-decoration:underline; }
</style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/icon-192.png" alt="Güvercin" />
    <h1>Güvercin</h1>
    <div class="sub">Soy takip ve üreme yönetimi · Android uygulaması</div>

    <a class="btn" href="${APK_URL}">
      <span class="btn-ico">⬇</span> APK İndir (Android)
    </a>
    <div class="meta">
      Sürüm <b>v${esc(appVersion)}</b>${apkSizeMb ? ` · ${esc(apkSizeMb)} MB` : ''}${apkDate ? ` · ${esc(apkDate)}` : ''}
    </div>

    <div class="steps">
      <h2>Kurulum</h2>
      <ol>
        <li>Yukarıdaki <b>APK İndir</b> butonuna bas.</li>
        <li>Telefonda <b>"bilinmeyen kaynaklardan kuruluma izin ver"</b> seçeneğini aç.</li>
        <li>İndirilen dosyayı açıp <b>Kur</b> de.</li>
      </ol>
    </div>

    <a class="link" href="/">Uygulamayı tarayıcıda aç →</a>
  </main>
</body>
</html>
`
}

/**
 * İndirme sayfasını hosting klasörüne (web/) yazar.
 * APK'nın kendisi Firebase'e konmaz (çalıştırılabilir dosya yasağı);
 * sayfa herkese açık GitHub sürümüne link verir.
 *
 * @param {string} webDir Hosting klasörü (web/)
 * @param {{appVersion?:string}} opts
 */
function prepareDownloads(webDir, { appVersion = '' } = {}) {
  const apk = latestApk()
  let apkSizeMb = ''
  let apkDate = ''
  if (apk) {
    const st = fs.statSync(apk.path)
    apkSizeMb = (st.size / 1048576).toFixed(1)
    apkDate = st.mtime.toLocaleDateString('tr-TR')
  }

  fs.writeFileSync(
    path.join(webDir, 'indir.html'),
    renderPage({ appVersion, apkSizeMb, apkDate }),
    'utf8'
  )

  return { url: APK_URL, repo: APK_REPO, asset: APK_ASSET, apiVersion: appVersion, localApk: apk?.name || null }
}

module.exports = { prepareDownloads, latestApk, APK_URL, APK_REPO, APK_ASSET }
