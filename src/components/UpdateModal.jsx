import { useState } from 'react'
import { dispTr } from '../lib.js'
import { applyUpdate, rememberAppliedUpdate } from '../updater.js'

export default function UpdateModal({ update, onClose }) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  // Güncelleme notları 2'den fazla madde içeriyorsa varsayılan olarak yalnızca
  // ilk 2 madde gösterilir; aşağı bakan ok ile kalan maddeler açılır.
  const [notesOpen, setNotesOpen] = useState(false)

  const handleUpdate = async () => {
    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      await applyUpdate(update, percent => {
        setProgress(Math.round(percent))
      })
      rememberAppliedUpdate(update.buildTime)
      // set() çağrısı başarılı olduğunda webview otomatik yenilenir.
    } catch (err) {
      console.error('Güncelleme uygulama hatası:', err)
      setError(err?.message || 'Güncelleme indirilirken bir hata oluştu.')
      setLoading(false)
    }
  }

  return (
    <div
      className="overlay"
      style={{ zIndex: 130 }}
      onMouseDown={e => {
        if (!loading && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ maxWidth: 480, padding: 0 }}>
        {/* Başlık */}
        <div
          className="modal-head"
          style={{
            padding: '16px 20px',
            background: 'var(--panel-2)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🚀</span>
            <div>
              <h2 style={{ margin: 0, padding: 0, fontSize: 16, fontWeight: 800 }}>
                {dispTr('YENİ GÜNCELLEME MEVCUT')}
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
                {dispTr(`Sürüm ${update.version} yayında`)}
              </p>
            </div>
          </div>
          {!loading && (
            <button type="button" className="x" onClick={onClose} aria-label="Kapat">
              ×
            </button>
          )}
        </div>

        {/* İçerik */}
        <div style={{ padding: '20px' }}>
          {/* Değişiklik Listesi */}
          <div
            style={{
              background: 'var(--panel-2)',
              borderRadius: 8,
              padding: '12px 16px',
              border: '1px solid var(--line)',
              marginBottom: 16
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8, color: 'var(--accent)' }}>
              {dispTr('✨ Bu Güncellemede Neler Var?')}
            </div>
            {update.changelog && update.changelog.length > 0 ? (
              <div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                  {(notesOpen || (update.changelog || []).length <= 2
                    ? (update.changelog || [])
                    : (update.changelog || []).slice(0, 2)
                  ).map((item, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{dispTr(item)}</li>
                  ))}
                </ul>
                {(update.changelog || []).length > 2 && (
                  <button
                    type="button"
                    onClick={() => setNotesOpen(o => !o)}
                    style={{
                      marginTop: 8,
                      padding: '4px 10px',
                      fontSize: 11.5,
                      borderRadius: 6,
                      border: '1px solid var(--line)',
                      background: 'var(--panel)',
                      color: 'var(--accent)',
                      cursor: 'pointer'
                    }}
                  >
                    {dispTr(notesOpen
                      ? 'Kısalt ▲'
                      : `Devamı (${update.changelog.length - 2} madde) ▼`)}
                  </button>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                {dispTr('Performans iyileştirmeleri ve hata düzeltmeleri içerir.')}
              </p>
            )}
          </div>

          {/* İndirme Durumu ve İlerleme Çubuğu */}
          {loading && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                {dispTr(progress < 100
                  ? `Güncelleme paketi indiriliyor... %${progress}`
                  : 'Yenilikler uygulanıyor, uygulama başlatılıyor...')}
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  background: 'var(--line)',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}

          {/* Hata Mesajı */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fee2e2',
                border: '1px solid #ef4444',
                color: '#991b1b',
                fontSize: 12.5,
                marginBottom: 16
              }}
            >
              ⚠️ {dispTr(error)}
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {!loading && (
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                {dispTr('Daha Sonra')}
              </button>
            )}
            <button
              type="button"
              className="btn primary"
              onClick={handleUpdate}
              disabled={loading}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700 }}
            >
              {dispTr(loading ? 'İndiriliyor...' : 'Şimdi Güncelle')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
