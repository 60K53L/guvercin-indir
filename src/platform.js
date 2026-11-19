/**
 * Hangi platformda çalıştığımızı belirler ve `window.host` yüzeyini kurar.
 *
 *   Electron  → preload zaten window.host'u enjekte etti, bizim işimiz yok
 *   Tarayıcı  → platform/web.js (derleme bayrağı VITE_WEB ile)
 *   Android   → platform/capacitor.js
 *
 * DİKKAT: Web tarafı DERLEME BAYRAĞIYLA ayrılır, çalışma anında
 * tahminle değil. window.Capacitor kontrolü Android'de bazen geç
 * yüklenebiliyor ve yanlışlıkla web sürümü çalışırsa kamera/fotoğraf
 * sessizce bozulurdu. Bayrak belirsizliği tamamen ortadan kaldırır.
 */
export default async function setupPlatform() {
  if (typeof window === 'undefined') return
  if (window.host) return // Electron preload

  if (import.meta.env.VITE_WEB === '1') {
    const { createWebHost } = await import('./platform/web.js')
    window.host = createWebHost()
    window.__guvercinPlatform = 'web'
    return
  }

  const { createCapacitorHost } = await import('./platform/capacitor.js')
  window.host = createCapacitorHost()
  window.__guvercinPlatform = 'capacitor'
}