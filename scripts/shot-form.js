/**
 * Kuş ekleme formunun ekran görüntüsü.
 * Mobilde formun arkasından ana ekranın görünmesi (taşma hatası)
 * düzeltildikten sonra kontrol için.
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const EMAIL = `test-form-${Date.now()}@guvercin-test.com`
const PASS = 'Test12345'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 430, height: 900, show: false,
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

  await new Promise(r => setTimeout(r, 4000))

  // "+ Yeni Kuş" düğmesine tıkla
  await win.webContents.executeJavaScript(`
    [...document.querySelectorAll('button')]
      .find(b => /Yeni Kuş/i.test(b.textContent))?.click()
  `, true)
  await new Promise(r => setTimeout(r, 1200))

  // Formu aşağı kaydır ki alt kısım (taşma olan yer) görünsün
  await win.webContents.executeJavaScript(`
    const m = document.querySelector('.modal');
    if (m) m.scrollTop = m.scrollHeight;
  `, true)
  await new Promise(r => setTimeout(r, 700))

  const shot = await win.webContents.capturePage()
  const out = path.join(__dirname, '..', 'build', 'ui-form.png')
  fs.writeFileSync(out, shot.toPNG())
  console.log('Ekran görüntüsü:', out)
  console.log('Hesap:', EMAIL)

  win.destroy()
  app.quit()
})