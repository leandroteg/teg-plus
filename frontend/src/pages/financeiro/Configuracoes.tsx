import { useState, useEffect } from 'react'
import {
  Settings, Key, Link, RefreshCw, CheckCircle2, XCircle,
  Eye, EyeOff, Save, Zap, AlertTriangle, Clock, Wifi,
  Building2, DollarSign, ArrowDownUp, FlaskConical, ShieldCheck,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useOmieConfig,
  useSaveOmieConfig,
  useTriggerSync,
  useTestOmieConnection,
  useLastSync,
  type OmieConfig,
  type SyncLog as OmieSyncLog,
} from '../../hooks/useOmie'
import {
  useOmieCredentials,
  useOmieTestarConexao,
  useOmieSyncContasPagar,
  useOmieAtualizarRemessas,
} from '../../hooks/useOmieApi'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(date: string | null | undefined) {
  if (!date) return 'Nunca sincronizado'
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// ── SyncRow ──────────────────────────────────────────────────────────────────

interface SyncRowProps {
  label: string
  dominio: string
  webhookUrl: string
  log: OmieSyncLog | null | undefined
  isLoadingLog: boolean
  isDark: boolean
}

function SyncRow({ label, dominio, webhookUrl, log, isLoadingLog, isDark }: SyncRowProps) {
  const trigger = useTriggerSync(dominio)

  function handleSync() {
    if (!webhookUrl) return
    trigger.mutate({ webhookUrl })
  }

  const status = log?.status
  const isPending = trigger.isPending || status === 'running'

  return (
    <div className={`flex items-center gap-3 py-3 border-b last:border-0 ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
      {/* Domain name */}
      <div className="w-36 shrink-0">
        <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
      </div>

      {/* Last sync */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Clock size={10} className="shrink-0" />
          {isLoadingLog ? '...' : fmtDate(log?.executado_em)}
        </p>
      </div>

      {/* Records */}
      <div className="w-20 text-center">
        <p className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {log?.registros != null ? log.registros.toLocaleString('pt-BR') : '–'}
        </p>
        <p className="text-[9px] text-slate-400">registros</p>
      </div>

      {/* Status badge */}
      <div className="w-24 flex justify-center">
        {!log && !isLoadingLog ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
            rounded-full bg-slate-100 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Pendente
          </span>
        ) : status === 'running' || isPending ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
            rounded-full bg-blue-50 text-blue-700">
            <RefreshCw size={9} className="animate-spin" />
            Rodando
          </span>
        ) : status === 'success' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
            rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={9} />
            OK
          </span>
        ) : status === 'error' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
            rounded-full bg-red-50 text-red-700" title={log?.mensagem ?? ''}>
            <XCircle size={9} />
            Erro
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
            rounded-full bg-slate-100 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            –
          </span>
        )}
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={isPending || !webhookUrl}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold
          bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
        <RefreshCw size={11} className={isPending ? 'animate-spin' : ''} />
        {isPending ? 'Aguarde' : 'Sincronizar'}
      </button>
    </div>
  )
}

// ── SYNC DOMAINS ─────────────────────────────────────────────────────────────

const SYNC_DOMAINS = [
  { label: 'Fornecedores',     dominio: 'fornecedores'   },
  { label: 'Contas a Pagar',   dominio: 'contas_pagar'   },
  { label: 'Contas a Receber', dominio: 'contas_receber' },
]

// ── SyncSection ───────────────────────────────────────────────────────────────

function SyncSection({ webhookUrl, isDark }: { webhookUrl: string; isDark: boolean }) {
  const fornLog  = useLastSync('fornecedores')
  const pagarLog = useLastSync('contas_pagar')
  const receberLog = useLastSync('contas_receber')

  const logs = [fornLog, pagarLog, receberLog]

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <RefreshCw size={16} className="text-emerald-600" />
        <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Sincronização</h2>
      </div>

      <div className="px-5">
        {SYNC_DOMAINS.map((item, idx) => (
          <SyncRow
            key={item.dominio}
            label={item.label}
            dominio={item.dominio}
            webhookUrl={webhookUrl}
            log={logs[idx].data}
            isLoadingLog={logs[idx].isLoading}
            isDark={isDark}
          />
        ))}
      </div>

      {!webhookUrl && (
        <div className={`mx-5 mb-4 mt-1 flex items-center gap-2 border rounded-xl px-3 py-2
          ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-700">
            Configure a URL do webhook n8n para habilitar a sincronização.
          </p>
        </div>
      )}
    </div>
  )
}

// ── OmieApiDireta section ─────────────────────────────────────────────────────

function OmieApiDiretaSection({ isDark }: { isDark: boolean }) {
  const { data: result, isLoading } = useOmieCredentials()
  const credentials = result?.credentials ?? null
  const isSandbox   = result?.isSandbox ?? false

  const testar = useOmieTestarConexao()
  const syncCP = useOmieSyncContasPagar()
  const atualizarRemessas = useOmieAtualizarRemessas()

  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [remessaResult, setRemessaResult] = useState<string | null>(null)

  async function handleTestar() {
    if (!credentials) return
    setTestResult(null)
    try {
      await testar.mutateAsync(credentials)
      setTestResult({ ok: true, msg: `API Omie respondeu com sucesso${isSandbox ? ' (Sandbox)' : ''}` })
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Falha na conexão' })
    }
  }

  async function handleSyncCP() {
    if (!credentials) return
    setSyncResult(null)
    try {
      const res = await syncCP.mutateAsync(credentials)
      setSyncResult(`${res.novas} novas, ${res.atualizadas} atualizadas, ${res.erros} erros (total ${res.total})`)
    } catch (err) {
      setSyncResult(`Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`)
    }
  }

  async function handleAtualizarRemessas() {
    if (!credentials) return
    setRemessaResult(null)
    try {
      const res = await atualizarRemessas.mutateAsync({ credentials })
      const confirmadas = res.filter(r => r.novoStatus === 'pago').length
      setRemessaResult(`${res.length} remessa(s) verificada(s), ${confirmadas} confirmada(s) como pago`)
    } catch (err) {
      setRemessaResult(`Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`)
    }
  }

  const row = `flex items-center gap-3 py-3 border-b last:border-0 ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`
  const btnPrimary = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0'
  const card = `rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`

  return (
    <div className={card}>
      <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <Wifi size={16} className="text-emerald-600" />
        <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>API Omie — Integração Direta</h2>
        <div className="ml-auto flex items-center gap-2">
          {isSandbox && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              SANDBOX
            </span>
          )}
          {credentials ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Conectado
            </span>
          ) : !isLoading ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Não configurado
            </span>
          ) : null}
        </div>
      </div>

      {/* Sandbox warning banner */}
      {isSandbox && credentials && (
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-700">Modo Sandbox ativo</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Usando credenciais de homologação Omie. Nenhuma operação afetará dados de produção.
              Para criar uma aplicação de teste, acesse{' '}
              <a href="https://app.omie.com.br" target="_blank" rel="noopener noreferrer" className="underline">app.omie.com.br</a>
              {' '}→ Minhas Aplicações → + Nova Aplicação → Testar grátis.
            </p>
          </div>
        </div>
      )}

      {!credentials && !isLoading ? (
        <div className="px-5 py-4">
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Configure APP_KEY e APP_SECRET na seção acima e habilite a integração Omie.
          </p>
        </div>
      ) : (
        <div className="px-5">
          {/* Testar conexão */}
          <div className={row}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-emerald-600" />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Testar Conexão</p>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Valida {isSandbox ? 'credenciais sandbox' : 'APP_KEY e APP_SECRET'} diretamente na API Omie
              </p>
              {testResult && (
                <p className={`text-xs mt-1 font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {testResult.ok ? '✓' : '✗'} {testResult.msg}
                </p>
              )}
            </div>
            <button onClick={handleTestar} disabled={testar.isPending || !credentials} className={btnPrimary}>
              {testar.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
              {testar.isPending ? 'Testando...' : 'Testar'}
            </button>
          </div>

          {/* Sync Contas a Pagar */}
          <div className={row}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <DollarSign size={13} className="text-blue-500" />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Importar CPs do Omie</p>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Importa contas a pagar em aberto do Omie para o TEG+</p>
              {syncResult && (
                <p className={`text-xs mt-1 font-medium ${syncResult.startsWith('Erro') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {syncResult}
                </p>
              )}
            </div>
            <button onClick={handleSyncCP} disabled={syncCP.isPending || !credentials} className={btnPrimary}>
              {syncCP.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Building2 size={11} />}
              {syncCP.isPending ? 'Importando...' : 'Importar'}
            </button>
          </div>

          {/* Atualizar remessas */}
          <div className={row}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ArrowDownUp size={13} className="text-indigo-500" />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Atualizar Status de Remessas</p>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Consulta Omie e atualiza pagamentos enviados (enviada → pago/cancelado)</p>
              {remessaResult && (
                <p className={`text-xs mt-1 font-medium ${remessaResult.startsWith('Erro') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {remessaResult}
                </p>
              )}
            </div>
            <button onClick={handleAtualizarRemessas} disabled={atualizarRemessas.isPending || !credentials} className={btnPrimary}>
              {atualizarRemessas.isPending ? <RefreshCw size={11} className="animate-spin" /> : <ArrowDownUp size={11} />}
              {atualizarRemessas.isPending ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const { isDark } = useTheme()
  const { isAdmin } = useAuth()
  const { data: config, isLoading: isLoadingConfig } = useOmieConfig()
  const saveConfig     = useSaveOmieConfig()
  const testConnection = useTestOmieConnection()

  const [form, setForm] = useState<OmieConfig>({
    omie_app_key: '',
    omie_app_secret: '',
    n8n_webhook_url: '',
    omie_enabled: 'false',
    cp_remessa_webhook_url: '',
    cp_remessa_status_webhook_url: '',
    omie_sandbox_mode: 'false',
    omie_sandbox_app_key: '',
    omie_sandbox_app_secret: '',
  })

  const [showKey, setShowKey]               = useState(false)
  const [showSecret, setShowSecret]         = useState(false)
  const [showSandboxKey, setShowSandboxKey] = useState(false)
  const [showSandboxSec, setShowSandboxSec] = useState(false)
  const [testStatus, setTestStatus]   = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setForm({
        omie_app_key:    config.omie_app_key    ?? '',
        omie_app_secret: config.omie_app_secret ?? '',
        n8n_webhook_url: config.n8n_webhook_url ?? '',
        omie_enabled:    config.omie_enabled    ?? 'false',
        cp_remessa_webhook_url:        config.cp_remessa_webhook_url        ?? '',
        cp_remessa_status_webhook_url: config.cp_remessa_status_webhook_url ?? '',
        omie_sandbox_mode:       config.omie_sandbox_mode       ?? 'false',
        omie_sandbox_app_key:    config.omie_sandbox_app_key    ?? '',
        omie_sandbox_app_secret: config.omie_sandbox_app_secret ?? '',
      })
    }
  }, [config])

  function handleChange(field: keyof OmieConfig, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaveSuccess(false)
    if (testStatus !== 'idle') setTestStatus('idle')
  }

  async function handleSave() {
    try {
      await saveConfig.mutateAsync(form)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveSuccess(false)
    }
  }

  async function handleTest() {
    if (!form.n8n_webhook_url) return
    setTestStatus('testing')
    setTestMessage('')
    try {
      await testConnection.mutateAsync({ webhookUrl: form.n8n_webhook_url })
      setTestStatus('ok')
      setTestMessage('Conexão estabelecida com sucesso.')
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : 'Falha na conexão.')
    }
  }

  const webhookBase = form.n8n_webhook_url.replace(/\/$/, '')

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Settings size={20} className="text-emerald-600" />
          Configurações
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Integração Omie e automações n8n</p>
      </div>

      {/* ── Access restriction ─────────────────────────────── */}
      {!isAdmin && (
        <div className={`border rounded-2xl p-4 flex items-center gap-3 ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-700">Acesso restrito</p>
            <p className="text-xs text-amber-600">
              Apenas administradores podem visualizar e editar as configurações de integração.
            </p>
          </div>
        </div>
      )}

      {/* ── Section 1: Integração Omie ─────────────────────── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <Key size={16} className="text-emerald-600" />
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Integração Omie</h2>
        </div>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">

            {/* Enabled toggle */}
            <div className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Integração habilitada</p>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ativa a sincronização automática com o Omie</p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleChange('omie_enabled', form.omie_enabled === 'true' ? 'false' : 'true')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed
                  ${form.omie_enabled === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
                  ${form.omie_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* ── Seletor de Ambiente ──────────────────────────────── */}
            <div className={`rounded-xl border p-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wide mb-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ambiente Ativo
              </p>
              <div className="flex gap-2">
                {/* Produção */}
                <button
                  disabled={!isAdmin}
                  onClick={() => handleChange('omie_sandbox_mode', 'false')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border
                    disabled:cursor-not-allowed ${
                    form.omie_sandbox_mode !== 'true'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200/60'
                      : isDark
                        ? 'bg-white/[0.02] border-white/[0.08] text-slate-500 hover:border-emerald-500/40 hover:text-emerald-400'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
                  }`}
                >
                  <ShieldCheck size={15} className="shrink-0" />
                  Produção
                </button>
                {/* Teste */}
                <button
                  disabled={!isAdmin}
                  onClick={() => handleChange('omie_sandbox_mode', 'true')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border
                    disabled:cursor-not-allowed ${
                    form.omie_sandbox_mode === 'true'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200/60'
                      : isDark
                        ? 'bg-white/[0.02] border-white/[0.08] text-slate-500 hover:border-amber-500/40 hover:text-amber-400'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  <FlaskConical size={15} className="shrink-0" />
                  Teste
                </button>
              </div>
              {form.omie_sandbox_mode === 'true' && (
                <p className={`text-[11px] mt-2 flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  <AlertTriangle size={11} className="shrink-0" />
                  Modo Teste ativo — operações usam as credenciais de teste e não afetam a produção
                </p>
              )}
            </div>

            {/* ── Credenciais de Produção ──────────────────────────── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-all ${
              form.omie_sandbox_mode !== 'true'
                ? isDark ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-emerald-50/50 border-emerald-200'
                : isDark ? 'bg-white/[0.01] border-white/[0.04] opacity-60' : 'bg-slate-50/50 border-slate-150 opacity-60'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${form.omie_sandbox_mode !== 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <p className={`text-xs font-bold ${form.omie_sandbox_mode !== 'true' ? isDark ? 'text-emerald-400' : 'text-emerald-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Credenciais de Produção
                </p>
                {form.omie_sandbox_mode !== 'true' && (
                  <span className="text-[9px] font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full tracking-wide">ATIVO</span>
                )}
              </div>
              {/* App Key Produção */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  App Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={form.omie_app_key}
                    onChange={e => handleChange('omie_app_key', e.target.value)}
                    disabled={!isAdmin}
                    placeholder="App Key de produção..."
                    className={`w-full pr-10 px-3 py-2 rounded-xl border text-sm placeholder-slate-400 font-mono
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                  <button type="button" onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              {/* App Secret Produção */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  App Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={form.omie_app_secret}
                    onChange={e => handleChange('omie_app_secret', e.target.value)}
                    disabled={!isAdmin}
                    placeholder="App Secret de produção..."
                    className={`w-full pr-10 px-3 py-2 rounded-xl border text-sm placeholder-slate-400 font-mono
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                  <button type="button" onClick={() => setShowSecret(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Credenciais de Teste ─────────────────────────────── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-all ${
              form.omie_sandbox_mode === 'true'
                ? isDark ? 'bg-amber-500/5 border-amber-500/25' : 'bg-amber-50/50 border-amber-200'
                : isDark ? 'bg-white/[0.01] border-white/[0.04] opacity-60' : 'bg-slate-50/50 border-slate-150 opacity-60'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${form.omie_sandbox_mode === 'true' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <p className={`text-xs font-bold ${form.omie_sandbox_mode === 'true' ? isDark ? 'text-amber-400' : 'text-amber-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Credenciais de Teste
                </p>
                {form.omie_sandbox_mode === 'true' && (
                  <span className="text-[9px] font-extrabold bg-amber-500 text-white px-1.5 py-0.5 rounded-full tracking-wide">ATIVO</span>
                )}
              </div>
              {/* Sandbox App Key */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  App Key
                </label>
                <div className="relative">
                  <input
                    type={showSandboxKey ? 'text' : 'password'}
                    value={form.omie_sandbox_app_key}
                    onChange={e => handleChange('omie_sandbox_app_key', e.target.value)}
                    disabled={!isAdmin}
                    placeholder="App Key da aplicação de teste..."
                    className={`w-full pr-10 px-3 py-2 rounded-xl border text-sm placeholder-slate-400 font-mono
                      focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                  <button type="button" onClick={() => setShowSandboxKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showSandboxKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              {/* Sandbox App Secret */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  App Secret
                </label>
                <div className="relative">
                  <input
                    type={showSandboxSec ? 'text' : 'password'}
                    value={form.omie_sandbox_app_secret}
                    onChange={e => handleChange('omie_sandbox_app_secret', e.target.value)}
                    disabled={!isAdmin}
                    placeholder="App Secret da aplicação de teste..."
                    className={`w-full pr-10 px-3 py-2 rounded-xl border text-sm placeholder-slate-400 font-mono
                      focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                  <button type="button" onClick={() => setShowSandboxSec(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showSandboxSec ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* n8n Webhook URL */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                URL Base do Webhook n8n
              </label>
              <input
                type="text"
                value={form.n8n_webhook_url}
                onChange={e => handleChange('n8n_webhook_url', e.target.value)}
                disabled={!isAdmin}
                placeholder="https://n8n.exemplo.com/webhook/..."
                className={`w-full px-3 py-2.5 rounded-xl border text-sm placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
              />
            </div>

            {/* Test result */}
            {(testStatus === 'ok' || testStatus === 'error') && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium
                ${testStatus === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {testStatus === 'ok'
                  ? <CheckCircle2 size={13} className="shrink-0" />
                  : <XCircle size={13} className="shrink-0" />
                }
                {testMessage}
              </div>
            )}

            {/* Save error */}
            {saveConfig.isError && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium
                bg-red-50 border border-red-200 text-red-700">
                <XCircle size={13} className="shrink-0" />
                {saveConfig.error instanceof Error ? saveConfig.error.message : 'Erro ao salvar.'}
              </div>
            )}

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saveConfig.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white
                    text-[11px] font-bold shadow-sm hover:bg-emerald-700 transition-all
                    disabled:opacity-60 disabled:cursor-not-allowed">
                  {saveConfig.isPending ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <Save size={12} />
                  )}
                  {saveConfig.isPending ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar'}
                </button>

                <button
                  onClick={handleTest}
                  disabled={testConnection.isPending || !form.n8n_webhook_url}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[11px] font-bold
                    transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-300 hover:border-emerald-400 hover:text-emerald-500' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'}`}>
                  {testConnection.isPending
                    ? <RefreshCw size={12} className="animate-spin" />
                    : <Zap size={12} />
                  }
                  {testConnection.isPending ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: API Direta Omie ──────────────────────── */}
      <OmieApiDiretaSection isDark={isDark} />

      {/* ── Section 3: Sincronização n8n ────────────────────── */}
      <SyncSection webhookUrl={form.n8n_webhook_url} isDark={isDark} />

      {/* ── Section 3: Webhooks n8n ─────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <Link size={16} className="text-emerald-600" />
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Webhooks n8n</h2>
        </div>

        <div className="px-5 py-5 space-y-3">
          {!webhookBase ? (
            <p className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Configure a URL base do webhook para ver os endpoints.
            </p>
          ) : (
            <>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Endpoints gerados automaticamente a partir da URL base configurada:
              </p>

              {[
                { label: 'Testar Conexão',         path: '/omie/test',                   method: 'POST' },
                { label: 'Sync Fornecedores',       path: '/omie/sync/fornecedores',      method: 'POST' },
                { label: 'Sync Contas a Pagar',     path: '/omie/sync/contas_pagar',      method: 'POST' },
                { label: 'Sync Contas a Receber',   path: '/omie/sync/contas_receber',    method: 'POST' },
              ].map(({ label, path, method }) => (
                <div key={path} className={`rounded-xl border px-3 py-2.5 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                      {method}
                    </span>
                    <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
                  </div>
                  <p className={`text-[11px] font-mono break-all ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {webhookBase}{path}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

    </div>
  )
}
