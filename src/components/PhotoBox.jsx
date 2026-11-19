import { useState } from 'react'
import { PhotoImg, openPhoto } from './PhotoViewer.jsx'
import { dispTr } from '../lib.js'

export function PhotoBox({ bird, onAdd, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false)
  const list = bird.photos || []

  const handlePick = (source) => {
    setModalOpen(false)
    onAdd(source)
  }

  const handleDelete = (n) => {
    if (window.confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) {
      onDelete(n)
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <span className="muted">{list.length} {dispTr('fotoğraf')}</span>
        <div className="spacer" />
        <button type="button" className="btn small" onClick={() => setModalOpen(true)}>{dispTr('+ Fotoğraf Ekle')}</button>
      </div>
      <div className="photos">
        {list.map(n => (
          <div key={n} className="photo">
            <PhotoImg name={n} onClick={() => openPhoto(list, list.indexOf(n))} />
            <button type="button" className="del" title="Sil" onClick={() => handleDelete(n)}>×</button>
          </div>
        ))}
        {!list.length && <p className="hint">{dispTr('Henüz fotoğraf yok.')}</p>}
      </div>

      {modalOpen && (
        <div
          className="overlay center"
          style={{ zIndex: 320 }}
          onMouseDown={e => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="modal" style={{ maxWidth: 330, padding: '16px 18px' }}>
            <div className="modal-head" style={{ marginBottom: 14, minHeight: 36 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{dispTr('Fotoğraf Ekle')}</h3>
              <button type="button" className="x" onClick={() => setModalOpen(false)} style={{ position: 'static', transform: 'none', marginLeft: 'auto' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 10px' }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => handlePick('camera')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 14px', fontSize: 14.5 }}
              >
                <span style={{ fontSize: 18 }}>📷</span>
                <span>{dispTr('Kamerayla Çek')}</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handlePick('photos')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 14px', fontSize: 14.5 }}
              >
                <span style={{ fontSize: 18 }}>🖼️</span>
                <span>{dispTr('Galeriden Seç')}</span>
              </button>
            </div>
            <div className="form-actions" style={{ marginTop: 8, padding: '10px 0 0', borderTop: '1px solid var(--line)', justifyContent: 'center' }}>
              <button type="button" className="btn small" onClick={() => setModalOpen(false)}>{dispTr('Vazgeç')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}