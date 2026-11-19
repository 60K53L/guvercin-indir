/**
 * Tema yönetimi.
 *
 * Temalar src/themes/*.css dosyalarıdır. Vite `?raw` ile metin olarak
 * içe alır; her tema için bir <style> etiketi oluşturulur ve yalnızca
 * SEÇİLİ olan etiket etkin (disabled = false) bırakılır.
 *
 * Böylece tema değişimi anında olur: yeniden derleme/yeniden yükleme yok,
 * uygulama yeniden başlamaz. Seçim `settings.theme` içinde saklanır ve
 * bulutta olduğu için diğer cihazlara da yansır.
 *
 * NOT: Tema dosyaları düz `:root { ... }` bloklarıdır; seçici yeniden
 * yazılmaz. Etkin olan dışındakiler `disabled` ile devre dışı bırakıldığı
 * için birbirine karışmazlar.
 */
import guncelCss from './themes/guncel.css?raw'
import zumrutCss from './themes/zumrut.css?raw'
import aydinlikCss from './themes/aydinlik.css?raw'
import kizilCss from './themes/kizil.css?raw'
import gokyuzuCss from './themes/gokyuzu.css?raw'
import dumanliCss from './themes/dumanli.css?raw'
import sarayCss from './themes/saray.css?raw'
import baked from './default-theme.js'
import { normalizeThemeId } from './theme-ids.js'

/** APK'nın açılış teması (scripts/build-themes.js yazar). */
export const DEFAULT_THEME = normalizeThemeId(baked)

export const THEMES = [
  // "Güncel" değil, renkten adı: koyu lacivert zemin. Diğerleri de tek
  // kelime ve renk adı (Zümrüt yeşil, Kızıl kırmızı, Gökyüzü mavi).
  { id: 'guncel', ad: 'Lacivert', aciklama: 'Koyu mavi, altın', css: guncelCss },
  { id: 'dumanli', ad: 'Dumanlı', aciklama: 'Antrasit, safir mavi', css: dumanliCss },
  { id: 'saray', ad: 'Saray', aciklama: 'Sıcak ceviz, kehribar', css: sarayCss },
  { id: 'zumrut', ad: 'Zümrüt', aciklama: 'Koyu yeşil, turkuaz', css: zumrutCss },
  { id: 'aydinlik', ad: 'Aydınlık', aciklama: 'Açık zemin, kahve', css: aydinlikCss },
  { id: 'kizil', ad: 'Kızıl', aciklama: 'Bordo, amber', css: kizilCss },
  { id: 'gokyuzu', ad: 'Gökyüzü', aciklama: 'Derin mavi, camgöbeği', css: gokyuzuCss }
]

/** Tanınmayan bir değer gelirse varsayılan temaya düşer. */
export function normalizeTheme(id) {
  return normalizeThemeId(id)
}

/** Uygulama açılışında bir kez çağrılır: <style> etiketlerini kurar. */
export function installThemes() {
  if (typeof document === 'undefined') return
  for (const t of THEMES) {
    if (document.getElementById(`tema-${t.id}`)) continue
    const el = document.createElement('style')
    el.id = `tema-${t.id}`
    el.setAttribute('data-tema', t.id)
    el.textContent = t.css
    el.disabled = true
    document.head.appendChild(el)
  }
  applyTheme(readStoredTheme())
}

/**
 * Seçili temayı etkinleştirir. Aynı tema tekrar verilirse hiçbir şey
 * yapmaz (gereksiz stil yeniden yazımı olmaz).
 */
export function applyTheme(id) {
  if (typeof document === 'undefined') return
  const wanted = normalizeTheme(id)
  let changed = false
  for (const t of THEMES) {
    const el = document.getElementById(`tema-${t.id}`)
    if (!el) continue
    const on = t.id === wanted
    if (el.disabled === on) {
      el.disabled = !on
      changed = true
    }
  }
  if (changed) {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', themeColor(wanted))
  }
}

/** Tema seçimi sayfa yenilendiğinde de korunsun. */
function readStoredTheme() {
  try {
    const raw = localStorage.getItem('guvercin-tema')
    if (!raw) return DEFAULT_THEME
    // 'guncel' (Lacivert) geçerli bir tema kimliğidir; eskiden buradaki
    // özel durum kullanıcı "Lacivert"i seçince seçimini sıfırlayıp
    // yedeğe (Dumanlı) düşürüyordu.
    return normalizeTheme(raw)
  } catch {
    return DEFAULT_THEME
  }
}

/** Kaydedilmeden önce anında önizlemek için. */
export function previewTheme(id) {
  applyTheme(id)
  try {
    localStorage.setItem('guvercin-tema', normalizeTheme(id))
  } catch { /* özel modda yazamayabilir, sorun değil */ }
}

function themeColor(id) {
  const map = {
    guncel: '#14161c',
    dumanli: '#0f1217',
    saray: '#14100c',
    zumrut: '#0e1512',
    aydinlik: '#f2efe7',
    kizil: '#180f10',
    gokyuzu: '#0d1220'
  }
  return map[id] || map[DEFAULT_THEME]
}