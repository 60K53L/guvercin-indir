/**
 * <option> metinlerinin büyük harf olduğunu denetler.
 *
 * Neden ayrı denetim? CSS `text-transform` native <select> açılır
 * listelerine ULAŞMAZ; tarayıcı listeyi kendi çiziyor. Bu yüzden seçenek
 * metinleri veride büyük harf olmak zorunda.
 *
 * Kullanım: node scripts/check-option-caps.js
 */
const fs = require('fs')
const path = require('path')

const trU = s => s.toLocaleUpperCase('tr-TR')
const dir = path.join(__dirname, '..', 'src', 'components')

let bad = 0
let total = 0

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.jsx')) continue
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n')
  lines.forEach((line, i) => {
    const m = line.match(/<option[^>]*>([^<{][^<]*)<\/option>/)
    if (!m) return
    const text = m[1]
    total++
    if (text !== trU(text)) {
      console.log(`  ${file}:${i + 1}  ->  "${text}"`)
      bad++
    }
  })
}

console.log(`\n${total} seçenek denetlendi, ${bad} tanesi küçük harf`)
process.exit(bad ? 1 : 0)