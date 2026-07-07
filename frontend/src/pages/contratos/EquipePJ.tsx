// pages/contratos/EquipePJ.tsx — Equipe PJ (SIGILOSO, sem item de menu)
// Acessada só pelo bloco agregado "EQUIPE-PJ" na Gestão de Contratos.
// Lista enxuta integrada ao RH (headcount): nome, cargo, base e admissão vêm de
// rh_colaboradores. Valores individuais ficam SÓ no banco (con_equipe_pj, RLS);
// a tela mostra apenas o total mensal. A soma mantém o agregado (Provisionado).
import { useState } from 'react'
import { ArrowLeft, Lock, Loader2, CheckCircle2, Ban } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
const iniciais = (n: string) => n.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

interface LinhaPJ {
  colaborador_id: string
  nome: string
  cargo: string | null
  base: string | null
  admissao: string | null
  valor_mensal: number
  row_ativo: boolean
}

export default function EquipePJ() {
  const nav = useNavigate()
  const { perfil, hasSetorPapel } = useAuth()
  const canPJ = perfil?.role === 'administrador' || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
  const qc = useQueryClient()
  const [okId, setOkId] = useState<string | null>(null)

  const { data: linhas = [], isLoading } = useQuery<LinhaPJ[]>({
    queryKey: ['con-equipe-pj'],
    enabled: canPJ,
    queryFn: async () => {
      const [colabs, rows] = await Promise.all([
        supabase.from('rh_colaboradores')
          .select('id, nome, cargo, data_admissao, base:est_bases!base_id(nome)')
          .eq('ativo', true).ilike('tipo_contrato', 'pj').order('nome'),
        supabase.from('con_equipe_pj').select('colaborador_id, valor_mensal, ativo'),
      ])
      const mapa = new Map((rows.data ?? []).map(r => [r.colaborador_id, r]))
      return (colabs.data ?? []).map((c: any) => {
        const r = mapa.get(c.id)
        return {
          colaborador_id: c.id, nome: c.nome?.trim() ?? '—', cargo: c.cargo,
          base: c.base?.nome ?? null, admissao: c.data_admissao,
          valor_mensal: Number(r?.valor_mensal ?? 0),
          row_ativo: r?.ativo ?? true,
        }
      })
    },
  })

  const salvar = useMutation({
    mutationFn: async (i: { colaboradorId: string; ativo: boolean }) => {
      const patch: Record<string, unknown> = {
        colaborador_id: i.colaboradorId,
        ativo: i.ativo,
        atualizado_em: new Date().toISOString(),
        atualizado_por_nome: perfil?.nome ?? null,
      }
      const { error } = await supabase.from('con_equipe_pj').upsert(patch, { onConflict: 'colaborador_id' })
      if (error) throw error
    },
    onSuccess: (_, v) => {
      setOkId(v.colaboradorId); setTimeout(() => setOkId(null), 1500)
      qc.invalidateQueries({ queryKey: ['con-equipe-pj'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
  })

  if (!canPJ) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Lock size={26} className="text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-600">Acesso restrito</p>
        <p className="text-xs text-slate-400 mt-1">Somente administradores e a supervisão de Contratos.</p>
      </div>
    )
  }

  const total = linhas.filter(l => l.row_ativo).reduce((s, l) => s + l.valor_mensal, 0)

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header enxuto: voltar + título + total */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav('/contratos/gestao')}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shrink-0">
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              Equipe PJ
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
                <Lock size={9} /> sigiloso
              </span>
            </h1>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total mensal</p>
          <p className="text-xl font-extrabold text-indigo-600">{fmt(total)}</p>
        </div>
      </div>

      {/* Lista compacta integrada ao RH */}
      {isLoading ? (
        <div className="flex justify-center py-14"><Loader2 size={22} className="animate-spin text-indigo-500" /></div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">Nenhum colaborador PJ ativo no headcount.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {linhas.map(l => (
            <div key={l.colaborador_id} className={`flex items-center gap-3 px-4 py-2.5 ${l.row_ativo ? '' : 'opacity-45'}`}>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                {iniciais(l.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{l.nome}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  {[l.cargo, l.base, l.admissao ? `desde ${new Date(l.admissao + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}` : null]
                    .filter(Boolean).join(' · ') || 'PJ · headcount'}
                </p>
              </div>
              {okId === l.colaborador_id && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
              <button
                onClick={() => salvar.mutate({ colaboradorId: l.colaborador_id, ativo: !l.row_ativo })}
                title={l.row_ativo ? 'Tirar do total' : 'Voltar a somar no total'}
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${l.row_ativo ? 'text-slate-300 hover:text-slate-500 hover:bg-slate-50' : 'text-slate-400 bg-slate-100'}`}>
                <Ban size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
