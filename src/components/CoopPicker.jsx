import { useState } from 'react'
import { ALL_COOPS, COOP_COLORS } from '../coops.js'
import { dispTr } from '../lib.js'

/**
 * Aktif kümes seçici.
 *
 * Tüm ekranların üstünde durur; seçim yapılınca App yalnızca o kümesin
 * görünümünü besler. "Tümü" bilinçli bir seçimdir, varsayılan değildir.
 */
export default function CoopPicker({ coops = [], value = '', counts = {}, onChange, onManage }) {
  const [open, setOpen] = useState(false)
  const active = coops.find(c => c.id === value)

  const choose = (id) => {
    onChange?.(id)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="coop-picker-btn"
        onClick={() => setOpen(true)}
        title="Aktif kümesi değiştir"
      >
        <span
          className="coop-dot"
          style={{ background: active?.color || 'var(--muted)' }}
        />
        <span className="coop-picker-label">
          {active ? dispTr(active.name) : dispTr('TÜM KÜMESLER')}
        </span>
        <span className="coop-picker-arrow">▾</span>
      </button>

      {open && (
        <div
          className="overlay"
          style={{ zIndex: 80 }}
          onMouseDown={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal" style={{ maxWidth: 430 }}>
            <div className="modal-head">
              <h2>{dispTr('KÜMES SEÇ')}</h2>
              <button className="x" onClick={() => setOpen(false)}>×</button>
            </div>

            <p className="hint" style={{ marginTop: 0 }}>
              {dispTr('Seçilen kümesin kuşları ve kayıtları gösterilir. Diğer kümesler arka planda kalır.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CoopOption
                name={dispTr('TÜM KÜMESLER')}
                subtitle={dispTr('Bütün kuşları ve kayıtları göster')}
                color="var(--muted)"
                active={!value}
                count={counts[ALL_COOPS]}
                onClick={() => choose(ALL_COOPS)}
              />
              {coops.map(coop => (
                <CoopOption
                  key={coop.id}
                  name={dispTr(coop.name)}
                  subtitle={`${counts[coop.id] ?? 0} ${dispTr('kuş')}`}
                  color={coop.color || COOP_COLORS[0]}
                  active={value === coop.id}
                  onClick={() => choose(coop.id)}
                />
              ))}
            </div>

            <div className="form-actions" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {onManage && (
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  onClick={() => { setOpen(false); onManage() }}
                >
                  {dispTr('Kümesleri Yönet')}
                </button>
              )}
              <button
                type="button"
                className="btn"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={() => setOpen(false)}
              >
                {dispTr('Vazgeç (ESC)')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CoopOption({ name, subtitle, color, active, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        border: `2px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'var(--accent-wash)' : 'var(--panel-2)',
        color: 'var(--text)',
        textAlign: 'left',
        cursor: 'pointer',
        justifyContent: 'center'
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: color,
          flex: '0 0 auto',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.08)'
        }}
      />
      <span style={{ minWidth: 0, flex: 1, textAlign: 'center' }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{name}</span>
        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11.5, marginTop: 2 }}>
          {subtitle}
        </span>
      </span>
      {typeof count === 'number' && (
        <span className="tag" style={{ flex: '0 0 auto', minWidth: 42, justifyContent: 'center' }}>
          {count}
        </span>
      )}
      {active && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', right: 14, color: 'var(--accent)', fontWeight: 900 }}
        >
          ✓
        </span>
      )}
    </button>
  )
}
