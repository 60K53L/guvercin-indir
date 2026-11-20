import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import {
  SEX, statusLabel, ringOf, fmtDate, byId, dispTr,
  parentsOf, childrenOf, siblingsOf, collectOffspring,
  relationshipCoefficient, kinshipPct,
  matesOf, mateIdOf, isFormer, relationLabel, compareBirds, isGone,
  sharedOffspring,
  treatmentStatusLabel, treatmentDurationDays, todayIso, kb, trUpper,
  footNumber, listFootOf, externalParentText
} from '../lib.js'
import { normalizeBird } from '../schema.js'
import { fitFontSize } from '../fitText.js'
import {
  BIRD_ROW_COLUMNS,
  applyGap,
  measureTableColumns,
  publishWidths,
  subscribeWidths
} from '../birdRowsWidths.js'
import { coopList, resolveBirdCoopId } from '../coops.js'
import Pedigree from './Pedigree.jsx'
import PostaPedigreeModal from './PostaPedigreeModal.jsx'
import Ring from './Ring.jsx'
import KlipsRing from './KlipsRing.jsx'
import { PhotoBox } from './PhotoBox.jsx'
import { PhotoImg, openPhoto } from './PhotoViewer.jsx'
import { TreatmentModal } from './TreatmentBoard.jsx'
import BirdPicker from './BirdPicker.jsx'
import BreedIcon from './BreedIcon.jsx'
import CoopTag from './CoopTag.jsx'
import { ENABLE_LOFT_CHECK } from './LoftCheck.jsx'

/**
 * Soy ve üreme özeti kartlarında uzun anne/baba künyelerinin
 * kart sınırlarını aşmadan ve taşmadan sığması için dinamik boyutlandırma.
 */
function parentChipStyle(text) {
  if (!text) return undefined
  const len = text.length
  if (len > 18) {
    return { fontSize: '8.5px', letterSpacing: '-0.35px', padding: '2px 3px' }
  }
  if (len > 14) {
    return { fontSize: '9.5px', letterSpacing: '-0.2px', padding: '2px 4px' }
  }
  if (len > 10) {
    return { fontSize: '11px', letterSpacing: '-0.1px', padding: '2px 4px' }
  }
  return undefined
}

export default function BirdDetail({
  bird, db, allDb, coops, activeCoop, onBack, onPrevBird, prevBird, onEdit, onDelete, onUpsert, onNotify,
  onOpenBird, onUpsertPairing, onRemovePairing,
  onUpsertTreatment, onRemoveTreatment
}) {
  const [tab, setTab] = useState('kimlik')
  const [assigning, setAssigning] = useState(false)
  const [assignDurum, setAssignDurum] = useState('simdi')
  const [pickingChick, setPickingChick] = useState(null)
  const [expandedPairChicks, setExpandedPairChicks] = useState({})
  const [showFciModal, setShowFciModal] = useState(false)
  const [editingTreatment, setEditingTreatment] = useState(null)
  // Kümes değişikliği doğrudan yazılmaz: önce onay penceresi açılır.
  const [pendingCoopId, setPendingCoopId] = useState('')

  useEffect(() => {
    if (!pendingCoopId) return
    const onKey = (e) => {
      if (e.key === 'Escape') setPendingCoopId('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingCoopId])

  useEffect(() => {
    const el = document.querySelector('.body')
    if (el) el.scrollTop = 0
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [bird?.id])

  const coopOptions = coops && coops.length ? coops : coopList(db)
  const currentCoopId = resolveBirdCoopId(bird, coopOptions)
  const currentCoop = coopOptions.find(c => c.id === currentCoopId) || activeCoop || coopOptions[0]
  // Aile bağları kümesle sınırlanmaz: eş, yavru ve ebeveynler başka kümesde
  // olsa da detay ekranında görünür. Liste ve seçiciler ise `db` (kümes
  // görünümü) üzerinden çalışmaya devam eder.
  const relationDb = allDb || db
  const activeCoopId = activeCoop?.id || ''
  const pendingCoop = pendingCoopId
    ? coopOptions.find(c => c.id === pendingCoopId) || null
    : null

  const confirmCoopChange = async () => {
    if (!pendingCoopId || !pendingCoop) return
    const target = pendingCoop
    setPendingCoopId('')
    try {
      await onUpsert({ ...bird, coopId: target.id })
      onNotify?.(`Kuş ${target.name} kümesine taşındı`)
    } catch (err) {
      onNotify?.(`Taşıma hatası: ${err.message || err}`, 'err')
    }
  }

  const togglePairChicks = (pairingId) => {
    setExpandedPairChicks(prev => ({
      ...prev,
      [pairingId]: !prev[pairingId]
    }))
  }

  /**
   * "Listede göster" tiki: kuşun listede HANGİ AYAĞIN rengiyle
   * gruplanacağını seçer. Tek seçim — bir ayak seçilirse diğeri kalkar.
   * Tik kaldırılırsa otomatik kurala dönülür (sol doluysa sol, yoksa sağ).
   */
  function setListFoot(foot) {
    const next = bird.listFoot === foot ? '' : foot
    // code/number türetilmiş alanlar normalizeBird ile yenilenir; yoksa
    // liste eski renk grubunda kalırdı.
    onUpsert(normalizeBird({ ...bird, listFoot: next }))
    onNotify(
      next === 'left' ? 'Listede SOL ayak rengiyle görünecek'
        : next === 'right' ? 'Listede SAĞ ayak rengiyle görünecek'
          : 'Listede otomatik seçim: sol doluysa sol, yoksa sağ'
    )
  }

  const data = useMemo(() => {
    if (!bird) return null
    const p = parentsOf(relationDb.birds, bird)
    const kids = childrenOf(relationDb.birds, bird).sort(compareBirds)
    const kidIds = new Set(kids.map(k => k.id))
    const grandkids = relationDb.birds.filter(b => kidIds.has(b.sireId) || kidIds.has(b.damId)).sort(compareBirds)
    const sibs = siblingsOf(relationDb.birds, bird).sort(compareBirds)
    const line = bird.sex === 'M' ? p.sire : p.dam
    const desc = collectOffspring(relationDb.birds, bird).length
    // Eşler ikiye ayrılır: MEVCUT EŞ (tek) ve ESKİ EŞLER.
    const groups = matesOf(relationDb.pairings, bird)
    const expand = (list) => list.map(x => ({
      pairing: x,
      mate: byId(relationDb.birds, mateIdOf(x, bird)),
      male: byId(relationDb.birds, x.maleId),
      female: byId(relationDb.birds, x.femaleId),
      kinship: relationshipCoefficient(relationDb.birds, byId(relationDb.birds, x.maleId), byId(relationDb.birds, x.femaleId))
    }))
    const mates = expand(groups.simdi)
    const formerMates = expand(groups.eski)
    const damOutside = externalParentText(bird, 'dam')
    const sireOutside = externalParentText(bird, 'sire')

    // Kardeşleri grupla: Öz Kardeşler, Aynı Babadan, Aynı Anneden
    const sireId = bird.sireId || null
    const damId = bird.damId || null
    const full = []
    const paternal = []
    const maternal = []
    sibs.forEach(s => {
      const isSameSire = Boolean(sireId && s.sireId === sireId)
      const isSameDam = Boolean(damId && s.damId === damId)
      if (isSameSire && isSameDam) {
        full.push(s)
      } else if (isSameSire) {
        paternal.push(s)
      } else if (isSameDam) {
        maternal.push(s)
      }
    })
    const siblingGroups = []
    if (full.length > 0) {
      siblingGroups.push({
        key: 'full',
        title: 'Öz Kardeşler (Anne ve Baba Bir)',
        badge: 'ÖZ KARDEŞ',
        birds: full
      })
    }
    if (paternal.length > 0) {
      siblingGroups.push({
        key: 'paternal',
        title: damId ? 'Aynı Babadan (Anne Farklı)' : 'Aynı Babadan',
        badge: 'BABA BİR',
        birds: paternal
      })
    }
    if (maternal.length > 0) {
      siblingGroups.push({
        key: 'maternal',
        title: sireId ? 'Aynı Anneden (Baba Farklı)' : 'Aynı Anneden',
        badge: 'ANNE BİR',
        birds: maternal
      })
    }

    return { p, kids, grandkids, sibs, siblingGroups, desc, mates, formerMates, line, damOutside, sireOutside }
  }, [bird, relationDb])

  useEffect(() => {
    if (!bird && onBack) {
      onBack()
    }
  }, [bird, onBack])

  if (!bird || !data) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <p className="muted" style={{ marginBottom: 16 }}>Kayıt bulunamadı veya silindi.</p>
        <button className="btn primary" onClick={onBack}>← Kuş Listesine Dön</button>
      </div>
    )
  }

  const { p, kids, grandkids, sibs, siblingGroups, desc, mates, formerMates, line, damOutside, sireOutside } = data
  // Yavrular ekranı ortaktır: başka kümesde yaşayan yavru da listede kalır.
  // Yalnızca rozetle "başka kümede" olduğu belirtilir.
  const otherCoopKids = kids.filter(k =>
    activeCoopId && resolveBirdCoopId(k, coopOptions) !== activeCoopId
  )

  async function addPhotos(source) {
    const r = await api.photoAdd(source)
    if (!r.ok) return onNotify(r.error, 'err')
    if (!r.data.length) return
    onUpsert({ ...bird, photos: [...(bird.photos || []), ...r.data] })
    // Fotoğraflar sıkıştırılıp yüklenir; ne kadar yer kazandığını söyle.
    const s = api.lastUploadStats && api.lastUploadStats()
    onNotify(s && s.savedBytes > 0
      ? `${r.data.length} fotoğraf eklendi · ${kb(s.originalBytes - s.savedBytes)} tasarruf`
      : `${r.data.length} fotoğraf eklendi`)
  }

  async function delPhoto(name) {
    await api.photoDelete(name)
    onUpsert({ ...bird, photos: (bird.photos || []).filter(x => x !== name) })
  }

  // Bir eş kartı: hem "Mevcut Eş" hem "Eski Eşler" listesinde kullanılır.
  function renderMate({ pairing, mate, male, female, kinship }, { former }) {
    // Bu çiftleşmeden doğmuş yavrular: hem pairing.chickIds hem de kuşların
    // kendi baba/ana alanları (elle girilmiş olabilir) birlikte dikkate alınır.
    const chickIds = new Set([
      ...(pairing.chickIds || []),
      ...relationDb.birds
        .filter(b => b.sireId === pairing.maleId && b.damId === pairing.femaleId)
        .map(b => b.id)
    ])
    // Kullanıcı yavruları hangi sırayla girdiyse girsin listeler daima
    // aynı düzende olsun (compareBirds: kod → GC → numara → cinsiyet).
    const chicks = relationDb.birds.filter(b => chickIds.has(b.id)).sort(compareBirds)
    const isChicksExpanded = !!expandedPairChicks[pairing.id]

    return (
      <div key={pairing.id} className="panel mate-item-card">
        {mate ? (
          <div className="mate-card-header">
            <div className="mate-pic">
              {(mate.photos || []).length > 0
                ? <Thumb name={mate.photos[0]} />
                : <div style={{ width: '100%', height: '100%', background: 'var(--panel-2)' }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Ring text={ringOf(mate)} />
                {mate.name && <span>· {dispTr(mate.name)}</span>}
                <CoopTag bird={mate} coops={coops} activeCoopId={activeCoopId} />
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {dispTr(SEX[mate.sex] || '—')} · {dispTr(statusLabel(mate.status))}
                {mate.line ? dispTr(` · ${mate.line}`) : ''}
                {mate.color ? dispTr(` · ${mate.color}`) : ''}
              </div>
              <div className="ped-sub" style={{ fontSize: 12, marginTop: 2 }}>
                <span>{dispTr('Doğrudan yavru:')} {childrenOf(relationDb.birds, mate).length}</span>
                {kinship > 0.005 && <span>{dispTr(` · Akrabalık ${kinshipPct(kinship)}`)}</span>}
              </div>
            </div>
            <button
              type="button"
              className="btn small"
              onClick={(e) => {
                e.stopPropagation()
                onOpenBird(mate.id)
              }}
              title={`${ringOf(mate)} profiline git`}
              style={{ flexShrink: 0 }}
            >
              {dispTr('PROFİLİ GÖR ›')}
            </button>
          </div>
        ) : (
          <p className="hint">{dispTr('Eş kaydı bulunamadı (silinmiş olabilir).')}</p>
        )}

        <div className="mate-pairing-info">
          <div>
            <Ring text={ringOf(female)} /> × <Ring text={ringOf(male)} />
            {pairing.date && ` · ${fmtDate(pairing.date)}`}
            {pairing.nest ? dispTr(` · Yuva: ${pairing.nest}`) : ''}
            {chicks.length > 0 && dispTr(` · ${chicks.length} yavru`)}
            {kinship > 0.005 && (
              <span style={{ color: kinship > 0.125 ? 'var(--danger)' : 'var(--muted)' }}>
                {' · '}{dispTr('Akrabalık')} {kinshipPct(kinship)}
              </span>
            )}
          </div>
          {pairing.notes && <div className="hint" style={{ marginTop: 4 }}>{dispTr(pairing.notes)}</div>}
        </div>

        {/* Eski eşten doğan yavrular: Açılır/Kapanır buton */}
        {former && (
          <div className="mate-chicks-section">
            <button
              type="button"
              className={`btn mate-chicks-toggle ${isChicksExpanded ? 'primary' : ''}`}
              onClick={() => togglePairChicks(pairing.id)}
            >
              <span>{dispTr(`🐣 BU EŞTEN OLMA YAVRULAR (${chicks.length})`)}</span>
              <span>{dispTr(isChicksExpanded ? '▲ GİZLE' : '▼ GÖSTER')}</span>
            </button>

            {isChicksExpanded && (
              <div className="mate-chicks-drawer">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <h4 style={{ margin: 0 }}>{dispTr('Kayıtlı Yavrular')} ({chicks.length})</h4>
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => setPickingChick(pairing)}
                  >
                    {dispTr('+ YAVRU OLARAK İŞARETLE')}
                  </button>
                </div>
                {chicks.length ? (
                  <BirdRows birds={chicks} db={relationDb} coops={coops} activeCoopId={activeCoopId} onOpen={onOpenBird} empty="" />
                ) : (
                  <p className="hint" style={{ margin: '8px 0' }}>{dispTr('Bu eşleşmeden henüz kayıtlı yavru yok.')}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mate-card-footer">
          {former ? (
            <button
              type="button"
              className="btn danger small"
              onClick={() => {
                if (window.confirm('Bu eski eş kaydını listeden çıkarmak istediğinizden emin misiniz?')) {
                  onRemovePairing(pairing.id)
                  onNotify('Eski eş kaydı silindi')
                }
              }}
            >
              {dispTr('ESKİ EŞ LİSTESİNDEN ÇIKAR')}
            </button>
          ) : (
            <button
              type="button"
              className="btn danger small"
              onClick={() => {
                if (window.confirm('Eşi ayırmak istediğinizden emin misiniz?')) {
                  onRemovePairing(pairing.id)
                  onNotify('Eş kaydı silindi')
                }
              }}
            >
              {dispTr('EŞİ AYIR')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const birdTreatments = useMemo(() => {
    if (!bird) return []
    return (db.treatments || [])
      .filter(t => t.birdId === bird.id)
      .map(t => ({
        ...t,
        days: treatmentDurationDays(t.startDate, t.endDate)
      }))
      .sort((a, b) => {
        const aIsActive = (a.status === 'aktif' || a.status === 'karantina') ? 1 : 0
        const bIsActive = (b.status === 'aktif' || b.status === 'karantina') ? 1 : 0
        if (aIsActive !== bIsActive) return bIsActive - aIsActive
        return String(b.startDate || b.updatedAt || '').localeCompare(String(a.startDate || a.updatedAt || ''))
      })
  }, [bird?.id, db.treatments])

  const activeBirdTreatments = useMemo(() => {
    return birdTreatments.filter(t => t.status === 'aktif' || t.status === 'karantina')
  }, [birdTreatments])

  const TABS = [
    ['kimlik', 'Kimlik'],
    ['hastalik', `Hastalık (${birdTreatments.length})${activeBirdTreatments.length ? ' 🚨' : ''}`],
    ['es', `Eşler (${mates.length})`],
    ['eski', `Eski Eşler (${formerMates.length})`],
    ['soy', 'Soy Ağacı'],
    ['yavru', `Yavrular (${kids.length})`],
    ['akraba', 'Akrabalar']
  ]

  return (
    <>
      <div className="bird-top-nav">
        {onPrevBird ? (
          <button
            type="button"
            className="backlink nav-btn-prev"
            onClick={onPrevBird}
            title={prevBird ? `${dispTr('Önceki kuş:')} ${ringOf(prevBird)}` : dispTr('Bir önceki kuşa dön')}
          >
            <span className="nav-btn-icon">←</span>
            <span className="nav-btn-text">
              {dispTr('GERİ')}
              {prevBird ? <span className="nav-prev-badge"> ({ringOf(prevBird)})</span> : ''}
            </span>
          </button>
        ) : null}

        <button
          type="button"
          className={`backlink ${onPrevBird ? 'nav-btn-list' : ''}`}
          onClick={onBack}
          title={dispTr('Kuş listesine dön')}
        >
          {onPrevBird ? (
            <>
              <span className="nav-btn-icon">📋</span>
              <span className="nav-btn-text">{dispTr('KUŞ LİSTESİ')}</span>
            </>
          ) : (
            dispTr('← KUŞ LİSTESİNE DÖN')
          )}
        </button>
      </div>

      <div className="panel bird-profile-card">
        <div className="bird-hero">
          <div className="bird-hero-main">
            <div className="bird-hero-pic">
              {(bird.photos || []).length > 0 && <Thumb name={bird.photos[0]} />}
            </div>
            <div className="bird-hero-text">
              <h2 className="bird-hero-title">
                <Ring text={ringOf(bird)} className="ring" style={{ fontSize: 18, padding: '4px 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
              </h2>
              <div className="bird-hero-sub">
                <span className={`tag ${bird.sex === '?' || (!bird.sex && bird.status === 'yavru') ? 'yavru' : (bird.sex || '')}`}>{dispTr(SEX[bird.sex] || (bird.status === 'yavru' ? 'YAVRU' : '—'))}</span> · {dispTr(statusLabel(bird.status))}
                {activeBirdTreatments.length > 0 && (
                  <span
                    className="tag"
                    style={{
                      background: activeBirdTreatments[0].status === 'aktif' ? '#ef444425' : '#f59e0b25',
                      color: activeBirdTreatments[0].status === 'aktif' ? '#ef4444' : '#f59e0b',
                      fontWeight: 800,
                      border: `1px solid ${activeBirdTreatments[0].status === 'aktif' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
                      marginLeft: 6
                    }}
                    title="Bu kuş şu anda tedavi/karantina altında"
                  >
                    🚨 {dispTr(activeBirdTreatments[0].status === 'aktif' ? 'HASTA' : 'KARANTİNA')}: {dispTr(activeBirdTreatments[0].illness)}
                  </span>
                )}
              </div>
              {bird.federationRing && (
                <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700, marginTop: 4 }}>
                  {dispTr('🚀 Marka:')} {dispTr(bird.federationRing)}
                </div>
              )}
            </div>
          </div>
          <div className="bird-hero-actions">
            {ENABLE_LOFT_CHECK && (
              bird.checkedAt ? (
                <button
                  type="button"
                  className="btn small"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title={`Kontrol Edildi: ${fmtDate(bird.checkedAt)} - Tekrar basarak sıfırlayabilirsiniz`}
                  onClick={async () => {
                    if (window.confirm('Bu kuşun kontrol kaydını sıfırlamak istiyor musunuz?')) {
                      const updated = { ...bird }
                      delete updated.checkedAt
                      await onUpsert(updated)
                      onNotify('Kontrol kaydı kaldırıldı')
                    }
                  }}
                >
                  <span>🟢</span> {dispTr('KONTROL EDİLDİ')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn small danger"
                  style={{
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Kuş henüz kontrol edilmedi. Tıklayarak mevcudiyet onayı verin."
                  onClick={async () => {
                    if (window.confirm('KUŞ HALA MEVCUT MU?')) {
                      await onUpsert({
                        ...bird,
                        checkedAt: new Date().toISOString()
                      })
                      onNotify('Kuş kontrol edildi olarak kaydedildi')
                    }
                  }}
                >
                  <span>🔴</span> {dispTr('KONTROL')}
                </button>
              )
            )}
            <button className="btn" onClick={() => onEdit(bird)}>{dispTr('Düzenle')}</button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm(`${ringOf(bird)} kaydı silinsin mi? Bu işlem geri alınamaz.`)) onDelete(bird.id)
              }}
            >{dispTr('Sil')}</button>
          </div>
        </div>

        {/* Belirgin ayırıcı çizgi */}
        <div className="detail-tabs-divider" />

        <div className="nav detail-tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{dispTr(label)}</button>
          ))}
        </div>
      </div>

      {tab === 'kimlik' && (
        <>
          <div className="split">
            <div className="panel">
              <h3>{dispTr('Bilgiler')}</h3>
              <dl className="kv">
                {/* 1. Ad Bilgisi */}
                <div>
                  <dt>{dispTr('Adı')}</dt>
                  <dd>
                    {bird.name ? (
                      <strong style={{ fontSize: 15, color: 'var(--text)' }}>{dispTr(bird.name)}</strong>
                    ) : (
                      <span className="muted">{dispTr('—')}</span>
                    )}
                  </dd>
                </div>

                {/* 2. Cinsiyet */}
                <div><dt>{dispTr('Cinsiyet')}</dt><dd><span className={`tag ${bird.sex === '?' || (!bird.sex && bird.status === 'yavru') ? 'yavru' : (bird.sex || '')}`}>{dispTr(SEX[bird.sex] || (bird.status === 'yavru' ? 'YAVRU' : '—'))}</span></dd></div>

                {/* 3. Cinsi */}
                <div>
                  <dt>{dispTr('Cinsi')}</dt>
                  <dd style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {bird.cinsi ? (
                      <>
                        <BreedIcon cinsi={bird.cinsi} size={28} />
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{dispTr(bird.cinsi)}</span>
                      </>
                    ) : '—'}
                  </dd>
                </div>

                {/* 4. Ayırıcı İşaret */}
                <div><dt>{dispTr('Ayırıcı İşaret')}</dt><dd>{dispTr(bird.color || '—')}</dd></div>

                {/* 5. Kümes */}
                <div>
                  <dt>{dispTr('Kümes')}</dt>
                  <dd style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      className="coop-dot"
                      style={{ background: currentCoop?.color || 'var(--muted)' }}
                    />
                    <select
                      value={currentCoopId}
                      onChange={e => {
                        const next = e.target.value
                        if (next && next !== currentCoopId) setPendingCoopId(next)
                      }}
                      style={{ maxWidth: 230, minWidth: 0 }}
                      title="Kuşu başka kümese taşı"
                    >
                      {coopOptions.map(coop => (
                        <option key={coop.id} value={coop.id}>{dispTr(coop.name)}</option>
                      ))}
                    </select>
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      {dispTr('değiştirince taşınır')}
                    </span>
                  </dd>
                </div>

                {/* 6. Durum */}
                <div>
                  <dt>{dispTr('Durum')}</dt>
                  <dd>
                    <span className={`tag durum-${bird.status || 'damizlik'}`}>
                      {dispTr(statusLabel(bird.status))}
                    </span>
                    {isGone(bird) && (
                      <span className="muted" style={{ marginLeft: 8, fontSize: 12.5 }}>
                        {dispTr('kayıttan çıkmış')}
                      </span>
                    )}
                  </dd>
                </div>

                {/* Klipsler ve Ek Bilgiler */}
                {bird.leftCode && (
                  <div>
                    <dt>{dispTr('Sol Ayak Klipsi')}</dt>
                    <dd style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <KlipsRing text={bird.leftCode} />
                      {footNumber(bird, 'left') && <span className="bird-num">{dispTr(footNumber(bird, 'left'))}</span>}
                      <label className="foot-pick" title="Listede bu ayağın rengiyle görünsün">
                        <input
                          type="checkbox"
                          checked={bird.listFoot === 'left'}
                          onChange={() => setListFoot('left')}
                        />
                        {dispTr('listede göster')}
                      </label>
                    </dd>
                  </div>
                )}
                {bird.rightCode && (
                  <div>
                    <dt>{dispTr('Sağ Ayak Klipsi')}</dt>
                    <dd style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <KlipsRing text={bird.rightCode} />
                      {footNumber(bird, 'right') && <span className="bird-num">{dispTr(footNumber(bird, 'right'))}</span>}
                      <label className="foot-pick" title="Listede bu ayağın rengiyle görünsün">
                        <input
                          type="checkbox"
                          checked={bird.listFoot === 'right'}
                          onChange={() => setListFoot('right')}
                        />
                        {dispTr('listede göster')}
                      </label>
                    </dd>
                  </div>
                )}
                {!bird.rightCode && !bird.leftCode && bird.code && (
                  <div><dt>{dispTr('Klips Rengi')}</dt><dd><KlipsRing text={bird.code} /></dd></div>
                )}
                <div><dt>{dispTr('Hat / soy')}</dt><dd>{dispTr(bird.line || '—')}</dd></div>
                {bird.federationRing && (
                  <div><dt>{dispTr('Federasyon Markası')}</dt><dd><strong style={{ color: '#38bdf8' }}>{dispTr(bird.federationRing)}</strong></dd></div>
                )}
                {bird.chipNo && (
                  <div><dt>{dispTr('Saat Çipi')}</dt><dd>{dispTr(bird.chipNo)}</dd></div>
                )}
                {bird.strain && (
                  <div><dt>{dispTr('Kan Hattı (Soy)')}</dt><dd><strong style={{ color: '#0284c7' }}>{dispTr(bird.strain)}</strong></dd></div>
                )}
                {bird.raceResults && (
                  <div style={{ marginTop: 8 }}><dt>{dispTr('Yarış Başarıları')}</dt><dd style={{ whiteSpace: 'pre-wrap', color: '#b45309', fontWeight: 600 }}>🏆 {dispTr(bird.raceResults)}</dd></div>
                )}
                {bird.birthDate && (
                  <div><dt>{dispTr('Doğum tarihi')}</dt><dd>{fmtDate(bird.birthDate)}</dd></div>
                )}
                {bird.status === 'satildi' && (
                  <div className="kv-note"><dt /><dd>{dispTr('Bu kuş satıldı, damızlıkta değil.')}</dd></div>
                )}
                {bird.status === 'kacti' && (
                  <div className="kv-note"><dt /><dd>{dispTr('Bu kuş kaçtı, kayıtta ama damızlıkta değil.')}</dd></div>
                )}
                {bird.status === 'oldu' && (
                  <div className="kv-note"><dt /><dd>{dispTr('Bu kuş öldü, kayıt soy geçmişi için tutuluyor.')}</dd></div>
                )}
                {bird.sex === 'F' && (
                  <div><dt>{dispTr('Yumurtlama tarihi')}</dt><dd>{bird.layingDate ? fmtDate(bird.layingDate) : '—'}</dd></div>
                )}
                {ENABLE_LOFT_CHECK && bird.checkedAt && (
                  <div>
                    <dt>{dispTr('Kümes Kontrolü')}</dt>
                    <dd>
                      <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span>🟢</span> {fmtDate(bird.checkedAt)} {new Date(bird.checkedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </dd>
                  </div>
                )}
                <div><dt>{dispTr('Güncelleme')}</dt><dd className="muted">{fmtDate(bird.updatedAt)}</dd></div>
              </dl>
              {bird.notes && (
                <>
                  <h3 style={{ marginTop: 16 }}>{dispTr('Notlar')}</h3>
                  <p className="hint" style={{ whiteSpace: 'pre-wrap' }}>{dispTr(bird.notes)}</p>
                </>
              )}
            </div>

            <div className="panel">
              <h3>{dispTr('Fotoğraflar')}</h3>
              <PhotoBox bird={bird} onAdd={addPhotos} onDelete={delPhoto} />
            </div>
          </div>

          <div className="panel">
            <h3>{dispTr('SOY VE ÜREME ÖZETİ')}</h3>
            <div className="cards" style={{ marginBottom: 0 }}>
              <div className="stat"><div className="n">{kids.length}</div><div className="t">{dispTr('DOĞRUDAN YAVRU')}</div></div>
              <div className="stat"><div className="n">{grandkids.length}</div><div className="t">{dispTr('TORUN')}</div></div>
              <div
                className="stat stat-parent"
                style={{ cursor: p.dam ? 'pointer' : 'default' }}
                onClick={() => p.dam && onOpenBird(p.dam.id)}
                title={p.dam ? `${ringOf(p.dam)} sayfasına git` : ''}
              >
                <div className="n stat-parent-ring">
                  {p.dam ? <Ring text={ringOf(p.dam)} style={parentChipStyle(ringOf(p.dam))} /> : damOutside ? <span className="muted" style={{ fontSize: 11, lineHeight: 1.25, fontWeight: 600 }}>{damOutside}</span> : <span className="muted" style={{ fontSize: 13 }}>{dispTr('BİLİNMİYOR')}</span>}
                </div>
                <div className="t" title={p.dam?.name ? `${dispTr('ANNE')} · ${dispTr(p.dam.name)}` : damOutside || dispTr('ANNE')}>
                  {dispTr('ANNE')} {p.dam?.name ? dispTr(`· ${p.dam.name}`) : ''}
                </div>
              </div>
              <div
                className="stat stat-parent"
                style={{ cursor: p.sire ? 'pointer' : 'default' }}
                onClick={() => p.sire && onOpenBird(p.sire.id)}
                title={p.sire ? `${ringOf(p.sire)} sayfasına git` : ''}
              >
                <div className="n stat-parent-ring">
                  {p.sire ? <Ring text={ringOf(p.sire)} style={parentChipStyle(ringOf(p.sire))} /> : sireOutside ? <span className="muted" style={{ fontSize: 11, lineHeight: 1.25, fontWeight: 600 }}>{sireOutside}</span> : <span className="muted" style={{ fontSize: 13 }}>{dispTr('BİLİNMİYOR')}</span>}
                </div>
                <div className="t" title={p.sire?.name ? `${dispTr('BABA')} · ${dispTr(p.sire.name)}` : sireOutside || dispTr('BABA')}>
                  {dispTr('BABA')} {p.sire?.name ? dispTr(`· ${p.sire.name}`) : ''}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'hastalik' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                {dispTr('🩺 Hastalık & Tedavi Takibi')}
              </h3>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>
                {dispTr('Bu kuşun mevcut hastalık durumu, uygulanan ilaçlar ve geçmiş tedavi kayıtları')}
              </p>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => setEditingTreatment({ birdId: bird.id, status: 'aktif', startDate: todayIso() })}
              style={{ fontWeight: 700 }}
            >
              {dispTr('+ Yeni Hastalık / Tedavi Girişi')}
            </button>
          </div>

          {/* MEVCUT AKTİF HASTALIK KARTI */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {dispTr('Mevcut Sağlık Durumu')}
            </div>

            {activeBirdTreatments.length > 0 ? (
              activeBirdTreatments.map(t => (
                <div
                  key={t.id}
                  style={{
                    background: t.status === 'aktif' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: t.status === 'aktif' ? '1px solid #ef4444' : '1px solid #f59e0b',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                          🚨 {dispTr(t.illness)}
                        </span>
                        <span
                          style={{
                            background: t.status === 'aktif' ? '#ef4444' : '#f59e0b',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 10
                          }}
                        >
                          {dispTr(treatmentStatusLabel(t.status))}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                        {dispTr('📅 Başlangıç:')} {fmtDate(t.startDate)} · ⏱️ <strong>{dispTr(`${t.days} gündür tedavide`)}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={async () => {
                          if (!confirm(`"${t.illness}" hastalığı İYİLEŞTİ olarak işaretlensin mi?`)) return
                          await onUpsertTreatment({ ...t, status: 'iyilesti', endDate: todayIso() })
                          onNotify('🎉 Geçmiş olsun! Kuş iyileşti olarak güncellendi.')
                        }}
                        style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
                      >
                        {dispTr('✅ İyileşti Olarak Kaydet')}
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setEditingTreatment(t)}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      >
                        {dispTr('✏️ Düzenle')}
                      </button>
                    </div>
                  </div>

                  {t.symptoms && (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      <strong>{dispTr('🔍 Belirtiler: ')}</strong>
                      <span>{dispTr(t.symptoms)}</span>
                    </div>
                  )}

                  {t.medicine && (
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      <strong style={{ color: 'var(--accent, #38bdf8)' }}>{dispTr('💊 Uygulanan İlaç: ')}</strong>
                      <span>{dispTr(t.medicine)}</span>
                      {t.dosage && <span className="muted">{dispTr(' · Dozaj:')} {dispTr(t.dosage)}</span>}
                    </div>
                  )}

                  {t.notes && (
                    <div style={{ marginTop: 8, fontSize: 12.5, fontStyle: 'italic', background: 'var(--panel-2)', padding: '6px 10px', borderRadius: 6 }}>
                      📝 {dispTr(t.notes)}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <span style={{ fontSize: 24 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: 14 }}>
                    {dispTr('Bu Kuş Şu Anda Sağlıklı')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {dispTr('Kuşta kayıtlı aktif bir hastalık veya karantina durumu bulunmuyor.')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GEÇMİŞ HASTALIK VE TEDAVİ KAYITLARI */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {dispTr('Geçmiş Tedavi Kayıtları')} ({birdTreatments.filter(t => t.status === 'iyilesti' || t.status === 'kronik').length})
            </div>

            {birdTreatments.filter(t => t.status === 'iyilesti' || t.status === 'kronik').length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {birdTreatments.filter(t => t.status === 'iyilesti' || t.status === 'kronik').map(t => (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--panel-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>{dispTr(t.illness)}</strong>
                        <span style={{ fontSize: 11, background: t.status === 'iyilesti' ? '#10b98125' : '#8b5cf625', color: t.status === 'iyilesti' ? '#10b981' : '#8b5cf6', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          {dispTr(treatmentStatusLabel(t.status))}
                        </span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                        {fmtDate(t.startDate)} {t.endDate ? `— ${fmtDate(t.endDate)}` : ''} · {t.days} {dispTr('gün sürdü')}
                        {t.medicine && dispTr(` · İlaç: ${t.medicine}`)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setEditingTreatment(t)}
                        style={{ padding: '4px 8px', fontSize: 11.5 }}
                      >
                        {dispTr('Düzenle')}
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={async () => {
                          if (!confirm(`"${t.illness}" kaydı silinsin mi?`)) return
                          await onRemoveTreatment(t.id)
                          onNotify('Kayıt silindi')
                        }}
                        style={{ padding: '4px 8px', fontSize: 11.5 }}
                      >
                        {dispTr('Sil')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                {dispTr('Kuşun geçmişe dönük tamamlanmış tedavi kaydı bulunmuyor.')}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'es' && (
        <div>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{dispTr('Mevcut Eş')} ({mates.length})</h3>
              {mates.length ? (
                <button
                  className="btn"
                  onClick={() => { setAssignDurum('simdi'); setAssigning(true) }}
                >
                  {dispTr('EŞİ DEĞİŞTİR')}
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => { setAssignDurum('simdi'); setAssigning(true) }}
                >
                  {dispTr('+ EŞ ATA')}
                </button>
              )}
            </div>

            {!mates.length && (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                {dispTr('Henüz eş kaydı yok.')} <b>{dispTr('Eş Ata')}</b> {dispTr('ile eşleştirin — kayıt Çiftleşmeler')}
                {dispTr('bölümünde de görünür ve yavru eklediğinizde soy bağlantısı otomatik kurulur.')}
              </p>
            )}
          </div>

          <div className="mate-cards-list">
            {mates.map(entry => renderMate(entry, { former: false }))}
          </div>

          {assigning && (
            <MateAssign
              bird={bird}
              db={db}
              allDb={allDb}
              durum={assignDurum}
              onCancel={() => setAssigning(false)}
              onSave={(p) => {
                onUpsertPairing(p)
                setAssigning(false)
                onNotify(assignDurum === 'eski' ? 'Eski eş eklendi' : 'Eş kaydı eklendi')
              }}
            />
          )}
        </div>
      )}

      {/* ---- ESKİ EŞLER: ayrı sekme ---- */}
      {tab === 'eski' && (
        <div>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{dispTr('Eski Eşler')} ({formerMates.length})</h3>
              <button
                className="btn primary"
                onClick={() => { setAssignDurum('eski'); setAssigning(true) }}
              >
                {dispTr('+ ESKİ EŞ EKLE')}
              </button>
            </div>

            {!formerMates.length && (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                {dispTr('Eski eş kaydı yok. Daha önce eş olmuş kuşları buraya ekleyebilirsiniz;')}
                {dispTr('listeye aynı kuş ikinci kez giremez.')}
              </p>
            )}
          </div>

          <div className="mate-cards-list">
            {formerMates.map(entry => renderMate(entry, { former: true }))}
          </div>

          {assigning && (
            <MateAssign
              bird={bird}
              db={db}
              allDb={allDb}
              durum={assignDurum}
              onCancel={() => setAssigning(false)}
              onSave={(p) => {
                onUpsertPairing(p)
                setAssigning(false)
                onNotify('Eski eş eklendi')
              }}
            />
          )}

          {pickingChick && (
            <ChickPick
              pairing={pickingChick}
              db={db}
              relationDb={relationDb}
              coops={coops}
              activeCoopId={activeCoopId}
              onCancel={() => setPickingChick(null)}
              onPick={async (chick) => {
                // Savunma: chick bir KUŞ NESNESİ olmalı. Satır tıklaması
                // yanlışlıkla id geçirirse (ya da liste bozulursa) yeni
                // sahte kuş kaydı açılmasın diye burada kesilir.
                if (!chick || typeof chick !== 'object' || !chick.id) {
                  onNotify('Yavru seçilemedi, liste yenilenmeli', 'err')
                  setPickingChick(null)
                  return
                }
                const yv = db.birds.find(b => b.id === chick.id)
                if (!yv) {
                  onNotify('Bu kuş artık kayıtlarda yok', 'err')
                  setPickingChick(null)
                  return
                }
                // Yavrunun baba/anne alanları bu eşleşmeye bağlanır; kuşun
                // KENDİ KAYDI (künye, ad, fotoğraf…) korunur.
                const updated = {
                  ...yv,
                  sireId: pickingChick.maleId,
                  damId: pickingChick.femaleId
                }
                await onUpsert(updated)
                onUpsertPairing({
                  ...pickingChick,
                  chickIds: [...new Set([...(pickingChick.chickIds || []), yv.id])]
                })
                setPickingChick(null)
                onNotify(`${ringOf(yv)} bu eşleşmenin yavrusu olarak işaretlendi`)
              }}
            />
          )}
        </div>
      )}

      {tab === 'soy' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{dispTr('3 Kuşak Soy Ağacı')}</h3>
            <button
              type="button"
              className="btn primary small"
              onClick={() => setShowFciModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>📜</span>
              <span>
                {dispTr(db.settings?.loftMode === 'posta'
                  ? 'FCI 4-Kuşak Yarış Pedigresi (Yazdır / PDF)'
                  : '4-Kuşak Damızlık Pedigresi (Yazdır / PDF)')}
              </span>
            </button>
          </div>
          <Pedigree birds={relationDb.birds} bird={bird} onOpen={onOpenBird} />
          <p className="hint">{dispTr('Kutulara tıklayarak o kuşun sayfasına geçebilirsiniz.')}</p>
        </div>
      )}

      {tab === 'yavru' && (
        <>
          <div className="panel">
            <h3>{dispTr('Doğrudan Yavrular')} ({kids.length})</h3>
            <p className="hint">
              {dispTr('Yavrular ortaktır: başka kümesde yaşayan yavrular da burada görünür. Kümes ve Babası satırları hangi kümede olduklarını ve babalarını gösterir. Yavrular babalarının yavru sayısına göre sıralanır.')}
              {otherCoopKids.length > 0 && ` ${dispTr(`${otherCoopKids.length} yavru başka kümede.`)}`}
            </p>
            <BirdRows birds={kids} db={relationDb} coops={coops} activeCoopId={activeCoopId} onOpen={onOpenBird} empty="Henüz yavru kaydı yok. Çiftleşme kaydından yavru ekleyebilirsiniz." sortMode="father" widthGroup="yavru" />
          </div>

          {grandkids.length > 0 && (
            <div className="panel">
              <h3>{dispTr('Torunlar')} ({grandkids.length})</h3>
              <BirdRows birds={grandkids} db={relationDb} coops={coops} activeCoopId={activeCoopId} onOpen={onOpenBird} empty="" widthGroup="yavru" />
            </div>
          )}
        </>
      )}

      {tab === 'akraba' && (
        <div className="panel">
          <div className="rel-grid">
            <RelativeCard label="ANNE" bird={p.dam} outside={damOutside} db={relationDb} coops={coops} activeCoopId={activeCoopId} empty="ANNE BİLİNMİYOR." onOpen={onOpenBird} />
            <RelativeCard label="BABA" bird={p.sire} outside={sireOutside} db={relationDb} coops={coops} activeCoopId={activeCoopId} empty="BABA BİLİNMİYOR." onOpen={onOpenBird} />
          </div>
          <h3 style={{ marginTop: 24, marginBottom: 14 }}>{dispTr('Kardeşler')} ({sibs.length})</h3>
          {sibs.length === 0 ? (
            <p className="hint">{dispTr('Kardeş kaydı yok.')}</p>
          ) : (
            siblingGroups.map(grp => (
              <div
                key={grp.key}
                style={{
                  background: 'var(--panel-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{dispTr(grp.title)}</span>
                    <span className="count">({grp.birds.length})</span>
                  </h4>
                  <span className="tag" style={{ fontSize: 10 }}>{dispTr(grp.badge)}</span>
                </div>
                <BirdRows
                  birds={grp.birds}
                  db={relationDb}
                  coops={coops}
                  activeCoopId={activeCoopId}
                  onOpen={onOpenBird}
                  empty=""
                  widthGroup="akraba"
                  parentMode="both"
                />
              </div>
            ))
          )}
        </div>
      )}

      {showFciModal && (
        <PostaPedigreeModal
          bird={bird}
          db={relationDb}
          coopName={currentCoop?.name}
          onClose={() => setShowFciModal(false)}
          onOpenBird={onOpenBird}
        />
      )}

      {editingTreatment && (
        <TreatmentModal
          treatment={editingTreatment}
          initialBirdId={bird.id}
          birds={db.birds || []}
          medications={db.medications || []}
          onSave={async (record) => {
            try {
              await onUpsertTreatment(record)
              setEditingTreatment(null)
              onNotify(record.id ? 'Tedavi kaydı güncellendi' : 'Yeni tedavi kaydı eklendi')
            } catch (err) {
              onNotify('Kaydetme hatası: ' + (err.message || err), 'err')
            }
          }}
          onClose={() => setEditingTreatment(null)}
        />
      )}
      {pendingCoop && (
        <div
          className="overlay"
          style={{ zIndex: 95 }}
          onMouseDown={e => e.target === e.currentTarget && setPendingCoopId('')}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h2>{dispTr('KÜMES DEĞİŞTİRİLSİN Mİ?')}</h2>
              <button className="x" onClick={() => setPendingCoopId('')} aria-label="Kapat">×</button>
            </div>

            <p className="hint" style={{ marginTop: 0, textAlign: 'center' }}>
              <b>{dispTr(bird.name || ringOf(bird))}</b>{' '}
              {dispTr('adlı kuş')}{' '}
              <b>{dispTr(currentCoop?.name || '—')}</b>{' '}
              {dispTr('kümesinden')}{' '}
              <b>{dispTr(pendingCoop.name)}</b>{' '}
              {dispTr('kümesine taşınacak.')}
            </p>

            <div
              className="hint"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel-2)',
                borderRadius: 10,
                padding: '10px 12px',
                lineHeight: 1.5
              }}
            >
              {dispTr('Kuşun eşi, yavruları ve ebeveynleriyle soy bağı korunur; bu kuşun detayında ve onların detayında görünmeye devam eder. Diğer kümesin kuşları yalnızca o kümesin listelerinde ve seçicilerinde görünür. Tedavi ve aşı kayıtları kuşla birlikte yeni kümeste görünür. Kuş kaydı silinmez.')}
            </div>

            <div className="form-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={() => setPendingCoopId('')}
              >
                {dispTr('Vazgeç (ESC)')}
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={confirmCoopChange}
              >
                {dispTr('Evet, Kümesi Değiştir')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MateAssign({ bird, db, allDb, durum = 'simdi', onCancel, onSave }) {
  const wantSex = bird.sex === 'M' ? 'F' : 'M'
  const [mateId, setMateId] = useState('')
  const [notes, setNotes] = useState('')
  // Yalnızca İKİ kuşun da cinsiyeti bilinmiyorsa gerekir: bu kuşun roldür.
  const [birdRole, setBirdRole] = useState('')
  const [err, setErr] = useState('')

  // Karşı cins kuşlar. Cinsiyet bilinmiyorsa tüm kuşlar listelenir.
  const bySex = db.birds.filter(
    b => b.id !== bird.id && (!bird.sex || b.sex === wantSex) && !isGone(b)
  )

  const relationDb = allDb || db
  const fullPairings = relationDb.pairings || []

  // Tüm kümeslerdeki aktif (mevcut) eşleşmelerde yer alan kuşların ID'leri
  const matedIds = useMemo(() => {
    const s = new Set()
    for (const p of fullPairings) {
      if (isFormer(p)) continue
      if (p.maleId) s.add(p.maleId)
      if (p.femaleId) s.add(p.femaleId)
    }
    return s
  }, [fullPairings])

  // Kuşun halihazırdaki mevcut eşi
  const currentMateId = useMemo(() => {
    for (const p of fullPairings) {
      if (!isFormer(p) && (p.maleId === bird.id || p.femaleId === bird.id)) {
        return mateIdOf(p, bird)
      }
    }
    return null
  }, [fullPairings, bird.id])

  // Kuşun kayıtlı eski eşleri
  const formerIds = useMemo(() => {
    const s = new Set()
    for (const p of fullPairings) {
      if (isFormer(p) && (p.maleId === bird.id || p.femaleId === bird.id)) {
        const other = mateIdOf(p, bird)
        if (other) s.add(other)
      }
    }
    return s
  }, [fullPairings, bird.id])

  const candidates = useMemo(() => {
    return bySex.filter(b => {
      if (durum === 'eski') {
        // Eski eş eklerken: Kuşun halihazırdaki MEVCUT eşi ve daha önce eklenmiş eski eşler adaya dahil edilmez.
        if (currentMateId && b.id === currentMateId) return false
        if (formerIds.has(b.id)) return false
        return true
      }
      // Mevcut eş atarken: Kuşun halihazırdaki mevcut eşi zaten eşleştiği için hariç tutulur;
      // ayrıca tüm kümeslerde halihazırda başka bir kuşla eşi olanlar listelenmez.
      if (currentMateId && b.id === currentMateId) return false
      if (matedIds.has(b.id)) return false
      return true
    }).sort(compareBirds)
  }, [bySex, durum, formerIds, currentMateId, matedIds])
  const hiddenMated = bySex.length - candidates.length
  const mate = byId(relationDb.birds, mateId)
  const kinship = mate ? relationshipCoefficient(relationDb.birds, bird, mate) : 0
  // Seçilen kuşla arasındaki soy bağı: "ANNESİ", "KARDEŞİ", "AMCASI"…
  const rel = mate ? relationLabel(relationDb.birds, bird, mate) : ''
  const sharedKids = mate ? sharedOffspring(relationDb.birds, bird, mate) : []

  function submit(e) {
    e.preventDefault()
    if (!mateId) return
    // Akraba eşleşmesinde onay POPUP'ı çıkmaz (mobilde PWA sorun
    // yapıyor). Uyarı seçim penceresindeki yazıda durur, kayıt yine yapılır.
    //
    // Cinsiyet ZORUNLU DEĞİL: kuşun cinsiyeti girilmemişse rol, seçilen
    // eşin cinsiyetinden türetilir (eş erkekse bu kuş ana, eş dişiyse baba).
    // İkisi de bilinmiyorsa kullanıcı rolü küçük seçiciyle belirtir.
    let maleId = ''
    let femaleId = ''
    if (bird.sex === 'M') {
      maleId = bird.id
      femaleId = mateId
    } else if (bird.sex === 'F') {
      femaleId = bird.id
      maleId = mateId
    } else if (mate?.sex === 'M') {
      femaleId = bird.id
      maleId = mateId
    } else if (mate?.sex === 'F') {
      maleId = bird.id
      femaleId = mateId
    } else if (birdRole === 'M') {
      maleId = bird.id
      femaleId = mateId
    } else if (birdRole === 'F') {
      femaleId = bird.id
      maleId = mateId
    } else {
      setErr('İki kuşun da cinsiyeti girilmemiş. Bu kuşun bu eşleşmedeki rolünü seçin.')
      return
    }
    setErr('')
    // Tarih/yuva alanları kaldırıldığı için gönderilmiyor. Eski kayıtlardaki
    // date/nest değerleri silinmez: yalnızca YENİ kayıtlarda boş gelir.
    onSave({ maleId, femaleId, notes, durum })
  }

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <form className="modal" style={{ maxWidth: 480 }} onSubmit={submit}>
        <div className="modal-head" style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center' }}>
          <span />
          <h2 style={{ textAlign: 'center', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dispTr(durum === 'eski' ? 'Eski Eş Ekle' : 'Eş Ata')}
          </h2>
          <button type="button" className="x" onClick={onCancel} style={{ justifySelf: 'end' }}>×</button>
        </div>

        <p className="hint">
          {durum === 'eski' ? (
            <>{dispTr('Bu kuşla daha önce eş olmuş bir kuş kaydedeceksiniz. Aynı kuş ikinci kez eklenemez.')}</>
          ) : bird.sex === 'M' ? (
            <>{dispTr('Bu kuş (')}<Ring text={ringOf(bird)} />{dispTr(') babası olacak.')}</>
          ) : (
            <>{dispTr('Bu kuş (')}<Ring text={ringOf(bird)} />{dispTr(') anası olacak.')}</>
          )}
        </p>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field wide">
            <label>{dispTr('Eş *')}</label>
            <BirdPicker
              birds={candidates}
              value={mateId}
              onChange={(v) => { setMateId(v); setErr('') }}
              title={durum === 'eski' ? 'Eski Eş Seç' : 'Eş Seç'}
              placeholder={dispTr('EŞ SEÇİN...')}
              clearLabel=""
              getTag={b => {
                const rel = relationLabel(relationDb.birds, bird, b)
                const shared = sharedOffspring(relationDb.birds, bird, b).length
                return rel ? `[${rel}]` : shared > 0 ? '[ESKİ EŞİ]' : ''
              }}
            />
            <div className="field-hint">
              {bird.sex
                ? dispTr(`Yalnızca ${bird.sex === 'M' ? 'dişiler' : 'erkekler'} listeleniyor (${candidates.length} kuş). Akrabalık varsa parantez içinde belirtilir.`)
                : dispTr('Bu kuşun cinsiyeti girilmemiş; tüm kuşlar listeleniyor. Rol, seçtiğiniz eşe göre otomatik belirlenir.')}
              {hiddenMated > 0 && (
                durum === 'eski'
                  ? dispTr(` ${hiddenMated} kuş zaten eski eşler listesinde olduğu için gizlendi.`)
                  : dispTr(` ${hiddenMated} kuşun eşi zaten seçili olduğu için gizlendi.`)
              )}
              {durum === 'simdi' && (
                <div className="field-hint">
                  {dispTr('Bir kuşun aynı anda tek mevcut eşi olur. Başka bir kuş seçersen şu anki eş otomatik olarak')} <b>{dispTr('Eski Eşler')}</b> {dispTr('listesine taşınır.')}
                </div>
              )}
            </div>
          </div>
          {/* Tarih ve Yuva/Kafes No kaldırıldı: kullanılmıyordu, gereksiz
            alan kaplıyordu. Yalnızca Eş ve Not kalır. */}
          <div className="field wide">
            <label>{dispTr('Not')}</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={durum === 'eski' ? dispTr('Örn. 2024 yılında eşliydi') : ''}
            />
          </div>
        </div>

        {!bird.sex && mate && !mate.sex && (
          <div className="field wide" style={{ marginTop: 14 }}>
            <label>{dispTr('İki kuşun da cinsiyeti girilmemiş — bu kuşun rolü nedir? *')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn small ${birdRole === 'M' ? 'primary' : ''}`}
                onClick={() => { setBirdRole('M'); setErr('') }}
              >
                {dispTr('Bu kuş ERKEK')}
              </button>
              <button
                type="button"
                className={`btn small ${birdRole === 'F' ? 'primary' : ''}`}
                onClick={() => { setBirdRole('F'); setErr('') }}
              >
                {dispTr('Bu kuş DİŞİ')}
              </button>
            </div>
          </div>
        )}

        {!bird.sex && mate && mate.sex && (
          <p className="hint" style={{ marginTop: 12 }}>
            {dispTr('Eş')} <b>{dispTr(mate.sex === 'M' ? 'erkek' : 'dişi')}</b> {dispTr('olduğu için bu kuş bu eşleşmede')} <b>{dispTr(mate.sex === 'M' ? 'ana' : 'baba')}</b> {dispTr('olarak kaydedilecek.')}
          </p>
        )}

        {err && (
          <p className="hint" style={{ color: 'var(--danger)', marginTop: 12 }}>{dispTr(err)}</p>
        )}

        {mate && rel && (
          <p
            className="hint"
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--danger)',
              color: 'var(--danger)'
            }}
          >
            <b>{dispTr('UYARI — AKRABA EŞLEŞMESİ')}</b>
            <br />
            <Ring text={ringOf(mate)} /> {dispTr('bu kuşun')} <b>{dispTr(rel)}</b>{dispTr('. Soy kalitesi düşebilir.')}
          </p>
        )}

        {mate && !rel && sharedKids.length > 0 && (
          <p
            className="hint"
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              color: 'var(--text)',
              background: 'var(--panel-2)'
            }}
          >
            <b>{dispTr('BİLGİ')}</b>
            <br />
            <Ring text={ringOf(mate)} /> {dispTr('ile bu kuşun kayıtlı')} <b>{dispTr(`${sharedKids.length} ortak yavrusu`)}</b> {dispTr('var (eski eş).')} <b>{dispTr('Akrabalık bağı yoktur')}</b>{dispTr(', güvenle eşleştirilebilir.')}
          </p>
        )}

        {mate && kinship > 0.005 && (
          <p className="hint" style={{ color: kinship > 0.125 ? 'var(--danger)' : 'var(--accent)', marginTop: 12 }}>
            {dispTr('Bu eşleşmede ortak atadan gelen yakınlık:')} <b>{dispTr(kinshipPct(kinship))}</b>{kinship > 0.125 ? dispTr(' — yüksek, soy kalitesini bozabilir.') : ''}
          </p>
        )}

        <div className="form-actions" style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }} disabled={!mateId}>
            {dispTr(durum === 'eski' ? 'Eski Eş Olarak Ekle' : 'Eşi Ata')}
          </button>
          <button type="button" className="btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onCancel}>
            {dispTr('Vazgeç')}
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Bir eşleşmenin yavrusu OLARAK İŞARETLEME penceresi.
 *
 * Yeni kuş TUTMAZ — kuşlar zaten kayıtlı. Var olan kuşlardan biri seçilir
 * ve baba/anne bağı bu eşleşmeye çevrilir. Böylece soy ağacı elle kurulur.
 */
function ChickPick({ pairing, db, relationDb, coops = [], activeCoopId = '', onCancel, onPick }) {
  const [q, setQ] = useState('')
  const displayDb = relationDb || db

  const already = useMemo(() => {
    const s = new Set(pairing.chickIds || [])
    for (const b of db.birds) {
      if (b.sireId === pairing.maleId && b.damId === pairing.femaleId) s.add(b.id)
    }
    return s
  }, [pairing, db.birds])

  const candidates = useMemo(() => {
    const needle = q.trim().toLocaleUpperCase('tr-TR')
    return db.birds
      .filter(b =>
        b.id !== pairing.maleId &&
        b.id !== pairing.femaleId &&
        !already.has(b.id)
      )
      .filter(b => {
        if (!needle) return true
        const hay = `${b.code || ''} ${b.number ?? ''} ${b.leftNumber || ''} ${b.rightNumber || ''} ${b.name || ''} ${b.cinsi || ''} ${b.line || ''}`
          .toLocaleUpperCase('tr-TR')
        return hay.includes(needle)
      })
      .sort(compareBirds)
  }, [db.birds, pairing.maleId, pairing.femaleId, already, q])

  const linkedElsewhere = db.birds.filter(b => !already.has(b.id) && b.id !== pairing.maleId && b.id !== pairing.femaleId)
    .filter(b => (b.sireId || b.damId) && !candidates.some(c => c.id === b.id))

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <h2>{dispTr('Yavru İşaretle')}</h2>
          <button className="x" onClick={onCancel}>×</button>
        </div>

        <p className="hint">
          {dispTr('Kayıtlı kuşlardan birini seçin; seçtiğiniz kuşun baba ve annesi bu eşleşmeye (')}{dispTr(ringOf(byId(displayDb.birds, pairing.maleId) || {}))} ×{' '}
          {dispTr(ringOf(byId(displayDb.birds, pairing.femaleId) || {}))}{dispTr(') bağlanır. Yeni kuş kaydı açılmaz.')}
        </p>

        <div className="field" style={{ marginTop: 14 }}>
          <label>{dispTr('Ara (künye, ad, cins, hat)')}</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={dispTr('Örn. KLİPS veya 01')}
            autoFocus
          />
          <div className="field-hint">{candidates.length} {dispTr('kuş listeleniyor.')}</div>
        </div>

        {candidates.length ? (
          <div style={{ maxHeight: 340, overflowY: 'auto', marginTop: 8 }}>
            {/* DİKKAT: onOpen bir KUŞ NESNESİ bekler. onPick'e doğrudan
              bağlanırsa satır tıklaması yalnızca id geçirir ve onPick
              içinde {...chick} yayılımı bozuk bir kayıt üretir. */}
          <BirdRows
            birds={candidates}
            db={db}
            coops={coops}
            activeCoopId={activeCoopId}
            onOpen={(id) => onPick(candidates.find(b => b.id === id))}
            empty=""
          />
          </div>
        ) : (
          <p className="hint" style={{ marginTop: 10 }}>
            {dispTr('Eşleşecek kuş bulunamadı. Aramayı değiştirin.')}
          </p>
        )}

        {linkedElsewhere.length > 0 && (
          <p className="hint" style={{ marginTop: 10 }}>
            {dispTr('Bu listedeki')} {linkedElsewhere.length} {dispTr('kuşun başka bir baba/anne kaydı var; seçerseniz o bağ')} <b>{dispTr('değiştirilir')}</b>.
          </p>
        )}

        <div className="form-actions">
          <button className="btn" onClick={onCancel}>{dispTr('Vazgeç')}</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Tek bir kuşu kompakt kart olarak gösterir.
 * Baba/Anne gibi TEKİL akraba bağları için kullanılır — 7 sütunlu tablo
 * tek satırda sayfayı seyrek ve dagink gösteriyordu.
 */
function RelativeCard({ label, bird, outside, db, coops, activeCoopId, empty, onOpen }) {
  return (
    <div className="rel-card">
      <div className="rel-label">{dispTr(label)}</div>
      {bird ? (
        <div className="rel-body" onClick={() => onOpen(bird.id)} title={`${ringOf(bird)} sayfasına git`}>
          <div className="rel-pic">
            {(bird.photos || []).length > 0
              ? <Thumb name={bird.photos[0]} />
              : <div className="rel-pic-empty" />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rel-ring"><Ring text={ringOf(bird)} className="" /></div>
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{dispTr(bird.name || 'İsimsiz')} · <span className={`tag ${bird.sex === '?' || (!bird.sex && bird.status === 'yavru') ? 'yavru' : (bird.sex || '')}`}>{dispTr(SEX[bird.sex] || (bird.status === 'yavru' ? 'YAVRU' : '—'))}</span></span>
              <CoopTag bird={bird} coops={coops} activeCoopId={activeCoopId} />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {dispTr(bird.cinsi ? `${bird.cinsi}` : '—')}
              {dispTr(bird.line ? ` · ${bird.line}` : '')}
              {' · '}{dispTr(statusLabel(bird.status))}
            </div>
            <div className="ped-sub">
              <span>{dispTr('Doğrudan yavru:')} {childrenOf(db.birds, bird).length}</span>
            </div>
          </div>
          <span className="muted" style={{ fontSize: 20 }}>›</span>
        </div>
      ) : outside ? (
        <div className="hint" style={{ padding: '10px 2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="tag" style={{ alignSelf: 'flex-start', fontSize: 10 }}>{dispTr('KAYIT DIŞI')}</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{outside}</span>
        </div>
      ) : (
        <div className="hint" style={{ padding: '10px 2px' }}>{dispTr(empty)}</div>
      )}
    </div>
  )
}

/**
 * Kuş listelerinde ayrı "Kümes" sütunu: her kuşun o an bulunduğu kümesi
 * gösterir. Böylece başka kümedeki yavru/eş/akraba, adın yanına rozet
 * sıkıştırılmadan okunur.
 */
function BirdRows({ birds, db, coops = [], activeCoopId = '', onOpen, empty, sortMode = 'default', widthGroup = '', parentMode = 'father' }) {
  if (!birds.length) return <p className="hint">{dispTr(empty)}</p>
  // Liste kaynağı ne olursa olsun (childrenOf, siblingsOf, chickIds…)
  // burada sıralanır. Kullanıcı kayıtları hangi sırayla girdiyse girsin
  // ekran hep aynı düzende görünür.
  const sireChildCount = (bird) => {
    const sire = (db?.birds || []).find(x => x.id === bird?.sireId)
    if (!sire) return 0
    return (db?.birds || []).filter(x => x.sireId === sire.id).length
  }
  // Künye kartı sabit genişlikte; uzun adlar karta sığacak şekilde
  // GERÇEK metin ölçümüyle küçültülür (canvas measureText).
  const ringFontSize = (text) => {
    const value = String(text || '')
    if (!value) return 12
    // Kart içi kullanılabilir alan: 200px kart - 12px iç boşluk.
    return fitFontSize(value, 188, { max: 12, min: 9 })
  }
  const rows = [...birds].sort((a, b) => {
    if (sortMode === 'father') {
      const countDiff = sireChildCount(b) - sireChildCount(a)
      if (countDiff !== 0) return countDiff
      const sireA = (db?.birds || []).find(x => x.id === a?.sireId)
      const sireB = (db?.birds || []).find(x => x.id === b?.sireId)
      const ringDiff = String(sireA ? ringOf(sireA) : '').localeCompare(
        String(sireB ? ringOf(sireB) : ''),
        'tr'
      )
      if (ringDiff !== 0) return ringDiff
    }
    return compareBirds(a, b)
  })
  // Sütun genişlikleri içerikten ölçülür; aynı gruptaki iki tablo
  // (Yavrular / Torunlar) ölçümleri birleştirilip birebir aynı hizaya gelir.
  const tableRef = useRef(null)
  const sourceId = useRef(`birdrows-${Math.random().toString(36).slice(2)}`)
  const [colWidths, setColWidths] = useState(null)

  useLayoutEffect(() => {
    const el = tableRef.current
    if (!el) return undefined
    // Ölçüm sadece geniş tabloda anlamlı; mobilde tablo kart düzenine
    // dönüşür ve sütun genişlikleri geçersizdir.
    const wide = window.matchMedia('(min-width: 901px)')
    const measure = () => {
      if (!wide.matches) {
        setColWidths(null)
        return
      }
      const measured = measureTableColumns(el)
      if (!measured) return
      const merged = publishWidths(widthGroup, sourceId.current, measured) || measured
      setColWidths(applyGap(merged))
    }

    const unsub = widthGroup
      ? subscribeWidths(widthGroup, widths => {
          if (wide.matches) setColWidths(applyGap(widths))
        })
      : undefined

    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      if (unsub) unsub()
    }
  }, [birds, widthGroup])

  return (
    <table className="grid bird-rows" ref={tableRef}>
      <colgroup>
        {BIRD_ROW_COLUMNS.map((name, i) => (
          <col
            key={name}
            className={`bird-rows-${name}`}
            style={colWidths && colWidths[i] ? { width: `${colWidths[i]}px` } : undefined}
          />
        ))}
        {/* Artan genişliği emen boş sütun: sabit px kolonların
            orantılı şişmesini engeller, böylece iki tablo hizalı kalır. */}
        <col className="bird-rows-spacer" />
      </colgroup>
      <thead><tr><th></th><th>{dispTr('Künye')}</th><th>{dispTr('Ad')}</th><th style={parentMode === 'both' ? { textAlign: 'left', paddingLeft: 12 } : undefined}>{parentMode === 'both' ? dispTr('Anne / Baba') : dispTr('Babası')}</th><th>{dispTr('Cinsiyet')}</th><th>{dispTr('Kümes')}</th><th>{dispTr('Cinsi')}</th><th>{dispTr('Ayırıcı İşaret')}</th><th>{dispTr('Durum')}</th><th className="bird-rows-spacer" /></tr></thead>
      <tbody>
        {rows.map(b => (
          <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(b.id)}>
            <td data-label="" style={{ width: 48 }}>
              {(b.photos || []).length
                ? <Thumb name={b.photos[0]} small />
                : <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--line)', opacity: .3 }}></div>}
            </td>
            <td data-label="Künye"><Ring text={ringOf(b)} style={{ fontSize: ringFontSize(ringOf(b)) }} /></td>
            <td data-label="Ad">{dispTr(b.name) || <span className="muted">—</span>}</td>
            <td data-label={parentMode === 'both' ? 'Anne / Baba' : 'Babası'} className="muted" style={{ fontSize: 12, whiteSpace: 'normal', ...(parentMode === 'both' ? { textAlign: 'left', paddingLeft: 12 } : {}) }}>
              {(() => {
                const sire = (db?.birds || []).find(x => x.id === b.sireId)
                const sireRing = sire ? ringOf(sire) : ''
                const sireName = sire?.name && sire.name !== sireRing ? dispTr(sire.name) : ''
                const sireText = sire ? (sireName ? `${sireRing} ${sireName}` : sireRing) : (externalParentText(b, 'sire') || '—')

                if (parentMode === 'both') {
                  const dam = (db?.birds || []).find(x => x.id === b.damId)
                  const damRing = dam ? ringOf(dam) : ''
                  const damName = dam?.name && dam.name !== damRing ? dispTr(dam.name) : ''
                  const damText = dam ? (damName ? `${damRing} ${damName}` : damRing) : (externalParentText(b, 'dam') || '—')

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 0', width: 44, textAlign: 'center', borderRadius: 4, background: 'rgba(236,72,153,0.15)', color: '#ec4899', flexShrink: 0, letterSpacing: '.04em' }}>
                          {dispTr('ANNE')}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{damText}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 0', width: 44, textAlign: 'center', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', flexShrink: 0, letterSpacing: '.04em' }}>
                          {dispTr('BABA')}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{sireText}</span>
                      </div>
                    </div>
                  )
                }

                return sireText
              })()}
            </td>
            <td data-label="Cinsiyet"><span className={`tag ${b.sex === '?' || (!b.sex && b.status === 'yavru') ? 'yavru' : (b.sex || '')}`}>{dispTr(SEX[b.sex] || (b.status === 'yavru' ? 'YAVRU' : '—'))}</span></td>
            <td data-label="Kümes"><CoopTag bird={b} coops={coops} activeCoopId={activeCoopId} compact always /></td>
            <td data-label="Cinsi" className="muted">{dispTr(b.cinsi || '—')}</td>
            <td data-label="Ayırıcı İşaret" className="muted">{dispTr(b.color || '—')}</td>
            <td data-label="Durum" className="muted">{dispTr(statusLabel(b.status))}</td>
            <td className="bird-rows-spacer" />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Thumb({ name, small }) {
  return <PhotoImg name={name} small={small} onClick={() => openPhoto(name)} />
}