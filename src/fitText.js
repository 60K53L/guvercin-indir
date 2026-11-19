/**
 * Metni bir kutuya otomatik sığdıran punto hesabı.
 *
 * Sabit karakter sayısı tahminleri ("20 karakterden uzunsa 9px") yanlış
 * sonuç veriyor: "SÜTLÜ KAHVERENGİ KLİPS-GC" 25 karakter olmasına rağmen
 * 12px'te sığarken "BEYAZ KLİPS-GC BABAÇ, ERKEK" 24 karakterde taşıyor.
 * Gerçek ölçüm (canvas measureText) ile yalnızca gerektiğinde küçültme
 * yapılır; kısa adlar tam boy kalır.
 *
 * Tarayıcı dışında (test/SSR) canvas yoksa karakter sayısına dayalı
 * yaklaşık bir yedek hesap kullanılır.
 */

let ctx = null
let ctxReady = false

function measureCtx() {
  if (ctxReady) return ctx
  ctxReady = true
  try {
    if (typeof document === 'undefined') return null
    ctx = document.createElement('canvas').getContext('2d')
  } catch {
    ctx = null
  }
  return ctx
}

/** Sabit aralıkta (0.5px adımlı) sığan en büyük punto. */
export function fitFontSize(text, maxWidth, options = {}) {
  const {
    font = '700 12px "Segoe UI", system-ui, -apple-system, sans-serif',
    max = 12,
    min = 9,
    fallbackPerChar = 7
  } = options

  const value = String(text || '')
  if (!value || !maxWidth) return max

  const c = measureCtx()
  if (!c) {
    // Canvas yoksa yaklaşık: büyük puntoda kaç karakter sığar?
    const perChar = fallbackPerChar * (max / 12)
    const fits = Math.max(1, Math.floor(maxWidth / perChar))
    if (value.length <= fits) return max
    const ratio = fits / value.length
    return Math.max(min, Math.floor(max * ratio * 2) / 2)
  }

  const baseFont = font.replace(/\d+(\.\d+)?px/, `${max}px`)
  c.font = baseFont
  const full = c.measureText(value).width
  if (!full || full <= maxWidth) return max

  // Sığmayan durumda orantılı küçült, 0.5px adımıyla yuvarla.
  const scaled = max * (maxWidth / full)
  const stepped = Math.floor(scaled * 2) / 2
  return Math.max(min, Math.min(max, stepped))
}

/**
 * Bir metnin gerçek piksel genişliği (canvas ölçümü).
 *
 * Sütun genişlikleri içerikten türetilirken kullanılır: her sütun kendi
 * en geniş içeriğine göre ölçülür, araya TEK tip bir boşluk konur.
 */
export function measureTextWidth(text, options = {}) {
  const {
    font = '400 14px "Segoe UI", system-ui, -apple-system, sans-serif',
    fallbackPerChar = 7.5
  } = options

  const value = String(text || '')
  if (!value) return 0

  const c = measureCtx()
  if (!c) return value.length * fallbackPerChar

  c.font = font
  return c.measureText(value).width
}

/** Sütunlar arasında kullanılacak ortak boşluk (px). */
export const COLUMN_GAP = 18

