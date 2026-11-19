import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { applyTheme } from './themes.js'
import { uid, ringOf, sortTr, isFormer, DURUM_ESKI, SEX, statusLabel, setGlobalCodeColors, dispTr } from './lib.js'
import BirdList from './components/BirdList.jsx'
import BirdForm from './components/BirdForm.jsx'
import BirdDetail from './components/BirdDetail.jsx'
import Backup from './components/Backup.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import PhotoViewer, { isPhotoOpen, closePhoto } from './components/PhotoViewer.jsx'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import Medications from './components/Medications.jsx'
import Incubation from './components/Incubation.jsx'
import TreatmentBoard from './components/TreatmentBoard.jsx'
import ActivityLogModal from './components/ActivityLogModal.jsx'
import { emptyDb, normalizeBird } from './schema.js'
import { initNotificationChannel, syncClutchNotifications } from './notifications.js'
import { recordActivity, getAllActivities, clearActivities } from './activityLog.js'
import UpdateModal from './components/UpdateModal.jsx'
import VersionHistoryModal from './components/VersionHistoryModal.jsx'
import CoopPicker from './components/CoopPicker.jsx'
import { ALL_COOPS, birdCoopId, coopList, coopStats, fallbackCoopId, scopeDb, withCoopCinsi, sortCinsi } from './coops.js'
import { notifyAppReady, checkForUpdate, rememberDismissedUpdate } from './updater.js'

/**
 * Bir nesneden yalnızca ARAYÜZDE hesaplanan alanları çıkarır.
 *
 * Liste görünümleri kayıtlara `male`, `female`, `tl` (kuluçka) ve `bird`,
 * `days` (tedavi) gibi türetilmiş alanlar ekliyor. Bunlar kayda geri
 * sızarsa Firestore belgesini şişirir ve kuşun BAYAT bir kopyasını
 * saklar; ayrıca iç içe `undefined` değer yazımı reddettirebilir.
 */
const withoutComputed = (obj, keys) => {
  const out = { ...obj }
  for (const k of keys) delete out[k]
  return out
}

export default function App() {
  const [configured] = useState(() => !!api.configured)

  // oturum durumu
  const [auth, setAuth] = useState({ signedIn: false, email: '', ready: false })
  const [db, setDb] = useState(emptyDb())
  const dbRef = useRef(db)
  dbRef.current = db

  const [view, setView] = useState('list')
  const [openId, setOpenId] = useState(null)
  const [birdHistory, setBirdHistory] = useState([])
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [activityTick, setActivityTick] = useState(0)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState(null)
  const [showVersionModal, setShowVersionModal] = useState(false)

  /**
   * Aktif kümes: cihaz bazlı görünüm tercihi.
   * null → henüz seçilmedi (ilk kümes otomatik seçilir)
   * ''   → kullanıcı bilinçli olarak "Tümü" dedi
   */
  const [activeCoopId, setActiveCoopId] = useState(() => {
    try {
      const saved = localStorage.getItem('guvercin:active_coop')
      return saved === null ? null : saved
    } catch {
      return null
    }
  })

  const navStateRef = useRef({ view, openId, birdHistory, editing, showActivityLog, showExitModal })
  navStateRef.current = { view, openId, birdHistory, editing, showActivityLog, showExitModal }

  // Mobil alt menünün yüksekliğini (.bottom-nav) CSS değişkenine yazar.
  // Pencere (modal) bu değeri alt boşluğa ekleyerek alt menünün altına
  // taşmaz (eski 100vh hesabı menüyü dikkate almıyordu). Masaüstünde menü
  // gizlidir → offsetHeight 0 → değişken 0 kalır, davranış aynıdır.
  const bottomNavRef = useRef(null)
  useEffect(() => {
    const el = bottomNavRef.current
    if (!el) return
    const apply = () => {
      document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight || 0}px`)
    }
    apply()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [auth.ready, auth.signedIn])

  // OTA Canlı Kod Güncelleme denetimi
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    notifyAppReady()

    const timer = setTimeout(async () => {
      try {
        const res = await checkForUpdate()
        if (res.hasUpdate && res.update) {
          setPendingUpdate(res.update)
        }
      } catch (err) {
        console.warn('Otomatik güncelleme denetimi hatası:', err)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  // Android donanım / kaydırma geri tuşu yönetimi
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let subHandle = null
    CapApp.addListener('backButton', () => {
      // 1. Fotoğraf tam ekran açıksa kapat
      if (isPhotoOpen()) {
        closePhoto()
        return
      }

      // 2. Çıkış onay penceresi ekrandaysa geri tuşu pencereyi kapatır;
      // uygulamadan çıkış yalnızca penceredeki onay düğmesiyle yapılır.
      if (navStateRef.current.showExitModal) {
        setShowExitModal(false)
        return
      }

      // 3. Açık bir klips/kuş picker veya dropdown varsa Escape ile kapat
      const openPicker = document.querySelector('.picker-backdrop') || document.querySelector('.code-picker-overlay')
      if (openPicker) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        return
      }

      // 4. Açık bir dialog/modal (overlay) varsa (çıkış modalı hariç) kapat
      const openModal = document.querySelector('.overlay:not(.exit-modal-overlay)')
      if (openModal) {
        const closeBtn = openModal.querySelector('.modal-head button.x, button.x, .btn-close')
        if (closeBtn) {
          closeBtn.click()
          return
        }
        openModal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        return
      }

      const state = navStateRef.current

      // 5. Kuş formu açıksa formu kapat
      if (state.editing) {
        setEditing(null)
        return
      }

      // 6. İşlem geçmişi modalı açıksa kapat
      if (state.showActivityLog) {
        setShowActivityLog(false)
        return
      }

      // 7. Kuş profil kartı açıksa: geçmiş varsa önceki kuşa, yoksa listeye dön
      if (state.openId) {
        if (state.birdHistory && state.birdHistory.length > 0) {
          goBackBird()
        } else {
          closeBird()
        }
        return
      }

      // 8. Farklı sekmedeyse ana sekmeye (Kuşlar) dön
      if (state.view !== 'list') {
        setView('list')
        return
      }

      // 9. Ana ekranda ve geri gidecek yer kalmadıysa -> Çıkış teyidi sor
      setShowExitModal(true)
    }).then(h => {
      subHandle = h
    }).catch(() => {})

    return () => {
      if (subHandle && typeof subHandle.remove === 'function') {
        subHandle.remove()
      }
    }
  }, [])

  useEffect(() => {
    const handler = () => setActivityTick(t => t + 1)
    window.addEventListener('guvercin:activity', handler)
    window.addEventListener('guvercin:activity_clear', handler)
    return () => {
      window.removeEventListener('guvercin:activity', handler)
      window.removeEventListener('guvercin:activity_clear', handler)
    }
  }, [])

  const activities = useMemo(() => getAllActivities(db), [db, activityTick])

  // ------------------------------------------------------------- oturum akışı
  useEffect(() => {
    if (!configured) return
    const off = api.onAuth(state => setAuth({ ...state, ready: true }))
    api.authState().then(r => {
      if (r.ok) setAuth({ ...r.data, ready: true })
      else setAuth({ signedIn: false, email: '', ready: true })
    })
    return off
  }, [configured])

  // Android yerel kuluçka bildirim kanalı ve zamanlanmış alarmlar
  useEffect(() => {
    initNotificationChannel()
  }, [])

  useEffect(() => {
    if (db.clutches && db.clutches.length > 0) {
      syncClutchNotifications(db).catch(() => {})
    }
  }, [db.clutches])

  // ------------------------------------------- gerçek zamanlı veri dinleme
  // Başka cihazda yapılan her değişiklik buraya düşer.
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    if (!configured || !auth.signedIn) return
    let alive = true
    const off = api.dbSubscribe(part => {
      if (!alive || part.error) return
      if (part.settings) setSettingsLoaded(true)
      setDb(cur => {
        const next = { ...cur }
        if (part.birds) {
          next.birds = part.birds.map(normalizeBird)

          // Veritabanı (Firestore) kalıcı aktarımı:
          // Eski kayıtlarda sağ/sol ayak klipsi henüz ayrıştırılmamış ya da
          // numara tek alanda duruyor olabilir. Normalize hâli kayıttan
          // farklıysa (ayak kodu veya AYAK NUMARASI) Firestore'a yazılır.
          // Yazımdan sonra fark kalmaz, bu yüzden döngüye girmez.
          const needsDbUpdate = part.birds.filter(b => {
            const norm = normalizeBird(b)
            return (b.leftCode || '') !== (norm.leftCode || '') ||
              (b.rightCode || '') !== (norm.rightCode || '') ||
              (b.leftNumber || '') !== (norm.leftNumber || '') ||
              (b.rightNumber || '') !== (norm.rightNumber || '') ||
              (b.number || '') !== (norm.number || '')
          })
          if (needsDbUpdate.length > 0) {
            setTimeout(() => {
              for (const raw of needsDbUpdate) {
                api.birdPut(normalizeBird(raw)).catch(e => console.warn('Kuş Firestore aktarım hatası:', e))
              }
            }, 300)
          }
        }
        if (part.pairings) next.pairings = part.pairings
        if (part.clutches) next.clutches = part.clutches
        if (part.medications) next.medications = part.medications
        if (part.vaccinations) next.vaccinations = part.vaccinations
        if (part.treatments) next.treatments = part.treatments
        if (part.supplements) next.supplements = part.supplements
        if (part.settings || part.birds) {
          // Başka cihazdan gelen kodlar da hep alfabetik görünsün.
          const s = { ...cur.settings, ...(part.settings || {}) }
          const birds = next.birds || []
          const birdRightCodes = birds.map(b => b.rightCode).filter(Boolean)
          const birdLeftCodes = birds.map(b => b.leftCode).filter(Boolean)
          s.rightCodes = sortTr([...new Set([...(s.rightCodes || []), ...birdRightCodes])])
          s.leftCodes = sortTr([...new Set([...(s.leftCodes || []), ...birdLeftCodes])])
          s.codes = sortTr([...new Set([...(s.codes || []), ...s.rightCodes, ...s.leftCodes])])
          if (Array.isArray(s.cinsi)) s.cinsi = sortCinsi(s.cinsi)
          if (s.coopCinsi && typeof s.coopCinsi === 'object') {
            const norm = {}
            for (const [k, v] of Object.entries(s.coopCinsi)) {
              if (Array.isArray(v)) norm[k] = sortCinsi(v)
            }
            s.coopCinsi = norm
          }
          next.settings = s
        }
        return next
      })
    })
    return () => { alive = false; off() }
  }, [configured, auth.signedIn])

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind })
    setTimeout(() => setToast(null), 2400)
  }, [])

  // --------------------------------------------------------------- yazma işlemleri
  // Dikkat: her işlem YALNIZCA kendi belgesini yazar. Tüm veritabanını
  // göndermiyoruz; yoksa iki kişi aynı anda çalışınca birbirinin kaydını
  // silerdi.

  /** Görünümü hemen güncelle, sonra buluta yaz. */
  const apply = useCallback(next => {
    dbRef.current = next
    setDb(next)
  }, [])

  // ÖNEMLİ: upsertPairing, upsertBird'dan ÖNCE tanımlanmalı. Ters sırada
  // olursa bağımlılık dizisi okunurken "before initialization" hatası verir
  // ve uygulama beyaz ekranda açılır.
  /**
 * Çiftleşme kaydı yazar.
 *
 * TEK EŞ KURALI: Bir kuşun aynı anda yalnızca bir "simdi" eşi olabilir.
 * Yeni bir mevcut eş atandığında, o iki kuşun önceki mevcut eşleri
 * otomatik olarak "eski" duruma alınır. Böylece veri katmanı da kuralı
 * uygular; arayüz kısıtlaması tek başına yeterli sayılmaz.
 *
 * `durum: 'eski'` ile gelen kayıtlar hiçbir zaman "simdi"ye yükseltilmez.
 */
const upsertPairing = useCallback(async (p) => {
    const cur = dbRef.current
    // Eğer p.id verilmemişse, aynı iki kuş arasında zaten bir eşleşme var mı kontrol et
    const existingPair = (!p.id && p.maleId && p.femaleId)
      ? cur.pairings.find(x => x.maleId === p.maleId && x.femaleId === p.femaleId)
      : null

    const id = p.id || existingPair?.id || uid()
    const durum = p.durum ? (p.durum === 'eski' ? 'eski' : 'simdi') : (existingPair?.durum || 'simdi')

    // Var olan yavruları kaybetme, yeni gelenlerle birleştir
    const existingChickIds = existingPair?.chickIds || []
    const chickIds = Array.isArray(p.chickIds)
      ? [...new Set([...existingChickIds, ...p.chickIds])]
      : existingChickIds

    const record = { ...(existingPair || {}), ...p, id, chickIds, durum }
    const exists = cur.pairings.some(x => x.id === record.id)

    let pairings
    if (exists) {
      pairings = cur.pairings.map(x => (x.id === record.id ? record : x))
    } else {
      pairings = [...cur.pairings, record]
    }

    // Yeni MEVCUT eş atandıysa, aynı kuşların önceki mevcut eşlerini eskiye al.
    if (durum === 'simdi') {
      const touched = new Set([record.maleId, record.femaleId].filter(Boolean))
      const demoted = []
      pairings = pairings.map(x => {
        if (x.id === record.id) return x
        const inPair = touched.has(x.maleId) || touched.has(x.femaleId)
        if (!inPair || isFormer(x)) return x
        const next = { ...x, durum: 'eski' }
        demoted.push(next)
        return next
      })
      for (const d of demoted) await api.pairingPut(d)
    }

    apply({ ...cur, pairings })
    await api.pairingPut(record)

    const male = cur.birds.find(b => b.id === record.maleId)
    const female = cur.birds.find(b => b.id === record.femaleId)
    recordActivity({
      type: 'pairing_add',
      title: `Eşleme: ${female ? ringOf(female) : 'Dişi'} × ${male ? ringOf(male) : 'Erkek'}`,
      detail: durum === 'eski' ? 'Eski Eş Olarak Kaydedildi' : 'Mevcut Eş'
    })

    return record
  }, [apply])

  const upsertBird = useCallback(async (bird) => {
    const now = new Date().toISOString()
    const record = { ...bird, id: bird.id || uid(), updatedAt: now, createdAt: bird.createdAt || now }
    const cur = dbRef.current
    const previous = cur.birds.find(b => b.id === record.id)
    const exists = Boolean(previous)
    const birds = exists
      ? cur.birds.map(b => (b.id === record.id ? record : b))
      : [...cur.birds, record]
    apply({ ...cur, birds })
    await api.birdPut(record)

    // Kümes değiştirildiyse aktif görünümü de yeni kümese taşı. Böylece
    // kuş kaydedildikten sonra listede "kaybolmuş" gibi görünmez.
    if (activeCoopId && record.coopId && record.coopId !== activeCoopId) {
      setActiveCoopId(record.coopId)
      try { localStorage.setItem('guvercin:active_coop', record.coopId) } catch {}
    }

    if (!exists) {
      recordActivity({
        type: 'bird_add',
        title: `${ringOf(record)} Sisteme Eklendi`,
        detail: `${SEX[record.sex] || 'Cinsiyet Belirtilmemiş'} · ${statusLabel(record.status)}${record.name ? ` · ${record.name}` : ''}${record.cinsi ? ` · ${record.cinsi}` : ''}`,
        birdId: record.id
      })
    } else {
      recordActivity({
        type: 'bird_edit',
        title: `${ringOf(record)} Güncellendi`,
        detail: record.name || record.cinsi || `${SEX[record.sex] || ''} ${statusLabel(record.status)}`,
        birdId: record.id
      })
    }

    // Yavru "Yeni Kuş" ekranından baba/ana seçilerek girildiğinde, o
    // eşleşmenin yavru listesine de eklenir. Böylece kuş sayfasındaki
    // "Eşler" kartı kaç yavru var doğru gösterir.
    if (record.sireId && record.damId) {
      const pairing = cur.pairings.find(p => p.maleId === record.sireId && p.femaleId === record.damId)
      if (pairing) {
        if (!(pairing.chickIds || []).includes(record.id)) {
          await upsertPairing({ ...pairing, chickIds: [...(pairing.chickIds || []), record.id] })
        }
      } else {
        // Eğer anne veya babanın zaten başka bir mevcut eşi varsa,
        // geriye dönük yavru kaydı o mevcut evliliği bozmamalı; durum: 'eski' olarak açılır.
        const sireHasMate = cur.pairings.some(p => p.maleId === record.sireId && !isFormer(p))
        const damHasMate = cur.pairings.some(p => p.femaleId === record.damId && !isFormer(p))
        const durum = (sireHasMate || damHasMate) ? 'eski' : 'simdi'
        await upsertPairing({ maleId: record.sireId, femaleId: record.damId, chickIds: [record.id], durum })
      }
    }
    return record
  }, [apply, upsertPairing, activeCoopId])

  const removeBird = useCallback(async (id) => {
    const cur = dbRef.current
    const target = cur.birds.find(b => b.id === id)
    // Silinen kuşun çocuklarındaki baba/ana bağı boşalır; soy kaydı kaybolmasın.
    const affected = cur.birds
      .filter(b => b.sireId === id || b.damId === id)
      .map(b => ({ ...b, sireId: b.sireId === id ? '' : b.sireId, damId: b.damId === id ? '' : b.damId }))
    const dropPairings = cur.pairings.filter(p => p.maleId === id || p.femaleId === id)
    const keepPairings = cur.pairings
      .filter(p => p.maleId !== id && p.femaleId !== id)
      .map(p => ({ ...p, chickIds: (p.chickIds || []).filter(c => c !== id) }))

    const next = {
      ...cur,
      birds: cur.birds.map(b => affected.find(a => a.id === b.id) || b).filter(b => b.id !== id),
      pairings: keepPairings
    }
    apply(next)

    await api.birdDelete(id)
    /* Kuş silinirken fotoğrafları da silinmeli: yoksa Firestore'da sahibi
     * kalmayan belge yığılıyor (kota + gereksiz okuma). */
    for (const name of (target?.photos || [])) {
      const r = await api.photoDelete(name)
      if (!r.ok) console.warn('Fotoğraf silinemedi:', name, r.error)
    }
    for (const b of affected) await api.birdPut(b)
    for (const p of dropPairings) await api.pairingDelete(p.id)
    for (const p of keepPairings) await api.pairingPut(p)

    if (target) {
      recordActivity({
        type: 'bird_delete',
        title: `${ringOf(target)} Sistemden Silindi`,
        detail: target.name ? `İsim: ${target.name}` : ''
      })
    }
  }, [apply])

  const resetAllLoftChecks = useCallback(async () => {
    const cur = dbRef.current
    let changed = 0
    const nextBirds = cur.birds.map(b => {
      if (b.checkedAt) {
        changed++
        const copy = { ...b }
        delete copy.checkedAt
        return copy
      }
      return b
    })
    if (changed === 0) return 0
    apply({ ...cur, birds: nextBirds })
    for (const b of cur.birds) {
      if (b.checkedAt) {
        const copy = { ...b }
        delete copy.checkedAt
        await api.birdPut(copy)
      }
    }
    recordActivity({
      type: 'bird_edit',
      title: 'Tüm Kümes Kontrolleri Sıfırlandı',
      detail: `${changed} kuşun mevcudiyet kontrol kaydı temizlendi`
    })
    return changed
  }, [apply])

  /** Çiftleşme kaydını yönetir:
   *  - Mevcut ("simdi") eş ayrıldığında "eski" duruma düşer.
   *  - Zaten "eski" olan kayıt silindiğinde veritabanından tamamen silinir.
   */
  const removePairing = useCallback(async (id) => {
    const cur = dbRef.current
    const target = cur.pairings.find(p => p.id === id)
    if (!target) return
    const male = cur.birds.find(b => b.id === target.maleId)
    const female = cur.birds.find(b => b.id === target.femaleId)
    if (target.durum === DURUM_ESKI) {
      const toRemove = cur.pairings.filter(p => p.id === id || (p.maleId === target.maleId && p.femaleId === target.femaleId && p.durum === DURUM_ESKI))
      apply({ ...cur, pairings: cur.pairings.filter(p => !toRemove.some(r => r.id === p.id)) })
      for (const r of toRemove) {
        await api.pairingDelete(r.id)
      }
      recordActivity({
        type: 'pairing_remove',
        title: `Eski Eş Kaydı Silindi: ${female ? ringOf(female) : 'Dişi'} × ${male ? ringOf(male) : 'Erkek'}`
      })
    } else {
      const next = { ...target, durum: DURUM_ESKI }
      apply({ ...cur, pairings: cur.pairings.map(p => p.id === id ? next : p) })
      await api.pairingPut(next)
      recordActivity({
        type: 'pairing_remove',
        title: `Eş Ayrıldı: ${female ? ringOf(female) : 'Dişi'} × ${male ? ringOf(male) : 'Erkek'}`
      })
    }
  }, [apply])

  const saveSettings = useCallback(async (settings) => {
    apply({ ...dbRef.current, settings })
    await api.settingsPut(settings)
  }, [apply])

  const changeCoop = useCallback((id) => {
    const next = id || ALL_COOPS
    setActiveCoopId(next)
    try { localStorage.setItem('guvercin:active_coop', next) } catch {}
    // Kümes değişince açık kuş/form başka kümese ait kalmasın.
    setOpenId(null)
    setEditing(null)
    const el = document.querySelector('.body')
    if (el) el.scrollTop = 0
  }, [])

  /**
   * Kümes silme: kuşlar hedef kümese taşınır, ardından kümes listesi yazılır.
   * Kuş kaydı silinmez; çiftleşme/kuluçka/tedavi kuştan türetildiği için
   * ayrıca güncellenmesi gerekmez.
   */
  const deleteCoop = useCallback(async (id, targetId) => {
    const cur = dbRef.current
    const list = coopList(cur)
    if (list.length <= 1) return
    const removed = list.find(c => c.id === id)
    const target = list.find(c => c.id === targetId) || list.find(c => c.id !== id)
    if (!removed || !target) return

    const moved = cur.birds.filter(b => birdCoopId(b, cur) === id)
    const birds = cur.birds.map(b =>
      birdCoopId(b, cur) === id ? { ...b, coopId: target.id } : b
    )
    const nextCoops = list
      .filter(c => c.id !== id)
      .map((c, i) => ({ ...c, order: i }))
    const nextSettings = { ...cur.settings, coops: nextCoops }

    apply({ ...cur, birds, settings: nextSettings })
    for (const bird of moved) {
      await api.birdPut({ ...bird, coopId: target.id })
    }
    await api.settingsPut(nextSettings)
    if (activeCoopId === id) changeCoop(target.id)
    recordActivity({
      type: 'general',
      icon: '🏠',
      title: `Kümes Silindi: ${removed.name}`,
      detail: `${moved.length} kuş ${target.name} kümesine taşındı`
    })
  }, [apply, activeCoopId, changeCoop])

  const setRightCodes = useCallback(async (codes) => {
    const cur = dbRef.current
    const sorted = sortTr(codes)
    return saveSettings({ ...cur.settings, rightCodes: sorted, leftCodes: sorted, codes: sorted })
  }, [saveSettings])

  const setLeftCodes = useCallback(async (codes) => {
    const cur = dbRef.current
    const sorted = sortTr(codes)
    return saveSettings({ ...cur.settings, rightCodes: sorted, leftCodes: sorted, codes: sorted })
  }, [saveSettings])

  const setCodes = useCallback(async (codes) => {
    const cur = dbRef.current
    const sorted = sortTr(codes)
    return saveSettings({ ...cur.settings, rightCodes: sorted, leftCodes: sorted, codes: sorted })
  }, [saveSettings])

  // Cins listesi KÜMES BAZINDADIR: her kümesin cinsleri kendi altında
  // saklanır, seçili kümesin listesi forma yansır. Klips renkleri ortak kalır.
  const setCinsi = useCallback(async (cinsi, coopId) => {
    const cur = dbRef.current
    const target = coopId || fallbackCoopId(coopList(cur))
    return saveSettings(withCoopCinsi(cur.settings, target, cinsi))
  }, [saveSettings])

  // İlaç / Tedavi / Dozaj işlemleri
  const upsertMedication = useCallback(async (med) => {
    const now = new Date().toISOString()
    const record = { ...med, id: med.id || uid(), updatedAt: now, createdAt: med.createdAt || now }
    const cur = dbRef.current
    const exists = cur.medications.some(m => m.id === record.id)
    const medications = exists
      ? cur.medications.map(m => (m.id === record.id ? record : m))
      : [...cur.medications, record]
    apply({ ...cur, medications })
    await api.medicationPut(record)
    recordActivity({
      type: 'med_add',
      title: `${record.name} İlacı Kaydedildi`,
      detail: record.dosage ? `Doz: ${record.dosage}` : (record.purpose || '')
    })
    return record
  }, [apply])

  const removeMedication = useCallback(async (id) => {
    const cur = dbRef.current
    const target = cur.medications.find(m => m.id === id)
    apply({ ...cur, medications: cur.medications.filter(m => m.id !== id) })
    await api.medicationDelete(id)
    if (target) {
      recordActivity({
        type: 'med_add',
        title: `${target.name} İlacı Silindi`
      })
    }
  }, [apply])

  // Takviye ve yem rehberi işlemleri
  const upsertSupplement = useCallback(async (sup) => {
    const now = new Date().toISOString()
    const record = { ...sup, id: sup.id || uid(), updatedAt: now, createdAt: sup.createdAt || now }
    const cur = dbRef.current
    const exists = (cur.supplements || []).some(s => s.id === record.id)
    const supplements = exists
      ? cur.supplements.map(s => (s.id === record.id ? record : s))
      : [...(cur.supplements || []), record]
    apply({ ...cur, supplements })
    await api.supplementPut(record)
    recordActivity({
      type: 'sup_add',
      title: `${record.name} ${record.kind === 'feed' ? 'Yemi' : 'Takviyesi'} Kaydedildi`,
      detail: record.purpose || ''
    })
    return record
  }, [apply])

  const removeSupplement = useCallback(async (id) => {
    const cur = dbRef.current
    const target = (cur.supplements || []).find(s => s.id === id)
    apply({ ...cur, supplements: (cur.supplements || []).filter(s => s.id !== id) })
    await api.supplementDelete(id)
    if (target) {
      recordActivity({
        type: 'sup_add',
        title: `${target.name} ${target.kind === 'feed' ? 'Yemi' : 'Takviyesi'} Silindi`
      })
    }
  }, [apply])

  // Kuluçka / Üretim işlemleri
  const upsertClutch = useCallback(async (clutch) => {
    // male/female = kuşun tam kopyası, tl = zaman çizelgesi (hepsi hesaplanır)
    const clean = withoutComputed(clutch, ['male', 'female', 'tl'])
    const now = new Date().toISOString()
    const record = { ...clean, id: clean.id || uid(), updatedAt: now, createdAt: clean.createdAt || now }
    const cur = dbRef.current
    const exists = (cur.clutches || []).some(c => c.id === record.id)
    const clutches = exists
      ? cur.clutches.map(c => (c.id === record.id ? record : c))
      : [...(cur.clutches || []), record]
    apply({ ...cur, clutches })
    await api.clutchPut(record)

    const female = (cur.birds || []).find(b => b.id === record.femaleId)
    const male = (cur.birds || []).find(b => b.id === record.maleId)
    const pairStr = `${female ? ringOf(female) : 'Dişi'} × ${male ? ringOf(male) : 'Erkek'}`
    let statusText = 'Kuluçkada Yatıyor'
    if (record.status === 'hatched') statusText = `Yavru Çıktı (${record.chickCount || 1} Adet)`
    else if (record.status === 'empty') statusText = 'Boş Çıktı / Kırıldı'
    else if (record.status === 'done') statusText = 'Tamamlandı'

    recordActivity({
      type: exists ? 'egg_status' : 'clutch_add',
      title: exists ? `Kuluçka Güncellendi: ${record.nest || pairStr}` : `Yeni Kuluçka: ${record.nest || pairStr}`,
      detail: `Durum: ${statusText}${record.notes ? ` · ${record.notes}` : ''}`
    })

    return record
  }, [apply])

  const removeClutch = useCallback(async (id) => {
    const cur = dbRef.current
    const target = (cur.clutches || []).find(c => c.id === id)
    apply({ ...cur, clutches: (cur.clutches || []).filter(c => c.id !== id) })
    await api.clutchDelete(id)
    if (target) {
      recordActivity({
        type: 'clutch_add',
        title: `Kuluçka Kaydı Silindi: ${target.nest || 'Yuva'}`
      })
    }
  }, [apply])

  // Aşı ve Tedavi Uygulaması işlemleri
  const upsertVaccination = useCallback(async (vac) => {
    const now = new Date().toISOString()
    const record = { ...vac, id: vac.id || uid(), updatedAt: now, createdAt: vac.createdAt || now }
    const cur = dbRef.current
    const exists = (cur.vaccinations || []).some(v => v.id === record.id)
    const vaccinations = exists
      ? cur.vaccinations.map(v => (v.id === record.id ? record : v))
      : [...(cur.vaccinations || []), record]
    apply({ ...cur, vaccinations })
    await api.vaccinationPut(record)

    recordActivity({
      type: 'vac_add',
      title: `${record.name} Aşısı / Uygulaması Kaydedildi`,
      detail: record.dosage ? `Doz: ${record.dosage}` : ''
    })

    return record
  }, [apply])

  const removeVaccination = useCallback(async (id) => {
    const cur = dbRef.current
    const target = (cur.vaccinations || []).find(v => v.id === id)
    apply({ ...cur, vaccinations: (cur.vaccinations || []).filter(v => v.id !== id) })
    await api.vaccinationDelete(id)
    if (target) {
      recordActivity({
        type: 'vac_add',
        title: `${target.name} Aşısı Silindi`
      })
    }
  }, [apply])

  // Hastalık ve Tedavi Takibi işlemleri
  const upsertTreatment = useCallback(async (treatment) => {
    // bird = kuşun tam kopyası, days = hesaplanan süre (kayda yazılmaz)
    const clean = withoutComputed(treatment, ['bird', 'days'])
    const now = new Date().toISOString()
    const record = { ...clean, id: clean.id || uid(), updatedAt: now, createdAt: clean.createdAt || now }
    const cur = dbRef.current
    const exists = (cur.treatments || []).some(t => t.id === record.id)
    const treatments = exists
      ? cur.treatments.map(t => (t.id === record.id ? record : t))
      : [...(cur.treatments || []), record]
    apply({ ...cur, treatments })
    await api.treatmentPut(record)

    const bird = (cur.birds || []).find(b => b.id === record.birdId)
    const bName = bird ? ringOf(bird) : 'Kuş'
    recordActivity({
      type: record.status === 'iyilesti' ? 'treat_cure' : 'treat_add',
      icon: record.status === 'iyilesti' ? '✅' : '🩺',
      title: record.status === 'iyilesti' ? `${bName} İyileşti (${record.illness})` : `${bName}: ${record.illness} Tedavisi Kaydedildi`,
      detail: `Durum: ${record.status} · İlaç: ${record.medicine || '—'}`
    })

    return record
  }, [apply])

  const removeTreatment = useCallback(async (id) => {
    const cur = dbRef.current
    const target = (cur.treatments || []).find(t => t.id === id)
    apply({ ...cur, treatments: (cur.treatments || []).filter(t => t.id !== id) })
    await api.treatmentDelete(id)
    if (target) {
      const bird = (cur.birds || []).find(b => b.id === target.birdId)
      recordActivity({
        type: 'treat_add',
        title: `${bird ? ringOf(bird) : 'Kuş'} İçin Tedavi Kaydı Silindi`,
        detail: target.illness
      })
    }
  }, [apply])

  // Cins listesi BİLEREK otomatik doldurulmaz. Her kuşçunun cins listesi
  // farklı; hazır liste yanlış kayıtlara yol açıyordu. Kullanıcı Ayarlar'da
  // kendi listesini elle yazar (alan boş gelir, ipucu metninde örnek görünür).

  // Ayar kaydedilince (veya başka cihazda değişince) tema anında uygulanır.
  useEffect(() => {
    applyTheme(db.settings?.theme || 'dumanli')
  }, [db.settings?.theme])

  // Özel künye kod renkleri güncellenince rozetlere anında yansır
  useEffect(() => {
    setGlobalCodeColors(db.settings?.codeColors || {})
  }, [db.settings?.codeColors])

  // ------------------------------------------------------------- kümesler
  // `coops` ayarlardan türetilir; eksik/boşsa tek varsayılan kümes döner.
  const coops = useMemo(() => coopList(db), [db.settings])

  // Kayıtlı tercih geçersizse (kümes silinmiş) ilk kümese düş.
  useEffect(() => {
    if (!coops.length) return
    if (activeCoopId === ALL_COOPS) return
    if (activeCoopId && coops.some(c => c.id === activeCoopId)) return
    setActiveCoopId(coops[0].id)
    try { localStorage.setItem('guvercin:active_coop', coops[0].id) } catch {}
  }, [coops, activeCoopId])

  /**
   * Kuşu açarken ait olduğu kümese geç.
   * Geçmiş, bildirim veya akrabalık bağlantısından başka kümesin kuşu
   * açılırsa kullanıcı yanlış kümeste kalmaz.
   */
  /**
   * Kuş profilini kapatır ve gezinme geçmişini sıfırlar.
   */
  const closeBird = useCallback(() => {
    setBirdHistory([])
    setOpenId(null)
  }, [])

  /**
   * Gezinme geçmişinden bir önceki kuşa döner.
   */
  const goBackBird = useCallback(() => {
    setBirdHistory(prev => {
      if (!prev || prev.length === 0) {
        setOpenId(null)
        return []
      }
      const next = [...prev]
      const prevId = next.pop()
      const prevBird = dbRef.current.birds.find(b => b.id === prevId)
      if (prevBird) {
        const coopId = birdCoopId(prevBird, dbRef.current)
        if (coopId && coopId !== activeCoopId) {
          setActiveCoopId(coopId)
          try { localStorage.setItem('guvercin:active_coop', coopId) } catch {}
        }
      }
      setOpenId(prevId)
      return next
    })
  }, [activeCoopId])

  /**
   * Kuşu açarken ait olduğu kümese geç ve geçmişe kaydet.
   * Geçmiş, bildirim veya akrabalık bağlantısından başka kümesin kuşu
   * açılırsa kullanıcı yanlış kümeste kalmaz.
   */
  const openBird = useCallback((id) => {
    const bird = dbRef.current.birds.find(b => b.id === id)
    if (bird) {
      const coopId = birdCoopId(bird, dbRef.current)
      if (coopId && coopId !== activeCoopId) {
        setActiveCoopId(coopId)
        try { localStorage.setItem('guvercin:active_coop', coopId) } catch {}
      }
    }
    setOpenId(currId => {
      if (currId && currId !== id) {
        setBirdHistory(prev => {
          if (prev.length > 0 && prev[prev.length - 1] === currId) return prev
          return [...prev, currId]
        })
      }
      return id
    })
    setView('list')
  }, [activeCoopId])

  const prevBirdId = birdHistory.length > 0 ? birdHistory[birdHistory.length - 1] : null
  const prevBird = useMemo(
    () => (prevBirdId ? db.birds.find(b => b.id === prevBirdId) || null : null),
    [db.birds, prevBirdId]
  )

  const activeCoop = useMemo(
    () => coops.find(c => c.id === activeCoopId) || null,
    [coops, activeCoopId]
  )

  // Ekranlara giden görünüm: seçili kümesin kuşları ve türetilmiş kayıtları.
  const viewDb = useMemo(
    () => scopeDb(db, activeCoopId || ALL_COOPS),
    [db, activeCoopId]
  )

  const stats = useMemo(
    () => coopStats(db, activeCoopId || ALL_COOPS),
    [db, activeCoopId]
  )

  // Seçici rozetlerinde kümes başına canlı kuş sayısı.
  const coopCounts = useMemo(() => {
    const out = { [ALL_COOPS]: coopStats(db, ALL_COOPS).total }
    for (const coop of coops) out[coop.id] = coopStats(db, coop.id).total
    return out
  }, [db, coops])

  const activeSickCount = useMemo(() => {
    return (viewDb.treatments || []).filter(t => t.status === 'aktif' || t.status === 'karantina').length
  }, [viewDb.treatments])

  // ------------------------------------------------------------------ ekranlar
  if (!configured) return <SetupScreen />

  if (!auth.ready) {
    return <div className="app"><div className="body">Yükleniyor…</div></div>
  }

  if (!auth.signedIn) {
    return (
      <AuthScreen
        onNotify={notify}
        onDone={() => { /* veri akışı onAuth dinleyicisiyle başlar */ }}
      />
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-row">
          <div className="coop-picker-slot">
            <CoopPicker
              coops={coops}
              value={activeCoopId || ALL_COOPS}
              counts={coopCounts}
              onChange={changeCoop}
              onManage={() => {
                try {
                  const saved = JSON.parse(localStorage.getItem('settings_open_cards') || '[]')
                  localStorage.setItem('settings_open_cards', JSON.stringify([...new Set([...saved, 'coops'])]))
                } catch {}
                setView('backup')
                setOpenId(null)
              }}
            />
          </div>
          <div
            className="brand-wrap"
            onClick={() => setShowVersionModal(true)}
            style={{ cursor: 'pointer' }}
            title="Sürüm Bilgisi ve Geliştirme Geçmişi"
          >
            <span className="brand-icon">🕊️</span>
            <span className="brand">{dispTr('GÜVERCİN SOY TAKİP')}</span>
            <span className="brand-pill">{dispTr('BETA')}</span>
          </div>
          <div className="brand-actions">
            {auth.email && (
              <span className="auth-email-pill desktop-only" title={`Oturum: ${auth.email}`}>
                <span className="auth-icon">👤</span>
                <span className="auth-email-text">{auth.email}</span>
              </span>
            )}
            <button
              type="button"
              className="logout-pill-btn desktop-only"
              onClick={() => setShowLogoutModal(true)}
              title="Oturumu kapat (Çıkış)"
            >
              <span>🚪</span>
              <span className="logout-pill-label">{dispTr('ÇIKIŞ')}</span>
            </button>
            <button
              type="button"
              className="history-pill-btn desktop-only"
              onClick={() => setShowActivityLog(true)}
              title="İşlem Geçmişi & Log Kayıtları"
            >
              <span>📋</span>
              <span>{dispTr('GEÇMİŞ')}</span>
            </button>
          </div>
        </div>
        <div className="topbar-tabs desktop-only">
          <nav className="nav">
            <button className={view === 'list' ? 'on' : ''} onClick={() => { setView('list'); closeBird() }}>{dispTr('Kuşlar')}</button>
            <button className={view === 'incubation' ? 'on' : ''} onClick={() => { setView('incubation'); closeBird() }}>{dispTr('Kuluçka & Üretim')}</button>
            <button className={view === 'treatments' ? 'on' : ''} onClick={() => { setView('treatments'); closeBird() }}>
              {dispTr('Hastalık Panosu')}
              {activeSickCount > 0 && <span className="tab-badge-pill">{activeSickCount}</span>}
            </button>
            <button className={view === 'medications' ? 'on' : ''} onClick={() => { setView('medications'); closeBird() }}>{dispTr('İlaçlar & Aşılar')}</button>
            <button className={view === 'backup' ? 'on' : ''} onClick={() => { setView('backup'); closeBird() }}>{dispTr('Yedekleme / Ayarlar')}</button>
          </nav>
        </div>
      </header>

      <div className={'body view-' + view}>
        {view === 'list' && !openId && (
          <BirdList db={viewDb} allDb={db} stats={stats} activeCoop={activeCoop} onOpen={openBird} onNew={() => setEditing({ coopId: activeCoop?.id || coops[0]?.id || '' })} />
        )}

        {view === 'list' && openId && (
          <BirdDetail
            key={openId}
            bird={db.birds.find(b => b.id === openId)}
            db={viewDb}
            allDb={db}
            activeCoop={activeCoop}
            coops={coops}
            onBack={closeBird}
            onPrevBird={birdHistory.length > 0 ? goBackBird : null}
            prevBird={prevBird}
            onOpenBird={openBird}
            onUpsertPairing={upsertPairing}
            onRemovePairing={removePairing}
            onUpsertTreatment={upsertTreatment}
            onRemoveTreatment={removeTreatment}
            onEdit={b => setEditing(b)}
            onDelete={async id => {
              closeBird()
              try {
                await removeBird(id)
                notify('Kuş silindi')
              } catch (err) {
                console.error('Silme hatası:', err)
                notify('Kuş silinirken hata oluştu: ' + (err.message || err), 'err')
              }
            }}
            onUpsert={upsertBird}
            onNotify={notify}
          />
        )}

        {view === 'incubation' && (
          <Incubation
            db={viewDb}
            onUpsertClutch={upsertClutch}
            onRemoveClutch={removeClutch}
            onUpsertPairing={upsertPairing}
            onNewChick={({ sireId, damId, birthDate }) => {
              const sire = dbRef.current.birds.find(b => b.id === sireId)
              const dam = dbRef.current.birds.find(b => b.id === damId)
              const parent = sire || dam
              const coopId = parent ? birdCoopId(parent, dbRef.current) : (activeCoop?.id || '')
              setEditing({ sireId, damId, birthDate, status: 'damizlik', coopId })
              setView('list')
              setOpenId(null)
            }}
            onOpenBird={openBird}
            onNotify={notify}
          />
        )}

        {view === 'treatments' && (
          <TreatmentBoard
            db={viewDb}
            onUpsertTreatment={upsertTreatment}
            onRemoveTreatment={removeTreatment}
            onOpenBird={openBird}
            onNotify={notify}
          />
        )}

        {view === 'medications' && (
          <Medications
            db={viewDb}
            onUpsertMedication={upsertMedication}
            onRemoveMedication={removeMedication}
            onUpsertVaccination={upsertVaccination}
            onRemoveVaccination={removeVaccination}
            onUpsertSupplement={upsertSupplement}
            onRemoveSupplement={removeSupplement}
            onSaveSettings={saveSettings}
            onNotify={notify}
            onOpenBird={openBird}
          />
        )}

        {view === 'backup' && (
          <Backup
            db={db}
            account={auth}
            activeCoopId={activeCoopId || ALL_COOPS}
            onSaveSettings={saveSettings}
            onNotify={notify}
            onSignOut={() => setShowLogoutModal(true)}
            onOpenActivityLog={() => setShowActivityLog(true)}
            activitiesCount={activities.length}
            onResetLoftChecks={resetAllLoftChecks}
            onOpenUpdate={upd => setPendingUpdate(upd)}
            onDeleteCoop={deleteCoop}
          />
        )}
      </div>

      {editing && (
        <BirdForm
          bird={editing}
          db={db}
          activeCoopId={activeCoopId || ALL_COOPS}
          coops={coops}
          onRightCodesChange={setRightCodes}
          onLeftCodesChange={setLeftCodes}
          onCodesChange={setCodes}
          onCinsiChange={setCinsi}
          onCancel={() => setEditing(null)}
          onSave={async (b, mateId) => {
            const saved = await upsertBird(b)
            setEditing(null)
            notify('Kaydedildi: ' + (b.name || ringOf(saved)))

            if (mateId) {
              const mate = dbRef.current.birds.find(x => x.id === mateId)
              if (mate) {
                let maleId = ''
                let femaleId = ''
                if (saved.sex === 'M') { maleId = saved.id; femaleId = mate.id }
                else if (saved.sex === 'F') { maleId = mate.id; femaleId = saved.id }
                else if (mate.sex === 'M') { maleId = mate.id; femaleId = saved.id }
                else if (mate.sex === 'F') { maleId = saved.id; femaleId = mate.id }
                else { maleId = saved.id; femaleId = mate.id }

                // Kuş zaten bu eşle MEVCUT eş durumundaysa tekrar işlem yapmaya gerek yok
                const existing = dbRef.current.pairings.find(p => p.maleId === maleId && p.femaleId === femaleId)
                if (!existing || existing.durum !== 'simdi') {
                  await upsertPairing({
                    ...(existing || {}),
                    maleId,
                    femaleId,
                    durum: 'simdi'
                  })
                  notify('Eş bağlandı: ' + ringOf(mate))
                }
              }
            }

            setOpenId(saved.id)
            setView('list')
          }}
        />
      )}

      {showActivityLog && (
        <ActivityLogModal
          activities={activities}
          onOpenBird={id => {
            setShowActivityLog(false)
            openBird(id)
          }}
          onClose={() => setShowActivityLog(false)}
          onClear={() => {
            clearActivities()
            notify('İşlem logları temizlendi')
          }}
        />
      )}

      <nav className="bottom-nav mobile-only" ref={bottomNavRef}>
        <button className={view === 'list' ? 'on' : ''} onClick={() => { setView('list'); closeBird() }}>
          <span className="bnav-icon">🕊️</span>
          <span className="bnav-label">{dispTr('Kuşlar')}</span>
        </button>
        <button className={view === 'incubation' ? 'on' : ''} onClick={() => { setView('incubation'); closeBird() }}>
          <span className="bnav-icon">🥚</span>
          <span className="bnav-label">{dispTr('Kuluçka')}</span>
        </button>
        <button className={view === 'treatments' ? 'on' : ''} onClick={() => { setView('treatments'); closeBird() }}>
          <span className="bnav-icon" style={{ position: 'relative' }}>
            🩺
            {activeSickCount > 0 && <span className="bnav-badge">{activeSickCount}</span>}
          </span>
          <span className="bnav-label">{dispTr('Hastalık')}</span>
        </button>
        <button className={view === 'medications' ? 'on' : ''} onClick={() => { setView('medications'); closeBird() }}>
          <span className="bnav-icon">💊</span>
          <span className="bnav-label">{dispTr('İlaç & Aşı')}</span>
        </button>
        <button className={view === 'backup' ? 'on' : ''} onClick={() => { setView('backup'); closeBird() }}>
          <span className="bnav-icon">⚙️</span>
          <span className="bnav-label">{dispTr('Ayarlar')}</span>
        </button>
      </nav>

      {toast && (
        <div className={`toast ${toast.kind}`}>
          {!/^[✅⚠️🕊️🐣🚨]/.test(toast.text) && (
            <span style={{ marginRight: 8, fontSize: 16 }}>
              {toast.kind === 'err' ? '⚠️' : '✅'}
            </span>
          )}
          <span>{dispTr(toast.text)}</span>
        </div>
      )}

      {showExitModal && (
        <div
          className="picker-backdrop overlay exit-modal-overlay"
          style={{
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setShowExitModal(false)}
        >
          <div
            className="panel"
            style={{
              maxWidth: 340,
              width: '100%',
              margin: '0 auto',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              padding: '24px 20px 18px',
              textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }}>🕊️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
              Uygulamadan Çıkılsın mı?
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.45 }}>
              Güvercin Soy Takip uygulamasından çıkmak istediğinize emin misiniz?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowExitModal(false)}
                style={{ padding: '10px 16px', fontWeight: 600, fontSize: 13.5, borderRadius: 10 }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => CapApp.exitApp()}
                style={{
                  background: '#ef4444',
                  borderColor: '#ef4444',
                  color: '#fff',
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 10
                }}
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div
          className="overlay logout-modal-overlay"
          style={{
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowLogoutModal(false) }}
        >
          <div
            className="panel"
            style={{
              maxWidth: 360,
              width: '100%',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              padding: '24px 20px 18px',
              textAlign: 'center'
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>🚪</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
              Çıkış Yapılsın mı?
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              <b style={{ textTransform: 'none' }}>{auth.email}</b> hesabından çıkmak
              istediğinize emin misiniz? Kayıtlarınız bulutta güvende kalır; aynı
              hesapla tekrar giriş yapabilirsiniz.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: '10px 16px', fontWeight: 600, fontSize: 13.5, borderRadius: 10 }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={async () => {
                  setShowLogoutModal(false)
                  await api.signOut()
                  notify('Çıkış yapıldı')
                }}
                style={{
                  background: '#ef4444',
                  borderColor: '#ef4444',
                  color: '#fff',
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 10
                }}
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingUpdate && (
        <UpdateModal
          update={pendingUpdate}
          onClose={() => {
            if (pendingUpdate?.buildTime) rememberDismissedUpdate(pendingUpdate.buildTime)
            setPendingUpdate(null)
          }}
        />
      )}

      {showVersionModal && (
        <VersionHistoryModal
          onClose={() => setShowVersionModal(false)}
          onOpenUpdate={upd => setPendingUpdate(upd)}
          onNotify={notify}
        />
      )}

      <PhotoViewer />
    </div>
  )
}