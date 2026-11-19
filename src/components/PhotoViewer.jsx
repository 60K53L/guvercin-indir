import { useCallback, useEffect, useState } from 'react'

/**
 * Fotoğraf görüntüleyici.
 *
 * Küçük görseller tıklanınca tam ekranda büyür; X, Esc veya arka plana
 * tıklayınca kapanır. Bir kuşun birden çok fotoğrafı varsa ok tuşlarıyla
 * fotoğraf değiştirilir.
 *
 * Tek bir bileşen uygulamanın her yerine asılır; açmak için `openPhoto`
 * çağrılır.
 */

// Bileşen ağacının dışından erişilebilen basit durum.
let openState = null
const watchers = new Set()

function setOpen(next) {
  openState = next
  for (const w of watchers) w(next)
}

/** Ekranı açan fonksiyon. Herhangi bir bileşenden çağrılabilir. */
export function openPhoto(names, index = 0) {
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean)
  if (!list.length) return
  setOpen({ names: list, index: Math.max(0, Math.min(index, list.length - 1)) })
}

export function closePhoto() {
  setOpen(null)
}

export function isPhotoOpen() {
  return !!openState
}

/** Küçük görsel yükleyen bileşen. */
export function PhotoImg({ name, onClick, small, alt = '' }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setSrc(null)
    setFailed(false)
    api.photoData(name).then(r => {
      if (!alive) return
      if (r.ok && r.data) setSrc(`data:${r.data.mime};base64,${r.data.base64}`)
      else setFailed(true)
    })
    return () => { alive = false }
  }, [name])

  const size = small ? 34 : '100%'

  if (failed) {
    return (
      <div className="photo-thumb" style={{ width: small ? 34 : '100%', height: small ? 34 : '100%' }}>
        <span className="muted">?</span>
      </div>
    )
  }

  if (!src) {
    return <div className="photo-thumb loading" style={{ width: small ? 34 : '100%', height: small ? 34 : '100%' }} />
  }

  const clickable = !!onClick
  return (
    <img
      src={src}
      alt={alt}
      className={clickable ? 'photo-thumb clickable' : 'photo-thumb'}
      style={{ width: size, height: small ? 34 : '100%', objectFit: 'cover', display: 'block', borderRadius: small ? 8 : 0 }}
      onClick={clickable ? onClick : undefined}
    />
  )
}

/** Tam ekran katmanı. Uygulamanın kökünde bir kez asılır. */
export default function PhotoViewer() {
  const [state, setState] = useState(openState)

  useEffect(() => {
    watchers.add(setState)
    return () => { watchers.delete(setState) }
  }, [])

  const move = useCallback((delta) => {
    if (!openState) return
    const n = openState.names.length
    setOpen({ ...openState, index: (openState.index + delta + n) % n })
  }, [])

  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') closePhoto()
      else if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    // Kaydırmayı kilitle
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [state, move])

  if (!state) return null

  const { names, index } = state
  const many = names.length > 1

  return (
    <div className="viewer" onMouseDown={e => e.target === e.currentTarget && closePhoto()}>
      <button className="viewer-close" onClick={closePhoto} title="Kapat (Esc)">×</button>

      <div className="viewer-stage">
        <PhotoImg name={names[index]} />
      </div>

      {many && (
        <>
          <button className="viewer-nav left" onClick={() => move(-1)} title="Önceki (←)">‹</button>
          <button className="viewer-nav right" onClick={() => move(1)} title="Sonraki (→)">›</button>
          <div className="viewer-count">{index + 1} / {names.length}</div>
        </>
      )}
    </div>
  )
}