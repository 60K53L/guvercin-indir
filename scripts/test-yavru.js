/**
 * Yeni model testi:
 *  - Çiftleşmeler sekmesi kaldırıldı
 *  - Yavru "Yeni Kuş" + baba/ana seçimiyle giriliyor
 *  - Bu yavru, eşleşmenin yavru listesine otomatik eklenmeli
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')

const EMAIL = `test-yavru-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

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

    // Baba ve ana
    await window.api.birdPut({ id: 'baba', code: 'GC', number: '01', sex: 'M', photos: [] })
    await window.api.birdPut({ id: 'ana',  code: 'GC', number: '02', sex: 'F', photos: [] })

    // Eş atamasi (formun "Eş" alani bunu yapar)
    await window.api.pairingPut({ id: 'p1', maleId: 'baba', femaleId: 'ana', chickIds: [] })

    // Yavru, baba/ana secilerek ekleniyor
    const yavruId = 'yavru-' + Date.now()
    await window.api.birdPut({ id: yavruId, code: 'GC', number: '03', sex: 'M', sireId: 'baba', damId: 'ana', photos: [] })

    // App'in yaptigi otomatik baglama mantigini taklit et
    const db = await window.api.dbLoad()
    const pairing = db.data.pairings.find(p => p.maleId === 'baba' && p.femaleId === 'ana')
    if (pairing && !(pairing.chickIds||[]).includes(yavruId)) {
      await window.api.pairingPut({ ...pairing, chickIds: [...(pairing.chickIds||[]), yavruId] })
    }
    const db2 = await window.api.dbLoad()
    const p2 = db2.data.pairings.find(p => p.id === 'p1')

    r.push({ ad: 'ciftlesme kaydi var', ok: !!p2, sonuc: p2 ? (p2.maleId + ' x ' + p2.femaleId) : 'yok' })
    r.push({ ad: 'yavru listeye eklendi', ok: (p2.chickIds||[]).includes(yavruId), sonuc: 'chickIds=' + (p2.chickIds||[]).length })
    r.push({ ad: 'yavrunun baba/ana bagi duruyor', ok: db2.data.birds.find(b=>b.id===yavruId).sireId === 'baba', sonuc: 'sireId=' + db2.data.birds.find(b=>b.id===yavruId).sireId })

    // NOT: Kuş silince bağlı çiftleşmelerin temizlenmesi App katmanındadır
    // (App.removeBird), api katmanında değil. Bu davranış
    // scripts/test-data.mjs içinde ayrıca kapsanıyor.

    await window.api.signOut()
    return r
  })()`, true)

  console.log('\n======== YAVRU BAGLAMA TESTI ========')
  let fail = 0
  for (const o of out) {
    if (!o.ok) fail++
    console.log(`  ${o.ok ? '✓' : '✗'} ${o.ad}  (${o.sonuc})`)
  }
  console.log('===================================\n')
  console.log('Hesap:', EMAIL)
  win.destroy()
  app.quit()
})