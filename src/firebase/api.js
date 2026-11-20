/**
 * Firestore + Storage katmanı.
 *
 * Tasarım: her kuş kendi belgesidir, her çiftleşme kendi belgesidir.
 * Böylece iki kişi aynı anda farklı kuşları düzenleyebilir; birinin
 * kaydı diğerinininkini silmez. (Tek büyük JSON'a yazmak "son yazan
 * kazanır" olurdu ve veri kaybettirirdi.)
 *
 * Bu dosya React'tan bağımsızdır; `window.api` yüzeyini üretir.
 */

import { initializeApp } from 'firebase/app'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, writeBatch
} from 'firebase/firestore'
import {
  getAuth, setPersistence, browserLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  updatePassword,
  signOut, onAuthStateChanged, updateProfile
} from 'firebase/auth'

import { firebaseConfig, isConfigured } from './config.js'
import { migrate } from '../schema.js'
import { compressImage } from './image.js'
import { APP_VERSION, BUILD_TIME } from '../version.js'

const ok = data => ({ ok: true, data })
const fail = error => ({ ok: false, error: turkceHata((error && error.message) || error) })

/** Firebase'in İngilizce hatalarını kullanıcının anlayacağı Türkçeye çevir. */
function turkceHata(msg) {
  const m = String(msg)
  if (/invalid-email/i.test(m)) return 'Geçersiz e-posta adresi.'
  if (/missing-password/i.test(m)) return 'Şifre boş bırakılamaz.'
  if (/weak-password/i.test(m)) return 'Şifre en az 6 karakter olmalı.'
  if (/email-already-in-use|already-in-use/i.test(m)) return 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.'
  if (/user-not-found/i.test(m)) return 'Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.'
  if (/wrong-password|invalid-credential/i.test(m)) return 'E-posta veya şifre hatalı.'
  if (/requires-recent-login/i.test(m)) return 'Güvenlik nedeniyle şifre değiştirmeden önce tekrar giriş yapmalısınız.'
  if (/expired-action-code/i.test(m)) return 'Bu şifre sıfırlama kodunun süresi dolmuş. Lütfen yeni bir bağlantı isteyin.'
  if (/invalid-action-code/i.test(m)) return 'Geçersiz şifre sıfırlama kodu veya bağlantısı.'
  if (/too-many-requests/i.test(m)) return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.'
  if (/network-request-failed|Failed to fetch|NetworkError/i.test(m)) return 'İnternet bağlantısı yok.'
  if (/unauthorized|permission-denied|Permission denied/i.test(m)) return 'Erişim reddedildi. Firebase kurallarını kontrol edin.'
  return m
}

export function createFirebaseApi() {
  if (!isConfigured()) {
    return {
      configured: false,
      authState: async () => ({ signedIn: false, user: null, email: '', flockId: '' }),
      onAuth: () => () => {},
      signUp: async () => fail('Firebase yapılandırılmamış (src/firebase/config.js).'),
      signIn: async () => fail('Firebase yapılandırılmamış (src/firebase/config.js).'),
      sendPasswordReset: async () => fail('Firebase yapılandırılmamış (src/firebase/config.js).'),
      updateUserPassword: async () => fail('Firebase yapılandırılmamış (src/firebase/config.js).'),
      verifyResetCode: async () => fail('Firebase yapılandırılmamış (src/firebase/config.js).'),
      confirmResetPassword: async () => fail('Firebase yapılandırılmamış (src/firebase/config.js).'),
      signOut: async () => ok(false),
      dbLoad: async () => fail('Firebase yapılandırılmamış.'),
      birdPut: async () => fail('Firebase yapılandırılmamış.'),
      birdDelete: async () => fail('Firebase yapılandırılmamış.'),
      pairingPut: async () => fail('Firebase yapılandırılmamış.'),
      pairingDelete: async () => fail('Firebase yapılandırılmamış.'),
      clutchPut: async () => fail('Firebase yapılandırılmamış.'),
      clutchDelete: async () => fail('Firebase yapılandırılmamış.'),
      medicationPut: async () => fail('Firebase yapılandırılmamış.'),
      medicationDelete: async () => fail('Firebase yapılandırılmamış.'),
      vaccinationPut: async () => fail('Firebase yapılandırılmamış.'),
      vaccinationDelete: async () => fail('Firebase yapılandırılmamış.'),
      treatmentPut: async () => fail('Firebase yapılandırılmamış.'),
      treatmentDelete: async () => fail('Firebase yapılandırılmamış.'),
      supplementPut: async () => fail('Firebase yapılandırılmamış.'),
      supplementDelete: async () => fail('Firebase yapılandırılmamış.'),
      settingsPut: async () => fail('Firebase yapılandırılmamış.'),
      dbSubscribe: () => () => {},
      photoUpload: async () => fail('Firebase yapılandırılmamış.'),
      photoData: async () => fail('Firebase yapılandırılmamış.'),
      photoDelete: async () => fail('Firebase yapılandırılmamış.')
    }
  }

  const app = initializeApp(firebaseConfig)

  // Çevrimdışı önbellek: internet kesilse bile uygulama verileri gösterir,
  // bağlantı gelince Firestore kendiliğinden eşitler.
  let db
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    })
  } catch {
    db = initializeFirestore(app)
  }

  const auth = getAuth(app)
  setPersistence(auth, browserLocalPersistence).catch(() => {})

  /** Kullanıcının verisi kim altında duruyor: users/{uid}/... */
  const userRef = uid => doc(db, 'users', uid)
  /** Yönetim paneli için ortak üye kayıt defteri: members/{uid}. */
  const memberDocRef = (uid, platform, deviceId) =>
    doc(db, 'members', `${uid}_${platform}_${deviceId}`)
  const birdsRef = uid => collection(db, 'users', uid, 'birds')
  const pairingsRef = uid => collection(db, 'users', uid, 'pairings')
  const clutchesRef = uid => collection(db, 'users', uid, 'clutches')
  const photosRef = uid => collection(db, 'users', uid, 'photos')
  const medicationsRef = uid => collection(db, 'users', uid, 'medications')
  const vaccinationsRef = uid => collection(db, 'users', uid, 'vaccinations')
  const treatmentsRef = uid => collection(db, 'users', uid, 'treatments')
  const supplementsRef = uid => collection(db, 'users', uid, 'supplements')

  /**
   * Fotoğraflar da Firestore'da. Neden: Cloud Storage 3 Şubat 2026'dan
   * itibaren ücretsiz pakette yok, kredi kartı istiyor. Sıkıştırılmış
   * görseller Firestore'a sığar ve karta gerek kalmaz.
   *
   * Aynı fotoğraf defalarca okunur (listede küçük görsel, detayda büyük).
   * Her seferinde ağdan çekmemek için bellekte tutuyoruz.
   */
  const photoCache = new Map()
  const photoCacheLimit = 60

  function trimCache(map, limit) {
    while (map.size > limit) {
      const oldestKey = map.keys().next().value
      map.delete(oldestKey)
    }
  }

  /** Son yüklemenin istatistiği (arayüzde ipucu için). */
  let lastUpload = { count: 0, originalBytes: 0, savedBytes: 0 }

  let current = null // { uid, email, displayName }
  const authListeners = new Set()
  // Abonelikler bir kümede tutuluyor: eskiden tek bir modül değişkeni vardı
  // ve ikinci bir abonelik birincinin üzerine yazıyor, eski aboneliği
  // istemeden kapatıyordu.
  const dataSubscriptions = new Set()

  function emitAuth(state) {
    for (const fn of authListeners) {
      try { fn(state) } catch { /* dinleyici hatası oturumu bozmasın */ }
    }
  }

  /**
   * Yönetim paneli için platform adı. Android/Web/Electron ayrımı derleme
   * bayrağı ve Electron kullanıcı aracısıyla yapılır; veri katmanı React'ı
   * tanımaz, yalnızca ortamı okur.
   */
  function platformName() {
    const p = typeof window !== 'undefined' ? window.__guvercinPlatform : ''
    if (p === 'capacitor') return 'android'
    if (p === 'web') return 'web'
    if (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent || '')) return 'windows'
    return 'web'
  }

  /**
   * Ortak üye kayıt defterini günceller. E-posta/şifre, e-posta bağlantısı ve
   * açık oturumların hepsinde çalışır; böylece Auth'ta olup `users/` altında
   * belgesi olmayan kullanıcılar da yönetim panelinde görünür.
   */
  function deviceId() {
    const key = 'guvercin:deviceId'
    try {
      let id = localStorage.getItem(key)
      if (!id) {
        id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : 'dev-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
        localStorage.setItem(key, id)
      }
      return id
    } catch {
      return 'session-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    }
  }

  let lastTouchTime = 0

  async function touchMemberActivity(force = false) {
    try {
      const user = auth.currentUser
      if (!user) return
      const nowMs = Date.now()
      if (!force && nowMs - lastTouchTime < 120000) return
      lastTouchTime = nowMs

      const platform = platformName()
      const device = deviceId()
      const ref = memberDocRef(user.uid, platform, device)
      const now = new Date().toISOString()
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || '',
        appVersion: APP_VERSION,
        buildTime: BUILD_TIME,
        deviceId: device,
        platform,
        lastSeenAt: now
      }, { merge: true })
    } catch (err) {
      console.warn('Üye son görülme güncellenemedi:', (err && err.message) || err)
    }
  }

  async function syncMember(user, rootSnap) {
    lastTouchTime = Date.now()
    try {
      const platform = platformName()
      const device = deviceId()
      const ref = memberDocRef(user.uid, platform, device)
      const memberSnap = await getDoc(ref).catch(() => null)
      const now = new Date().toISOString()
      const rootData = rootSnap && rootSnap.exists ? rootSnap.data() : null
      const memberData = memberSnap && memberSnap.exists ? memberSnap.data() : null
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || '',
        // Kayıt tarihi ilk girişte bir kez yazılır; sonraki açılışlarda korunur.
        createdAt: (memberData && memberData.createdAt) || (rootData && rootData.createdAt) || now,
        appVersion: APP_VERSION,
        buildTime: BUILD_TIME,
        deviceId: device,
        platform,
        lastSeenAt: now
      }, { merge: true })
    } catch (err) {
      // Üye kaydı başarısız olsa da giriş ve uygulama verisi çalışmaya devam eder.
      console.warn('Üye kaydı güncellenemedi:', (err && err.message) || err)
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      current = null
      for (const off of dataSubscriptions) {
        try { off() } catch { /* kapatma hatası oturumu bozmasın */ }
      }
      dataSubscriptions.clear()
      emitAuth({ signedIn: false, user: null, email: '', flockId: '' })
      return
    }
    // İlk girişte bileşen adını profilde sakla (listede göstermek için).
    if (!user.displayName) {
      try { await updateProfile(user, { displayName: user.email.split('@')[0] }) } catch {}
    }
    const doc_ = await getDoc(userRef(user.uid)).catch(() => null)
    current = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      flockId: (doc_ && doc_.data() && doc_.data().flockId) || 'ev'
    }
    // Giriş akışını bekletmeden üye kaydını arka planda güncelle.
    void syncMember(user, doc_)
    emitAuth({ signedIn: true, ...current })
  })

  /** Yazma işlemleri oturum açmayı gerektirir. */
  function needAuth() {
    if (!current) throw new Error('Oturum açılmamış.')
    return current.uid
  }

  function stripUndefined(obj) {
    const out = {}
    for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
    return out
  }

  return {
    configured: true,

    /** Son fotoğraf yüklemesinin sıkıştırma istatistiği. */
    lastUploadStats: () => ({ ...lastUpload }),
    touchMember: (force = false) => touchMemberActivity(force),

    // ---------------------------------------------------------------- oturum
    authState: async () => {
      const user = auth.currentUser
      if (!user) return ok({ signedIn: false, user: null, email: '', flockId: '' })
      return ok({
        signedIn: true,
        user: { uid: user.uid, email: user.email },
        email: user.email,
        flockId: (current && current.flockId) || 'ev'
      })
    },

    onAuth(fn) {
      authListeners.add(fn)
      return () => authListeners.delete(fn)
    },

    async signUp(email, password) {
      try {
        const cleanMail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
        const cred = await createUserWithEmailAndPassword(auth, cleanMail, password)
        const uid = cred.user.uid
        await setDoc(userRef(uid), {
          email: cred.user.email,
          flockId: 'ev',
          createdAt: new Date().toISOString()
        })
        current = { uid, email: cred.user.email, displayName: cred.user.email.split('@')[0], flockId: 'ev' }
        return ok({ uid, email: cred.user.email })
      } catch (err) { return fail(err) }
    },

    async signIn(email, password) {
      try {
        const cleanMail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
        const cred = await signInWithEmailAndPassword(auth, cleanMail, password)
        return ok({ uid: cred.user.uid, email: cred.user.email })
      } catch (err) { return fail(err) }
    },

    async sendPasswordReset(email) {
      try {
        const cleanMail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
        if (!cleanMail) return fail('E-posta adresi giriniz.')
        const actionCodeSettings = {
          url: 'https://guvercin-beta-dev.web.app/reset-password.html',
          handleCodeInApp: true
        }
        await sendPasswordResetEmail(auth, cleanMail, actionCodeSettings)
        return ok(true)
      } catch (err) {
        if (/user-not-found/i.test((err && (err.code || err.message)) || '')) {
          return fail('Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.')
        }
        return fail(err)
      }
    },

    async updateUserPassword(newPassword) {
      try {
        const user = auth.currentUser
        if (!user) return fail('Oturum açılmamış.')
        if (!newPassword || newPassword.length < 6) return fail('Şifre en az 6 karakter olmalı.')
        await updatePassword(user, newPassword)
        return ok(true)
      } catch (err) { return fail(err) }
    },

    async verifyResetCode(codeOrUrl) {
      try {
        const s = String(codeOrUrl || '').trim()
        const m = s.match(/[?&]oobCode=([a-zA-Z0-9_-]+)/)
        const code = m ? m[1] : s
        if (!code) return fail('Geçerli bir kod veya bağlantı giriniz.')
        const email = await verifyPasswordResetCode(auth, code)
        return ok({ email, code })
      } catch (err) { return fail(err) }
    },

    async confirmResetPassword(codeOrUrl, newPassword) {
      try {
        const s = String(codeOrUrl || '').trim()
        const m = s.match(/[?&]oobCode=([a-zA-Z0-9_-]+)/)
        const code = m ? m[1] : s
        if (!code) return fail('Geçerli bir kod veya bağlantı giriniz.')
        if (!newPassword || newPassword.length < 6) return fail('Şifre en az 6 karakter olmalı.')
        await confirmPasswordReset(auth, code, newPassword)
        return ok(true)
      } catch (err) { return fail(err) }
    },

    async sendSignInLink(email) {
      try {
        const cleanMail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
        if (!cleanMail) return fail('E-posta adresi giriniz.')
        const actionCodeSettings = {
          url: 'https://guvercin-beta-dev.web.app/reset-password.html',
          handleCodeInApp: true
        }
        await sendSignInLinkToEmail(auth, cleanMail, actionCodeSettings)
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('emailForSignIn', cleanMail)
        }
        return ok(true)
      } catch (err) { return fail(err) }
    },

    isSignInLink(linkOrUrl) {
      try {
        const url = linkOrUrl || (typeof window !== 'undefined' ? window.location.href : '')
        return isSignInWithEmailLink(auth, url)
      } catch {
        return false
      }
    },

    async signInWithLink(email, linkOrUrl) {
      try {
        let cleanMail = String(email || '').trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
        if (!cleanMail && typeof window !== 'undefined' && window.localStorage) {
          cleanMail = window.localStorage.getItem('emailForSignIn') || ''
        }
        if (!cleanMail) return fail('Doğrulama için e-posta adresi gereklidir.')
        const url = linkOrUrl || (typeof window !== 'undefined' ? window.location.href : '')
        // Firebase v12 imzası: signInWithEmailLink(auth, email, emailLink)
        const cred = await signInWithEmailLink(auth, cleanMail, url)
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('emailForSignIn')
        }
        return ok({ uid: cred.user.uid, email: cred.user.email })
      } catch (err) { return fail(err) }
    },

    waitForAuthReady() {
      return new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, user => {
          unsub()
          resolve(user)
        })
      })
    },

    async signOut() {
      try { await signOut(auth); return ok(true) } catch (err) { return fail(err) }
    },

    // ------------------------------------------------------------------ veri
    async dbLoad() {
      try {
        const uid = needAuth()
        const [birds, pairings, clutches, medications, vaccinations, treatments, supplements, meta] = await Promise.all([
          getDocs(birdsRef(uid)),
          getDocs(pairingsRef(uid)),
          getDocs(clutchesRef(uid)),
          getDocs(medicationsRef(uid)),
          getDocs(vaccinationsRef(uid)),
          getDocs(treatmentsRef(uid)),
          getDocs(supplementsRef(uid)),
          getDoc(userRef(uid))
        ])
        const data = {
          birds: birds.docs.map(d => ({ id: d.id, ...d.data() })),
          pairings: pairings.docs.map(d => ({ id: d.id, ...d.data() })),
          clutches: clutches.docs.map(d => ({ id: d.id, ...d.data() })),
          medications: medications.docs.map(d => ({ id: d.id, ...d.data() })),
          vaccinations: vaccinations.docs.map(d => ({ id: d.id, ...d.data() })),
          treatments: treatments.docs.map(d => ({ id: d.id, ...d.data() })),
          supplements: supplements.docs.map(d => ({ id: d.id, ...d.data() })),
          settings: (meta.exists() && meta.data().settings) || {}
        }
        const migrated = migrate(data)
        // Eğer migrate sırasında mükerrer/artık eşleşmeler tekilleştirildiyse,
        // Firestore'daki artık kopya belgeleri arka planda kalıcı olarak sil
        const keptIds = new Set(migrated.pairings.map(p => p.id))
        const removedDocs = pairings.docs.filter(d => !keptIds.has(d.id))
        if (removedDocs.length > 0) {
          Promise.all([
            ...removedDocs.map(d => deleteDoc(d.ref)),
            ...migrated.pairings.map(p => setDoc(doc(pairingsRef(uid), p.id), stripUndefined({ ...p, updatedAt: new Date().toISOString() })))
          ]).catch(e => console.warn('Pairing cleanup warning:', e))
        }
        return ok(migrated)
      } catch (err) { return fail(err) }
    },

    async birdPut(bird) {
      try {
        const uid = needAuth()
        await setDoc(doc(birdsRef(uid), bird.id), stripUndefined({ ...bird, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(bird.id)
      } catch (err) { return fail(err) }
    },

    async birdDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(birdsRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async pairingPut(p) {
      try {
        const uid = needAuth()
        await setDoc(doc(pairingsRef(uid), p.id), stripUndefined({ ...p, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(p.id)
      } catch (err) { return fail(err) }
    },

    async pairingDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(pairingsRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async clutchPut(c) {
      try {
        const uid = needAuth()
        await setDoc(doc(clutchesRef(uid), c.id), stripUndefined({ ...c, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(c.id)
      } catch (err) { return fail(err) }
    },

    async clutchDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(clutchesRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async medicationPut(m) {
      try {
        const uid = needAuth()
        await setDoc(doc(medicationsRef(uid), m.id), stripUndefined({ ...m, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(m.id)
      } catch (err) { return fail(err) }
    },

    async medicationDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(medicationsRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async vaccinationPut(v) {
      try {
        const uid = needAuth()
        await setDoc(doc(vaccinationsRef(uid), v.id), stripUndefined({ ...v, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(v.id)
      } catch (err) { return fail(err) }
    },

    async vaccinationDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(vaccinationsRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async treatmentPut(t) {
      try {
        const uid = needAuth()
        await setDoc(doc(treatmentsRef(uid), t.id), stripUndefined({ ...t, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(t.id)
      } catch (err) { return fail(err) }
    },

    async treatmentDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(treatmentsRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async supplementPut(s) {
      try {
        const uid = needAuth()
        await setDoc(doc(supplementsRef(uid), s.id), stripUndefined({ ...s, updatedAt: new Date().toISOString() }))
        void touchMemberActivity(true)
        return ok(s.id)
      } catch (err) { return fail(err) }
    },

    async supplementDelete(id) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(supplementsRef(uid), id))
        void touchMemberActivity(true)
        return ok(id)
      } catch (err) { return fail(err) }
    },

    async settingsPut(settings) {
      try {
        const uid = needAuth()
        await setDoc(userRef(uid), { settings: stripUndefined(settings) }, { merge: true })
        void touchMemberActivity(true)
        return ok(true)
      } catch (err) { return fail(err) }
    },

    /**
     * Gerçek zamanlı dinleme. Başka cihazda yapılan her değişiklik
     * buraya anında düşer. Dönen değer: aboneliği iptal eden fonksiyon.
     */
    dbSubscribe(cb) {
      const user = auth.currentUser
      if (!user) return () => {}
      const uid = user.uid

      const unsubBirds = onSnapshot(
        birdsRef(uid),
        snap => cb({ birds: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'Kuşlar dinlenemiyor.' })
      )
      const unsubPairings = onSnapshot(
        pairingsRef(uid),
        snap => cb({ pairings: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'Çiftleşmeler dinlenemiyor.' })
      )
      const unsubClutches = onSnapshot(
        clutchesRef(uid),
        snap => cb({ clutches: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'Kuluçkalar dinlenemiyor.' })
      )
      const unsubMedications = onSnapshot(
        medicationsRef(uid),
        snap => cb({ medications: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'İlaçlar dinlenemiyor.' })
      )
      const unsubVaccinations = onSnapshot(
        vaccinationsRef(uid),
        snap => cb({ vaccinations: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'Aşılar dinlenemiyor.' })
      )
      const unsubTreatments = onSnapshot(
        treatmentsRef(uid),
        snap => cb({ treatments: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'Tedaviler dinlenemiyor.' })
      )
      const unsubSupplements = onSnapshot(
        supplementsRef(uid),
        snap => cb({ supplements: snap.docs.map(d => ({ id: d.id, ...d.data() })) }),
        () => cb({ error: 'Takviyeler dinlenemiyor.' })
      )
      const unsubMeta = onSnapshot(
        userRef(uid),
        snap => {
          const d = snap.data() || {}
          if (d.flockId) current = { ...current, flockId: d.flockId }
          cb({ settings: d.settings || {}, flockId: d.flockId || 'ev' })
        },
        () => {}
      )

      const unsub = () => {
        unsubBirds()
        unsubPairings()
        unsubClutches()
        unsubMedications()
        unsubVaccinations()
        unsubTreatments()
        unsubSupplements()
        unsubMeta()
        dataSubscriptions.delete(unsub)
      }
      dataSubscriptions.add(unsub)
      return unsub
    },

    // -------------------------------------------------------------- fotoğraf
    /**
     * Platform katmanının seçtiği fotoğrafları sıkıştırıp yükler.
     * list: [{ name, base64, mime }] — ad zaten benzersiz üretilmiş olmalı.
     */
    async photoUpload(list) {
      try {
        const uid = needAuth()
        const names = []
        let originalBytes = 0
        let savedBytes = 0

        for (const p of list) {
          const c = await compressImage(p.base64, p.mime)
          await setDoc(doc(photosRef(uid), p.name), {
            name: p.name,
            mime: c.mime,
            data: c.base64,
            width: c.width,
            height: c.height,
            bytes: c.bytes,
            originalBytes: c.originalBytes,
            addedAt: new Date().toISOString()
          })
          names.push(p.name)
          photoCache.set(p.name, c.base64)
          originalBytes += c.originalBytes
          savedBytes += c.originalBytes - c.bytes
        }

        trimCache(photoCache, photoCacheLimit)
        lastUpload = { count: names.length, originalBytes, savedBytes }
        return ok(names)
      } catch (err) { return fail(err) }
    },

    async photoData(name) {
      const cached = photoCache.get(name)
      if (cached) return ok({ mime: 'image/jpeg', base64: cached, cached: true })
      try {
        const uid = needAuth()
        const snap = await getDoc(doc(photosRef(uid), name))
        if (!snap.exists()) return fail('Fotoğraf bulunamadı.')
        const d = snap.data()
        photoCache.set(name, d.data)
        trimCache(photoCache, photoCacheLimit)
        return ok({ mime: d.mime || 'image/jpeg', base64: d.data, cached: false })
      } catch (err) { return fail(err) }
    },

    async photoDelete(name) {
      try {
        const uid = needAuth()
        await deleteDoc(doc(photosRef(uid), name))
        photoCache.delete(name)
        return ok(true)
      } catch (err) { return fail(err) }
    },

    // ------------------------------------------------------------ yedekleme
    /* Not: dışa aktarma ve geri yükleme `src/api.js` içinde yürütülüyor
     * (host dosya seçme/kaydetme katmanı gerekiyor). Buradaki eski
     * exportJson/importJson kopyaları hiçbir yerden çağrılmıyordu. */
  }
}