import { ringOf, dispTr } from '../lib.js'

/**
 * MODÜLER KÜMES MEVCUDİYET / BONCUK KONTROL MODÜLÜ
 *
 * Bu özellik kuşların ayaklarındaki boncukları tek tek kontrol edip
 * kümeste hala mevcut olup olmadığını tespit etmek içindir.
 * İleride tüm kontroller tamamlandığında tek hamlede kaldırmak için
 * aşağıdaki ENABLE_LOFT_CHECK değerini false yapmanız veya bu dosyayı
 * devre dışı bırakmanız yeterlidir.
 */
export const ENABLE_LOFT_CHECK = true

function fmtDateTime(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    const gun = String(d.getDate()).padStart(2, '0')
    const ay = String(d.getMonth() + 1).padStart(2, '0')
    const yil = d.getFullYear()
    const saat = String(d.getHours()).padStart(2, '0')
    const dk = String(d.getMinutes()).padStart(2, '0')
    return `${gun}.${ay}.${yil} ${saat}:${dk}`
  } catch {
    return isoString
  }
}

export default function LoftCheck({ bird, onUpsert, onNotify }) {
  if (!ENABLE_LOFT_CHECK || !bird) return null

  const isChecked = Boolean(bird.checkedAt)

  const handleMarkPresent = async () => {
    if (!window.confirm('KUŞ HALA MEVCUT MU?')) return
    const nowIso = new Date().toISOString()
    const updated = { ...bird, checkedAt: nowIso }
    try {
      await onUpsert(updated)
      if (onNotify) {
        onNotify(`✓ ${ringOf(bird)} mevcudiyeti onaylandı (${fmtDateTime(nowIso)})`)
      }
    } catch (err) {
      if (onNotify) onNotify('Hata: ' + (err.message || err), 'err')
    }
  }

  const handleResetCheck = async () => {
    if (!window.confirm(`${ringOf(bird)} kontrol durumunu sıfırlamak istediğinize emin misiniz?`)) return
    const updated = { ...bird, checkedAt: null }
    try {
      await onUpsert(updated)
      if (onNotify) {
        onNotify(`Kontrol kaydı sıfırlandı: ${ringOf(bird)}`)
      }
    } catch (err) {
      if (onNotify) onNotify('Hata: ' + (err.message || err), 'err')
    }
  }

  return (
    <div className="panel" style={{ padding: '20px 18px', maxWidth: 680, margin: '0 auto 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>🔍</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {dispTr('KÜMES BONCUK & MEVCUDİYET KONTROLÜ')}
            </h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {dispTr('Ayağındaki boncuk/klips kontrolü ve kuşun kümesteki varlık teyidi')}
            </div>
          </div>
        </div>

        {isChecked ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: '6px 12px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 12.5,
              letterSpacing: 0.5
            }}
          >
            <span>🟢</span>
            <span>{dispTr('KONTROL EDİLDİ')}</span>
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              padding: '6px 12px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 12.5,
              letterSpacing: 0.5
            }}
          >
            <span>🔴</span>
            <span>{dispTr('KONTROL EDİLMEDİ')}</span>
          </span>
        )}
      </div>

      {isChecked ? (
        <div
          style={{
            background: 'var(--panel-2)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 700, fontSize: 14 }}>
            <span>✅</span>
            <span>{dispTr('Kuş Kümeste Mevcut Olarak Kaydedildi')}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted">{dispTr('Son Kontrol Tarihi & Saati:')}</span>
            <strong style={{ color: 'var(--accent, #38bdf8)' }}>{fmtDateTime(bird.checkedAt)}</strong>
          </div>
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {dispTr('Bu güvercinin ayak boncukları incelenmiş ve kümesteki mevcudiyeti doğrulanmıştır. Dilerseniz mevcudiyet tarihini yeniden güncelleyebilirsiniz.')}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--panel-2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 700, fontSize: 14 }}>
            <span>⚠️</span>
            <span>{dispTr('Bu Kuş İçin Henüz Kontrol Yapılmadı')}</span>
          </div>
          <p className="hint" style={{ marginTop: 8, marginBottom: 0, color: 'var(--muted)' }}>
            {dispTr('Kümesteki kuşların ayak boncuklarını kontrol ederken bu kuşu gördüğünüzde aşağıdaki "KUŞ HALA MEVCUT" butonuna basarak tarih ve saatiyle birlikte mevcudiyetini onaylayın.')}
          </p>
        </div>
      )}

      {/* İŞLEM BUTONLARI */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn primary"
          onClick={handleMarkPresent}
          style={{
            flex: '1 1 200px',
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: 0.5
          }}
        >
          <span>🔍</span>
          <span>{dispTr('KUŞ HALA MEVCUT')}</span>
        </button>

        {isChecked && (
          <button
            type="button"
            className="btn small"
            onClick={handleResetCheck}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--muted)',
              background: 'transparent',
              border: '1px solid var(--line)'
            }}
          >
            {dispTr('Kontrolü Sıfırla')}
          </button>
        )}
      </div>
    </div>
  )
}
