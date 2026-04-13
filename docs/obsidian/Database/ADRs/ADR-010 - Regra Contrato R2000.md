---
tipo: adr
id: ADR-010
titulo: "Contrato obrigatório para recorrente ou serviço > R$2000"
status: aceito
data: 2026-04-01
autor: Time DEV
tags: [adr, contratos, regra-negocio, compras]
---

# ADR-010 — Regra de Contrato Obrigatório (R$ 2.000)

## Status
✅ Aceito

## Contexto
Nem toda compra precisa de contrato formal. Materiais de baixo valor não justificam o processo contratual. Porém, serviços de maior valor e compras recorrentes precisam de formalização.

## Decisão
Contrato é obrigatório quando:
- Requisição é **recorrente** (`is_recorrente = true`), OU
- Categoria é **serviço** (`cat_tipo = 'servico'`) E valor estimado **> R$ 2.000**

```typescript
const deveContrato = isRecorrente || (catTipo === 'servico' && valor > 2000)
```

## Alternativas Consideradas
1. **Contrato sempre obrigatório** — Burocracia excessiva para compras pequenas
2. **Limite R$ 5.000** — Muito alto, serviços médios ficariam sem contrato
3. **Por módulo/categoria** — Complexidade de configuração sem ganho claro

## Consequências
### Positivas
- Equilíbrio entre controle e agilidade
- Compras pequenas de material fluem rápido
- Serviços formalizados protegem a empresa

### Negativas
- Valor fixo (R$ 2.000) pode precisar de reajuste com inflação
- Não considera complexidade do serviço, apenas valor

## Implementação
- `FilaCotacoes.tsx` — Alerta visual quando `deveContrato`
- `CotacaoForm.tsx` — Campo de vinculação ao contrato habilitado
- `27 - Módulo Contratos Gestão` — Documentação da regra

## Links
- [[27 - Módulo Contratos Gestão]]
- [[11 - Fluxo Requisição]]
- [[40 - ADRs Index]]
