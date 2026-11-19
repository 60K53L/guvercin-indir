import { useState, useMemo } from 'react'
import {
  byId, ringOf, SEX, statusLabel, dispTr,
  relationshipCoefficient, kinshipPct, relationLabel,
  findCommonAncestors, compareBirds, matesOf, mateIdOf, isGone, sharedOffspring,
  COSTUME_TYPES, detectCostumeType, analyzeCostumeMating, todayIso
} from '../lib.js'
import Ring from './Ring.jsx'
import BirdPicker from './BirdPicker.jsx'

export default function MatingSimulator({ db, onUpsertPairing, onOpenBird, onNotify, hideHeader = false }) {
  const [maleId, setMaleId] = useState('')
  const [femaleId, setFemaleId] = useState('')
  const [nestInput, setNestInput] = useState('')
  const [simTab, setSimTab] = useState('all') // 'all' | 'costume' | 'kinship'

  // Kullanıcının elle seçebileceği kostüm tipleri (kuş seçiliyken geçersiz kılmak için)
  const [manualDamType, setManualDamType] = useState('')
  const [manualSireType, setManualSireType] = useState('')

  // Kuş seçilmediğinde serbest laboratuvar modunda kullanılacak tipler
  const [freeDamType, setFreeDamType] = useState('CAKAL')
  const [freeSireType, setFreeSireType] = useState('KIRMIZI_KOMPLE')

  // Erkek ve Dişi Kuş Listeleri
  const males = useMemo(() => {
    return (db.birds || [])
      .filter(b => b.sex === 'M' && !isGone(b))
      .sort(compareBirds)
  }, [db.birds])

  const females = useMemo(() => {
    return (db.birds || [])
      .filter(b => b.sex === 'F' && !isGone(b))
      .sort(compareBirds)
  }, [db.birds])

  const male = useMemo(() => byId(db.birds, maleId), [db.birds, maleId])
  const female = useMemo(() => byId(db.birds, femaleId), [db.birds, femaleId])

  // Efektif Kostüm Tipleri
  const effectiveDamType = useMemo(() => {
    if (female) return manualDamType || detectCostumeType(female)
    return freeDamType
  }, [female, manualDamType, freeDamType])

  const effectiveSireType = useMemo(() => {
    if (male) return manualSireType || detectCostumeType(male)
    return freeSireType
  }, [male, manualSireType, freeSireType])

  // Kostüm, Renk ve Kapak Altı Analizi
  const costumeAnalysis = useMemo(() => {
    return analyzeCostumeMating(effectiveDamType, effectiveSireType, female, male)
  }, [effectiveDamType, effectiveSireType, female, male])

  // Kapak altını toplamak için kümesinizdeki uygun damızlık kuş önerileri
  const recommendedFixers = useMemo(() => {
    if (!costumeAnalysis?.remedyTip?.recommendedType) return []
    const targetType = costumeAnalysis.remedyTip.recommendedType
    return (db.birds || []).filter(b => {
      if (isGone(b)) return false
      return detectCostumeType(b) === targetType
    }).slice(0, 4)
  }, [db.birds, costumeAnalysis])

  // Akrabalık ve Wright Katsayısı Analizi
  const analysis = useMemo(() => {
    if (!male || !female) return null

    // Wright katsayısı hesabı
    const coeff = relationshipCoefficient(db.birds, male, female)
    const directRel = relationLabel(db.birds, male, female) || relationLabel(db.birds, female, male)
    const commonAncestors = findCommonAncestors(db.birds, male, female)

    // Risk Seviyesi
    let riskLevel = 'safe' // safe | mild | linebreeding | high | severe
    let riskText = 'Temiz Kan / Yabancı Eşleşme'
    let riskDesc = 'İki kuş arasında bilinen ortak ata yok. Hibrit canlılığı (heterozis) yüksek olur; bağışıklık ve dayanıklılık artar.'
    let riskColor = '#16a34a'
    let riskBg = '#dcfce7'

    if (coeff > 0.25) {
      riskLevel = 'severe'
      riskText = 'AŞIRI YAKIN AKRABA (Yüksek Risk)'
      riskDesc = 'Öz kardeş, ana-oğul veya baba-kız derecesinde aşırı yakın eşleşme. Genetik sakatlık, bağışıklık düşüşü, yumurtada ölüm ve kısırlık riski çok yüksektir.'
      riskColor = '#dc2626'
      riskBg = '#fee2e2'
    } else if (coeff > 0.125) {
      riskLevel = 'high'
      riskText = 'Yakın Akraba Eşleşmesi'
      riskDesc = 'Yarı kardeş veya dede-torun derecesinde yakın akrabalık. Belirli özellikleri sabitlemek için tercih edilebilir ancak zayıf yönler de katlanarak çıkabilir.'
      riskColor = '#ea580c'
      riskBg = '#ffedd5'
    } else if (coeff > 0.05) {
      riskLevel = 'linebreeding'
      riskText = 'Çizgi Yetiştiriciliği (Linebreeding / Kan Sabitleme)'
      riskDesc = 'Kuzen veya 2.-3. kuşak ortak ata eşleşmesi. Damızlık kan hattını sabitlemek ve üstün özellikleri korumak için kuşçulukta ideal kabul edilen seviyedir.'
      riskColor = '#ca8a04'
      riskBg = '#fef9c3'
    } else if (coeff > 0.005) {
      riskLevel = 'mild'
      riskText = 'Uzak Akraba'
      riskDesc = 'Çok uzak bir ortak ata mevcut; risk önemsizdir, güvenle eşleştirilebilir.'
      riskColor = '#0284c7'
      riskBg = '#e0f2fe'
    }

    // Mevcut eş durumları
    const maleMates = matesOf(db.pairings, male)
    const femaleMates = matesOf(db.pairings, female)

    return {
      coeff,
      pct: kinshipPct(coeff),
      directRel,
      commonAncestors,
      riskLevel,
      riskText,
      riskDesc,
      riskColor,
      riskBg,
      maleHasMate: maleMates.simdi.length > 0 ? byId(db.birds, mateIdOf(maleMates.simdi[0], male)) : null,
      femaleHasMate: femaleMates.simdi.length > 0 ? byId(db.birds, mateIdOf(femaleMates.simdi[0], female)) : null,
      sharedChicks: sharedOffspring(db.birds, male, female)
    }
  }, [male, female, db.birds, db.pairings])

  const handlePairNow = async () => {
    if (!male || !female) return
    if (!window.confirm(dispTr(`${ringOf(female)} ile ${ringOf(male)} kuşlarını kümeste YENİ EŞ olarak kaydetmek istiyor musunuz?`))) return

    try {
      // Aynı çift daha önce kaydedilmişse YENİ belge açma; mevcut kaydı
      // güncelle. Aksi hâlde her basışta ayrı bir "simdi" kaydı oluşuyor
      // ve tek eş kuralı bozuluyordu.
      const existing = (db.pairings || []).find(
        p => p.maleId === male.id && p.femaleId === female.id
      )
      await onUpsertPairing({
        ...(existing || {}),
        maleId: male.id,
        femaleId: female.id,
        nest: nestInput.trim() || existing?.nest || undefined,
        durum: 'simdi',
        date: existing?.date || todayIso(),
        chickIds: existing?.chickIds || []
      })
      onNotify(dispTr(`${ringOf(female)} × ${ringOf(male)} çifti başarıyla eşleştirildi!`))
    } catch (err) {
      onNotify(dispTr('Eşleştirme başarısız: ') + (err.message || err), 'err')
    }
  }

  // Kostüm & Kapak Altı Islah Bölümü Renderı
  const renderCostumeSection = (isFreeMode = false) => {
    const c = costumeAnalysis
    if (!c) return null

    return (
      <div style={{ marginTop: isFreeMode ? 0 : 20 }}>
        {/* 1. KÜMES ISLAH KURALI BİLGİ KUTUSU */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: c.lineStatus === 'warning' ? '#fee2e2' : (c.lineStatus === 'valid' ? '#dcfce7' : '#e0f2fe'),
            border: `1.5px solid ${c.lineBadgeColor}`,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: c.lineBadgeColor }}>
              {dispTr(c.lineTitle)}
            </span>
            <span className="tag" style={{ background: c.lineBadgeColor, color: '#fff', fontSize: 10, fontWeight: 700 }}>
              {dispTr(c.lineStatus === 'warning' ? 'KURAL İHLALİ' : 'ISLAH DİSİPLİNİ')}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#1f2937', lineHeight: 1.45 }}>
            {dispTr(c.lineDesc)}
          </p>
        </div>

        {/* 2. KAPAK ALTI GÜVENLİK VE RİSK BAROMETRESİ */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: c.tailBg,
            border: `1.5px solid ${c.tailColor}`,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {dispTr('🛡️ KAPAK ALTI (KUYRUK ALTI) RİSK BAROMETRESİ')}
              </span>
              <div style={{ fontSize: 16, fontWeight: 800, color: c.tailColor, marginTop: 2 }}>
                {dispTr(c.tailTitle)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: c.tailColor }}>
                {dispTr(`%${c.tailScore}`)}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: c.tailColor }}>{dispTr('Kapak Güvenlik Puanı')}</div>
            </div>
          </div>

          {/* İlerleme Çubuğu */}
          <div style={{ width: '100%', height: 8, background: 'rgba(0,0,0,0.1)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
            <div
              style={{
                width: `${c.tailScore}%`,
                height: '100%',
                background: c.tailColor,
                transition: 'width .3s ease'
              }}
            />
          </div>

          <p style={{ margin: 0, fontSize: 12.5, color: '#1f2937', lineHeight: 1.5 }}>
            {dispTr(c.tailDesc)}
          </p>
        </div>

        {/* 3. TAHMİNİ YAVRU KIYAFET DAĞILIMI */}
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>
            {dispTr('🐣 Tahmini Yavru Kıyafet & Desen Dağılımı')}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {c.offspring.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 14px',
                  background: 'var(--panel-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
                    {dispTr(`🕊️ ${item.label}`)}
                  </span>
                  <span
                    className="tag"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--on-accent)',
                      fontWeight: 800,
                      fontSize: 11
                    }}
                  >
                    {dispTr(item.badge)}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {dispTr(item.desc)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. DAMIZLIK ISLAH & KAPAK ALTI KURTARMA TAVSİYESİ (Varsa) */}
        {c.remedyTip && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: '#fef3c7',
              border: '1.5px dashed #d97706',
              marginBottom: 16
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, color: '#b45309', marginBottom: 6 }}>
              {dispTr(c.remedyTip.title)}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}>
              {dispTr(c.remedyTip.text)}
            </p>

            {/* Kümesinizdeki Uygun Damızlık Önerileri */}
            {recommendedFixers.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fde68a' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  {dispTr('🕊️ Kümesinizden Önerilen Düz Renk Frenleyici Kuşlar:')}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {recommendedFixers.map(fb => (
                    <div
                      key={fb.id}
                      style={{
                        padding: '4px 10px',
                        background: '#fff',
                        borderRadius: 6,
                        border: '1px solid #d97706',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12
                      }}
                    >
                      <Ring text={ringOf(fb)} />
                      <span style={{ fontWeight: 600 }}>{dispTr(`${fb.name || ''} (${fb.sex === 'M' ? '♂ Erkek' : '♀ Dişi'})`)}</span>
                      <button
                        type="button"
                        className="btn small"
                        style={{ padding: '2px 8px', fontSize: 10.5 }}
                        onClick={() => {
                          if (fb.sex === 'M') setMaleId(fb.id)
                          else setFemaleId(fb.id)
                          onNotify(dispTr(`${ringOf(fb)} damızlık olarak seçildi!`))
                        }}
                      >
                        {dispTr('Seç')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mating-simulator-page">
      {!hideHeader && (
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h2>{dispTr('Sanal Eşleştirme & Islah Simülatörü')}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {dispTr('Damızlık eşleşmesi, kan akrabalığı, renk kalıtımı ve kapak altı desen analizi')}
            </p>
          </div>
        </div>
      )}

      {/* Kuş Seçim Alanı */}
      <div className="panel" style={{ marginBottom: 20, padding: 18 }}>
        <div className="sim-selector-wrap">
          {/* Dişi Seçimi - ÖNCE ANNE */}
          <div className="sim-select-col">
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
              {dispTr('DİŞİ KUŞ (ANNE ADAYI)')}
            </label>
            <BirdPicker
              birds={females}
              value={femaleId}
              onChange={id => {
                setFemaleId(id)
                setManualDamType('')
              }}
              title="Dişi Kuş (Anne Adayı) Seç"
              placeholder={dispTr(`-- DİŞİ KUŞ SEÇİNİZ (${females.length}) --`)}
              clearLabel={dispTr('— Seçimi Temizle —')}
            />

            {/* Kostüm Tipi Seçimi / Düzenlemesi */}
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>
                {dispTr('Kostüm / Renk Tipi:')}
              </label>
              <select
                value={effectiveDamType}
                onChange={e => {
                  if (female) setManualDamType(e.target.value)
                  else setFreeDamType(e.target.value)
                }}
                style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
              >
                {COSTUME_TYPES.map(ct => (
                  <option key={ct.id} value={ct.id}>{dispTr(ct.label)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sim-cross-badge">
            ×
          </div>

          {/* Erkek Seçimi - SONRA BABA */}
          <div className="sim-select-col">
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
              {dispTr('ERKEK KUŞ (BABA ADAYI)')}
            </label>
            <BirdPicker
              birds={males}
              value={maleId}
              onChange={id => {
                setMaleId(id)
                setManualSireType('')
              }}
              title="Erkek Kuş (Baba Adayı) Seç"
              placeholder={dispTr(`-- ERKEK KUŞ SEÇİNİZ (${males.length}) --`)}
              clearLabel={dispTr('— Seçimi Temizle —')}
            />

            {/* Kostüm Tipi Seçimi / Düzenlemesi */}
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>
                {dispTr('Kostüm / Renk Tipi:')}
              </label>
              <select
                value={effectiveSireType}
                onChange={e => {
                  if (male) setManualSireType(e.target.value)
                  else setFreeSireType(e.target.value)
                }}
                style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
              >
                {COSTUME_TYPES.map(ct => (
                  <option key={ct.id} value={ct.id}>{dispTr(ct.label)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Kuşlar Seçilmediğinde: Serbest Kostüm Laboratuvarı */}
      {(!male || !female) && (
        <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            <span style={{ fontSize: 24 }}>🎨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{dispTr('Hızlı Kostüm & Kapak Altı Laboratuvarı (Önizleme)')}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                {dispTr('Yukarıdan iki kostüm tipi seçerek eşleşme sonucunu ve kapak altı riskini anında görebilirsiniz')}
              </p>
            </div>
          </div>

          {renderCostumeSection(true)}

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--panel-2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            {dispTr('💡 Kendi kümesinizdeki kayıtlı kuşların soy akrabalığını ve geçmişini incelemek için yukarıdaki kutulardan Dişi ve Erkek kuşunuzu seçebilirsiniz.')}
          </div>
        </div>
      )}

      {/* Simülasyon Sonuç Kartı (Her iki kuş seçildiğinde) */}
      {male && female && analysis && (
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            {/* Karşılaştırma Kartı */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {/* Dişi Kartı - ÖNCE ANNE ADAYI */}
              <div
                style={{ flex: 1, minWidth: 240, padding: 14, background: 'var(--panel-2)', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => onOpenBird(female.id)}
                title="Kuş detayına git"
              >
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{dispTr('ANNE ADAYI (DİŞİ)')}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  <Ring text={ringOf(female)} /> {female.name && female.name !== ringOf(female) ? dispTr(`· ${female.name}`) : ''}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {dispTr(female.cinsi || 'Irk Belirtilmedi')} · {dispTr(female.color || 'Renk Belirtilmedi')}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="tag" style={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 11, fontWeight: 700 }}>
                    {dispTr(`🏷️ Kostüm: ${COSTUME_TYPES.find(c => c.id === effectiveDamType)?.label.split('(')[0].trim()}`)}
                  </span>
                </div>
                {female.line && <div style={{ fontSize: 12, marginTop: 4 }}>{dispTr(`Hat / Soy: ${female.line}`)}</div>}
                {analysis.femaleHasMate && (
                  <div className="tag muted" style={{ marginTop: 8 }}>
                    {dispTr(`⚠️ Şu an eşli: ${ringOf(analysis.femaleHasMate)}`)}
                  </div>
                )}
              </div>

              {/* Erkek Kartı - SONRA BABA ADAYI */}
              <div
                style={{ flex: 1, minWidth: 240, padding: 14, background: 'var(--panel-2)', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => onOpenBird(male.id)}
                title="Kuş detayına git"
              >
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{dispTr('BABA ADAYI (ERKEK)')}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  <Ring text={ringOf(male)} /> {male.name && male.name !== ringOf(male) ? dispTr(`· ${male.name}`) : ''}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {dispTr(male.cinsi || 'Irk Belirtilmedi')} · {dispTr(male.color || 'Renk Belirtilmedi')}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="tag" style={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 11, fontWeight: 700 }}>
                    {dispTr(`🏷️ Kostüm: ${COSTUME_TYPES.find(c => c.id === effectiveSireType)?.label.split('(')[0].trim()}`)}
                  </span>
                </div>
                {male.line && <div style={{ fontSize: 12, marginTop: 4 }}>{dispTr(`Hat / Soy: ${male.line}`)}</div>}
                {analysis.maleHasMate && (
                  <div className="tag muted" style={{ marginTop: 8 }}>
                    {dispTr(`⚠️ Şu an eşli: ${ringOf(analysis.maleHasMate)}`)}
                  </div>
                )}
              </div>
            </div>

            {/* Analiz Sekmeleri Seçici */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 20,
                marginBottom: 16,
                borderBottom: '1px solid var(--line)',
                paddingBottom: 10,
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                className={`btn small ${simTab === 'all' ? 'primary' : ''}`}
                onClick={() => setSimTab('all')}
              >
                {dispTr('✨ Birleşik Görünüm (Akrabalık + Kostüm)')}
              </button>
              <button
                type="button"
                className={`btn small ${simTab === 'costume' ? 'primary' : ''}`}
                onClick={() => setSimTab('costume')}
              >
                {dispTr('🎨 Kostüm, Renk & Kapak Altı Motoru')}
              </button>
              <button
                type="button"
                className={`btn small ${simTab === 'kinship' ? 'primary' : ''}`}
                onClick={() => setSimTab('kinship')}
              >
                {dispTr('🧬 Soy & Akrabalık Analizi')}
              </button>
            </div>

            {/* KOSTÜM & KAPAK ALTI BÖLÜMÜ */}
            {(simTab === 'all' || simTab === 'costume') && (
              <div style={{ marginBottom: simTab === 'all' ? 24 : 0 }}>
                {simTab === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>🎨</span>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{dispTr('1. KOSTÜM & KAPAK ALTI ISLAH ANALİZİ')}</h4>
                  </div>
                )}
                {renderCostumeSection(false)}
              </div>
            )}

            {/* SOY & AKRABALIK BÖLÜMÜ */}
            {(simTab === 'all' || simTab === 'kinship') && (
              <div>
                {simTab === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
                    <span style={{ fontSize: 18 }}>🧬</span>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{dispTr('2. SOY YAKINLIĞI & AKRABALIK ANALİZİ')}</h4>
                  </div>
                )}

                {/* Kan Yakınlığı ve Risk Skoru Paneli */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: analysis.riskBg,
                    border: `1px solid ${analysis.riskColor}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: analysis.riskColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {dispTr('AKRABALIK DERECESİ & RİSK ANALİZİ')}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: analysis.riskColor, marginTop: 2 }}>
                        {dispTr(analysis.riskText)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: analysis.riskColor }}>
                        {dispTr(analysis.pct)}
                      </div>
                      <div style={{ fontSize: 11, color: analysis.riskColor }}>{dispTr('Akrabalık Katsayısı')}</div>
                    </div>
                  </div>

                  <p style={{ margin: '10px 0 0', fontSize: 14, color: '#1f2937', lineHeight: 1.5 }}>
                    {dispTr(analysis.riskDesc)}
                  </p>

                  {analysis.directRel && (
                    <div style={{ marginTop: 10, fontWeight: 700, color: analysis.riskColor }}>
                      {dispTr('📌 Doğrudan Bağlantı: Bu iki kuş birbirinin ')}<u>{dispTr(analysis.directRel)}</u>{dispTr(' konumundadır.')}
                    </div>
                  )}

                  {analysis.sharedChicks.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#166534', background: '#dcfce7', padding: '6px 10px', borderRadius: 6, fontWeight: 600 }}>
                      {dispTr(`🕊️ Bu çiftin daha önce kayıtlı ${analysis.sharedChicks.length} ortak yavrusu bulunmaktadır (eski/mevcut eş).`)}
                    </div>
                  )}
                </div>

                {/* Ortak Atalar */}
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ margin: '0 0 10px' }}>
                    {dispTr(`Ortak Atalar (${analysis.commonAncestors.length})`)}
                  </h4>

                  {analysis.commonAncestors.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      {dispTr('Kayıtlı soy ağacında her iki kuşun da paylaştığı ortak bir ata bulunmamaktadır (Temiz soy eşleşmesi).')}
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                      {analysis.commonAncestors.map((ca, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: 10,
                            background: 'var(--panel-2)',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            cursor: 'pointer'
                          }}
                          onClick={() => onOpenBird(ca.bird.id)}
                        >
                          <div style={{ fontWeight: 700 }}>
                            <Ring text={ringOf(ca.bird)} /> {ca.bird.name && ca.bird.name !== ringOf(ca.bird) ? dispTr(`· ${ca.bird.name}`) : ''}
                          </div>
                          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                            <div>{dispTr(`Baba tarafında: ${ca.genA}. Kuşak (${ca.pathA || 'Doğrudan'})`)}</div>
                            <div>{dispTr(`Anne tarafında: ${ca.genB}. Kuşak (${ca.pathB || 'Doğrudan'})`)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tahmini Yavru Özellikleri */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <h4 style={{ margin: '0 0 8px' }}>{dispTr('Tahmini Yavru Soy Bileşimi')}</h4>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span className="tag" style={{ padding: '6px 12px' }}>
                      {dispTr(`Irk Karışımı: %50 ${male.cinsi || 'Bilinmeyen'} + %50 ${female.cinsi || 'Bilinmeyen'}`)}
                    </span>
                    {male.line && (
                      <span className="tag" style={{ padding: '6px 12px' }}>
                        {dispTr(`Baba Hattı: ${male.line}`)}
                      </span>
                    )}
                    {female.line && (
                      <span className="tag" style={{ padding: '6px 12px' }}>
                        {dispTr(`Anne Hattı: ${female.line}`)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Doğrudan Eşleştirme Alanı */}
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: 'var(--panel-2)',
                borderRadius: 8,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {dispTr('Folluk / Yuvalık No (Opsiyonel)')}
                </label>
                <input
                  type="text"
                  placeholder={dispTr('Örn: Folluk 1, Yuva 3...')}
                  value={nestInput}
                  onChange={e => setNestInput(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  className="btn primary"
                  style={{ padding: '10px 20px', fontWeight: 700 }}
                  onClick={handlePairNow}
                >
                  {dispTr('❤️ Bu Çifti Kümeste Eşleştir')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
