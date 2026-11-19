/**
 * Capacitor (Android) için işletim sistemine özgü işler.
 * Veri katmanı ortaktır; sadece dosya seçme/kaydetme farklıdır.
 *
 * Dönen yüzey `window.host` ile aynıdır:
 *   pickPhotos, saveJson, pickJson, openPath, openExternal, userDataPath
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera'
import { Share } from '@capacitor/share'
import { Browser } from '@capacitor/browser'
import { FilePicker } from '@capawesome/capacitor-file-picker'

const ok = data => ({ ok: true, data })
const fail = error => ({ ok: false, error: String((error && error.message) || error) })

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp': 'image/bmp'
}

const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2)

/** Android'de Camera bazen content://, bazen file:// döndürür. Filesystem yol bekler. */
function toFsPath(p) {
  if (!p) return p
  if (p.startsWith('file://')) return decodeURIComponent(p.slice(7))
  return p
}

export function createCapacitorHost() {
  return {
    async pickPhotos(source) {
      try {
        if (source === 'camera') {
          const photo = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera
          })
          if (!photo) return ok([])
          const src = toFsPath(photo.path || photo.webPath)
          const read = await Filesystem.readFile({ path: src })
          const ext = '.' + (photo.format || 'jpeg').toLowerCase()
          return ok([{
            name: `${uid()}${ext}`,
            mime: MIME[ext] || 'image/jpeg',
            base64: read.data
          }])
        }

        const picked = await Camera.pickImages({ quality: 90 })
        const out = []
        for (const photo of picked.photos || []) {
          const src = toFsPath(photo.path || photo.webPath)
          const read = await Filesystem.readFile({ path: src })
          const ext = '.' + (photo.format || 'jpeg').toLowerCase()
          out.push({
            name: `${uid()}${ext}`,
            mime: MIME[ext] || 'image/jpeg',
            base64: read.data
          })
        }
        return ok(out)
      } catch (err) {
        // Kullanıcı seçimi iptal etti.
        if (err && /cancel/i.test(String(err.message))) return ok([])
        return fail(err)
      }
    },

    async saveJson(text, suggestedName) {
      try {
        const name = suggestedName || `guvercin-${new Date().toISOString().slice(0, 10)}.json`
        await Filesystem.writeFile({
          path: name,
          data: text,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })
        try {
          const uriRes = await Filesystem.getUri({ path: name, directory: Directory.Documents })
          await Share.share({ title: 'Güvercin yedeği', url: uriRes.uri, dialogTitle: 'Yedeği paylaş' })
        } catch {
          // Paylaşım iptal edilirse veya desteklenmezse dosya yine de yazılmıştır
        }
        return ok(name)
      } catch (err) { return fail(err) }
    },

    async pickJson() {
      try {
        const picked = await FilePicker.pickFiles({
          types: ['application/json', 'text/json', '*/*'],
          readData: true
        })
        const file = picked.files && picked.files[0]
        if (!file) return ok(null)
        if (file.data) {
          try {
            const bin = atob(file.data)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            return ok(new TextDecoder('utf-8').decode(bytes))
          } catch {
            const decoded = decodeURIComponent(escape(atob(file.data)))
            return ok(decoded)
          }
        }
        const res = await Filesystem.readFile({ path: toFsPath(file.path), encoding: Encoding.UTF8 })
        return ok(res.data)
      } catch (err) {
        if (err && /cancel/i.test(String(err.message))) return ok(null)
        return fail(err)
      }
    },

    async openPath() {
      return ok(false)
    },

    /**
     * Bağlantıyı uygulama dışında açar.
     * APK indirme gibi WebView'in kaldıramayacağı indirmeler için gereklidir.
     */
    async openExternal(url) {
      try {
        await Browser.open({ url: String(url) })
        return ok(true)
      } catch (err) { return fail(err) }
    },

    async userDataPath() {
      try {
        const res = await Filesystem.getUri({ path: '', directory: Directory.Data })
        return ok(res.uri)
      } catch (err) { return fail(err) }
    }
  }
}