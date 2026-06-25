import type { ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

// Escolhe a versão mobile (<lg) OU desktop (lg+) de um painel — renderiza só uma
// (não monta a árvore desktop pesada no celular). O desktop nunca é modificado;
// aqui apenas decidimos QUAL renderizar.
export default function ResponsivePainel({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  const isMobile = useIsMobile()
  return <>{isMobile ? mobile : desktop}</>
}
