import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import setupPlatform from './platform.js'
import { installThemes } from './themes.js'
import './styles.css'

// Tema <style> etiketleri styles.css'ten SONRA eklenir; böylece :root
// değişkenlerini ezerler. Tema artık çalışma anında seçilebilir.
installThemes()

// Web sürümünde uygulama kabuğu çevrimdışı da açılabilsin diye servis
// çalışanı kaydedilir. Android/Electron'da kayıt yapılmaz.
if (import.meta.env.VITE_WEB === '1' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Servis çalışanı kaydedilemedi:', err)
    })
  })
}

// api hazır olmadan render etme: App açılışta oturum durumu soruyor.
// Firebase SDK'sı büyük (~250 KB); ilk açılışta gerektiği kadar yüklenir.
setupPlatform().then(async () => {
  const { createApi } = await import('./api.js')
  window.api = createApi(window.host)
  createRoot(document.getElementById('root')).render(<App />)
})