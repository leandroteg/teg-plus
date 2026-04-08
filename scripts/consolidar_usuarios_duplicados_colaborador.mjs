import fs from 'node:fs'
import path from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LOGIN_DOMAIN = process.env.LOGIN_DOMAIN || 'login.teg.local'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
}

function normalize(v) {
  return (v ?? '').toString().trim()
}

function toDate(v) {
  const d = new Date(v || 0)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

async function restGet(pathname) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`GET ${pathname}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function restPatch(pathname, body, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${pathname}: ${res.status} ${await res.text()}`)
  const txt = await res.text()
  return txt ? JSON.parse(txt) : null
}

async function listAuthUsers() {
  const users = []
  let page = 1
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (!res.ok) throw new Error(`Auth list users: ${res.status} ${await res.text()}`)
    const json = await res.json()
    const batch = json?.users || []
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }
  return users
}

async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Auth delete user ${userId}: ${res.status} ${await res.text()}`)
}

function emailRank(emailRaw) {
  const email = normalize(emailRaw).toLowerCase()
  const suffix = `@${LOGIN_DOMAIN}`
  if (!email.endsWith(suffix)) return 10_000
  const local = email.slice(0, -suffix.length)
  const m = local.match(/^(.*)\.(\d+)$/)
  if (!m) return 0
  return 100 + Number(m[2] || 0)
}

function pickKeeperAuth(authUsers) {
  return [...authUsers].sort((a, b) => {
    const ra = emailRank(a.email)
    const rb = emailRank(b.email)
    if (ra !== rb) return ra - rb
    return toDate(a.created_at) - toDate(b.created_at)
  })[0]
}

async function main() {
  const perfis = await restGet('sys_perfis?select=id,auth_id,email,colaborador_id,ativo,created_at,nome,role,alcada_nivel,modulos')
  const authUsers = await listAuthUsers()

  const authByColab = new Map()
  for (const u of authUsers) {
    const cid = normalize(u?.user_metadata?.colaborador_id)
    if (!cid) continue
    authByColab.set(cid, [...(authByColab.get(cid) || []), u])
  }

  const perfisByColab = new Map()
  for (const p of perfis) {
    const cid = normalize(p.colaborador_id)
    if (!cid) continue
    perfisByColab.set(cid, [...(perfisByColab.get(cid) || []), p])
  }

  const duplicateGroups = [...authByColab.entries()].filter(([, users]) => users.length > 1)

  const report = {
    groups_found: duplicateGroups.length,
    consolidated_groups: 0,
    auth_users_deleted: 0,
    perfis_deactivated: 0,
    relinked_colaboradores: 0,
    details: [],
  }

  for (const [colaboradorId, users] of duplicateGroups) {
    const keeperAuth = pickKeeperAuth(users)
    const extras = users.filter((u) => u.id !== keeperAuth.id)

    const candidatePerfis = perfisByColab.get(colaboradorId) || []
    const byAuthGlobal = perfis.find((p) => normalize(p.auth_id) === keeperAuth.id)
    let keeperPerfil = byAuthGlobal ||
      candidatePerfis.find((p) => normalize(p.auth_id) === keeperAuth.id) ||
      candidatePerfis.sort((a, b) => toDate(a.created_at) - toDate(b.created_at))[0]

    if (!keeperPerfil) {
      report.details.push({ colaborador_id: colaboradorId, skipped: true, reason: 'keeper_perfil_not_found' })
      continue
    }

    // Promote keeper profile.
    const patchedKeeper = await restPatch(`sys_perfis?id=eq.${keeperPerfil.id}`, {
      auth_id: keeperAuth.id,
      email: normalize(keeperAuth.email).toLowerCase(),
      colaborador_id: colaboradorId,
      ativo: true,
    })
    keeperPerfil = patchedKeeper?.[0] || keeperPerfil

    await restPatch(`rh_colaboradores?id=eq.${colaboradorId}`, { perfil_id: keeperPerfil.id }, 'return=minimal')

    const extraAuthIds = new Set(extras.map((u) => u.id))
    const extraPerfis = perfis.filter((p) => {
      if (p.id === keeperPerfil.id) return false
      return normalize(p.colaborador_id) === colaboradorId || extraAuthIds.has(normalize(p.auth_id))
    })

    for (const p of extraPerfis) {
      await restPatch(`sys_perfis?id=eq.${p.id}`, {
        ativo: false,
        auth_id: null,
        colaborador_id: null,
        email: `zombie+${p.id}@deprecated.local`,
        nome: `${normalize(p.nome) || 'Perfil'} [OBSOLETO]`,
      }, 'return=minimal')
      report.perfis_deactivated += 1
    }

    for (const u of extras) {
      await deleteAuthUser(u.id)
      report.auth_users_deleted += 1
    }

    report.consolidated_groups += 1
    report.relinked_colaboradores += 1
    report.details.push({
      colaborador_id: colaboradorId,
      keeper_auth_email: normalize(keeperAuth.email).toLowerCase(),
      keeper_perfil_id: keeperPerfil.id,
      deleted_auth_users: extras.map((x) => ({ id: x.id, email: x.email })),
      deactivated_perfis: extraPerfis.map((x) => x.id),
    })
  }

  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const outPath = path.join('C:/teg-plus', `tmp_consolidacao_usuarios_${stamp}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(JSON.stringify(report, null, 2))
  console.log(`REPORT: ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
