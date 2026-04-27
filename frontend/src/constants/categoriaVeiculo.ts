// ─────────────────────────────────────────────────────────────────────────────
// constants/categoriaVeiculo.ts — Fonte ÚNICA da verdade para categorias de
// veículos/máquinas. Importe daqui em vez de redeclarar mapas.
// Sincronizado com enum fro_categoria no Supabase (migration 089).
// ─────────────────────────────────────────────────────────────────────────────

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
  'escavadeira',
  'carregadeira',
  'motoniveladora',
  'rolo_compactador',
  'trator',
  'betoneira',
] as const

export type CategoriaVeiculo = typeof CATEGORIA_VEICULO[number]

export const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  passeio:          'Passeio',
  pickup:           'Pickup',
  van:              'Van',
  vuc:              'VUC',
  moto:             'Moto',
  onibus:           'Ônibus',
  truck:            'Truck',
  carreta:          'Carreta',
  guindauto:        'Guindauto',
  guindaste:        'Guindaste',
  munck:            'Munck',
  retro:            'Retroescavadeira',
  escavadeira:      'Escavadeira',
  carregadeira:     'Carregadeira',
  motoniveladora:   'Motoniveladora',
  rolo_compactador: 'Rolo Compactador',
  trator:           'Trator',
  betoneira:        'Betoneira',
}

/** Categorias agrupadas para filtros / KPIs / abas (Leves / Caminhão / Maquinário). */
export const CATEGORIA_GRUPO: Record<CategoriaVeiculo, 'leve' | 'caminhao' | 'maquina'> = {
  passeio: 'leve', pickup: 'leve', van: 'leve', vuc: 'leve', moto: 'leve', onibus: 'leve',
  truck: 'caminhao', carreta: 'caminhao',
  guindauto: 'maquina', guindaste: 'maquina', munck: 'maquina', retro: 'maquina',
  escavadeira: 'maquina', carregadeira: 'maquina', motoniveladora: 'maquina',
  rolo_compactador: 'maquina', trator: 'maquina', betoneira: 'maquina',
}

export const CATEGORIA_GRUPO_LABEL: Record<'leve' | 'caminhao' | 'maquina', string> = {
  leve:     'Leves',
  caminhao: 'Caminhões',
  maquina:  'Máquinas',
}
