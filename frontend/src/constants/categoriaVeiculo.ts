// ─────────────────────────────────────────────────────────────────────────────
// constants/categoriaVeiculo.ts — Fonte ÚNICA da verdade para categorias.
// Frota organizada em 5 categorias finais (sem subcategorias):
// Leve · Ônibus/Van · Pesados · Guindauto · Máquinas
// ─────────────────────────────────────────────────────────────────────────────

// Lista COMPLETA — inclui categorias deprecadas para preservar tipo TS
// em caso de registros legados não migrados.
export const CATEGORIA_VEICULO = [
  // ── 5 categorias ATIVAS ─────────────────────────────────────────────────
  'leve',
  'onibus_van',
  'pesados',
  'guindauto',
  'maquinas',
  // ── DEPRECATED (migradas via SQL para as 5 acima — mantidas no tipo
  //                apenas para preservar tipagem caso reapareçam):
  'passeio', 'pickup', 'van', 'vuc', 'moto', 'onibus',
  'truck', 'carreta',
  'guindaste', 'munck',
  'retro', 'trator', 'betoneira', 'outras_maquinas',
  'escavadeira', 'carregadeira', 'motoniveladora', 'rolo_compactador',
] as const

export type CategoriaVeiculo = typeof CATEGORIA_VEICULO[number]

/** Categorias DEPRECADAS — não aparecem em selects/filtros. Mantidas no enum
 *  do banco para preservar tipagem se houver registros legados. */
export const CATEGORIA_DEPRECATED: CategoriaVeiculo[] = [
  'passeio', 'pickup', 'van', 'vuc', 'moto', 'onibus',
  'truck', 'carreta',
  'guindaste', 'munck',
  'retro', 'trator', 'betoneira', 'outras_maquinas',
  'escavadeira', 'carregadeira', 'motoniveladora', 'rolo_compactador',
]

/** Categorias ATIVAS — são as 5 finais usadas em selects, filtros e KPIs. */
export const CATEGORIA_VEICULO_ATIVAS: CategoriaVeiculo[] =
  CATEGORIA_VEICULO.filter(c => !CATEGORIA_DEPRECATED.includes(c))

export const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  // Ativas
  leve:             'Leve',
  onibus_van:       'Ônibus/Van',
  pesados:          'Pesados',
  guindauto:        'Guindauto',
  maquinas:         'Máquinas',
  // Deprecated — mantidas pra renderizar registros legados se aparecerem
  passeio:          'Passeio',
  pickup:           'Pickup',
  van:              'Van',
  vuc:              'VUC',
  moto:             'Moto',
  onibus:           'Ônibus',
  truck:            'Caminhão',
  carreta:          'Carreta',
  guindaste:        'Guindaste',
  munck:            'Munck',
  retro:            'Retro',
  trator:           'Trator',
  betoneira:        'Betoneira',
  outras_maquinas:  'Outras Máquinas',
  escavadeira:      'Escavadeira',
  carregadeira:     'Carregadeira',
  motoniveladora:   'Motoniveladora',
  rolo_compactador: 'Rolo Compactador',
}

/** Mapa ativo {categoria: label} — usar em selects/filtros para mostrar só
 *  as 5 categorias finais. */
export const CATEGORIA_LABEL_ATIVAS: Record<string, string> =
  Object.fromEntries(CATEGORIA_VEICULO_ATIVAS.map(c => [c, CATEGORIA_LABEL[c]]))

/** Cor associada a cada categoria ativa (Tailwind). Usado em badges/atalhos. */
export const CATEGORIA_COLOR: Record<CategoriaVeiculo, { lightBg: string; lightText: string; darkBg: string; darkText: string }> = {
  leve:       { lightBg: 'bg-emerald-50', lightText: 'text-emerald-700', darkBg: 'bg-emerald-500/15', darkText: 'text-emerald-300' },
  onibus_van: { lightBg: 'bg-sky-50',     lightText: 'text-sky-700',     darkBg: 'bg-sky-500/15',     darkText: 'text-sky-300' },
  pesados:    { lightBg: 'bg-amber-50',   lightText: 'text-amber-700',   darkBg: 'bg-amber-500/15',   darkText: 'text-amber-300' },
  guindauto:  { lightBg: 'bg-violet-50',  lightText: 'text-violet-700',  darkBg: 'bg-violet-500/15',  darkText: 'text-violet-300' },
  maquinas:   { lightBg: 'bg-rose-50',    lightText: 'text-rose-700',    darkBg: 'bg-rose-500/15',    darkText: 'text-rose-300' },
  // Deprecated — herdam cor da categoria ativa correspondente para registros legados
  passeio: { lightBg: 'bg-emerald-50', lightText: 'text-emerald-700', darkBg: 'bg-emerald-500/15', darkText: 'text-emerald-300' },
  pickup:  { lightBg: 'bg-emerald-50', lightText: 'text-emerald-700', darkBg: 'bg-emerald-500/15', darkText: 'text-emerald-300' },
  moto:    { lightBg: 'bg-emerald-50', lightText: 'text-emerald-700', darkBg: 'bg-emerald-500/15', darkText: 'text-emerald-300' },
  van:     { lightBg: 'bg-sky-50',     lightText: 'text-sky-700',     darkBg: 'bg-sky-500/15',     darkText: 'text-sky-300' },
  onibus:  { lightBg: 'bg-sky-50',     lightText: 'text-sky-700',     darkBg: 'bg-sky-500/15',     darkText: 'text-sky-300' },
  truck:   { lightBg: 'bg-amber-50',   lightText: 'text-amber-700',   darkBg: 'bg-amber-500/15',   darkText: 'text-amber-300' },
  carreta: { lightBg: 'bg-amber-50',   lightText: 'text-amber-700',   darkBg: 'bg-amber-500/15',   darkText: 'text-amber-300' },
  vuc:     { lightBg: 'bg-amber-50',   lightText: 'text-amber-700',   darkBg: 'bg-amber-500/15',   darkText: 'text-amber-300' },
  guindaste: { lightBg: 'bg-violet-50', lightText: 'text-violet-700', darkBg: 'bg-violet-500/15', darkText: 'text-violet-300' },
  munck:     { lightBg: 'bg-violet-50', lightText: 'text-violet-700', darkBg: 'bg-violet-500/15', darkText: 'text-violet-300' },
  retro:           { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  trator:          { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  betoneira:       { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  outras_maquinas: { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  escavadeira:     { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  carregadeira:    { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  motoniveladora:  { lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
  rolo_compactador:{ lightBg: 'bg-rose-50', lightText: 'text-rose-700', darkBg: 'bg-rose-500/15', darkText: 'text-rose-300' },
}

/** Emoji/ícone associado a cada categoria. */
export const CATEGORIA_ICON: Record<CategoriaVeiculo, string> = {
  leve:       '🚗',
  onibus_van: '🚐',
  pesados:    '🚛',
  guindauto:  '🏗️',
  maquinas:   '🚜',
  // Deprecated
  passeio: '🚗', pickup: '🛻', van: '🚐', vuc: '📦', moto: '🏍️', onibus: '🚌',
  truck: '🚛', carreta: '🚚',
  guindaste: '🏗️', munck: '🪝',
  retro: '🚜', trator: '🚜', betoneira: '🥣', outras_maquinas: '⚙️',
  escavadeira: '⛏️', carregadeira: '🚜', motoniveladora: '🛣️', rolo_compactador: '🛞',
}

// ── Compat: alguns lugares ainda referenciam CATEGORIA_GRUPO/_LABEL.
// Após simplificação, cada categoria ativa É seu próprio grupo (1:1).
export type CategoriaGrupo = 'leve' | 'onibus_van' | 'pesados' | 'guindauto' | 'maquinas'

export const CATEGORIA_GRUPO: Record<CategoriaVeiculo, CategoriaGrupo> = {
  leve: 'leve', onibus_van: 'onibus_van', pesados: 'pesados',
  guindauto: 'guindauto', maquinas: 'maquinas',
  // Deprecated → grupo equivalente da categoria ativa
  passeio: 'leve', pickup: 'leve', moto: 'leve',
  van: 'onibus_van', onibus: 'onibus_van',
  truck: 'pesados', carreta: 'pesados', vuc: 'pesados',
  guindaste: 'guindauto', munck: 'guindauto',
  retro: 'maquinas', trator: 'maquinas', betoneira: 'maquinas', outras_maquinas: 'maquinas',
  escavadeira: 'maquinas', carregadeira: 'maquinas', motoniveladora: 'maquinas',
  rolo_compactador: 'maquinas',
}

export const CATEGORIA_GRUPO_LABEL: Record<CategoriaGrupo, string> = {
  leve:        'Leve',
  onibus_van:  'Ônibus/Van',
  pesados:     'Pesados',
  guindauto:   'Guindauto',
  maquinas:    'Máquinas',
}

/** Cor por grupo (= cor da categoria ativa). Mantido pra compat. */
export const CATEGORIA_GRUPO_COLOR: Record<CategoriaGrupo, { lightBg: string; lightText: string; darkBg: string; darkText: string }> =
  Object.fromEntries(
    (['leve', 'onibus_van', 'pesados', 'guindauto', 'maquinas'] as const)
      .map(g => [g, CATEGORIA_COLOR[g]])
  ) as Record<CategoriaGrupo, { lightBg: string; lightText: string; darkBg: string; darkText: string }>
