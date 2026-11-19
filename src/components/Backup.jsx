import { useEffect, useState, useMemo } from 'react'
import { sortTr, trUpper, isFormer, isGone, ringColor, isDualCode, findDuplicateDualCodesInList, DEFAULT_MED_CATEGORIES, dispTr } from '../lib.js'
import Ring from './Ring.jsx'
import { THEMES, DEFAULT_THEME, previewTheme } from '../themes.js'
import {
  sendTestNotification,
  sendTestTelegramNotification,
  sendClutchTelegramSummary
} from '../notifications.js'
import { ENABLE_LOFT_CHECK } from './LoftCheck.jsx'
import CoopsSettings from './CoopsSettings.jsx'
import { coopCinsiList, coopList, sortCinsi } from '../coops.js'
import { getCurrentVersionInfo, checkForUpdate } from '../updater.js'

export default function Backup({ db, account, activeCoopId, onSaveSettings, onNotify, onSignOut, onOpenActivityLog, activitiesCount = 0, onResetLoftChecks, onOpenUpdate, onDeleteCoop }) {
  const getInitialSingleCodes = () => {
    if (db.settings?.singleCodes && Array.isArray(db.settings.singleCodes)) {
      return db.settings.singleCodes.join(', ')
    }
    const all = sortTr([...new Set([...(db.settings?.rightCodes || []), ...(db.settings?.leftCodes || []), ...(db.settings?.codes || [])])])
    return all.filter(c => !isDualCode(c)).join(', ')
  }

  const getInitialDualCodes = () => {
    if (db.settings?.dualCodes && Array.isArray(db.settings.dualCodes)) {
      return db.settings.dualCodes.join(', ')
    }
    const all = sortTr([...new Set([...(db.settings?.rightCodes || []), ...(db.settings?.leftCodes || []), ...(db.settings?.codes || [])])])
    return all.filter(c => isDualCode(c)).join(', ')
  }

  const [singleCodes, setSingleCodes] = useState(getInitialSingleCodes)
  const [dualCodes, setDualCodes] = useState(getInitialDualCodes)
  const [showSingleCodes, setShowSingleCodes] = useState(false)
  const [showDualCodes, setShowDualCodes] = useState(false)
  const [codeColors, setCodeColors] = useState(db.settings.codeColors || {})
  const [coopCinsiText, setCoopCinsiText] = useState(() => {
    const map = {}
    for (const c of coopList(db)) map[c.id] = coopCinsiList(db, c.id).join(', ')
    return map
  })
  const [medCategories, setMedCategories] = useState((db.settings.medicationCategories || DEFAULT_MED_CATEGORIES).join(', '))
  const [theme, setTheme] = useState(db.settings.theme || DEFAULT_THEME)
  const [busy, setBusy] = useState('')
  const [dataPath, setDataPath] = useState('')
  const [showPwChange, setShowPwChange] = useState(false)
  const [newPw1, setNewPw1] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [showPwText, setShowPwText] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  // Telegram bildirim ayarları
  const [tgToken, setTgToken] = useState(db.settings?.telegram?.botToken || '')
  const [tgChatId, setTgChatId] = useState(db.settings?.telegram?.chatId || '')
  const [tgEnabled, setTgEnabled] = useState(db.settings?.telegram?.enabled ?? false)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgReporting, setTgReporting] = useState(false)

  // Kümes Modu (Saya / Posta / Hibrit)
  const [loftMode, setLoftMode] = useState(db.settings?.loftMode || 'saya')
  const [loftName, setLoftName] = useState(db.settings?.loftName || '')
  const [confirmMode, setConfirmMode] = useState(null)
  const [versionInfo, setVersionInfo] = useState(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    getCurrentVersionInfo().then(setVersionInfo).catch(() => {})
  }, [])

  // Açık olan kartlar (Kullanıcı tercihi localStorage'da tutulur; varsayılan olarak kapalı ve düzenli)
  const allCards = ['mode', 'coops', 'codes', 'theme', 'loftCheck', 'notifications', 'logs', 'account', 'backup', 'version']
  const [openCards, setOpenCards] = useState(() => {
    try {
      const saved = localStorage.getItem('settings_open_cards')
      if (saved !== null) {
        return new Set(JSON.parse(saved))
      }
    } catch (_) {}
    return new Set() // Varsayılan olarak tüm kartlar kapalı
  })

  const toggleCard = (id) => {
    setOpenCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('settings_open_cards', JSON.stringify([...next]))
      } catch (_) {}
      return next
    })
  }

  const allOpen = openCards.size >= allCards.length
  const toggleAll = () => {
    setOpenCards(prev => {
      const next = prev.size >= allCards.length ? new Set() : new Set(allCards)
      try {
        localStorage.setItem('settings_open_cards', JSON.stringify([...next]))
      } catch (_) {}
      return next
    })
  }

  // Ana ekrandaki sayaçla aynı mantık
  const pairedCount = () => {
    const mated = new Set()
    for (const p of db.pairings) {
      if (isFormer(p)) continue
      if (p.maleId) mated.add(p.maleId)
      if (p.femaleId) mated.add(p.femaleId)
    }
    return db.birds.filter(b => !isGone(b) && mated.has(b.id)).length
  }

  useEffect(() => {
    api.userDataPath().then(r => r.ok && setDataPath(r.data))
  }, [])

  const dbSingleCodes = useMemo(() => {
    if (db.settings?.singleCodes && Array.isArray(db.settings.singleCodes)) {
      return db.settings.singleCodes.join(', ')
    }
    const all = sortTr([...new Set([...(db.settings?.rightCodes || []), ...(db.settings?.leftCodes || []), ...(db.settings?.codes || [])])])
    return all.filter(c => !isDualCode(c)).join(', ')
  }, [db.settings?.singleCodes, db.settings?.codes, db.settings?.rightCodes, db.settings?.leftCodes])

  const dbDualCodes = useMemo(() => {
    if (db.settings?.dualCodes && Array.isArray(db.settings.dualCodes)) {
      return db.settings.dualCodes.join(', ')
    }
    const all = sortTr([...new Set([...(db.settings?.rightCodes || []), ...(db.settings?.leftCodes || []), ...(db.settings?.codes || [])])])
    return all.filter(c => isDualCode(c)).join(', ')
  }, [db.settings?.dualCodes, db.settings?.codes, db.settings?.rightCodes, db.settings?.leftCodes])

  const coopsForCinsi = useMemo(
    () => coopList(db),
    [db.settings?.coops, db.settings?.loftName]
  )
  // Kümes bazlı cins metinleri; başka cihazdan gelen değişiklikte tazelenir.
  const coopCinsiKey = JSON.stringify(db.settings?.coopCinsi || {}) +
    '::' + coopsForCinsi.map(c => c.id).join('|')
  useEffect(() => { setSingleCodes(dbSingleCodes) }, [dbSingleCodes])
  useEffect(() => { setDualCodes(dbDualCodes) }, [dbDualCodes])
  useEffect(() => {
    const map = {}
    for (const c of coopsForCinsi) map[c.id] = coopCinsiList(db, c.id).join(', ')
    setCoopCinsiText(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopCinsiKey])
  useEffect(() => {
    setMedCategories((db.settings?.medicationCategories || DEFAULT_MED_CATEGORIES).join(', '))
  }, [db.settings?.medicationCategories])
  useEffect(() => { setCodeColors(db.settings?.codeColors || {}) }, [db.settings?.codeColors])

  // Elle seçilen klips rengi kısa bir gecikmeyle OTOMATİK kaydedilir.
  // Böylece kullanıcı "rengi seçtim ama kaydolmadı / 'Kaydet'e basmayı
  // unuttum" durumunu yaşamaz. Renk seçiciyi canlı sürüklerken çok fazla
  // yazma olmasın diye 600 ms beklenir. "Ayarları Kaydet" de aynı veriyi yazar.
  useEffect(() => {
    const saved = JSON.stringify(db.settings?.codeColors || {})
    if (JSON.stringify(codeColors || {}) === saved) return
    const t = setTimeout(() => {
      onSaveSettings({ ...db.settings, codeColors })
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeColors])
  useEffect(() => { setLoftMode(db.settings?.loftMode || 'saya') }, [db.settings?.loftMode])
  useEffect(() => { setLoftName(db.settings?.loftName || '') }, [db.settings?.loftName])
  useEffect(() => {
    if (db.settings?.telegram) {
      setTgToken(db.settings.telegram.botToken || '')
      setTgChatId(db.settings.telegram.chatId || '')
      setTgEnabled(db.settings.telegram.enabled ?? false)
    }
  }, [db.settings?.telegram])

  const secilenAd = (THEMES.find(t => t.id === theme) || {}).ad || theme || DEFAULT_THEME
  const kayitli = db.settings?.theme || DEFAULT_THEME
  const kirli = theme !== kayitli

  const parsedSingleCodes = useMemo(() => {
    return sortTr(singleCodes.split(',').map(s => trUpper(s.trim())).filter(Boolean))
  }, [singleCodes])

  const parsedDualCodes = useMemo(() => {
    return sortTr(dualCodes.split(',').map(s => trUpper(s.trim())).filter(Boolean))
  }, [dualCodes])

  const dualDuplicates = useMemo(() => {
    return findDuplicateDualCodesInList(parsedDualCodes)
  }, [parsedDualCodes])

  const allDistinctCodes = useMemo(() => {
    return sortTr([...new Set([...parsedSingleCodes, ...parsedDualCodes])])
  }, [parsedSingleCodes, parsedDualCodes])

  const checkedBirdsCount = useMemo(() => {
    return (db.birds || []).filter(b => Boolean(b.checkedAt)).length
  }, [db.birds])

  const uncheckedBirdsCount = useMemo(() => {
    return (db.birds || []).filter(b => !b.checkedAt).length
  }, [db.birds])

  const renderColorCard = (code) => {
    const currentColor = codeColors[code] || ringColor(code) || '#38bdf8'
    return (
      <div
        key={code}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 8
        }}
      >
        <Ring text={code} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="color"
            value={currentColor}
            onChange={e => {
              const next = { ...codeColors, [code]: e.target.value }
              setCodeColors(next)
            }}
            title="Rengi değiştir"
            style={{
              width: 32,
              height: 28,
              padding: 0,
              border: '1px solid var(--line)',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent'
            }}
          />
          {codeColors[code] && (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const next = { ...codeColors }
                delete next[code]
                setCodeColors(next)
              }}
              title="Varsayılan renge dön"
              style={{ padding: '2px 6px', fontSize: 11 }}
            >
              ↺
            </button>
          )}
        </div>
      </div>
    )
  }

  const handleSaveMode = (newMode) => {
    setLoftMode(newMode)
    onSaveSettings({
      ...db.settings,
      loftMode: newMode,
      loftName: (loftName || '').trim()
    })
    const names = {
      saya: 'Saya & Kostüm Modu (Klips Odaklı)',
      posta: 'Posta & Yarış Modu (Resmi Marka & FCI Pedigre)',
      hibrit: 'Kapsamlı (Hibrit) Mod'
    }
    onNotify(`Kümes modu değiştirildi: ${names[newMode] || newMode}`)
  }

  const handleModeClick = (newMode) => {
    if (newMode === loftMode) return
    setConfirmMode(newMode)
  }

  const handleSaveGeneral = () => {
    if (dualDuplicates.length > 0) {
      const first = dualDuplicates[0]
      alert(`Çift renk klipslerde mükerrer kombinasyon var!\n"${first.existing}" ile "${first.current}" aynı renktir.\nLütfen birini silip tekrar kaydedin.`)
      return
    }
    const mergedCodes = sortTr([...new Set([...parsedSingleCodes, ...parsedDualCodes])])
    // Cinsler kümes bazında kaydedilir: her giriş kendi kümesine yazılır.
    const nextCoopCinsi = {}
    for (const c of coopsForCinsi) {
      nextCoopCinsi[c.id] = sortCinsi(
        (coopCinsiText[c.id] || '').split(',').map(s => trUpper(s.trim())).filter(Boolean)
      )
    }
    const allCinsi = sortCinsi([...new Set(Object.values(nextCoopCinsi).flat())])
    onSaveSettings({
      ...db.settings,
      owner: db.settings?.owner || '',
      theme,
      loftMode,
      loftName: (loftName || '').trim(),
      singleCodes: parsedSingleCodes,
      dualCodes: parsedDualCodes,
      rightCodes: mergedCodes,
      leftCodes: mergedCodes,
      codes: mergedCodes,
      coopCinsi: nextCoopCinsi,
      cinsi: allCinsi,
      medicationCategories: sortTr(medCategories.split(',').map(s => trUpper(s.trim())).filter(Boolean)),
      codeColors,
      telegram: {
        botToken: tgToken.trim(),
        chatId: tgChatId.trim(),
        enabled: Boolean(tgEnabled)
      }
    })
    onNotify('Ayarlar kaydedildi')
  }

  const handleSaveTelegram = () => {
    onSaveSettings({
      ...db.settings,
      telegram: {
        botToken: tgToken.trim(),
        chatId: tgChatId.trim(),
        enabled: Boolean(tgEnabled)
      }
    })
    onNotify('Telegram ayarları kaydedildi')
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      {/* ÜST SATIR: Çıkış ve Geçmiş (her zaman görünür, her yerden erişilebilir) */}
      <div
        style={{
          maxWidth: 560,
          margin: '16px auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%', justifyContent: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: 22 }}>🚪</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'none', wordBreak: 'break-all' }}>
              {account?.email}
            </div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'none' }}>{dispTr('Hesap ve işlemler')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
          <button
            type="button"
            className="btn"
            onClick={onOpenActivityLog}
            style={{ flex: '1 1 0', minWidth: 120, padding: '10px 14px', fontSize: 13, justifyContent: 'center' }}
          >
            {dispTr('📋 İşlem Geçmişi')}
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy === 'out'}
            onClick={onSignOut}
            style={{ flex: '1 1 0', minWidth: 120, padding: '10px 14px', fontSize: 13, justifyContent: 'center' }}
          >
            {busy === 'out' ? '…' : dispTr('Çıkış Yap')}
          </button>
        </div>
      </div>

      {/* Üst Bar: Başlık ve Tümünü Aç/Kapat */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{dispTr('AYARLAR & YÖNETİM')}</h2>
          <div className="muted" style={{ fontSize: 12 }}>{dispTr('Klipsler, renkler, bildirimler ve sistem tercihleri')}</div>
        </div>
        <button
          type="button"
          className="btn small"
          onClick={toggleAll}
          style={{ fontSize: 12, padding: '5px 10px' }}
        >
          {allOpen ? dispTr('Tümünü Daralt ∧') : dispTr('Tümünü Genişlet ∨')}
        </button>
      </div>

      <div className="settings-accordion">
        {/* 0. KART: KÜMES TÜRÜ & ÇALIŞMA MODU */}
        <div className={`settings-card ${openCards.has('mode') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('mode')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>
                {loftMode === 'posta' ? '🚀' : loftMode === 'hibrit' ? '🌐' : '🕊️'}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('KÜMES TÜRÜ & ÇALIŞMA MODU')}</div>
                <div className="settings-card-sub">
                  {dispTr('Saya & Klips, Posta (Yarış) veya Kapsamlı Hibrit mod tercihi')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{
                fontSize: 11,
                background: loftMode === 'posta' ? '#38bdf825' : loftMode === 'hibrit' ? '#a855f725' : 'var(--panel-2)',
                color: loftMode === 'posta' ? '#38bdf8' : loftMode === 'hibrit' ? '#c084fc' : 'var(--text)',
                fontWeight: 700
              }}>
                {loftMode === 'posta' ? dispTr('🚀 POSTA MODU') : loftMode === 'hibrit' ? dispTr('🌐 HİBRİT MOD') : dispTr('🕊️ SAYA MODU')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('mode') && (
            <div className="settings-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 16 }}>
                {/* SAYA MODU */}
                <div
                  onClick={() => handleModeClick('saya')}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: `2px solid ${loftMode === 'saya' ? 'var(--accent)' : 'var(--line)'}`,
                    background: loftMode === 'saya' ? 'var(--accent-wash)' : 'var(--panel-2)',
                    cursor: 'pointer',
                    transition: 'all .15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>🕊️</span>
                    {loftMode === 'saya' && <span className="tag primary" style={{ fontSize: 10, fontWeight: 700 }}>{dispTr('AKTİF')}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{dispTr('Saya & Kostüm Modu')}</div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {dispTr('3D renkli klips gruplaması, kostüm renkleri ve eşleştirme simülatörü odaklı klasik kümes modu.')}
                  </div>
                </div>

                {/* POSTA MODU */}
                <div
                  onClick={() => handleModeClick('posta')}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: `2px solid ${loftMode === 'posta' ? '#38bdf8' : 'var(--line)'}`,
                    background: loftMode === 'posta' ? '#38bdf818' : 'var(--panel-2)',
                    cursor: 'pointer',
                    transition: 'all .15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>🚀</span>
                    {loftMode === 'posta' && <span className="tag" style={{ background: '#38bdf8', color: '#000', fontSize: 10, fontWeight: 700 }}>{dispTr('AKTİF')}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, color: loftMode === 'posta' ? '#38bdf8' : 'inherit' }}>
                    {dispTr('Posta & Yarış Modu')}
                  </div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {dispTr('Resmi federasyon/dernek markaları, saat çipi, kan hatları, yarış dereceleri ve FCI 4-kuşak yarış pedigresi.')}
                  </div>
                </div>

                {/* HİBRİT MOD */}
                <div
                  onClick={() => handleModeClick('hibrit')}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: `2px solid ${loftMode === 'hibrit' ? '#a855f7' : 'var(--line)'}`,
                    background: loftMode === 'hibrit' ? '#a855f718' : 'var(--panel-2)',
                    cursor: 'pointer',
                    transition: 'all .15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>🌐</span>
                    {loftMode === 'hibrit' && <span className="tag" style={{ background: '#a855f7', color: '#fff', fontSize: 10, fontWeight: 700 }}>{dispTr('AKTİF')}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, color: loftMode === 'hibrit' ? '#c084fc' : 'inherit' }}>
                    {dispTr('Kapsamlı (Hibrit) Mod')}
                  </div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {dispTr('Hem 3D renkli klipsler hem resmi federasyon markaları aynı anda devrede. Karma kümesler içindir.')}
                  </div>
                </div>
              </div>

              {/* Kümes / Damızlık Adı (Pedigre Başlığı İçin) */}
              <div className="field wide" style={{ marginTop: 6 }}>
                <label>
                  <span>{dispTr('Resmi Kümes / Damızlık Adı (FCI Pedigre Sertifikasında Başlıkta Görünür)')}</span>
                  <input
                    type="text"
                    value={loftName}
                    onChange={e => setLoftName(e.target.value)}
                    onBlur={() => {
                      if (loftName !== (db.settings?.loftName || '')) {
                        onSaveSettings({ ...db.settings, loftName: loftName.trim() })
                      }
                    }}
                    placeholder={dispTr('Örn: YILDIZ POSTA KÜMESİ / EGE DAMIZLIK')}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 0.1 KART: KÜMESLER (FİZİKSEL BÖLMELER) */}
        <div className={`settings-card ${openCards.has('coops') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('coops')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🏠</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('KÜMESLER')}</div>
                <div className="settings-card-sub">
                  {dispTr('Çatıdaki fiziksel bölmeler: ad, renk ve sıra')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: 'var(--panel-2)' }}>
                {(db.settings?.coops || []).length} {dispTr('KÜMES')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('coops') && (
            <div className="settings-card-body">
              <CoopsSettings
                db={db}
                activeCoopId={activeCoopId}
                onSaveSettings={onSaveSettings}
                onNotify={onNotify}
                onDeleteCoop={onDeleteCoop}
              />
            </div>
          )}
        </div>

        {/* 1. KART: KLİPS KODLARI & BONCUK RENKLERİ */}
        <div className={`settings-card ${openCards.has('codes') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('codes')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🏷️</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('KLİPS KODLARI & BONCUK RENKLERİ & GÜVERCİN CİNSLERİ & HASTALIK KATEGORİLERİ')}</div>
                <div className="settings-card-sub">
                  {dispTr('Tek renk ve çift renk klipslerinizi buradan düzenleyebilirsiniz (Her iki ayak için de geçerlidir)')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: 'var(--panel-2)' }}>
                {allDistinctCodes.length} {dispTr('RENK')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('codes') && (
            <div className="settings-card-body">
              {/* İki Ayrı Tik / Onay Kutusu: Düz Renkler & Çift Renkler */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--panel-2)',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  marginBottom: 16
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    margin: 0,
                    fontWeight: 600,
                    fontSize: 13,
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showSingleCodes}
                    onChange={e => setShowSingleCodes(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <span>{dispTr('🎨 Düz Renkleri Göster')} ({parsedSingleCodes.length})</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    margin: 0,
                    fontWeight: 600,
                    fontSize: 13,
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showDualCodes}
                    onChange={e => setShowDualCodes(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <span>{dispTr('🎨 Çift Renkleri Göster')} ({parsedDualCodes.length})</span>
                </label>
              </div>

              <div className="form-grid">
                {/* 1. DÜZ RENKLER BÖLÜMÜ (Yalnızca tik seçildiğinde açılır) */}
                {showSingleCodes && (
                  <div
                    className="field wide"
                    style={{
                      padding: 14,
                      background: 'var(--panel-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      marginBottom: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dispTr('🎨 DÜZ (TEK) RENK KLİPSLER')} ({parsedSingleCodes.length})</span>
                      <span className="muted" style={{ fontSize: 11 }}>{dispTr('Her iki ayak için geçerli')}</span>
                    </div>
                    <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{dispTr('Virgülle ayırarak girin:')}</label>
                    <input
                      value={singleCodes}
                      onChange={e => setSingleCodes(e.target.value)}
                      placeholder={dispTr('Örn: BEYAZ KLİPS, SARI KLİPS, YEŞİL KLİPS, MAVİ KLİPS')}
                      style={{ marginBottom: 12 }}
                    />

                    {parsedSingleCodes.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                          {dispTr('Düz Renk Paletleri (Otomatik veya Elle Seçim):')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                          {parsedSingleCodes.map(code => renderColorCard(code))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. ÇİFT RENKLER BÖLÜMÜ (Yalnızca tik seçildiğinde açılır) */}
                {showDualCodes && (
                  <div
                    className="field wide"
                    style={{
                      padding: 14,
                      background: 'var(--panel-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      marginBottom: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dispTr('🎨 ÇİFT RENK KLİPSLER')} ({parsedDualCodes.length})</span>
                      <span className="muted" style={{ fontSize: 11 }}>{dispTr('Ters sıra kombini otomatik engellenir')}</span>
                    </div>
                    <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{dispTr('Virgülle ayırarak girin:')}</label>
                    <input
                      value={dualCodes}
                      onChange={e => setDualCodes(e.target.value)}
                      placeholder={dispTr('Örn: SARI-KIRMIZI KLİPS, SİYAH-BEYAZ KLİPS, SARI-MAVİ KLİPS')}
                      style={{ marginBottom: 12 }}
                    />

                    {/* Mükerrer Çift Renk Uyarısı */}
                    {dualDuplicates.length > 0 && (
                      <div
                        style={{
                          padding: '10px 14px',
                          background: '#ef444420',
                          border: '1px solid #ef4444',
                          borderRadius: 8,
                          color: '#f87171',
                          fontSize: 12.5,
                          marginBottom: 12,
                          lineHeight: 1.5
                        }}
                      >
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span>{dispTr('⚠️ MÜKERRER / TERS KOMBİNASYON TESPİT EDİLDİ:')}</span>
                        </div>
                        <div>
                          {dispTr('Aynı renkler ters sırada dahi olsa 2 kez girilemez. Lütfen mükerrer olanı silin:')}
                        </div>
                        <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                          {dualDuplicates.map((dup, idx) => (
                            <li key={idx}>
                              <strong>&quot;{dup.existing}&quot;</strong> {dispTr('ile')} <strong>&quot;{dup.current}&quot;</strong> {dispTr('aynı renktir!')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedDualCodes.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                          {dispTr('Çift Renk Paletleri (Otomatik veya Elle Seçim):')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                          {parsedDualCodes.map(code => renderColorCard(code))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="field wide" style={{ marginTop: 4 }}>
                  <label>{dispTr('Cinsler - Kümes Bazında (virgülle)')}</label>
                  {coopsForCinsi.map(c => (
                    <div key={c.id} style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flex: '0 0 auto' }} />
                        <b style={{ fontSize: 12 }}>{dispTr(c.name)}</b>
                      </div>
                      <input
                        value={coopCinsiText[c.id] || ''}
                        onChange={e => setCoopCinsiText({ ...coopCinsiText, [c.id]: e.target.value })}
                        placeholder={dispTr('ÖRN. BEYAZ, ÇAKAL, LİMONİ')}
                      />
                    </div>
                  ))}
                  <p className="hint" style={{ marginTop: 6, fontSize: 12 }}>
                    {dispTr('Her kümesin cins listesi ayrıdır; bir kümesin cinsleri diğer kümeslerde görünmez. Klips renkleri ortaktır.')}
                  </p>
                </div>

                <div className="field wide" style={{ marginTop: 6 }}>
                  <label>{dispTr('İLAÇ & HASTALIK KATEGORİLERİ (virgülle)')}</label>
                  <input
                    value={medCategories}
                    onChange={e => setMedCategories(e.target.value)}
                    placeholder={dispTr('Örn: GÖZ SULANMASI, HIRILTI, KANAT TUTULMASI, KURSAK MANTARI, SALMONELLA')}
                  />
                  <p className="hint" style={{ marginTop: 4, fontSize: 12 }}>
                    {dispTr('İlaç & Aşı sekmesindeki filtreleme butonları burada girdiğiniz kategorilere göre listelenir.')}
                  </p>
                </div>
              </div>

              <div className="form-actions center" style={{ marginTop: 16 }}>
                <button className="btn primary" onClick={handleSaveGeneral}>
                  {dispTr('Ayarları Kaydet')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. KART: TEMA VE GÖRÜNÜM */}
        <div className={`settings-card ${openCards.has('theme') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('theme')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🎨</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('TEMA VE GÖRÜNÜM')}</div>
                <div className="settings-card-sub">
                  {dispTr('Karanlık, Dumanlı, Gökyüzü ve Saray renk paletleri · Seçili:')} <b>{dispTr(secilenAd)}</b>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: 'var(--panel-2)' }}>
                {dispTr(secilenAd)}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('theme') && (
            <div className="settings-card-body">
              <p className="hint" style={{ marginTop: 0 }}>
                {dispTr('Rengi hemen değiştir; kalıcı olması için aşağıdaki "TEMAYI KAYDET" düğmesine bas.')}
              </p>
              <div className="theme-grid">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-chip${theme === t.id ? ' on' : ''}`}
                    onClick={() => {
                      setTheme(t.id)
                      previewTheme(t.id)
                    }}
                  >
                    <span className="theme-swatch" data-tema={t.id}>
                      <i /><i /><i />
                    </span>
                    <span className="theme-name">{dispTr(t.ad)}</span>
                    <span className="theme-desc">{dispTr(t.aciklama)}</span>
                  </button>
                ))}
              </div>

              <div className="theme-save">
                <div className="muted" style={{ marginBottom: 8, fontSize: 12.5 }}>
                  {dispTr('Seçili:')} <b>{dispTr(secilenAd)}</b>
                  {kirli && <span style={{ color: 'var(--accent)' }}> {dispTr('· kaydedilmedi')}</span>}
                </div>
                <button
                  className="btn primary"
                  disabled={!kirli}
                  onClick={() => {
                    onSaveSettings({ ...db.settings, theme })
                    onNotify(`Tema kaydedildi: ${secilenAd}`)
                  }}
                >
                  {dispTr('TEMAYI KAYDET')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. KART: KULUÇKA & TELEGRAM BİLDİRİMLERİ */}
        <div className={`settings-card ${openCards.has('notifications') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('notifications')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🔔</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('KULUÇKA & TELEGRAM BİLDİRİMLERİ')}</div>
                <div className="settings-card-sub">
                  {dispTr('Döl kontrolü, çıkım ve bilezik takma alarmları · Telefon ve Telegram botu')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: tgEnabled ? '#10b98122' : 'var(--panel-2)', color: tgEnabled ? '#10b981' : 'inherit' }}>
                {tgEnabled ? dispTr('TELEGRAM AKTİF') : dispTr('TELEFON AKTİF')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('notifications') && (
            <div className="settings-card-body">
              {/* BÖLÜM 1: TELEFON (ANDROID) BİLDİRİMLERİ */}
              <div style={{ marginBottom: 20 }}>
                <strong style={{ fontSize: 13, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dispTr('📱 Telefon Bildirimleri (Android / Yerel)')}
                </strong>
                <p className="hint" style={{ marginTop: 4 }}>
                  {dispTr('Android cihazınızda döl kontrolü (6. gün), yavru çıkımı (18. gün) ve künye takma (7. gün) zamanı geldiğinde telefonunuza otomatik hatırlatıcı bildirimi gönderilir.')}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  <button
                    className="btn small"
                    type="button"
                    onClick={async () => {
                      try {
                        await sendTestNotification()
                        onNotify('Test bildirimi 3 saniye içinde telefonunuza gelecek!')
                      } catch (err) {
                        onNotify('Test bildirimi hatası: ' + err.message, 'err')
                      }
                    }}
                  >
                    {dispTr('🧪 Test Telefon Bildirimi Gönder (3 sn)')}
                  </button>
                </div>
              </div>

              {/* BÖLÜM 2: TELEGRAM BİLDİRİMLERİ */}
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {dispTr('✈️ Telegram Kuluçka Bildirimleri')}
                  </strong>
                  <label className="check-label" style={{ cursor: 'pointer', fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={tgEnabled}
                      onChange={e => setTgEnabled(e.target.checked)}
                    />
                    <span>{dispTr('Telegram Bildirimlerini Etkinleştir')}</span>
                  </label>
                </div>

                <p className="hint" style={{ marginTop: 0 }}>
                  {dispTr('Telegram botunuz üzerinden döl kontrolleri, çıkım alarmları ve bilezik hatırlatmaları doğrudan Telegram sohbetinize gelir.')}
                </p>

                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="field wide">
                    <label>{dispTr('Telegram Bot Token')}</label>
                    <input
                      type="text"
                      placeholder={dispTr('Örn: 7123456789:AAHkL12_abcdEfGh...')}
                      value={tgToken}
                      onChange={e => setTgToken(e.target.value)}
                      style={{ textTransform: 'none' }}
                    />
                  </div>
                  <div className="field wide">
                    <label>{dispTr('Telegram Chat ID')}</label>
                    <input
                      type="text"
                      placeholder={dispTr('Örn: 123456789 veya @KanalAdi')}
                      value={tgChatId}
                      onChange={e => setTgChatId(e.target.value)}
                      style={{ textTransform: 'none' }}
                    />
                  </div>
                </div>

                {/* Telegram Kurulum Rehberi */}
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--panel-2)', borderRadius: 8, border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.6 }}>
                  <strong>{dispTr('ℹ️ 3 Adımda Telegram Bildirim Kurulumu:')}</strong>
                  <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    <li>{dispTr("Telegram'da ")}<b>{dispTr('@BotFather')}</b>{dispTr(' hesabını açın, ')}<code>{dispTr('/newbot')}</code>{dispTr(' komutu verip botunuzu oluşturun ve size verilen ')}<b>{dispTr('HTTP API Token')}</b>{dispTr("'ı yukarıya yapıştırın.")}</li>
                    <li>{dispTr("Oluşturduğunuz botun sohbetini Telegram'da açıp ")}<b>{dispTr('Başlat (/start)')}</b>{dispTr(' deyin.')}</li>
                    <li>{dispTr("Chat ID'nizi öğrenmek için Telegram'da ")}<b>{dispTr('@userinfobot')}</b>{dispTr(' veya ')}<b>{dispTr('@getmyid_bot')}</b>{dispTr(' botuna bir mesaj atın; gelen ')}<code>{dispTr('Id')}</code>{dispTr(' numarasını yukarıdaki Chat ID alanına yazın.')}</li>
                  </ol>
                </div>

                {/* Telegram Butonları */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  <button
                    className="btn primary small"
                    type="button"
                    disabled={tgTesting || !tgToken.trim() || !tgChatId.trim()}
                    onClick={async () => {
                      setTgTesting(true)
                      try {
                        await sendTestTelegramNotification(tgToken, tgChatId)
                        onNotify('✅ Telegram test bildirimi başarıyla gönderildi!')
                      } catch (err) {
                        onNotify('Telegram Hatası: ' + err.message, 'err')
                      } finally {
                        setTgTesting(false)
                      }
                    }}
                  >
                    {tgTesting ? 'Gönderiliyor…' : dispTr('🧪 Test Telegram Bildirimi Gönder')}
                  </button>

                  <button
                    className="btn small"
                    type="button"
                    disabled={tgReporting || !tgToken.trim() || !tgChatId.trim()}
                    onClick={async () => {
                      setTgReporting(true)
                      try {
                        await sendClutchTelegramSummary(db, tgToken, tgChatId)
                        onNotify('✅ Güncel kuluçka raporu Telegram\'a iletildi!')
                      } catch (err) {
                        onNotify('Rapor Hatası: ' + err.message, 'err')
                      } finally {
                        setTgReporting(false)
                      }
                    }}
                  >
                    {tgReporting ? 'İletiliyor…' : dispTr('📲 Günün Kuluçka Alarmlarını Telegram\'a Gönder')}
                  </button>

                  <button
                    className="btn small"
                    type="button"
                    onClick={handleSaveTelegram}
                  >
                    {dispTr('💾 Telegram Ayarlarını Kaydet')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. KART: İŞLEM GEÇMİŞİ & LOG KAYITLARI */}
        <div className={`settings-card ${openCards.has('logs') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('logs')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>📋</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('İŞLEM GEÇMİŞİ & LOG KAYITLARI')}</div>
                <div className="settings-card-sub">
                  {dispTr('Kümesteki son hareketler, eklenen kuşlar ve yumurtalar')} ({activitiesCount} {dispTr('Kayıt')})
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: 'var(--panel-2)' }}>
                {activitiesCount} {dispTr('İŞLEM')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('logs') && (
            <div className="settings-card-body">
              <p className="hint" style={{ marginTop: 0 }}>
                {dispTr('Kümeste son yapılan tüm işlemler (kuş ekleme, düzenleme, yumurta hareketleri, aşı ve tedaviler) kronolojik olarak kaydedilir ve geriye dönük incelenebilir.')}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn primary"
                  type="button"
                  onClick={onOpenActivityLog}
                >
                  {dispTr('📋 İşlem Geçmişini Aç')} {activitiesCount > 0 ? dispTr(`(${activitiesCount} Kayıt)`) : ''}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. KART: KÜMES MEVCUDİYET & BONCUK KONTROLLERİ */}
        {ENABLE_LOFT_CHECK && (
          <div className={`settings-card ${openCards.has('loftCheck') ? 'open' : ''}`}>
            <div className="settings-card-head" onClick={() => toggleCard('loftCheck')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>🔍</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="settings-card-title">{dispTr('KÜMES MEVCUDİYET & BONCUK KONTROLLERİ')}</div>
                  <div className="settings-card-sub">
                    {dispTr('Kümesteki kuşların sayım ve mevcudiyet durumları ·')} {checkedBirdsCount} {dispTr('Kontrol Edildi,')} {uncheckedBirdsCount} {dispTr('Eksik')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  className="tag"
                  style={{
                    fontSize: 11,
                    background: uncheckedBirdsCount === 0 && db.birds.length > 0 ? '#10b98122' : 'var(--panel-2)',
                    color: uncheckedBirdsCount === 0 && db.birds.length > 0 ? '#10b981' : 'inherit'
                  }}
                >
                  {checkedBirdsCount} / {db.birds.length} {dispTr('KONTROL EDİLDİ')}
                </span>
                <span className="settings-card-arrow">▼</span>
              </div>
            </div>

            {openCards.has('loftCheck') && (
              <div className="settings-card-body">
                <p className="hint" style={{ marginTop: 0 }}>
                  {dispTr('Kümesteki kuşların ayaklarındaki boncukları kontrol ederek mevcudiyet durumunu kuş profillerindeki')} <b>{dispTr('KONTROL')}</b> {dispTr('butonu ile onaylayabilirsiniz.')}
                </p>

                <div className="cards" style={{ marginBottom: 14 }}>
                  <div className="stat">
                    <div className="n" style={{ color: '#10b981' }}>{checkedBirdsCount}</div>
                    <div className="t">{dispTr('Kontrol Edildi (Mevcut)')}</div>
                  </div>
                  <div className="stat">
                    <div className="n" style={{ color: uncheckedBirdsCount > 0 ? '#ef4444' : 'inherit' }}>{uncheckedBirdsCount}</div>
                    <div className="t">{dispTr('Kontrol Edilmeyen')}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn danger"
                    type="button"
                    disabled={checkedBirdsCount === 0}
                    onClick={async () => {
                      if (!window.confirm('Tüm kuşların kontrol (mevcudiyet) kayıtları sıfırlanacak. Yeni bir kümes sayımı başlatmak istediğinize emin misiniz?')) {
                        return
                      }
                      if (onResetLoftChecks) {
                        const count = await onResetLoftChecks()
                        onNotify(count > 0 ? `${count} kuşun kontrol kaydı sıfırlandı` : 'Sıfırlanacak kontrol kaydı bulunamadı')
                      }
                    }}
                  >
                    {dispTr('🔴 Tüm Kontrol Kayıtlarını Sıfırla')}
                  </button>
                </div>

                <p className="hint" style={{ marginTop: 12 }}>
                  {dispTr('Yeni bir kümes sayımı veya boncuk kontrol turu başlatmak istediğinizde bu butonu kullanarak tüm kuşların kontrol işaretlerini tek seferde temizleyebilirsiniz.')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 6. KART: HESAP VE GÜVENLİK */}
        <div className={`settings-card ${openCards.has('account') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('account')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>👤</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('HESAP VE GÜVENLİK')}</div>
                <div className="settings-card-sub">
                  {account.email} · {db.birds.length} {dispTr('Kuş')} · {pairedCount()} {dispTr('Eşli')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: '#10b98122', color: '#10b981' }}>
                {dispTr('OTURUM AÇIK')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('account') && (
            <div className="settings-card-body">
              <div className="cards" style={{ marginBottom: 12 }}>
                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="n auth-email" style={{ fontSize: 15, wordBreak: 'break-all', textTransform: 'none' }}>
                    {account.email}
                  </div>
                  <div className="t">{dispTr('Oturum açan hesap')}</div>
                </div>
                <div className="stat">
                  <div className="n">{db.birds.length}</div>
                  <div className="t">{dispTr('Toplam Kuş')}</div>
                </div>
                <div className="stat">
                  <div className="n">{pairedCount()}</div>
                  <div className="t">{dispTr('Eşli Kuş')}</div>
                </div>
              </div>

              <p className="hint">
                {dispTr('Kayıtlar bulutta saklanır. Aynı hesapla girdiğin her cihaz (bilgisayar, telefon) aynı kayıtları anında görür.')}
              </p>

              <div className="form-actions center" style={{ gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                {!showPwChange ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setShowPwChange(true); setPwErr(''); setPwSuccess('') }}
                  >
                    {dispTr('🔑 Şifre Değiştir')}
                  </button>
                ) : null}
              </div>

              {showPwChange && (
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: 13, textTransform: 'uppercase' }}>{dispTr('Yeni Şifre Belirleme')}</strong>
                    <button
                      type="button"
                      onClick={() => setShowPwText(!showPwText)}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0, textTransform: 'none' }}
                    >
                      {showPwText ? dispTr('🙈 Şifreyi Gizle') : dispTr('👁️ Şifreyi Göster')}
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="field wide">
                      <label>{dispTr('Yeni Şifre')}</label>
                      <input
                        type={showPwText ? 'text' : 'password'}
                        value={newPw1}
                        onChange={e => setNewPw1(e.target.value)}
                        placeholder={dispTr('En az 6 karakter')}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        style={{ textTransform: 'none' }}
                      />
                    </div>
                    <div className="field wide">
                      <label>{dispTr('Yeni Şifre (Tekrar)')}</label>
                      <input
                        type={showPwText ? 'text' : 'password'}
                        value={newPw2}
                        onChange={e => setNewPw2(e.target.value)}
                        placeholder={dispTr('Şifreyi tekrar girin')}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        style={{ textTransform: 'none' }}
                      />
                    </div>
                  </div>

                  {pwErr && <p className="hint" style={{ color: 'var(--danger)', marginTop: 8 }}>{dispTr(pwErr)}</p>}
                  {pwSuccess && <p className="hint" style={{ color: 'var(--success, #22c55e)', marginTop: 8 }}>{dispTr(pwSuccess)}</p>}

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy === 'pw'}
                      onClick={async () => {
                        setPwErr('')
                        setPwSuccess('')
                        if (newPw1.length < 6) return setPwErr('Şifre en az 6 karakter olmalı.')
                        if (newPw1 !== newPw2) return setPwErr('Şifreler eşleşmiyor! Lütfen iki kutucuğa da aynı şifreyi yazın.')

                        setBusy('pw')
                        const r = await api.updateUserPassword(newPw1)
                        setBusy('')

                        if (!r.ok) return setPwErr(r.error)
                        setPwSuccess('Şifreniz başarıyla değiştirildi.')
                        onNotify('Şifre güncellendi')
                        setNewPw1('')
                        setNewPw2('')
                        setTimeout(() => setShowPwChange(false), 1500)
                      }}
                    >
                      {busy === 'pw' ? 'Güncelleniyor…' : dispTr('Şifreyi Güncelle')}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy === 'pw'}
                      onClick={() => { setShowPwChange(false); setPwErr(''); setPwSuccess('') }}
                    >
                      {dispTr('İptal')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 6. KART: YEDEKLEME (JSON DOSYASI) */}
        <div className={`settings-card ${openCards.has('backup') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('backup')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>💾</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('YEDEKLEME (JSON DOSYASI)')}</div>
                <div className="settings-card-sub">
                  {dispTr('Tüm kayıtları tek tıkla JSON dosyasına aktarın veya yedekten geri yükleyin')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag" style={{ fontSize: 11, background: 'var(--panel-2)' }}>
                {dispTr('JSON')}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('backup') && (
            <div className="settings-card-body">
              <p className="hint" style={{ marginTop: 0 }}>
                {dispTr('Tüm kayıtları tek bir JSON dosyasına aktarabilirsin.')}
                {dataPath && <> {dispTr('Verilerin şu klasörde:')} <code>{dataPath}</code></>}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  disabled={busy === 'export'}
                  onClick={async () => {
                    setBusy('export')
                    const r = await api.exportJson()
                    setBusy('')
                    if (r.ok) onNotify('Yedek kaydedildi')
                    else onNotify(r.error, 'err')
                  }}
                >
                  {busy === 'export' ? 'Kaydediliyor…' : dispTr('JSON olarak dışa aktar')}
                </button>

                <button
                  className="btn"
                  disabled={busy === 'import'}
                  onClick={async () => {
                    setBusy('import')
                    const r = await api.importJson()
                    setBusy('')
                    if (!r.ok) return onNotify(r.error, 'err')
                    if (!r.data) return
                    onNotify(
                      r.data.silinen > 0
                        ? `Geri yüklendi: ${r.data.birds} kuş, ${r.data.pairings} çiftleşme, ${r.data.treatments} tedavi · ${r.data.silinen} eski kuş silindi`
                        : `Geri yüklendi: ${r.data.birds} kuş, ${r.data.pairings} çiftleşme, ${r.data.treatments} tedavi`
                    )
                  }}
                >
                  {busy === 'import' ? 'Yükleniyor…' : dispTr('Yedekten geri yükle')}
                </button>
              </div>

              <p className="hint" style={{ marginTop: 12 }}>
                <b style={{ color: 'var(--danger)' }}>{dispTr('Dikkat:')}</b> {dispTr('Geri yükleme mevcut tüm kayıtları')} <b>{dispTr('silip')}</b> {dispTr('yedekteki kayıtlarla değiştirir. Yanlış dosya seçersen kayıtların gider — önce mevcut durumu dışa aktar.')}
              </p>
            </div>
          )}
        </div>

        {/* 7. KART: UYGULAMA SÜRÜMÜ & CANLI GÜNCELLEME (OTA) */}
        <div className={`settings-card ${openCards.has('version') ? 'open' : ''}`}>
          <div className="settings-card-head" onClick={() => toggleCard('version')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🚀</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="settings-card-title">{dispTr('UYGULAMA SÜRÜMÜ & CANLI GÜNCELLEME')}</div>
                <div className="settings-card-sub">
                  {dispTr('Sürüm: v')}{versionInfo?.version || '1.0.0'} {dispTr('· Canlı OTA desteği')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tag primary" style={{ fontSize: 11 }}>
                {dispTr('v')}{versionInfo?.version || '1.0.0'}
              </span>
              <span className="settings-card-arrow">▼</span>
            </div>
          </div>

          {openCards.has('version') && (
            <div className="settings-card-body">
              <p className="hint" style={{ marginTop: 0 }}>
                {dispTr('Uygulama açılışlarında yeni güncellemeleri otomatik denetler. Dilerseniz buradan hemen kontrol edebilirsiniz.')}
              </p>

              <div style={{
                background: 'var(--panel-2)',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                marginBottom: 14,
                fontSize: 12.5,
                lineHeight: 1.6
              }}>
                <div><b>{dispTr('Mevcut Sürüm:')}</b>{dispTr(' v')}{versionInfo?.version || '1.0.0'}</div>
                <div><b>{dispTr('Derleme Zamanı:')}</b> {versionInfo?.buildTime || '-'}</div>
                <div><b>{dispTr('Çalışma Modu:')}</b> {versionInfo?.isNative ? dispTr('📱 Android (Capacitor Yerel)') : dispTr('🌐 Web / Masaüstü')}</div>
                <div><b>{dispTr('Canlı Güncelleme (OTA):')}</b> <span style={{ color: '#10b981', fontWeight: 700 }}>{dispTr('✅ Aktif')}</span></div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={checkingUpdate}
                  onClick={async () => {
                    setCheckingUpdate(true)
                    try {
                      const res = await checkForUpdate()
                      setCheckingUpdate(false)
                      if (res.hasUpdate && res.update) {
                        if (typeof onOpenUpdate === 'function') {
                          onOpenUpdate(res.update)
                        } else {
                          onNotify('Yeni güncelleme bulundu: v' + res.update.version)
                        }
                      } else if (res.error) {
                        onNotify('Güncelleme denetlenemedi: ' + res.error, 'err')
                      } else {
                        onNotify('Tebrikler! Uygulamanız en son güncel sürümde. (v' + (versionInfo?.version || '1.0.0') + ')')
                      }
                    } catch (e) {
                      setCheckingUpdate(false)
                      onNotify('Güncelleme denetimi başarısız: ' + e.message, 'err')
                    }
                  }}
                  style={{ fontWeight: 700 }}
                >
                  {checkingUpdate ? 'Denetleniyor...' : dispTr('🔄 Güncellemeleri Denetle')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Kümes Modu Değiştirme Onay Penceresi */}
      {confirmMode && (
        <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setConfirmMode(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 17 }}>
                <span>⚠️</span>
                <span>{dispTr('Kümes Çalışma Modunu Değiştir')}</span>
              </h2>
              <button type="button" className="x" onClick={() => setConfirmMode(null)}>×</button>
            </div>

            <div style={{ padding: '8px 0 16px 0' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: '14px 10px',
                background: 'var(--panel-2)',
                borderRadius: 10,
                border: '1px solid var(--line)',
                marginBottom: 16
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 2 }}>
                    {loftMode === 'posta' ? '🚀' : loftMode === 'hibrit' ? '🌐' : '🕊️'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {loftMode === 'posta' ? dispTr('Posta Modu') : loftMode === 'hibrit' ? dispTr('Hibrit Mod') : dispTr('Saya Modu')}
                  </div>
                  <div className="muted" style={{ fontSize: 10 }}>{dispTr('Mevcut Mod')}</div>
                </div>

                <div style={{ fontSize: 20, color: 'var(--muted)' }}>➔</div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 2 }}>
                    {confirmMode === 'posta' ? '🚀' : confirmMode === 'hibrit' ? '🌐' : '🕊️'}
                  </div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: confirmMode === 'posta' ? '#38bdf8' : confirmMode === 'hibrit' ? '#c084fc' : 'var(--accent)'
                  }}>
                    {confirmMode === 'posta' ? dispTr('Posta & Yarış Modu') : confirmMode === 'hibrit' ? dispTr('Kapsamlı Hibrit Mod') : dispTr('Saya & Kostüm Modu')}
                  </div>
                  <div className="tag primary" style={{ fontSize: 9, padding: '1px 6px' }}>{dispTr('Yeni Mod')}</div>
                </div>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 12px 0' }}>
                {dispTr('Kümes çalışma modunu ')}<strong>{confirmMode === 'posta' ? dispTr('Posta & Yarış Modu') : confirmMode === 'hibrit' ? dispTr('Kapsamlı (Hibrit) Mod') : dispTr('Saya & Kostüm Modu')}</strong>{dispTr(' olarak değiştirmek istediğinize emin misiniz?')}
              </p>

              <div style={{
                padding: '10px 12px',
                background: 'var(--panel-2)',
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--muted)'
              }}>
                <div>{dispTr('🔒 ')}<b>{dispTr('Veri Güvencesi:')}</b>{dispTr(' Kuş kayıtlarınız, fotoğraflarınız ve geçmiş bilgileriniz ')}<b>{dispTr('asla silinmez')}</b>.</div>
                <div style={{ marginTop: 4 }}>{dispTr('🔄 İstediğiniz zaman ayarlardan tekrar diğer modlara geçiş yapabilirsiniz.')}</div>
              </div>
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn" onClick={() => setConfirmMode(null)}>
                {dispTr('Vazgeç')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const m = confirmMode
                  setConfirmMode(null)
                  handleSaveMode(m)
                }}
              >
                {dispTr('Evet, Modu Değiştir')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}