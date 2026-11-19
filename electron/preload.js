const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)

// Yalnızca işletim sistemine özgü işler burada. Veri katmanı (Firestore)
// renderer içinde çalışır ve preload'u kullanmaz.
contextBridge.exposeInMainWorld('host', {
  pickPhotos: () => invoke('photo:pick'),
  saveJson: (text, suggestedName) => invoke('data:save', { text, suggestedName }),
  pickJson: () => invoke('data:open'),
  openPath: (p) => invoke('app:openPath', p),
  openExternal: (url) => invoke('app:openExternal', url),
  userDataPath: () => invoke('app:userDataPath')
})