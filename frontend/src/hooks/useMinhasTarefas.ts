import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Types ───────────────────────────────────────────────────────────────────────

export type ModuloTarefa =
  | 'compras'
  | 'financeiro'
  | 'locacao'
  | 'estoque'
  | 'contratos'
  | 'despesas'
  | 'transporte'

export interface Tarefa {
  id: string
  modulo: ModuloTarefa
  moduloLabel: string
  tipo: string // ex: "Aprovação", "Cotação", "Vistoria"
  numero: string
  titulo: string
  descricao?: string
  prioridade: 'alta' | 'normal' | 'baixa'
  criadoEm: string
  link: string // rota para onde navegar ao clicar
}

const MODULO_LABEL: Record<ModuloTarefa, string> = {
  compras: 'Compras',
  financeiro: 'Financeiro',
  locacao: 'Locacao',
  estoque: 'Estoque',
  contratos: 'Contratos',
  despesas: 'Despesas',
  transporte: 'Transporte',
}

// ── Hook principal ──────────────────────────────────────────────────────────────

export function useMinhasTarefas() {
  const { perfil } = useAuth()
  const authId = perfil?.auth_id
  const email = perfil?.email?.toLowerCase()
  const enabled = !!authId

  return useQuery<Tarefa[]>({
    queryKey: ['minhas-tarefas', authId],
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      if (!authId) return []

      const tarefas: Tarefa[] = []

      // 1. Aprovacoes pendentes via apr_aprovacoes (aprovador = eu)
      if (email) {
        const { data: aprs } = await supabase
          .from('apr_aprovacoes')
          .select('id, entidade_id, entidade_numero, modulo, tipo_aprovacao, created_at')
          .eq('status', 'pendente')
          .ilike('aprovador_email', email)
          .order('created_at', { ascending: false })

        for (const a of aprs ?? []) {
          const tipo = String(a.tipo_aprovacao ?? '').replace(/_/g, ' ')
          const modulo = mapModulo(a.modulo as string | null)
          tarefas.push({
            id: `apr-${a.id}`,
            modulo,
            moduloLabel: MODULO_LABEL[modulo],
            tipo: `Aprovacao — ${tipo}`,
            numero: (a.entidade_numero as string) || 'N/A',
            titulo: humanTipoAprovacao(a.tipo_aprovacao as string),
            prioridade: 'alta',
            criadoEm: a.created_at as string,
            link: aprovacaoLink(a.tipo_aprovacao as string, a.entidade_id as string),
          })
        }
      }

      // 2. Cotacoes atribuidas a mim (comprador)
      const { data: cotacoes } = await supabase
        .from('cmp_cotacoes')
        .select('id, requisicao_id, status, created_at, cmp_requisicoes(numero, descricao)')
        .eq('comprador_id', authId)
        .in('status', ['pendente', 'em_andamento'])
        .order('created_at', { ascending: false })

      for (const c of cotacoes ?? []) {
        const req = (c as { cmp_requisicoes?: { numero?: string; descricao?: string } }).cmp_requisicoes
        tarefas.push({
          id: `cot-${c.id}`,
          modulo: 'compras',
          moduloLabel: MODULO_LABEL.compras,
          tipo: 'Cotacao',
          numero: req?.numero || 'N/A',
          titulo: req?.descricao || 'Cotar itens da requisicao',
          prioridade: 'normal',
          criadoEm: c.created_at as string,
          link: `/compras/cotacoes/${c.id}`,
        })
      }

      // 3. Esclarecimentos solicitados a mim (minhas requisicoes em_esclarecimento)
      const { data: esclRcs } = await supabase
        .from('cmp_requisicoes')
        .select('id, numero, descricao, status, updated_at')
        .eq('solicitante_id', authId)
        .eq('status', 'em_esclarecimento')
        .order('updated_at', { ascending: false })

      for (const r of esclRcs ?? []) {
        tarefas.push({
          id: `esclrc-${r.id}`,
          modulo: 'compras',
          moduloLabel: MODULO_LABEL.compras,
          tipo: 'Esclarecimento',
          numero: r.numero as string,
          titulo: 'Requisicao precisa de esclarecimento',
          descricao: r.descricao as string | undefined,
          prioridade: 'alta',
          criadoEm: r.updated_at as string,
          link: `/compras/requisicoes`,
        })
      }

      // 4. Vistorias de locacao atribuidas a mim
      const { data: vistorias } = await supabase
        .from('loc_vistorias')
        .select('id, tipo, status, created_at, imovel:loc_imoveis(descricao, endereco, cidade)')
        .eq('responsavel_id', authId)
        .in('status', ['pendente', 'em_andamento'])
        .order('created_at', { ascending: false })

      for (const v of vistorias ?? []) {
        const imo = (v as { imovel?: { descricao?: string; endereco?: string; cidade?: string } }).imovel
        const end = imo?.endereco || imo?.descricao || 'Imovel'
        tarefas.push({
          id: `vist-${v.id}`,
          modulo: 'locacao',
          moduloLabel: MODULO_LABEL.locacao,
          tipo: `Vistoria ${v.tipo as string}`,
          numero: (v.id as string).slice(0, 8).toUpperCase(),
          titulo: `${end}${imo?.cidade ? ` — ${imo.cidade}` : ''}`,
          prioridade: 'normal',
          criadoEm: v.created_at as string,
          link: `/locacao`,
        })
      }

      // 5. Entradas de imoveis atribuidas a mim
      const { data: entradas } = await supabase
        .from('loc_entradas')
        .select('id, numero, status, endereco, cidade, created_at')
        .eq('responsavel_id', authId)
        .in('status', ['pendente', 'aguardando_vistoria', 'aguardando_assinatura'])
        .order('created_at', { ascending: false })

      for (const e of entradas ?? []) {
        tarefas.push({
          id: `ent-${e.id}`,
          modulo: 'locacao',
          moduloLabel: MODULO_LABEL.locacao,
          tipo: `Entrada de imovel (${formatStatus(e.status as string)})`,
          numero: (e.numero as string) || 'N/A',
          titulo: `${e.endereco || 'Imovel'}${e.cidade ? ` — ${e.cidade}` : ''}`,
          prioridade: 'normal',
          criadoEm: e.created_at as string,
          link: `/locacao/entradas`,
        })
      }

      // 6. Saidas de imoveis atribuidas a mim
      const { data: saidas } = await supabase
        .from('loc_saidas')
        .select('id, status, created_at, imovel:loc_imoveis(descricao, endereco, cidade)')
        .eq('responsavel_id', authId)
        .in('status', ['pendente', 'aguardando_vistoria', 'solucionando_pendencias', 'encerramento_contratual'])
        .order('created_at', { ascending: false })

      for (const s of saidas ?? []) {
        const imo = (s as { imovel?: { descricao?: string; endereco?: string; cidade?: string } }).imovel
        tarefas.push({
          id: `sai-${s.id}`,
          modulo: 'locacao',
          moduloLabel: MODULO_LABEL.locacao,
          tipo: `Saida de imovel (${formatStatus(s.status as string)})`,
          numero: (s.id as string).slice(0, 8).toUpperCase(),
          titulo: `${imo?.endereco || imo?.descricao || 'Imovel'}${imo?.cidade ? ` — ${imo.cidade}` : ''}`,
          prioridade: 'normal',
          criadoEm: s.created_at as string,
          link: `/locacao/saidas`,
        })
      }

      // 7. Solicitacoes de locacao atribuidas a mim
      const { data: locSols } = await supabase
        .from('loc_solicitacoes')
        .select('id, titulo, tipo, urgencia, status, created_at')
        .eq('responsavel_id', authId)
        .in('status', ['aberta', 'em_andamento'])
        .order('created_at', { ascending: false })

      for (const s of locSols ?? []) {
        const urg = s.urgencia as string | undefined
        const prio: Tarefa['prioridade'] = urg === 'urgente' || urg === 'alta' ? 'alta' : 'normal'
        tarefas.push({
          id: `locsol-${s.id}`,
          modulo: 'locacao',
          moduloLabel: MODULO_LABEL.locacao,
          tipo: `Solicitacao ${s.tipo as string}`,
          numero: (s.id as string).slice(0, 8).toUpperCase(),
          titulo: s.titulo as string,
          prioridade: prio,
          criadoEm: s.created_at as string,
          link: `/locacao`,
        })
      }

      // 8. Cautelas pendentes de aprovacao por mim
      const { data: cautelas } = await supabase
        .from('est_cautelas')
        .select('id, numero, status, created_at, solicitante_nome, obra_nome')
        .eq('aprovador_id', authId)
        .in('status', ['pendente', 'aguardando_aprovacao'])
        .order('created_at', { ascending: false })

      for (const c of cautelas ?? []) {
        tarefas.push({
          id: `cau-${c.id}`,
          modulo: 'estoque',
          moduloLabel: MODULO_LABEL.estoque,
          tipo: 'Cautela — Aprovar',
          numero: (c.numero as string) || 'N/A',
          titulo: `${(c as { solicitante_nome?: string }).solicitante_nome || 'Colaborador'}${(c as { obra_nome?: string }).obra_nome ? ` — ${(c as { obra_nome?: string }).obra_nome}` : ''}`,
          prioridade: 'normal',
          criadoEm: c.created_at as string,
          link: `/estoque/cautelas/${c.id}`,
        })
      }

      // 9. Adiantamentos para aprovar (gestor = eu)
      const { data: adtos } = await supabase
        .from('desp_adiantamentos')
        .select('id, numero, status, valor, created_at, solicitante_nome')
        .eq('gestor_id', authId)
        .in('status', ['aguardando_aprovacao', 'pendente'])
        .order('created_at', { ascending: false })

      for (const a of adtos ?? []) {
        tarefas.push({
          id: `adto-${a.id}`,
          modulo: 'despesas',
          moduloLabel: MODULO_LABEL.despesas,
          tipo: 'Adiantamento — Aprovar',
          numero: (a.numero as string) || 'N/A',
          titulo: `${(a as { solicitante_nome?: string }).solicitante_nome || 'Colaborador'}${a.valor ? ` — R$ ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}`,
          prioridade: 'normal',
          criadoEm: a.created_at as string,
          link: `/despesas/adiantamentos`,
        })
      }

      // Sort: high priority first, then by date desc
      tarefas.sort((a, b) => {
        const p: Record<Tarefa['prioridade'], number> = { alta: 0, normal: 1, baixa: 2 }
        if (p[a.prioridade] !== p[b.prioridade]) return p[a.prioridade] - p[b.prioridade]
        return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
      })

      return tarefas
    },
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function mapModulo(m: string | null): ModuloTarefa {
  switch (m) {
    case 'cmp': return 'compras'
    case 'fin': return 'financeiro'
    case 'con': return 'contratos'
    case 'log': return 'transporte'
    case 'loc': return 'locacao'
    case 'est': return 'estoque'
    case 'desp': return 'despesas'
    default: return 'compras'
  }
}

function humanTipoAprovacao(tipo: string): string {
  const map: Record<string, string> = {
    requisicao_compra:    'Requisicao de compra aguardando sua aprovacao',
    cotacao:              'Cotacao aguardando sua aprovacao',
    minuta_contratual:    'Minuta contratual aguardando sua aprovacao',
    autorizacao_pagamento:'Autorizacao de pagamento aguardando sua aprovacao',
    aprovacao_transporte: 'Solicitacao de transporte aguardando sua aprovacao',
  }
  return map[tipo] || 'Aprovacao pendente'
}

function aprovacaoLink(tipo: string, _entidadeId: string): string {
  // Rota onde o usuario pode executar a aprovacao
  switch (tipo) {
    case 'requisicao_compra':     return '/aprovai'
    case 'cotacao':               return '/aprovai'
    case 'minuta_contratual':     return '/aprovai'
    case 'autorizacao_pagamento': return '/aprovai'
    case 'aprovacao_transporte':  return '/aprovai'
    default:                      return '/aprovai'
  }
}

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ')
}
