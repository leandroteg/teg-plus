import { useMemo } from 'react'
import { ArrowRight, TrendingDown, FileText, HandHelping, Loader2 } from 'lucide-react'
import { useMovimentacoesPatrimonial, useDepreciacoes, useTermosResponsabilidade } from '../../hooks/usePatrimonial'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'

interface TimelineEntry {
  date: string
  type: 'movimentacao' | 'depreciacao' | 'termo' | 'cautela'
  title: string
  subtitle: string
}

const TYPE_CONFIG = {
  movimentacao: { icon: ArrowRight, dot: 'bg-blue-500', text: 'text-blue-400', lightDot: 'bg-blue-500', lightText: 'text-blue-600' },
  depreciacao:  { icon: TrendingDown, dot: 'bg-amber-500', text: 'text-amber-400', lightDot: 'bg-amber-500', lightText: 'text-amber-600' },
  termo:        { icon: FileText, dot: 'bg-violet-500', text: 'text-violet-400', lightDot: 'bg-violet-500', lightText: 'text-violet-600' },
  cautela:      { icon: HandHelping, dot: 'bg-teal-500', text: 'text-teal-400', lightDot: 'bg-teal-500', lightText: 'text-teal-600' },
}

function useCautelasDoAtivo(imobilizadoId: string) {
  return useQuery<any[]>({
    queryKey: ['pat-cautelas-ativo', imobilizadoId],
    enabled: !!imobilizadoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautela_itens')
        .select('*, cautela:est_cautelas(*)')
        .eq('item_id', imobilizadoId)
      if (error) return []
      return data ?? []
    },
  })
}

export default function AtivoTimeline({ imobilizadoId, isDark }: { imobilizadoId: string; isDark: boolean }) {
  const { data: movs = [], isLoading: l1 } = useMovimentacoesPatrimonial(imobilizadoId)
  const { data: deps = [], isLoading: l2 } = useDepreciacoes(imobilizadoId)
  const { data: termos = [], isLoading: l3 } = useTermosResponsabilidade(imobilizadoId)
  const { data: cautelas = [], isLoading: l4 } = useCautelasDoAtivo(imobilizadoId)

  const isLoading = l1 || l2 || l3 || l4

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = []

    for (const m of movs) {
      entries.push({
        date: m.criado_em,
        type: 'movimentacao',
        title: `${(m.tipo ?? '').charAt(0).toUpperCase()}${(m.tipo ?? '').slice(1).replace(/_/g, ' ')}`,
        subtitle: m.observacoes || `${(m as any).base_origem_nome ?? '?'} -> ${(m as any).base_destino_nome ?? '?'}`,
      })
    }

    for (const d of deps) {
      entries.push({
        date: d.competencia ?? d.criado_em,
        type: 'depreciacao',
        title: `Depreciacao ${d.competencia ?? ''}`,
        subtitle: `R$ ${(d.valor_depreciacao ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (valor: R$ ${(d.valor_apos ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
      })
    }

    for (const t of termos) {
      entries.push({
        date: t.criado_em,
        type: 'termo',
        title: `Termo de Responsabilidade`,
        subtitle: `${t.responsavel_nome ?? 'N/A'}${t.assinado ? ' (assinado)' : ' (pendente)'}`,
      })
    }

    for (const c of cautelas) {
      const cau = c.cautela
      entries.push({
        date: cau?.criado_em ?? c.criado_em ?? '',
        type: 'cautela',
        title: `Cautela ${cau?.numero ?? ''}`,
        subtitle: `${cau?.solicitante_nome ?? 'N/A'} - ${cau?.destino_nome ?? ''}`,
      })
    }

    entries.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    return entries
  }, [movs, deps, termos, cautelas])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <p className={`text-xs text-center py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Nenhum evento registrado
      </p>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className={`absolute left-[9px] top-2 bottom-2 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />

      <div className="space-y-4">
        {timeline.map((entry, i) => {
          const cfg = TYPE_CONFIG[entry.type]
          const Icon = cfg.icon
          return (
            <div key={i} className="relative flex items-start gap-3">
              {/* Dot */}
              <div className={`absolute -left-6 top-1 h-[18px] w-[18px] rounded-full flex items-center justify-center ${isDark ? 'bg-[#0f1117]' : 'bg-white'}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${isDark ? cfg.dot : cfg.lightDot}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon size={12} className={isDark ? cfg.text : cfg.lightText} />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {entry.title}
                  </span>
                  <span className={`text-[10px] ml-auto shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {entry.date ? new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                  </span>
                </div>
                <p className={`text-[11px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {entry.subtitle}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
