/**
 * Firestore Veri Aktarım Betiği
 * guvercin-takip-9f2a -> guvercin-beta-dev
 */
const fs = require('fs')
const https = require('https')
const path = require('path')

const SOURCE_PROJECT = 'guvercin-takip-9f2a'
const TARGET_PROJECT = 'guvercin-beta-dev'

const cfg = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json')))
let token = cfg.tokens.access_token

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, raw: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

function getDocs(project, docPath) {
  return request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${project}/databases/(default)/documents${docPath}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })
}

async function listAll(project, colPath) {
  let docs = []
  let pageToken = ''
  do {
    const url = colPath + (pageToken ? `?pageToken=${pageToken}` : '')
    const res = await getDocs(project, url)
    if (res.body && res.body.documents) {
      docs.push(...res.body.documents)
    }
    pageToken = res.body && res.body.nextPageToken
  } while (pageToken)
  return docs
}

async function commitWrites(project, writes) {
  if (!writes.length) return { ok: true, count: 0 }
  const postData = JSON.stringify({ writes })
  const res = await request(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${project}/databases/(default)/documents:commit`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    },
    postData
  )
  return res
}

async function migrateUser(uid) {
  console.log(`\nAktarılıyor: ${uid}`)
  const writes = []

  // 1. Ana kullanıcı belgesi
  const userDocRes = await getDocs(SOURCE_PROJECT, `/users/${uid}`)
  if (userDocRes.body && userDocRes.body.fields) {
    const targetName = userDocRes.body.name.replace(SOURCE_PROJECT, TARGET_PROJECT)
    writes.push({
      update: {
        name: targetName,
        fields: userDocRes.body.fields
      }
    })
    console.log(`  ✓ Ana kullanıcı profili ve ayarları hazırlandı`)
  }

  // 2. Alt koleksiyonlar
  for (const sub of ['birds', 'pairings', 'medications', 'photos']) {
    const subDocs = await listAll(SOURCE_PROJECT, `/users/${uid}/${sub}`)
    for (const d of subDocs) {
      const targetName = d.name.replace(SOURCE_PROJECT, TARGET_PROJECT)
      writes.push({
        update: {
          name: targetName,
          fields: d.fields
        }
      })
    }
    console.log(`  ✓ ${sub}: ${subDocs.length} belge hazırlandı`)
  }

  // Firestore commit (500'erli gruplar halinde)
  console.log(`  -> Toplam yazılacak belge: ${writes.length}`)
  const CHUNK_SIZE = 400
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const chunk = writes.slice(i, i + CHUNK_SIZE)
    const res = await commitWrites(TARGET_PROJECT, chunk)
    if (res.status === 200) {
      console.log(`  ✓ Grup ${Math.floor(i / CHUNK_SIZE) + 1} yazıldı (${chunk.length} belge)`)
    } else {
      console.error(`  ✗ Hata (HTTP ${res.status}):`, res.body || res.raw)
    }
  }
}

async function main() {
  const usersToMigrate = [
    'g2Kx8dpNtCSRLIuV2zLCZZKNAWe2', // tekvandobiliyorum@gmail.com (GÖKSEL)
    'YeLYNfl4w0h2hxqBgTBz2cJDlxz1'  // evrimkaytan@gmail.com
  ]

  for (const uid of usersToMigrate) {
    await migrateUser(uid)
  }

  console.log('\n--- DOĞRULAMA (guvercin-beta-dev) ---')
  for (const uid of usersToMigrate) {
    for (const sub of ['birds', 'pairings', 'medications', 'photos']) {
      const docs = await listAll(TARGET_PROJECT, `/users/${uid}/${sub}`)
      console.log(`Hedef [${uid}] ${sub}: ${docs.length} belge`)
    }
  }
  console.log('\nAktarım başarıyla tamamlandı!')
}

main().catch(console.error)
