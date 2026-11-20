import { useState, useMemo, useEffect } from 'react'
import {
  byId, ringOf, fmtDate, SEX, statusLabel,
  clutchTimeline, todayIso, addDays, compareBirds, trUpper, uid, trSearch, dispTr,
  calculateClutchFromHatch
} from '../lib.js'
import Ring from './Ring.jsx'
import BirdPicker from './BirdPicker.jsx'
import MatingSimulator from './MatingSimulator.jsx'
import ChickSexGuideModal from './ChickSexGuideModal.jsx'
import {
  requestNotificationPermission, syncClutchNotifications, sendTestNotification
} from '../notifications.js'

/**
 * Klips künye rozetlerinin anne/baba kutularında satıra sığması için
 * karakter uzunluğuna göre dinamik yazı boyutu ve sıkıştırma stili üretir.
 */
function clutchRingStyle(text) {
  const len = String(text || '').length
  if (len > 15) {
    return { fontSize: '9px', letterSpacing: '-0.3px', padding: '1px 4px', maxWidth: '100%', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center' }
  }
  if (len > 11) {
    return { fontSize: '10px', letterSpacing: '-0.2px', padding: '1px 5px', maxWidth: '100%', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center' }
  }
  if (len > 8) {
    return { fontSize: '11px', padding: '1px 6px', maxWidth: '100%', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center' }
  }
  return { fontSize: '12px', padding: '1px 6px', maxWidth: '100%', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center' }
}

export default function Incubation({
  db, onUpsertClutch, onRemoveClutch, onNewChick, onOpenBird, onUpsertPairing, onNotify
}) {
  const [editing, setEditing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('active') // active | hatched | all | done
  const [simOpen, setSimOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notifCount, setNotifCount] = useState(null)
  const [showSexGuide, setShowSexGuide] = useState(false)

  useEffect(() => {
    syncClutchNotifications(db).then(r => setNotifCount(r.scheduledCount)).catch(() => {})
  }, [db.clutches])

  // Eşleşmiş çiftler (açılır liste için)
  const activePairings = useMemo(() => {
    return (db.pairings || [])
      .filter(p => p.durum !== 'eski')
      .map(p => {
        const male = byId(db.birds, p.maleId)
        const female = byId(db.birds, p.femaleId)
        return {
          pairing: p,
          male,
          female,
          // Not: etiket sıralama anahtarı olarak da kullanılıyor (aşağıdaki
          // sort). Bu yüzden burada HAM bırakılır, görünümde dispTr uygulanır.
          label: `${ringOf(female)} × ${ringOf(male)}${p.nest ? ` (YUVA: ${p.nest})` : ''}`
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'tr-TR', { sensitivity: 'base' }))
  }, [db.pairings, db.birds])

  // Kuluçka kayıtları
  const clutches = useMemo(() => {
    return (db.clutches || [])
      .map(c => {
        const male = byId(db.birds, c.maleId)
        const female = byId(db.birds, c.femaleId)
        const tl = clutchTimeline(c)
        return { ...c, male, female, tl }
      })
      .sort((a, b) => {
        // En güncel yumurta üstte
        const da = a.egg2Date || a.egg1Date || a.createdAt || ''
        const db_ = b.egg2Date || b.egg1Date || b.createdAt || ''
        return db_.localeCompare(da)
      })
  }, [db.clutches, db.birds])

  // İstatistikler (KPI)
  const stats = useMemo(() => {
    let active = 0
    let hatchingSoon = 0
    let ringSoon = 0
    let totalChicks = 0

    for (const c of clutches) {
      if (c.status === 'incubation') {
        active++
        if (c.tl && c.tl.daysToHatch <= 3 && c.tl.daysToHatch >= -1) hatchingSoon++
      }
      if (c.status === 'hatched') {
        totalChicks += Number(c.chickCount || 1)
        if (c.tl && Math.abs(c.tl.daysToRing) <= 2) ringSoon++
      }
    }
    return { active, hatchingSoon, ringSoon, totalChicks }
  }, [clutches])

  // Filtrelenmiş liste
  const filtered = useMemo(() => {
    return clutches.filter(c => {
      if (filter === 'active' && c.status !== 'incubation') return false
      if (filter === 'hatched' && c.status !== 'hatched') return false
      if (filter === 'done' && c.status !== 'done' && c.status !== 'empty') return false

      if (search.trim()) {
        const q = trSearch(search)
        const text = trSearch([
          c.nest, c.notes,
          ringOf(c.male), c.male?.name,
          ringOf(c.female), c.female?.name
        ].filter(Boolean).join(' '))
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [clutches, filter, search])

  const handleSave = async (clutchData) => {
    try {
      await onUpsertClutch(clutchData)
      onNotify(editing?.id ? 'Kuluçka kaydı güncellendi' : 'Yeni kuluçka başlatıldı')
      setEditing(null)
      syncClutchNotifications(db).then(r => setNotifCount(r.scheduledCount)).catch(() => {})
    } catch (err) {
      onNotify('Kayıt başarısız: ' + (err.message || err), 'err')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kuluçka kaydını silmek istediğinize emin misiniz?')) return
    try {
      await onRemoveClutch(id)
      onNotify('Kuluçka kaydı silindi')
      syncClutchNotifications(db).then(r => setNotifCount(r.scheduledCount)).catch(() => {})
    } catch (err) {
      onNotify('Silme başarısız', 'err')
    }
  }

  const handleQuickStatus = async (clutch, newStatus, extra = {}) => {
    const updated = { ...clutch, status: newStatus, ...extra }
    delete updated.male
    delete updated.female
    delete updated.tl
    await onUpsertClutch(updated)
    onNotify('Durum güncellendi')
    syncClutchNotifications(db).then(r => setNotifCount(r.scheduledCount)).catch(() => {})
  }

  return (
    <div className="incubation-page">
      {/* Üst Başlık ve İstatistikler */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2>{dispTr('Kuluçka & Üretim Takibi')}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {dispTr('Folluklar, yumurta tarihleri, kuluçka geri sayımı ve künye takma alarmları')}
          </p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>
          {dispTr('+ Yeni Yumurta / Kuluçka Başlat')}
        </button>
      </div>

      {/* KPI Sayaçları */}
      <div className="cards">
        <div className="stat">
          <div className="n">{stats.active}</div>
          <div className="t">{dispTr('Kuluçkada (Yatıyor)')}</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: stats.hatchingSoon > 0 ? 'var(--gold, #d97706)' : 'inherit' }}>
            {stats.hatchingSoon}
          </div>
          <div className="t">{dispTr('Yaklaşan Çıkım (≤3 Gün)')}</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: stats.ringSoon > 0 ? 'var(--accent, #2563eb)' : 'inherit' }}>
            {stats.ringSoon}
          </div>
          <div className="t">{dispTr('Künye Zamanı Gelmiş')}</div>
        </div>
        <div className="stat">
          <div className="n">{stats.totalChicks}</div>
          <div className="t">{dispTr('Çıkan Yavru')}</div>
        </div>
      </div>

      {/* Filtre ve Arama Çubuğu */}
      <div className="toolbar incubation-toolbar">
        <div className="filter-tabs incubation-tabs">
          <button className={`btn small ${filter === 'active' ? 'primary' : ''}`} onClick={() => setFilter('active')}>
            {dispTr(`Kuluçkada (${stats.active})`)}
          </button>
          <button className={`btn small ${filter === 'hatched' ? 'primary' : ''}`} onClick={() => setFilter('hatched')}>
            {dispTr('Yavrusu Çıkanlar')}
          </button>
          <button className={`btn small ${filter === 'all' ? 'primary' : ''}`} onClick={() => setFilter('all')}>
            {dispTr(`Tümü (${clutches.length})`)}
          </button>
          <button className={`btn small ${filter === 'done' ? 'primary' : ''}`} onClick={() => setFilter('done')}>
            {dispTr('Arşiv / Boş')}
          </button>
        </div>
        <input
          type="text"
          placeholder={dispTr('Yuva no, künye veya nota göre ara…')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Kuluçka Kartları Listesi */}
      <div className="clutch-grid">
        {filtered.length === 0 && (
          <div className="panel centered-card">
            <p className="muted">{dispTr('Gösterilecek kuluçka kaydı bulunamadı.')}</p>
            <button className="btn primary" onClick={() => setEditing({})}>
              {dispTr('+ Yeni Yumurta / Kuluçka Başlat')}
            </button>
          </div>
        )}

        {filtered.map(c => {
          const tl = c.tl
          const isIncubating = c.status === 'incubation'
          const isHatched = c.status === 'hatched'
          const isOpen = expandedId === c.id
          const toggleCard = () => setExpandedId(prev => prev === c.id ? null : c.id)

          return (
            <div
              key={c.id}
              className={`panel clutch-card clutch-card-compact${isOpen ? ' open' : ''}`}
              style={{ marginBottom: 10, cursor: 'pointer' }}
              onClick={toggleCard}
            >
              {/* Kart Başlığı: Folluk No, Durum ve Ok */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                  <span className="tag" style={{ fontWeight: 700, fontSize: 12, height: 22, borderRadius: 6, background: 'var(--panel-2)', border: '1px solid var(--line)', padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}>
                    🪹 {dispTr(c.nest || 'Folluk No Yok')}
                  </span>
                  {isIncubating && (
                    <span className="tag" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 600, fontSize: 11, height: 22, borderRadius: 6, padding: '0 6px', display: 'inline-flex', alignItems: 'center' }}>
                      {dispTr(`🥚 Kuluçkada (${Math.min(18, tl?.daysPassed || 1)}. Gün)`)}
                    </span>
                  )}
                  {isHatched && (
                    <span className="tag" style={{ background: '#dcfce7', color: '#166534', fontWeight: 600, fontSize: 11, height: 22, borderRadius: 6, padding: '0 6px', display: 'inline-flex', alignItems: 'center' }}>
                      {dispTr(`🐣 Yavru (${c.chickCount || 1})`)}
                    </span>
                  )}
                  {c.status === 'empty' && (
                    <span className="tag muted" style={{ fontSize: 11, height: 22, borderRadius: 6, padding: '0 6px', display: 'inline-flex', alignItems: 'center' }}>
                      {dispTr('Boş / Kırıldı')}
                    </span>
                  )}
                  {c.status === 'done' && (
                    <span className="tag muted" style={{ fontSize: 11, height: 22, borderRadius: 6, padding: '0 6px', display: 'inline-flex', alignItems: 'center' }}>
                      {dispTr('Tamamlandı')}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isIncubating && tl && tl.daysToHatch <= 0 && (
                    <span className="tag" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 10, height: 20, borderRadius: 6, padding: '0 5px', display: 'inline-flex', alignItems: 'center' }}>
                      {dispTr('BUGÜN!')}
                    </span>
                  )}
                  {isHatched && tl && Math.abs(tl.daysToRing) <= 1 && (
                    <span className="tag" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 10, height: 20, borderRadius: 6, padding: '0 5px', display: 'inline-flex', alignItems: 'center' }}>
                      {dispTr('KÜNYE!')}
                    </span>
                  )}
                  <span className="bird-group-arrow" style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Anne ve Baba Kuş Bilgisi - 1 SATIRI PAYLAŞIYOR, TÜM YAZILAR VE ROZETLER ORTALI */}
              <div
                className="clutch-parents"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  marginBottom: 6,
                  width: '100%'
                }}
              >
                {/* ANNE */}
                <div
                  className="clutch-parent-box"
                  style={{
                    padding: '8px 6px',
                    background: 'var(--panel-2)',
                    borderRadius: 6,
                    minWidth: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: c.female ? 'pointer' : 'default'
                  }}
                  onClick={(e) => {
                    if (isOpen && c.female) {
                      e.stopPropagation()
                      onOpenBird(c.female.id)
                    }
                  }}
                >
                  <div className="muted" style={{ fontSize: 10, marginBottom: 3, textAlign: 'center', width: '100%' }}>
                    {dispTr('ANNE (DİŞİ)')}
                  </div>
                  {c.female ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <Ring text={ringOf(c.female)} style={clutchRingStyle(ringOf(c.female))} />
                      </div>
                      {c.female.name && c.female.name !== ringOf(c.female) && (
                        <span style={{ fontSize: 11, fontWeight: 600, marginTop: 2, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dispTr(c.female.name)}
                        </span>
                      )}
                      <div className="muted" style={{ fontSize: 10.5, marginTop: 1, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dispTr(c.female.cinsi || c.female.color || '—')}
                      </div>
                    </div>
                  ) : <span className="muted" style={{ fontSize: 11, textAlign: 'center' }}>{dispTr('BELİRTİLMEDİ')}</span>}
                </div>

                {/* BABA */}
                <div
                  className="clutch-parent-box"
                  style={{
                    padding: '8px 6px',
                    background: 'var(--panel-2)',
                    borderRadius: 6,
                    minWidth: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: c.male ? 'pointer' : 'default'
                  }}
                  onClick={(e) => {
                    if (isOpen && c.male) {
                      e.stopPropagation()
                      onOpenBird(c.male.id)
                    }
                  }}
                >
                  <div className="muted" style={{ fontSize: 10, marginBottom: 3, textAlign: 'center', width: '100%' }}>
                    {dispTr('BABA (ERKEK)')}
                  </div>
                  {c.male ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <Ring text={ringOf(c.male)} style={clutchRingStyle(ringOf(c.male))} />
                      </div>
                      {c.male.name && c.male.name !== ringOf(c.male) && (
                        <span style={{ fontSize: 11, fontWeight: 600, marginTop: 2, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dispTr(c.male.name)}
                        </span>
                      )}
                      <div className="muted" style={{ fontSize: 10.5, marginTop: 1, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dispTr(c.male.cinsi || c.male.color || '—')}
                      </div>
                    </div>
                  ) : <span className="muted" style={{ fontSize: 11, textAlign: 'center' }}>{dispTr('BELİRTİLMEDİ')}</span>}
                </div>
              </div>

              {/* Alt Süreç & Çıkım Özeti (Kompakt Şerit) */}
              {tl && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, gap: 4 }}>
                  {isIncubating && (
                    <>
                      <span className="muted">
                        {dispTr('Tahmini:')} <strong>{fmtDate(tl.expectedHatch)}</strong>
                      </span>
                      <span style={{ color: tl.daysToHatch <= 0 ? 'var(--success, #16a34a)' : tl.daysToHatch <= 3 ? 'var(--gold, #d97706)' : 'var(--muted)', fontWeight: 600 }}>
                        {tl.daysToHatch === 0 ? dispTr('Bugün Çıkım Günü!') : tl.daysToHatch > 0 ? dispTr(`${tl.daysToHatch} Gün Kaldı`) : dispTr(`${Math.abs(tl.daysToHatch)} Gün Geçti`)}
                      </span>
                    </>
                  )}
                  {isHatched && (
                    <>
                      <span className="muted">
                        {dispTr('Çıkım:')} <strong>{fmtDate(c.hatchDate || tl.effectiveHatch)}</strong>
                      </span>
                      <span style={{ color: Math.abs(tl.daysToRing) <= 1 ? 'var(--danger, #dc2626)' : 'var(--muted)', fontWeight: 600 }}>
                        {tl.daysToRing > 1 ? dispTr(`Künye: ${tl.daysToRing} gün sonra`) : tl.daysToRing <= 1 && tl.daysToRing >= -1 ? dispTr('Künye Zamanı!') : dispTr(`Yeme Düşme: ${fmtDate(tl.weanDate)}`)}
                      </span>
                    </>
                  )}
                  {!isIncubating && !isHatched && (
                    <span className="muted">
                      {dispTr(`1. Yumurta: ${fmtDate(c.egg1Date) || '—'}`)}
                    </span>
                  )}
                </div>
              )}

              {/* AŞAĞI AÇILAN KART İÇERİĞİ (KUŞLAR SEKMESİNDEKİ GİBİ AKORDİYON) */}
              {isOpen && (
                <div
                  className="clutch-card-body"
                  style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Zaman Çizelgesi ve İlerleme */}
                  {tl && (
                    <div style={{ background: 'var(--panel-2)', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 8px', fontSize: 11.5, marginBottom: 4 }}>
                        <span>{dispTr(`1. Yumurta: ${fmtDate(c.egg1Date) || '—'}`)}</span>
                        <span>{dispTr(`2. Yumurta: ${fmtDate(c.egg2Date) || '—'}`)}</span>
                        <span>{dispTr('Tahmini Çıkım:')} <strong>{dispTr(fmtDate(tl.expectedHatch))}</strong></span>
                      </div>

                      {/* Kuluçka Süreç Çubuğu */}
                      {isIncubating && (
                        <div style={{ background: 'var(--line)', borderRadius: 6, height: 8, overflow: 'hidden', position: 'relative', margin: '6px 0 8px' }}>
                          <div
                            style={{
                              background: tl.daysToHatch <= 0 ? 'var(--success, #16a34a)' : 'var(--accent, #2563eb)',
                              width: `${tl.progressPct}%`,
                              height: '100%',
                              transition: 'width 0.3s'
                            }}
                          />
                        </div>
                      )}

                      {/* Tarihler ve Alarmlar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 8px', fontSize: 11 }} className="muted">
                        {isIncubating && (
                          <>
                            <span>{dispTr(`Döl Kontrol: ${fmtDate(tl.checkDate)}`)}</span>
                            <span>{dispTr(`18 Günlük Süreçte ${Math.min(18, tl.daysPassed)}. Gün`)}</span>
                          </>
                        )}
                        {isHatched && (
                          <>
                            <span>{dispTr(`Çıkım: ${fmtDate(c.hatchDate || tl.effectiveHatch)}`)}</span>
                            <span>{dispTr(`Künye Takma: ${fmtDate(tl.ringDate)}`)}</span>
                            <span>{dispTr(`Yeme Düşme: ${fmtDate(tl.weanDate)}`)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {c.notes && (
                    <div className="hint" style={{ marginBottom: 10, fontSize: 11.5 }}>
                      📝 {dispTr(c.notes)}
                    </div>
                  )}

                  {/* 1 YAVRU ÇIKTI, 2 YAVRU ÇIKTI, BOŞ ÇIKTI, KIRILDI KARTLARI (TEK SATIRDA EŞİT GENİŞLİKTE) */}
                  {isIncubating && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="muted" style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 5, textAlign: 'center' }}>
                        {dispTr('HIZLI SONUÇ BİLDİR')}
                      </div>
                      <div
                        className="clutch-outcome-grid"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 6,
                          width: '100%'
                        }}
                      >
                        {/* 1 YAVRU ÇIKTI */}
                        <button
                          type="button"
                          className="btn small outcome-btn"
                          style={{
                            background: 'var(--panel-2)',
                            borderColor: 'var(--line)',
                            padding: '6px 2px',
                            textAlign: 'center',
                            justifyContent: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 6
                          }}
                          onClick={() => {
                            const h = calculateClutchFromHatch(todayIso(), 1)
                            handleQuickStatus(c, 'hatched', { hatchDate: h.hatchDate, chickCount: 1, egg1Date: h.egg1Date, egg2Date: h.egg2Date })
                          }}
                          title={dispTr('1 Yavru Çıktı')}
                        >
                          <span style={{ fontSize: 13 }}>🐣</span>
                          <span style={{ fontSize: 'clamp(9px, 2.2vw, 11px)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {dispTr('1 YAVRU')}
                          </span>
                          <span className="muted" style={{ fontSize: 8.5, whiteSpace: 'nowrap' }}>
                            {dispTr('ÇIKTI')}
                          </span>
                        </button>

                        {/* 2 YAVRU ÇIKTI */}
                        <button
                          type="button"
                          className="btn small primary outcome-btn"
                          style={{
                            padding: '6px 2px',
                            textAlign: 'center',
                            justifyContent: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 6
                          }}
                          onClick={() => {
                            const h = calculateClutchFromHatch(todayIso(), 2)
                            handleQuickStatus(c, 'hatched', { hatchDate: h.hatchDate, chickCount: 2, egg1Date: h.egg1Date, egg2Date: h.egg2Date })
                          }}
                          title={dispTr('2 Yavru Çıktı')}
                        >
                          <span style={{ fontSize: 13 }}>🐣</span>
                          <span style={{ fontSize: 'clamp(9px, 2.2vw, 11px)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {dispTr('2 YAVRU')}
                          </span>
                          <span style={{ fontSize: 8.5, whiteSpace: 'nowrap', opacity: 0.9 }}>
                            {dispTr('ÇIKTI')}
                          </span>
                        </button>

                        {/* BOŞ ÇIKTI */}
                        <button
                          type="button"
                          className="btn small outcome-btn"
                          style={{
                            background: 'var(--panel-2)',
                            borderColor: 'var(--line)',
                            padding: '6px 2px',
                            textAlign: 'center',
                            justifyContent: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 6
                          }}
                          onClick={() => handleQuickStatus(c, 'empty', { notes: (c.notes ? c.notes + ' · ' : '') + 'Boş çıktı' })}
                          title={dispTr('Boş Çıktı')}
                        >
                          <span style={{ fontSize: 13 }}>🥚</span>
                          <span style={{ fontSize: 'clamp(9px, 2.2vw, 11px)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {dispTr('BOŞ')}
                          </span>
                          <span className="muted" style={{ fontSize: 8.5, whiteSpace: 'nowrap' }}>
                            {dispTr('ÇIKTI')}
                          </span>
                        </button>

                        {/* KIRILDI */}
                        <button
                          type="button"
                          className="btn small danger outcome-btn"
                          style={{
                            padding: '6px 2px',
                            textAlign: 'center',
                            justifyContent: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 6
                          }}
                          onClick={() => handleQuickStatus(c, 'empty', { notes: (c.notes ? c.notes + ' · ' : '') + 'Yumurta kırıldı' })}
                          title={dispTr('Kırıldı')}
                        >
                          <span style={{ fontSize: 13 }}>💔</span>
                          <span style={{ fontSize: 'clamp(9px, 2.2vw, 11px)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {dispTr('KIRILDI')}
                          </span>
                          <span style={{ fontSize: 8.5, whiteSpace: 'nowrap', opacity: 0.9 }}>
                            {dispTr('YUMURTA')}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Yavru Çıkmış Durumundaki Aksiyonlar */}
                  {isHatched && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      <button
                        type="button"
                        className="btn small primary"
                        style={{ background: 'var(--accent, #2563eb)', width: '100%', justifyContent: 'center' }}
                        onClick={() => onNewChick({
                          damId: c.femaleId,
                          sireId: c.maleId,
                          birthDate: c.hatchDate || tl?.effectiveHatch || todayIso(),
                          nest: c.nest
                        })}
                      >
                        {dispTr('+ Bu Yuvadan Yavru Kuş Kaydet')}
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <button
                          type="button"
                          className="btn small"
                          style={{ padding: '6px 8px', fontSize: 11, justifyContent: 'center' }}
                          onClick={() => setShowSexGuide(true)}
                          title="Follukta yavru cinsiyetini ayırt etme rehberi"
                        >
                          {dispTr('💡 Cinsiyet Rehberi')}
                        </button>
                        <button
                          type="button"
                          className="btn small"
                          style={{ padding: '6px 8px', fontSize: 11, justifyContent: 'center' }}
                          onClick={() => handleQuickStatus(c, 'done')}
                        >
                          {dispTr('✓ Yeme Düştü (Tamam)')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Düzenle ve Sil Butonları */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setEditing(c)}
                      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                    >
                      ✏️ {dispTr('Düzenle')}
                    </button>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => handleDelete(c.id)}
                      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                    >
                      🗑️ {dispTr('Sil')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Kuluçka Bildirim Durum Kartı (Kompakt ve Yeterli Boyutta) */}
      <div className="clutch-notif-box compact">
        <div className="clutch-notif-main compact">
          <span className="clutch-notif-icon">🔔</span>
          <span className="clutch-notif-title">
            {notifCount !== null && notifCount > 0
              ? dispTr(`${notifCount} kuluçka alarmı kurulu`)
              : dispTr('Kuluçka bildirimleri aktif')}
          </span>
          <span className="clutch-notif-sub">
            {dispTr('(Döl 6. gün, çıkım 18. gün, künye 7. gün)')}
          </span>
        </div>
        <div className="clutch-notif-actions">
          <button
            type="button"
            className="btn small"
            onClick={async () => {
              try {
                const granted = await requestNotificationPermission()
                const res = await syncClutchNotifications(db)
                setNotifCount(res.scheduledCount)
                onNotify(granted ? `${res.scheduledCount} bildirim yenilendi!` : 'Bildirim izni verilmedi.', granted ? 'ok' : 'err')
              } catch (err) {
                onNotify('Hata: ' + err.message, 'err')
              }
            }}
          >
            {dispTr('Yenile')}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={async () => {
              try {
                await sendTestNotification()
                onNotify('Test bildirimi 3 saniye içinde gelecek!')
              } catch (err) {
                onNotify('Hata: ' + err.message, 'err')
              }
            }}
          >
            {dispTr('Test Et')}
          </button>
        </div>
      </div>

      {/* EŞLEŞTİRME SİMÜLATÖRÜ KARTI (BİLDİRİMİN ALTINDA) - açılır/kapanır */}
      <div className="panel sim-card">
        <div className="sim-card-head" role="button" onClick={() => setSimOpen(prev => !prev)}>
          <div className="sim-card-main">
            <span className="sim-card-icon" style={{ fontSize: 24 }}>🧬</span>
            <div className="sim-card-text">
              <h3 className="sim-card-title">{dispTr('Eşleştirme & İslah Simülatörü')}</h3>
              <p className="sim-card-sub">{dispTr('Kan akrabalığı, renk kalıtımı, kapak altı analizi')}</p>
            </div>
          </div>
          <span className="sim-card-toggle">
            {dispTr(simOpen ? 'KAPAT' : 'AÇ')}
          </span>
        </div>

        {simOpen && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #6366f140' }}>
            <MatingSimulator
              db={db}
              onUpsertPairing={onUpsertPairing}
              onOpenBird={onOpenBird}
              onNotify={onNotify}
              hideHeader={true}
            />
          </div>
        )}
      </div>


      {/* Düzenleme / Yeni Kuluçka Modalı */}
      {editing && (
        <ClutchModal
          initial={editing}
          activePairings={activePairings}
          birds={db.birds}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Follukta Yavru Cinsiyet Rehberi Modalı */}
      {showSexGuide && (
        <ChickSexGuideModal
          onClose={() => setShowSexGuide(false)}
        />
      )}
    </div>
  )
}

function ClutchModal({ initial, activePairings, birds, onSave, onCancel }) {
  const [nest, setNest] = useState(initial.nest || '')
  const [pairingId, setPairingId] = useState(initial.pairingId || '')
  const [maleId, setMaleId] = useState(initial.maleId || '')
  const [femaleId, setFemaleId] = useState(initial.femaleId || '')
  const [egg1Date, setEgg1Date] = useState(initial.egg1Date || todayIso())
  const [egg2Date, setEgg2Date] = useState(initial.egg2Date || addDays(initial.egg1Date || todayIso(), 2))
  const [status, setStatus] = useState(initial.status || 'incubation')
  const [chickCount, setChickCount] = useState(initial.chickCount || 2)
  const [hatchDate, setHatchDate] = useState(initial.hatchDate || '')
  const [notes, setNotes] = useState(initial.notes || '')

  const males = useMemo(() => birds.filter(b => b.sex === 'M').sort(compareBirds), [birds])
  const females = useMemo(() => birds.filter(b => b.sex === 'F').sort(compareBirds), [birds])

  const handlePairingSelect = (pid) => {
    setPairingId(pid)
    const found = activePairings.find(x => x.pairing.id === pid)
    if (found) {
      setMaleId(found.pairing.maleId)
      setFemaleId(found.pairing.femaleId)
      if (found.pairing.nest && !nest) setNest(found.pairing.nest)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...initial,
      id: initial.id || uid(),
      nest: trUpper(nest.trim()),
      pairingId: pairingId || null,
      maleId: maleId || null,
      femaleId: femaleId || null,
      egg1Date,
      egg2Date,
      status,
      chickCount: Number(chickCount),
      hatchDate: status === 'hatched' ? (hatchDate || todayIso()) : null,
      notes: trUpper(notes.trim()),
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h2>{dispTr(initial.id ? 'KULUÇKA KAYDINI DÜZENLE' : 'YENİ KULUÇKA / YUMURTA BAŞLAT')}</h2>
          <button type="button" className="x" onClick={onCancel} aria-label="Kapat">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Folluk No */}
          <div className="field">
            <label>{dispTr('Folluk / Yuvalık No (İsteğe bağlı)')}</label>
            <input
              type="text"
              placeholder={dispTr('Örn: Folluk 1, Yuva 3, Dolap 2...')}
              value={nest}
              onChange={e => setNest(e.target.value)}
            />
          </div>

          {/* Hazır Çift Seçimi */}
          <div className="field">
            <label>{dispTr('Kümesteki Eşleşmiş Çiftlerden Seç (Hızlı)')}</label>
            <BirdPicker
              items={activePairings.map(p => ({
                id: p.pairing.id,
                label: p.label
              }))}
              value={pairingId}
              onChange={handlePairingSelect}
              title="Kümesteki Eşleşmiş Çiftler"
              placeholder={dispTr('-- Listeden Çift Seç --')}
              clearLabel={dispTr('— Çift Seçimini Temizle —')}
            />
          </div>

          {/* Veya Manuel Anne-Baba Seçimi - ÖNCE ANNE, SONRA BABA */}
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>{dispTr('ANNE (DİŞİ KUŞ)')}</label>
              <BirdPicker
                birds={females}
                value={femaleId}
                onChange={setFemaleId}
                title="Anne (Dişi Kuş) Seç"
                placeholder={dispTr('-- SEÇİNİZ --')}
                clearLabel={dispTr('— Seçimi Kaldır —')}
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>{dispTr('BABA (ERKEK KUŞ)')}</label>
              <BirdPicker
                birds={males}
                value={maleId}
                onChange={setMaleId}
                title="Baba (Erkek Kuş) Seç"
                placeholder={dispTr('-- SEÇİNİZ --')}
                clearLabel={dispTr('— Seçimi Kaldır —')}
              />
            </div>
          </div>

          {/* Hızlı Çıkım Girişi (Yumurta Günü Bilinmiyorsa) */}
          <div style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                {dispTr('🐣 Hızlı Çıkım Girişi (Yumurta Günü Bilinmiyorsa)')}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                {dispTr('Geriye dönük 18-20 gün hesaplanır')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="btn small"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6
                }}
                onClick={() => {
                  const effectiveHatch = hatchDate || todayIso()
                  const res = calculateClutchFromHatch(effectiveHatch, 1)
                  setEgg1Date(res.egg1Date)
                  setEgg2Date(res.egg2Date)
                  setStatus('hatched')
                  setChickCount(1)
                  setHatchDate(effectiveHatch)
                }}
                title={dispTr('Bugün 1. yavru çıktı olarak işaretle ve yumurta tarihlerini geriye hesapla')}
              >
                <span>🐣</span> {dispTr('1. Yavru Çıktı')}
              </button>
              <button
                type="button"
                className="btn small primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6
                }}
                onClick={() => {
                  const effectiveHatch = hatchDate || todayIso()
                  const res = calculateClutchFromHatch(effectiveHatch, 2)
                  setEgg1Date(res.egg1Date)
                  setEgg2Date(res.egg2Date)
                  setStatus('hatched')
                  setChickCount(2)
                  setHatchDate(effectiveHatch)
                }}
                title={dispTr('Bugün 2. yavru çıktı olarak işaretle ve yumurta tarihlerini geriye hesapla')}
              >
                <span>🐣</span> {dispTr('2. Yavru Çıktı')}
              </button>
            </div>
          </div>

          {/* Yumurta Tarihleri */}
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label style={{ minHeight: '2.4em', display: 'block' }}>{dispTr('1. Yumurta Tarihi')}</label>
              <input
                type="date"
                value={egg1Date}
                onChange={e => {
                  setEgg1Date(e.target.value)
                  if (!egg2Date || egg2Date < e.target.value) setEgg2Date(addDays(e.target.value, 2))
                }}
                required
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label style={{ minHeight: '2.4em', display: 'block' }}>{dispTr('2. Yumurta (Kuluçka Başlangıcı)')}</label>
              <input
                type="date"
                value={egg2Date}
                onChange={e => setEgg2Date(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Durum */}
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <label>{dispTr('Kuluçka Durumu')}</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="incubation">{dispTr('🥚 KULUÇKADA YATIYOR')}</option>
                <option value="hatched">{dispTr('🐣 YAVRU ÇIKTI')}</option>
                <option value="empty">{dispTr('BOŞ ÇIKTI / KIRILDI')}</option>
                <option value="done">{dispTr('TAMAMLANDI')}</option>
              </select>
            </div>
            {status === 'hatched' && (
              <>
                <div className="field" style={{ flex: 1, minWidth: 100 }}>
                  <label>{dispTr('Yavru Sayısı')}</label>
                  <select value={chickCount} onChange={e => setChickCount(e.target.value)}>
                    <option value="1">{dispTr('1 YAVRU')}</option>
                    <option value="2">{dispTr('2 YAVRU')}</option>
                  </select>
                </div>
                <div className="field" style={{ flex: 1, minWidth: 130 }}>
                  <label>{dispTr('Çıkım Tarihi')}</label>
                  <input
                    type="date"
                    value={hatchDate || todayIso()}
                    onChange={e => {
                      const val = e.target.value
                      setHatchDate(val)
                      if (val) {
                        const res = calculateClutchFromHatch(val, chickCount)
                        setEgg1Date(res.egg1Date)
                        setEgg2Date(res.egg2Date)
                      }
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Notlar */}
          <div className="field">
            <label>{dispTr('Notlar / Açıklama')}</label>
            <textarea
              rows={2}
              placeholder={dispTr('Yumurta durumu, döl kontrol notu, folluk özellikleri...')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary">{dispTr('Kaydet')}</button>
            <button type="button" className="btn" onClick={onCancel}>{dispTr('Vazgeç')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

