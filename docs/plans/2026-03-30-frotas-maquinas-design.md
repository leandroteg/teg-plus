# Módulo Frotas & Máquinas — Design Doc
**Data:** 2026-03-30
**Status:** Aprovado
**Scope:** Redesign completo do módulo `/frotas` — veículos, máquinas (tratores, guindastes, muncks), manutenção, operação e controle

---

## 1. Contexto

O módulo atual possui estrutura básica (Veículos, Ordens, Checklists, Abastecimentos, Telemetria) mas está incompleto. Este redesign cobre:
- Máquinas pesadas além de veículos
- Pipeline de custódia (entrada → pátio → saída → alocado)
- OS com pipeline kanban 6 estágios
- Checklists digitais de locadora (entrega/devolução)
- Multas, pedágios, acessórios
- Agenda de alocação (Gantt/calendário)
- Integrações Patrimonial, Contratos, Financeiro

---

## 2. Estrutura de Menu (4 itens)

```
/frotas                     → Painel
/frotas/frota               → Frota & Máquinas  (4 sub-abas)
/frotas/manutencao          → Manutenção         (4 sub-abas)
/frotas/operacao            → Operação & Controle (5 sub-abas)
```

---

## 3. Painel (`/frotas`)

**Propósito:** Visão executiva — estado atual da frota inteira + alertas críticos.

### KPI Cards (linha 1)
| KPI | Descrição |
|-----|-----------|
| Total da Frota | Veículos + Máquinas ativos |
| Disponíveis | Status = disponivel no pátio |
| Alocados | Em uso em obra/responsável |
| Em Manutenção | Status = em_manutencao ou bloqueado |
| Custo do Mês | Soma OS concluídas + abastecimentos + multas |
| Disponibilidade % | gauge circular |

### Alertas Ativos
- Documentos vencendo em ≤ 30 dias (CRLV, seguro, tacógrafo, CNH operador)
- Preventivas atrasadas (km vencido ou data vencida)
- OS críticas/altas em aberto
- Contratos de locação vencendo em ≤ 30 dias

### Grid Visual de Status da Frota
- Chip por veículo/máquina: placa + dot colorido de status
- Hover: tooltip com modelo, responsável, OS em aberto

### Mini-Agenda
- Próximas 7 dias: alocações e preventivas agendadas

---

## 4. Frota & Máquinas (`/frotas/frota`)

**Propósito:** Pipeline de custódia — ciclo completo de entrada, pátio, saída e alocação.

### Sub-abas

#### 4.1 Em Entrada
Veículos/máquinas em processo de recebimento (chegada de obra, chegada de locadora).

**Fluxo:** Clica "+ Registrar Entrada" → wizard:
1. Identificar ativo (placa/série) — busca ou cadastro novo
2. Tipo de entrada: `retorno_obra | chegada_locacao | aquisicao`
3. Checklist de entrada (fotos obrigatórias: frente, traseira, laterais, avarias)
4. Hodômetro / horímetro de entrada
5. Confirmar → ativo vai para **Pátio**

Cards com: placa, modelo, tipo entrada, responsável pela vistoria, data/hora.

#### 4.2 Pátio
Ativos disponíveis na base, prontos para alocação.

**Visão:** Cards em grid — cada card mostra:
- Placa + modelo + categoria (badge: veículo / máquina)
- Propriedade: `próprio` | `locado` (com nome da locadora e vencimento do contrato)
- KM/Horímetro atual
- Próxima preventiva (verde/amarelo/vermelho)
- Documentos críticos (CRLV, seguro) com status vencimento
- **Badge de OS** em aberto mais crítica (ex: `🔧 Corretiva · Em Execução`) — clicável
- Acessórios vinculados (chip: "Munck", "Carroceria", "Guincho")
- Botões: `Alocar` | `Enviar para Manutenção` | `Checklist Saída`

#### 4.3 Checklist Saída
Ativos com saída pendente de checklist — bloqueiam saída até conclusão.

**Fluxo:** Checklist digital (template por tipo de ativo) com:
- Itens de vistoria (pneus, luzes, fluidos, carroceria, etc.)
- Campo de avarias com foto
- Assinatura digital do motorista/operador
- Hodômetro/horímetro de saída
- Confirmar → ativo vai para **Alocados**

#### 4.4 Alocados
Ativos em uso — vinculados a obra, responsável e data prevista de retorno.

**Visão:** Tabela + toggle card — colunas:
- Ativo (placa/série + modelo)
- Obra / Centro de Custo
- Responsável (colaborador ou terceiro)
- Saída em / Retorno previsto
- KM/Hs saída
- **Badge OS** em aberto (igual ao Pátio)
- Posição GPS (se telemetria ativa)
- Ação: `Registrar Retorno`

**Registrar Retorno** → dispara fluxo de entrada (checklist de devolução).

### Cadastro de Ativo
Modal/wizard "+ Novo Ativo":
1. **Tipo:** Veículo (placa obrigatória) | Máquina (número de série)
2. **Dados:** marca, modelo, ano, categoria, combustível/energia
3. **Propriedade:**
   - `Próprio` → vincula item no módulo Patrimonial (cria ou seleciona)
   - `Locado` → vincula contrato no módulo Contratos (locação)
   - `Cedido` → empresa cedente, prazo
4. **Documentos:** CRLV, seguro, tacógrafo, CNH operador (datas vencimento)
5. **Acessórios:** lista de acessórios vinculados (munck, carroceria, etc.)
6. **Preventiva:** km/hs ou data da próxima

---

## 5. Manutenção (`/frotas/manutencao`)

### Sub-abas

#### 5.1 Planejamento
Calendário de manutenções preventivas programadas.

- Visão mensal/semanal (calendário)
- Cada evento: ativo + tipo de serviço + km/hs gatilho + data estimada
- Alertas automáticos: preventiva vencida (vermelho), em 7 dias (amarelo), em 30 dias (verde)
- Botão "+ Agendar Preventiva" — define ativo, serviço, km/data gatilho, oficina
- Ao executar → gera OS automaticamente

#### 5.2 Checklists
Templates e histórico de execuções.

**Templates** (CRUD):
- `pré_viagem` — inspeção diária motorista
- `pós_viagem` — devolução ao pátio
- `entrega_locadora` — saída para locadora
- `devolução_locadora` — recebimento de locadora
- `pré_manutenção` — entrada em oficina
- `pós_manutenção` — saída da oficina
- Customizável por categoria de ativo

**Histórico de execuções:** tabela com filtros por ativo, tipo, período, responsável. Cada linha abre checklist completo com fotos.

#### 5.3 OS Abertas
Pipeline kanban 6 colunas:

```
Pendente → Cotação → Em Aprovação → Aprovada → Em Execução → Concluída
```

Cada card mostra:
- Número OS + ativo (placa/série)
- Tipo: `preventiva | corretiva | sinistro | revisão`
- Prioridade badge: `crítica` (vermelho) | `alta` (laranja) | `média` (amarelo) | `baixa` (cinza)
- Oficina / fornecedor
- Valor estimado → valor real (após conclusão)
- Dias em aberto

**Abrir OS:** botão "+ Nova OS" — ativo, tipo, prioridade, problema, oficina, itens (peças + mão de obra).

**Aprovação:** OS em "Em Aprovação" dispara notificação para aprovador (integração com módulo Aprovações se valor > threshold).

#### 5.4 Histórico
Timeline completa de manutenção por ativo.

- Filtros: ativo, tipo OS, período, fornecedor, status
- Cada linha: OS#, data, tipo, serviço realizado, peças, custo total
- Expandir: detalhes completos, itens, NF vinculada
- KPIs no topo: custo total período, média custo/OS, OS por tipo (pizza)

---

## 6. Operação & Controle (`/frotas/operacao`)

### Sub-abas

#### 6.1 Agenda de Alocação
Calendário Gantt visual — quem tem o quê, por quanto tempo, para qual obra.

- **Visão Gantt:** eixo Y = ativos, eixo X = tempo (semana/mês)
- Cada barra: responsável + obra + cor por status
- **Visão Calendário:** filtro por ativo ou por obra
- **Solicitar Alocação:** "+ Nova Alocação" — ativo, obra/CC, responsável, período, finalidade
- Conflito detectado automaticamente (ativo já alocado no período)

#### 6.2 Abastecimentos
Log de abastecimentos com custo/km.

- Tabela: data, ativo, hodômetro, litros, valor, posto, tipo combustível, responsável
- "+ Registrar Abastecimento" — modal simples
- KPIs: custo total mês, média L/100km por ativo, ranking de consumo
- Alerta de consumo atípico (desvio > 20% da média)

#### 6.3 Multas & Pedágios
Controle de infrações e custos de pedágio.

**Multas:**
- Registro: ativo, data infração, tipo, valor, AIT, motorista responsável, obra
- Status: `recebida | contestada | paga | vencida`
- Vínculo com colaborador (desconto em folha — futura integração RH)
- Vínculo com obra (apropriação de custo)

**Pedágios:**
- Registro manual ou importação de extrato tag
- Vínculo com viagem/obra para custeio

#### 6.4 Telemetria
Ocorrências de comportamento e posicionamento.

- Feed de ocorrências: excesso velocidade, frenagem brusca, aceleração brusca, fora de área, parada não autorizada
- Status: `registrada → analisada → comunicado_rh → encerrada`
- Mapa de posição atual (se integração GPS ativa)
- Histórico de rotas por ativo/período

#### 6.5 Indicadores
Painel analítico — gestão por dados.

| Indicador | Cálculo |
|-----------|---------|
| Custo/km | (OS + abastecimento + multas) / km rodado |
| Disponibilidade % | dias disponível / dias do período |
| MTBF | média de km/tempo entre falhas |
| Custo por Obra | soma todos os custos do ativo alocado à obra |
| Ranking Consumo | ativos por litros/100km |
| Custo Manutenção/mês | tendência últimos 12 meses (gráfico linha) |

---

## 7. Integrações

| Módulo | Trigger | Ação |
|--------|---------|------|
| **Patrimonial** | Cadastro ativo próprio | Cria/vincula item patrimonial `pat_itens` |
| **Contratos** | Cadastro ativo locado | Vincula contrato de locação, alerta vencimento |
| **Financeiro (CP)** | OS aprovada/concluída | Gera conta a pagar para oficina |
| **Financeiro** | Multa registrada | Gera lançamento de custo |
| **Aprovações** | OS > threshold de valor | Dispara fluxo de aprovação |
| **Obras** | Alocação vinculada a obra | Custo aparece no painel da obra |

---

## 8. Banco de Dados — Novas Tabelas

Prefixo `fro_`

| Tabela | Descrição |
|--------|-----------|
| `fro_veiculos` | Já existe — adicionar campos: `tipo_ativo`, `numero_serie`, `horimetro_atual`, `pat_item_id`, `con_contrato_id` |
| `fro_acessorios` | Acessórios vinculáveis (munck, carroceria, guincho) |
| `fro_veiculo_acessorios` | Pivô veículo ↔ acessório |
| `fro_alocacoes` | Histórico de alocações (ativo, responsável, obra, período, checklist saída/entrada) |
| `fro_checklist_templates` | Templates de checklist por tipo |
| `fro_checklist_itens` | Itens de cada template |
| `fro_checklist_execucoes` | Execução preenchida (vínculo ativo + template + fotos) |
| `fro_ordens_servico` | Já existe — adicionar: `pat_item_id`, fluxo 6 estágios |
| `fro_multas` | Infrações e pedágios |
| `fro_abastecimentos` | Já existe — revisar campos |
| `fro_telemetria_ocorrencias` | Já existe |

---

## 9. Padrões UI/UX

- **Cores de status ativo:** emerald (disponível) · sky (em uso/alocado) · amber (manutenção) · red (bloqueado) · slate (baixado)
- **Cores OS prioridade:** red (crítica) · orange (alta) · amber (média) · slate (baixa)
- **Badges:** rounded-full, 10px, uppercase, border + bg com opacidade
- **Cards:** rounded-2xl, shadow suave, border white/6 (dark) ou slate-200 (light)
- **Kanban:** colunas com scroll independente, drag-and-drop opcional fase 2
- **Tabelas:** sticky header, zebra striping leve, ações inline no hover
- **Modais:** overlay escuro, max-w-2xl, scroll interno, sticky footer com botões

---

## 9b. Integrações Externas — Arquitetura de Adaptador

### Abastecimento — Cartão Frota (Veloe / Ticket / outros)
- Tabela `fro_integracao_cartao`: `provider` (veloe | ticket | sem_parar | manual), `api_key_enc`, `last_sync_at`
- n8n workflow `POST /frotas/sync-cartao`: busca extrato da API do provider → normaliza → insere em `fro_abastecimentos` com campo `origem = 'cartao_veloe'`
- UI: botão "Importar Extrato" + badge "Última sync HH:mm" na aba Abastecimentos
- Registros manuais continuam funcionando em paralelo
- Troca de provider: só muda config na tabela + ajusta n8n, zero mudança no frontend

### Telemetria — GPS/Rastreador (Cobli / Omnilink / outros)
- Tabela `fro_integracao_telemetria`: `provider` (cobli | omnilink | rastreio | samsara), `device_id` por veículo, `webhook_secret`
- Cobli e maioria dos providers enviam webhooks de eventos → n8n recebe em `POST /frotas/telemetria-webhook` → normaliza → insere em `fro_telemetria_ocorrencias`
- Dados capturados: posição lat/lng, velocidade, ignição on/off, odômetro, eventos de comportamento (excesso velocidade, frenagem brusca, etc.), histórico de rotas
- **Compartilhamento com Logística:** view `fro_posicao_atual` (posição mais recente por veículo) consumida pelo módulo Transportes para acompanhamento de rota em tempo real — sem duplicar dados, sem acoplamento direto
- Troca de provider: só muda webhook_secret + ajusta parser no n8n

---

## 10. Fases de Implementação

### Fase 1 — Core (prioridade alta)
- [ ] Migration DB: novas tabelas + alterações existentes
- [ ] Frota & Máquinas: Pátio + Alocados (refactor Veiculos.tsx)
- [ ] Frota & Máquinas: Em Entrada + Checklist Saída (novo)
- [ ] Manutenção: OS Abertas — pipeline 6 estágios (refactor Ordens.tsx)
- [ ] Manutenção: Checklists — templates + execução digital (refactor Checklists.tsx)

### Fase 2 — Operação
- [ ] Operação: Agenda de Alocação (Gantt/calendário)
- [ ] Operação: Abastecimentos (refactor Abastecimentos.tsx)
- [ ] Operação: Multas & Pedágios (novo)
- [ ] Manutenção: Planejamento preventivo (calendário)
- [ ] Manutenção: Histórico OS

### Fase 3 — Analytics & Integrações
- [ ] Painel: refactor FrotasHome com novos KPIs + mini-agenda
- [ ] Operação: Indicadores analíticos
- [ ] Integrações: Patrimonial, Contratos, Financeiro
- [ ] Telemetria: refactor + mapa GPS

---

## 11. Arquivos a Criar/Modificar

```
frontend/src/pages/frotas/
  FrotasHome.tsx              ← refactor
  frota/
    FrotaHome.tsx             ← novo (container 4 abas)
    EmEntrada.tsx             ← novo
    Patio.tsx                 ← novo (refactor Veiculos.tsx)
    ChecklistSaida.tsx        ← novo
    Alocados.tsx              ← novo
  manutencao/
    ManutencaoHome.tsx        ← novo (container 4 abas)
    Planejamento.tsx          ← novo
    Checklists.tsx            ← refactor
    OSAbertas.tsx             ← refactor Ordens.tsx
    HistoricoOS.tsx           ← novo
  operacao/
    OperacaoHome.tsx          ← novo (container 5 abas)
    AgendaAlocacao.tsx        ← novo
    Abastecimentos.tsx        ← refactor
    MultasPedagios.tsx        ← novo
    Telemetria.tsx            ← refactor
    Indicadores.tsx           ← novo

frontend/src/types/frotas.ts  ← expandir
frontend/src/hooks/useFrotas.ts ← expandir
supabase/068_fro_redesign.sql ← migration
```


## Links
- [[obsidian/24 - Módulo Frotas e Manutenção]]
