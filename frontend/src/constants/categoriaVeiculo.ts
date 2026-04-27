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
  // Substituídas por 'outras_maquinas' historicamente
  'escavadeira', 'carregadeira', 'motoniveladora', 'rolo_compactador',
  // Zeradas / não utilizadas no contexto atual da empresa
  'van', 'vuc', 'moto', 'carreta', 'guindaste', 'munck', 'betoneira', 'outras_maquinas',
]

/** Categorias ATIVAS — para usar em selects de cadastro e filtros. Exclui depreciadas. */
export const CATEGORIA_VEICULO_ATIVAS: CategoriaVeiculo[] =
  CATEGORIA_VEICULO.filter(c => !CATEGORIA_DEPRECATED.includes(c))

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

/** Categorias agrupadas para filtros / KPIs / abas (Leves / Caminhão / Maquinário). */
export const CATEGORIA_GRUPO: Record<CategoriaVeiculo, 'leve' | 'caminhao' | 'maquina'> = {
  passeio: 'leve', pickup: 'leve', van: 'leve', vuc: 'leve', moto: 'leve', onibus: 'leve',
  truck: 'caminhao', carreta: 'caminhao',
  guindauto: 'maquina', guindaste: 'maquina', munck: 'maquina', retro: 'maquina',
  trator: 'maquina', betoneira: 'maquina', outras_maquinas: 'maquina',
  // deprecated — ainda mapeadas para grupo correto caso apareçam em registros legados
  escavadeira: 'maquina', carregadeira: 'maquina', motoniveladora: 'maquina',
  rolo_compactador: 'maquina',
}

export const CATEGORIA_GRUPO_LABEL: Record<'leve' | 'caminhao' | 'maquina', string> = {
  leve:     'Leves',
  caminhao: 'Caminhões',
  maquina:  'Máquinas',
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
