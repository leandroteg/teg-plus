// Fluxo de Caixa Previsto — matriz mensal (meses do filtro De→Até do Painel Financeiro).
// RECEITAS: cronograma do EGP (engine projObra, mesma projeção do painel Cronograma);
//   no mês em que já existe previsão real (fin_contas_receber de medição faturada), ela substitui.
// SAÍDAS: linhas = classes financeiras agrupadas pelos grupos (fin_grupos/fin_classes),
//   alimentadas por fin_contas_pagar (vencimento; pago usa data de pagamento)
//   + seção Contratos Recorrentes (Provisionado: aluguéis, Equipe PJ etc., valor mensal na vigência).
// RESULTADO: receitas − saídas, mês a mês.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useContasPagar, useContasReceber } from '../../hooks/useFinanceiro'
import { useEAPFinal } from '../../hooks/usePMO'
import { buildTree, makeDefaultConfig, projObra, startYM, type Config } from '../pmo/paineis/cronogramaEngine'
import { GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'

const fmtK = (v: number) => {
  if (Math.abs(v) < 0.5) return '—'
  const a = Math.abs(v)
  const s = a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'K' : String(Math.round(a))
  return (v < 0 ? '-' : '') + s
}
const mesesEntre = (de: string, ate: string): string[] => {
  const out: string[] = []
  let [y, m] = de.split('-').map(Number)
  const [ye, me] = ate.split('-').map(Number)
  while (y < ye || (y === ye && m <= me)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } }
  return out.slice(0, 36)
}
const MES_LBL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ymLbl = (ym: string) => `${MES_LBL[Number(ym.slice(5, 7))]}/${ym.slice(2, 4)}`

export default function FluxoCaixaPrevisto({ de, ate, isDark }: { de: string; ate: string; isDark: boolean }) {
  const meses = mesesEntre(de, ate)
  const { data: cp = [] } = useContasPagar()
  const { data: cr = [] } = useContasReceber()

  // grupos + classes financeiras (linhas); grupo da classe = prefixo do código (CLS-02.* → GRP-02)
  const { data: cad } = useQuery({
    queryKey: ['fluxo-grupos-classes'],
    queryFn: async () => {
      const [g, c, ct, pf] = await Promise.all([
        supabase.from('fin_grupos_financeiros').select('codigo, descricao, tipo').eq('ativo', true).order('codigo'),
        supabase.from('fin_classes_financeiras').select('codigo, descricao, tipo').eq('ativo', true).order('codigo'),
        supabase.from('con_contratos').select('numero, objeto, grupo_contrato, valor_mensal, recorrente, data_inicio, data_fim_previsto')
          .eq('tipo_contrato', 'despesa').eq('recorrente', true).in('status', ['assinado', 'vigente']),
        supabase.from('pmo_fluxo_os').select('portfolio_id').not('portfolio_id', 'is', null).limit(1),
      ])
      return {
        grupos: g.data ?? [], classes: c.data ?? [], contratos: ct.data ?? [],
        portfolioId: (pf.data?.[0] as { portfolio_id?: string } | undefined)?.portfolio_id,
      }
    },
  })
  const { data: versoes } = useQuery({
    queryKey: ['fluxo-cronog-versao', cad?.portfolioId],
    enabled: !!cad?.portfolioId,
    queryFn: async () => {
      const { data } = await supabase.from('pmo_cronograma_versao').select('config, updated_at')
        .eq('portfolio_id', cad!.portfolioId!).order('updated_at', { ascending: false }).limit(1)
      return (data ?? []) as { config: Config }[]
    },
  })
  const { data: eap } = useEAPFinal(cad?.portfolioId)

  // Folha CLT: última competência lançada projetada nos meses correntes/futuros.
  // Esc. Central + administrativos = Despesa de Pessoal; restante = Mão de Obra Direta.
  const { data: folha } = useQuery<{ competencia: string | null; pessoal: number; mod: number } | null>({
    queryKey: ['fluxo-folha-projecao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fin_folha_projecao')
      if (error) return null
      return data as { competencia: string | null; pessoal: number; mod: number }
    },
  })
  const ymAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const folhaNoMes = (bucket: 'pessoal' | 'mod') => (ym: string) =>
    ym >= ymAtual ? (folha?.[bucket] ?? 0) : 0

  // ── Receita projetada pelo cronograma EGP (R$/mês) ──────────────────────────
  const receitaCronograma = new Map<string, number>()
  if (eap && eap.length) {
    const tree = buildTree(eap)
    const obras = tree.flatMap(f => f.obras)
    const cfg = versoes?.[0]?.config ?? makeDefaultConfig(obras)
    const start = startYM()
    obras.forEach(o => {
      const proj = projObra(o, cfg, start)
      proj.meses.forEach((ym, i) => receitaCronograma.set(ym, (receitaCronograma.get(ym) ?? 0) + proj.totalRmes[i]))
    })
  }

  // ── Receita real prevista (contas a receber por vencimento/recebimento) ─────
  const receitaReal = new Map<string, number>()
  cr.filter(c => c.status !== 'cancelado').forEach(c => {
    const d = ['recebido', 'conciliado'].includes(c.status) ? (c.data_recebimento || c.data_vencimento) : c.data_vencimento
    const ym = (d ?? '').slice(0, 7)
    if (ym) receitaReal.set(ym, (receitaReal.get(ym) ?? 0) + c.valor_original)
  })
  const receitaDe = (ym: string) => receitaReal.has(ym) ? receitaReal.get(ym)! : (receitaCronograma.get(ym) ?? 0)

  // ── Saídas por classe financeira × mês (fin_contas_pagar) ───────────────────
  const porClasse = new Map<string, Map<string, number>>()  // classeKey -> ym -> R$
  cp.filter(c => c.status !== 'cancelado').forEach(c => {
    const d = ['pago', 'conciliado'].includes(c.status) ? (c.data_pagamento || c.data_vencimento) : c.data_vencimento
    const ym = (d ?? '').slice(0, 7)
    if (!ym) return
    const key = c.classe_financeira || 'sem'
    if (!porClasse.has(key)) porClasse.set(key, new Map())
    const m = porClasse.get(key)!
    m.set(ym, (m.get(ym) ?? 0) + c.valor_original)
  })

  const grupos = (cad?.grupos ?? []).filter(g => g.tipo !== 'receita')
  const classes = cad?.classes ?? []
  const classeLabel = (key: string) => classes.find(cl => cl.codigo === key)?.descricao ?? key
  const grupoDaClasse = (key: string): string => {
    const m = /^CLS-(\d{2})/.exec(key)
    return m ? `GRP-${m[1]}` : 'GRP-XX'
  }
  // seções: grupo -> [classeKeys com valor na janela]
  const secoes = grupos.map(g => ({
    grupo: g,
    linhas: [...porClasse.keys()].filter(k => grupoDaClasse(k) === g.codigo &&
      meses.some(ym => (porClasse.get(k)!.get(ym) ?? 0) > 0)),
  })).filter(s => s.linhas.length > 0)
  const semClasse = [...porClasse.keys()].filter(k => k === 'sem' || grupoDaClasse(k) === 'GRP-XX')
    .filter(k => meses.some(ym => (porClasse.get(k)!.get(ym) ?? 0) > 0))

  // ── Contratos recorrentes (Provisionado) — SOMADOS por grupo de contrato ────
  const contratos = (cad?.contratos ?? []).filter(ct => (ct.valor_mensal ?? 0) > 0)
  const contratoNoMes = (ct: (typeof contratos)[number], ym: string) => {
    const ini = (ct.data_inicio ?? '').slice(0, 7) || '0000-00'
    const fim = (ct.data_fim_previsto ?? '9999-12').slice(0, 7)
    return ym >= ini && ym <= fim ? (ct.valor_mensal ?? 0) : 0
  }
  const gruposContrato = [...new Set(contratos.map(ct => (ct.grupo_contrato as string) || 'outro'))]
    .map(g => ({
      key: g,
      label: GRUPO_CONTRATO_LABEL[g as GrupoContrato] ?? g,
      val: (ym: string) => contratos.filter(ct => ((ct.grupo_contrato as string) || 'outro') === g)
        .reduce((s, ct) => s + contratoNoMes(ct, ym), 0),
    }))
    .sort((a, b) => meses.reduce((s, ym) => s + b.val(ym), 0) - meses.reduce((s, ym) => s + a.val(ym), 0))

  const saidaDe = (ym: string) =>
    [...porClasse.values()].reduce((s, m) => s + (m.get(ym) ?? 0), 0) +
    contratos.reduce((s, ct) => s + contratoNoMes(ct, ym), 0) +
    folhaNoMes('pessoal')(ym) + folhaNoMes('mod')(ym)

  const td = `px-3 py-2 text-right text-[11px] font-mono whitespace-nowrap`
  const tdLbl = `px-3 py-2 text-[11px] font-medium whitespace-nowrap`
  const headBg = isDark ? 'bg-white/[0.03]' : 'bg-slate-50'
  const secBg = isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'
  const border = isDark ? 'divide-white/[0.05]' : 'divide-slate-100'
  const txt = isDark ? 'text-slate-300' : 'text-slate-600'

  const Linha = ({ label, val, cls, sub }: { label: string; val: (ym: string) => number; cls?: string; sub?: boolean }) => (
    <tr className={cls}>
      <td className={`${tdLbl} ${sub ? 'pl-7' : ''} ${cls ? '' : txt}`}>{label}</td>
      {meses.map(ym => <td key={ym} className={td}>{fmtK(val(ym))}</td>)}
      <td className={`${td} font-bold`}>{fmtK(meses.reduce((s, ym) => s + val(ym), 0))}</td>
    </tr>
  )

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      <div className="overflow-x-auto">
        <table className={`w-full divide-y ${border}`}>
          <thead>
            <tr className={headBg}>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Grupo / Classe</th>
              {meses.map(ym => <th key={ym} className="px-3 py-2.5 text-right text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">{ymLbl(ym)}</th>)}
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase text-slate-400">Total</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${border}`}>
            {/* RECEITAS: cronograma EGP, substituído por previsão real quando existir no mês */}
            <Linha label="RECEITAS (cronograma EGP / medições faturadas)" val={receitaDe}
              cls={`font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`} />

            {secoes.map(s => (
              <>
                <tr key={s.grupo.codigo} className={secBg}>
                  <td colSpan={meses.length + 2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">{s.grupo.descricao}</td>
                </tr>
                {s.linhas.map(k => <Linha key={k} sub label={classeLabel(k)} val={ym => porClasse.get(k)!.get(ym) ?? 0} />)}
              </>
            ))}

            {semClasse.length > 0 && (
              <>
                <tr className={secBg}>
                  <td colSpan={meses.length + 2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">Sem classificação</td>
                </tr>
                {semClasse.map(k => <Linha key={k} sub label={k === 'sem' ? 'Sem classe financeira' : classeLabel(k)} val={ym => porClasse.get(k)!.get(ym) ?? 0} />)}
              </>
            )}

            {gruposContrato.length > 0 && (
              <>
                <tr className={secBg}>
                  <td colSpan={meses.length + 2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">Contratos Recorrentes (Provisionado)</td>
                </tr>
                {gruposContrato.map(g => <Linha key={g.key} sub label={g.label} val={g.val} />)}
              </>
            )}

            {folha && (folha.mod > 0 || folha.pessoal > 0) && (
              <>
                <tr className={secBg}>
                  <td colSpan={meses.length + 2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
                    Folha CLT — projeção pela última folha ({folha.competencia?.slice(5, 7)}/{folha.competencia?.slice(0, 4)})
                  </td>
                </tr>
                <Linha sub label="Mão de Obra Direta" val={folhaNoMes('mod')} />
                <Linha sub label="Despesa de Pessoal (Esc. Central e administrativos)" val={folhaNoMes('pessoal')} />
              </>
            )}

            <Linha label="TOTAL SAÍDAS" val={saidaDe}
              cls={`font-bold ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`} />
            <Linha label="RESULTADO" val={ym => receitaDe(ym) - saidaDe(ym)}
              cls={`font-extrabold ${isDark ? 'bg-violet-500/15 text-violet-200' : 'bg-violet-600 text-white'}`} />
          </tbody>
        </table>
      </div>
      <p className={`px-4 py-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Receitas: projeção do cronograma EGP; nos meses com contas a receber lançadas (medições faturadas), o valor real substitui a projeção.
        Saídas: contas a pagar por classe financeira + contratos recorrentes provisionados.
      </p>
    </div>
  )
}
