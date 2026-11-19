import { useEffect, useMemo, useState } from 'react'
import { COOP_COLORS, normalizeCoops, nextCoopColor, nextCoopName, resolveBirdCoopId } from '../coops.js'
import { dispTr, trUpper, uid } from '../lib.js'

/**
 * Ayarlar → Kümesler kartı.
 *
 * Burada yalnızca kümes tanımları yönetilir. Kuş ataması kuş formundan
 * yapılır; silinen kümesin kuşları hedef kümese taşınır (veri kaybı yok).
 */
export default function CoopsSettings({
  db, activeCoopId, onSaveSettings, onNotify, onMoveBirdsToCoop, onDeleteCoop
}) {
  const source = useMemo(
    () => normalizeCoops(db.settings?.coops, db.settings?.loftName),
    [db.settings?.coops, db.settings?.loftName]
  )
  const [draft, setDraft] = useState(source)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Dışarıdan (başka cihazdan) gelen değişiklikleri yansıt. Kullanıcı
  // yazarken `db.settings.coops` değişmediği için taslak bozulmaz.
  const sourceKey = source.map(c => `${c.id}:${c.name}:${c.color}:${c.order}`).join('|')
  useEffect(() => {
    setDraft(source)
  }, [sourceKey])

  const birds = db.birds || []

  const counts = useMemo(() => {
    const map = {}
    for (const coop of draft) map[coop.id] = 0
    for (const bird of birds) {
      const id = resolveBirdCoopId(bird, draft)
      map[id] = (map[id] || 0) + 1
    }
    return map
  }, [birds, draft])

  const save = async (next, message) => {
    const clean = normalizeCoops(next, db.settings?.loftName)
    setDraft(clean)
    await onSaveSettings({ ...db.settings, coops: clean })
    if (message) onNotify?.(message)
  }

  const addCoop = async () => {
    if (busy) return
    setBusy(true)
    const coop = {
      id: 'coop_' + uid(),
      name: nextCoopName(draft),
      color: nextCoopColor(draft),
      order: draft.length,
      createdAt: new Date().toISOString()
    }
    await save([...draft, coop], `${coop.name} eklendi`)
    setBusy(false)
  }

  const rename = (id, value) => {
    setDraft(draft.map(c => (c.id === id ? { ...c, name: trUpper(value) } : c)))
  }

  const commitRename = async (id) => {
    const target = draft.find(c => c.id === id)
    if (!target) return
    const cleanName = trUpper(String(target.name || '').trim()).trim()
    if (!cleanName) {
      setDraft(source)
      onNotify?.('Kümes adı boş olamaz', 'err')
      return
    }
    await save(draft, 'Kümes adı güncellendi')
  }

  const setColor = async (id, color) => {
    await save(draft.map(c => (c.id === id ? { ...c, color } : c)))
  }

  const move = async (index, delta) => {
    const next = [...draft]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    await save(next.map((c, i) => ({ ...c, order: i })))
  }

  const askDelete = (coop) => {
    if (draft.length <= 1) {
      onNotify?.('Son kümes silinemez. Önce yeni bir kümes ekleyin.', 'err')
      return
    }
    const target = draft.find(c => c.id !== coop.id)
    setDeleteTarget({ coop, target })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { coop, target } = deleteTarget
    const ids = birds
      .filter(b => resolveBirdCoopId(b, draft) === coop.id)
      .map(b => b.id)
    setBusy(true)
    try {
      if (ids.length && onMoveBirdsToCoop) {
        await onMoveBirdsToCoop(ids, target.id)
      }
      if (onDeleteCoop) {
        await onDeleteCoop(coop.id, target.id)
      } else {
        await save(
          draft.filter(c => c.id !== coop.id).map((c, i) => ({ ...c, order: i })),
          `${coop.name} silindi`
        )
      }
      onNotify?.(`${coop.name} silindi${ids.length ? ` · ${ids.length} kuş ${target.name} kümesine taşındı` : ''}`)
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="hint" style={{ marginTop: 0 }}>
        {dispTr('Her kuş tek bir kümese aittir. Kümes seçiliyken yalnızca o kümesin kuşları ve kayıtları gösterilir; diğer kümesler arka planda kalır.')}
      </p>

      {draft.map((coop, index) => {
        const isActive = coop.id === activeCoopId
        return (
          <div
            key={coop.id}
            style={{
              border: `2px solid ${isActive ? 'var(--accent)' : 'var(--line)'}`,
              background: isActive ? 'var(--accent-wash)' : 'var(--panel-2)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: coop.color, flex: '0 0 auto' }} />
              <input
                type="text"
                value={coop.name}
                onChange={e => rename(coop.id, e.target.value)}
                onBlur={() => commitRename(coop.id)}
                aria-label="Kümes adı"
                style={{ flex: '1 1 140px', minWidth: 0, fontWeight: 800 }}
              />
              <span className="tag" style={{ flex: '0 0 auto' }}>
                {counts[coop.id] || 0} {dispTr('kuş')}
              </span>
              {isActive && (
                <span className="tag primary" style={{ flex: '0 0 auto', fontWeight: 800 }}>
                  {dispTr('AKTİF')}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 11.5, marginRight: 2 }}>{dispTr('RENK')}</span>
              {COOP_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Renk ${color}`}
                  onClick={() => setColor(coop.id, color)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: color,
                    border: coop.color === color ? '3px solid var(--text)' : '2px solid var(--line)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                />
              ))}
              <div className="spacer" />
              <button
                type="button"
                className="btn small"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                title="Yukarı taşı"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => move(index, 1)}
                disabled={index === draft.length - 1}
                title="Aşağı taşı"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn small danger"
                onClick={() => askDelete(coop)}
                disabled={draft.length <= 1}
              >
                {dispTr('Sil')}
              </button>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        className="btn primary"
        onClick={addCoop}
        disabled={busy}
        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        {dispTr('+ Yeni Kümes Ekle')}
      </button>

      {deleteTarget && (
        <div
          className="overlay"
          style={{ zIndex: 90 }}
          onMouseDown={e => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h2>{dispTr('KÜMES SİLİNSİN Mİ?')}</h2>
              <button className="x" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              <b>{dispTr(deleteTarget.coop.name)}</b> {dispTr('kümesi silinecek.')}
              {' '}
              {counts[deleteTarget.coop.id] || 0} {dispTr('kuş')} <b>{dispTr(deleteTarget.target.name)}</b> {dispTr('kümesine taşınacak. Kuş kaydı silinmez.')}
            </p>
            <div className="form-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={() => setDeleteTarget(null)}
              >
                {dispTr('Vazgeç (ESC)')}
              </button>
              <button
                type="button"
                className="btn danger"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={confirmDelete}
                disabled={busy}
              >
                {dispTr('Sil ve Taşı')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
