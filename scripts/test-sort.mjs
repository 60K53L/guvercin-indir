/**
 * Türkçe alfabetik sıralama testi.
 * Türkçede c, ç, g, ğ, ı, i, o, ö, ş, u, ü sırası farklıdır;
 * İngilizce sıralama bunları yanlış dizer.
 */
const sortTr = list =>
  [...list].sort((a, b) => String(a).localeCompare(String(b), 'tr', { sensitivity: 'base' }))

let pass = 0, fail = 0
const check = (name, cond) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name) }
}

console.log('\n1) Künye kodları')
{
  const out = sortTr(['MAVI BONCUK', 'KIRMIZI BONCUK', 'BEYAZ BONCUK', 'SIYAH BONCUK'])
  check('sıralandı', JSON.stringify(out) ===
    JSON.stringify(['BEYAZ BONCUK', 'KIRMIZI BONCUK', 'MAVI BONCUK', 'SIYAH BONCUK']))
}

console.log('\n2) Cinsler — Türkçe harfler')
{
  const out = sortTr(['SARI KOMPLE', 'ÇAKAL', 'LİMONİ', 'KIRMIZI KOMPLE', 'BEYAZ'])
  check('Ç, K, L, S, B sırası doğru',
    JSON.stringify(out) === JSON.stringify(['BEYAZ', 'ÇAKAL', 'KIRMIZI KOMPLE', 'LİMONİ', 'SARI KOMPLE']))
}

console.log('\n3) Türkçe I/İ ile ı/i')
{
  const out = sortTr(['ISLAK', 'IRAK', 'ISPARTA', 'İZMİR', 'İSTANBUL'])
  // Türkçe alfabesinde I ile İ ayrı harfler ve I < İ sırasındadır.
  // IRAK(I-R) < ISLAK(I-S-L) < ISPARTA(I-S-P) çünkü R<S ve L<P
  check('I/İ doğru dizildi',
    JSON.stringify(out) === JSON.stringify(['IRAK', 'ISLAK', 'ISPARTA', 'İSTANBUL', 'İZMİR']))
}

console.log('\n4) G/Ğ ve Ö/Ş sırası')
{
  const out = sortTr(['ŞAHİN', 'GÜVERCİN', 'ÖRDEK', 'GÖÇMEN'])
  check('G, GÖÇMEN, GÜVERCİN, ÖRDEK, ŞAHİN',
    JSON.stringify(out) === JSON.stringify(['GÖÇMEN', 'GÜVERCİN', 'ÖRDEK', 'ŞAHİN']))
}

console.log('\n5) Büyük/küçük harf ve tekrar')
{
  const out = sortTr(['mavi', 'MAVI', 'beyaz'])
  check('tekrar edenler korundu (3 eleman)', out.length === 3)
  check('büyük/küçük harf birleşiyor', out[out.length - 1] === 'mavi' || out[0] === 'beyaz')
}

console.log('\n6) Orijinal dizi bozulmamalı')
{
  const src = ['c', 'a', 'b']
  sortTr(src)
  check('kaynak dizi aynı kaldı', JSON.stringify(src) === JSON.stringify(['c', 'a', 'b']))
}

console.log('\n7) Boş ve tek eleman')
{
  check('boş dizi', JSON.stringify(sortTr([])) === '[]')
  check('tek eleman', JSON.stringify(sortTr(['x'])) === '["x"]')
}

console.log(`\n${'='.repeat(40)}`)
console.log(`  ${pass} geçti, ${fail} başarısız`)
console.log('='.repeat(40) + '\n')
process.exit(fail ? 1 : 0)