/**
 * Tarayıcı için işletim sistemine özgü işler.
 *
 * Dönen yüzey `window.host` ile Electron ve Capacitor ile AYNI'dir:
 *   pickPhotos, saveJson, pickJson, openPath, openExternal, userDataPath
 * Böylece React bileşenleri platformun ne olduğunu bilmez.
 *
 * Farklar tarayıcıda:
 *   fotoğraf  → <input type="file" accept="image/*"> (telefonda kamera açar)
 *   JSON kaydet → <a download> ile indirme
 *   JSON al   → <input type="file" accept=".json">
 */

/** Dosya adından uzantı; yoksa verilen varsayılan. */
function extOf(name, fallback) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''))
  return m ? '.' + m[1].toLowerCase() : fallback
}

const ok = data => ({ ok: true, data })
const fail = error => ({ ok: false, error: String((error && error.message) || error) })

/** Gizli bir dosya seçici açar ve kullanıcı seçene kadar bekler. */
function pickFile({ accept, capture } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    if (capture) input.capture = capture
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    // 'cancel' olayı yeni tarayıcılarda var; eski yollarda değişim olmaz.
    let settled = false
    const done = v => {
      if (settled) return
      settled = true
      input.remove()
      resolve(v)
    }

    input.addEventListener('change', () => {
      const files = Array.from(input.files || [])
      done(files.length ? files : null)
    })
    input.addEventListener('cancel', () => done(null))

    input.click()
  })
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const s = String(fr.result || '')
      resolve(s.slice(s.indexOf(',') + 1))
    }
    fr.onerror = () => reject(fr.error || new Error('Dosya okunamadı'))
    fr.readAsDataURL(file)
  })
}

export function createWebHost() {
  return {
    async pickPhotos(source) {
      try {
        const capture = source === 'camera' ? 'environment' : undefined
        const files = await pickFile({ accept: 'image/*', capture })
        if (!files) return ok([])
        const out = []
        for (const f of files) {
          const mime = f.type || 'image/jpeg'
          out.push({
            name: `${crypto.randomUUID()}${extOf(f.name, '.jpg')}`,
            mime,
            base64: await readAsBase64(f)
          })
        }
        return ok(out)
      } catch (err) {
        return fail(err)
      }
    },

    async saveJson(text, suggestedName) {
      try {
        const name = suggestedName || `guvercin-${new Date().toISOString().slice(0, 10)}.json`
        const blob = new Blob([text], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
        // Tarayıcı indirmeyi başlatsın diye kısa süre sonra serbest bırak.
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        return ok(name)
      } catch (err) { return fail(err) }
    },

    async pickJson() {
      try {
        const files = await pickFile({ accept: 'application/json,.json' })
        if (!files) return ok(null)
        return ok(await files[0].text())
      } catch (err) {
        return fail(err)
      }
    },

    async openPath() {
      // Tarayıcıda dosya sistemi yolu yok; ayrıca hiçbir bileşen de
      // kullanmıyor (Android sürümü de hep false döner).
      return ok(false)
    },

    /** Bağlantıyı yeni sekmede açar (indirme bağlantıları dahil). */
    async openExternal(url) {
      try {
        window.open(String(url), '_blank', 'noopener')
        return ok(true)
      } catch (err) { return fail(err) }
    },

    async userDataPath() {
      return ok('tarayıcı belleği')
    }
  }
}