const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const isDev = !app.isPackaged
let win = null

/**
 * Pencere ve görev çubuğu ikonu. Electron, exe'nin ikon kaynağını kendisi
 * okumaz; belirtilmezse başlıkta ve alt barda Electron simgesi görünür.
 *
 * Dosya app.asar İÇİNDE olamaz: Chromium ikonu native olarak yükler ve asar
 * arşivini okuyamaz, sonuçta yine Electron simgesi çıkar. Bu yüzden
 * electron-builder `extraResources` ile `resources/` yanına konur.
 */
const APP_ICON = path.join(process.resourcesPath, 'icon.png')

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#14161c',
    title: 'GÜVERCİN SOY TAKİP',
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Firebase Auth ve IndexedDB çevrimdışı önbelleği bununla çalışır.
      spellcheck: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'app', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function ok(data) { return { ok: true, data } }
function fail(err) { return { ok: false, error: err.message || String(err) } }

/**
 * Fotoğraf seçtirir ve base64 olarak renderer'a verir.
 * Yükleme işini renderer yapar; burada sadece okuma ve ad üretme var.
 */
ipcMain.handle('photo:pick', async () => {
  try {
    const res = await dialog.showOpenDialog(win, {
      title: 'Fotoğraf seç',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Resim', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
    })
    if (res.canceled || !res.filePaths.length) return ok([])

    const out = []
    for (const p of res.filePaths) {
      const ext = (path.extname(p) || '.jpg').toLowerCase()
      const buf = fs.readFileSync(p)
      out.push({
        name: `${crypto.randomUUID()}${ext}`,
        mime: MIME[ext] || 'image/jpeg',
        base64: buf.toString('base64')
      })
    }
    return ok(out)
  } catch (err) { return fail(err) }
})

ipcMain.handle('data:save', async (_e, { text, suggestedName }) => {
  try {
    const res = await dialog.showSaveDialog(win, {
      title: 'Yedeği kaydet',
      defaultPath: suggestedName || `guvercin-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return ok(null)
    fs.writeFileSync(res.filePath, text, 'utf8')
    return ok(res.filePath)
  } catch (err) { return fail(err) }
})

ipcMain.handle('data:open', async () => {
  try {
    const res = await dialog.showOpenDialog(win, {
      title: 'Yedek dosyası seç',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths.length) return ok(null)
    return ok(fs.readFileSync(res.filePaths[0], 'utf8'))
  } catch (err) { return fail(err) }
})

ipcMain.handle('app:userDataPath', () => ok(app.getPath('userData')))

ipcMain.handle('app:openPath', (_e, p) => { shell.openPath(p); return ok(true) })

/** Dış bağlantıyı varsayılan tarayıcıda açar. Yalnızca http(s) kabul edilir. */
ipcMain.handle('app:openExternal', async (_e, url) => {
  try {
    const u = new URL(String(url))
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return fail('Yalnızca http(s) adresleri açılabilir')
    }
    await shell.openExternal(u.toString())
    return ok(true)
  } catch (err) { return fail(err) }
})