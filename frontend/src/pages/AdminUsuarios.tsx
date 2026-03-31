import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import {
  Users, UserPlus, Search, ChevronLeft, Shield,
  Check, X, AlertCircle, Mail, RefreshCw,
  CheckCircle, Power, Edit3, ChevronDown, ChevronUp,
  Calendar, Clock, Briefcase, Building2, Eye, EyeOff, Lock,
  LayoutGrid, LayoutList, SlidersHorizontal,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import {
  useAuth,
  type Perfil, type Role, type PapelGlobal,
  ROLE_LABEL, ROLE_COLOR, ALCADA_LABEL, MODULOS_ERP, MODULOS_ERP_GROUPED,
} from '../contexts/AuthContext'
import { GRUPO_CONTRATO_OPTIONS } from '../constants/contratos'

const INTERNAL_LOGIN_DOMAIN = 'login.teg.local'
const INTERNAL_SIGNUP_DOMAIN = 'login.teg.local.com'
const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace(/\/$/, '') || ''

type CadastroResult = {
  nome: string
  username: string
  login_email: string
  senha_temporaria: string
  email_contato?: string
  whatsapp?: string
}

function normalizeUsername(raw: string) {
  const base = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!base) return 'usuario'
  const parts = base.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].replace(/\.+/g, '.')
  return `${parts[0]}.${parts[parts.length - 1]}`.replace(/\.+/g, '.')
}

function randomToken(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(len)
    crypto.getRandomValues(arr)
    return Array.from(arr, b => chars[b % chars.length]).join('')
  }
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function buildSenhaTemporaria() {
  return `Teg@${randomToken(10)}#`
}

function buildCredenciaisMessage(data: CadastroResult) {
  return [
    `Acesso TEG+ criado para ${data.nome}`,
    `Usuário: ${data.username}`,
    `Login: ${data.login_email}`,
    `Senha temporária: ${data.senha_temporaria}`,
    'No primeiro acesso, alterar a senha.',
  ].join('\n')
}

function openShareEmail(destinatario: string, message: string) {
  const subject = encodeURIComponent('Acesso TEG+')
  const body = encodeURIComponent(message)
  window.open(`mailto:${destinatario}?subject=${subject}&body=${body}`, '_blank')
}

function openShareWhatsApp(whatsapp: string, message: string) {
  const numero = whatsapp.replace(/\D/g, '')
  const text = encodeURIComponent(message)
  window.open(`https://wa.me/${numero}?text=${text}`, '_blank')
}

// ── Roles config (novo sistema 5 perfis) ─────────────────────────────────────
const PAPEIS: { value: PapelGlobal; label: string; color: string }[] = [
  { value: 'requisitante', label: 'Requisitante', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'equipe', label: 'Equipe', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'supervisor', label: 'Supervisor', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'diretor', label: 'Diretor', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'ceo', label: 'Administrador', color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
]

const ROLE_LABEL_UI: Partial<Record<Role, string>> = {
  ceo: 'Administrador',
  admin: 'Administrador',
  administrador: 'Administrador',
}

function getRoleLabel(role: Role) {
  return ROLE_LABEL_UI[role] ?? ROLE_LABEL[role]
}

function mapPapelToLegacyRole(papel: PapelGlobal): Role {
  switch (papel) {
    case 'diretor':
      return 'diretor'
    case 'ceo':
      return 'administrador'
    case 'supervisor':
    case 'equipe':
      return 'gestor'
    default:
      return 'requisitante'
  }
}

function resolvePapelFromPerfil(perfil: Perfil): PapelGlobal {
  const direto = perfil.papel_global as PapelGlobal | undefined
  if (direto && PAPEIS.some(p => p.value === direto)) return direto
  const role = String(perfil.role ?? '').toLowerCase()
  if (role === 'administrador' || role === 'admin') return 'ceo'
  if (role === 'diretor' || role === 'gerente') return 'diretor'
  if (role === 'supervisor' || role === 'aprovador') return 'supervisor'
  if (role === 'gestor') return 'equipe'
  if (role === 'comprador') return 'equipe'
  return 'requisitante'
}

function normalizeModuloForSetor(modulo: string) {
  if (modulo === 'patrimonial') return 'patrimonio'
  if (modulo === 'apontamentos') return 'financeiro'
  return modulo
}

function createEmptyModulosMap() {
  return MODULOS_ERP.reduce((acc, item) => {
    acc[item.key] = false
    return acc
  }, {} as Record<string, boolean>)
}

function isPapelGlobal(value: unknown): value is PapelGlobal {
  return value === 'requisitante'
    || value === 'equipe'
    || value === 'supervisor'
    || value === 'diretor'
    || value === 'ceo'
}

function extractModuloPapeis(permissoes: Record<string, any> | null | undefined): Record<string, PapelGlobal> {
  const raw = permissoes?.modulo_papeis
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, PapelGlobal> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (isPapelGlobal(value) && value !== 'requisitante') {
      out[key] = value
    }
  }
  return out
}

function applyModuloPapeisOnPermissoes(
  permissoes: Record<string, any> | null | undefined,
  moduloPapeis: Record<string, PapelGlobal>
) {
  const next = { ...(permissoes ?? {}) } as Record<string, any>
  if (Object.keys(moduloPapeis).length === 0) {
    delete next.modulo_papeis
  } else {
    next.modulo_papeis = moduloPapeis
  }
  return next
}

function resolvePapelByModulo(
  modulo: string,
  moduloPapeis: Record<string, PapelGlobal> | undefined
): PapelGlobal {
  if (!moduloPapeis) return 'requisitante'
  const normalized = normalizeModuloForSetor(modulo)
  return moduloPapeis[modulo] || moduloPapeis[normalized] || 'requisitante'
}

async function updatePerfilWithSync(
  payload: Partial<Perfil> & { id: string; papel_global?: PapelGlobal }
) {
  const { id, papel_global, ...rest } = payload
  const data = { ...rest } as Partial<Perfil> & { papel_global?: PapelGlobal }
  if (papel_global) data.papel_global = papel_global

  const runUpdate = async (body: Partial<Perfil>) => supabase
    .from('sys_perfis')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  let { data: updated, error } = await runUpdate(data)

  // Compatibilidade: alguns bancos ainda não têm coluna papel_global.
  if (error && papel_global && /papel_global/i.test(String(error.message || ''))) {
    const { papel_global: _pg, ...fallbackData } = data
    const retry = await runUpdate(fallbackData)
    updated = retry.data
    error = retry.error
  }

  if (error) throw error

  if (rest.modulos || rest.permissoes_especiais) {
    const moduloPapeis = extractModuloPapeis(
      (rest.permissoes_especiais as Record<string, any> | undefined)
      ?? ((updated as Perfil).permissoes_especiais as Record<string, any> | undefined)
    )
    await syncPerfilSetores(
      id,
      (rest.modulos as Record<string, boolean> | undefined) ?? ((updated as Perfil).modulos ?? {}),
      moduloPapeis
    )
  }

  return updated as Perfil
}

async function syncPerfilSetores(
  perfilId: string,
  modulos: Record<string, boolean>,
  moduloPapeis?: Record<string, PapelGlobal>
) {
  const ativos = Object.entries(modulos)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([modulo]) => normalizeModuloForSetor(modulo))

  try {
    if (ativos.length === 0) {
      await supabase
        .from('sys_perfil_setores')
        .update({ ativo: false })
        .eq('perfil_id', perfilId)
      return
    }

    const uniqueModulos = Array.from(new Set(ativos))
    const { data: setores, error: setoresError } = await supabase
      .from('sys_setores')
      .select('id, modulo_key')
      .in('modulo_key', uniqueModulos)
      .eq('ativo', true)

    if (setoresError) throw setoresError
    if (!setores || setores.length === 0) return

    await supabase
      .from('sys_perfil_setores')
      .update({ ativo: false })
      .eq('perfil_id', perfilId)

    const rows = setores.map(setor => {
      const papelSetor = resolvePapelByModulo(setor.modulo_key, moduloPapeis)
      return ({
      perfil_id: perfilId,
      setor_id: setor.id,
      papel: papelSetor,
      aprovador_tecnico: papelSetor === 'supervisor' || papelSetor === 'diretor' || papelSetor === 'ceo',
      ativo: true,
    })})

    const { error: upsertErr } = await supabase
      .from('sys_perfil_setores')
      .upsert(rows, { onConflict: 'perfil_id,setor_id' })

    if (upsertErr) throw upsertErr
  } catch {
    // fallback silencioso: legado (role + modulos) continua operando
  }
}

// ── Avatar inline ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]
function Avatar({ nome, size = 'md' }: { nome: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
  const ini = nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  }
  return (
    <div className={`${color} rounded-xl flex items-center justify-center shrink-0 ${sizeClasses[size]}`}>
      <span className="text-white font-extrabold">{ini}</span>
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_COLOR[role]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {getRoleLabel(role)}
    </span>
  )
}

// ── Módulo Checkbox Group ────────────────────────────────────────────────────
function ModuloCheckboxGroup({
  modulos,
  onToggle,
  onSetAll,
  disabled = false,
}: {
  modulos: Record<string, boolean>
  onToggle: (key: string) => void
  onSetAll: (keys: string[], val: boolean) => void
  disabled?: boolean
}) {
  const allKeys = MODULOS_ERP.map(m => m.key)
  const selectedCount = allKeys.filter(k => modulos[k]).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Módulos ({selectedCount} de {allKeys.length})
        </label>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onSetAll(allKeys, true)} disabled={disabled}
            className="text-[10px] font-semibold text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed">Todos</button>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={() => onSetAll(allKeys, false)} disabled={disabled}
            className="text-[10px] font-semibold text-slate-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed">Nenhum</button>
        </div>
      </div>
      <div className="space-y-2.5">
        {MODULOS_ERP_GROUPED.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{group.label}</p>
            <div className="grid grid-cols-2 gap-1">
              {group.modulos.map(({ key, label, icon }) => (
                <label key={key}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-xs
                    ${modulos[key]
                      ? 'bg-primary/8 text-primary font-semibold'
                      : 'text-slate-500 hover:bg-slate-50'} ${disabled ? 'opacity-55 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={!!modulos[key]}
                    onChange={() => onToggle(key)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer"
                  />
                  <span className="text-[11px]">{icon}</span>
                  <span className="truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
function ModuloPapelEditor({
  modulos,
  moduloPapeis,
  onChange,
  disabled = false,
}: {
  modulos: Record<string, boolean>
  moduloPapeis: Record<string, PapelGlobal>
  onChange: (modulo: string, papel: PapelGlobal | '') => void
  disabled?: boolean
}) {
  const ativos = MODULOS_ERP.filter(mod => Boolean(modulos?.[mod.key]))

  if (ativos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
        Marque ao menos um módulo para definir papel por módulo.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ativos.map(mod => (
        <div key={mod.key} className="grid grid-cols-[1fr_180px] gap-2 items-center">
          <div className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
            <span className="text-[11px]">{mod.icon}</span>
            <span>{mod.label}</span>
          </div>
          <select
            value={moduloPapeis[mod.key] ?? ''}
            disabled={disabled}
            onChange={e => onChange(mod.key, e.target.value as PapelGlobal | '')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Requisitante (padrão)</option>
            {PAPEIS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

function usePerfis() {
  return useQuery({
    queryKey: ['perfis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('*')
        .order('nome')
      if (error) throw error
      return data as Perfil[]
    },
    staleTime: 30_000,
    retry: false,
  })
}

function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Perfil> & { id: string; papel_global?: PapelGlobal }) =>
      updatePerfilWithSync(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis'] }),
  })
}

function useBulkUpdateUsers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      ids: string[]
      papel_global?: PapelGlobal
      alcada_nivel?: number
      modulos?: Record<string, boolean>
      modulo_papeis?: Record<string, PapelGlobal>
    }) => {
      const { ids, papel_global, alcada_nivel, modulos, modulo_papeis } = payload
      if (!ids.length) throw new Error('Selecione ao menos um usuário.')

      const changes: Partial<Perfil> & { papel_global?: PapelGlobal } = {}
      if (papel_global) {
        changes.papel_global = papel_global
        changes.role = mapPapelToLegacyRole(papel_global)
      }
      if (typeof alcada_nivel === 'number') changes.alcada_nivel = alcada_nivel
      if (modulos) changes.modulos = modulos

      if (Object.keys(changes).length === 0 && !modulo_papeis) {
        throw new Error('Defina ao menos um campo para aplicar em lote.')
      }

      for (const id of ids) {
        let payloadUpdate: Partial<Perfil> & { id: string; papel_global?: PapelGlobal } = { id, ...changes }
        if (modulo_papeis) {
          const { data: perfilAtual, error: perfilError } = await supabase
            .from('sys_perfis')
            .select('permissoes_especiais')
            .eq('id', id)
            .single()
          if (perfilError) throw perfilError
          payloadUpdate = {
            ...payloadUpdate,
            permissoes_especiais: applyModuloPapeisOnPermissoes(
              (perfilAtual?.permissoes_especiais as Record<string, any> | undefined),
              modulo_papeis
            ),
          }
        }
        await updatePerfilWithSync(payloadUpdate)
      }

      return { total: ids.length }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis'] }),
  })
}

function useChangePassword() {
  return useMutation({
    mutationFn: async ({ auth_id, password }: { auth_id: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-set-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ auth_id, password }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao alterar senha')
      return json
    },
  })
}

function useCadastrarUsuario() {
  const { perfil: myPerfil } = useAuth()

  const ensureUniqueUsername = async (base: string) => {
    let candidate = base
    let suffix = 2

    while (suffix < 100) {
      const loginA = `${candidate}@${INTERNAL_LOGIN_DOMAIN}`
      const loginB = `${candidate}@${INTERNAL_SIGNUP_DOMAIN}`

      const { count, error } = await supabase
        .from('sys_perfis')
        .select('id', { count: 'exact', head: true })
        .in('email', [loginA, loginB])

      if (error) throw error
      if (!count) return candidate

      candidate = `${base}.${suffix}`
      suffix += 1
    }

    throw new Error('Não foi possível gerar um usuário único. Tente outro nome.')
  }

  const createDetachedClient = () => {
    const url = import.meta.env.VITE_SUPABASE_URL || 'https://uzfjfucrinokeuwpbeie.supabase.co'
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
      || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDE2NTgsImV4cCI6MjA4Nzc3NzY1OH0.eFf_TTijVffZxnl2xlm_Mncji1bQRHyosAALawrtZbk'
    return createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  const waitForPerfil = async (authId: string) => {
    for (let i = 0; i < 8; i += 1) {
      const { data } = await supabase
        .from('sys_perfis')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle()
      if (data) return data as Perfil
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    return null
  }

  const cadastrarViaN8n = async (payload: {
    nome: string
    username: string
    login_email: string
    signup_email: string
    senha_temporaria: string
    role: Role
    papel_global: PapelGlobal
    alcada_nivel: number
    modulos: Record<string, boolean>
    criado_por: string | null
  }) => {
    if (!N8N_BASE) return null

    const res = await fetch(`${N8N_BASE}/usuarios/cadastrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(txt || 'Falha ao cadastrar usuário no fluxo de automação.')
    }
    const out = await res.json().catch(() => ({}))
    return out as Record<string, unknown>
  }

  return useMutation({
    mutationFn: async ({
      nome, email_contato, whatsapp, username, papel_global, alcada_nivel, modulos,
    }: {
      nome: string
      email_contato?: string
      whatsapp?: string
      username?: string
      papel_global: PapelGlobal
      alcada_nivel: number; modulos: Record<string, boolean>
    }) => {
      const role = mapPapelToLegacyRole(papel_global)
      const baseUsername = normalizeUsername(username || nome)
      const finalUsername = await ensureUniqueUsername(baseUsername)
      const loginEmail = `${finalUsername}@${INTERNAL_LOGIN_DOMAIN}`
      const signupEmail = `${finalUsername}@${INTERNAL_SIGNUP_DOMAIN}`
      const senhaTemporaria = buildSenhaTemporaria()

      // 1) Tenta via n8n (fluxo recomendado para produção)
      try {
        await cadastrarViaN8n({
          nome,
          username: finalUsername,
          login_email: loginEmail,
          signup_email: signupEmail,
          senha_temporaria: senhaTemporaria,
          role,
          papel_global,
          alcada_nivel,
          modulos,
          criado_por: myPerfil?.id ?? null,
        })

        const { data: perfilN8n } = await supabase
          .from('sys_perfis')
          .select('id')
          .eq('email', loginEmail)
          .maybeSingle()

        if (perfilN8n?.id) {
          await syncPerfilSetores(perfilN8n.id, modulos)
        }

        return {
          nome,
          username: finalUsername,
          login_email: loginEmail,
          senha_temporaria: senhaTemporaria,
          email_contato,
          whatsapp,
        } satisfies CadastroResult
      } catch (n8nErr) {
        // segue para fallback local
        if (!N8N_BASE) {
          // sem n8n configurado, usa fallback local
        } else {
          console.warn('[AdminUsuarios] n8n indisponível, usando fallback local:', n8nErr)
        }
      }

      // 2) Fallback local: convite + signup desacoplado (não troca sessão do admin)
      const { error: convErr } = await supabase
        .from('sys_convites')
        .insert({
          email: signupEmail,
          role,
          papel_global,
          alcada_nivel,
          modulos,
          nome_sugerido: nome || null,
          convidado_por: myPerfil?.id,
        })
      if (convErr) throw convErr

      const detached = createDetachedClient()
      const { data: signUpData, error: signUpErr } = await detached.auth.signUp({
        email: signupEmail,
        password: senhaTemporaria,
        options: {
          data: { nome, username: finalUsername, origem: 'admin_usuarios' },
        },
      })

      if (signUpErr) throw signUpErr
      if (!signUpData?.user?.id) {
        throw new Error('Cadastro iniciado, mas sem retorno de usuário no Auth.')
      }

      const perfilCriado = await waitForPerfil(signUpData.user.id)
      if (!perfilCriado) {
        throw new Error('Usuário criado no Auth, mas perfil não ficou disponível a tempo.')
      }

      const { error: updErr } = await supabase
        .from('sys_perfis')
        .update({
          nome,
          email: loginEmail,
          role,
          papel_global,
          alcada_nivel,
          modulos,
          senha_definida: true,
          ativo: true,
        })
        .eq('id', perfilCriado.id)

      if (updErr) throw updErr
      await syncPerfilSetores(perfilCriado.id, modulos)

      return {
        nome,
        username: finalUsername,
        login_email: loginEmail,
        senha_temporaria: senhaTemporaria,
        email_contato,
        whatsapp,
      } satisfies CadastroResult
    },
  })
}

// ── Expanded User Detail + Inline Edit ────────────────────────────────────────
function UserDetailPanel({
  user, onClose, forceEdit = false,
}: { user: Perfil; onClose: () => void; forceEdit?: boolean }) {
  const update = useUpdateUser()
  const changePwd = useChangePassword()
  const [editing, setEditing] = useState(false)
  const [papelGlobal, setPapelGlobal] = useState<PapelGlobal>(resolvePapelFromPerfil(user))
  const [alcada,  setAlcada]  = useState(user.alcada_nivel)
  const [ativo,   setAtivo]   = useState(user.ativo)
  const [altProxLogin, setAltProxLogin] = useState(user.alterar_senha_proximo_login ?? false)
  const [modulos, setModulos] = useState<Record<string, boolean>>(user.modulos ?? {})
  const [permEspeciais, setPermEspeciais] = useState<Record<string, any>>(user.permissoes_especiais ?? {})
  const [moduloPapeis, setModuloPapeis] = useState<Record<string, PapelGlobal>>(
    extractModuloPapeis(user.permissoes_especiais as Record<string, any>)
  )
  const [novaSenha,    setNovaSenha]    = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [showSenha,    setShowSenha]    = useState(false)
  const [senhaError,   setSenhaError]   = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (forceEdit) setEditing(true)
  }, [forceEdit])

  const toggleMod = (key: string) =>
    setModulos(m => ({ ...m, [key]: !m[key] }))

  const setPapelModulo = (modulo: string, papel: PapelGlobal | '') => {
    setModuloPapeis(prev => {
      const next = { ...prev }
      if (!papel || papel === 'requisitante') delete next[modulo]
      else next[modulo] = papel
      return next
    })
  }

  const handleSave = async () => {
    setSenhaError('')
    if (novaSenha) {
      if (novaSenha.length < 6) {
        setSenhaError('A senha deve ter pelo menos 6 caracteres')
        return
      }
      if (novaSenha !== confirmSenha) {
        setSenhaError('As senhas não coincidem')
        return
      }
      await changePwd.mutateAsync({ auth_id: user.auth_id, password: novaSenha })
    }
    await update.mutateAsync({
      id: user.id,
      role: mapPapelToLegacyRole(papelGlobal),
      papel_global: papelGlobal,
      alcada_nivel: alcada,
      ativo,
      alterar_senha_proximo_login: altProxLogin,
      modulos,
      permissoes_especiais: applyModuloPapeisOnPermissoes(permEspeciais, moduloPapeis),
    })
    setSuccess(true)
    setTimeout(() => { setSuccess(false); setEditing(false) }, 1200)
  }

  const handleCancel = () => {
    setPapelGlobal(resolvePapelFromPerfil(user))
    setAlcada(user.alcada_nivel)
    setAtivo(user.ativo)
    setAltProxLogin(user.alterar_senha_proximo_login ?? false)
    setModulos(user.modulos ?? {})
    setPermEspeciais(user.permissoes_especiais ?? {})
    setModuloPapeis(extractModuloPapeis(user.permissoes_especiais as Record<string, any>))
    setNovaSenha('')
    setConfirmSenha('')
    setSenhaError('')
    setEditing(false)
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="border-t border-slate-100 bg-slate-50/50">
      {/* User info section */}
      <div className="px-4 py-4 space-y-3">
        {/* Basic Info Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Mail size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Briefcase size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 truncate">{user.cargo || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Building2 size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 truncate">{user.departamento || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Shield size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600">{ALCADA_LABEL[user.alcada_nivel]}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Desde: </span>
            <span className="text-slate-600">{fmtDate(user.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Acesso: </span>
            <span className="text-slate-600">{fmtDate(user.ultimo_acesso)}</span>
          </div>
        </div>

        {/* Módulos atuais */}
        {!editing && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Módulos ({MODULOS_ERP.filter(m => user.modulos?.[m.key]).length} de {MODULOS_ERP.length})
            </p>
            <div className="flex gap-1 flex-wrap">
              {MODULOS_ERP.map(({ key, label, icon }) => (
                <span key={key} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  user.modulos?.[key]
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 text-slate-300'
                }`}>
                  <span className="text-[9px]">{icon}</span> {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Senha status */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${user.senha_definida ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="text-slate-500">
              {user.senha_definida ? 'Senha definida' : 'Senha pendente (magic link)'}
            </span>
          </div>
          {user.alterar_senha_proximo_login && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-orange-600 font-medium">Redefinição de senha pendente no próximo login</span>
            </div>
          )}
        </div>
      </div>

      {/* Action bar or Edit form */}
      {!editing ? (
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => setEditing(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-indigo-500 active:scale-[0.98] transition-all">
            <Edit3 size={12} /> Editar Permissões
          </button>
          <button onClick={async () => {
            await update.mutateAsync({ id: user.id, ativo: !user.ativo })
          }}
            disabled={update.isPending}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all
              ${user.ativo
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}>
            <Power size={12} /> {user.ativo ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
          {/* Role */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Perfil de Acesso
            </label>
            <div className="flex flex-wrap gap-2">
              {PAPEIS.map(r => (
                <button key={r.value}
                  onClick={() => setPapelGlobal(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    papelGlobal === r.value ? r.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alçada */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Alçada de Aprovação
            </label>
            <div className="grid grid-cols-1 gap-1">
              {([0, 1, 2, 3, 4] as const).map(n => (
                <button key={n} onClick={() => setAlcada(n)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all
                    ${alcada === n ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}>
                  <Shield size={12} />
                  <span className="text-xs font-semibold">{ALCADA_LABEL[n]}</span>
                  {alcada === n && <Check size={12} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Módulos */}
          <ModuloCheckboxGroup
            modulos={modulos}
            onToggle={toggleMod}
            onSetAll={(keys, val) => setModulos(m => {
              const next = { ...m }
              keys.forEach(k => { next[k] = val })
              return next
            })}
          />

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Papel por modulo
            </label>
            <ModuloPapelEditor
              modulos={modulos}
              moduloPapeis={moduloPapeis}
              onChange={setPapelModulo}
            />
            <p className="text-[10px] text-slate-400">
              Se nao definir, o modulo fica como Requisitante.
            </p>
          </div>

          {/* ── Permissões Especiais ─────────────────────────────────── */}
          {modulos?.contratos && mapPapelToLegacyRole(papelGlobal) !== 'administrador' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Permissões Contratos</label>
              <div className="grid grid-cols-2 gap-2">
                {GRUPO_CONTRATO_OPTIONS.map(g => (
                  <label key={g.value} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permEspeciais?.contratos?.grupos_permitidos?.includes(g.value) ?? false}
                      onChange={e => {
                        const current = permEspeciais?.contratos?.grupos_permitidos ?? []
                        const updated = e.target.checked
                          ? [...current, g.value]
                          : current.filter((v: string) => v !== g.value)
                        setPermEspeciais({
                          ...permEspeciais,
                          contratos: { ...permEspeciais?.contratos, grupos_permitidos: updated }
                        })
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {g.label}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">Se nenhum grupo selecionado, acessa todos</p>
            </div>
          )}

          {/* Senha */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Alterar Senha <span className="normal-case font-normal text-slate-400">(deixe em branco para manter)</span>
            </label>
            <div className="relative">
              <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => { setNovaSenha(e.target.value); setSenhaError('') }}
                placeholder="Nova senha"
                className="w-full pl-8 pr-9 py-2 rounded-xl border border-slate-200 text-xs
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
              />
              <button type="button" onClick={() => setShowSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showSenha ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            {novaSenha && (
              <div className="relative">
                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={confirmSenha}
                  onChange={e => { setConfirmSenha(e.target.value); setSenhaError('') }}
                  placeholder="Confirmar nova senha"
                  className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-xs
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
                />
              </div>
            )}
            {senhaError && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs">
                <AlertCircle size={11} /> {senhaError}
              </div>
            )}
          </div>

          {/* Checkboxes: ativo + alterar senha próximo login */}
          <div className="space-y-2 bg-white rounded-xl px-4 py-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ativo}
                onChange={e => setAtivo(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer"
              />
              <div>
                <p className="text-xs font-semibold text-navy">Conta ativa</p>
                <p className="text-[10px] text-slate-400">Usuário pode fazer login</p>
              </div>
            </label>
            <div className="border-t border-slate-100" />
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={altProxLogin}
                onChange={e => setAltProxLogin(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400/30 cursor-pointer"
              />
              <div>
                <p className="text-xs font-semibold text-navy">Alterar senha no próximo login</p>
                <p className="text-[10px] text-slate-400">Usuário será obrigado a redefinir a senha</p>
              </div>
            </label>
          </div>

          {/* Error */}
          {(update.isError || changePwd.isError) && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
              <AlertCircle size={12} />
              {changePwd.isError ? (changePwd.error as Error)?.message : 'Erro ao salvar. Tente novamente.'}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={update.isPending || changePwd.isPending || success}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs
                flex items-center justify-center gap-1.5 hover:bg-indigo-500 disabled:opacity-60 transition-all">
              {success
                ? <><CheckCircle size={13} /> Salvo!</>
                : (update.isPending || changePwd.isPending)
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Check size={13} /> Salvar alterações</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal: Cadastrar usuário ──────────────────────────────────────────────────
function CadastroUsuarioModal({ onClose }: { onClose: () => void }) {
  const cadastrar = useCadastrarUsuario()
  const [form, setForm] = useState({
    nome: '',
    username: '',
    email_contato: '',
    whatsapp: '',
    papel_global: 'requisitante' as PapelGlobal,
    alcada_nivel: 0,
    modulos: { compras: true } as Record<string, boolean>,
  })
  const [result, setResult] = useState<CadastroResult | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleMod = (key: string) =>
    setForm(f => ({ ...f, modulos: { ...f.modulos, [key]: !f.modulos[key] } }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const output = await cadastrar.mutateAsync({
      nome: form.nome.trim(),
      username: form.username.trim() || undefined,
      email_contato: form.email_contato.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      papel_global: form.papel_global,
      alcada_nivel: form.alcada_nivel,
      modulos: form.modulos,
    })
    setResult(output)
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(buildCredenciaisMessage(result))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus size={15} className="text-primary" />
            </div>
            <h3 className="font-bold text-navy">Cadastrar Usuário</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <p className="font-bold text-navy">Usuário cadastrado com sucesso!</p>
              <p className="text-sm text-slate-500">Compartilhe os dados de acesso com segurança.</p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-1.5 text-xs">
              <p className="text-slate-600"><span className="font-semibold">Nome:</span> {result.nome}</p>
              <p className="text-slate-600"><span className="font-semibold">Usuário:</span> {result.username}</p>
              <p className="text-slate-600"><span className="font-semibold">Login:</span> {result.login_email}</p>
              <p className="text-slate-600"><span className="font-semibold">Senha temporária:</span> {result.senha_temporaria}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className={`py-2 rounded-xl text-xs font-semibold border ${
                  copied ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {copied ? 'Copiado!' : 'Copiar dados'}
              </button>
              <button
                type="button"
                disabled={!result.email_contato}
                onClick={() => {
                  if (!result.email_contato) return
                  openShareEmail(result.email_contato, buildCredenciaisMessage(result))
                }}
                className="py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                E-mail
              </button>
              <button
                type="button"
                disabled={!result.whatsapp}
                onClick={() => {
                  if (!result.whatsapp) return
                  openShareWhatsApp(result.whatsapp, buildCredenciaisMessage(result))
                }}
                className="py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                WhatsApp
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-indigo-500"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome completo</label>
              <input
                type="text"
                value={form.nome}
                onChange={set('nome')}
                placeholder="Nome completo"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Usuário (opcional)</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: normalizeUsername(e.target.value) }))}
                placeholder="nome.sobrenome"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">Se vazio, o sistema gera automaticamente.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail para compartilhar</label>
                <input
                  type="email"
                  value={form.email_contato}
                  onChange={set('email_contato')}
                  placeholder="opcional"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">WhatsApp para compartilhar</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={set('whatsapp')}
                  placeholder="(xx) xxxxx-xxxx"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Papel (alçada operacional)</label>
              <select
                value={form.papel_global}
                onChange={e => setForm(f => ({ ...f, papel_global: e.target.value as PapelGlobal }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
              >
                {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Alçada */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Alçada de aprovação</label>
              <select
                value={form.alcada_nivel}
                onChange={e => setForm(f => ({ ...f, alcada_nivel: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
              >
                {[0, 1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{ALCADA_LABEL[n]}</option>
                ))}
              </select>
            </div>

            {/* Módulos */}
            <ModuloCheckboxGroup
              modulos={form.modulos}
              onToggle={toggleMod}
              onSetAll={(keys, val) => setForm(f => {
                const next = { ...f.modulos }
                keys.forEach(k => { next[k] = val })
                return { ...f, modulos: next }
              })}
            />

            {cadastrar.isError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
                <AlertCircle size={13} className="mt-0.5" />
                <span>{cadastrar.error instanceof Error ? cadastrar.error.message : 'Erro ao cadastrar usuário.'}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">
                Cancelar
              </button>
              <button type="submit" disabled={cadastrar.isPending || !form.nome.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                  flex items-center justify-center gap-1.5 hover:bg-indigo-500 disabled:opacity-60">
                {cadastrar.isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><UserPlus size={14} /> Cadastrar</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Página Principal ───────────────────────────────────────────────────────────
function BatchEditModal({
  open,
  onClose,
  selectedCount,
  allVisibleSelected,
  onSelectVisible,
  onClear,
  bulkPapel,
  onBulkPapel,
  bulkAlcada,
  onBulkAlcada,
  bulkTouchSetores,
  onBulkTouchSetores,
  bulkModulos,
  bulkModuloPapeis,
  onBulkModuloPapel,
  onToggleModulo,
  onSetAllModulos,
  onApply,
  isPending,
  errorMessage,
}: {
  open: boolean
  onClose: () => void
  selectedCount: number
  allVisibleSelected: boolean
  onSelectVisible: () => void
  onClear: () => void
  bulkPapel: PapelGlobal | ''
  onBulkPapel: (value: PapelGlobal | '') => void
  bulkAlcada: number | ''
  onBulkAlcada: (value: number | '') => void
  bulkTouchSetores: boolean
  onBulkTouchSetores: (value: boolean) => void
  bulkModulos: Record<string, boolean>
  bulkModuloPapeis: Record<string, PapelGlobal>
  onBulkModuloPapel: (modulo: string, papel: PapelGlobal | '') => void
  onToggleModulo: (key: string) => void
  onSetAllModulos: (keys: string[], val: boolean) => void
  onApply: () => Promise<void>
  isPending: boolean
  errorMessage: string | null
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-navy text-base">Edição em lote</h3>
            <p className="text-xs text-slate-400 mt-0.5">{selectedCount} usuário(s) selecionado(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onSelectVisible}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Papel</label>
              <select
                value={bulkPapel}
                onChange={e => onBulkPapel(e.target.value as PapelGlobal | '')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Não alterar</option>
                {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Alçada</label>
              <select
                value={bulkAlcada}
                onChange={e => onBulkAlcada(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Não alterar</option>
                {[0, 1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{ALCADA_LABEL[n]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkTouchSetores}
                onChange={e => onBulkTouchSetores(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              Aplicar alterações em áreas/módulos
            </label>
            <div className={`rounded-xl border border-slate-100 p-2.5 space-y-3 transition-all ${bulkTouchSetores ? 'bg-slate-50/60' : 'bg-slate-50/30'}`}>
              <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                <ModuloCheckboxGroup
                  modulos={bulkModulos}
                  onToggle={onToggleModulo}
                  onSetAll={onSetAllModulos}
                  disabled={!bulkTouchSetores}
                />
              </div>
              <div className="rounded-lg border border-slate-100 bg-white p-2.5 space-y-2">
                <label className="text-[11px] font-semibold text-slate-500">Papel no módulo</label>
                <ModuloPapelEditor
                  modulos={bulkModulos}
                  moduloPapeis={bulkModuloPapeis}
                  onChange={onBulkModuloPapel}
                  disabled={!bulkTouchSetores}
                />
                <p className="text-[10px] text-slate-400">Não definido = Requisitante.</p>
              </div>
              {!bulkTouchSetores && (
                <p className="text-[11px] text-slate-500">
                  Ative a opção acima para aplicar alterações de módulos e papel por módulo.
                </p>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
              <AlertCircle size={12} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || selectedCount === 0}
              onClick={onApply}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              {isPending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check size={13} /> Aplicar em {selectedCount} usuário(s)</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsuarios() {
  const navigate = useNavigate()
  const { data: perfis, isLoading, refetch, isFetching } = usePerfis()
  const bulkUpdate = useBulkUpdateUsers()

  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState<Role | 'todos'>('todos')
  const [filterAtivo,  setFilterAtivo]  = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [filterAlcada, setFilterAlcada] = useState<number | 'todos'>('todos')
  const [filterModulo, setFilterModulo] = useState<string | 'todos'>('todos')
  const [filterModuloPapel, setFilterModuloPapel] = useState<PapelGlobal | 'todos'>('todos')
  const [showFilters,  setShowFilters]  = useState(false)
  const [viewMode,     setViewMode]     = useState<'table' | 'cards'>('table')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [quickEditUserId, setQuickEditUserId] = useState<string | null>(null)
  const [showCadastro, setShowCadastro] = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])
  const [bulkPapel, setBulkPapel] = useState<PapelGlobal | ''>('')
  const [bulkAlcada, setBulkAlcada] = useState<number | ''>('')
  const [bulkTouchSetores, setBulkTouchSetores] = useState(false)
  const [bulkModulos, setBulkModulos] = useState<Record<string, boolean>>(() => createEmptyModulosMap())
  const [bulkModuloPapeis, setBulkModuloPapeis] = useState<Record<string, PapelGlobal>>({})
  const [showBatchEditor, setShowBatchEditor] = useState(false)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    if (!perfis) return []
    return perfis.filter(p => {
      const papel = resolvePapelFromPerfil(p)
      const moduloPapeis = extractModuloPapeis(p.permissoes_especiais as Record<string, any> | undefined)
      const matchSearch = !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())
      const matchRole = filterRole === 'todos' || papel === filterRole
      const matchAtivo =
        filterAtivo === 'todos'
          ? true
          : filterAtivo === 'ativos'
            ? p.ativo
            : !p.ativo
      const matchAlcada = filterAlcada === 'todos' || p.alcada_nivel === filterAlcada
      const matchModulo = filterModulo === 'todos' || Boolean(p.modulos?.[filterModulo])
      const matchModuloPapel = filterModuloPapel === 'todos'
        ? true
        : (
            filterModulo !== 'todos'
            && Boolean(p.modulos?.[filterModulo])
            && resolvePapelByModulo(filterModulo, moduloPapeis) === filterModuloPapel
          )
      return matchSearch && matchRole && matchAtivo && matchAlcada && matchModulo && matchModuloPapel
    })
  }, [perfis, search, filterRole, filterAtivo, filterAlcada, filterModulo, filterModuloPapel])

  const stats = useMemo(() => {
    if (!perfis) return {}
    return perfis.reduce((acc, p) => {
      const papel = resolvePapelFromPerfil(p)
      acc[papel] = (acc[papel] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [perfis])

  const toggleExpand = (id: string) =>
    setExpandedUser(prev => {
      const next = prev === id ? null : id
      if (next !== quickEditUserId) setQuickEditUserId(null)
      return next
    })

  const selectedVisibleCount = useMemo(
    () => filtered.filter(user => selectedIds.includes(user.id)).length,
    [filtered, selectedIds]
  )
  const allVisibleSelected = filtered.length > 0 && selectedVisibleCount === filtered.length
  const hasPartialVisibleSelection = selectedVisibleCount > 0 && !allVisibleSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartialVisibleSelection
    }
  }, [hasPartialVisibleSelection])

  useEffect(() => {
    if (!perfis) return
    const validIds = new Set(perfis.map(p => p.id))
    setSelectedIds(prev => prev.filter(id => validIds.has(id)))
  }, [perfis])

  useEffect(() => {
    if (!bulkTouchSetores) {
      setBulkModuloPapeis({})
    }
  }, [bulkTouchSetores])

  useEffect(() => {
    if (filterModulo === 'todos' && filterModuloPapel !== 'todos') {
      setFilterModuloPapel('todos')
    }
  }, [filterModulo, filterModuloPapel])

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ))
  }

  const toggleSelectAllVisible = () => {
    const visibleIds = filtered.map(p => p.id)
    setSelectedIds(prev => {
      if (allVisibleSelected) {
        return prev.filter(id => !visibleIds.includes(id))
      }
      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }

  const clearBatch = () => {
    setSelectedIds([])
    setBulkPapel('')
    setBulkAlcada('')
    setBulkTouchSetores(false)
    setBulkModulos(createEmptyModulosMap())
    setBulkModuloPapeis({})
  }

  const handleToolbarEdit = () => {
    if (selectedIds.length === 1) {
      const [id] = selectedIds
      setShowBatchEditor(false)
      setViewMode('cards')
      setExpandedUser(id)
      setQuickEditUserId(id)
      return
    }
    setQuickEditUserId(null)
    setShowBatchEditor(v => !v)
  }

  const applyBatch = async () => {
    await bulkUpdate.mutateAsync({
      ids: selectedIds,
      papel_global: bulkPapel || undefined,
      alcada_nivel: typeof bulkAlcada === 'number' ? bulkAlcada : undefined,
      modulos: bulkTouchSetores ? bulkModulos : undefined,
      modulo_papeis: bulkTouchSetores && Object.keys(bulkModuloPapeis).length ? bulkModuloPapeis : undefined,
    })
    setExpandedUser(null)
    setQuickEditUserId(null)
    setShowBatchEditor(false)
    clearBatch()
  }

  return (
    <>
      {showCadastro && <CadastroUsuarioModal onClose={() => { setShowCadastro(false); refetch() }} />}
      {showBatchEditor && (
        <BatchEditModal
          open={showBatchEditor}
          onClose={() => setShowBatchEditor(false)}
          selectedCount={selectedIds.length}
          allVisibleSelected={allVisibleSelected}
          onSelectVisible={toggleSelectAllVisible}
          onClear={clearBatch}
          bulkPapel={bulkPapel}
          onBulkPapel={setBulkPapel}
          bulkAlcada={bulkAlcada}
          onBulkAlcada={setBulkAlcada}
          bulkTouchSetores={bulkTouchSetores}
          onBulkTouchSetores={setBulkTouchSetores}
          bulkModulos={bulkModulos}
          bulkModuloPapeis={bulkModuloPapeis}
          onBulkModuloPapel={(modulo, papel) => {
            setBulkModuloPapeis(prev => {
              const next = { ...prev }
              if (!papel || papel === 'requisitante') delete next[modulo]
              else next[modulo] = papel
              return next
            })
          }}
          onToggleModulo={key => setBulkModulos(prev => {
            const enabled = !prev[key]
            if (!enabled) {
              setBulkModuloPapeis(prevPapeis => {
                if (!(key in prevPapeis)) return prevPapeis
                const nextPapeis = { ...prevPapeis }
                delete nextPapeis[key]
                return nextPapeis
              })
            }
            return { ...prev, [key]: enabled }
          })}
          onSetAllModulos={(keys, val) => {
            setBulkModulos(prev => {
              const next = { ...prev }
              keys.forEach(k => { next[k] = val })
              return next
            })
            if (!val) {
              setBulkModuloPapeis(prevPapeis => {
                const nextPapeis = { ...prevPapeis }
                keys.forEach(k => { delete nextPapeis[k] })
                return nextPapeis
              })
            }
          }}
          onApply={applyBatch}
          isPending={bulkUpdate.isPending}
          errorMessage={bulkUpdate.error instanceof Error ? bulkUpdate.error.message : (bulkUpdate.isError ? 'Erro ao editar em lote.' : null)}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/perfil')}
            className="w-8 h-8 rounded-lg bg-white shadow-card flex items-center justify-center text-slate-500 hover:text-navy">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-navy leading-tight">Usuários</h1>
            <p className="text-xs text-slate-400">{perfis?.length ?? 0} contas · {perfis?.filter(p => p.ativo).length ?? 0} ativas</p>
          </div>
          <button
            onClick={() => refetch()}
            className={`w-8 h-8 rounded-lg bg-white shadow-card flex items-center justify-center text-slate-400 hover:text-primary ${isFetching ? 'animate-spin' : ''}`}>
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowCadastro(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg hover:bg-indigo-500 active:scale-95 transition-all">
            <UserPlus size={14} /> Cadastrar
          </button>
        </div>

        {/* Stats de roles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['requisitante', 'equipe', 'supervisor', 'diretor', 'ceo'] as Role[]).map(r => {
            const c = ROLE_COLOR[r]
            return (
              <div key={r} className={`rounded-xl p-3 ${c.bg}`}>
                <p className={`text-xl font-black ${c.text}`}>{stats[r] ?? 0}</p>
                <p className={`text-xs font-semibold ${c.text} opacity-80`}>{getRoleLabel(r)}</p>
              </div>
            )
          })}
        </div>

        {/* Toolbar + filtros */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                showFilters
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filtros
            </button>

            <div className="inline-flex rounded-xl border overflow-hidden border-slate-200 bg-white">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 transition-colors ${viewMode === 'cards' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                title="Visualização em cards"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                title="Visualização em tabela"
              >
                <LayoutList size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleToolbarEdit}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showBatchEditor && selectedIds.length !== 1
                  ? 'bg-primary text-white border-primary shadow'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary'
              }`}
            >
              <Edit3 size={12} />
              Editar
            </button>
          </div>

          <div className="flex items-center justify-end">
            <span className="text-xs text-slate-500">{selectedIds.length} selecionado(s)</span>
          </div>

          {showFilters && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-card">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Papel</label>
                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value as Role | 'todos')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="todos">Todos</option>
                    {(['requisitante', 'equipe', 'supervisor', 'diretor', 'ceo'] as Role[]).map(r => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
                  <select
                    value={filterAtivo}
                    onChange={e => setFilterAtivo(e.target.value as 'todos' | 'ativos' | 'inativos')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="todos">Todos</option>
                    <option value="ativos">Ativos</option>
                    <option value="inativos">Inativos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Alçada</label>
                  <select
                    value={filterAlcada}
                    onChange={e => setFilterAlcada(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="todos">Todas</option>
                    {[0, 1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{ALCADA_LABEL[n]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Módulo</label>
                  <select
                    value={filterModulo}
                    onChange={e => setFilterModulo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="todos">Todos</option>
                    {MODULOS_ERP.map(mod => (
                      <option key={mod.key} value={mod.key}>{mod.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Papel no módulo</label>
                  <select
                    value={filterModuloPapel}
                    disabled={filterModulo === 'todos'}
                    onChange={e => setFilterModuloPapel(e.target.value as PapelGlobal | 'todos')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="todos">Todos</option>
                    {PAPEIS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterRole('todos')
                    setFilterAtivo('todos')
                    setFilterAlcada('todos')
                    setFilterModulo('todos')
                    setFilterModuloPapel('todos')
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {false && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 space-y-3 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">Edicao em lote</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {allVisibleSelected ? 'Desmarcar visiveis' : 'Selecionar visiveis'}
                </button>
                <button
                  type="button"
                  onClick={clearBatch}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchEditor(false)}
                  className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center"
                  aria-label="Fechar edicao em lote"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Papel</label>
                <select
                  value={bulkPapel}
                  onChange={e => setBulkPapel(e.target.value as PapelGlobal | '')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Nao alterar</option>
                  {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Alcada</label>
                <select
                  value={bulkAlcada}
                  onChange={e => setBulkAlcada(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Nao alterar</option>
                  {[0, 1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{ALCADA_LABEL[n]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkTouchSetores}
                  onChange={e => setBulkTouchSetores(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                Alterar setores/modulos em lote
              </label>
              {bulkTouchSetores && (
                <div className="rounded-xl border border-slate-100 p-2.5 bg-slate-50/60">
                  <ModuloCheckboxGroup
                    modulos={bulkModulos}
                    onToggle={key => setBulkModulos(prev => ({ ...prev, [key]: !prev[key] }))}
                    onSetAll={(keys, val) => setBulkModulos(prev => {
                      const next = { ...prev }
                      keys.forEach(k => { next[k] = val })
                      return next
                    })}
                  />
                </div>
              )}
            </div>

            {bulkUpdate.isError && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
                <AlertCircle size={12} />
                <span>{bulkUpdate.error instanceof Error ? bulkUpdate.error.message : 'Falha ao aplicar alteracoes em lote.'}</span>
              </div>
            )}

            <button
              type="button"
              disabled={bulkUpdate.isPending || selectedIds.length === 0}
              onClick={applyBatch}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              {bulkUpdate.isPending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check size={13} /> Aplicar em {selectedIds.length} usuario(s)</>}
            </button>
          </div>
        )}

        {/* Lista de usuários */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum usuário encontrado</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3 w-10">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                    </th>
                    <th className="px-3 py-3">Usuario</th>
                    <th className="px-3 py-3">Login</th>
                    <th className="px-3 py-3">Papel</th>
                    <th className="px-3 py-3">Alcada</th>
                    <th className="px-3 py-3">Setores</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const isSelected = selectedIds.includes(p.id)
                    const enabledModules = Object.values(p.modulos ?? {}).filter(Boolean).length
                    const displayPapel = resolvePapelFromPerfil(p) as Role
                    return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p.id)}
                            className="rounded border-slate-300 text-primary focus:ring-primary/30"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar nome={p.nome} size="sm" />
                            <p className="font-semibold text-navy max-w-[220px] truncate">{p.nome}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-500">{p.email}</td>
                        <td className="px-3 py-3">
                          <RoleBadge role={displayPapel} />
                        </td>
                        <td className="px-3 py-3 text-slate-600 text-xs">{ALCADA_LABEL[p.alcada_nivel]}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{enabledModules} modulo(s)</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            p.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${p.ativo ? 'bg-green-500' : 'bg-red-500'}`} />
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickEditUserId(null)
                              setViewMode('cards')
                              setExpandedUser(p.id)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
                          >
                            <Edit3 size={12} className="opacity-80" />
                            Editar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => {
              const isExpanded = expandedUser === p.id
              const isSelected = selectedIds.includes(p.id)
              const displayPapel = resolvePapelFromPerfil(p) as Role
              return (
                <div key={p.id} className={`bg-white rounded-2xl shadow-card overflow-hidden transition-all ${!p.ativo ? 'opacity-60' : ''}`}>
                  {/* Card header - clickable */}
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        e.stopPropagation()
                        toggleSelectOne(p.id)
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    <Avatar nome={p.nome} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-navy truncate">{p.nome}</p>
                        {!p.ativo && <span className="text-[10px] bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">Inativo</span>}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{p.email.split('@')[0]}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <RoleBadge role={displayPapel} />
                        {p.alcada_nivel > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-navy/10 text-navy text-[10px] font-semibold">
                            <Shield size={9} /> N{p.alcada_nivel}
                          </span>
                        )}
                        {p.modulos && (
                          <span className="text-[10px] text-slate-400">
                            {Object.values(p.modulos).filter(Boolean).length} módulos
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isExpanded ? 'bg-primary/10 text-primary' : 'text-slate-300'
                    }`}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <UserDetailPanel
                      user={p}
                      forceEdit={quickEditUserId === p.id}
                      onClose={() => {
                        setExpandedUser(null)
                        setQuickEditUserId(null)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

