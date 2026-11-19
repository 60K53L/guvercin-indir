/**
 * Arayüz doğrulama: geçici hesapla ana ekranı açar ve ekran görüntüsü alır.
 * Kart ortalaması, filtre yerleşimi gibi düzen değişikliklerini görmek için.
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const EMAIL = `test-ui-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 460, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'))
  await new Promise(r => setTimeout(r, 2500))

  await win.webContents.executeJavaScript(`(async () => {
    const up = await window.api.signUp(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASS)})
    if (!up.ok) return
    await window.api.settingsPut({ codes: ['MAVI','BEYAZ','KIRMIZI'], cinsi: ['ÇAKAL','LİMONİ'], seeded: true })
    await window.api.birdPut({ id: 'a', code: 'MAVI', number: '01', sex: 'M', name: 'YILDIZ', status: 'damizlik', photos: [] })
    await window.api.birdPut({ id: 'b', code: 'BEYAZ', number: '02', sex: 'F', name: 'AY', status: 'damizlik', photos: [] })
    await window.api.birdPut({ id: 'c', code: 'KIRMIZI', number: '03', sex: 'M', name: 'KIRMIZI', status: 'damizlik', photos: [] })
    await window.api.pairingPut({ id: 'p', maleId: 'a', femaleId: 'b', chickIds: [] })
    await window.api.birdPut({ id: 'd', code: 'MAVI', number: '04', sex: 'M', name: 'YAVRU', status: 'yavru', sireId: 'a', damId: 'b', photos: [] })
  })()`, true)

  // Firebase'in yayması için kısa bekleme
  await new Promise(r => setTimeout(r, 6000))

  const shot = await win.webContents.capturePage()
  const out = path.join(__dirname, '..', 'build', 'ui-ana-ekran.png')
  fs.writeFileSync(out, shot.toPNG())
  console.log('Ekran görüntüsü:', out)
  console.log('Hesap:', EMAIL)

  win.destroy()
  app.quit()
})