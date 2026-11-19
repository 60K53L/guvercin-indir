import { useState, useEffect } from 'react'
import { dispTr } from '../lib.js'
import { getCurrentVersionInfo, checkForUpdate } from '../updater.js'
import { CHANGELOG, CHANGELOG_DATES } from '../version.js'

export default function VersionHistoryModal({ onClose, onOpenUpdate, onNotify }) {
  const [versionInfo, setVersionInfo] = useState(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [openVersions, setOpenVersions] = useState({})

  useEffect(() => {
    getCurrentVersionInfo().then(setVersionInfo).catch(() => {})
  }, [])

  const handleCheckUpdate = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await checkForUpdate()
      setChecking(false)
      if (res.hasUpdate && res.update) {
        setCheckResult({ ok: true, text: `Yeni sürüm bulundu: v${res.update.version}` })
        if (typeof onOpenUpdate === 'function') {
          onClose()
          onOpenUpdate(res.update)
        }
      } else if (res.error) {
        setCheckResult({ ok: false, text: `Güncelleme kontrolü: ${res.error}` })
        if (onNotify) onNotify(`Güncelleme denetlenemedi: ${res.error}`, 'err')
      } else {
        setCheckResult({ ok: true, text: 'Uygulamanız en son güncel sürümde!' })
        if (onNotify) onNotify('Tebrikler! Uygulamanız en son güncel sürümde.')
      }
    } catch (err) {
      setChecking(false)
      setCheckResult({ ok: false, text: err.message })
      if (onNotify) onNotify(`Güncelleme denetimi başarısız: ${err.message}`, 'err')
    }
  }

  const versionEntries = [
    ...Object.keys(CHANGELOG).map(v => ({ version: v, tag: null, date: CHANGELOG_DATES[v], items: CHANGELOG[v] || [] })),
    {
      version: '0.9.8', tag: ' (Beta)', date: '14 Ekim 2026', items: [
        'Kuluçka & Yumurta Takibi: Çatlama ve çıkım geri sayımları, yerel bildirimler.',
        'Say & Posta Kümes Modları: Kümes türüne özel çalışma modları ve arayüzler.',
        'Telegram Bildirim Botu: Yumurta çıkımları ve kuluçka özetini otomatik Telegram\'a iletme.',
        'Çift Renk Klips & Kontrast Motoru: 34 renkli boncuk rozetleri ve okunabilir kontrast optimizasyonu.'
      ]
    },
    {
      version: '0.9.0', tag: ' (İlk Sürüm)', date: null, items: [
        'Kuş soy ağacı, eşleştirmeler ve fotoğraf albümü.',
        'JSON dosya yedekleme ve Firebase bulut senkronizasyonu.'
      ]
    }
  ].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))

  return (
    <div className="overlay" style={{ zIndex: 120 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, padding: 0 }}>
        <div className="modal-head" style={{ padding: '16px 20px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🕊️</span>
            <div>
              <h2 style={{ margin: 0, padding: 0, fontSize: 16, fontWeight: 800 }}>{dispTr('GÜVERCİN SOY TAKİP')}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>{dispTr('Sürüm Bilgisi ve Geliştirme Geçmişi')}</p>
            </div>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <div style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--panel-2)', border: '1.5px solid var(--accent)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <span className="tag primary" style={{ fontSize: 11, fontWeight: 800 }}>{dispTr('MEVCUT SÜRÜM')}</span>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: 'var(--text)' }}>{dispTr(`v${versionInfo?.version || '1.0.0'}`)}</div>
              </div>
              <span className="tag" style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}>{dispTr('● Canlı OTA Aktif')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
              <div>📅 <b>{dispTr('Derleme:')}</b> {versionInfo?.buildTime || '20261015-1311'}</div>
              <div>📱 <b>{dispTr('Platform:')}</b> {dispTr(versionInfo?.isNative ? 'Android (Capacitor Yerel)' : 'Web / Tarayıcı')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn primary" disabled={checking} onClick={handleCheckUpdate} style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 700 }}>
                {dispTr(checking ? 'Denetleniyor...' : '🔄 Güncellemeleri Denetle')}
              </button>
              {checkResult && (
                <span style={{ fontSize: 12, color: checkResult.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {checkResult.ok ? '✓ ' : '⚠️ '}{dispTr(checkResult.text)}
                </span>
              )}
            </div>
          </div>

          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>{dispTr('📜 SÜRÜM GEÇMİŞİ & YENİLİKLER')}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {versionEntries.map((entry, i) => {
              const isLatest = i === 0
              const isOpen = openVersions[entry.version] !== undefined ? openVersions[entry.version] : (i === 0)
              return (
                <div key={entry.version} style={{ background: 'var(--panel-2)', border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color .15s' }}>
                  <button type="button" onClick={() => setOpenVersions(s => ({ ...s, [entry.version]: !isOpen }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-block', width: 14, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: isLatest ? 'var(--accent)' : 'var(--text)' }}>{dispTr(`v${entry.version}${entry.tag || (isLatest ? ' (Son Sürüm)' : '')}`)}</span>
                    {entry.date && <span className="muted" style={{ fontSize: 11 }}>{dispTr(entry.date)}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{dispTr(`${entry.items.length} madde ${isOpen ? '▲' : '▼'}`)}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 14px 12px 40px' }}>
                      <ul style={{ margin: 0, paddingLeft: 0, fontSize: 12.5, lineHeight: 1.55, color: isLatest ? 'var(--text)' : 'var(--muted)', listStyle: 'none' }}>
                        {entry.items.map((item, idx) => (
                          <li key={idx} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                            <span style={{ color: 'var(--accent)', flex: '0 0 auto' }}>•</span>
                            <span>{dispTr(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '12px 20px', background: 'var(--panel-2)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose} style={{ padding: '6px 18px', fontSize: 13 }}>{dispTr('Kapat')}</button>
        </div>
      </div>
    </div>
  )
}
