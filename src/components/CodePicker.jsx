import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { trUpper, trSearch, dispTr, PRIMARY_RING_COLORS, isDualCode, sortTr, findDualColorDuplicate, ringChip } from '../lib.js'
import { sortCinsi } from '../coops.js'
import Ring from './Ring.jsx'
import KlipsRing from './KlipsRing.jsx'
import BreedIcon from './BreedIcon.jsx'

export default function CodePicker({
  codes = [],
  items = null,
  value,
  onChange,
  onCodesChange,
  title = 'Künye Kodları',
  hint = 'Künyenin başına gelir, en fazla 24 karakter:',
  emptyText = 'Henüz kayıt yok.',
  placeholder = 'Örn. KIRMIZI KLİPS, SARI-KIRMIZI',
  emptyLabel = 'SEÇ',
  clearLabel = '— Seçimi Kaldır (Boş) —',
  buttonStyle = null,
  isColor = false,
  dualMode,
  onDualModeChange,
  // Salt seçim modu: kod ekleme/yönetme arayüzü gizlenir. Ayarları
  // değiştirmeyen, yalnızca mevcut listeden seçim yapan yerlerde kullanılır
  // (ör. "Klips Rengiyle Bul" penceresi).
  selectOnly = false,
  // Sol/Sağ ayak klips seçicilerinde kullanılır: seçili klips kartı sabit
  // genişlikte ve yazısı ortada gösterilir (iki ayak birbirine eşit genişlikte).
  chipFixed = false
}) {
  const [listOpen, setListOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [internalOnlyDual, setInternalOnlyDual] = useState(() => isColor && Boolean(isDualCode(value)))

  const onlyDual = dualMode !== undefined ? dualMode : internalOnlyDual
  const setOnlyDual = (val) => {
    if (onDualModeChange) onDualModeChange(val)
    setInternalOnlyDual(val)
  }

  const [draft, setDraft] = useState('')
  const [dualOpen, setDualOpen] = useState(false)
  const [color1, setColor1] = useState('SARI')
  const [color2, setColor2] = useState('KIRMIZI')
  const [colorPickerTarget, setColorPickerTarget] = useState(null) // 'c1' | 'c2' | null
  const searchInputRef = useRef(null)
const backdropRef = useRef(null)

  // ESC tuş dinleyicisi: ESC'ye basıldığında işlem iptal olur
  useEffect(() => {
    if (!listOpen && !manageOpen && !colorPickerTarget) return
    const onKey = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault()
        if (colorPickerTarget) {
          setColorPickerTarget(null)
        } else if (dualOpen) {
          setDualOpen(false)
        } else {
          setListOpen(false)
          setManageOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listOpen, manageOpen, colorPickerTarget, dualOpen])

  // Liste açıldığında arama kutusunu temizle ve odağı arama kutusuna al;
  // böylece klavyeden ESC (ve arama) beklendiği gibi çalışır.
  useEffect(() => {
    if (listOpen) {
      setSearch('')
      if (isColor && isDualCode(value) && dualMode === undefined) {
        setInternalOnlyDual(true)
      }
      // Odağı arama alanına ve backdrop'a taşı: ESC olaylarının container'a
      // ulaşması ve klavyeden kapatma için.
      setTimeout(() => {
        searchInputRef.current?.focus()
        backdropRef.current?.focus()
      }, 50)
    }
  }, [listOpen, isColor, value, dualMode])

  function add() {
    let c = trUpper(draft.trim())
    if (!c) return
    if (isColor) {
      c = c.replace(/\\bGRI\\b/g, 'GRİ').replace(/\\bKLIPS\\b/g, 'KLİPS')
    }
    if (isColor && isDualCode(c)) {
      const dup = findDualColorDuplicate(c, codes)
      if (dup) {
        if (dup.isExact) {
          alert(`"${c}" zaten listede kayıtlı!`)
        } else {
          alert(`"${dup.existing}" zaten listede kayıtlı!\nAynı renk kombinasyonu (${c}) tekrar eklenemez.`)
        }
        return
      }
    }
    if (!codes.includes(c)) onCodesChange([...codes, c])
    onChange(c)
    setDraft('')
    setManageOpen(false)
    setListOpen(false)
  }

  function remove(c) {
    const next = codes.filter(x => x !== c)
    onCodesChange(next)
    if (value === c) onChange(next[0] || '')
  }

  const filteredItems = useMemo(() => {
    if (!items) return null
    const q = trSearch(search)
    if (!q) return items
    return items.filter(it => trSearch(it.label || it.name || '').includes(q))
  }, [items, search])

  const filteredCodes = useMemo(() => {
    if (items) return []
    let list = codes
    const isNoneCode = c => c === 'KLİPSSİZ / TANIMSIZ' || c === 'KLİPSSİZ/TANIMSIZ' || c === 'KÜNYESİZLER'
    const isGoneCode = c => c === 'ÖLEN / KAÇTI / SATILDI'
    const isSpecialCode = c => isNoneCode(c) || isGoneCode(c)
    if (isColor) {
      const noneItem = codes.find(isNoneCode)
      const goneItem = codes.find(isGoneCode)
      const singles = codes.filter(c => !isSpecialCode(c) && !isDualCode(c))
      const duals = codes.filter(c => !isSpecialCode(c) && isDualCode(c))
      if (onlyDual) {
        list = sortTr(duals)
      } else {
        // Çift renkler seçili değilken yalnızca tek renkler gösterilir
        list = sortTr(singles)
      }
      if (noneItem) {
        list = [...list, noneItem]
      }
      if (goneItem) {
        list = [...list, goneItem]
      }
    } else {
      const noneItem = codes.find(isNoneCode)
      const goneItem = codes.find(isGoneCode)
      const rest = codes.filter(c => !isSpecialCode(c))
      list = sortCinsi(rest)
      if (noneItem) list = [...list, noneItem]
      if (goneItem) list = [...list, goneItem]
    }
    // Arama katlaması trSearch ile yapılır: trUpper "MAVI" kaydı ile
    // "mavi" aramasını eşleştiremez (İ/I).
    const q = trSearch(search)
    if (!q) return list
    return list.filter(c => trSearch(c).includes(q))
  }, [codes, items, search, isColor, onlyDual])

  return (
    <>
      <div style={{ display: 'flex', gap: 6, width: '100%', minWidth: 0 }}>
        <button
          type="button"
          onClick={() => setListOpen(true)}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            position: 'relative',
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '8px 24px 8px 12px',
            cursor: 'pointer',
            font: 'inherit',
            height: 42,
            boxSizing: 'border-box',
            ...(buttonStyle || {})
          }}
        >
          <div style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0
          }}>
            {value ? (
              items ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                  {(() => {
                    const selectedItem = items.find(it => (it.value ?? it.id) === value)
                    if (selectedItem?.badgeClass) {
                      return <span className={`tag ${selectedItem.badgeClass}`}>{dispTr(selectedItem.label)}</span>
                    }
                    if (selectedItem?.badge) {
                      return <span className={`tag ${selectedItem.badge}`}>{dispTr(selectedItem.label)}</span>
                    }
                    return (
                      <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dispTr(selectedItem?.label || value)}
                      </span>
                    )
                  })()}
                </div>
              ) : isColor ? (
                (value === 'KLİPSSİZ / TANIMSIZ' || value === 'KLİPSSİZ/TANIMSIZ' || value === 'KÜNYESİZLER') ? (
                  <span className="ring ring-chip ring-chip-none" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dispTr(value)}
                  </span>
                ) : value === 'ÖLEN / KAÇTI / SATILDI' ? (
                  <span className="ring ring-chip" style={{
                    background: 'rgba(239, 68, 68, 0.22)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    fontWeight: 800,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {dispTr(value)}
                  </span>
                ) : (
                  chipFixed ? (
                    <KlipsRing text={value} />
                  ) : (
                    <Ring text={value} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
                  )
                )
              ) : (
                <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dispTr(value)}
                </span>
              )
            ) : (
              <span style={{ color: 'var(--text)', fontSize: 'inherit', fontWeight: 'normal' }}>{dispTr(emptyLabel)}</span>
            )}
          </div>
          <span style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10,
            color: 'var(--muted)',
            pointerEvents: 'none'
          }}>▼</span>
        </button>
        {!selectOnly && (
          <button
            type="button"
            className="btn"
            title="Kod ekle / yönet"
            onClick={() => { setDraft(''); setManageOpen(true) }}
            style={{ padding: '6px 14px', fontSize: 18, lineHeight: 1, height: 42, flexShrink: 0 }}
          >+</button>
        )}
      </div>

      {/* 1. SEÇİM MODALI - ÜSTTEN VE ALTTAN BOŞLUK BIRAKAN ÖZEL LİSTE */}
      {listOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={backdropRef}
          tabIndex={-1}
          className="picker-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setListOpen(false) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
              e.preventDefault()
              e.stopPropagation()
              setListOpen(false)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 350,
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
            onClick={(e) => { if (e.target === e.currentTarget) setListOpen(false) }}
            style={{
              width: '100%',
              minHeight: 150,
              flex: '1 1 auto',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 10
            }}
            title="İptal etmek için tıklayın (ESC)"
          >
            {/* Üst/alt alanlar boş bırakılır; dokunulduğunda kapanır (ESC). */}
          </div>

          {/* Orta içerik kartı - Üstten ve alttan boşluklu, liste içinde kayan kart */}
          <div
            className="picker-card"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: 'min(72vh, calc(100vh - 220px))',
              background: 'var(--panel, #1e2430)',
              border: '1px solid var(--line, #334155)',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0
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
                  {dispTr(`${items ? items.length : codes.length} seçenek kayıtlı`)}
                </span>
              </div>
              <button
                type="button"
                className="x"
                onClick={() => setListOpen(false)}
                title={dispTr('İptal / Kapat (ESC)')}
                style={{ position: 'static', width: 34, height: 34, justifySelf: 'end' }}
              >×</button>
            </div>

            {/* Arama / Filtreleme kutusu */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line, #334155)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setListOpen(false) } }}
                  placeholder={dispTr('Listede ara...')}
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

              {isColor && !selectOnly && (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: onlyDual ? 'var(--accent, #38bdf8)' : 'var(--text)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '4px 2px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={onlyDual}
                    onChange={e => setOnlyDual(e.target.checked)}
                    style={{
                      accentColor: 'var(--accent, #38bdf8)',
                      width: 16,
                      height: 16,
                      cursor: 'pointer'
                    }}
                  />
                  <span>{dispTr('🎨 Çift Renkleri Göster')}</span>
                </label>
              )}
            </div>

            {/* Liste Alanı - Bu aralıkta kayar */}
            <div
              className="codepicker-list"
              style={{
                flex: '1 1 auto',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
              }}
            >
              {/* Seçimi Kaldır / Boş Bırak */}
              <button
                type="button"
                onClick={() => { onChange(''); setListOpen(false); }}
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
                  fontSize: 14.5,
                  fontWeight: !value ? 700 : 600,
                  minHeight: 44,
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <span>{dispTr(clearLabel)}</span>
                {!value && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 900, fontSize: 18 }}>✓</span>
                )}
              </button>

              {/* Items Listesi (Cinsiyet, Durum vb.) */}
              {items && filteredItems.map(it => {
                const itVal = it.value ?? it.id
                const isSelected = value === itVal
                const isSexF = it.badgeClass === 'F' || it.badge === 'F' || itVal === 'F'
                const isSexM = it.badgeClass === 'M' || it.badge === 'M' || itVal === 'M'
                const isDangerStatus = it.badgeClass === 'durum-satildi' || it.badgeClass === 'durum-kacti' || it.badgeClass === 'durum-oldu' || itVal === 'satildi' || itVal === 'kacti' || itVal === 'oldu'

                let bg = isSelected ? 'rgba(59, 130, 246, 0.20)' : 'var(--panel-2, #181d27)'
                let borderColor = isSelected ? '2px solid var(--accent, #3b82f6)' : '1px solid var(--line, #334155)'
                let textColor = isSelected ? 'var(--accent, #38bdf8)' : 'var(--text)'
                let checkColor = 'var(--accent, #38bdf8)'

                if (isSexF) {
                  bg = isSelected ? 'rgba(236, 72, 153, 0.28)' : 'rgba(236, 72, 153, 0.12)'
                  borderColor = isSelected ? '2px solid #ec4899' : '1px solid rgba(236, 72, 153, 0.35)'
                  textColor = isSelected ? '#f472b6' : '#f9a8d4'
                  checkColor = '#ec4899'
                } else if (isSexM) {
                  bg = isSelected ? 'rgba(59, 130, 246, 0.28)' : 'rgba(59, 130, 246, 0.12)'
                  borderColor = isSelected ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.35)'
                  textColor = isSelected ? '#60a5fa' : '#93c5fd'
                  checkColor = '#3b82f6'
                } else if (isDangerStatus) {
                  bg = isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.10)'
                  borderColor = isSelected ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.35)'
                  textColor = isSelected ? '#f87171' : '#fca5a5'
                  checkColor = '#ef4444'
                }

                return (
                  <button
                    key={itVal}
                    type="button"
                    onClick={() => { onChange(itVal); setListOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: borderColor,
                      background: bg,
                      color: textColor,
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      minHeight: 46,
                      boxSizing: 'border-box',
                      boxShadow: isSelected ? '0 0 0 2px rgba(56, 189, 248, 0.3)' : '0 1px 3px rgba(0,0,0,0.18)'
                    }}
                  >
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 'calc(100% - 40px)',
                      display: 'inline-block'
                    }}>
                      {dispTr(it.label)}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: checkColor,
                          fontWeight: 900,
                          fontSize: 18
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Kod / Renk Listesi */}
              {!items && filteredCodes.map(c => {
                const isSelected = value === c
                if (isColor) {
                  const isNone = c === 'KLİPSSİZ / TANIMSIZ' || c === 'KLİPSSİZ/TANIMSIZ' || c === 'KÜNYESİZLER'
                  const isGone = c === 'ÖLEN / KAÇTI / SATILDI'
                  const chip = (isNone || isGone) ? null : ringChip(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { onChange(c); setListOpen(false); }}
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
                        fontSize: 'clamp(11.5px, 2.8vw, 14px)',
                        fontWeight: 700,
                        border: isSelected
                          ? (isGone ? '2px solid #ef4444' : '2px solid var(--accent, #38bdf8)')
                          : (isGone
                              ? '1px solid rgba(239, 68, 68, 0.45)'
                              : (isNone
                                  ? '1px dashed var(--line, #334155)'
                                  : (chip?.isDual
                                      ? '1px solid rgba(255, 255, 255, 0.22)'
                                      : (chip?.isDark
                                          ? '1px solid rgba(255, 255, 255, 0.85)'
                                          : '1px solid var(--line, #334155)')))),
                        background: isGone
                          ? (isSelected ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.15)')
                          : (isNone
                              ? 'transparent'
                              : (chip ? chip.dolgu : 'var(--panel-2, #181d27)')),
                        color: isGone
                          ? '#f87171'
                          : (isNone
                              ? 'var(--muted, #94a3b8)'
                              : (chip ? chip.yazi : 'var(--text)')),
                        textShadow: (!isNone && !isGone && chip?.textShadow) ? chip.textShadow : 'none',
                        boxShadow: isSelected
                          ? (isGone ? '0 0 0 2px rgba(239, 68, 68, 0.45)' : '0 0 0 2px rgba(56, 189, 248, 0.45)')
                          : ((isNone || isGone) ? 'none' : '0 1px 3px rgba(0,0,0,0.18)'),
                        boxSizing: 'border-box'
                      }}
                    >
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 'calc(100% - 40px)',
                        display: 'inline-block'
                      }}>
                        {dispTr(c)}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            position: 'absolute',
                            right: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontWeight: 900,
                            fontSize: 16,
                            color: isGone ? '#ef4444' : (isNone ? 'var(--accent, #38bdf8)' : (chip ? chip.yazi : 'var(--accent, #38bdf8)'))
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  )
                }

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { onChange(c); setListOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      width: '100%',
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid var(--accent, #3b82f6)' : '1px solid var(--line, #334155)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'var(--panel-2, #181d27)',
                      color: isSelected ? 'var(--accent, #38bdf8)' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: 700,
                      minHeight: 48,
                      boxSizing: 'border-box',
                      boxShadow: isSelected ? '0 0 0 2px rgba(56, 189, 248, 0.3)' : '0 1px 3px rgba(0,0,0,0.18)'
                    }}
                  >
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 'calc(100% - 40px)'
                    }}>
                      <BreedIcon cinsi={c} size={32} />
                      <span>{dispTr(c)}</span>
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--accent, #38bdf8)',
                          fontWeight: 900,
                          fontSize: 18
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}

              {((items && !filteredItems.length) || (!items && !filteredCodes.length)) && (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  {onlyDual
                    ? (selectOnly
                        ? dispTr('Kayıtlı çift renk bulunamadı.')
                        : dispTr('Kayıtlı çift renk bulunamadı. + butonundan yeni çift renk oluşturabilirsiniz.'))
                    : (search ? dispTr(`"${search}" ile eşleşen seçenek bulunamadı.`) : dispTr(emptyText))}
                </div>
              )}
            </div>

            {/* Kart Alt Çubuğu */}
            <div
              style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--line, #334155)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--panel-2, #181d27)',
                gap: 8
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setListOpen(false)}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                {dispTr('Vazgeç / İptal (ESC)')}
              </button>
              {!selectOnly && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setListOpen(false)
                    setDraft(search.trim())
                    setManageOpen(true)
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}
                >
                  {dispTr('+ Yeni Ekle')}
                </button>
              )}
            </div>
          </div>

          {/* Alttaki boşluk - Tıklandığında işlemi iptal eder */}
          <div
            className="picker-bottom-space"
            onClick={(e) => { if (e.target === e.currentTarget) setListOpen(false) }}
            style={{
              width: '100%',
              minHeight: 150,
              flex: '1 1 auto',
              cursor: 'pointer'
            }}
            title="İptal etmek için tıklayın (ESC)"
          />
        </div>,
        document.body
      )}

      {/* 2. YÖNETİM MODALI - KOD / RENK EKLEME VE SİLME */}
      {manageOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="picker-backdrop"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
              e.preventDefault()
              e.stopPropagation()
              setManageOpen(false)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 360,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            userSelect: 'none',
            padding: '0 12px'
          }}
        >
          <div style={{ minHeight: 150, flex: '1 1 auto' }} />
          <div className="modal" style={{ maxWidth: 340, flexShrink: 0, margin: '0 auto' }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{dispTr(title)}</h2>
              <button type="button" className="x" onClick={() => setManageOpen(false)}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={draft}
                maxLength={24}
                placeholder={dispTr(placeholder)}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
                style={{
                  flex: 1, minWidth: 0, background: 'var(--panel-2)', border: '1px solid var(--line)',
                  color: 'var(--text)', borderRadius: 8, padding: '9px 10px', textTransform: 'uppercase'
                }}
              />
              <button type="button" className="btn primary" onClick={add}>{dispTr('Ekle')}</button>
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{dispTr('Önizleme:')}</span>
                {draft ? (
                  isColor ? (
                    <Ring text={trUpper(draft)} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
                  ) : (
                    <strong style={{ color: 'var(--text)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dispTr(draft)}
                    </strong>
                  )
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                )}
              </div>
              {isColor && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setDualOpen(!dualOpen)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    whiteSpace: 'nowrap',
                    background: dualOpen ? 'var(--accent)' : 'var(--panel-2)',
                    color: dualOpen ? '#ffffff' : 'var(--text)',
                    borderColor: dualOpen ? 'var(--accent)' : 'var(--line)'
                  }}
                >
                  {dualOpen ? dispTr('▲ Kapat') : dispTr('🎨 Çift Renk')}
                </button>
              )}
            </div>

            {/* Çift Renk Sihirbazı */}
            {isColor && dualOpen && (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                background: 'var(--panel-2)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{dispTr('🎨 ÇİFT RENK OLUŞTURUCU')}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{dispTr('Alacalı Klips')}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>{dispTr('1. RENK')}</label>
                    <button
                      type="button"
                      onClick={() => setColorPickerTarget('c1')}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'var(--panel)',
                        color: 'var(--text)',
                        border: '1px solid var(--line)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <Ring text={color1} />
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>▼</span>
                    </button>
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>{dispTr('2. RENK')}</label>
                    <button
                      type="button"
                      onClick={() => setColorPickerTarget('c2')}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'var(--panel)',
                        color: 'var(--text)',
                        border: '1px solid var(--line)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <Ring text={color2} />
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>▼</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, gap: 6 }}>
                  <Ring text={`${color1}-${color2} KLİPS`} />
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => {
                      if (color1 === color2) {
                        alert('Çift renk klips için 2 farklı renk seçmelisiniz!')
                        return
                      }
                      const dualCode = `${color1}-${color2} KLİPS`
                      const dup = findDualColorDuplicate(dualCode, codes)
                      if (dup) {
                        if (dup.isExact) {
                          alert(`"${dualCode}" zaten listede kayıtlı!`)
                        } else {
                          alert(`"${dup.existing}" zaten listede kayıtlı!\nAynı renk kombinasyonu (${dualCode}) tekrar eklenemez.`)
                        }
                        return
                      }
                      if (!codes.includes(dualCode)) onCodesChange([...codes, dualCode])
                      onChange(dualCode)
                      setDualOpen(false)
                      setManageOpen(false)
                      setListOpen(false)
                    }}
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                  >
                    {dispTr('+ Bu Çift Rengi Ekle')}
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 220, overflowY: 'auto', padding: 2 }}>
              {sortCinsi(codes).map(c => (
                <span key={c} className="chip" style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 6px' }}>
                  <span
                    style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}
                    title={c}
                    onClick={() => { onChange(c); setManageOpen(false) }}
                  >
                    {isColor ? <Ring text={c} /> : <span style={{ color: 'var(--text)', fontWeight: 600 }}>{dispTr(c)}</span>}
                  </span>
                  <button type="button" className="x2" title="Sil" onClick={() => remove(c)}>×</button>
                </span>
              ))}
              {!codes.length && <span className="hint">{dispTr(emptyText)}</span>}
            </div>

            <p className="hint" style={{ marginTop: 14 }}>
              {dispTr(hint)}{' '}
              <b className={isColor ? "ring" : ""}>{draft ? dispTr(draft) + '…' : '…'}</b>
            </p>

            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setManageOpen(false)}>{dispTr('Kapat')}</button>
            </div>
          </div>
          <div style={{ minHeight: 150, flex: '1 1 auto' }} />
        </div>,
        document.body
      )}

      {/* 3. ÇİFT RENK İÇİN RENK SEÇİMİ (ASLA EKRANI KAPLAMAZ, ÜST-ALT BOŞLUKLU, ESC İLE KAPANIR) */}
      {isColor && colorPickerTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="picker-backdrop"
          onClick={() => setColorPickerTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 450,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 16px',
            boxSizing: 'border-box'
          }}
        >
          {/* Üstteki boşluk - Tıklandığında işlemi iptal eder */}
          <div
            onClick={() => setColorPickerTarget(null)}
            style={{
              width: '100%',
              minHeight: 40,
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="İptal etmek için tıklayın (ESC)"
          >
            {/* Boşluk alanı; dokunulup kapanır. */}
          </div>

          {/* Orta içerik kartı - Üstten ve alttan boşluklu, asla ekranı kaplamaz */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 320,
              maxHeight: 'min(56vh, calc(100vh - 200px))',
              background: 'var(--panel, #1e2430)',
              border: '1px solid var(--line, #334155)',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            {/* Kart Başlığı */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line, #334155)',
                display: 'grid',
                gridTemplateColumns: '36px 1fr 36px',
                alignItems: 'center',
                background: 'var(--panel-2, #181d27)'
              }}
            >
              <div />
              <div style={{ textAlign: 'center', minWidth: 0, padding: '0 4px' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {colorPickerTarget === 'c1' ? dispTr('1. RENK SEÇİN') : dispTr('2. RENK SEÇİN')}
                </h3>
              </div>
              <button
                type="button"
                className="x"
                onClick={() => setColorPickerTarget(null)}
                title="İptal / Kapat (ESC)"
                style={{ position: 'static', width: 32, height: 32, justifySelf: 'end' }}
              >×</button>
            </div>

            {/* 2 sütunlu kompakt renk listesi */}
            <div
              style={{
                padding: '10px 12px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                maxHeight: 280
              }}
            >
              {PRIMARY_RING_COLORS.map(c => {
                const isSelected = (colorPickerTarget === 'c1' ? color1 : color2) === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (colorPickerTarget === 'c1') setColor1(c)
                      else setColor2(c)
                      setColorPickerTarget(null)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isSelected ? '1px solid var(--accent, #3b82f6)' : '1px solid var(--line, #334155)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.16)' : 'var(--panel-2, #181d27)',
                      cursor: 'pointer'
                    }}
                  >
                    <Ring text={c} />
                    {isSelected && (
                      <span style={{ color: 'var(--accent, #3b82f6)', fontWeight: 800, fontSize: 14 }}>✓</span>
                    )}
                  </button>
                )
              })}
            </div>

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
                className="btn small"
                onClick={() => setColorPickerTarget(null)}
                style={{
                  padding: '8px 14px',
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
            onClick={() => setColorPickerTarget(null)}
            style={{
              width: '100%',
              minHeight: 40,
              flex: '1 1 auto',
              cursor: 'pointer'
            }}
            title="İptal etmek için tıklayın (ESC)"
          />
        </div>,
        document.body
      )}
    </>
  )
}