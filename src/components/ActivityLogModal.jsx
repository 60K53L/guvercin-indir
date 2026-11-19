import { useState, useMemo } from 'react'
import { trSearch, trUpper, dispTr } from '../lib.js'

function formatDateTime(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString.slice(0, 10)
    const day = String(d.getDate()).padStart(2, '0')
    const mon = String(d.getMonth() + 1).padStart(2, '0')
    const yr = d.getFullYear()
    const hr = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${day}.${mon}.${yr} ${hr}:${min}`
  } catch {
    return isoString.slice(0, 10)
  }
}

export default function ActivityLogModal({ activities, onOpenBird, onClose, onClear }) {
  const [filter, setFilter] = useState('all') // 'all' | 'birds' | 'clutch' | 'pair' | 'med'
  const [search, setSearch] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const counts = useMemo(() => {
    return {
      all: activities.length,
      birds: activities.filter(a => a.type.startsWith('bird')).length,
      clutch: activities.filter(a => a.type.startsWith('clutch') || a.type.startsWith('egg')).length,
      pair: activities.filter(a => a.type.startsWith('pair')).length,
      med: activities.filter(a => a.type.startsWith('med') || a.type.startsWith('vac')).length,
    }
  }, [activities])

  const filtered = useMemo(() => {
    let list = activities
    if (filter === 'birds') {
      list = list.filter(a => a.type.startsWith('bird'))
    } else if (filter === 'clutch') {
      list = list.filter(a => a.type.startsWith('clutch') || a.type.startsWith('egg'))
    } else if (filter === 'pair') {
      list = list.filter(a => a.type.startsWith('pair'))
    } else if (filter === 'med') {
      list = list.filter(a => a.type.startsWith('med') || a.type.startsWith('vac'))
    }

    const q = trSearch(search)
    if (q) {
      list = list.filter(a =>
        trSearch(a.title || '').includes(q) ||
        trSearch(a.detail || '').includes(q) ||
        trSearch(a.time || '').includes(q)
      )
    }
    return list
  }, [activities, filter, search])

  return (
    <div className="overlay" style={{ zIndex: 110 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '18px 22px 16px' }}>
        <div className="modal-head" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          minHeight: 44,
          padding: '0 4px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, paddingRight: 12, textAlign: 'left' }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>📋</span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, padding: 0, textAlign: 'left', lineHeight: 1.25 }}>{dispTr('İŞLEM GEÇMİŞİ & LOG KAYITLARI')}</h2>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{dispTr('Son eklenen kuşlar, yumurta hareketleri ve işlemler')}</div>
            </div>
          </div>
          <button
            type="button"
            className="x"
            onClick={onClose}
            style={{
              position: 'static',
              transform: 'none',
              flexShrink: 0,
              margin: 0,
              width: 36,
              height: 36
            }}
            title="Kapat"
          >×</button>
        </div>

        {/* Filtre ve Arama Alanı */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
            <button
              type="button"
              className={`btn small ${filter === 'all' ? 'primary' : ''}`}
              onClick={() => setFilter('all')}
            >
              {dispTr(`TÜMÜ (${counts.all})`)}
            </button>
            <button
              type="button"
              className={`btn small ${filter === 'birds' ? 'primary' : ''}`}
              onClick={() => setFilter('birds')}
            >
              {dispTr(`🕊️ KUŞLAR (${counts.birds})`)}
            </button>
            <button
              type="button"
              className={`btn small ${filter === 'clutch' ? 'primary' : ''}`}
              onClick={() => setFilter('clutch')}
            >
              {dispTr(`🥚 YUMURTA & KULUÇKA (${counts.clutch})`)}
            </button>
            <button
              type="button"
              className={`btn small ${filter === 'pair' ? 'primary' : ''}`}
              onClick={() => setFilter('pair')}
            >
              {dispTr(`❤️ EŞLER (${counts.pair})`)}
            </button>
            <button
              type="button"
              className={`btn small ${filter === 'med' ? 'primary' : ''}`}
              onClick={() => setFilter('med')}
            >
              {dispTr(`💊 İLAÇ & AŞI (${counts.med})`)}
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={dispTr('Loglarda ara (künye, ilaç, yumurta, tarih)...')}
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>

        {/* Kayıt Listesi */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div>{dispTr('Aradığınız kriterlere uygun işlem kaydı bulunamadı.')}</div>
            </div>
          )}

          {filtered.map(act => (
            <div
              key={act.id}
              className="panel"
              style={{
                margin: 0,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--panel-2)'
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: 'var(--panel)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0
                }}
              >
                {act.icon || '📋'}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  {dispTr(act.title)}
                </div>
                {act.detail && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {dispTr(act.detail)}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🕒 {formatDateTime(act.time)}</span>
                </div>
              </div>

              {act.birdId && onOpenBird && (
                <button
                  type="button"
                  className="btn small"
                  style={{ flexShrink: 0, fontSize: 12 }}
                  onClick={() => {
                    onClose()
                    onOpenBird(act.birdId)
                  }}
                  title="Kuş sayfasına git"
                >
                  {dispTr('GİT ›')}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Alt Butonlar & Güvenlikli Temizleme */}
        <div style={{
          marginTop: 14,
          paddingTop: 12,
          paddingBottom: 4,
          paddingLeft: 4,
          paddingRight: 4,
          borderTop: '1px solid var(--line)',
          flexShrink: 0
        }}>
          {!showDeleteConfirm ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {activities.length > 0 ? (
                <button
                  type="button"
                  className="btn"
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    padding: '6px 12px',
                    background: 'var(--panel-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                  onClick={() => { setShowDeleteConfirm(true); setConfirmText('') }}
                >
                  {dispTr('⚙️ Geçmişi Temizleme Seçenekleri...')}
                </button>
              ) : <div />}
              <button
                type="button"
                className="btn primary"
                onClick={onClose}
                style={{
                  minWidth: 120,
                  padding: '9px 24px',
                  borderRadius: 8,
                  fontWeight: 700,
                  marginLeft: 'auto'
                }}
              >
                {dispTr('Kapat')}
              </button>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 10,
                padding: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                <span>🛡️</span>
                <span>{dispTr('İŞLEM GEÇMİŞİNİ TEMİZLEME GÜVENLİK ONAYI')}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6, lineHeight: 1.45 }}>
                {dispTr('Bu işlem yalnızca bu ekranda listelenen ')}<strong>{dispTr(`${activities.length} adet geçmiş hareket metnini`)}</strong>{dispTr(' temizler.')}
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, color: '#10b981', fontWeight: 600 }}>
                  {dispTr('✅ Kuşlarınız, soy ağacı, yumurtalar ve tedaviler KESİNLİKLE SİLİNMEZ. Sadece bu bilgilendirme yazıları sıfırlanır.')}
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {dispTr('Yanlışlıkla silinmeyi önlemek için kutuya büyük harfle ')}<strong>{dispTr('SİL')}</strong>{dispTr(' yazın:')}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(trUpper(e.target.value))}
                    placeholder={dispTr('SİL')}
                    style={{ width: 100, padding: '6px 10px', fontSize: 13, fontWeight: 700, letterSpacing: 1, textAlign: 'center' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn small danger"
                    disabled={!['SİL', 'SIL'].includes(confirmText.trim())}
                    style={{
                      opacity: ['SİL', 'SIL'].includes(confirmText.trim()) ? 1 : 0.4,
                      cursor: ['SİL', 'SIL'].includes(confirmText.trim()) ? 'pointer' : 'not-allowed'
                    }}
                    onClick={() => {
                      if (['SİL', 'SIL'].includes(confirmText.trim())) {
                        onClear()
                        setShowDeleteConfirm(false)
                        setConfirmText('')
                      }
                    }}
                  >
                    {dispTr('Sadece Log Yazılarını Sil')}
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => { setShowDeleteConfirm(false); setConfirmText('') }}
                  >
                    {dispTr('Vazgeç')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
