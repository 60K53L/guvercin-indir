import { ringOf, SEX, statusLabel, byId } from './lib.js'

const STORAGE_KEY = 'guvercin_activity_log'
const CLEARED_KEY = 'guvercin_activity_log_cleared'
const MAX_ACTIVITIES = 300

/**
 * Yeni bir işlem kaydeder.
 * @param {{
 *   type: 'bird_add' | 'bird_edit' | 'bird_delete' | 'clutch_add' | 'clutch_edit' | 'egg_status' | 'pairing_add' | 'pairing_remove' | 'med_add' | 'vac_add' | 'treatment_add' | 'sup_add' | 'session_login' | string,
 *   icon?: string,
 *   title: string,
 *   detail?: string,
 *   time?: string,
 *   birdId?: string
 * }} activity
 */
export function recordActivity(activity) {
  try {
    const list = getStoredActivities()
    const item = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: activity.type || 'general',
      icon: activity.icon || getIconForType(activity.type),
      title: activity.title,
      detail: activity.detail || '',
      time: activity.time || new Date().toISOString(),
      birdId: activity.birdId || null
    }
    const updated = [item, ...list].slice(0, MAX_ACTIVITIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    // Bildirim ve gerçek zamanlı güncelleme için olay fırlat
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('guvercin:activity', { detail: item }))
    }
    return item
  } catch (err) {
    console.warn('Log kaydı yazılamadı:', err)
    return null
  }
}

/**
 * Kullanıcı oturum veya mobil uygulama açılışını throttled olarak kaydeder.
 * Aynı cihazda 30 dakika içinde birden fazla kez yazmaz.
 */
export function recordSessionLogin(platform, appVersion) {
  const lastKey = 'guvercin:last_session_log_time'
  try {
    const last = parseInt(localStorage.getItem(lastKey) || '0', 10)
    const now = Date.now()
    if (now - last < 30 * 60 * 1000) return null
    localStorage.setItem(lastKey, String(now))
  } catch {}

  const plat = String(platform || '').toLowerCase()
  const platLabel = plat === 'capacitor' || plat === 'android'
    ? 'Mobil Uygulama (Android)'
    : (plat === 'windows' ? 'Masaüstü (Windows)' : 'Web Tarayıcı')

  return recordActivity({
    type: 'session_login',
    icon: '🔑',
    title: 'Uygulamaya Giriş Yapıldı',
    detail: `${platLabel}${appVersion ? ` · v${appVersion}` : ''}`,
    time: new Date().toISOString()
  })
}

/**
 * Kayıtlı yerel logları okur.
 */
function getStoredActivities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

/**
 * Log kayıtlarını döner.
 * Yerel loglar ile veritabanındaki (kuşlar, kuluçka, eşler, aşı/tedavi)
 * tüm hareketleri kronolojik olarak birleştirir ve tekilleştirir.
 * Bu sayede başka cihazdan (ör. mobilden) yapılan değişiklikler de anında görünür.
 */
export function getAllActivities(db) {
  const stored = getStoredActivities()

  let clearedTime = 0
  try {
    const rawCleared = localStorage.getItem(CLEARED_KEY)
    if (rawCleared) {
      clearedTime = rawCleared === '1' ? 1 : new Date(rawCleared).getTime()
    }
  } catch {}

  const synthetic = generateHistoryFromDb(db)

  const combined = []
  const seenKeys = new Set()

  // 1. Önce doğrudan kaydedilen yerel eylemleri al (daha detaylı başlık/açıklama içerebilir)
  for (const s of stored) {
    if (!s) continue
    const sTime = new Date(s.time || 0).getTime()
    if (clearedTime && sTime <= clearedTime) continue
    const dateStr = s.time ? s.time.slice(0, 10) : ''
    const key = `${s.type}_${s.birdId || ''}_${s.title}_${dateStr}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      combined.push(s)
    }
  }

  // 2. Ardından bulut veri tabanındaki tüm hareketleri birleştir (farklı cihazdan yapılan işlemler buraya düşer)
  for (const s of synthetic) {
    if (!s) continue
    const sTime = new Date(s.time || 0).getTime()
    if (clearedTime && sTime <= clearedTime) continue
    const dateStr = s.time ? s.time.slice(0, 10) : ''
    const key = `${s.type}_${s.birdId || ''}_${s.title}_${dateStr}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      combined.push(s)
    }
  }

  // Tarihe göre yeniden eskiye sırala
  combined.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
  return combined.slice(0, MAX_ACTIVITIES)
}

export function clearActivities() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(CLEARED_KEY, new Date().toISOString())
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('guvercin:activity_clear'))
    }
  } catch {}
}

function getIconForType(type) {
  switch (type) {
    case 'bird_add': return '🕊️'
    case 'bird_edit': return '✏️'
    case 'bird_delete': return '🗑️'
    case 'clutch_add': return '🪺'
    case 'clutch_edit': return '🪺'
    case 'egg_status': return '🥚'
    case 'pairing_add': return '❤️'
    case 'pairing_remove': return '💔'
    case 'med_add': return '💊'
    case 'vac_add': return '💉'
    case 'treatment_add': return '🩺'
    case 'sup_add': return '🌾'
    case 'session_login': return '🔑'
    default: return '📋'
  }
}

/**
 * Mevcut veri tabanındaki tarihli hareketleri tarar ve log üretir.
 */
function generateHistoryFromDb(db) {
  if (!db) return []
  const list = []

  // 1. Kuşlar (Ekleme ve Güncelleme)
  if (Array.isArray(db.birds)) {
    for (const b of db.birds) {
      const ring = ringOf(b)
      const sexLabel = SEX[b.sex] || 'Cinsiyet Belirtilmemiş'
      const stat = statusLabel(b.status)
      const detail = `${sexLabel} · ${stat}${b.cinsi ? ` · ${b.cinsi}` : ''}${b.name ? ` · ${b.name}` : ''}`

      if (b.createdAt) {
        list.push({
          id: `seed_bird_add_${b.id}`,
          type: 'bird_add',
          icon: '🕊️',
          title: `${ring} Sisteme Eklendi`,
          detail,
          time: b.createdAt,
          birdId: b.id
        })
      }
      if (b.updatedAt && b.updatedAt !== b.createdAt) {
        list.push({
          id: `seed_bird_upd_${b.id}`,
          type: 'bird_edit',
          icon: '✏️',
          title: `${ring} Güncellendi`,
          detail,
          time: b.updatedAt,
          birdId: b.id
        })
      }
    }
  }

  // 2. Kuluçka & Yumurtalar
  if (Array.isArray(db.clutches)) {
    for (const c of db.clutches) {
      const female = byId(db.birds, c.femaleId)
      const male = byId(db.birds, c.maleId)
      const pairText = `${female ? ringOf(female) : 'Bilinmeyen'} × ${male ? ringOf(male) : 'Bilinmeyen'}`

      if (c.startDate) {
        list.push({
          id: `seed_clutch_${c.id}`,
          type: 'clutch_add',
          icon: '🪺',
          title: `Kuluçka Başlatıldı: ${pairText}`,
          detail: c.notes || (c.nest ? `Yuva: ${c.nest}` : 'Kuluçka süreci aktif'),
          time: c.startDate.includes('T') ? c.startDate : `${c.startDate}T09:00:00.000Z`
        })
      }

      if (c.updatedAt && c.updatedAt !== c.startDate) {
        list.push({
          id: `seed_clutch_upd_${c.id}`,
          type: 'clutch_edit',
          icon: '🪺',
          title: `Kuluçka Güncellendi: ${pairText}`,
          detail: c.notes || (c.nest ? `Yuva: ${c.nest}` : 'Kuluçka güncellendi'),
          time: c.updatedAt
        })
      }

      if (Array.isArray(c.eggs)) {
        c.eggs.forEach((egg, idx) => {
          if (!egg) return
          let eggStatusText = ''
          if (egg.status === 'cikti') eggStatusText = 'Yavru Çıktı 🐣'
          else if (egg.status === 'dolu') eggStatusText = 'Dolu Olarak İşaretlendi 🟢'
          else if (egg.status === 'bos') eggStatusText = 'Boş Olarak İşaretlendi ⚪'
          else if (egg.status === 'oldu') eggStatusText = 'Yumurta/Yavru Öldü ❌'

          if (eggStatusText) {
            const eggTime = egg.hatchDate || egg.date || c.startDate || new Date().toISOString()
            list.push({
              id: `seed_egg_${c.id}_${idx}`,
              type: 'egg_status',
              icon: '🥚',
              title: `${idx + 1}. Yumurta: ${eggStatusText}`,
              detail: `${pairText} çiftinin yumurtası`,
              time: eggTime.includes('T') ? eggTime : `${eggTime}T12:00:00.000Z`
            })
          }
        })
      }
    }
  }

  // 3. Eşleşmeler
  if (Array.isArray(db.pairings)) {
    for (const p of db.pairings) {
      const male = byId(db.birds, p.maleId)
      const female = byId(db.birds, p.femaleId)
      const pairText = `${male ? ringOf(male) : 'Bilinmeyen'} × ${female ? ringOf(female) : 'Bilinmeyen'}`
      const pTime = p.startDate || p.createdAt || p.updatedAt || new Date().toISOString()
      const isEnded = p.active === false
      list.push({
        id: `seed_pair_${p.id}`,
        type: isEnded ? 'pairing_remove' : 'pairing_add',
        icon: isEnded ? '💔' : '❤️',
        title: isEnded ? `Eş Ayrıldı: ${pairText}` : `Yeni Eşleşme: ${pairText}`,
        detail: p.notes || (isEnded ? 'Eşleşme sonlandırıldı' : 'Eşleşme aktif'),
        time: pTime.includes('T') ? pTime : `${pTime}T10:00:00.000Z`
      })
    }
  }

  // 4. Aşılar
  if (Array.isArray(db.vaccinations)) {
    for (const v of db.vaccinations) {
      const vTime = v.date || v.createdAt || new Date().toISOString().slice(0, 10)
      list.push({
        id: `seed_vac_${v.id}`,
        type: 'vac_add',
        icon: '💉',
        title: `${v.name} Aşısı Uygulandı`,
        detail: `Doz: ${v.dosage || '—'}${v.administeredBy ? ` · Uygulayan: ${v.administeredBy}` : ''}`,
        time: vTime.includes('T') ? vTime : `${vTime}T10:00:00.000Z`
      })
    }
  }

  // 5. İlaçlar
  if (Array.isArray(db.medications)) {
    for (const m of db.medications) {
      list.push({
        id: `seed_med_${m.id}`,
        type: 'med_add',
        icon: '💊',
        title: `${m.name} İlacı Kaydedildi`,
        detail: `Doz: ${m.dosage || '—'}${m.purpose ? ` · Amaç: ${m.purpose}` : ''}`,
        time: m.createdAt || m.updatedAt || new Date().toISOString()
      })
    }
  }

  // 6. Tedaviler
  if (Array.isArray(db.treatments)) {
    for (const t of db.treatments) {
      const bird = byId(db.birds, t.birdId)
      const birdText = bird ? ringOf(bird) : 'Kuş'
      const tTime = t.startDate || t.createdAt || t.updatedAt || new Date().toISOString()
      const statusTxt = t.status === 'cured' ? 'İyileşti ✅' : (t.status === 'active' ? 'Aktif Tedavi 🚨' : 'Tedavi')
      list.push({
        id: `seed_treat_${t.id}`,
        type: 'treatment_add',
        icon: '🩺',
        title: `${birdText}: ${t.medicineName || 'Tedavi'} (${statusTxt})`,
        detail: t.notes || (t.dosage ? `Doz: ${t.dosage}` : 'Tedavi süreci'),
        time: tTime.includes('T') ? tTime : `${tTime}T11:00:00.000Z`,
        birdId: t.birdId || null
      })
    }
  }

  // 7. Takviyeler & Yemler
  if (Array.isArray(db.supplements)) {
    for (const s of db.supplements) {
      const sTime = s.date || s.createdAt || s.updatedAt || new Date().toISOString()
      list.push({
        id: `seed_sup_${s.id}`,
        type: 'sup_add',
        icon: '🌾',
        title: `${s.name || 'Takviye'} Verildi`,
        detail: `Doz: ${s.dosage || '—'}${s.notes ? ` · ${s.notes}` : ''}`,
        time: sTime.includes('T') ? sTime : `${sTime}T10:00:00.000Z`
      })
    }
  }

  return list
}
