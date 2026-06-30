// types/ponto.ts — módulo Ponto (DP)

export type AprovStatus = 'pendente' | 'em_aprovacao' | 'aprovado' | 'reprovado'

export interface PontoResumoMes {
  ano_mes: string
  colaborador_id: string | null
  colaborador_nome: string | null
  cargo: string | null
  matricula: string | null
  base_id: string | null
  base_nome: string | null
  base_codigo: string | null
  centro_custo_id: string | null
  cc_codigo: string | null
  cc_nome: string | null
  projeto_id: string | null
  projeto_codigo: string | null
  departamento: string | null
  dias: number
  dias_batidos: number
  hh_trabalhada: string | null
  normais: string | null
  extras: string | null
  faltas: string | null
  atrasos: string | null
  banco_saldo: string | null
}

export interface PontoDia {
  data: string
  secullum_func_id: number
  colaborador_id: string | null
  entrada1: string | null; saida1: string | null
  entrada2: string | null; saida2: string | null
  entrada3: string | null; saida3: string | null
  memoria1_ent: string | null; memoria1_sai: string | null
  memoria2_ent: string | null; memoria2_sai: string | null
  compensado: boolean | null; folga: boolean | null; refeicao: boolean | null
  neutro: boolean | null; almoco_livre: boolean | null; ajuste: boolean | null
  observacoes: string | null
  normais: string | null; faltas: string | null
  ex50: string | null; ex70: string | null; ex100: string | null
  dsr: string | null; noturno: string | null; atrasos: string | null; carga: string | null
  t_mais_menos: string | null; banco_saldo: string | null; hh_trabalhada: string | null
  base_id: string | null; centro_custo_id: string | null; projeto_id: string | null
  departamento: string | null; cargo: string | null
  aprov_status: AprovStatus
}

// item de hora extra (1 dia/colaborador com extra > 0) — vem da view
export interface HoraExtraItem {
  data: string
  secullum_func_id: number
  colaborador_id: string | null
  colaborador_nome: string | null
  cargo: string | null
  base_id: string | null
  base_nome: string | null
  cc_codigo: string | null
  ex50: string | null; ex70: string | null; ex100: string | null
  extras_total: string | null
  aprov_status: AprovStatus
  aprov_por: string | null
  aprov_em: string | null
}

export interface PontoAfastamento {
  id: string
  colaborador_id: string | null
  inicio: string
  fim: string | null
  motivo: string | null
  justificativa: string | null
  aprov_status: AprovStatus
  aprov_por: string | null
  aprov_em: string | null
  colaborador?: { nome: string | null; base_id: string | null; base?: { nome: string | null } | null } | null
}

export interface PontoRetificacao {
  nsr: number | null
  data_hora: string
  origem: string | null
  motivo: string | null
  aprov_status: AprovStatus
  aprov_por: string | null
  aprov_em: string | null
  colaborador?: { nome: string | null; base_id: string | null; base?: { nome: string | null } | null } | null
}

export interface PontoTabProps {
  anoMes: string
  baseId: string
  pessoa: string
  status: string
  ocultosJustif: Set<string>
  quickReg: string
  vista: string
  diaData: string
  bases: { id: string; nome: string; codigo: string }[]
}

// linha da visão diária (1 colaborador no dia)
export interface PontoDiaLista {
  data: string
  secullum_func_id: number
  colaborador_id: string | null
  base_id: string | null
  entrada1: string | null; saida1: string | null; entrada2: string | null; saida2: string | null
  normais: string | null; faltas: string | null
  ex50: string | null; ex70: string | null; ex100: string | null
  aprov_status: AprovStatus
  colaborador?: { nome: string | null } | null
  base?: { nome: string | null } | null
}

// item genérico p/ a fila de aprovação
export type AprovTipo = 'retificacao' | 'hora_extra' | 'atestado'
export interface AprovKey {
  tipo: AprovTipo
  nsr?: number | null
  data?: string
  secullum_func_id?: number
  id?: string
}
