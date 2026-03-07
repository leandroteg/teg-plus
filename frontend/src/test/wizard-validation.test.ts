import { describe, it, expect } from 'vitest'

function validateStep2(
  solicitante: string,
  obraNome: string,
  descricao: string,
  itens: Array<{ descricao: string }>
): string[] {
  const errs: string[] = []
  if (!solicitante.trim()) errs.push('Informe o nome do solicitante')
  if (!obraNome) errs.push('Selecione a obra')
  if (!descricao.trim()) errs.push('Informe a descricao')
  if (itens.every(i => !i.descricao.trim())) errs.push('Adicione ao menos um item')
  return errs
}

describe('NovaRequisicao Step2 validation', () => {
  it('retorna 4 erros quando todos os campos estao vazios', () => {
    expect(validateStep2('', '', '', [{ descricao: '' }])).toHaveLength(4)
  })

  it('retorna zero erros quando tudo preenchido', () => {
    expect(validateStep2('Joao', 'SE Frutal', 'Cabo XLPE', [{ descricao: 'Cabo' }])).toHaveLength(0)
  })

  it('detecta solicitante vazio isoladamente', () => {
    expect(validateStep2('', 'SE Frutal', 'Cabo', [{ descricao: 'Cabo' }])).toEqual(['Informe o nome do solicitante'])
  })
})
