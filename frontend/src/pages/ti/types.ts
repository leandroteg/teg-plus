import {
  Monitor, Wrench, KeyRound,
  type LucideIcon,
} from 'lucide-react'

export type CategoriaChamado = 'hardware' | 'software' | 'acessos'
export type PrioridadeChamado = 'baixa' | 'media' | 'alta' | 'urgente'
export type StatusChamado = 'aberto' | 'em_atendimento' | 'aguardando_usuario' | 'resolvido' | 'fechado'

export interface Chamado {
  id: string
  numero: number
  solicitante_id: string
  categoria: CategoriaChamado
  prioridade: PrioridadeChamado
  titulo: string
  descricao: string
  status: StatusChamado
  atendente_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  closed_at: string | null
  criado_por_nome?: string | null
  atualizado_por_nome?: string | null
  // joins (opcional)
  solicitante?: { nome: string; email: string } | null
  atendente?: { nome: string; email: string } | null
}

export interface Comentario {
  id: string
  chamado_id: string
  autor_id: string
  mensagem: string
  interno: boolean
  created_at: string
  autor?: { nome: string } | null
}

export interface CategoriaDef {
  key: CategoriaChamado
  label: string
  desc: string
  Icon: LucideIcon
  accent: string
  hint: string
}

export const CATEGORIAS: CategoriaDef[] = [
  {
    key: 'hardware',
    label: 'Hardware',
    desc: 'Computador, monitor, teclado, impressora',
    Icon: Monitor,
    accent: 'sky',
    hint: 'Ex.: meu computador não liga, o monitor está apagando, a impressora não imprime.',
  },
  {
    key: 'software',
    label: 'Software / Sistemas',
    desc: 'TEG+, Office, navegador, instalação',
    Icon: Wrench,
    accent: 'violet',
    hint: 'Ex.: o sistema travou, não consigo abrir um arquivo, preciso instalar um programa.',
  },
  {
    key: 'acessos',
    label: 'Acessos e senhas',
    desc: 'Login, permissões, recuperação',
    Icon: KeyRound,
    accent: 'amber',
    hint: 'Ex.: esqueci minha senha, preciso de acesso a um módulo, login bloqueado.',
  },
]

export const PRIORIDADES: { key: PrioridadeChamado; label: string; desc: string; dot: string }[] = [
  { key: 'baixa',    label: 'Baixa',    desc: 'Posso aguardar, não atrapalha meu trabalho agora', dot: 'bg-slate-400' },
  { key: 'media',    label: 'Média',    desc: 'Atrapalha em algum momento do dia',               dot: 'bg-sky-500' },
  { key: 'alta',     label: 'Alta',     desc: 'Estou travado(a) em uma tarefa importante',        dot: 'bg-amber-500' },
  { key: 'urgente',  label: 'Urgente',  desc: 'Parou totalmente meu trabalho ou da equipe',       dot: 'bg-rose-500' },
]

export const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto:              'Aberto',
  em_atendimento:      'Em atendimento',
  aguardando_usuario:  'Aguardando você',
  resolvido:           'Resolvido',
  fechado:             'Fechado',
}

export const STATUS_COLOR: Record<StatusChamado, string> = {
  aberto:              'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  em_atendimento:      'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  aguardando_usuario:  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  resolvido:           'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  fechado:             'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
}

export const PRIORIDADE_LABEL: Record<PrioridadeChamado, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
}

export function getCategoria(key: CategoriaChamado) {
  return CATEGORIAS.find(c => c.key === key)!
}

export function formatNumero(numero: number) {
  return `TI-${String(numero).padStart(4, '0')}`
}

export interface Anexo {
  id: string
  chamado_id: string
  comentario_id: string | null
  autor_id: string
  storage_path: string
  nome: string
  mime: string | null
  tamanho_bytes: number | null
  created_at: string
}

export const ANEXO_MAX_BYTES = 15 * 1024 * 1024 // 15 MB
export const ANEXO_MAX_BYTES_LABEL = '15 MB'

export function formatBytes(n: number | null | undefined) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
