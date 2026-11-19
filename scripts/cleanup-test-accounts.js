/**
 * Test hesaplarını siler. Email'in @ işaretinden öncesi `test-` ile
 * başlıyorsa hesap ve kullanıcı verisi tamamen kaldırılır.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const storePath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'))
const tok = store.tokens
const PROJECT = 'guvercin-takip-9f2a'

async function accessToken() {
  if (tok.access_token && Date.now() < tok.expires_at - 60000) return tok.access_token
  execFileSync('npx', ['firebase', 'login:list'], { encoding: 'utf8' })
  return JSON.parse(fs.readFileSync(storePath, 'utf8')).tokens.access_token
}

async function call(url, init = {}) {
  const t = await accessToken()
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  })
  return { status: res.status, body: await res.text() }
}

;(async () => {
  // Silinecek test hesapları (e2e testi bunları oluşturur).
  const emails = process.argv.slice(2)
  if (!emails.length) {
    console.log('Kullanım: node scripts/cleanup-test-accounts.js <e-posta> [e-posta...]')
    return
  }

  for (const email of emails) {
    const found = await call(
      `https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/locations/global/accounts:lookup`,
      { method: 'POST', body: JSON.stringify({ email }) }
    )
    let localId = null
    try {
      const j = JSON.parse(found.body)
      localId = (j.users && j.users[0] && j.users[0].localId) || null
    } catch {
      console.log(`  bulunamadi: ${email} → ${found.body.slice(0, 120)}`)
      continue
    }
    if (!localId) {
      console.log(`  yok: ${email}`)
      continue
    }
    const del = await call(
      `https://identitytoolkit.googleapis.com/admin/v1/projects/${PROJECT}/accounts:delete`,
      { method: 'POST', body: JSON.stringify({ localId }) }
    )
    console.log(`  silindi: ${email} → HTTP ${del.status}`)
  }
})()