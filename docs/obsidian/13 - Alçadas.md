---
title: Alçadas de Aprovação
type: regra-de-negócio
status: ativo
tags: [alçadas, aprovação, limites, financeiro, regras]
criado: 2026-03-02
relacionado: ["[[12 - Fluxo Aprovação]]", "[[07 - Schema Database]]", "[[09 - Auth Sistema]]"]
---

# Alçadas de Aprovação — TEG+ ERP

## O que é Alçada?

Alçada é o **limite de autoridade financeira** de cada nível hierárquico para aprovar compras. Quanto maior o valor da requisição, maior o nível de aprovação exigido.

---

## Tabela de Alçadas

| Nível | Cargo | Valor Mínimo | Valor Máximo | Prazo | Tipo de Aprovação |
|-------|-------|-------------|-------------|-------|-------------------|
| **1** | Coordenador | R$ 0,01 | R$ 5.000,00 | 24h | Único nível |
| **2** | Gerente | R$ 5.001,00 | R$ 25.000,00 | 24h | Precisa de N1 antes |
| **3** | Diretor | R$ 25.001,00 | R$ 100.000,00 | 48h | Precisa de N1+N2 antes |
| **4** | CEO | R$ 100.001,00 | Sem limite | 72h | Precisa de N1+N2+N3 antes |

---

## Lógica de Determinação

```sql
CREATE OR REPLACE FUNCTION determinar_alcada(valor numeric)
RETURNS integer AS $$
BEGIN
  IF valor > 100000 THEN
    RETURN 4;
  ELSIF valor > 25000 THEN
    RETURN 3;
  ELSIF valor > 5000 THEN
    RETURN 2;
  ELSE
    RETURN 1;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### Exemplos práticos:

| Requisição | Valor | Alçada | Aprovações Necessárias |
|-----------|-------|--------|----------------------|
| 10 capacetes | R$ 250,00 | 1 | Coordenador |
| Ferramentas obra | R$ 8.500,00 | 2 | Coordenador → Gerente |
| Locação de guindaste | R$ 45.000,00 | 3 | Coordenador → Gerente → Diretor |
| Transformador 138kV | R$ 250.000,00 | 4 | Coordenador → Gerente → Diretor → CEO |

---

## Schema SQL (`apr_alcadas`)

```sql
CREATE TABLE apr_alcadas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nivel       integer NOT NULL UNIQUE CHECK (nivel BETWEEN 1 AND 4),
  cargo       varchar(100) NOT NULL,
  valor_min   numeric(12,2) NOT NULL,
  valor_max   numeric(12,2),         -- NULL = sem limite
  prazo_horas integer NOT NULL DEFAULT 24,
  descricao   text,
  criado_em   timestamp DEFAULT now()
);

-- Dados iniciais
INSERT INTO apr_alcadas (nivel, cargo, valor_min, valor_max, prazo_horas) VALUES
  (1, 'Coordenador', 0, 5000, 24),
  (2, 'Gerente', 5001, 25000, 24),
  (3, 'Diretor', 25001, 100000, 48),
  (4, 'CEO', 100001, NULL, 72);
```

---

## Alçada por Categoria

Algumas categorias têm regras específicas de alçada **além do valor**:

| Categoria | Regra Especial |
|-----------|---------------|
| Frota/Equipamentos | Sempre mínimo Nível 2 (Gerente) |
| Locação | Sempre mínimo Nível 2 (Gerente) |
| Serviços | Sempre mínimo Nível 2 (Gerente) |
| Mobilização | Sempre mínimo Nível 3 (Diretor) |
| Demais categorias | Segue tabela padrão por valor |

---

## Aprovação Sequencial

```
R$ 30.000 (Nível 3 — Diretor)

Aprovação N1 (Coordenador)
    ↓ Aprovado
Aprovação N2 (Gerente)
    ↓ Aprovado
Aprovação N3 (Diretor)
    ↓ Aprovado
REQUISIÇÃO APROVADA ✅
```

**Regra crítica:** Se qualquer nível rejeitar, a requisição é **cancelada imediatamente** — não avança para próximos níveis.

---

## Expiração de Aprovações

| Situação | Comportamento |
|----------|--------------|
| Aprovação dentro do prazo | Normal |
| Prazo expirado (aprovador não respondeu) | Status → `expirada` |
| Aprovação expirada | Pode ser reemitida pelo comprador/admin |
| Requisição com aprovação expirada | Fica em `em_aprovacao` até ação |

---

## Campos de Alçada no Perfil de Usuário

```ts
// No sys_perfis
{
  nivel_alcada: 2,  // Gerente → pode aprovar até R$25.000
  role: 'aprovador'
}
```

**Importante:** `nivel_alcada` no perfil ≠ alçada calculada por valor.
- `nivel_alcada` do perfil = poder de aprovação do usuário
- `alcada_nivel` da requisição = nível exigido pelo valor

---

## Visualização no Dashboard

```
┌─────────────────────────────────────────────────┐
│  APROVAÇÕES PENDENTES — SUA ALÇADA             │
│                                                 │
│  ● RC-202602-0042  SE Frutal   R$250   Nível 1 │
│  ● RC-202602-0038  SE Paracatu R$3.2k  Nível 1 │
│  ● RC-202602-0035  SE Perdizes R$18k   Nível 2 │
│                                                 │
│  [Ver todas aprovações pendentes →]             │
└─────────────────────────────────────────────────┘
```

---

## Função de Determinação de Alçada

A função `apr_determinar_alcada()` é chamada automaticamente ao criar uma aprovação. Ela analisa o valor da requisição e retorna o nível máximo de alçada necessário:

```sql
-- Exemplo de uso na criação de aprovação
SELECT apr_determinar_alcada(valor_total) AS nivel_alcada
FROM cmp_requisicoes WHERE id = :req_id;
```

O resultado define quantos níveis sequenciais de aprovação são criados em `apr_aprovacoes`.

---

## Aprovação via Token (sem login)

Aprovadores podem aprovar/rejeitar sem fazer login no sistema, diretamente via:

- **WhatsApp:** link com token único enviado via n8n
- **E-mail:** botão de aprovação no corpo do e-mail

O token é gerado com validade igual ao prazo da alçada (24h/48h/72h) e permite ação única (aprovar ou rejeitar com observação).

---

## Integração com AprovAI

O sistema de alçadas é usado por múltiplos tipos de aprovação via [[12 - Fluxo Aprovação|AprovAI]]:

| Tipo de Aprovação | Origem |
|-------------------|--------|
| Compras (requisições) | Módulo Compras |
| Pagamentos | Módulo Financeiro |
| Minutas contratuais | Módulo Contratos |
| Validação técnica | Requisições especiais |
| Transportes | Módulo Logística |

---

## Hierarquia de Roles

```
requisitante < comprador < aprovador < supervisor < gerente/diretor < ceo
```

Cada role define o escopo de ação no sistema. A alçada é verificada contra o `nivel_alcada` do perfil do aprovador.

---

## Links Relacionados

- [[12 - Fluxo Aprovação]] — Como as alçadas são usadas no fluxo
- [[07 - Schema Database]] — Tabela apr_alcadas
- [[09 - Auth Sistema]] — Roles e nivel_alcada no perfil
- [[14 - Compradores e Categorias]] — Alçadas especiais por categoria
