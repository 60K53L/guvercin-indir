import assert from 'node:assert'
import { recordActivity, recordSessionLogin, getAllActivities, clearActivities } from '../src/activityLog.js'

// Mock localStorage and window
const store = new Map()
globalThis.localStorage = {
  getItem: k => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
}

globalThis.window = {
  dispatchEvent: () => true
}
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type
    this.detail = init && init.detail
  }
}

console.log('--- TEST ACTIVITY LOG ---')

// 1. recordActivity
store.clear()
const act1 = recordActivity({
  type: 'bird_add',
  title: 'TR-34-01 Eklendi',
  time: '2026-11-01T10:00:00.000Z'
})
assert(act1 && act1.id, 'recordActivity should return created item')
assert.strictEqual(getAllActivities(null).length, 1, 'Should have 1 activity in store')

// 2. recordSessionLogin throttled
const log1 = recordSessionLogin('android', '1.0.46')
assert(log1, 'Initial session login should record')
const log2 = recordSessionLogin('android', '1.0.46')
assert.strictEqual(log2, null, 'Second session login within 30 min should be throttled')

// 3. Multi-device DB synchronization test
// Suppose local storage already has 12 items
for (let i = 0; i < 12; i++) {
  recordActivity({
    type: 'bird_edit',
    title: `Eski Kuş ${i} Güncellendi`,
    time: `2026-10-30T10:${String(i).padStart(2, '0')}:00.000Z`
  })
}

// DB contains items added from another device yesterday
const mockDb = {
  birds: [
    {
      id: 'bird_yest_1',
      sex: 'D',
      status: 'damizlik',
      cinsi: 'Misri',
      code: 'TR-34-Y1',
      createdAt: '2026-11-01T14:00:00.000Z',
      updatedAt: '2026-11-01T16:00:00.000Z'
    }
  ],
  clutches: [
    {
      id: 'clutch_yest_1',
      femaleId: 'bird_yest_1',
      maleId: 'unknown',
      startDate: '2026-11-01T15:00:00.000Z',
      eggs: [{ status: 'cikti', hatchDate: '2026-11-01T15:30:00.000Z' }]
    }
  ],
  pairings: [
    {
      id: 'pair_1',
      maleId: 'unknown',
      femaleId: 'bird_yest_1',
      startDate: '2026-11-01T12:00:00.000Z',
      active: true
    }
  ],
  treatments: [
    {
      id: 'treat_1',
      birdId: 'bird_yest_1',
      medicineName: 'Baytril',
      status: 'active',
      startDate: '2026-11-01T17:00:00.000Z'
    }
  ]
}

const all = getAllActivities(mockDb)
assert(all.length > 12, 'getAllActivities must not short-circuit at 10; must include DB items!')

// Verify yesterday's items from DB appear in the log
const titles = all.map(a => a.title)
assert(titles.some(t => t.includes('TR-34-Y1 Sisteme Eklendi')), 'DB bird_add should be in log')
assert(titles.some(t => t.includes('TR-34-Y1 Güncellendi')), 'DB bird_edit should be in log')
assert(titles.some(t => t.includes('Kuluçka Başlatıldı')), 'DB clutch_add should be in log')
assert(titles.some(t => t.includes('Yavru Çıktı')), 'DB egg status should be in log')
assert(titles.some(t => t.includes('Yeni Eşleşme')), 'DB pairing should be in log')
assert(titles.some(t => t.includes('Baytril')), 'DB treatment should be in log')

// 4. Verify sorting: all items must be in descending order of time
for (let i = 0; i < all.length - 1; i++) {
  const tA = new Date(all[i].time || 0).getTime()
  const tB = new Date(all[i + 1].time || 0).getTime()
  assert(tA >= tB, `Log order must be descending: ${all[i].time} >= ${all[i + 1].time}`)
}

console.log('✓ All activityLog tests passed!')
