
import { dispTr } from '../lib.js'

/**
 * Firebase henüz kurulmadığında gösterilir. Kullanıcıya ne yapması
 * gerektiğini tek tek anlatır.
 */
export default function SetupScreen() {
  return (
    <div className="auth-wrap">
      <div className="auth-card wide">
        <h2 style={{ marginTop: 0 }}>{dispTr('Kurulum gerekli')}</h2>
        <p className="hint">
          {dispTr('Uygulama verilerini bulutta (Firebase) tutar. İlk kez kuruyorsan şu adımları izle:')}
        </p>
        <ol className="hint" style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>
            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
              console.firebase.google.com
            </a> adresine gir, Gmail hesabınla aç.
          </li>
          <li><b>Proje ekle</b> → ad ver (<code>Güvercin</code>) → Devam.</li>
          <li>
            Sol menü → <b>Build → Authentication → Get started</b> → aç.
          </li>
          <li>
            <b>Sign-in method</b> → <b>Email/Password</b> → etkinleştir → Kaydet.
          </li>
          <li>
            Sol menü → <b>Build → Firestore Database → Create database</b> →
            başlangıçta <b>test modunda</b> seç (kuralları sonra kapatacağız).
          </li>
          <li>
            Sol menü → <b>Build → Storage → Get started</b> → etkinleştir.
          </li>
          <li>
            Proje ana ekranında <b>Web</b> simgesine tıkla (iki köşeli
            parantez işareti), uygulamaya isim ver, <b>Kaydet</b> de.
          </li>
          <li>
            Çıkan <code>firebaseConfig</code> bilgisini kopyala ve
            <code> src/firebase/config.js </code> dosyasındaki
            <code> firebaseConfig </code> alanının yerine yapıştır.
          </li>
        </ol>
        <p className="hint">
          {dispTr('En son adımdan sonra uygulamayı kapatıp yeniden aç.')}
        </p>
      </div>
    </div>
  )
}