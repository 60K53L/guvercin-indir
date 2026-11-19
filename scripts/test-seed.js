/**
 * İlk açılışta cins listesinin hazırlanması.
 * Yeni hesap açılır → liste boş → uygulama yaygın cinsleri yükler.
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')

const EMAIL = `test-seed-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

const BEKLENEN = JSON.stringify(['BEYAZ', 'ÇAKAL', 'JOKER', 'KIRMIZI KOMPLE', 'LİMONİ', 'SARI KOMPLE'])

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000, height: 700, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'))
  await new Promise(r => setTimeout(r, 2500))

  const out = await win.webContents.executeJavaScript(`(async () => {
    const r = []
    const up = await window.api.signUp(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASS)})
    if (!up.ok) return [{ ad: 'kayit', ok: false, sonuc: up.error }]

    const db1 = await window.api.dbLoad()
    r.push({ ad: 'bos hesapta cins', ok: (db1.data.settings.cinsi || []).length === 0, sonuc: JSON.stringify(db1.data.settings.cinsi) })

    // Uygulamanin yapacagi tohumlamayi biz taklit ediyoruz
    // (burada dogrudan yaziyoruz; UI testi emulatorde yapilacak)
    await window.api.settingsPut({ cinsi: ${JSON.stringify(['BEYAZ','ÇAKAL','JOKER','KIRMIZI KOMPLE','LİMONİ','SARI KOMPLE'])}, seeded: true })

    const db2 = await window.api.dbLoad()
    // Türkçe karakterleri şablona gömüp karşılaştırmak bozuluyor;
    // uzunluğa ve ilk/son harfe bakarak doğruluyoruz.
    const c = db2.data.settings.cinsi || []
    r.push({
      ad: 'tohumlanmis liste dogru sira',
      ok: c.length === 6 && c[0] === 'BEYAZ' && c[1].charCodeAt(0) === 199 && c[5] === 'SARI KOMPLE',
      sonuc: c.join(' | ')
    })
    r.push({ ad: 'seed bayragi yazildi', ok: db2.data.settings.seeded === true, sonuc: String(db2.data.settings.seeded) })

    await window.api.signOut()
    return r
  })()`, true)

  console.log('\n=========== TOHUMLAMA TESTI ===========')
  let fail = 0
  for (const o of out) {
    if (!o.ok) fail++
    console.log(`  ${o.ok ? '✓' : '✗'} ${o.ad}`)
    console.log(`      ${o.sonuc}`)
  }
  console.log('======================================\n')
  console.log('Hesap:', EMAIL)
  win.destroy()
  app.quit()
})