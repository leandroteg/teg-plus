// types/ponto.ts — módulo Ponto (DP)

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
}

export interface PontoAfastamento {
  id: string
  colaborador_id: string | null
  inicio: string
  fim: string | null
  motivo: string | null
  justificativa: string | null
  colaborador?: { nome: string | null } | null
}

export interface PontoPendencia {
  id: string
  colaborador_id: string | null
  data_hora: string
  endereco: string | null
  latitude: number | null
  longitude: number | null
  precisao: number | null
  status: number | null
  colaborador?: { nome: string | null } | null
}

export interface PontoAprovacao {
  id: string
  ano_mes: string
  base_id: string | null
  status: 'pendente' | 'enviado' | 'aprovado' | 'reprovado'
  enviado_em: string | null
  enviado_por_nome: string | null
  aprovado_em: string | null
  aprovador_nome: string | null
  observacao: string | null
}

// agregado por base (área) p/ a aba Aprovação
export interface PontoAreaResumo {
  base_id: string | null
  base_nome: string
  pessoas: number
  hh_trabalhada_min: number
  extras_min: number
  faltas_min: number
  aprovacao?: PontoAprovacao
}

export interface PontoTabProps {
  anoMes: string
  baseId: string
  bases: { id: string; nome: string; codigo: string }[]
}
