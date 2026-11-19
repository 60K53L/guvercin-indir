const fs = require('fs')
const path = require('path')

const S = 256
const buf = Buffer.alloc(S * S * 4)

function px(x, y, r, g, b, a = 255) {
  const i = (y * S + x) * 4
  buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = a
}

const cx = S / 2, cy = S / 2

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)

    // yuvarlak koyu zemin
    if (d > S * 0.48) { px(x, y, 0, 0, 0, 0); continue }

    // altın bilezik halkası
    const r0 = S * 0.36, r1 = S * 0.44
    if (d >= r0 && d <= r1) { px(x, y, 0xc9, 0xa2, 0x27); continue }

    // gövde
    const bodyTop = cy - S * 0.10
    if (y > bodyTop && y < cy + S * 0.30) {
      const halfW = S * 0.17 * Math.sin(Math.PI * ((y - bodyTop) / (S * 0.40)))
      if (Math.abs(dx) <= halfW) { px(x, y, 0xd8, 0xdc, 0xe4); continue }
    }

    // kafa
    const hx = cx - S * 0.02, hy = bodyTop - S * 0.06
    const hd = Math.sqrt((x - hx) ** 2 + (y - hy) ** 2)
    if (hd < S * 0.105) { px(x, y, 0xd8, 0xdc, 0xe4); continue }

    // göz
    if (hd < S * 0.024 && x > hx) { px(x, y, 0x14, 0x16, 0x1c); continue }

    // gaga
    if (x < hx - S * 0.04 && Math.abs(y - hy) < S * 0.018 && x > hx - S * 0.12) {
      px(x, y, 0xc9, 0xa2, 0x27); continue
    }

    px(x, y, 0x1c, 0x1f, 0x27)
  }
}

const maskRow = ((S + 31) / 32) * 4
const xor = Buffer.alloc(S * S * 4)
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    const di = ((S - 1 - y) * S + x) * 4
    buf.copy(xor, di, i, i + 4)
  }
}

const and = Buffer.alloc(maskRow * S)
const header = Buffer.alloc(40)
header.writeUInt32LE(40, 0)
header.writeInt32LE(S, 4)
header.writeInt32LE(S * 2, 8)
header.writeUInt16LE(1, 12)
header.writeUInt16LE(32, 14)
header.writeUInt32LE(xor.length + and.length, 20)

const image = Buffer.concat([header, xor, and])

const dir = Buffer.alloc(6)
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry[0] = 0; entry[1] = 0; entry[2] = 0; entry[3] = 0
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(image.length, 8); entry.writeUInt32LE(22, 12)

const out = path.join(__dirname, '..', 'build', 'icon.ico')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, Buffer.concat([dir, entry, image]))

const png = Buffer.alloc(S * S * 4 + 8)
png.writeUInt32BE(S, 0); png.writeUInt32BE(S, 4)
png[8] = 6; png[9] = 0; png[10] = 0; png[11] = 0; png[12] = 0
buf.copy(png, 13)
fs.writeFileSync(path.join(path.dirname(out), 'icon.png'), png)

console.log('icon yazıldı:', out)