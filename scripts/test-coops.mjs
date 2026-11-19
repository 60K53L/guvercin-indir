/**
 * Çoklu kümes (coop) veri katmanı testleri.
 *
 * Kural: kümes seçiliyken A kümesinin görünümünde B kümesinin kuşları,
 * çiftleşmeleri, kuluçkaları ve kuşa bağlı tedavileri görünmemeli.
 * Aşı/ilaç tanımları ortak bazdır.
 */
import { emptyDb, migrate } from '../src/schema.js'
import { childrenOf } from '../src/lib.js'
import {
  ALL_COOPS, DEFAULT_COOP_ID, DEFAULT_COOP_NAME,
  birdCoopId, birdInCoop, coopById, coopCinsiList, coopList, coopMatingBreakdown, coopStats,
  fallbackCoopId, findCoopRingDuplicate, nextCoopName, normalizeCoops,
  resolveBirdCoopId, scopeDb, withCoopCinsi
} from '../src/coops.js'

let pass = 0
let fail = 0
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (detail ? `  → ${detail}` : '')) }
}

const ids = list => list.map(x => x.id).sort()
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('\n1) Varsayılan ve boş veritabanı')
{
  const db = emptyDb()
  check('tek varsayılan kümes var', db.settings.coops.length === 1)
  check('kimlik coop_ana', db.settings.coops[0].id === DEFAULT_COOP_ID)
  check('ad ANA KÜMES', db.settings.coops[0].name === DEFAULT_COOP_NAME)
  check('Tümü boş string', ALL_COOPS === '')
}

console.log('\n2) Eski kayıttan geçiş (migration)')
{
  const db = migrate({
    birds: [
      { id: 'b1', code: 'MAVI' },
      { id: 'b2', code: 'SARI' }
    ],
    settings: { loftName: 'YILDIZ POSTA KÜMESİ' }
  })
  check('varsayılan kümes üretildi', db.settings.coops.length === 1)
  check('ad loftName’den geldi', db.settings.coops[0].name === 'YILDIZ POSTA KÜMESİ')
  check('tüm kuşlar varsayılana bağlandı',
    db.birds.every(b => b.coopId === db.settings.coops[0].id))
  check('şema sürümü 2', db.version === 2)
}

console.log('\n3) Mevcut kümesler ve eksik/geçersiz atama')
{
  const db = migrate({
    birds: [
      { id: 'b1', code: 'A1' },
      { id: 'b2', code: 'B1', coopId: 'coop_b' },
      { id: 'b3', code: 'X1', coopId: 'silinmis_kumes' }
    ],
    settings: {
      coops: [
        { id: 'coop_a', name: 'ÇATI 1', order: 0 },
        { id: 'coop_b', name: 'ÇATI 2', order: 1 }
      ]
    }
  })
  const byId = Object.fromEntries(db.birds.map(b => [b.id, b]))
  check('eksik coopId ilk kümese düştü', byId.b1.coopId === 'coop_a')
  check('geçerli coopId korundu', byId.b2.coopId === 'coop_b')
  check('geçersiz coopId ilk kümese düştü', byId.b3.coopId === 'coop_a')
  check('isimler Türkçe büyük harf', db.settings.coops[0].name === 'ÇATI 1')
}

console.log('\n4) normalizeCoops güvenliği')
{
  const list = normalizeCoops([
    { id: '', name: 'çatı 1' },
    { id: 'coop_a', name: 'ÇATI 1' },
    { id: 'coop_a', name: 'ikinci' },
    { id: 'coop_c', name: '' }
  ])
  check('dört kümes korundu', list.length === 4)
  check('boş kimlik üretildi', list.some(c => c.id === 'coop_1'))
  check('çift kimlik tekilleştirildi', new Set(list.map(c => c.id)).size === 4)
  check('Türkçe büyük harf', list[0].name === 'ÇATI 1')
  check('aynı isim tekilleştirildi', new Set(list.map(c => c.name)).size === 4)
  check('boş isim dolduruldu', list.some(c => c.name.startsWith('KÜMES ')))
  check('sıra alanı sayı', list.every(c => Number.isFinite(c.order)))
  check('renk atandı', list.every(c => Boolean(c.color)))
  check('girdi dizisi bozulmadı', list.length === 4)
}

console.log('\n5) Kimlik çözümleme')
{
  const coops = normalizeCoops([
    { id: 'coop_a', name: 'A' },
    { id: 'coop_b', name: 'B' }
  ])
  check('eksik kimlik varsayılan', resolveBirdCoopId({}, coops) === DEFAULT_COOP_ID ||
    resolveBirdCoopId({}, coops) === 'coop_a')
  check('geçersiz kimlik yedeğe düştü', resolveBirdCoopId({ coopId: 'yok' }, coops) === 'coop_a')
  check('geçerli kimlik korundu', resolveBirdCoopId({ coopId: 'coop_b' }, coops) === 'coop_b')
  check('fallbackCoopId boşta varsayılan', fallbackCoopId([]) === DEFAULT_COOP_ID)
}

console.log('\n6) scopeDb — katı kümes izolasyonu')
{
  const db = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [
        { id: 'coop_a', name: 'A', order: 0 },
        { id: 'coop_b', name: 'B', order: 1 }
      ]
    },
    birds: [
      { id: 'a1', coopId: 'coop_a', sex: 'M', status: 'damizlik' },
      { id: 'a2', coopId: 'coop_a', sex: 'F', status: 'damizlik' },
      { id: 'b1', coopId: 'coop_b', sex: 'M', status: 'damizlik' },
      { id: 'b2', coopId: 'coop_b', sex: 'F', status: 'damizlik' }
    ],
    pairings: [
      { id: 'pA', maleId: 'a1', femaleId: 'a2', durum: 'simdi' },
      { id: 'pB', maleId: 'b1', femaleId: 'b2', durum: 'simdi' },
      { id: 'pCross', maleId: 'a1', femaleId: 'b2', durum: 'simdi' }
    ],
    clutches: [
      { id: 'cA', maleId: 'a1', femaleId: 'a2' },
      { id: 'cB', maleId: 'b1', femaleId: 'b2' },
      { id: 'cCross', maleId: 'a1', femaleId: 'b2' },
      { id: 'cNone', maleId: null, femaleId: null }
    ],
    treatments: [
      { id: 'tA', birdId: 'a1' },
      { id: 'tB', birdId: 'b1' },
      { id: 'tAll', birdId: '' }
    ],
    vaccinations: [
      { id: 'vA', birdIds: ['a1'] },
      { id: 'vB', birdIds: ['b1'] },
      { id: 'vAll', birdIds: [] }
    ],
    medications: [{ id: 'm1', name: 'İLAÇ' }]
  }

  const before = {
    birds: db.birds.length,
    pairings: db.pairings.length,
    clutches: db.clutches.length,
    treatments: db.treatments.length
  }

  const a = scopeDb(db, 'coop_a')
  check('A kuşları', eq(ids(a.birds), ['a1', 'a2']))
  check('A çiftleşmesi var, çapraz yok', eq(ids(a.pairings), ['pA']))
  check('A kuluçkası var, çapraz yok', eq(ids(a.clutches), ['cA', 'cNone']))
  check('A tedavisi + ortak tedavi', eq(ids(a.treatments), ['tA', 'tAll']))
  check('A aşısı + ortak aşı', eq(ids(a.vaccinations), ['vA', 'vAll']))
  check('ilaç envanteri ortak', eq(ids(a.medications), ['m1']))

  const b = scopeDb(db, 'coop_b')
  check('B kuşları', eq(ids(b.birds), ['b1', 'b2']))
  check('B çiftleşmesi var, çapraz yok', eq(ids(b.pairings), ['pB']))
  check('B kuluçkası var, çapraz yok', eq(ids(b.clutches), ['cB', 'cNone']))
  check('B tedavisi + ortak tedavi', eq(ids(b.treatments), ['tAll', 'tB']))
  check('B aşısı + ortak aşı', eq(ids(b.vaccinations), ['vAll', 'vB']))

  check('Tümü aynı veritabanını döner', scopeDb(db, ALL_COOPS) === db)
  check('orijinal db değişmedi',
    db.birds.length === before.birds &&
    db.pairings.length === before.pairings &&
    db.clutches.length === before.clutches &&
    db.treatments.length === before.treatments)
}

console.log('\n7) Sayaçlar')
{
  const db = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [{ id: 'coop_a', name: 'A' }, { id: 'coop_b', name: 'B' }]
    },
    birds: [
      { id: 'a1', coopId: 'coop_a', sex: 'M', status: 'damizlik' },
      { id: 'a2', coopId: 'coop_a', sex: 'F', status: 'damizlik' },
      { id: 'a3', coopId: 'coop_a', sex: 'F', status: 'oldu' },
      { id: 'b1', coopId: 'coop_b', sex: 'M', status: 'damizlik' }
    ],
    pairings: [{ id: 'p1', maleId: 'a1', femaleId: 'a2', durum: 'simdi' }],
    clutches: [],
    treatments: [],
    vaccinations: [],
    medications: []
  }
  const s = coopStats(db, 'coop_a')
  check('toplam ölü hariç', s.total === 2)
  check('erkek sayısı', s.male === 1)
  check('dişi sayısı', s.female === 1)
  check('eşli sayısı', s.mated === 2)
  const all = coopStats(db, ALL_COOPS)
  check('Tümü toplamı', all.total === 3)
}

console.log('\n7b) Sayaçlar — eşi başka kümesde')
{
  const db = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [{ id: 'coop_a', name: 'A' }, { id: 'coop_b', name: 'B' }]
    },
    birds: [
      { id: 'a1', coopId: 'coop_a', sex: 'M', status: 'damizlik' },
      { id: 'b1', coopId: 'coop_b', sex: 'F', status: 'damizlik' }
    ],
    pairings: [{ id: 'pCross', maleId: 'a1', femaleId: 'b1', durum: 'simdi' }],
    clutches: [],
    treatments: [],
    vaccinations: [],
    medications: []
  }
  const s = coopStats(db, 'coop_a')
  check('çapraz kümes eşi sayılıyor', s.mated === 1)
  check('diğer kümes kuşu toplama girmiyor', s.total === 1)
}

console.log('\n7c) Eşli kuş ayrıntısı — aynı kümes / başka kümes / kopuk')
{
  const db = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [{ id: 'coop_a', name: 'A' }, { id: 'coop_b', name: 'B' }]
    },
    birds: [
      { id: 'a1', coopId: 'coop_a', sex: 'M', status: 'damizlik' },
      { id: 'a2', coopId: 'coop_a', sex: 'F', status: 'damizlik' },
      { id: 'a3', coopId: 'coop_a', sex: 'M', status: 'damizlik' },
      { id: 'a4', coopId: 'coop_a', sex: 'F', status: 'damizlik' },
      { id: 'a5', coopId: 'coop_a', sex: 'F', status: 'damizlik' },
      { id: 'b1', coopId: 'coop_b', sex: 'F', status: 'damizlik' }
    ],
    pairings: [
      { id: 'pSame', maleId: 'a1', femaleId: 'a2', durum: 'simdi' },
      { id: 'pCross', maleId: 'a3', femaleId: 'b1', durum: 'simdi' },
      { id: 'pOrphan', maleId: 'silinmis', femaleId: 'a4', durum: 'simdi' },
      { id: 'pOld', maleId: 'a1', femaleId: 'a5', durum: 'eski' }
    ],
    clutches: [],
    treatments: [],
    vaccinations: [],
    medications: []
  }

  const a = coopMatingBreakdown(db, 'coop_a')
  check('aynı kümes çifti ayrı sayıldı', a.samePairs.length === 1 && a.samePairs[0].pairing.id === 'pSame')
  check('eşi başka kümede olan çift ayrı sayıldı',
    a.crossPairs.length === 1 && a.crossPairs[0].pairing.id === 'pCross')
  check('eşi başka kümede olan çift eksik sayılmadı',
    a.crossPairs[0].maleMissing === false && a.crossPairs[0].femaleMissing === false)
  check('gerçekten silinmiş eş kopuk sayıldı',
    a.orphanPairs.length === 1 && a.orphanPairs[0].pairing.id === 'pOrphan')
  check('kopuk kayıtta eksik taraf işaretlendi', a.orphanPairs[0].maleMissing === true)
  check('eski eş sayılmadı', ![...a.samePairs, ...a.crossPairs, ...a.orphanPairs]
    .some(x => x.pairing.id === 'pOld'))
  check('eşli kuş sayısı 4 (a1, a2, a3, a4)', a.mated === 4)
  check('eşi olmayan yalnız a5', eq(a.unpaired.map(b => b.id), ['a5']))
  check('çift sayısı 2 (aynı + başka kümes)', a.pairs === 2)
  check('coopStats eşli sayısı ayrıntıyla aynı', coopStats(db, 'coop_a').mated === a.mated)

  // Ekran (scopeDb) çapraz çifti saklar; ayrıntı ise gösterir. Farkın
  // kaynağı budur ve kullanıcıya "silinmiş" diye yanlış anlatılmamalıdır.
  const scoped = scopeDb(db, 'coop_a')
  check('scopeDb çapraz çifti gizler', !scoped.pairings.some(p => p.id === 'pCross'))
  check('scopeDb kopuk kaydı kalan tarafla gösterir', scoped.pairings.some(p => p.id === 'pOrphan'))

  const all = coopMatingBreakdown(db, ALL_COOPS)
  check('Tümünde çapraz çift aynı kümes çifti olur',
    all.samePairs.length === 2 && all.crossPairs.length === 0)
  check('Tümünde eşli kuş 5', all.mated === 5)
}

console.log('\n8) İsim ve liste yardımcıları')
{
  const coops = normalizeCoops([
    { id: 'c1', name: 'ÇATI 1' },
    { id: 'c2', name: 'ÇATI 2' },
    { id: 'c3', name: 'ÇATI 3' }
  ])
  check('sıradaki isim KÜMES 4', nextCoopName(coops) === 'KÜMES 4')
  check('ilk kümes bulundu', coopById({ settings: { coops } }, 'c2').name === 'ÇATI 2')
  check('bilinmeyen kimlik ilk kümese düştü',
    coopById({ settings: { coops } }, 'yok').id === 'c1')
  check('coopList boşta varsayılan üretir', coopList({ settings: {} }).length === 1)
}

console.log('\n9) Kuş kümesi yardımcıları')
{
  const db = {
    settings: { coops: [{ id: 'coop_a', name: 'A' }, { id: 'coop_b', name: 'B' }] }
  }
  check('eksik coopId yedeğe düştü', birdCoopId({}, db) === 'coop_a')
  check('Tümü her kuşu kapsar', birdInCoop({ coopId: 'coop_b' }, ALL_COOPS, db))
  check('A görünümü B kuşunu kapsamaz', !birdInCoop({ coopId: 'coop_b' }, 'coop_a', db))
  check('A görünümü A kuşunu kapsar', birdInCoop({ coopId: 'coop_a' }, 'coop_a', db))
}

console.log('\n10) Cins listesi kümes bazında')
{
  const base = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [
        { id: 'coop_a', name: 'A', order: 0 },
        { id: 'coop_b', name: 'B', order: 1 },
        { id: 'coop_t', name: 'T', order: 2 }
      ],
      cinsi: ['ÇAKAL'], // eski ortak liste
      coopCinsi: { coop_b: ['ÇAKAL'] }
    },
    birds: [
      { id: 'a1', coopId: 'coop_a', cinsi: 'BEYAZ' },
      { id: 'a2', coopId: 'coop_a', cinsi: 'BEYAZ KIRMIZILARDAN' },
      { id: 'b1', coopId: 'coop_b', cinsi: 'LİMONİ' },
      { id: 'b2', coopId: 'coop_b', cinsi: '' },
      { id: 't1', coopId: 'coop_t', cinsi: '' }
    ]
  }
  const a = coopCinsiList(base, 'coop_a')
  const b = coopCinsiList(base, 'coop_b')
  const t = coopCinsiList(base, 'coop_t')
  const all = coopCinsiList(base, ALL_COOPS)
  check('A cinsleri yalnız kendi kuşlarından', eq(a, ['BEYAZ', 'BEYAZ KIRMIZILARDAN']))
  check('B cinsleri kendi kuşu + elle eklenen', b.includes('LİMONİ') && b.includes('ÇAKAL'))
  check('A cinsi B listesinde yok', !b.includes('BEYAZ'))
  check('B cinsi A listesinde yok', !a.includes('LİMONİ'))
  check('boş kümesin cins listesi boş', t.length === 0)
  check('Tümü tüm cinsleri birleştirir',
    ['BEYAZ', 'BEYAZ KIRMIZILARDAN', 'LİMONİ', 'ÇAKAL'].every(x => all.includes(x)))
  check('eski ortak liste kümeslere sızmıyor', !a.includes('ÇAKAL') && !t.includes('ÇAKAL'))

  const next = withCoopCinsi(base.settings, 'coop_a', ['SARI', 'BEYAZ'])
  check('withCoopCinsi yeni nesne döner', next !== base.settings)
  check('withCoopCinsi hedef listeyi yazar', eq(next.coopCinsi.coop_a, ['BEYAZ', 'SARI']))
  check('withCoopCinsi diğer kümeyi bozmaz', eq(next.coopCinsi.coop_b, ['ÇAKAL']))
  check('withCoopCinsi eski ayarı değiştirmez', base.settings.coopCinsi.coop_a === undefined)
}

console.log('\n11) Migration cinsleri kümeslere ayırır')
{
  const db = migrate({
    settings: {
      coops: [
        { id: 'coop_d', name: 'DAMIZLIK', order: 0 },
        { id: 'coop_t', name: 'TAHTA', order: 1 }
      ],
      cinsi: ['ORTAK ESKİ']
    },
    birds: [
      { id: 'd1', coopId: 'coop_d', cinsi: 'BEYAZ' },
      { id: 't1', coopId: 'coop_t', cinsi: 'LİMONİ' }
    ]
  })
  check('DAMIZLIK yalnız kendi cinsini görür', eq(db.settings.coopCinsi.coop_d, ['BEYAZ']))
  check('TAHTA yalnız kendi cinsini görür', eq(db.settings.coopCinsi.coop_t, ['LİMONİ']))
  check('eski ortak cins kümeslere sızmıyor', !db.settings.coopCinsi.coop_d.includes('ORTAK ESKİ'))
  check('eski cinsi alanı uyumluluk için korunur', eq(db.settings.cinsi, ['ORTAK ESKİ']))
}

console.log('\n12) Klips tekilliği kümes bazında')
{
  const db = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [
        { id: 'coop_a', name: 'A', order: 0 },
        { id: 'coop_b', name: 'B', order: 1 },
        { id: 'coop_t', name: 'T', order: 2 }
      ]
    },
    birds: [
      { id: 'a1', coopId: 'coop_a', sex: 'M', leftCode: 'SİYAH-SARI', leftNumber: '03' },
      { id: 'b1', coopId: 'coop_b', sex: 'M', leftCode: 'SİYAH-SARI', leftNumber: '03' }
    ]
  }
  const base = { sex: 'M', leftCode: 'SİYAH-SARI', leftNumber: '03' }
  check('aynı klips farklı kümesde serbest',
    findCoopRingDuplicate(db, { ...base, coopId: 'coop_t' }, db.settings.coops) === null)
  const hitA = findCoopRingDuplicate(db, { ...base, coopId: 'coop_a' }, db.settings.coops)
  check('aynı klips aynı kümesde çakışır',
    hitA && hitA.dup.id === 'a1' && hitA.foot === 'left')
  check('aynı klips karşı cinsiyette serbest',
    findCoopRingDuplicate(db, { ...base, sex: 'F', coopId: 'coop_a' }, db.settings.coops) === null)
  check('kuşun kendisi çakışma saymaz',
    findCoopRingDuplicate(db, { ...base, id: 'a1', coopId: 'coop_a' }, db.settings.coops) === null)

  const db2 = {
    ...db,
    birds: [...db.birds, { id: 'a2', coopId: 'coop_a', sex: 'F', rightCode: 'siyah-sari', rightNumber: '07' }]
  }
  const hitRight = findCoopRingDuplicate(
    db2,
    { sex: 'F', rightCode: 'SİYAH-SARI', rightNumber: '07', coopId: 'coop_a' },
    db2.settings.coops
  )
  check('sağ ayak ve Türkçe harf eşleşmesi',
    hitRight && hitRight.dup.id === 'a2' && hitRight.foot === 'right')
}

console.log('\n13) Ortak yavrular — kümes değişse de ebeveyn bağı korunur')
{
  const db = {
    ...emptyDb(),
    settings: {
      ...emptyDb().settings,
      coops: [{ id: 'coop_a', name: 'DAMIZLIK' }, { id: 'coop_b', name: 'UÇAN SAYA' }]
    },
    birds: [
      { id: 'sire', coopId: 'coop_a', sex: 'M', status: 'damizlik' },
      { id: 'dam', coopId: 'coop_a', sex: 'F', status: 'damizlik' },
      { id: 'chick', coopId: 'coop_b', sex: 'F', status: 'yavru', sireId: 'sire', damId: 'dam' }
    ],
    pairings: [
      { id: 'p', maleId: 'sire', femaleId: 'dam', chickIds: ['chick'], durum: 'simdi' }
    ],
    clutches: [], treatments: [], vaccinations: [], medications: []
  }

  const a = scopeDb(db, 'coop_a')
  check('yavru başka kümede olduğu için liste görünümünde yok',
    !a.birds.some(b => b.id === 'chick'))
  check('tam veride ebeveynin doğrudan yavrusu bulunur',
    childrenOf(db.birds, db.birds.find(b => b.id === 'sire')).some(b => b.id === 'chick'))
  check('yavrunun kendi kaydı anne/babayı korur',
    db.birds.find(b => b.id === 'chick').sireId === 'sire' &&
    db.birds.find(b => b.id === 'chick').damId === 'dam')
  const p = db.pairings[0]
  const kidIds = new Set([
    ...(p.chickIds || []),
    ...db.birds.filter(b => b.sireId === p.maleId && b.damId === p.femaleId).map(b => b.id)
  ])
  check('çiftleşme kaydı başka kümedeki yavruyu korur', kidIds.has('chick'))
  check('eşli kuş ayrıntısı yavruyu çiftle birlikte sayar',
    coopMatingBreakdown(db, 'coop_a').samePairs.length === 1)
}

console.log(`\n${'='.repeat(40)}`)
console.log(`  ${pass} geçti, ${fail} başarısız`)
console.log('='.repeat(40) + '\n')

process.exit(fail ? 1 : 0)
