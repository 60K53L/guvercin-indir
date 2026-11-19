import { useMemo } from 'react'
import { ringOf, byId, fmtDate, statusLabel, externalParentText } from '../lib.js'
import Ring from './Ring.jsx'
import { PhotoImg } from './PhotoViewer.jsx'

export default function PostaPedigreeModal({ bird, db, coopName, onClose, onOpenBird }) {
  const birds = db.birds || []
  const loftMode = db.settings?.loftMode || 'saya'
  const isPosta = loftMode === 'posta'
  const defaultLoft = isPosta ? 'YARIŞ & DAMIZLIK KÜMESİ' : 'SAYA & DAMIZLIK KÜMESİ'
  const loftName = coopName || db.settings?.loftName || (db.settings?.owner ? `${db.settings.owner} KÜMESİ` : defaultLoft)
  const ownerName = db.settings?.owner || 'KÜMES YÖNETİCİSİ'

  // Kuşaklar (4 Nesil Soy Ağacı)
  // Gen 1: Ebeveynler
  const sire = useMemo(() => byId(birds, bird.sireId), [birds, bird.sireId])
  const dam = useMemo(() => byId(birds, bird.damId), [birds, bird.damId])

  // Gen 2: Dedeler & Nineler
  const ss = useMemo(() => byId(birds, sire?.sireId), [birds, sire?.sireId])
  const sd = useMemo(() => byId(birds, sire?.damId), [birds, sire?.damId])
  const ds = useMemo(() => byId(birds, dam?.sireId), [birds, dam?.sireId])
  const dd = useMemo(() => byId(birds, dam?.damId), [birds, dam?.damId])

  // Gen 3: Büyük Dedeler & Nineler
  const sss = useMemo(() => byId(birds, ss?.sireId), [birds, ss?.sireId])
  const ssd = useMemo(() => byId(birds, ss?.damId), [birds, ss?.damId])
  const sds = useMemo(() => byId(birds, sd?.sireId), [birds, sd?.sireId])
  const sdd = useMemo(() => byId(birds, sd?.damId), [birds, sd?.damId])
  const dss = useMemo(() => byId(birds, ds?.sireId), [birds, ds?.sireId])
  const dsd = useMemo(() => byId(birds, ds?.damId), [birds, ds?.damId])
  const dds = useMemo(() => byId(birds, dd?.sireId), [birds, dd?.sireId])
  const ddd = useMemo(() => byId(birds, dd?.damId), [birds, dd?.damId])

  const handlePrint = () => {
    window.print()
  }

  const renderCell = (b, role, isFemale = false, externalText = '') => {
    if (!b) {
      return (
        <div className="fci-card empty">
          <div className="fci-role">{role}</div>
          <div className="fci-empty-text" style={externalText ? { fontSize: 10, fontWeight: 700, color: 'var(--text)' } : undefined}>
            {externalText || 'Kayıt Yok'}
          </div>
        </div>
      )
    }

    const ringText = (isPosta && b.federationRing) ? b.federationRing : (b.federationRing || ringOf(b))
    const sexLabel = b.sex === 'F' ? '♀ DİŞİ' : b.sex === 'M' ? '♂ ERKEK' : '—'
    const strain = b.strain || b.line || ''

    return (
      <div
        className={`fci-card ${b.sex === 'F' ? 'female' : b.sex === 'M' ? 'male' : ''}`}
        onClick={() => onOpenBird && onOpenBird(b.id)}
        title="Kuş detayını açmak için tıklayın"
      >
        <div className="fci-card-header">
          <span className="fci-role">{role}</span>
          <span className={`fci-sex ${b.sex}`}>{sexLabel}</span>
        </div>

        <div className="fci-ring-line">
          <strong className="fci-ring"><Ring text={ringText} /></strong>
          {b.name && <span className="fci-name">«{b.name}»</span>}
        </div>

        <div className="fci-info-line">
          {b.birthDate && <span>Yıl: {b.birthDate.slice(0, 4)}</span>}
          {b.cinsi && <span className="fci-cinsi-badge" title="Kostüm Cinsi">{b.cinsi}</span>}
          {b.color && <span>{b.color}</span>}
          {strain && <span className="fci-strain-badge" title="Soy/Hat">{strain}</span>}
        </div>

        {b.raceResults && (
          <div className="fci-results">
            🏆 {b.raceResults}
          </div>
        )}
      </div>
    )
  }

  const subjectRing = (isPosta && bird.federationRing) ? bird.federationRing : (bird.federationRing || ringOf(bird))
  const todayStr = fmtDate(new Date().toISOString().slice(0, 10))

  return (
    <div className="overlay fci-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fci-modal">
        {/* Yazdırma / Eylem Çubuğu (Yazdırmada gizlenir) */}
        <div className="fci-toolbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📜</span>
            <div>
              <strong>
                {isPosta
                  ? 'FCI Standart Yarış Pedigresi & Soy Kütüğü Belgesi'
                  : '4-Kuşak Damızlık Soy Ağacı & Pedigre Belgesi'}
              </strong>
              <div className="muted" style={{ fontSize: 11 }}>
                {isPosta
                  ? `${subjectRing} için 4 kuşak resmi sertifika`
                  : `${subjectRing} için 4 kuşak damızlık soy kütüğü belgesi`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="no-print tag" style={{ background: '#f8fafc22', border: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)' }}>
              📄 A4 Yatay (Tek Sayfa)
            </span>
            <button type="button" className="btn primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🖨️</span>
              <span>Yazdır / PDF (A4 Tek Sayfa)</span>
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>

        {/* Sertifika Gövdesi (Yazıcıda ve ekranda temiz çıktı) */}
        <div className="fci-certificate-sheet">
          {/* Üst Logo ve Başlık */}
          <div className="fci-sheet-header">
            <div className="fci-header-loft">
              <h2>{loftName}</h2>
              <div className="fci-header-owner">Yetiştirici: <strong>{ownerName}</strong></div>
              {db.settings?.owner && <div className="fci-header-meta">Resmi Kümes Kaydı</div>}
            </div>

            <div className="fci-header-badge">
              <div className="fci-badge-icon">🕊️</div>
              <div className="fci-badge-title">
                {isPosta ? 'FCI PIGEON PEDIGREE' : 'DAMIZLIK SOY KÜTÜĞÜ'}
              </div>
              <div className="fci-badge-sub">
                {isPosta ? 'RESMİ SOY KÜTÜĞÜ BELGESİ' : '4-KUŞAK RESMİ PEDİGRE SERTİFİKASI'}
              </div>
            </div>

            <div className="fci-header-date">
              <div>Tarih: <strong>{todayStr}</strong></div>
              <div>Belge ID: <strong>{bird.id.slice(0, 8).toUpperCase()}</strong></div>
            </div>
          </div>

          {/* 4 Kuşak Tablo / Ağaç Izgarası */}
          <div className="fci-grid-tree">
            {/* 1. SÜTUN: ANA KUŞ (SUBJECT) */}
            <div className="fci-col fci-col-subject">
              <div className="fci-col-label">ANA KUŞ / SUBJECT</div>
              <div className={`fci-card fci-subject-card ${bird.sex === 'F' ? 'female' : 'male'}`}>
                {/* Rozet, Fotoğraf ve Kuş Adı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {(bird.photos || []).length > 0 && (
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1.5px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <PhotoImg name={bird.photos[0]} small />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="fci-subject-ring-badge">
                      <Ring text={subjectRing} />
                    </div>
                    {bird.name && <div className="fci-subject-name">«{bird.name}»</div>}
                  </div>
                </div>

                {/* Rozetler / Etiketler (Temiz, Canlı, Yüksek Kontrast) */}
                <div className="fci-subject-tags">
                  <span className={`fci-pill ${bird.sex === 'F' ? 'fci-pill-female' : bird.sex === 'M' ? 'fci-pill-male' : 'fci-pill-neutral'}`}>
                    {bird.sex === 'F' ? '♀ DİŞİ' : bird.sex === 'M' ? '♂ ERKEK' : '—'}
                  </span>
                  {bird.cinsi && (
                    <span className="fci-pill fci-pill-cinsi" title="Kostüm Cinsi">
                      🕊️ {bird.cinsi}
                    </span>
                  )}
                  {bird.status && (
                    <span className={`fci-pill ${bird.status === 'damizlik' ? 'fci-pill-damizlik' : 'fci-pill-status'}`}>
                      {bird.status === 'damizlik' ? '⭐ DAMIZLIK' : statusLabel(bird.status)}
                    </span>
                  )}
                  {bird.color && (
                    <span className="fci-pill fci-pill-color" title="Ayırıcı İşaret / Renk">
                      {bird.color}
                    </span>
                  )}
                  {bird.birthDate && (
                    <span className="fci-pill fci-pill-year" title="Doğum Yılı">
                      📅 D. {bird.birthDate.slice(0, 4)}
                    </span>
                  )}
                </div>

                {/* Soy / Kan Hattı */}
                {(bird.strain || bird.line) && (
                  <div className="fci-subject-info-box">
                    <span className="fci-info-box-label">{isPosta ? 'Kan Hattı / Soy (Strain):' : 'Damızlık Soyu / Hat:'}</span>
                    <strong className="fci-info-box-val">{bird.strain || bird.line}</strong>
                  </div>
                )}

                {/* Saat Çipi (Posta) */}
                {bird.chipNo && (
                  <div className="fci-subject-info-box">
                    <span className="fci-info-box-label">Saat Çipi:</span>
                    <strong className="fci-info-box-val">{bird.chipNo}</strong>
                  </div>
                )}

                {/* Yarış Başarıları (Posta) */}
                {bird.raceResults && (
                  <div className="fci-subject-results">
                    <div className="fci-results-head">🏆 YARIŞ BAŞARILARI VE DERECELERİ:</div>
                    <div className="fci-results-body">{bird.raceResults}</div>
                  </div>
                )}

                {/* Notlar */}
                {bird.notes && (
                  <div className="fci-subject-notes">
                    📝 <strong>Not:</strong> {bird.notes}
                  </div>
                )}
              </div>
            </div>


            {/* 2. SÜTUN: 1. NESİL (EBEVEYNLER - 2 KUŞ) */}
            <div className="fci-col fci-col-parents">
              <div className="fci-col-label">1. NESİL / PARENTS</div>
              <div className="fci-cell-group">
                {renderCell(sire, 'BABA (SIRE)', false, externalParentText(bird, 'sire'))}
                {renderCell(dam, 'ANNE (DAM)', true, externalParentText(bird, 'dam'))}
              </div>
            </div>

            {/* 3. SÜTUN: 2. NESİL (DEDELER / NİNELER - 4 KUŞ) */}
            <div className="fci-col fci-col-grandparents">
              <div className="fci-col-label">2. NESİL / GRANDPARENTS</div>
              <div className="fci-cell-group">
                {renderCell(ss, 'BABANIN BABASI', false)}
                {renderCell(sd, 'BABANIN ANNESİ', true)}
                {renderCell(ds, 'ANNENİN BABASI', false)}
                {renderCell(dd, 'ANNENİN ANNESİ', true)}
              </div>
            </div>

            {/* 4. SÜTUN: 3. NESİL (BÜYÜK DEDELER - 8 KUŞ) */}
            <div className="fci-col fci-col-greatgrand">
              <div className="fci-col-label">3. NESİL / GREAT-GRANDPARENTS</div>
              <div className="fci-cell-group">
                {renderCell(sss, 'B.B.B', false)}
                {renderCell(ssd, 'B.B.A', true)}
                {renderCell(sds, 'B.A.B', false)}
                {renderCell(sdd, 'B.A.A', true)}
                {renderCell(dss, 'A.B.B', false)}
                {renderCell(dsd, 'A.B.A', true)}
                {renderCell(dds, 'A.A.B', false)}
                {renderCell(ddd, 'A.A.A', true)}
              </div>
            </div>
          </div>

          {/* Alt Sertifika Onay & İmza Çubuğu */}
          <div className="fci-sheet-footer">
            <div className="fci-footer-seal">
              <div className="fci-seal-circle">
                {isPosta ? 'FCI STANDART' : 'DAMIZLIK KÜTÜĞÜ'}
              </div>
              <span>
                {isPosta
                  ? 'Bu soy ağacı yetiştirici kümes kayıtları esas alınarak doğrulanmıştır.'
                  : 'Bu soy kütüğü ve soy ağacı yetiştirici kümes kayıtları esas alınarak doğrulanmıştır.'}
              </span>
            </div>
            <div className="fci-footer-sign">
              <div className="fci-sign-line" />
              <span>Yetiştirici İmzası / Kaşe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
