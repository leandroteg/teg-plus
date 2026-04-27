// ─────────────────────────────────────────────────────────────────────────────
// constants/categoriaVeiculo.ts — Fonte ÚNICA da verdade para categorias de
// veículos/máquinas. Importe daqui em vez de redeclarar mapas.
// Sincronizado com enum fro_categoria no Supabase (migration 089).
// ─────────────────────────────────────────────────────────────────────────────

// Lista COMPLETA — usada para tipos e renderização de labels de dados existentes.
// Algumas categorias foram unificadas em "outras_maquinas" e estão DEPRECATED:
// não aparecem em selects de cadastro novo (use CATEGORIA_VEICULO_ATIVAS).
export const CATEGORIA_VEICULO = [
  // ── Frota leve / passageiros ─────────────────────────────────────────────
  'passeio',
  'pickup',
  'van',
  'vuc',
  'moto',
  'onibus',
  // ── Frota pesada / transporte ────────────────────────────────────────────
  'truck',
  'carreta',
  // ── Equipamentos de obra civil / movimentação de carga ───────────────────
  'guindauto',
  'guindaste',
  'munck',
  'retro',
  'trator',
  'betoneira',
  'outras_maquinas',
  // ── DEPRECATED (substituídas por outras_maquinas, mantidas no tipo apenas
  //                para preservar dados legados):
  'escavadeira',
  'carregadeira',
  'motoniveladora',
  'rolo_compactador',
] as const

export type CategoriaVeiculo = typeof CATEGORIA_VEICULO[number]

/** Categorias DEPRECADAS — não aparecem em selects/filtros. Mantidas no enum do
 *  banco pra preservar registros legados. Para reativar, basta tirar daqui. */
export const CATEGORIA_DEPRECATED: CategoriaVeiculo[] = [
  // Não utilizadas no contexto atual da empresa
  'vuc', 'moto', 'carreta',
]

/** Categorias ATIVAS — para usar em selects de cadastro e filtros. Exclui depreciadas. */
export const CATEGORIA_VEICULO_ATIVAS: CategoriaVeiculo[] =
  CATEGORIA_VEICULO.filter(c => !CATEGORIA_DEPRECATED.includes(c))

/** Mapa ativo {categoria: label} — usar em vez de CATEGORIA_LABEL em selects/filtros
 *  para garantir que categorias depreciadas não apareçam para o usuário. */
export const CATEGORIA_LABEL_ATIVAS: Record<string, string> =
  Object.fromEntries(CATEGORIA_VEICULO_ATIVAS.map(c => [c, CATEGORIA_LABEL[c]]))

export const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  passeio:          'Passeio',
  pickup:           'Pickup',
  van:              'Van',
  vuc:              'VUC',
  moto:             'Moto',
  onibus:           'Ônibus',
  truck:            'Caminhão',
  carreta:          'Carreta',
  guindauto:        'Guindauto',
  guindaste:        'Guindaste',
  munck:            'Munck',
  retro:            'Retro',
  trator:           'Trator',
  betoneira:        'Betoneira',
  outras_maquinas:  'Outras Máquinas',
  // ── Deprecated — labels mantidos para renderizar registros legados ──
  escavadeira:      'Escavadeira',
  carregadeira:     'Carregadeira',
  motoniveladora:   'Motoniveladora',
  rolo_compactador: 'Rolo Compactador',
}

/** Tipos de grupo de categoria. */
export type CategoriaGrupo = 'leve' | 'onibus_van' | 'pesados' | 'guindauto' | 'maquina'

/** Categorias agrupadas em 5 grupos para filtros / KPIs / atalhos.
 *  Leve · Ônibus/Van · Pesados · Guindauto · Máquinas. */
export const CATEGORIA_GRUPO: Record<CategoriaVeiculo, CategoriaGrupo> = {
  // Leve
  passeio: 'leve', pickup: 'leve',
  // Ônibus / Van (Sprinter entra como van)
  onibus: 'onibus_van', van: 'onibus_van',
  // Pesados (caminhões)
  truck: 'pesados', carreta: 'pesados',
  // Guindauto / equipamentos de içamento
  guindauto: 'guindauto', guindaste: 'guindauto', munck: 'guindauto',
  // Máquinas pesadas (terraplanagem, concreto, etc)
  trator: 'maquina', retro: 'maquina', motoniveladora: 'maquina',
  escavadeira: 'maquina', carregadeira: 'maquina', rolo_compactador: 'maquina',
  betoneira: 'maquina', outras_maquinas: 'maquina',
  // Deprecated (sem veículos hoje, mantém grupo coerente caso reapareçam)
  vuc: 'pesados', moto: 'leve',
}

export const CATEGORIA_GRUPO_LABEL: Record<CategoriaGrupo, string> = {
  leve:        'Leve',
  onibus_van:  'Ônibus/Van',
  pesados:     'Pesados',
  guindauto:   'Guindauto',
  maquina:     'Máquinas',
}

/** Cor associada a cada grupo (Tailwind). Usado em badges/atalhos. */
export const CATEGORIA_GRUPO_COLOR: Record<CategoriaGrupo, { lightBg: string; lightText: string; darkBg: string; darkText: string }> = {
  leve:       { lightBg: 'bg-emerald-50', lightText: 'text-emerald-700', darkBg: 'bg-emerald-500/15', darkText: 'text-emerald-300' },
  onibus_van: { lightBg: 'bg-sky-50',     lightText: 'text-sky-700',     darkBg: 'bg-sky-500/15',     darkText: 'text-sky-300' },
  pesados:    { lightBg: 'bg-amber-50',   lightText: 'text-amber-700',   darkBg: 'bg-amber-500/15',   darkText: 'text-amber-300' },
  guindauto:  { lightBg: 'bg-violet-50',  lightText: 'text-violet-700',  darkBg: 'bg-violet-500/15',  darkText: 'text-violet-300' },
  maquina:    { lightBg: 'bg-rose-50',    lightText: 'text-rose-700',    darkBg: 'bg-rose-500/15',    darkText: 'text-rose-300' },
}

/** Emoji/ícone associado a cada categoria — usado em telas como Planejamento de Manutenção. */
export const CATEGORIA_ICON: Record<CategoriaVeiculo, string> = {
  passeio:          '🚗',
  pickup:           '🛻',
  van:              '🚐',
  vuc:              '📦',
  moto:             '🏍️',
  onibus:           '🚌',
  truck:            '🚛',
  carreta:          '🚚',
  guindauto:        '🏗️',
  guindaste:        '🏗️',
  munck:            '🪝',
  retro:            '🚜',
  trator:           '🚜',
  betoneira:        '🥣',
  outras_maquinas:  '⚙️',
  // deprecated
  escavadeira:      '⛏️',
  carregadeira:     '🚜',
  motoniveladora:   '🛣️',
  rolo_compactador: '🛞',
}
