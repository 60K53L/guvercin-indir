/**
 * Uygulama ikonlarını üretir.
 *
 * Kaynak: guvercin_ikon.ico içindeki 256x256 PNG (scripts/ico-to-png.js
 * ile çözülür). Buradan:
 *   - Android mipmap-* klasörleri (kare ikon + yuvarlak ölçüt varyantları)
 *   - PWA / favicon
 *   - Electron için build/icon.ico (kaynak dosyanın kendisi)
 *
 * Yeniden boyutlama, tarayıcısız ortamda çalışan saf birbox/ bicubic
 * örnekleyici ile yapılır; ek paket gerekmez.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')
const SRC_PNG = path.join(ROOT, 'build', 'icon-kaynak.png')
const SRC_ICO = path.join(ROOT, 'guvercin_ikon.ico')

// ---------------------------------------------------------------- PNG okuma
function readPng(file) {
  const buf = fs.readFileSync(file)
  let off = 8
  let w = 0, h = 0, bitDepth = 8, colorType = 6
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    off += 12 + len
  }
  if (bitDepth !== 8) throw new Error('sadece 8-bit PNG destekleniyor')

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = w * bpp
  const out = Buffer.alloc(w * h * 4)

  let prev = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride))
    // PNG filtrelerini geri al
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      line[x] = v & 0xff
    }
    for (let x = 0; x < w; x++) {
      const s = x * bpp
      const d = (y * w + x) * 4
      if (channels === 4) {
        out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3]
      } else if (channels === 3) {
        out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255
      } else if (channels === 1) {
        out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = 255
      }
    }
    prev = line
  }
  return { w, h, data: out }
}

// ------------------------------------------------------------ yeniden boyut
/** Yüksek kaliteli box downsample (ortalama alma). */
function resize(img, nw, nh) {
  const n = Buffer.alloc(nw * nh * 4)
  const sx = img.w / nw
  const sy = img.h / nh
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.min(img.h, Math.ceil((y + 1) * sy)))
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.min(img.w, Math.ceil((x + 1) * sx)))
      let r = 0, g = 0, b = 0, a = 0, c = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.w + xx) * 4
          const al = img.data[i + 3] / 255
          r += img.data[i] * al
          g += img.data[i + 1] * al
          b += img.data[i + 2] * al
          a += img.data[i + 3]
          c++
        }
      }
      const d = (y * nw + x) * 4
      const avgA = c ? a / c : 0
      if (c && avgA > 0) {
        n[d] = Math.round(r / (a / 255) || 0)
        n[d + 1] = Math.round(g / (a / 255) || 0)
        n[d + 2] = Math.round(b / (a / 255) || 0)
      }
      n[d + 3] = Math.round(avgA)
    }
  }
  return { w: nw, h: nh, data: n }
}

/** Yuvarlak maske uygular (Android adaptive icon ön planı için). */
function roundMask(img) {
  const n = Buffer.from(img.data)
  const cx = img.w / 2, cy = img.h / 2
  const rOut = img.w * 0.5
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      // Düz kenar ile yuvarlak arasında yumuşak geçiş
      const t = Math.max(0, Math.min(1, (rOut - d) / 1.5))
      const i = (y * img.w + x) * 4 + 3
      n[i] = Math.round(img.data[i] * t)
    }
  }
  return { w: img.w, h: img.h, data: n }
}

// -------------------------------------------------------------- PNG yazma
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

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td) >>> 0, 0)
  return Buffer.concat([len, td, crc])
}

function writePng(img, file) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h)
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0
    img.data.copy(raw, y * (img.w * 4 + 1) + 1, y * img.w * 4, (y + 1) * img.w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.w, 0)
  ihdr.writeUInt32BE(img.h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, png)
  return png.length
}

// ------------------------------------------------------------------ üretim
// Bu modül scripts/make-web-icons.js tarafından da kullanılıyor (PWA ikonları).
// Yalnızca doğrudan çalıştırılınca üretim yapar.
module.exports = { readPng, resize, writePng, roundMask, SRC_PNG, ROOT }

if (require.main !== module) return

const src = readPng(SRC_PNG)
console.log(`Kaynak: ${src.w}x${src.h}\n`)

// Android launcher ikonları (kare, yuvarlatılmış köşe zaten PNG'de)
const MDPI = [48, 72, 96, 144, 192]
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }

const resDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
let count = 0
for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = path.join(resDir, `mipmap-${density}`)
  // Kare ikon (yuvarlak köşeli, kaynaktaki gibi)
  writePng(resize(src, size, size), path.join(dir, 'ic_launcher.png'))
  // Ön plan (adaptive icon) — TAM KAPAK bırakılır.
  // Kaynak ikon zaten yuvarlatılmış köşeli; ayrıca daire maskesi
  // uygulamak çift şekillendirme yapıp kenarda halka bırakıyor.
  // Şekli sistem maskesi belirler.
  writePng(resize(src, Math.round(size * 108 / 48), Math.round(size * 108 / 48)),
    path.join(dir, 'ic_launcher_foreground.png'))
  // Tam yuvarlak (Play Store / bildirim)
  writePng(roundMask(resize(src, Math.round(size * 0.5), Math.round(size * 0.5))),
    path.join(dir, 'ic_launcher_round.png'))
  console.log(`  mipmap-${density.padEnd(7)} ${String(size).padStart(3)}px  → ic_launcher, _foreground, _round`)
  count += 3
}

// Adaptive icon arka planı (düz renk — logo bunun üstüne oturur)
for (const density of Object.keys(DENSITIES)) {
  const size = Math.round(DENSITIES[density] * 108 / 48)
  const solid = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    solid[i * 4] = 0x1f; solid[i * 4 + 1] = 0x86; solid[i * 4 + 2] = 0xd6; solid[i * 4 + 3] = 0xff
  }
  writePng({ w: size, h: size, data: solid },
    path.join(resDir, `mipmap-${density}`, 'ic_launcher_background.png'))
}

// Web / uygulama içi favicon
const pubDir = path.join(ROOT, 'app')
writePng(resize(src, 192, 192), path.join(pubDir, 'icon.png'))
writePng(resize(src, 512, 512), path.join(pubDir, 'icon-512.png'))

// Electron için kaynak .ico'yu kullan
if (fs.existsSync(SRC_ICO)) {
  fs.copyFileSync(SRC_ICO, path.join(ROOT, 'build', 'icon.ico'))
  console.log('\n  build/icon.ico  ← kaynak .ico kopyalandı')
}

console.log(`\n${count + 5 + 2} dosya yazıldı.`)