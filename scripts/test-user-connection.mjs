#!/usr/bin/env node
// =============================================================
// TEG+ - Teste de Conexão e Verificação de Usuário
// Uso: node scripts/test-user-connection.mjs [username_ou_email]
//
// Exemplos:
//   node scripts/test-user-connection.mjs gabriel.freitas
//   node scripts/test-user-connection.mjs gabriel.freitas@empresa.com
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/test-user-connection.mjs gabriel.freitas
// =============================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Carrega .env se existir ────────────────────────────────────
const envPath = resolve(__dirname, '../.env')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=')
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

// ── Configuração ───────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || 'https://uzfjfucrinokeuwpbeie.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDE2NTgsImV4cCI6MjA4Nzc3NzY1OH0.eFf_TTijVffZxnl2xlm_Mncji1bQRHyosAALawrtZbk'

const LOOKUP = process.argv[2] || 'gabriel.freitas'

// ── Helpers de output ──────────────────────────────────────────
const ok   = (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`)
const fail = (msg) => console.log(`  \x1b[31m✘\x1b[0m ${msg}`)
const info = (msg) => console.log(`  \x1b[33m→\x1b[0m ${msg}`)
const sep  = ()    => console.log('')

// ── Determina chave a usar ────────────────────────────────────
const activeKey = SERVICE_ROLE_KEY || ANON_KEY
const keyType   = SERVICE_ROLE_KEY ? 'service_role' : 'anon'

console.log('')
console.log('══════════════════════════════════════════════')
console.log('   TEG+ - Teste de Conexão')
console.log(`   Usuário buscado: ${LOOKUP}`)
console.log('══════════════════════════════════════════════')
sep()

// ── 1. Supabase REST API ───────────────────────────────────────
console.log('[ 1 · SUPABASE REST API ]')
info(`URL: ${SUPABASE_URL}`)
info(`Chave: ${keyType}`)

const supabase = createClient(SUPABASE_URL, activeKey)

try {
  // Testa com query simples na tabela sys_obras (leitura pública de obras)
  const { data, error, status } = await supabase
    .from('sys_obras')
    .select('id, nome')
    .limit(1)

  if (error && error.code !== 'PGRST116') {
    fail(`Erro REST: ${error.message} (código: ${error.code})`)
  } else {
    ok(`REST API acessível (status ${status})`)
    if (data?.length) {
      info(`Obra de teste: ${data[0].nome}`)
    }
  }
} catch (e) {
  fail(`Falha de rede: ${e.message}`)
  console.log('')
  console.log('  DICA: Verifique se SUPABASE_URL está correto e há acesso à internet.')
  process.exit(1)
}

sep()

// ── 2. Busca usuário ───────────────────────────────────────────
console.log('[ 2 · BUSCA DE USUÁRIO ]')

// Normaliza: se não tem @, trata como username (parte antes do @) em email
const isEmail = LOOKUP.includes('@')
info(`Modo de busca: ${isEmail ? 'e-mail exato' : 'nome/username parcial'}`)

let query = supabase
  .from('sys_perfis')
  .select('id, nome, email, cargo, departamento, role, alcada_nivel, modulos, ativo, ultimo_acesso, created_at')

if (isEmail) {
  query = query.eq('email', LOOKUP)
} else {
  // Busca por nome parcial (case-insensitive) ou por email que contenha o username
  query = query.or(`nome.ilike.%${LOOKUP}%,email.ilike.%${LOOKUP}%`)
}

const { data: perfis, error: perfilError } = await query.limit(5)

if (perfilError) {
  if (perfilError.code === '42501' || perfilError.message?.includes('permission')) {
    fail('Sem permissão para ler sys_perfis com chave anon (RLS ativo)')
    info('Defina SUPABASE_SERVICE_ROLE_KEY no .env para consultar sys_perfis')
  } else {
    fail(`Erro ao buscar perfil: ${perfilError.message}`)
  }
} else if (!perfis || perfis.length === 0) {
  fail(`Nenhum usuário encontrado para "${LOOKUP}"`)
  info('Verifique se o usuário já fez login ou tem convite ativo em sys_convites')
} else {
  ok(`${perfis.length} usuário(s) encontrado(s):`)
  sep()
  for (const p of perfis) {
    const status = p.ativo ? '\x1b[32mATIVO\x1b[0m' : '\x1b[31mINATIVO\x1b[0m'
    const ultimoAcesso = p.ultimo_acesso
      ? new Date(p.ultimo_acesso).toLocaleString('pt-BR')
      : 'nunca'
    const modulos = Object.entries(p.modulos || {})
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ') || 'nenhum'

    console.log(`  ┌─ ${p.nome} (${status})`)
    console.log(`  │  Email:          ${p.email}`)
    console.log(`  │  Cargo:          ${p.cargo || '—'}`)
    console.log(`  │  Departamento:   ${p.departamento || '—'}`)
    console.log(`  │  Role:           ${p.role}`)
    console.log(`  │  Alçada:         nível ${p.alcada_nivel}`)
    console.log(`  │  Módulos:        ${modulos}`)
    console.log(`  │  Último acesso:  ${ultimoAcesso}`)
    console.log(`  └─ ID: ${p.id}`)
    sep()
  }
}

// ── 3. Busca convite pendente ──────────────────────────────────
console.log('[ 3 · CONVITE EM sys_convites ]')

const { data: convites, error: conviteError } = await supabase
  .from('sys_convites')
  .select('id, email, role, alcada_nivel, modulos, aceito, expires_at, created_at')
  .or(`email.ilike.%${isEmail ? LOOKUP : LOOKUP}%`)
  .limit(5)

if (conviteError) {
  if (conviteError.code === '42501' || conviteError.message?.includes('permission')) {
    info('Sem permissão para ler sys_convites com chave anon')
  } else {
    fail(`Erro ao buscar convite: ${conviteError.message}`)
  }
} else if (!convites || convites.length === 0) {
  info(`Nenhum convite encontrado para "${LOOKUP}"`)
} else {
  ok(`${convites.length} convite(s) encontrado(s):`)
  for (const c of convites) {
    const aceito  = c.aceito ? '\x1b[32maceiro\x1b[0m' : '\x1b[33mpendente\x1b[0m'
    const expira  = new Date(c.expires_at) < new Date()
      ? '\x1b[31mEXPIRADO\x1b[0m'
      : `válido até ${new Date(c.expires_at).toLocaleDateString('pt-BR')}`
    const modulos = Object.entries(c.modulos || {})
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ') || 'nenhum'

    console.log(`  ┌─ ${c.email}`)
    console.log(`  │  Status:   ${aceito} · ${expira}`)
    console.log(`  │  Role:     ${c.role}`)
    console.log(`  │  Alçada:   nível ${c.alcada_nivel}`)
    console.log(`  └─ Módulos:  ${modulos}`)
    sep()
  }
}

// ── 4. Resumo ─────────────────────────────────────────────────
console.log('══════════════════════════════════════════════')
console.log('   Concluído')
console.log('══════════════════════════════════════════════')
console.log('')
