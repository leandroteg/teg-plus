export interface Camera {
  id: string
  nome: string
  local: string | null
  canal: number
  nvrNome: string | null
  streamKey: string | null
  ptz: boolean
  ordem: number
  ativo: boolean
  observacoes: string | null
}

export interface MonEvento {
  id: string
  cameraId: string | null
  cameraNome: string | null
  canal: number | null
  tipo: string
  alvo: string | null      // human | vehicle | null
  estado: string | null    // active | inactive
  snapshotPath: string | null
  ocorreuEm: string
}
