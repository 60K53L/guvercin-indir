import { APP_VERSION, APK_DOWNLOAD_URL } from '../version.js'
import { dispTr } from '../lib.js'

/**
 * "Android uygulamasını indir" penceresi.
 *
 * Giriş (oturum açma) ekranındaki bağlantıdan açılır. Tek bir "APK İndir"
 * düğmesi sunar ve APK dosyasını DOĞRUDAN indirir; kullanıcıya iframe,
 * GitHub adresi ya da başka bir ara adım gösterilmez.
 *
 * Bu pencere yalnızca giriş ekranının (.auth-wrap) içinde çizildiği için
 * metinler dispTr() ile üretilir; CSS büyük harf dönüşümü o kapsamda kapalıdır.
 */
export default function DownloadModal({ onClose }) {
  return (
    <div
      className="overlay"
      style={{ zIndex: 140 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h2>{dispTr('📱 Android Uygulamasını İndir')}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Kapat" title="Kapat">
            ×
          </button>
        </div>

        <p className="muted" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.5 }}>
          {dispTr('Uygulamayı telefona kurmak için ')}<b>{dispTr('APK İndir')}</b> {dispTr('düğmesine bas.')}
        </p>

        <a
          className="btn primary"
          href={APK_DOWNLOAD_URL}
          onClick={e => {
            // Android WebView indirme bağlantısını kaldıramaz; dosyanın
            // sistem tarayıcısında inmesi için platform katmanına devredilir.
            e.preventDefault()
            api.openExternal(APK_DOWNLOAD_URL)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '13px 16px',
            fontSize: 15.5,
            fontWeight: 800,
            textDecoration: 'none'
          }}
        >
          {dispTr(`⬇ APK İndir (v${APP_VERSION})`)}
        </a>

        <p className="hint" style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.6 }}>
          <b>{dispTr('Kurulum:')}</b> {dispTr('indirilen dosyayı aç → telefondan')}
          {' '}<b>{dispTr('"bilinmeyen kaynaklardan kuruluma izin ver"')}</b> → <b>{dispTr('Kur')}</b>.
        </p>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onClose}>
            {dispTr('Kapat')}
          </button>
        </div>
      </div>
    </div>
  )
}
