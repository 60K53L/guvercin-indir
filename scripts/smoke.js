/**
 * Duman testi: uygulamayı Electron'da açıp ekranı kontrol eder.
 * Ekran görüntüsü alır ve konsol hatalarını toplar.
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const errors = []
const logs = []

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.webContents.on('console-message', (e, level, message, line, source) => {
    logs.push(`[${level}] ${message}`)
    if (level >= 2) errors.push(`${message} (${source}:${line})`)
  })

  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'))
  await new Promise(r => setTimeout(r, 2500))

  // Ekranda ne var?
  const info = await win.webContents.executeJavaScript(`
    (() => {
      const root = document.getElementById('root')
      return JSON.stringify({
        text: root.innerText.slice(0, 600),
        hasApi: typeof window.api === 'object' && window.api !== null,
        configured: window.api ? window.api.configured : null,
        hasHost: typeof window.host === 'object' && window.host !== null,
        hostKeys: window.host ? Object.keys(window.host) : null,
        apiKeys: window.api ? Object.keys(window.api) : null
      })
    })()
  `)

  const shot = await win.webContents.capturePage()
  const out = path.join(__dirname, '..', 'build', 'smoke.png')
  fs.writeFileSync(out, shot.toPNG())

  console.log('--- EKRAN ---')
  console.log(info)
  console.log('\n--- KONSOL ---')
  console.log(logs.join('\n') || '(boş)')
  console.log('\n--- HATA SAYISI: ' + errors.length + ' ---')
  errors.forEach(e => console.log('  ' + e))
  console.log('\nEkran görüntüsü: ' + out)

  win.destroy()
  app.quit()
})