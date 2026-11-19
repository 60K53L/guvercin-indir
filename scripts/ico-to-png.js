/**
 * ICO dosyasını okur, PNG'lere çevirir.
 *
 * Android bir .ico kabul etmez; mipmap klasörlerine ayrı boyutlarda
 * PNG gerekir. Burada kaynak .ico içindeki en büyük görseli çözüp
 * yeniden boyutlandırarak yazar.
 *
 * ICO'da PNG sıkıştırması varsa doğrudan kopyalanır (en temiz yol).
 * Sıkıştırılmamışsa BMP başlığı elle çözülür.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = process.argv[2] || path.join(ROOT, 'guvercin_ikon.ico')

const buf = fs.readFileSync(SRC)
if (buf[0] !== 0 || buf[1] !== 0) throw new Error('ICO değil')
const count = buf.readUInt16LE(4)

const entries = []
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16
  entries.push({
    w: buf[o] === 0 ? 256 : buf[o],
    h: buf[o + 1] === 0 ? 256 : buf[o + 1],
    size: buf.readUInt32LE(o + 8),
    offset: buf.readUInt32LE(o + 12)
  })
}
entries.sort((a, b) => b.w - a.w)
const best = entries[0]
console.log(`ICO'daki boyutlar: ${entries.map(e => e.w + 'x' + e.h).join(', ')}`)
console.log(`En büyük: ${best.w}x${best.h}, ${best.size} bayt`)

const img = buf.subarray(best.offset, best.offset + best.size)

// PNG imzasıyla mı?
const isPng =
  img[0] === 0x89 && img[1] === 0x50 && img[2] === 0x4e && img[3] === 0x47

let png
if (isPng) {
  png = Buffer.from(img)
  console.log('Kaynak PNG olarak saklanmış — doğrudan kopyalanıyor.')
} else {
  // ICO içindeki BMP: 40 baytlık BITMAPINFOHEADER ile
  // ardından çift yönlü satır verisi (alt satırdan yukarı).
  const headerSize = img.readUInt32LE(0)
  const width = img.readInt32LE(4)
  const height = img.readInt32LE(8) * 2   // maske dahil iki katı yazılır
  const bpp = img.readUInt16LE(14)
  const dataOffset = headerSize + (bpp === 32 ? (width * 4 * (height / 2)) / (width * 4) * 0 : 0)
  // Gerçek piksel verisi başlangıcı
  const pixelsAt = headerSize
  const rowBytes = width * 4
  const halfHeight = height / 2

  console.log(`BMP: ${width}x${halfHeight}, ${bpp}bpp, header ${headerSize}`)

  // BMP BGRA -> RGBA, alttan üste -> üstten alta
  const out = Buffer.alloc(width * halfHeight * 4)
  for (let y = 0; y < halfHeight; y++) {
    const srcRow = (halfHeight - 1 - y) * rowBytes
    const dstRow = y * width * 4
    for (let x = 0; x < width; x++) {
      const s = pixelsAt + srcRow + x * 4
      const d = dstRow + x * 4
      out[d] = img[s + 2]       // R
      out[d + 1] = img[s + 1]   // G
      out[d + 2] = img[s]       // B
      out[d + 3] = img[s + 3]   // A
    }
  }

  // Ham RGBA -> PNG (sıkıştırma yok ama geçerli; sonra yeniden boyutlanacak)
  png = encodePng(out, width, halfHeight)
  console.log('BMP çözüldü, PNG üretildi.')
}

fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true })
const preview = path.join(ROOT, 'build', 'icon-kaynak.png')
fs.writeFileSync(preview, png)
console.log('\nKaynak PNG:', preview, `(${(png.length / 1024).toFixed(1)} KB)`)

/** Ham RGBA verisini PNG'ye çevirir (zlib sıkıştırmalı, geçerli). */
function encodePng(rgba, w, h) {
  const zlib = require('zlib')
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filtre: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8    // bit derinliği
  ihdr[9] = 6    // renk tipi: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td) >>> 0, 0)
  return Buffer.concat([len, td, crc])
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return c ^ -1
}