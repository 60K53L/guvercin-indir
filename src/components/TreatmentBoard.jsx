import { useState, useMemo } from 'react'
import {
  byId, ringOf, fmtDate, todayIso, SEX, statusLabel, dispTr,
  TREATMENT_STATUS, COMMON_ILLNESSES, treatmentStatusLabel, treatmentDurationDays,
  compareBirds, trSearch, trUpper
} from '../lib.js'
import Ring from './Ring.jsx'
import BirdPicker from './BirdPicker.jsx'

export default function TreatmentBoard({
  db,
  onUpsertTreatment,
  onRemoveTreatment,
  onOpenBird,
  onNotify
}) {
  const [filter, setFilter] = useState('active') // 'all' | 'active' | 'quarantine' | 'healed'
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null | {} | treatment

  const birdsById = useMemo(() => {
    const map = new Map()
    for (const b of (db.birds || [])) map.set(b.id, b)
    return map
  }, [db.birds])

  const treatments = useMemo(() => {
    return (db.treatments || []).map(t => {
      const bird = birdsById.get(t.birdId) || null
      const days = treatmentDurationDays(t.startDate, t.endDate)
      return { ...t, bird, days }
    }).sort((a, b) => {
      // Aktifler en üstte, sonra başlangıç tarihine göre en yeni
      const aIsActive = (a.status === 'aktif' || a.status === 'karantina') ? 1 : 0
      const bIsActive = (b.status === 'aktif' || b.status === 'karantina') ? 1 : 0
      if (aIsActive !== bIsActive) return bIsActive - aIsActive
      return String(b.startDate || b.updatedAt || '').localeCompare(String(a.startDate || a.updatedAt || ''))
    })
  }, [db.treatments, birdsById])

  // İstatistikler (KPI)
  const stats = useMemo(() => {
    let active = 0
    let quarantine = 0
    let healed = 0
    for (const t of treatments) {
      if (t.status === 'aktif') active++
      else if (t.status === 'karantina') quarantine++
      else if (t.status === 'iyilesti') healed++
    }
    return {
      active,
      quarantine,
      healed,
      total: treatments.length,
      underTreatment: active + quarantine
    }
  }, [treatments])

  // Filtrelenmiş liste
  const filtered = useMemo(() => {
    const q = trSearch(search)
    return treatments.filter(t => {
      if (filter === 'active' && t.status !== 'aktif') return false
      if (filter === 'quarantine' && t.status !== 'karantina') return false
      if (filter === 'healed' && t.status !== 'iyilesti') return false

      if (!q) return true
      const metin = [
        t.bird ? ringOf(t.bird) : '',
        t.bird?.name, t.illness, t.medicine, t.symptoms, t.notes
      ]
      return trSearch(metin.filter(Boolean).join(' ')).includes(q)
    })
  }, [treatments, filter, search])

  // Hızlı iyileşti işaretleme
  async function markHealed(t) {
    const bName = t.bird ? ringOf(t.bird) : 'Kuş'
    if (!window.confirm(`${bName} için "${t.illness}" hastalığı İYİLEŞTİ olarak kaydedilsin mi?`)) return
    try {
      await onUpsertTreatment({
        ...t,
        status: 'iyilesti',
        endDate: todayIso()
      })
      onNotify(`🎉 Geçmiş olsun! ${bName} iyileşti olarak kaydedildi.`)
    } catch (err) {
      onNotify('Güncelleme hatası: ' + (err.message || err), 'err')
    }
  }

  // Silme
  async function handleDelete(t) {
    const bName = t.bird ? ringOf(t.bird) : 'Kuş'
    if (!window.confirm(`${bName} için "${t.illness}" tedavi kaydı silinsin mi? Bu işlem geri alınamaz.`)) return
    try {
      await onRemoveTreatment(t.id)
      onNotify('Tedavi kaydı silindi.')
    } catch (err) {
      onNotify('Silme hatası: ' + (err.message || err), 'err')
    }
  }

  return (
    <div className="treatment-board-page">
      {/* ÜST BAŞLIK & YENİ GİRİŞ BUTONU */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2>{dispTr('📋 Sağlık & Tedavi Takip Panosu')}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {dispTr('Kümesteki hasta kuşlar, karantina takibi, uygulanan ilaçlar ve tedavi geçmişi')}
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setEditing({ status: 'aktif', startDate: todayIso() })}
          style={{ padding: '10px 18px', fontWeight: 700 }}
        >
          {dispTr('+ Yeni Hastalık / Tedavi Girişi')}
        </button>
      </div>

      {/* KPI SAYAÇLARI */}
      <div className="cards" style={{ marginBottom: 16 }}>
        <div className="stat" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="n" style={{ color: stats.active > 0 ? '#ef4444' : 'inherit' }}>
            {stats.active}
          </div>
          <div className="t">{dispTr('🚨 Aktif Tedavide')}</div>
        </div>
        <div className="stat" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="n" style={{ color: stats.quarantine > 0 ? '#f59e0b' : 'inherit' }}>
            {stats.quarantine}
          </div>
          <div className="t">{dispTr('🟡 Karantinada')}</div>
        </div>
        <div className="stat" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="n" style={{ color: stats.healed > 0 ? '#10b981' : 'inherit' }}>
            {stats.healed}
          </div>
          <div className="t">{dispTr('✅ İyileşen Kuş')}</div>
        </div>
        <div className="stat" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="n">{stats.total}</div>
          <div className="t">{dispTr('Toplam Kayıt')}</div>
        </div>
      </div>


      {/* FİLTRE VE ARAMA ÇUBUĞU */}
      <div className="toolbar treatment-toolbar" style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={dispTr('Kuş, künye, hastalık, ilaç veya belirti ara...')}
        />
        {/* 2+2 satır: ızgara ile tam eşit ve ortalı hizalı butonlar */}
        <div className="treatment-tabs">
          <button
            type="button"
            className={`btn small ${filter === 'active' ? 'primary' : ''}`}
            onClick={() => setFilter('active')}
          >
            {dispTr('🚨 Aktif Tedavide')} ({stats.active})
          </button>
          <button
            type="button"
            className={`btn small ${filter === 'quarantine' ? 'primary' : ''}`}
            onClick={() => setFilter('quarantine')}
          >
            {dispTr('🟡 Karantina')} ({stats.quarantine})
          </button>
          <button
            type="button"
            className={`btn small ${filter === 'healed' ? 'primary' : ''}`}
            onClick={() => setFilter('healed')}
          >
            {dispTr('✅ İyileşenler')} ({stats.healed})
          </button>
          <button
            type="button"
            className={`btn small ${filter === 'all' ? 'primary' : ''}`}
            onClick={() => setFilter('all')}
          >
            {dispTr('Tümü')} ({stats.total})
          </button>
        </div>
      </div>

      {/* PANO KARTLARI LİSTESİ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map(t => {
          const isActive = t.status === 'aktif'
          const isQuarantine = t.status === 'karantina'
          const isHealed = t.status === 'iyilesti'

          const borderColor = isActive
            ? 'rgba(239, 68, 68, 0.4)'
            : isQuarantine
            ? 'rgba(245, 158, 11, 0.4)'
            : 'rgba(16, 185, 129, 0.3)'

          const statusBg = isActive
            ? '#ef4444'
            : isQuarantine
            ? '#f59e0b'
            : '#10b981'

          return (
            <div
              key={t.id}
              className="panel"
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: 14,
                padding: '16px 18px',
                position: 'relative',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                transition: 'transform 0.15s ease',
                background: isActive
                  ? 'linear-gradient(180deg, var(--panel) 0%, rgba(239, 68, 68, 0.04) 100%)'
                  : 'var(--panel)'
              }}
            >
              {/* Pano Raptiyesi İkonu */}
              <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: statusBg,
                    color: '#fff',
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: 0.4
                  }}
                >
                  {dispTr(treatmentStatusLabel(t.status))}
                </span>
                <span style={{ fontSize: 16 }}>📌</span>
              </div>

              {/* ÜST SATIR: KUŞ BİLGİSİ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                {t.bird ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Ring text={ringOf(t.bird)} />
                      {t.bird.name && <strong style={{ fontSize: 15 }}>{dispTr(t.bird.name)}</strong>}
                      <span className={`tag ${t.bird.sex}`}>{dispTr(SEX[t.bird.sex] || '—')}</span>
                      <span className={`tag durum-${t.bird.status || 'damizlik'}`}>{dispTr(statusLabel(t.bird.status))}</span>
                    </div>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => onOpenBird(t.bird.id)}
                      style={{ padding: '4px 10px', fontSize: 11.5 }}
                    >
                      {dispTr('Kuş Profiline Git →')}
                    </button>
                  </>
                ) : (
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{dispTr('Kuş Kaydı Bulunamadı (Silinmiş)')}</span>
                )}
              </div>

              {/* ORTA KISIM: HASTALIK VE TEDAVİ DETAYI */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                  🩺 {dispTr(t.illness)}
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>
                  <div>
                    📅 <strong>{dispTr('Başlangıç:')}</strong> {fmtDate(t.startDate)}
                  </div>
                  {t.endDate && (
                    <div>
                      🏁 <strong>{dispTr('Bitiş:')}</strong> {fmtDate(t.endDate)}
                    </div>
                  )}
                  <div>
                    ⏱️ <strong>{dispTr('Süre:')}</strong> {t.days} {dispTr('Gün')} {isActive || isQuarantine ? dispTr('(Halen Tedavide)') : dispTr('Sürdü')}
                  </div>
                </div>

                {t.symptoms && (
                  <div style={{ fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{dispTr('🔍 Belirtiler:')} </span>
                    <span>{dispTr(t.symptoms)}</span>
                  </div>
                )}

                {t.medicine && (
                  <div style={{ fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--accent, #38bdf8)', fontWeight: 700 }}>{dispTr('💊 Uygulanan İlaç / Tedavi:')} </span>
                    <strong style={{ color: 'var(--text)' }}>{dispTr(t.medicine)}</strong>
                    {t.dosage && <span className="muted">{dispTr(' · Dozaj:')} {dispTr(t.dosage)}</span>}
                  </div>
                )}

                {t.notes && (
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic', background: 'var(--panel-2)', padding: '6px 10px', borderRadius: 6 }}>
                    {dispTr('📝 Not:')} {dispTr(t.notes)}
                  </div>
                )}
              </div>

              {/* ALT AKSİYON ÇUBUĞU */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 10, flexWrap: 'wrap' }}>
                {(isActive || isQuarantine) && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => markHealed(t)}
                    style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 700, background: '#10b981', borderColor: '#10b981' }}
                  >
                    {dispTr('✅ İyileşti Olarak Kaydet')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setEditing(t)}
                  style={{ padding: '6px 12px', fontSize: 12.5 }}
                >
                  {dispTr('✏️ Düzenle')}
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => handleDelete(t)}
                  style={{ padding: '6px 10px', fontSize: 12.5 }}
                >
                  {dispTr('Sil')}
                </button>
              </div>
            </div>
          )
        })}

        {!filtered.length && (
          <div className="panel" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>📋</span>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {search ? dispTr('Aramanıza uygun kayıt bulunamadı.') : dispTr('Henüz bu kategoride hastalık kaydı yok.')}
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {dispTr('Kuşların sağlık durumunu ve uygulanan ilaçları takip etmek için yukarıdaki "+ Yeni Hastalık / Tedavi Girişi" düğmesini kullanabilirsiniz.')}
            </p>
          </div>
        )}
      </div>

      {/* YENİ / DÜZENLE MODALI */}
      {editing && (
        <TreatmentModal
          treatment={editing}
          birds={db.birds || []}
          medications={db.medications || []}
          onSave={async (record) => {
            try {
              await onUpsertTreatment(record)
              setEditing(null)
              onNotify(record.id ? 'Tedavi kaydı güncellendi' : 'Yeni tedavi kaydı panoya eklendi')
            } catch (err) {
              onNotify('Kaydetme hatası: ' + (err.message || err), 'err')
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/**
 * Tedavi ekleme / düzenleme modalı
 */
export function TreatmentModal({ treatment, birds = [], medications = [], initialBirdId, onSave, onClose }) {
  const [birdId, setBirdId] = useState(treatment.birdId || initialBirdId || '')
  const [illness, setIllness] = useState(treatment.illness || '')
  const [status, setStatus] = useState(treatment.status || 'aktif')
  const [startDate, setStartDate] = useState(treatment.startDate || todayIso())
  const [endDate, setEndDate] = useState(treatment.endDate || '')
  const [symptoms, setSymptoms] = useState(treatment.symptoms || '')
  const [medicine, setMedicine] = useState(treatment.medicine || '')
  const [dosage, setDosage] = useState(treatment.dosage || '')
  const [notes, setNotes] = useState(treatment.notes || '')
  const [err, setErr] = useState('')

  const sortedBirds = useMemo(() => [...birds].sort(compareBirds), [birds])

  // Durum 'iyilesti' olunca bitiş tarihi yoksa bugünü doldur
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus)
    if (newStatus === 'iyilesti' && !endDate) {
      setEndDate(todayIso())
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!birdId) return setErr('Lütfen hasta kuşu seçin.')
    if (!illness.trim()) return setErr('Lütfen hastalık adını girin.')

    onSave({
      ...treatment,
      birdId,
      illness: illness.trim(),
      status,
      startDate: startDate || todayIso(),
      endDate: status === 'iyilesti' ? (endDate || todayIso()) : (endDate || null),
      symptoms: symptoms.trim(),
      medicine: medicine.trim(),
      dosage: dosage.trim(),
      notes: notes.trim()
    })
  }

  return (
    <div className="overlay" style={{ zIndex: 300 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-head">
          <h2>{treatment.id ? dispTr('Tedavi Kaydını Düzenle') : dispTr('Yeni Hastalık & Tedavi Girişi')}</h2>
          <button type="button" className="x" onClick={onClose}>×</button>
        </div>

        {err && <p className="hint" style={{ color: 'var(--danger)', marginBottom: 12 }}>{dispTr(err)}</p>}

        <form onSubmit={handleSubmit}>
          {/* 1. KUŞ SEÇİMİ */}
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 700 }}>{dispTr('Hasta Kuş *')}</label>
            <BirdPicker
              birds={sortedBirds}
              value={birdId}
              onChange={setBirdId}
              disabled={Boolean(initialBirdId && treatment.id)}
              title="Hasta Kuş Seç"
              placeholder={dispTr('KUŞ SEÇİN...')}
              clearLabel=""
            />
          </div>

          {/* 2. HASTALIK ADI VE HIZLI SEÇENEKLER */}
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 700 }}>{dispTr('Mevcut Hastalık *')}</label>
            <input
              value={illness}
              onChange={e => setIllness(trUpper(e.target.value))}
              placeholder={dispTr('Örn. SALLABAŞ (PMV), ÇİÇEK, KURUMA, İSHAL')}
              style={{ width: '100%', marginBottom: 8 }}
            />
            {/* Hızlı Seçim Rozetleri */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {COMMON_ILLNESSES.map(c => (
                <button
                  key={c}
                  type="button"
                  className="btn small"
                  onClick={() => setIllness(c)}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    background: illness === c ? 'var(--accent, #3b82f6)' : 'var(--panel-2)',
                    color: illness === c ? '#fff' : 'inherit'
                  }}
                >
                  {dispTr(c)}
                </button>
              ))}
            </div>
          </div>

          {/* 3. DURUM VE TARİHLER */}
          <div className="form-row-2" style={{ marginBottom: 14 }}>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700 }}>{dispTr('Durum')}</label>
              <select value={status} onChange={e => handleStatusChange(e.target.value)}>
                {TREATMENT_STATUS.map(s => (
                  <option key={s.value} value={s.value}>{dispTr(s.label)}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700 }}>{dispTr('Başlangıç Tarihi')}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>

          {status === 'iyilesti' && (
            <div className="field" style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 700 }}>{dispTr('İyileşme / Bitiş Tarihi')}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          )}

          {/* 4. BELİRTİLER */}
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 700 }}>{dispTr('Belirtiler')}</label>
            <input
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder={dispTr('Örn. Boyun bükme, yem yiyememe, yeşil sulu dışkı, tek gözde yaşarma')}
            />
          </div>

          {/* 5. KULLANILAN İLAÇ VE DOZAJ */}
          <div className="form-row-2" style={{ marginBottom: 14 }}>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700 }}>{dispTr('Kullanılan İlaç / Tedavi')}</label>
              <input
                value={medicine}
                onChange={e => setMedicine(e.target.value)}
                placeholder={dispTr('Örn. Baytril 10%, Ronidazole')}
              />
              {medications.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span className="hint" style={{ fontSize: 11 }}>{dispTr('Rehberden:')}</span>
                  {medications.slice(0, 5).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn small"
                      onClick={() => { setMedicine(m.name); if (m.dosage && !dosage) setDosage(m.dosage) }}
                      style={{ padding: '2px 6px', fontSize: 10.5 }}
                    >
                      {dispTr(m.name)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700 }}>{dispTr('Dozaj & Kullanım Şekli')}</label>
              <input
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                placeholder={dispTr('Örn. Günde 1 damla ağızdan / 5 gün')}
              />
            </div>
          </div>

          {/* 6. NOTLAR */}
          <div className="field" style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 700 }}>{dispTr('Gözlem Notları')}</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={dispTr('Örn. Kuş karantina kafesine alındı, B vitamini takviyesi verildi.')}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary">
              {treatment.id ? dispTr('Kaydet') : dispTr('Panoya Ekle')}
            </button>
            <button type="button" className="btn" onClick={onClose}>{dispTr('Vazgeç')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
