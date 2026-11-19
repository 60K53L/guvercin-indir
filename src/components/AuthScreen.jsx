import { useEffect, useState } from 'react'
import { applyTheme } from '../themes.js'
import { dispTr } from '../lib.js'
import DownloadModal from './DownloadModal.jsx'

/**
 * Giriş / kayıt ekranı. Veriler bulutta olduğu için uygulamayı açmadan
 * önce kim olduğun bilinmesi gerekiyor.
 *
 * E-posta + şifre: Android ve bilgisayarda birebir aynı çalışır,
 * ek kurulum gerektirmez.
 *
 * NOT: Bu ekranda görünen her metin dispTr() ile yazılır; CSS büyük harf
 * dönüşümü bu kapsamda kapalıdır (styles.css → GİRİŞ EKRANI). Böylece
 * noktalı "İ" yerine küçük "i" görünür. E-posta/şifre DEĞERLERİ dönüşüme
 * girmez; aşağıdaki İ/ı korumalı e-posta normalizasyonları giriş mantığının
 * parçasıdır ve asla değiştirilmemelidir (scripts/check-display-case.js bekçisi).
 */
export default function AuthScreen({ onDone, onNotify }) {
  useEffect(() => {
    applyTheme('dumanli')
  }, [])
  const [mode, setMode] = useState('in') // 'in' | 'up' | 'reset' | 'setNewPass'
  const [showDownload, setShowDownload] = useState(false)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  // Şifre sıfırlama link/kod doğrulama alanları
  const [codeOrUrl, setCodeOrUrl] = useState('')
  const [activeCode, setActiveCode] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [isLoggedInViaLink, setIsLoggedInViaLink] = useState(false)
  const [newPass1, setNewPass1] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)

  // Sayfa açıldığında URL parametrelerinde oobCode veya Email Link var mı kontrol et
  useEffect(() => {
    if (typeof window === 'undefined') return
    const href = window.location.href

    // 1. Email Sign-In (Magic Link) kontrolü
    if (api.isSignInLink && api.isSignInLink(href)) {
      const savedEmail = window.localStorage ? window.localStorage.getItem('emailForSignIn') : ''
      if (savedEmail) {
        setBusy(true)
        api.signInWithLink(savedEmail, href).then(r => {
          setBusy(false)
          if (r.ok) {
            setVerifiedEmail(r.data.email)
            setIsLoggedInViaLink(true)
            setMode('setNewPass')
            setSuccess('Hızlı giriş bağlantısı doğrulandı! Şimdi lütfen yeni şifrenizi iki kez belirleyin.')
          } else {
            setErr(r.error)
            setMode('reset')
          }
        })
        return
      }
    }

    // 2. Standart oobCode kontrolü
    const params = new URLSearchParams(window.location.search)
    const oob = params.get('oobCode') || params.get('code')
    if (oob) {
      setBusy(true)
      api.verifyResetCode(oob).then(r => {
        setBusy(false)
        if (r.ok) {
          setVerifiedEmail(r.data.email)
          setActiveCode(r.data.code)
          setIsLoggedInViaLink(false)
          setMode('setNewPass')
        } else {
          setErr(r.error)
          setMode('reset')
        }
      })
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setSuccess('')

    if (mode === 'setNewPass') {
      if (newPass1.length < 6) return setErr('Şifre en az 6 karakter olmalı.')
      if (newPass1 !== newPass2) return setErr('Şifreler eşleşmiyor! Lütfen iki kutucuğa da aynı şifreyi yazın.')

      setBusy(true)
      let r
      if (isLoggedInViaLink) {
        r = await api.updateUserPassword(newPass1)
      } else {
        r = await api.confirmResetPassword(activeCode, newPass1)
      }
      setBusy(false)

      if (!r.ok) return setErr(r.error)
      setSuccess('Şifreniz başarıyla kaydedildi!')
      if (onNotify) onNotify('Şifre güncellendi')
      setEmail(verifiedEmail)
      setPass('')
      setPass2('')
      if (isLoggedInViaLink && onDone) {
        setTimeout(() => {
          onDone({ email: verifiedEmail })
        }, 1200)
      } else {
        setTimeout(() => {
          setMode('in')
          setSuccess('Yeni şifrenizle giriş yapabilirsiniz.')
        }, 1500)
      }
      return
    }

    const mail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
    if (!mail) return setErr('E-posta giriniz.')

    if (mode === 'reset') {
      setBusy(true)
      const r = await api.sendPasswordReset(mail)
      setBusy(false)
      if (!r.ok) return setErr(r.error)
      setSuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Maildeki linki kopyalayıp aşağıdaki kutucuğa yapıştırarak şifrenizi burada 2 kez kontrolle belirleyebilirsiniz.')
      if (onNotify) onNotify('Sıfırlama bağlantısı gönderildi')
      return
    }

    if (pass.length < 6) return setErr('Şifre en az 6 karakter olmalı.')
    if (mode === 'up' && pass !== pass2) return setErr('Şifreler aynı değil.')

    setBusy(true)
    const r = mode === 'up'
      ? await api.signUp(mail, pass)
      : await api.signIn(mail, pass)
    setBusy(false)

    if (!r.ok) return setErr(r.error)
    if (onNotify) onNotify(mode === 'up' ? 'Hesap oluşturuldu' : 'Giriş yapıldı')
    if (onDone) onDone(r.data)
  }

  async function handleSendMagicLink() {
    setErr('')
    setSuccess('')
    const mail = String(email).trim().replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
    if (!mail) return setErr('Lütfen e-posta adresinizi giriniz.')

    setBusy(true)
    const r = await api.sendSignInLink(mail)
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    setSuccess('✨ Şifresiz hızlı giriş bağlantısı gönderildi! Maildeki bağlantıya tıklayabilir veya bağlantıyı kopyalayıp aşağıdaki kutucuğa yapıştırarak anında giriş yapabilir ve yeni şifrenizi belirleyebilirsiniz.')
    if (onNotify) onNotify('Hızlı giriş bağlantısı gönderildi')
  }

  async function handleVerifyPasted() {
    setErr('')
    setSuccess('')
    const pasted = codeOrUrl.trim()
    if (!pasted) return setErr('Lütfen mailinize gelen linki veya kodu yapıştırın.')

    setBusy(true)

    // A) Yapıştırılan metin Magic Link mi?
    if (api.isSignInLink && api.isSignInLink(pasted)) {
      const mail = email.trim() || (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('emailForSignIn') : '')
      if (!mail) {
        setBusy(false)
        return setErr('Bu bir şifresiz giriş bağlantısıdır. Lütfen yukarıdaki e-posta kutusuna adresinizi yazıp tekrar butona tıklayın.')
      }
      const r = await api.signInWithLink(mail, pasted)
      setBusy(false)
      if (!r.ok) return setErr(r.error)
      setVerifiedEmail(r.data.email)
      setIsLoggedInViaLink(true)
      setMode('setNewPass')
      setSuccess('Bağlantı doğrulandı! Güvenliğiniz için yeni şifrenizi iki kez belirleyin.')
      return
    }

    // B) Standart Reset Code / URL
    const r = await api.verifyResetCode(pasted)
    setBusy(false)

    if (!r.ok) return setErr(r.error)
    setVerifiedEmail(r.data.email)
    setActiveCode(r.data.code)
    setIsLoggedInViaLink(false)
    setMode('setNewPass')
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div className="brand-wrap" style={{ display: 'inline-flex', marginBottom: 8 }}>
            <span className="brand-icon">🕊️</span>
            <span className="brand">{dispTr('GÜVERCİN SOY TAKİP')}</span>
            <span className="brand-pill">{dispTr('BETA')}</span>
          </div>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0, marginBottom: 18, fontSize: 13 }}>
          {dispTr(mode === 'setNewPass' ? 'YENİ ŞİFRE BELİRLEME' : mode === 'reset' ? 'ŞİFRE SIFIRLAMA' : 'Soy takip ve üreme kayıtları')}
        </p>

        {mode === 'setNewPass' && (
          <>
            <div style={{ background: 'var(--accent-wash-2)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13, textAlign: 'center' }}>
              {dispTr('👤 Hesap:')} <strong style={{ textTransform: 'none' }}>{verifiedEmail}</strong>
            </div>

            <div className="form-grid">
              <div className="field wide">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>{dispTr('Yeni Şifre')}</label>
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '2px 6px', textTransform: 'none' }}
                  >
                    {dispTr(showNewPass ? '🙈 Şifreyi Gizle' : '👁️ Şifreyi Göster')}
                  </button>
                </div>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPass1}
                  onChange={e => setNewPass1(e.target.value)}
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
                  type={showNewPass ? 'text' : 'password'}
                  value={newPass2}
                  onChange={e => setNewPass2(e.target.value)}
                  placeholder={dispTr('Şifrenizi tekrar girin')}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ textTransform: 'none' }}
                />
              </div>
            </div>

            {err && <p className="hint" style={{ color: 'var(--danger)', marginTop: 12 }}>{dispTr(err)}</p>}
            {success && <p className="hint" style={{ color: '#22c55e', marginTop: 12, lineHeight: 1.5 }}>{dispTr(success)}</p>}

            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 16 }}>
              {dispTr(busy ? 'Güncelleniyor…' : 'Şifreyi Güncelle')}
            </button>

            <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                className="linklike"
                onClick={() => { setMode('in'); setErr(''); setSuccess('') }}
              >
                {dispTr('← Giriş ekranına dön')}
              </button>
            </p>
          </>
        )}

        {mode !== 'setNewPass' && (
          <>
            {mode === 'reset' && (
              <p className="hint" style={{ textAlign: 'center', marginTop: -10, marginBottom: 16 }}>
                {dispTr('Kayıtlı e-posta adresinizi girin veya mailinize gelen linki aşağıya yapıştırın.')}
              </p>
            )}

            <div className="form-grid">
              <div className="field wide">
                <label>{dispTr('E-posta')}</label>
                <input
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ornek@gmail.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="auth-email-input"
                  style={{ textTransform: 'none' }}
                />
              </div>

              {mode !== 'reset' && (
                <div className="field wide">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>{dispTr('Şifre')}</label>
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: 12,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        textTransform: 'none'
                      }}
                    >
                      {dispTr(showPass ? '🙈 Şifreyi Gizle' : '👁️ Şifreyi Göster')}
                    </button>
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    placeholder={dispTr('En az 6 karakter')}
                    autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ textTransform: 'none' }}
                  />
                  {mode === 'in' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        type="button"
                        className="linklike"
                        onClick={() => { setMode('reset'); setErr(''); setSuccess('') }}
                        style={{ fontSize: 12, cursor: 'pointer', textTransform: 'none', color: 'var(--muted)' }}
                      >
                        {dispTr('Şifremi unuttum?')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {mode === 'up' && (
                <div className="field wide">
                  <label>{dispTr('Şifre (tekrar)')}</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={pass2}
                    onChange={e => setPass2(e.target.value)}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ textTransform: 'none' }}
                  />
                </div>
              )}
            </div>

            {err && <p className="hint" style={{ color: 'var(--danger)', marginTop: 12 }}>{dispTr(err)}</p>}
            {success && <p className="hint" style={{ color: '#22c55e', marginTop: 12, lineHeight: 1.5 }}>{dispTr(success)}</p>}

            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 16 }}>
              {dispTr(busy ? 'Bekleyin…' : mode === 'reset' ? 'Sıfırlama Bağlantısı Gönder' : mode === 'in' ? 'Giriş Yap' : 'Hesap Oluştur')}
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={handleSendMagicLink}
                style={{ width: '100%', marginTop: 8 }}
              >
                {dispTr('✨ Şifresiz Hızlı Giriş Bağlantısı Gönder')}
              </button>
            )}

            {mode === 'reset' && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="hint" style={{ margin: '0 0 10px 0', fontSize: 12, textAlign: 'center' }}>
                  {dispTr('Zaten sıfırlama maili aldıysanız, maildeki linki veya kodu buraya yapıştırıp şifrenizi belirleyebilirsiniz:')}
                </p>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <input
                    type="text"
                    value={codeOrUrl}
                    onChange={e => setCodeOrUrl(e.target.value)}
                    placeholder={dispTr('Maildeki linki veya oobCode kodunu yapıştırın')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      width: '100%',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      textTransform: 'none',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={handleVerifyPasted}
                    style={{ marginTop: 2 }}
                  >
                    {dispTr('Bağlantıyı Doğrula & Şifre Belirle')}
                  </button>
                </div>
              </div>
            )}

            {mode === 'reset' ? (
              <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                  type="button"
                  className="linklike"
                  onClick={() => { setMode('in'); setErr(''); setSuccess('') }}
                >
                  {dispTr('← Giriş ekranına dön')}
                </button>
              </p>
            ) : (
              <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
                {dispTr(mode === 'in' ? 'Henüz hesabın yok mu? ' : 'Zaten hesabın var mı? ')}
                <button
                  type="button"
                  className="linklike"
                  onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setSuccess('') }}
                >
                  {dispTr(mode === 'in' ? 'Hesap oluştur' : 'Giriş yap')}
                </button>
              </p>
            )}

            <p className="hint" style={{ textAlign: 'center', fontSize: 12 }}>
              {dispTr('Kayıtlar bulutta saklanır. Aynı e-postayla girdiğin cihazlar aynı kayıtları görür.')}
            </p>
          </>
        )}
      </form>

      <div className="auth-download">
        <button
          type="button"
          className="download-footer-btn"
          onClick={() => setShowDownload(true)}
          title="Android uygulamasını indir"
        >
          {dispTr('⬇ Android uygulamasını indir')}
        </button>
      </div>

      {showDownload && <DownloadModal onClose={() => setShowDownload(false)} />}
    </div>
  )
}
