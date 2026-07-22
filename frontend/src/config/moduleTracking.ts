// Mapa rota → módulo para o rastreio de acessos (sys_acessos) do painel
// admin "Uso dos Módulos". Rotas fora deste mapa (/, /login, /perfil,
// /admin/*, /cadastros, telas públicas de assinatura/aprovação) são
// intencionalmente ignoradas — o painel mede uso de módulos, não do app todo.
// Ordem: prefixos mais específicos primeiro (o primeiro match vence).

const ROUTE_TO_MODULE: Array<{ prefix: string; modulo: string }> = [
  // Compras tem rotas top-level fora de /compras (ver App.tsx)
  { prefix: '/compras',       modulo: 'compras' },
  { prefix: '/nova',          modulo: 'compras' },
  { prefix: '/requisicoes',   modulo: 'compras' },
  { prefix: '/cotacoes',      modulo: 'compras' },
  { prefix: '/pedidos',       modulo: 'compras' },
  // Financeiro também agrupa /despesas e /apontamentos
  { prefix: '/financeiro',    modulo: 'financeiro' },
  { prefix: '/despesas',      modulo: 'financeiro' },
  { prefix: '/apontamentos',  modulo: 'financeiro' },
  { prefix: '/fiscal',        modulo: 'fiscal' },
  { prefix: '/estoque',       modulo: 'estoque' },
  { prefix: '/logistica',     modulo: 'logistica' },
  { prefix: '/frotas',        modulo: 'frotas' },
  { prefix: '/locacoes',      modulo: 'locacoes' },
  { prefix: '/sgi',           modulo: 'sgi' },
  { prefix: '/qsma',          modulo: 'qsma' },
  { prefix: '/ssma',          modulo: 'qsma' },
  { prefix: '/paineis',       modulo: 'paineis' },
  { prefix: '/patrimonial',   modulo: 'patrimonial' },
  { prefix: '/rh',            modulo: 'rh' },
  { prefix: '/contratos',     modulo: 'contratos' },
  { prefix: '/controladoria', modulo: 'controladoria' },
  { prefix: '/obras',         modulo: 'obras' },
  { prefix: '/egp',           modulo: 'egp' },
  { prefix: '/orcamentacao',  modulo: 'orcamentacao' },
  { prefix: '/ti',            modulo: 'ti' },
  { prefix: '/monitoramento', modulo: 'monitoramento' },
]

// Labels amigáveis para o painel (inclui módulos que só existem nos logs de
// auditoria, ex.: 'aprovacoes'). Chave desconhecida cai no fallback.
export const MODULE_LABELS: Record<string, string> = {
  compras: 'Compras',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  estoque: 'Estoque',
  logistica: 'Logística',
  frotas: 'Frotas',
  locacoes: 'Gestão de Imóveis',
  sgi: 'Gestão (SGI)',
  qsma: 'QSMA',
  paineis: 'Painéis',
  patrimonial: 'Patrimonial',
  rh: 'RH',
  contratos: 'Contratos',
  controladoria: 'Controladoria',
  obras: 'Obras',
  egp: 'EGP',
  orcamentacao: 'Orçamentação',
  ti: 'TI (Helpdesk)',
  monitoramento: 'Monitoramento (CFTV)',
  aprovacoes: 'Aprovações',
  cadastros: 'Cadastros',
  sys: 'Sistema',
}

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key.toUpperCase()
}

// Módulos rastreáveis por navegação — base para "módulos sem nenhum uso"
export const TRACKED_MODULES: string[] = [...new Set(ROUTE_TO_MODULE.map((r) => r.modulo))]

export function resolveModulo(pathname: string): string | null {
  const match = ROUTE_TO_MODULE.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return match?.modulo ?? null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUM_RE = /^\d+$/

// '/cotacoes/3f2a.../editar' → '/cotacoes/:id/editar' (evita explosão de
// cardinalidade na coluna tela)
export function normalizeTela(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => (UUID_RE.test(seg) || NUM_RE.test(seg) ? ':id' : seg))
    .join('/')
}
