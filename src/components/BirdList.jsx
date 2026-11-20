import { useMemo, useState, useCallback, useEffect } from 'react'
import { SEX, ringOf, compareBirds, statusLabel, isFormer, sortTr, statusFilterOptions, treatmentStatusLabel, foldTr, isDualCode, footCode, footNumber, dispTr, ringChip, isGone, fmtDate } from '../lib.js'
import { coopMatingBreakdown, resolveBirdCoopId, coopList, sortCinsi } from '../coops.js'
import { PhotoImg, openPhoto } from './PhotoViewer.jsx'
import Ring from './Ring.jsx'
import CodePicker from './CodePicker.jsx'
import CoopTag from './CoopTag.jsx'
import { ENABLE_LOFT_CHECK } from './LoftCheck.jsx'

// Kuş listesinin dikey kaydırma pozisyonunu saklar.
// Kullanıcı profil kartına gidip "KUŞ LİSTESİNE DÖN" dediğinde kalınan yere döner.
let savedBirdListScroll = 0
try {
  const s = sessionStorage.getItem('guvercin:bird_list_scroll')
  if (s) savedBirdListScroll = Number(s) || 0
} catch {}

export default function BirdList({ db, allDb, stats, onOpen, onNew, activeCoop }) {
  const coops = useMemo(() => coopList(db), [db.settings])
  const [q, setQ] = useState('')
  const [sex, setSex] = useState('')
  const [status, setStatus] = useState('')
  const [code, setCode] = useState('')
  const [cinsi, setCinsi] = useState('')
  const [photoOnly, setPhotoOnly] = useState(false)
  // Cinsiyeti girilmemiş kuşları topluca bulmak için. Yeni kuş kaydında
  // cinsiyet boş kalabiliyor; o kuşlar eş listesinde de görünmediği için
  // eksikleri görmek zorlaşıyordu.
  const [sexMissing, setSexMissing] = useState(false)
  const [uncheckedOnly, setUncheckedOnly] = useState(false)
  const [showMated, setShowMated] = useState(false)

  // Sayfa kaydırıldıkça pozisyonu güncelle
  useEffect(() => {
    const el = document.querySelector('.body')
    if (!el) return
    const onScroll = () => {
      savedBirdListScroll = el.scrollTop
      try {
        sessionStorage.setItem('guvercin:bird_list_scroll', String(el.scrollTop))
      } catch {}
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Listeye geri dönüldüğünde kalınan scroll pozisyonunu geri yükle
  useEffect(() => {
    const el = document.querySelector('.body')
    if (!el || savedBirdListScroll <= 0) return

    const restore = () => {
      if (el && savedBirdListScroll > 0) {
        el.scrollTop = savedBirdListScroll
      }
    }

    restore()
    const raf = requestAnimationFrame(restore)
    const t1 = setTimeout(restore, 40)
    const t2 = setTimeout(restore, 120)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // Kuş satırına tıklandığında anlık scroll pozisyonunu kesin olarak kaydet
  const handleOpenBird = useCallback((id) => {
    const el = document.querySelector('.body')
    if (el) {
      savedBirdListScroll = el.scrollTop
      try {
        sessionStorage.setItem('guvercin:bird_list_scroll', String(el.scrollTop))
      } catch {}
    }
    onOpen(id)
  }, [onOpen])

  // "Klips Rengiyle Bul": sağ/sol ayak klips rengi seçimi ve bulucu penceresi.
  const [rightSel, setRightSel] = useState('')
  const [leftSel, setLeftSel] = useState('')
  const [findOpen, setFindOpen] = useState(false)

  const rows = useMemo(() => {
    // Türkçe arama: foldTr, ı/İ/i/I harflerinin hepsini aynı forma indirger.
    // Eski kod .toLowerCase() kullanıyordu; "kırmızı" yazınca "KIRMIZI"
    // ile eşleşmiyordu (ı ≠ i). Ayrıca sol/sağ ayak kodu ve federasyon/
    // çip alanları da artık aranıyor.
    const tokens = foldTr(q.trim()).split(/\s+/).filter(Boolean)
    return db.birds
      .filter(b => {
        if (sex && b.sex !== sex) return false
        if (status && (b.status || '') !== status) return false
        if (code === '__gone__') {
          if (!isGone(b)) return false
        } else if (code === '__none__') {
          if (isGone(b) || (b.code || b.leftCode || b.rightCode || '').trim()) return false
        } else if (code) {
          if (isGone(b) || b.code !== code) return false
        }
        if (cinsi && (b.cinsi || '') !== cinsi) return false
        if (photoOnly && !(b.photos || []).length) return false
        if (sexMissing && b.sex) return false
        if (uncheckedOnly && b.checkedAt) return false
        if (rightSel && !birdHasClipColor(b, rightSel, 'right')) return false
        if (leftSel && !birdHasClipColor(b, leftSel, 'left')) return false
        if (!tokens.length) return true
        const hay = foldTr([
          b.name, b.code, b.leftCode, b.rightCode, b.number,
          b.leftNumber, b.rightNumber,
          b.cinsi, b.line, b.color, b.notes,
          b.federationRing, b.chipNo, b.strain, ringOf(b)
        ].filter(Boolean).join(' '))
        return tokens.every(tok => hay.includes(tok))
      })
      .sort(compareBirds)
  }, [db.birds, q, sex, status, code, cinsi, photoOnly, sexMissing, uncheckedOnly, rightSel, leftSel])

  // Sonuç sayısında ölen/kaçan/satılan kuşlar sayılmaz; bunlar ayrı
  // kategoride listelenir ve toplam hesaba dahil değildir.
  const resultCount = code === '__gone__'
    ? rows.length
    : rows.filter(b => !isGone(b)).length

  // Künye kodları TÜRKÇE alfabetik. sortTr: Ç/Ğ/İ/Ö/Ş/Ü doğru sıralanır
  // ve 'ı' 'i' den önce gelir; varsayılan .sort() bunu yapmıyor.
  // Ölen/kaçan/satılan kuşlar aktif künye filtre listesini meşgul etmesin.
  const codes = useMemo(
    () => sortTr([...new Set(db.birds.filter(b => !isGone(b)).map(b => b.code).filter(Boolean))]),
    [db.birds]
  )

  const cinsiler = useMemo(
    () => sortCinsi([...new Set(db.birds.map(b => b.cinsi).filter(Boolean))]),
    [db.birds]
  )

  const hasFilter = Boolean(q || sex || status || code || cinsi || photoOnly || sexMissing || uncheckedOnly || rightSel || leftSel)
  function resetFilters() {
    setQ(''); setSex(''); setStatus(''); setCode(''); setCinsi('')
    setPhotoOnly(false); setSexMissing(false); setUncheckedOnly(false)
    setRightSel(''); setLeftSel('')
  }

  // Cinsiyeti eksik kuş sayısı — filtre başlığında gösterilir.
  const sexMissingCount = useMemo(
    () => db.birds.filter(b => !b.sex).length,
    [db.birds]
  )

  // Kümeste henüz kontrol edilmemiş kuş sayısı
  const uncheckedCount = useMemo(
    () => db.birds.filter(b => !b.checkedAt).length,
    [db.birds]
  )

  // Kuşların aktif hastalık kayıtları
  const activeTreatmentsMap = useMemo(() => {
    const map = new Map()
    for (const t of (db.treatments || [])) {
      if ((t.status === 'aktif' || t.status === 'karantina') && t.birdId) {
        if (!map.has(t.birdId)) map.set(t.birdId, t)
      }
    }
    return map
  }, [db.treatments])

  // Klips / Künye koduna göre gruplama
  const groups = useMemo(() => {
    const map = new Map()
    for (const b of rows) {
      const gone = isGone(b)
      const c = (b.code || '').trim()
      const key = gone ? '__gone__' : (c || '__none__')
      if (!map.has(key)) {
        map.set(key, {
          key,
          code: gone ? '' : c,
          title: gone ? 'ÖLEN / KAÇTI / SATILDI' : (c || 'KLİPSSİZ / TANIMSIZ'),
          isNone: !c && !gone,
          isGone: gone,
          birds: []
        })
      }
      map.get(key).birds.push(b)
    }

    const namedGroups = Array.from(map.values()).filter(g => !g.isNone && !g.isGone)
    namedGroups.sort((a, b) => a.code.localeCompare(b.code, 'tr-TR', { sensitivity: 'base' }))

    // Listeleme: önce tek renkler alfabetik, hemen ardından çift renkler alfabetik.
    const singles = namedGroups.filter(g => !isDualCode(g.code))
    const duals = namedGroups.filter(g => isDualCode(g.code))
    const orderedGroups = [...singles, ...duals]

    const noneGroup = map.get('__none__')
    if (noneGroup) {
      orderedGroups.push(noneGroup)
    }
    const goneGroup = map.get('__gone__')
    if (goneGroup) {
      orderedGroups.push(goneGroup)
    }

    return orderedGroups.map(g => ({
      ...g,
      totalCount: g.birds.length,
      femaleCount: g.birds.filter(b => b.sex === 'F').length,
      maleCount: g.birds.filter(b => b.sex === 'M').length,
      unknownSexCount: g.birds.filter(b => !b.sex).length
    }))
  }, [rows])

  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = sessionStorage.getItem('guvercin:open_bird_groups')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const updateOpenGroups = useCallback((nextOrUpdater) => {
    setOpenGroups(cur => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(cur) : nextOrUpdater
      try {
        sessionStorage.setItem('guvercin:open_bird_groups', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  // Klips rengi bulucu için renk listesi: YALNIZCA kullanıcının kendi eklediği
  // klips kodları (Ayarlar → Klips Kodları). Hazır (varsayılan) renk paleti
  // BİLEREK listeye eklenmez; kullanıcı "elle girmediğim renkler görünmesin"
  // dedi. Çift renk kombinasyonları da dahildir (seçici, "Çift Renkleri
  // Göster" tikine göre listeyi kendisi süzer), Türkçe alfabetik.
  const finderColors = useMemo(() => {
    const s = db.settings || {}
    const raw = [
      ...(s.codes || []), ...(s.singleCodes || []), ...(s.dualCodes || []),
      ...(s.rightCodes || []), ...(s.leftCodes || [])
    ].filter(Boolean)
    return sortTr([...new Set(raw)])
  }, [db.settings])

  const isSearching = Boolean(q.trim()) || Boolean(rightSel) || Boolean(leftSel)

  // Arama veya klips rengi filtresi varken eşleşen tüm grupları otomatik aç
  useEffect(() => {
    if (isSearching) {
      const all = {}
      groups.forEach(g => { all[g.key] = true })
      updateOpenGroups(all)
    }
  }, [isSearching, groups, updateOpenGroups])

  const isGroupOpen = useCallback((key) => {
    if (isSearching) return true
    return Boolean(openGroups[key])
  }, [isSearching, openGroups])

  const toggleGroup = useCallback((key) => {
    updateOpenGroups(cur => {
      const currentlyOpen = isSearching
        ? (cur[key] !== false)
        : Boolean(cur[key])
      return {
        ...cur,
        [key]: !currentlyOpen
      }
    })
  }, [isSearching, groups.length, updateOpenGroups])

  const allOpen = useMemo(() => {
    if (groups.length === 0) return false
    return groups.every(g => isGroupOpen(g.key))
  }, [groups, isGroupOpen])

  const toggleAll = useCallback(() => {
    if (allOpen) {
      const closed = {}
      groups.forEach(g => { closed[g.key] = false })
      updateOpenGroups(closed)
    } else {
      const all = {}
      groups.forEach(g => { all[g.key] = true })
      updateOpenGroups(all)
    }
  }, [allOpen, groups, updateOpenGroups])

  return (
    <>
      <div className="coop-view-banner">
        <span
          className="coop-dot"
          style={{ background: activeCoop?.color || 'var(--muted)' }}
        />
        <span className="coop-view-name">
          {dispTr(activeCoop ? activeCoop.name : 'TÜM KÜMESLER')}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {dispTr(activeCoop ? 'AKTİF KÜMES' : 'BÜTÜN KÜMESLER')}
        </span>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>{resultCount} {dispTr('sonuç')}</span>
      </div>

      <div className="cards">
        <div className="stat"><div className="n">{stats.female}</div><div className="t">{dispTr('DİŞİ')}</div></div>
        <div className="stat"><div className="n">{stats.male}</div><div className="t">{dispTr('ERKEK')}</div></div>
        <div className="stat"><div className="n">{stats.total}</div><div className="t">{dispTr('TOPLAM KUŞ')}</div></div>
        <button
          className="stat stat-btn"
          onClick={() => setShowMated(true)}
          title="Eşli kuşları listele"
        >
          <div className="n">{stats.mated}</div>
          <div className="t">{dispTr('EŞLİ KUŞ')}</div>
          {/* Alt satır: karışıklığı önlemek için çift adetleri ayrı yazılır. */}
          <div className="t stat-sub">{dispTr(`(${stats.pairs} ÇİFT)`)}</div>
        </button>
      </div>

      <div className="toolbar">
        <input
          /* type="search" yerine text: bazı Android klavyeleri arama
             türünde de klavye açmıyordu. */
          type="text" placeholder={dispTr('Ara: künye, ad, hat, renk, nota…')}
          value={q} onChange={e => setQ(e.target.value)}
        />
        {/* Sıralama: üst satır künye + cinsiyet, alt satır cins + durum. */}
        <div className="filter-picker bird-code-filter" style={{ minWidth: 160, flex: '0 0 auto', alignSelf: 'center' }}>
          <CodePicker
            codes={[...codes, 'KLİPSSİZ / TANIMSIZ', 'ÖLEN / KAÇTI / SATILDI']}
            value={code === '__none__' ? 'KLİPSSİZ / TANIMSIZ' : code === '__gone__' ? 'ÖLEN / KAÇTI / SATILDI' : code}
            onChange={val => {
              if (val === 'KLİPSSİZ / TANIMSIZ' || val === 'KÜNYESİZLER') {
                setCode('__none__')
              } else if (val === 'ÖLEN / KAÇTI / SATILDI') {
                setCode('__gone__')
              } else {
                setCode(val || '')
              }
            }}
            isColor={true}
            selectOnly
            placeholder={dispTr('TÜM KÜNYELER')}
            emptyLabel={dispTr('KÜNYELER')}
            clearLabel={dispTr('— Tüm Künyeler —')}
            title="Künye Filtresi"
            emptyText={dispTr('Kayıtlı künye yok.')}
            buttonStyle={{ height: 36, padding: '8px 10px' }}
          />
        </div>
        <div className="filter-picker" style={{ minWidth: 140, flex: '0 0 auto', alignSelf: 'center' }}>
          <CodePicker
            items={[
              { value: 'F', label: dispTr(SEX.F), badgeClass: 'F' },
              { value: 'M', label: dispTr(SEX.M), badgeClass: 'M' }
            ]}
            value={sex}
            onChange={setSex}
            selectOnly
            placeholder={dispTr('DİŞİ / ERKEK')}
            emptyLabel={dispTr('DİŞİ / ERKEK')}
            clearLabel={dispTr('— Tümü (Dişi & Erkek) —')}
            title="Cinsiyet Filtresi"
            buttonStyle={{ height: 36, padding: '8px 10px' }}
          />
        </div>
        <div className="filter-picker" style={{ minWidth: 140, flex: '0 0 auto', alignSelf: 'center' }}>
          <CodePicker
            codes={cinsiler}
            value={cinsi}
            onChange={setCinsi}
            selectOnly
            placeholder={dispTr('TÜM CİNSLER')}
            emptyLabel={dispTr('TÜM CİNSLER')}
            clearLabel={dispTr('— Tüm Cinsler —')}
            title="Cins (Irk) Filtresi"
            emptyText={dispTr('Kayıtlı cins bulunamadı.')}
            buttonStyle={{ height: 36, padding: '8px 10px' }}
          />
        </div>
        <div className="filter-picker" style={{ minWidth: 140, flex: '0 0 auto', alignSelf: 'center' }}>
          <CodePicker
            items={statusFilterOptions().map(s => ({
              value: s.value,
              label: s.label,
              badgeClass: `durum-${s.value}`
            }))}
            value={status}
            onChange={setStatus}
            selectOnly
            placeholder={dispTr('TÜM DURUMLAR')}
            emptyLabel={dispTr('TÜM DURUMLAR')}
            clearLabel={dispTr('— Tüm Durumlar —')}
            title="Durum Filtresi"
            buttonStyle={{ height: 36, padding: '8px 10px' }}
          />
        </div>
        {leftSel && (
          <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {dispTr('SOL:')} <Ring text={leftSel} />
            <span role="button" tabIndex={0} onClick={() => setLeftSel('')} style={{ cursor: 'pointer', fontWeight: 800 }} title="Kaldır">×</span>
          </span>
        )}
        {rightSel && (
          <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {dispTr('SAĞ:')} <Ring text={rightSel} />
            <span role="button" tabIndex={0} onClick={() => setRightSel('')} style={{ cursor: 'pointer', fontWeight: 800 }} title="Kaldır">×</span>
          </span>
        )}
        <label className={`filter-check${photoOnly ? ' on' : ''}`}>
          <input type="checkbox" checked={photoOnly} onChange={e => setPhotoOnly(e.target.checked)} />
          {dispTr('Fotoğraflılar')}
        </label>
        <label
          className={`filter-check${sexMissing ? ' on' : ''}`}
          title="Cinsiyeti girilmemiş kuşları göster"
        >
          <input
            type="checkbox"
            checked={sexMissing}
            onChange={e => setSexMissing(e.target.checked)}
          />
          {dispTr('Cinsiyeti eksik')}{sexMissingCount > 0 && ` (${sexMissingCount})`}
        </label>
        {ENABLE_LOFT_CHECK && (
          <label
            className={`filter-check${uncheckedOnly ? ' on' : ''}`}
            title="Kümeste henüz kontrolü yapılmamış kuşları filtrele"
          >
            <input
              type="checkbox"
              checked={uncheckedOnly}
              onChange={e => setUncheckedOnly(e.target.checked)}
            />
            {dispTr('Kontrolü Eksik')}{uncheckedCount > 0 && ` (${uncheckedCount})`}
          </label>
        )}
        <button
          type="button"
          className={`btn btn-find${(rightSel || leftSel) ? ' primary' : ''}`}
          onClick={() => setFindOpen(true)}
          title="Sağ/sol ayak klips rengine göre kuş bul"
        >
          {dispTr('Klips Rengiyle Bul')}
        </button>
        <div className="spacer" />
        {hasFilter && (
          <button className="btn btn-reset" onClick={resetFilters} title="Tüm filtreleri ve aramayı temizle">
            {dispTr('Filtreleri sıfırla')}
          </button>
        )}
        <span className="muted count">{resultCount} {dispTr('sonuç')}</span>
        <button
          className="btn"
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.45)',
            color: '#34d399',
            fontWeight: 700
          }}
          onClick={() => onNew?.({ status: 'yavru', sex: '?', line: 'BİZİM YAVRU' })}
          title="Doğrudan yavru kuş kaydı açar"
        >
          {dispTr('🐣 + Yeni Yavru')}
        </button>
        <button className="btn primary" onClick={() => onNew?.()}>{dispTr('+ Yeni Kuş')}</button>
      </div>

      {/* Klips grubu kartı: başlık tek satır ortada; grup sayısı + buton alt
          satırı paylaşır; grupların tamamı çizgili kartın içine alınır. */}
      {rows.length === 0 ? (
        <div className="panel bird-list">
          <p className="muted" style={{ padding: 24, textAlign: 'center' }}>
            {dispTr('Kayıt bulunamadı. "Yeni Kuş" ile başlayın.')}
          </p>
        </div>
      ) : (
        <div className="bird-groups-container">
          <div className="bird-groups-head">
            <span className="bird-list-summary-title">
              {dispTr(db.settings?.loftMode === 'posta' ? 'KÜNYE / BİLEZİK GRUPLARI' : 'KLİPS RENK GRUPLARI')}
            </span>
          </div>
          <div className="bird-groups-subrow">
            <span className="bird-list-summary-badge">{groups.length} {dispTr('GRUP')}</span>
            <button
              type="button"
              className="btn"
              onClick={toggleAll}
              title={allOpen ? 'Tüm klips gruplarını daralt' : 'Tüm klips gruplarını genişlet'}
            >
              {dispTr(allOpen ? 'Tümünü Daralt ∧' : 'Tümünü Genişlet ∨')}
            </button>
          </div>
          {groups.map(group => {
            const open = isGroupOpen(group.key)
            return (
              <div key={group.key} className={`bird-group-card${open ? ' open' : ''}`}>
                <button
                  type="button"
                  className="bird-group-head"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={open}
                >
                  {/* Öncelik kart rengi ve yazısındadır: rozet solda. Sayı ve
                      cinsiyet rozetleri de rozetin hemen sağına, küçük bir
                      boşlukla dizilir (en fazla 4 öğe: toplam + D + E + ?).
                      Kartı açan ok sağda, tek başına kalır. */}
                  <div className="bird-group-left">
                    {group.isGone ? (
                      <span
                        className="ring ring-chip"
                        style={{
                          ...groupChipStyle('ÖLEN / KAÇTI / SATILDI'),
                          background: 'rgba(239, 68, 68, 0.22)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.45)',
                          fontWeight: 800
                        }}
                      >
                        {dispTr('ÖLEN / KAÇTI / SATILDI')}
                      </span>
                    ) : group.isNone ? (
                      <span className="ring ring-chip ring-chip-none" style={groupChipStyle('KLİPSSİZ / TANIMSIZ')}>
                        {dispTr('KLİPSSİZ / TANIMSIZ')}
                      </span>
                    ) : (
                      <Ring text={group.code} style={groupChipStyle(group.code)} />
                    )}
                    <span className="bird-group-count">{group.totalCount} {dispTr('Kuş')}</span>
                    <div className="bird-group-tags">
                      {group.femaleCount > 0 && (
                        <span className="tag F" title="Dişi Kuş Sayısı">{group.femaleCount} {dispTr('D')}</span>
                      )}
                      {group.maleCount > 0 && (
                        <span className="tag M" title="Erkek Kuş Sayısı">{group.maleCount} {dispTr('E')}</span>
                      )}
                      {group.unknownSexCount > 0 && (
                        <span className="tag" title="Cinsiyeti Eksik / Belirsiz">{group.unknownSexCount} {dispTr('?')}</span>
                      )}
                    </div>
                  </div>
                  <div className="bird-group-right">
                    <span className="bird-group-arrow">▼</span>
                  </div>
                </button>

                {group.isGone && (
                  <div className="muted" style={{ fontSize: 11.5, padding: '0 12px 8px', lineHeight: 1.3 }}>
                    {dispTr('Buradaki kuşlar toplam hesaba dahil değildir.')}
                  </div>
                )}

                {open && (
                  <div className="bird-group-body">
                    {group.birds.map(b => (
                      <div key={b.id} className="bird-row" onClick={() => handleOpenBird(b.id)}>
                        <div className="bird-main">
                          <ClipLines bird={b} />
                          <div className="bird-sub">
                            {b.name && <span className="bird-name" style={{ color: 'var(--text)' }}>{dispTr(b.name)}</span>}
                            {activeTreatmentsMap.has(b.id) && (
                              <span
                                className="tag"
                                style={{
                                  background: activeTreatmentsMap.get(b.id).status === 'aktif' ? '#ef444425' : '#f59e0b25',
                                  color: activeTreatmentsMap.get(b.id).status === 'aktif' ? '#ef4444' : '#f59e0b',
                                  fontWeight: 800,
                                  border: `1px solid ${activeTreatmentsMap.get(b.id).status === 'aktif' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                                }}
                                title={`${activeTreatmentsMap.get(b.id).illness} (${treatmentStatusLabel(activeTreatmentsMap.get(b.id).status)})`}
                              >
                                🩺 {dispTr(activeTreatmentsMap.get(b.id).illness)}
                              </span>
                            )}
                            {b.federationRing && (
                              <span className="tag" style={{ background: '#38bdf825', color: '#38bdf8', fontWeight: 700 }}>
                                🚀 {dispTr(b.federationRing)}
                              </span>
                            )}
                            {b.color && <span className="bird-mark" style={{ color: 'var(--accent)' }}>{dispTr(b.color)}</span>}
                            {b.line && <span style={{ color: 'var(--accent-2)' }}>· {dispTr(b.line)}</span>}
                            {b.notes && <span style={{ color: 'var(--accent-2)', opacity: .85 }} title={dispTr(b.notes)}>· {dispTr(b.notes)}</span>}
                          </div>
                        </div>

                        <div className="bird-thumb" onClick={e => e.stopPropagation()}>
                          {(b.photos || []).length
                            ? <PhotoImg name={b.photos[0]} small onClick={() => openPhoto(b.photos, 0)} />
                            : <span className="bird-thumb-empty" />}
                        </div>

                        <span className="bird-go">›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {findOpen && (
        <ClipColorFinder
          colors={finderColors}
          rightSel={rightSel}
          leftSel={leftSel}
          onChange={(r, l) => { setRightSel(r); setLeftSel(l) }}
          onClose={() => setFindOpen(false)}
        />
      )}

      {showMated && (
        <MatedList
          db={db}
          allDb={allDb}
          coops={coops}
          activeCoopId={activeCoop?.id || ''}
          onClose={() => setShowMated(false)}
          onOpen={handleOpenBird}
        />
      )}
    </>
  )
}

/**
 * Bir kuşun dolu olan ayaklarını sırayla döndürür: her zaman SOL önce.
 * Sol ayak kuşun GELDİĞİ soy, sağ ayak KENDİ soyudur; ikisi ayrı satırdır.
 */
function footLines(b) {
  const out = []
  for (const foot of ['left', 'right']) {
    const code = footCode(b, foot)
    const num = footNumber(b, foot)
    if (code || num) out.push({ foot, code, num })
  }
  return out
}

/**
 * Liste kartındaki künye satırları.
 *
 * Her ayak AYRI satırda gösterilir; numara renk rozetinin YANINDA küçük
 * kutuda durur (2 hane yeter). Kuşun listede gruplandığı ayak ✓ ile
 * işaretlenir. Hiç ayak künyesi olmayan kuşlarda eski tek satır korunur.
 */
/**
 * Uzun grup adlarının (ör. KAHVERENGİ BEYAZ KLİPS veya KLİPSSİZ / TANIMSIZ)
 * kart başlığında kırpılmadan ve satırı taşırmadan tek satıra sığması için dinamik boyutlandırma.
 */
function groupChipStyle(code) {
  if (!code) return undefined
  const len = code.length
  if (len > 18) {
    return { fontSize: '9px', letterSpacing: '-0.35px', padding: '0 3px' }
  }
  if (len > 14) {
    return { fontSize: '9.5px', letterSpacing: '-0.2px', padding: '0 4px' }
  }
  if (len > 10) {
    return { fontSize: '10.5px', letterSpacing: '-0.1px', padding: '0 4px' }
  }
  return undefined
}

/**
 * Uzun cins adlarının (ör. BEYAZ SARILARDAN, BEYAZ KIRMIZILARDAN) satırda kırpılmadan
 * ve ilk harfi kesilmeden tam sığması için dinamik stil
 */
function cinsiBadgeStyle(cinsi) {
  if (!cinsi) return undefined
  const len = cinsi.length
  if (len > 18) {
    return { fontSize: '8px', letterSpacing: '-0.35px', padding: '0 3px' }
  }
  if (len > 14) {
    return { fontSize: '8.5px', letterSpacing: '-0.25px', padding: '0 4px' }
  }
  if (len > 10) {
    return { fontSize: '9.5px', letterSpacing: '-0.15px', padding: '0 4px' }
  }
  return undefined
}

function ClipLines({ bird: b }) {
  const lines = footLines(b)

  if (!lines.length) {
    return (
      <div className="bird-ring">
        {(b.sex || b.status === 'yavru') && <span className={`tag ${b.sex === '?' || (!b.sex && b.status === 'yavru') ? 'yavru' : (b.sex || '')}`}>{dispTr(SEX[b.sex] || (b.status === 'yavru' ? 'YAVRU' : '—'))}</span>}
        {b.cinsi && (
          <span className="bird-cinsi" style={cinsiBadgeStyle(b.cinsi)} title={dispTr(b.cinsi)}>
            <span>{dispTr(b.cinsi)}</span>
          </span>
        )}
        <span className={`tag durum-${b.status || 'damizlik'}`}>
          {dispTr(statusLabel(b.status))}
        </span>
      </div>
    )
  }

  // Profilde ayak seçildiyse listede yalnızca seçilen ayak gösterilir.
  const shown = b.listFoot ? lines.filter(ln => ln.foot === b.listFoot) : lines

  return (
    <>
      {shown.map((ln, i) => (
        <div className="bird-ring" key={ln.foot}>
          {ln.num ? (() => {
            const chip = ringChip(ln.code)
            const bg = chip ? chip.dolgu : null
            const fg = chip ? chip.yazi : null
            const dark = chip?.isDark === true
            return (
              <span
                className="bird-num"
                style={{
                  background: bg || undefined,
                  color: fg || undefined,
                  borderColor: bg || undefined,
                  boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.45)' : undefined,
                }}
              >
                {ln.num}
              </span>
            )
          })() : null}
          {i === 0 && (b.sex || b.status === 'yavru') ? <span className={`tag ${b.sex === '?' || (!b.sex && b.status === 'yavru') ? 'yavru' : (b.sex || '')}`}>{dispTr(SEX[b.sex] || (b.status === 'yavru' ? 'YAVRU' : '—'))}</span> : null}
          {i === 0 && b.cinsi ? (
            <span className="bird-cinsi" style={cinsiBadgeStyle(b.cinsi)} title={dispTr(b.cinsi)}>
              <span>{dispTr(b.cinsi)}</span>
            </span>
          ) : null}
          {i === 0 ? (
            <span className={`tag durum-${b.status || 'damizlik'}`}>
              {dispTr(statusLabel(b.status))}
            </span>
          ) : null}
        </div>
      ))}
    </>
  )
}

/**
 * "Eşli kuş" ekranı.
 *
 * Her satır bir ÇİFTLEŞME kaydı: DİŞİ solda, ERKEK sağda. Kuşun
 * cinsiyeti bilinmiyorsa yer boş bırakılmaz, kart sağa dayanır.
 * Yavruların sayısı satırın altında gösterilir.
 */
function MatedList({ db, allDb, coops = [], activeCoopId = '', onClose, onOpen }) {
  const [expandedPairs, setExpandedPairs] = useState(new Set())
  // Eş ve yavru bağları kümes sınırını aşar. Bu yüzden ekran, aktif kümenin
  // görünümüyle (`db`) sınırlı kalmaz; kuşları ve yavruları tam veriden
  // (`allDb`) çözer. Sayılar yine aktif kümeye göre hesaplanır.
  const sourceDb = allDb || db

  const togglePairKids = (pairingId) => {
    setExpandedPairs(prev => {
      const next = new Set(prev)
      if (next.has(pairingId)) next.delete(pairingId)
      else next.add(pairingId)
      return next
    })
  }

  const breakdown = useMemo(
    () => coopMatingBreakdown(sourceDb, activeCoopId),
    [sourceDb, activeCoopId]
  )

  /**
   * Çiftleşmenin yavruları: `chickIds` + kuşların kendi baba/anne alanları.
   * Yavru başka kümede olsa bile burada görünür; kümes rozetiyle işaretlenir.
   */
  const withKids = useCallback((item) => {
    const p = item.pairing
    const ids = new Set([...(p.chickIds || [])])
    for (const b of sourceDb.birds || []) {
      if (b.sireId === p.maleId && b.damId === p.femaleId) ids.add(b.id)
    }
    const kids = (sourceDb.birds || [])
      .filter(b => ids.has(b.id))
      .sort(compareBirds)
    return { ...item, kids }
  }, [sourceDb.birds])

  const pairRows = useMemo(
    () => [...breakdown.samePairs, ...breakdown.crossPairs]
      .map(withKids)
      .sort((a, b) => compareBirds(a.male || a.female, b.male || b.female)),
    [breakdown.samePairs, breakdown.crossPairs, withKids]
  )

  const orphanRows = useMemo(
    () => [...breakdown.orphanPairs]
      .map(withKids)
      .sort((a, b) => compareBirds(a.male || a.female, b.male || b.female)),
    [breakdown.orphanPairs, withKids]
  )

  /**
   * İki ebeveyni de başka kümede olup yavrusu bu kümede kalan çiftler.
   * `scopeDb` bu kayıtları yavru bağlantısı sayesinde gösterir; Eşli Kuşlar
   * ekranında da ayrı bir "ortak yavru" bölümünde görünmelidir.
   */
  const sharedChickRows = useMemo(() => {
    const known = new Set([
      ...breakdown.samePairs.map(x => x.pairing.id),
      ...breakdown.crossPairs.map(x => x.pairing.id),
      ...breakdown.orphanPairs.map(x => x.pairing.id)
    ])
    const byBirdId = new Map((sourceDb.birds || []).map(b => [b.id, b]))
    return (db.pairings || [])
      .filter(p => !isFormer(p) && !known.has(p.id))
      .map(p => ({
        pairing: p,
        male: p.maleId ? (byBirdId.get(p.maleId) || null) : null,
        female: p.femaleId ? (byBirdId.get(p.femaleId) || null) : null
      }))
      .filter(x => x.male || x.female)
      .map(withKids)
      .sort((a, b) => compareBirds(a.male || a.female, b.male || b.female))
  }, [db.pairings, breakdown, sourceDb.birds, withKids])

  const crossCount = breakdown.crossPairs.length

  const coopNameOf = (bird) => {
    if (!bird || !activeCoopId) return ''
    const id = resolveBirdCoopId(bird, coops)
    if (!id || id === activeCoopId) return ''
    return (coops.find(c => c.id === id) || {}).name || ''
  }

  const crossNotes = (item) => {
    const out = []
    const maleName = coopNameOf(item.male)
    const femaleName = coopNameOf(item.female)
    if (maleName) out.push(`${dispTr('ERKEK')}: ${dispTr(maleName)}`)
    if (femaleName) out.push(`${dispTr('DİŞİ')}: ${dispTr(femaleName)}`)
    return out
  }

  const renderPairCard = (item, { orphan = false, shared = false } = {}) => {
    const { pairing: p, male, female, kids } = item
    const isKidsOpen = expandedPairs.has(p.id)
    const cross = crossNotes(item)
    const missing = []
    if (item.maleMissing) missing.push(`${dispTr('ERKEK')} (ID: ${p.maleId})`)
    if (item.femaleMissing) missing.push(`${dispTr('DİŞİ')} (ID: ${p.femaleId})`)

    return (
      <div key={p.id} className={`pair-card${orphan ? ' pair-card-orphan' : ''}`}>
        {/* 2 Kare Kart Yan Yana (Dişi Solda, Erkek Sağda) -> Birlikte Dikdörtgen */}
        <div className="pair-couple-row">
          <PairSquare
            bird={female}
            role="DİŞİ"
            isFemale={true}
            onOpen={onOpen}
            coops={coops}
            activeCoopId={activeCoopId}
            missingId={p.femaleId}
          />

          <div className="pair-link">
            <span className="pair-link-icon">🔗</span>
            <span className="pair-status-tag">{dispTr('EŞ')}</span>
          </div>

          <PairSquare
            bird={male}
            role="ERKEK"
            isFemale={false}
            onOpen={onOpen}
            coops={coops}
            activeCoopId={activeCoopId}
            missingId={p.maleId}
          />
        </div>

        {cross.length > 0 && (
          <div className="pair-cross-note">
            <span>🔄</span>
            <span>{dispTr('Eşi başka kümede:')} {cross.join(' · ')}</span>
          </div>
        )}

        {orphan && (
          <div className="pair-orphan-note">
            <b>{dispTr('KOPUK KAYIT')}</b>
            <span>{dispTr('Kuş kaydı bulunmayan taraf:')} {missing.join(', ')}</span>
            {p.date && <span>{fmtDate(p.date)}</span>}
          </div>
        )}

        {shared && (
          <div className="pair-cross-note">
            <span>🐣</span>
            <span>{dispTr('Ebeveynler başka kümede; yavru bu kümede olduğu için çift burada gösteriliyor.')}</span>
          </div>
        )}

        {/* Alt Kısım: Yavruları Göster Butonu */}
        <div className="pair-kids-section">
          {kids.length > 0 ? (
            <>
              <button
                type="button"
                className={`pair-kids-toggle-btn ${isKidsOpen ? 'open' : ''}`}
                onClick={() => togglePairKids(p.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🐣</span>
                  <span>{kids.length} {dispTr('Yavruyu')} {dispTr(isKidsOpen ? 'Gizle' : 'Göster')}</span>
                </span>
                <span className="arrow">{isKidsOpen ? '▲' : '▼'}</span>
              </button>

              {isKidsOpen && (
                <div className="pair-kids-drawer">
                  <div className="pair-kids-grid">
                    {kids.map(k => (
                      <div
                        key={k.id}
                        className="pair-kid-item"
                        onClick={() => onOpen(k.id)}
                        title="Yavru detayını açmak için tıklayın"
                      >
                        <Ring text={ringOf(k)} />
                        {k.name && k.name !== ringOf(k) && <span className="kid-name">«{dispTr(k.name)}»</span>}
                        {k.sex && (
                          <span className={`kid-sex ${k.sex}`}>
                            {dispTr(k.sex === 'F' ? '♀ DİŞİ' : k.sex === 'M' ? '♂ ERKEK' : '?')}
                          </span>
                        )}
                        {k.cinsi && <span className="kid-cinsi">{dispTr(k.cinsi)}</span>}
                        <CoopTag bird={k} coops={coops} activeCoopId={activeCoopId} compact />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="pair-no-kids">🐣 {dispTr('Henüz kayıtlı yavru yok')}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="overlay"
      style={{ zIndex: 70 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal pair-modal" style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <h2>{dispTr(`Eşli Kuşlar (${pairRows.length} çift)`)}</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <p className="hint">
          {dispTr('Yalnızca şu an eşi olan çiftleşmeler listelenir. Eski eşler kuş sayfasındaki')} <b>{dispTr('Eski Eşler')}</b>{dispTr(' sekmesinde durur.')}
        </p>

        <p className="hint pair-summary">
          <b>{breakdown.mated}</b> {dispTr('eşli kuş')}
          {' · '}<b>{breakdown.samePairs.length}</b> {dispTr('aynı kümesde çift')}
          {crossCount > 0 && <> {' · '}<b>{crossCount}</b> {dispTr('eşi başka kümede')}</>}
          {orphanRows.length > 0 && <> {' · '}<b>{orphanRows.length}</b> {dispTr('kopuk kayıt')}</>}
          {' · '}<b>{breakdown.unpaired.length}</b> {dispTr('eşsiz kuş')}
        </p>

        {!pairRows.length && (
          <p className="hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            {dispTr('Şu an eşi olan kuş yok.')}
          </p>
        )}

        <div className="pair-list">
          {pairRows.map(item => renderPairCard(item))}
        </div>

        {crossCount > 0 && (
          <p className="hint pair-cross-summary">
            {dispTr(`${crossCount} çiftin eşi başka kümede. Bu kuşlar silinmiş değildir; kümes rozetiyle gösterilir ve "eşli" sayacına dahildir.`)}
          </p>
        )}

        {sharedChickRows.length > 0 && (
          <div className="pair-shared-section">
            <h3>{dispTr('Yavrusu Bu Kümede Olan Çiftler')} ({sharedChickRows.length})</h3>
            <p className="hint">
              {dispTr('Bu çiftlerin iki ebeveyni de başka kümede; yavruları bu kümede olduğu için burada gösteriliyor.')}
            </p>
            <div className="pair-list">
              {sharedChickRows.map(item => renderPairCard(item, { shared: true }))}
            </div>
          </div>
        )}

        {orphanRows.length > 0 && (
          <div className="pair-orphan-section">
            <h3>{dispTr('Kuşu Silinmiş Çiftleşme Kayıtları')} ({orphanRows.length})</h3>
            <p className="hint" style={{ color: 'var(--danger)' }}>
              {dispTr('Bu kayıtlarda bir tarafın kuş kaydı gerçekten yok. Silinmiş tarafın kimliği aşağıda yazılı; kalan taraf eşli sayacında sayılmaya devam eder.')}
            </p>
            <div className="pair-list">
              {orphanRows.map(item => renderPairCard(item, { orphan: true }))}
            </div>
          </div>
        )}

        {breakdown.unpaired.length > 0 && (
          <div className="pair-unpaired-section">
            <h3>{dispTr('Eşi Olmayan Kuşlar')} ({breakdown.unpaired.length})</h3>
            <p className="hint">
              {dispTr('Bu kuşların güncel bir eş kaydı yok. Toplam ile eşli sayısı arasındaki fark bu listedir.')}
            </p>
            <div className="pair-unpaired-list">
              {[...breakdown.unpaired].sort(compareBirds).map(b => (
                <button
                  key={b.id}
                  type="button"
                  className="pair-unpaired-item"
                  onClick={() => onOpen(b.id)}
                  title="Kuş detayına gitmek için tıklayın"
                >
                  <Ring text={ringOf(b)} />
                  <span className={`tag ${b.sex === '?' || (!b.sex && b.status === 'yavru') ? 'yavru' : (b.sex || '')}`}>{dispTr(SEX[b.sex] || (b.status === 'yavru' ? 'YAVRU' : 'CİNSİYETSİZ'))}</span>
                  <span className="muted">{dispTr(b.cinsi || '—')}</span>
                  {b.name && <span className="muted">«{dispTr(b.name)}»</span>}
                  <CoopTag bird={b} coops={coops} activeCoopId={activeCoopId} compact />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions center">
          <button className="btn" onClick={onClose} style={{ width: '100%' }}>{dispTr('Kapat')}</button>
        </div>
      </div>
    </div>
  )
}

function PairSquare({ bird, role, isFemale, onOpen, coops = [], activeCoopId = '', missingId = '' }) {
  if (!bird) {
    return (
      <div className={`pair-square empty ${isFemale ? 'female' : 'male'}`}>
        <div className={`pair-square-role ${isFemale ? 'female' : 'male'}`}>
          {dispTr(isFemale ? '♀ DİŞİ' : '♂ ERKEK')}
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          {dispTr(missingId ? 'Kayıt silinmiş' : 'Taraf belirtilmemiş')}
        </div>
        {missingId && (
          <div className="hint" style={{ fontSize: 9, wordBreak: 'break-all', marginTop: 2 }}>
            ID: {missingId}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`pair-square ${isFemale ? 'female' : 'male'}`}
      onClick={() => onOpen(bird.id)}
      title={`${role} detayına gitmek için tıklayın`}
    >
      <div className={`pair-square-role ${isFemale ? 'female' : 'male'}`}>
        {dispTr(isFemale ? '♀ DİŞİ' : '♂ ERKEK')}
      </div>

      <div className="pair-square-pic">
        {(bird.photos || []).length
          ? <PhotoImg name={bird.photos[0]} small />
          : <span className="bird-thumb-empty" />}
      </div>

      <div className="pair-square-ring">
        <Ring text={ringOf(bird)} />
      </div>

      {bird.name ? (
        <div className="pair-square-name" title={bird.name}>«{dispTr(bird.name)}»</div>
      ) : (
        <div className="pair-square-name muted">—</div>
      )}

      {bird.cinsi && (
        <div className="pair-square-cinsi">{dispTr(bird.cinsi)}</div>
      )}

      <CoopTag bird={bird} coops={coops} activeCoopId={activeCoopId} compact />

      <span className={`tag durum-${bird.status || 'damizlik'}`} style={{ fontSize: 10, marginTop: 4, padding: '1px 6px' }}>
        {dispTr(statusLabel(bird.status))}
      </span>
    </div>
  )
}

/**
 * Bir kuşun belirtilen ayaktaki klips kodunda `color` rengini arar.
 *
 * Tek klipsli kuşlarda (yalnızca `code` dolu) ayak bilinmediği için kod her
 * iki ayak için de dikkate alınır; böylece kullanıcı tek renk seçince kuş
 * mutlaka karşısına gelir. Renk karşılaştırması foldTr ile yapılır; böylece
 * "MAVİ" ↔ "MAVI", "YEŞİL" ↔ "YESIL" gibi yazımlar da eşleşir.
 */
function birdHasClipColor(b, color, foot) {
  const target = foldTr(color)
  if (!target) return true
  const texts = []
  if (foot === 'right') {
    if (b.rightCode) texts.push(b.rightCode)
    else if (!b.leftCode && b.code) texts.push(b.code)
  } else {
    if (b.leftCode) texts.push(b.leftCode)
    else if (!b.rightCode && b.code) texts.push(b.code)
  }
  return texts.some(t => foldTr(t).includes(target))
}

/**
 * "Klips Rengiyle Bul" penceresi: sağ ve/veya sol ayak klips rengini seçip
 * ona uyan kuşları listeler. Tek renk yeterlidir; iki ayak da seçilirse
 * yalnızca her ikisine de uyan kuşlar gösterilir.
 */
function ClipColorFinder({ colors, rightSel, leftSel, onChange, onClose }) {
  const [draftRight, setDraftRight] = useState(rightSel || '')
  const [draftLeft, setDraftLeft] = useState(leftSel || '')
  // "Çift Renkleri Göster": her iki seçiciye de aynı anda uygulanır.
  const [showDual, setShowDual] = useState(() => isDualCode(rightSel) || isDualCode(leftSel))

  return (
    <div
      className="overlay"
      style={{ zIndex: 75 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h2>🎨 {dispTr('Klips Rengiyle Bul')}</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <p className="hint" style={{ marginTop: 0 }}>
          {dispTr('Sağ ve/veya sol ayak klips rengini seçin.')} <b>{dispTr('Tek renk')}</b> {dispTr('seçmeniz yeterlidir; iki ayak da seçilirse yalnızca')} <b>{dispTr('her ikisine de uyan')}</b> {dispTr('kuşlar listelenir.')}
        </p>

        {/* Çift renk tik kutusu — kuş ekleme ekranındaki gibi, iki seçiciye ortak */}
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: showDual ? 'var(--accent, #38bdf8)' : 'var(--muted)',
            cursor: 'pointer',
            userSelect: 'none',
            background: showDual ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            padding: '3px 8px',
            borderRadius: 6,
            border: `1px solid ${showDual ? 'var(--accent, #38bdf8)' : 'transparent'}`,
            marginBottom: 12
          }}
        >
          <input
            type="checkbox"
            checked={showDual}
            onChange={e => setShowDual(e.target.checked)}
            style={{ accentColor: 'var(--accent, #38bdf8)', width: 15, height: 15, cursor: 'pointer' }}
          />
          <span>🎨 {dispTr('Çift Renkleri Göster')}</span>
        </label>

        <div className="field" style={{ marginTop: 0 }}>
          <label>{dispTr('SOL AYAK')}</label>
          <CodePicker
            isColor
            selectOnly
            codes={colors}
            value={draftLeft}
            onChange={setDraftLeft}
            dualMode={showDual}
            onDualModeChange={setShowDual}
            title="Sol Ayak Klips Rengi"
            emptyText={dispTr('Kayıtlı klips rengi yok.')}
          />
        </div>

        <div className="field">
          <label>{dispTr('SAĞ AYAK')}</label>
          <CodePicker
            isColor
            selectOnly
            codes={colors}
            value={draftRight}
            onChange={setDraftRight}
            dualMode={showDual}
            onDualModeChange={setShowDual}
            title="Sağ Ayak Klips Rengi"
            emptyText={dispTr('Kayıtlı klips rengi yok.')}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => { setDraftRight(''); setDraftLeft('') }}
          >
            {dispTr('Temizle')}
          </button>
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{dispTr('Vazgeç')}</button>
          <button
            type="button"
            className="btn primary"
            onClick={() => { onChange(draftRight, draftLeft); onClose() }}
          >
            {dispTr('Kuşları Bul')}
          </button>
        </div>
      </div>
    </div>
  )
}