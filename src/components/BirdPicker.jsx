import { useState, useEffect, useMemo, useRef } from 'react'
import { ringOf, trSearch, dispTr, ringChip, trUpper } from '../lib.js'

/**
 * BirdPicker / SelectPicker
 *
 * Uzun kuş veya çift listeleri için ekranı kaplamayan,
 * üstten ve alttan boşluk bırakan, arama özellikli,
 * boşluğa tıklanınca veya ESC'ye basılınca iptal olan özel seçici bileşen.
 */
export default function BirdPicker({ /*UNIQUE_MARKER_XYZ*/
  birds,
  items,
  value,
  onChange,
  title = 'Kuş Seçin',
  placeholder = 'KUŞ SEÇİN...',
  clearLabel = '— Seçimi Kaldır (Boş) —',
  emptyText = 'Kayıtlı seçenek bulunamadı.',
  disabled = false,
  getTag = null,
  showSex = true,
  extraOptions = null,
  extraTitle = '',
  // Kümes filtresi: verilirse pencerede kümes düğmeleri görünür ve liste
  // seçilen kümesin kuşlarına daralır. Böylece anne/baba gibi seçimlerde
  // başka kümeslerdeki kuşlar da bulunabilir.
  coops = null,
  coopIdOf = null,
  defaultCoopId = '',
  style = {}
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [coopFilter, setCoopFilter] = useState(defaultCoopId || '')
  const searchInputRef = useRef(null)
  const chipRowRef = useRef(null)
  const [chipScale, setChipScale] = useState(1)

  // Kümes filtresi yalnızca birden fazla kümes varsa anlamlı.
  const coopListSafe = Array.isArray(coops) ? coops : []
  const hasCoopFilter = coopListSafe.length > 1 && typeof coopIdOf === 'function'

  // Kümes adı uzun olduğunda (ör. "TAHTA KÜMES") düğme satırı taşırmadan
  // tek satıra sığsın diye yazı boyutu ve iç boşluk dinamik küçülür.
  function coopChipStyle(name) {
    const len = (name || '').length
    if (len > 14) return { fontSize: 9, padding: '4px 6px', letterSpacing: '-0.2px' }
    if (len > 10) return { fontSize: 9.5, padding: '4px 7px', letterSpacing: '-0.1px' }
    return { fontSize: 10, padding: '5px 8px' }
  }

  // ESC tuş dinleyicisi: ESC'ye basıldığında işlem iptal olur
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Açıldığında aramayı ve kümes filtresini sıfırla. Kümes filtresi her
  // açılışta formun kümesine döner; kullanıcı bilerek başka kümese geçer.
  useEffect(() => {
    if (open) {
      setSearch('')
      setCoopFilter(defaultCoopId || '')
    }
  }, [open, defaultCoopId])

  // Kuş haritası (hızlı erişim için)
  const birdsMap = useMemo(() => {
    if (!birds) return new Map()
    const map = new Map()
    for (const b of birds) {
      if (b && b.id) map.set(b.id, b)
    }
    return map
  }, [birds])

  // Seçili kuş veya item
  const selectedBird = birds ? (birdsMap.get(value) || null) : null
  const selectedItem = items ? (items.find(i => i.id === value) || null) : null
  const selectedExtra = extraOptions ? (extraOptions.find(o => o.value === value) || null) : null

  // Kümes filtresi düğmeleri modal genişliğine sığmıyorsa tüm satır
  // otomatik küçültülür (zoom), böylece hiçbir düğme alt satıra kaymaz.
  useEffect(() => {
    if (!hasCoopFilter) { setChipScale(1); return }
    const el = chipRowRef.current
    if (!el) return
    const measure = () => {
      const sw = el.scrollWidth
      const cw = el.clientWidth
      const scale = (sw > cw && cw > 0) ? cw / sw : 1
      setChipScale(scale)
    }
    measure()
    const t = setTimeout(measure, 80)
    return () => clearTimeout(t)
  }, [hasCoopFilter, coops, coopFilter])

  // Filtrelenmiş liste - seçili olan daima listenin en başında yer alır
  const filteredList = useMemo(() => {
    // trSearch: Türkçe harfleri katlar. trUpper kullanılsa "MAVI" yazılmış
    // bir kayıt "mavi" aramasıyla bulunamazdı (İ/I eşleşmez).
    const q = trSearch(search)

    if (birds) {
      // Kümes filtresi: liste seçilen kümesin kuşlarına daralır. Filtre boşsa
      // ("TÜMÜ") bütün kümesler listelenir.
      const base = (hasCoopFilter && coopFilter)
        ? birds.filter(b => b && coopIdOf(b) === coopFilter)
        : birds
      let list = []
      if (!q) {
        list = [...base]
      } else {
        list = base.filter(b => {
          if (!b) return false
          const ring = trSearch(ringOf(b))
          const name = trSearch(b.name)
          const cinsi = trSearch(b.cinsi)
          const color = trSearch(b.color)
          const line = trSearch(b.line)
          const tag = getTag ? trSearch(getTag(b)) : ''
          return ring.includes(q) || name.includes(q) || cinsi.includes(q) || color.includes(q) || line.includes(q) || tag.includes(q)
        })
      }

      // Seçili kuş varsa listenin en tepesine taşı (kullanıcı aşağı kaydırmak zorunda kalmasın)
      if (value) {
        const selIdx = list.findIndex(b => b && b.id === value)
        if (selIdx > 0) {
          const [selBird] = list.splice(selIdx, 1)
          list.unshift(selBird)
        }
        // Seçili kuş kümes filtresi dışında kaldıysa da görünsün: kullanıcı
        // mevcut bağın kopmadığını görür, etiketinde "BAŞKA KÜMES" yazar.
        // (Aramayla elenen seçili kuş geri eklenmez.)
        if (selIdx < 0 && hasCoopFilter && coopFilter && !base.some(b => b && b.id === value)) {
          const selBird = birds.find(b => b && b.id === value)
          if (selBird) list.unshift(selBird)
        }
      }

      return list
    }

    if (items) {
      let list = []
      if (!q) {
        list = [...items]
      } else {
        list = items.filter(it => {
          if (!it) return false
          const label = trSearch(it.label)
          const sub = trSearch(it.sublabel)
          const tag = trSearch(it.tag)
          return label.includes(q) || sub.includes(q) || tag.includes(q)
        })
      }

      // Seçili öğe varsa listenin en tepesine taşı
      if (value) {
        const selIdx = list.findIndex(it => it && it.id === value)
        if (selIdx > 0) {
          const [selItem] = list.splice(selIdx, 1)
          list.unshift(selItem)
        }
      }

      return list
    }

    return []
  }, [birds, items, search, getTag, value, hasCoopFilter, coopFilter, coopIdOf])

  // Kümes başına kuş sayısı (filtre düğmelerinde gösterilir).
  const coopCounts = useMemo(() => {
    const map = new Map()
    if (!birds) return map
    for (const b of birds) {
      if (!b) continue
      const id = hasCoopFilter ? coopIdOf(b) : ''
      map.set(id, (map.get(id) || 0) + 1)
    }
    return map
  }, [birds, hasCoopFilter, coopIdOf])

  const totalCount = filteredList.length + (extraOptions ? extraOptions.length : 0)

  // Seçim yapma
  function handleSelect(id) {
    onChange(id)
    setOpen(false)
  }

  // Temizleme
  function handleClear() {
    onChange('')
    setOpen(false)
  }

  return (
    <>
      {/* TETİKLEYİCİ BUTON (SELECT GİBİ GÖRÜNÜR) */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className="bird-picker-trigger"
        style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          textAlign: 'left',
          background: disabled ? 'var(--panel)' : 'var(--panel-2)',
          border: '1px solid var(--line)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: '6px 8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          font: 'inherit',
          fontSize: 'clamp(9.5px, 2.5vw, 12.5px)',
          minHeight: 40,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
          ...style
        }}
      >
        <div style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 4,
          flex: 1,
          minWidth: 0
        }}>
          {selectedBird ? (
            <>
              <span style={{
                fontWeight: 700,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flexShrink: 0
              }}>
                {dispTr(ringOf(selectedBird))}
              </span>
              {selectedBird.name && selectedBird.name !== ringOf(selectedBird) && (
                <span style={{
                  fontWeight: 600,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: '0 1 auto'
                }}>
                  {dispTr(`· ${selectedBird.name}`)}
                </span>
              )}
              {showSex && selectedBird.sex && (
                <span style={{
                  fontSize: 10.5,
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontWeight: 600,
                  background: selectedBird.sex === 'F' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: selectedBird.sex === 'F' ? '#f472b6' : '#60a5fa',
                  flexShrink: 0
                }}>
                  {dispTr(selectedBird.sex === 'F' ? '♀ Dişi' : '♂ Erkek')}
                </span>
              )}
              {getTag && getTag(selectedBird) && (
                <span style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                  {dispTr(getTag(selectedBird))}
                </span>
              )}
            </>
          ) : selectedItem ? (
            <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>
              {dispTr(selectedItem.label)}
            </span>
          ) : selectedExtra ? (
            <span style={{ fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>
              {selectedExtra.label}
            </span>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>
              {dispTr(placeholder)}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 4 }}>▼</span>
      </button>

      {/* SEÇİM MODALI - ÜSTTEN VE ALTTAN BOŞLUK BIRAKAN ÖZEL LİSTE */}
      {open && (
        <div
          className="picker-backdrop"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            userSelect: 'none',
            padding: '10px 12px'
          }}
        >
          {/* Üstteki boşluk - Tıklandığında işlemi iptal eder */}
          <div
            className="picker-top-space"
            onClick={() => setOpen(false)}
            style={{
              width: '100%',
              minHeight: 45,
              flex: '1 1 auto',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 8
            }}
            title="İptal etmek için tıklayın (ESC)"
          >
            <div
              style={{
                fontSize: 12,
                color: '#fff',
                opacity: 0.9,
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '4px 14px',
                borderRadius: 14,
                backdropFilter: 'blur(4px)',
                letterSpacing: 0.3
              }}
            >
              {dispTr('✕ İptal etmek için boşluğa tıklayın (ESC)')}
            </div>
          </div>

          {/* Orta içerik kartı - Üstten ve alttan boşluklu, liste içinde kayan kart */}
          <div
            className="picker-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: 'min(58vh, calc(100vh - 190px))',
              background: 'var(--panel, #1e2430)',
              border: '1px solid var(--line, #334155)',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            {/* Kart Başlığı */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line, #334155)',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 40px',
                alignItems: 'center',
                background: 'var(--panel-2, #181d27)'
              }}
            >
              <div />
              <div style={{ textAlign: 'center', minWidth: 0, padding: '0 8px' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {dispTr(title)}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                  {dispTr(`${totalCount} seçenek listeleniyor`)}
                </span>
              </div>
              <button
                type="button"
                className="x"
                onClick={() => setOpen(false)}
                title="İptal / Kapat (ESC)"
                style={{ position: 'static', width: 34, height: 34, justifySelf: 'end' }}
              >×</button>
            </div>

            {/* Arama / Filtreleme kutusu */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line, #334155)' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={dispTr('Listede ara (künye, ad, ırk)...')}
                  style={{
                    width: '100%',
                    padding: '8px 30px 8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line, #334155)',
                    background: 'var(--panel-2, #181d27)',
                    color: 'var(--text)',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: 18,
                      cursor: 'pointer',
                      padding: 2,
                      lineHeight: 1
                    }}
                  >×</button>
                )}
              </div>
            </div>

            {/* Kümes filtresi — kuş listesi seçilen kümesin kuşlarına daralır.
                "TÜMÜ" seçilirse bütün kümeslerin kuşları listelenir. */}
            {hasCoopFilter && (
              <div
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--line, #334155)',
                  background: 'var(--panel-2, #181d27)'
                }}
              >
                <div
                  ref={chipRowRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'nowrap',
                    gap: 4,
                    paddingBottom: 2,
                    overflow: 'hidden',
                    zoom: chipScale,
                    width: '100%'
                  }}
                >
                  {[{ id: '', name: 'TÜMÜ', color: '' }, ...coopListSafe].map(c => {
                    const active = (coopFilter || '') === (c.id || '')
                    const count = c.id ? (coopCounts.get(c.id) || 0) : (birds ? birds.length : 0)
                    return (
                      <button
                        key={c.id || 'all'}
                        type="button"
                        onClick={() => setCoopFilter(c.id || '')}
                        title={c.id ? c.name : 'Bütün kümesler'}
                        style={{
                          flex: '0 0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          textAlign: 'center',
                          borderRadius: 8,
                          border: active ? '2px solid var(--accent, #38bdf8)' : '1px solid var(--line, #334155)',
                          background: active ? 'rgba(56, 189, 248, 0.16)' : 'var(--panel, #1e2430)',
                          color: active ? 'var(--accent, #38bdf8)' : 'var(--text)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2,
                          ...coopChipStyle(c.name)
                        }}
                      >
                        {c.color && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: c.color,
                              flexShrink: 0
                            }}
                          />
                        )}
                        <span>{c.name}</span>
                        <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 600 }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Liste Alanı - Bu aralıkta kayar */}
            <div
              style={{
                flex: '1 1 auto',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              {/* Seçimi Kaldır / Boş Bırak */}
              {clearLabel && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: !value ? '2px solid var(--accent, #3b82f6)' : '1px dashed var(--line, #334155)',
                    background: !value ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    color: !value ? 'var(--accent, #3b82f6)' : 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: !value ? 700 : 500,
                    minHeight: 40,
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <span>{dispTr(clearLabel)}</span>
                  {!value && (
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 900, fontSize: 16 }}>✓</span>
                  )}
                </button>
              )}

              {/* Kuş Listesi */}
              {birds && filteredList.map(b => {
                if (!b) return null
                const isSelected = value === b.id
                const tagText = getTag ? getTag(b) : null
                const bCinsiUpper = b.cinsi ? trUpper(b.cinsi) : ''
                // Kuşun kendi klipsi (ringOf, code, sol/sağ ayak) DAİMA ilk önceliktir.
                // Yalnızca klips/künye rengi yoksa cins/renk kontrolüne bakılır.
                const ringChipVal = ringChip(ringOf(b)) || 
                  (b.code && ringChip(b.code)) || 
                  (b.leftCode && ringChip(b.leftCode)) || 
                  (b.rightCode && ringChip(b.rightCode))

                const chip = ringChipVal ||
                  (bCinsiUpper.includes('BEYAZ KIRMIZILARDAN') || bCinsiUpper.includes('BEYAZ SARILARDAN') || bCinsiUpper.includes('BEYAZ KIRMIZILAR') || bCinsiUpper.includes('BEYAZ SARILAR')
                    ? ringChip('BEYAZ')
                    : (b.cinsi && ringChip(b.cinsi)) || (b.color && ringChip(b.color)))

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    style={{
                      width: '100%',
                      minHeight: 40,
                      padding: '9px 14px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      cursor: 'pointer',
                      fontSize: 'clamp(11px, 2.7vw, 13.5px)',
                      fontWeight: 700,
                      border: isSelected
                        ? '2px solid var(--accent, #38bdf8)'
                        : (chip?.isDual
                            ? '1px solid rgba(255, 255, 255, 0.22)'
                            : (chip?.isDark
                                ? '1px solid rgba(255, 255, 255, 0.85)'
                                : '1px solid var(--line, #334155)')),
                      background: chip ? chip.dolgu : (isSelected ? 'rgba(59, 130, 246, 0.16)' : 'var(--panel-2, #181d27)'),
                      color: chip ? chip.yazi : 'var(--text)',
                      textShadow: chip?.textShadow || 'none',
                      boxShadow: isSelected
                        ? '0 0 0 2px rgba(56, 189, 248, 0.45)'
                        : '0 1px 3px rgba(0,0,0,0.18)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      overflow: 'hidden',
                      maxWidth: 'calc(100% - 36px)',
                      whiteSpace: 'nowrap'
                    }}>
                      <span style={{
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {dispTr(ringOf(b))}
                      </span>

                      {b.name && b.name !== ringOf(b) && (
                        <span style={{
                          fontWeight: 600,
                          opacity: 0.85,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 1
                        }}>
                          {dispTr(`· ${b.name}`)}
                        </span>
                      )}

                      {showSex && b.sex && (
                        <span style={{
                          fontSize: 11,
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontWeight: 600,
                          background: b.sex === 'F' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: 'inherit',
                          flexShrink: 0
                        }}>
                          {dispTr(b.sex === 'F' ? '♀ Dişi' : '♂ Erkek')}
                        </span>
                      )}

                      {b.cinsi && (
                        <span style={{
                          fontSize: 11,
                          opacity: 0.8,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 1
                        }}>
                          {dispTr(`(${b.cinsi})`)}
                        </span>
                      )}

                      {tagText && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          opacity: 0.9,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 1
                        }}>
                          {dispTr(`· ${tagText}`)}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span style={{
                        position: 'absolute',
                        right: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: chip ? chip.yazi : 'var(--accent, #38bdf8)',
                        fontWeight: 900,
                        fontSize: 16
                      }}>✓</span>
                    )}
                  </button>
                )
              })}

              {/* Genel Item Listesi (Çiftler vb.) */}
              {items && filteredList.map(it => {
                if (!it) return null
                const isSelected = value === it.id

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleSelect(it.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: isSelected ? '1px solid var(--accent, #3b82f6)' : '1px solid var(--line, #334155)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.16)' : 'var(--panel-2, #181d27)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: isSelected ? 700 : 500,
                      textAlign: 'center',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', flex: 1, alignItems: 'center', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {dispTr(it.label)}
                      </span>
                      {it.sublabel && (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {dispTr(it.sublabel)}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span style={{
                        position: 'absolute',
                        right: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--accent, #3b82f6)',
                        fontWeight: 800,
                        fontSize: 16
                      }}>✓</span>
                    )}
                  </button>
                )
              })}

              {!filteredList.length && (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  {search ? dispTr(`"${search}" ile eşleşen sonuç bulunamadı.`) : dispTr(emptyText)}
                </div>
              )}
            </div>

            {/* Kayıt dışı seçenekler: kuş listesinin altında sabit durur.
                Seçilince çağıran taraf elle açıklama girişi gösterir. */}
            {extraOptions && extraOptions.length > 0 && (
              <div
                style={{
                  padding: '8px 10px 10px',
                  borderTop: '1px solid var(--line, #334155)',
                  background: 'var(--panel-2, #181d27)'
                }}
              >
                {extraTitle && (
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center', marginBottom: 6, letterSpacing: 0.3 }}>
                    {extraTitle}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(extraOptions.length, 3)}, minmax(0, 1fr))`, gap: 6 }}>
                  {extraOptions.map(o => {
                    const isSelected = value === o.value
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => handleSelect(o.value)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: 8,
                          border: isSelected ? '2px solid var(--accent, #38bdf8)' : '1px solid var(--line, #334155)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.16)' : 'var(--panel, #1e2430)',
                          color: isSelected ? 'var(--accent, #38bdf8)' : 'var(--text)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Kart Alt Çubuğu */}
            <div
              style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--line, #334155)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--panel-2, #181d27)'
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                {dispTr('Vazgeç / İptal (ESC)')}
              </button>
            </div>
          </div>

          {/* Alttaki boşluk - Tıklandığında işlemi iptal eder */}
          <div
            className="picker-bottom-space"
            onClick={() => setOpen(false)}
            style={{
              width: '100%',
              minHeight: 35,
              flex: '1 1 auto',
              cursor: 'pointer'
            }}
            title="İptal etmek için tıklayın (ESC)"
          />
        </div>
      )}
    </>
  )
}
