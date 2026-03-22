import type { GrupoContrato } from '../types/contratos'

export const GRUPO_CONTRATO_OPTIONS: { value: GrupoContrato; label: string; subtipos?: { value: string; label: string }[] }[] = [
  { value: 'locacao_imovel', label: 'Locação de Imóvel', subtipos: [
    { value: 'alojamento', label: 'Alojamento' },
    { value: 'canteiro', label: 'Canteiro de Obras' },
    { value: 'deposito', label: 'Depósito' },
  ]},
  { value: 'locacao_veiculos', label: 'Locação de Veículos' },
  { value: 'locacao_equipamentos', label: 'Locação de Equipamentos/Máquinas', subtipos: [
    { value: 'equipamentos', label: 'Equipamentos' },
    { value: 'ferramental', label: 'Ferramental' },
  ]},
  { value: 'equipe_pj', label: 'Equipe PJ' },
  { value: 'prestacao_servicos', label: 'Prestação de Serviços', subtipos: [
    { value: 'terceiros', label: 'Terceiros' },
    { value: 'pontual', label: 'Pontual' },
  ]},
  { value: 'servico_recorrente', label: 'Serviço Recorrente', subtipos: [
    { value: 'vigilancia', label: 'Vigilância e Monitoramento' },
    { value: 'ti', label: 'Software e TI' },
    { value: 'contabilidade', label: 'Contabilidade' },
    { value: 'telefonia', label: 'Internet e Telefonia' },
    { value: 'medicos', label: 'Serviços Médicos' },
  ]},
  { value: 'aquisicao', label: 'Aquisição', subtipos: [
    { value: 'equipamentos', label: 'Equipamentos' },
    { value: 'veiculos', label: 'Veículos' },
    { value: 'imovel', label: 'Imóvel' },
    { value: 'ferramental', label: 'Ferramental' },
  ]},
  { value: 'subcontratacao_empreitada', label: 'Subcontratação / Empreitada', subtipos: [
    { value: 'subcontratacao', label: 'Subcontratação' },
    { value: 'empreitada', label: 'Empreitada' },
  ]},
  { value: 'consultoria_juridico', label: 'Consultoria / Jurídico', subtipos: [
    { value: 'consultoria', label: 'Consultoria' },
    { value: 'advocacia', label: 'Advocacia' },
  ]},
  { value: 'apoio_operacional', label: 'Apoio Operacional', subtipos: [
    { value: 'alimentacao', label: 'Alimentação / Restaurante' },
    { value: 'hospedagem', label: 'Hospedagem' },
    { value: 'frete', label: 'Frete / Transportes' },
  ]},
  { value: 'seguros', label: 'Seguros' },
  { value: 'outro', label: 'Outro' },
]

export const GRUPO_CONTRATO_LABEL: Record<GrupoContrato, string> = Object.fromEntries(
  GRUPO_CONTRATO_OPTIONS.map(o => [o.value, o.label])
) as Record<GrupoContrato, string>
