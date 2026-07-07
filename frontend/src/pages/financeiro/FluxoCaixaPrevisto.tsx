// Fluxo de Caixa Previsto — matriz mensal com a MESMA estrutura de categorias do
// Plano Orçamentário da Controladoria (sempre todas as linhas), + RECEITAS no topo
// e RESULTADO embaixo. Cada fonte é mapeada para UMA categoria:
//   fin_contas_pagar  -> pela classe financeira (código/descrição, keywords + grupo)
//   contratos recorrentes (Provisionado) -> pelo grupo do contrato
//   folha CLT (última competência)       -> Mão de Obra Direta / Pessoal
// RECEITAS: projeção do cronograma EGP; substituída pelo real (contas a receber)
// nos meses em que já houver lançamento.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useContasPagar, useContasReceber } from '../../hooks/useFinanceiro'
import { useEAPFinal } from '../../hooks/usePMO'
import { buildTree, makeDefaultConfig, projObra, startYM, type Config } from '../pmo/paineis/cronogramaEngine'

// ── Estrutura fixa (idêntica ao Plano Orçamentário) ──────────────────────────
const SECTIONS: { title: string; items: string[] }[] = [
  { title: 'CUSTOS DIRETOS E IND. OBRAS', items: [
    'Materiais (Aço, Concreto)', 'Mão de Obra Direta', 'Alojamentos e Alimentação',
    'Frotas', 'Serviços Terc. + Outros C. Diretos', 'Equipamentos e EPIs'] },
  { title: 'DESPESAS ADMINISTRATIVAS', items: [
    'Pessoal', 'Administrativo', 'Serviços Administrativos', 'Sistemas', 'Desp Fin. e Outra Desp Adm'] },
  { title: 'DESPESAS APÓS O LUCRO', items: [
    'Amortizações', 'Investimentos', 'Impostos (PIS/COFINS/IRPJ/CSLL)'] },
]

// classe financeira (código CLS-GG.* + descrição) → categoria fixa
function catDaClasse(codigo: string | null, descricao: string): string {
  const d = descricao.toLowerCase()
  if (/aço|aco|concreto|cimento|material/.test(d)) return 'Materiais (Aço, Concreto)'
  if (/imposto|pis|cofins|irpj|csll|iss|icms|tribut|simples/.test(d)) return 'Impostos (PIS/COFINS/IRPJ/CSLL)'
  if (/amortiz|financiamento|empr[eé]stimo|consórcio|consorcio/.test(d)) return 'Amortizações'
  if (/investimento|imobilizado|patrim[oô]n|aquisi[cç][aã]o/.test(d)) return 'Investimentos'
  if (/aloj|aliment|refei|hosped|pousada|loca[cç][aã]o de im[oó]v|aluguel/.test(d)) return 'Alojamentos e Alimentação'
  if (/ve[ií]cul|frota|combust|abastec|ped[aá]gio|ipva|licenciam/.test(d)) return 'Frotas'
  if (/equipament|epi|ferrament|m[aá]quina/.test(d)) return 'Equipamentos e EPIs'
  if (/sistema|software|internet|telefon|licen[cç]a de uso/.test(d)) return 'Sistemas'
  if (/juro|tarifa|banc[aá]|financeir|seguro|multa/.test(d)) return 'Desp Fin. e Outra Desp Adm'
  const grp = /^CLS-(\d{2})/.exec(codigo ?? '')?.[1]
  if (grp === '02') {
    if (/sal[aá]rio|fopag|inss|fgts|rescis|f[eé]rias|13|gratifica|pens[aã]o|sindical|m[aã]o de obra|di[aá]ria/.test(d)) return 'Mão de Obra Direta'
    if (/terceir|subcontrat|servi[cç]o/.test(d)) return 'Serviços Terc. + Outros C. Diretos'
    return 'Serviços Terc. + Outros C. Diretos'
  }
  if (grp === '05') return 'Impostos (PIS/COFINS/IRPJ/CSLL)'
  if (grp === '06') return 'Desp Fin. e Outra Desp Adm'
  if (grp === '08') return 'Amortizações'
  if (grp === '09') return 'Investimentos'
  if (grp === '04') {
    if (/sal[aá]rio|fopag|pessoal|inss|fgts|pr[oó]-labore/.test(d)) return 'Pessoal'
    if (/contab|jur[ií]dic|consult|assessor|servi[cç]o/.test(d)) return 'Serviços Administrativos'
    return 'Administrativo'
  }
  if (grp === '03') return 'Serviços Terc. + Outros C. Diretos'
  if (/servi[cç]o|terceir|subcontrat/.test(d)) return 'Serviços Terc. + Outros C. Diretos'
  return 'Administrativo'
}

// grupo do contrato recorrente → categoria fixa
const CAT_CONTRATO: Record<string, string> = {
  locacao_imovel: 'Alojamentos e Alimentação',
  apoio_operacional: 'Alojamentos e Alimentação',
  locacao_veiculos: 'Frotas',
  locacao_equipamentos: 'Equipamentos e EPIs',
  equipe_pj: 'Mão de Obra Direta',
  servico_recorrente: 'Serviços Administrativos',
  consultoria_juridico: 'Serviços Administrativos',
  seguros: 'Desp Fin. e Outra Desp Adm',
  aquisicao: 'Investimentos',
  prestacao_servicos: 'Serviços Terc. + Outros C. Diretos',
  subcontratacao_empreitada: 'Serviços Terc. + Outros C. Diretos',
  outras_locacoes: 'Alojamentos e Alimentação',
  outro: 'Serviços Terc. + Outros C. Diretos',
}

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

  const { data: cad } = useQuery({
    queryKey: ['fluxo-cad'],
    queryFn: async () => {
      const [c, ct, pf] = await Promise.all([
        supabase.from('fin_classes_financeiras').select('codigo, descricao'),
        supabase.from('con_contratos').select('numero, grupo_contrato, valor_mensal, data_inicio, data_fim_previsto')
          .eq('tipo_contrato', 'despesa').eq('recorrente', true).in('status', ['assinado', 'vigente']),
        supabase.from('pmo_fluxo_os').select('portfolio_id').not('portfolio_id', 'is', null).limit(1),
      ])
      return {
        classes: c.data ?? [], contratos: ct.data ?? [],
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
  const { data: folha } = useQuery<{ competencia: string | null; pessoal: number; mod: number; pj_pessoal: number; pj_mod: number } | null>({
    queryKey: ['fluxo-folha-projecao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fin_folha_projecao')
      return error ? null : data as { competencia: string | null; pessoal: number; mod: number; pj_pessoal: number; pj_mod: number }
    },
  })

  // ── Receitas: cronograma EGP, substituído pelo real quando houver ───────────
  const receitaCronograma = new Map<string, number>()
  if (eap && eap.length) {
    const tree = buildTree(eap)
    // espelha a visão padrão do painel Cronograma do EGP: O&M (manutenção) fora
    const obras = tree.flatMap(f => f.obras)
      .filter(o => !(o.omR > 0 && !o.drivers.some(d => d.contr > 0)))
      .map(o => o.omR > 0 ? { ...o, omR: 0, omOscs: [], saldoR: o.saldoR - o.omR } : o)
    const cfg = versoes?.[0]?.config ?? makeDefaultConfig(obras)
    const start = startYM()
    obras.forEach(o => {
      const proj = projObra(o, cfg, start)
      proj.meses.forEach((ym, i) => receitaCronograma.set(ym, (receitaCronograma.get(ym) ?? 0) + proj.totalRmes[i]))
    })
  }
  const receitaReal = new Map<string, number>()
  cr.filter(c => c.status !== 'cancelado').forEach(c => {
    const d = ['recebido', 'conciliado'].includes(c.status) ? (c.data_recebimento || c.data_vencimento) : c.data_vencimento
    const ym = (d ?? '').slice(0, 7)
    if (ym) receitaReal.set(ym, (receitaReal.get(ym) ?? 0) + c.valor_original)
  })
  const receitaDe = (ym: string) => receitaReal.has(ym) ? receitaReal.get(ym)! : (receitaCronograma.get(ym) ?? 0)

  // ── Saídas: tudo cai numa categoria fixa (cat -> ym -> R$) ──────────────────
  const mapa = new Map<string, Map<string, number>>()
  const soma = (cat: string, ym: string, v: number) => {
    if (!v || !ym) return
    if (!mapa.has(cat)) mapa.set(cat, new Map())
    const m = mapa.get(cat)!
    m.set(ym, (m.get(ym) ?? 0) + v)
  }
  const classes = cad?.classes ?? []
  const classeDesc = (key: string) => classes.find(cl => cl.codigo === key)?.descricao ?? key

  // 1. contas a pagar (classe financeira → categoria)
  cp.filter(c => c.status !== 'cancelado').forEach(c => {
    const d = ['pago', 'conciliado'].includes(c.status) ? (c.data_pagamento || c.data_vencimento) : c.data_vencimento
    const key = c.classe_financeira || ''
    const cat = catDaClasse(key.startsWith('CLS-') ? key : null, key.startsWith('CLS-') ? classeDesc(key) : key)
    soma(cat, (d ?? '').slice(0, 7), c.valor_original)
  })
  // 2. contratos recorrentes (grupo do contrato → categoria), mês a mês na vigência
  const contratos = (cad?.contratos ?? []).filter(ct =>
    (ct.valor_mensal ?? 0) > 0 && ct.numero !== 'EQUIPE-PJ' && (ct.grupo_contrato as string) !== 'equipe_pj')
  meses.forEach(ym => contratos.forEach(ct => {
    const ini = (ct.data_inicio ?? '').slice(0, 7) || '0000-00'
    const fim = (ct.data_fim_previsto ?? '9999-12').slice(0, 7)
    if (ym >= ini && ym <= fim)
      soma(CAT_CONTRATO[(ct.grupo_contrato as string) || 'outro'] ?? 'Serviços Terc. + Outros C. Diretos', ym, ct.valor_mensal ?? 0)
  }))
  // 3. folha CLT projetada (meses correntes/futuros)
  const ymAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  meses.filter(ym => ym >= ymAtual).forEach(ym => {
    soma('Mão de Obra Direta', ym, (folha?.mod ?? 0) + (folha?.pj_mod ?? 0))
    soma('Pessoal', ym, (folha?.pessoal ?? 0) + (folha?.pj_pessoal ?? 0))
  })

  const catDe = (cat: string) => (ym: string) => mapa.get(cat)?.get(ym) ?? 0
  const secSubtotal = (items: string[]) => (ym: string) => items.reduce((s, it) => s + (mapa.get(it)?.get(ym) ?? 0), 0)
  const totalSaidas = (ym: string) => SECTIONS.reduce((s, sec) => s + secSubtotal(sec.items)(ym), 0)

  const td = 'px-3 py-2 text-right text-[13px] font-mono whitespace-nowrap'
  const tdLbl = 'px-3 py-2 text-[13px] font-medium whitespace-nowrap'
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
            <tr className={isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Categoria</th>
              {meses.map(ym => <th key={ym} className="px-3 py-2.5 text-right text-[11px] font-bold uppercase text-slate-400 whitespace-nowrap">{ymLbl(ym)}</th>)}
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase text-slate-400">Total</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${border}`}>
            <Linha label="RECEITAS" val={receitaDe}
              cls={`font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`} />

            {SECTIONS.map(sec => (
              <>
                <tr key={sec.title} className={secBg}>
                  <td colSpan={meses.length + 2} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider">{sec.title}</td>
                </tr>
                {sec.items.map(it => <Linha key={it} sub label={it} val={catDe(it)} />)}
                <Linha label="Subtotal" val={secSubtotal(sec.items)}
                  cls={`font-bold ${isDark ? 'text-violet-300' : 'text-violet-700 bg-violet-50/50'}`} />
              </>
            ))}

            <Linha label="TOTAL CUSTOS + IMPOSTOS" val={totalSaidas}
              cls={`font-extrabold ${isDark ? 'bg-violet-500/20 text-violet-200' : 'bg-violet-600 text-white'}`} />
            <Linha label="RESULTADO" val={ym => receitaDe(ym) - totalSaidas(ym)}
              cls={`font-extrabold ${isDark ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-white'}`} />
          </tbody>
        </table>
      </div>
      <p className={`px-4 py-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Receitas: cronograma EGP (substituído pelo real nos meses com contas a receber). Saídas: contas a pagar (classe financeira),
        contratos recorrentes provisionados e folha CLT projetada — todas mapeadas nas categorias do Plano Orçamentário.
      </p>
    </div>
  )
}
