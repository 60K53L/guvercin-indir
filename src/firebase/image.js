/**
 * Fotoğraf sıkıştırma.
 *
 * Firestore'da belge sınırı 1 MB. Ham telefon fotoğrafları 3-5 MB
 * olduğu için doğrudan yazılamaz. Burada küçültüp JPEG olarak
 * sıkıştırıyoruz; kuş fotoğraflarında gözle fark edilmez.
 *
 * Hedef: en fazla 1600 px kenar, 280 KB altı.
 */

const MAX_EDGE = 1600
const TARGET_BYTES = 280 * 1024
// Base64 veri 4/3 oranında büyür; belge sınırının altında kalmalı.
const HARD_LIMIT = 700 * 1024

const QUALITY_STEPS = [0.78, 0.62, 0.48, 0.35]

function base64ToDataUrl(base64, mime) {
  return `data:${mime || 'image/jpeg'};base64,${base64}`
}

function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(',')
  return dataUrl.slice(comma + 1)
}

/** Yaklaşık bayt sayısı (base64 uzunluğundan). */
function byteSize(base64) {
  const clean = base64.replace(/=+$/, '')
  return Math.floor((clean.length * 3) / 4)
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Görsel açılamadı'))
    img.src = dataUrl
  })
}

function drawScaled(img, maxEdge) {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  // Fotoğraflarda saydamlık gereksiz; JPEG varsayılan beyaz zemin kullanır.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tw, th)
  ctx.drawImage(img, 0, 0, tw, th)
  return { canvas, tw, th }
}

/**
 * base64 hâlindeki görseli sıkıştırır.
 * @returns {{base64, mime, width, height, bytes, originalBytes, compressed: boolean}}
 */
export async function compressImage(base64, mime) {
  const originalBytes = byteSize(base64)

  // Zaten küçükse dokunma — yeniden kodlamak kaliteyi bozar.
  if (originalBytes <= TARGET_BYTES) {
    return {
      base64,
      mime: mime || 'image/jpeg',
      width: null,
      height: null,
      bytes: originalBytes,
      originalBytes,
      compressed: false
    }
  }

  let img
  try {
    img = await loadImage(base64ToDataUrl(base64, mime))
  } catch {
    // Görsel çözülemedi (bozuk dosya vb.) — olduğu gibi göndermeyi dene.
    return {
      base64, mime: mime || 'image/jpeg', width: null, height: null,
      bytes: originalBytes, originalBytes, compressed: false
    }
  }

  const { canvas, tw, th } = drawScaled(img, MAX_EDGE)

  let out = ''
  let outBytes = 0
  for (const q of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL('image/jpeg', q)
    out = dataUrlToBase64(dataUrl)
    outBytes = byteSize(out)
    if (outBytes <= TARGET_BYTES) break
  }

  // Hâlâ büyükse bir kez daha küçült.
  if (outBytes > HARD_LIMIT) {
    const small = drawScaled(img, 1100)
    out = dataUrlToBase64(small.canvas.toDataURL('image/jpeg', 0.45))
    outBytes = byteSize(out)
  }

  return {
    base64: out,
    mime: 'image/jpeg',
    width: tw,
    height: th,
    bytes: outBytes,
    originalBytes,
    compressed: true
  }
}