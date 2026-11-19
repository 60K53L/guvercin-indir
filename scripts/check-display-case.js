/**
 * GÖRÜNTÜ BÜYÜK HARF denetimi (regresyon bekçisi).
 *
 * Neden bu denetim var? "İ" harflerini "i" yapma isteği daha iki kez faciaya
 * dönüştü: kaynak kodu toplu yeniden yazıldığı için
 *   1) satır içi stil değerleri büyük harfe çevrildi (1PX SOLiD VAR(--LiNE))
 *      → CSS özel değişken adları büyük/küçük harfe duyarlı, tasarım çöktü;
 *   2) login e-posta normalizasyonundaki /İ/g regex'leri /i/g yapıldı
 *      → 'İ'.toLowerCase() = "i̇" (U+0069 U+0307) olduğu için Firebase farklı
 *      e-posta görür, giriş yapılamaz.
 *
 * Doğru yol: dönüşüm YALNIZCA görüntü katmanında, dispTr() üzerinden yapılır.
 * Bu denetim o sınırı korur.
 *
 * Kullanım: node scripts/check-display-case.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')

let bad = 0
const fail = msg => { console.log(`  HATA: ${msg}`); bad++ }

/* 1) Giriş (login) e-posta regex'leri yerinde mi?
      Firebase'e giden e-posta daima İ korumasıyla normalleştirilmeli. */
const loginFiles = [
  ['src/firebase/api.js', 5],
  ['src/components/AuthScreen.jsx', 2]
]
let loginTotal = 0
for (const [rel, expected] of loginFiles) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const n = text.split("replace(/İ/g, 'i')").length - 1
  loginTotal += n
  if (n !== expected) fail(`${rel}: ${expected} adet replace(/İ/g, 'i') bekleniyor, ${n} bulundu`)
}

/* 2) Türkçe harf katlaması bozulmuş mu? */
const lib = fs.readFileSync(path.join(SRC, 'lib.js'), 'utf8')
if (!/toLocaleUpperCase\('tr-TR'\)/.test(lib)) fail('lib.js: trUpper toLocaleUpperCase(\'tr-TR\') kullanmıyor')
if (!/\[İı\]/.test(lib)) fail('lib.js: foldTr içindeki [İı] katlaması kaybolmuş')

/* 3) Stil değerleri büyük harfe çevrilmiş mi?
      Bozulma imzası: CSS'te KÜÇÜK yazılması gereken sözcüğün büyük harfli
      hali (1PX, SOLiD, VAR(--LiNE). Kaynak dizgelerde bu imza bulunamaz;
      interpolasyonlar (${...}) JS kodudur, dışarıda bırakılır. */
const CSS_WORDS = /(var\(--[a-z0-9-]+\)|\b(solid|dashed|dotted|rgba|rgb|hsl|center|flex|column|row|none|inherit|pointer|baseline|nowrap|break-word|border-box|space-between|space-around|underline|line-through)\b|\b\d+(px|em|rem|vh|vw|pt)\b)/gi
let literals = 0
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { walk(p); continue }
    if (!/\.(js|jsx)$/.test(e.name)) continue
    // version.js'teki CHANGELOG düz metindir, stil değeri değildir; dışarıda.
    if (e.name === 'version.js') continue
    const text = fs.readFileSync(p, 'utf8')
    for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      const s = m[2].replace(/\$\{[^}]*\}/g, '')
      literals++
      for (const w of s.match(CSS_WORDS) || []) {
        if (w !== w.toLowerCase()) {
          fail(`${path.relative(ROOT, p)}: bozulmuş stil değeri -> "${m[2]}"`)
          break
        }
      }
    }
  }
}
walk(SRC)

/* 4) dispTr yalnızca görüntü katmanında kullanılmalı (veri katmanında değil). */
let dispUses = 0
for (const file of fs.readdirSync(path.join(SRC, 'components'))) {
  if (!file.endsWith('.jsx')) continue
  dispUses += (fs.readFileSync(path.join(SRC, 'components', file), 'utf8').match(/\bdispTr\(/g) || []).length
}
const dataFiles = ['schema.js', 'lib.js', 'version.js', 'themes.js']
for (const f of dataFiles) {
  const p = path.join(SRC, f)
  if (!fs.existsSync(p)) continue
  const text = fs.readFileSync(p, 'utf8')
  const used = (text.match(/\bdispTr\(/g) || []).length
  if (used > 1) fail(`${f}: dispTr kullanımı (${used}) — görüntü katmanı dışına çıkmış`)
}

/* 5) dispTr ile yazılan metinler CSS büyük harfine takılırsa "i" yeniden "İ" olur.
      Bu yüzden giriş ekranı kapsamındaki override zorunlu. */
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8')
const scope = css.match(/\.auth-wrap[\s\S]*?\}/)
if (!scope || !/text-transform:\s*none/.test(scope[0])) {
  fail('styles.css: dispTr kullanılan kapsamda text-transform: none override\'ı yok')
}

console.log(`\n${loginTotal} login regex'i, ${literals} dizge, ${dispUses} dispTr kullanımı denetlendi, ${bad} sorun`)
process.exit(bad ? 1 : 0)
