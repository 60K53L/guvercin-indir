/**
 * Servis çalışanı — uygulama KABUĞUNU çevrimdışı kullanılabilir tutar.
 *
 * Veri tarafı zaten Firestore'un IndexedDB önbelleğinde; burada yalnızca
 * HTML/JS/CSS önbelleğe alınır. Firestore ve Firebase isteklerine
 * DOKUNULMAZ (aksi halde yazma kuyruğu bozulur).
 *
 * Strateji:
 *   - gezinme (navigate)  → önce ağ, düşerse önbellek (yeni sürüm gelsin)
 *   - kendi varlıklarımız → önce önbellek, yoksa ağ (hızlı açılış)
 *   - Firebase/harici     → hiç müdahale edilmez, doğrudan ağa gider
 */
const VERSION = 'guvercin-v1'
const SHELL = `${VERSION}-shell`
const RUNTIME = `${VERSION}-assets`

// Uygulama kabuğu: bunlar ilk yüklemeden sonra hep önbellekte bulunmalı.
const PRECACHE = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

/** Firebase gibi harici kaynaklar — önbelleklenmez, araya girilmez. */
function isExternal(url) {
  return url.origin !== self.location.origin
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (isExternal(url)) return
  // Firebase SDK'sı ve resimler kendi yolunu bırakılsın.
  if (url.pathname.startsWith('/__/')) return

  // Sayfa gezinmesi: ağ önce, çevrimdışıysa önbellekten göster.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(SHELL).then(c => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    )
    return
  }

  // Kendi statik varlıklarımız: önbellek önce.
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(RUNTIME).then(c => c.put(req, copy))
        }
        return res
      })
    })
  )
})