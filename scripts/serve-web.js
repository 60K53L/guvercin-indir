/**
 * web/ klasörünü basit bir statik sunucuyla açar.
 *
 * Amaç: yayınlamadan ÖNCE gerçek bir tarayıcıda denemek.
 * Servis çalışanı yalnızca https:// veya localhost üzerinde kaydolur;
 * bu sunucu http://10.0.2.2:8080 üzerinden açılacağı için emülatörde
 * servis çalışanı çalışmaz (uygulamanın geri kalanı sorunsuz çalışır).
 *
 * Kullanım:  node scripts/serve-web.js [port]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.join(__dirname, '..', 'web')
const PORT = Number(process.argv[2] || 8080)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

if (!fs.existsSync(ROOT)) {
  console.error('web/ yok. Önce: npm run web:build')
  process.exit(1)
}

function localIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address
    }
  }
  return '127.0.0.1'
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let file = path.join(ROOT, decodeURIComponent(url.pathname))
  // Dışarı çıkışı engelle.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end(' Yasak')
    return
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
  if (!fs.existsSync(file)) file = path.join(ROOT, 'index.html') // SPA geri dönüş

  const type = TYPES[path.extname(file)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' })
  fs.createReadStream(file).pipe(res)
}).listen(PORT, () => {
  console.log(`\n  Yerel   : http://localhost:${PORT}`)
  console.log(`  Ağ      : http://${localIp()}:${PORT}`)
  console.log(`  Emülatör: http://10.0.2.2:${PORT}\n`)
  console.log('  (Durdurmak için Ctrl+C)\n')
})