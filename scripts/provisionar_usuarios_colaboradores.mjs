import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LOGIN_DOMAIN = process.env.LOGIN_DOMAIN || 'login.teg.local'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
}

const MOD_KEYS = [
  'egp', 'obras', 'ssma',
  'compras', 'logistica', 'estoque', 'patrimonial', 'frotas',
  'financeiro', 'fiscal', 'controladoria', 'contratos', 'cadastros',
  'rh',
]

const ROLE_RANK = {
  visitante: 0,
  requisitante: 1,
  gestor: 2,
  diretor: 3,
  administrador: 4,
}

function normalize(value) {
  return (value ?? '').toString().trim()
}

function up(value) {
  return normalize(value).toUpperCase()
}

function slugName(value) {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferTags(cargoRaw) {
  const cargo = up(cargoRaw)
  const tags = new Set()
  if (!cargo) return tags
  if (cargo.includes('DIRETOR')) tags.add('diretor')
  if (cargo.includes('ENGENHEIR')) tags.add('engenheiro')
  if (cargo.includes('ALMOXARIF')) tags.add('almoxarife')
  if (cargo.includes('ADMINISTRATIV') || cargo.includes('AUXILIAR DE ESCRITORIO')) tags.add('administrativo')
  if (cargo.includes('COMPRADOR') || cargo.includes('COMPRAS')) tags.add('compradores')
  if (cargo.includes('SUPRIMENT')) tags.add('suprimentos')
  if (cargo.includes(' RECURSOS HUMANOS') || cargo.includes('GESTORA DE RH') || cargo.includes('GERENTE DE RH') || cargo.includes('ASSISTENTE DE RH') || cargo.startsWith('RH ')) tags.add('rh')
  if (cargo.includes('FINANCEIR') || cargo.includes('CONTROLLER')) tags.add('financeiro')
  if (/(^|\s)TI(\s|$)/.test(cargo) || cargo.includes('TECNOLOG')) tags.add('ti')
  if (cargo.includes('GERENTE') || cargo.includes('GESTOR') || cargo.includes('SUPERVISOR') || cargo.includes('COORDENADOR') || cargo.includes('ENCARREGADO')) tags.add('lideranca')
  return tags
}

function inScope(colaborador) {
  const email = normalize(colaborador.email)
  const tags = inferTags(colaborador.cargo)
  const byEmail = email !== ''
  const byCargo = [
    'diretor',
    'engenheiro',
    'almoxarife',
    'administrativo',
    'compradores',
    'suprimentos',
    'rh',
    'financeiro',
    'ti',
  ].some((t) => tags.has(t))
  return byEmail || byCargo
}

function buildUsername(fullName) {
  const STOPWORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  const tokens = slugName(fullName).split(' ').filter(Boolean).filter((t) => !STOPWORDS.has(t))
  if (tokens.length === 0) return `usuario.${crypto.randomUUID().slice(0, 6)}`
  if (tokens.length === 1) return tokens[0]
  return `${tokens[0]}.${tokens[tokens.length - 1]}`
}

function ensureUniqueUsername(baseUsername, used) {
  let username = baseUsername.slice(0, 45)
  if (!used.has(username)) {
    used.add(username)
    return username
  }
  let i = 2
  while (i < 1000) {
    const candidate = `${baseUsername}.${i}`.slice(0, 45)
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
    i += 1
  }
  const fallback = `${baseUsername}.${crypto.randomUUID().slice(0, 4)}`.slice(0, 45)
  used.add(fallback)
  return fallback
}

function emptyModulos() {
  return Object.fromEntries(MOD_KEYS.map((k) => [k, false]))
}

function mergeModulos(current, target) {
  const merged = emptyModulos()
  for (const key of MOD_KEYS) merged[key] = !!(current?.[key] || target?.[key])
  return merged
}

function deriveAccess(cargoRaw) {
  const tags = inferTags(cargoRaw)
  let role = 'requisitante'
  let alcada = 1
  if (tags.has('diretor')) {
    role = 'diretor'
    alcada = 3
  } else if (tags.has('lideranca')) {
    role = 'gestor'
    alcada = 2
  }

  const modulos = emptyModulos()
  modulos.compras = true
  modulos.logistica = true

  if (tags.has('diretor')) {
    for (const key of MOD_KEYS) modulos[key] = true
  }
  if (tags.has('engenheiro')) {
    modulos.obras = true
    modulos.egp = true
  }
  if (tags.has('almoxarife')) {
    modulos.estoque = true
  }
  if (tags.has('rh')) {
    modulos.rh = true
  }
  if (tags.has('financeiro')) {
    modulos.financeiro = true
    modulos.controladoria = true
  }
  if (tags.has('ti')) {
    modulos.cadastros = true
  }
  if (tags.has('compradores') || tags.has('suprimentos')) {
    modulos.compras = true
    modulos.logistica = true
  }

  return { role, alcada, modulos }
}

function randomPassword() {
  const part = crypto.randomBytes(5).toString('hex')
  return `Teg@${part}#`
}

async function sbRest(method, pathname, { query = '', body = null, prefer = null } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${pathname}${query ? `?${query}` : ''}`
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  }
  if (body) headers['Content-Type'] = 'application/json'
  if (prefer) headers.Prefer = prefer
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`REST ${method} ${pathname} failed: ${res.status} ${await res.text()}`)
  }
  const txt = await res.text()
  if (!txt) return null
  return JSON.parse(txt)
}

async function authListUsers() {
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
    if (!res.ok) throw new Error(`Auth list users failed: ${res.status} ${await res.text()}`)
    const json = await res.json()
    const batch = json?.users || []
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }
  return users
}

async function authCreateUser({ email, password, nome, username, colaboradorId }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        username,
        colaborador_id: colaboradorId,
      },
    }),
  })
  if (!res.ok) throw new Error(`Auth create failed (${email}): ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json?.user?.id
}

async function authUpdateEmail(authId, email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
    }),
  })
  if (!res.ok) throw new Error(`Auth update email failed (${authId}): ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json?.id || authId
}

async function authFindUserIdByEmail(email) {
  const users = await authListUsers()
  const found = users.find((u) => normalize(u.email).toLowerCase() === normalize(email).toLowerCase())
  return found?.id ? String(found.id) : null
}

async function findPerfilByAuthId(authId, maxTry = 8) {
  for (let i = 0; i < maxTry; i += 1) {
    const rows = await sbRest('GET', 'sys_perfis', {
      query: `select=*&auth_id=eq.${authId}&limit=1`,
    })
    if (rows?.length) return rows[0]
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

async function main() {
  const colaboradores = await sbRest('GET', 'rh_colaboradores', {
    query: 'select=id,nome,email,cargo,matricula,ativo,status_admissao,perfil_id&ativo=eq.true',
  })

  const perfis = await sbRest('GET', 'sys_perfis', {
    query: 'select=*',
  })

  const authUsers = await authListUsers()

  const selected = colaboradores.filter(inScope)
  const usedSyntheticUsernames = new Set(
    authUsers
      .map((u) => normalize(u.email).toLowerCase())
      .filter((e) => e.endsWith(`@${LOGIN_DOMAIN}`))
      .map((e) => e.split('@')[0]),
  )

  const perfisByColaborador = new Map()
  const perfisByEmail = new Map()
  const perfisByAuthId = new Map()
  const authByEmail = new Map()
  for (const p of perfis) {
    if (p.colaborador_id) perfisByColaborador.set(String(p.colaborador_id), p)
    if (p.email) perfisByEmail.set(String(p.email).toLowerCase(), p)
    if (p.auth_id) perfisByAuthId.set(String(p.auth_id), p)
  }
  for (const u of authUsers) {
    const em = normalize(u.email).toLowerCase()
    if (em) authByEmail.set(em, String(u.id))
  }

  const created = []
  const updated = []

  for (const col of selected) {
    const colaboradorId = String(col.id)
    const nome = normalize(col.nome)
    const cargo = normalize(col.cargo)
    const existingPerfil = perfisByColaborador.get(colaboradorId)

    const existingEmail = normalize(existingPerfil?.email).toLowerCase()
    let chosenUsername = ''
    if (existingEmail.endsWith(`@${LOGIN_DOMAIN}`)) {
      chosenUsername = existingEmail.split('@')[0]
      usedSyntheticUsernames.add(chosenUsername)
    } else {
      chosenUsername = buildUsername(nome).toLowerCase()
      chosenUsername = ensureUniqueUsername(chosenUsername, usedSyntheticUsernames)
    }
    let syntheticEmail = `${chosenUsername}@${LOGIN_DOMAIN}`

    let perfil = existingPerfil
    let authId = perfil?.auth_id ? String(perfil.auth_id) : null
    let generatedPassword = null

    if (!authId) {
      const mappedAuth = authByEmail.get(syntheticEmail)
      if (mappedAuth) {
        authId = mappedAuth
      } else {
        generatedPassword = randomPassword()
        try {
          authId = await authCreateUser({
            email: syntheticEmail,
            password: generatedPassword,
            nome,
            username: chosenUsername,
            colaboradorId,
          })
        } catch (error) {
          const msg = String(error?.message || '')
          if (!msg.includes('email_exists')) throw error
          generatedPassword = null
          authId = await authFindUserIdByEmail(syntheticEmail)
          if (!authId) throw error
        }
        authByEmail.set(syntheticEmail, authId)
      }
    }

    if (!perfil && authId) {
      perfil = perfisByAuthId.get(authId) || await findPerfilByAuthId(authId)
    }

    if (!perfil) {
      const inserted = await sbRest('POST', 'sys_perfis', {
        body: [{
          auth_id: authId,
          nome,
          email: syntheticEmail,
          cargo: cargo || null,
          role: 'requisitante',
          alcada_nivel: 1,
          modulos: { compras: true, logistica: true },
          ativo: true,
          colaborador_id: colaboradorId,
          senha_definida: false,
        }],
        prefer: 'return=representation',
      })
      perfil = inserted[0]
    }

    const access = deriveAccess(cargo)

    if (authId && normalize(perfil?.email).toLowerCase() !== syntheticEmail) {
      const takenBy = authByEmail.get(syntheticEmail)
      if (takenBy && takenBy !== authId) {
        let i = 2
        while (authByEmail.get(syntheticEmail) && authByEmail.get(syntheticEmail) !== authId) {
          syntheticEmail = `${chosenUsername}.${i}@${LOGIN_DOMAIN}`
          i += 1
        }
      }
      await authUpdateEmail(authId, syntheticEmail)
      authByEmail.set(syntheticEmail, authId)
    }

    const currentRole = normalize(perfil.role) || 'requisitante'
    const keepRole = currentRole === 'administrador'
    const nextRole = keepRole
      ? currentRole
      : (ROLE_RANK[currentRole] >= ROLE_RANK[access.role] ? currentRole : access.role)
    const nextAlcada = keepRole
      ? Number(perfil.alcada_nivel || 0)
      : Math.max(Number(perfil.alcada_nivel || 0), access.alcada)
    const nextModulos = keepRole
      ? (perfil.modulos || {})
      : mergeModulos(perfil.modulos || {}, access.modulos)

    const patched = await sbRest('PATCH', 'sys_perfis', {
      query: `id=eq.${perfil.id}`,
      body: {
        auth_id: authId,
        nome,
        email: syntheticEmail,
        cargo: cargo || null,
        colaborador_id: colaboradorId,
        role: nextRole,
        alcada_nivel: nextAlcada,
        modulos: nextModulos,
        ativo: true,
      },
      prefer: 'return=representation',
    })
    const perfilFinal = patched?.[0] || perfil

    await sbRest('PATCH', 'rh_colaboradores', {
      query: `id=eq.${colaboradorId}`,
      body: { perfil_id: perfilFinal.id },
    })

    if (generatedPassword) {
      created.push({
        colaborador_id: colaboradorId,
        nome,
        cargo,
        username: chosenUsername,
        login_email: syntheticEmail,
        senha_inicial: generatedPassword,
        role: perfilFinal.role,
      })
    } else {
      updated.push({
        colaborador_id: colaboradorId,
        nome,
        cargo,
        username: chosenUsername,
        login_email: syntheticEmail,
        role: perfilFinal.role,
      })
    }
  }

  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const outDir = path.resolve('C:/teg-plus')
  const jsonPath = path.join(outDir, `tmp_provisionamento_usuarios_${stamp}.json`)
  const csvPath = path.join(outDir, `tmp_credenciais_iniciais_${stamp}.csv`)

  const summary = {
    generated_at: now.toISOString(),
    total_colaboradores_ativos: colaboradores.length,
    total_selecionados_uniao: selected.length,
    criados: created.length,
    atualizados: updated.length,
    arquivo_credenciais: csvPath,
  }

  fs.writeFileSync(jsonPath, JSON.stringify({ summary, created, updated }, null, 2), 'utf8')

  const csvHeader = 'nome,username,login_email,senha_inicial,role,cargo,colaborador_id\n'
  const csvBody = created.map((r) => (
    `"${r.nome.replaceAll('"', '""')}","${r.username}","${r.login_email}","${r.senha_inicial}","${r.role}","${r.cargo.replaceAll('"', '""')}","${r.colaborador_id}"`
  )).join('\n')
  fs.writeFileSync(csvPath, csvHeader + csvBody + (csvBody ? '\n' : ''), 'utf8')

  console.log(JSON.stringify(summary, null, 2))
  console.log(`JSON: ${jsonPath}`)
  console.log(`CSV: ${csvPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
