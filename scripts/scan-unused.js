/**
 * Kullanılmayan kod taraması.
 * Her export'un (ve component'in) projede başka bir yerde kullanılıp
 * kullanılmadığına bakar.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src')
const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p)
  }
})(ROOT)

const readAll = files.map(f => ({ f, text: fs.readFileSync(f, 'utf8') }))

// Testler de bir export'u "kullanıyor" sayılmalı; yoksa scripts/test-*.mjs
// tarafından test edilen yardımcılar yanlışlıkla "hiç kullanılmıyor" diye
// işaretlenip siliniyordu.
const SCRIPTS = path.join(__dirname, '..', 'scripts')
const usageAll = [...readAll]
if (fs.existsSync(SCRIPTS)) {
  for (const e of fs.readdirSync(SCRIPTS, { withFileTypes: true })) {
    if (e.isFile() && /\.(jsx?|mjs)$/.test(e.name)) {
      usageAll.push({ f: path.join(SCRIPTS, e.name), text: fs.readFileSync(path.join(SCRIPTS, e.name), 'utf8') })
    }
  }
}

// Bileşen dosyaları (kendi adıyla render edilir)
const components = readAll.filter(x => x.f.endsWith('.jsx'))
const libs = readAll.filter(x => x.f.endsWith('.js') && !x.f.endsWith('schema.js'))

console.log('=== KULLANILMAYAN IMPORTLAR ===\n')
for (const { f, text } of readAll) {
  const rel = path.relative(ROOT, f)
  const lines = text.split('\n')
  const names = []
  lines.forEach((ln, i) => {
    let m = ln.match(/^\s*import\s+(.+?)\s+from\s+['"]/)
    if (m) {
      const clause = m[1]
      // { ... } içindeki adlandırılmış importlar
      const inner = clause.match(/\{([^}]*)\}/)
      if (inner) {
        inner[1].split(',').forEach(n => {
          const name = n.trim().split(/\s+as\s+/).pop().trim()
          if (name) names.push({ name, line: i + 1 })
        })
      }
      // varsayılan (default) import — yalnızca brace'lerin DIŞINDA kalan kısım
      const before = clause.split('{')[0].replace(/,\s*$/, '').trim()
      if (before && !before.startsWith('*')) {
        const def = before.split(/\s+as\s+/).pop().trim()
        if (def && /^[A-Za-z_$][\w$]*$/.test(def)) names.push({ name: def, line: i + 1 })
      }
    }
  })

  for (const { name, line } of names) {
    // Kullanım sayımı: import satırı hariç
    const uses = (text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
    if (uses <= 1) {
      console.log(`  ${rel}:${line}  →  "${name}" import edilmiş ama kullanılmıyor`)
    }
  }
}

console.log('\n=== KULLANILMAYAN BILESENLER ===\n')
for (const c of components) {
  const base = path.basename(c.f, '.jsx')
  const used = usageAll.some(x => x.f !== c.f && new RegExp(`\\b${base}\\b`).test(x.text))
  if (!used) console.log(`  ${path.relative(ROOT, c.f)}  →  hiçbir yerde import edilmiyor`)
}

console.log('\n=== KULLANILMAYAN EXPORTLAR (kendi dosyasinda referans var mi) ===\n')
for (const { f, text } of libs) {
  const rel = path.relative(ROOT, f)
  const re = /export\s+(?:const|function|let)\s+([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re.exec(text))) {
    const name = m[1]
    // Başka dosyada kullanılıyor mu?
    const elsewhere = usageAll.some(x => x.f !== f && new RegExp(`\\b${name}\\b`).test(x.text))
    // Kendi dosyasında kullanılıyor mu?
    const selfUses = (text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
    if (!elsewhere && selfUses <= 1) {
      console.log(`  ${rel}  →  export "${name}" hiç kullanılmıyor`)
    }
  }
}