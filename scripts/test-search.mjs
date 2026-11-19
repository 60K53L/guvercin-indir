/**
 * Türkçe arama/katlama kurallarının testi (AGENTS.md).
 *
 * Neden bu test var? trUpper() locale'e göre çeviriyor ve noktalı İ'yi
 * koruyor; katlamamış bir anahtar sözcük noktalı kayıtla eşleşmiyor.
 * Bu, kullanıcı "mavi" yazıp "MAVI BONCUK" kaydını bulamadığında ortaya
 * çıkıyor — gözle görünmeyen bir hata. Test, arama yapan yerlerin
 * trSearch()/foldTr() kullanması gerektiğini sabitliyor.
 */
import { trSearch, trUpper, foldTr, matchMedicationCategory } from '../src/lib.js'
import { syncClutchNotifications } from '../src/notifications.js'

let pass = 0, fail = 0
const check = (name, cond) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name) }
}

console.log('\n1) Arama katlaması (İ / I / ı / i)')
{
  // Katlanmamış (ASCII) yazılmış eski kayıt, noktalı aramayla bulunmalı.
  check('ASCII kayıt katlanmış aramayla bulunuyor',
    foldTr('MAVI BONCUK').includes(trSearch('mavi')))
  check('katlanmış kayıt katlanmış aramayla bulunuyor',
    trSearch('MAVİ BONCUK').includes(trSearch('mavi')))
  check('Ş/ş, Ç/ç, Ğ/ğ, Ö/ö, Ü/ü katlanıyor',
    trSearch('Kırmızı Klips') === trSearch('KIRMIZI KLİPS'))
  check('bozuk Türkçe çevirme eşleşmeyi bozmuyor',
    trSearch('dişi') === trSearch('DİŞI'))
}

console.log('\n2) trUpper Türkçe doğruluğu')
{
  check('dişi → DİŞİ', trUpper('dişi') === 'DİŞİ')
  check('Aktif Tedavi → AKTİF TEDAVİ', trUpper('Aktif Tedavi') === 'AKTİF TEDAVİ')
  check('İyileşti → İYİLEŞTİ', trUpper('İyileşti') === 'İYİLEŞTİ')
  check('Lacivert → LACİVERT', trUpper('Lacivert') === 'LACİVERT')
  check('Çiçek → ÇİÇEK', trUpper('çiçek') === 'ÇİÇEK')
}

console.log('\n3) İlaç kategori eşleşmesi (her iki yazım)')
{
  const med = { name: 'TETRASIKLİN', purpose: 'göz sulanması için', categories: ['HIRILTI'] }
  check('noktalı kategori eşleşiyor', matchMedicationCategory(med, 'GÖZ SULANMASI'))
  check('noktasız yazılmış kategori eşleşiyor', matchMedicationCategory(med, 'GOZ SULANMASI'))
  check('doğrudan atanan kategori eşleşiyor', matchMedicationCategory(med, 'HIRILTI'))
  check('katlanmış kayıt noktalı aramayla eşleşiyor',
    matchMedicationCategory({ categories: ['MAVI'] }, 'mavi'))
}

console.log('\n4) Bildirim kimlikleri benzersiz (Android çakışması)')
{
  const future = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)
  const clutches = Array.from({ length: 300 }, (_, i) => ({
    id: 'c' + i, nest: String(i), status: 'incubation', egg1Date: future, egg2Date: future
  }))
  const res = await syncClutchNotifications({ birds: [], pairings: [], clutches })
  const ids = res.items.map(x => x.id)
  check('bildirim üretildi', res.scheduledCount > 0)
  check('kimlikler benzersiz', new Set(ids).size === ids.length)
  check('kimlikler int32 sınırında', ids.every(id => Number.isInteger(id) && id >= 0 && id < 2147483647))
}

console.log('\n========================================')
console.log(`  ${pass} geçti, ${fail} başarısız`)
process.exit(fail ? 1 : 0)
