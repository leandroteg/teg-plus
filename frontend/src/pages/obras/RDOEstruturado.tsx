// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/RDOEstruturado.tsx — Modal de RDO baseado na matriz do
// Planejamento Técnico. Registra, por estrutura × atividade, o avanço do dia;
// a equipe (pré-preenchida da Alocação de Equipes) e os recursos/frota
// (pré-preenchidos da Alocação de Recursos).
// Ao salvar: grava obr_rdo + obr_rdo_avanco/equipe/recurso E propaga o avanço
// para obr_atividade_avanco (a matriz do Planejamento) — RDO alimenta o plano.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Users, Truck, ClipboardList, Check, Save, ChevronDown, ChevronUp, ChevronRight, Plus, AlertTriangle, Camera } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useCatalogoAtividades, coresDoCatalogo } from './catalogoAtividades'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'

// Catálogo padronizado de eventos do RDO → permite filtrar/contar por obra.
// O texto livre continua existindo, como complemento da descrição.
export const EVENTO_TIPOS: { grupo: string; itens: { v: string; l: string }[] }[] = [
  { grupo: 'Clima', itens: [
    { v: 'clima_chuva', l: 'Chuva' }, { v: 'clima_solo', l: 'Solo encharcado' },
    { v: 'clima_vento', l: 'Vento forte' }, { v: 'clima_descarga', l: 'Descarga atmosférica' } ] },
  { grupo: 'Fundiário / acesso', itens: [
    { v: 'fund_proprietario', l: 'Proprietário não autoriza' }, { v: 'fund_acesso', l: 'Acesso interditado' },
    { v: 'fund_faixa', l: 'Faixa não liberada' }, { v: 'fund_benfeitoria', l: 'Benfeitoria a indenizar' } ] },
  { grupo: 'Material', itens: [
    { v: 'mat_falta', l: 'Falta de material' }, { v: 'mat_avaria', l: 'Material avariado' },
    { v: 'mat_fornecedor', l: 'Atraso do fornecedor' } ] },
  { grupo: 'Equipamento', itens: [
    { v: 'eqp_quebra', l: 'Quebra' }, { v: 'eqp_manutencao', l: 'Manutenção' },
    { v: 'eqp_indisponivel', l: 'Indisponível' } ] },
  { grupo: 'Equipe', itens: [
    { v: 'eqe_efetivo', l: 'Efetivo insuficiente' }, { v: 'eqe_lideranca', l: 'Falta de encarregado' },
    { v: 'eqe_documento', l: 'Treinamento/ASO vencido' } ] },
  { grupo: 'Cliente / CEMIG', itens: [
    { v: 'cli_desligamento', l: 'Desligamento não liberado' }, { v: 'cli_projeto', l: 'Projeto em revisão' },
    { v: 'cli_fiscal', l: 'Aguardando fiscal' } ] },
  { grupo: 'QSMA', itens: [
    { v: 'qsma_interdicao', l: 'Interdição QSMA' }, { v: 'qsma_incidente', l: 'Incidente' },
    { v: 'qsma_licenca', l: 'Licença/condicionante' } ] },
  { grupo: 'Outros', itens: [{ v: 'outro', l: 'Outro' }] },
]
export const EVENTO_LABEL: Record<string, string> =
  Object.fromEntries(EVENTO_TIPOS.flatMap(g => g.itens.map(i => [i.v, `${g.grupo} · ${i.l}`])))

const NATUREZAS = [
  { v: 'impeditivo', l: 'Impeditivo' },
  { v: 'ocorrencia', l: 'Ocorrência' },
  { v: 'improdutividade', l: 'Improdutividade' },
] as const
interface EventoRDO { natureza: string; tipo: string; horas: string; descricao: string; fotos: File[] }

// valores aceitos pelo CHECK de obr_rdo.condicao_climatica — não inventar outros
const CLIMAS = [
  { v: 'sol', l: 'Sol' },
  { v: 'nublado', l: 'Nublado' },
  { v: 'chuva', l: 'Chuva' },
  { v: 'chuva_forte', l: 'Chuva forte' },
  { v: 'tempestade', l: 'Tempestade' },
] as const

interface Estrutura { id: string; nome: string; tipo: string | null }

// equipe alocada na obra (obr_planejamento_equipe → rh_colaboradores)
function useEquipeDaObra(obraId?: string) {
  return useQuery<{ colaborador_id: string | null; nome: string; funcao: string | null }[]>({
    queryKey: ['rdo-equipe-obra', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_planejamento_equipe')
        .select('colaborador_id, nome, funcao, papel, status').eq('obra_id', obraId!)
        .in('status', ['planejado', 'mobilizado', 'ativo'])
      return (data ?? []).map(r => ({
        colaborador_id: (r.colaborador_id as string) ?? null,
        nome: String(r.nome ?? ''),
        funcao: (r.funcao as string) ?? (r.papel as string) ?? null,
      })).filter(r => r.nome)
    },
  })
}
// recursos alocados na obra (fro_alocacoes ativas → fro_veiculos)
function useRecursosDaObra(obraId?: string) {
  return useQuery<{ veiculo_id: string; descricao: string }[]>({
    queryKey: ['rdo-recursos-obra', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data: alocs } = await supabase.from('fro_alocacoes').select('veiculo_id').eq('obra_id', obraId!).eq('status', 'ativa')
      const ids = [...new Set((alocs ?? []).map(a => a.veiculo_id as string).filter(Boolean))]
      if (!ids.length) return []
      const { data: veics } = await supabase.from('fro_veiculos').select('id, placa, marca, modelo, categoria, codigo_interno').in('id', ids)
      return (veics ?? []).map(v => ({
        veiculo_id: String(v.id),
        descricao: [v.placa || v.codigo_interno, [v.marca, v.modelo].filter(Boolean).join(' '), v.categoria].filter(Boolean).join(' · '),
      }))
    },
  })
}
// catálogo completo pra adicionar quem não está alocado
function useColaboradoresAtivos() {
  return useQuery<{ id: string; nome: string; cargo: string | null }[]>({
    queryKey: ['rdo-colabs-ativos'],
    queryFn: async () => {
      const { data } = await supabase.from('rh_colaboradores').select('id, nome, cargo').eq('ativo', true).is('data_demissao', null).order('nome')
      return (data ?? []) as never
    },
    staleTime: 5 * 60_000,
  })
}
// TSTs do headcount (RH) — cargo de segurança do trabalho
function useTSTs() {
  return useQuery<{ id: string; nome: string; cargo: string | null }[]>({
    queryKey: ['rdo-tsts'],
    queryFn: async () => {
      const { data } = await supabase.from('rh_colaboradores')
        .select('id, nome, cargo').eq('ativo', true)
        .or('cargo.ilike.%SEGURAN%,cargo.ilike.%TST%').order('nome')
      return (data ?? []) as { id: string; nome: string; cargo: string | null }[]
    },
    staleTime: 10 * 60_000,
  })
}

function useVeiculosAtivos() {
  return useQuery<{ id: string; descricao: string }[]>({
    queryKey: ['rdo-veiculos-ativos'],
    queryFn: async () => {
      const { data } = await supabase.from('fro_veiculos').select('id, placa, marca, modelo, categoria, codigo_interno').order('placa')
      return (data ?? []).map(v => ({ id: String(v.id), descricao: [v.placa || v.codigo_interno, [v.marca, v.modelo].filter(Boolean).join(' '), v.categoria].filter(Boolean).join(' · ') }))
    },
    staleTime: 5 * 60_000,
  })
}

export default function RDOEstruturado({ obraId, obraNome, onClose, obras, onObraChange, rdoId: rdoIdProp }: {
  obraId: string; obraNome: string; onClose: () => void
  /** quando presente, edita um RDO existente (carrega e ATUALIZA em vez de criar) */
  rdoId?: string
  /** lista p/ trocar a obra sem sair do modal (opcional) */
  obras?: { id: string; nome: string; projeto_id: string | null; projeto_nome: string }[]
  onObraChange?: (id: string) => void
}) {
  // Projeto filtra a obra — escolher a frente primeiro encurta muito a lista
  const [projSel, setProjSel] = useState('')
  const projetosOpts = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of obras ?? []) if (o.projeto_id) m.set(o.projeto_id, o.projeto_nome)
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [obras])
  const obrasOpts = useMemo(
    () => (obras ?? []).filter(o => !projSel || o.projeto_id === projSel),
    [obras, projSel],
  )
  // obra atual saiu do filtro → cai na primeira do projeto escolhido
  useEffect(() => {
    if (projSel && obrasOpts.length && !obrasOpts.some(o => o.id === obraId)) onObraChange?.(obrasOpts[0].id)
  }, [projSel, obrasOpts, obraId, onObraChange])
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const qc = useQueryClient()

  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [clima, setClima] = useState<typeof CLIMAS[number]['v']>('sol')
  const [resumo, setResumo] = useState('')
  const [horasImp, setHorasImp] = useState('0')
  const [motivoImp, setMotivoImp] = useState('')
  // cabeçalho do padrão "Modelo RDOs" (CEMIG)
  const [fiscais, setFiscais] = useState<string[]>([])
  const [addFiscal, setAddFiscal] = useState('')
  const [tstSel, setTstSel] = useState<{ id: string; nome: string }[]>([])
  const [eventos, setEventos] = useState<EventoRDO[]>([])
  const [notas, setNotas] = useState('')
  // seções (frentes) da matriz de avanço — começam FECHADAS
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const togSecao = (k: string) => setAbertas(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const [aba, setAba] = useState<'avanco' | 'equipe' | 'recursos'>('avanco')
  // no MOBILE o cabeçalho do dia começa recolhido (no desktop aparece sempre)
  const [detDia, setDetDia] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: estruturas = [] } = useQuery<Estrutura[]>({
    queryKey: ['obr-estruturas', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_estruturas').select('id, nome, tipo').eq('obra_id', obraId).order('ordem').order('nome')
      return (data ?? []) as Estrutura[]
    },
  })
  // situação atual da matriz (pra mostrar o que já está feito)
  const { data: matriz = [] } = useQuery<{ estrutura_id: string; atividade: string; avanco: number }[]>({
    queryKey: ['obr-ativ-avanco', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_atividade_avanco').select('estrutura_id, atividade, avanco').eq('obra_id', obraId)
      return (data ?? []) as never
    },
  })
  const atual = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of matriz) m.set(`${c.estrutura_id}|${c.atividade}`, Number(c.avanco))
    return m
  }, [matriz])

  const { data: equipeAloc = [] } = useEquipeDaObra(obraId)
  const { data: recursosAloc = [] } = useRecursosDaObra(obraId)
  const { data: colabs = [] } = useColaboradoresAtivos()
  const { data: veiculos = [] } = useVeiculosAtivos()
  const { data: tsts = [] } = useTSTs()

  // ── modo edição: carrega o RDO existente e seus filhos ──────────────────────
  const { data: edicao } = useQuery({
    queryKey: ['rdo-edicao', rdoIdProp],
    enabled: !!rdoIdProp,
    queryFn: async () => {
      const [cab, av, ev, eq, rc] = await Promise.all([
        supabase.from('obr_rdo').select('*').eq('id', rdoIdProp!).single(),
        supabase.from('obr_rdo_avanco').select('estrutura_id, atividade, avanco').eq('rdo_id', rdoIdProp!),
        supabase.from('obr_rdo_eventos').select('natureza, tipo, horas_perdidas, descricao').eq('rdo_id', rdoIdProp!),
        supabase.from('obr_rdo_equipe').select('colaborador_id, nome, funcao, presente').eq('rdo_id', rdoIdProp!),
        supabase.from('obr_rdo_recurso').select('veiculo_id, descricao, operando').eq('rdo_id', rdoIdProp!),
      ])
      return { cab: cab.data, av: av.data ?? [], ev: ev.data ?? [], eq: eq.data ?? [], rc: rc.data ?? [] }
    },
  })
  useEffect(() => {
    if (!edicao?.cab) return
    const c = edicao.cab as Record<string, unknown>
    setData((c.data as string) ?? new Date().toISOString().slice(0, 10))
    setClima((c.condicao_climatica as never) ?? 'sol')
    setResumo((c.resumo_atividades as string) ?? '')
    setHorasImp(String(c.horas_improdutivas ?? '0'))
    setMotivoImp((c.motivo_improdutividade as string) ?? '')
    setNotas((c.notas as string) ?? '')
    setFiscais((c.fiscais_cemig as string[]) ?? ((c.fiscal_cemig as string) ? [(c.fiscal_cemig as string)] : []))
    const ids = (c.tst_ids as string[]) ?? [], nomes = (c.tst_nomes as string[]) ?? []
    setTstSel(ids.map((id, i) => ({ id, nome: nomes[i] ?? '' })))
    setEventos(edicao.ev.map(e => ({ natureza: e.natureza as string, tipo: e.tipo as string, horas: String(e.horas_perdidas ?? ''), descricao: (e.descricao as string) ?? '', fotos: [] })))
    setAvancos(Object.fromEntries(edicao.av.map(a => [`${a.estrutura_id}|${a.atividade}`, Number(a.avanco)])))
    setEquipe(Object.fromEntries(edicao.eq.filter(e => e.colaborador_id).map(e => [e.colaborador_id as string, { nome: e.nome as string, funcao: e.funcao as string | null, presente: e.presente as boolean }])))
    setRecursos(Object.fromEntries(edicao.rc.map(r => [r.veiculo_id as string, { descricao: r.descricao as string, operando: r.operando as boolean }])))
  }, [edicao])
  const { data: CATALOGO_RDO = [] } = useCatalogoAtividades(obraId)
  const SECAO_COR_RDO = useMemo(() => coresDoCatalogo(CATALOGO_RDO), [CATALOGO_RDO])

  // TST já alocado nesta obra vem marcado sozinho
  useEffect(() => {
    if (!tsts.length || !equipeAloc.length) return
    const ids = new Set(tsts.map(t => t.id))
    const naObra = equipeAloc.filter(e => e.colaborador_id && ids.has(e.colaborador_id))
      .map(e => ({ id: e.colaborador_id!, nome: e.nome }))
    if (naObra.length) setTstSel(prev => prev.length ? prev : naObra)
  }, [tsts, equipeAloc])

  // avanços informados hoje: chave estrutura|atividade → 0..1
  const [avancos, setAvancos] = useState<Record<string, number>>({})
  // equipe/recursos marcados (pré-preenchidos pela alocação)
  const [equipe, setEquipe] = useState<Record<string, { nome: string; funcao: string | null; presente: boolean }>>({})
  const [recursos, setRecursos] = useState<Record<string, { descricao: string; operando: boolean }>>({})
  const [fotosAtiv, setFotosAtiv] = useState<Record<string, File[]>>({})
  const [addColab, setAddColab] = useState('')
  const [addVeic, setAddVeic] = useState('')

  // trocou de obra → zera tudo que é da obra (senão fica a equipe/recurso da anterior)
  useEffect(() => {
    if (rdoIdProp) return   // em edição a obra é fixa; não zera o que foi hidratado
    setEquipe({}); setRecursos({}); setAvancos({}); setFotosAtiv({}); setTstSel([]); setAbertas(new Set())
  }, [obraId, rdoIdProp])
  useEffect(() => {
    setEquipe(Object.fromEntries(
      equipeAloc.filter(e => e.colaborador_id).map(e => [e.colaborador_id!, { nome: e.nome, funcao: e.funcao, presente: true }])))
  }, [equipeAloc])
  useEffect(() => {
    setRecursos(Object.fromEntries(
      recursosAloc.map(r => [r.veiculo_id, { descricao: r.descricao, operando: true }])))
  }, [recursosAloc])

  const setAv = (k: string, v: number) => setAvancos(a => ({ ...a, [k]: v }))
  const nEquipe = Object.values(equipe).filter(e => e.presente).length
  const nRec = Object.values(recursos).filter(r => r.operando).length
  const nAv = Object.keys(avancos).length

  const salvar = useMutation({
    mutationFn: async () => {
      // 1) cabeçalho do RDO (cria ou atualiza)
      const cab = {
        obra_id: obraId, data, condicao_climatica: clima,
        efetivo_proprio: nEquipe, efetivo_terceiro: 0,
        equipamentos_operando: nRec, equipamentos_parados: Object.values(recursos).filter(r => !r.operando).length,
        resumo_atividades: resumo || null,
        ocorrencias: eventos.filter(e => e.natureza === 'ocorrencia')
          .map(e => [EVENTO_LABEL[e.tipo], e.descricao].filter(Boolean).join(': ')).join(' | ') || null,
        horas_improdutivas: Number(horasImp) || 0, motivo_improdutividade: motivoImp || null,
        preenchido_por_nome: perfil?.nome ?? null, preenchido_em: new Date().toISOString(),
        fiscal_cemig: fiscais.join(' · ') || null, fiscais_cemig: fiscais,
        tst_nome: tstSel.map(t => t.nome).join(' · ') || null,
        tst_ids: tstSel.map(t => t.id), tst_nomes: tstSel.map(t => t.nome),
        impeditivos: eventos.filter(e => e.natureza === 'impeditivo')
          .map(e => [EVENTO_LABEL[e.tipo], e.descricao].filter(Boolean).join(': ')).join(' | ') || null,
        notas: notas || null,
      }
      let novoId = rdoIdProp ?? ''
      if (rdoIdProp) {
        const { error: eU } = await supabase.from('obr_rdo').update(cab).eq('id', rdoIdProp)
        if (eU) throw eU
        // limpa filhos regraváveis (fotos existentes são preservadas)
        await Promise.all([
          supabase.from('obr_rdo_avanco').delete().eq('rdo_id', rdoIdProp),
          supabase.from('obr_rdo_eventos').delete().eq('rdo_id', rdoIdProp),
          supabase.from('obr_rdo_equipe').delete().eq('rdo_id', rdoIdProp),
          supabase.from('obr_rdo_recurso').delete().eq('rdo_id', rdoIdProp),
        ])
      } else {
        const { data: rdo, error: e1 } = await supabase.from('obr_rdo').insert({ ...cab, status: 'rascunho' }).select('id').single()
        if (e1 || !rdo) throw e1 ?? new Error('Falha ao criar o RDO')
        novoId = rdo.id as string
      }
      const rdoId = novoId

      // 2) avanços do dia + propagação para a matriz do Planejamento
      const linhas = Object.entries(avancos).map(([k, v]) => {
        const [estrutura_id, atividade] = k.split('|')
        return { rdo_id: rdoId, estrutura_id, atividade, avanco: v }
      })
      if (linhas.length) {
        const { error: e2 } = await supabase.from('obr_rdo_avanco').insert(linhas)
        if (e2) throw e2
        const { error: e3 } = await supabase.from('obr_atividade_avanco').upsert(
          linhas.map(l => ({
            obra_id: obraId, estrutura_id: l.estrutura_id, atividade: l.atividade,
            data, avanco: l.avanco, responsavel_nome: perfil?.nome ?? null, updated_at: new Date().toISOString(),
          })), { onConflict: 'estrutura_id,atividade' })
        if (e3) throw e3
      }

      // 2b) eventos padronizados (impeditivo / ocorrência / improdutividade)
      const fotosRows: Record<string, unknown>[] = []
      const subirFoto = async (f: File, sufixo: string) => {
        const ext = f.name.split('.').pop() || 'jpg'
        const path = `${obraId}/${rdoId}/${sufixo}-${Math.round(performance.now())}-${f.name.replace(/[^\w.-]/g, '_')}.${ext === f.name ? 'jpg' : ext}`
        const { error } = await supabase.storage.from('obr-rdo-fotos').upload(path, f, { upsert: true })
        if (error) throw error
        return { path, url: supabase.storage.from('obr-rdo-fotos').getPublicUrl(path).data.publicUrl }
      }

      if (eventos.length) {
        const { data: evIns, error: eE } = await supabase.from('obr_rdo_eventos').insert(eventos.map(ev => ({
          rdo_id: rdoId, obra_id: obraId, data,
          natureza: ev.natureza, tipo: ev.tipo,
          horas_perdidas: Number(ev.horas) || 0, descricao: ev.descricao || null,
          criado_por_nome: perfil?.nome ?? null,
        }))).select('id')
        if (eE) throw eE
        // fotos de cada evento (mesma ordem do insert)
        for (let i = 0; i < eventos.length; i++) {
          for (const f of eventos[i].fotos) {
            const up = await subirFoto(f, `evento-${i}`)
            fotosRows.push({
              rdo_id: rdoId, obra_id: obraId, data, escopo: 'evento',
              evento_id: (evIns ?? [])[i]?.id ?? null, ...up, criado_por_nome: perfil?.nome ?? null,
            })
          }
        }
      }

      // fotos por atividade
      for (const [atv, arq] of Object.entries(fotosAtiv)) {
        for (const f of arq) {
          const up = await subirFoto(f, `ativ-${atv.slice(0, 12).replace(/[^\w]/g, '')}`)
          fotosRows.push({
            rdo_id: rdoId, obra_id: obraId, data, escopo: 'atividade',
            atividade: atv, ...up, criado_por_nome: perfil?.nome ?? null,
          })
        }
      }
      if (fotosRows.length) {
        const { error: eF } = await supabase.from('obr_rdo_fotos').insert(fotosRows)
        if (eF) throw eF
      }

      // 3) equipe e recursos
      const eq = Object.entries(equipe).map(([colaborador_id, v]) => ({ rdo_id: rdoId, colaborador_id, nome: v.nome, funcao: v.funcao, presente: v.presente }))
      if (eq.length) await supabase.from('obr_rdo_equipe').insert(eq)
      const rc = Object.entries(recursos).map(([veiculo_id, v]) => ({ rdo_id: rdoId, veiculo_id, descricao: v.descricao, operando: v.operando }))
      if (rc.length) await supabase.from('obr_rdo_recurso').insert(rc)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-ativ-avanco', obraId] })
      qc.invalidateQueries({ queryKey: ['rdos'] })
      onClose()
    },
  })

  // botão de câmera reutilizado nos eventos e nas atividades
  const BotaoFoto = ({ arquivos, onAdd, onDel, titulo }: {
    arquivos: File[]; onAdd: (fs: File[]) => void; onDel: (i: number) => void; titulo: string
  }) => (
    <span className="inline-flex items-center gap-1">
      <label title={titulo}
        className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-lg cursor-pointer text-[10px] font-bold ${arquivos.length
          ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-50 text-sky-700')
          : (isDark ? 'text-slate-500 hover:bg-white/[0.06]' : 'text-slate-400 hover:bg-slate-100')}`}>
        <Camera size={13} />{arquivos.length > 0 && arquivos.length}
        <input type="file" accept="image/*" multiple capture="environment" className="hidden"
          onChange={e => { onAdd([...(e.target.files ?? [])]); e.currentTarget.value = '' }} />
      </label>
      {arquivos.map((f, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] max-w-[110px] ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <span className="truncate">{f.name}</span>
          <button onClick={() => onDel(i)} className="hover:text-rose-500 shrink-0"><X size={9} /></button>
        </span>
      ))}
    </span>
  )

  const card = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
  const inp = `rounded-lg border px-2 py-1.5 text-xs ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`
  const tab = (k: typeof aba, label: string, icon: React.ReactNode, n: number) => (
    <button onClick={() => setAba(k)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${aba === k
        ? (isDark ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-orange-50 border-orange-300 text-orange-700')
        : (isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500')}`}>
      {icon}{label}{n > 0 && <span className="text-[10px] opacity-70">({n})</span>}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-5xl max-h-[92vh] lg:max-h-[92vh] flex flex-col rounded-t-2xl lg:rounded-2xl border shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        {/* header */}
        <div className={`flex items-start justify-between gap-3 p-3 lg:p-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 min-w-0">
              <h3 className={`font-bold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>Diário de Obra</h3>
              {obras?.length && onObraChange ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <select value={projSel} onChange={e => setProjSel(e.target.value)}
                    className={`shrink min-w-0 max-w-[130px] lg:max-w-[190px] truncate rounded-lg px-2 py-1 border text-sm font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.12] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <option value="">Todos os projetos</option>
                    {projetosOpts.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <select value={obraId} onChange={e => onObraChange(e.target.value)}
                    className={`min-w-0 flex-1 lg:flex-none lg:max-w-[420px] truncate rounded-lg px-2 py-1 border text-sm font-bold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.12] text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    {obrasOpts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
              ) : (
                <span className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{obraNome}</span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {rdoIdProp ? 'Editando' : 'Preenchido por'} <b>{perfil?.nome ?? '—'}</b> · {new Date().toLocaleDateString('pt-BR')} · {estruturas.length} estrutura(s) · o avanço atualiza o <b>Realizado</b> do Planejamento
            </p>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
        </div>

        {/* cabeçalho do dia */}
        <div className={`px-3 lg:px-4 py-2.5 lg:py-3 flex items-end gap-2 flex-wrap border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">DATA
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inp} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">CLIMA
            <select value={clima} onChange={e => setClima(e.target.value as never)} className={inp}>
              {CLIMAS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select></label>
          {/* MOBILE: recolhe os campos secundários pra sobrar tela pro conteúdo */}
          <button onClick={() => setDetDia(v => !v)}
            className={`lg:hidden inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border ${isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            {detDia ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Detalhes
          </button>
          <div className={`${detDia ? 'contents' : 'hidden'} lg:contents`}>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">HS IMPRODUTIVAS
            <input value={horasImp} onChange={e => setHorasImp(e.target.value)} className={`${inp} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1 flex-1 min-w-[180px]">MOTIVO
            <input value={motivoImp} onChange={e => setMotivoImp(e.target.value)} placeholder="chuva, aguardando liberação…" className={inp} /></label>
          <div className="text-[10px] font-bold text-slate-400 flex flex-col gap-1 w-full sm:w-auto sm:min-w-[190px]">FISCAL CEMIG
            <div className="flex items-center gap-1 flex-wrap">
              {fiscais.map(n => (
                <span key={n} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isDark ? 'bg-white/[0.08] text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                  {n}<button onClick={() => setFiscais(f => f.filter(x => x !== n))} className="hover:text-rose-500"><X size={10} /></button>
                </span>
              ))}
              <input value={addFiscal} onChange={e => setAddFiscal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && addFiscal.trim()) { setFiscais(f => [...new Set([...f, addFiscal.trim()])]); setAddFiscal('') } }}
                placeholder="nome + Enter" className={`${inp} w-32`} />
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 flex flex-col gap-1 w-full sm:w-auto sm:min-w-[200px]">TST ALOCADO
            <div className="flex items-center gap-1 flex-wrap">
              {tstSel.map(t => (
                <span key={t.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  {t.nome.trim().split(' ')[0]}<button onClick={() => setTstSel(l => l.filter(x => x.id !== t.id))} className="hover:text-rose-500"><X size={10} /></button>
                </span>
              ))}
              <select value="" onChange={e => {
                const t = tsts.find(x => x.id === e.target.value)
                if (t) setTstSel(l => l.some(x => x.id === t.id) ? l : [...l, { id: t.id, nome: t.nome }])
              }} className={`${inp} w-36`}>
                <option value="">+ técnico…</option>
                {tsts.filter(t => !tstSel.some(x => x.id === t.id)).map(t => <option key={t.id} value={t.id}>{t.nome.trim()}</option>)}
              </select>
            </div>
          </div>
          </div>
          <div className="flex items-center gap-1.5 w-full lg:w-auto lg:ml-auto">
            {tab('avanco', 'Avanço', <ClipboardList size={13} />, nAv)}
            {tab('equipe', 'Equipe', <Users size={13} />, nEquipe)}
            {tab('recursos', 'Recursos', <Truck size={13} />, nRec)}
          </div>
        </div>

        <div className="p-3 lg:p-4 overflow-y-auto overscroll-contain flex-1 space-y-3">
          {/* ── AVANÇO: matriz estrutura × atividade ── */}
          {aba === 'avanco' && (
            estruturas.length === 0 ? (
              <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Esta obra ainda não tem estruturas cadastradas — cadastre em <b>Planejamento</b> para lançar avanço por torre.
              </p>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain max-h-[52vh] lg:max-h-none overflow-y-auto">
                <table className="border-collapse text-xs min-w-full">
                  <thead>
                    <tr>
                      <th className={`sticky left-0 z-10 px-2 py-1.5 text-left text-[9px] font-bold uppercase ${isDark ? 'bg-[#0f172a] text-slate-500' : 'bg-white text-slate-400'}`}>Atividade</th>
                      {estruturas.map(e => (
                        <th key={e.id} className={`px-1 py-1.5 text-center min-w-[62px] ${isDark ? 'border-l border-white/[0.05]' : 'border-l border-slate-100'}`}>
                          <div className={`text-[11px] font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{e.nome}</div>
                          <div className="text-[9px] text-slate-400">{e.tipo ?? ''}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CATALOGO_RDO.map(g => [
                      // cabeçalho da FRENTE — clique abre/fecha
                      <tr key={g.secao} className={isDark ? 'border-t border-white/[0.08]' : 'border-t border-slate-200'}>
                        <td colSpan={estruturas.length + 1} className="p-0">
                          <button onClick={() => togSecao(g.secao)}
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-slate-50 hover:bg-slate-100'}`}>
                            {abertas.has(g.secao) ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                            <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: SECAO_COR_RDO[g.secao] }}>{g.secao}</span>
                            <span className="text-[10px] text-slate-400">{g.atividades.length} atividade(s)</span>
                            {(() => { const n = g.atividades.filter(a => estruturas.some(e => avancos[`${e.id}|${a}`] != null)).length
                              return n > 0 ? <span className="text-[10px] font-bold text-orange-500">· {n} lançada(s)</span> : null })()}
                          </button>
                        </td>
                      </tr>,
                      ...(abertas.has(g.secao) ? g.atividades : []).map(atv => (
                      <tr key={g.secao + atv} className={isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}>
                        <td className={`sticky left-0 z-10 px-2 py-1 pl-6 text-[11px] whitespace-nowrap ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-white text-slate-600'}`}>
                          <span className="inline-flex items-center gap-1.5">
                            {atv}
                            <BotaoFoto arquivos={fotosAtiv[atv] ?? []} titulo={`fotos de ${atv}`}
                              onAdd={fs => setFotosAtiv(p => ({ ...p, [atv]: [...(p[atv] ?? []), ...fs] }))}
                              onDel={k => setFotosAtiv(p => ({ ...p, [atv]: (p[atv] ?? []).filter((_, z) => z !== k) }))} />
                          </span>
                        </td>
                        {estruturas.map(e => {
                          const k = `${e.id}|${atv}`
                          const hoje = avancos[k]
                          const feito = atual.get(k) ?? 0
                          const val = hoje != null ? hoje : feito
                          return (
                            <td key={e.id} className={`px-0.5 py-0.5 text-center ${isDark ? 'border-l border-white/[0.05]' : 'border-l border-slate-100'}`}>
                              <select value={String(Math.round(val * 100))}
                                onChange={ev => setAv(k, Number(ev.target.value) / 100)}
                                className={`w-full rounded px-0.5 py-1 text-[10px] font-bold border-0 cursor-pointer ${
                                  hoje != null ? 'ring-1 ring-orange-400 ' : ''}${
                                  val >= 1 ? 'bg-emerald-500 text-white' : val > 0 ? 'bg-amber-400 text-slate-900' : (isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-100 text-slate-400')}`}>
                                {[0, 25, 50, 75, 100].map(p => <option key={p} value={p}>{p ? `${p}%` : '·'}</option>)}
                              </select>
                            </td>
                          )
                        })}
                      </tr>
                    ))])}
                  </tbody>
                </table>
                <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Célula com borda laranja = informada neste RDO. As demais mostram o que já estava na matriz.
                </p>
              </div>
            )
          )}

          {/* ── EQUIPE ── */}
          {aba === 'equipe' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select value={addColab} onChange={e => setAddColab(e.target.value)} className={`${inp} flex-1`}>
                  <option value="">+ adicionar colaborador…</option>
                  {colabs.filter(c => !equipe[c.id]).map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}
                </select>
                <button onClick={() => { const c = colabs.find(x => x.id === addColab); if (c) { setEquipe(p => ({ ...p, [c.id]: { nome: c.nome, funcao: c.cargo, presente: true } })); setAddColab('') } }}
                  disabled={!addColab} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-40">Incluir</button>
              </div>
              {equipeAloc.length > 0 && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pré-preenchido com a equipe alocada nesta obra (Alocação de Equipes).</p>}
              {Object.keys(equipe).length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Nenhuma equipe alocada nesta obra — inclua manualmente acima.</p>}
              <div className="grid sm:grid-cols-2 gap-1.5">
                {Object.entries(equipe).map(([id, e]) => (
                  <div key={id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${card}`}>
                    <button onClick={() => setEquipe(p => ({ ...p, [id]: { ...e, presente: !e.presente } }))}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${e.presente ? 'bg-emerald-600 border-emerald-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                      {e.presente && <Check size={11} strokeWidth={3} />}
                    </button>
                    <span className={`text-xs truncate flex-1 ${e.presente ? '' : 'opacity-40 line-through'} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{e.nome}</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[110px]">{e.funcao ?? ''}</span>
                    <button onClick={() => setEquipe(p => { const n = { ...p }; delete n[id]; return n })} className="text-slate-400 hover:text-rose-500"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RECURSOS ── */}
          {aba === 'recursos' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select value={addVeic} onChange={e => setAddVeic(e.target.value)} className={`${inp} flex-1`}>
                  <option value="">+ adicionar recurso/veículo…</option>
                  {veiculos.filter(v => !recursos[v.id]).map(v => <option key={v.id} value={v.id}>{v.descricao}</option>)}
                </select>
                <button onClick={() => { const v = veiculos.find(x => x.id === addVeic); if (v) { setRecursos(p => ({ ...p, [v.id]: { descricao: v.descricao, operando: true } })); setAddVeic('') } }}
                  disabled={!addVeic} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-40">Incluir</button>
              </div>
              {recursosAloc.length > 0 && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pré-preenchido com a frota alocada nesta obra (Alocação de Recursos).</p>}
              {Object.keys(recursos).length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Nenhum recurso alocado nesta obra — inclua manualmente acima.</p>}
              <div className="grid sm:grid-cols-2 gap-1.5">
                {Object.entries(recursos).map(([id, r]) => (
                  <div key={id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${card}`}>
                    <button onClick={() => setRecursos(p => ({ ...p, [id]: { ...r, operando: !r.operando } }))}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${r.operando ? 'bg-emerald-600 border-emerald-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                      {r.operando && <Check size={11} strokeWidth={3} />}
                    </button>
                    <span className={`text-xs truncate flex-1 ${r.operando ? '' : 'opacity-40'} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.descricao}</span>
                    <span className="text-[9px] text-slate-400">{r.operando ? 'operando' : 'parado'}</span>
                    <button onClick={() => setRecursos(p => { const n = { ...p }; delete n[id]; return n })} className="text-slate-400 hover:text-rose-500"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* textos do dia */}
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">RESUMO DAS ATIVIDADES
              <textarea rows={2} value={resumo} onChange={e => setResumo(e.target.value)} className={`${inp} resize-none`} /></label>
            <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">NOTAS
              <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} className={`${inp} resize-none`} /></label>
          </div>

          {/* ── EVENTOS PADRONIZADOS (impeditivo · ocorrência · improdutividade) ── */}
          <div className={`rounded-xl border p-3 ${card}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} className="text-amber-500" />
              <span className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ocorrências e impeditivos</span>
              <span className="text-[10px] text-slate-400">tipo padronizado — permite filtrar eventos por obra</span>
              <button onClick={() => setEventos(l => [...l, { natureza: 'impeditivo', tipo: 'clima_chuva', horas: '', descricao: '', fotos: [] }])}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white">
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {eventos.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-2">Nenhum evento no dia.</p>
            ) : (
              <div className="space-y-1.5">
                {eventos.map((ev, i) => (
                  <div key={i} className={`flex items-center gap-1.5 flex-wrap rounded-lg p-1.5 lg:p-0 ${isDark ? "bg-white/[0.03] lg:bg-transparent" : "bg-slate-50 lg:bg-transparent"}`}>
                    <select value={ev.natureza} onChange={e => setEventos(l => l.map((x, j) => j === i ? { ...x, natureza: e.target.value } : x))}
                      className={`${inp} flex-1 min-w-[120px] lg:flex-none lg:w-[130px]`}>
                      {NATUREZAS.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
                    </select>
                    <select value={ev.tipo} onChange={e => setEventos(l => l.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))}
                      className={`${inp} flex-1 min-w-[140px] lg:flex-none lg:w-[200px]`}>
                      {EVENTO_TIPOS.map(g => (
                        <optgroup key={g.grupo} label={g.grupo}>
                          {g.itens.map(it => <option key={it.v} value={it.v}>{it.l}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input value={ev.horas} onChange={e => setEventos(l => l.map((x, j) => j === i ? { ...x, horas: e.target.value } : x))}
                      placeholder="hs" className={`${inp} w-14`} />
                    <input value={ev.descricao} onChange={e => setEventos(l => l.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))}
                      placeholder="detalhe (opcional)" className={`${inp} flex-1 min-w-[160px]`} />
                    <BotaoFoto arquivos={ev.fotos} titulo="fotos desta ocorrência"
                      onAdd={fs => setEventos(l => l.map((x, j) => j === i ? { ...x, fotos: [...x.fotos, ...fs] } : x))}
                      onDel={k => setEventos(l => l.map((x, j) => j === i ? { ...x, fotos: x.fotos.filter((_, z) => z !== k) } : x))} />
                    <button onClick={() => setEventos(l => l.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {erro && <p className="text-xs rounded-lg px-3 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{erro}</p>}
        </div>

        {/* footer */}
        <div className={`p-3 lg:p-4 border-t flex items-center justify-between gap-2 flex-wrap ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {nAv} avanço(s) · {nEquipe} pessoa(s) · {nRec} recurso(s)
          </span>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button onClick={onClose} className={`px-4 py-2.5 lg:py-2 rounded-xl text-sm font-medium border ${isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-300 text-slate-600'}`}>Cancelar</button>
            <button onClick={() => { setErro(null); setSalvando(true); salvar.mutate(undefined, { onError: e => setErro(String((e as Error).message)), onSettled: () => setSalvando(false) }) }}
              disabled={salvando}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 lg:py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50">
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {rdoIdProp ? 'Salvar alterações' : 'Salvar RDO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
