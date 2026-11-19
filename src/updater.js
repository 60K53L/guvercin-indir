import { Capacitor } from '@capacitor/core'
import { APP_VERSION, BUILD_TIME } from './version.js'

const VERSION_CHECK_URL = 'https://guvercin-beta-dev.web.app/version.json'
const DISMISS_KEY = 'guvercin:dismissed_update_build'
const APPLY_KEY = 'guvercin:applied_update_build'

function storedValue(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

export function rememberDismissedUpdate(buildTime) {
  try {
    localStorage.setItem(DISMISS_KEY, String(buildTime || ''))
  } catch {}
}

export function rememberAppliedUpdate(buildTime) {
  try {
    localStorage.setItem(APPLY_KEY, String(buildTime || ''))
  } catch {}
}

/** Basit semver karşılaştırması: '1.2.3' > '1.2.2' ise pozitif döner. */
function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0
    const db = pb[i] || 0
    if (da !== db) return da - db
  }
  return 0
}
/**
 * Uygulama her açıldığında Capgo'ya hazır olduğunu bildirir.
 * Eğer yeni bir OTA paketi yüklendiyse ve bu çağrı yapılmazsa,
 * Capgo çökme olduğunu varsayıp eski sürüme geri döner (rollback).
 */
export async function notifyAppReady() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.notifyAppReady()
  } catch (err) {
    console.warn('CapacitorUpdater notifyAppReady hatası:', err)
  }
}

/**
 * Şu anki aktif sürüm ve derleme bilgisini döndürür.
 */
export async function getCurrentVersionInfo() {
  if (!Capacitor.isNativePlatform()) {
    return {
      version: APP_VERSION,
      buildTime: BUILD_TIME,
      isNative: false,
      bundleId: 'web'
    }
  }

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const current = await CapacitorUpdater.current()
    // Not: current.bundle.version artık OTA damgasıdır (Capgo paket kimliği).
    // Uygulamanın KENDİ sürümü APP_VERSION/BUILD_TIME'dır; karşılaştırma
    // version.json ile BUILD_TIME üzerinden yapılır. İkisini karıştırmak
    // "her açılışta güncelleme var" hatasına yol açıyordu.
    return {
      version: APP_VERSION,
      buildTime: BUILD_TIME,
      isNative: true,
      bundleId: current?.bundle?.id || 'builtin',
      bundleVersion: current?.bundle?.version || '',
      nativeVersion: current?.native || APP_VERSION
    }
  } catch {
    return {
      version: APP_VERSION,
      buildTime: BUILD_TIME,
      isNative: true,
      bundleId: 'builtin'
    }
  }
}

/**
 * Firebase Hosting üzerindeki version.json dosyasını kontrol eder.
 * @returns {Promise<{ hasUpdate: boolean, update?: object, error?: string }>}
 */
export async function checkForUpdate() {
  if (!Capacitor.isNativePlatform()) {
    return { hasUpdate: false, reason: 'not_native' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(`${VERSION_CHECK_URL}?_t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { hasUpdate: false, error: `Sunucu hatası: ${res.status}` }
    }

    const remote = await res.json()
    if (!remote || !remote.version || !remote.bundleUrl) {
      return { hasUpdate: false, error: 'Geçersiz sürüm bilgisi' }
    }

    // Aynı OTA bildiriminin her açılışta tekrar gelmesini engelle.
    // Kullanıcı kapatırsa ya da uyguladıysa bu buildTime hatırlanır.
    const already = storedValue(DISMISS_KEY) || storedValue(APPLY_KEY)
    if (already && String(already) === String(remote.buildTime)) {
      return { hasUpdate: false, reason: 'dismissed', currentVersion: remote.version }
    }

    // Aktif çalışan sürüm bilgisi
    const currentInfo = await getCurrentVersionInfo()

    // Karşılaştırma: uzak sürüm/bu deme YALNIZCA daha YENİ olduğunda güncelleme
    // teklif edilir. Eşit ya da düşük uzak bilgi → güncelleme YOK.
    //
    // ÖNEMLİ: eski yazım "farklı" (!==) üzerinden idi. Bu kural yüzünden
    // cihazın kurulu sürümü uzaktan BÜYÜK olduğunda (ör: dev sırasında 1.0.19
    // çalışırken sunucu 1.0.18'de) bile "güncelleme var" sanılıyor, paket inip
    // yeniden yüklendikten sonra bir kez daha aynı ekran geliyor ve döngü
    // oluşuyordu. Ayrıca dev modda (HMR) set() etkin sonuç vermediğinden
    // sürüm hiç değişmiyor; inequality temelli kontrol de çalınca tekrar
    // aynı prompt'a düşüyordu.
    const isNewBuild =
      !!remote.buildTime &&
      !!currentInfo.buildTime &&
      String(remote.buildTime) > String(currentInfo.buildTime)
    const isNewVersion = compareVersions(remote.version, currentInfo.version) > 0

    if (isNewBuild || isNewVersion) {
      return {
        hasUpdate: true,
        update: {
          version: remote.version,
          buildTime: remote.buildTime || '',
          bundleUrl: remote.bundleUrl,
          checksum: remote.checksum || '',
          changelog: Array.isArray(remote.changelog) ? remote.changelog : []
        }
      }
    }

    return { hasUpdate: false, currentVersion: currentInfo.version }
  } catch (err) {
    clearTimeout(timeoutId)
    return { hasUpdate: false, error: err.name === 'AbortError' ? 'Zaman aşımı' : err.message }
  }
}

/**
 * Yeni güncellemeyi indirir ve uygular.
 * Uygulama otomatik olarak yeni kodla baştan başlayacaktır.
 *
 * @param {object} updateInfo checkForUpdate'ten dönen update nesnesi
 * @param {function} onProgress (percent: number) => void
 */
export async function applyUpdate(updateInfo, onProgress) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Canlı güncelleme yalnızca mobilde desteklenir.')
  }

  const { CapacitorUpdater } = await import('@capgo/capacitor-updater')

  let downloadListener = null
  try {
    if (typeof onProgress === 'function') {
      downloadListener = await CapacitorUpdater.addListener('download', info => {
        if (info && typeof info.percent === 'number') {
          onProgress(info.percent)
        }
      })
    }

    // Paketi cihaza indir (Capgo checksum gerektirir).
    // SÜRÜM olarak buildTime damgasını kullan: uygulama sürümü her OTA'da
    // "1.0.0" kaldığı için Capgo yeni paketi "zaten var" sanıp atlayabiliyordu.
    const downloadOpts = {
      url: updateInfo.bundleUrl,
      version: updateInfo.buildTime || updateInfo.version
    }
    if (updateInfo.checksum) {
      downloadOpts.checksum = updateInfo.checksum
    }

    const bundle = await CapacitorUpdater.download(downloadOpts)

    if (!bundle) {
      throw new Error('Güncelleme paketi indirilemedi.')
    }

    if (downloadListener) {
      await downloadListener.remove()
      downloadListener = null
    }

    // Yeni paketi aktif yap ve uygulamayı yenile
    await CapacitorUpdater.set(bundle)
    return true
  } catch (err) {
    if (downloadListener) {
      try { await downloadListener.remove() } catch {}
    }
    throw err
  }
}
