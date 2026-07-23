// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/obrasFiltros.tsx — barra de filtros PADRÃO da Gestão de Obras.
// Mesma caixa de seleção múltipla do EGP (MultiSelect), usada IDÊNTICA em todas
// as abas: Projeto · Tipo · Valor · Ano. Opções sempre ordenadas.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MultiSelect, togFiltro } from '../pmo/paineis/egpFiltros'
import type { EGPOscRow } from '../../hooks/usePMO'

export interface ObrasFiltros {
  fProjeto: Set<string>; setFProjeto: React.Dispatch<React.SetStateAction<Set<string>>>
  fTipo: Set<string>; setFTipo: React.Dispatch<React.SetStateAction<Set<string>>>
  fValor: Set<string>; setFValor: React.Dispatch<React.SetStateAction<Set<string>>>
  fAno: Set<string>; setFAno: React.Dispatch<React.SetStateAction<Set<string>>>
}

export function useObrasFiltros(): ObrasFiltros {
  const [fProjeto, setFProjeto] = useState<Set<string>>(new Set())
  const [fTipo, setFTipo] = useState<Set<string>>(new Set())
  const [fValor, setFValor] = useState<Set<string>>(new Set())
  const [fAno, setFAno] = useState<Set<string>>(new Set())
  return { fProjeto, setFProjeto, fTipo, setFTipo, fValor, setFValor, fAno, setFAno }
}

export const VALOR_OPTS = [
  { value: 'gt1m', label: '> R$ 1 mi' },
  { value: 'mid', label: 'R$ 100 mil – 1 mi' },
  { value: 'lt100k', label: '< R$ 100 mil' },
]
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()

/** OSCs válidas agrupadas por obra (exclui canceladas) */
export function agruparOscsPorObra(oscs: EGPOscRow[]) {
  const m = new Map<string, EGPOscRow[]>()
  for (const o of oscs) {
    if (!o.obra_id || o.etapa_atual === 'cancelada') continue
    const a = m.get(o.obra_id) ?? []; a.push(o); m.set(o.obra_id, a)
  }
  return m
}

/** true se a obra passa nos 4 filtros */
export function obraPassa(
  obra: { id: string; pmo_projeto_id: string | null },
  oscsPorObra: Map<string, EGPOscRow[]>,
  f: ObrasFiltros,
): boolean {
  if (f.fProjeto.size && !(obra.pmo_projeto_id && f.fProjeto.has(obra.pmo_projeto_id))) return false
  const arr = oscsPorObra.get(obra.id) ?? []
  if (f.fTipo.size && !arr.some(x => x.tipo && f.fTipo.has(x.tipo))) return false
  if (f.fAno.size && !arr.some(x => f.fAno.has((x.data_osc ?? '').slice(0, 4)))) return false
  if (f.fValor.size && !arr.some(x => {
    const v = x.valor ?? 0
    return (f.fValor.has('gt1m') && v > 1_000_000)
      || (f.fValor.has('mid') && v >= 100_000 && v <= 1_000_000)
      || (f.fValor.has('lt100k') && v < 100_000)
  })) return false
  return true
}

export function ObrasFiltrosBar({ projetos, oscs, f, isDark, onChange, children }: {
  projetos: { id: string; nome: string }[]
  oscs: EGPOscRow[]
  f: ObrasFiltros
  isDark: boolean
  /** chamado a cada mudança (ex.: resetar a obra selecionada) */
  onChange?: () => void
  /** controles extras à direita (busca, contador, botões) */
  children?: ReactNode
}) {
  const projetosOrd = useMemo(() => [...projetos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [projetos])
  const tipos = useMemo(() => ([...new Set(oscs.map(o => o.tipo).filter(Boolean))] as string[])
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [oscs])
  const anos = useMemo(() => [...new Set(oscs.map(o => (o.data_osc ?? '').slice(0, 4)).filter(Boolean))]
    .sort().reverse(), [oscs])

  const tog = (v: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) => { togFiltro(v, set); onChange?.() }
  const lim = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => { set(new Set()); onChange?.() }

  return (
    <>
      <MultiSelect label="Projeto" options={projetosOrd.map(p => ({ value: p.id, label: p.nome }))} selected={f.fProjeto}
        onToggle={v => tog(v, f.setFProjeto)} onClear={() => lim(f.setFProjeto)} isDark={isDark} compacto />
      <MultiSelect label="Tipo" options={tipos.map(t => ({ value: t, label: cap(t) }))} selected={f.fTipo}
        onToggle={v => tog(v, f.setFTipo)} onClear={() => lim(f.setFTipo)} isDark={isDark} compacto />
      <MultiSelect label="Valor" options={VALOR_OPTS} selected={f.fValor}
        onToggle={v => tog(v, f.setFValor)} onClear={() => lim(f.setFValor)} isDark={isDark} compacto />
      <MultiSelect label="Ano" options={anos.map(a => ({ value: a, label: a }))} selected={f.fAno}
        onToggle={v => tog(v, f.setFAno)} onClear={() => lim(f.setFAno)} isDark={isDark} compacto />
      {children}
    </>
  )
}
