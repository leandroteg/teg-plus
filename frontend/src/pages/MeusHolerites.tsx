// ─────────────────────────────────────────────────────────────────────────────
// MeusHolerites.tsx — Portal TEG: colaborador baixa os proprios holerites.
// Lista agrupada por ano, com botao "Baixar" que gera signed URL (1h).
// RLS em rh_holerites garante que so vem os do proprio colaborador.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { FileText, Download, ChevronDown, ChevronRight, Loader2, Receipt } from 'lucide-react'
import { useHolerites, getHoleriteDownloadUrl, type Holerite, type TipoHolerite } from '../hooks/useHolerites'
import { useTheme } from '../contexts/ThemeContext'

const TIPO_LABEL: Record<TipoHolerite, string> = {
  mensal: 'Mensal',
  '13o': '13º Salário',
  ferias: 'Férias',
  rescisao: 'Rescisão',
  adiantamento: 'Adiantamento',
}

const TIPO_COR: Record<TipoHolerite, string> = {
  mensal: 'bg-emerald-100 text-emerald-700',
  '13o': 'bg-amber-100 text-amber-700',
  ferias: 'bg-sky-100 text-sky-700',
  rescisao: 'bg-red-100 text-red-700',
  adiantamento: 'bg-violet-100 text-violet-700',
}

const MES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const fmtMoeda = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function MeusHolerites() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: holerites = [], isLoading } = useHolerites()
  const [baixando, setBaixando] = useState<string | null>(null)

  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls = `rounded-2xl border ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`

  // Agrupa por ano
  const porAno = useMemo(() => {
    const map = new Map<number, Holerite[]>()
    for (const h of holerites) {
      const ano = new Date(h.competencia + (h.competencia.length === 10 ? 'T00:00:00' : '')).getFullYear()
      if (!map.has(ano)) map.set(ano, [])
      map.get(ano)!.push(h)
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [holerites])

  const [anosAbertos, setAnosAbertos] = useState<Set<number>>(() => {
    // Abre o ano corrente por padrao
    return new Set([new Date().getFullYear()])
  })

  function toggleAno(ano: number) {
    setAnosAbertos(prev => {
      const n = new Set(prev)
      n.has(ano) ? n.delete(ano) : n.add(ano)
      return n
    })
  }

  async function handleBaixar(h: Holerite) {
    setBaixando(h.id)
    try {
      const url = await getHoleriteDownloadUrl(h.arquivo_url)
      if (!url) {
        alert('Não foi possível gerar o link de download. Tente novamente.')
        return
      }
      // Abre em nova aba (browser baixa ou abre PDF inline)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBaixando(null)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-12">
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txtMain}`}>
          <Receipt size={20} className="text-emerald-600" />
          Meus Holerites
        </h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>
          Baixe os holerites disponibilizados pelo RH. Os arquivos são privados.
        </p>
      </div>

      {isLoading && (
        <div className={`${cardCls} p-12 flex justify-center`}>
          <Loader2 size={24} className="animate-spin text-emerald-500" />
        </div>
      )}

      {!isLoading && holerites.length === 0 && (
        <div className={`${cardCls} p-12 text-center`}>
          <FileText size={32} className={`mx-auto mb-3 ${txtMuted}`} />
          <p className={`text-sm font-semibold ${txtMain}`}>Nenhum holerite disponível</p>
          <p className={`text-xs mt-1 ${txtMuted}`}>
            Quando o RH disponibilizar, ele aparecerá aqui.
          </p>
        </div>
      )}

      {!isLoading && porAno.map(([ano, lista]) => {
        const aberto = anosAbertos.has(ano)
        return (
          <div key={ano} className={cardCls}>
            <button
              onClick={() => toggleAno(ano)}
              className={`w-full flex items-center justify-between px-4 py-3 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} transition-colors`}
            >
              <div className="flex items-center gap-3">
                {aberto ? <ChevronDown size={16} className={txtMuted} /> : <ChevronRight size={16} className={txtMuted} />}
                <span className={`font-bold ${txtMain}`}>{ano}</span>
                <span className={`text-xs ${txtMuted}`}>· {lista.length} {lista.length === 1 ? 'holerite' : 'holerites'}</span>
              </div>
            </button>

            {aberto && (
              <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                {lista.map(h => {
                  const d = new Date(h.competencia + (h.competencia.length === 10 ? 'T00:00:00' : ''))
                  const mes = MES_LABEL[d.getMonth()]
                  return (
                    <div
                      key={h.id}
                      className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 ${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-slate-50 hover:bg-slate-50'}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
                        <FileText size={16} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold ${txtMain}`}>{mes}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_COR[h.tipo]}`}>
                            {TIPO_LABEL[h.tipo]}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 ${txtMuted}`}>
                          {h.valor_liquido != null && `Líquido: ${fmtMoeda(h.valor_liquido)} · `}
                          Disponibilizado em {new Date(h.uploaded_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleBaixar(h)}
                        disabled={baixando === h.id}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {baixando === h.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Download size={13} />}
                        Baixar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
