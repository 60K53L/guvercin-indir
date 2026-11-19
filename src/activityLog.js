import { ringOf, SEX, statusLabel, byId } from './lib.js'

const STORAGE_KEY = 'guvercin_activity_log'
const CLEARED_KEY = 'guvercin_activity_log_cleared'
const MAX_ACTIVITIES = 200

/**
 * Yeni bir işlem kaydeder.
 * @param {{
 *   type: 'bird_add' | 'bird_edit' | 'bird_delete' | 'clutch_add' | 'egg_status' | 'pairing_add' | 'pairing_remove' | 'med_add' | 'vac_add' | 'sup_add',
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
 * Log kayıtlarını döner. Eğer log listesi henüz boşsa,
 * mevcut veritabanındaki (kuşlar, kuluçka yumurtaları, aşılar)
 * geçmiş hareketleri otomatik olarak kronolojik loglara dönüştürür.
 */
export function getAllActivities(db) {
  const stored = getStoredActivities()
  if (stored.length >= 10) return stored

  /* Kullanıcı listeyi bilinçli olarak temizlediyse sentetik geçmiş yeniden
   * üretilmez. Eskiden clearActivities() localStorage'ı siliyordu ama
   * stored < 10 olduğu için bir sonraki açılışta DB'den yeniden log
   * üretiliyor ve "İşlem logları temizlendi" mesajından hemen sonra liste
   * doluyordu. */
  try {
    if (localStorage.getItem(CLEARED_KEY)) return stored
  } catch { /* özel modda okunamayabilir */ }

  // Eğer log azsa veya ilk kez açılıyorsa mevcut DB'den sentetik log üretip birleştir
  const synthetic = generateHistoryFromDb(db)
  
  // Stored olanları sentetik olanlarla birleştir (aynı ID/title çakışmasını engelle)
  const combined = [...stored]
  const titles = new Set(stored.map(s => s.title + '_' + s.time?.slice(0, 10)))

  for (const s of synthetic) {
    const key = s.title + '_' + s.time?.slice(0, 10)
    if (!titles.has(key)) {
      combined.push(s)
      titles.add(key)
    }
  }

  // Tarihe göre yeniden eskiye sırala
  combined.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
  return combined.slice(0, MAX_ACTIVITIES)
}

export function clearActivities() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    // Temizlik kalıcı olsun: yoksa getAllActivities() DB'den yeniden
    // sentetik geçmiş üretip listeyi dolduruyordu.
    localStorage.setItem(CLEARED_KEY, '1')
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
    case 'egg_status': return '🥚'
    case 'pairing_add': return '❤️'
    case 'pairing_remove': return '💔'
    case 'med_add': return '💊'
    case 'vac_add': return '💉'
    case 'sup_add': return '🌾'
    default: return '📋'
  }
}

/**
 * Mevcut veri tabanındaki tarihli hareketleri tarar ve log üretir.
 */
function generateHistoryFromDb(db) {
  if (!db) return []
  const list = []

  // 1. Kuşlar
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

  // 3. Aşılar
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

  // 4. İlaçlar
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

  return list
}
