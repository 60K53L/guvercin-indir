/**
 * VERİ TARAYICI — "BONCUK" kalıntısı arar. SALT OKUNUR.
 *
 * Kullanıcı kuş künyelerini BONCUK'tan KLİPS'e çevirdi ama elle
 * değiştirdiği için bazı kayıtlarda BONCUK kalmış olabilir. Bu betik
 * bulutdaki veriyi okur ve hangi alanda geçtiğini bildirir.
 *
 * GÜVENLİK
 *   - Hiçbir şey YAZMAZ, silmez veya değiştirmez. Yalnızca okur.
 *   - Şifre komut satırına düz metin olarak GİRİLMEZ; ortam
 *     değişkeninden okunur (GUVERCIN_SIFRE) ve betikte tutulmaz.
 *   - Şifre gerektirmeyen yol: uygulamanın JSON yedeği dışa aktarılır,
 *     tarayıcıya dosya yolu verilir.
 *
 * KULLANIM
 *   $env:GUVERCIN_SIFRE='...'; node scripts/scan-data.js guvercintakipai@gmail.com
 *   node scripts/scan-data.js --dosya yedek.json
 *
 * Alternatif (şifre istemeden): uygulamada Yedekleme → "JSON olarak
 * dışa aktar", sonra `node scripts/scan-data.js --dosya <yol>`.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, collection, getDocs, doc, getDoc
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { firebaseConfig } from '../src/firebase/config.js'

const ARANAN = ['BONCUK', 'Boncuk', 'boncuk']

/** Bir nesne ağacında ARANAN kelimeleri bulur; yol bilgisiyle döner. */
function tara(deger, yol, bulunan) {
  if (typeof deger === 'string') {
    if (ARANAN.some(k => deger.includes(k))) bulunan.push({ yol, deger })
    return
  }
  if (Array.isArray(deger)) {
    deger.forEach((d, i) => tara(d, `${yol}[${i}]`, bulunan))
    return
  }
  if (deger && typeof deger === 'object') {
    for (const [k, v] of Object.entries(deger)) tara(v, `${yol}.${k}`, bulunan)
  }
}

function raporVer(db, kaynak) {
  const bulunan = []
  tara(db, '', bulunan)

  const toplamKuş = (db.birds || []).length
  const toplamCift = (db.pairings || []).length
  console.log(`\nKaynak: ${kaynak}`)
  console.log(`Kuş: ${toplamKuş}   Çiftleşme: ${toplamCift}`)
  console.log('-'.repeat(66))

  if (!bulunan.length) {
    console.log('  ✓ BONCUK kelimesi HİÇBİR YERDE yok')
    return 0
  }

  // Alan bazında özet: hangi alanda kaç yerde geçiyor.
  const alanlar = new Map()
  for (const b of bulunan) {
    const alan = b.yol.replace(/^.*\.(?=[^.]+$)/, '') || b.yol
    alanlar.set(alan, (alanlar.get(alan) || 0) + 1)
  }
  console.log(`  ✗ ${bulunan.length} yerde geçiyor. Alan dağılımı:`)
  for (const [alan, adet] of [...alanlar].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${alan.padEnd(16)} ${adet}`)
  }

  console.log('\n  Tek tek kayıtlar (silmeden önce bunlara bak):')
  for (const b of bulunan.slice(0, 120)) {
    const kirp = b.deger.length > 70 ? b.deger.slice(0, 70) + '…' : b.deger
    console.log(`      ${b.yol}  =  "${kirp}"`)
  }
  if (bulunan.length > 120) {
    console.log(`      … ve ${bulunan.length - 120} tane daha`)
  }
  return bulunan.length
}

const arg = process.argv.slice(2)
const dosyaArg = arg.findIndex(a => a === '--dosya')

if (dosyaArg !== -1) {
  // --- Şifresiz yol: JSON yedeğini tara ---
  const yol = arg[dosyaArg + 1]
  if (!yol) {
    console.error('Kullanım: node scripts/scan-data.js --dosya yedek.json')
    process.exit(1)
  }
  // Windows Not/PowerShell dosyaya BOM (U+FEFF) ekleyebiliyor; JSON.parse
// bunu hata verir. Kullanıcının kaydettiği yedek dosyasını da
// sorunsuz okuyabilmek için baştan atılır.
  const ham = readFileSync(yol, 'utf8').replace(/^\uFEFF/, '')
  const db = JSON.parse(ham)
  process.exit(raporVer(db, yol) ? 1 : 0)
} else {
  // --- Doğrudan bulut: giriş yap, SADECE oku ---
  const email = arg[0]
  const sifre = process.env.GUVERCIN_SIFRE
  if (!email || !sifre) {
    console.error('Kullanım:')
    console.error('  $env:GUVERCIN_SIFRE="..."; node scripts/scan-data.js e-posta')
    console.error('  node scripts/scan-data.js --dosya yedek.json   (şifresiz)')
    process.exit(1)
  }

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)

  const oturum = await signInWithEmailAndPassword(auth, email, sifre)
  const uid = oturum.user.uid
  console.log(`Giriş yapıldı: ${oturum.user.email}`)

  const [birdsSnap, pairingsSnap, userSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'birds')),
    getDocs(collection(db, 'users', uid, 'pairings')),
    getDoc(doc(db, 'users', uid))
  ])

  const veri = {
    birds: birdsSnap.docs.map(d => d.data()),
    pairings: pairingsSnap.docs.map(d => d.data()),
    settings: userSnap.exists() ? userSnap.data().settings || {} : {}
  }

  process.exit(raporVer(veri, `bulut (${email})`) ? 1 : 0)
}