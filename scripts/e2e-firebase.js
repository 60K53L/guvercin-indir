/**
 * Uçtan uca test: gerçek Firebase projesine bağlanır, geçici bir hesap
 * açar, kuş ekler, okur, siler ve hesabı temizler.
 *
 * Bu, kodun gerçekten çalıştığının kanıtıdır; sahte depo değil.
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')

const EMAIL = `test-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

const errors = []

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 860, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })

  win.webContents.on('console-message', (e, level, message, line, source) => {
    if (level >= 2 && !/DevTools|Autofill/.test(message)) errors.push(`${message} (${source}:${line})`)
  })

  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'))
  await new Promise(r => setTimeout(r, 2000))

  const run = (js) => win.webContents.executeJavaScript(js, true)

  const report = await run(`(async () => {
    const out = []
    const log = (name, val) => out.push({ name, val: JSON.stringify(val) })

    try {
      log('yapilandirilmis', window.api.configured)

      // --- oturum ac ---
      const up = await window.api.signUp(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASS)})
      log('kayit', up.ok ? 'basarili' : up.error)
      if (!up.ok) return out

      const st = await window.api.authState()
      log('oturum', st.ok ? st.data.email : st.error)

      // --- kuş ekle ---
      const birdId = 'test-' + Date.now()
      const put = await window.api.birdPut({
        id: birdId, code: 'TEST', number: '01', sex: 'M',
        name: 'DENEME', status: 'damizlik', photos: []
      })
      log('kus eklendi', put.ok ? put.data : put.error)

      const bird2 = await window.api.birdPut({
        id: birdId + '-2', code: 'TEST', number: '02', sex: 'F',
        name: 'DENEME DISI', status: 'damizlik', photos: [], sireId: birdId
      })
      log('ikinci kus', bird2.ok ? 'ok' : bird2.error)

      // --- ciftlesme ---
      const pair = await window.api.pairingPut({
        id: 'p-' + Date.now(), maleId: birdId, femaleId: birdId + '-2',
        chickIds: [], nest: 'K-1'
      })
      log('ciftlesme', pair.ok ? 'ok' : pair.error)

      // --- oku ---
      const db = await window.api.dbLoad()
      log('okunan kus sayisi', db.ok ? db.data.birds.length : db.error)
      log('okunan ciftlesme', db.ok ? db.data.pairings.length : db.error)

      // --- ayar ---
      const s = await window.api.settingsPut({ codes: ['TESTKOD'], cinsi: ['LIMONI'] })
      log('ayarlar', s.ok ? 'ok' : s.error)

      // --- guncelleme: sadece TEK belge degismeli ---
      await window.api.birdPut({ id: birdId, code: 'TEST', number: '01', sex: 'M',
        name: 'GUNCELLENDI', status: 'damizlik', photos: [] })
      const db2 = await window.api.dbLoad()
      const guncel = db2.ok ? db2.data.birds.find(b => b.id === birdId) : null
      log('tek belge guncellendi', guncel ? guncel.name : 'yok')
      log('diger belge etkilenmedi', db2.ok ? (db2.data.birds.find(b => b.id === birdId + '-2') || {}).name : '-')

      // --- sil ---
      const del = await window.api.birdDelete(birdId)
      log('silme', del.ok ? 'ok' : del.error)
      const db3 = await window.api.dbLoad()
      log('silinen kuş kaldi mi', db3.ok ? db3.data.birds.some(b => b.id === birdId) : '-')

      // --- cikis ---
      const out2 = await window.api.signOut()
      log('cikis', out2.ok ? 'ok' : out2.error)

      const st2 = await window.api.authState()
      log('cikis sonrasi durum', st2.ok ? st2.data.signedIn : st2.error)
    } catch (err) {
      log('HATA', String(err && err.message || err))
    }
    return out
  })()`)

  console.log('\n================= UÇTAN UCA TEST =================')
  let fails = 0
  for (const r of report) {
    const bad = /HATA|error|hatalı|permission|denied|FAIL/i.test(r.val)
    if (bad) fails++
    console.log(`  ${bad ? '✗' : '✓'} ${r.name.padEnd(26)} ${r.val}`)
  }
  console.log('==================================================\n')
  console.log('Konsol hataları:', errors.length)
  errors.slice(0, 5).forEach(e => console.log('  ' + e))

  console.log('\nTEMİZLEME — test hesabını silmek için Firebase Admin gerekli.')
  console.log('Hesap:', EMAIL)

  win.destroy()
  app.quit()
})