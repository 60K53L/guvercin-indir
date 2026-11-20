import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  SEX, ringOf, relationshipCoefficient, kinshipPct, trUpper, isFormer,
  relationLabel, isGone, statusOptionsAlpha, parentCompare, sharedOffspring,
  compareBirds, sortTr, isDualCode, trSearch, footCode, footNumber, dispTr,
  EXTERNAL_PARENT_STATUS, normalizeExternalParent, extractAllRingCodes
} from '../lib.js'
import { normalizeBird } from '../schema.js'
import { birdInCoop, coopCinsiList, coopList, fallbackCoopId, findCoopRingDuplicate, resolveBirdCoopId, sortCinsi } from '../coops.js'
import { PhotoBox } from './PhotoBox.jsx'
import CodePicker from './CodePicker.jsx'
import BirdPicker from './BirdPicker.jsx'
import ChickSexGuideModal from './ChickSexGuideModal.jsx'

const blank = {
  code: '', rightCode: '', leftCode: '', rightNumber: '', leftNumber: '', listFoot: '',
  number: '', name: '', sex: '', cinsi: '', color: '',
  status: 'damizlik', line: '', sireId: '', damId: '', coopId: '',
  sireOutside: null, damOutside: null,
  layingDate: '', birthDate: '', notes: '', photos: [],
  federationRing: '', chipNo: '', strain: '', raceResults: ''
}

/** Anne/baba seçicisinin altında görünen kayıt dışı durumları. */
const PARENT_OUTSIDE_OPTIONS = EXTERNAL_PARENT_STATUS.map(s => ({
  value: `outside:${s.value}`,
  label: s.label
}))

export default function BirdForm({
  bird, db, coops, activeCoopId, onCancel, onSave,
  onRightCodesChange, onLeftCodesChange, onCodesChange, onCinsiChange
}) {
  const coopOptions = useMemo(
    () => (coops && coops.length ? coops : coopList(db)),
    [coops, db]
  )
  const defaultCoopId = activeCoopId || fallbackCoopId(coopOptions)

  const [f, setF] = useState(() => {
    const norm = normalizeBird(bird)
    const isChick = norm?.status === 'yavru' || norm?.sex === '?'
    return {
      ...blank,
      ...norm,
      line: norm?.line || (isChick ? 'BİZİM YAVRU' : ''),
      coopId: norm?.coopId ? resolveBirdCoopId(norm, coopOptions) : defaultCoopId,
      rightCode: norm?.rightCode || '',
      leftCode: norm?.leftCode || '',
      rightNumber: norm?.rightNumber || '',
      leftNumber: norm?.leftNumber || '',
      listFoot: norm?.listFoot || ''
    }
  })
  const [showDualKlips, setShowDualKlips] = useState(() => Boolean(isDualCode(f.rightCode) || isDualCode(f.leftCode)))
  const [err, setErr] = useState('')
  const [showSexGuide, setShowSexGuide] = useState(false)
  // Fotoğraf silme KAYDET anına ertelenir: "Vazgeç"e basınca silinen
  // fotoğraf geri gelmiyordu (yanlışlıkla veri kaybı). Bu oturumda eklenen
  // fotoğraflar ise henüz kayıtlı olmadığı için anında silinir (yetim kalmasın).
  const [pendingDeletes, setPendingDeletes] = useState([])
  const [addedThisSession, setAddedThisSession] = useState([])
  const isNew = !bird.id

  // Cinsler KÜMES BAZINDA: forma yalnızca bu kuşun kümesinin cinsleri gelir.
  // Kümes alanı değişince liste de o kümesin cinslerine döner. Taşınan kuşun
  // mevcut cinsi yeni kümesin listesinde yoksa bile seçili kalır; kaydetmede
  // cins kaybolmaz.
  const cinsiCodes = useMemo(() => {
    const list = coopCinsiList(db, resolveBirdCoopId(f, coopOptions))
    return f.cinsi && !list.includes(f.cinsi) ? sortCinsi([...list, f.cinsi]) : list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, f.coopId, f.cinsi, coopOptions])
  const overlayRef = useRef(null)
  const modalRef = useRef(null)

  // Mobil klavye açıldığında odaklanılan input'un (ör. Hat/Soy, Ad, Notlar)
  // klavye altında kalmayıp ekranın merkezine rahatça kayması için scroll desteği
  const handleFormFocus = useCallback((e) => {
    const el = e.target
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
      setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch {}
      }, 160)
    }
  }, [])

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const onResize = () => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          try {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } catch {}
        }, 80)
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const resetScroll = () => {
      if (modalRef.current) modalRef.current.scrollTop = 0
      if (overlayRef.current) overlayRef.current.scrollTop = 0
    }

    resetScroll()
    const raf = requestAnimationFrame(resetScroll)
    const t = setTimeout(resetScroll, 60)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [])

  const preserveCursor = (el, start, end) => {
    if (!el || start === null || end === null || typeof el.setSelectionRange !== 'function') return
    const restore = () => {
      try { el.setSelectionRange(start, end) } catch {}
    }
    queueMicrotask(restore)
    requestAnimationFrame(restore)
    setTimeout(restore, 0)
  }

  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))
  // trUpper: Türkçe locale. toUpperCase() "dişi" → "DIŞI" yapıyordu.
  const setUpper = (k) => (e) => {
    const el = e.target
    const start = el?.selectionStart ?? null
    const end = el?.selectionEnd ?? null
    const val = trUpper(e.target.value)
    setF(prev => ({ ...prev, [k]: val }))
    preserveCursor(el, start, end)
  }
  const up = (v) => trUpper(v)

  /**
   * Kayıt dışı anne/baba seçimi. Durum seçilince gerçek kuş bağı (id) boşaltılır:
   * böylece çiftleşme/soy bağı oluşmaz, yalnızca bilgi metni saklanır.
   */
  const setParentOutside = (which, status) => {
    const idKey = which === 'sire' ? 'sireId' : 'damId'
    const outKey = which === 'sire' ? 'sireOutside' : 'damOutside'
    setF(prev => {
      if (!status) return { ...prev, [outKey]: null }
      return {
        ...prev,
        [idKey]: '',
        [outKey]: { status, note: prev[outKey]?.note || '' }
      }
    })
  }

  const setParentOutsideNote = (which, note, el) => {
    const start = el?.selectionStart ?? null
    const end = el?.selectionEnd ?? null
    const outKey = which === 'sire' ? 'sireOutside' : 'damOutside'
    setF(prev => ({
      ...prev,
      [outKey]: { status: prev[outKey]?.status || '', note: trUpper(note) }
    }))
    preserveCursor(el, start, end)
  }

  const setParentBird = (which, id) => {
    const idKey = which === 'sire' ? 'sireId' : 'damId'
    const parent = db.birds.find(b => b.id === id)
    const outKey = which === 'sire' ? 'sireOutside' : 'damOutside'
    setF(prev => {
      const autoCinsi = (!prev.cinsi && parent?.cinsi) ? parent.cinsi : prev.cinsi
      const autoLine = (!prev.line && parent?.line) ? parent.line : prev.line
      return {
        ...prev,
        [idKey]: id,
        [outKey]: null,
        cinsi: autoCinsi,
        line: autoLine
      }
    })
  }

  function submit(e) {
    e.preventDefault()
    const rightCode = trUpper((f.rightCode || '').trim())
    const leftCode = trUpper((f.leftCode || '').trim())
    // Numara HER AYAK için ayrıdır; 2 hane yeterli ("05"). "GC" yazımı korunur.
    const rightNumber = trUpper(String(f.rightNumber ?? '').trim())
    const leftNumber = trUpper(String(f.leftNumber ?? '').trim())
    const listFoot = f.listFoot === 'left' || f.listFoot === 'right' ? f.listFoot : ''
    const fedRing = trUpper((f.federationRing || '').trim())

    // Listenin hangi ayakla gruplanacağı: kullanıcı seçtiyse o ayak, yoksa
    // eskisi gibi sol öncelikli. normalizeBird aynı kuralı uygular.
    const mainLeft = listFoot !== 'right'
    const code = (mainLeft ? (leftCode || rightCode) : (rightCode || leftCode)) || trUpper((f.code || '').trim())
    const number = mainLeft ? (leftNumber || rightNumber) : (rightNumber || leftNumber)

    let finalName = up(f.name).trim()
    if (!code && !number && !finalName && !fedRing) {
      if (f.status !== 'yavru') {
        return setErr('En az bir bilgi girin: Klips Rengi, Numara, Ad veya Federasyon Markası')
      } else {
        const damBird = db.birds.find(b => b.id === f.damId)
        const sireBird = db.birds.find(b => b.id === f.sireId)
        if (f.nestHint) {
          finalName = `YAVRU (${f.nestHint})`
        } else if (damBird && sireBird) {
          finalName = `YAVRU (${ringOf(damBird)} × ${ringOf(sireBird)})`
        } else if (damBird || sireBird) {
          finalName = `${ringOf(damBird || sireBird)} YAVRUSU`
        } else {
          const count = (db.birds || []).filter(b => b.status === 'yavru').length
          finalName = `YAVRU #${count + 1}`
        }
      }
    }

    // Aynı ayak + aynı renk + aynı numara, AYNI KÜMESTE ve aynı cinsiyette
    // tekrar edemez. Klipsler kümes bazında benzersizdir: aynı klips başka
    // kümeslerde farklı kuşlara takılabilir (ör. SİYAH-SARI 3 kümeste).
    const dupInfo = findCoopRingDuplicate(db, {
      ...f,
      leftCode,
      leftNumber,
      rightCode,
      rightNumber
    }, coopOptions)
    if (dupInfo) {
      const footAd = dupInfo.foot === 'left' ? 'Sol ayak' : 'Sağ ayak'
      const footCodeVal = dupInfo.foot === 'left' ? leftCode : rightCode
      const footNumVal = dupInfo.foot === 'left' ? leftNumber : rightNumber
      return setErr(
        `Bu künye bu kümeste zaten kullanılıyor: ${trUpper(footAd)} ${footCodeVal}-${footNumVal} ` +
        `(${SEX[dupInfo.dup.sex] || 'cinsiyetsiz'}). ` +
        'Aynı klipsi karşı cinsiyette kullanabilirsiniz.'
      )
    }
    // Akraba eşleşmesinde onay POPUP'ı çıkmaz: mobilde ve PWA'da
    // rahatsız edici ve bazı tarayıcılarda engelleniyor. Uyarı yalnızca
    // penceredeki yazıda kalır, kayıt yine de yapılır.

    /* code/number burada BOŞ verilir: normalizeBird bunları ayaklardan
     * yeniden türetir. Eskiden kalma tek `number` alanı dolu gelirse
     * normalizeBird onu ayrıştırıp temizlenen ayağı geri getirebilirdi. */
    onSave(normalizeBird({
      ...f,
      code: '',
      number: '',
      rightCode,
      leftCode,
      rightNumber,
      leftNumber,
      listFoot,
      coopId: resolveBirdCoopId(f, coopOptions),
      federationRing: fedRing,
      chipNo: up(f.chipNo || '').trim(),
      strain: up(f.strain || '').trim(),
      raceResults: (f.raceResults || '').trim(),
      cinsi: up(f.cinsi).trim(),
      name: finalName,
      color: up(f.color).trim(),
      line: up(f.line).trim(),
      notes: up(f.notes).trim(),
      damOutside: normalizeExternalParent(f.damOutside, f.damId),
      sireOutside: normalizeExternalParent(f.sireOutside, f.sireId)
    }), effectiveMateId || '')
    // Kayıt başarıyla gönderildi → ertelenen fotoğraf silmelerini uygula.
    if (pendingDeletes.length) {
      for (const name of pendingDeletes) api.photoDelete(name).catch(() => {})
      setPendingDeletes([])
    }
  }

  /**
   * Bir ayak için "bu renkte kayıtlı numaralar" ve "sonraki numara" önerisi.
   *
   * Numara AYAK BAŞINA benzersiz olduğu için sayaç ayak ayak hesaplanır:
   * sol ayak BEYAZ-05 varken sağ ayak SARI-01 ayrı bir dizi izler.
   * Sayaç KÜMES BAZINDADIR: başka kümesdeki aynı renk numaraları bu kümesin
   * sırasını etkilemez (aynı klips her kümesde yeniden kullanılabilir).
   */
  const footSuggest = (foot, code) => {
    const c = (code || '').trim()
    if (!c) return { used: [], next: '' }
    const targetCoopId = resolveBirdCoopId(f, coopOptions)
    const used = db.birds
      .filter(b =>
        b.id !== f.id &&
        resolveBirdCoopId(b, coopOptions) === targetCoopId &&
        footNumber(b, foot) &&
        trSearch(footCode(b, foot)) === trSearch(c)
      )
      .map(b => footNumber(b, foot))
      .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
    const nums = used.map(Number).filter(n => !Number.isNaN(n))
    if (!nums.length) return { used, next: '' }
    const pad = used.reduce((w, s) => Math.max(w, /^\d+$/.test(s) && s.length > 1 ? s.length : 0), 0)
    const next = String(Math.max(...nums) + 1)
    return { used, next: pad ? next.padStart(pad, '0') : next }
  }

  const leftSuggest = footSuggest('left', f.leftCode)
  const rightSuggest = footSuggest('right', f.rightCode)

  async function addPhotos(source) {
    const r = await api.photoAdd(source)
    // Önceden sessizce yutuyordu; kullanıcı neden yüklenmediğini bilemiyordu.
    if (!r.ok) return setErr(r.error || 'Fotoğraf eklenemedi.')
    if (r.data.length) {
      setF({ ...f, photos: [...(f.photos || []), ...r.data] })
      setAddedThisSession(prev => [...prev, ...r.data])
    }
  }

  function delPhoto(name) {
    setF({ ...f, photos: (f.photos || []).filter(x => x !== name) })
    if (addedThisSession.includes(name)) {
      // Bu oturumda eklendi, kayıtlı değil → depodan hemen sil
      setAddedThisSession(prev => prev.filter(x => x !== name))
      api.photoDelete(name).catch(() => {})
    } else {
      // Kayıtlı fotoğraf: gerçek silme KAYDET'e kadar ertelenir
      setPendingDeletes(prev => (prev.includes(name) ? prev : [...prev, name]))
    }
  }

  const targetCoopId = f.coopId || defaultCoopId
  // Eş adayları yalnızca kuşun kümesinden seçilir. A kümesini düzenlerken
  // B kümesinin kuşları eş listesinde görünmez.
  const candidates = db.birds.filter(b =>
    b.id !== f.id && birdInCoop(b, targetCoopId, db)
  )

  // Anne/baba adayları ise BÜTÜN kümeslerden gelir; seçicideki kümes
  // filtresi listeyi önce kuşun kendi kümesine daraltır. Kullanıcı filtreyi
  // değiştirince başka kümesdeki anne/baba da seçilebilir (ör. UÇAN SAYA
  // kümesindeki yavruya başka kümesdeki erkek babalık yapabilir).
  const parentCandidates = db.birds.filter(b => b.id !== f.id)
  const coopIdOfBird = useCallback(
    b => resolveBirdCoopId(b, coopOptions),
    [coopOptions]
  )

  // Seçili anne/baba başka kümesde olabilir. Bu bağ kaybolmasın diye seçili
  // ebeveyn, kümes adayları arasında yoksa listeye ayrıca eklenir; kaydetme
  // sırasında da kimlik korunur.
  const currentDam = f.damId ? db.birds.find(b => b.id === f.damId) || null : null
  const currentSire = f.sireId ? db.birds.find(b => b.id === f.sireId) || null : null
  const damInOtherCoop = Boolean(currentDam && !birdInCoop(currentDam, targetCoopId, db))
  const sireInOtherCoop = Boolean(currentSire && !birdInCoop(currentSire, targetCoopId, db))

  // Kuşun MEVCUT eşi. Bir kuşun en fazla bir mevcut eşi olabilir; düzenleme
  // ekranı açıldığında bu eş seçili gelmeli, boş gelmesi hataydı.
  const currentMateId = useMemo(() => {
    if (!bird.id) return ''
    for (const p of db.pairings) {
      if (isFormer(p)) continue
      if (p.maleId === bird.id) return p.femaleId || ''
      if (p.femaleId === bird.id) return p.maleId || ''
    }
    return ''
  }, [bird.id, db.pairings])

  // Düzenleme açıldığında mevcut eş seçili gelsin; "Yeni Kuş"da boş.
  const [mateId, setMateId] = useState('')
  const [matePicked, setMatePicked] = useState(false)
  const effectiveMateId = matePicked ? mateId : (currentMateId || mateId)

  const matedIds = useMemo(() => {
    const s = new Set()
    for (const p of db.pairings) {
      if (isFormer(p)) continue
      if (p.maleId) s.add(p.maleId)
      if (p.femaleId) s.add(p.femaleId)
    }
    return s
  }, [db.pairings])

  const bySex = useMemo(() => {
    // SATILDI/KAÇTI/ÖLÜ kuşlar eş adayı olmaz; UÇURMALIK olur (uçmaya hazır).
    const alive = candidates.filter(b => !isGone(b))
    if (f.sex === 'M') return alive.filter(b => b.sex === 'F')
    if (f.sex === 'F') return alive.filter(b => b.sex === 'M')
    return alive
  }, [candidates, f.sex])

  // Kuşun zaten mevcut eşi varsa YALNIZCA o eş sunulur — ikinci eş
  // seçilemez. Eşi yoksa normal aday listesi açılır.
  const hasCurrentMate = Boolean(currentMateId)
  const mateCandidates = useMemo(() => {
    // Mevcut eş başka kümeste olsa bile gösterilir: mevcut bağ gizlenirse
    // düzenleme sırasında yanlışlıkla koparılabilirdi. Aday listesi ise
    // yalnızca aynı kümesden gelir.
    if (hasCurrentMate) {
      const mate = db.birds.find(b => b.id === currentMateId)
      return mate ? [mate] : []
    }
    return bySex.filter(b => !matedIds.has(b.id) || b.id === effectiveMateId).sort(compareBirds)
  }, [bySex, matedIds, hasCurrentMate, currentMateId, effectiveMateId, db.birds])
  const hiddenMated = hasCurrentMate ? 0 : bySex.length - mateCandidates.length

  // Anne/baba listeleri: yavru veya kuş için sol/sağ ayak klips rengi seçildiğinde
  // o klips rengine ait anne/babalar ve GC damızlıkları en üste çıkar.
  const targetKlipsCodes = useMemo(() => {
    const list = [f.leftCode, f.rightCode, f.code]
      .filter(Boolean)
      .map(k => String(k).trim())
    return [...new Set(list)]
  }, [f.leftCode, f.rightCode, f.code])

  const anneSirala = useMemo(() => parentCompare(targetKlipsCodes), [targetKlipsCodes])
  const babaSirala = useMemo(() => parentCompare(targetKlipsCodes), [targetKlipsCodes])

  // Mevcut ebeveyn başka kümesdeyse de seçili kalabilsin: aday listesine
  // eklenir; böylece form "BİLİNMİYOR" göstermez ve kayıt bağı kopmaz.
  const damCandidates = useMemo(() => {
    const list = parentCandidates.filter(b => b.sex === 'F')
    if (currentDam && !list.some(b => b.id === currentDam.id)) list.push(currentDam)
    return list.sort(anneSirala)
  }, [parentCandidates, currentDam, anneSirala])

  const sireCandidates = useMemo(() => {
    const list = parentCandidates.filter(b => b.sex === 'M')
    if (currentSire && !list.some(b => b.id === currentSire.id)) list.push(currentSire)
    return list.sort(babaSirala)
  }, [parentCandidates, currentSire, babaSirala])

  const parentTag = (b) =>
    b && !birdInCoop(b, targetCoopId, db) ? 'BAŞKA KÜMES' : ''

  const selectedMate = db.birds.find(b => b.id === effectiveMateId) || null
  const mateInOtherCoop = Boolean(
    selectedMate && !birdInCoop(selectedMate, targetCoopId, db)
  )
  const mateSex = f.sex || selectedMate?.sex
  const kinship = !isNew && selectedMate && mateSex
    ? relationshipCoefficient(db.birds, { ...f, sex: mateSex }, selectedMate)
    : 0

  // Seçilen eş ile bu kuş arasındaki soy bağı: ANNESİ, BABASI, KARDEŞİ…
  const relForMate = useMemo(() => {
    if (!selectedMate) return ''
    return relationLabel(db.birds, { ...f, sex: mateSex || f.sex }, selectedMate)
  }, [db.birds, f, mateSex, selectedMate])

  // Eski eş / ortak yavru durumu (akrabalık değildir)
  const sharedKids = useMemo(() => {
    if (!selectedMate) return []
    return sharedOffspring(db.birds, f, selectedMate)
  }, [db.birds, f, selectedMate])

  const allKlipsCodes = useMemo(() => {
    return extractAllRingCodes(db).allCodes
  }, [db.birds, db.settings?.codes, db.settings?.singleCodes, db.settings?.dualCodes, db.settings?.rightCodes, db.settings?.leftCodes])

  const handleKlipsCodesChange = (nextCodes) => {
    if (onRightCodesChange) onRightCodesChange(nextCodes)
    if (onLeftCodesChange) onLeftCodesChange(nextCodes)
    if (onCodesChange) onCodesChange(nextCodes)
  }

  return (
    <div
      ref={overlayRef}
      className="overlay"
      onMouseDown={e => e.target === e.currentTarget && onCancel()}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <form ref={modalRef} className="modal" onSubmit={submit} onFocusCapture={handleFormFocus} style={{ scrollPadding: '70px 0 280px 0' }}>
        <div className="modal-head" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <h2 style={{
            margin: 0,
            fontSize: 'clamp(12px, 3.8vw, 17px)',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingRight: 38,
            minWidth: 0,
            flex: 1
          }}>
            {dispTr(isNew ? 'Yeni Kuş' : `Düzenle: ${ringOf(f)}`)}
          </h2>
          <button type="button" className="x" onClick={onCancel} aria-label="Kapat" title="Kapat">×</button>
        </div>

        {err && <p className="hint" style={{ color: 'var(--danger)' }}>{dispTr(err)}</p>}

        <div className="form-grid">
          {/* KÜMES: Yeni kuş eklerken tepede kümes seçimi gösterilmez (kullanıcı zaten üst menüden kümese girmiştir).
              Yalnızca mevcut kuş düzenlenirken kümesler arası taşıma için gösterilir. */}
          {!isNew && coopOptions.length > 1 && (
            <div className="field wide">
              <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Kümes')}</label>
              <select
                value={f.coopId || defaultCoopId}
                onChange={e => setF({ ...f, coopId: e.target.value })}
              >
                {coopOptions.map(coop => (
                  <option key={coop.id} value={coop.id}>{dispTr(coop.name)}</option>
                ))}
              </select>
              <div className="field-hint" style={{ textAlign: 'center' }}>
                {dispTr('Kuş bu kümeste listelenir. Kümes değiştirilirse kuş yeni kümese taşınır; eş, yavru ve ebeveyn bağları korunur.')}
              </div>
            </div>
          )}

          {/* KLİPS RENGİ KARTI */}
          <div className="field wide" style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '14px 14px',
            marginBottom: 2
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{dispTr('🏷️')}</span>
                <strong style={{ fontSize: 13, letterSpacing: 0.5 }}>{dispTr('KLİPS RENGİ')}</strong>
                <span className="muted" style={{ fontSize: 11.5 }}>{dispTr('(İsteğe bağlı)')}</span>
              </div>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: showDualKlips ? 'var(--accent, #38bdf8)' : 'var(--muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: showDualKlips ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: `1px solid ${showDualKlips ? 'var(--accent, #38bdf8)' : 'transparent'}`
                }}
              >
                <input
                  type="checkbox"
                  checked={showDualKlips}
                  onChange={e => setShowDualKlips(e.target.checked)}
                  style={{ accentColor: 'var(--accent, #38bdf8)', width: 15, height: 15, cursor: 'pointer' }}
                />
                <span>{dispTr('🎨 Çift Renkleri Göster')}</span>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 1. Satır: SOL AYAK — kuşun GELDİĞİ soy (ataları).
                  Numara kutusu renk seçicinin YANINDA: künye numarası
                  2 haneli olduğu için küçük tutulur (56px). */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                  <label
                    title="Listede bu ayağın rengiyle görünsün"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: 0, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={f.listFoot === 'left'}
                      onChange={e => setF({ ...f, listFoot: e.target.checked ? 'left' : '' })}
                      style={{ accentColor: 'var(--accent, #38bdf8)', width: 15, height: 15, cursor: 'pointer' }}
                    />
                    {dispTr('SOL AYAK')}
                  </label>
                  <span className="field-hint" style={{ margin: 0 }}>{dispTr('geldiği soy')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CodePicker
                      isColor={true}
                      codes={allKlipsCodes}
                      value={f.leftCode || ''}
                      onChange={v => setF({ ...f, leftCode: v })}
                      onCodesChange={handleKlipsCodesChange}
                      dualMode={showDualKlips}
                      onDualModeChange={setShowDualKlips}
                      chipFixed
                      title="Sol Ayak Klips Renkleri"
                      hint={dispTr('Seçtiğiniz renk klips listesine eklenir:')}
                      emptyText={dispTr('Henüz klips rengi eklenmemiş.')}
                      placeholder={dispTr('Örn. KIRMIZI KLİPS, MAVİ KLİPS')}
                    />
                  </div>
                  <input
                    value={f.leftNumber || ''}
                    onChange={setUpper('leftNumber')}
                    placeholder={dispTr('01/GC')}
                    maxLength={3}
                    aria-label="Sol ayak künye numarası"
                    title="Sol ayak künye numarası (2 hane veya GC)"
                    style={{ flex: '0 0 56px', width: 56, height: 42, textAlign: 'center', fontWeight: 700, letterSpacing: 1, padding: '0 4px' }}
                  />
                </div>
                {leftSuggest.next && (
                  <div className="field-hint" style={{ marginTop: 4 }}>
                    <button
                      type="button" className="btn small"
                      onClick={() => setF({ ...f, leftNumber: leftSuggest.next })}
                    >{dispTr(`Sonraki: ${leftSuggest.next}`)}</button>
                  </div>
                )}
              </div>

              {/* 2. Satır: SAĞ AYAK — kuşun KENDİ soyu (verdiği yavrular). */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                  <label
                    title="Listede bu ayağın rengiyle görünsün"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: 0, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={f.listFoot === 'right'}
                      onChange={e => setF({ ...f, listFoot: e.target.checked ? 'right' : '' })}
                      style={{ accentColor: 'var(--accent, #38bdf8)', width: 15, height: 15, cursor: 'pointer' }}
                    />
                    {dispTr('SAĞ AYAK')}
                  </label>
                  <span className="field-hint" style={{ margin: 0 }}>{dispTr('kendi soyu')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CodePicker
                      isColor={true}
                      codes={allKlipsCodes}
                      value={f.rightCode || ''}
                      onChange={v => setF({ ...f, rightCode: v })}
                      onCodesChange={handleKlipsCodesChange}
                      dualMode={showDualKlips}
                      onDualModeChange={setShowDualKlips}
                      chipFixed
                      title="Sağ Ayak Klips Renkleri"
                      hint={dispTr('Seçtiğiniz renk klips listesine eklenir:')}
                      emptyText={dispTr('Henüz klips rengi eklenmemiş.')}
                      placeholder={dispTr('Örn. SARI KLİPS, BEYAZ KLİPS')}
                    />
                  </div>
                  <input
                    value={f.rightNumber || ''}
                    onChange={setUpper('rightNumber')}
                    placeholder={dispTr('01/GC')}
                    maxLength={3}
                    aria-label="Sağ ayak künye numarası"
                    title="Sağ ayak künye numarası (2 hane veya GC)"
                    style={{ flex: '0 0 56px', width: 56, height: 42, textAlign: 'center', fontWeight: 700, letterSpacing: 1, padding: '0 4px' }}
                  />
                </div>
                {rightSuggest.next && (
                  <div className="field-hint" style={{ marginTop: 4 }}>
                    <button
                      type="button" className="btn small"
                      onClick={() => setF({ ...f, rightNumber: rightSuggest.next })}
                    >{dispTr(`Sonraki: ${rightSuggest.next}`)}</button>
                  </div>
                )}
              </div>

              {/* Seçim yapılmadıysa hangi ayağın kullanılacağı burada yazar. */}
              <div className="field-hint" style={{ marginTop: -6 }}>
                {dispTr(f.listFoot === 'left'
                  ? 'Listede SOL ayak rengiyle görünecek.'
                  : f.listFoot === 'right'
                    ? 'Listede SAĞ ayak rengiyle görünecek.'
                    : 'Listede hangi ayakla görüneceği seçilmedi: sol doluysa sol, yoksa sağ.')}
              </div>
            </div>
          </div>

          {/* ÜSTTEN ALTA: Sol ayak ve Sağ ayak (yukarıda) */}
          {/* CİNSİYET VE CİNSİ — aynı satır */}
          <div className="field wide" style={{ margin: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 10, marginBottom: 8, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}><label style={{ margin: 0 }}>{dispTr('Cinsiyet')}</label></div>
              <button
                type="button"
                className="btn small"
                style={{
                  padding: '1px 6px',
                  fontSize: 9,
                  background: 'var(--accent-wash)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2
                }}
                onClick={() => setShowSexGuide(true)}
                title="Follukta yavru cinsiyeti ayırt etme rehberi"
              >
                {dispTr('💡 Rehber')}
              </button>
              <div style={{ textAlign: 'center' }}><label style={{ margin: 0 }}>{dispTr('Cinsi')}</label></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <select
                  value={f.sex === '?' || (f.status === 'yavru' && !f.sex) ? '?' : f.sex}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '?') {
                      setF({ ...f, sex: '?', status: 'yavru', line: f.line || 'BİZİM YAVRU' })
                    } else if (val === 'M' || val === 'F') {
                      setF({ ...f, sex: val })
                    } else {
                      setF({ ...f, sex: '' })
                    }
                  }}
                >
                  <option value="">{dispTr('SEÇ (BELLİ DEĞİL)')}</option>
                  <option value="?">{dispTr('🐣 YAVRU (CİNSİYET HENÜZ BELLİ DEĞİL)')}</option>
                  <option value="M">{dispTr(SEX.M)}</option>
                  <option value="F">{dispTr(SEX.F)}</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <CodePicker
                  isColor={false}
                  codes={cinsiCodes}
                  value={f.cinsi || ''}
                  onChange={v => setF({ ...f, cinsi: v })}
                  onCodesChange={list => onCinsiChange?.(list, resolveBirdCoopId(f, coopOptions))}
                  title="Cinsler"
                  hint={dispTr('Seçtiğiniz cins bu kümesin listesine eklenir:')}
                  emptyText={dispTr('Bu kümeste henüz cins eklenmemiş.')}
                  placeholder={dispTr('Örn. LİMONİ, ÇAKAL')}
                />
              </div>
            </div>
          </div>
          {/* ANNE VE BABA — aynı satır, eşit hizalı */}
          <div className="field wide" style={{ margin: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Anne (dişi)')}</label>
                <BirdPicker
                  birds={damCandidates}
                  value={f.damOutside?.status ? `outside:${f.damOutside.status}` : f.damId}
                  onChange={v => v.startsWith('outside:')
                    ? setParentOutside('dam', v.slice(8))
                    : setParentBird('dam', v)}
                  title="Anne (Dişi Kuş) Seç"
                  placeholder={dispTr('BİLİNMİYOR')}
                  clearLabel={dispTr('— Bilinmiyor (Seçimi Kaldır) —')}
                  showSex={false}
                  getTag={parentTag}
                  extraOptions={PARENT_OUTSIDE_OPTIONS}
                  extraTitle="KAYITLARIMDA YOK İSE"
                  coops={coopOptions}
                  coopIdOf={coopIdOfBird}
                  defaultCoopId={targetCoopId}
                />
                {f.damOutside?.status && (
                  <input
                    value={f.damOutside.note || ''}
                    onChange={e => setParentOutsideNote('dam', e.target.value, e.target)}
                    placeholder={dispTr('Anne bilgisi (Örn. AÇIK SARI BOZALI)')}
                    style={{ marginTop: 6, fontSize: 12 }}
                  />
                )}
              </div>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Baba (erkek)')}</label>
                <BirdPicker
                  birds={sireCandidates}
                  value={f.sireOutside?.status ? `outside:${f.sireOutside.status}` : f.sireId}
                  onChange={v => v.startsWith('outside:')
                    ? setParentOutside('sire', v.slice(8))
                    : setParentBird('sire', v)}
                  title="Baba (Erkek Kuş) Seç"
                  placeholder={dispTr('BİLİNMİYOR')}
                  clearLabel={dispTr('— Bilinmiyor (Seçimi Kaldır) —')}
                  showSex={false}
                  getTag={parentTag}
                  extraOptions={PARENT_OUTSIDE_OPTIONS}
                  extraTitle="KAYITLARIMDA YOK İSE"
                  coops={coopOptions}
                  coopIdOf={coopIdOfBird}
                  defaultCoopId={targetCoopId}
                />
                {f.sireOutside?.status && (
                  <input
                    value={f.sireOutside.note || ''}
                    onChange={e => setParentOutsideNote('sire', e.target.value, e.target)}
                    placeholder={dispTr('Baba bilgisi (Örn. AÇIK SARI BOZALI)')}
                    style={{ marginTop: 6, fontSize: 12 }}
                  />
                )}
              </div>
            </div>
            {(f.damOutside?.status || f.sireOutside?.status) && (
              <div className="field-hint" style={{ marginTop: 8, textAlign: 'center' }}>
                {dispTr('Kayıt dışı anne/baba yalnızca bilgi olarak görünür; eş kaydı veya soy bağı oluşturmaz.')}
              </div>
            )}
            {coopOptions.length > 1 && (
              <div className="field-hint" style={{ marginTop: 6, textAlign: 'center' }}>
                {dispTr('Anne/baba başka kümesde ise seçicideki kümes düğmelerinden o kümese geçin.')}
              </div>
            )}
            {(damInOtherCoop || sireInOtherCoop) && (
              <div
                className="field-hint"
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)',
                  marginTop: 8
                }}
              >
                <b>{dispTr('UYARI — FARKLI KÜMES:')}</b>{' '}
                {dispTr('Seçili anne veya baba başka kümeste. Soy bağı korunur; bu kayıt formda görünmeye devam eder. Diğer kümesin kuşları kümes listelerinde görünmez.')}
              </div>
            )}
          </div>
          {/* AD VE HAT/SOY — aynı satır, hizalı */}
          <div className="field wide" style={{ margin: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Ad (isteğe bağlı)')}</label>
                <input value={f.name} onChange={setUpper('name')} placeholder={dispTr('Örn. YILDIZ')} />
              </div>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Hat / soy')}</label>
                <input value={f.line} onChange={setUpper('line')} placeholder={dispTr('Örn. NEREDEN GELDİ')} />
              </div>
            </div>
          </div>
          {/* DURUM VE AYIRICI İŞARET — aynı satır */}
          <div className="field wide" style={{ margin: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Durum')}</label>
                <select
                  value={f.status}
                  onChange={e => {
                    const st = e.target.value
                    if (st === 'yavru') {
                      setF({ ...f, status: 'yavru', line: f.line || 'BİZİM YAVRU', sex: f.sex || '?' })
                    } else {
                      setF({ ...f, status: st })
                    }
                  }}
                >
                  {statusOptionsAlpha().map(s => <option key={s.value} value={s.value}>{dispTr(s.label)}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0, minWidth: 0 }}>
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Ayırıcı İşaret')}</label>
                <input value={f.color} onChange={setUpper('color')} placeholder={dispTr('Örn. KANADI SAZLI, OMZU AÇIK LEKELİ')} />
              </div>
            </div>
          </div>

          {(db.settings?.loftMode === 'posta' || db.settings?.loftMode === 'hibrit') && (
            <div className="field wide" style={{
              background: '#38bdf812',
              border: '1px solid #38bdf840',
              borderRadius: 8,
              padding: 12,
              marginTop: 4,
              marginBottom: 4
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{dispTr('🚀')}</span>
                <strong style={{ fontSize: 13, color: '#38bdf8' }}>{dispTr('Posta & Yarış Güvercini Özel Alanları')}</strong>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Resmi Federasyon / Dernek Markası')}</label>
                  <input
                    value={f.federationRing || ''}
                    onChange={setUpper('federationRing')}
                    placeholder={dispTr('Örn: TR-24-34-012345')}
                  />
                  <span className="muted" style={{ fontSize: 11 }}>{dispTr('FCI standart künye formatı')}</span>
                </div>
                <div className="field">
                  <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Elektronik Saat Çip No')}</label>
                  <input
                    value={f.chipNo || ''}
                    onChange={setUpper('chipNo')}
                    placeholder={dispTr('Örn: 900085001234 (Benzing/Tipes)')}
                  />
                </div>
                <div className="field">
                  <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Kan Hattı / Soy (Strain)')}</label>
                  <input
                    value={f.strain || ''}
                    onChange={setUpper('strain')}
                    placeholder={dispTr('Örn: JANSSEN, VAN LOON, KOOPMAN')}
                  />
                </div>
                <div className="field">
                  <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Yarış & Etap Dereceleri / Başarılar')}</label>
                  <textarea
                    rows={2}
                    value={f.raceResults || ''}
                    onChange={e => setF({ ...f, raceResults: e.target.value })}
                    placeholder={dispTr('Örn: 2024 Eskişehir 350 KM 1.lik (1240 m/dk)\n2024 Polatlı 420 KM 4.lük')}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="field">
            <label style={{ textAlign: 'center', display: 'block' }}>{dispTr(hasCurrentMate ? 'Mevcut eş' : 'Eş (isteğe bağlı)')}</label>
            <BirdPicker
              birds={mateCandidates}
              value={effectiveMateId}
              onChange={v => { setMateId(v); setMatePicked(true) }}
              disabled={hasCurrentMate}
              title={hasCurrentMate ? 'Mevcut Eş' : 'Eş Seç (İsteğe Bağlı)'}
              placeholder={dispTr(hasCurrentMate ? 'MEVCUT EŞ' : 'EŞ SEÇMEDEN KAYDET')}
              clearLabel={dispTr('— Eş Seçmeden Kaydet —')}
              getTag={b => {
                const rel = relationLabel(db.birds, f, b)
                const shared = sharedOffspring(db.birds, f, b).length
                // Not: etiket hem gösterimde hem BirdPicker aramasında (trSearch)
                // kullanılıyor; mantık değeri ham bırakılır, görünümde sarılır.
                 return rel ? `[${rel}]` : shared > 0 ? '[ESKİ EŞİ]' : ''
              }}
            />
            <div className="field-hint">
              {dispTr(hasCurrentMate
                ? 'Bu kuşun eşi var. Değiştirmek veya ayırmak için kuş sayfasındaki Eşler bölümünü kullan.'
                : !f.sex
                ? 'Cinsiyeti seçersen eş listesi otomatik daralır.'
                : mateCandidates.length
                  ? `${f.sex === 'M' ? 'Erkek' : 'Dişi'} olduğu için yalnızca ${f.sex === 'M' ? 'dişiler' : 'erkekler'} listeleniyor (${mateCandidates.length} kuş).`
                  : `Eşe uygun ${f.sex === 'M' ? 'dişi' : 'erkek'} kuş yok.`)}
              {hiddenMated > 0 && dispTr(` ${hiddenMated} kuşun eşi zaten seçili olduğu için gizlendi.`)}
              {!hasCurrentMate && dispTr(' Akrabalık varsa seçenek sonunda [ANNESİ] gibi yazılı.')}
            </div>
            {mateInOtherCoop && (
              <div
                className="field-hint"
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)'
                }}
              >
                <b>{dispTr('UYARI — FARKLI KÜMES:')}</b>{' '}
                {dispTr('Mevcut eş başka kümeste. Bu bağ korunur; ancak kümes listelerinde diğer kümesin kuşları görünmez.')}
              </div>
            )}
            {selectedMate && relForMate && (
              <div
                className="field-hint"
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)'
                }}
              >
                <b>{dispTr('UYARI — AKRABA EŞLEŞMESİ:')}</b> {dispTr(ringOf(selectedMate))} {dispTr('bu kuşun')}{' '}
                <b>{dispTr(relForMate)}</b>{dispTr('. Soy kalitesi düşebilir.')}
              </div>
            )}
            {selectedMate && !relForMate && sharedKids.length > 0 && (
              <div
                className="field-hint"
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  background: 'var(--panel-2)'
                }}
              >
                {dispTr('ℹ️')} <b>{dispTr('BİLGİ:')}</b> {dispTr(ringOf(selectedMate))} {dispTr('ile bu kuşun kayıtlı')} {sharedKids.length} {dispTr('ortak yavrusu var (eski eş).')} <b>{dispTr('Akrabalık bağı yoktur')}</b>{dispTr(', güvenle eşleştirilebilir.')}
              </div>
            )}
            {selectedMate && kinship > 0.005 && (
              <div className="field-hint" style={{ color: kinship > 0.125 ? 'var(--danger)' : 'var(--accent)' }}>
                {dispTr('Akrabalık:')} {dispTr(kinshipPct(kinship))}{dispTr(kinship > 0.125 ? ' — yüksek' : '')}
              </div>
            )}
          </div>
          <div className="field">
              <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Doğum tarihi (isteğe bağlı)')}</label>
              <input type="date" value={f.birthDate} onChange={set('birthDate')} />
              <div className="field-hint">{dispTr('Soy ağacında yıl olarak görünür.')}</div>
            </div>
            {f.sex === 'F' && (
              <div className="field">
                <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Yumurtlama tarihi (isteğe bağlı)')}</label>
                <input type="date" value={f.layingDate} onChange={set('layingDate')} />
              </div>
            )}
          <div className="field wide">
            <label style={{ textAlign: 'center', display: 'block' }}>{dispTr('Notlar')}</label>
            <textarea rows={3} value={f.notes} onChange={setUpper('notes')} />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <PhotoBox bird={f} onAdd={addPhotos} onDelete={delPhoto} />
        </div>

        {/* Mobilde klavye açıldığında son kutuların da yukarı kayabilmesi için boşluk payı */}
        <div style={{ height: 160 }} aria-hidden="true" />
        <div className="form-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
          <button type="submit" className="btn primary" style={{ flexShrink: 0 }}>{dispTr('Kaydet')}</button>
          <button type="button" className="btn" onClick={onCancel} style={{ flexShrink: 0 }}>{dispTr('Vazgeç')}</button>
          <div className="spacer" />
          <span
            className="muted"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'clamp(9.5px, 2.7vw, 13px)',
              whiteSpace: 'nowrap',
              minWidth: 0,
              maxWidth: '52%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              justifyContent: 'flex-end',
              textAlign: 'right'
            }}
            title={ringOf(f)}
          >
            <strong style={{
              color: 'var(--text)',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0
            }}>
              {dispTr(ringOf(f))}
            </strong>
          </span>
        </div>
      </form>

      {showSexGuide && (
        <ChickSexGuideModal
          onClose={() => setShowSexGuide(false)}
          onSelectSex={sex => setF(p => ({ ...p, sex }))}
        />
      )}
    </div>
  )
}