/**
 * Yedekleme ekranının ekran görüntüsü (mobil genişlikte).
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const EMAIL = `test-yedek-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 430, height: 1400, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'))
  await new Promise(r => setTimeout(r, 2500))

  const up = await win.webContents.executeJavaScript(
    `window.api.signUp(${JSON.stringify(EMAIL)}, ${JSON.stringify(PASS)}).then(r => r.ok)`, true)
  if (!up) { console.error('kayıt başarısız'); app.quit(); return }

  await win.webContents.executeJavaScript(`
    (async () => {
      await window.api.birdPut({ id: 'a', code: 'MAVI', number: '01', sex: 'M', name: 'YILDIZ', status: 'damizlik', photos: [] });
      await window.api.birdPut({ id: 'b', code: 'BEYAZ', number: '02', sex: 'F', name: 'AY', status: 'damizlik', photos: [] });
      await window.api.pairingPut({ id: 'p', maleId: 'a', femaleId: 'b', chickIds: [] });
    })()
  `, true)

  await new Promise(r => setTimeout(r, 6000))

  // "Yedekleme" sekmesine geç
  await win.webContents.executeJavaScript(`
    [...document.querySelectorAll('.nav button')]
      .find(b => /Yedekleme/i.test(b.textContent))?.click()
  `, true)
  await new Promise(r => setTimeout(r, 1500))

  const shot = await win.webContents.capturePage()
  const out = path.join(__dirname, '..', 'build', 'ui-yedekleme.png')
  fs.writeFileSync(out, shot.toPNG())
  console.log('Ekran görüntüsü:', out)
  console.log('Hesap:', EMAIL)

  win.destroy()
  app.quit()
})