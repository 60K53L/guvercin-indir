/**
 * Türkçe karakter uçtan uca testi.
 *
 * Emülatörde Ç/Ğ/İ/Ö/Ş/Ü yazılamıyor (bilgisayar klavyesi QWERTY).
 * Bu test, veriyi Firebase'e biz yazıp geri okuyarak Türkçe karakterlerin
 * bozulmadan saklanıp alfabetik sıralandığını doğrular.
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')

const EMAIL = `test-tr-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

// Karışık ve Türkçe karakterli — sıralı gelmeli
const KODLAR = ['ŞAHİN', 'ÇAKAL', 'ZEYTİN', 'İZMİR', 'ÖZTÜRK', 'GÖÇMEN', 'ÇİĞDEM']
const CINSLER = ['ŞAHİN', 'ÇAKAL', 'YAĞLI', 'İZMİR', 'ÖRDEK', 'GÜVERCİN', 'ÇİĞDEM']

const EXPECT_KOD = ['ÇAKAL', 'ÇİĞDEM', 'GÖÇMEN', 'İZMİR', 'ÖZTÜRK', 'ŞAHİN', 'ZEYTİN']
const EXPECT_CINS = ['ÇAKAL', 'ÇİĞDEM', 'GÜVERCİN', 'İZMİR', 'ÖRDEK', 'ŞAHİN', 'YAĞLI']

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
    if (!up.ok) return [{ ad: 'kayit', sonuc: up.error }]

    // Karışık sırayla yaz
    await window.api.settingsPut({ codes: ${JSON.stringify(KODLAR)}, cinsi: ${JSON.stringify(CINSLER)} })

    // Geri oku — migrate() sıralamalı
    const db = await window.api.dbLoad()
    r.push({ ad: 'kodlar (sirali gelmeli)', sonuc: JSON.stringify(db.data.settings.codes) })
    r.push({ ad: 'cinsler (sirali gelmeli)', sonuc: JSON.stringify(db.data.settings.cinsi) })

    const c = await window.api.settingsPut({ codes: ${JSON.stringify(KODLAR)}, cinsi: ${JSON.stringify(CINSLER)} })
    r.push({ ad: 'turkce karakter bozulmadi', sonuc: c.ok ? 'evet' : c.error })

    await window.api.signOut()
    return r
  })()`, true)

  console.log('\n============== TURKCE KARAKTER TESTI ==============')
  let fail = 0
  for (const o of out) {
    let okc = true
    if (o.ad.startsWith('kodlar')) okc = o.sonuc === JSON.stringify(EXPECT_KOD)
    if (o.ad.startsWith('cinsler')) okc = o.sonuc === JSON.stringify(EXPECT_CINS)
    if (o.sonuc === 'evet') okc = true
    if (o.sonuc && /error|hata/i.test(o.sonuc)) okc = false
    if (!okc) fail++
    console.log(`  ${okc ? '✓' : '✗'} ${o.ad}`)
    console.log(`      ${o.sonuc}`)
  }
  console.log('=================================================\n')
  console.log('Hesap:', EMAIL)
  win.destroy()
  app.quit()
})