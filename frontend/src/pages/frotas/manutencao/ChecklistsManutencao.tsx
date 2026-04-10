import { useState } from 'react'
import { ClipboardList, Eye, LayoutGrid, List } from 'lucide-react'
import { useChecklistTemplates, useChecklistExecucoes } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroChecklistTemplate, FroChecklistExecucao, TipoChecklist2 } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const TIPO_LABEL: Record<TipoChecklist2, string> = {
  pre_viagem:         'Pré-Viagem',
  pos_viagem:         'Pós-Viagem',
  entrega_locadora:   'Entrega Locadora',
  devolucao_locadora: 'Devolução Locadora',
  pre_manutencao:     'Pré-Manutenção',
  pos_manutencao:     'Pós-Manutenção',
}

const TIPO_ATIVO_LABEL: Record<string, string> = {
  todos:    'Todos',
  veiculo:  'Veículo',
  maquina:  'Máquina',
}

const STATUS_EXECUCAO_CFG: Record<FroChecklistExecucao['status'], { label: string; cls: string }> = {
  pendente:      { label: 'Pendente',      cls: 'bg-amber-500/15 text-amber-400' },
  em_andamento:  { label: 'Em Andamento',  cls: 'bg-sky-500/15 text-sky-400'     },
  concluido:     { label: 'Concluído',     cls: 'bg-emerald-500/15 text-emerald-400' },
}

const TIPO_CFG: Record<TipoChecklist2, string> = {
  pre_viagem:         'bg-teal-500/15 text-teal-400',
  pos_viagem:         'bg-slate-500/15 text-slate-400',
  entrega_locadora:   'bg-violet-500/15 text-violet-400',
  devolucao_locadora: 'bg-indigo-500/15 text-indigo-400',
  pre_manutencao:     'bg-orange-500/15 text-orange-400',
  pos_manutencao:     'bg-emerald-500/15 text-emerald-400',
}

// ── Modal Ver Itens ───────────────────────────────────────────────────────────
function ItensModal({
  template,
  onClose,
  isLight,
}: {
  template: FroChecklistTemplate
  onClose: () => void
  isLight: boolean
}) {
  const card = !isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
  const divider = !isDark ? 'border-slate-100' : 'border-white/[0.06]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col ${card}`}>
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${divider}`}>
          <div>
            <p className={`text-sm font-extrabold ${!isDark ? 'text-slate-800' : 'text-white'}`}>
              {template.nome}
            </p>
            <p className="text-[10px] text-slate-500">{(template.itens ?? []).length} itens</p>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto styled-scrollbar flex-1 p-4 space-y-1.5">
          {(template.itens ?? [])
            .slice()
            .sort((a, b) => a.ordem - b.ordem)
            .map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-2.5 rounded-xl ${
                  !isDark ? 'bg-slate-50 border border-slate-200' : 'bg-white/4 border border-white/[0.05]'
                }`}
              >
                <span className={`text-[10px] font-bold mt-0.5 w-4 text-right shrink-0 ${!isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {item.ordem}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${!isDark ? 'text-slate-700' : 'text-slate-200'}`}>
                    {item.descricao}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {item.obrigatorio && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                        Obrigatório
                      </span>
                    )}
                    {item.permite_foto && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                        Permite Foto
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({
  template,
  onVerItens,
  isLight,
}: {
  template: FroChecklistTemplate
  onVerItens: (t: FroChecklistTemplate) => void
  isLight: boolean
}) {
  const tipoCls = TIPO_CFG[template.tipo] ?? 'bg-slate-500/15 text-slate-400'
  const tipoAtivoLabel = TIPO_ATIVO_LABEL[template.tipo_ativo] ?? template.tipo_ativo

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-2.5 ${
        !isDark ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/50 border-white/[0.07]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-extrabold leading-tight ${!isDark ? 'text-slate-800' : 'text-white'}`}>
          {template.nome}
        </p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
          !isDark ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
        }`}>
          Ativo
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoCls}`}>
          {TIPO_LABEL[template.tipo]}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          !isDark ? 'bg-slate-100 text-slate-600' : 'bg-white/8 text-slate-400'
        }`}>
          {tipoAtivoLabel}
        </span>
      </div>

      <p className={`text-xs ${!isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {(template.itens ?? []).length} itens de verificação
      </p>

      <button
        onClick={() => onVerItens(template)}
        className={`flex items-center gap-1.5 text-xs font-semibold mt-auto pt-1 transition-colors ${
          !isDark ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'
        }`}
      >
        <Eye size={12} /> Ver Itens
      </button>
    </div>
  )
}

// ── Templates Section ─────────────────────────────────────────────────────────
function Templates({ isLight }: { isLight: boolean }) {
  const { data: templates = [], isLoading } = useChecklistTemplates()
  const [selected, setSelected] = useState<FroChecklistTemplate | null>(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-36 rounded-2xl animate-pulse ${!isDark ? 'bg-slate-100' : 'bg-white/5'}`} />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {templates.map(t => (
          <TemplateCard key={t.id} template={t} onVerItens={setSelected} isLight={isLight} />
        ))}
      </div>
      {templates.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum template ativo</p>
      )}
      {selected && (
        <ItensModal template={selected} onClose={() => setSelected(null)} isLight={isLight} />
      )}
    </>
  )
}

// ── Execuções Section ─────────────────────────────────────────────────────────
function Execucoes({ isLight }: { isLight: boolean }) {
  const { data: execucoes = [], isLoading } = useChecklistExecucoes()

  const card = !isDark ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'
  const divider = !isDark ? 'border-slate-100' : 'border-white/[0.04]'
  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${!isDark ? 'text-slate-500' : 'text-slate-400'}`
  const td = `px-3 py-2.5 text-xs ${!isDark ? 'text-slate-700' : 'text-slate-300'}`
  const trEven = !isDark ? 'bg-slate-50/60' : 'bg-white/[0.02]'

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-10 rounded-xl animate-pulse ${!isDark ? 'bg-slate-100' : 'bg-white/5'}`} />
        ))}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      {execucoes.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhuma execução registrada</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`border-b ${divider}`}>
              <th className={th}>Veículo</th>
              <th className={th}>Template</th>
              <th className={th}>Responsável</th>
              <th className={th}>Data</th>
              <th className={th}>Status</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {execucoes.map((ex, idx) => {
              const sCfg = STATUS_EXECUCAO_CFG[ex.status]
              return (
                <tr key={ex.id} className={idx % 2 === 1 ? trEven : ''}>
                  <td className={td + ' font-semibold'}>
                    {ex.veiculo?.placa ?? '—'}
                    <span className={`ml-1.5 font-normal ${!isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {ex.veiculo?.modelo}
                    </span>
                  </td>
                  <td className={td}>{ex.template?.nome ?? '—'}</td>
                  <td className={td}>{ex.responsavel_nome ?? '—'}</td>
                  <td className={td}>{fmtDate(ex.created_at)}</td>
                  <td className={td}>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                      {sCfg.label}
                    </span>
                  </td>
                  <td className={td}>
                    <button className={`text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                      !isDark ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'
                    }`}>
                      <Eye size={11} /> Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type Aba = 'templates' | 'execucoes'

export default function ChecklistsManutencao() {
  const { isDark } = useTheme()
  const [aba, setAba] = useState<Aba>('templates')

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${!isDark ? 'text-slate-800' : 'text-white'}`}>
          <ClipboardList size={20} className="text-teal-500" />
          Checklists de Manutenção
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Templates de inspeção e histórico de execuções</p>
      </div>

      {/* Toggle */}
      <div className={`flex gap-1 p-1 rounded-xl w-fit ${
        !isDark ? 'bg-slate-100 border border-slate-200' : 'bg-white/4 border border-white/8'
      }`}>
        <button
          onClick={() => setAba('templates')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            aba === 'templates'
              ? 'bg-teal-600 text-white shadow-sm'
              : !isDark ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutGrid size={12} /> Templates
        </button>
        <button
          onClick={() => setAba('execucoes')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            aba === 'execucoes'
              ? 'bg-teal-600 text-white shadow-sm'
              : !isDark ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <List size={12} /> Execuções
        </button>
      </div>

      {/* Content */}
      {aba === 'templates' ? (
        <Templates isLight={isLight} />
      ) : (
        <Execucoes isLight={isLight} />
      )}
    </div>
  )
}
