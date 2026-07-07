// pages/contratos/EquipePJ.tsx — Equipe PJ (SIGILOSO)
// Valores mensais individuais dos prestadores PJ. Proteção em 2 camadas:
// RLS na tabela con_equipe_pj (admin / diretor-ceo / supervisor de Contratos) + gate nesta tela.
// A soma dos ativos vira o contrato agregado EQUIPE-PJ (aparece na Gestão e no Provisionado
// só com o TOTAL — base do fluxo de caixa previsto), mantido por trigger no banco.
import { useState } from 'react'
import {
  Users, Lock, ShieldCheck, Loader2, CheckCircle2, BadgeDollarSign, Ban,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

interface LinhaPJ {
  colaborador_id: string
  nome: string
  cargo: string | null
  valor_mensal: number
  row_ativo: boolean
  tem_linha: boolean
}

export default function EquipePJ() {
  const { perfil, hasSetorPapel } = useAuth()
  const canPJ = perfil?.role === 'administrador' || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
  const qc = useQueryClient()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [okId, setOkId] = useState<string | null>(null)

  const { data: linhas = [], isLoading } = useQuery<LinhaPJ[]>({
    queryKey: ['con-equipe-pj'],
    enabled: canPJ,
    queryFn: async () => {
      const [colabs, rows] = await Promise.all([
        supabase.from('rh_colaboradores').select('id, nome, cargo')
          .eq('ativo', true).ilike('tipo_contrato', 'pj').order('nome'),
        supabase.from('con_equipe_pj').select('colaborador_id, valor_mensal, ativo'),
      ])
      const mapa = new Map((rows.data ?? []).map(r => [r.colaborador_id, r]))
      return (colabs.data ?? []).map(c => {
        const r = mapa.get(c.id)
        return {
          colaborador_id: c.id, nome: c.nome, cargo: c.cargo,
          valor_mensal: Number(r?.valor_mensal ?? 0),
          row_ativo: r?.ativo ?? true,
          tem_linha: !!r,
        }
      })
    },
  })

  const salvar = useMutation({
    mutationFn: async (i: { colaboradorId: string; valor?: number; ativo?: boolean }) => {
      const patch: Record<string, unknown> = {
        colaborador_id: i.colaboradorId,
        atualizado_em: new Date().toISOString(),
        atualizado_por_nome: perfil?.nome ?? null,
      }
      if (i.valor !== undefined) patch.valor_mensal = i.valor
      if (i.ativo !== undefined) patch.ativo = i.ativo
      const { error } = await supabase.from('con_equipe_pj')
        .upsert(patch, { onConflict: 'colaborador_id' })
      if (error) throw error
    },
    onSuccess: (_, v) => {
      setOkId(v.colaboradorId); setTimeout(() => setOkId(null), 1800)
      qc.invalidateQueries({ queryKey: ['con-equipe-pj'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
  })

  // ── Acesso restrito ─────────────────────────────────────────────────────────
  if (!canPJ) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Lock size={28} className="text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-600">Acesso restrito</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Os valores da Equipe PJ são sigilosos. Somente administradores e a supervisão
          do módulo Contratos podem abrir esta tela.
        </p>
      </div>
    )
  }

  const total = linhas.filter(l => l.row_ativo).reduce((s, l) => s + l.valor_mensal, 0)
  const preenchidos = linhas.filter(l => l.row_ativo && l.valor_mensal > 0).length

  function valorEditado(l: LinhaPJ): string {
    return edits[l.colaborador_id] ?? (l.valor_mensal ? String(l.valor_mensal).replace('.', ',') : '')
  }
  function salvarValor(l: LinhaPJ) {
    const raw = (edits[l.colaborador_id] ?? '').trim()
    if (raw === '') return
    const num = Number(raw.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(num) || num < 0) return
    if (num === l.valor_mensal) { setEdits(e => { const n = { ...e }; delete n[l.colaborador_id]; return n }); return }
    salvar.mutate({ colaboradorId: l.colaborador_id, valor: num })
    setEdits(e => { const n = { ...e }; delete n[l.colaborador_id]; return n })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-500" /> Equipe PJ
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
              <Lock size={10} /> sigiloso
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Valores mensais dos prestadores PJ. A soma alimenta o contrato agregado
            <span className="font-mono font-semibold"> EQUIPE-PJ</span> (Gestão/Provisionado) — só o total é visível fora daqui.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-4">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Total mensal (ativos)</p>
          <p className="text-xl font-extrabold text-indigo-700 mt-1">{fmt(total)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PJs ativos</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{linhas.filter(l => l.row_ativo).length}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${preenchidos === linhas.length ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${preenchidos === linhas.length ? 'text-emerald-600' : 'text-amber-600'}`}>Com valor definido</p>
          <p className={`text-xl font-extrabold mt-1 ${preenchidos === linhas.length ? 'text-emerald-700' : 'text-amber-700'}`}>{preenchidos}/{linhas.length}</p>
        </div>
      </div>

      {/* Aviso de proteção */}
      <div className="flex items-start gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
        <ShieldCheck size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Estes valores ficam numa tabela protegida por RLS no banco — nem a API entrega os dados
          a quem não for administrador ou supervisão de Contratos. No módulo, todos veem apenas o bloco
          agregado com o total.
        </p>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin text-indigo-500" />
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">Nenhum colaborador PJ ativo no headcount.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prestador</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Cargo</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[220px]">Valor mensal (R$)</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[90px]">No total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {linhas.map(l => (
                <tr key={l.colaborador_id} className={l.row_ativo ? '' : 'opacity-50'}>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-bold text-slate-700">{l.nome}</p>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <p className="text-[11px] text-slate-400">{l.cargo || '—'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {okId === l.colaborador_id && <CheckCircle2 size={13} className="text-emerald-500" />}
                      {l.valor_mensal === 0 && !edits[l.colaborador_id] && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 uppercase">definir</span>
                      )}
                      <BadgeDollarSign size={13} className="text-slate-300" />
                      <input
                        inputMode="decimal"
                        value={valorEditado(l)}
                        onChange={e => setEdits(m => ({ ...m, [l.colaborador_id]: e.target.value }))}
                        onBlur={() => salvarValor(l)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="0,00"
                        disabled={!l.row_ativo || salvar.isPending}
                        className="w-[120px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-right text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:bg-slate-50"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => salvar.mutate({ colaboradorId: l.colaborador_id, ativo: !l.row_ativo })}
                      title={l.row_ativo ? 'Tirar do total (não soma no contrato agregado)' : 'Voltar a somar no total'}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        l.row_ativo
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                      }`}>
                      {l.row_ativo ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                      {l.row_ativo ? 'Sim' : 'Não'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60">
                <td className="px-4 py-3 text-xs font-extrabold text-slate-600" colSpan={2}>Total mensal (vai pro contrato EQUIPE-PJ)</td>
                <td className="px-4 py-3 text-right text-sm font-extrabold text-indigo-700">{fmt(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
