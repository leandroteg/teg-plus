import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  PMOPortfolio, PMOProjeto, PMOTAP, PMOEAP, PMOTarefa,
  PMOMedicaoResumo, PMOMedicaoPeriodo, PMOMedicaoItem, PMOMedicaoItemPeriodo,
  PMOHistograma, PMOFluxoOS, PMOStatusReport,
  PMOMulta, PMOReuniao, PMOMudanca, PMOIndicadoresSnapshot,
  PMOStakeholder, PMOComunicacao, PMOOrcamento, PMORisco,
  PMOPlanoAcao, PMOEntregavel, PMODocumento, PMOAvancoFisico,
  PMOLicaoAprendida, PMOAceite, PMODesmobilizacao,
} from '../types/pmo'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

// ── Portfolio ────────────────────────────────────────────────────────────────

export function usePortfolios(filters?: { status?: string; obra_id?: string }) {
  return useQuery<PMOPortfolio[]>({
    queryKey: ['pmo-portfolios', filters],
    queryFn: async () => {
      let q = supabase
        .from('pmo_portfolio')
        .select('*, obra:sys_obras!obra_id(id, nome, codigo)')
        .order('created_at', { ascending: false })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOPortfolio[]
    },
  })
}

export function usePortfolio(id: string | undefined) {
  return useQuery<PMOPortfolio | null>({
    queryKey: ['pmo-portfolio', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_portfolio')
        .select('*, obra:sys_obras!obra_id(id, nome, codigo)')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as PMOPortfolio
    },
  })
}

export function useCriarPortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOPortfolio>) => {
      const { data, error } = await supabase
        .from('pmo_portfolio')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOPortfolio
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pmo-portfolios'] })
    },
  })
}

export function useAtualizarPortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOPortfolio> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_portfolio')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOPortfolio
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-portfolios'] })
      qc.invalidateQueries({ queryKey: ['pmo-portfolio', vars.id] })
    },
  })
}

// ── Projetos ────────────────────────────────────────────────────────────────

export function useProjetos(portfolioId: string | undefined) {
  return useQuery<PMOProjeto[]>({
    queryKey: ['pmo-projetos', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_projetos')
        .select('*, centro_custo:sys_centros_custo!centro_custo_id(id, descricao, codigo)')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOProjeto[]
    },
  })
}

export function useProjeto(id: string | undefined) {
  return useQuery<PMOProjeto | null>({
    queryKey: ['pmo-projeto', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_projetos')
        .select('*, centro_custo:sys_centros_custo!centro_custo_id(id, descricao, codigo)')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as PMOProjeto
    },
  })
}

export function useCriarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOProjeto>) => {
      const { data, error } = await supabase
        .from('pmo_projetos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOProjeto
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-projetos', vars.portfolio_id] })
    },
  })
}

export function useAtualizarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOProjeto> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_projetos')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOProjeto
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-projetos', d.portfolio_id] })
      qc.invalidateQueries({ queryKey: ['pmo-projeto', d.id] })
    },
  })
}

export function useDeletarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pmo_projetos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pmo-projetos'] })
    },
  })
}

// ── Obras do contrato/portfolio (Iniciação → Obras/OS Iniciadas) ──────────────
export interface EGPObraVinc {
  id: string
  codigo: string | null
  nome: string
  status: string | null
  pmo_projeto_id: string | null
  tipo: string | null
  polo_nome: string
}

export function useObrasDoPortfolio(portfolioId?: string) {
  return useQuery<EGPObraVinc[]>({
    queryKey: ['egp-obras-portfolio', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      // polos (projetos) do portfólio → obras de sys_obras ligadas a eles
      const { data: polos, error: e1 } = await supabase
        .from('pmo_projetos')
        .select('id, nome')
        .eq('portfolio_id', portfolioId!)
      if (e1) throw e1
      const ids = (polos ?? []).map((p: { id: string }) => p.id)
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('sys_obras')
        .select('id, codigo, nome, status, pmo_projeto_id, tipo')
        .in('pmo_projeto_id', ids)
        .order('nome')
      if (error) throw error
      const pm = new Map((polos ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
      return (data ?? []).map((o: Record<string, unknown>) => ({
        ...(o as object),
        polo_nome: pm.get(o.pmo_projeto_id as string) ?? '—',
      })) as EGPObraVinc[]
    },
  })
}

// ── OSCs por obra (pmo_fluxo_os) ──────────────────────────────────────────────
export interface EGPOscRow {
  id: string
  obra_id: string | null
  portfolio_id: string
  numero_os: string
  etapa_atual: string
  tipo_servico: string | null
  data_recebimento: string | null
  observacoes: string | null
  tipo: string | null
  valor: number | null
  quantidade_us: number | null
  saldo_reais: number | null
  data_osc: string | null
  vencimento: string | null
  abertura_path: string | null
}

export async function getAberturaUrl(path: string, download = false): Promise<string | null> {
  const { data } = await supabase.storage.from('egp-osc-abertura').createSignedUrl(path, 3600, download ? { download: true } : undefined)
  return data?.signedUrl ?? null
}

export function useOSCsDoPortfolio(portfolioId?: string) {
  return useQuery<EGPOscRow[]>({
    queryKey: ['egp-oscs-portfolio', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_fluxo_os')
        .select('id, obra_id, portfolio_id, numero_os, etapa_atual, tipo_servico, data_recebimento, observacoes, tipo, valor, quantidade_us, saldo_reais, data_osc, vencimento, abertura_path')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as EGPOscRow[]
    },
  })
}

export interface EGPOscItem {
  id: string
  secao: string | null
  subsec_codigo: string | null
  subsec_nome: string | null
  unidade: string | null
  quantidade: number | null
  valor: number | null
  valor_acum: number | null
}
export function useOSCItens(fluxoOsId?: string) {
  return useQuery<EGPOscItem[]>({
    queryKey: ['egp-osc-itens', fluxoOsId],
    enabled: !!fluxoOsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_osc_itens')
        .select('id, secao, subsec_codigo, subsec_nome, unidade, quantidade, valor, valor_acum')
        .eq('fluxo_os_id', fluxoOsId!)
        .order('subsec_codigo', { ascending: true })
      if (error) throw error
      return (data ?? []) as EGPOscItem[]
    },
  })
}

// espelhos de medição (PDFs) por OSC — bucket egp-medicoes / tabela pmo_medicoes
export interface MedicaoEspelho {
  id: string
  numero_os: string
  competencia: string | null
  arquivo_nome: string | null
  storage_path: string
  tamanho: number | null
  created_at: string
}
export function useEspelhosDaOSC(numeroOs?: string) {
  return useQuery<MedicaoEspelho[]>({
    queryKey: ['egp-espelhos', numeroOs],
    enabled: !!numeroOs,
    queryFn: async () => {
      const { data, error } = await supabase.from('pmo_medicoes').select('*').eq('numero_os', numeroOs!).order('competencia', { ascending: false })
      if (error) throw error
      return (data ?? []) as MedicaoEspelho[]
    },
  })
}
export async function getEspelhoUrl(path: string, download = false): Promise<string | null> {
  const { data } = await supabase.storage.from('egp-medicoes').createSignedUrl(path, 3600, download ? { download: true } : undefined)
  return data?.signedUrl ?? null
}

// medição mensal consolidada (realizado por OSC por mês) — base do painel de Faturamento
export interface MedicaoMensalRow { numero_os: string; competencia: string; realizado: number | null; acumulado: number | null; n_medicoes: number | null; subcontratada?: boolean }
export function useMedicaoMensal() {
  return useQuery<MedicaoMensalRow[]>({
    queryKey: ['egp-medicao-mensal'],
    queryFn: async () => {
      let out: MedicaoMensalRow[] = []; let from = 0
      for (;;) {
        const { data, error } = await supabase.from('pmo_medicao_mensal').select('numero_os, competencia, realizado, acumulado, n_medicoes, subcontratada').order('competencia').range(from, from + 999)
        if (error) throw error
        out = out.concat((data ?? []) as MedicaoMensalRow[])
        if (!data || data.length < 1000) break
        from += 1000
      }
      return out
    },
  })
}

// medição por seção/pacote da EAP (realizado real por OSC×mês×pacote)
export interface MedicaoSecaoRow { numero_os: string; competencia: string; pacote: string; realizado: number | null }
export function useMedicaoSecao() {
  return useQuery<MedicaoSecaoRow[]>({
    queryKey: ['egp-medicao-secao'],
    queryFn: async () => {
      let out: MedicaoSecaoRow[] = []; let from = 0
      for (;;) {
        const { data, error } = await supabase.from('pmo_medicao_secao').select('numero_os, competencia, pacote, realizado').range(from, from + 999)
        if (error) throw error
        out = out.concat((data ?? []) as MedicaoSecaoRow[])
        if (!data || data.length < 1000) break
        from += 1000
      }
      return out
    },
  })
}

// medição por OSC (agrupado por polo) — medido = Σ valor_acum dos itens
export interface MedicaoOSCRow {
  id: string
  numero_os: string
  obra_id: string | null
  obra_nome: string
  polo_id: string
  polo_nome: string
  valor: number
  medido: number
  tipo: string | null
  data_osc: string | null
  vencimento: string | null
}
export function useMedicaoPorOSC(portfolioId?: string) {
  return useQuery<MedicaoOSCRow[]>({
    queryKey: ['egp-medicao-osc', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data: polos } = await supabase.from('pmo_projetos').select('id, nome').eq('portfolio_id', portfolioId!)
      const polosArr = (polos ?? []) as { id: string; nome: string }[]
      const ids = polosArr.map(p => p.id)
      if (!ids.length) return []
      const poloNome = new Map(polosArr.map(p => [p.id, p.nome]))
      const { data: obras } = await supabase.from('sys_obras').select('id, nome, pmo_projeto_id').in('pmo_projeto_id', ids)
      const obraMap = new Map((obras ?? []).map((o: Record<string, unknown>) => [o.id as string, o]))
      const { data: oscs } = await supabase.from('pmo_fluxo_os').select('id, numero_os, obra_id, valor, tipo, data_osc, vencimento, saldo_reais').eq('portfolio_id', portfolioId!)
      const oscArr = (oscs ?? []) as { id: string; numero_os: string; obra_id: string | null; valor: number | null; tipo: string | null; data_osc: string | null; vencimento: string | null; saldo_reais: number | null }[]
      const oscIds = oscArr.map(o => o.id)
      const medido = new Map<string, number>()
      if (oscIds.length) {
        const { data: itens } = await supabase.from('pmo_osc_itens').select('fluxo_os_id, valor_acum').in('fluxo_os_id', oscIds)
        for (const it of (itens ?? []) as { fluxo_os_id: string; valor_acum: number | null }[]) {
          if (it.valor_acum != null) medido.set(it.fluxo_os_id, (medido.get(it.fluxo_os_id) ?? 0) + Number(it.valor_acum))
        }
      }
      return oscArr.filter(o => o.obra_id && obraMap.has(o.obra_id)).map(o => {
        const obra = obraMap.get(o.obra_id as string) as Record<string, unknown>
        const poloId = obra.pmo_projeto_id as string
        const valor = Number(o.valor ?? 0)
        // faturado = valor - saldo (faturamento); fallback = Σ valor_acum dos itens (EAP)
        const fat = o.saldo_reais != null ? Math.max(0, valor - Number(o.saldo_reais)) : (medido.get(o.id) ?? 0)
        return {
          id: o.id, numero_os: o.numero_os, obra_id: o.obra_id, obra_nome: obra.nome as string,
          polo_id: poloId, polo_nome: poloNome.get(poloId) ?? '—',
          valor, medido: fat,
          tipo: o.tipo, data_osc: o.data_osc, vencimento: o.vencimento,
        }
      })
    },
  })
}

// ── EAP Final (visão por polo, financeiro + físico ao vivo) ───────────────────
export interface EAPPacote {
  n: string
  valor: number
  faturado: number
  pctFin: number
  pctFis: number | null
  qtdContr: number
  qtdReal: number
  unidade: string | null
  isOutros: boolean
}
export interface EAPPolo {
  id: string
  label: string
  codigo: string | null
  contr: number
  fat: number
  saldo: number
  pctFin: number
  pctFis: number
  qtdTorres: number | null
  montTon: number
  nOscs: number
  oscs: string[]
  obras: { nome: string; oscs: { id: string; numero_os: string }[] }[]
  pacotes: EAPPacote[]
}
type PacAcc = { valor: number; fat: number; qC: number; qR: number; uni: string | null }
export interface EAPOscRaw {
  id: string
  numero_os: string
  obra_id: string | null
  obra_nome: string
  valor: number
  saldo_reais: number | null
  etapa_atual: string
  data_osc: string | null
  pacotes: Record<string, PacAcc>
}
// filtra os polos crus pelas OSCs com abertura (data_osc) dentro de [de, ate] (YYYY-MM); vazio = tudo
export function filtrarRawPorPeriodo(raws: EAPPoloRaw[], de?: string, ate?: string): EAPPoloRaw[] {
  if (!de && !ate) return raws
  return raws.map(p => ({
    ...p,
    oscs: p.oscs.filter(o => {
      const ym = (o.data_osc ?? '').slice(0, 7)
      if (!ym) return false
      if (de && ym < de) return false
      if (ate && ym > ate) return false
      return true
    }),
  }))
}
export interface EAPPoloRaw { id: string; label: string; codigo: string | null; qtdTorres: number | null; oscs: EAPOscRaw[] }
const PACOTES_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']
function pacoteDe(code: string | null, secao: string | null): string {
  const c = String(code ?? ''); const s = (secao ?? '').toLowerCase()
  if (c.startsWith('1.6') || c.startsWith('1.5') || (s.includes('prelimin') && s.includes('topog'))) return 'Serv. Preliminares'
  if (c.startsWith('1.1') || c.startsWith('1.2') || c.startsWith('1.3') || s.includes('mobiliz') || s.includes('canteiro')) return 'Canteiro e Mobiliz.'
  if (c.startsWith('1.4') || s.includes('administ')) return 'Administração Local'
  if (c.startsWith('1') || s.includes('prelimin')) return 'Serv. Preliminares'
  if (c.startsWith('2') || s.includes('funda')) return 'Fundações'
  if (c.startsWith('4') || s.includes('montagem') || s.includes('estrutura metál')) return 'Montagem de Torres'
  if (c.startsWith('6') || s.includes('lanca') || s.includes('lança')) return 'Lançamento de Cabos'
  return 'Outros'
}
// item "driver" de cada pacote (carrega o quantitativo físico)
function isDriver(pac: string, code: string | null, nome: string | null, uni: string | null): boolean {
  const c = String(code ?? ''); const n = (nome ?? '').toLowerCase(); const u = (uni ?? '').toLowerCase()
  if (pac === 'Serv. Preliminares') return c.startsWith('1.6') || n.includes('topograf')
  if (pac === 'Canteiro e Mobiliz.') return c.startsWith('1.1') || n.includes('canteiro')
  if (pac === 'Fundações') return c.startsWith('2.11') || n.includes('tubul')
  if (pac === 'Montagem de Torres') return c.startsWith('4.2') || (n.includes('montagem') && u === 'ton')
  if (pac === 'Lançamento de Cabos') return c.startsWith('6.2') || ((n.includes('lanc') || n.includes('lança')) && u === 'km')
  if (pac === 'Administração Local') return c.startsWith('1.4') || n.includes('administ')
  return false
}
type ItemRow = { fluxo_os_id: string; subsec_codigo: string | null; subsec_nome: string | null; secao: string | null; unidade: string | null; quantidade: number | null; qty_acum: number | null; valor: number | null; valor_acum: number | null }

export function useEAPFinal(portfolioId?: string) {
  return useQuery<EAPPoloRaw[]>({
    queryKey: ['egp-eap-final', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data: polosD } = await supabase.from('pmo_projetos').select('id, nome, codigo, qtd_torres').eq('portfolio_id', portfolioId!)
      const polos = (polosD ?? []) as { id: string; nome: string; codigo: string | null; qtd_torres: number | null }[]
      if (!polos.length) return []
      const polosIds = polos.map(p => p.id)
      const { data: obrasD } = await supabase.from('sys_obras').select('id, nome, pmo_projeto_id').in('pmo_projeto_id', polosIds)
      const obra2polo = new Map((obrasD ?? []).map((o: Record<string, unknown>) => [o.id as string, o.pmo_projeto_id as string]))
      const obraNome = new Map((obrasD ?? []).map((o: Record<string, unknown>) => [o.id as string, o.nome as string]))
      const { data: oscsD } = await supabase.from('pmo_fluxo_os').select('id, numero_os, obra_id, valor, saldo_reais, etapa_atual, data_osc').eq('portfolio_id', portfolioId!)
      const oscs = (oscsD ?? []) as { id: string; numero_os: string; obra_id: string | null; valor: number | null; saldo_reais: number | null; etapa_atual: string; data_osc: string | null }[]
      const oscIds = oscs.map(o => o.id)
      let itens: ItemRow[] = []
      for (let i = 0; i < oscIds.length; i += 200) {
        const slice = oscIds.slice(i, i + 200)
        const { data } = await supabase.from('pmo_osc_itens').select('fluxo_os_id, subsec_codigo, subsec_nome, secao, unidade, quantidade, qty_acum, valor, valor_acum').in('fluxo_os_id', slice)
        itens = itens.concat((data ?? []) as ItemRow[])
      }
      // agrega itens por OSC → pacote (cru; agregação por polo é no cliente, respeitando a seleção)
      const byOsc = new Map<string, Record<string, PacAcc>>()
      for (const it of itens) {
        const pac = pacoteDe(it.subsec_codigo, it.secao)
        let m = byOsc.get(it.fluxo_os_id); if (!m) { m = {}; byOsc.set(it.fluxo_os_id, m) }
        let a = m[pac]; if (!a) { a = { valor: 0, fat: 0, qC: 0, qR: 0, uni: null }; m[pac] = a }
        a.valor += Number(it.valor ?? 0); a.fat += Number(it.valor_acum ?? 0)
        if (isDriver(pac, it.subsec_codigo, it.subsec_nome, it.unidade)) {
          a.qC += Number(it.quantidade ?? 0); a.qR += Number(it.qty_acum ?? 0); a.uni = it.unidade ?? a.uni
        }
      }
      return polos.map(p => ({
        id: p.id, label: p.nome, codigo: p.codigo, qtdTorres: p.qtd_torres,
        oscs: oscs.filter(o => (o.obra_id ? obra2polo.get(o.obra_id) : undefined) === p.id).map(o => ({
          id: o.id, numero_os: o.numero_os, obra_id: o.obra_id, obra_nome: o.obra_id ? (obraNome.get(o.obra_id) ?? '— Sem obra') : '— Sem obra',
          valor: Number(o.valor ?? 0), saldo_reais: o.saldo_reais, etapa_atual: o.etapa_atual, data_osc: o.data_osc,
          pacotes: byOsc.get(o.id) ?? {},
        })),
      }))
    },
  })
}

// agrega os polos crus respeitando a seleção de OSCs (excludedOscs = ids ocultados)
export function aggregatePolos(raws: EAPPoloRaw[], excludedOscs: Set<string>): EAPPolo[] {
  return raws.map(r => {
    const oscs = r.oscs.filter(o => o.etapa_atual !== 'cancelada' && !excludedOscs.has(o.id))
    const contr = oscs.reduce((s, o) => s + o.valor, 0)
    const fat = oscs.reduce((s, o) => s + (o.saldo_reais != null ? Math.max(0, o.valor - o.saldo_reais) : 0), 0)
    const m = new Map<string, PacAcc>()
    for (const o of oscs) for (const [pac, a] of Object.entries(o.pacotes)) {
      let x = m.get(pac); if (!x) { x = { valor: 0, fat: 0, qC: 0, qR: 0, uni: null }; m.set(pac, x) }
      x.valor += a.valor; x.fat += a.fat; x.qC += a.qC; x.qR += a.qR; if (a.uni) x.uni = a.uni
    }
    let montTon = 0
    const pacotes: EAPPacote[] = PACOTES_ORD.filter(n => m.has(n)).map(n => {
      const a = m.get(n)!
      if (n === 'Montagem de Torres') montTon = a.qC
      return { n, valor: a.valor, faturado: a.fat, pctFin: a.valor ? Math.round(a.fat / a.valor * 100) : 0, pctFis: a.qC > 0 ? Math.round(a.qR / a.qC * 100) : null, qtdContr: a.qC, qtdReal: a.qR, unidade: a.uni, isOutros: n === 'Outros' }
    })
    const wf = pacotes.filter(x => x.pctFis != null)
    const wsum = wf.reduce((s, x) => s + x.valor, 0)
    const pctFis = wsum ? Math.round(wf.reduce((s, x) => s + (x.pctFis as number) * x.valor, 0) / wsum) : 0
    const obrasMap = new Map<string, { id: string; numero_os: string }[]>()
    for (const o of oscs) { const k = o.obra_nome || '— Sem obra'; const a = obrasMap.get(k) ?? []; a.push({ id: o.id, numero_os: o.numero_os }); obrasMap.set(k, a) }
    const obras = [...obrasMap.entries()].map(([nome, list]) => ({ nome, oscs: list.sort((a, b) => a.numero_os.localeCompare(b.numero_os, undefined, { numeric: true })) })).sort((a, b) => a.nome.localeCompare(b.nome))
    return {
      id: r.id, label: r.label, codigo: r.codigo,
      contr, fat, saldo: contr - fat, pctFin: contr ? Math.round(fat / contr * 100) : 0,
      pctFis, qtdTorres: r.qtdTorres, montTon,
      nOscs: oscs.length, oscs: oscs.map(o => o.numero_os).sort(), obras, pacotes,
    }
  }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}
// fmtQ helper exposto p/ componente
export function fmtQtd(v: number, u: string | null): string | null {
  if (!u || !v) return null
  const s = v >= 1000 ? (v / 1000).toFixed(1) + 'k' : (Number.isInteger(v) ? String(v) : v.toFixed(1))
  return `${s} ${u}`
}

export function useUpdatePoloTorres(portfolioId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ poloId, torres }: { poloId: string; torres: number | null }) => {
      const { error } = await supabase.from('pmo_projetos').update({ qtd_torres: torres }).eq('id', poloId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['egp-eap-final', portfolioId] }) },
  })
}

// aplica medição: parse do espelho da OSC → casa itens por nome → grava valor_acum (medido)
export function useAplicarMedicao() {
  const qc = useQueryClient()
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  return useMutation({
    mutationFn: async ({ portfolio_id, parsed }: { portfolio_id: string; parsed: ParsedOSC }) => {
      const { data: itens, error } = await supabase.from('pmo_osc_itens')
        .select('id, subsec_nome').eq('numero_os', parsed.numero_os)
      if (error) throw error
      if (!itens?.length) throw new Error(`OSC ${parsed.numero_os} não tem itens cadastrados — cadastre a OSC antes`)
      const byNome = new Map((itens as { id: string; subsec_nome: string }[]).map(i => [norm(i.subsec_nome), i.id]))
      let upd = 0
      for (const pit of parsed.itens ?? []) {
        const id = byNome.get(norm(pit.item))
        if (id != null && pit.valor != null) {
          const { error: e2 } = await supabase.from('pmo_osc_itens').update({ valor_acum: pit.valor }).eq('id', id)
          if (!e2) upd++
        }
      }
      return { numero_os: parsed.numero_os, atualizados: upd, total: itens.length }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['egp-medicao-osc', vars.portfolio_id] })
      qc.invalidateQueries({ queryKey: ['egp-osc-itens'] })
    },
  })
}

export function useUpdateOSC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; portfolio_id: string } & Partial<EGPOscRow>) => {
      const { portfolio_id: _pf, ...fields } = patch as Record<string, unknown>
      const { error } = await supabase.from('pmo_fluxo_os').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['egp-oscs-portfolio', vars.portfolio_id] })
    },
  })
}

export function useAddOSC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { portfolio_id: string; obra_id: string; numero_os: string; tipo_servico?: string; observacoes?: string }) => {
      const { data, error } = await supabase
        .from('pmo_fluxo_os')
        .insert({ ...payload, etapa_atual: 'recebida' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['egp-oscs-portfolio', vars.portfolio_id] })
    },
  })
}

// parse do PDF de abertura da OSC via n8n (Gemini)
export interface ParsedOSC {
  numero_os: string
  trecho?: string
  valor?: number | null
  data_inicio?: string | null
  data_termino?: string | null
  tipo?: string | null
  itens?: { secao: string; item: string; unidade: string; quantidade: number; valor: number }[]
}
export async function parseOSCPdf(base64: string, mime: string): Promise<ParsedOSC> {
  const base = (import.meta.env.VITE_N8N_WEBHOOK_URL as string) || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'
  const resp = await fetch(`${base}/egp/parse-osc`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mime_type: mime }),
  })
  if (!resp.ok) throw new Error('Falha ao ler o PDF (parse)')
  const r = await resp.json()
  if (!r || !r.numero_os) throw new Error('Não consegui extrair a OSC do PDF')
  return r as ParsedOSC
}

export function useAddOSCFromParse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ portfolio_id, obra_id, parsed }: { portfolio_id: string; obra_id: string; parsed: ParsedOSC }) => {
      const { data: osc, error } = await supabase.from('pmo_fluxo_os').insert({
        portfolio_id, obra_id, numero_os: parsed.numero_os, etapa_atual: 'recebida',
        valor: parsed.valor ?? null, data_osc: parsed.data_inicio ?? null, vencimento: parsed.data_termino ?? null,
        tipo: parsed.tipo ?? null, tipo_servico: parsed.trecho ?? null,
      }).select('id').single()
      if (error) throw error
      const itens = (parsed.itens ?? []).filter(it => it.item).map(it => ({
        fluxo_os_id: osc.id, numero_os: parsed.numero_os, secao: it.secao || null, subsec_nome: it.item,
        unidade: it.unidade || null, quantidade: it.quantidade ?? null, valor: it.valor ?? null,
      }))
      if (itens.length) { const { error: e2 } = await supabase.from('pmo_osc_itens').insert(itens); if (e2) throw e2 }
      return osc
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['egp-oscs-portfolio', vars.portfolio_id] })
      qc.invalidateQueries({ queryKey: ['egp-obras-portfolio', vars.portfolio_id] })
    },
  })
}

export function useDeletarOSC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_fluxo_os').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['egp-oscs-portfolio', vars.portfolio_id] })
    },
  })
}

// cria obra (sys_obras) ligada a um projeto/polo, no contexto do EGP
export function useCriarObraEGP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { nome: string; codigo: string; pmo_projeto_id: string; portfolio_id: string }) => {
      const { data, error } = await supabase
        .from('sys_obras')
        .insert({ nome: payload.nome, codigo: payload.codigo, pmo_projeto_id: payload.pmo_projeto_id, status: 'ativa' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['egp-obras-portfolio', vars.portfolio_id] })
    },
  })
}

// ── TAP ──────────────────────────────────────────────────────────────────────

export function useTAP(portfolioId: string | undefined) {
  return useQuery<PMOTAP | null>({
    queryKey: ['pmo-tap', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_tap')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .single()
      if (error) return null
      return data as PMOTAP
    },
  })
}

export function useSalvarTAP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOTAP> & { portfolio_id: string }) => {
      const { data, error } = await supabase
        .from('pmo_tap')
        .upsert(payload, { onConflict: 'portfolio_id' })
        .select()
        .single()
      if (error) throw error
      return data as PMOTAP
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-tap', vars.portfolio_id] })
    },
  })
}

// ── EAP ──────────────────────────────────────────────────────────────────────

export function useEAP(portfolioId: string | undefined, projetoId?: string | null) {
  return useQuery<PMOEAP[]>({
    queryKey: ['pmo-eap', portfolioId, projetoId ?? 'all'],
    enabled: !!portfolioId,
    queryFn: async () => {
      let q = supabase
        .from('pmo_eap')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('ordem')
      if (projetoId) q = q.eq('projeto_id', projetoId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOEAP[]
    },
  })
}

// ── Tarefas (Cronograma) ─────────────────────────────────────────────────────

export function useTarefas(portfolioId: string | undefined, filters?: { status?: string }) {
  return useQuery<PMOTarefa[]>({
    queryKey: ['pmo-tarefas', portfolioId, filters],
    enabled: !!portfolioId,
    queryFn: async () => {
      let q = supabase
        .from('pmo_tarefas')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('ordem')
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOTarefa[]
    },
  })
}

export function useCriarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOTarefa>) => {
      const { data, error } = await supabase
        .from('pmo_tarefas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOTarefa
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-tarefas', vars.portfolio_id] })
    },
  })
}

export function useAtualizarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOTarefa> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_tarefas')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOTarefa
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-tarefas', d.portfolio_id] })
    },
  })
}

// ── Medicoes ─────────────────────────────────────────────────────────────────

export function useMedicaoResumo(portfolioId: string | undefined) {
  return useQuery<PMOMedicaoResumo | null>({
    queryKey: ['pmo-medicao-resumo', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_resumo')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .single()
      if (error) return null
      return data as PMOMedicaoResumo
    },
  })
}

export function useMedicaoPeriodos(resumoId: string | undefined) {
  return useQuery<PMOMedicaoPeriodo[]>({
    queryKey: ['pmo-medicao-periodos', resumoId],
    enabled: !!resumoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_periodo')
        .select('*')
        .eq('medicao_resumo_id', resumoId!)
        .order('periodo')
      if (error) return []
      return (data ?? []) as PMOMedicaoPeriodo[]
    },
  })
}

export function useMedicaoItens(portfolioId: string | undefined) {
  return useQuery<PMOMedicaoItem[]>({
    queryKey: ['pmo-medicao-itens', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_itens')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('numero_medicao')
      if (error) return []
      return (data ?? []) as PMOMedicaoItem[]
    },
  })
}

// ── Medicao Item Periodos ────────────────────────────────────────────────────

export function useMedicaoItemPeriodos(medicaoItemId: string | undefined) {
  return useQuery<PMOMedicaoItemPeriodo[]>({
    queryKey: ['pmo-medicao-item-periodos', medicaoItemId],
    enabled: !!medicaoItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_item_periodo')
        .select('*')
        .eq('medicao_item_id', medicaoItemId!)
        .order('periodo')
      if (error) return []
      return (data ?? []) as PMOMedicaoItemPeriodo[]
    },
  })
}

// ── Histograma ───────────────────────────────────────────────────────────────

export function useHistograma(portfolioId: string | undefined) {
  return useQuery<PMOHistograma[]>({
    queryKey: ['pmo-histograma', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_histograma')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('semana')
      if (error) return []
      return (data ?? []) as PMOHistograma[]
    },
  })
}

// ── Fluxo OS ─────────────────────────────────────────────────────────────────

export function useFluxoOS(portfolioId?: string) {
  return useQuery<PMOFluxoOS[]>({
    queryKey: ['pmo-fluxo-os', portfolioId],
    queryFn: async () => {
      let q = supabase
        .from('pmo_fluxo_os')
        .select('*')
        .order('created_at', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOFluxoOS[]
    },
  })
}

export function useAtualizarFluxoOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOFluxoOS> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_fluxo_os')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOFluxoOS
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pmo-fluxo-os'] })
    },
  })
}

// ── Status Report ────────────────────────────────────────────────────────────

export function useStatusReports(portfolioId: string | undefined) {
  return useQuery<PMOStatusReport[]>({
    queryKey: ['pmo-status-reports', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_status_report')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('data_report', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOStatusReport[]
    },
  })
}

// ── Multas ───────────────────────────────────────────────────────────────────

export function useMultas(portfolioId?: string) {
  return useQuery<PMOMulta[]>({
    queryKey: ['pmo-multas', portfolioId],
    queryFn: async () => {
      let q = supabase
        .from('pmo_multas')
        .select('*')
        .order('created_at', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOMulta[]
    },
  })
}

// ── Reunioes ─────────────────────────────────────────────────────────────────

export function useReunioes(portfolioId?: string) {
  return useQuery<PMOReuniao[]>({
    queryKey: ['pmo-reunioes', portfolioId],
    queryFn: async () => {
      let q = supabase
        .from('pmo_reunioes')
        .select('*')
        .order('data', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOReuniao[]
    },
  })
}

// ── Mudancas ─────────────────────────────────────────────────────────────────

export function useMudancas(portfolioId: string | undefined) {
  return useQuery<PMOMudanca[]>({
    queryKey: ['pmo-mudancas', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_mudancas')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('data_solicitacao', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOMudanca[]
    },
  })
}

// ── Indicadores Snapshot ─────────────────────────────────────────────────────

export function useIndicadores(portfolioId: string | undefined) {
  return useQuery<PMOIndicadoresSnapshot[]>({
    queryKey: ['pmo-indicadores', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_indicadores_snapshot')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('data_snapshot', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOIndicadoresSnapshot[]
    },
  })
}

// ── AI Generation Hooks ─────────────────────────────────────────────────────

export function useGerarTAPIA() {
  return useMutation({
    mutationFn: async (payload: {
      portfolio_id: string
      obra_nome: string
      numero_osc?: string
      resumo_osc?: string
      tipo_osc?: string
    }) => {
      const res = await fetch(`${N8N_BASE}/egp/gerar-tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao gerar TAP via IA')
      return res.json().catch(() => ({})) as Promise<Partial<PMOTAP>>
    },
  })
}

export function useGerarEAPIA() {
  return useMutation({
    mutationFn: async (payload: {
      portfolio_id: string
      obra_nome: string
      tap_dados?: Partial<PMOTAP>
    }) => {
      const res = await fetch(`${N8N_BASE}/egp/gerar-eap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao gerar EAP via IA')
      return res.json().catch(() => ([])) as Promise<Partial<PMOEAP>[]>
    },
  })
}

export function useGerarCronogramaIA() {
  return useMutation({
    mutationFn: async (payload: {
      portfolio_id: string
      obra_nome: string
      eap_itens?: PMOEAP[]
      tap_dados?: Partial<PMOTAP>
    }) => {
      const res = await fetch(`${N8N_BASE}/egp/gerar-cronograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao gerar cronograma via IA')
      return res.json().catch(() => ([])) as Promise<Partial<PMOTarefa>[]>
    },
  })
}

// ── Parse OSC (upload PDF → n8n → parsed data) ────────────────────────────

export interface OSCParsed {
  portfolio: Partial<PMOPortfolio>
  tap: Partial<PMOTAP>
}

export function useParseOSC() {
  return useMutation({
    mutationFn: async (payload: {
      file_base64?: string
      file_url?: string
      file_name: string
      mime_type: string
    }): Promise<OSCParsed> => {
      const res = await fetch(`${N8N_BASE}/egp/parse-osc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao processar OSC via IA')
      return res.json() as Promise<OSCParsed>
    },
  })
}

export function useConfirmarOSC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (parsed: OSCParsed) => {
      // 1) Create portfolio
      const { data: portfolio, error: errP } = await supabase
        .from('pmo_portfolio')
        .insert({
          ...parsed.portfolio,
          status: parsed.portfolio.status || 'em_analise_ate',
          valor_total_osc: parsed.portfolio.valor_total_osc || 0,
          valor_faturado: 0,
          custo_orcado: parsed.portfolio.custo_orcado || 0,
          custo_planejado: 0,
          custo_real: 0,
          multa_valor_estimado: 0,
        })
        .select()
        .single()
      if (errP) throw errP

      // 2) Create TAP linked to portfolio
      if (parsed.tap && Object.keys(parsed.tap).length > 0) {
        const { error: errT } = await supabase
          .from('pmo_tap')
          .insert({
            ...parsed.tap,
            portfolio_id: portfolio.id,
            status: 'rascunho',
            orcamento_total: parsed.tap.orcamento_total || 0,
          })
        if (errT) console.warn('Erro ao criar TAP:', errT.message)
      }

      return portfolio as PMOPortfolio
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pmo-portfolios'] })
    },
  })
}

// ── Stakeholders ────────────────────────────────────────────────────────────

export function useStakeholders(portfolioId: string | undefined) {
  return useQuery<PMOStakeholder[]>({
    queryKey: ['pmo-stakeholders', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_stakeholders')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOStakeholder[]
    },
  })
}

export function useCriarStakeholder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOStakeholder>) => {
      const { data, error } = await supabase
        .from('pmo_stakeholders')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOStakeholder
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-stakeholders', vars.portfolio_id] })
    },
  })
}

export function useAtualizarStakeholder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOStakeholder> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_stakeholders')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOStakeholder
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-stakeholders', d.portfolio_id] })
    },
  })
}

export function useDeletarStakeholder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_stakeholders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-stakeholders', vars.portfolio_id] })
    },
  })
}

// ── Comunicação ─────────────────────────────────────────────────────────────

export function useComunicacao(portfolioId: string | undefined) {
  return useQuery<PMOComunicacao[]>({
    queryKey: ['pmo-comunicacao', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_comunicacao')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOComunicacao[]
    },
  })
}

export function useCriarComunicacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOComunicacao>) => {
      const { data, error } = await supabase
        .from('pmo_comunicacao')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOComunicacao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-comunicacao', vars.portfolio_id] })
    },
  })
}

export function useAtualizarComunicacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOComunicacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_comunicacao')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOComunicacao
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-comunicacao', d.portfolio_id] })
    },
  })
}

export function useDeletarComunicacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_comunicacao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-comunicacao', vars.portfolio_id] })
    },
  })
}

// ── Orçamento ───────────────────────────────────────────────────────────────

export function useOrcamento(portfolioId: string | undefined) {
  return useQuery<PMOOrcamento[]>({
    queryKey: ['pmo-orcamento', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_orcamento')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOOrcamento[]
    },
  })
}

export function useCriarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOOrcamento>) => {
      const { data, error } = await supabase
        .from('pmo_orcamento')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOOrcamento
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-orcamento', vars.portfolio_id] })
    },
  })
}

export function useAtualizarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOOrcamento> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_orcamento')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOOrcamento
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-orcamento', d.portfolio_id] })
    },
  })
}

export function useDeletarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_orcamento').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-orcamento', vars.portfolio_id] })
    },
  })
}

// ── Riscos EGP ──────────────────────────────────────────────────────────────

export function useRiscosEGP(portfolioId: string | undefined) {
  return useQuery<PMORisco[]>({
    queryKey: ['pmo-riscos', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_riscos')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMORisco[]
    },
  })
}

export function useCriarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMORisco>) => {
      const { data, error } = await supabase
        .from('pmo_riscos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMORisco
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-riscos', vars.portfolio_id] })
    },
  })
}

export function useAtualizarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMORisco> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_riscos')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMORisco
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-riscos', d.portfolio_id] })
    },
  })
}

export function useDeletarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_riscos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-riscos', vars.portfolio_id] })
    },
  })
}

// ── Plano de Ação ───────────────────────────────────────────────────────────

export function usePlanoAcao(portfolioId: string | undefined) {
  return useQuery<PMOPlanoAcao[]>({
    queryKey: ['pmo-plano-acao', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_plano_acao')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOPlanoAcao[]
    },
  })
}

export function useCriarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOPlanoAcao>) => {
      const { data, error } = await supabase
        .from('pmo_plano_acao')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOPlanoAcao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-plano-acao', vars.portfolio_id] })
    },
  })
}

export function useAtualizarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOPlanoAcao> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_plano_acao')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOPlanoAcao
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-plano-acao', d.portfolio_id] })
    },
  })
}

export function useDeletarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_plano_acao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-plano-acao', vars.portfolio_id] })
    },
  })
}

// ── Entregáveis ─────────────────────────────────────────────────────────────

export function useEntregaveis(portfolioId: string | undefined) {
  return useQuery<PMOEntregavel[]>({
    queryKey: ['pmo-entregaveis', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_entregaveis')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOEntregavel[]
    },
  })
}

export function useCriarEntregavel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOEntregavel>) => {
      const { data, error } = await supabase
        .from('pmo_entregaveis')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOEntregavel
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-entregaveis', vars.portfolio_id] })
    },
  })
}

export function useAtualizarEntregavel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOEntregavel> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_entregaveis')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOEntregavel
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-entregaveis', d.portfolio_id] })
    },
  })
}

export function useDeletarEntregavel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_entregaveis').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-entregaveis', vars.portfolio_id] })
    },
  })
}

// ── Documentos EGP ──────────────────────────────────────────────────────────

export function useDocumentosEGP(portfolioId: string | undefined) {
  return useQuery<PMODocumento[]>({
    queryKey: ['pmo-documentos', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_documentos')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMODocumento[]
    },
  })
}

export function useCriarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMODocumento>) => {
      const { data, error } = await supabase
        .from('pmo_documentos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMODocumento
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-documentos', vars.portfolio_id] })
    },
  })
}

export function useAtualizarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMODocumento> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_documentos')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMODocumento
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-documentos', d.portfolio_id] })
    },
  })
}

export function useDeletarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_documentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-documentos', vars.portfolio_id] })
    },
  })
}

// ── Avanço Físico ───────────────────────────────────────────────────────────

export function useAvancoFisico(portfolioId: string | undefined) {
  return useQuery<PMOAvancoFisico[]>({
    queryKey: ['pmo-avanco-fisico', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_avanco_fisico')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOAvancoFisico[]
    },
  })
}

export function useCriarAvanco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOAvancoFisico>) => {
      const { data, error } = await supabase
        .from('pmo_avanco_fisico')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOAvancoFisico
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-avanco-fisico', vars.portfolio_id] })
    },
  })
}

export function useDeletarAvanco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_avanco_fisico').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-avanco-fisico', vars.portfolio_id] })
    },
  })
}

// ── Lições Aprendidas ───────────────────────────────────────────────────────

export function useLicoesAprendidas(portfolioId: string | undefined) {
  return useQuery<PMOLicaoAprendida[]>({
    queryKey: ['pmo-licoes', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_licoes_aprendidas')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOLicaoAprendida[]
    },
  })
}

export function useCriarLicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOLicaoAprendida>) => {
      const { data, error } = await supabase
        .from('pmo_licoes_aprendidas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOLicaoAprendida
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-licoes', vars.portfolio_id] })
    },
  })
}

export function useAtualizarLicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOLicaoAprendida> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_licoes_aprendidas')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOLicaoAprendida
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-licoes', d.portfolio_id] })
    },
  })
}

export function useDeletarLicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_licoes_aprendidas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-licoes', vars.portfolio_id] })
    },
  })
}

// ── Aceite ──────────────────────────────────────────────────────────────────

export function useAceite(portfolioId: string | undefined) {
  return useQuery<PMOAceite | null>({
    queryKey: ['pmo-aceite', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_aceite')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .single()
      if (error) return null
      return data as PMOAceite
    },
  })
}

export function useSalvarAceite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOAceite> & { portfolio_id: string }) => {
      const { data, error } = await supabase
        .from('pmo_aceite')
        .upsert(payload, { onConflict: 'portfolio_id' })
        .select()
        .single()
      if (error) throw error
      return data as PMOAceite
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-aceite', vars.portfolio_id] })
    },
  })
}

export function useAtualizarAceite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOAceite> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_aceite')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOAceite
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-aceite', d.portfolio_id] })
    },
  })
}

// ── Desmobilização ──────────────────────────────────────────────────────────

export function useDesmobilizacao(portfolioId: string | undefined) {
  return useQuery<PMODesmobilizacao[]>({
    queryKey: ['pmo-desmobilizacao', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_desmobilizacao')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMODesmobilizacao[]
    },
  })
}

export function useCriarDesmob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMODesmobilizacao>) => {
      const { data, error } = await supabase
        .from('pmo_desmobilizacao')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMODesmobilizacao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-desmobilizacao', vars.portfolio_id] })
    },
  })
}

export function useAtualizarDesmob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMODesmobilizacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_desmobilizacao')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMODesmobilizacao
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-desmobilizacao', d.portfolio_id] })
    },
  })
}

export function useDeletarDesmob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_desmobilizacao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-desmobilizacao', vars.portfolio_id] })
    },
  })
}
