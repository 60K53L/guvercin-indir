/**
 * GitHub release yedeği: commit + push + sürüm etiketi + APK release'i.
 *
 * Tam yedek için `npm run backup:github` kullanılır; bu betik tek başına
 * Web/kaynak ZIP üretmez. NEDEN AYRI BETİK? OTA yayını ile GitHub yedeği ayrı
 * adımlardır. OTA onay gerektirir; kaynak yedeği ise her güncellemeden sonra
 * alınmalıdır. Bu betik yalnızca açıkça `npm run backup:release` denince
 * çalışır.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const RELEASE_REPO = '60K53L/guvercin-indir'
const pkg = require(path.join(ROOT, 'package.json'))
const version = pkg.version
const tag = `v${version}`

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts })
}

function capture(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function hasChanges() {
  return capture('git', ['status', '--porcelain']).length > 0
}

function tagExists(name) {
  try {
    capture('git', ['rev-parse', '-q', '--verify', `refs/tags/${name}`])
    return true
  } catch {
    return false
  }
}

function releaseExists(name) {
  try {
    execFileSync('gh', ['release', 'view', name, '-R', RELEASE_REPO], {
      cwd: ROOT,
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

function previousVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  if (!m) return null
  return `${m[1]}.${m[2]}.${Math.max(0, Number(m[3]) - 1)}`
}

function findApk(v) {
  if (!fs.existsSync(DIST_DIR)) return null
  const prefix = `Güvercin-${v}-`
  const files = fs.readdirSync(DIST_DIR)
    .filter(f => f.startsWith(prefix) && f.toLowerCase().endsWith('.apk'))
  if (!files.length) return null
  files.sort((a, b) =>
    fs.statSync(path.join(DIST_DIR, b)).mtimeMs - fs.statSync(path.join(DIST_DIR, a)).mtimeMs
  )
  return path.join(DIST_DIR, files[0])
}

async function changelogFor(v) {
  try {
    const mod = await import(pathToFileURL(path.join(ROOT, 'src', 'version.js')).href)
    return Array.isArray(mod.CHANGELOG?.[v]) ? mod.CHANGELOG[v] : []
  } catch {
    return []
  }
}

async function releaseNotes(v) {
  const items = await changelogFor(v)
  const lines = [`Güvercin v${v}`, '']
  if (items.length) {
    lines.push('Bu güncellemede neler var?', '')
    for (const item of items) lines.push(`- ${item}`)
    lines.push('')
  }
  lines.push(`İndirme: https://github.com/${RELEASE_REPO}/releases/latest/download/guvercin.apk`)
  return lines.join('\n')
}

function pushTag() {
  if (tagExists(tag)) {
    console.log(`   Etiket zaten var: ${tag}`)
  } else {
    run('git', ['tag', '-a', tag, '-m', `Güvercin ${tag}`])
    console.log(`   Etiket oluşturuldu: ${tag}`)
  }
  // Etiketi her durumda gönder; uzakta varsa git "up-to-date" der.
  run('git', ['push', 'origin', tag])
}

/** APK'yı release'te tam olarak `guvercin.apk` adıyla yüklemek için hazırlar. */
function stageApk(v, apk) {
  const dir = path.join(DIST_DIR, `.release-v${v}`)
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, 'guvercin.apk')
  fs.copyFileSync(apk, dest)
  return dest
}

/** Aynı release'te kalmış eski/tarihli APK asset'lerini temizler. */
function cleanApkAssets(releaseTag) {
  let names = []
  try {
    const out = execFileSync(
      'gh',
      ['release', 'view', releaseTag, '-R', RELEASE_REPO, '--json', 'assets', '--jq', '.assets[].name'],
      { cwd: ROOT, encoding: 'utf8' }
    )
    names = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  } catch {
    return
  }
  for (const name of names) {
    if (name.toLowerCase().endsWith('.apk') && name !== 'guvercin.apk') {
      run('gh', ['release', 'delete-asset', releaseTag, name, '-R', RELEASE_REPO, '--yes'])
      console.log(`   Eski APK asset'i kaldırıldı: ${name}`)
    }
  }
}

async function ensureRelease(v, { latest, apk }) {
  // Release etiketi her zaman vX.Y.Z biçiminde olmalı; mevcut v1.0.20 ile aynı.
  const releaseTag = `v${v}`
  const notes = await releaseNotes(v)
  const stagedApk = apk ? stageApk(v, apk) : null

  try {
    if (releaseExists(releaseTag)) {
      console.log(`   Release zaten var: ${releaseTag}`)
      cleanApkAssets(releaseTag)
      if (latest) {
        run('gh', ['release', 'edit', releaseTag, '-R', RELEASE_REPO, '--latest'])
      }
      if (stagedApk) {
        run('gh', ['release', 'upload', releaseTag, stagedApk, '-R', RELEASE_REPO, '--clobber'])
        console.log(`   APK güncellendi: ${releaseTag} / guvercin.apk`)
      }
      return
    }

    if (!stagedApk) {
      console.warn(`   ⚠️ ${releaseTag} için APK bulunamadı; release oluşturulmadı.`)
      return
    }

    const args = [
      'release', 'create', releaseTag, stagedApk,
      '-R', RELEASE_REPO,
      '--title', `Güvercin ${releaseTag}`,
      '--notes', notes,
      latest ? '--latest' : '--latest=false'
    ]
    run('gh', args)
    console.log(`   Release oluşturuldu: ${releaseTag} (guvercin.apk)`)
  } finally {
    if (stagedApk) fs.rmSync(path.dirname(stagedApk), { recursive: true, force: true })
  }
}

async function main() {
  console.log(`🚀 GitHub yedeği başlıyor: v${version}`)

  if (hasChanges()) {
    console.log('> 1. Değişiklikler commit ediliyor...')
    run('git', ['add', '-A'])
    run('git', ['commit', '-m', `chore: v${version} kaynak yedeği`])
  } else {
    console.log('> 1. Commit edilecek değişiklik yok.')
  }

  console.log('> 2. main dalı GitHub\'a gönderiliyor...')
  run('git', ['push', 'origin', 'main'])

  console.log('> 3. Sürüm etiketi gönderiliyor...')
  pushTag()

  const prev = previousVersion(version)
  if (prev) {
    console.log(`> 4. Önceki sürüm release'i kontrol ediliyor: ${prev}`)
    await ensureRelease(prev, { latest: false, apk: findApk(prev) })
  }

  console.log(`> 5. Güncel sürüm release'i hazırlanıyor: ${version}`)
  const currentApk = findApk(version)
  if (!currentApk) {
    throw new Error(`dist/ içinde v${version} APK'sı yok. Önce npm run mobile:apk çalıştırın.`)
  }
  await ensureRelease(version, { latest: true, apk: currentApk })

  console.log('\n✅ GitHub yedeği tamamlandı.')
  console.log('   Kaynak: https://github.com/60K53L/GUVERCIN')
  console.log(`   Release: https://github.com/${RELEASE_REPO}/releases`)
}

main().catch(err => {
  console.error('\nGitHub yedeği hatası:', err.message)
  process.exit(1)
})
