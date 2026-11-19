import { dispTr } from '../lib.js'

export default function ChickSexGuideModal({ onClose, onSelectSex }) {
  return (
    <div
      className="overlay"
      style={{ zIndex: 120 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 580, padding: 0 }}>
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
            <span style={{ fontSize: 24 }}>🐣</span>
            <div>
              <h2 style={{ margin: 0, padding: 0, fontSize: 16, fontWeight: 800 }}>
                {dispTr('FOLLUKTA YAVRU CİNSİYET REHBERİ')}
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
                {dispTr('Usta yetiştiricilerin yuvada cinsiyet tespiti için kullandığı 4 altın kural')}
              </p>
            </div>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        {/* İçerik */}
        <div style={{ padding: '16px 20px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* 1. BİLİMSEL GENETİK KURAL */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#fef3c7',
              border: '1.5px solid #d97706',
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>🧬</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#92400e' }}>
                {dispTr('BİLİMSEL GENETİK KURAL (İSTİSNASIZ %100 KESİNLİK)')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: '#78350f', lineHeight: 1.45 }}>
              {dispTr('İki Kırmızı kuştan (')}<b>{dispTr('Çakal')}</b>{dispTr(' veya ')}<b>{dispTr('Kırmızı Komple')}</b>{dispTr(') yuvada bir adet ')}<b>{dispTr('SARI (Limoni veya Sarı Komple)')}</b>{dispTr(' yavru çıkarsa; ')}<u>{dispTr('o yavru istisnasız %100 DİŞİDİR')}</u>{dispTr('. Erkek yavrunun sarı olabilmesi için annenin de sarı olması gerekir. Biyolojik doğa kanunudur.')}
            </p>
          </div>

          {/* 2. KAFA VE GAGA KEMİĞİ */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--panel-2)',
              border: '1px solid var(--line)',
              marginBottom: 12
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6, color: 'var(--text)' }}>
              {dispTr('A. Kafa ve Gaga Kemiği Morfolojisi (En Güvenilir Gösterge)')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div style={{ padding: '8px 12px', background: 'var(--panel)', borderRadius: 8, borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: 12.5, marginBottom: 2 }}>
                  {dispTr('♂️ ERKEK YAVRU')}
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {dispTr('Kafa yapısı daha geniş, üstten bakıldığında alın kısmı basık ve geniştir. Gaga kökü (burun eti / ceroma) daha kaba, etli ve kalındır. Gözler kafada biraz daha yukarıda durur.')}
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: 'var(--panel)', borderRadius: 8, borderLeft: '3px solid #f472b6' }}>
                <div style={{ fontWeight: 700, color: '#f472b6', fontSize: 12.5, marginBottom: 2 }}>
                  {dispTr('♀️ DİŞİ YAVRU')}
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {dispTr('Kafa kubbesi daha yuvarlak ve narin/zariftir. Gagası erkeğe göre belirgin şekilde ince, kibar ve uzun uzanır. Bakışı yumuşaktır.')}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SAVUNMA REFLEKSİ */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--panel-2)',
              border: '1px solid var(--line)',
              marginBottom: 12
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6, color: 'var(--text)' }}>
              {dispTr('B. Yuvadaki Tehdit / Savunma Refleksi (18. Günden İtibaren)')}
            </div>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
              {dispTr('Elinizi folluğa veya yuvaya doğru yavaşça uzattığınızda gösterdikleri tepki:')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div style={{ padding: '8px 12px', background: 'var(--panel)', borderRadius: 8, borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: 12.5, marginBottom: 2 }}>
                  {dispTr('♂️ ERKEK DAVRANIŞI')}
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {dispTr('Kanatlarını kabartıp dikleşir, elinize doğru ')}<b>{dispTr('tık tık diye gagasını vurur')}</b>{dispTr(' ve yuvayı korumak için öne atılır.')}
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: 'var(--panel)', borderRadius: 8, borderLeft: '3px solid #f472b6' }}>
                <div style={{ fontWeight: 700, color: '#f472b6', fontSize: 12.5, marginBottom: 2 }}>
                  {dispTr('♀️ DİŞİ DAVRANIŞI')}
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {dispTr('Geriye, yuvanın köşesine veya kardeşinin arkasına siner; başını eğip daha sessiz ve çekingen kalır.')}
                </div>
              </div>
            </div>
          </div>

          {/* 4. BACAK VE BİLEK KALINLIĞI */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--panel-2)',
              border: '1px solid var(--line)',
              marginBottom: 12
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4, color: 'var(--text)' }}>
              {dispTr('C. Bacak ve Bilek Kalınlığı')}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
              {dispTr('Çakal ve Komple ırklarında erkek yavruların paça ve ayak bilek kemiği belirgin şekilde daha etli ve kalındır. Künye takarken (7-9. günlerde) künyenin bir yavrunun ayağına diğerine göre daha sıkı geçmesi ilk erkek işaretidir.')}
            </p>
          </div>

          {/* 5. KOMPLELERDE BOYUN HALKASI */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--panel-2)',
              border: '1px solid var(--line)'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4, color: 'var(--text)' }}>
              {dispTr('D. Komple Kuşlarda Boyun Halkası Genişliği')}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
              {dispTr('Komple ırkında erkek yavruların boyun halkasındaki beyaz tasma genellikle daha tok, kalın ve yukarıya doğru dolgundur; dişi yavrularda boyundaki beyaz çizgi daha narin ve incedir.')}
            </p>
          </div>
        </div>

        {/* Alt Butonlar */}
        <div
          className="modal-actions"
          style={{
            padding: '12px 20px',
            background: 'var(--panel)',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8
          }}
        >
          {onSelectSex ? (
            <div style={{ display: 'flex', gap: 8, flex: '1 1 auto' }}>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1, background: '#0284c7', borderColor: '#0284c7' }}
                onClick={() => { onSelectSex('M'); onClose(); }}
              >
                {dispTr('♂️ ERKEK Olarak Seç')}
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1, background: '#db2777', borderColor: '#db2777' }}
                onClick={() => { onSelectSex('F'); onClose(); }}
              >
                {dispTr('♀️ DİŞİ Olarak Seç')}
              </button>
            </div>
          ) : (
            <div />
          )}

          <button
            type="button"
            className="btn"
            onClick={onClose}
            style={{ minWidth: 90 }}
          >
            {dispTr('Kapat')}
          </button>
        </div>
      </div>
    </div>
  )
}
