import {
  LayoutDashboard, Building2, FolderOpen, ArrowRightFromLine, Plus,
  Loader2, WifiOff, CloudUpload, CheckCircle2, AlertTriangle, X,
} from 'lucide-react'
import { useState } from 'react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'
import NovaSolicitacaoModal from './locacao/NovaSolicitacaoModal'
import { useVistoriaSync } from '../hooks/useVistoriaSync'
import { useTheme } from '../contexts/ThemeContext'

// ── Sync Banner ─────────────────────────────────────────────────────────────

function VistoriaSyncBanner() {
  const { isOnline, syncing, pendingCount, lastResults, syncAll } = useVistoriaSync()
  const { isDark } = useTheme()
  const [dismissed, setDismissed] = useState(false)

  // Nothing to show
  if (pendingCount === 0 && lastResults.length === 0) return null
  if (dismissed && !syncing && pendingCount === 0) return null

  // Syncing animation
  if (syncing) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isDark ? 'bg-indigo-500/15 text-indigo-300 border-b border-indigo-500/20'
               : 'bg-indigo-50 text-indigo-700 border-b border-indigo-200'
      }`}>
        <Loader2 size={16} className="animate-spin shrink-0" />
        <span>Sincronizando vistorias offline...</span>
      </div>
    )
  }

  // Pending vistorias waiting to sync
  if (pendingCount > 0) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isOnline
          ? isDark ? 'bg-amber-500/15 text-amber-300 border-b border-amber-500/20'
                   : 'bg-amber-50 text-amber-700 border-b border-amber-200'
          : isDark ? 'bg-slate-500/15 text-slate-300 border-b border-slate-500/20'
                   : 'bg-slate-100 text-slate-600 border-b border-slate-200'
      }`}>
        {isOnline ? <CloudUpload size={16} className="shrink-0" /> : <WifiOff size={16} className="shrink-0" />}
        <span className="flex-1">
          {pendingCount} vistoria(s) pendente(s) de sincronização
          {!isOnline && ' — aguardando conexão'}
        </span>
        {isOnline && (
          <button
            onClick={() => syncAll()}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              isDark ? 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-200'
                     : 'bg-amber-200 hover:bg-amber-300 text-amber-800'
            }`}
          >
            Sincronizar agora
          </button>
        )}
      </div>
    )
  }

  // Success notification (auto-dismiss after showing)
  const allOk = lastResults.length > 0 && lastResults.every(r => r.success)
  const hasErrors = lastResults.some(r => !r.success)

  if (allOk) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isDark ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/20'
               : 'bg-emerald-50 text-emerald-700 border-b border-emerald-200'
      }`}>
        <CheckCircle2 size={16} className="shrink-0" />
        <span className="flex-1">{lastResults.length} vistoria(s) sincronizada(s) com sucesso!</span>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    )
  }

  if (hasErrors) {
    const failCount = lastResults.filter(r => !r.success).length
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isDark ? 'bg-red-500/15 text-red-300 border-b border-red-500/20'
               : 'bg-red-50 text-red-700 border-b border-red-200'
      }`}>
        <AlertTriangle size={16} className="shrink-0" />
        <span className="flex-1">{failCount} vistoria(s) falharam ao sincronizar</span>
        <button
          onClick={() => syncAll()}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
            isDark ? 'bg-red-500/30 hover:bg-red-500/50 text-red-200'
                   : 'bg-red-200 hover:bg-red-300 text-red-800'
          }`}
        >
          Tentar novamente
        </button>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    )
  }

  return null
}

// ── Layout ──────────────────────────────────────────────────────────────────

export default function LocacaoLayout() {
  const [showModal, setShowModal] = useState(false)

  const NAV: NavItem[] = [
    { to: '/locacoes',              icon: LayoutDashboard,     label: 'Painel',           end: true },
    {
      to: '/locacoes',
      icon: Plus,
      label: 'Nova Solicitação',
      end: false,
      action: () => setShowModal(true),
      accent: true,
    },
    { to: '/locacoes/entradas',     icon: Building2,           label: 'Entradas'          },
    { to: '/locacoes/gestao',       icon: FolderOpen,          label: 'Gestão'            },
    { to: '/locacoes/saida',        icon: ArrowRightFromLine,  label: 'Devoluções'        },
  ]

  return (
    <>
      <VistoriaSyncBanner />
      <ModuleLayout
        moduleKey="locacoes"
        moduleName="Locação Imóveis"
        moduleEmoji="🏘️"
        accent="indigo"
        nav={NAV}
        bottomNavMaxItems={5}
        truncateBottomLabels
      />
      {showModal && <NovaSolicitacaoModal onClose={() => setShowModal(false)} />}
    </>
  )
}
