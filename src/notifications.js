import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { byId, ringOf, clutchTimeline } from './lib.js'

export const CHANNEL_ID = 'incubation_channel'

/** Platform yerel Android/Capacitor mı? */
export const isNative = () => Capacitor.isNativePlatform()

/** Bildirim kanalını oluşturur (Android 8+). */
export async function initNotificationChannel() {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Kuluçka Hatırlatıcıları',
      description: 'Yumurta döl kontrolü, tahmini çıkım ve künye takma bildirimleri',
      importance: 4, // Yüksek öncelik (ses ve afiş)
      visibility: 1, // Kilit ekranında görünür
      vibration: true
    })
  } catch (err) {
    console.warn('Bildirim kanalı oluşturulamadı:', err)
  }
}

/** Bildirim iznini denetler. */
export async function checkNotificationPermission() {
  if (!isNative()) {
    if (typeof Notification !== 'undefined') return Notification.permission === 'granted'
    return false
  }
  try {
    const res = await LocalNotifications.checkPermissions()
    return res.display === 'granted'
  } catch {
    return false
  }
}

/** Bildirim izni ister. */
export async function requestNotificationPermission() {
  if (!isNative()) {
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      const res = await Notification.requestPermission()
      return res === 'granted'
    }
    return false
  }
  try {
    const res = await LocalNotifications.requestPermissions()
    return res.display === 'granted'
  } catch (err) {
    console.warn('Bildirim izni istenirken hata:', err)
    return false
  }
}

/**
 * Belirli bir string kimlik için deterministik 32-bit tamsayı üretir.
 *
 * FNV-1a kullanılıyor: eski djb2 + %200000 çok dar bir aralıktı, iki farklı
 * kuluçka aynı kimliği üretebiliyordu ve Android'de bir bildirimin kimliği
 * diğerinin üzerine yazılıyordu (bir hatırlatıcı sessizce kayboluyordu).
 * Aralık int32 sınırında kalacak şekilde genişletildi.
 */
function hashString(str) {
  let hash = 2166136261
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 100000000
}

/**
 * Tüm aktif kuluçkalar için bildirim listesini üretir ve planlar.
 * @param {object} db - { clutches, birds, pairings }
 * @returns {Promise<{ scheduledCount: number, items: Array }>}
 */
export async function syncClutchNotifications(db) {
  if (!db || !db.clutches) return { scheduledCount: 0, items: [] }

  const items = []
  const now = Date.now()
  // Android bildirim kimlikleri benzersiz olmalı; çakışma olursa bir
  // bildirim diğerinin yerine geçer. Yakalayıp kaydırıyoruz.
  const usedIds = new Set()
  const nextId = base => {
    let id = base
    while (usedIds.has(id) || id === 999999) id += 200000000
    usedIds.add(id)
    return id
  }

  for (const c of db.clutches) {
    // Sadece aktif kuluçkalar ve yeni çıkmış yavrular için bildirim kurulur
    if (c.status !== 'incubation' && c.status !== 'hatched') continue

    const tl = clutchTimeline(c)
    if (!tl) continue

    const male = byId(db.birds || [], c.maleId)
    const female = byId(db.birds || [], c.femaleId)
    const maleRing = ringOf(male)
    const femaleRing = ringOf(female)
    const pairName = `${femaleRing} × ${maleRing}`
    const nestLabel = c.nest ? `Yuva ${c.nest}` : 'Kuluçka'
    const baseId = hashString(c.id)

    // 1. DÖL / DAMAR KONTROLÜ (6. Gün - sadece kuluçka aşamasındayken)
    if (c.status === 'incubation' && tl.checkDate) {
      const target = new Date(`${tl.checkDate}T09:00:00`)
      if (target.getTime() > now) {
        items.push({
          id: nextId(baseId * 10 + 1),
          title: '🕊️ KULUÇKA: DÖL KONTROLÜ',
          body: `${nestLabel}: ${pairName} yumurtalarında döl/damar kontrolü zamanı!`,
          schedule: { at: target, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          isExactNotification: false,
          autoCancel: true,
          extra: { clutchId: c.id, type: 'check' }
        })
      }
    }

    // 2. TAHMİNİ ÇIKIM GÜNÜ (18. Gün - sadece kuluçka aşamasındayken)
    if (c.status === 'incubation' && tl.expectedHatch) {
      const target = new Date(`${tl.expectedHatch}T09:00:00`)
      if (target.getTime() > now) {
        items.push({
          id: nextId(baseId * 10 + 2),
          title: '🐣 KULUÇKA: YAVRU ÇIKIM GÜNÜ!',
          body: `${nestLabel}: ${pairName} yumurtalarından bugün çıkım bekleniyor! Yuvayı kontrol ediniz.`,
          schedule: { at: target, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          isExactNotification: false,
          autoCancel: true,
          extra: { clutchId: c.id, type: 'hatch' }
        })
      }
    }

    // 3. KÜNYE / BİLEZİK TAKMA (Çıkımdan 7 gün sonra)
    if (tl.ringDate) {
      const target = new Date(`${tl.ringDate}T09:00:00`)
      if (target.getTime() > now) {
        items.push({
          id: nextId(baseId * 10 + 3),
          title: '🏷️ KULUÇKA: KÜNYE TAKMA ZAMANI!',
          body: `${nestLabel}: Yavrular 7 günlük oldu, künye/bilezik takma zamanı!`,
          schedule: { at: target, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          isExactNotification: false,
          autoCancel: true,
          extra: { clutchId: c.id, type: 'ring' }
        })
      }
    }

    // 4. YEME DÜŞME DÖNEMİ (Çıkımdan 30 gün sonra - yavru çıkmışsa)
    if (c.status === 'hatched' && tl.weanDate) {
      const target = new Date(`${tl.weanDate}T09:00:00`)
      if (target.getTime() > now) {
        items.push({
          id: nextId(baseId * 10 + 4),
          title: '🌾 KULUÇKA: YEME DÜŞME DÖNEMİ',
          body: `${nestLabel}: Yavrular 30 günlük oldu, yeme düşme sürecine girdi.`,
          schedule: { at: target, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          isExactNotification: false,
          autoCancel: true,
          extra: { clutchId: c.id, type: 'wean' }
        })
      }
    }
  }

  if (isNative()) {
    try {
      // Önceki bayat bildirimleri temizle ve yenilerini kur
      await LocalNotifications.cancelAll()
      if (items.length > 0) {
        await LocalNotifications.schedule({ notifications: items })
      }
    } catch (err) {
      console.warn('Bildirimler planlanırken hata:', err)
    }
  }

  return { scheduledCount: items.length, items }
}

/** Kullanıcının telefonunda anında test edebilmesi için 3 saniye sonra test bildirimi gönderir. */
export async function sendTestNotification() {
  const target = new Date(Date.now() + 3000)
  const item = {
    id: 999999,
    title: '🕊️ GÜVERCİN: TEST BİLDİRİMİ',
    body: 'Kuluçka bildirim sistemi başarıyla çalışıyor! Planlanan hatırlatıcılar vaktinde iletilecektir.',
    schedule: { at: target, allowWhileIdle: true },
    channelId: CHANNEL_ID,
    isExactNotification: false,
    autoCancel: true
  }

  if (isNative()) {
    await initNotificationChannel()
    const granted = await requestNotificationPermission()
    if (!granted) throw new Error('Bildirim izni verilmedi.')
    await LocalNotifications.schedule({ notifications: [item] })
    return true
  } else if (typeof Notification !== 'undefined') {
    const granted = await requestNotificationPermission()
    if (!granted) throw new Error('Tarayıcı bildirim izni verilmedi.')
    setTimeout(() => {
      new Notification(item.title, { body: item.body })
    }, 3000)
    return true
  }
  return false
}

/**
 * Telegram Bot API üzerinden HTML formatında bildirim gönderir.
 * @param {string} botToken
 * @param {string} chatId
 * @param {string} text
 */
export async function sendTelegramMessage(botToken, chatId, text) {
  const token = (botToken || '').trim()
  const chat = (chatId || '').trim()
  if (!token) throw new Error('Telegram Bot Token boş olamaz.')
  if (!chat) throw new Error('Telegram Chat ID boş olamaz.')

  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: 'HTML'
    })
  })

  const json = await res.json()
  if (!json.ok) {
    throw new Error(json.description || 'Telegram mesajı gönderilemedi.')
  }
  return json
}

/**
 * Kullanıcının Telegram botunu ve Chat ID'sini doğrulaması için test mesajı gönderir.
 */
export async function sendTestTelegramNotification(botToken, chatId) {
  const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date().toLocaleDateString('tr-TR')
  const text = `🕊️ <b>GÜVERCİN TAKİP SİSTEMİ</b>\n\n` +
    `✅ <b>Telegram Bildirim Bağlantısı Başarılı!</b>\n` +
    `📅 <i>${dateStr} - ${nowStr}</i>\n\n` +
    `🥚 Kuluçka döl kontrolleri (6. gün)\n` +
    `🐣 Tahmini yavru çıkımları (18. gün)\n` +
    `💍 Künye / bilezik takma hatırlatmaları (7. gün)\n\n` +
    `Bu kanaldan anlık olarak telefonunuza iletilecektir.`
  return sendTelegramMessage(botToken, chatId, text)
}

/**
 * Telegram HTML mesajları için özel karakterleri kaçırır.
 */
export function escapeTelegramHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Aktif kuluçkaların durumunu Telegram'a özet rapor olarak iletir.
 */
export async function sendClutchTelegramSummary(db, botToken, chatId) {
  const token = (botToken || db?.settings?.telegram?.botToken || '').trim()
  const chat = (chatId || db?.settings?.telegram?.chatId || '').trim()
  if (!token || !chat) throw new Error('Telegram Bot Token ve Chat ID gereklidir.')

  const active = (db?.clutches || []).filter(c => c.status === 'incubation' || c.status === 'hatched')
  if (!active.length) {
    return sendTelegramMessage(token, chat, '🕊️ <b>GÜVERCİN KULUÇKA RAPORU</b>\n\nŞu anda aktif kuluçka veya bekleyen yavru kaydı bulunmuyor.')
  }

  const lines = [`🕊️ <b>GÜVERCİN KULUÇKA RAPORU (${active.length} YUVA)</b>\n`]
  for (const c of active) {
    const tl = clutchTimeline(c)
    const nest = escapeTelegramHtml(c.nest ? `Yuva ${c.nest}` : 'Folluk')
    const female = byId(db.birds || [], c.femaleId)
    const male = byId(db.birds || [], c.maleId)
    const pair = `${escapeTelegramHtml(ringOf(female))} × ${escapeTelegramHtml(ringOf(male))}`

    if (c.status === 'incubation' && tl) {
      if (tl.daysToHatch === 0) {
        lines.push(`🔔 <b>${nest} (${pair}):</b>\n<b>BUGÜN ÇIKIM GÜNÜ!</b> 🐣 Yuvayı kontrol ediniz.`)
      } else if (tl.daysToHatch > 0) {
        lines.push(`⏳ <b>${nest} (${pair}):</b>\nÇıkıma <b>${tl.daysToHatch} gün</b> kaldı (18 günlük süreçte ${Math.min(18, tl.daysPassed)}. gün).`)
      } else {
        lines.push(`⚠️ <b>${nest} (${pair}):</b>\nÇıkım tarihi <b>${Math.abs(tl.daysToHatch)} gün</b> geçti.`)
      }
    } else if (c.status === 'hatched' && tl) {
      if (Math.abs(tl.daysToRing) <= 1) {
        lines.push(`💍 <b>${nest} (${pair}):</b>\n<b>BUGÜN KÜNYE / BİLEZİK TAKMA GÜNÜ!</b> (${c.chickCount || 1} yavru)`)
      } else if (tl.daysToRing > 1) {
        lines.push(`🐣 <b>${nest} (${pair}):</b>\n${c.chickCount || 1} yavru çıktı · Künye: <b>${tl.daysToRing} gün sonra</b>`)
      } else {
        lines.push(`🐣 <b>${nest} (${pair}):</b>\n${c.chickCount || 1} yavru çıktı · Künye tamamlandı`)
      }
    }
  }

  return sendTelegramMessage(token, chat, lines.join('\n\n'))
}
