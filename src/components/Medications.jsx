import { useState, useMemo } from 'react'
import {
  trUpper, fmtDate, todayIso, diffDays, byId, ringOf, compareBirds,
  sortTr, DEFAULT_MED_CATEGORIES, matchMedicationCategory, uid, trSearch, dispTr
} from '../lib.js'
import Ring from './Ring.jsx'

export default function Medications({
  db,
  onUpsertMedication,
  onRemoveMedication,
  onUpsertVaccination,
  onRemoveVaccination,
  onUpsertSupplement,
  onRemoveSupplement,
  onSaveSettings,
  onNotify,
  onOpenBird
}) {
  const [activeTab, setActiveTab] = useState('guide') // 'guide' | 'vaccines' | 'supplements'
  const [editingMed, setEditingMed] = useState(null)
  const [editingVac, setEditingVac] = useState(null)
  const [editingSup, setEditingSup] = useState(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [filterHuman, setFilterHuman] = useState(false)
  const [filterAnimal, setFilterAnimal] = useState(false)
  const [itemTypeFilter, setItemTypeFilter] = useState('') // '' | 'medication' | 'vaccine' | 'supplement'
  const [supKindFilter, setSupKindFilter] = useState('') // '' | 'supplement' | 'feed'
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showCategoryChips, setShowCategoryChips] = useState(false)

  // Tanımlı kategoriler (kullanıcı ayarlarından veya varsayılanlar)
  const categories = useMemo(() => {
    const list = db.settings?.medicationCategories
    if (Array.isArray(list) && list.length > 0) return sortTr(list)
    return sortTr(DEFAULT_MED_CATEGORIES)
  }, [db.settings?.medicationCategories])

  // Her kategori için ilaç sayıları
  const categoryCounts = useMemo(() => {
    const counts = {}
    const allMeds = db.medications || []
    for (const cat of categories) {
      counts[cat] = allMeds.filter(m => matchMedicationCategory(m, cat)).length
    }
    return counts
  }, [categories, db.medications])

  // İlaç, Aşı ve Takviye tür sayıları
  const itemTypeCounts = useMemo(() => {
    const all = db.medications || []
    return {
      all: all.length,
      medication: all.filter(m => !m.itemType || m.itemType === 'medication').length,
      vaccine: all.filter(m => m.itemType === 'vaccine').length,
      supplement: all.filter(m => m.itemType === 'supplement').length
    }
  }, [db.medications])

  const humanCount = useMemo(() => {
    return (db.medications || []).filter(m => m.forHuman).length
  }, [db.medications])

  const animalCount = useMemo(() => {
    return (db.medications || []).filter(m => m.forAnimal).length
  }, [db.medications])

  const hasGuideFilter = Boolean(search || itemTypeFilter || filterHuman || filterAnimal || selectedCategory)

  const resetGuideFilters = () => {
    setSearch('')
    setItemTypeFilter('')
    setFilterHuman(false)
    setFilterAnimal(false)
    setSelectedCategory('')
  }

  const handleAddCategory = async (newCat) => {
    const clean = trUpper(newCat || '').trim()
    if (!clean) return
    // Karşılaştırma katlanmış haliyle: "MAVİ" ile "MAVI" aynı kategori.
    if (categories.some(c => trSearch(c) === trSearch(clean))) {
      alert(`"${clean}" kategorisi zaten mevcut!`)
      return
    }
    const updated = sortTr([...categories, clean])
    if (onSaveSettings) {
      await onSaveSettings({
        ...db.settings,
        medicationCategories: updated
      })
      onNotify(`"${clean}" kategorisi eklendi`)
    }
    return updated
  }

  const handleRemoveCategory = async (catToRemove) => {
    if (!window.confirm(`"${catToRemove}" kategorisini silmek istediğinizden emin misiniz?`)) return
    const updated = categories.filter(c => trSearch(c) !== trSearch(catToRemove))
    if (onSaveSettings) {
      await onSaveSettings({
        ...db.settings,
        medicationCategories: updated
      })
      onNotify(`"${catToRemove}" kategorisi silindi`)
    }
    if (selectedCategory === catToRemove) {
      setSelectedCategory('')
    }
  }

  const handleResetDefaultCategories = async () => {
    if (!window.confirm('Tüm kategoriler varsayılan listeye sıfırlansın mı?')) return
    const updated = sortTr(DEFAULT_MED_CATEGORIES)
    if (onSaveSettings) {
      await onSaveSettings({
        ...db.settings,
        medicationCategories: updated
      })
      onNotify('Kategoriler varsayılana sıfırlandı')
    }
  }

  // ---------------- İLAÇ REHBERİ ----------------
  const medications = useMemo(() => {
    const t = trSearch(search)
    return (db.medications || [])
      .filter(m => {
        // İlaç / Aşı / Takviye tür filtresi
        if (itemTypeFilter) {
          const type = m.itemType || 'medication'
          if (type !== itemTypeFilter) return false
        }

        // İnsan / Hayvan İlacı filtreleri
        if (filterHuman && !filterAnimal) {
          if (!m.forHuman) return false
        } else if (!filterHuman && filterAnimal) {
          if (!m.forAnimal) return false
        } else if (filterHuman && filterAnimal) {
          if (!m.forHuman && !m.forAnimal) return false
        }

        // Kategori / Hastalık filtresi (göz sulanması, hırıltı, kanat tutulması vb.)
        if (selectedCategory) {
          if (!matchMedicationCategory(m, selectedCategory)) return false
        }

        if (!t) return true
        const typeLabel = m.itemType === 'vaccine' ? 'Aşı' : m.itemType === 'supplement' ? 'Takviye' : 'İlaç'
        return trSearch([
          m.name,
          m.purpose,
          m.dosage,
          m.alternative,
          m.pharmacyAlternative,
          m.activeIngredient,
          typeLabel,
          Array.isArray(m.categories) ? m.categories.join(' ') : '',
          m.forHuman ? 'İnsan İlacı' : '',
          m.forAnimal ? 'Hayvan İlacı' : ''
        ].filter(Boolean).join(' ')).includes(t)
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr', { sensitivity: 'base' }))
  }, [db.medications, search, itemTypeFilter, filterHuman, filterAnimal, selectedCategory])

  // ---------------- AŞI VE UYGULAMA KAYITLARI ----------------
  const vaccinations = useMemo(() => {
    const t = trSearch(search)
    return (db.vaccinations || [])
      .filter(v => {
        if (!t) return true
        return trSearch([v.name, v.dosage, v.administeredBy, v.targetOther, v.notes]
          .filter(Boolean).join(' ')).includes(t)
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [db.vaccinations, search])

  // Yaklaşan aşılar
  const upcomingVacCount = useMemo(() => {
    const today = todayIso()
    return (db.vaccinations || []).filter(v => {
      if (!v.nextDate) return false
      const diff = diffDays(v.nextDate, today)
      return diff >= 0 && diff <= 30
    }).length
  }, [db.vaccinations])

  // ---------------- TAKVİYELER & YEMLER ----------------
  const supplements = useMemo(() => {
    const t = trSearch(search)
    return (db.supplements || [])
      .filter(s => {
        if (supKindFilter === 'feed' && s.kind !== 'feed') return false
        if (supKindFilter === 'supplement' && s.kind === 'feed') return false
        if (!t) return true
        return trSearch([
          s.name,
          s.purpose,
          s.usage,
          s.content,
          s.brand,
          s.notes,
          s.kind === 'feed' ? 'Yem' : 'Takviye'
        ].filter(Boolean).join(' ')).includes(t)
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr', { sensitivity: 'base' }))
  }, [db.supplements, search, supKindFilter])

  const supplementCounts = useMemo(() => {
    const all = db.supplements || []
    return {
      all: all.length,
      supplement: all.filter(s => s.kind !== 'feed').length,
      feed: all.filter(s => s.kind === 'feed').length
    }
  }, [db.supplements])

  const handleMedSubmit = async (med) => {
    try {
      await onUpsertMedication({
        ...med,
        itemType: med.itemType || 'medication',
        name: trUpper(med.name).trim(),
        purpose: trUpper(med.purpose).trim(),
        dosage: trUpper(med.dosage).trim(),
        alternative: trUpper(med.alternative).trim(),
        pharmacyAlternative: trUpper(med.pharmacyAlternative || '').trim(),
        activeIngredient: trUpper(med.activeIngredient).trim(),
        notes: trUpper(med.notes || '').trim()
      })
      const typeLabel = med.itemType === 'vaccine' ? 'Aşı' : med.itemType === 'supplement' ? 'Takviye' : 'İlaç'
      onNotify(med.id ? `${typeLabel} güncellendi` : `${typeLabel} eklendi`)
    } finally {
      setEditingMed(null)
    }
  }

  const handleMedDelete = async (id) => {
    if (!window.confirm('Bu ilaç kaydını silmek istediğinizden emin misiniz?')) return
    try {
      await onRemoveMedication(id)
      onNotify('İlaç silindi')
    } finally {
      setEditingMed(null)
    }
  }

  const handleVacSubmit = async (vac) => {
    try {
      await onUpsertVaccination(vac)
      onNotify(vac.id ? 'Aşı kaydı güncellendi' : 'Aşı kaydı eklendi')
    } finally {
      setEditingVac(null)
    }
  }

  const handleVacDelete = async (id) => {
    if (!window.confirm('Bu aşı kaydını silmek istediğinizden emin misiniz?')) return
    try {
      await onRemoveVaccination(id)
      onNotify('Aşı kaydı silindi')
    } finally {
      setEditingVac(null)
    }
  }

  const handleSupSubmit = async (sup) => {
    try {
      await onUpsertSupplement(sup)
      onNotify(sup.id && (db.supplements || []).some(s => s.id === sup.id)
        ? 'Takviye / yem güncellendi'
        : 'Takviye / yem eklendi')
    } finally {
      setEditingSup(null)
    }
  }

  const handleSupDelete = async (id) => {
    if (!window.confirm('Bu takviye / yem kaydını silmek istediğinizden emin misiniz?')) return
    try {
      await onRemoveSupplement(id)
      onNotify('Takviye / yem silindi')
    } finally {
      setEditingSup(null)
    }
  }

  return (
    <div className="medications-page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2>{dispTr('İlaçlar, Tedavi & Aşı Takibi')}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {dispTr('Hastalık tedavileri, dozaj rehberi ve kuşlara yapılan tarihli aşı uygulamaları')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'guide' ? (
            <button
              className="btn primary"
              onClick={() => setEditingMed(itemTypeFilter ? { itemType: itemTypeFilter } : {})}
            >
              {dispTr(
                itemTypeFilter === 'vaccine'
                  ? '+ Yeni Aşı'
                  : itemTypeFilter === 'supplement'
                    ? '+ Yeni Takviye'
                    : '+ Yeni İlaç'
              )}
            </button>
          ) : activeTab === 'vaccines' ? (
            <button className="btn primary" onClick={() => setEditingVac({})}>{dispTr('+ Yeni Aşı / Uygulama Kaydet')}</button>
          ) : (
            <button className="btn primary" onClick={() => setEditingSup({})}>{dispTr('+ Yeni Takviye / Yem')}</button>
          )}
        </div>
      </div>

      {/* Ana Sekmeler: İlaç Rehberi & Aşı Takvimi */}
      <div className="med-tabs-bar">
        <button
          className={`btn ${activeTab === 'guide' ? 'primary' : ''}`}
          onClick={() => setActiveTab('guide')}
        >
          {dispTr(`📖 İlaç Rehberi & Dozaj (${medications.length})`)}
        </button>
        <button
          className={`btn ${activeTab === 'vaccines' ? 'primary' : ''}`}
          onClick={() => setActiveTab('vaccines')}
        >
          {dispTr(`💉 Aşı & Uygulama Kayıtları (${vaccinations.length})`)}
          {upcomingVacCount > 0 && (
            <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
              {upcomingVacCount} {dispTr('Yaklaşan')}
            </span>
          )}
        </button>
        <button
          className={`btn ${activeTab === 'supplements' ? 'primary' : ''}`}
          onClick={() => setActiveTab('supplements')}
        >
          {dispTr(`🌾 Takviyeler & Yemler (${(db.supplements || []).length})`)}
        </button>
      </div>

      {/* İlaç / Aşı / Takviye Tür Filtresi Butonları */}
      {activeTab === 'guide' && (
        <div style={{ display: 'flex', gap: 6, width: '100%', marginBottom: 10 }}>
          <button
            type="button"
            className={`btn small ${!itemTypeFilter ? 'primary' : ''}`}
            onClick={() => setItemTypeFilter('')}
            style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center', fontWeight: !itemTypeFilter ? 700 : 500 }}
          >
            {dispTr(`TÜMÜ (${itemTypeCounts.all})`)}
          </button>
          <button
            type="button"
            className={`btn small ${itemTypeFilter === 'medication' ? 'primary' : ''}`}
            onClick={() => setItemTypeFilter(prev => prev === 'medication' ? '' : 'medication')}
            style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center', fontWeight: itemTypeFilter === 'medication' ? 700 : 500 }}
          >
            {dispTr(`💊 İlaç (${itemTypeCounts.medication})`)}
          </button>
          <button
            type="button"
            className={`btn small ${itemTypeFilter === 'vaccine' ? 'primary' : ''}`}
            onClick={() => setItemTypeFilter(prev => prev === 'vaccine' ? '' : 'vaccine')}
            style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center', fontWeight: itemTypeFilter === 'vaccine' ? 700 : 500 }}
          >
            {dispTr(`💉 Aşı (${itemTypeCounts.vaccine})`)}
          </button>
          <button
            type="button"
            className={`btn small ${itemTypeFilter === 'supplement' ? 'primary' : ''}`}
            onClick={() => setItemTypeFilter(prev => prev === 'supplement' ? '' : 'supplement')}
            style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center', fontWeight: itemTypeFilter === 'supplement' ? 700 : 500 }}
          >
            {dispTr(`🌾 Takviye (${itemTypeCounts.supplement})`)}
          </button>
        </div>
      )}

      {/* Arama & Filtre Çubuğu */}
      <div className="toolbar" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder={dispTr(
            activeTab === 'guide'
              ? (itemTypeFilter === 'vaccine'
                ? 'Ara: aşı adı, ne işe yarıyor, dozaj, etken madde…'
                : itemTypeFilter === 'supplement'
                  ? 'Ara: takviye adı, ne işe yarıyor, kullanım, içerik…'
                  : 'Ara: ilaç / aşı / takviye adı, ne işe yarıyor, dozaj, muadili…')
              : activeTab === 'vaccines'
                ? 'Ara: aşı adı, dozaj, uygulayan kişi, not…'
                : 'Ara: takviye / yem adı, ne işe yarıyor, kullanım, içerik, marka…'
          )}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 160 }}
        />

        {activeTab === 'guide' && (
          <>
            {/* Hastalık Seçimi Açılır Menüsü + Yönet Düğmesi */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '1 1 200px', minWidth: 160 }}>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{
                  flex: 1,
                  height: 38,
                  padding: '0 8px',
                  borderRadius: 8,
                  border: selectedCategory ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: selectedCategory ? 'var(--accent-wash)' : 'var(--panel)',
                  color: selectedCategory ? 'var(--accent)' : 'var(--text)',
                  fontWeight: selectedCategory ? 700 : 500,
                  fontSize: 12.5,
                  cursor: 'pointer'
                }}
              >
                <option value="">{dispTr('🩺 Tüm Hastalıklar & Belirtiler')}</option>
                {categories.map(cat => {
                  const count = categoryCounts[cat] || 0
                  return (
                    <option key={cat} value={cat}>
                      {dispTr(`🏷️ ${cat} (${count})`)}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                className="btn small"
                onClick={() => setShowCategoryManager(true)}
                title={dispTr('Kategorileri Yönet')}
                style={{ height: 38, padding: '0 10px', fontSize: 13, flexShrink: 0 }}
              >
                ⚙️
              </button>
            </div>

            {/* İnsan / Hayvan Filtre Butonları */}
            <button
              type="button"
              className={`btn small ${filterHuman ? 'primary' : ''}`}
              onClick={() => setFilterHuman(prev => !prev)}
              style={{
                height: 38,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: filterHuman ? 700 : 500,
                borderRadius: 8,
                border: filterHuman ? '1.5px solid #3b82f6' : '1px solid var(--line)',
                background: filterHuman ? '#3b82f622' : 'var(--panel)',
                color: filterHuman ? '#60a5fa' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0
              }}
              title={dispTr('Sadece insan ilaçlarını filtrele')}
            >
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#3b82f6' }} />
              {dispTr('İnsan')}{humanCount > 0 ? ` (${humanCount})` : ''}
            </button>

            <button
              type="button"
              className={`btn small ${filterAnimal ? 'primary' : ''}`}
              onClick={() => setFilterAnimal(prev => !prev)}
              style={{
                height: 38,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: filterAnimal ? 700 : 500,
                borderRadius: 8,
                border: filterAnimal ? '1.5px solid #10b981' : '1px solid var(--line)',
                background: filterAnimal ? '#10b98122' : 'var(--panel)',
                color: filterAnimal ? '#34d399' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0
              }}
              title={dispTr('Sadece hayvan ilaçlarını filtrele')}
            >
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
              {dispTr('Veteriner')}{animalCount > 0 ? ` (${animalCount})` : ''}
            </button>

            {hasGuideFilter && (
              <button
                type="button"
                className="btn small danger"
                onClick={resetGuideFilters}
                style={{ height: 38, padding: '0 10px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                title={dispTr('Tüm filtreleri ve aramayı temizle')}
              >
                {dispTr('✕ Temizle')}
              </button>
            )}
          </>
        )}

        {activeTab === 'supplements' && (
          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <button
              type="button"
              className={`btn small ${!supKindFilter ? 'primary' : ''}`}
              onClick={() => setSupKindFilter('')}
              style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center' }}
            >
              {dispTr(`TÜMÜ (${supplementCounts.all})`)}
            </button>
            <button
              type="button"
              className={`btn small ${supKindFilter === 'supplement' ? 'primary' : ''}`}
              onClick={() => setSupKindFilter(prev => prev === 'supplement' ? '' : 'supplement')}
              style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center' }}
            >
              {dispTr(`💪 Takviye (${supplementCounts.supplement})`)}
            </button>
            <button
              type="button"
              className={`btn small ${supKindFilter === 'feed' ? 'primary' : ''}`}
              onClick={() => setSupKindFilter(prev => prev === 'feed' ? '' : 'feed')}
              style={{ flex: '1 1 0', justifyContent: 'center', textAlign: 'center' }}
            >
              {dispTr(`🌾 Yem (${supplementCounts.feed})`)}
            </button>
          </div>
        )}

        <div className="spacer" />

        <span className="muted count" style={{ flexShrink: 0 }}>
          {dispTr(activeTab === 'guide'
            ? `${medications.length} kayıt`
            : activeTab === 'vaccines'
              ? `${vaccinations.length} kayıt`
              : `${supplements.length} kayıt`)}
        </span>
      </div>

      {/* Aktif Kategori Varsa Bilgi Çubuğu */}
      {activeTab === 'guide' && selectedCategory && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            padding: '8px 12px',
            background: 'var(--accent-wash)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            fontSize: 12.5,
            flexWrap: 'wrap',
            gap: 6
          }}
        >
          <div>
            <strong>{dispTr('🎯 ')}&quot;{dispTr(selectedCategory)}&quot;</strong> {dispTr('için kullanılması gereken ilaçlar listeleniyor (')}<b>{medications.length}</b> {dispTr('adet bulundu)')}
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => setSelectedCategory('')}
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            {dispTr('Filtreyi Kaldır ✕')}
          </button>
        </div>
      )}

      {/* ---------------- SEKMEYE GÖRE İÇERİK ---------------- */}
      {activeTab === 'guide' ? (
        /* İlaç Rehberi Kart Listesi */
        <div className="medications-cards-list">
          {medications.length === 0 && (
            <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
              <p className="muted">
                {dispTr(hasGuideFilter
                  ? `Seçilen filtreye (${selectedCategory ? `"${selectedCategory}"` : 'arama'}) uygun ilaç bulunamadı.`
                  : 'Henüz ilaç kaydı yok. "Yeni İlaç" ile başlayın.')}
              </p>
              {hasGuideFilter && (
                <button className="btn" style={{ marginTop: 8 }} onClick={resetGuideFilters}>
                  {dispTr('Filtreleri Sıfırla')}
                </button>
              )}
            </div>
          )}

          {medications.map(m => {
            const isVac = m.itemType === 'vaccine'
            const isSup = m.itemType === 'supplement'
            const kindClass = isVac ? 'kind-vac' : isSup ? 'kind-sup' : 'kind-med'
            return (
              <div
                key={m.id}
                className={`panel med-card ${kindClass}${openId === m.id ? ' open' : ''}`}
                onClick={() => setOpenId(o => o === m.id ? null : m.id)}
              >
                {/* 1. SATIR: İsim + Tür Rozetleri + Açma İkonu */}
                <div className="med-head">
                  <div className="med-title">
                    <span className="med-name">{m.name}</span>
                    {isVac ? (
                      <span className="tag kind-tag kind-vaccine">{dispTr('💉 AŞI')}</span>
                    ) : isSup ? (
                      <span className="tag kind-tag kind-supplement">{dispTr('🌾 TAKVİYE')}</span>
                    ) : (
                      <span className="tag kind-tag kind-medication">{dispTr('💊 İLAÇ')}</span>
                    )}
                    {m.forHuman && (
                      <span className="tag kind-tag kind-human">{dispTr('🔵 İNSAN')}</span>
                    )}
                    {m.forAnimal && (
                      <span className="tag kind-tag kind-animal">{dispTr('🟢 VETERİNER')}</span>
                    )}
                  </div>
                  <span
                    className="med-go"
                    style={{
                      width: 26,
                      height: 26,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      background: 'var(--panel-2)',
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    {openId === m.id ? '▲' : '▼'}
                  </span>
                </div>

                {/* 2. SATIR: Kısa Bilgi Rozetleri (Dozaj, Etken Madde, Eczane Muadili) */}
                <div className="med-preview" style={{ marginTop: 8 }}>
                  {m.dosage && <span className="tag">{dispTr(`💧 Dozaj: ${m.dosage}`)}</span>}
                  {m.activeIngredient && <span className="tag">{dispTr(`🧪 Etken: ${m.activeIngredient}`)}</span>}
                  {m.alternative && <span className="tag muted">{dispTr(`Muadil: ${m.alternative}`)}</span>}
                  {m.pharmacyAlternative && (
                    <span
                      className="tag"
                      style={{
                        background: '#10b98122',
                        color: '#10b981',
                        borderColor: '#10b98160',
                        fontWeight: 600
                      }}
                      title={dispTr('Veteriner ilacı bulunamadığında insan eczanesinden temin edilebilir')}
                    >
                      {dispTr(`🏥 Eczane: ${m.pharmacyAlternative}`)}
                    </span>
                  )}
                  {!m.dosage && !m.activeIngredient && !m.alternative && !m.pharmacyAlternative && m.purpose && (
                    <span className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {dispTr(m.purpose)}
                    </span>
                  )}
                </div>

                {/* 3. SATIR: İlacın Kategorileri / Hastalık Etiketleri */}
                {Array.isArray(m.categories) && m.categories.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                    {m.categories.map(cat => (
                      <span
                        key={cat}
                        className="tag"
                        style={{
                          fontSize: 10.5,
                          background: selectedCategory === cat ? 'var(--accent)' : 'var(--panel-2)',
                          color: selectedCategory === cat ? '#fff' : 'var(--text)',
                          borderColor: selectedCategory === cat ? 'var(--accent)' : 'var(--line)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                        title={`"${cat}" kategorisine göre filtrele`}
                      >
                        {dispTr(`🏷️ ${cat}`)}
                      </span>
                    ))}
                  </div>
                )}

                {/* AÇIK DETAY ALANI (Tıklandığında tüm satır başları ve biçimlendirmeler korunarak açılır) */}
                {openId === m.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
                    {/* Ne İşe Yarar / Tedavi Alanı — white-space: pre-wrap ile tüm satır başları, yıldızlar ve paragraflar korunur */}
                    {m.purpose && (
                      <div
                        className="med-purpose"
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          lineHeight: 1.6,
                          fontSize: 13,
                          color: 'var(--text)',
                          padding: '12px 14px',
                          background: 'var(--panel-2)',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          marginBottom: 12
                        }}
                      >
                        {dispTr(m.purpose)}
                      </div>
                    )}
                    {m.pharmacyAlternative && (
                      <div
                        style={{
                          marginBottom: 10,
                          padding: '10px 14px',
                          background: '#10b98115',
                          border: '1px solid #10b98140',
                          borderRadius: 8,
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12
                        }}
                      >
                        <span style={{ fontSize: 24 }}>🏥</span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#10b981' }}>
                            {dispTr(`Eczane Muadili: ${m.pharmacyAlternative}`)}
                          </div>
                          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                            {dispTr('Veteriner ilacını bulamazsanız, insan eczanesinden bu muadili temin edebilirsiniz.')}
                          </div>
                        </div>
                      </div>
                    )}

                    {m.alternative && (
                      <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                        <span className="muted">{dispTr('Veteriner Muadili:')} </span>
                        <strong>{dispTr(m.alternative)}</strong>
                      </div>
                    )}

                    {m.notes && (
                      <div style={{ fontSize: 12.5, marginBottom: 8, color: 'var(--muted)', fontStyle: 'italic' }}>
                        {dispTr(`Not: ${m.notes}`)}
                      </div>
                    )}

                    <div className="med-row-actions" style={{ marginTop: 10 }}>
                      <button className="btn small primary" onClick={() => setEditingMed(m)}>{dispTr('Düzenle')}</button>
                      <button className="btn small danger" onClick={() => handleMedDelete(m.id)}>{dispTr('Sil')}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : activeTab === 'vaccines' ? (
        /* Aşı ve Uygulama Kayıtları Listesi */
        <div className="vaccinations-list">
          {vaccinations.length === 0 && (
            <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
              <p className="muted">{dispTr('Henüz kayıtlı aşı veya toplu tedavi uygulaması yok.')}</p>
              <button className="btn primary" onClick={() => setEditingVac({})}>
                {dispTr('+ İlk Aşı Kaydını Ekle')}
              </button>
            </div>
          )}

          {vaccinations.map(v => {
            const today = todayIso()
            const diffNext = v.nextDate ? diffDays(v.nextDate, today) : null

            return (
              <div key={v.id} className="panel" style={{ marginBottom: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{dispTr(`💉 ${v.name}`)}</span>
                      <span className="tag" style={{ background: 'var(--panel-2)', fontWeight: 600 }}>
                        {fmtDate(v.date)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {v.targetType === 'all' ? (
                        <span className="tag" style={{ background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                          {dispTr('🏠 Tüm Kümese Uygulandı')}
                        </span>
                      ) : v.targetType === 'other' ? (
                        <span
                          className="tag"
                          style={{
                            background: '#e0e7ff',
                            color: '#3730a3',
                            borderColor: '#c7d2fe',
                            fontWeight: 700
                          }}
                        >
                          {dispTr(`🏷️ ${v.targetOther || 'Özel Grup'}`)}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="muted" style={{ fontSize: 12 }}>{dispTr('Uygulanan Kuşlar:')}</span>
                          {(v.birdIds || []).map(bid => {
                            const b = byId(db.birds, bid)
                            return b ? (
                              <span
                                key={bid}
                                onClick={() => onOpenBird && onOpenBird(bid)}
                                style={{ cursor: onOpenBird ? 'pointer' : 'default' }}
                              >
                                <Ring text={ringOf(b)} />
                              </span>
                            ) : null
                          })}
                        </div>
                      )}

                      {v.dosage && <span className="tag">{dispTr(`Dozaj / Yol: ${v.dosage}`)}</span>}
                      {v.administeredBy && <span className="tag muted">{dispTr(`Yapan: ${v.administeredBy}`)}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn small" onClick={() => setEditingVac(v)}>{dispTr('Düzenle')}</button>
                    <button className="btn small danger" onClick={() => handleVacDelete(v.id)}>{dispTr('Sil')}</button>
                  </div>
                </div>

                {/* Tekrar Aşı Tarihi & Alarmlar */}
                {v.nextDate && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {dispTr(`Bir Sonraki Tekrar Tarihi: ${fmtDate(v.nextDate)}`)}
                    </span>

                    {diffNext !== null && diffNext <= 0 && (
                      <span className="tag" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>
                        {dispTr(`⚠️ Tekrar Aşı Zamanı Geldi! (${Math.abs(diffNext)} gün önce doldu)`)}
                      </span>
                    )}

                    {diffNext !== null && diffNext > 0 && diffNext <= 15 && (
                      <span className="tag" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                        {dispTr(`🔔 Tekrar Aşısına ${diffNext} Gün Kaldı`)}
                      </span>
                    )}

                    {diffNext !== null && diffNext > 15 && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {dispTr(`(${diffNext} gün sonra)`)}
                      </span>
                    )}
                  </div>
                )}

                {v.notes && (
                  <div className="hint" style={{ marginTop: 10 }}>
                    {dispTr(`📝 ${v.notes}`)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Takviyeler & Yemler Kart Listesi */
        <div className="medications-cards-list">
          {supplements.length === 0 && (
            <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
              <p className="muted">
                {dispTr(search || supKindFilter
                  ? 'Arama veya türe uygun takviye / yem bulunamadı.'
                  : 'Henüz takviye veya yem kaydı yok. "Yeni Takviye / Yem" ile başlayın.')}
              </p>
              {(search || supKindFilter) && (
                <button
                  className="btn"
                  style={{ marginTop: 8 }}
                  onClick={() => { setSearch(''); setSupKindFilter('') }}
                >
                  {dispTr('Filtreleri Sıfırla')}
                </button>
              )}
            </div>
          )}

          {supplements.map(sup => {
            const isFeed = sup.kind === 'feed'
            return (
              <div
                key={sup.id}
                className={`panel med-card${openId === sup.id ? ' open' : ''}`}
                onClick={() => setOpenId(o => o === sup.id ? null : sup.id)}
              >
                <div className="med-head">
                  <div className="med-title">
                    <span className="med-name">{sup.name}</span>
                    <span className={`tag kind-tag ${isFeed ? 'kind-feed' : 'kind-supplement'}`}>
                      {dispTr(isFeed ? 'YEM' : 'TAKVİYE')}
                    </span>
                  </div>
                  <span className="med-go">{openId === sup.id ? '↑' : '↓'}</span>
                </div>

                <div className="med-preview">
                  {sup.brand && <span className="tag">{dispTr(`Marka: ${sup.brand}`)}</span>}
                  {sup.usage && <span className="tag">{dispTr(`Kullanım: ${sup.usage}`)}</span>}
                  {sup.content && <span className="tag">{dispTr(`İçerik: ${sup.content}`)}</span>}
                  {!sup.brand && !sup.usage && !sup.content && sup.purpose && (
                    <span className="muted">{sup.purpose}</span>
                  )}
                </div>

                {openId === sup.id && (
                  <>
                    {sup.purpose && (sup.brand || sup.usage || sup.content) && (
                      <div className="med-purpose">{sup.purpose}</div>
                    )}

                    {(sup.brand || sup.usage || sup.content) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {sup.brand && <span className="tag">{dispTr(`Marka: ${sup.brand}`)}</span>}
                        {sup.usage && <span className="tag">{dispTr(`Kullanım / Doz: ${sup.usage}`)}</span>}
                        {sup.content && <span className="tag">{dispTr(`İçerik: ${sup.content}`)}</span>}
                      </div>
                    )}

                    {sup.notes && (
                      <div className="hint" style={{ marginTop: 10 }}>
                        {dispTr(`📝 ${sup.notes}`)}
                      </div>
                    )}

                    <div className="med-row-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn small primary" onClick={() => setEditingSup(sup)}>{dispTr('Düzenle')}</button>
                      <button className="btn small danger" onClick={() => handleSupDelete(sup.id)}>{dispTr('Sil')}</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* İlaç Ekleme / Düzenleme Modalı */}
      {editingMed && (
        <MedicationModal
          medication={editingMed}
          availableCategories={categories}
          onAddNewCategory={handleAddCategory}
          onSave={handleMedSubmit}
          onDelete={handleMedDelete}
          onCancel={() => setEditingMed(null)}
        />
      )}

      {/* Kategorileri Yönet Modalı */}
      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          categoryCounts={categoryCounts}
          onAddCategory={handleAddCategory}
          onRemoveCategory={handleRemoveCategory}
          onResetDefaults={handleResetDefaultCategories}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {/* Aşı Kaydı Ekleme / Düzenleme Modalı */}
      {editingVac && (
        <VaccinationModal
          initial={editingVac}
          birds={db.birds || []}
          onSave={handleVacSubmit}
          onCancel={() => setEditingVac(null)}
        />
      )}

      {/* Takviye / Yem Ekleme / Düzenleme Modalı */}
      {editingSup && (
        <SupplementModal
          initial={editingSup}
          onSave={handleSupSubmit}
          onDelete={handleSupDelete}
          onCancel={() => setEditingSup(null)}
        />
      )}
    </div>
  )
}

function MedicationModal({ medication, availableCategories = [], onAddNewCategory, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    name: medication?.name || '',
    purpose: medication?.purpose || '',
    dosage: medication?.dosage || '',
    alternative: medication?.alternative || '',
    pharmacyAlternative: medication?.pharmacyAlternative || '',
    activeIngredient: medication?.activeIngredient || '',
    categories: Array.isArray(medication?.categories) ? [...medication.categories] : [],
    forHuman: !!medication?.forHuman,
    forAnimal: !!medication?.forAnimal,
    itemType: medication?.itemType || 'medication'
  })

  const [newCatInput, setNewCatInput] = useState('')

  // İmleç kaymasını ve yazıların birbirine girmesini önlemek için yazarken ham metin tutulur
  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const toggleCategory = (cat) => {
    setForm(prev => {
      const exists = prev.categories.includes(cat)
      const next = exists ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat]
      return { ...prev, categories: next }
    })
  }

  const handleCreateCategory = async () => {
    const clean = trUpper(newCatInput).trim()
    if (!clean) return
    if (!form.categories.includes(clean)) {
      setForm(prev => ({ ...prev, categories: [...prev.categories, clean] }))
    }
    if (onAddNewCategory) {
      await onAddNewCategory(clean)
    }
    setNewCatInput('')
  }

  const setKind = (kind, val) => {
    if (kind === 'human') {
      setForm(p => ({ ...p, forHuman: val, forAnimal: val ? false : p.forAnimal }))
    } else {
      setForm(p => ({ ...p, forAnimal: val, forHuman: val ? false : p.forHuman }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...medication,
      id: medication?.id || uid(),
      ...form,
      itemType: form.itemType || 'medication',
      name: trUpper(form.name).trim(),
      purpose: form.purpose.trim(),
      dosage: trUpper(form.dosage).trim(),
      alternative: trUpper(form.alternative).trim(),
      pharmacyAlternative: trUpper(form.pharmacyAlternative || '').trim(),
      activeIngredient: trUpper(form.activeIngredient).trim(),
      categories: sortTr(form.categories),
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h2>
            {dispTr(
              medication?.id
                ? (form.itemType === 'vaccine'
                    ? 'AŞIYI DÜZENLE'
                    : form.itemType === 'supplement'
                      ? 'TAKVİYEYİ DÜZENLE'
                      : 'İlACI DÜZENLE')
                : (form.itemType === 'vaccine'
                    ? 'YENİ AŞI EKLE'
                    : form.itemType === 'supplement'
                      ? 'YENİ TAKVİYE EKLE'
                      : 'YENİ İLAÇ EKLE')
            )}
          </h2>
          <button type="button" className="x" onClick={onCancel} aria-label="Kapat">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Kayıt Türü Seçimi: İlaç / Aşı / Takviye */}
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{dispTr('Kayıt Türü *')}</span>
              <span className="muted" style={{ fontSize: 11 }}>{dispTr('(Ne kaydetmek istiyorsunuz?)')}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className={`btn ${form.itemType === 'medication' ? 'primary' : ''}`}
                onClick={() => handleChange('itemType', 'medication')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  fontWeight: form.itemType === 'medication' ? 700 : 500,
                  fontSize: 13,
                  borderRadius: 8
                }}
              >
                <span>💊</span>
                <span>{dispTr('İlaç')}</span>
              </button>
              <button
                type="button"
                className={`btn ${form.itemType === 'vaccine' ? 'primary' : ''}`}
                onClick={() => handleChange('itemType', 'vaccine')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  fontWeight: form.itemType === 'vaccine' ? 700 : 500,
                  fontSize: 13,
                  borderRadius: 8
                }}
              >
                <span>💉</span>
                <span>{dispTr('Aşı')}</span>
              </button>
              <button
                type="button"
                className={`btn ${form.itemType === 'supplement' ? 'primary' : ''}`}
                onClick={() => handleChange('itemType', 'supplement')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  fontWeight: form.itemType === 'supplement' ? 700 : 500,
                  fontSize: 13,
                  borderRadius: 8
                }}
              >
                <span>🌾</span>
                <span>{dispTr('Takviye')}</span>
              </button>
            </div>
          </div>

          <div className="field">
            <label>
              <span>
                {dispTr(
                  form.itemType === 'vaccine'
                    ? 'Aşı Adı *'
                    : form.itemType === 'supplement'
                      ? 'Takviye Adı *'
                      : 'İlaç Adı *'
                )}
              </span>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder={dispTr(
                  form.itemType === 'vaccine'
                    ? 'Örn: Salmonella Aşısı, Çiçek Aşısı, Difilin…'
                    : form.itemType === 'supplement'
                      ? 'Örn: B-Kompleks, Probiyotik, Bira Mayası, Elektrolit…'
                      : 'Örn: Baytril, Ronidazole, Amoksisilin…'
                )}
              />
            </label>
          </div>

          {/* Kategori Seçimi (Göz sulanması, hırıltı, kanat tutulması vb.) */}
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{dispTr('Hastalık & Tedavi Kategorileri (Hangi hastalıklarda kullanılır?):')}</span>
              <span className="muted" style={{ fontSize: 11 }}>{dispTr('Birden fazla seçebilirsiniz')}</span>
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 4,
                marginBottom: 8,
                maxHeight: 120,
                overflowY: 'auto',
                padding: 6,
                background: 'var(--panel-2)',
                borderRadius: 8,
                border: '1px solid var(--line)'
              }}
            >
              {availableCategories.map(cat => {
                const selected = form.categories.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`btn small ${selected ? 'primary' : ''}`}
                    style={{
                      borderRadius: 16,
                      fontSize: 11.5,
                      padding: '3px 10px',
                      background: selected ? 'var(--accent)' : 'var(--panel)',
                      borderColor: selected ? 'var(--accent)' : 'var(--line)',
                      color: selected ? '#fff' : 'inherit'
                    }}
                  >
                    {dispTr(selected ? '✓ ' : '+ ')} {dispTr(cat)}
                  </button>
                )
              })}
            </div>

            {/* Yeni Kategori Ekleme Satırı */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder={dispTr('Örn: GÖZ SULANMASI, HIRILTI, KANAT TUTULMASI…')}
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateCategory()
                  }
                }}
                style={{ fontSize: 12 }}
              />
              <button
                type="button"
                className="btn small"
                onClick={handleCreateCategory}
                disabled={!newCatInput.trim()}
                style={{ whiteSpace: 'nowrap', fontSize: 12 }}
              >
                {dispTr('+ Kategori Ekle')}
              </button>
            </div>
          </div>

          <div className="field">
            <label>
              <span>{dispTr('Ne İşe Yarıyor / Tedavi Alanı')}</span>
              <textarea
                rows={3}
                value={form.purpose}
                onChange={e => handleChange('purpose', e.target.value)}
                placeholder={dispTr('Örn: Solunum yolu enfeksiyonları, kursak mantarı, çiçek hastalığı…')}
              />
            </label>
          </div>

          <div className="field">
            <label>{dispTr('İlaç Türü')}</label>
            <div className="kind-picker">
              <label className="kind-opt">
                <input
                  type="checkbox"
                  checked={form.forHuman}
                  onChange={e => setKind('human', e.target.checked)}
                />
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4aa3f0', marginRight: 4 }} />
                <span>{dispTr('İnsan İlacı')}</span>
              </label>
              <label className="kind-opt">
                <input
                  type="checkbox"
                  checked={form.forAnimal}
                  onChange={e => setKind('animal', e.target.checked)}
                />
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3fbf5f', marginRight: 4 }} />
                <span>{dispTr('Hayvan İlacı')}</span>
              </label>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>
                <span>{dispTr('Dozaj')}</span>
                <input
                  type="text"
                  value={form.dosage}
                  onChange={e => handleChange('dosage', e.target.value)}
                  placeholder={dispTr('Örn: 1 litre suya 2 ml, 1 tablet…')}
                />
              </label>
            </div>
            <div className="field">
              <label>
                <span>{dispTr('Etken Maddesi')}</span>
                <input
                  type="text"
                  value={form.activeIngredient}
                  onChange={e => handleChange('activeIngredient', e.target.value)}
                  placeholder={dispTr('Örn: Enrofloxacin, Doxycycline…')}
                />
              </label>
            </div>
          </div>

          {/* Muadili ve Sağına Eczane Muadili */}
          <div className="form-grid" style={{ marginTop: 2 }}>
            <div className="field">
              <label>
                <span>{dispTr('Muadili (Veteriner Muadili)')}</span>
                <input
                  type="text"
                  value={form.alternative}
                  onChange={e => handleChange('alternative', e.target.value)}
                  placeholder={dispTr('Örn: Enrocin, Doxibiotic, Ronidazole 40…')}
                />
              </label>
            </div>
            <div className="field">
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 700 }}>
                  <span>{dispTr('🏥 Eczane Muadili')}</span>
                  <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{dispTr('(İnsan Eczanesi)')}</span>
                </span>
                <input
                  type="text"
                  value={form.pharmacyAlternative}
                  onChange={e => handleChange('pharmacyAlternative', e.target.value)}
                  placeholder={dispTr('Örn: Tetradox, Monodoks, Flagyl, Cipro…')}
                  style={{ borderColor: form.pharmacyAlternative ? '#10b981' : undefined }}
                />
              </label>
            </div>
          </div>
          <p className="hint" style={{ marginTop: -4, marginBottom: 12, fontSize: 11.5 }}>
            {dispTr('💡 ')}<b>{dispTr('Eczane Muadili:')}</b> {dispTr('Veteriner ilacını bulamadığınızda, nöbetçi/beşeri eczaneden hemen temin edebileceğiniz karşılığıdır.')}
          </p>

          <div className="form-actions">
            {medication?.id && (
              <button type="button" className="btn danger" onClick={() => onDelete(medication.id)}>
                {dispTr('Sil')}
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="btn" onClick={onCancel}>{dispTr('İptal')}</button>
            <button type="submit" className="btn primary">{dispTr(medication?.id ? 'Güncelle' : 'Kaydet')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VaccinationModal({ initial, birds, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || '')
  const [date, setDate] = useState(initial.date || todayIso())
  const [targetType, setTargetType] = useState(initial.targetType || 'all')
  const [targetOther, setTargetOther] = useState(initial.targetOther || '')
  const [selectedBirds, setSelectedBirds] = useState(new Set(initial.birdIds || []))
  const [dosage, setDosage] = useState(initial.dosage || '')
  const [nextDate, setNextDate] = useState(initial.nextDate || '')
  const [administeredBy, setAdministeredBy] = useState(initial.administeredBy || '')
  const [notes, setNotes] = useState(initial.notes || '')

  const sortedBirds = useMemo(() => [...birds].sort(compareBirds), [birds])

  const toggleBird = (id) => {
    setSelectedBirds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    if (targetType === 'other' && !targetOther.trim()) {
      alert(dispTr('Lütfen aşı uygulanan grubu veya açıklamayı yazın.'))
      return
    }

    onSave({
      ...initial,
      id: initial.id || uid(),
      name: trUpper(name.trim()),
      date,
      targetType,
      targetOther: targetType === 'other' ? trUpper(targetOther.trim()) : '',
      birdIds: targetType === 'selected' ? Array.from(selectedBirds) : [],
      dosage: trUpper(dosage.trim()),
      nextDate: nextDate || null,
      administeredBy: trUpper(administeredBy.trim()),
      notes: trUpper(notes.trim()),
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-head">
          <h2>{dispTr(initial.id ? 'AŞI / UYGULAMA KAYDINI DÜZENLE' : 'YENİ AŞI / TEDAVİ UYGULAMASI')}</h2>
          <button type="button" className="x" onClick={onCancel} aria-label="Kapat">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Aşı Adı */}
          <div className="field">
            <label>{dispTr('Aşı / İlaç Adı *')}</label>
            <input
              type="text"
              required
              placeholder={dispTr('Örn: PMV-1 Veba Aşısı, Çiçek Aşısı, Salmonella, İç Parazit...')}
              value={name}
              onChange={e => setName(e.target.value)}
              title="Aşı / uygulama adı — mevcut ilaçlardan öneri almaz"
            />
          </div>

          {/* Tarih ve Dozaj */}
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>{dispTr('Uygulama Tarihi *')}</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>{dispTr('Dozaj & Yöntem')}</label>
              <input
                type="text"
                placeholder={dispTr('Örn: Deri altı 0.25 ml, 1 lt suya 2 gr...')}
                value={dosage}
                onChange={e => setDosage(e.target.value)}
              />
            </div>
          </div>

          {/* Hedef Kuşlar — Görsel Olarak Düzenlenmiş ve Diğer / Özel Seçenekli */}
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span>{dispTr('Kime Uygulandı? *')}</span>
              <span className="muted" style={{ fontSize: 11 }}>
                {targetType === 'all'
                  ? dispTr('Tüm kümese toplu aşı')
                  : targetType === 'selected'
                    ? dispTr(`${selectedBirds.size} kuş seçildi`)
                    : dispTr('Özel etiket veya grup')}
              </span>
            </label>

            {/* 3'lü Seçim Butonları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                className={`btn ${targetType === 'all' ? 'primary' : ''}`}
                onClick={() => setTargetType('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 10px',
                  fontWeight: targetType === 'all' ? 700 : 500,
                  fontSize: 12.5,
                  borderRadius: 8
                }}
              >
                <span>🏠</span>
                <span>{dispTr('Tüm Kümese')}</span>
              </button>

              <button
                type="button"
                className={`btn ${targetType === 'selected' ? 'primary' : ''}`}
                onClick={() => setTargetType('selected')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 10px',
                  fontWeight: targetType === 'selected' ? 700 : 500,
                  fontSize: 12.5,
                  borderRadius: 8
                }}
              >
                <span>🕊️</span>
                <span>{dispTr('Seçili Kuşlara')}</span>
              </button>

              <button
                type="button"
                className={`btn ${targetType === 'other' ? 'primary' : ''}`}
                onClick={() => setTargetType('other')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 10px',
                  fontWeight: targetType === 'other' ? 700 : 500,
                  fontSize: 12.5,
                  borderRadius: 8
                }}
              >
                <span>🏷️</span>
                <span>{dispTr('Diğer / Özel')}</span>
              </button>
            </div>

            {/* Diğer seçildiğinde açılan elle veri giriş alanı */}
            {targetType === 'other' && (
              <div
                style={{
                  background: 'var(--panel-2)',
                  border: '1px solid var(--accent, #38bdf8)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>✍️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {dispTr('Özel Grup veya Etiket Tanımı')}
                  </span>
                </div>

                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={dispTr('Örn: YEŞİL ETİKETLİLER, KIRMIZI ETİKETLİLER, DAMIZLIKLAR…')}
                  value={targetOther}
                  onChange={e => setTargetOther(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                />

                {/* Hızlı Seçim Rozetleri */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 11 }}>{dispTr('Hızlı Seç:')}</span>
                  {['YEŞİL ETİKETLİLER', 'KIRMIZI ETİKETLİLER', 'SARI ETİKETLİLER', 'DAMIZLIK KUŞLAR', 'GENÇ YAVRULAR', 'UÇAN SAYA'].map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      className="btn small"
                      onClick={() => setTargetOther(suggestion)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        borderRadius: 14,
                        background: targetOther === suggestion ? 'var(--accent)' : 'var(--panel)',
                        color: targetOther === suggestion ? '#fff' : 'var(--text)',
                        borderColor: targetOther === suggestion ? 'var(--accent)' : 'var(--line)'
                      }}
                    >
                      {dispTr(suggestion)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seçili Kuşlar Listesi */}
            {targetType === 'selected' && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, background: 'var(--panel-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {dispTr(`Kuş Seçimi (${selectedBirds.size} / ${sortedBirds.length})`)}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setSelectedBirds(new Set(sortedBirds.map(b => b.id)))}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      {dispTr('Tümünü Seç')}
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setSelectedBirds(new Set())}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      {dispTr('Temizle')}
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {sortedBirds.map(b => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <input
                        type="checkbox"
                        checked={selectedBirds.has(b.id)}
                        onChange={() => toggleBird(b.id)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>{ringOf(b)} {b.name && b.name !== ringOf(b) ? dispTr(`· ${b.name}`) : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tekrar Tarihi ve Uygulayan Kişi */}
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>{dispTr('Tekrar Aşı Tarihi (Opsiyonel)')}</label>
              <input
                type="date"
                value={nextDate}
                onChange={e => setNextDate(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>{dispTr('Uygulayan Kişi')}</label>
              <input
                type="text"
                placeholder={dispTr('Örn: Göksel, Abim...')}
                value={administeredBy}
                onChange={e => setAdministeredBy(e.target.value)}
              />
            </div>
          </div>

          {/* Notlar */}
          <div className="field">
            <label>{dispTr('Notlar')}</label>
            <textarea
              rows={2}
              placeholder={dispTr('Aşı seri no, saklama koşulu, kuşların durumu...')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary">{dispTr('Kaydet')}</button>
            <button type="button" className="btn" onClick={onCancel}>{dispTr('İptal')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Takviye / yem rehberi kaydı. İlaç rehberiyle aynı kart düzeninde
 * gösterilir; burada yalnızca ad, tür ve kısa bilgi alanları tutulur.
 */
function SupplementModal({ initial, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    kind: initial?.kind === 'feed' ? 'feed' : 'supplement',
    purpose: initial?.purpose || '',
    usage: initial?.usage || '',
    content: initial?.content || '',
    brand: initial?.brand || '',
    notes: initial?.notes || ''
  })

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...initial,
      id: initial?.id || uid(),
      name: trUpper(form.name).trim(),
      kind: form.kind === 'feed' ? 'feed' : 'supplement',
      purpose: form.purpose.trim(),
      usage: trUpper(form.usage).trim(),
      content: trUpper(form.content).trim(),
      brand: trUpper(form.brand).trim(),
      notes: trUpper(form.notes).trim(),
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h2>{dispTr(initial?.id ? 'TAKVİYE / YEM DÜZENLE' : 'YENİ TAKVİYE / YEM EKLE')}</h2>
          <button type="button" className="x" onClick={onCancel} aria-label="Kapat">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>
              <span>{dispTr('Adı *')}</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder={dispTr('Örn: B12 Vitamini, Kalsiyum, Mercimek, Güvercin Yemi…')}
              />
            </label>
          </div>

          <div className="field">
            <label>{dispTr('Türü')}</label>
            <div className="kind-picker">
              <label className="kind-opt">
                <input
                  type="radio"
                  name="supplementKind"
                  checked={form.kind === 'supplement'}
                  onChange={() => handleChange('kind', 'supplement')}
                />
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', marginRight: 4 }} />
                <span>{dispTr('Takviye')}</span>
              </label>
              <label className="kind-opt">
                <input
                  type="radio"
                  name="supplementKind"
                  checked={form.kind === 'feed'}
                  onChange={() => handleChange('kind', 'feed')}
                />
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#a3e635', marginRight: 4 }} />
                <span>{dispTr('Yem')}</span>
              </label>
            </div>
          </div>

          <div className="field">
            <label>
              <span>{dispTr('Ne İşe Yarar?')}</span>
              <textarea
                rows={3}
                value={form.purpose}
                onChange={e => handleChange('purpose', e.target.value)}
                placeholder={dispTr('Örn: Tüy döneminde tüylerin sağlıklı çıkmasını destekler, bağışıklığı güçlendirir…')}
              />
            </label>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>
                <span>{dispTr('Kullanım / Dozaj')}</span>
                <input
                  type="text"
                  value={form.usage}
                  onChange={e => handleChange('usage', e.target.value)}
                  placeholder={dispTr('Örn: Haftada 2 kez, 1 litre suya 5 ml…')}
                />
              </label>
            </div>
            <div className="field">
              <label>
                <span>{dispTr('İçerik / Etken Madde')}</span>
                <input
                  type="text"
                  value={form.content}
                  onChange={e => handleChange('content', e.target.value)}
                  placeholder={dispTr('Örn: Vitamin B kompleksi, kalsiyum, mısır…')}
                />
              </label>
            </div>
          </div>

          <div className="field">
            <label>
              <span>{dispTr('Marka (Opsiyonel)')}</span>
              <input
                type="text"
                value={form.brand}
                onChange={e => handleChange('brand', e.target.value)}
                placeholder={dispTr('Örn: Versele-Laga, Belçika Yemi…')}
              />
            </label>
          </div>

          <div className="field">
            <label>
              <span>{dispTr('Notlar')}</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder={dispTr('Saklama koşulu, kullanım dönemi, dikkat edilmesi gerekenler…')}
              />
            </label>
          </div>

          <div className="form-actions">
            {initial?.id && (
              <button type="button" className="btn danger" onClick={() => onDelete(initial.id)}>
                {dispTr('Sil')}
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="btn" onClick={onCancel}>{dispTr('İptal')}</button>
            <button type="submit" className="btn primary">{dispTr(initial?.id ? 'Güncelle' : 'Kaydet')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CategoryManagerModal({
  categories = [],
  categoryCounts = {},
  onAddCategory,
  onRemoveCategory,
  onResetDefaults,
  onClose
}) {
  const [newCat, setNewCat] = useState('')

  const handleAdd = async (e) => {
    e.preventDefault()
    const clean = trUpper(newCat).trim()
    if (!clean) return
    await onAddCategory(clean)
    setNewCat('')
  }

  return (
    <div className="overlay" style={{ zIndex: 70 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480, width: '100%' }}>
        <div className="modal-head">
          <h2>{dispTr('🩺 İLAÇ & HASTALIK KATEGORİLERİ')}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <div style={{ padding: '0 0 16px' }}>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.45 }}>
            Buradan kendi hastalık ve belirti kategorilerinizi (Göz Sulanması, Hırıltı, Kanat Tutulması vb.) tanımlayabilirsiniz.
            İlaç sekmesinde bu kategorileri seçtiğinizde ilgili ilaçlar listelenir.
          </p>

          {/* Yeni Kategori Ekleme Formu */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Yeni kategori adı (örn: KURSAK MANTARI)"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            <button type="submit" className="btn primary small" disabled={!newCat.trim()}>
              + Ekle
            </button>
          </form>

          {/* Mevcut Kategoriler Listesi */}
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--muted)' }}>
            Mevcut Kategoriler ({categories.length}):
          </div>
          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--panel-2)',
              padding: 6
            }}
          >
            {categories.map(cat => {
              const count = categoryCounts[cat] || 0
              return (
                <div
                  key={cat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    borderBottom: '1px solid var(--line)',
                    background: 'var(--panel)',
                    marginBottom: 4
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>🏷️ {cat}</span>
                    <span className="tag" style={{ fontSize: 10 }}>{count} ilaç</span>
                  </div>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => onRemoveCategory(cat)}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    title="Bu kategoriyi sil"
                  >
                    Sil
                  </button>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <button
              type="button"
              className="btn small"
              onClick={onResetDefaults}
              style={{ fontSize: 11 }}
              title="Varsayılan kategori listesine geri dön"
            >
              ↺ Varsayılanlara Dön
            </button>
            <button type="button" className="btn primary small" onClick={onClose}>
              Tamam
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}