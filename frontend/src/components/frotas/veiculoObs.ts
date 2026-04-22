// Helper para extrair campos do campo `observacoes` do fro_veiculos
// Formato esperado: "Categoria origem: X | Cód. Sistema: Y | Cód. Frota: Z | Responsável: W | Local: V | Rastreador: R"

export interface ObsInfo {
  categoriaOrigem?: string
  codigo?: string
  codFrota?: string
  responsavel?: string
  local?: string
  rastreador?: string
}

export function parseObsInfo(obs?: string): ObsInfo {
  if (!obs) return {}
  const info: ObsInfo = {}
  obs.split('|').forEach(part => {
    const p = part.trim()
    if (p.startsWith('Categoria origem:')) info.categoriaOrigem = p.replace('Categoria origem:', '').trim()
    else if (p.startsWith('Cód. Sistema:')) info.codigo = p.replace('Cód. Sistema:', '').trim()
    else if (p.startsWith('Cód. Frota:'))   info.codFrota = p.replace('Cód. Frota:', '').trim()
    else if (p.startsWith('Responsável:'))  info.responsavel = p.replace('Responsável:', '').trim()
    else if (p.startsWith('Local:'))        info.local = p.replace('Local:', '').trim()
    else if (p.startsWith('Rastreador:'))   info.rastreador = p.replace('Rastreador:', '').trim()
  })
  return info
}

/** Retorna string pronta "CÓDIGO · CATEGORIA" para exibir em cards/rows */
export function formatCodigoCategoria(v: {
  placa: string
  numero_serie?: string
  categoria: string
  tipo_ativo?: string
  observacoes?: string
  codigo_interno?: string
}): { codigo: string; categoria: string } {
  const obs = parseObsInfo(v.observacoes)
  const isMaquina = v.tipo_ativo === 'maquina'
  // Prioridade: campo dedicado codigo_interno > Cód. Sistema (obs) > Cód. Frota (obs) > numero_serie (maquina) > placa
  const codigo = v.codigo_interno || obs.codigo || obs.codFrota || (isMaquina && v.numero_serie) || v.placa
  const categoria = obs.categoriaOrigem || v.categoria.toUpperCase()
  return { codigo, categoria }
}
