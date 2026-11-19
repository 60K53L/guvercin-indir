/**
 * Sürüm artırma ve CHANGELOG yeniden yazma kurallarını denetler.
 *
 * Neden test? Sürüm numarası artık her yayında artıyor. publish-ota.js bu işi
 * METİN üzerinden yapıyor; bir desen bozulursa sürüm bilgisi penceresi eski
 * numarada kalır ya da maddeler yanlış anahtara yazılır. Bu denetim, yayın
 * yapılmadan önce kuralların doğru çalıştığını kanıtlar.
 *
 * Kullanım: node scripts/test-version-bump.js
 */
const { bumpPatch, buildChangelogBlock } = require('./publish-ota.js')

let passed = 0
let failed = 0

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passed++
  else {
    failed++
    console.log(`  BAŞARISIZ: ${name}\n    beklenen: ${JSON.stringify(want)}\n    gelen:    ${JSON.stringify(got)}`)
  }
}

// 1. Yama numarası artar, sürüm ailesi korunur.
check('1.0.19 -> 1.0.20', bumpPatch('1.0.19'), '1.0.20')
check('1.0.9  -> 1.0.10 (sayı, metin değil)', bumpPatch('1.0.9'), '1.0.10')
check('1.2.3  -> 1.2.4', bumpPatch('1.2.3'), '1.2.4')
check('bozuk girdi olduğu gibi kalır', bumpPatch('1.0'), '1.0')

// 2. Yeni maddeler yeni anahtara yazılır, eski anahtarda yayınlanmışlar kalır.
const cl = {
  '1.0.19': ['eski madde', 'yeni madde'],
  '1.0.18': ['önceki sürüm maddesi']
}
const block = buildChangelogBlock(cl, '1.0.20', ['yeni madde'])

const keys = block.split('\n').filter(l => l.startsWith("  '")).map(l => l.match(/'([^']+)'/)[1])
check('yeni anahtar en üstte ve tüm anahtarlar korunuyor', keys, ['1.0.20', '1.0.19', '1.0.18'])
check('eski anahtar yeni maddeyi taşımaz', block.includes("    \"yeni madde\"") && block.indexOf("\"yeni madde\"") < block.indexOf('1.0.19'), true)
check('eski anahtar kendi maddesini korur', block.includes('"eski madde"'), true)
check('boş anahtar yazılmaz', buildChangelogBlock({ '1.0.2': ['x'] }, '1.0.3', ['x']).includes('1.0.2'), false)

// 3. Türkçe karakterler ve tırnaklar bozulmadan yazılmalı.
const tricky = buildChangelogBlock({ '1.0.1': ['KLİPSSİZ / TANIMSIZ', '"Alıntı" maddesi'] }, '1.0.2', ['KLİPSSİZ / TANIMSIZ', '"Alıntı" maddesi'])
check('Türkçe harfler korunuyor', tricky.includes('KLİPSSİZ / TANIMSIZ'), true)
check('iç tırnak kaçışlı yazılıyor', tricky.includes('\\"Alıntı\\" maddesi'), true)

console.log(`\n${passed + failed} sürüm kuralı denetlendi, ${failed} tanesi başarısız`)
process.exit(failed ? 1 : 0)
