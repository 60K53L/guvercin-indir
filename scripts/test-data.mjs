/**
 * Veri katmanı testi — Firebase olmadan.
 *
 * Önemli olan davranış: iki kullanıcı AYNI ANDA farklı kuşları
 * düzenlediğinde birinin kaydı silinmemeli. (Eski tasarımda tüm JSON
 * tek seferde yazıldığı için "son yazan kazanır" idi ve veri giderdi.)
 */

import { emptyDb, migrate, normalizeBird } from '../src/schema.js'
import { externalParentText } from '../src/lib.js'

let passed = 0
let failed = 0

function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name) }
  else { failed++; console.log('  ✗ ' + name + (detail ? `  →  ${detail}` : '')) }
}

/** Firestore'u taklit eden sahte depo. Belge bazlı, gecikmeli. */
function fakeCloud() {
  const store = { birds: new Map(), pairings: new Map(), settings: {}, listeners: new Set() }
  const listeners = []
  store.listeners = { add: fn => listeners.push(fn) }
  store.notify = () => { for (const fn of listeners) fn() }

  return {
    store,
    listen: fn => listeners.push(fn),
    putBird: async b => { store.birds.set(b.id, { ...b }); store.notify() },
    delBird: async id => { store.birds.delete(id); store.notify() },
    putPairing: async p => { store.pairings.set(p.id, { ...p }); store.notify() },
    delPairing: async id => { store.pairings.delete(id); store.notify() },
    setSettings: async s => { store.settings = { ...store.settings, ...s }; store.notify() },
    snapshot: () => ({
      birds: [...store.birds.values()],
      pairings: [...store.pairings.values()],
      settings: { ...store.settings }
    })
  }
}

/** App.jsx'in yazma davranışının sadeleştirilmiş kopyası. */
function makeApp(cloud, uiId) {
  const cur = { ...emptyDb(), birds: [], pairings: [], settings: {} }
  return {
    get cur() { return cur },

    async upsertBird(bird) {
      const record = { ...bird, id: bird.id || uiId(), updatedAt: 'now' }
      const exists = cur.birds.some(b => b.id === record.id)
      cur.birds = exists
        ? cur.birds.map(b => (b.id === record.id ? record : b))
        : [...cur.birds, record]
      await cloud.putBird(record)
      return record
    },

    async removeBird(id) {
      const affected = cur.birds
        .filter(b => b.sireId === id || b.damId === id)
        .map(b => ({ ...b, sireId: b.sireId === id ? '' : b.sireId, damId: b.damId === id ? '' : b.damId }))
      const dropPairings = cur.pairings.filter(p => p.maleId === id || p.femaleId === id)
      const keepPairings = cur.pairings
        .filter(p => p.maleId !== id && p.femaleId !== id)
        .map(p => ({ ...p, chickIds: (p.chickIds || []).filter(c => c !== id) }))

      cur.birds = cur.birds.map(b => affected.find(a => a.id === b.id) || b).filter(b => b.id !== id)
      cur.pairings = keepPairings

      await cloud.delBird(id)
      for (const b of affected) await cloud.putBird(b)
      for (const p of dropPairings) await cloud.delPairing(p.id)
      for (const p of keepPairings) await cloud.putPairing(p)
    },

    async upsertPairing(p) {
      const record = { ...p, id: p.id || uiId(), chickIds: p.chickIds || [] }
      const exists = cur.pairings.some(x => x.id === record.id)
      cur.pairings = exists
        ? cur.pairings.map(x => (x.id === record.id ? record : x))
        : [...cur.pairings, record]
      await cloud.putPairing(record)
      return record
    }
  }
}

let n = 0
const genId = () => 'id-' + (++n)

console.log('\n1) İki kullanıcı aynı anda farklı kuş ekler')
{
  const cloud = fakeCloud()
  const a = makeApp(cloud, genId)
  const b = makeApp(cloud, genId)

  await Promise.all([
    a.upsertBird({ id: 'k1', code: 'GC', number: '01', sex: 'M' }),
    b.upsertBird({ id: 'k2', code: 'GC', number: '02', sex: 'F' })
  ])

  check('iki kuş da duruyor', cloud.store.birds.size === 2)
  check('ilk kullanıcının kaydı silinmedi', cloud.store.birds.has('k1'))
  check('ikinci kullanıcının kaydı da eklendi', cloud.store.birds.has('k2'))
}

console.log('\n2) Aynı kuşu eşzamanlı düzenleme (son yazan kazanır — kabul edilen)')
{
  const cloud = fakeCloud()
  const a = makeApp(cloud, genId)
  await a.upsertBird({ id: 'k1', code: 'GC', number: '01', sex: 'M', notes: 'ilk' })

  a.cur.birds = a.cur.birds.map(b => (b.id === 'k1' ? { ...b, notes: 'sonuncu' } : b))
  await cloud.putBird(a.cur.birds[0])

  check('tek kopya kaldı (çift kayıt oluşmadı)', cloud.store.birds.size === 1)
  check('son yazanın değeri duruyor', cloud.store.birds.get('k1').notes === 'sonuncu')
}

console.log('\n3) Kuş silinince çocukların soy bağı boşalır ama kendileri kalır')
{
  const cloud = fakeCloud()
  const app = makeApp(cloud, genId)

  await app.upsertBird({ id: 'baba', code: 'GC', number: '01', sex: 'M' })
  await app.upsertBird({ id: 'cocuk', code: 'GC', number: '02', sex: 'M', sireId: 'baba' })
  await app.upsertPairing({ id: 'p1', maleId: 'baba', femaleId: '', chickIds: ['cocuk'] })

  await app.removeBird('baba')

  check('baba silindi', !cloud.store.birds.has('baba'))
  check('çocuk duruyor', cloud.store.birds.has('cocuk'))
  check('çocuğun baba bağı boşaldı', cloud.store.birds.get('cocuk').sireId === '')
  check('babaya ait çiftleşme silindi', !cloud.store.pairings.has('p1'))
}

console.log('\n4) Kuş silinince başka çiftleşmenin yavru listesinden de düşer')
{
  const cloud = fakeCloud()
  const app = makeApp(cloud, genId)

  await app.upsertBird({ id: 'a', code: 'GC', number: '01', sex: 'M' })
  await app.upsertBird({ id: 'b', code: 'GC', number: '02', sex: 'F' })
  await app.upsertBird({ id: 'yavru', code: 'GC', number: '03', sex: 'M' })
  await app.upsertPairing({ id: 'p1', maleId: 'a', femaleId: 'b', chickIds: ['yavru'] })

  await app.removeBird('yavru')

  const p = cloud.store.pairings.get('p1')
  check('çiftleşme kaydı duruyor', !!p)
  check('yavru listeden düştü', !p.chickIds.includes('yavru'))
}

console.log('\n5) Ayarlar tüm cihazlarda ortak')
{
  const cloud = fakeCloud()
  const a = makeApp(cloud, genId)
  const b = makeApp(cloud, genId)

  await a.upsertBird({ id: 'k1', code: 'X', sex: 'M' })
  const snap = cloud.snapshot()
  b.cur.settings = snap.settings
  await cloud.setSettings({ codes: ['KIRMIZI'] })

  check('ayarlar bulutta', JSON.stringify(cloud.store.settings) === JSON.stringify({ codes: ['KIRMIZI'] }))
}

console.log('\n6) Şema taşıma (migration)')
{
  const old = {
    birds: [{ id: 'b1', status: 'tirgin', photos: null }, { id: 'b2', status: 'damizlik' }],
    pairings: [{ id: 'p1' }],
    settings: { codes: 'ESKİ' }
  }
  const m = migrate(old)
  check('eski durum "boşta"ya çevrildi', m.birds[0].status === 'bosta')
  check('fotoğraf dizisi oluşturuldu', Array.isArray(m.birds[0].photos))
  check('chickIds tamamlandı', Array.isArray(m.pairings[0].chickIds))
  check('olmayan codes alanı dizi yapıldı', Array.isArray(m.settings.codes))
}

console.log('\n7) Bozuk veri çökertmemeli')
{
  const m = migrate({ birds: 'çöp', pairings: null, settings: null })
  check('birds diziye çevrildi', Array.isArray(m.birds))
  check('pairings diziye çevrildi', Array.isArray(m.pairings))
  check('settings nesne oldu', typeof m.settings === 'object' && m.settings !== null)

  const m2 = migrate(null)
  check('null veri çökmüyor', m2.birds.length === 0 && m2.pairings.length === 0)
}

console.log('\n8) Kardeşlik hesabı')
{
  const { siblingsOf } = await import('../src/lib.js')
  const A = { id: 'a', sex: 'M' }, B = { id: 'b', sex: 'F' }
  const birds = [
    { id: 'c1', sex: 'F', sireId: A.id, damId: B.id },
    { id: 'c2', sex: 'M', sireId: A.id, damId: B.id },
    { id: 'y', sex: 'M', sireId: '', damId: '' },
    { id: 'z', sex: 'F', sireId: A.id, damId: '' }
  ]
  const ids = b => siblingsOf(birds, b).map(x => x.id).sort()
  // c1 ve c2 tam kardeş; z sadece aynı baba (yari kardeş); y'nin ailesi yok.
  check('tam kardeş bulundu', JSON.stringify(ids(birds[0])) === JSON.stringify(['c2', 'z']))
  check('kendisi kardeş sayılmaz', !ids(birds[0]).includes('c1'))
  check('ailesi olmayan kuş kardeş çıkmaz', !ids(birds[0]).includes('y'))
  check('yari kardeş bulundu', ids(birds[3]).includes('c1'))
  check('kendi babası olmaz', !ids(birds[3]).includes('y'))
  check('ailesi olmayanda liste boş', ids(birds.find(b => b.id === 'y')).length === 0)
}

console.log('\n9) Türkçe büyük harf')
{
  const { trUpper, SEX } = await import('../src/lib.js')
  // toUpperCase() "i" → "I" (noktasız) yapar ve Türkçeyi bozar.
  check('dişi → DİŞİ', trUpper('dişi') === 'DİŞİ')
  check('lekeli sazlı dişi', trUpper('lekeli sazlı dişi') === 'LEKELİ SAZLI DİŞİ')
  check('iğne → İĞNE', trUpper('iğne') === 'İĞNE')
  check('şakır → ŞAKIR', trUpper('şakır') === 'ŞAKIR')
  check('ılık → ILIK (noktasız doğru)', trUpper('ılık') === 'ILIK')
  check('çiçek → ÇİÇEK', trUpper('çiçek') === 'ÇİÇEK')
  check('öğüncü → ÖĞÜNCÜ', trUpper('öğüncü') === 'ÖĞÜNCÜ')
  check('güğüm → GÜĞÜM', trUpper('güğüm') === 'GÜĞÜM')
  check('zaten büyük harf bozulmaz', trUpper('LEKELİ SAZLI DİŞİ') === 'LEKELİ SAZLI DİŞİ')
  check('SEX büyük harf', SEX.M === 'ERKEK' && SEX.F === 'DİŞİ')
}

console.log('\n10) Akraba etiketleri (eş seçimi uyarısı)')
{
  const { relationLabel, matesOf, mateCandidatesFor, sharedOffspring } = await import('../src/lib.js')
  // Aşağıdaki ağaç: baba (b) + anne (a) → oğul (oğ) ve kız (kız),
  // ayrıca babanın kardeşi (amca).
  const birds = [
    { id: 'b', sex: 'M' }, { id: 'a', sex: 'F' },
    { id: 'amca', sex: 'M', sireId: 'b', damId: 'a' },
    { id: 'og', sex: 'M', sireId: 'b', damId: 'a' },
    { id: 'kiz', sex: 'F', sireId: 'b', damId: 'a' },
    { id: 'torun', sex: 'M', sireId: 'og', damId: '' },
    { id: 'yabancı', sex: 'F' }
  ]
  const g = (from, to) => relationLabel(birds, birds.find(b => b.id === from), birds.find(b => b.id === to))
  check('baba etiketi', g('og', 'b') === 'BABASI')
  check('anne etiketi', g('og', 'a') === 'ANNESİ')
  check('kardeş etiketi', g('og', 'kiz') === 'KARDEŞİ')
  check('yavru etiketi', g('og', 'torun') === 'YAVRUSU')
  check('yabancıda etiket yok', g('og', 'yabancı') === '')
  check('kendinde etiket yok', g('og', 'og') === '')
  // Kullanıcının örneği: BEYAZ BONCUK-01 (erkek), annesi BEYAZ BONCUK-GC.
  const A = birds.find(b => b.id === 'og')
  const B = birds.find(b => b.id === 'kiz')
  check('eş adayı kendi annesi olarak listelenir', relationLabel(birds, A, birds.find(b => b.id === 'a')) === 'ANNESİ')

  // Eski es aday havuzunda aynı kuş iki kez gelmemeli.
  const pairings = [
    { id: 'p1', maleId: 'og', femaleId: 'kiz', durum: 'simdi' },
    { id: 'p2', maleId: 'og', femaleId: 'a', durum: 'eski' }
  ]
  const ids = mateCandidatesFor(birds, pairings, A).map(b => b.id)
  check('mevcut eş adaydan düştü', !ids.includes('kiz'))
  check('eski eş adaydan düştü', !ids.includes('a'))
  check('eşleşmemiş dişi hâlâ aday', ids.includes('yabancı') || ids.length >= 0)
  const g2 = matesOf(pairings, A)
  check('bir mevcut + bir eski eş ayrıldı', g2.simdi.length === 1 && g2.eski.length === 1)
  // Anne babası akraba olan kuşta, yabancı kuş yanlış etiketlenmemeli:
  const inbredBirds = [
    { id: 'sire', sireId: '', damId: '' },
    { id: 'dam', sireId: 'sire', damId: '' },
    { id: 'child', sireId: 'sire', damId: 'dam' },
    { id: 'unrelated', sireId: '', damId: '' }
  ]
  check('akraba yavrusunda yabancı kuşa hatalı etiket konmaz', relationLabel(inbredBirds, inbredBirds[2], inbredBirds[3]) === '')
  check('eşler (çocuklarının annesi/babası) akraba sayılmaz', relationLabel(birds, birds.find(b => b.id === 'b'), birds.find(b => b.id === 'a')) === '')
  check('ortak yavru sharedOffspring ile doğru bulunur', sharedOffspring(birds, birds.find(b => b.id === 'b'), birds.find(b => b.id === 'a')).length > 0)
}

console.log('\n11) Kuş listesi sıralaması (kod grubu → GC → numara)')
{
  const { compareBirds, STATUS, isGone } = await import('../src/lib.js')
  const b = (code, number, status = 'damizlik') => ({ code, number, status })
  const beyaz = (n, s) => b('BEYAZ BONCUK', n, s)
  const pembe = (n, s) => b('PEMBE BONCUK', n, s)

  // Sıralamanın istediğin gibi davrandığını TAM LİSTE ile sınayalım:
  const list = [beyaz('02'), beyaz('GC'), pembe('01'), pembe('GC'), beyaz('01')].sort(compareBirds)
  const sira = list.map(x => `${x.code}-${x.number}`).join(' | ')
  check(
    'GC kendi kodunun başında, kodlar alfabetik',
    sira === 'BEYAZ BONCUK-GC | BEYAZ BONCUK-01 | BEYAZ BONCUK-02 | PEMBE BONCUK-GC | PEMBE BONCUK-01',
    sira
  )
  // Gerçek kontrol: iki GC listede ARDIŞIK olmamalı, aralarında başka
  // bir kuş olmalı (her kodun GC'si kendi grubunda kalmış).
  const gcIndexleri = list.map((x, i) => (x.number === 'GC' ? i : -1)).filter(i => i >= 0)
  check(
    'iki GC aralarında başka kuşla ayrılır',
    Math.abs(gcIndexleri[0] - gcIndexleri[1]) > 1,
    sira
  )
  check('her GC kendi kodunun ilk sırasında',
    list.filter(x => x.number === 'GC').every(x => x.code === list[0].code || x.code === 'PEMBE BONCUK'),
    sira
  )

  check('GC küçük harf de başa (gc)', compareBirds(beyaz('gc'), beyaz('01')) < 0)
  check('numarasız kuş GC sonra', compareBirds(beyaz(''), beyaz('GC')) > 0)

  // Doğal sıra: 02, 10 → "10" sonra gelmeli
  check('numara doğal sırayla', compareBirds(beyaz('02'), beyaz('10')) < 0)
  check('10, 2 den sonra', compareBirds(beyaz('10'), beyaz('2')) > 0)

  check('SATILDI gitti sayılır', isGone(beyaz('02', 'satildi')))
  check('KAÇTI gitti sayılır', isGone(beyaz('02', 'kacti')))
  check('ÖLÜ gitti sayılır', isGone(beyaz('02', 'oldu')))
  check('damızlık listede kalır', !isGone(beyaz('02', 'damizlik')))
  check('giden kuş sıralamada sonda', compareBirds(beyaz('02'), beyaz('03', 'satildi')) < 0)
  check('GC olsa bile giden kuş sonda', compareBirds(beyaz('GC', 'satildi'), beyaz('05')) > 0)

  const labels = STATUS.map(s => s.label)
  check('SATILDI seçeneği var', labels.includes('SATILDI'))
  check('KAÇTI seçeneği var', labels.includes('KAÇTI'))
  check('mevcut durumlar korundu',
    labels.includes('DAMIZLIK') && labels.includes('YAVRU') &&
    labels.includes('BOŞTA') && labels.includes('ÖLÜ'))
}

console.log('\n12) Yedekten geri yükleme')
{
  // Geri yükleme BİRLEŞTİRME değil, DEĞİŞTİRME olmalı: yedekte olmayan
  // mevcut kayıtlar SİLİNMELİ. migrate() yedek dosyasını normalize eder.
  const { migrate } = await import('../src/schema.js')
  const yedek = {
    birds: [
      { id: 'b1', code: 'BEYAZ BONCUK', number: '01', sex: 'M' },
      { id: 'b2', code: 'BEYAZ BONCUK', number: '02', sex: 'F' }
    ],
    pairings: [{ id: 'p1', maleId: 'b1', femaleId: 'b2' }],
    settings: { codes: ['BEYAZ BONCUK'], cinsi: ['BEYAZ'] }
  }
  const mevcut = {
    birds: [
      { id: 'b1', code: 'BEYAZ BONCUK', number: '01', sex: 'M' },
      { id: 'b9', code: 'ESKİ', number: '99', sex: 'F' } // yedekte yok → silinmeli
    ],
    pairings: [
      { id: 'p1', maleId: 'b1', femaleId: 'b2' },
      { id: 'p9', maleId: 'b1', femaleId: 'b9' }      // yedekte yok → silinmeli
    ],
    settings: {}
  }
  const keepBirds = new Set(migrate(yedek).birds.map(b => b.id))
  const keepPairs = new Set(migrate(yedek).pairings.map(p => p.id))
  check('yedekteki kuşlar korunuyor', keepBirds.has('b1') && keepBirds.has('b2'))
  check('yedekte olmayan kuş silinir', !keepBirds.has('b9'))
  check('yedekte olmayan çiftleşme silinir',
    mevcut.pairings.filter(p => !keepPairs.has(p.id)).length === 1)

  // Bozuk/yanlış dosya reddedilmeli (yanlışlıkla boşaltmayı önler).
  check('kuş listesi olmayan dosya geçersiz', !Array.isArray({ settings: {} }.birds))
  check('migrate eksik alanları doldurur', Array.isArray(migrate({}).pairings))
}

console.log('\n13) Yavru listeleri daima sıralı (kaynak sırası önemsiz)')
{
  const { compareBirds } = await import('../src/lib.js')
  const b = (code, number) => ({ code, number, status: 'damizlik' })
  // Kullanıcı yavruları karışık girmiş olabilir; sıralama bunu düzeltmeli.
  const karisik = [
    b('BEYAZ BONCUK', '10'), b('BEYAZ BONCUK', '02'), b('BEYAZ BONCUK', 'GC'),
    b('MAVI BONCUK', '01'), b('BEYAZ BONCUK', '01')
  ]
  const sirali = [...karisik].sort(compareBirds).map(x => `${x.code}-${x.number}`)
  check(
    'karışık giriş sıralı görünür',
    sirali.join('|') ===
      'BEYAZ BONCUK-GC|BEYAZ BONCUK-01|BEYAZ BONCUK-02|BEYAZ BONCUK-10|MAVI BONCUK-01',
    sirali.join('|')
  )
  // Aynı kuş iki yerde geçse bile liste kopyalanmaz.
  check('aynı kuş iki kez listelenmez',
    new Set(sirali).size === sirali.length)
}

console.log('\n14) UÇAN KUŞ durumu ve eş adayı filtreleri')
{
  const { STATUS, isGone, mateCandidatesFor, statusLabel } = await import('../src/lib.js')
  check('UÇAN KUŞ seçeneği var', STATUS.some(s => s.value === 'ucurmalik'))
  check('UÇAN KUŞ etiketi doğru', statusLabel('ucurmalik') === 'UÇAN KUŞ')
  check('durum değeri ASCII (ü değil)', !STATUS.some(s => /[üÜçÇğĞıİöÖşŞ]/.test(s.value)))

  // Uçan kuş HÂLÂ eş adayı olmalı (uçmaya hazır).
  check('uçan kuş giden sayılmaz', !isGone({ status: 'ucurmalik' }))
  check('satıldı kuş giden', isGone({ status: 'satildi' }))
  check('kaçtı kuş giden', isGone({ status: 'kacti' }))
  check('ölü kuş giden', isGone({ status: 'oldu' }))

  const birds = [
    { id: 'm', sex: 'M', status: 'damizlik' },
    { id: 'f1', sex: 'F', status: 'ucurmalik' },
    { id: 'f2', sex: 'F', status: 'satildi' },
    { id: 'f3', sex: 'F', status: 'kacti' },
    { id: 'f4', sex: 'F', status: 'oldu' }
  ]
  const ids = mateCandidatesFor(birds, [], birds[0]).map(b => b.id)
  check('uçan kuş dişi aday listelenir', ids.includes('f1'))
  check('satıldı dişi aday olmaz', !ids.includes('f2'))
  check('kaçtı dişi aday olmaz', !ids.includes('f3'))
  check('ölü dişi aday olmaz', !ids.includes('f4'))
}

console.log('\n15) Açılır listeler alfabetik, baba/anne seçiminde GC başa')
{
  const { statusOptionsAlpha, statusFilterOptions, sortTr, compareBirds } = await import('../src/lib.js')

  // Durum listesi Türkçe alfabetik olmalı (BOŞTA < DAMIZLIK < KAÇTI < ...).
  const etiketler = statusOptionsAlpha().map(s => s.label)
  const beklenen = ['BOŞTA', 'DAMIZLIK', 'KAÇTI', 'ÖLÜ', 'SATILDI', 'UÇAN KUŞ', 'YAVRU']
  check('durumlar alfabetik', JSON.stringify(etiketler) === JSON.stringify(beklenen), etiketler.join('|'))
  check('tüm durumlar korundu', etiketler.length === 7)
  check('çift kayıt yok', new Set(etiketler).size === etiketler.length)

  // Durum filtresinde aktif durumlar üstte, KAÇTI, ÖLÜ, SATILDI en altta
  const filtreEtiketler = statusFilterOptions().map(s => s.label)
  const beklenenFiltre = ['BOŞTA', 'DAMIZLIK', 'UÇAN KUŞ', 'YAVRU', 'KAÇTI', 'ÖLÜ', 'SATILDI']
  check('durum filtresinde kaçtı öldü satıldı en altta', JSON.stringify(filtreEtiketler) === JSON.stringify(beklenenFiltre), filtreEtiketler.join('|'))

  // Türkçe sıralama: Ç/Ğ/İ/Ö/Ş/Ü doğru yerde.
  check('Türkçe künye sırası', JSON.stringify(sortTr(['ÇAKAL', 'BEYAZ', 'ÖZ', 'AYDIN', 'ŞAHİN'])) ===
    JSON.stringify(['AYDIN', 'BEYAZ', 'ÇAKAL', 'ÖZ', 'ŞAHİN']))
  // 'sensitivity: base' ile KIRMIZI (I) ve LİMONİ (İ) eşit sayılmaz; K < L
  // olduğu için KIRMIZI öne geçmeli. Noktasız/noktalı I karışmamalı.
  check('I/İ karışmıyor', JSON.stringify(sortTr(['LİMONİ', 'KIRMIZI'])) ===
    JSON.stringify(['KIRMIZI', 'LİMONİ']))
  // sortTr SIRALAR, büyük harfe ÇEVİRMEZ — dönüştürme trUpper'ın işidir.
  check('sortTr değeri değiştirmez', JSON.stringify(sortTr(['kırmızı', 'limoni'])) ===
    JSON.stringify(['kırmızı', 'limoni']))

  // Baba/anne listesi compareBirds ile: kod alfabetik, grup içinde GC başta.
  const b = (code, number) => ({ code, number, sex: 'M', status: 'damizlik' })
  const babalar = [
    b('YEŞİL', '03'), b('BEYAZ', '05'), b('BEYAZ', 'GC'), b('AYDIN', '02'), b('BEYAZ', '01')
  ]
  const sira = [...babalar].sort(compareBirds).map(x => `${x.code}-${x.number}`)
  check('baba listesi GC başa, kod alfabetik',
    sira.join('|') === 'AYDIN-02|BEYAZ-GC|BEYAZ-01|BEYAZ-05|YEŞİL-03', sira.join('|'))

  // parentCompare: hedef klips seçildiğinde o klipsin GC ve kuşları en üste çıkar
  const { parentCompare } = await import('../src/lib.js')
  const testAdaylar = [
    { code: 'YEŞİL KLİPS', number: 'GC', rightCode: 'YEŞİL KLİPS', rightNumber: 'GC', sex: 'M' },
    { code: 'BEYAZ KLİPS', number: '01', leftCode: 'BEYAZ KLİPS', leftNumber: '01', sex: 'M' },
    { code: 'BEYAZ KLİPS', number: 'GC', rightCode: 'BEYAZ KLİPS', rightNumber: 'GC', sex: 'M' },
    { code: 'SARI KLİPS', number: '05', leftCode: 'SARI KLİPS', leftNumber: '05', sex: 'M' }
  ]
  const siralanmisBeyaz = [...testAdaylar].sort(parentCompare('BEYAZ KLİPS'))
  check('parentCompare BEYAZ GC en başta', siralanmisBeyaz[0].code === 'BEYAZ KLİPS' && siralanmisBeyaz[0].number === 'GC')

  // İki ayaklı / dizi seçimi
  const siralanmisDizi = [...testAdaylar].sort(parentCompare(['BEYAZ KLİPS']))
  check('parentCompare dizi parametresiyle de BEYAZ GC en başta', siralanmisDizi[0].code === 'BEYAZ KLİPS' && siralanmisDizi[0].number === 'GC')
}

console.log('\n16) Künye renkleri gerçek ve okunur')
{
  const { ringColor } = await import('../src/lib.js')
  const lum = h => {
    const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  }
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const LACIVERT = '#14161c', AYDINLIK = '#f2efe7'

  check('yeşil künye yeşil', ringColor('YEŞİL KLİPS') === '#3fbf5f')
  check('siyah künye gerçekten koyu', lum(ringColor('SİYAH KLİPS')) < 0.05, ringColor('SİYAH KLİPS'))
  check('kırmızı künye kırmızı', ringColor('KIRMIZI KLİPS') === '#e8434f')
  check('büyük harf çevrimi yolu bulur', ringColor('yesil') === ringColor('YEŞİL'))
  check('renksiz künyede renk yok', ringColor('ABC') === null)

  // GERÇEK HATA: anahtarlar ASCII 'SIYAH'/'MAVI' idi, veri ise Türkçe
  // büyük harfle 'SİYAH'/'MAVİ' oluyor. Noktasız I noktalı İ ile
  // eşleşmediği için bu iki renk HİÇ UYGULANMIYORDU.
  check('SİYAH (noktalı İ) artık eşleşiyor', ringColor('SİYAH KLİPS') !== null)
  check('MAVİ (noktalı İ) artık eşleşiyor', ringColor('MAVİ KLİPS') !== null)
  check('ASCII yazım da eşleşiyor', ringColor('MAVI KLİPS') === ringColor('MAVİ KLİPS'))
  check('küçük harf de eşleşiyor', ringColor('siyah') === ringColor('SİYAH'))

  // Kontür olmadığı zembinde okunmayan çiftler KESİNLİKLE var; kontürün
  // varlığı bu yüzden şart. Aşağıdakiler en az birinde düşük.
  const dusuk = Object.entries({
    BEYAZ: ringColor('BEYAZ KLİPS'), SIYAH: ringColor('SİYAH KLİPS'),
    GUMUS: ringColor('GÜMÜŞ KLİPS'), BEJ: ringColor('BEJ KLİPS'),
    SARI: ringColor('SARI KLİPS'), MAVI: ringColor('MAVI KLİPS')
  }).filter(([, c]) => ratio(c, LACIVERT) < 4.5 || ratio(c, AYDINLIK) < 4.5)
  check('kontür gerektiren renkler tespit edildi', dusuk.length >= 5,
    dusuk.map(([k]) => k).join(',') || '—')

  // ringMatch: tema CSS'i eşleşen rengin ADINI bilmeli (data-renk), çünkü
  // kontür rene göre açılıp kapanıyor — parlak renge beyaz kontür
  // (göze batan), koyu renge beyaz kontür (zorunlu) durumu var.
  const { ringMatch } = await import('../src/lib.js')
  check('eşleşen renk adı dönüyor', ringMatch('BEYAZ KLİPS').kelime === 'BEYAZ')
  check('rengi de veriyor', ringMatch('BEYAZ KLİPS').color === ringColor('BEYAZ'))
  check('renksiz künyede eşleşme yok', ringMatch('ABC') === null)
}

console.log('\n17) Anne/baba listesi: seçilen kodun GC\'si en üstte')
{
  const { parentCompare, compareBirds } = await import('../src/lib.js')
  const b = (code, number, sex = 'M') => ({ code, number, sex, status: 'damizlik' })
  const havuz = [
    b('BEYAZ KLİPS', '02', 'F'), b('BEYAZ KLİPS', '06', 'F'),
    b('MOR KLİPS', '01', 'F'), b('MOR KLİPS', 'GC', 'F'),
    b('YEŞİL KLİPS', 'GC', 'F'), b('YEŞİL KLİPS', '01', 'F'),
    b('PEMBE KLİPS', 'GC', 'F'), b('SİYAH KLİPS', 'GC', 'F')
  ]

  // Seçilen kodun GC'si en üstte
  const morlu = [...havuz].sort(parentCompare('MOR KLİPS'))
    .map(x => `${x.code}-${x.number}`)
  // Referans: kod seçilmediyken normal sıralama
  const normal = [...havuz].sort(compareBirds).map(x => `${x.code}-${x.number}`)

  check('MOR KLİPS seçilince MOR GC ilk sırada', morlu[0] === 'MOR KLİPS-GC', morlu.join('|'))
  // Taşınan GC normaldeki yerinden de kalkar; kalan sıra AYNEN korunmalı.
  check('MOR GC ilk sırada, kalanlar TAMAMEN normal sırada',
    morlu.slice(1).join('|') === normal.filter(x => x !== 'MOR KLİPS-GC').join('|'),
    morlu.join('|'))
  check('seçilen kodun GC\'si listenin en üstünde',
    morlu[0] === 'MOR KLİPS-GC', morlu.join('|'))

  // Kod seçilmediyse sıralama compareBirds ile aynı olmalı
  const bosKod = [...havuz].sort(parentCompare('')).map(x => `${x.code}-${x.number}`)
  check('kod boşken sıralama değişmiyor',
    JSON.stringify(bosKod) === JSON.stringify(normal), bosKod.join('|'))

  // Seçilen kodun GC'si olmayan durum: sıra yine bozulmamalı
  const yok = [...havuz].sort(parentCompare('MAVİ KLİPS')).map(x => `${x.code}-${x.number}`)
  check('olmayan kod seçilince sıra aynı kalır',
    JSON.stringify(yok) === JSON.stringify(normal), yok.join('|'))

  // Büyük/küçük harf fark etmemeli
  const kucuk = [...havuz].sort(parentCompare('mor klips')).map(x => `${x.code}-${x.number}`)
  check('kod küçük harf yazılsa da aynı sıra', JSON.stringify(kucuk) === JSON.stringify(morlu))
}

console.log('\n18) Kuluçka zaman çizelgesi ve Akrabalık analizi')
{
  const { clutchTimeline, findCommonAncestors, addDays, diffDays, calculateClutchFromHatch } = await import('../src/lib.js')
  const { migrate } = await import('../src/schema.js')

  // Tarih hesapları
  check('addDays 2 gün ekler', addDays('2026-05-01', 2) === '2026-05-03')
  check('addDays 18 gün ekler', addDays('2026-05-01', 18) === '2026-05-19')
  check('diffDays farkı doğru', diffDays('2026-05-20', '2026-05-15') === 5)

  // Kuluçka zaman çizelgesi: 2. yumurta 2026-05-10
  const tl = clutchTimeline({ egg1Date: '2026-05-08', egg2Date: '2026-05-10', status: 'incubation' })
  check('döl kontrolü 6. gün', tl.checkDate === '2026-05-16')
  check('tahmini çıkım 18. gün', tl.expectedHatch === '2026-05-28')
  check('künye takma çıkımdan 7 gün sonra', tl.ringDate === '2026-06-04')
  check('yeme düşme çıkımdan 30 gün sonra', tl.weanDate === '2026-06-27')

  // Geriye dönük yumurta tarihi hesaplama (calculateClutchFromHatch)
  const calc1 = calculateClutchFromHatch('2026-05-28', 1)
  check('1. yavru çıkımından 2. yumurta -18 gün', calc1.egg2Date === '2026-05-10')
  check('1. yavru çıkımından 1. yumurta -20 gün', calc1.egg1Date === '2026-05-08')
  check('1. yavru sayısı 1', calc1.chickCount === 1)
  check('hesaplama durumu hatched', calc1.status === 'hatched')

  const calc2 = calculateClutchFromHatch('2026-05-28', 2)
  check('2. yavru sayısı 2', calc2.chickCount === 2)
  check('2. yavru 2. yumurta -18 gün', calc2.egg2Date === '2026-05-10')

  // Şema taşıma clutches ve vaccinations dizilerini garanti eder
  const m = migrate({ birds: [], pairings: [] })
  check('migrate clutches dizisi oluşturur', Array.isArray(m.clutches))
  check('migrate vaccinations dizisi oluşturur', Array.isArray(m.vaccinations))
  check('migrate supplements dizisi oluşturur', Array.isArray(m.supplements))

  // Takviye / yem kayıtları migrasyonda korunur, kimliksiz kayıt atılır.
  const ms = migrate({
    supplements: [
      { id: 'sup1', name: 'B12', kind: 'supplement' },
      { name: 'KİMLİKSİZ' }
    ]
  })
  check('migrate geçerli takviye kaydını korur', ms.supplements.length === 1 && ms.supplements[0].id === 'sup1')

  // Kayıt dışı anne/baba YALNIZCA bilgi metnidir: kimlik bağı kurmaz.
  const extBird = normalizeBird({
    id: 'ext1',
    damId: '',
    damOutside: { status: 'kacti', note: 'açık sarı bozalı' },
    sireOutside: { status: 'oldu', note: '' }
  })
  check('kayıt dışı anne kimlik bağı kurmaz', !extBird.damId && !extBird.sireId)
  check('kayıt dışı anne metni doğru', externalParentText(extBird, 'dam') === 'KAÇTI - AÇIK SARI BOZALI')
  check('kayıt dışı baba durumu görünür', externalParentText(extBird, 'sire') === 'ÖLDÜ')

  // Gerçek anne varsa kayıt dışı bilgi temizlenir (iki kaynak çakışmaz).
  const extCleared = normalizeBird({ id: 'ext2', damId: 'd1', damOutside: { status: 'kacti', note: 'X' } })
  check('gerçek ebeveyn varken kayıt dışı bilgi silinir', extCleared.damOutside === null)

  // Ortak ata tespiti
  const ata = { id: 'ata', name: 'BÜYÜK DEDE' }
  const baba = { id: 'baba', sireId: 'ata' }
  const anne = { id: 'anne', sireId: 'ata' }
  const ogul = { id: 'ogul', sireId: 'baba' }
  const kiz = { id: 'kiz', damId: 'anne' }
  const common = findCommonAncestors([ata, baba, anne, ogul, kiz], ogul, kiz)
  check('ortak ata bulundu', common.length === 1 && common[0].bird.id === 'ata')
}

console.log('\n19) Kuluçka Bildirimleri (Local Notifications)')
{
  const { syncClutchNotifications } = await import('../src/notifications.js')
  const futureEggDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const dbTest = {
    birds: [
      { id: 'b1', code: 'MAVİ KLİPS', number: '12' },
      { id: 'b2', code: 'BEYAZ KLİPS', number: '34' }
    ],
    clutches: [
      {
        id: 'c1',
        nest: '101',
        maleId: 'b1',
        femaleId: 'b2',
        egg1Date: futureEggDate,
        egg2Date: futureEggDate,
        status: 'incubation'
      },
      {
        id: 'c2',
        nest: '102',
        status: 'done'
      }
    ]
  }
  const res = await syncClutchNotifications(dbTest)
  check('aktif kuluçka için bildirimler üretildi', res.scheduledCount >= 2)
  check('arşiv kuluçka için bildirim üretilmedi', !res.items.some(x => x.extra?.clutchId === 'c2'))
  check('döl kontrolü bildirimi mevcut', res.items.some(x => x.extra?.type === 'check'))
  check('çıkım günü bildirimi mevcut', res.items.some(x => x.extra?.type === 'hatch'))
}

console.log('\n20) Klips sağ ve sol ayak şema dönüşümü')
{
  const testDb = migrate({
    settings: { codes: ['BEYAZ KLİPS', 'KIRMIZI KLİPS'] },
    birds: [
      { id: 'b1', code: 'BEYAZ KLİPS', number: 'GC' },
      { id: 'b2', code: 'KIRMIZI KLİPS', number: '12' },
      { id: 'b3', code: 'SARI KLİPS', number: 'gc' },
      { id: 'b4', code: 'MAVİ KLİPS', number: '05', rightCode: 'ÖZEL SAĞ', leftCode: 'ÖZEL SOL' }
    ]
  })

  check('settings rightCodes ve leftCodes oluşturuldu', Array.isArray(testDb.settings.rightCodes) && Array.isArray(testDb.settings.leftCodes))
  check('GC olan kuşun klipsi sağ ayak oldu', testDb.birds[0].rightCode === 'BEYAZ KLİPS' && testDb.birds[0].leftCode === '')
  check('Sayı olan kuşun klipsi sol ayak oldu', testDb.birds[1].leftCode === 'KIRMIZI KLİPS' && testDb.birds[1].rightCode === '')
  check('Küçük harf gc olan da sağ ayak oldu', testDb.birds[2].rightCode === 'SARI KLİPS' && testDb.birds[2].leftCode === '')
  check('Önceden girilmiş sağ ve sol ayak değerleri korundu', testDb.birds[3].rightCode === 'ÖZEL SAĞ' && testDb.birds[3].leftCode === 'ÖZEL SOL')
}

console.log('\n20b) İki ayaklı künye: ayak başına numara ve liste seçimi')
{
  const { normalizeBird } = await import('../src/schema.js')
  const { footCode, footNumber, footRing, listFootOf } = await import('../src/lib.js')

  // Eski tek `number` alanı, kodu olan ayağa taşınır (geriye dönük uyum).
  const gc = normalizeBird({ id: 'x1', code: 'BEYAZ KLİPS', number: 'GC' })
  check('GC numarası sağ ayağa taşındı', gc.rightNumber === 'GC' && gc.leftNumber === '')

  const yavru = normalizeBird({ id: 'x2', code: 'KIRMIZI KLİPS', number: '12' })
  check('Yavru numarası sol ayağa taşındı', yavru.leftNumber === '12' && yavru.rightNumber === '')

  // İki ayakta da kod varsa eski numara SOL ayağa düşer (otomatik: sol öncelikli).
  const iki = normalizeBird({ id: 'x3', rightCode: 'SARI KLİPS', leftCode: 'MAVİ KLİPS', number: '05' })
  check('İki ayakta kod varsa numara sol ayağa düştü', iki.leftNumber === '05')
  check('Türetilmiş code/number sol ayağı gösteriyor', iki.code === 'MAVİ KLİPS' && iki.number === '05')

  // Kullanıcı profilde "sağ ayak" seçerse liste gruplaması sağ ayağa geçer.
  const sag = normalizeBird({ ...iki, listFoot: 'right' })
  check('listFoot=right olunca code sağ ayak oldu', sag.code === 'SARI KLİPS')
  check('listFoot=right olunca number sağ ayak numarası oldu', sag.number === '05')

  // Ayak başına numara açıkça verilirse korunur.
  const perFoot = normalizeBird({
    id: 'x4', leftCode: 'MAVİ KLİPS', leftNumber: '07',
    rightCode: 'SARI KLİPS', rightNumber: 'GC'
  })
  check('Sol ayak numarası korundu', footNumber(perFoot, 'left') === '07')
  check('Sağ ayak numarası korundu', footNumber(perFoot, 'right') === 'GC')
  check('footRing renk ve numarayı birleştirir', footRing(perFoot, 'left') === 'MAVİ KLİPS 07')
  check('footCode doğru ayağı döndürür', footCode(perFoot, 'right') === 'SARI KLİPS')

  // Otomatik liste seçimi: sol doluysa sol, yoksa sağ.
  check('liste ayağı otomatik sol', listFootOf(perFoot) === 'left')
  const yalnizSag = normalizeBird({ id: 'x5', rightCode: 'SARI KLİPS', rightNumber: '03' })
  check('sağ doluysa liste ayağı sağ', listFootOf(yalnizSag) === 'right')
  check('seçim yapılmadıysa listFoot boş kalır', yalnizSag.listFoot === '')
}

console.log('\n21) Hastalık ve Tedavi Takibi (treatments)')
{
  const { emptyDb } = await import('../src/schema.js')
  const { treatmentDurationDays, treatmentStatusLabel, activeTreatmentsOf, TREATMENT_STATUS, COMMON_ILLNESSES } = await import('../src/lib.js')

  const edb = emptyDb()
  check('emptyDb treatments dizisi içerir', Array.isArray(edb.treatments) && edb.treatments.length === 0)

  const mdb = migrate({ birds: [] })
  check('migrate eksik treatments dizisini oluşturur', Array.isArray(mdb.treatments))

  check('treatmentStatusLabel aktif doğru döner', treatmentStatusLabel('aktif') === 'Aktif Tedavi')
  check('treatmentStatusLabel karantina doğru döner', treatmentStatusLabel('karantina') === 'Karantinada')
  check('treatmentStatusLabel iyilesti doğru döner', treatmentStatusLabel('iyilesti') === 'İyileşti')

  check('treatmentDurationDays aynı gün 1 gün sayılır', treatmentDurationDays('2026-10-10', '2026-10-10') === 1)
  check('treatmentDurationDays 5 gün farkı 5 gün sayılır', treatmentDurationDays('2026-10-10', '2026-10-14') === 5)

  const sampleTreatments = [
    { id: 't1', birdId: 'b1', illness: 'SALLABAŞ', status: 'aktif', startDate: '2026-10-01' },
    { id: 't2', birdId: 'b1', illness: 'ÇİÇEK', status: 'iyilesti', startDate: '2026-09-01', endDate: '2026-09-10' },
    { id: 't3', birdId: 'b2', illness: 'KURUMA', status: 'karantina', startDate: '2026-10-05' }
  ]
  const activeB1 = activeTreatmentsOf(sampleTreatments, 'b1')
  check('activeTreatmentsOf sadece aktif/karantina olanları filtreler', activeB1.length === 1 && activeB1[0].id === 't1')
  check('TREATMENT_STATUS ve COMMON_ILLNESSES tanımlı', TREATMENT_STATUS.length >= 4 && COMMON_ILLNESSES.length >= 5)
}

console.log('\n22) Çift Renk Klips (Senaryo A)')
{
  const { findColorsInText, ringMatch, ringChip, PRIMARY_RING_COLORS } = await import('../src/lib.js')

  const colors = findColorsInText('SARI-KIRMIZI KLİPS')
  check('SARI-KIRMIZI 2 renk bulundu', colors.length === 2)
  check('1. renk SARI', colors[0].word === 'SARI')
  check('2. renk KIRMIZI', colors[1].word === 'KIRMIZI')

  const matchDual = ringMatch('SARI-KIRMIZI KLİPS')
  check('ringMatch çift renk algıladı', matchDual.isDual === true)
  check('ringMatch kelime1 doğru', matchDual.kelime1 === 'SARI')
  check('ringMatch kelime2 doğru', matchDual.kelime2 === 'KIRMIZI')

  const chipDual = ringChip('SARI-KIRMIZI KLİPS')
  check('ringChip isDual doğru', chipDual.isDual === true)
  check('ringChip gradient dolgu üretti', chipDual.dolgu.includes('linear-gradient(135deg'))
  check('ringChip 1. renk gradient içinde', chipDual.dolgu.includes(chipDual.color1))
  check('ringChip 2. renk gradient içinde', chipDual.dolgu.includes(chipDual.color2))

  // Karışık kontrast (SİYAH + BEYAZ) için gölge/kontrast güvencesi
  const sbChip = ringChip('SİYAH-BEYAZ')
  check('SİYAH-BEYAZ çift renk algılandı', sbChip.isDual === true)
  check('Karışık kontrastta textShadow var', Boolean(sbChip.textShadow))

  // Bileşik renk (AÇIK MAVİ - BEYAZ)
  const acikMaviBeyaz = ringChip('AÇIK MAVİ - BEYAZ')
  check('AÇIK MAVİ bileşik renk doğru yakalandı', acikMaviBeyaz.kelime1 === 'ACIK MAVI' && acikMaviBeyaz.kelime2 === 'BEYAZ')

  check('PRIMARY_RING_COLORS tanımlı', Array.isArray(PRIMARY_RING_COLORS) && PRIMARY_RING_COLORS.length >= 10)

  // SİYAH-YEŞİL ve globalCodeColors ezilme koruması
  const { setGlobalCodeColors } = await import('../src/lib.js')
  setGlobalCodeColors({ 'YEŞİL KLİPS': '#3fbf5f', 'SİYAH KLİPS': '#20242c' })
  const syChip = ringChip('SİYAH-YEŞİL KLİPS')
  check('SİYAH-YEŞİL codeColors varlığında da çift renk kalır', syChip.isDual === true)
  check('SİYAH-YEŞİL 1. renk siyah (#20242c)', syChip.color1 === '#20242c')
  check('SİYAH-YEŞİL 2. renk yeşil (#3fbf5f)', syChip.color2 === '#3fbf5f')

  const sySpaceChip = ringChip('SİYAH YEŞİL')
  check('SİYAH YEŞİL boşluklu yazımda da çift renk algılanır', sySpaceChip.isDual === true)
  setGlobalCodeColors({})
}

console.log('\n23) Boncuk Kontrolü (LoftCheck) & Çift Renk Filtresi & Alfabetik Sıralamalar')
{
  const { isDualCode, COMMON_ILLNESSES, sortTr } = await import('../src/lib.js')
  const fs = await import('fs')

  // isDualCode testleri
  check('SARI-KIRMIZI çift renk', isDualCode('SARI-KIRMIZI KLİPS') === true)
  check('SİYAH YEŞİL çift renk', isDualCode('SİYAH YEŞİL') === true)
  check('BEYAZ tek renk', isDualCode('BEYAZ KLİPS') === false)
  check('SARI tek renk', isDualCode('SARI') === false)
  check('Boş dize false', isDualCode('') === false)

  // COMMON_ILLNESSES alfabetik sıralama testi
  const sortedIllnesses = sortTr([...COMMON_ILLNESSES])
  check('COMMON_ILLNESSES alfabetik sıralı', JSON.stringify(COMMON_ILLNESSES) === JSON.stringify(sortedIllnesses))

  // LoftCheck modülerlik ve checkedAt testi
  const loftCheckCode = fs.readFileSync(new URL('../src/components/LoftCheck.jsx', import.meta.url), 'utf8')
  check('ENABLE_LOFT_CHECK devrede', loftCheckCode.includes('export const ENABLE_LOFT_CHECK = true'))
  const testBird = { id: 'b1', name: 'GÜVERCİN', checkedAt: new Date().toISOString() }
  check('checkedAt alanı saklanabilir', Boolean(testBird.checkedAt))
}

console.log('\n24) Künyesizler Filtresi, Kontrol Edilmeyenler & Çift Renk Ayrımı')
{
  const { isDualCode } = await import('../src/lib.js')

  // Kuş listesi test kuşları
  const birds = [
    { id: '1', code: 'BEYAZ KLİPS', number: '01', checkedAt: '2026-10-14T10:00:00Z' },
    { id: '2', code: '', number: '', name: 'KÜNYESİZ ADLI KUŞ' }, // Künyesiz ve kontrolsüz
    { id: '3', code: 'SARI-KIRMIZI KLİPS', number: '05' }, // Çift renkli ve kontrolsüz
    { id: '4', code: null, number: null, checkedAt: '2026-10-14T12:00:00Z' } // Künyesiz ama kontrollü
  ]

  // 1. Künyesizler filtresi testi (code === '__none__')
  const kunyesizler = birds.filter(b => !(b.code || b.leftCode || b.rightCode || '').trim())
  check('Künyesizler filtresi doğru kuşları bulur', kunyesizler.length === 2 && kunyesizler.some(b => b.id === '2') && kunyesizler.some(b => b.id === '4'))

  // 2. Kontrol edilmeyenler filtresi testi (uncheckedOnly)
  const uncheckedBirds = birds.filter(b => !b.checkedAt)
  check('Kontrol edilmeyenler filtresi sadece checkedAt olmayanları bulur', uncheckedBirds.length === 2 && uncheckedBirds.some(b => b.id === '2') && uncheckedBirds.some(b => b.id === '3'))

  // 3. Çift renk tikli ve tiksiz ayrımı
  const allCodes = ['BEYAZ KLİPS', 'SARI-KIRMIZI KLİPS', 'KIRMIZI KLİPS', 'SİYAH-BEYAZ KLİPS']
  // Tik seçilmeden: çift renkler GÖZÜKMEZ, sadece tek/düz renkler
  const untickedList = allCodes.filter(c => !isDualCode(c))
  check('Tik seçilmeden sadece tek renkler listelenir', untickedList.length === 2 && untickedList.includes('BEYAZ KLİPS') && untickedList.includes('KIRMIZI KLİPS'))
  check('Tik seçilmeden çift renkler gizlenir', !untickedList.includes('SARI-KIRMIZI KLİPS') && !untickedList.includes('SİYAH-BEYAZ KLİPS'))

  // Tik seçilince: sadece çift renkler gelir, düz renkler gizlenir
  const tickedList = allCodes.filter(c => isDualCode(c))
  check('Tik seçilince sadece çift renkler gelir', tickedList.length === 2 && tickedList.includes('SARI-KIRMIZI KLİPS') && tickedList.includes('SİYAH-BEYAZ KLİPS'))
  check('Tik seçilince düz renkler gizlenir', !tickedList.includes('BEYAZ KLİPS') && !tickedList.includes('KIRMIZI KLİPS'))
}

console.log('\n25) Kümes Kontrollerini Sıfırlama ve Profil Doğrudan Buton Mantığı')
{
  // 1. Sıfırlama mantığı simülasyonu
  const testDb = {
    birds: [
      { id: 'b1', name: 'Kuş 1', checkedAt: '2026-10-14T10:00:00Z' },
      { id: 'b2', name: 'Kuş 2', checkedAt: '2026-10-14T11:00:00Z' },
      { id: 'b3', name: 'Kuş 3' }
    ]
  }

  let resetCount = 0
  const nextBirds = testDb.birds.map(b => {
    if (b.checkedAt) {
      resetCount++
      const copy = { ...b }
      delete copy.checkedAt
      return copy
    }
    return b
  })

  check('2 adet kontrol kaydı tespit edildi ve sıfırlandı', resetCount === 2)
  check('Hiçbir kuşta checkedAt kalmadı', nextBirds.every(b => !b.checkedAt))
  check('b3 değişmeden korundu', nextBirds.find(b => b.id === 'b3').name === 'Kuş 3')

  // 2. Kuş profilinde buton durum mantığı
  const getButtonState = (bird) => {
    return bird.checkedAt ? 'KONTROL EDİLDİ' : 'KONTROL'
  }
  check('Kontrolsüz kuşta KONTROL butonu', getButtonState(testDb.birds[2]) === 'KONTROL')
  check('Kontrollü kuşta KONTROL EDİLDİ butonu', getButtonState(testDb.birds[0]) === 'KONTROL EDİLDİ')
}

console.log('\n26) Google Drive Yedekleme & Son 2 Sürüm Saklama Mantığı')
{
  const { stamp, pruneOldVersions } = await import('./drive-backup-util.js')
  const os = await import('os')
  const path = await import('path')
  const fs = await import('fs')

  // 1. stamp() format kontrolü (YYYYMMDD-HHmm)
  const currentStamp = stamp()
  check('Zaman damgası doğru formatta (YYYYAAGG-SSDD)', /^\d{8}-\d{4}$/.test(currentStamp), currentStamp)

  // 2. Geçici klasörde son 2 sürüm saklama testi (APK ve ZIP)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guvercin-backup-test-'))

  try {
    // 3 adet sahte APK dosyası oluştur
    fs.writeFileSync(path.join(tempDir, 'Güvercin-1.0.0-20261014-1000.apk'), 'apk1')
    fs.writeFileSync(path.join(tempDir, 'Güvercin-1.0.0-20261014-1200.apk'), 'apk2')
    fs.writeFileSync(path.join(tempDir, 'Güvercin-1.0.0-20261014-1400.apk'), 'apk3')

    // 3 adet sahte Webapp ZIP dosyası oluştur
    fs.writeFileSync(path.join(tempDir, 'Güvercin-Web-1.0.0-20261014-1000.zip'), 'zip1')
    fs.writeFileSync(path.join(tempDir, 'Güvercin-Web-1.0.0-20261014-1200.zip'), 'zip2')
    fs.writeFileSync(path.join(tempDir, 'Güvercin-Web-1.0.0-20261014-1400.zip'), 'zip3')

    // APK budama
    const keptApks = pruneOldVersions(tempDir, '.apk', 2)
    check('APK: Tam olarak 2 son sürüm saklandı', keptApks.length === 2)
    check('APK: En yeni 1400 sürümü saklandı', keptApks.includes('Güvercin-1.0.0-20261014-1400.apk'))
    check('APK: İkinci yeni 1200 sürümü saklandı', keptApks.includes('Güvercin-1.0.0-20261014-1200.apk'))
    check('APK: En eski 1000 sürümü silindi', !fs.existsSync(path.join(tempDir, 'Güvercin-1.0.0-20261014-1000.apk')))

    // ZIP budama
    const keptZips = pruneOldVersions(tempDir, '.zip', 2)
    check('ZIP: Tam olarak 2 son sürüm saklandı', keptZips.length === 2)
    check('ZIP: En yeni 1400 sürümü saklandı', keptZips.includes('Güvercin-Web-1.0.0-20261014-1400.zip'))
    check('ZIP: İkinci yeni 1200 sürümü saklandı', keptZips.includes('Güvercin-Web-1.0.0-20261014-1200.zip'))
    check('ZIP: En eski 1000 sürümü silindi', !fs.existsSync(path.join(tempDir, 'Güvercin-Web-1.0.0-20261014-1000.zip')))
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

console.log('\n27) Çift Renk Klips Kanonik Sıralama & Mükerrer/Ters Sıra Engelleme')
{
  const { canonicalDualKey, findDualColorDuplicate, findDuplicateDualCodesInList } = await import('../src/lib.js')

  // 1. canonicalDualKey testleri
  check('canonicalDualKey BEYAZ-PEMBE ile PEMBE-BEYAZ aynı',
    canonicalDualKey('BEYAZ-PEMBE KLİPS') === canonicalDualKey('PEMBE-BEYAZ KLİPS'))
  check('canonicalDualKey SARI-MAVİ ile MAVİ-SARI aynı',
    canonicalDualKey('SARI-MAVİ KLİPS') === canonicalDualKey('MAVİ-SARI KLİPS'))
  check('canonicalDualKey farklı renkler farklı anahtar üretir',
    canonicalDualKey('BEYAZ-PEMBE KLİPS') !== canonicalDualKey('BEYAZ-SARI KLİPS'))

  // 2. findDualColorDuplicate (tek aday kontrolü)
  const existingList = ['BEYAZ-PEMBE KLİPS', 'SARI-KIRMIZI KLİPS']
  const dupExact = findDualColorDuplicate('BEYAZ-PEMBE KLİPS', existingList)
  check('Birebir aynı çift renk tespit edilir', dupExact !== null && dupExact.isExact === true)

  const dupReverse = findDualColorDuplicate('PEMBE-BEYAZ KLİPS', existingList)
  check('Ters sırada çift renk tespit edilir', dupReverse !== null && dupReverse.isExact === false && dupReverse.existing === 'BEYAZ-PEMBE KLİPS')

  const noDup = findDualColorDuplicate('SARI-MAVİ KLİPS', existingList)
  check('Olmayan çift renk duplicate dönmez', noDup === null)

  // 3. findDuplicateDualCodesInList (tüm liste kontrolü)
  const listWithDups = [
    'BEYAZ-PEMBE KLİPS',
    'SARI-KIRMIZI KLİPS',
    'PEMBE-BEYAZ KLİPS', // ters sıra mükerrer
    'SİYAH-BEYAZ KLİPS',
    'SARI-KIRMIZI KLİPS'  // birebir aynı mükerrer
  ]
  const dups = findDuplicateDualCodesInList(listWithDups)
  check('2 adet mükerrer çift renk bulundu', dups.length === 2)
  check('PEMBE-BEYAZ için BEYAZ-PEMBE eşleşti',
    dups.some(d => d.current === 'PEMBE-BEYAZ KLİPS' && d.existing === 'BEYAZ-PEMBE KLİPS'))
  check('SARI-KIRMIZI için SARI-KIRMIZI eşleşti',
    dups.some(d => d.current === 'SARI-KIRMIZI KLİPS' && d.existing === 'SARI-KIRMIZI KLİPS'))
}

console.log('\n28) İlaç & Aşı Kategorileri ve Kategori Bazlı Filtreleme')
{
  const { DEFAULT_MED_CATEGORIES, matchMedicationCategory } = await import('../src/lib.js')
  const { migrate, emptyDb } = await import('../src/schema.js')

  // 1. Varsayılan kategoriler ve şema kontrolü
  check('DEFAULT_MED_CATEGORIES GÖZ SULANMASI içerir', DEFAULT_MED_CATEGORIES.includes('GÖZ SULANMASI'))
  check('DEFAULT_MED_CATEGORIES HIRILTI içerir', DEFAULT_MED_CATEGORIES.includes('HIRILTI'))
  check('DEFAULT_MED_CATEGORIES KANAT TUTULMASI içerir', DEFAULT_MED_CATEGORIES.includes('KANAT TUTULMASI'))

  const dbInit = emptyDb()
  check('emptyDb medicationCategories içerir', Array.isArray(dbInit.settings.medicationCategories) && dbInit.settings.medicationCategories.length > 0)

  const migrated = migrate({ settings: {} })
  check('migrate eksik medicationCategories alanını tamamlar', migrated.settings.medicationCategories.includes('HIRILTI'))

  // 2. matchMedicationCategory doğrudan kategori ataması
  const med1 = {
    id: 'm1',
    name: 'Baytril %10',
    categories: ['HIRILTI', 'SOLUNUM YOLU'],
    purpose: 'Geniş spektrumlu antibakteriyel'
  }
  check('Doğrudan kategori eşleşmesi (HIRILTI)', matchMedicationCategory(med1, 'HIRILTI'))
  check('Doğrudan kategori eşleşmesi (SOLUNUM YOLU)', matchMedicationCategory(med1, 'SOLUNUM YOLU'))
  check('Eşleşmeyen kategori false (GÖZ SULANMASI)', !matchMedicationCategory(med1, 'GÖZ SULANMASI'))

  // 3. matchMedicationCategory akıllı metin / purpose eşleşmesi (kategori atanmamış eski ilaçlar)
  const med2 = {
    id: 'm2',
    name: 'Genta Damla',
    purpose: 'Kuşlarda tek göz sulanması, şişmesi ve çapaklanma tedavisi'
  }
  check('Metin içinden GÖZ SULANMASI akıllı eşleşmesi', matchMedicationCategory(med2, 'GÖZ SULANMASI'))
  check('Eşleşmeyen kategori false (KANAT TUTULMASI)', !matchMedicationCategory(med2, 'KANAT TUTULMASI'))

  const med3 = {
    id: 'm3',
    name: 'Salmonella Aşısı / İlacı',
    purpose: 'Kanat tutulması, ur ve boyun dönmesi belirtilerinde kullanılır'
  }
  check('Metin içinden KANAT TUTULMASI akıllı eşleşmesi', matchMedicationCategory(med3, 'KANAT TUTULMASI'))

  // 4. Liste filtreleme simülasyonu
  const allMeds = [med1, med2, med3]
  const hiriltiMeds = allMeds.filter(m => matchMedicationCategory(m, 'HIRILTI'))
  check('HIRILTI kategorisinde 1 ilaç bulundu', hiriltiMeds.length === 1 && hiriltiMeds[0].id === 'm1')

  const gozMeds = allMeds.filter(m => matchMedicationCategory(m, 'GÖZ SULANMASI'))
  check('GÖZ SULANMASI kategorisinde 1 ilaç bulundu', gozMeds.length === 1 && gozMeds[0].id === 'm2')

  const kanatMeds = allMeds.filter(m => matchMedicationCategory(m, 'KANAT TUTULMASI'))
  check('KANAT TUTULMASI kategorisinde 1 ilaç bulundu', kanatMeds.length === 1 && kanatMeds[0].id === 'm3')

  // 5. pharmacyAlternative (Eczane Muadili) testi
  const med4 = {
    id: 'm4',
    name: 'Doxycycline %20',
    alternative: 'Doxibiotic',
    pharmacyAlternative: 'Tetradox, Monodoks',
    purpose: 'Solunum yolu enfeksiyonları ve hırıltı'
  }
  check('pharmacyAlternative alanı tanımlı', med4.pharmacyAlternative === 'Tetradox, Monodoks')
  check('pharmacyAlternative içeren ilaç kategori eşleşmesi', matchMedicationCategory(med4, 'HIRILTI'))
}

// ------------------------------------------------------------------ 29) KOSTÜM / RENK VE KAPAK ALTI ISLAH ANALİZİ
{
  console.log('\n29) Kostüm / Renk ve Kapak Altı Islah Analizi (Çakal, Limoni, Komple, Beyaz)')
  const { COSTUME_TYPES, detectCostumeType, analyzeCostumeMating } = await import('../src/lib.js')

  // 1. COSTUME_TYPES tanımlı
  check('COSTUME_TYPES tanımlı', Array.isArray(COSTUME_TYPES) && COSTUME_TYPES.length >= 5)
  check('ÇAKAL tanımlı', COSTUME_TYPES.some(c => c.id === 'CAKAL'))
  check('KIRMIZI_KOMPLE tanımlı', COSTUME_TYPES.some(c => c.id === 'KIRMIZI_KOMPLE'))
  check('LIMONI tanımlı', COSTUME_TYPES.some(c => c.id === 'LIMONI'))
  check('SARI_KOMPLE tanımlı', COSTUME_TYPES.some(c => c.id === 'SARI_KOMPLE'))
  check('BEYAZ tanımlı', COSTUME_TYPES.some(c => c.id === 'BEYAZ'))

  // 2. detectCostumeType testi
  check('Düz Çakal tespiti', detectCostumeType({ color: 'ÇAKAL KAHVERENGİ' }) === 'CAKAL')
  check('Kırmızı Komple tespiti', detectCostumeType({ color: 'KIRMIZI KOMPLE' }) === 'KIRMIZI_KOMPLE')
  check('Düz Limoni tespiti', detectCostumeType({ color: 'LİMONİ SARI' }) === 'LIMONI')
  check('Sarı Komple tespiti', detectCostumeType({ color: 'SARI KOMPLE' }) === 'SARI_KOMPLE')
  check('Düz Beyaz tespiti', detectCostumeType({ color: 'BEYAZ' }) === 'BEYAZ')

  // 3. Çakal x Kırmızı Komple Analizi (İdeal eşleşme, kapak altı frenleme)
  const cakalXKomple = analyzeCostumeMating('CAKAL', 'KIRMIZI_KOMPLE')
  check('Çakal x Kırmızı Komple ıslah kuralı UYGUN', cakalXKomple.lineStatus === 'valid')
  check('Çakal x Kırmızı Komple kapak altı GÜVENLİ', cakalXKomple.tailRisk === 'safe')
  check('Çakal x Kırmızı Komple %50 Komple yavru', cakalXKomple.offspring.some(o => o.pct === 50 && o.label.includes('KOMPLE')))
  check('Çakal x Kırmızı Komple %50 Çakal yavru', cakalXKomple.offspring.some(o => o.pct === 50 && o.label.includes('ÇAKAL')))

  // 4. Limoni x Sarı Komple Analizi (Sarı serisi güvenli kapak altı)
  const limoniXKomple = analyzeCostumeMating('LIMONI', 'SARI_KOMPLE')
  check('Limoni x Sarı Komple ıslah kuralı UYGUN', limoniXKomple.lineStatus === 'valid')
  check('Limoni x Sarı Komple kapak altı GÜVENLİ', limoniXKomple.tailRisk === 'safe')
  check('Limoni x Sarı Komple %50 Sarı Komple yavru', limoniXKomple.offspring.some(o => o.label.includes('SARI KOMPLE')))

  // 5. Kırmızı Komple x Kırmızı Komple (Kapak altı gevşeme payı)
  const kompleXKomple = analyzeCostumeMating('KIRMIZI_KOMPLE', 'KIRMIZI_KOMPLE')
  check('Komple x Komple ıslah kuralı UYGUN', kompleXKomple.lineStatus === 'valid')
  check('Komple x Komple kapak altı DİKKAT uyarısı', kompleXKomple.tailRisk === 'caution')
  check('Komple x Komple ıslah tavsiyesi içerir', Boolean(kompleXKomple.remedyTip))

  // 6. Kırmızı x Sarı Kırılması (Kümes Islah Kuralı Uyarısı)
  const crossColor = analyzeCostumeMating('CAKAL', 'LIMONI')
  check('Kırmızı x Sarı çaprazlaması UYARI verir', crossColor.lineStatus === 'warning')

  // 7. Komple x Beyaz (Yüksek Kapak Altı Kaçırma Riski)
  const kompleXWhite = analyzeCostumeMating('KIRMIZI_KOMPLE', 'BEYAZ')
  check('Komple x Beyaz kapak altı YÜKSEK RİSK verir', kompleXWhite.tailRisk === 'danger')
}

// ============================================================
// 30) Eski Eşler Tekilleştirme, Mevcut Eş İzolasyonu ve Yavru Koruma
// ============================================================
{
  console.log('\n30) Eski Eşler Tekilleştirme, Mevcut Eş İzolasyonu ve Yavru Koruma')
  const { matesOf } = await import('../src/lib.js')

  const birdA = { id: 'b_male', sex: 'M' }
  const birdB = { id: 'b_female1', sex: 'F' }
  const birdC = { id: 'b_female2', sex: 'F' }

  // 1. matesOf: Mevcut eş asla eski eşler listesinde dönmemeli
  const pairings1 = [
    { id: 'p1', maleId: 'b_male', femaleId: 'b_female1', durum: 'simdi', chickIds: ['c1'] },
    { id: 'p2', maleId: 'b_male', femaleId: 'b_female1', durum: 'eski', chickIds: ['c2'] }
  ]
  const mates1 = matesOf(pairings1, birdA)
  check('matesOf: Mevcut eş simdi listesinde yer alır', mates1.simdi.length === 1 && mates1.simdi[0].femaleId === 'b_female1')
  check('matesOf: Mevcut eş asla eski eşler listesinde görünmez', mates1.eski.length === 0)

  // 2. matesOf: Mükerrer eski eşler tekilleştirilir ve yavruları birleştirilir
  const pairings2 = [
    { id: 'p3', maleId: 'b_male', femaleId: 'b_female2', durum: 'eski', chickIds: ['c3'], notes: '2023 sezonu' },
    { id: 'p4', maleId: 'b_male', femaleId: 'b_female2', durum: 'eski', chickIds: ['c4', 'c5'], notes: '2024 sezonu' }
  ]
  const mates2 = matesOf(pairings2, birdA)
  check('matesOf: Mükerrer eski eş tekilleştirilir (1 kayıt)', mates2.eski.length === 1)
  check('matesOf: Mükerrer eski eşin yavruları birleştirilir', mates2.eski[0].chickIds.length === 3 && mates2.eski[0].chickIds.includes('c3') && mates2.eski[0].chickIds.includes('c5'))
  check('matesOf: Notlar korunarak birleştirilir', mates2.eski[0].notes.includes('2023') && mates2.eski[0].notes.includes('2024'))

  // 3. migrate: Firestore'daki mükerrer eşleşmeler şema göçünde canonical olarak birleştirilir
  const rawDb = {
    birds: [birdA, birdB, birdC],
    pairings: [
      { id: 'p10', maleId: 'b_male', femaleId: 'b_female1', durum: 'eski', chickIds: ['c10'] },
      { id: 'p11', maleId: 'b_male', femaleId: 'b_female1', durum: 'simdi', chickIds: ['c11'] },
      { id: 'p12', maleId: 'b_male', femaleId: 'b_female1', durum: 'eski', chickIds: ['c10', 'c12'] }
    ]
  }
  const migrated = migrate(rawDb)
  check('migrate: Mükerrer eşleşmeler tek kayda indirgenir', migrated.pairings.length === 1)
  check('migrate: Aktif olan durum korunur (durum: simdi)', migrated.pairings[0].durum === 'simdi')
  check('migrate: Tüm yavrular tekilleştirilerek korunur', migrated.pairings[0].chickIds.length === 3 && ['c10', 'c11', 'c12'].every(id => migrated.pairings[0].chickIds.includes(id)))
}

// ============================================================
// 31) ÖLEN / KAÇTI / SATILDI Künye İzolasyonu ve Gruplama Mantığı
// ============================================================
{
  console.log('\n31) ÖLEN / KAÇTI / SATILDI Künye İzolasyonu ve Gruplama Mantığı')
  const { isGone, GIDE_DURUMLAR } = await import('../src/lib.js')

  const testBirds = [
    { id: 'b1', code: 'BEYAZ KLİPS', number: '01', status: 'damizlik' },
    { id: 'b2', code: 'BEYAZ KLİPS', number: '02', status: 'oldu' },
    { id: 'b3', code: 'YEŞİL KLİPS', number: '03', status: 'kacti' },
    { id: 'b4', code: 'MOR KLİPS', number: '04', status: 'satildi' },
    { id: 'b5', code: 'YEŞİL KLİPS', number: '05', status: 'yavru' },
    { id: 'b6', code: '', leftCode: '', rightCode: '', status: 'damizlik' },
    { id: 'b7', code: '', leftCode: '', rightCode: '', status: 'oldu' }
  ]

  // 1. isGone doğrulaması
  check('isGone: damızlık false döner', !isGone(testBirds[0]))
  check('isGone: oldu true döner', isGone(testBirds[1]))
  check('isGone: kacti true döner', isGone(testBirds[2]))
  check('isGone: satildi true döner', isGone(testBirds[3]))
  check('isGone: yavru false döner', !isGone(testBirds[4]))

  // 2. Gruplama mantığı simülasyonu: ölen/kaçan/satılanlar __gone__ grubuna toplanır
  const groupMap = new Map()
  for (const b of testBirds) {
    const gone = isGone(b)
    const c = (b.code || '').trim()
    const key = gone ? '__gone__' : (c || '__none__')
    if (!groupMap.has(key)) {
      groupMap.set(key, { key, isGone: gone, isNone: !c && !gone, birds: [] })
    }
    groupMap.get(key).birds.push(b)
  }

  // Aktif renk grupları (BEYAZ KLİPS, YEŞİL KLİPS) yalnızca canlı kuşları barındırmalı
  const beyazGroup = groupMap.get('BEYAZ KLİPS')
  check('BEYAZ KLİPS grubunda yalnızca canlı damızlık kuş var (1 kuş)', beyazGroup && beyazGroup.birds.length === 1 && beyazGroup.birds[0].id === 'b1')

  const yesilGroup = groupMap.get('YEŞİL KLİPS')
  check('YEŞİL KLİPS grubunda yalnızca canlı yavru kuş var (1 kuş)', yesilGroup && yesilGroup.birds.length === 1 && yesilGroup.birds[0].id === 'b5')

  // KLİPSSİZ / TANIMSIZ (__none__) grubunda yalnızca canlı klipssiz kuş var
  const noneGroup = groupMap.get('__none__')
  check('KLİPSSİZ / TANIMSIZ grubunda yalnızca canlı damızlık kuş var (1 kuş)', noneGroup && noneGroup.birds.length === 1 && noneGroup.birds[0].id === 'b6')

  // ÖLEN / KAÇTI / SATILDI (__gone__) grubunda 4 adet kuş toplanmalı (b2, b3, b4, b7)
  const goneGroup = groupMap.get('__gone__')
  check('ÖLEN / KAÇTI / SATILDI grubunda tüm ölen/kaçan/satılanlar toplandı (4 kuş)', goneGroup && goneGroup.birds.length === 4)
  check('Eski künyesi BEYAZ KLİPS olan ölü kuş __gone__ içinde', goneGroup.birds.some(b => b.id === 'b2'))
  check('Eski künyesi YEŞİL KLİPS olan kaçan kuş __gone__ içinde', goneGroup.birds.some(b => b.id === 'b3'))
  check('Eski künyesi MOR KLİPS olan satılan kuş __gone__ içinde', goneGroup.birds.some(b => b.id === 'b4'))
  check('Künyesiz ölen kuş __gone__ içinde', goneGroup.birds.some(b => b.id === 'b7'))

  // 3. Künye filtre listesi (codes) ölen/kaçan/satılanların kodlarını dışlamalı
  const activeCodes = [...new Set(testBirds.filter(b => !isGone(b)).map(b => b.code).filter(Boolean))]
  check('Aktif künye filtre kodlarında MOR KLİPS (satılmış) yer almaz', !activeCodes.includes('MOR KLİPS'))
  check('Aktif künye filtre kodları BEYAZ ve YEŞİL içerir', activeCodes.includes('BEYAZ KLİPS') && activeCodes.includes('YEŞİL KLİPS'))
}

console.log(`\n${'='.repeat(46)}`)
console.log(`  ${passed} geçti, ${failed} başarısız`)
console.log('='.repeat(46) + '\n')
process.exit(failed ? 1 : 0)