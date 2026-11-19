import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * WEB sürümü (PWA) için ayrı yapılandırma.
 *
 * APK/Electron `vite.config.js` ile `app/` klasörüne üretilir; burada
 * çıktı `web/` altına gider ve base '/' olur (sunucu kökünden sunulur).
 *
 * VITE_WEB=1 bayrağı src/platform.js ve src/main.jsx tarafından okunur:
 * web'de tarayıcı platformu ve servis çalışanı devreye girer.
 *
 * Kullanım:  npm run web:build
 */
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'web',
    emptyOutDir: true
  },
  define: {
    'import.meta.env.VITE_WEB': JSON.stringify('1')
  }
})