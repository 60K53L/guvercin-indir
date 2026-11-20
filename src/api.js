/**
 * Uygulamanın tek veri giriş noktası: `window.api`.
 *
 * İki katman birleşiyor:
 *   - bulut (Firebase) → veriler burada
 *   - platform (host)  → dosya seçme/kaydetme
 *
 * React bileşenleri yalnızca bu yüzeyi görür; nerede çalıştıklarını bilmez.
 */

import { createFirebaseApi } from './firebase/api.js'
import { migrate } from './schema.js'

const ok = data => ({ ok: true, data })
const fail = error => ({ ok: false, error: String((error && error.message) || error) })

export function createApi(host) {
  const cloud = createFirebaseApi()

  return {
    configured: cloud.configured,

    // ---------------------------------------------------------------- oturum
    authState: () => cloud.authState(),
    onAuth: fn => cloud.onAuth(fn),
    signUp: (email, pass) => cloud.signUp(email, pass),
    signIn: (email, pass) => cloud.signIn(email, pass),
    sendPasswordReset: email => cloud.sendPasswordReset(email),
    sendSignInLink: email => cloud.sendSignInLink(email),
    isSignInLink: linkOrUrl => cloud.isSignInLink(linkOrUrl),
    signInWithLink: (email, linkOrUrl) => cloud.signInWithLink(email, linkOrUrl),
    waitForAuthReady: () => cloud.waitForAuthReady(),
    updateUserPassword: newPass => cloud.updateUserPassword(newPass),
    verifyResetCode: codeOrUrl => cloud.verifyResetCode(codeOrUrl),
    confirmResetPassword: (codeOrUrl, newPass) => cloud.confirmResetPassword(codeOrUrl, newPass),
    signOut: () => cloud.signOut(),

    // ------------------------------------------------------------------ veri
    dbLoad: () => cloud.dbLoad(),
    birdPut: bird => cloud.birdPut(bird),
    birdDelete: id => cloud.birdDelete(id),
    pairingPut: p => cloud.pairingPut(p),
    pairingDelete: id => cloud.pairingDelete(id),
    clutchPut: c => cloud.clutchPut(c),
    clutchDelete: id => cloud.clutchDelete(id),
    medicationPut: m => cloud.medicationPut(m),
    medicationDelete: id => cloud.medicationDelete(id),
    vaccinationPut: v => cloud.vaccinationPut(v),
    vaccinationDelete: id => cloud.vaccinationDelete(id),
    treatmentPut: t => cloud.treatmentPut(t),
    treatmentDelete: id => cloud.treatmentDelete(id),
    supplementPut: s => cloud.supplementPut(s),
    supplementDelete: id => cloud.supplementDelete(id),
    settingsPut: s => cloud.settingsPut(s),
    dbSubscribe: cb => cloud.dbSubscribe(cb),
    touchMember: (force = false) => (cloud.touchMember ? cloud.touchMember(force) : Promise.resolve()),

    // -------------------------------------------------------------- fotoğraf
    /** Seç → sıkıştır → yükle. Bileşenler tek çağrı bekliyor. */
    async photoAdd(source) {
      const picked = await host.pickPhotos(source)
      if (!picked.ok) return picked
      if (!picked.data.length) return ok([])
      return cloud.photoUpload(picked.data)
    },

    /** Son yüklemenin sıkıştırma istatistiği (fotoğraf eklendiğinde kullanıcıya
     "bu kadar tasarruf ettik" bilgisi verilir). */
    lastUploadStats: () => (cloud.lastUploadStats ? cloud.lastUploadStats() : null),

    photoData: name => cloud.photoData(name),
    photoDelete: name => cloud.photoDelete(name),

    // -------------------------------------------------------------- yedekleme
    async exportJson() {
      const db = await cloud.dbLoad()
      if (!db.ok) return db
      const text = JSON.stringify(migrate(db.data), null, 2)
      const saved = await host.saveJson(text)
      return saved.ok ? ok(saved.data) : saved
    },

    /**
     * Yedekten GERİ YÜKLEME.
     *
     * ÖNEMLİ: Bu bir BİRLEŞTİRME değil. Buluttaki mevcut tüm kuş ve
     * çiftleşme kayıtları silinir, yerine yedektekiler yazılır. Yedek
     * eski bir dosyaysa geride kalan kayıtlar KAYBOLUR — bu yüzden
     * geri yükleme öncesi boşta kalmayan kayıt sayısı kullanıcıya
     * bildirilir (aşağıda `silinen`).
     *
     * Sıralama: silme ÖNCE yapılır, yoksa eski kayıtlar listede kalır.
     */
    async importJson() {
      const text = await host.pickJson()
      if (!text.ok) return text
      if (!text.data) return ok(null)
      let parsed
      try {
        parsed = JSON.parse(text.data)
      } catch (err) {
        return fail('Dosya okunamadı: geçerli bir JSON değil.')
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.birds)) {
        return fail('Bu dosya uygulamanın yedek dosyası değil (kuş listesi bulunamadı).')
      }
      const db = migrate(parsed)

      // Yedekte olmayan mevcut kayıtları tespit et.
      const cur = await cloud.dbLoad()
      if (!cur.ok) return cur
      const keepBirds = new Set(db.birds.map(b => b.id))
      const keepPairs = new Set(db.pairings.map(p => p.id))
      const keepClutches = new Set((db.clutches || []).map(c => c.id))
      const keepMeds = new Set((db.medications || []).map(m => m.id))
      const keepVacs = new Set((db.vaccinations || []).map(v => v.id))
      const keepTreats = new Set((db.treatments || []).map(t => t.id))
      const keepSupps = new Set((db.supplements || []).map(s => s.id))
      const goneBirds = (cur.data.birds || []).filter(b => !keepBirds.has(b.id))
      const gonePairs = (cur.data.pairings || []).filter(p => !keepPairs.has(p.id))
      const goneClutches = (cur.data.clutches || []).filter(c => !keepClutches.has(c.id))
      const goneMeds = (cur.data.medications || []).filter(m => !keepMeds.has(m.id))
      const goneVacs = (cur.data.vaccinations || []).filter(v => !keepVacs.has(v.id))
      const goneTreats = (cur.data.treatments || []).filter(t => !keepTreats.has(t.id))
      const goneSupps = (cur.data.supplements || []).filter(s => !keepSupps.has(s.id))

      const errs = []
      for (const b of goneBirds) {
        const r = await cloud.birdDelete(b.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const p of gonePairs) {
        const r = await cloud.pairingDelete(p.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const c of goneClutches) {
        const r = await cloud.clutchDelete(c.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const m of goneMeds) {
        const r = await cloud.medicationDelete(m.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const v of goneVacs) {
        const r = await cloud.vaccinationDelete(v.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const t of goneTreats) {
        const r = await cloud.treatmentDelete(t.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const s of goneSupps) {
        const r = await cloud.supplementDelete(s.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const b of db.birds) {
        const r = await cloud.birdPut(b)
        if (!r.ok) errs.push(r.error)
      }
      for (const p of db.pairings) {
        const r = await cloud.pairingPut(p)
        if (!r.ok) errs.push(r.error)
      }
      for (const c of (db.clutches || [])) {
        const r = await cloud.clutchPut(c)
        if (!r.ok) errs.push(r.error)
      }
      for (const m of (db.medications || [])) {
        const r = await cloud.medicationPut(m)
        if (!r.ok) errs.push(r.error)
      }
      for (const v of (db.vaccinations || [])) {
        const r = await cloud.vaccinationPut(v)
        if (!r.ok) errs.push(r.error)
      }
      /* DÜZELTME: tedaviler de sil-then-write kapsamına alındı. Eskiden
       * importJson treatments'ı hiç işlemiyordu; yedekteki tedaviler
       * yüklenmez, buluttaki (silinen kuşa ait) tedaviler ise hayalet
       * kayıt olarak kalırdı. */
      for (const t of (db.treatments || [])) {
        const r = await cloud.treatmentPut(t.id)
        if (!r.ok) errs.push(r.error)
      }
      for (const s of (db.supplements || [])) {
        const r = await cloud.supplementPut(s)
        if (!r.ok) errs.push(r.error)
      }
      const s = await cloud.settingsPut(db.settings)
      if (!s.ok) errs.push(s.error)
      const totalCount = db.birds.length + db.pairings.length + (db.clutches || []).length + (db.medications || []).length + (db.vaccinations || []).length + (db.treatments || []).length + (db.supplements || []).length
      return errs.length
        ? fail(`${totalCount} kayıttan bazıları yüklenemedi: ${errs[0]}`)
        : ok({
          birds: db.birds.length,
          pairings: db.pairings.length,
          clutches: (db.clutches || []).length,
          medications: (db.medications || []).length,
          vaccinations: (db.vaccinations || []).length,
          treatments: (db.treatments || []).length,
          supplements: (db.supplements || []).length,
          silinen: goneBirds.length
        })
    },

    openPath: p => host.openPath(p),
    openExternal: url => host.openExternal(url),
    userDataPath: () => host.userDataPath()
  }
}